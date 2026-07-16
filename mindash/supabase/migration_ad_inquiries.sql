-- ============================================================
-- Mindash 광고·제휴 문의 테이블 (한 번만 실행)
-- 설계: Fable / 구현: Opus 4.8
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 [Run]
--
-- beta_signups 패턴과 동일: anon insert만 허용(조회는 service_role/대시보드).
-- email에 unique를 걸지 않음 → 같은 회사의 재문의 허용.
-- ============================================================

create table if not exists public.ad_inquiries (
  id            uuid primary key default gen_random_uuid(),
  company       text not null,
  contact_name  text,
  email         text not null,
  phone         text,
  ad_type       text,
  budget        text,
  message       text not null,
  created_at    timestamptz default now()
);

create index if not exists ad_inquiries_created_idx on public.ad_inquiries (created_at desc);

alter table public.ad_inquiries enable row level security;

drop policy if exists "anon can insert ad inquiry" on public.ad_inquiries;
create policy "anon can insert ad inquiry"
  on public.ad_inquiries for insert
  to anon, authenticated
  with check (true);

-- 문의 조회(관리자): SQL Editor에서
--   select created_at, company, contact_name, email, phone, ad_type, budget, message
--   from public.ad_inquiries order by created_at desc;
