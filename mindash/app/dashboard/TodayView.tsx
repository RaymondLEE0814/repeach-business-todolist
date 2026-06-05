'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { levelInfo, newlyUnlocked, xpForDifficulty, DIFFICULTY, SUBTASK_XP, type Difficulty } from '@/lib/gamification';
import Confetti from './Confetti';
import GameBar from './GameBar';
import { bucketOf, dueLabel, todayStr, type Bucket } from './dateUtils';

type Project = { id: string; name: string };
type Row = {
  id: string;
  project_id: string;
  category_id: string;
  title: string;
  completed: boolean;
  link: string | null;
  notes: string | null;
  difficulty: string | null;
  due_date: string | null;
};
type Toast = { key: number; icon: string; title: string; sub?: string };

const normalizeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
const diffOf = (d?: string | null): Difficulty => ((d as Difficulty) in DIFFICULTY ? (d as Difficulty) : 'normal');

const BUCKETS: { key: Bucket; label: string; color: string }[] = [
  { key: 'overdue', label: '지난 일정', color: '#ff3e00' },
  { key: 'today', label: '오늘', color: '#d48f00' },
  { key: 'week', label: '이번 주', color: '#0090ff' },
  { key: 'later', label: '이후', color: '#848281' },
  { key: 'none', label: '날짜 없음', color: '#c6c6c6' },
];

export default function TodayView({ projects }: { projects: Project[] }) {
  const supabase = createClient();
  const [items, setItems] = useState<Row[]>([]); // 미완료만
  const [loading, setLoading] = useState(true);
  const [gDone, setGDone] = useState(0);
  const [gXp, setGXp] = useState(0);
  const [confettiKey, setConfettiKey] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  const projName = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach((p) => (m[p.id] = p.name));
    return m;
  }, [projects]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    let { data, error } = await supabase
      .from('todos')
      .select('id,project_id,category_id,title,completed,link,notes,difficulty,due_date');
    if (error) {
      // 마이그레이션 전 폴백
      const fb = await supabase.from('todos').select('id,project_id,category_id,title,completed,link,notes');
      data = (fb.data ?? []).map((r) => ({ ...(r as Row), difficulty: 'normal', due_date: null }));
    }
    const rows = (data as Row[]) ?? [];
    const completed = rows.filter((r) => r.completed);
    const base = completed.reduce((s, r) => s + xpForDifficulty(r.difficulty), 0);
    const subRes = await supabase.from('subtasks').select('*', { count: 'exact', head: true }).eq('done', true);
    const subDone = subRes.error ? 0 : subRes.count ?? 0;
    setGDone(completed.length);
    setGXp(base + SUBTASK_XP * subDone);
    setItems(rows.filter((r) => !r.completed));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(id);
  }, [toast]);

  const complete = async (r: Row) => {
    const dxp = xpForDifficulty(r.difficulty);
    const prev = items;
    setItems((list) => list.filter((x) => x.id !== r.id));
    const oldXp = gXp;
    const newXp = oldXp + dxp;
    setGXp(newXp);
    setGDone((d) => d + 1);
    setConfettiKey((k) => k + 1);

    const before = levelInfo(oldXp);
    const after = levelInfo(newXp);
    if (after.level > before.level) {
      setToast({ key: newXp, icon: after.icon, title: `레벨 업! Lv.${after.level} ${after.title}`, sub: '새 칭호를 획득했어요 🎉' });
    } else {
      const ach = newlyUnlocked(gDone, gDone + 1);
      if (ach) setToast({ key: gDone + 1, icon: ach.icon, title: `업적 달성: ${ach.name}`, sub: ach.desc });
    }

    const { error } = await supabase.from('todos').update({ completed: true }).eq('id', r.id).eq('category_id', r.category_id);
    if (error) {
      setItems(prev);
      setGXp(oldXp);
      setGDone((d) => Math.max(0, d - 1));
      alert('저장에 실패했습니다: ' + error.message);
    }
  };

  const setDueToday = async (r: Row) => {
    const t = todayStr();
    setItems((list) => list.map((x) => (x.id === r.id ? { ...x, due_date: t } : x)));
    const { error } = await supabase.from('todos').update({ due_date: t }).eq('id', r.id).eq('category_id', r.category_id);
    if (error) {
      setItems((list) => list.map((x) => (x.id === r.id ? { ...x, due_date: r.due_date } : x)));
      alert('저장에 실패했습니다: ' + error.message);
    }
  };

  const grouped = useMemo(() => {
    const g: Record<Bucket, Row[]> = { overdue: [], today: [], week: [], later: [], none: [] };
    items.forEach((r) => g[bucketOf(r.due_date)].push(r));
    (Object.keys(g) as Bucket[]).forEach((k) => g[k].sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '')));
    return g;
  }, [items]);

  const totalLeft = items.length;
  const todayCount = grouped.today.length + grouped.overdue.length;

  return (
    <>
      <Confetti fireKey={confettiKey} />
      {toast && (
        <div className="game-toast" key={toast.key}>
          <span className="game-toast-icon">{toast.icon}</span>
          <div>
            <div className="game-toast-title">{toast.title}</div>
            {toast.sub && <div className="game-toast-sub">{toast.sub}</div>}
          </div>
        </div>
      )}

      <GameBar gXp={gXp} gDone={gDone} />

      <div className="today">
        <div className="today-head">
          <h2 className="heading">오늘 집중할 일 {todayCount > 0 ? `${todayCount}개` : ''}</h2>
          <p className="muted" style={{ fontSize: 14 }}>
            여러 프로젝트에 흩어진 할 일을 날짜별로 모았어요. 체크하면 목록에서 사라집니다.
          </p>
        </div>

        {loading ? (
          <p className="muted" style={{ padding: '40px 0', textAlign: 'center' }}>
            불러오는 중…
          </p>
        ) : totalLeft === 0 ? (
          <div className="dash-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 8 }}>🎉</div>
            <h3 className="heading-sm">남은 할 일이 없어요!</h3>
            <p className="muted" style={{ marginTop: 6 }}>워크스페이스에서 새 할 일을 추가하고 계획일을 정해보세요.</p>
          </div>
        ) : (
          BUCKETS.map((b) => {
            const list = grouped[b.key];
            if (list.length === 0) return null;
            return (
              <section className="today-bucket" key={b.key}>
                <h3 className="today-bucket-head">
                  <span className="today-dot" style={{ background: b.color }} />
                  {b.label}
                  <span className="today-cnt">{list.length}</span>
                </h3>
                <div className="today-list">
                  {list.map((r) => {
                    const d = diffOf(r.difficulty);
                    return (
                      <div className="today-item" key={r.id}>
                        <label className="today-main">
                          <input type="checkbox" checked={false} onChange={() => complete(r)} />
                          <span className="ws-check" />
                          <span className="today-text-wrap">
                            <span className="today-text">
                              {d !== 'normal' && (
                                <span className="ws-diff" style={{ color: DIFFICULTY[d].color, borderColor: DIFFICULTY[d].color }}>
                                  {DIFFICULTY[d].label}
                                </span>
                              )}
                              {r.link ? (
                                <a href={normalizeUrl(r.link)} target="_blank" rel="noreferrer">
                                  {r.title}
                                </a>
                              ) : (
                                r.title
                              )}
                            </span>
                            <span className="today-meta">
                              <span className="today-proj">{projName[r.project_id] ?? '프로젝트'}</span>
                              {r.due_date && <span className={`ws-due ws-due-${b.key}`}>📅 {dueLabel(r.due_date)}</span>}
                            </span>
                            {r.notes ? <span className="ws-note">{r.notes}</span> : null}
                          </span>
                        </label>
                        {b.key !== 'today' && (
                          <button className="today-toToday" onClick={() => setDueToday(r)} title="오늘 할 일로">
                            오늘로
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
