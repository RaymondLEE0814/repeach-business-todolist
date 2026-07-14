import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions/auth';

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 행이 없으면(다른 사이트 전용 계정이 Mindash에 처음 접근) pending 멤버로 편입
  await supabase.rpc('mindash_ensure_member');

  const { data: prof } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .maybeSingle();
  const { data: adm } = await supabase
    .from('mindash_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  // 이미 승인(또는 관리자)이면 대시보드로
  if (adm || (prof && prof.status === 'approved')) redirect('/dashboard');

  const rejected = prof?.status === 'rejected';

  return (
    <main className="pending-wrap">
      <div className="pending-card">
        <div className="pending-illus">{rejected ? '🚫' : '⏳'}</div>
        <h1 className="pending-title">
          {rejected ? '가입이 거절되었습니다' : '관리자 승인 대기 중이에요'}
        </h1>
        <p className="pending-desc">
          {rejected ? (
            <>
              현재 계정({user.email})의 가입이 거절된 상태입니다.
              <br />
              문의가 필요하면 관리자에게 연락해 주세요.
            </>
          ) : (
            <>
              가입해 주셔서 감사합니다! 계정({user.email})은 관리자 승인 후 이용할 수 있어요.
              <br />
              승인이 완료되면 새로고침만으로 바로 시작할 수 있습니다.
            </>
          )}
        </p>
        <form action={signOut}>
          <button className="btn btn-light" type="submit">
            로그아웃
          </button>
        </form>
      </div>
    </main>
  );
}
