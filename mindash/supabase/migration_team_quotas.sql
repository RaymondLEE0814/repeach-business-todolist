-- ============================================================
-- Mindash 프리투페이드 · Phase 3: 팀 쿼터 (인원 + 팀 할일)
-- 설계: Fable 5 / 구현: Opus 4.8 · ref xdxqmoeggvnlvjgxttdf
-- ★ migration_plans.sql(Phase 2) 실행 후에 실행. Supabase SQL Editor, 멱등·트랜잭션.
--
-- 한도(무료 팀): 팀원 3명(팀장 포함) · 팀 할일 300개.  유료(starter): 팀원 6명 · 할일 무제한.
-- ============================================================

begin;

-- 1) 팀 플랜 판정 헬퍼
create or replace function public.mindash_team_plan(p_team uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select plan from teams where id = p_team), 'free');
$$;

-- 2) 팀 인원 한도 — 초대 발급 시점 게이트 (현재 팀원 + pending 초대 합산)
create or replace function public.mindash_check_invite_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit int;
begin
  v_limit := case when public.mindash_team_plan(new.team_id) = 'starter' then 6 else 3 end;
  if (select count(*) from team_members where team_id = new.team_id)
   + (select count(*) from team_invites where team_id = new.team_id and status = 'pending') >= v_limit then
    raise exception 'MINDASH_QUOTA:team_members';
  end if;
  return new;
end $$;
drop trigger if exists mindash_invite_quota on public.team_invites;
create trigger mindash_invite_quota before insert on public.team_invites
  for each row execute function public.mindash_check_invite_quota();

-- 3) 팀 할일 한도 — Phase 2의 mindash_check_todo_quota에 팀 분기 추가(개인 분기 유지)
create or replace function public.mindash_check_todo_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_team uuid;
begin
  select owner_id, team_id into v_owner, v_team from projects where id = new.project_id;
  -- 프로젝트당 하드캡(플랜 무관)
  if (select count(*) from todos where project_id = new.project_id) >= 1000 then
    raise exception 'MINDASH_QUOTA:project_todos_hard';
  end if;
  -- 개인 프로젝트: 소유자 free면 개인 합산 300
  if v_team is null
     and public.mindash_user_plan(v_owner) = 'free'
     and (select count(*) from todos t join projects p on p.id = t.project_id
          where p.owner_id = v_owner and p.team_id is null) >= 300 then
    raise exception 'MINDASH_QUOTA:personal_todos';
  end if;
  -- 팀 프로젝트: 팀이 free면 팀 합산 300
  if v_team is not null
     and public.mindash_team_plan(v_team) = 'free'
     and (select count(*) from todos t join projects p on p.id = t.project_id
          where p.team_id = v_team) >= 300 then
    raise exception 'MINDASH_QUOTA:team_todos';
  end if;
  return new;
end $$;

-- 4) 수락 시점 인원 재검사 (발급~수락 사이 인원 변동 대비) — 기존 본문 유지 + team_full 추가
create or replace function public.accept_team_invite(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v record; v_limit int;
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
  -- 인원 한도 재검사 (이미 팀원이면 통과 — 재수락/중복 방지)
  v_limit := case when public.mindash_team_plan(v.team_id) = 'starter' then 6 else 3 end;
  if not exists (select 1 from team_members where team_id = v.team_id and user_id = auth.uid())
     and (select count(*) from team_members where team_id = v.team_id) >= v_limit then
    return jsonb_build_object('ok', false, 'reason', 'team_full');
  end if;
  insert into team_members (team_id, user_id, role) values (v.team_id, auth.uid(), v.role)
    on conflict (team_id, user_id) do nothing;
  update team_invites set status = 'accepted', accepted_by = auth.uid() where id = v.id;
  return jsonb_build_object('ok', true, 'team_id', v.team_id);
end $$;

-- 5) teams.plan 셀프 변경 방어 (팀 update 정책이 leader/admin에 열려 있으므로 트리거로 봉쇄)
create or replace function public.mindash_lock_team_plan()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.plan is distinct from old.plan and not public.mindash_is_admin() then
    raise exception 'plan은 관리자만 변경할 수 있습니다 (mindash_set_team_plan)';
  end if;
  return new;
end $$;
drop trigger if exists mindash_teams_lock_plan on public.teams;
create trigger mindash_teams_lock_plan before update on public.teams
  for each row when (new.plan is distinct from old.plan) execute function public.mindash_lock_team_plan();

-- 6) 관리자용 팀 플랜 변경 RPC
create or replace function public.mindash_set_team_plan(p_team uuid, p_plan text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.mindash_is_admin() then return jsonb_build_object('ok',false,'reason','not_admin'); end if;
  if p_plan not in ('free','starter') then return jsonb_build_object('ok',false,'reason','bad_plan'); end if;
  update teams set plan = p_plan where id = p_team;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.mindash_team_plan(uuid), public.mindash_set_team_plan(uuid, text) from public;
grant execute on function public.mindash_team_plan(uuid), public.mindash_set_team_plan(uuid, text) to authenticated;

commit;

-- ── 검증 ──────────────────────────────────────────────────
--   -- free 팀에서 팀원 3명일 때 4번째 초대 insert → 'MINDASH_QUOTA:team_members' 예외
--   -- 팀 할일 300 초과 insert → 'MINDASH_QUOTA:team_todos'
--   -- 팀장이 update teams set plan='starter' 직접 시도 → 트리거 차단
--   -- 관리자: select public.mindash_set_team_plan('<team>','starter');

-- ── 롤백 ──────────────────────────────────────────────────
--   drop trigger if exists mindash_invite_quota on public.team_invites;
--   drop trigger if exists mindash_teams_lock_plan on public.teams;
--   drop function if exists public.mindash_check_invite_quota, public.mindash_lock_team_plan,
--     public.mindash_team_plan(uuid), public.mindash_set_team_plan(uuid,text);
--   -- accept_team_invite / mindash_check_todo_quota 는 migration_admin_approval.sql / migration_plans.sql 버전으로 재배포
