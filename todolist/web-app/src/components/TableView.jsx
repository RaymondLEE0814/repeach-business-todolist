import React, { useState } from 'react';
import { Trash2, Plus, ExternalLink, FolderPlus, Pencil } from 'lucide-react';
import { categoryColor } from '../lib/colors';

const normalizeUrl = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

// 링크 셀: URL이 있으면 열기 아이콘, 없으면 흐릿한 + 아이콘, 클릭 시 인라인 편집
const LinkCell = ({ value, onChange }) => {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        className="inline-input"
        style={{ fontSize: '0.8rem' }}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === 'Enter') setEditing(false); if (e.key === 'Escape') setEditing(false); }}
        placeholder="URL 붙여넣기"
      />
    );
  }
  if (!value) {
    return (
      <button className="btn-icon link-add" title="링크 추가" onClick={() => setEditing(true)}>
        <Plus size={15} />
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.1rem' }}>
      <a href={normalizeUrl(value)} target="_blank" rel="noreferrer" className="btn-icon" style={{ opacity: 1, color: 'var(--color-sky-blue)' }} title={value}>
        <ExternalLink size={16} />
      </a>
      <button className="btn-icon" style={{ padding: '0.3rem' }} title="링크 수정" onClick={() => setEditing(true)}>
        <Pencil size={13} />
      </button>
    </div>
  );
};

const TableView = ({ categories, todos, onUpdate, onDelete, onAdd, onAddCategory, onDeleteCategory }) => {
  const [filter, setFilter] = useState('ALL');

  const filteredTodos = filter === 'ALL' ? todos : todos.filter(t => t.categoryId === filter);

  const handleAddCategory = () => {
    const name = window.prompt('새 카테고리 이름을 입력하세요');
    if (name && name.trim() && onAddCategory) {
      const id = onAddCategory(name.trim());
      setFilter(id); // 새로 만든 카테고리로 필터 이동
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <button className="btn-primary btn-light" onClick={handleAddCategory}>
          <FolderPlus size={18} /> 카테고리 추가
        </button>
        <select
          className="inline-input"
          style={{ width: 'auto', border: '1px solid var(--border-color)' }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">전체 보기</option>
          {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      </div>

      {categories.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          아직 카테고리가 없습니다. 위 <strong>“카테고리 추가”</strong> 버튼으로 시작하세요.
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>상태</th>
                <th style={{ width: '170px' }}>카테고리</th>
                <th style={{ minWidth: '240px' }}>할 일 내용</th>
                <th style={{ width: '64px', textAlign: 'center' }}>링크</th>
                <th style={{ width: '110px' }}>담당자</th>
                <th style={{ width: '120px' }}>진행률</th>
                <th style={{ width: '24%' }}>비고 / 메모</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredTodos.map((todo) => (
                <tr key={todo.id}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      className="custom-checkbox"
                      checked={todo.completed}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const updates = { completed: checked };
                        if (checked) updates.progress = '100';
                        else if (todo.progress === '100') updates.progress = '0';
                        onUpdate(todo.id, updates);
                      }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="cat-dot" style={{ background: categoryColor(todo.categoryId) }} />
                      <select
                        className="inline-input badge"
                        value={todo.categoryId}
                        onChange={(e) => onUpdate(todo.id, { categoryId: e.target.value })}
                      >
                        {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      className={`inline-input ${todo.completed ? 'completed-text' : ''}`}
                      style={{ fontWeight: 500 }}
                      value={todo.title || ''}
                      onChange={(e) => onUpdate(todo.id, { title: e.target.value })}
                      placeholder="할 일을 입력하세요"
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <LinkCell value={todo.link} onChange={(v) => onUpdate(todo.id, { link: v })} />
                  </td>
                  <td>
                    <input
                      type="text"
                      className={`inline-input ${todo.completed ? 'completed-text' : ''}`}
                      style={{ textAlign: 'center' }}
                      value={todo.assignee || ''}
                      onChange={(e) => onUpdate(todo.id, { assignee: e.target.value })}
                      placeholder="담당자명"
                    />
                  </td>
                  <td>
                    <select
                      className={`inline-input ${todo.completed ? 'completed-text' : ''}`}
                      value={todo.progress || '0'}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdate(todo.id, { progress: val, completed: val === '100' });
                      }}
                    >
                      <option value="0">0%</option>
                      <option value="25">25% (준비)</option>
                      <option value="50">50% (진행)</option>
                      <option value="75">75% (검토)</option>
                      <option value="100">100% (완료)</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      className={`inline-input ${todo.completed ? 'completed-text' : ''}`}
                      value={todo.notes || ''}
                      onChange={(e) => onUpdate(todo.id, { notes: e.target.value })}
                      placeholder="클릭하여 내용을 추가하세요..."
                    />
                  </td>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <button className="btn-icon" onClick={() => onDelete(todo.id)} title="삭제">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {categories.length > 0 && (
        <div className="table-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn-primary" onClick={() => onAdd(filter === 'ALL' ? categories[0].id : filter)}>
            <Plus size={18} /> 새 업무 추가
          </button>
          {filter !== 'ALL' && onDeleteCategory && (
            <button
              className="btn-primary btn-light"
              style={{ color: 'var(--color-coral-red)' }}
              onClick={() => {
                if (window.confirm('이 카테고리와 포함된 할 일이 모두 삭제됩니다. 계속할까요?')) {
                  onDeleteCategory(filter);
                  setFilter('ALL');
                }
              }}
            >
              <Trash2 size={16} /> 현재 카테고리 삭제
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TableView;
