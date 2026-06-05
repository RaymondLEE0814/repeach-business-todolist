// Family 일러스트 시스템 — 표정 있는 블롭 캐릭터 + 오브젝트(코인/별/하트/자물쇠/돋보기/화살표)
// design.md: "The illustration system IS the brand identity"
import type { CSSProperties } from 'react';

// ---------- 캐릭터: 유기적 블롭 + 막대 팔다리 + 점 눈 + 미소 ----------
function Blob({ color, dark }: { color: string; dark: string }) {
  return (
    <svg viewBox="0 0 100 116" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 팔다리 (뒤에) */}
      <g stroke={dark} strokeWidth="5" strokeLinecap="round">
        <line x1="14" y1="64" x2="2" y2="56" />
        <line x1="86" y1="64" x2="98" y2="56" />
        <line x1="38" y1="86" x2="33" y2="108" />
        <line x1="62" y1="86" x2="67" y2="108" />
      </g>
      {/* 몸통 블롭 */}
      <path
        d="M50 8 C72 6 93 22 91 47 C89 69 79 89 50 89 C23 89 9 70 9 47 C9 23 28 10 50 8 Z"
        fill={color}
        stroke={dark}
        strokeWidth="2.5"
      />
      {/* 눈 */}
      <circle cx="40" cy="45" r="5" fill="#1a1a1a" />
      <circle cx="62" cy="45" r="5" fill="#1a1a1a" />
      <circle cx="42" cy="43" r="1.7" fill="#fff" />
      <circle cx="64" cy="43" r="1.7" fill="#fff" />
      {/* 미소 */}
      <path d="M39 60 Q50 71 61 60" stroke="#1a1a1a" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Coin() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="42" fill="#ffbb26" stroke="#d48f00" strokeWidth="5" />
      <path d="M50 30 L56 45 L72 46 L59 56 L64 72 L50 62 L36 72 L41 56 L28 46 L44 45 Z" fill="#d48f00" />
    </svg>
  );
}

function Star() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <path
        d="M50 6 L62 38 L96 40 L69 61 L79 94 L50 74 L21 94 L31 61 L4 40 L38 38 Z"
        fill="#ffbb26"
        stroke="#d48f00"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Heart() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <path
        d="M50 86 C16 62 8 40 22 26 C33 15 47 20 50 34 C53 20 67 15 78 26 C92 40 84 62 50 86 Z"
        fill="#ff2b3a"
        stroke="#c81824"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Lock() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M30 48 V36 a20 20 0 0 1 40 0 V48" stroke="#d48f00" strokeWidth="8" fill="none" strokeLinecap="round" />
      <rect x="20" y="46" width="60" height="44" rx="10" fill="#ffbb26" stroke="#d48f00" strokeWidth="4" />
      <circle cx="50" cy="64" r="6" fill="#d48f00" />
      <rect x="47" y="64" width="6" height="14" rx="3" fill="#d48f00" />
    </svg>
  );
}

function Magnifier() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <circle cx="42" cy="42" r="28" fill="#e8f3ff" stroke="#0090ff" strokeWidth="7" />
      <line x1="62" y1="62" x2="86" y2="86" stroke="#0090ff" strokeWidth="9" strokeLinecap="round" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M18 70 C30 30 62 26 82 34" stroke="#00ca48" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M70 24 L86 32 L74 46" stroke="#00ca48" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Sparkle() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M50 8 C54 36 64 46 92 50 C64 54 54 64 50 92 C46 64 36 54 8 50 C36 46 46 36 50 8 Z" fill="#9f4fff" />
    </svg>
  );
}

type Piece = { el: React.ReactNode; s: CSSProperties };

const il = (style: CSSProperties, dur: number, delay: number, rot: number): CSSProperties =>
  ({
    ...style,
    ['--r']: `${rot}deg`,
    animationDuration: `${dur}s`,
    animationDelay: `${delay}s`,
  }) as CSSProperties;

const PIECES: Piece[] = [
  { el: <Blob color="#0090ff" dark="#006fcc" />, s: il({ top: 64, left: '5%', width: 96 }, 6.5, 0, -6) },
  { el: <Blob color="#ff3e00" dark="#cc3200" />, s: il({ top: 150, right: '7%', width: 80 }, 7, 1.2, 7) },
  { el: <Blob color="#00ca48" dark="#009b38" />, s: il({ bottom: 18, left: '13%', width: 64 }, 6, 0.6, -4) },
  { el: <Blob color="#ffbb26" dark="#d48f00" />, s: il({ top: 30, left: '31%', width: 52 }, 5.6, 1.8, 6) },
  { el: <Blob color="#ff58ae" dark="#d62f86" />, s: il({ top: 116, right: '25%', width: 58 }, 6.8, 0.9, -8) },
  { el: <Coin />, s: il({ top: 96, left: '21%', width: 40 }, 5.4, 0.3, 0) },
  { el: <Star />, s: il({ top: 54, right: '17%', width: 38 }, 5.8, 1.5, 10) },
  { el: <Heart />, s: il({ bottom: 56, right: '11%', width: 34 }, 5.2, 0.8, -6) },
  { el: <Sparkle />, s: il({ top: 24, left: '47%', width: 28 }, 4.8, 2.1, 0) },
  { el: <Magnifier />, s: il({ bottom: 30, left: '39%', width: 46 }, 6.2, 1.1, 6) },
  { el: <Arrow />, s: il({ top: 168, left: '3%', width: 52 }, 6.6, 1.7, -4) },
  { el: <Lock />, s: il({ top: 26, right: '31%', width: 34 }, 5.5, 0.5, 8) },
];

export default function HeroDecor() {
  return (
    <div className="hero-decor" aria-hidden>
      {PIECES.map((p, i) => (
        <span className="il" key={i} style={p.s}>
          {p.el}
        </span>
      ))}
    </div>
  );
}
