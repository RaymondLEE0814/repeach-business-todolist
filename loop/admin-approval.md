# [기능] 관리자 승인제 + 관리자 페이지

> 설계: Fable / 구현: Opus 4.8 · 2026-07-14
> 시드 관리자: **dobestray@naver.com**

## 목표
- 회원가입 후 **관리자 승인**을 받아야 앱 사용 가능(미승인=대기 페이지).
- `/admin` 관리자 페이지에서 **전체 사용자 조회 + 승인/거절/승인취소 + 관리자 지정**.
- 기존 사용자는 **자동 승인**(잠기지 않음).

## 설계 핵심 (Fable)
- **관리자**: 별도 `mindash_admins` 테이블 + `mindash_is_admin()` SECURITY DEFINER 헬퍼(team_members 패턴 동형). 공유 DB라 `mindash_` 접두사.
- **승인상태**: `profiles.status`(pending/approved/rejected) + approved_at/by. **default 'approved'로 컬럼 추가 → backfill → default 'pending'으로 변경**(기존 사용자 자동 승인의 핵심). 트리거는 신규를 pending으로.
- **3중 게이트**:
  1. 미들웨어: /dashboard·/admin·/api/ 경로에서 status 단건 조회 → 미승인 redirect /pending(또는 API 403), /admin은 관리자 아니면 /dashboard. (DB 조회라 승인취소 **즉시 반영**)
  2. `app/dashboard/layout.tsx` / `app/admin/layout.tsx` 서버 재확인
  3. RLS 최종선: `can_access_project`/`can_manage_project` 첫머리에 `mindash_is_approved() and ...` 주입 → 미승인자는 PostgREST 직접 호출로도 데이터 0건. create_team/accept_team_invite RPC도 게이트.
- **자기승인 봉쇄**: `revoke update on profiles` 후 `grant update (full_name)` → 본인은 이름만 수정, status는 DEFINER RPC(`mindash_set_user_status`/`mindash_set_admin`)로만.
- **관리자 페이지**: 전체 profiles(admin RLS로 열림) + 승인/거절/취소/관리자지정 서버액션→RPC. 마지막 관리자 보호.
- **흐름**: signUp→/pending, signIn→status 분기, /invite 열람 OK·수락은 RPC 게이트.

## 신규 파일/변경
- 마이그레이션: `mindash/supabase/migration_admin_approval.sql`
- 신규: `app/pending/page.tsx`, `app/admin/layout.tsx`, `app/admin/page.tsx` + Client, `app/actions/admin.ts`, `app/dashboard/layout.tsx`
- 수정: `lib/supabase/middleware.ts`, `app/actions/auth.ts`, `app/api/chat/route.ts`, `app/auth/confirm/route.ts`

## Phase
- P1 마이그레이션(단독 배포해도 기존 사용자 무영향=안전지점)
- P2 게이트 배선
- P3 관리자 페이지

## 테스트
신규가입→/pending→대시보드/API 차단 / dobestray 로그인→/admin 승인→해당 사용자 접근 가능 / 일반 사용자 /admin→/dashboard / 기존 사용자 무영향 / 승인취소 즉시 반영 / 마지막 관리자 보호.
