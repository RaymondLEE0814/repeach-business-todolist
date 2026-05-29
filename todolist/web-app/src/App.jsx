import React, { useState } from 'react';
import { useTodoDB, PROJECTS } from './hooks/useTodoDB';
import TableView from './components/TableView';
import MindmapView from './components/MindmapView';
import { LayoutDashboard, Network, Save, ChevronDown, Check } from 'lucide-react';

function App() {
  const [activeProjectId, setActiveProjectId] = useState(PROJECTS[0].id);
  const { categories, todos, isLoaded, isSaving, updateTodo, deleteTodo, addTodo, saveToDB, hasUnsavedChanges, isSupabaseConfigured } = useTodoDB(activeProjectId);
  const [activeTab, setActiveTab] = useState('table'); // 'table' or 'mindmap'
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  const activeProjectName = PROJECTS.find(p => p.id === activeProjectId)?.name || '비즈니스 구축';

  const handleProjectSwitch = (id) => {
    if (hasUnsavedChanges) {
      if(!window.confirm("저장되지 않은 변경사항이 있습니다. 저장하지 않고 이동하시겠습니까?")) {
        return;
      }
    }
    setActiveProjectId(id);
    setIsProjectDropdownOpen(false);
  };

  if (!isLoaded) return <div style={{padding: '2rem'}}>데이터 로딩 중...</div>;

  return (
    <div className="app-container">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ position: 'relative' }}>
            <div 
              className="project-selector"
              onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
            >
              <h1>{activeProjectName}</h1>
              <ChevronDown 
                size={28} 
                strokeWidth={2.5}
                className={`chevron-icon ${isProjectDropdownOpen ? 'open' : ''}`} 
              />
            </div>
            
            {isProjectDropdownOpen && (
              <div className="dropdown-menu">
                {PROJECTS.map(p => {
                  const isActive = p.id === activeProjectId;
                  return (
                    <div 
                      key={p.id} 
                      className={`dropdown-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleProjectSwitch(p.id)}
                    >
                      <div className="item-name">
                        {p.name}
                      </div>
                      {isActive && <Check size={20} color="var(--accent)" strokeWidth={3} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p style={{ marginTop: '0.2rem' }}>모듈별 세부 진행 상황 및 투두리스트 관리 대시보드</p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
          <button
            className="btn-primary"
            disabled={isSaving}
            style={{
              backgroundColor: hasUnsavedChanges ? '#2563EB' : 'var(--text-main)',
              boxShadow: hasUnsavedChanges ? '0 4px 14px 0 rgba(37,99,235,0.39)' : 'none',
              opacity: isSaving ? 0.6 : 1,
            }}
            onClick={saveToDB}
          >
            <Save size={18} />
            {isSaving ? '저장 중...' : hasUnsavedChanges ? 'DB에 변경사항 저장' : 'DB 저장 완료됨'}
          </button>
          <span style={{
            fontSize: '0.75rem',
            color: isSupabaseConfigured ? '#16a34a' : '#d97706',
            fontWeight: 600,
          }}>
            {isSupabaseConfigured ? '● 클라우드 DB 연결됨 (Supabase)' : '● 로컬 저장 모드 (Supabase 미설정)'}
          </span>
        </div>
      </header>

      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'table' ? 'active' : ''}`}
          onClick={() => setActiveTab('table')}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <LayoutDashboard size={18} />
            칸반/테이블 뷰
          </div>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'mindmap' ? 'active' : ''}`}
          onClick={() => setActiveTab('mindmap')}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <Network size={18} />
            마인드맵 뷰
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
          />
        ) : (
          <MindmapView 
            categories={categories} 
            todos={todos} 
            onUpdate={updateTodo}
            rootName={activeProjectName}
          />
        )}
      </div>
    </div>
  );
}

export default App;
