import React, { useState, useEffect } from 'react';
import { useTodoDB, useProjects } from './hooks/useTodoDB';
import TableView from './components/TableView';
import MindmapView from './components/MindmapView';
import { LayoutDashboard, Network, Save, ChevronDown, Check, Plus } from 'lucide-react';

function App() {
  const { projects, projectsLoaded, createProject } = useProjects();
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeTab, setActiveTab] = useState('table'); // 'table' | 'mindmap'
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // 프로젝트 목록 로드되면 첫 프로젝트 자동 선택
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
    return <div style={{ padding: '2rem' }}>데이터 로딩 중...</div>;
  }

  return (
    <div className="app-container">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ position: 'relative' }}>
            <div className="project-selector" onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}>
              <h1>{activeProjectName}</h1>
              <ChevronDown size={28} strokeWidth={2.5} className={`chevron-icon ${isProjectDropdownOpen ? 'open' : ''}`} />
            </div>

            {isProjectDropdownOpen && (
              <div className="dropdown-menu">
                {projects.map(p => {
                  const isActive = p.id === activeProjectId;
                  return (
                    <div key={p.id} className={`dropdown-item ${isActive ? 'active' : ''}`} onClick={() => handleProjectSwitch(p.id)}>
                      <div className="item-name">{p.name}</div>
                      {isActive && <Check size={20} color="var(--accent)" strokeWidth={3} />}
                    </div>
                  );
                })}

                {/* 새 프로젝트 추가 */}
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
                    <button className="btn-primary" style={{ padding: '0.4rem 0.75rem' }} onClick={handleCreateProject}>추가</button>
                  </div>
                ) : (
                  <div
                    className="dropdown-item"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={(e) => { e.stopPropagation(); setIsCreating(true); }}
                  >
                    <div className="item-name" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Plus size={18} /> 새 프로젝트 추가
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <p style={{ marginTop: '0.2rem' }}>모듈별 세부 진행 상황 및 투두리스트 관리 대시보드</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
          <button
            className="btn-primary"
            disabled={isSaving}
            style={hasUnsavedChanges
              ? { opacity: isSaving ? 0.6 : 1 }
              : { backgroundColor: 'var(--color-light-pill)', color: 'var(--color-graphite)', opacity: isSaving ? 0.6 : 1 }}
            onClick={saveToDB}
          >
            <Save size={18} />
            {isSaving ? '저장 중...' : hasUnsavedChanges ? 'DB에 변경사항 저장' : 'DB 저장 완료됨'}
          </button>
          <span style={{ fontSize: '0.75rem', color: isSupabaseConfigured ? 'var(--color-meadow-green)' : 'var(--color-deep-amber)', fontWeight: 600, letterSpacing: '-0.01em' }}>
            {isSupabaseConfigured ? '● 클라우드 DB 연결됨 (Supabase)' : '● 로컬 저장 모드 (Supabase 미설정)'}
          </span>
        </div>
      </header>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'table' ? 'active' : ''}`} onClick={() => setActiveTab('table')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LayoutDashboard size={18} /> 칸반/테이블 뷰
          </div>
        </button>
        <button className={`tab-btn ${activeTab === 'mindmap' ? 'active' : ''}`} onClick={() => setActiveTab('mindmap')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Network size={18} /> 마인드맵 뷰
          </div>
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
