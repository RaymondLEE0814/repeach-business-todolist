-- ============================================================
-- Mindash ↔ life-exit 격리 · Phase 1: life-exit 트리거에 app 가드 추가
-- 설계: Fable 5 / 구현: Opus 4.8 · ref xdxqmoeggvnlvjgxttdf
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 [Run]
--
-- 문제: on_auth_user_created_lev 트리거가 WHEN 조건 없이 모든 auth.users insert에
--       발동 → Mindash 가입자까지 lev_profiles에 적재(누수).
-- 해결: 트리거에 WHEN (app <> 'mindash') 가드를 붙여 재생성.
--       lev_handle_new_user 함수 본문은 건드리지 않음 → life-exit 로직 완전 무변경.
--       life-exit 가입은 app 마커가 없으므로 WHEN이 항상 참 → 동작 그대로.
--       Mindash 가입은 app='mindash'이므로 WHEN이 거짓 → lev_profiles 미생성.
--
-- 참고: 확인된 원본 트리거 정의 (롤백 근거)
--   CREATE TRIGGER on_auth_user_created_lev AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION lev_handle_new_user()
-- ============================================================

begin;

drop trigger if exists on_auth_user_created_lev on auth.users;

create trigger on_auth_user_created_lev
  after insert on auth.users
  for each row
  when (coalesce(new.raw_user_meta_data ->> 'app', '') <> 'mindash')
  execute function lev_handle_new_user();

commit;

-- ── 검증 (별도 실행) ──────────────────────────────────────
--   select tgname, pg_get_triggerdef(oid, true) from pg_trigger
--    where tgrelid='auth.users'::regclass and not tgisinternal;   -- lev 트리거에 WHEN 절 확인
--   -- Mindash에서 테스트 가입 1건 → 아래가 증가하지 않아야 함:
--   select count(*) from public.lev_profiles;
--   -- life-exit.com에서 테스트 가입 1건 → lev_profiles가 정상 증가해야 함

-- ── 롤백 (원상복구, 필요 시) ───────────────────────────────
--   begin;
--     drop trigger if exists on_auth_user_created_lev on auth.users;
--     create trigger on_auth_user_created_lev after insert on auth.users
--       for each row execute function lev_handle_new_user();
--   commit;
