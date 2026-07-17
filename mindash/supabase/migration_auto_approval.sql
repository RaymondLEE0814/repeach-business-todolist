-- ============================================================
-- Mindash 자동승인 전환 + 가입 트리거 병합(nickname/phone 저장)
-- 설계: Fable 5 / 구현: Opus 4.8 · ref xdxqmoeggvnlvjgxttdf
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 [Run] (멱등·트랜잭션)
--
-- 이 파일 하나가 두 작업을 합칩니다:
--   (가) 회원가입 폼: handle_new_user가 nickname/phone도 profiles에 저장
--   (나) 자동승인: 신규 가입 status 기본값 approved + 기존 pending 멤버 일괄 승인
--
-- ★ 중요: mindash_is_approved()·can_access/manage·미들웨어 게이트 로직은 한 줄도
--   바꾸지 않습니다. 자동승인은 "status 값의 변화"일 뿐, 게이트 자체는 rejected(차단)
--   기능으로 그대로 존치됩니다.
-- ============================================================

begin;

-- ── 0) 회원가입 폼 컬럼(멱등) — migration_signup_fields.sql을 이미 실행했다면 no-op ──
alter table public.profiles
  add column if not exists nickname text,
  add column if not exists phone    text;
grant update (full_name, nickname, phone) on public.profiles to authenticated;

-- ── A) 신규 가입 기본값: approved ──
alter table public.profiles alter column status set default 'approved';

-- ── B) 기존 pending "Mindash 멤버"만 일괄 승인 (rejected는 유지 = 차단 기능 존치) ──
--     ⚠ where mindash_member 필수: 비멤버(lev 사용자)는 pending 유지.
--       CHECK(mindash_member or status='pending')가 실수 시 2차 안전망.
update public.profiles
set status = 'approved', approved_at = coalesce(approved_at, now())
where mindash_member and status = 'pending';

-- ── C) 가입 트리거 병합: app=mindash 가입 → nickname/phone 저장 + status approved ──
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data ->> 'app' = 'mindash' then
    insert into public.profiles (id, email, full_name, nickname, phone, status, mindash_member, mindash_joined_at)
    values (
      new.id,
      new.email,
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'nickname',
      new.raw_user_meta_data ->> 'phone',
      'approved',
      true,
      now()
    )
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

-- ── D) lev 계정의 Mindash 편입도 즉시 approved (기존 멤버 status는 무변경) ──
create or replace function public.mindash_ensure_member()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;
  insert into public.profiles (id, email, full_name, status, mindash_member, mindash_joined_at)
  values (auth.uid(), auth.jwt() ->> 'email',
          nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''), 'approved', true, now())
  on conflict (id) do update
    set mindash_member    = true,
        mindash_joined_at = coalesce(profiles.mindash_joined_at, now())
    where not profiles.mindash_member;   -- 기존 멤버(rejected 포함)의 status는 절대 무변경
  select status into v_status from profiles where id = auth.uid();
  return jsonb_build_object('ok', true, 'status', v_status);
end $$;

commit;

-- ── 검증 (별도 실행) ──────────────────────────────────────
--   select status, count(*) from public.profiles where mindash_member group by 1;   -- pending 0 기대
--   select count(*) from public.profiles where not mindash_member and status <> 'pending';  -- 0 기대(lev 무오염)
--   -- 신규 가입 → 즉시 /dashboard 진입, profiles.status='approved', nickname/phone 저장 확인:
--   select full_name, nickname, phone, status from public.profiles order by created_at desc limit 5;

-- ── 롤백 (필요 시) ────────────────────────────────────────
--   alter table public.profiles alter column status set default 'pending';
--   (handle_new_user / mindash_ensure_member 의 status 리터럴을 'pending'으로 되돌려 재배포)
--   ※ 이미 승인된 사용자는 되돌리지 않음(파괴적 롤백 불필요).
