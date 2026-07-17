import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/app/components/Nav';
import Footer from '@/app/components/Footer';

export const metadata: Metadata = {
  title: '요금제 | Mindash',
  description:
    '개인은 무료로 시작해 월 3,900원, 팀은 인당 과금 없는 고정 요금. 요금제별 사용 한도와 기능을 확인하세요.',
};

type Plan = {
  group: '개인' | '팀';
  name: string;
  price: string;
  target: string;
  features: string[];
  featured?: boolean;
};

// 실제 강제되는 정책과 일치 (supabase/migration_plans.sql · migration_team_quotas.sql, lib/plan.ts)
const PLANS: Plan[] = [
  {
    group: '개인',
    name: 'Free',
    price: '0',
    target: '혼자 시작하기',
    features: ['개인 프로젝트 3개', '할 일 300개', '마인드맵 · 일정표 뷰', '난이도별 XP · 게임화'],
  },
  {
    group: '개인',
    name: 'Personal Pro',
    price: '3,900',
    target: '개인 · 무제한',
    features: ['개인 프로젝트 무제한', '할 일 무제한', 'Free의 모든 기능'],
    featured: true,
  },
  {
    group: '팀',
    name: 'Team Free',
    price: '0',
    target: '팀 무료로 시작',
    features: ['팀원 3명(팀장 포함)', '팀 할 일 300개', '할 일 담당자 지정', '팀 진행현황 대시보드'],
  },
  {
    group: '팀',
    name: 'Team Starter',
    price: '19,000',
    target: '2~6명 팀',
    features: ['팀원 최대 6명', '팀 할 일 무제한', 'Team Free의 모든 기능'],
  },
];

export default function PricingPage() {
  return (
    <>
      <Nav />

      <section className="section" id="pricing">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">요금제</span>
            <h1 className="heading-lg">무료로 시작하고, 필요할 때 올리세요</h1>
            <p>가입하면 바로 무료로 씁니다. 한도를 넘길 때만 유료로 전환하세요. 인당 과금 없는 고정 요금입니다.</p>
          </div>

          <div className="pricing">
            {PLANS.map((p) => (
              <div className={`plan${p.featured ? ' featured' : ''}`} key={p.name}>
                {p.featured && <span className="featured-flag">가장 인기</span>}
                <span className="plan-group">{p.group}</span>
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
                <ul className="plan-features">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link href="/signup" className={`btn ${p.featured ? 'btn-dark' : 'btn-light'} btn-block btn-sm`}>
                  {p.price === '0' ? '무료로 시작하기' : '시작하기'}
                </Link>
              </div>
            ))}
          </div>

          <p className="price-note">
            무료 한도(개인 프로젝트 3개·할 일 300개, 팀원 3명·팀 할 일 300개)를 넘겨도 기존 데이터는 그대로 유지되고,
            새로 추가할 때만 업그레이드 안내가 나타납니다. 표시된 금액은 예상 요금제이며 정식 결제는 곧 안내드립니다.
          </p>

          <div className="pricing-cta">
            <Link href="/signup" className="btn btn-dark">
              무료로 시작하기
            </Link>
            <Link href="/login" className="btn btn-light">
              로그인
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
