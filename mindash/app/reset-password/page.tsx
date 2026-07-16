import Link from 'next/link';
import ResetPasswordForm from './ResetPasswordForm';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash } = await searchParams;

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="brand" style={{ justifyContent: 'center' }}>
          <span className="brand-dot">M</span>
          Mindash
        </Link>

        {!token_hash ? (
          <>
            <h1>링크가 올바르지 않아요</h1>
            <p className="sub">주소가 잘리지 않았는지 확인하고, 관리자에게 새 링크를 요청해 주세요.</p>
          </>
        ) : (
          <>
            <h1>새 비밀번호 설정</h1>
            <p className="sub">관리자가 보낸 재설정 링크예요. 새 비밀번호를 입력하면 바로 이 비밀번호로 로그인돼요.</p>
            <ResetPasswordForm tokenHash={token_hash} />
          </>
        )}

        <p className="auth-back">
          <Link href="/login" className="link-cta">
            ← 로그인으로
          </Link>
        </p>
      </div>
    </div>
  );
}
