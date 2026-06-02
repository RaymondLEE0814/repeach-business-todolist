import Link from 'next/link';
import SignupForm from './SignupForm';

export default function SignupPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="brand">
          <span className="brand-dot">M</span>
          Mindash
        </Link>
        <h1>Mindash 시작하기</h1>
        <p className="sub">계정을 만들고 나만의 워크스페이스를 열어보세요.</p>

        <SignupForm />

        <p className="auth-foot">
          이미 계정이 있으신가요? <Link href="/login">로그인</Link>
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
