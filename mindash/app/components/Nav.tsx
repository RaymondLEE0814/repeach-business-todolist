import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand">
          <span className="brand-dot">M</span>
          Mindash
        </Link>
        <div className="nav-links">
          <a href="/#problem">문제</a>
          <a href="/#flow">사용 흐름</a>
          <a href="/#features">기능</a>
          <Link href="/pricing">요금제</Link>
        </div>
        <div className="nav-actions">
          <Link href="/login" className="btn btn-light btn-sm">
            로그인
          </Link>
          <a href="/#beta" className="btn btn-dark btn-sm">
            무료 베타 신청
          </a>
        </div>
      </div>
    </nav>
  );
}
