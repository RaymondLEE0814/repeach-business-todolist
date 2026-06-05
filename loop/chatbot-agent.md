# [작업/이슈] 챗봇(자연어 일정 관리) 도입

> 상태: 진행 중 · 작성일 2026-06-05
> 참조 키트: [`todolist_LMS_sales/chat-system-kit/`](../todolist_LMS_sales/chat-system-kit/)
> 구현 대상: [`mindash/`](../mindash/)

## 목표
대시보드 우하단 플로팅 챗봇으로 **자연어로 일정을 조회·추가·완료**한다.
예) "내일 제안서 초안 쓰기 추가해줘", "오늘 할 일 뭐야?", "제안서 완료 처리해줘".

## 키트 대비 적응 (요약)
| 키트(파일 편집 도메인) | Mindash 적용 |
|---|---|
| Fastify 독립 서버 | Next.js Route Handler `app/api/chat/route.ts` |
| SQLite + 백그라운드 큐 + jobs 폴링 | 제거 — 할 일 조작은 빠름 → **인라인 처리** |
| 파일 read/write/edit/list/grep 툴 | **Supabase 할 일 툴** (아래) |
| public/ 경로 가두기 | **로그인 사용자 RLS** (owner 격리) ★보안 핵심 |
| 라우터(chat/task) 분리 | 단일 에이전트 루프로 통합(flash가 텍스트/툴 자동 선택) |
| floating-chat.js 바닐라 | React `<ChatWidget>` (IME 가드 유지) |

## 툴 (function-calling)
- `list_projects()` — 내 프로젝트 목록
- `list_todos({ when?: today|week|overdue|all, project?, include_completed? })`
- `add_todo({ title, project?, category?, due_date?, difficulty? })`
- `complete_todo({ query, project? })` — 제목 부분일치로 찾아 완료
- `create_project({ name })`
- `create_category({ project, name })`

## 설계 결정 / 이슈
1. **인증/RLS**: 에이전트 툴은 요청의 **로그인 세션 Supabase 클라이언트**로 실행 →
   본인 소유 데이터만 접근(다른 사용자 데이터 불가). 비로그인 호출은 401.
2. **모델**: `gemini-2.5-flash` 단일(라우터 분리 없이). function-calling으로
   수다는 텍스트, 작업은 툴 호출. 환경변수 `GEMINI_MODEL`로 교체 가능.
3. **런타임**: Route Handler `export const runtime = 'nodejs'` (@google/genai는 Node).
4. **컨텍스트 주입**: 시스템 프롬프트에 오늘 날짜 + 내 프로젝트 목록 주입(왕복 절약).
5. **카테고리 필수 처리**: add_todo 시 카테고리 미지정이면 프로젝트의 첫 카테고리
   사용, 없으면 기본 '할 일' 카테고리 자동 생성.
6. **클라이언트 동기화**: 작업 후 `window` 커스텀 이벤트(`mindash:data-changed`)를
   디스패치 → Workspace/TodayView가 데이터 재로딩.
7. **게임화**: 챗봇 완료도 DB만 갱신 → 클라이언트 재로딩 시 XP 반영(컨페티는 수동 체크 때만).

## 🔑 필요한 것 (외부 의존)
- **GEMINI_API_KEY** (Google AI Studio, 무료): https://aistudio.google.com/apikey
  - 로컬 `.env.local` + Vercel 환경변수에 추가해야 라이브 동작.

## 롤아웃 체크리스트
- [ ] @google/genai 설치
- [ ] tools / agent / route / ChatWidget 구현
- [ ] 로컬 빌드(타입체크) 통과
- [ ] GEMINI_API_KEY 발급 + .env.local 설정 → 로컬 테스트
- [ ] Vercel 환경변수 추가 → 배포 → 라이브 점검

## 알려진 한계 / 다음 단계
- 음성/멀티턴 기억은 v1 범위 외(세션 history는 클라이언트가 함께 전송).
- 삭제(프로젝트/할 일)는 v1 제외(실수 방지) — 추후 확인형으로 추가 가능.
