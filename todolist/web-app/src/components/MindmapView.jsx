import React, { useState } from 'react';
import { ChevronRight, ChevronDown, ExternalLink } from 'lucide-react';

const normalizeUrl = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const MindmapView = ({ categories, todos, onUpdate, rootName }) => {
  const [expandedCats, setExpandedCats] = useState({});

  const toggleCat = (id) => {
    setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="mindmap-container">
      <div className="mm-layout">
        
        <div className="mm-root">
          {rootName || '비즈니스 관리'}
        </div>

        <div className="mm-children">
          {categories.map(cat => {
            const catTodos = todos.filter(t => t.categoryId === cat.id);
            const total = catTodos.length;
            const completed = catTodos.filter(t => t.completed).length;
            const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
            const isExpanded = !!expandedCats[cat.id];

            return (
              <div key={cat.id} className="mm-node-container">
                <div 
                  className="mm-node" 
                  onClick={() => toggleCat(cat.id)} 
                  style={{ cursor: 'pointer', borderColor: isExpanded ? 'var(--text-main)' : 'var(--border-color)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '1rem', color: isExpanded ? 'var(--text-main)' : 'inherit' }}>
                      {cat.name}
                    </div>
                    {isExpanded ? <ChevronDown size={18} color="#6B7280" /> : <ChevronRight size={18} color="#6B7280" />}
                  </div>
                  <div className="mm-progress">
                    <span>{completed}/{total}</span>
                    <div className="mm-bar">
                      <div className="mm-fill" style={{ width: `${percent}%` }}></div>
                    </div>
                    <span>{percent}%</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mm-subtopics">
                    {catTodos.map(todo => (
                      <div key={todo.id} className={`mm-subnode ${todo.completed ? 'completed-text' : ''}`}>
                        <input 
                          type="checkbox" 
                          className="custom-checkbox"
                          checked={todo.completed}
                          style={{ margin: 0, marginTop: '2px' }}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const updates = { completed: checked };
                            if (checked) updates.progress = '100';
                            else if (todo.progress === '100') updates.progress = '0';
                            onUpdate(todo.id, updates);
                          }}
                        />
                        <span style={{ flex: 1, paddingLeft: '0.3rem' }}>
                          {todo.title}
                        </span>
                        {todo.link ? (
                          <a href={normalizeUrl(todo.link)} target="_blank" rel="noreferrer" title="링크 열기" style={{ color: 'var(--border-focus)', display: 'flex', alignItems: 'center' }}>
                            <ExternalLink size={14} />
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default MindmapView;
