import React, { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';

const TableView = ({ categories, todos, onUpdate, onDelete, onAdd }) => {
  const [filter, setFilter] = useState('ALL');

  const filteredTodos = filter === 'ALL' 
    ? todos 
    : todos.filter(t => t.categoryId === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
        <select 
          className="inline-input" 
          style={{ width: 'auto', border: '1px solid var(--border-color)' }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">전체 보기</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: '50px', textAlign: 'center' }}>상태</th>
              <th style={{ width: '180px' }}>카테고리</th>
              <th style={{ minWidth: '300px' }}>할 일 내용</th>
              <th style={{ width: '120px' }}>담당자</th>
              <th style={{ width: '120px' }}>진행률</th>
              <th style={{ width: '25%' }}>비고 / 메모</th>
              <th style={{ width: '60px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredTodos.map((todo) => {
              const cat = categories.find(c => c.id === todo.categoryId);
              return (
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
                    <select
                      className="inline-input badge"
                      value={todo.categoryId}
                      onChange={(e) => onUpdate(todo.id, { categoryId: e.target.value })}
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
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
                        onUpdate(todo.id, { 
                          progress: val, 
                          completed: val === '100' 
                        });
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
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="table-actions">
        <button className="btn-primary" onClick={() => onAdd(filter === 'ALL' ? categories[0].id : filter)}>
          <Plus size={18} /> 새 업무 추가
        </button>
      </div>
    </div>
  );
};

export default TableView;
