import Link from 'next/link';
import Nav from '@/app/components/Nav';
import AdInquiryForm from '@/app/components/AdInquiryForm';
import Footer from '@/app/components/Footer';
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

const ADS_POINTS = [
  {
    icon: '🎯',
    bg: '#ffece6',
    color: '#ff3e00',
    title: '명확한 타깃',
    desc: '개인 · 프리랜서 · 소규모 팀 · 스터디까지, 생산성 도구에 지갑을 여는 실사용자층에 닿습니다.',
  },
  {
    icon: '☀️',
    bg: '#fff6e0',
    color: '#d48f00',
    title: '매일 열어보는 화면',
    desc: '할 일 관리는 매일 반복 방문하는 서비스입니다. 일회성 노출이 아닌 반복 노출 지면을 협의할 수 있습니다.',
  },
  {
    icon: '🤝',
    bg: '#e6f9ee',
    color: '#00ca48',
    title: '유연한 집행',
    desc: '배너, 스폰서십, 뉴스레터, 제휴 이벤트 등 — 정해진 상품을 파는 대신 브랜드에 맞는 방식을 함께 설계합니다.',
  },
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
            <Link href="/signup" className="btn btn-dark">
              무료로 시작하기
            </Link>
            <Link href="/pricing" className="btn btn-light">
              요금제 미리 보기
            </Link>
          </div>
          <p className="hero-note">신용카드 없이 · 가입 즉시 이용</p>

          {/* 서비스 소개 영상 */}
          <div className="hero-video-wrap">
            <video
              className="hero-video"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/videos/intro-poster.webp"
              aria-label="서비스 소개 영상"
            >
              <source src="/videos/intro-video.webm" type="video/webm" />
              <source src="/videos/intro-video.mp4" type="video/mp4" />
            </video>
          </div>

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

      {/* ---------- Comparison ---------- */}
      <section className="section">
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

      {/* ---------- Pricing 티저 (자세한 요금표는 /pricing) ---------- */}
      <section className="section-tight" id="pricing">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">요금제</span>
            <h2 className="heading-lg">무료부터 월 19,000원까지, 작은 팀 가격</h2>
            <p>인당 과금 없는 고정 요금. 자세한 플랜은 요금제 페이지에서 확인하세요.</p>
          </div>
          <div className="pricing-cta">
            <Link href="/pricing" className="btn btn-dark">
              요금제 자세히 보기
            </Link>
            <Link href="/signup" className="btn btn-light">
              무료로 시작하기
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- 광고 · 제휴 문의 ---------- */}
      <section className="section" id="ads" style={{ background: 'var(--color-parchment-card)' }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">광고 · 제휴 문의</span>
            <h2 className="heading-lg">Mindash 사용자에게 브랜드를 알려보세요</h2>
            <p>
              일과 프로젝트에 진심인 사람들이 매일 찾는 화면입니다. 광고 지면과 형태는 문의를 받아 함께 협의해
              드립니다.
            </p>
          </div>

          <div className="grid-3" style={{ marginBottom: 40 }}>
            {ADS_POINTS.map((a) => (
              <div className="card" key={a.title}>
                <span className="card-icon" style={{ background: a.bg, color: a.color }}>
                  {a.icon}
                </span>
                <h3 className="heading-sm">{a.title}</h3>
                <p>{a.desc}</p>
              </div>
            ))}
          </div>

          <AdInquiryForm />
        </div>
      </section>

      <Footer />
    </>
  );
}
