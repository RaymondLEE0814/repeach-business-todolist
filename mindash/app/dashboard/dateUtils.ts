// 오늘/이번 주 실행 화면용 날짜 유틸 (브라우저 로컬 기준)

const pad = (n: number) => String(n).padStart(2, '0');
export const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => toStr(new Date());

// 이번 주 끝(다가오는 일요일, 일요일이면 오늘)
export function endOfWeekStr(): string {
  const d = new Date();
  const add = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + add);
  return toStr(d);
}

export type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none';

export function bucketOf(due: string | null | undefined): Bucket {
  if (!due) return 'none';
  const t = todayStr();
  if (due < t) return 'overdue';
  if (due === t) return 'today';
  if (due <= endOfWeekStr()) return 'week';
  return 'later';
}

// 뱃지용 라벨 (오늘/내일/어제/N일 지남/월/일(요일))
export function dueLabel(due: string | null | undefined): string {
  if (!due) return '';
  const [y, m, d] = due.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === -1) return '어제';
  if (diff < 0) return `${-diff}일 지남`;
  const wd = ['일', '월', '화', '수', '목', '금', '토'][target.getDay()];
  return `${m}/${d}(${wd})`;
}
