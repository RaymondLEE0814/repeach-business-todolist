// 프리투페이드 무료 한도 + 쿼터 에러 파싱.
// ★ 숫자는 supabase/migration_plans.sql · migration_team_quotas.sql 의 트리거 리터럴과 동기화할 것.
export const FREE_LIMITS = {
  personalProjects: 3,
  personalTodos: 300,
  teamMembers: 3, // 팀장 포함
  teamTodos: 300,
} as const;

export type QuotaCode =
  | 'personal_projects'
  | 'personal_todos'
  | 'project_todos_hard'
  | 'team_members'
  | 'team_todos';

// Postgres가 raise exception 메시지를 supabase-js error.message에 그대로 전달한다.
export function parseQuotaError(message?: string | null): QuotaCode | null {
  if (!message) return null;
  const m = message.match(/MINDASH_QUOTA:(\w+)/);
  return m ? (m[1] as QuotaCode) : null;
}

// 업그레이드 모달 카피. 비파괴 원칙("기존 데이터는 유지")을 본문에 명시.
export const QUOTA_COPY: Record<QuotaCode, { title: string; body: string }> = {
  personal_projects: {
    title: '무료 플랜 한도에 도달했어요',
    body: `무료 플랜에서는 개인 프로젝트를 ${FREE_LIMITS.personalProjects}개까지 만들 수 있어요. 지금까지 만든 프로젝트와 할 일은 그대로 안전하게 유지됩니다. 업그레이드하면 프로젝트를 무제한으로 만들 수 있어요.`,
  },
  personal_todos: {
    title: '무료 플랜 한도에 도달했어요',
    body: `무료 플랜의 할 일 ${FREE_LIMITS.personalTodos}개를 모두 사용했어요. 기존 할 일은 계속 보고, 완료하고, 수정할 수 있어요. 새 할 일을 계속 추가하려면 업그레이드해 주세요.`,
  },
  project_todos_hard: {
    title: '이 프로젝트가 가득 찼어요',
    body: '한 프로젝트에는 할 일을 1,000개까지 담을 수 있어요. 새 프로젝트로 나눠서 관리해 주세요.',
  },
  team_members: {
    title: '무료 팀 인원이 가득 찼어요',
    body: `무료 팀은 팀장 포함 ${FREE_LIMITS.teamMembers}명까지 함께할 수 있어요. 업그레이드하면 더 많은 팀원을 초대할 수 있어요.`,
  },
  team_todos: {
    title: '무료 팀 한도에 도달했어요',
    body: `무료 팀의 할 일 ${FREE_LIMITS.teamTodos}개를 모두 사용했어요. 기존 할 일은 그대로 유지돼요. 새 할 일을 계속 추가하려면 팀 플랜으로 업그레이드해 주세요.`,
  },
};
