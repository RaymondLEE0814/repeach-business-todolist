# [버그수정] 챗봇 팀 컨텍스트 인지

> 설계: Fable / 구현: Opus 4.8 · 2026-06-11

## 증상
팀 스페이스에서 챗봇에 "신규 프로젝트 만들고 할 일 7개 추가" 요청 시, 챗봇은 "등록 완료"라고 답하지만 팀 화면엔 안 보임(빈 프로젝트).

## 진단 (재현으로 확정)
- 팀 프로젝트 할 일 insert는 DB/RLS **정상**(문제 아님).
- 챗봇 `create_project`가 **team_id를 안 넣어 항상 개인 프로젝트**로 생성(NULL 확인).
- `add_todo` 폴백이 "개인 프로젝트 우선"이라 팀 컨텍스트에서도 개인으로 감.
- 근본: **챗봇 파이프라인에 "현재 컨텍스트(개인/팀)" 전달 자체가 없음.**

## 수정 (마이그레이션 불필요, RLS가 최종 방어)
1. `app/dashboard/chatContext.ts` (신규): 모듈 싱글턴으로 현재 컨텍스트(teamId/teamName) 보관.
2. `DashboardShell.tsx`: context 변경 시 `setChatContext` 동기화(useEffect).
3. `ChatWidget.tsx`: send 시 `teamId` 전송 + 헤더에 현재 컨텍스트 배지(개인/팀).
4. `api/chat/route.ts`: teamId를 `teams` select(RLS)로 **검증(비멤버 403)**, 프로젝트 목록을 컨텍스트로 필터, 시스템 프롬프트에 컨텍스트 + 환각 방지 규칙 주입, `ToolCtx.currentTeamId`.
5. `lib/chat/tools.ts`: `inContext` 헬퍼, `findProject` 2단계(컨텍스트 우선→전체), `create_project`가 `team_id=currentTeamId`(+`personal` 옵션), `add_todo`/`create_category` 폴백을 컨텍스트 기준, 자동생성 프로젝트도 team_id 반영.
6. `lib/chat/agent.ts`: `changed=false`인데 "완료/등록" 주장하면 경고 부기(환각 사후 가드).

## 테스트 시나리오
팀 전환 → "프로젝트 X 만들고 할일 7개" → team_id=그 팀 + 7건 등록 + 개수 정확 보고 / 개인에서는 team_id NULL(회귀) / "개인에 만들어줘"는 personal / 비멤버 teamId 위조 403.
