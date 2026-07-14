// ============================================================
// Mindash 게임화 로직 (v3 — 공식 기반 무한 레벨)
// - 레벨은 공식(누적 XP = round5(10 × (n-1)^1.7))으로 무한히 이어짐.
// - 칭호는 10티어 × 5단계(로마숫자). Lv51+는 '초월' 티어 유지.
// - XP는 "완료한 할 일의 난이도 XP 합 + 완료 서브퀘스트 × 2"로 계산(내가 완료한 것만).
// - 누적 업적은 완료한 할 일 "개수"로 판정.
// ============================================================

export type Tier = { tier: number; name: string; icon: string; startLevel: number };
export const LEVELS_PER_TIER = 5;

// 티어별 시작 레벨 = (tier-1)*5+1
export const TIERS: Tier[] = [
  { tier: 1, name: '새싹', icon: '🌱', startLevel: 1 },
  { tier: 2, name: '일꾼', icon: '🔨', startLevel: 6 },
  { tier: 3, name: '능력자', icon: '⚡', startLevel: 11 },
  { tier: 4, name: '숙련가', icon: '🧭', startLevel: 16 },
  { tier: 5, name: '전문가', icon: '🚀', startLevel: 21 },
  { tier: 6, name: '마스터', icon: '🎯', startLevel: 26 },
  { tier: 7, name: '전설', icon: '👑', startLevel: 31 },
  { tier: 8, name: '그랜드마스터', icon: '🏆', startLevel: 36 },
  { tier: 9, name: '신화', icon: '🌟', startLevel: 41 },
  { tier: 10, name: '초월', icon: '🪐', startLevel: 46 },
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

// 레벨 n 도달에 필요한 누적 XP (n>=1, Lv1=0)
export function cumXpForLevel(n: number): number {
  if (n <= 1) return 0;
  return Math.round((10 * Math.pow(n - 1, 1.7)) / 5) * 5;
}

function levelFromXp(xp: number): number {
  let lv = Math.floor(Math.pow(Math.max(0, xp) / 10, 1 / 1.7)) + 1;
  if (lv < 1) lv = 1;
  while (cumXpForLevel(lv + 1) <= xp) lv++;
  while (lv > 1 && cumXpForLevel(lv) > xp) lv--;
  return lv;
}

export function tierForLevel(level: number): Tier {
  const idx = Math.min(Math.floor((level - 1) / LEVELS_PER_TIER), TIERS.length - 1);
  return TIERS[idx];
}

export function titleFor(level: number): { title: string; icon: string; tierName: string; subRank: number } {
  const t = tierForLevel(level);
  const subRank = level - t.startLevel + 1; // 초월 티어에선 5 초과 가능
  const title = subRank <= 5 ? `${t.name} ${ROMAN[subRank - 1]}` : `${t.name} ✦${subRank}`;
  return { title, icon: t.icon, tierName: t.name, subRank };
}

export type LevelInfo = {
  xp: number;
  level: number;
  title: string;
  icon: string;
  hasNext: boolean;
  xpForNext: number;
  pct: number;
  // v3 추가 필드
  tier: number;
  tierName: string;
  subRank: number;
  levelStartXp: number;
  nextLevelXp: number;
};

// 인자는 누적 XP(이미 가중 합산된 값)
export function levelInfo(xp: number): LevelInfo {
  const safe = Math.max(0, xp);
  const level = levelFromXp(safe);
  const t = tierForLevel(level);
  const { title, icon, tierName, subRank } = titleFor(level);
  const levelStartXp = cumXpForLevel(level);
  const nextLevelXp = cumXpForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - levelStartXp);
  return {
    xp: safe,
    level,
    title,
    icon,
    hasNext: true, // 무한 레벨
    xpForNext: nextLevelXp - safe,
    pct: Math.min(100, Math.floor(((safe - levelStartXp) / span) * 100)),
    tier: t.tier,
    tierName,
    subRank,
    levelStartXp,
    nextLevelXp,
  };
}

// ---------- 난이도 ----------
export type Difficulty = 'easy' | 'normal' | 'hard' | 'delayed';

export const DIFFICULTY: Record<Difficulty, { xp: number; label: string; icon: string; color: string }> = {
  easy: { xp: 5, label: '쉬움', icon: '🟢', color: '#00ca48' },
  normal: { xp: 10, label: '보통', icon: '🔵', color: '#0090ff' },
  hard: { xp: 20, label: '어려움', icon: '🔴', color: '#ff3e00' },
  delayed: { xp: 25, label: '미루던 일', icon: '🟣', color: '#9f4fff' },
};

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'delayed'];

export function xpForDifficulty(d?: string | null): number {
  return DIFFICULTY[(d as Difficulty) in DIFFICULTY ? (d as Difficulty) : 'normal'].xp;
}

// 서브 퀘스트(체크리스트) 1개 완료 = +2 XP (작은 단위 보상)
export const SUBTASK_XP = 2;

// ---------- 누적 완료 개수 기반 업적 ----------
export type Achievement = { id: string; threshold: number; name: string; icon: string; desc: string };

export const COUNT_ACHIEVEMENTS: Achievement[] = [
  { id: 'first', threshold: 1, name: '첫 발걸음', icon: '👣', desc: '첫 할 일을 완료했어요' },
  { id: 'ten', threshold: 10, name: '탄력 받는 중', icon: '🔥', desc: '할 일 10개 완료' },
  { id: 'fifty', threshold: 50, name: '꾸준함의 증명', icon: '💎', desc: '할 일 50개 완료' },
  { id: 'hundred', threshold: 100, name: '백전백승', icon: '🌟', desc: '할 일 100개 완료' },
];

export function countAchievementsUnlocked(done: number): Achievement[] {
  return COUNT_ACHIEVEMENTS.filter((a) => done >= a.threshold);
}

export function newlyUnlocked(oldDone: number, newDone: number): Achievement | null {
  return COUNT_ACHIEVEMENTS.find((a) => oldDone < a.threshold && newDone >= a.threshold) ?? null;
}
