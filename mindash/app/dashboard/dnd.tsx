'use client';

import { type ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

// 드래그 핸들(grip)만 드래그 시작 → 체크박스/링크/버튼 클릭과 충돌 없음
export function DraggableTodo({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: (handle: Record<string, unknown>) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled });
  return (
    <div ref={setNodeRef} className={isDragging ? 'ws-dragging' : undefined}>
      {children(disabled ? {} : { ...attributes, ...listeners })}
    </div>
  );
}

// 카테고리 컬럼 = 드롭 대상 (id: `cat:<categoryId>`)
export function DroppableColumn({
  id,
  className = 'ws-list',
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className}${isOver ? ' ws-drop-over' : ''}`}>
      {children}
    </div>
  );
}
