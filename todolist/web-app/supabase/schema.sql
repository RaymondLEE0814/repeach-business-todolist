-- ============================================================
-- 비즈니스 To-Do 관리 앱 - Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 그대로 붙여넣고 [Run] 하세요.
-- ============================================================

-- 1) 프로젝트 테이블
create table if not exists public.projects (
  id        text primary key,
  name      text not null,
  created_at timestamptz default now()
);

-- 2) 카테고리 테이블 (프로젝트별)
--    id는 프로젝트 안에서만 고유하면 되므로 (project_id, id) 복합 기본키 사용
create table if not exists public.categories (
  project_id text not null,
  id         text not null,
  name       text not null,
  position   int  default 0,
  primary key (project_id, id)
);

-- 3) 할 일 테이블
create table if not exists public.todos (
  project_id  text not null,
  id          text not null,
  category_id text,
  title       text default '',
  completed   boolean default false,
  notes       text default '',
  assignee    text default '',
  progress    text default '0',
  link        text default '',
  position    int default 0,
  primary key (project_id, id)
);

-- 기존에 todos 테이블을 이미 만든 경우, link 컬럼만 추가 (벤치마킹/참고자료 URL용)
alter table public.todos add column if not exists link text default '';

create index if not exists todos_project_idx on public.todos (project_id);
create index if not exists categories_project_idx on public.categories (project_id);

-- ============================================================
-- RLS (행 수준 보안)
-- 지금은 로그인 없이 누구나 읽고/쓰게 허용합니다 (MVP).
-- ⚠️ 주의: 앱 링크와 anon 키를 아는 사람은 누구나 수정할 수 있습니다.
--    외부에 널리 공유하기 전에 로그인(Supabase Auth)을 붙이는 것을 권장합니다.
-- ============================================================
alter table public.projects   enable row level security;
alter table public.categories enable row level security;
alter table public.todos      enable row level security;

drop policy if exists "public all - projects"   on public.projects;
drop policy if exists "public all - categories" on public.categories;
drop policy if exists "public all - todos"       on public.todos;

create policy "public all - projects"   on public.projects   for all using (true) with check (true);
create policy "public all - categories" on public.categories for all using (true) with check (true);
create policy "public all - todos"       on public.todos       for all using (true) with check (true);
