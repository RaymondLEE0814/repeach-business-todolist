import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser()는 JWT를 검증하므로 보안 점검에 사용 (getSession() 사용 금지)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isDash = path.startsWith('/dashboard');
  const isAdmin = path.startsWith('/admin');
  const isApi = path.startsWith('/api/');
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = '';
    return NextResponse.redirect(url);
  };

  // 보호 라우트: 로그인 안 한 사용자가 /dashboard·/admin 접근 시 /login으로
  if ((isDash || isAdmin) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', path);
    return NextResponse.redirect(url);
  }

  // 승인/관리자 게이트: DB 단건 조회(경로 한정). 조회 실패(마이그레이션 전 등)는 관대하게 통과.
  if (user && (isDash || isAdmin || isApi)) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .maybeSingle();
    // 앱 스코핑 후: profiles 행 없음 = 비-Mindash 멤버 → 미승인 취급(/pending에서 편입)
    const approved = prof ? prof.status === 'approved' : false;

    if (isAdmin) {
      const { data: adm } = await supabase
        .from('mindash_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!adm) return redirectTo('/dashboard'); // 관리자 아님
      // 관리자는 자동 승인 취급 → 통과
    } else if (!approved) {
      if (isApi) {
        return NextResponse.json(
          { error: '이용이 제한된 계정입니다. 관리자에게 문의해 주세요.' },
          { status: 403 }
        );
      }
      return redirectTo('/pending');
    }
  }

  // 로그인한 사용자가 로그인/회원가입 페이지 접근 시 → 승인 여부에 따라 분기
  if (user && (path === '/login' || path === '/signup')) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .maybeSingle();
    return redirectTo(prof && prof.status !== 'approved' ? '/pending' : '/dashboard');
  }

  // 승인된 사용자가 /pending 접근 시 대시보드로. (행 없음 = 비멤버 → /pending에 머물며 편입)
  if (user && path === '/pending') {
    const { data: prof } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .maybeSingle();
    if (prof && prof.status === 'approved') return redirectTo('/dashboard');
  }

  return supabaseResponse;
}
