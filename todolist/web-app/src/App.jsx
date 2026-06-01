import React, { useState, useEffect } from 'react';
import { useTodoDB, useProjects } from './hooks/useTodoDB';
import TableView from './components/TableView';
import MindmapView from './components/MindmapView';
import { BRAND_COLORS } from './lib/colors';
import { LayoutDashboard, Network, Save, ChevronDown, Check, Plus } from 'lucide-react';

const BrandDots = () => (
  <div style={{ display: 'flex', gap: '7px', marginBottom: '0.9rem' }}>
    {BRAND_COLORS.slice(0, 5).map((c, i) => (
      <span key={i} style={{ width: 13, height: 13, borderRadius: '50%', background: c, display: 'inline-block' }} />
    ))}
  </div>
);

function App() {
  const { projects, projectsLoaded, createProject } = useProjects();
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeTab, setActiveTab] = useState('table');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    if (projectsLoaded && !activeProjectId && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    }
  }, [projectsLoaded, projects, activeProjectId]);

  const {
    categories, todos, isLoaded, isSaving,
    updateTodo, deleteTodo, addTodo, addCategory, deleteCategory, saveToDB,
    hasUnsavedChanges, isSupabaseConfigured,
  } = useTodoDB(activeProjectId);

  const activeProjectName = projects.find(p => p.id === activeProjectId)?.name || '프로젝트';

  const total = todos.length;
  const done = todos.filter(t => t.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const handleProjectSwitch = (id) => {
    if (hasUnsavedChanges && !window.confirm("저장되지 않은 변경사항이 있습니다. 저장하지 않고 이동하시겠습니까?")) return;
    setActiveProjectId(id);
    setIsProjectDropdownOpen(false);
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    const id = await createProject(name);
    setNewProjectName('');
    setIsCreating(false);
    setIsProjectDropdownOpen(false);
    if (id) setActiveProjectId(id);
  };

  if (!projectsLoaded || (activeProjectId && !isLoaded)) {
    return <div className="loading-screen">데이터 로딩 중...</div>;
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-top">
          <div>
            <BrandDots />
            <div style={{ position: 'relative' }}>
              <div className="project-selector" onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}>
                <h1>{activeProjectName}</h1>
                <ChevronDown size={30} strokeWidth={2.5} className={`chevron-icon ${isProjectDropdownOpen ? 'open' : ''}`} />
              </div>

              {isProjectDropdownOpen && (
                <div className="dropdown-menu">
                  {projects.map(p => {
                    const isActive = p.id === activeProjectId;
                    return (
                      <div key={p.id} className={`dropdown-item ${isActive ? 'active' : ''}`} onClick={() => handleProjectSwitch(p.id)}>
                        <div className="item-name">{p.name}</div>
                        {isActive && <Check size={20} color="var(--color-ember-orange)" strokeWidth={3} />}
                      </div>
                    );
                  })}

                  {isCreating ? (
                    <div className="dropdown-item" style={{ cursor: 'default', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        className="inline-input"
                        style={{ border: '1px solid var(--border-color)' }}
                        placeholder="새 프로젝트 이름"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); if (e.key === 'Escape') { setIsCreating(false); setNewProjectName(''); } }}
                      />
                      <button className="btn-primary" style={{ padding: '0.45rem 0.9rem' }} onClick={handleCreateProject}>추가</button>
                    </div>
                  ) : (
                    <div className="dropdown-item" style={{ color: 'var(--color-ash)' }} onClick={(e) => { e.stopPropagation(); setIsCreating(true); }}>
                      <div className="item-name" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={18} /> 새 프로젝트 추가
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="header-actions">
            <button
              className={`btn-primary ${hasUnsavedChanges ? '' : 'btn-light'}`}
              disabled={isSaving}
              style={{ opacity: isSaving ? 0.6 : 1 }}
              onClick={saveToDB}
            >
              <Save size={18} />
              {isSaving ? '저장 중...' : hasUnsavedChanges ? 'DB에 변경사항 저장' : 'DB 저장 완료됨'}
            </button>
            <span className="db-status" style={{ color: isSupabaseConfigured ? 'var(--color-meadow-green)' : 'var(--color-deep-amber)' }}>
              {isSupabaseConfigured ? '● 클라우드 DB 연결됨' : '● 로컬 저장 모드'}
            </span>
          </div>
        </div>

        {/* 진행 현황 스탯 */}
        <div className="stats-row">
          <div className="stat-chip">
            <span className="stat-num">{total}</span>
            <span className="stat-label">전체 할 일</span>
          </div>
          <div className="stat-chip">
            <span className="stat-num" style={{ color: 'var(--color-meadow-green)' }}>{done}</span>
            <span className="stat-label">완료</span>
          </div>
          <div className="stat-progress">
            <div className="stat-progress-head">
              <span className="stat-label">전체 진행률</span>
              <span className="stat-pct">{pct}%</span>
            </div>
            <div className="stat-bar"><div className="stat-bar-fill" style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
      </header>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'table' ? 'active' : ''}`} onClick={() => setActiveTab('table')}>
          <LayoutDashboard size={17} /> 칸반/테이블 뷰
        </button>
        <button className={`tab-btn ${activeTab === 'mindmap' ? 'active' : ''}`} onClick={() => setActiveTab('mindmap')}>
          <Network size={17} /> 마인드맵 뷰
        </button>
      </div>

      <div className="surface">
        {activeTab === 'table' ? (
          <TableView
            categories={categories}
            todos={todos}
            onUpdate={updateTodo}
            onDelete={deleteTodo}
            onAdd={addTodo}
            onAddCategory={addCategory}
            onDeleteCategory={deleteCategory}
          />
        ) : (
          <MindmapView categories={categories} todos={todos} onUpdate={updateTodo} rootName={activeProjectName} />
        )}
      </div>
    </div>
  );
}

export default App;
