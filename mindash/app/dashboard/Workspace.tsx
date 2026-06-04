'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Project = { id: string; name: string };
type Category = { id: string; name: string };
type Todo = {
  id: string;
  category_id: string;
  title: string;
  completed: boolean;
  assignee: string | null;
  progress: string | null;
  link: string | null;
};

export default function Workspace({ projects }: { projects: Project[] }) {
  const supabase = createClient();
  const [activeId, setActiveId] = useState<string | null>(projects[0]?.id ?? null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (projectId: string) => {
      setLoading(true);
      const [{ data: cats }, { data: tds }] = await Promise.all([
        supabase.from('categories').select('id,name').eq('project_id', projectId).order('position'),
        supabase
          .from('todos')
          .select('id,category_id,title,completed,assignee,progress,link')
          .eq('project_id', projectId)
          .order('position'),
      ]);
      setCategories((cats as Category[]) ?? []);
      setTodos((tds as Todo[]) ?? []);
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    if (activeId) load(activeId);
  }, [activeId, load]);

  const toggle = async (todo: Todo) => {
    const next = !todo.completed;
    // 낙관적 업데이트
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: next } : t)));
    const { error } = await supabase
      .from('todos')
      .update({ completed: next })
      .eq('id', todo.id)
      .eq('category_id', todo.category_id);
    if (error) {
      // 롤백
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: !next } : t)));
      alert('저장에 실패했습니다: ' + error.message);
    }
  };

  const total = todos.length;
  const done = todos.filter((t) => t.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="ws">
      {/* 프로젝트 전환 탭 */}
      <div className="ws-tabs">
        {projects.map((p) => (
          <button
            key={p.id}
            className={`ws-tab${p.id === activeId ? ' active' : ''}`}
            onClick={() => setActiveId(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* 진행 현황 */}
      <div className="ws-stats">
        <div className="ws-chip">
          <span className="ws-num">{total}</span>
          <span className="ws-label">전체 할 일</span>
        </div>
        <div className="ws-chip">
          <span className="ws-num" style={{ color: 'var(--color-meadow-green)' }}>
            {done}
          </span>
          <span className="ws-label">완료</span>
        </div>
        <div className="ws-progress">
          <div className="ws-progress-head">
            <span className="ws-label">진행률</span>
            <span className="ws-pct">{pct}%</span>
          </div>
          <div className="ws-bar">
            <div className="ws-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="muted" style={{ padding: '40px 0', textAlign: 'center' }}>
          불러오는 중…
        </p>
      ) : (
        <div className="ws-cols">
          {categories.map((cat) => {
            const items = todos.filter((t) => t.category_id === cat.id);
            const catDone = items.filter((t) => t.completed).length;
            return (
              <div className="ws-col" key={cat.id}>
                <div className="ws-col-head">
                  <span className="ws-col-name">{cat.name}</span>
                  <span className="ws-col-count">
                    {catDone}/{items.length}
                  </span>
                </div>
                <div className="ws-list">
                  {items.map((t) => (
                    <label className="ws-item" key={t.id}>
                      <input
                        type="checkbox"
                        checked={t.completed}
                        onChange={() => toggle(t)}
                      />
                      <span className={`ws-check${t.completed ? ' done' : ''}`} />
                      <span className={`ws-text${t.completed ? ' done' : ''}`}>
                        {t.link ? (
                          <a href={t.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                            {t.title}
                          </a>
                        ) : (
                          t.title
                        )}
                        {t.assignee ? <span className="ws-assignee">{t.assignee}</span> : null}
                      </span>
                    </label>
                  ))}
                  {items.length === 0 && <p className="ws-empty">할 일 없음</p>}
                </div>
              </div>
            );
          })}
          {categories.length === 0 && (
            <p className="muted">이 프로젝트에는 아직 항목이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
