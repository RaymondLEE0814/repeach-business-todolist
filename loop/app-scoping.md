# [구조] Mindash ↔ life-exit.com 앱 단위 DB 스코핑 분리

> 설계: Fable / 구현: Opus 4.8 · 2026-07-14

## 문제
- 한 Supabase 프로젝트를 Mindash와 life-exit.com(`lev_*`)이 공유. `auth.users`는 프로젝트당 1개 → 공유 불가피.
- Mindash 트리거 `on_auth_user_created`가 **모든 가입**에 `profiles` 행 생성 → 다른 사이트 가입자까지 섞여 관리자 페이지에 142명 표시.

## 결정
사용자 선택: **앱 단위 스코핑**(별도 Supabase 프로젝트 X). 기존 Mindash 사용자/데이터 유지, 재가입 없음. `lev_*`·`on_auth_user_created_lev`·`auth.users` 무접촉.

## 설계 핵심 (Fable)
- **`profiles.mindash_member` boolean 플래그**로 실제 Mindash 사용자만 스코핑(삭제 X, 되돌림 가능).
- **CHECK 불변식 `mindash_member OR status='pending'`** → 비멤버=자동 pending → 기존 status 기반 게이트가 코드 수정 없이 정합.
- **backfill**: projects/teams/team_members/invites/todos/subtasks/mindash_admins + 시드관리자 활동 신호 UNION → member=true(status 무변경). 비멤버는 status pending으로 리셋.
- **트리거 조건부화**: signUp `data.app='mindash'` 마커가 있을 때만 profiles 생성. 다른 사이트 신규가입 유입 차단.
- **`mindash_ensure_member()` RPC**: lev 전용 계정이 Mindash 로그인/pending 접근 시 pending 멤버로 편입(기존 멤버 무변경).
- **`mindash_is_approved()`에 `and mindash_member` 추가** → RLS 전체(can_access/manage_project, 팀 RPC) 자동 전파. set_user_status/set_admin은 상태 변경 시 member=true 확정(CHECK 위반 방지).

## 변경 파일
- 마이그레이션: `mindash/supabase/migration_app_scoping.sql` (S1~S8, 트랜잭션 1개)
- `app/actions/auth.ts`: signUp `app:'mindash'` 마커, signIn `mindash_ensure_member` 편입+분기
- `app/admin/page.tsx`: `.eq('mindash_member', true)` 필터
- `lib/supabase/middleware.ts`: 행 없음 기본값 `true→false` flip, /pending 블록 no-row 허용
- `app/dashboard/layout.tsx`: no-row → /pending
- `app/pending/page.tsx`: `mindash_ensure_member` 호출로 편입(리다이렉트 루프 방지)
- 무수정: `api/chat/route.ts`, `AdminUsers.tsx`, `migration_teams.sql` team join, `lev_*` 일체

## 실행 순서
DB 마이그레이션 먼저 → 즉시 앱 배포(**repo 루트에서** — plan.life-exit.com=repeach-business-todolist 프로젝트).

## 검증
`select mindash_member, status, count(*) from profiles group by 1,2;` → (true,approved)=Mindash 사용자 / (false,pending)=나머지 / (false, approved|rejected)=0. 관리자 페이지 "전체 N명"이 member=true 수와 일치. 두 auth 트리거 다 존재.
