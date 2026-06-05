// ============================================================
// Mindash 게임화 로직 (v2)
// - 레벨 문턱 하향(더 쉽게)
// - 난이도별 XP + 서브 퀘스트(체크리스트) 부분 완료 보상
// XP는 "완료한 할 일의 난이도 XP 합 + 완료 서브퀘스트 × 2"로 계산.
// 누적 업적은 완료한 할 일 "개수"로 판정.
// ============================================================

export type LevelDef = { level: number; minXp: number; title: string; icon: string };

// 문턱을 낮춰 더 자주 레벨업이 보이도록 (개정 방향: 더 쉽게)
export const LEVELS: LevelDef[] = [
  { level: 1, minXp: 0, title: '새싹', icon: '🌱' },
  { level: 2, minXp: 40, title: '일꾼', icon: '🔨' },
  { level: 3, minXp: 100, title: '능력자', icon: '⚡' },
  { level: 4, minXp: 200, title: '마스터', icon: '🎯' },
  { level: 5, minXp: 350, title: '전설', icon: '👑' },
  { level: 6, minXp: 550, title: '그랜드마스터', icon: '🏆' },
];

export type LevelInfo = {
  xp: number;
  level: number;
  title: string;
  icon: string;
  hasNext: boolean;
  xpForNext: number;
  pct: number;
};

// 인자는 누적 XP(이미 가중 합산된 값)
export function levelInfo(xp: number): LevelInfo {
  const safe = Math.max(0, xp);
  let cur = LEVELS[0];
  for (const l of LEVELS) if (safe >= l.minXp) cur = l;
  const next = LEVELS.find((l) => l.level === cur.level + 1) ?? null;
  const span = next ? next.minXp - cur.minXp : 1;
  const into = safe - cur.minXp;
  return {
    xp: safe,
    level: cur.level,
    title: cur.title,
    icon: cur.icon,
    hasNext: !!next,
    xpForNext: next ? next.minXp - safe : 0,
    pct: next ? Math.min(100, Math.round((into / span) * 100)) : 100,
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
