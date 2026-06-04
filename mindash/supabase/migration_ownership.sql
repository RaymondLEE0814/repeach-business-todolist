-- ============================================================
-- Mindash — 개인별 워크스페이스 (소유자 + RLS)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 [Run] 하세요.
--
-- 효과: 로그인한 사용자는 "자기 소유 프로젝트"만 보고/수정합니다.
--       기존 4개 프로젝트는 레이몬드(sometimes0814@gmail.com) 소유로 지정.
--       새 계정은 빈 워크스페이스에서 시작 → Mindash에서 직접 생성.
--
-- ⚠️ 주의: 이 SQL 이후로는 로그인 없이(anon) 접근하던 기존 Vite 할 일 앱과
--          anon 키 시드 스크립트는 더 이상 이 테이블을 읽/쓰지 못합니다.
-- ============================================================

-- 1) projects 에 소유자 컬럼 추가
alter table public.projects
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- 2) 기존 소유자 없는 프로젝트 → 레이몬드 계정으로 backfill
update public.projects
set owner_id = (select id from auth.users where email = 'sometimes0814@gmail.com')
where owner_id is null;

create index if not exists projects_owner_idx on public.projects (owner_id);

-- 3) 기존 "누구나 허용" 정책 제거
drop policy if exists "public all - projects"   on public.projects;
drop policy if exists "public all - categories" on public.categories;
drop policy if exists "public all - todos"      on public.todos;

-- RLS 활성화(이미 켜져 있어도 안전)
alter table public.projects   enable row level security;
alter table public.categories enable row level security;
alter table public.todos      enable row level security;

-- 4) projects: 본인 소유만
drop policy if exists "own projects - select" on public.projects;
drop policy if exists "own projects - insert" on public.projects;
drop policy if exists "own projects - update" on public.projects;
drop policy if exists "own projects - delete" on public.projects;

create policy "own projects - select" on public.projects
  for select to authenticated using (owner_id = auth.uid());
create policy "own projects - insert" on public.projects
  for insert to authenticated with check (owner_id = auth.uid());
create policy "own projects - update" on public.projects
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own projects - delete" on public.projects
  for delete to authenticated using (owner_id = auth.uid());

-- 5) categories: 부모 프로젝트가 본인 소유일 때만
drop policy if exists "own categories - all" on public.categories;
create policy "own categories - all" on public.categories
  for all to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = categories.project_id and p.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = categories.project_id and p.owner_id = auth.uid()
  ));

-- 6) todos: 부모 프로젝트가 본인 소유일 때만
drop policy if exists "own todos - all" on public.todos;
create policy "own todos - all" on public.todos
  for all to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = todos.project_id and p.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = todos.project_id and p.owner_id = auth.uid()
  ));
