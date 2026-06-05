import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions/auth';
import DashboardShell from './DashboardShell';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 미들웨어가 1차 보호하지만, 서버 컴포넌트에서도 방어적으로 재확인
  if (!user) {
    redirect('/login');
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('id,name')
    .order('created_at');

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    '사용자';

  return (
    <>
      <nav className="nav dash-nav">
        <div className="container nav-inner">
          <Link href="/" className="brand">
            <span className="brand-dot">M</span>
            Mindash
          </Link>
          <div className="nav-actions">
            <span className="caption" style={{ marginRight: 6 }}>
              {user.email}
            </span>
            <form action={signOut}>
              <button className="btn btn-light btn-sm" type="submit">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="dash-main">
        <h1 className="dash-hello">안녕하세요, {displayName}님 👋</h1>
        <p className="body-lg" style={{ marginTop: 10 }}>
          내 업무 공간입니다. 프로젝트를 전환하며 할 일을 확인하고 체크하세요.
        </p>

        <div style={{ marginTop: 28 }}>
          <DashboardShell initialProjects={projects ?? []} userId={user.id} />
        </div>
      </main>
    </>
  );
}
