import Link from 'next/link';
import Nav from '@/app/components/Nav';
import BetaForm from '@/app/components/BetaForm';
import HeroDecor from '@/app/components/HeroDecor';

const FEATURES = [
  { icon: '⚡', bg: '#ffece6', color: '#ff3e00', title: '빠른 할 일 입력', desc: '떠오르는 일을 즉시 적고 나중에 정리하세요. 입력은 1초, 정리는 마인드맵에서.' },
  { icon: '🧠', bg: '#e8f3ff', color: '#0090ff', title: '마인드맵 기반 프로젝트 보기', desc: '프로젝트 구조를 한눈에. 노드를 펼치며 큰 그림과 세부 업무를 동시에 봅니다.' },
  { icon: '☀️', bg: '#fff6e0', color: '#d48f00', title: '오늘 / 이번 주 실행 화면', desc: '흩어진 할 일을 오늘 할 일로 모아 실행에 집중하게 합니다.' },
  { icon: '📅', bg: '#e6f9ee', color: '#00ca48', title: '프로젝트별 캘린더', desc: '마감일과 일정을 프로젝트별 캘린더로 확인하고 놓치지 않습니다.' },
  { icon: '👥', bg: '#f3ecff', color: '#9f4fff', title: '팀원 초대 · 담당자 지정', desc: '누가 무엇을 언제까지 하는지 명확하게. 인당 과금 없이 작은 팀 가격으로.' },
  { icon: '🔗', bg: '#ffeef6', color: '#ff58ae', title: '읽기 전용 공유 링크', desc: '고객이나 외부에 진행 상황을 링크 하나로 안전하게 공유합니다.' },
  { icon: '🗓️', bg: '#e8f3ff', color: '#0086fc', title: 'Google Calendar 연동', desc: '기존 캘린더와 일정을 동기화해 한곳에서 관리합니다.', soon: true },
  { icon: '🧩', bg: '#fff6e0', color: '#d48f00', title: '프로젝트 템플릿', desc: '자주 쓰는 프로젝트 구조를 템플릿으로 바로 시작합니다.' },
];

const PROBLEMS = [
  '할 일은 많은데 프로젝트 흐름이 안 보이나요?',
  '회의에서 나온 아이디어가 실제 일정으로 이어지지 않나요?',
  '노션, 엑셀, 카카오톡에 업무가 흩어져 있나요?',
  '작은 팀인데 PM툴 요금이 부담스럽나요?',
];

const FLOW = [
  { n: '1', title: '마인드맵으로 구조를 만든다', desc: '프로젝트를 노드로 펼치며 머릿속 계획을 한 장의 그림으로 정리합니다.' },
  { n: '2', title: '노드를 할 일로 바꾼다', desc: '각 노드에 마감일과 담당자를 붙이면 그대로 실행 가능한 업무가 됩니다.' },
  { n: '3', title: '일정표에서 바로 실행한다', desc: '오늘·이번 주 화면에서 할 일을 확인하고 체크하며 진행합니다.' },
];

const USECASES = [
  { tag: '개인', color: '#ff3e00', title: '사이드 프로젝트를 계획하고 매일 실행', desc: '공부 계획, 자기계발 루틴, 개인 목표를 구조화하고 오늘 할 일로 실행합니다.' },
  { tag: '프리랜서', color: '#0090ff', title: '고객별 납기일과 작업 목록 관리', desc: '고객별 프로젝트, 마감일, 작업을 한곳에서 관리하고 진행을 공유합니다.' },
  { tag: '소규모 팀', color: '#00ca48', title: '누가 무엇을 언제까지 할지 공유', desc: '복잡한 PM툴 없이 담당자와 마감을 명확히 나누고 팀 캘린더로 확인합니다.' },
  { tag: '스터디 / 동아리', color: '#9f4fff', title: '행사 준비와 역할 분담 관리', desc: '행사·프로젝트를 단계로 나누고 역할을 배정해 빠짐없이 준비합니다.' },
];

const PLANS = [
  { name: 'Free', price: '0', target: '체험 / 개인 시작', value: '프로젝트 3개, 마인드맵 3개', featured: false },
  { name: 'Personal Pro', price: '3,900', target: '개인', value: '무제한 프로젝트와 캘린더 연동', featured: true },
  { name: 'Freelancer', price: '7,900', target: '1인 사업자', value: '고객별 프로젝트와 외부 공유', featured: false },
  { name: 'Team Starter', price: '19,000', target: '2~5명 팀', value: '팀원 3명 포함, 담당자·댓글·팀 캘린더', featured: false },
];

const COMPARE = [
  { who: 'Todoist · TickTick', what: '빠르지만 프로젝트 구조 시각화가 약함' },
  { who: 'Notion', what: '유연하지만 직접 설계해야 해서 초반 부담이 큼' },
  { who: 'Trello', what: '쉽지만 큰 프로젝트 흐름이 흩어질 수 있음' },
  { who: 'Asana · ClickUp · monday', what: '강력하지만 작은 팀에게 비싸고 무거움' },
  { who: 'Miro · MindMeister', what: '아이디어 정리에 좋지만 실행 일정관리가 약함' },
];

export default function Home() {
  return (
    <>
      <Nav />

      {/* ---------- Hero ---------- */}
      <header className="hero">
        <HeroDecor />

        <div className="container hero-inner">
          <span className="eyebrow">개인과 작은 팀을 위한 프로젝트 일정관리</span>
          <h1 className="display">
            마인드맵으로 계획하고,
            <br />
            일정표로 <span className="accent">바로 실행</span>하세요
          </h1>
          <p className="sub">
            아이디어를 업무로 바꾸고, 오늘 할 일을 놓치지 않게 도와줍니다.
            마인드맵과 일정표를 한 화면에 연결하세요.
          </p>
          <div className="hero-actions">
            <a href="#beta" className="btn btn-dark">
              무료 베타 신청하기
            </a>
            <a href="#pricing" className="btn btn-light">
              요금제 미리 보기
            </a>
          </div>
          <p className="hero-note">신용카드 없이 신청 · 베타 예상 요금제</p>

          {/* 제품 시각화: 마인드맵 → 일정 */}
          <div className="product">
            <div className="product-grid">
              <div className="panel">
                <div className="panel-title">
                  <span className="dot" style={{ background: '#ff3e00' }} /> 마인드맵 · 프로젝트 구조
                </div>
                <div className="mind">
                  <span className="node root">제품 출시</span>
                  <span className="node n1">랜딩페이지</span>
                  <span className="node n2">베타 모집</span>
                  <span className="node n3">가격 검증</span>
                  <span className="node n4">팀 세팅</span>
                </div>
              </div>
              <div className="panel">
                <div className="panel-title">
                  <span className="dot" style={{ background: '#00ca48' }} /> 오늘 할 일 · 일정표
                </div>
                <div>
                  <div className="sched-item">
                    <span className="check done" />
                    <span className="sched-text done">랜딩 카피 확정</span>
                    <span className="pill-date">완료</span>
                  </div>
                  <div className="sched-item">
                    <span className="check" />
                    <span className="sched-text">베타 폼 연결</span>
                    <span className="pill-date soon">오늘</span>
                  </div>
                  <div className="sched-item">
                    <span className="check" />
                    <span className="sched-text">가격표 검토</span>
                    <span className="pill-date">내일</span>
                  </div>
                  <div className="sched-item">
                    <span className="check" />
                    <span className="sched-text">팀원 초대</span>
                    <span className="pill-date">이번 주</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- Problem ---------- */}
      <section className="section" id="problem">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">이런 적 있으신가요</span>
            <h2 className="heading-lg">할 일은 쌓이는데, 프로젝트는 안 보입니다</h2>
            <p>도구는 많은데 정작 업무는 여기저기 흩어져 있습니다.</p>
          </div>
          <div className="problem-list">
            {PROBLEMS.map((p, i) => (
              <div className="problem-item" key={i}>
                <span className="q">{['🌀', '💡', '📨', '💸'][i]}</span>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Solution flow ---------- */}
      <section className="section" id="flow" style={{ background: 'var(--color-parchment-card)' }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">사용 흐름</span>
            <h2 className="heading-lg">계획에서 실행까지 3단계</h2>
            <p>아이디어가 할 일로 흩어지지 않게, 한 흐름으로 연결합니다.</p>
          </div>
          <div className="flow">
            {FLOW.map((s) => (
              <div className="flow-step" key={s.n}>
                <div className="flow-num">{s.n}</div>
                <h3 className="heading-sm">{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="section" id="features">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">핵심 기능</span>
            <h2 className="heading-lg">실행에 필요한 것만, 가볍게</h2>
            <p>많은 기능보다 매일 쓰는 흐름에 집중했습니다.</p>
          </div>
          <div className="grid-4">
            {FEATURES.map((f) => (
              <div className="card" key={f.title}>
                <span className="card-icon" style={{ background: f.bg, color: f.color }}>
                  {f.icon}
                </span>
                <h3 className="heading-sm">
                  {f.title}
                  {f.soon && <span className="badge-soon">예정</span>}
                </h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Use cases ---------- */}
      <section className="section" style={{ background: 'var(--color-parchment-card)' }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">사용 사례</span>
            <h2 className="heading-lg">당신의 상황에 딱 맞게</h2>
          </div>
          <div className="grid-2">
            {USECASES.map((u) => (
              <div className="usecase" key={u.tag}>
                <span className="tag" style={{ background: u.color }}>
                  {u.tag}
                </span>
                <h3>{u.title}</h3>
                <p>{u.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      <section className="section" id="pricing">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">베타 예상 요금제</span>
            <h2 className="heading-lg">작은 팀도 부담 없는 가격</h2>
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
                <a href="#beta" className={`btn ${p.featured ? 'btn-dark' : 'btn-light'} btn-block btn-sm`}>
                  이 가격으로 신청
                </a>
              </div>
            ))}
          </div>
          <p className="price-note">
            표시된 금액은 확정 결제가 아니라 베타 예상 요금제입니다. 출시 시 다시 안내드립니다.
          </p>
          <div className="pricing-cta">
            <a href="#beta" className="btn btn-dark">
              이 가격으로 베타 신청하기
            </a>
            <a href="#beta" className="btn btn-light">
              팀 요금제 알림 받기
            </a>
          </div>
        </div>
      </section>

      {/* ---------- Comparison ---------- */}
      <section className="section" style={{ background: 'var(--color-parchment-card)' }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">대안 비교</span>
            <h2 className="heading-lg">왜 Mindash 인가요?</h2>
          </div>
          <div className="compare">
            {COMPARE.map((c) => (
              <div className="compare-row" key={c.who}>
                <span className="who">{c.who}</span>
                <span className="what">{c.what}</span>
              </div>
            ))}
            <div className="compare-banner">
              Mindash는 <b>마인드맵 · 일정관리 · 간단한 팀 협업</b>을 작은 팀 가격에 연결합니다.
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Beta signup ---------- */}
      <section className="section beta" id="beta">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">무료 베타</span>
            <h2 className="heading-lg">가장 먼저 사용해 보세요</h2>
            <p>30초면 신청 완료. 베타 오픈 시 가장 먼저 안내드립니다.</p>
          </div>
          <BetaForm />
        </div>
      </section>

      {/* ---------- Footer ---------- */}
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
              <a href="#features">기능</a>
              <a href="#pricing">요금제</a>
              <a href="#beta">베타 신청</a>
              <Link href="/login">로그인</Link>
              <Link href="/signup">회원가입</Link>
            </div>
          </div>
          <p className="footer-copy">© 2026 Mindash. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
