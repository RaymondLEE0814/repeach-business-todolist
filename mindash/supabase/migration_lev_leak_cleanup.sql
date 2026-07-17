-- ============================================================
-- Mindash ↔ life-exit 격리 · Phase 2: lev_profiles 누수 정리
-- 설계: Fable 5 / 구현: Opus 4.8 · ref xdxqmoeggvnlvjgxttdf
-- ★ 반드시 Phase 1(migration_lev_isolation.sql) 적용 후에 실행.
--
-- 대상: lev_profiles 행 중 "Mindash 멤버이면서 실제 life-exit 사용자가 아닌" 행.
--   제외 조건(진짜 life-exit 사용자 보호):
--     - lev_admins 에 있으면 제외 (life-exit 관리자)
--     - lev_course_applications 에 신청 기록 있으면 제외 (실제 수강신청자)
--   → 실측상 dobestray@naver.com 1명이 제외되고, 순수 Mindash 사용자 11명이 정리 대상.
--
-- 삭제는 되돌릴 수 없으므로 3단계로: 드라이런 → 백업+삭제 → 검증. 각 블록을 나눠 실행할 것.
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- [2-1] 드라이런 — 삭제 대상만 출력(아무것도 지우지 않음). 이메일 목록을 눈으로 확인하세요.
--        (기대: 11행. dobestray@naver.com은 여기 없어야 정상)
-- ─────────────────────────────────────────────────────────
select lp.id, lp.email
from public.lev_profiles lp
join public.profiles pr on pr.id = lp.id and pr.mindash_member
where not exists (select 1 from public.lev_admins la             where la.user_id = lp.id)
  and not exists (select 1 from public.lev_course_applications ca where ca.user_id = lp.id)
order by lp.email;


-- ─────────────────────────────────────────────────────────
-- [2-2] 백업 + 삭제 — 위 목록을 확인한 뒤에만 실행. 한 트랜잭션.
--        삭제 대상 전체를 백업 테이블에 먼저 복사 → 언제든 복원 가능.
-- ─────────────────────────────────────────────────────────
begin;

create table if not exists public.zz_backup_lev_profiles_20260717 as
select lp.*
from public.lev_profiles lp
join public.profiles pr on pr.id = lp.id and pr.mindash_member
where not exists (select 1 from public.lev_admins la             where la.user_id = lp.id)
  and not exists (select 1 from public.lev_course_applications ca where ca.user_id = lp.id);

delete from public.lev_profiles lp
using public.profiles pr
where pr.id = lp.id and pr.mindash_member
  and not exists (select 1 from public.lev_admins la             where la.user_id = lp.id)
  and not exists (select 1 from public.lev_course_applications ca where ca.user_id = lp.id);

commit;


-- ─────────────────────────────────────────────────────────
-- [2-3] 검증 — 남은 겹침은 "제외된 겸용 사용자"만이어야 함(기대: 1 = dobestray)
-- ─────────────────────────────────────────────────────────
select lp.email
from public.lev_profiles lp
join public.profiles pr on pr.id = lp.id and pr.mindash_member
order by lp.email;
--   백업된 행 수 확인:
select count(*) as backed_up from public.zz_backup_lev_profiles_20260717;


-- ── 롤백 (필요 시): 백업에서 복원 ─────────────────────────
--   insert into public.lev_profiles
--   select * from public.zz_backup_lev_profiles_20260717
--   on conflict (id) do nothing;
--
-- ── 정리(2주 관찰 후, 이상 없으면 백업 테이블 삭제) ────────
--   drop table if exists public.zz_backup_lev_profiles_20260717;
