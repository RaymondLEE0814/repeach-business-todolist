'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  levelInfo,
  countAchievementsUnlocked,
  newlyUnlocked,
} from '@/lib/gamification';

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
  notes: string | null;
};
type Toast = { key: number; icon: string; title: string; sub?: string };

const uid = () => globalThis.crypto.randomUUID();
const normalizeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

// 카테고리별 브랜치 색상 (Family 팔레트)
const CAT_COLORS = ['#ff3e00', '#0090ff', '#00ca48', '#ffbb26', '#9f4fff', '#ff58ae', '#0086fc', '#00c978'];
const catColor = (i: number) => CAT_COLORS[i % CAT_COLORS.length];

// ---------- 컨페티 ----------
function Confetti({ fireKey }: { fireKey: number }) {
  if (!fireKey) return null;
  const colors = ['#ff3e00', '#0090ff', '#00ca48', '#ffbb26', '#9f4fff', '#ff58ae'];
  return (
    <div className="confetti" key={fireKey} aria-hidden>
      {Array.from({ length: 30 }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / 30 + Math.random() * 0.5;
        const dist = 120 + Math.random() * 200;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist - 60;
        const rot = Math.random() * 720 - 360;
        const style = {
          background: colors[i % colors.length],
          animationDelay: `${Math.floor(Math.random() * 90)}ms`,
          ['--tx']: `${tx.toFixed(0)}px`,
          ['--ty']: `${ty.toFixed(0)}px`,
          ['--rot']: `${rot.toFixed(0)}deg`,
        } as CSSProperties;
        return <i key={i} style={style} />;
      })}
    </div>
  );
}

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

  // 인라인 입력 폼 상태
  const [addingCat, setAddingCat] = useState<string | null>(null); // 할 일 추가 폼이 열린 카테고리
  const [tTitle, setTTitle] = useState('');
  const [tLink, setTLink] = useState('');
  const [tNotes, setTNotes] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [catName, setCatName] = useState('');
  const [addingProject, setAddingProject] = useState(false);
  const [projName, setProjName] = useState('');

  // 편집 폼 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eLink, setELink] = useState('');
  const [eNotes, setENotes] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [eCatName, setECatName] = useState('');

  // 게임화 상태
  const [gDone, setGDone] = useState(0);
  const [confettiKey, setConfettiKey] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('todos')
        .select('*', { count: 'exact', head: true })
        .eq('completed', true);
      setGDone(count ?? 0);
    })();
  }, [supabase]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(id);
  }, [toast]);

  const load = useCallback(
    async (projectId: string) => {
      setLoading(true);
      const [{ data: cats }, { data: tds }] = await Promise.all([
        supabase.from('categories').select('id,name').eq('project_id', projectId).order('position'),
        supabase
          .from('todos')
          .select('id,category_id,title,completed,assignee,progress,link,notes')
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

  // ---------- 프로젝트 ----------
  const submitProject = async () => {
    const name = projName.trim();
    if (!name) return;
    const id = uid();
    const { error } = await supabase.from('projects').insert({ id, name, owner_id: userId });
    if (error) return alert('프로젝트 생성 실패: ' + error.message);
    setProjects((p) => [...p, { id, name }]);
    setActiveId(id);
    setAddingProject(false);
    setProjName('');
  };

  const deleteProject = async (project: Project) => {
    if (!window.confirm(`'${project.name}' 프로젝트를 삭제할까요? 안의 할 일도 모두 삭제됩니다.`)) return;
    await supabase.from('todos').delete().eq('project_id', project.id);
    await supabase.from('categories').delete().eq('project_id', project.id);
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (error) return alert('삭제 실패: ' + error.message);
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== project.id);
      if (activeId === project.id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  // ---------- 카테고리 ----------
  const submitCategory = async () => {
    if (!activeId) return;
    const name = catName.trim();
    if (!name) return;
    const id = uid();
    const { error } = await supabase
      .from('categories')
      .insert({ project_id: activeId, id, name, position: categories.length });
    if (error) return alert('카테고리 생성 실패: ' + error.message);
    setCategories((c) => [...c, { id, name }]);
    setAddingCategory(false);
    setCatName('');
  };

  const deleteCategory = async (cat: Category) => {
    if (!activeId) return;
    if (!window.confirm(`'${cat.name}' 카테고리와 그 안의 할 일을 삭제할까요?`)) return;
    await supabase.from('todos').delete().eq('project_id', activeId).eq('category_id', cat.id);
    const { error } = await supabase.from('categories').delete().eq('project_id', activeId).eq('id', cat.id);
    if (error) return alert('삭제 실패: ' + error.message);
    setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    setTodos((prev) => prev.filter((t) => t.category_id !== cat.id));
  };

  // ---------- 할 일 ----------
  const openAddTodo = (categoryId: string) => {
    setAddingCat(categoryId);
    setTTitle('');
    setTLink('');
    setTNotes('');
  };

  const submitTodo = async () => {
    if (!activeId || !addingCat) return;
    const title = tTitle.trim();
    if (!title) return;
    const id = uid();
    const link = tLink.trim();
    const notes = tNotes.trim();
    const { error } = await supabase.from('todos').insert({
      project_id: activeId,
      id,
      category_id: addingCat,
      title,
      completed: false,
      notes,
      assignee: '',
      progress: '0',
      link,
      position: todos.length,
    });
    if (error) return alert('할 일 생성 실패: ' + error.message);
    setTodos((t) => [
      ...t,
      { id, category_id: addingCat, title, completed: false, assignee: '', progress: '0', link, notes },
    ]);
    setAddingCat(null);
    setTTitle('');
    setTLink('');
    setTNotes('');
  };

  // 할 일 편집
  const openEdit = (t: Todo) => {
    setEditingId(t.id);
    setETitle(t.title);
    setELink(t.link ?? '');
    setENotes(t.notes ?? '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const title = eTitle.trim();
    if (!title) return;
    const link = eLink.trim();
    const notes = eNotes.trim();
    const cur = todos.find((t) => t.id === editingId);
    if (!cur) {
      setEditingId(null);
      return;
    }
    setTodos((prev) => prev.map((t) => (t.id === editingId ? { ...t, title, link, notes } : t)));
    const { error } = await supabase
      .from('todos')
      .update({ title, link, notes })
      .eq('id', editingId)
      .eq('category_id', cur.category_id);
    if (error) {
      alert('수정 실패: ' + error.message);
      if (activeId) load(activeId);
    }
    setEditingId(null);
  };

  // 카테고리 이름 변경
  const openEditCat = (c: Category) => {
    setEditingCatId(c.id);
    setECatName(c.name);
  };

  const saveEditCat = async () => {
    if (!editingCatId || !activeId) return;
    const name = eCatName.trim();
    if (!name) {
      setEditingCatId(null);
      return;
    }
    setCategories((prev) => prev.map((c) => (c.id === editingCatId ? { ...c, name } : c)));
    const { error } = await supabase
      .from('categories')
      .update({ name })
      .eq('project_id', activeId)
      .eq('id', editingCatId);
    if (error) alert('수정 실패: ' + error.message);
    setEditingCatId(null);
  };

  const deleteTodo = async (todo: Todo) => {
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    if (todo.completed) setGDone((n) => Math.max(0, n - 1));
    const { error } = await supabase.from('todos').delete().eq('id', todo.id).eq('category_id', todo.category_id);
    if (error) {
      alert('삭제 실패: ' + error.message);
      if (activeId) load(activeId);
    }
  };

  const toggle = async (todo: Todo) => {
    const next = !todo.completed;
    const updated = todos.map((t) => (t.id === todo.id ? { ...t, completed: next } : t));
    const prevTodos = todos;
    const prevGDone = gDone;
    const newGDone = Math.max(0, gDone + (next ? 1 : -1));
    setTodos(updated);
    setGDone(newGDone);

    if (next) celebrate(prevGDone, newGDone, updated, todo);

    const { error } = await supabase
      .from('todos')
      .update({ completed: next })
      .eq('id', todo.id)
      .eq('category_id', todo.category_id);
    if (error) {
      setTodos(prevTodos);
      setGDone(prevGDone);
      alert('저장에 실패했습니다: ' + error.message);
    }
  };

  const celebrate = (oldDone: number, newDone: number, updated: Todo[], todo: Todo) => {
    setConfettiKey((k) => k + 1);
    const before = levelInfo(oldDone);
    const after = levelInfo(newDone);
    let t: Toast | null = null;

    if (after.level > before.level) {
      t = { key: newDone, icon: after.icon, title: `레벨 업! Lv.${after.level} ${after.title}`, sub: '새 칭호를 획득했어요 🎉' };
    } else {
      const ach = newlyUnlocked(oldDone, newDone);
      if (ach) {
        t = { key: newDone, icon: ach.icon, title: `업적 달성: ${ach.name}`, sub: ach.desc };
      } else {
        const projAll = updated.length > 0 && updated.every((x) => x.completed);
        const catItems = updated.filter((x) => x.category_id === todo.category_id);
        const catAll = catItems.length > 0 && catItems.every((x) => x.completed);
        if (projAll) {
          t = { key: Math.random(), icon: '🏁', title: '프로젝트 완주!', sub: `${activeProject?.name ?? ''} 100% 달성` };
        } else if (catAll) {
          const c = categories.find((c) => c.id === todo.category_id);
          t = { key: Math.random(), icon: '✅', title: '구역 정복!', sub: `'${c?.name ?? ''}' 카테고리 올클리어` };
        }
      }
    }
    if (t) setToast(t);
  };

  const total = todos.length;
  const done = todos.filter((t) => t.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const activeProject = projects.find((p) => p.id === activeId) ?? null;

  const gi = levelInfo(gDone);
  const unlocked = countAchievementsUnlocked(gDone);

  // 할 일 추가 인라인 폼
  const addTodoForm = (categoryId: string) =>
    addingCat === categoryId ? (
      <div className="ws-addform">
        <input
          className="ws-input"
          autoFocus
          placeholder="할 일 내용"
          value={tTitle}
          onChange={(e) => setTTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitTodo();
            if (e.key === 'Escape') setAddingCat(null);
          }}
        />
        <input
          className="ws-input"
          placeholder="🔗 링크 (선택) — 예: example.com"
          value={tLink}
          onChange={(e) => setTLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitTodo();
            if (e.key === 'Escape') setAddingCat(null);
          }}
        />
        <textarea
          className="ws-input ws-ta"
          placeholder="📝 비고 (선택) — 메모를 남겨보세요"
          value={tNotes}
          onChange={(e) => setTNotes(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setAddingCat(null);
          }}
        />
        <div className="ws-addform-actions">
          <button className="btn btn-dark btn-sm" onClick={submitTodo}>
            추가
          </button>
          <button className="btn btn-light btn-sm" onClick={() => setAddingCat(null)}>
            취소
          </button>
        </div>
      </div>
    ) : (
      <button className="ws-add" onClick={() => openAddTodo(categoryId)}>
        + 할 일 추가
      </button>
    );

  // 할 일 편집 인라인 폼
  const editTodoForm = () => (
    <div className="ws-addform">
      <input
        className="ws-input"
        autoFocus
        placeholder="할 일 내용"
        value={eTitle}
        onChange={(e) => setETitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') saveEdit();
          if (e.key === 'Escape') setEditingId(null);
        }}
      />
      <input
        className="ws-input"
        placeholder="🔗 링크 (선택) — 예: example.com"
        value={eLink}
        onChange={(e) => setELink(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') saveEdit();
          if (e.key === 'Escape') setEditingId(null);
        }}
      />
      <textarea
        className="ws-input ws-ta"
        placeholder="📝 비고 (선택)"
        value={eNotes}
        onChange={(e) => setENotes(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditingId(null);
        }}
      />
      <div className="ws-addform-actions">
        <button className="btn btn-dark btn-sm" onClick={saveEdit}>
          저장
        </button>
        <button className="btn btn-light btn-sm" onClick={() => setEditingId(null)}>
          취소
        </button>
      </div>
    </div>
  );

  // ---------- 게임 바 ----------
  const gameBar = (
    <div className="game-bar">
      <div className="game-level">
        <span className="game-icon">{gi.icon}</span>
        <div>
          <div className="game-title">
            Lv.{gi.level} <b>{gi.title}</b>
          </div>
          <div className="game-sub">
            전체 완료 {gDone}개 · {gi.hasNext ? `다음 레벨까지 ${gi.xpForNext} XP` : '최고 레벨 달성'}
          </div>
        </div>
      </div>
      <div className="game-xp">
        <div className="game-xpbar">
          <div className="game-xpfill" style={{ width: `${gi.pct}%` }} />
        </div>
      </div>
      <div className="game-badges">
        {unlocked.length > 0 ? (
          unlocked.map((a) => (
            <span className="game-badge" key={a.id} title={`${a.name} — ${a.desc}`}>
              {a.icon}
            </span>
          ))
        ) : (
          <span className="game-badge-empty">할 일을 완료하면 업적이 열려요</span>
        )}
      </div>
    </div>
  );

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

      {gameBar}

      {projects.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center' }}>
          <h2 className="heading">아직 프로젝트가 없습니다</h2>
          <p className="body" style={{ margin: '10px 0 22px' }}>
            첫 프로젝트를 만들어 나만의 업무 공간을 시작하세요. 할 일을 완료할 때마다 XP와 칭호가 쌓입니다!
          </p>
          <div className="ws-addproj" style={{ justifyContent: 'center' }}>
            <input
              className="ws-input"
              placeholder="첫 프로젝트 이름"
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitProject();
              }}
            />
            <button className="btn btn-dark btn-sm" onClick={submitProject}>
              + 만들기
            </button>
          </div>
        </div>
      ) : (
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
            {addingProject ? (
              <span className="ws-addproj">
                <input
                  className="ws-input"
                  autoFocus
                  placeholder="프로젝트 이름"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitProject();
                    if (e.key === 'Escape') setAddingProject(false);
                  }}
                />
                <button className="btn btn-dark btn-sm" onClick={submitProject}>
                  추가
                </button>
                <button className="btn btn-light btn-sm" onClick={() => setAddingProject(false)}>
                  취소
                </button>
              </span>
            ) : (
              <button
                className="ws-tab ws-tab-add"
                onClick={() => {
                  setAddingProject(true);
                  setProjName('');
                }}
              >
                + 프로젝트
              </button>
            )}
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

          {/* 뷰 전환 */}
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
                              <span className="ws-text-wrap">
                                <span className={`ws-text${t.completed ? ' done' : ''}`}>
                                  {t.link ? (
                                    <a href={normalizeUrl(t.link)} target="_blank" rel="noreferrer">
                                      {t.title}
                                    </a>
                                  ) : (
                                    t.title
                                  )}
                                </span>
                                {t.notes ? <span className="ws-note">{t.notes}</span> : null}
                              </span>
                            </label>
                          ))}
                          {items.length === 0 && <p className="ws-empty">할 일 없음</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
                {categories.length === 0 && (
                  <p className="muted" style={{ marginLeft: 24 }}>
                    카테고리가 없습니다. 목록 뷰에서 추가하세요.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* ---------- 목록 뷰 ---------- */
            <div className="ws-cols">
              {categories.map((cat) => {
                const items = todos.filter((t) => t.category_id === cat.id);
                const catDone = items.filter((t) => t.completed).length;
                return (
                  <div className="ws-col" key={cat.id}>
                    <div className="ws-col-head">
                      {editingCatId === cat.id ? (
                        <input
                          className="ws-input"
                          autoFocus
                          value={eCatName}
                          onChange={(e) => setECatName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditCat();
                            if (e.key === 'Escape') setEditingCatId(null);
                          }}
                        />
                      ) : (
                        <span className="ws-col-name" onDoubleClick={() => openEditCat(cat)} title="더블클릭하여 이름 변경">
                          {cat.name}
                        </span>
                      )}
                      <span className="ws-col-right">
                        <span className="ws-col-count">
                          {catDone}/{items.length}
                        </span>
                        <button className="ws-edit" onClick={() => openEditCat(cat)} title="이름 변경">
                          ✎
                        </button>
                        <button className="ws-x" onClick={() => deleteCategory(cat)} title="카테고리 삭제">
                          ×
                        </button>
                      </span>
                    </div>
                    <div className="ws-list">
                      {items.map((t) =>
                        editingId === t.id ? (
                          <div key={t.id}>{editTodoForm()}</div>
                        ) : (
                          <div className="ws-item" key={t.id}>
                            <label className="ws-item-main">
                              <input type="checkbox" checked={t.completed} onChange={() => toggle(t)} />
                              <span className={`ws-check${t.completed ? ' done' : ''}`} />
                              <span className="ws-text-wrap">
                                <span className={`ws-text${t.completed ? ' done' : ''}`}>
                                  {t.link ? (
                                    <a href={normalizeUrl(t.link)} target="_blank" rel="noreferrer">
                                      {t.title}
                                    </a>
                                  ) : (
                                    t.title
                                  )}
                                  {t.assignee ? <span className="ws-assignee">{t.assignee}</span> : null}
                                </span>
                                {t.link ? <span className="ws-link">🔗 {t.link}</span> : null}
                                {t.notes ? <span className="ws-note">{t.notes}</span> : null}
                              </span>
                            </label>
                            <span className="ws-item-actions">
                              <button className="ws-edit" onClick={() => openEdit(t)} title="편집">
                                ✎
                              </button>
                              <button className="ws-x" onClick={() => deleteTodo(t)} title="할 일 삭제">
                                ×
                              </button>
                            </span>
                          </div>
                        )
                      )}
                      {addTodoForm(cat.id)}
                    </div>
                  </div>
                );
              })}

              <div className="ws-col ws-col-ghost">
                {addingCategory ? (
                  <div className="ws-addform" style={{ width: '100%' }}>
                    <input
                      className="ws-input"
                      autoFocus
                      placeholder="카테고리 이름"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitCategory();
                        if (e.key === 'Escape') setAddingCategory(false);
                      }}
                    />
                    <div className="ws-addform-actions">
                      <button className="btn btn-dark btn-sm" onClick={submitCategory}>
                        추가
                      </button>
                      <button className="btn btn-light btn-sm" onClick={() => setAddingCategory(false)}>
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="ws-add-cat"
                    onClick={() => {
                      setAddingCategory(true);
                      setCatName('');
                    }}
                  >
                    + 카테고리 추가
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
