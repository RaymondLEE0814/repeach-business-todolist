-- ============================================================
-- Mindash 게임화 v2 — 난이도 + 서브 퀘스트(체크리스트)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 [Run] 하세요.
-- (ref: xdxqmoeggvnlvjgxttdf — 기존 프로젝트가 있는 DB)
-- ============================================================

-- 1) todos 에 난이도 컬럼 추가 (easy/normal/hard/delayed)
alter table public.todos
  add column if not exists difficulty text default 'normal';

-- 2) 서브 퀘스트(체크리스트) 테이블
create table if not exists public.subtasks (
  id          uuid primary key default gen_random_uuid(),
  todo_id     text not null,
  project_id  text not null,            -- 소유권 판정용 (RLS)
  title       text not null,
  done        boolean default false,
  position    int default 0,
  created_at  timestamptz default now()
);

create index if not exists subtasks_todo_idx on public.subtasks (todo_id);
create index if not exists subtasks_project_idx on public.subtasks (project_id);

-- 3) RLS: 부모 프로젝트가 본인 소유일 때만 (owner 격리와 동일 규칙)
alter table public.subtasks enable row level security;

drop policy if exists "own subtasks - all" on public.subtasks;
create policy "own subtasks - all" on public.subtasks
  for all to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = subtasks.project_id and p.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = subtasks.project_id and p.owner_id = auth.uid()
  ));
