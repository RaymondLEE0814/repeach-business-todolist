-- ============================================================
-- Mindash 회원가입 필드 확장: nickname / phone
-- 설계: Fable 5 / 구현: Opus 4.8 · ref xdxqmoeggvnlvjgxttdf
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 [Run] (멱등)
--
-- ★ 실행 순서: 이 마이그레이션(컬럼 추가) → 이후 handle_new_user 트리거 갱신(nickname/phone insert).
--   역순이면 신규 가입이 전부 실패한다.
-- ============================================================

begin;

alter table public.profiles
  add column if not exists nickname text,
  add column if not exists phone    text;

-- admin_approval에서 full_name만 update 허용했으므로 확장(향후 프로필 편집 대비)
grant update (full_name, nickname, phone) on public.profiles to authenticated;

commit;

-- (선택) 트리거 갱신 전에 가입한 사용자 backfill — 값은 raw_user_meta_data에 남아 있어 언제든 복구 가능:
-- update public.profiles p
-- set nickname = coalesce(p.nickname, u.raw_user_meta_data ->> 'nickname'),
--     phone    = coalesce(p.phone,    u.raw_user_meta_data ->> 'phone')
-- from auth.users u where u.id = p.id;
