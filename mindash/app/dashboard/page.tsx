import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions/auth';
import DashboardShell from './DashboardShell';
import ChatWidget from './ChatWidget';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 미들웨어가 1차 보호하지만, 서버 컴포넌트에서도 방어적으로 재확인
  if (!user) {
    redirect('/login');
  }

  const [{ data: projects }, { data: teams }, { data: memberships }, { data: myInvites }, { data: adm }] =
    await Promise.all([
      supabase.from('projects').select('id,name,team_id').order('created_at'),
      supabase.from('teams').select('id,name').order('created_at'),
      supabase.from('team_members').select('team_id,role').eq('user_id', user.id),
      supabase.from('team_invites').select('token').eq('status', 'pending').eq('email', (user.email ?? '').toLowerCase()),
      supabase.from('mindash_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
    ]);
  const isAdmin = !!adm;

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
            {isAdmin && (
              <Link href="/admin" className="btn btn-light btn-sm">
                🛡️ 관리자
              </Link>
            )}
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

        {myInvites && myInvites.length > 0 && (
          <div className="invite-banner">
            <span>✉️ 받은 팀 초대가 {myInvites.length}건 있어요.</span>
            <Link href={`/invite/${myInvites[0].token}`} className="btn btn-dark btn-sm">
              확인하기
            </Link>
          </div>
        )}

        <div style={{ marginTop: 28 }}>
          <DashboardShell
            initialProjects={projects ?? []}
            initialTeams={teams ?? []}
            memberships={memberships ?? []}
            userId={user.id}
            userEmail={user.email ?? ''}
          />
        </div>
      </main>

      <ChatWidget />
    </>
  );
}
