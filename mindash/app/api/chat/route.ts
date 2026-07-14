import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runChatAgent, type ChatMessage } from '@/lib/chat/agent';
import type { ToolCtx } from '@/lib/chat/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pad = (n: number) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} (${wd})`;
};

function buildSystem(today: string, projects: string, name: string, teamName: string | null): string {
  const contextBlock = teamName
    ? `현재 컨텍스트: 사용자는 지금 팀 "${teamName}" 스페이스를 보고 있다.
- 사용자가 다른 공간을 명시하지 않는 한, 새 프로젝트/할 일은 모두 이 팀에 만들어진다(툴이 자동 처리하므로 team을 따로 지정할 필요 없음).
- 사용자가 "개인에/내 개인 공간에"라고 명시하면 create_project의 personal 옵션을 true로 준다.
- 아래 프로젝트 목록은 이 팀 스페이스의 프로젝트다.`
    : `현재 컨텍스트: 사용자는 지금 개인 공간을 보고 있다. 새 프로젝트/할 일은 개인 공간에 만들어진다.
- 아래 프로젝트 목록은 개인 공간의 프로젝트다.`;
  return `너는 "Mindash" 서비스의 일정 비서다. 사용자(${name})가 자연어로 요청하면 할 일을 조회/추가/완료하고, 필요하면 프로젝트·카테고리를 만든다.

${contextBlock}

오늘 날짜: ${today}
사용자의 프로젝트(업무 공간): ${projects}

규칙:
- 할 일 조회/추가/완료는 반드시 제공된 함수(툴)를 호출해서 처리한다. 데이터를 지어내지 마라.
- **데이터 변경(추가/완료/생성)은 반드시 해당 툴을 호출해 그 결과(ok:true)를 확인한 뒤에만 "했다"고 보고한다. 툴을 호출하지 않았거나 결과가 실패면 절대 완료했다고 말하지 마라.**
- **여러 항목을 추가할 때는 항목마다 add_todo를 각각 호출한다(한 번에 하나). 모든 호출 결과가 돌아온 뒤 실제 성공 개수를 세어 보고한다.**
- 계획일은 가능하면 YYYY-MM-DD로 넘겨라. "내일/오늘/모레" 같은 표현은 그대로 넘겨도 된다(오늘은 ${today.slice(0, 10)} 기준).
- add_todo/create_project 시 team은 지정하지 마라 — 현재 컨텍스트(위)에 맞춰 툴이 자동 처리한다.
- complete_todo가 여러 후보를 돌려주면 그 목록을 보여주고 어떤 걸 완료할지 되묻는다.
- 작업을 마치면 무엇을 했는지 한국어 1-2문장으로 간결하고 친근하게 보고한다(이모지 적당히).
- 정보가 부족하면 짧게 되묻는다. 추측으로 위험한 변경을 하지 마라.
- 삭제 기능은 아직 없다. 삭제 요청은 정중히 안내하고, 대신 화면에서 직접 지우도록 권한다.
- 한국어로 답한다.`;
}

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // 승인 게이트: 미승인 사용자는 챗봇(및 DB 변경) 사용 불가
  const { data: prof } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .maybeSingle();
  const { data: adm } = await supabase
    .from('mindash_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!adm && prof && prof.status !== 'approved') {
    return NextResponse.json(
      { error: '관리자 승인 대기 중입니다. 승인 후 이용할 수 있어요.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message ?? '').trim();
  if (!message) return NextResponse.json({ error: 'message가 비었습니다.' }, { status: 400 });

  const rawHistory = Array.isArray(body?.history) ? body.history : [];
  const history: ChatMessage[] = rawHistory
    .slice(-8)
    .map((m: { role?: string; text?: string }) => ({
      role: m.role === 'assistant' || m.role === 'model' ? ('model' as const) : ('user' as const),
      text: String(m.text ?? ''),
    }))
    .filter((m: ChatMessage) => m.text.trim());

  // 현재 컨텍스트(개인/팀) — 클라이언트 힌트를 RLS로 검증(신뢰하지 않음)
  const rawTeamId = typeof body?.teamId === 'string' && body.teamId.trim() ? body.teamId.trim() : null;
  let currentTeamId: string | null = null;
  let currentTeamName: string | null = null;
  if (rawTeamId) {
    // teams - select RLS: 소속 팀만 보임 → 조회 성공 자체가 멤버십 검증
    const { data: team } = await supabase.from('teams').select('id,name').eq('id', rawTeamId).maybeSingle();
    if (!team) {
      return NextResponse.json({ error: '해당 팀에 접근할 수 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.' }, { status: 403 });
    }
    currentTeamId = team.id;
    currentTeamName = team.name;
  }

  // 프로젝트 목록을 현재 컨텍스트로 필터
  let pq = supabase.from('projects').select('name').order('created_at');
  pq = currentTeamId ? pq.eq('team_id', currentTeamId) : pq.is('team_id', null);
  const { data: projects } = await pq;
  const projList = (projects ?? []).map((p: { name: string }) => p.name).join(', ') || '(아직 없음)';
  const displayName =
    (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || '사용자';

  const ctx: ToolCtx = { supabase, userId: user.id, currentTeamId, log: () => {}, changed: { v: false } };
  const messages: ChatMessage[] = [...history, { role: 'user', text: message }];

  try {
    const { reply, changed } = await runChatAgent({
      system: buildSystem(todayStr(), projList, displayName, currentTeamName),
      messages,
      ctx,
    });
    return NextResponse.json({ reply, changed });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || '에이전트 오류' }, { status: 500 });
  }
}
