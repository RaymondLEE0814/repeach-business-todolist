// 챗봇 에이전트가 쓰는 Supabase 할 일 툴.
// 모든 호출은 요청의 "로그인 세션" Supabase 클라이언트로 실행되므로 RLS(owner)로 본인 데이터만 접근.
import { Type, type FunctionDeclaration } from '@google/genai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseQuotaError, QUOTA_COPY } from '@/lib/plan';

// 무료 한도 초과(MINDASH_QUOTA:*) 에러는 챗봇용 한국어 안내로 치환, 그 외는 원문 유지.
const errMsg = (m: string) => {
  const q = parseQuotaError(m);
  return q ? `${QUOTA_COPY[q].body} 요금제는 /pricing 에서 볼 수 있어요.` : m;
};

const pad = (n: number) => String(n).padStart(2, '0');
const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toStr(new Date());
function endOfWeekStr() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return toStr(d);
}
function resolveDate(s?: string | null): string | null {
  if (!s) return null;
  const t = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const add = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return toStr(d);
  };
  if (t === '오늘' || t.toLowerCase() === 'today') return add(0);
  if (t === '내일' || t.toLowerCase() === 'tomorrow') return add(1);
  if (t === '모레') return add(2);
  const p = Date.parse(t);
  return isNaN(p) ? null : toStr(new Date(p));
}
const DIFF_MAP: Record<string, string> = {
  '쉬움': 'easy', '보통': 'normal', '어려움': 'hard', '미루던 일': 'delayed',
  easy: 'easy', normal: 'normal', hard: 'hard', delayed: 'delayed',
};
const normDiff = (d?: string | null) => (d ? DIFF_MAP[String(d).trim()] ?? 'normal' : 'normal');
const uid = () => (globalThis.crypto?.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

export type ToolCtx = {
  supabase: SupabaseClient;
  userId: string;
  currentTeamId: string | null; // null = 개인 컨텍스트
  log: (s: string) => void;
  changed: { v: boolean };
};

type Proj = { id: string; name: string; team_id: string | null };
async function getProjects(ctx: ToolCtx): Promise<Proj[]> {
  const { data } = await ctx.supabase.from('projects').select('id,name,team_id').order('created_at');
  return (data as Proj[]) ?? [];
}
// 현재 컨텍스트(팀이면 그 팀, 개인이면 team_id 없는) 프로젝트인지
const inContext = (ctx: ToolCtx) => (p: Proj) => (ctx.currentTeamId ? p.team_id === ctx.currentTeamId : !p.team_id);

function findProject(projects: Proj[], name: string | null | undefined, ctx?: ToolCtx): Proj | null {
  if (!name) return null;
  const t = String(name).trim().toLowerCase();
  const match = (list: Proj[]) =>
    list.find((p) => p.name.toLowerCase() === t) ?? list.find((p) => p.name.toLowerCase().includes(t)) ?? null;
  // ① 현재 컨텍스트 내에서 먼저, ② 없으면 전체(다른 공간을 이름으로 명시 지정한 경우)
  if (ctx) return match(projects.filter(inContext(ctx))) ?? match(projects);
  return match(projects);
}

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'list_projects',
    description: '사용자의 프로젝트(업무 공간) 이름 목록을 반환한다.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'list_todos',
    description: '할 일을 조회한다. 날짜 범위(오늘/이번주/지난일정/전체)나 프로젝트로 거를 수 있다. 기본은 미완료만.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        when: { type: Type.STRING, enum: ['today', 'week', 'overdue', 'all'], description: '오늘/이번주/지난일정/전체' },
        project: { type: Type.STRING, description: '특정 프로젝트 이름(선택)' },
        include_completed: { type: Type.BOOLEAN, description: '완료한 것도 포함할지(기본 false)' },
      },
    },
  },
  {
    name: 'add_todo',
    description: '새 할 일을 추가한다. 프로젝트/카테고리는 이름으로 찾고, 없으면 적절히 기본값을 쓴다.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: '할 일 내용(필수)' },
        project: { type: Type.STRING, description: '프로젝트 이름(선택, 없으면 추론/기본)' },
        category: { type: Type.STRING, description: '카테고리 이름(선택)' },
        due_date: { type: Type.STRING, description: '계획일 YYYY-MM-DD 또는 오늘/내일/모레' },
        difficulty: { type: Type.STRING, enum: ['easy', 'normal', 'hard', 'delayed'], description: '난이도(선택)' },
        parent: { type: Type.STRING, description: '상위 할 일 제목(선택) — 이 할 일을 그 하위로 추가' },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_todo',
    description: '미완료 할 일을 제목 부분일치로 찾아 완료 처리한다. 여러 개면 후보를 돌려준다.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: '완료할 할 일의 제목 또는 일부(필수)' },
        project: { type: Type.STRING, description: '범위를 좁힐 프로젝트(선택)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_project',
    description: '새 프로젝트를 만든다. 현재 컨텍스트(개인/팀)에 자동 생성된다.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        personal: { type: Type.BOOLEAN, description: '팀 스페이스를 보고 있어도 개인 공간에 만들려면 true' },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_category',
    description: '프로젝트 안에 새 카테고리를 만든다.',
    parameters: {
      type: Type.OBJECT,
      properties: { project: { type: Type.STRING, description: '대상 프로젝트(선택, 없으면 첫 프로젝트)' }, name: { type: Type.STRING } },
      required: ['name'],
    },
  },
];

export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolCtx): Promise<object> {
  const sb = ctx.supabase;
  try {
    switch (name) {
      case 'list_projects': {
        const ps = await getProjects(ctx);
        return { projects: ps.map((p) => p.name) };
      }
      case 'list_todos': {
        const when = String(args.when ?? 'all');
        const includeCompleted = !!args.include_completed;
        const projects = await getProjects(ctx);
        const pmap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
        let q = sb.from('todos').select('id,title,completed,due_date,project_id,difficulty');
        const proj = findProject(projects, args.project as string, ctx);
        if (proj) q = q.eq('project_id', proj.id);
        if (!includeCompleted) q = q.eq('completed', false);
        const { data, error } = await q;
        if (error) return { error: errMsg(error.message) };
        let rows = (data as { id: string; title: string; completed: boolean; due_date: string | null; project_id: string }[]) ?? [];
        const t = todayStr();
        const eow = endOfWeekStr();
        if (when === 'today') rows = rows.filter((r) => r.due_date === t);
        else if (when === 'overdue') rows = rows.filter((r) => r.due_date && r.due_date < t);
        else if (when === 'week') rows = rows.filter((r) => r.due_date && r.due_date >= t && r.due_date <= eow);
        const todos = rows.slice(0, 50).map((r) => ({ title: r.title, project: pmap[r.project_id] ?? '', due_date: r.due_date, completed: r.completed }));
        ctx.log(`list_todos when=${when} → ${todos.length}`);
        return { count: todos.length, todos };
      }
      case 'add_todo': {
        const title = String(args.title ?? '').trim();
        if (!title) return { ok: false, error: 'title 필요' };
        const projects = await getProjects(ctx);
        let proj = findProject(projects, args.project as string, ctx);
        if (!proj && args.project) {
          const id = uid();
          const nm = String(args.project).trim();
          const { error } = await sb.from('projects').insert({ id, name: nm, owner_id: ctx.userId, team_id: ctx.currentTeamId });
          if (error) return { ok: false, error: errMsg(error.message) };
          proj = { id, name: nm, team_id: ctx.currentTeamId };
          ctx.changed.v = true;
        }
        // 명시 안 하면 현재 컨텍스트(팀/개인)의 프로젝트 우선
        if (!proj) proj = projects.find(inContext(ctx)) ?? null;
        if (!proj) {
          const id = uid();
          const nm = ctx.currentTeamId ? '팀 할 일' : '내 할 일';
          const { error } = await sb.from('projects').insert({ id, name: nm, owner_id: ctx.userId, team_id: ctx.currentTeamId });
          if (error) return { ok: false, error: errMsg(error.message) };
          proj = { id, name: nm, team_id: ctx.currentTeamId };
          ctx.changed.v = true;
        }
        const { data: cats } = await sb.from('categories').select('id,name,position').eq('project_id', proj.id).order('position');
        const catList = (cats as { id: string; name: string }[]) ?? [];
        const cname = args.category ? String(args.category).trim().toLowerCase() : null;
        let cat = cname
          ? catList.find((c) => c.name.toLowerCase() === cname) ?? catList.find((c) => c.name.toLowerCase().includes(cname)) ?? null
          : catList[0] ?? null;
        if (!cat) {
          const id = uid();
          const nm = args.category ? String(args.category).trim() : '할 일';
          const { error } = await sb.from('categories').insert({ project_id: proj.id, id, name: nm, position: catList.length });
          if (error) return { ok: false, error: errMsg(error.message) };
          cat = { id, name: nm };
        }
        // 상위 할 일(parent) 지정 시: 제목 부분일치로 찾아 그 밑에 중첩 + 카테고리 상속
        let parentId: string | null = null;
        if (args.parent) {
          const pq = String(args.parent).trim().toLowerCase();
          const { data: cand } = await sb.from('todos').select('id,category_id,title').eq('project_id', proj.id);
          const matches = ((cand as { id: string; category_id: string; title: string }[]) ?? []).filter((r) =>
            r.title.toLowerCase().includes(pq)
          );
          if (matches.length === 1) {
            parentId = matches[0].id;
            cat = { id: matches[0].category_id, name: cat.name }; // 부모의 카테고리 상속
          }
        }
        const { count } = await sb.from('todos').select('*', { count: 'exact', head: true }).eq('project_id', proj.id);
        const due = resolveDate(args.due_date as string);
        const diff = normDiff(args.difficulty as string);
        const id = uid();
        const { error } = await sb.from('todos').insert({
          project_id: proj.id, id, category_id: cat.id, title, completed: false,
          notes: '', assignee: '', progress: '0', link: '', difficulty: diff, due_date: due, parent_id: parentId, position: count ?? 0,
        });
        if (error) return { ok: false, error: errMsg(error.message) };
        ctx.changed.v = true;
        ctx.log(`add_todo "${title}" → ${proj.name}/${cat.name}`);
        return { ok: true, added: { title, project: proj.name, category: cat.name, due_date: due, difficulty: diff } };
      }
      case 'complete_todo': {
        const query = String(args.query ?? '').trim();
        if (!query) return { ok: false, error: 'query 필요' };
        const projects = await getProjects(ctx);
        const pmap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
        let q = sb.from('todos').select('id,title,project_id,category_id').eq('completed', false);
        const proj = findProject(projects, args.project as string, ctx);
        if (proj) q = q.eq('project_id', proj.id);
        const { data, error } = await q;
        if (error) return { ok: false, error: errMsg(error.message) };
        const ql = query.toLowerCase();
        const matches = ((data as { id: string; title: string; project_id: string; category_id: string }[]) ?? []).filter((r) =>
          r.title.toLowerCase().includes(ql)
        );
        if (matches.length === 0) return { ok: false, message: `'${query}'에 맞는 미완료 할 일을 찾지 못했어요.` };
        if (matches.length > 1)
          return {
            ok: false,
            ambiguous: true,
            candidates: matches.slice(0, 8).map((m) => ({ title: m.title, project: pmap[m.project_id] ?? '' })),
            message: '여러 개가 매칭돼요. 더 구체적으로 알려주세요.',
          };
        const m = matches[0];
        const { error: upErr } = await sb
          .from('todos')
          .update({ completed: true, completed_by: ctx.userId, completed_at: new Date().toISOString() })
          .eq('id', m.id)
          .eq('category_id', m.category_id);
        if (upErr) return { ok: false, error: upErr.message };
        ctx.changed.v = true;
        ctx.log(`complete_todo "${m.title}"`);
        return { ok: true, completed: { title: m.title, project: pmap[m.project_id] ?? '' } };
      }
      case 'create_project': {
        const name = String(args.name ?? '').trim();
        if (!name) return { ok: false, error: 'name 필요' };
        const teamId = args.personal ? null : ctx.currentTeamId; // 팀 컨텍스트면 팀에, personal=true면 개인에
        const id = uid();
        const { error } = await sb.from('projects').insert({ id, name, owner_id: ctx.userId, team_id: teamId });
        if (error) return { ok: false, error: errMsg(error.message) };
        ctx.changed.v = true;
        return { ok: true, project: name, space: teamId ? '팀' : '개인' };
      }
      case 'create_category': {
        const projects = await getProjects(ctx);
        const proj = findProject(projects, args.project as string, ctx) ?? projects.find(inContext(ctx));
        if (!proj) return { ok: false, error: '프로젝트가 없어요. 먼저 프로젝트를 만들어 주세요.' };
        const name = String(args.name ?? '').trim();
        if (!name) return { ok: false, error: 'name 필요' };
        const { data: cats } = await sb.from('categories').select('id').eq('project_id', proj.id);
        const id = uid();
        const { error } = await sb.from('categories').insert({ project_id: proj.id, id, name, position: cats?.length ?? 0 });
        if (error) return { ok: false, error: errMsg(error.message) };
        ctx.changed.v = true;
        return { ok: true, category: name, project: proj.name };
      }
      default:
        return { error: `알 수 없는 함수: ${name}` };
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
}
