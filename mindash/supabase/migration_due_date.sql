-- ============================================================
-- Mindash — 오늘/이번 주 실행 화면용: todos 계획일(due_date)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 [Run] 하세요.
-- (ref: xdxqmoeggvnlvjgxttdf)
-- ============================================================

alter table public.todos
  add column if not exists due_date date;

create index if not exists todos_due_idx on public.todos (due_date);
