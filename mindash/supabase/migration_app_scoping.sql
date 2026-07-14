-- ============================================================
-- Mindash 앱 스코핑 분리 — 전체 DB 마이그레이션 (한 번만 실행)
-- 설계: Fable / 구현: Opus 4.8
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 [Run] (ref xdxqmoeggvnlvjgxttdf)
--
-- 문제: 한 Supabase 프로젝트를 Mindash와 life-exit.com(lev_*)이 공유. auth.users는
--       프로젝트당 1개라, Mindash 트리거가 "모든 가입"에 profiles를 만들어 다른 사이트
--       가입자(142명)까지 관리자 페이지에 섞임.
-- 해결: profiles.mindash_member 플래그로 "실제 Mindash 사용자"만 스코핑.
--       CHECK 불변식(mindash_member OR status='pending')로 비멤버=자동 pending →
--       기존 status 기반 게이트가 코드 수정 없이 그대로 정합.
--       lev_* / on_auth_user_created_lev / auth.users 는 일절 건드리지 않음.
-- ============================================================

begin;

-- ─────────────────────────────────────────────────────────
-- S1) 멤버십 컬럼
-- ─────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists mindash_member    boolean not null default false,
  add column if not exists mindash_joined_at timestamptz;
create index if not exists profiles_mindash_member_idx on public.profiles (mindash_member) where mindash_member;

-- ─────────────────────────────────────────────────────────
-- S2) backfill: Mindash 활동 흔적이 있는 사용자 = 진짜 멤버 (status는 건드리지 않음)
-- ─────────────────────────────────────────────────────────
with mindash_users as (
  select owner_id     as uid from public.projects
  union select owner_id      from public.teams
  union select user_id       from public.team_members
  union select invited_by    from public.team_invites
  union select accepted_by   from public.team_invites where accepted_by is not null
  union select completed_by  from public.todos    where completed_by is not null
  union select assigned_to   from public.todos    where assigned_to  is not null
  union select done_by       from public.subtasks where done_by      is not null
  union select user_id       from public.mindash_admins
  union select id from auth.users where lower(email) = 'dobestray@naver.com'  -- 시드 관리자
)
update public.profiles p
set mindash_member = true,
    mindash_joined_at = coalesce(p.mindash_joined_at, p.created_at, now())
where p.id in (select uid from mindash_users where uid is not null);

-- ─────────────────────────────────────────────────────────
-- S3) 비멤버(다른 사이트 전용)는 pending으로 리셋 (admin_approval의 전원 approved backfill 되돌림)
-- ─────────────────────────────────────────────────────────
update public.profiles
set status = 'pending', approved_at = null, approved_by = null
where not mindash_member;

-- ─────────────────────────────────────────────────────────
-- S4) 불변식: 멤버가 아니면 반드시 pending (게이트 정합의 근거)
-- ─────────────────────────────────────────────────────────
alter table public.profiles drop constraint if exists mindash_member_status_chk;
alter table public.profiles
  add constraint mindash_member_status_chk check (mindash_member or status = 'pending');

-- ─────────────────────────────────────────────────────────
-- S5) 트리거를 조건부로 교체: 'app=mindash' 마커가 있는 가입만 profiles 생성.
--     트리거(on_auth_user_created)와 lev_* 는 그대로. life-exit.com 가입자는 더 이상 유입 안 됨.
-- ─────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data ->> 'app' = 'mindash' then
    insert into public.profiles (id, email, full_name, status, mindash_member, mindash_joined_at)
    values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'pending', true, now())
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

-- ─────────────────────────────────────────────────────────
-- S6) 편입 RPC: lev 전용 사용자가 Mindash에 로그인하면 pending 멤버로 편입(기존 멤버는 무변경)
-- ─────────────────────────────────────────────────────────
create or replace function public.mindash_ensure_member()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;
  insert into public.profiles (id, email, full_name, status, mindash_member, mindash_joined_at)
  values (auth.uid(), auth.jwt() ->> 'email',
          nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''), 'pending', true, now())
  on conflict (id) do update
    set mindash_member    = true,
        mindash_joined_at = coalesce(profiles.mindash_joined_at, now())
    where not profiles.mindash_member;                 -- 기존 멤버는 status 포함 절대 무변경
  select status into v_status from profiles where id = auth.uid();
  return jsonb_build_object('ok', true, 'status', v_status);
end $$;
revoke all on function public.mindash_ensure_member() from public;
grant execute on function public.mindash_ensure_member() to authenticated;

-- ─────────────────────────────────────────────────────────
-- S7) 승인 판정에 멤버십 조건 추가 → RLS 전체(can_access/manage_project, 팀 RPC)에 자동 전파
-- ─────────────────────────────────────────────────────────
create or replace function public.mindash_is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
                 where id = auth.uid() and status = 'approved' and mindash_member)
      or exists (select 1 from mindash_admins where user_id = auth.uid());
$$;

-- ─────────────────────────────────────────────────────────
-- S8) 상태/관리자 변경 RPC: 관리자가 상태를 만지면 멤버로 확정(CHECK 위반 방지)
-- ─────────────────────────────────────────────────────────
create or replace function public.mindash_set_user_status(p_user uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.mindash_is_admin() then return jsonb_build_object('ok',false,'reason','not_admin'); end if;
  if p_status not in ('pending','approved','rejected') then
    return jsonb_build_object('ok',false,'reason','bad_status'); end if;
  if exists (select 1 from mindash_admins where user_id = p_user) and p_status <> 'approved' then
    return jsonb_build_object('ok',false,'reason','cannot_block_admin'); end if;
  update profiles set
    mindash_member = true,
    status      = p_status,
    approved_at = case when p_status = 'approved' then now() else null end,
    approved_by = case when p_status = 'approved' then auth.uid() else null end
  where id = p_user;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mindash_set_admin(p_user uuid, p_grant boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.mindash_is_admin() then return jsonb_build_object('ok',false,'reason','not_admin'); end if;
  if p_grant then
    insert into mindash_admins (user_id, granted_by) values (p_user, auth.uid())
      on conflict (user_id) do nothing;
    update profiles set mindash_member = true, status = 'approved',
      approved_at = coalesce(approved_at, now()),
      approved_by = coalesce(approved_by, auth.uid())
    where id = p_user;                        -- 관리자 지정 = 멤버 + 자동 승인
  else
    if (select count(*) from mindash_admins) <= 1 then
      return jsonb_build_object('ok',false,'reason','last_admin'); end if;
    delete from mindash_admins where user_id = p_user;
  end if;
  return jsonb_build_object('ok', true);
end $$;

commit;

-- 검증(별도 실행):
--   select mindash_member, status, count(*) from public.profiles group by 1,2 order by 1,2;
--   select count(*) from public.profiles where not mindash_member and status <> 'pending';  -- 0
--   select tgname from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal; -- 두 트리거 다 존재
