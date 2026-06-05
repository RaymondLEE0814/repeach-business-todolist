// ============================================================
// Mindash 게임화 로직 (v1)
// 완료한 할 일 수를 기반으로 XP/레벨/칭호/업적을 계산하는 순수 함수 모음.
// DB 추가 컬럼 없이 기존 todos.completed 만으로 동작.
// ============================================================

export const XP_PER_TODO = 10;

export type LevelDef = { level: number; minXp: number; title: string; icon: string };

export const LEVELS: LevelDef[] = [
  { level: 1, minXp: 0, title: '새싹', icon: '🌱' },
  { level: 2, minXp: 50, title: '일꾼', icon: '🔨' },
  { level: 3, minXp: 120, title: '능력자', icon: '⚡' },
  { level: 4, minXp: 250, title: '마스터', icon: '🎯' },
  { level: 5, minXp: 450, title: '전설', icon: '👑' },
  { level: 6, minXp: 700, title: '그랜드마스터', icon: '🏆' },
];

export function xpFromDone(done: number): number {
  return Math.max(0, done) * XP_PER_TODO;
}

export type LevelInfo = {
  xp: number;
  level: number;
  title: string;
  icon: string;
  hasNext: boolean;
  xpForNext: number; // 다음 레벨까지 남은 XP
  pct: number; // 현재 레벨 구간 진행률 (0~100)
};

export function levelInfo(done: number): LevelInfo {
  const xp = xpFromDone(done);
  let cur = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.minXp) cur = l;
  const next = LEVELS.find((l) => l.level === cur.level + 1) ?? null;
  const span = next ? next.minXp - cur.minXp : 1;
  const into = xp - cur.minXp;
  return {
    xp,
    level: cur.level,
    title: cur.title,
    icon: cur.icon,
    hasNext: !!next,
    xpForNext: next ? next.minXp - xp : 0,
    pct: next ? Math.min(100, Math.round((into / span) * 100)) : 100,
  };
}

export type Achievement = {
  id: string;
  threshold: number;
  name: string;
  icon: string;
  desc: string;
};

// 누적 완료 개수 기반 업적
export const COUNT_ACHIEVEMENTS: Achievement[] = [
  { id: 'first', threshold: 1, name: '첫 발걸음', icon: '👣', desc: '첫 할 일을 완료했어요' },
  { id: 'ten', threshold: 10, name: '탄력 받는 중', icon: '🔥', desc: '할 일 10개 완료' },
  { id: 'fifty', threshold: 50, name: '꾸준함의 증명', icon: '💎', desc: '할 일 50개 완료' },
  { id: 'hundred', threshold: 100, name: '백전백승', icon: '🌟', desc: '할 일 100개 완료' },
];

export function countAchievementsUnlocked(done: number): Achievement[] {
  return COUNT_ACHIEVEMENTS.filter((a) => done >= a.threshold);
}

// old → new 로 늘어날 때 새로 넘긴 누적-업적 (완료 순간 토스트용)
export function newlyUnlocked(oldDone: number, newDone: number): Achievement | null {
  return COUNT_ACHIEVEMENTS.find((a) => oldDone < a.threshold && newDone >= a.threshold) ?? null;
}
