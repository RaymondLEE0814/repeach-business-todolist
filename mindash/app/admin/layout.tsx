import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions/auth';

// 관리자 전용 게이트 (미들웨어 + 여기 + RPC 3중)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: adm } = await supabase
    .from('mindash_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!adm) redirect('/dashboard');

  return (
    <>
      <nav className="nav dash-nav">
        <div className="container nav-inner">
          <Link href="/dashboard" className="brand">
            <span className="brand-dot">M</span>
            Mindash
          </Link>
          <div className="nav-actions">
            <span className="caption" style={{ marginRight: 6 }}>
              🛡️ 관리자 · {user.email}
            </span>
            <Link href="/dashboard" className="btn btn-light btn-sm">
              대시보드
            </Link>
            <form action={signOut}>
              <button className="btn btn-light btn-sm" type="submit">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="dash-main">{children}</main>
    </>
  );
}
