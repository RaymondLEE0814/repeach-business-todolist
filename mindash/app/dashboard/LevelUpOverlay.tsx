'use client';

import { useEffect } from 'react';

export type LevelUp = { level: number; title: string; icon: string };

export default function LevelUpOverlay({ data, onClose }: { data: LevelUp | null; onClose: () => void }) {
  useEffect(() => {
    if (!data) return;
    const id = setTimeout(onClose, 3200);
    return () => clearTimeout(id);
  }, [data, onClose]);

  if (!data) return null;
  return (
    <div className="levelup" onClick={onClose} role="dialog" aria-label="레벨 업">
      <div className="levelup-card" onClick={(e) => e.stopPropagation()}>
        <div className="levelup-burst" aria-hidden>
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} style={{ transform: `rotate(${(360 / 14) * i}deg) translateY(-86px)` }} />
          ))}
        </div>
        <div className="levelup-ring" aria-hidden />
        <div className="levelup-ring levelup-ring2" aria-hidden />
        <div className="levelup-icon">{data.icon}</div>
        <div className="levelup-label">LEVEL UP!</div>
        <div className="levelup-lv">Lv.{data.level}</div>
        <div className="levelup-title">{data.title}</div>
        <div className="levelup-hint">화면을 누르면 닫혀요</div>
      </div>
    </div>
  );
}
