-- ============================================================
-- Mindash 프리투페이드 · Phase 2: 플랜 모델 + 개인 쿼터
-- 설계: Fable 5 / 구현: Opus 4.8 · ref xdxqmoeggvnlvjgxttdf
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 [Run] (멱등·트랜잭션)
--
-- 한도(무료): 개인 프로젝트 3개 · 개인 할일 300개 · 프로젝트당 1000개(하드캡, 남용방지)
-- 강제 지점: BEFORE INSERT 트리거(클라이언트/챗봇/향후 어떤 경로든 단일 지점 차단).
-- 원칙: 초과해도 조회/수정/완료/삭제는 허용, 신규 INSERT만 차단(데이터 잠김 없음).
-- 숫자는 lib/plan.ts FREE_LIMITS와 동기화(변경 시 양쪽 함께).
-- ============================================================

begin;

-- 1) 플랜 컬럼
alter table public.profiles add column if not exists plan text not null default 'free'
  check (plan in ('free','pro'));
alter table public.teams add column if not exists plan text not null default 'free'
  check (plan in ('free','starter'));

-- 2) 개인 플랜 판정(관리자는 항상 pro 취급 → 운영 계정 무제한)
create or replace function public.mindash_user_plan(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from mindash_admins where user_id = p_user) then 'pro'
    else coalesce((select plan from profiles where id = p_user), 'free')
  end;
$$;

-- 3) 개인 프로젝트 한도 트리거 (개인 프로젝트 = team_id is null)
create or replace function public.mindash_check_project_quota()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.team_id is null
     and public.mindash_user_plan(new.owner_id) = 'free'
     and (select count(*) from projects where owner_id = new.owner_id and team_id is null) >= 3 then
    raise exception 'MINDASH_QUOTA:personal_projects';
  end if;
  return new;
end $$;
drop trigger if exists mindash_project_quota on public.projects;
create trigger mindash_project_quota before insert on public.projects
  for each row execute function public.mindash_check_project_quota();

-- 4) 할일 한도 트리거 (프로젝트당 하드캡 + 개인 300; 팀 분기는 Phase 3에서 이 함수에 추가)
create or replace function public.mindash_check_todo_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_team uuid;
begin
  select owner_id, team_id into v_owner, v_team from projects where id = new.project_id;
  -- 프로젝트당 하드캡(플랜 무관, 자원 남용 방지)
  if (select count(*) from todos where project_id = new.project_id) >= 1000 then
    raise exception 'MINDASH_QUOTA:project_todos_hard';
  end if;
  -- 개인 프로젝트: 소유자가 free면 개인 프로젝트 전체 합산 300개
  if v_team is null
     and public.mindash_user_plan(v_owner) = 'free'
     and (select count(*) from todos t join projects p on p.id = t.project_id
          where p.owner_id = v_owner and p.team_id is null) >= 300 then
    raise exception 'MINDASH_QUOTA:personal_todos';
  end if;
  return new;
end $$;
drop trigger if exists mindash_todo_quota on public.todos;
create trigger mindash_todo_quota before insert on public.todos
  for each row execute function public.mindash_check_todo_quota();

-- 5) 관리자용 개인 플랜 변경 RPC (입금 확인 후 수동 전환 = MVP 업그레이드 경로)
create or replace function public.mindash_set_user_plan(p_user uuid, p_plan text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.mindash_is_admin() then return jsonb_build_object('ok',false,'reason','not_admin'); end if;
  if p_plan not in ('free','pro') then return jsonb_build_object('ok',false,'reason','bad_plan'); end if;
  update profiles set plan = p_plan where id = p_user;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.mindash_user_plan(uuid), public.mindash_set_user_plan(uuid, text) from public;
grant execute on function public.mindash_user_plan(uuid), public.mindash_set_user_plan(uuid, text) to authenticated;

commit;

-- ── 검증 (별도 실행) ──────────────────────────────────────
--   -- free 계정으로 4번째 개인 프로젝트 insert → 'MINDASH_QUOTA:personal_projects' 예외
--   -- 기존 3개 프로젝트의 조회/수정/삭제는 정상이어야 함(트리거는 INSERT 전용)
--   select id, plan from public.profiles where id = auth.uid();
--   -- 관리자로 pro 전환: select public.mindash_set_user_plan('<uuid>','pro');

-- ── 롤백 ──────────────────────────────────────────────────
--   drop trigger if exists mindash_project_quota on public.projects;
--   drop trigger if exists mindash_todo_quota on public.todos;
--   drop function if exists public.mindash_check_project_quota, public.mindash_check_todo_quota,
--     public.mindash_user_plan(uuid), public.mindash_set_user_plan(uuid,text);
--   (plan 컬럼은 남겨도 무해)
