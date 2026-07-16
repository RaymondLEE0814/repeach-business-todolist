import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div>
            <div className="brand">
              <span className="brand-dot">M</span>
              Mindash
            </div>
            <p className="caption" style={{ marginTop: 10, maxWidth: 280 }}>
              마인드맵으로 계획하고, 일정표로 바로 실행하는 가벼운 프로젝트 일정관리.
            </p>
          </div>
          <div className="footer-links">
            <a href="/#features">기능</a>
            <Link href="/pricing">요금제</Link>
            <a href="/#beta">베타 신청</a>
            <a href="/#ads">광고 문의</a>
            <Link href="/login">로그인</Link>
            <Link href="/signup">회원가입</Link>
          </div>
        </div>

        <div className="footer-company">
          <p className="footer-company-name">(주)슈퍼런</p>
          <p className="footer-company-lines">
            대표자 이석진 · 사업자등록번호 739-87-03673
            <br />
            주소 서울특별시 마포구 신촌로 114 에프디빌딩 2층 · 대표번호 02-6012-1223
            <br />
            통신판매업신고번호 제2026-대전유성-1027호 · 출판사신고확인번호 제2014-000082호 · 등록번호 제2025-10호
          </p>
        </div>

        <p className="footer-copy">© 2026 Mindash. All rights reserved.</p>
      </div>
    </footer>
  );
}
