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
          {rejected ? '이용이 제한된 계정이에요' : '계정을 준비하고 있어요'}
        </h1>
        <p className="pending-desc">
          {rejected ? (
            <>
              현재 계정({user.email})은 이용이 제한된 상태예요.
              <br />
              문의가 필요하면 관리자에게 연락해 주세요.
            </>
          ) : (
            <>
              계정({user.email})을 준비하고 있어요.
              <br />
              새로고침하면 바로 시작할 수 있어요.
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
