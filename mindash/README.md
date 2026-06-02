# Mindash — 랜딩페이지 + 로그인 (워크스페이스 베이스)

마인드맵으로 계획하고, 일정표로 바로 실행하는 **개인·작은 팀용 프로젝트 일정관리** 서비스의
랜딩페이지입니다. [`doc_business/landing_page_prd/landing_page_prd.md`](../doc_business/landing_page_prd/landing_page_prd.md)
PRD와 [`.agents/skills/design.md`](../.agents/skills/design.md)(Family 디자인 시스템)을 기반으로 만들었습니다.

향후 개인/기업이 함께 쓰는 **워크스페이스**로 확장하기 위해, 처음부터 로그인과 Supabase 인증을 붙였습니다.

## 스택
- **Next.js (App Router) + React 19** — 서버 컴포넌트, 서버 액션
- **Supabase** — 인증(이메일+비밀번호) + DB (베타 신청 저장)
- **@supabase/ssr** — 쿠키 기반 세션, `proxy.ts`(구 middleware)로 세션 갱신·라우트 보호
- 디자인: Family 시스템(크림 캔버스 `#fbfaf9`, Inter + Fraunces, 알약 버튼, 인셋 보더 카드) — `app/globals.css`

## 페이지 구성
| 경로 | 설명 |
|---|---|
| `/` | 랜딩페이지 (히어로 → 문제 → 사용 흐름 → 기능 → 사용 사례 → 요금제 → 비교 → 베타 신청) |
| `/signup` | 회원가입 (이메일+비밀번호) |
| `/login` | 로그인 |
| `/dashboard` | 로그인 후 진입하는 보호 라우트 — **향후 워크스페이스** 자리 |
| `/auth/confirm` | 이메일 확인 링크 처리 |

## 로컬 실행
```bash
cd mindash
npm install
# .env.local 확인 (이미 기존 Supabase 프로젝트로 채워져 있음)
npm run dev      # http://localhost:3000
```

## ⚠️ 최초 1회: Supabase 테이블 생성 (필수)
베타 신청 폼과 프로필 자동 생성이 동작하려면 DB 테이블이 있어야 합니다.
publishable 키로는 테이블을 만들 수 없으므로, **Supabase 대시보드 > SQL Editor** 에
[`supabase/schema.sql`](supabase/schema.sql) 전체를 붙여넣고 **Run** 하세요.

생성되는 것:
- `beta_signups` — 랜딩 폼 신청 저장 (익명 INSERT 허용 / 조회는 운영자만)
- `profiles` — 가입자 프로필(auth.users와 1:1) + 신규 가입 시 자동 생성 트리거

> 로그인/회원가입 자체는 Supabase Auth가 `auth.users`를 자동 관리하므로 SQL 없이도 동작합니다.
> SQL을 실행해야 **베타 폼 저장**과 **프로필 트리거**가 켜집니다.

### Supabase Auth 설정 팁
- **이메일 확인 사용 시**: Authentication > URL Configuration 의 Redirect URLs 에
  `http://localhost:3000/auth/confirm` (그리고 배포 도메인)을 추가하세요.
- 빠른 테스트를 원하면 Authentication > Providers > Email 에서 "Confirm email"을 잠시 꺼도 됩니다.

## 환경변수 (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # 배포 시 실제 도메인
```

## 배포 (Vercel)
1. Vercel에서 이 폴더(`mindash`)를 루트로 새 프로젝트 생성 (Root Directory = `mindash`)
2. 위 환경변수 등록 (`NEXT_PUBLIC_SITE_URL` 은 배포 도메인으로)
3. 배포 후 Supabase Redirect URLs 에 배포 도메인 `/auth/confirm` 추가

## 다음 단계 (워크스페이스)
`/dashboard` 를 시작점으로, 마인드맵 편집 → 노드를 할 일/마감/담당자로 변환 →
오늘·이번 주 일정표 실행, 팀 초대/공유 순으로 확장합니다.
