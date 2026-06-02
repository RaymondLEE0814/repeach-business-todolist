-- ============================================================
-- Mindash — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 [Run] 하세요.
-- (인증/auth.users 는 Supabase Auth가 자동 관리하므로 별도 생성 불필요)
-- ============================================================

-- 1) 베타 신청 테이블 (랜딩페이지 폼)
create table if not exists public.beta_signups (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  name            text,
  user_type       text not null,         -- 개인 / 프리랜서 / 소규모 팀 / 소규모 기업
  current_tool    text not null,         -- 현재 사용하는 도구
  pain_point      text not null,         -- 가장 불편한 점
  interested_plan text,                  -- 관심 요금제 (선택)
  created_at      timestamptz default now()
);

create index if not exists beta_signups_created_idx on public.beta_signups (created_at desc);

-- RLS: 익명 사용자는 "신청(INSERT)"만 가능, 조회/수정은 불가 (운영자는 service_role로 조회)
alter table public.beta_signups enable row level security;

drop policy if exists "anon can insert beta" on public.beta_signups;
create policy "anon can insert beta"
  on public.beta_signups
  for insert
  to anon, authenticated
  with check (true);

-- ============================================================
-- 2) (향후 워크스페이스용) 프로필 테이블 — auth.users 와 1:1
--    회원가입 시 트리거로 자동 생성
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- 신규 가입 시 프로필 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
