-- 할 일에 링크(URL) 필드 추가 — 벤치마킹/참고자료 프로젝트용
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 [Run] 하세요. (한 번만)
alter table public.todos add column if not exists link text default '';
