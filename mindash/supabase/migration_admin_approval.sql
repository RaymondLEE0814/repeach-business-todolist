-- ============================================================
-- Mindash 관리자 승인제 + 관리자 페이지 — 전체 DB 마이그레이션 (한 번만 실행)
-- 설계: Fable / 구현: Opus 4.8 · 시드 관리자: dobestray@naver.com
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 [Run] (ref xdxqmoeggvnlvjgxttdf)
--
-- 핵심:
--  - 관리자 = 별도 mindash_admins 테이블 + mindash_is_admin() DEFINER 헬퍼(team 패턴 동형).
--  - 승인 = profiles.status(pending/approved/rejected). default 'approved'로 추가 → backfill
--           → default 'pending'으로 변경(기존 사용자 전원 자동 승인, 잠김 방지의 핵심).
--  - 게이트 3중: 미들웨어/레이아웃(앱) + RLS(can_access/manage_project에 is_approved 주입) + RPC.
--  - 공유 DB(lev_* 공존)라 신규 객체는 전부 mindash_ 접두사.
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- 1) 관리자 테이블 + 헬퍼 + 시드
-- ─────────────────────────────────────────────────────────
create table if not exists public.mindash_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  note       text,
  created_at timestamptz default now()
);
alter table public.mindash_admins enable row level security;

-- SECURITY DEFINER → RLS 우회 판정(재귀 원천 차단)
create or replace function public.mindash_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from mindash_admins where user_id = auth.uid());
$$;

-- select만: 본인이 관리자인지 셀프 조회 + 관리자는 목록 조회. INSERT/UPDATE/DELETE 정책 없음 → RPC로만 변경.
drop policy if exists "mindash_admins - select" on public.mindash_admins;
create policy "mindash_admins - select" on public.mindash_admins for select to authenticated
  using (user_id = auth.uid() or public.mindash_is_admin());

-- 시드 관리자 (auth.users에서 email로 id 조회)
insert into public.mindash_admins (user_id, note)
select id, 'seed admin' from auth.users
where lower(email) = 'dobestray@naver.com'
on conflict (user_id) do nothing;

-- ─────────────────────────────────────────────────────────
-- 2) 승인 상태 컬럼 (default 트릭으로 기존 사용자 자동 승인)
-- ─────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists status      text not null default 'approved'
    check (status in ('pending','approved','rejected')),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id);

-- backfill 완료 후 신규 가입 기본값을 pending으로
alter table public.profiles alter column status set default 'pending';
update public.profiles set approved_at = now() where status = 'approved' and approved_at is null;

-- 신규 가입 트리거: 명시적으로 pending
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, status)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'pending')
  on conflict (id) do nothing;
  return new;
end $$;

-- 승인 판정 헬퍼(관리자는 항상 승인 취급)
create or replace function public.mindash_is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved')
      or exists (select 1 from mindash_admins where user_id = auth.uid());
$$;

revoke all on function public.mindash_is_admin(), public.mindash_is_approved() from public;
grant execute on function public.mindash_is_admin(), public.mindash_is_approved() to authenticated;

-- ─────────────────────────────────────────────────────────
-- 3) profiles RLS: 관리자 전체 read + 자기승인 봉쇄(컬럼 grant)
-- ─────────────────────────────────────────────────────────
drop policy if exists "mindash admin read all profiles" on public.profiles;
create policy "mindash admin read all profiles" on public.profiles for select to authenticated
  using (public.mindash_is_admin());

-- 본인 update를 full_name으로만 제한 → status/approved_* 는 DEFINER RPC로만 변경 가능
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────
-- 4) 상태/관리자 변경 RPC (첫 줄 권한 게이트 + 감사컬럼 + 보호 로직)
-- ─────────────────────────────────────────────────────────
create or replace function public.mindash_set_user_status(p_user uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.mindash_is_admin() then return jsonb_build_object('ok',false,'reason','not_admin'); end if;
  if p_status not in ('pending','approved','rejected') then
    return jsonb_build_object('ok',false,'reason','bad_status'); end if;
  -- 관리자 계정은 거절/승인취소 불가
  if exists (select 1 from mindash_admins where user_id = p_user) and p_status <> 'approved' then
    return jsonb_build_object('ok',false,'reason','cannot_block_admin'); end if;
  update profiles set
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
    update profiles set status = 'approved',
      approved_at = coalesce(approved_at, now()),
      approved_by = coalesce(approved_by, auth.uid())
    where id = p_user;                        -- 관리자 지정 = 자동 승인
  else
    if (select count(*) from mindash_admins) <= 1 then
      return jsonb_build_object('ok',false,'reason','last_admin'); end if;  -- 마지막 관리자 보호
    delete from mindash_admins where user_id = p_user;
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.mindash_set_user_status(uuid, text), public.mindash_set_admin(uuid, boolean) from public;
grant execute on function public.mindash_set_user_status(uuid, text), public.mindash_set_admin(uuid, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────
-- 5) RLS 최종선: 데이터 접근 헬퍼에 승인 조건 주입
--    (기존 정책 문장은 그대로 — 헬퍼만 교체하면 전 테이블에 게이트 적용)
-- ─────────────────────────────────────────────────────────
create or replace function public.can_access_project(p_project text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.mindash_is_approved() and exists (
    select 1 from projects p
    where p.id = p_project
      and ( p.owner_id = auth.uid()
            or (p.team_id is not null and exists (
                  select 1 from team_members m where m.team_id = p.team_id and m.user_id = auth.uid())))
  );
$$;

create or replace function public.can_manage_project(p_project text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.mindash_is_approved() and exists (
    select 1 from projects p
    where p.id = p_project
      and ( p.owner_id = auth.uid()
            or (p.team_id is not null and exists (
                  select 1 from team_members m
                  where m.team_id = p.team_id and m.user_id = auth.uid() and m.role in ('leader','admin'))))
  );
$$;

-- ─────────────────────────────────────────────────────────
-- 6) 팀 RPC 게이트: 미승인자는 팀 생성/초대수락 불가
-- ─────────────────────────────────────────────────────────
create or replace function public.create_team(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.mindash_is_approved() then raise exception 'not approved'; end if;
  insert into teams (name, owner_id) values (trim(p_name), auth.uid()) returning id into v_team;
  insert into team_members (team_id, user_id, role) values (v_team, auth.uid(), 'leader');
  return v_team;
end $$;

create or replace function public.accept_team_invite(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.mindash_is_approved() then return jsonb_build_object('ok', false, 'reason', 'not_approved'); end if;
  select * into v from team_invites where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v.status <> 'pending' then return jsonb_build_object('ok', false, 'reason', v.status); end if;
  if v.expires_at < now() then
    update team_invites set status = 'expired' where id = v.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if lower(v.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    return jsonb_build_object('ok', false, 'reason', 'email_mismatch', 'email', v.email);
  end if;
  insert into team_members (team_id, user_id, role) values (v.team_id, auth.uid(), v.role)
    on conflict (team_id, user_id) do nothing;
  update team_invites set status = 'accepted', accepted_by = auth.uid() where id = v.id;
  return jsonb_build_object('ok', true, 'team_id', v.team_id);
end $$;

-- 확인용: 무충돌 점검 → select proname from pg_proc where proname like 'mindash_%';
