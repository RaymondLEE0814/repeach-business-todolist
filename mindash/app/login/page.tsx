import Link from 'next/link';
import LoginForm from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const redirectTo = sp.redirect || '/dashboard';

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="brand">
          <span className="brand-dot">M</span>
          Mindash
        </Link>
        <h1>다시 오신 걸 환영해요</h1>
        <p className="sub">로그인하고 워크스페이스로 이동하세요.</p>

        {sp.error === 'confirm' && (
          <div className="form-msg error">
            이메일 확인에 실패했거나 링크가 만료되었습니다. 다시 시도해 주세요.
          </div>
        )}

        <LoginForm redirectTo={redirectTo} />

        <p className="auth-foot">
          아직 계정이 없으신가요? <Link href="/signup">회원가입</Link>
        </p>
        <p className="auth-back">
          <Link href="/" className="link-cta">
            ← 랜딩페이지로
          </Link>
        </p>
      </div>
    </div>
  );
}
