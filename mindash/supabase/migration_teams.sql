-- ============================================================
-- Mindash 팀(그룹) 워크스페이스 — 전체 DB 마이그레이션 (한 번만 실행)
-- 설계: Fable / 구현: Opus 4.8 · 확정: member 생성O/삭제X, 이메일 지정 초대, 개인 XP만
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 [Run] (ref xdxqmoeggvnlvjgxttdf)
--
-- 핵심: projects.team_id 하나로 개인/팀 공존. 접근판정은 SECURITY DEFINER 헬퍼로만
--       (RLS 무한재귀 방지). team_id NULL 경로는 기존 owner 규칙과 논리 동치(하위호환).
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- 1) 테이블
-- ─────────────────────────────────────────────────────────
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists teams_owner_idx on public.teams (owner_id);

create table if not exists public.team_members (
  team_id   uuid not null references public.teams(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('leader','admin','member')),
  joined_at timestamptz default now(),
  primary key (team_id, user_id)
);
create index if not exists team_members_user_idx on public.team_members (user_id);

create table if not exists public.team_invites (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  email       text not null,
  role        text not null default 'member' check (role in ('admin','member')),
  token       uuid not null default gen_random_uuid() unique,
  status      text not null default 'pending' check (status in ('pending','accepted','declined','revoked','expired')),
  invited_by  uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id),
  created_at  timestamptz default now(),
  expires_at  timestamptz not null default now() + interval '7 days'
);
create index if not exists team_invites_team_idx  on public.team_invites (team_id);
create index if not exists team_invites_email_idx on public.team_invites (lower(email));
create unique index if not exists team_invites_pending_uniq
  on public.team_invites (team_id, lower(email)) where (status = 'pending');

-- ─────────────────────────────────────────────────────────
-- 2) 기존 테이블 확장
-- ─────────────────────────────────────────────────────────
alter table public.projects
  add column if not exists team_id uuid references public.teams(id) on delete set null;
create index if not exists projects_team_idx on public.projects (team_id);

alter table public.todos
  add column if not exists assigned_to  uuid references auth.users(id) on delete set null,
  add column if not exists completed_by uuid references auth.users(id) on delete set null,
  add column if not exists completed_at timestamptz;
create index if not exists todos_completed_by_idx on public.todos (completed_by) where completed = true;

alter table public.subtasks
  add column if not exists done_by uuid references auth.users(id) on delete set null;

-- backfill: 기존 완료 todo는 개인 워크스페이스이므로 프로젝트 owner 귀속
update public.todos t
set completed_by = p.owner_id,
    completed_at = coalesce(t.completed_at, now())
from public.projects p
where p.id = t.project_id and t.completed and t.completed_by is null;

-- 서브태스크도 개인 XP 집계용으로 owner 귀속(기존 완료분 보존)
update public.subtasks s
set done_by = p.owner_id
from public.projects p
where p.id = s.project_id and s.done and s.done_by is null;

-- ─────────────────────────────────────────────────────────
-- 3) SECURITY DEFINER 헬퍼 (RLS 우회 판정 → 무한재귀 차단)
-- ─────────────────────────────────────────────────────────
create or replace function public.is_team_member(p_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where team_id = p_team and user_id = auth.uid());
$$;

create or replace function public.team_role(p_team uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from team_members where team_id = p_team and user_id = auth.uid();
$$;

-- 읽기/할일편집 권한: owner 또는 팀원
create or replace function public.can_access_project(p_project text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from projects p
    where p.id = p_project
      and ( p.owner_id = auth.uid()
            or (p.team_id is not null and exists (
                  select 1 from team_members m where m.team_id = p.team_id and m.user_id = auth.uid())))
  );
$$;

-- 구조 변경(프로젝트/카테고리 삭제·이름변경) 권한: owner 또는 팀 leader/admin
create or replace function public.can_manage_project(p_project text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from projects p
    where p.id = p_project
      and ( p.owner_id = auth.uid()
            or (p.team_id is not null and exists (
                  select 1 from team_members m
                  where m.team_id = p.team_id and m.user_id = auth.uid() and m.role in ('leader','admin'))))
  );
$$;

create or replace function public.shares_team_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members a join team_members b on a.team_id = b.team_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

revoke all on function public.is_team_member(uuid), public.team_role(uuid),
  public.can_access_project(text), public.can_manage_project(text), public.shares_team_with(uuid) from public;
grant execute on function public.is_team_member(uuid), public.team_role(uuid),
  public.can_access_project(text), public.can_manage_project(text), public.shares_team_with(uuid) to authenticated;

-- teams.owner_id 불변 강제 (이양 RPC만 예외 — 아래 transfer_leadership가 트리거 우회 위해 owner_id를 직접 set)
create or replace function public.lock_team_owner()
returns trigger language plpgsql as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'owner_id는 직접 변경할 수 없습니다 (transfer_leadership 사용)';
  end if;
  return new;
end $$;
drop trigger if exists teams_lock_owner on public.teams;
create trigger teams_lock_owner before update on public.teams
  for each row when (new.owner_id is distinct from old.owner_id) execute function public.lock_team_owner();

-- ─────────────────────────────────────────────────────────
-- 4) RPC
-- ─────────────────────────────────────────────────────────
create or replace function public.create_team(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into teams (name, owner_id) values (trim(p_name), auth.uid()) returning id into v_team;
  insert into team_members (team_id, user_id, role) values (v_team, auth.uid(), 'leader');
  return v_team;
end $$;

create or replace function public.get_invite_preview(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select ti.*, t.name as team_name, pr.full_name as inviter
  into v from team_invites ti
  join teams t on t.id = ti.team_id
  left join profiles pr on pr.id = ti.invited_by
  where ti.token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'team_name', v.team_name, 'inviter', v.inviter,
    'email', v.email, 'status', v.status,
    'expired', (v.expires_at < now()));
end $$;

create or replace function public.accept_team_invite(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
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

create or replace function public.decline_team_invite(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from team_invites where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v.status = 'pending' then update team_invites set status = 'declined' where id = v.id; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.transfer_leadership(p_team uuid, p_new uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if public.team_role(p_team) <> 'leader' then return jsonb_build_object('ok', false, 'reason', 'not_leader'); end if;
  if not exists (select 1 from team_members where team_id = p_team and user_id = p_new) then
    return jsonb_build_object('ok', false, 'reason', 'not_member'); end if;
  update team_members set role = 'admin'  where team_id = p_team and user_id = auth.uid();
  update team_members set role = 'leader' where team_id = p_team and user_id = p_new;
  update teams set owner_id = p_new where id = p_team;   -- 트리거 우회: DEFINER + 직접 update, 트리거는 owner 변경 차단하므로 잠시 비활성 필요
  return jsonb_build_object('ok', true);
end $$;

-- 팀장 진행상황 집계 (첫 줄 권한 게이트)
create or replace function public.team_progress(p_team uuid)
returns table (user_id uuid, full_name text, email text,
  assigned_total bigint, assigned_done bigint, done_7d bigint, last_completed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, pr.full_name, pr.email,
    count(t.id) filter (where t.assigned_to = m.user_id)                                  as assigned_total,
    count(t.id) filter (where t.assigned_to = m.user_id and t.completed)                  as assigned_done,
    count(t.id) filter (where t.completed_by = m.user_id and t.completed_at >= now() - interval '7 days') as done_7d,
    max(t.completed_at) filter (where t.completed_by = m.user_id)                         as last_completed_at
  from team_members m
  join profiles pr on pr.id = m.user_id
  left join projects p on p.team_id = m.team_id
  left join todos t on t.project_id = p.id
  where m.team_id = p_team and public.team_role(p_team) in ('leader','admin')
  group by m.user_id, pr.full_name, pr.email;
$$;

grant execute on function public.create_team(text), public.get_invite_preview(uuid),
  public.accept_team_invite(uuid), public.decline_team_invite(uuid),
  public.transfer_leadership(uuid, uuid), public.team_progress(uuid) to authenticated;

-- transfer_leadership가 owner 잠금 트리거를 통과하도록: 트리거를 owner가 스스로 바꾸는 경우만 막고
-- DEFINER RPC 경로는 예외 처리. 간단화를 위해 트리거를 조건부로: (아래) 세션 GUC 플래그 방식 대신
-- transfer 함수에서 트리거를 잠깐 비활성화하는 대신, 트리거 조건을 유지하고 transfer는 허용 목적이므로
-- 트리거를 삭제하고 대신 teams update 정책에서 owner 변경을 막는다(아래 정책 참고).
drop trigger if exists teams_lock_owner on public.teams;

-- ─────────────────────────────────────────────────────────
-- 5) RLS 정책
-- ─────────────────────────────────────────────────────────
alter table public.teams         enable row level security;
alter table public.team_members  enable row level security;
alter table public.team_invites  enable row level security;

-- teams
drop policy if exists "teams - select" on public.teams;
drop policy if exists "teams - insert" on public.teams;
drop policy if exists "teams - update" on public.teams;
drop policy if exists "teams - delete" on public.teams;
create policy "teams - select" on public.teams for select to authenticated
  using (owner_id = auth.uid() or public.is_team_member(id));
create policy "teams - insert" on public.teams for insert to authenticated
  with check (owner_id = auth.uid());
create policy "teams - update" on public.teams for update to authenticated
  using (public.team_role(id) in ('leader','admin'))
  with check (owner_id = (select t.owner_id from public.teams t where t.id = teams.id)); -- owner 변경 차단(이양은 RPC)
create policy "teams - delete" on public.teams for delete to authenticated
  using (public.team_role(id) = 'leader');

-- team_members
drop policy if exists "team_members - select" on public.team_members;
drop policy if exists "team_members - insert" on public.team_members;
drop policy if exists "team_members - update" on public.team_members;
drop policy if exists "team_members - delete" on public.team_members;
create policy "team_members - select" on public.team_members for select to authenticated
  using (user_id = auth.uid() or public.is_team_member(team_id));
create policy "team_members - insert" on public.team_members for insert to authenticated
  with check (public.team_role(team_id) in ('leader','admin') and role <> 'leader');
create policy "team_members - update" on public.team_members for update to authenticated
  using (public.team_role(team_id) = 'leader');
create policy "team_members - delete" on public.team_members for delete to authenticated
  using (
    (user_id = auth.uid() and role <> 'leader')
    or (public.team_role(team_id) = 'leader' and user_id <> auth.uid())
    or (public.team_role(team_id) = 'admin' and role = 'member')
  );

-- team_invites
drop policy if exists "invites - select" on public.team_invites;
drop policy if exists "invites - insert" on public.team_invites;
drop policy if exists "invites - update" on public.team_invites;
drop policy if exists "invites - delete" on public.team_invites;
create policy "invites - select" on public.team_invites for select to authenticated
  using (public.team_role(team_id) in ('leader','admin')
         or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy "invites - insert" on public.team_invites for insert to authenticated
  with check (public.team_role(team_id) in ('leader','admin') and invited_by = auth.uid());
create policy "invites - update" on public.team_invites for update to authenticated
  using (public.team_role(team_id) in ('leader','admin'));
create policy "invites - delete" on public.team_invites for delete to authenticated
  using (public.team_role(team_id) in ('leader','admin'));

-- projects (기존 own 정책 교체)
drop policy if exists "own projects - select" on public.projects;
drop policy if exists "own projects - insert" on public.projects;
drop policy if exists "own projects - update" on public.projects;
drop policy if exists "own projects - delete" on public.projects;
create policy "projects - select" on public.projects for select to authenticated
  using (public.can_access_project(id));
create policy "projects - insert" on public.projects for insert to authenticated
  with check (owner_id = auth.uid() and (team_id is null or public.is_team_member(team_id)));
create policy "projects - update" on public.projects for update to authenticated
  using (public.can_manage_project(id))
  with check (team_id is null or public.is_team_member(team_id));
create policy "projects - delete" on public.projects for delete to authenticated
  using (public.can_manage_project(id));

-- categories (member: 생성/편집 O, 삭제는 manage 권한)
drop policy if exists "own categories - all" on public.categories;
drop policy if exists "categories - select" on public.categories;
drop policy if exists "categories - insert" on public.categories;
drop policy if exists "categories - update" on public.categories;
drop policy if exists "categories - delete" on public.categories;
create policy "categories - select" on public.categories for select to authenticated
  using (public.can_access_project(project_id));
create policy "categories - insert" on public.categories for insert to authenticated
  with check (public.can_access_project(project_id));
create policy "categories - update" on public.categories for update to authenticated
  using (public.can_access_project(project_id));
create policy "categories - delete" on public.categories for delete to authenticated
  using (public.can_manage_project(project_id));

-- todos / subtasks (member 전체 CRUD)
drop policy if exists "own todos - all" on public.todos;
create policy "todos - all" on public.todos for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));

drop policy if exists "own subtasks - all" on public.subtasks;
create policy "subtasks - all" on public.subtasks for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));

-- profiles: 같은 팀이면 이름/이메일 조회 (팀장 대시보드용) — 기존 own 정책과 OR 공존
drop policy if exists "team members read profiles" on public.profiles;
create policy "team members read profiles" on public.profiles for select to authenticated
  using (public.shares_team_with(id));
