import type { Metadata } from 'next';
import Nav from '@/app/components/Nav';
import Footer from '@/app/components/Footer';

export const metadata: Metadata = {
  title: '요금제 | Mindash',
  description:
    '개인 월 3,900원부터, 팀은 인당 과금 없는 고정 요금. Mindash 베타 예상 요금제를 확인하세요.',
};

const PLANS = [
  { name: 'Free', price: '0', target: '체험 / 개인 시작', value: '개인 프로젝트 3개 · 할 일 300개', featured: false },
  { name: 'Personal Pro', price: '3,900', target: '개인', value: '무제한 프로젝트와 할 일', featured: true },
  { name: 'Freelancer', price: '7,900', target: '1인 사업자', value: '고객별 프로젝트와 외부 공유', featured: false },
  { name: 'Team Starter', price: '19,000', target: '2~6명 팀', value: '팀원 최대 6명, 담당자·팀 진행현황', featured: false },
];

export default function PricingPage() {
  return (
    <>
      <Nav />

      <section className="section" id="pricing">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">베타 예상 요금제</span>
            <h1 className="heading-lg">작은 팀도 부담 없는 가격</h1>
            <p>인당 과금 대신 합리적인 고정 요금으로 시작하세요.</p>
          </div>

          <div className="pricing">
            {PLANS.map((p) => (
              <div className={`plan${p.featured ? ' featured' : ''}`} key={p.name}>
                {p.featured && <span className="featured-flag">가장 인기</span>}
                <span className="plan-name">{p.name}</span>
                <span className="plan-target">{p.target}</span>
                <div className="plan-price">
                  {p.price === '0' ? (
                    '무료'
                  ) : (
                    <>
                      {p.price}
                      <small>원 / 월</small>
                    </>
                  )}
                </div>
                <p className="plan-value">{p.value}</p>
                <a href="/#beta" className={`btn ${p.featured ? 'btn-dark' : 'btn-light'} btn-block btn-sm`}>
                  이 가격으로 신청
                </a>
              </div>
            ))}
          </div>

          <p className="price-note">
            표시된 금액은 확정 결제가 아니라 베타 예상 요금제입니다. 출시 시 다시 안내드립니다.
          </p>

          <div className="pricing-cta">
            <a href="/#beta" className="btn btn-dark">
              이 가격으로 베타 신청하기
            </a>
            <a href="/#beta" className="btn btn-light">
              팀 요금제 알림 받기
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
