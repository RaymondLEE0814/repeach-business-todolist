// 클라이언트 전용 모듈 싱글턴 — 챗봇이 "현재 보고 있는 컨텍스트(개인/팀)"를 전송 시점에 읽는다.
// DashboardShell이 값을 쓰고, ChatWidget이 send() 순간 읽는다(리렌더 불필요).
export type ChatContext = { teamId: string | null; teamName: string | null };

const ref: ChatContext = { teamId: null, teamName: null };

export const setChatContext = (c: ChatContext) => {
  ref.teamId = c.teamId;
  ref.teamName = c.teamName;
};

export const getChatContext = (): ChatContext => ({ ...ref });
