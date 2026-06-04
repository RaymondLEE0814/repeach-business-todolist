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

const uid = () => globalThis.crypto.randomUUID();

// 카테고리별 브랜치 색상 (Family 팔레트)
const CAT_COLORS = ['#ff3e00', '#0090ff', '#00ca48', '#ffbb26', '#9f4fff', '#ff58ae', '#0086fc', '#00c978'];
const catColor = (i: number) => CAT_COLORS[i % CAT_COLORS.length];

export default function Workspace({
  initialProjects,
  userId,
}: {
  initialProjects: Project[];
  userId: string;
}) {
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeId, setActiveId] = useState<string | null>(initialProjects[0]?.id ?? null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'list' | 'mindmap'>('list');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
    else {
      setCategories([]);
      setTodos([]);
    }
  }, [activeId, load]);

  // ---------- 프로젝트 생성 ----------
  const addProject = async () => {
    const name = window.prompt('새 프로젝트 이름')?.trim();
    if (!name) return;
    const id = uid();
    const { error } = await supabase.from('projects').insert({ id, name, owner_id: userId });
    if (error) {
      alert('프로젝트 생성 실패: ' + error.message);
      return;
    }
    setProjects((p) => [...p, { id, name }]);
    setActiveId(id);
  };

  const deleteProject = async (project: Project) => {
    if (!window.confirm(`'${project.name}' 프로젝트를 삭제할까요? 안의 할 일도 모두 삭제됩니다.`)) return;
    // 자식 먼저 삭제 (FK가 없으므로 수동 정리)
    await supabase.from('todos').delete().eq('project_id', project.id);
    await supabase.from('categories').delete().eq('project_id', project.id);
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (error) {
      alert('삭제 실패: ' + error.message);
      return;
    }
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== project.id);
      if (activeId === project.id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  // ---------- 카테고리 생성 ----------
  const addCategory = async () => {
    if (!activeId) return;
    const name = window.prompt('새 카테고리 이름')?.trim();
    if (!name) return;
    const id = uid();
    const { error } = await supabase
      .from('categories')
      .insert({ project_id: activeId, id, name, position: categories.length });
    if (error) {
      alert('카테고리 생성 실패: ' + error.message);
      return;
    }
    setCategories((c) => [...c, { id, name }]);
  };

  const deleteCategory = async (cat: Category) => {
    if (!activeId) return;
    if (!window.confirm(`'${cat.name}' 카테고리와 그 안의 할 일을 삭제할까요?`)) return;
    await supabase.from('todos').delete().eq('project_id', activeId).eq('category_id', cat.id);
    const { error } = await supabase.from('categories').delete().eq('project_id', activeId).eq('id', cat.id);
    if (error) {
      alert('삭제 실패: ' + error.message);
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    setTodos((prev) => prev.filter((t) => t.category_id !== cat.id));
  };

  // ---------- 할 일 생성 / 삭제 / 토글 ----------
  const addTodo = async (categoryId: string) => {
    if (!activeId) return;
    const title = window.prompt('할 일 내용')?.trim();
    if (!title) return;
    const id = uid();
    const { error } = await supabase.from('todos').insert({
      project_id: activeId,
      id,
      category_id: categoryId,
      title,
      completed: false,
      notes: '',
      assignee: '',
      progress: '0',
      link: '',
      position: todos.length,
    });
    if (error) {
      alert('할 일 생성 실패: ' + error.message);
      return;
    }
    setTodos((t) => [...t, { id, category_id: categoryId, title, completed: false, assignee: '', progress: '0', link: '' }]);
  };

  const deleteTodo = async (todo: Todo) => {
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', todo.id)
      .eq('category_id', todo.category_id);
    if (error) {
      alert('삭제 실패: ' + error.message);
      if (activeId) load(activeId);
    }
  };

  const toggle = async (todo: Todo) => {
    const next = !todo.completed;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: next } : t)));
    const { error } = await supabase
      .from('todos')
      .update({ completed: next })
      .eq('id', todo.id)
      .eq('category_id', todo.category_id);
    if (error) {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: !next } : t)));
      alert('저장에 실패했습니다: ' + error.message);
    }
  };

  const total = todos.length;
  const done = todos.filter((t) => t.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const activeProject = projects.find((p) => p.id === activeId) ?? null;

  // ---------- 빈 워크스페이스 ----------
  if (projects.length === 0) {
    return (
      <div className="dash-card" style={{ textAlign: 'center' }}>
        <h2 className="heading">아직 프로젝트가 없습니다</h2>
        <p className="body" style={{ margin: '10px 0 22px' }}>
          첫 프로젝트를 만들어 나만의 업무 공간을 시작하세요.
        </p>
        <button className="btn btn-dark" onClick={addProject}>
          + 새 프로젝트 만들기
        </button>
      </div>
    );
  }

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
        <button className="ws-tab ws-tab-add" onClick={addProject}>
          + 프로젝트
        </button>
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
        {activeProject && (
          <button className="ws-del-project" onClick={() => deleteProject(activeProject)} title="프로젝트 삭제">
            프로젝트 삭제
          </button>
        )}
      </div>

      {/* 뷰 전환: 목록 / 마인드맵 */}
      <div className="ws-viewtoggle">
        <button className={`ws-vbtn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')}>
          ▦ 목록 뷰
        </button>
        <button className={`ws-vbtn${view === 'mindmap' ? ' active' : ''}`} onClick={() => setView('mindmap')}>
          ⌗ 마인드맵 뷰
        </button>
      </div>

      {loading ? (
        <p className="muted" style={{ padding: '40px 0', textAlign: 'center' }}>
          불러오는 중…
        </p>
      ) : view === 'mindmap' ? (
        /* ---------- 마인드맵 뷰 ---------- */
        <div className="mm">
          <div className="mm-root">{activeProject?.name ?? '프로젝트'}</div>
          <div className="mm-branches">
            {categories.map((cat, i) => {
              const items = todos.filter((t) => t.category_id === cat.id);
              const cdone = items.filter((t) => t.completed).length;
              const cpct = items.length ? Math.round((cdone / items.length) * 100) : 0;
              const open = !!expanded[cat.id];
              return (
                <div className="mm-branch" key={cat.id}>
                  <button
                    className="mm-node"
                    style={{ borderLeftColor: catColor(i) }}
                    onClick={() => setExpanded((e) => ({ ...e, [cat.id]: !e[cat.id] }))}
                  >
                    <span className="mm-node-top">
                      <span className="mm-dot" style={{ background: catColor(i) }} />
                      <span className="mm-node-name">{cat.name}</span>
                      <span className="mm-caret">{open ? '▾' : '▸'}</span>
                    </span>
                    <span className="mm-node-prog">
                      <span className="mm-mini">
                        {cdone}/{items.length}
                      </span>
                      <span className="mm-mbar">
                        <span className="mm-mfill" style={{ width: `${cpct}%`, background: catColor(i) }} />
                      </span>
                      <span className="mm-pct">{cpct}%</span>
                    </span>
                  </button>
                  {open && (
                    <div className="mm-leaves">
                      {items.map((t) => (
                        <label className="mm-leaf" key={t.id}>
                          <input type="checkbox" checked={t.completed} onChange={() => toggle(t)} />
                          <span className={`ws-check${t.completed ? ' done' : ''}`} />
                          <span className={`ws-text${t.completed ? ' done' : ''}`}>
                            {t.link ? (
                              <a href={t.link} target="_blank" rel="noreferrer">
                                {t.title}
                              </a>
                            ) : (
                              t.title
                            )}
                          </span>
                        </label>
                      ))}
                      {items.length === 0 && <p className="ws-empty">할 일 없음</p>}
                    </div>
                  )}
                </div>
              );
            })}
            {categories.length === 0 && <p className="muted" style={{ marginLeft: 24 }}>카테고리가 없습니다. 목록 뷰에서 추가하세요.</p>}
          </div>
        </div>
      ) : (
        <div className="ws-cols">
          {categories.map((cat) => {
            const items = todos.filter((t) => t.category_id === cat.id);
            const catDone = items.filter((t) => t.completed).length;
            return (
              <div className="ws-col" key={cat.id}>
                <div className="ws-col-head">
                  <span className="ws-col-name">{cat.name}</span>
                  <span className="ws-col-right">
                    <span className="ws-col-count">
                      {catDone}/{items.length}
                    </span>
                    <button className="ws-x" onClick={() => deleteCategory(cat)} title="카테고리 삭제">
                      ×
                    </button>
                  </span>
                </div>
                <div className="ws-list">
                  {items.map((t) => (
                    <div className="ws-item" key={t.id}>
                      <label className="ws-item-main">
                        <input type="checkbox" checked={t.completed} onChange={() => toggle(t)} />
                        <span className={`ws-check${t.completed ? ' done' : ''}`} />
                        <span className={`ws-text${t.completed ? ' done' : ''}`}>
                          {t.link ? (
                            <a href={t.link} target="_blank" rel="noreferrer">
                              {t.title}
                            </a>
                          ) : (
                            t.title
                          )}
                          {t.assignee ? <span className="ws-assignee">{t.assignee}</span> : null}
                        </span>
                      </label>
                      <button className="ws-x" onClick={() => deleteTodo(t)} title="할 일 삭제">
                        ×
                      </button>
                    </div>
                  ))}
                  <button className="ws-add" onClick={() => addTodo(cat.id)}>
                    + 할 일 추가
                  </button>
                </div>
              </div>
            );
          })}

          <div className="ws-col ws-col-ghost">
            <button className="ws-add-cat" onClick={addCategory}>
              + 카테고리 추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
