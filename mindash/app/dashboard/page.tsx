import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions/auth';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 미들웨어가 1차 보호하지만, 서버 컴포넌트에서도 방어적으로 재확인
  if (!user) {
    redirect('/login');
  }

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
        <h1 className="dash-hello">
          안녕하세요, {displayName}님 👋
        </h1>
        <p className="body-lg" style={{ marginTop: 10 }}>
          로그인에 성공했습니다. 여기가 앞으로 개인과 팀이 함께 쓰는 워크스페이스가 됩니다.
        </p>

        <div className="dash-card">
          <span className="dash-soon">준비 중</span>
          <h2 className="heading">워크스페이스가 곧 열립니다</h2>
          <p className="body" style={{ marginTop: 10, maxWidth: 560 }}>
            마인드맵으로 프로젝트를 설계하고, 노드를 할 일·마감일·담당자로 바꿔
            오늘/이번 주 일정표에서 바로 실행하는 공간입니다. 개인은 물론, 팀과
            기업이 함께 협업할 수 있도록 단계적으로 제공할 예정입니다.
          </p>

          <div className="grid-3" style={{ marginTop: 28 }}>
            <div className="card">
              <span className="card-icon" style={{ background: '#e8f3ff', color: '#0090ff' }}>
                🧠
              </span>
              <h3 className="heading-sm">마인드맵 프로젝트</h3>
              <p>프로젝트 구조를 노드로 설계</p>
            </div>
            <div className="card">
              <span className="card-icon" style={{ background: '#e6f9ee', color: '#00ca48' }}>
                ☀️
              </span>
              <h3 className="heading-sm">오늘 할 일</h3>
              <p>실행할 일만 모아 보기</p>
            </div>
            <div className="card">
              <span className="card-icon" style={{ background: '#f3ecff', color: '#9f4fff' }}>
                👥
              </span>
              <h3 className="heading-sm">팀 협업</h3>
              <p>담당자 지정과 공유</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
