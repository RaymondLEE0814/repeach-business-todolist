import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type Row = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  assigned_total: number;
  assigned_done: number;
  done_7d: number;
  last_completed_at: string | null;
};

const fmt = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default async function TeamProgressPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: team } = await supabase.from('teams').select('name').eq('id', teamId).maybeSingle();
  if (!team) redirect('/dashboard');

  const { data } = await supabase.rpc('team_progress', { p_team: teamId });
  const rows = (data as Row[]) ?? [];

  return (
    <>
      <nav className="nav dash-nav">
        <div className="container nav-inner">
          <Link href="/dashboard" className="brand">
            <span className="brand-dot">M</span>
            Mindash
          </Link>
          <Link href="/dashboard" className="btn btn-light btn-sm">
            ← 대시보드
          </Link>
        </div>
      </nav>

      <main className="dash-main">
        <h1 className="dash-hello">📊 {team.name} 진행상황</h1>
        <p className="body-lg" style={{ marginTop: 10 }}>
          팀원별 담당 완료율과 최근 활동입니다.
        </p>

        {rows.length === 0 ? (
          <div className="dash-card" style={{ marginTop: 24 }}>
            <p className="muted">표시할 데이터가 없거나, 이 화면을 볼 권한이 없습니다. (팀장/관리자만 조회 가능)</p>
          </div>
        ) : (
          <div className="grid-2" style={{ marginTop: 24 }}>
            {rows.map((r) => {
              const pct = r.assigned_total > 0 ? Math.round((r.assigned_done / r.assigned_total) * 100) : 0;
              return (
                <div className="card" key={r.user_id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <span className="tm-avatar">{(r.full_name || r.email || '?').slice(0, 1).toUpperCase()}</span>
                    <div>
                      <div className="heading-sm">{r.full_name || r.email?.split('@')[0] || '사용자'}</div>
                      <div className="caption">{r.email}</div>
                    </div>
                  </div>
                  <div className="ws-progress" style={{ marginBottom: 12 }}>
                    <div className="ws-progress-head">
                      <span className="ws-label">담당 완료</span>
                      <span className="ws-pct">
                        {r.assigned_done}/{r.assigned_total} · {pct}%
                      </span>
                    </div>
                    <div className="ws-bar">
                      <div className="ws-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="caption">최근 7일 완료 <b style={{ color: 'var(--color-meadow-green)' }}>{r.done_7d}</b></span>
                    <span className="caption">마지막 활동 {fmt(r.last_completed_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
