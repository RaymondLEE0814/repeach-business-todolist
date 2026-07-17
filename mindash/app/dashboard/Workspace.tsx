'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { createClient } from '@/lib/supabase/client';
import { buildTree, subtreeStats, collectSubtreeIds, type Node } from './tree';
import { DraggableTodo, DroppableColumn } from './dnd';
import {
  levelInfo,
  newlyUnlocked,
  DIFFICULTY,
  DIFFICULTIES,
  xpForDifficulty,
  SUBTASK_XP,
  type Difficulty,
} from '@/lib/gamification';
import Confetti from './Confetti';
import GameBar from './GameBar';
import QuotaModal from './QuotaModal';
import { parseQuotaError, type QuotaCode } from '@/lib/plan';
import LevelUpOverlay, { type LevelUp } from './LevelUpOverlay';
import { dueLabel, bucketOf } from './dateUtils';

type Project = { id: string; name: string };
type Category = { id: string; name: string };
type Todo = {
  id: string;
  category_id: string;
  title: string;
  completed: boolean;
  assignee: string | null;
  assigned_to: string | null;
  progress: string | null;
  link: string | null;
  notes: string | null;
  difficulty: string | null;
  due_date: string | null;
  parent_id: string | null;
  position: number | null;
};
type Subtask = { id: string; todo_id: string; title: string; done: boolean };
type Member = { user_id: string; full_name: string | null; email: string | null };
type Toast = { key: number; icon: string; title: string; sub?: string };
// cols: 접힌 카테고리, done: 완료 구역이 펼쳐진 카테고리. proj는 이 상태가 어느 프로젝트 것인지 표시.
type FoldState = { proj: string | null; cols: Record<string, boolean>; done: Record<string, boolean> };

const EMPTY_FOLD: Record<string, boolean> = {};
const foldKey = (projectId: string) => `mindash:fold:v1:${projectId}`;

const uid = () => globalThis.crypto.randomUUID();
const normalizeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
const diffOf = (d?: string | null): Difficulty => ((d as Difficulty) in DIFFICULTY ? (d as Difficulty) : 'normal');

const CAT_COLORS = ['#ff3e00', '#0090ff', '#00ca48', '#ffbb26', '#9f4fff', '#ff58ae', '#0086fc', '#00c978'];
const catColor = (i: number) => CAT_COLORS[i % CAT_COLORS.length];
// 멤버는 user_id 해시로 고정색 → 카드·팝오버에서 같은 사람은 항상 같은 색
const memberColor = (id: string) => CAT_COLORS[[...id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % CAT_COLORS.length];
const memberInitial = (m?: Member | null) => (m?.full_name || m?.email || '?').slice(0, 1).toUpperCase();
const memberName = (m: Member, meId: string) =>
  `${m.full_name || m.email?.split('@')[0] || '사용자'}${m.user_id === meId ? ' (나)' : ''}`;

export default function Workspace({
  initialProjects,
  userId,
  teamId = null,
  canManage = true,
}: {
  initialProjects: Project[];
  userId: string;
  teamId?: string | null;
  canManage?: boolean;
}) {
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeId, setActiveId] = useState<string | null>(initialProjects[0]?.id ?? null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [subtasks, setSubtasks] = useState<Record<string, Subtask[]>>({});
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'list' | 'mindmap'>('list');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openChecklist, setOpenChecklist] = useState<Record<string, boolean>>({});

  // 담당자 지정 — members: 현재 팀원, assignFor: 담당자 팝오버가 열린 todo id
  const [members, setMembers] = useState<Member[]>([]);
  const [assignFor, setAssignFor] = useState<string | null>(null);

  // 무료 한도 초과 시 업그레이드 모달. insert 에러 메시지에서 MINDASH_QUOTA 코드를 파싱해 띄운다.
  const [quotaCode, setQuotaCode] = useState<QuotaCode | null>(null);

  // 컬럼 접기 / 완료 구역 펼치기 — proj를 함께 담아 프로젝트 전환 중 이전 상태가 새 키를 덮는 것을 막는다
  const [fold, setFold] = useState<FoldState>({ proj: null, cols: {}, done: {} });
  const [pulseCat, setPulseCat] = useState<{ id: string; key: number } | null>(null);
  const foldReady = fold.proj === activeId;
  const collapsedCats = foldReady ? fold.cols : EMPTY_FOLD;
  const openDone = foldReady ? fold.done : EMPTY_FOLD;
  const patchFold = (key: 'cols' | 'done', catId: string, value: boolean) =>
    setFold((f) => {
      const base: FoldState = f.proj === activeId ? f : { proj: activeId, cols: {}, done: {} };
      return { ...base, [key]: { ...base[key], [catId]: value } };
    });

  // 추가 폼 상태
  const [addingCat, setAddingCat] = useState<string | null>(null);
  const [tTitle, setTTitle] = useState('');
  const [tLink, setTLink] = useState('');
  const [tNotes, setTNotes] = useState('');
  const [tDiff, setTDiff] = useState<Difficulty>('normal');
  const [tDue, setTDue] = useState('');
  const [tAssignee, setTAssignee] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [catName, setCatName] = useState('');
  const [addingProject, setAddingProject] = useState(false);
  const [projName, setProjName] = useState('');
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [sTitle, setSTitle] = useState('');
  // 마인드맵 노드 추가(카테고리 최상위 또는 특정 노드 하위)
  const [mindAdd, setMindAdd] = useState<{ catId: string; parentId: string | null } | null>(null);
  const [mindAddTitle, setMindAddTitle] = useState('');

  // 편집 폼 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eLink, setELink] = useState('');
  const [eNotes, setENotes] = useState('');
  const [eDiff, setEDiff] = useState<Difficulty>('normal');
  const [eDue, setEDue] = useState('');
  const [eAssignee, setEAssignee] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [eCatName, setECatName] = useState('');

  // 게임화 상태
  const [gDone, setGDone] = useState(0); // 완료한 할 일 개수 (업적용)
  const [gXp, setGXp] = useState(0); // 누적 XP (난이도 가중 + 서브퀘스트)
  const [confettiKey, setConfettiKey] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [levelUp, setLevelUp] = useState<LevelUp | null>(null);

  // 전체 XP/완료수 재계산 (RLS로 본인 소유만 집계)
  const refreshGlobalXp = useCallback(async () => {
    // 팀 프로젝트가 보여도 "내가 완료한 것"만 XP로 집계 (completed_by = 나)
    const { data: doneTodos, error } = await supabase
      .from('todos')
      .select('difficulty')
      .eq('completed', true)
      .eq('completed_by', userId);
    if (error) {
      // 마이그레이션 전 폴백: 내 소유 프로젝트의 완료 개수 × 10
      const { count } = await supabase.from('todos').select('*', { count: 'exact', head: true }).eq('completed', true);
      setGDone(count ?? 0);
      setGXp((count ?? 0) * 10);
      return;
    }
    const base = (doneTodos ?? []).reduce((s, r) => s + xpForDifficulty(r.difficulty), 0);
    const subRes = await supabase
      .from('subtasks')
      .select('*', { count: 'exact', head: true })
      .eq('done', true)
      .eq('done_by', userId);
    const subDone = subRes.error ? 0 : subRes.count ?? 0;
    setGDone((doneTodos ?? []).length);
    setGXp(base + SUBTASK_XP * subDone);
  }, [supabase, userId]);

  useEffect(() => {
    refreshGlobalXp();
  }, [refreshGlobalXp]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!pulseCat) return;
    const id = setTimeout(() => setPulseCat(null), 600);
    return () => clearTimeout(id);
  }, [pulseCat]);

  // 담당자 팝오버: 바깥 클릭 / Esc 로 닫기
  useEffect(() => {
    if (!assignFor) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-assign-menu]')) setAssignFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAssignFor(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [assignFor]);

  const load = useCallback(
    async (projectId: string) => {
      setLoading(true);
      const [catR, todoR, subR] = await Promise.all([
        supabase.from('categories').select('id,name').eq('project_id', projectId).order('position'),
        supabase
          .from('todos')
          .select('id,category_id,title,completed,assignee,assigned_to,progress,link,notes,difficulty,due_date,parent_id,position')
          .eq('project_id', projectId)
          .order('position'),
        supabase.from('subtasks').select('id,todo_id,title,done').eq('project_id', projectId).order('position'),
      ]);
      let tds = todoR.data as Todo[] | null;
      if (todoR.error) {
        // 마이그레이션 전(parent_id·assigned_to 등 없음) 폴백
        const fb = await supabase
          .from('todos')
          .select('id,category_id,title,completed,assignee,progress,link,notes,difficulty,due_date')
          .eq('project_id', projectId)
          .order('position');
        tds = (fb.data ?? []).map((r) => ({ ...(r as Todo), assigned_to: null, parent_id: null, position: 0 }));
        if (fb.error) {
          const fb2 = await supabase
            .from('todos')
            .select('id,category_id,title,completed,assignee,progress,link,notes')
            .eq('project_id', projectId)
            .order('position');
          tds = (fb2.data ?? []).map((r) => ({ ...(r as Todo), assigned_to: null, difficulty: 'normal', due_date: null, parent_id: null, position: 0 }));
        }
      }
      setCategories((catR.data as Category[]) ?? []);
      setTodos(tds ?? []);
      const grouped: Record<string, Subtask[]> = {};
      if (!subR.error) ((subR.data as Subtask[]) ?? []).forEach((s) => (grouped[s.todo_id] ??= []).push(s));
      setSubtasks(grouped);
      setLoading(false);
    },
    [supabase]
  );

  // 팀원 목록 로드 (담당자 후보). 개인 워크스페이스면 비운다. TeamPanel의 2단 조회 패턴 재사용.
  useEffect(() => {
    if (!teamId) {
      setMembers([]);
      return;
    }
    let alive = true;
    (async () => {
      const { data: mem } = await supabase.from('team_members').select('user_id').eq('team_id', teamId);
      const ids = (mem ?? []).map((m) => m.user_id);
      const { data: profs } = ids.length
        ? await supabase.from('profiles').select('id,email,full_name').in('id', ids)
        : { data: [] as { id: string; email: string; full_name: string }[] };
      if (!alive) return;
      const pmap = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
      setMembers(ids.map((id) => ({ user_id: id, full_name: pmap[id]?.full_name ?? null, email: pmap[id]?.email ?? null })));
    })();
    return () => {
      alive = false;
    };
  }, [supabase, teamId]);

  useEffect(() => {
    if (activeId) load(activeId);
    else {
      setCategories([]);
      setTodos([]);
      setSubtasks({});
    }
  }, [activeId, load]);

  // 접힘 상태 복원 (프로젝트 전환 시)
  useEffect(() => {
    if (!activeId) {
      setFold({ proj: null, cols: {}, done: {} });
      return;
    }
    const cols: Record<string, boolean> = {};
    const done: Record<string, boolean> = {};
    try {
      const raw = localStorage.getItem(foldKey(activeId));
      if (raw) {
        const parsed = JSON.parse(raw) as { c?: string[]; d?: string[] };
        (parsed.c ?? []).forEach((id) => (cols[id] = true));
        (parsed.d ?? []).forEach((id) => (done[id] = true));
      }
    } catch {
      // 손상된 값은 무시하고 전부 펼친 상태로 시작
    }
    setFold({ proj: activeId, cols, done });
  }, [activeId]);

  // 접힘 상태 저장 (현재 프로젝트 것일 때만)
  useEffect(() => {
    if (!activeId || fold.proj !== activeId) return;
    const c = Object.keys(fold.cols).filter((id) => fold.cols[id]);
    const d = Object.keys(fold.done).filter((id) => fold.done[id]);
    try {
      if (c.length || d.length) localStorage.setItem(foldKey(activeId), JSON.stringify({ c, d }));
      else localStorage.removeItem(foldKey(activeId));
    } catch {
      // 저장 실패(사파리 프라이빗 등)해도 이번 세션 동작에는 영향 없음
    }
  }, [activeId, fold]);

  // 챗봇이 데이터를 바꾸면 재로딩
  useEffect(() => {
    const h = () => {
      refreshGlobalXp();
      if (activeId) load(activeId);
    };
    window.addEventListener('mindash:data-changed', h);
    return () => window.removeEventListener('mindash:data-changed', h);
  }, [activeId, load, refreshGlobalXp]);

  // ---------- 프로젝트 ----------
  const submitProject = async () => {
    const name = projName.trim();
    if (!name) return;
    const id = uid();
    const { error } = await supabase.from('projects').insert({ id, name, owner_id: userId, team_id: teamId });
    if (error) {
      const q = parseQuotaError(error.message);
      if (q) return setQuotaCode(q);
      return alert('프로젝트 생성 실패: ' + error.message);
    }
    setProjects((p) => [...p, { id, name }]);
    setActiveId(id);
    setAddingProject(false);
    setProjName('');
  };

  const deleteProject = async (project: Project) => {
    if (!window.confirm(`'${project.name}' 프로젝트를 삭제할까요? 안의 할 일도 모두 삭제됩니다.`)) return;
    await supabase.from('subtasks').delete().eq('project_id', project.id);
    await supabase.from('todos').delete().eq('project_id', project.id);
    await supabase.from('categories').delete().eq('project_id', project.id);
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (error) return alert('삭제 실패: ' + error.message);
    try {
      localStorage.removeItem(foldKey(project.id));
    } catch {}
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== project.id);
      if (activeId === project.id) setActiveId(next[0]?.id ?? null);
      return next;
    });
    refreshGlobalXp();
  };

  // ---------- 카테고리 ----------
  const submitCategory = async () => {
    if (!activeId) return;
    const name = catName.trim();
    if (!name) return;
    const id = uid();
    const { error } = await supabase
      .from('categories')
      .insert({ project_id: activeId, id, name, position: categories.length });
    if (error) return alert('카테고리 생성 실패: ' + error.message);
    setCategories((c) => [...c, { id, name }]);
    setAddingCategory(false);
    setCatName('');
  };

  const deleteCategory = async (cat: Category) => {
    if (!activeId) return;
    if (!window.confirm(`'${cat.name}' 카테고리와 그 안의 할 일을 삭제할까요?`)) return;
    const ids = todos.filter((t) => t.category_id === cat.id).map((t) => t.id);
    if (ids.length) await supabase.from('subtasks').delete().eq('project_id', activeId).in('todo_id', ids);
    await supabase.from('todos').delete().eq('project_id', activeId).eq('category_id', cat.id);
    const { error } = await supabase.from('categories').delete().eq('project_id', activeId).eq('id', cat.id);
    if (error) return alert('삭제 실패: ' + error.message);
    setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    setTodos((prev) => prev.filter((t) => t.category_id !== cat.id));
    setFold((f) => {
      const drop = (m: Record<string, boolean>) => Object.fromEntries(Object.entries(m).filter(([id]) => id !== cat.id));
      return { ...f, cols: drop(f.cols), done: drop(f.done) };
    });
    refreshGlobalXp();
  };

  const openEditCat = (c: Category) => {
    setEditingCatId(c.id);
    setECatName(c.name);
  };
  const saveEditCat = async () => {
    if (!editingCatId || !activeId) return;
    const name = eCatName.trim();
    if (!name) {
      setEditingCatId(null);
      return;
    }
    setCategories((prev) => prev.map((c) => (c.id === editingCatId ? { ...c, name } : c)));
    const { error } = await supabase.from('categories').update({ name }).eq('project_id', activeId).eq('id', editingCatId);
    if (error) alert('수정 실패: ' + error.message);
    setEditingCatId(null);
  };

  // ---------- 할 일 ----------
  const openAddTodo = (categoryId: string) => {
    setAddingCat(categoryId);
    setTTitle('');
    setTLink('');
    setTNotes('');
    setTDiff('normal');
    setTDue('');
    setTAssignee('');
  };

  const submitTodo = async () => {
    if (!activeId || !addingCat) return;
    const title = tTitle.trim();
    if (!title) return;
    const id = uid();
    const link = tLink.trim();
    const notes = tNotes.trim();
    const { error } = await supabase.from('todos').insert({
      project_id: activeId,
      id,
      category_id: addingCat,
      title,
      completed: false,
      notes,
      assignee: '',
      assigned_to: teamId ? tAssignee || null : null,
      progress: '0',
      link,
      difficulty: tDiff,
      due_date: tDue || null,
      parent_id: null,
      position: todos.length,
    });
    if (error) {
      const q = parseQuotaError(error.message);
      if (q) return setQuotaCode(q);
      return alert('할 일 생성 실패: ' + error.message);
    }
    setTodos((t) => [
      ...t,
      {
        id,
        category_id: addingCat,
        title,
        completed: false,
        assignee: '',
        assigned_to: teamId ? tAssignee || null : null,
        progress: '0',
        link,
        notes,
        difficulty: tDiff,
        due_date: tDue || null,
        parent_id: null,
        position: todos.length,
      },
    ]);
    setAddingCat(null);
    setTTitle('');
    setTLink('');
    setTNotes('');
    setTDiff('normal');
    setTDue('');
    setTAssignee('');
  };

  // 마인드맵에서 노드 추가 (카테고리 최상위: parentId=null / 특정 노드 하위: parentId=노드id)
  const submitMindTodo = async () => {
    if (!activeId || !mindAdd) return;
    const title = mindAddTitle.trim();
    if (!title) return;
    const id = uid();
    const { catId, parentId } = mindAdd;
    const { error } = await supabase.from('todos').insert({
      project_id: activeId,
      id,
      category_id: catId,
      title,
      completed: false,
      notes: '',
      assignee: '',
      assigned_to: null,
      progress: '0',
      link: '',
      difficulty: 'normal',
      due_date: null,
      parent_id: parentId,
      position: todos.length,
    });
    if (error) {
      const q = parseQuotaError(error.message);
      if (q) return setQuotaCode(q);
      return alert('추가 실패: ' + error.message);
    }
    setTodos((t) => [
      ...t,
      {
        id,
        category_id: catId,
        title,
        completed: false,
        assignee: '',
        assigned_to: null,
        progress: '0',
        link: '',
        notes: '',
        difficulty: 'normal',
        due_date: null,
        parent_id: parentId,
        position: todos.length,
      },
    ]);
    if (parentId) setExpanded((e) => ({ ...e, [parentId]: true }));
    setMindAddTitle('');
    // 연속 추가를 위해 폼 유지 (닫기는 취소/Esc)
  };

  const openEdit = (t: Todo) => {
    setEditingId(t.id);
    setETitle(t.title);
    setELink(t.link ?? '');
    setENotes(t.notes ?? '');
    setEDiff(diffOf(t.difficulty));
    setEDue(t.due_date ?? '');
    setEAssignee(t.assigned_to ?? '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const title = eTitle.trim();
    if (!title) return;
    const link = eLink.trim();
    const notes = eNotes.trim();
    const cur = todos.find((t) => t.id === editingId);
    if (!cur) {
      setEditingId(null);
      return;
    }
    const nextAssigned = teamId ? eAssignee || null : cur.assigned_to;
    setTodos((prev) =>
      prev.map((t) =>
        t.id === editingId ? { ...t, title, link, notes, difficulty: eDiff, due_date: eDue || null, assigned_to: nextAssigned } : t
      )
    );
    const { error } = await supabase
      .from('todos')
      .update({ title, link, notes, difficulty: eDiff, due_date: eDue || null, assigned_to: nextAssigned })
      .eq('id', editingId)
      .eq('category_id', cur.category_id);
    if (error) {
      alert('수정 실패: ' + error.message);
      if (activeId) load(activeId);
    }
    // 완료된 할 일의 난이도가 바뀌면 XP 재계산
    if (cur.completed && diffOf(cur.difficulty) !== eDiff) refreshGlobalXp();
    setEditingId(null);
  };

  const deleteTodo = async (todo: Todo) => {
    // 서브트리(자손 포함) id 수집
    const node = tree.byId.get(todo.id);
    const ids = node ? collectSubtreeIds(node) : [todo.id];
    if (ids.length > 1 && !window.confirm(`하위 할 일 ${ids.length - 1}개도 함께 삭제됩니다. 계속할까요?`)) return;
    const idSet = new Set(ids);
    setTodos((prev) => prev.filter((t) => !idSet.has(t.id)));
    setSubtasks((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      return next;
    });
    // 루트 1건 삭제 → DB FK CASCADE가 자손 todos + 그 subtasks까지 연쇄 삭제
    const { error } = await supabase.from('todos').delete().eq('id', todo.id).eq('category_id', todo.category_id);
    if (error) {
      alert('삭제 실패: ' + error.message);
      if (activeId) load(activeId);
    }
    refreshGlobalXp();
  };

  const toggle = async (todo: Todo) => {
    const next = !todo.completed;
    const updated = todos.map((t) => (t.id === todo.id ? { ...t, completed: next } : t));
    const prevTodos = todos;
    const prevGDone = gDone;
    const prevGXp = gXp;
    const dxp = xpForDifficulty(todo.difficulty);
    const newGDone = Math.max(0, gDone + (next ? 1 : -1));
    const newGXp = Math.max(0, gXp + (next ? dxp : -dxp));
    setTodos(updated);
    setGDone(newGDone);
    setGXp(newGXp);

    if (next) celebrate(prevGDone, newGDone, prevGXp, newGXp, updated, todo);

    const { error } = await supabase
      .from('todos')
      .update({
        completed: next,
        completed_by: next ? userId : null,
        completed_at: next ? new Date().toISOString() : null,
      })
      .eq('id', todo.id)
      .eq('category_id', todo.category_id);
    if (error) {
      setTodos(prevTodos);
      setGDone(prevGDone);
      setGXp(prevGXp);
      alert('저장에 실패했습니다: ' + error.message);
    }
  };

  // 담당자 지정/해제 (낙관적 업데이트 + 실패 롤백, toggle과 동일 패턴)
  const assignTodo = async (todo: Todo, memberId: string | null) => {
    setAssignFor(null);
    if (todo.assigned_to === memberId) return;
    const prevTodos = todos;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, assigned_to: memberId } : t)));
    const { error } = await supabase
      .from('todos')
      .update({ assigned_to: memberId })
      .eq('id', todo.id)
      .eq('category_id', todo.category_id);
    if (error) {
      setTodos(prevTodos);
      alert('담당자 지정 실패: ' + error.message);
    }
  };

  const celebrate = (oldDone: number, newDone: number, oldXp: number, newXp: number, updated: Todo[], todo: Todo) => {
    setConfettiKey((k) => k + 1);
    const before = levelInfo(oldXp);
    const after = levelInfo(newXp);
    let t: Toast | null = null;
    if (after.level > before.level) {
      setLevelUp({ level: after.level, title: after.title, icon: after.icon });
      for (let n = 1; n <= 2; n++) setTimeout(() => setConfettiKey((k) => k + 1), n * 250);
    } else {
      const ach = newlyUnlocked(oldDone, newDone);
      if (ach) {
        t = { key: newDone, icon: ach.icon, title: `업적 달성: ${ach.name}`, sub: ach.desc };
      } else {
        const projAll = updated.length > 0 && updated.every((x) => x.completed);
        const catItems = updated.filter((x) => x.category_id === todo.category_id);
        const catAll = catItems.length > 0 && catItems.every((x) => x.completed);
        if (projAll) {
          t = { key: Math.random(), icon: '🏁', title: '프로젝트 완주!', sub: `${activeProject?.name ?? ''} 100% 달성` };
        } else if (catAll) {
          const c = categories.find((c) => c.id === todo.category_id);
          t = { key: Math.random(), icon: '✅', title: '구역 정복!', sub: `'${c?.name ?? ''}' 카테고리 올클리어` };
        }
      }
    }
    if (t) setToast(t);
  };

  // ---------- 서브 퀘스트(체크리스트) ----------
  const submitSubtask = async (todoId: string) => {
    if (!activeId) return;
    const title = sTitle.trim();
    if (!title) return;
    const id = uid();
    const list = subtasks[todoId] ?? [];
    const { error } = await supabase
      .from('subtasks')
      .insert({ id, todo_id: todoId, project_id: activeId, title, done: false, position: list.length });
    if (error) return alert('단계 추가 실패: ' + error.message);
    setSubtasks((prev) => ({ ...prev, [todoId]: [...(prev[todoId] ?? []), { id, todo_id: todoId, title, done: false }] }));
    setSTitle('');
  };

  const toggleSubtask = async (st: Subtask) => {
    const next = !st.done;
    setSubtasks((prev) => ({
      ...prev,
      [st.todo_id]: (prev[st.todo_id] ?? []).map((x) => (x.id === st.id ? { ...x, done: next } : x)),
    }));
    setGXp((x) => Math.max(0, x + (next ? SUBTASK_XP : -SUBTASK_XP)));
    const { error } = await supabase
      .from('subtasks')
      .update({ done: next, done_by: next ? userId : null })
      .eq('id', st.id);
    if (error) {
      setSubtasks((prev) => ({
        ...prev,
        [st.todo_id]: (prev[st.todo_id] ?? []).map((x) => (x.id === st.id ? { ...x, done: !next } : x)),
      }));
      setGXp((x) => Math.max(0, x + (next ? -SUBTASK_XP : SUBTASK_XP)));
    }
  };

  const deleteSubtask = async (st: Subtask) => {
    if (st.done) setGXp((x) => Math.max(0, x - SUBTASK_XP));
    setSubtasks((prev) => ({ ...prev, [st.todo_id]: (prev[st.todo_id] ?? []).filter((x) => x.id !== st.id) }));
    await supabase.from('subtasks').delete().eq('id', st.id);
  };

  const total = todos.length;
  const done = todos.filter((t) => t.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const activeProject = projects.find((p) => p.id === activeId) ?? null;
  const tree = useMemo(() => buildTree(todos), [todos]);

  const anyExpanded = categories.some((c) => !collapsedCats[c.id]);
  const setAllCollapsed = (collapsed: boolean) =>
    setFold((f) => {
      const base: FoldState = f.proj === activeId ? f : { proj: activeId, cols: {}, done: {} };
      const cols: Record<string, boolean> = {};
      if (collapsed) categories.forEach((c) => (cols[c.id] = true));
      return { ...base, proj: activeId, cols };
    });

  // ---------- 드래그앤드롭(카테고리 간 이동) ----------
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );
  const dragNode = dragId ? tree.byId.get(dragId) ?? null : null;

  const moveTodoToCategory = async (node: Node<Todo>, targetCatId: string) => {
    if (!activeId) return;
    if (node.category_id === targetCatId && node.parent_id === null) return; // 제자리
    const ids = collectSubtreeIds(node);
    const descIds = ids.filter((i) => i !== node.id);
    const idSet = new Set(ids);
    const prev = todos;
    const newPos = todos.length;
    // 낙관적: 이동 노드는 새 카테고리+최상위, 자손은 카테고리만
    setTodos((p) =>
      p.map((t) =>
        !idSet.has(t.id)
          ? t
          : t.id === node.id
          ? { ...t, category_id: targetCatId, parent_id: null, position: newPos }
          : { ...t, category_id: targetCatId }
      )
    );
    // ① 루트 먼저 (실패 시 안전 롤백)
    const r1 = await supabase
      .from('todos')
      .update({ category_id: targetCatId, parent_id: null, position: newPos })
      .eq('project_id', activeId)
      .eq('id', node.id);
    if (r1.error) {
      setTodos(prev);
      alert('이동 실패: ' + r1.error.message);
      return;
    }
    // 접힌 컬럼으로 옮겼으면 카운트를 튕겨서 도착을 알린다 (컬럼은 접힌 채로 둔다)
    if (collapsedCats[targetCatId]) setPulseCat({ id: targetCatId, key: Date.now() });
    // ② 자손 카테고리 일괄
    if (descIds.length) {
      const r2 = await supabase.from('todos').update({ category_id: targetCatId }).eq('project_id', activeId).in('id', descIds);
      if (r2.error) load(activeId);
    }
  };

  const onDragStart = (e: DragStartEvent) => {
    setDragId(String(e.active.id));
    setEditingId(null);
    setAddingCat(null);
    setMindAdd(null);
    setAssignFor(null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId || !overId.startsWith('cat:')) return;
    const targetCatId = overId.slice(4);
    const node = tree.byId.get(String(e.active.id));
    if (node) moveTodoToCategory(node, targetCatId);
  };

  // 난이도 선택 UI
  const diffSelector = (value: Difficulty, onChange: (d: Difficulty) => void) => (
    <div className="ws-diffsel">
      {DIFFICULTIES.map((d) => (
        <button
          key={d}
          type="button"
          className={`ws-diffbtn${value === d ? ' active' : ''}`}
          style={value === d ? { borderColor: DIFFICULTY[d].color, color: DIFFICULTY[d].color } : undefined}
          onClick={() => onChange(d)}
        >
          {DIFFICULTY[d].label} <small>+{DIFFICULTY[d].xp}</small>
        </button>
      ))}
    </div>
  );

  // 담당자 선택 UI (팀 워크스페이스 · 멤버가 있을 때만)
  const assigneeSelector = (value: string, onChange: (v: string) => void) =>
    teamId && members.length > 0 ? (
      <>
        <div className="ws-difflabel">👤 담당자</div>
        <select className="ws-input ws-assignee-select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">담당자 없음</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {memberName(m, userId)}
            </option>
          ))}
        </select>
      </>
    ) : null;

  const addTodoForm = (categoryId: string) =>
    addingCat === categoryId ? (
      <div className="ws-addform">
        <input
          className="ws-input"
          autoFocus
          placeholder="할 일 내용"
          value={tTitle}
          onChange={(e) => setTTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) submitTodo();
            if (e.key === 'Escape') setAddingCat(null);
          }}
        />
        <div className="ws-difflabel">난이도 (완료 시 XP)</div>
        {diffSelector(tDiff, setTDiff)}
        <div className="ws-daterow">
          <span className="ws-difflabel">📅 계획일</span>
          <input className="ws-input ws-date" type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} />
          {tDue && (
            <button className="ws-date-clear" onClick={() => setTDue('')}>
              지우기
            </button>
          )}
        </div>
        {assigneeSelector(tAssignee, setTAssignee)}
        <input
          className="ws-input"
          placeholder="🔗 링크 (선택) — 예: example.com"
          value={tLink}
          onChange={(e) => setTLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) submitTodo();
            if (e.key === 'Escape') setAddingCat(null);
          }}
        />
        <textarea
          className="ws-input ws-ta"
          placeholder="📝 비고 (선택)"
          value={tNotes}
          onChange={(e) => setTNotes(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setAddingCat(null);
          }}
        />
        <div className="ws-addform-actions">
          <button className="btn btn-dark btn-sm" onClick={submitTodo}>
            추가
          </button>
          <button className="btn btn-light btn-sm" onClick={() => setAddingCat(null)}>
            취소
          </button>
        </div>
      </div>
    ) : (
      <button className="ws-add" onClick={() => openAddTodo(categoryId)}>
        + 할 일 추가
      </button>
    );

  const editTodoForm = () => (
    <div className="ws-addform">
      <input
        className="ws-input"
        autoFocus
        placeholder="할 일 내용"
        value={eTitle}
        onChange={(e) => setETitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) saveEdit();
          if (e.key === 'Escape') setEditingId(null);
        }}
      />
      <div className="ws-difflabel">난이도</div>
      {diffSelector(eDiff, setEDiff)}
      <div className="ws-daterow">
        <span className="ws-difflabel">📅 계획일</span>
        <input className="ws-input ws-date" type="date" value={eDue} onChange={(e) => setEDue(e.target.value)} />
        {eDue && (
          <button className="ws-date-clear" onClick={() => setEDue('')}>
            지우기
          </button>
        )}
      </div>
      {assigneeSelector(eAssignee, setEAssignee)}
      <input
        className="ws-input"
        placeholder="🔗 링크 (선택)"
        value={eLink}
        onChange={(e) => setELink(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) saveEdit();
          if (e.key === 'Escape') setEditingId(null);
        }}
      />
      <textarea
        className="ws-input ws-ta"
        placeholder="📝 비고 (선택)"
        value={eNotes}
        onChange={(e) => setENotes(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditingId(null);
        }}
      />
      <div className="ws-addform-actions">
        <button className="btn btn-dark btn-sm" onClick={saveEdit}>
          저장
        </button>
        <button className="btn btn-light btn-sm" onClick={() => setEditingId(null)}>
          취소
        </button>
      </div>
    </div>
  );

  // 체크리스트 패널
  const checklistPanel = (t: Todo) => {
    const list = subtasks[t.id] ?? [];
    return (
      <div className="ws-checklist">
        {list.map((st) => (
          <div className="ws-sub" key={st.id}>
            <label className="ws-sub-main">
              <input type="checkbox" checked={st.done} onChange={() => toggleSubtask(st)} />
              <span className={`ws-check ws-check-sm${st.done ? ' done' : ''}`} />
              <span className={`ws-sub-text${st.done ? ' done' : ''}`}>{st.title}</span>
            </label>
            <button className="ws-x" onClick={() => deleteSubtask(st)} title="단계 삭제">
              ×
            </button>
          </div>
        ))}
        {addingSubFor === t.id ? (
          <div className="ws-sub-add">
            <input
              className="ws-input"
              autoFocus
              placeholder="세부 단계 (Enter로 연속 추가)"
              value={sTitle}
              onChange={(e) => setSTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) submitSubtask(t.id);
                if (e.key === 'Escape') setAddingSubFor(null);
              }}
            />
            <button className="btn btn-light btn-sm" onClick={() => setAddingSubFor(null)}>
              완료
            </button>
          </div>
        ) : (
          <button
            className="ws-sub-addbtn"
            onClick={() => {
              setAddingSubFor(t.id);
              setSTitle('');
            }}
          >
            + 단계 추가 (+{SUBTASK_XP} XP)
          </button>
        )}
      </div>
    );
  };

  // 마인드맵 노드(재귀) — 무한 depth
  const MAX_UI_DEPTH = 5;
  const renderMindNode = (node: Node<Todo>, color: string): ReactNode => {
    const hasChildren = node.children.length > 0;
    const open = !!expanded[node.id];
    const stats = hasChildren ? subtreeStats(node) : null;
    return (
      <div className="mm-item" key={node.id}>
        <div className="mm-leaf">
          {hasChildren ? (
            <button className="mm-caret-sm" onClick={() => setExpanded((e) => ({ ...e, [node.id]: !e[node.id] }))}>
              {open ? '▾' : '▸'}
            </button>
          ) : (
            <span className="mm-caret-sm empty" />
          )}
          <label className="mm-leaf-main">
            <input type="checkbox" checked={node.completed} onChange={() => toggle(node)} />
            <span className={`ws-check${node.completed ? ' done' : ''}`} />
            <span className="ws-text-wrap">
              <span className={`ws-text${node.completed ? ' done' : ''}`}>
                {node.link ? (
                  <a href={normalizeUrl(node.link)} target="_blank" rel="noreferrer">
                    {node.title}
                  </a>
                ) : (
                  node.title
                )}
                {stats && (
                  <span className="mm-substat">
                    {stats.done - (node.completed ? 1 : 0)}/{stats.total - 1}
                  </span>
                )}
              </span>
              {node.notes ? <span className="ws-note">{node.notes}</span> : null}
            </span>
          </label>
          <span className="mm-node-actions">
            {node.depth < MAX_UI_DEPTH - 1 && (
              <button
                className="mm-addchild"
                onClick={() => {
                  setMindAdd({ catId: node.category_id, parentId: node.id });
                  setMindAddTitle('');
                  setExpanded((e) => ({ ...e, [node.id]: true }));
                }}
                title="하위 할 일 추가"
              >
                + 하위
              </button>
            )}
            <button className="ws-x" onClick={() => deleteTodo(node)} title="삭제">
              ×
            </button>
          </span>
        </div>
        {(open || mindAdd?.parentId === node.id) && (
          <div className="mm-leaves" style={{ borderLeftColor: color }}>
            {node.children.map((c) => renderMindNode(c, color))}
            {mindAdd?.parentId === node.id && renderMindAddForm(node.category_id, node.id)}
          </div>
        )}
      </div>
    );
  };

  const renderMindAddForm = (catId: string, parentId: string | null) => (
    <div className="mm-addform" key={`add-${parentId ?? catId}`}>
      <input
        className="ws-input"
        autoFocus
        placeholder={parentId ? '하위 할 일 (Enter로 추가)' : '할 일 (Enter로 추가)'}
        value={mindAddTitle}
        onChange={(e) => setMindAddTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // 한글 IME 조합 중 Enter 무시 (마지막 음절 확정용)
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            submitMindTodo();
          }
          if (e.key === 'Escape') setMindAdd(null);
        }}
      />
      <button className="btn btn-dark btn-sm" onClick={submitMindTodo}>
        추가
      </button>
      <button className="btn btn-light btn-sm" onClick={() => setMindAdd(null)}>
        닫기
      </button>
    </div>
  );

  // 할 일 한 줄 (목록 뷰, 재귀)
  const renderTodo = (t: Node<Todo>, depth = 0): ReactNode => {
    const subs = subtasks[t.id] ?? [];
    const subDone = subs.filter((s) => s.done).length;
    const d = diffOf(t.difficulty);
    const open = !!openChecklist[t.id];
    if (editingId === t.id) return <div key={t.id}>{editTodoForm()}</div>;
    const childForm = mindAdd?.parentId === t.id;
    const cs = t.children.length ? subtreeStats(t) : null;
    const assignedMember = t.assigned_to ? members.find((m) => m.user_id === t.assigned_to) ?? null : null;
    const assignedGone = !!t.assigned_to && !assignedMember; // 팀 나간 멤버
    return (
      <div className="ws-tree-node" key={t.id}>
        {editingId === t.id ? (
          editTodoForm()
        ) : (
          <DraggableTodo id={t.id} disabled={editingId === t.id}>
            {(handle) => (
              <div className="ws-item-wrap">
                <div className="ws-item">
                  <span className="ws-drag" {...handle} title="드래그하여 이동">
                    ⠿
                  </span>
                  <div className="ws-item-body">
                  <label className="ws-item-main">
                    <input type="checkbox" checked={t.completed} onChange={() => toggle(t)} />
                    <span className={`ws-check${t.completed ? ' done' : ''}`} />
                    <span className="ws-text-wrap">
                      <span className={`ws-text${t.completed ? ' done' : ''}`}>
                        {depth > 0 && <span className="ws-childmark">↳</span>}
                        {t.link ? (
                          <a href={normalizeUrl(t.link)} target="_blank" rel="noreferrer" title={t.link}>
                            {t.title}
                          </a>
                        ) : (
                          t.title
                        )}
                      </span>
                      {t.notes ? (
                        <span className="ws-note" title={t.notes}>
                          {t.notes}
                        </span>
                      ) : null}
                    </span>
                  </label>
                  <div className="ws-meta">
                    {d !== 'normal' && (
                      <span className="ws-diff" style={{ color: DIFFICULTY[d].color, borderColor: DIFFICULTY[d].color }}>
                        {DIFFICULTY[d].label}
                      </span>
                    )}
                    {cs && (
                      <span className="mm-substat">
                        {cs.done - (t.completed ? 1 : 0)}/{cs.total - 1}
                      </span>
                    )}
                    {t.due_date && !t.completed && (
                      <span className={`ws-due ws-due-${bucketOf(t.due_date)}`}>📅 {dueLabel(t.due_date)}</span>
                    )}
                    <button
                      className={`ws-sub-toggle${subs.length === 0 ? ' ws-sub-toggle-ghost' : ''}`}
                      aria-expanded={open}
                      onClick={() => setOpenChecklist((o) => ({ ...o, [t.id]: !o[t.id] }))}
                    >
                      {subs.length > 0 ? `☑ 체크리스트 ${subDone}/${subs.length}` : '＋ 체크리스트'} {open ? '▾' : '▸'}
                    </button>
                    <span className="ws-meta-right">
              {teamId && (
                <span className="ws-assignee-wrap" data-assign-menu>
                  <button
                    className={`ws-assignee-btn${
                      !t.assigned_to ? ' ws-assignee-empty' : assignedGone ? ' ws-assignee-gone' : ''
                    }${t.assigned_to && !assignedGone ? ' ws-assign-pop' : ''}`}
                    key={t.assigned_to ?? 'none'}
                    style={t.assigned_to && !assignedGone ? { background: memberColor(t.assigned_to) } : undefined}
                    aria-haspopup="menu"
                    aria-expanded={assignFor === t.id}
                    aria-label={
                      !t.assigned_to
                        ? '담당자 지정'
                        : assignedGone
                        ? '팀을 나간 멤버 · 클릭해 변경'
                        : `담당: ${memberName(assignedMember!, userId).replace(' (나)', '')} · 클릭해 변경`
                    }
                    title={
                      !t.assigned_to
                        ? '담당자 지정'
                        : assignedGone
                        ? '팀을 나간 멤버'
                        : `담당: ${memberName(assignedMember!, userId).replace(' (나)', '')} · 클릭해 변경`
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAssignFor((cur) => (cur === t.id ? null : t.id));
                    }}
                  >
                    {!t.assigned_to ? '+' : assignedGone ? '?' : memberInitial(assignedMember)}
                  </button>
                  {assignFor === t.id && (
                    <div className="ws-assignee-menu" role="menu">
                      {t.assigned_to !== userId && (
                        <button
                          type="button"
                          role="menuitem"
                          className="ws-assignee-item ws-assignee-me"
                          onClick={() => assignTodo(t, userId)}
                        >
                          👋 내가 맡기
                        </button>
                      )}
                      {members.map((m) => (
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={m.user_id === t.assigned_to}
                          className="ws-assignee-item"
                          key={m.user_id}
                          onClick={() => assignTodo(t, m.user_id)}
                        >
                          <span className="ws-assignee-dot" style={{ background: memberColor(m.user_id) }}>
                            {memberInitial(m)}
                          </span>
                          {memberName(m, userId)}
                          {m.user_id === t.assigned_to && <span className="ws-assignee-check">✓</span>}
                        </button>
                      ))}
                      {t.assigned_to && (
                        <button
                          type="button"
                          role="menuitem"
                          className="ws-assignee-item ws-assignee-clear"
                          onClick={() => assignTodo(t, null)}
                        >
                          담당 해제
                        </button>
                      )}
                    </div>
                  )}
                </span>
              )}
              <span className="ws-item-actions">
                <button className="ws-edit" onClick={() => openEdit(t)} title="편집">
                  ✎
                </button>
                {depth < MAX_UI_DEPTH - 1 && (
                  <button
                    className="mm-addchild"
                    onClick={() => {
                      setMindAdd({ catId: t.category_id, parentId: t.id });
                      setMindAddTitle('');
                    }}
                    title="하위 할 일 추가"
                  >
                    + 하위
                  </button>
                )}
                <button className="ws-x" onClick={() => deleteTodo(t)} title="할 일 삭제">
                  ×
                </button>
              </span>
                    </span>
                  </div>
                  </div>
                </div>
                {open && checklistPanel(t)}
              </div>
            )}
          </DraggableTodo>
        )}
        {(t.children.length > 0 || childForm) && (
          <div className="ws-children">
            {t.children.map((c) => renderTodo(c, depth + 1))}
            {childForm && renderMindAddForm(t.category_id, t.id)}
          </div>
        )}
      </div>
    );
  };

  // ---------- 게임 바 ----------
  return (
    <>
      <Confetti fireKey={confettiKey} />
      <LevelUpOverlay data={levelUp} onClose={() => setLevelUp(null)} />
      <QuotaModal code={quotaCode} onClose={() => setQuotaCode(null)} />
      {toast && (
        <div className="game-toast" key={toast.key}>
          <span className="game-toast-icon">{toast.icon}</span>
          <div>
            <div className="game-toast-title">{toast.title}</div>
            {toast.sub && <div className="game-toast-sub">{toast.sub}</div>}
          </div>
        </div>
      )}

      <GameBar gXp={gXp} gDone={gDone} />

      {projects.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center' }}>
          <h2 className="heading">아직 프로젝트가 없습니다</h2>
          <p className="body" style={{ margin: '10px 0 22px' }}>
            첫 프로젝트를 만들어 나만의 업무 공간을 시작하세요. 할 일을 완료할 때마다 XP와 칭호가 쌓입니다!
          </p>
          <div className="ws-addproj" style={{ justifyContent: 'center' }}>
            <input
              className="ws-input"
              placeholder="첫 프로젝트 이름"
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) submitProject();
              }}
            />
            <button className="btn btn-dark btn-sm" onClick={submitProject}>
              + 만들기
            </button>
          </div>
        </div>
      ) : (
        <div className="ws">
          <div className="ws-toprow">
          <div className="ws-tabs">
            {projects.map((p) => (
              <button key={p.id} className={`ws-tab${p.id === activeId ? ' active' : ''}`} onClick={() => setActiveId(p.id)}>
                {p.name}
              </button>
            ))}
            {addingProject ? (
              <span className="ws-addproj">
                <input
                  className="ws-input"
                  autoFocus
                  placeholder="프로젝트 이름"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) submitProject();
                    if (e.key === 'Escape') setAddingProject(false);
                  }}
                />
                <button className="btn btn-dark btn-sm" onClick={submitProject}>
                  추가
                </button>
                <button className="btn btn-light btn-sm" onClick={() => setAddingProject(false)}>
                  취소
                </button>
              </span>
            ) : (
              <button
                className="ws-tab ws-tab-add"
                onClick={() => {
                  setAddingProject(true);
                  setProjName('');
                }}
              >
                + 프로젝트
              </button>
            )}
          </div>
          <div className="ws-viewtoggle">
            <button className={`ws-vbtn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')}>
              ▦ 목록 뷰
            </button>
            <button className={`ws-vbtn${view === 'mindmap' ? ' active' : ''}`} onClick={() => setView('mindmap')}>
              ⌗ 마인드맵 뷰
            </button>
          </div>
          </div>

          <div className="ws-stats">
            <div className="ws-chip">
              <span className="ws-num">{total}</span>
              <span className="ws-label">전체 할 일</span>
            </div>
            <div className="ws-chip">
              <span className="ws-num" style={{ color: 'var(--color-meadow-green)' }}>
                {done}
              </span>
              <span className="ws-label">완료</span>
            </div>
            <div className="ws-progress">
              <div className="ws-progress-head">
                <span className="ws-label">진행률</span>
                <span className="ws-pct">{pct}%</span>
              </div>
              <div className="ws-bar">
                <div className="ws-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
            {view === 'list' && categories.length > 1 && (
              <button className="ws-fold-all" onClick={() => setAllCollapsed(anyExpanded)}>
                {anyExpanded ? '모두 접기' : '모두 펼치기'}
              </button>
            )}
            {activeProject && canManage && (
              <button className="ws-del-project" onClick={() => deleteProject(activeProject)} title="프로젝트 삭제">
                프로젝트 삭제
              </button>
            )}
          </div>

          {loading ? (
            <p className="muted" style={{ padding: '40px 0', textAlign: 'center' }}>
              불러오는 중…
            </p>
          ) : view === 'mindmap' ? (
            <div className="mm">
              <div className="mm-root">{activeProject?.name ?? '프로젝트'}</div>
              <div className="mm-branches">
                {categories.map((cat, i) => {
                  const items = todos.filter((t) => t.category_id === cat.id);
                  const cdone = items.filter((t) => t.completed).length;
                  const cpct = items.length ? Math.round((cdone / items.length) * 100) : 0;
                  const open = !!expanded[cat.id];
                  return (
                    <div className="mm-branch" key={cat.id}>
                      <button
                        className="mm-node"
                        style={{ borderLeftColor: catColor(i) }}
                        onClick={() => setExpanded((e) => ({ ...e, [cat.id]: !e[cat.id] }))}
                      >
                        <span className="mm-node-top">
                          <span className="mm-dot" style={{ background: catColor(i) }} />
                          <span className="mm-node-name">{cat.name}</span>
                          <span className="mm-caret">{open ? '▾' : '▸'}</span>
                        </span>
                        <span className="mm-node-prog">
                          <span className="mm-mini">
                            {cdone}/{items.length}
                          </span>
                          <span className="mm-mbar">
                            <span className="mm-mfill" style={{ width: `${cpct}%`, background: catColor(i) }} />
                          </span>
                          <span className="mm-pct">{cpct}%</span>
                        </span>
                      </button>
                      {open && (
                        <div className="mm-leaves" style={{ borderLeftColor: catColor(i) }}>
                          {(tree.rootsByCategory.get(cat.id) ?? []).map((n) => renderMindNode(n, catColor(i)))}
                          {mindAdd?.catId === cat.id && mindAdd.parentId === null ? (
                            renderMindAddForm(cat.id, null)
                          ) : (
                            <button
                              className="mm-add-root"
                              onClick={() => {
                                setMindAdd({ catId: cat.id, parentId: null });
                                setMindAddTitle('');
                              }}
                            >
                              + 할 일
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {categories.length === 0 && (
                  <p className="muted" style={{ marginLeft: 24 }}>
                    카테고리가 없습니다. 목록 뷰에서 추가하세요.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={() => setDragId(null)}
            >
            <div className="ws-cols">
              {categories.map((cat) => {
                const items = todos.filter((t) => t.category_id === cat.id);
                const catDone = items.filter((t) => t.completed).length;
                const catPct = items.length ? Math.round((catDone / items.length) * 100) : 0;
                // 서브트리까지 전부 끝난 루트만 완료 구역으로 내린다. 하위가 남은 루트는 활성 구역에 남겨 묻히지 않게 한다.
                const doneRoots: Node<Todo>[] = [];
                const activeRoots: Node<Todo>[] = [];
                for (const n of tree.rootsByCategory.get(cat.id) ?? []) {
                  const s = subtreeStats(n);
                  (s.done === s.total ? doneRoots : activeRoots).push(n);
                }
                const collapsed = !!collapsedCats[cat.id];
                const showDone = !!openDone[cat.id];
                const foldLabel = `'${cat.name}' 컬럼 ${collapsed ? '펼치기' : '접기'}`;
                const pulsing = pulseCat?.id === cat.id;
                return (
                  <div className={`ws-col${collapsed ? ' ws-col-folded' : ''}`} key={cat.id}>
                    <div className="ws-col-head">
                      <button
                        className="ws-fold"
                        aria-expanded={!collapsed}
                        aria-label={foldLabel}
                        title={foldLabel}
                        onClick={() => patchFold('cols', cat.id, !collapsed)}
                      >
                        {collapsed ? '▸' : '▾'}
                      </button>
                      {editingCatId === cat.id ? (
                        <input
                          className="ws-input"
                          autoFocus
                          value={eCatName}
                          onChange={(e) => setECatName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) saveEditCat();
                            if (e.key === 'Escape') setEditingCatId(null);
                          }}
                        />
                      ) : (
                        <span className="ws-col-name" onDoubleClick={() => openEditCat(cat)} title="더블클릭하여 이름 변경">
                          {cat.name}
                        </span>
                      )}
                      <span className="ws-col-right">
                        <span
                          className={`ws-col-count${pulsing ? ' ws-count-pulse' : ''}`}
                          key={pulsing ? pulseCat.key : 'count'}
                        >
                          {catDone}/{items.length}
                        </span>
                        <button className="ws-edit" onClick={() => openEditCat(cat)} title="이름 변경">
                          ✎
                        </button>
                        {canManage && (
                          <button className="ws-x" onClick={() => deleteCategory(cat)} title="카테고리 삭제">
                            ×
                          </button>
                        )}
                      </span>
                    </div>
                    {collapsed ? (
                      // 접혀 있어도 드롭은 받는다. 진행 미터가 항상 안에 있어 rect가 0이 되지 않는다.
                      <DroppableColumn id={`cat:${cat.id}`} className="ws-fold-drop">
                        <div className="ws-col-meter" role="img" aria-label={`진행률 ${catPct}%`}>
                          <div className="ws-col-meter-fill" style={{ width: `${catPct}%` }} />
                        </div>
                        {dragId ? <div className="ws-fold-hint">여기에 놓기</div> : null}
                      </DroppableColumn>
                    ) : (
                      <DroppableColumn id={`cat:${cat.id}`}>
                        {activeRoots.map((n) => renderTodo(n))}
                        {activeRoots.length === 0 && doneRoots.length > 0 && (
                          <p className="ws-empty">이 카테고리의 할 일을 모두 끝냈어요</p>
                        )}
                        {addTodoForm(cat.id)}
                        {doneRoots.length > 0 && (
                          <div className="ws-done-fold">
                            <button
                              className="ws-done-toggle"
                              aria-expanded={showDone}
                              onClick={() => patchFold('done', cat.id, !showDone)}
                            >
                              완료 {doneRoots.length}개 {showDone ? '접기 ▾' : '보기 ▸'}
                            </button>
                            {showDone && doneRoots.map((n) => renderTodo(n))}
                          </div>
                        )}
                      </DroppableColumn>
                    )}
                  </div>
                );
              })}

              <div className="ws-col ws-col-ghost">
                {addingCategory ? (
                  <div className="ws-addform" style={{ width: '100%' }}>
                    <input
                      className="ws-input"
                      autoFocus
                      placeholder="카테고리 이름"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) submitCategory();
                        if (e.key === 'Escape') setAddingCategory(false);
                      }}
                    />
                    <div className="ws-addform-actions">
                      <button className="btn btn-dark btn-sm" onClick={submitCategory}>
                        추가
                      </button>
                      <button className="btn btn-light btn-sm" onClick={() => setAddingCategory(false)}>
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="ws-add-cat"
                    onClick={() => {
                      setAddingCategory(true);
                      setCatName('');
                    }}
                  >
                    + 카테고리 추가
                  </button>
                )}
              </div>
            </div>
            <DragOverlay dropAnimation={null}>
              {dragNode ? (
                <div className="ws-drag-overlay">
                  ⠿ {dragNode.title}
                  {dragNode.children.length > 0 && (
                    <span className="mm-substat">하위 {collectSubtreeIds(dragNode).length - 1}</span>
                  )}
                </div>
              ) : null}
            </DragOverlay>
            </DndContext>
          )}
        </div>
      )}
    </>
  );
}
