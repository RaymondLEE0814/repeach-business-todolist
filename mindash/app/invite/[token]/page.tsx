import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import InviteActions from './InviteActions';

type Preview = {
  ok: boolean;
  reason?: string;
  team_name?: string;
  inviter?: string;
  email?: string;
  status?: string;
  expired?: boolean;
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent('/invite/' + token)}`);

  const { data } = await supabase.rpc('get_invite_preview', { p_token: token });
  const p = data as Preview | null;
  const myEmail = (user.email ?? '').toLowerCase();
  const emailMatch = !!p?.email && p.email.toLowerCase() === myEmail;

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: 'center' }}>
          <span className="brand-dot">M</span>
          Mindash
        </div>

        {!p || !p.ok ? (
          <>
            <h1>초대를 찾을 수 없어요</h1>
            <p className="sub">링크가 올바르지 않거나 이미 만료되었을 수 있어요.</p>
          </>
        ) : p.status !== 'pending' || p.expired ? (
          <>
            <h1>사용할 수 없는 초대예요</h1>
            <p className="sub">{p.expired ? '초대가 만료되었어요.' : '이미 처리된 초대예요.'}</p>
          </>
        ) : (
          <>
            <h1>{p.team_name} 팀 초대</h1>
            <p className="sub">
              {p.inviter ? `${p.inviter}님이 ` : ''}당신을 팀에 초대했어요. 참여하면 팀 프로젝트를 함께 볼 수 있어요.
            </p>
            {!emailMatch && (
              <div className="form-msg error">
                이 초대는 <b>{p.email}</b> 용이에요. 지금 <b>{user.email}</b> 로 로그인되어 있어 수락할 수 없어요. 초대받은
                이메일로 로그인해 주세요.
              </div>
            )}
            <InviteActions token={token} canAccept={emailMatch} />
          </>
        )}

        <p className="auth-back">
          <Link href="/dashboard" className="link-cta">
            ← 대시보드로
          </Link>
        </p>
      </div>
    </div>
  );
}
