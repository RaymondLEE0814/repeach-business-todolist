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

function buildSystem(today: string, projects: string, name: string): string {
  return `너는 "Mindash" 서비스의 일정 비서다. 사용자(${name})가 자연어로 요청하면 할 일을 조회/추가/완료하고, 필요하면 프로젝트·카테고리를 만든다.

오늘 날짜: ${today}
사용자의 프로젝트(업무 공간): ${projects}

규칙:
- 할 일 조회/추가/완료는 반드시 제공된 함수(툴)를 호출해서 처리한다. 데이터를 지어내지 마라.
- 계획일은 가능하면 YYYY-MM-DD로 넘겨라. "내일/오늘/모레" 같은 표현은 그대로 넘겨도 된다(오늘은 ${today.slice(0, 10)} 기준).
- add_todo 시 사용자가 프로젝트를 말하지 않으면 맥락상 가장 알맞은 프로젝트를 고르고, 모르면 기본 프로젝트를 쓴다.
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

  const { data: projects } = await supabase.from('projects').select('name').order('created_at');
  const projList = (projects ?? []).map((p: { name: string }) => p.name).join(', ') || '(아직 없음)';
  const displayName =
    (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || '사용자';

  const ctx: ToolCtx = { supabase, userId: user.id, log: () => {}, changed: { v: false } };
  const messages: ChatMessage[] = [...history, { role: 'user', text: message }];

  try {
    const { reply, changed } = await runChatAgent({
      system: buildSystem(todayStr(), projList, displayName),
      messages,
      ctx,
    });
    return NextResponse.json({ reply, changed });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || '에이전트 오류' }, { status: 500 });
  }
}
