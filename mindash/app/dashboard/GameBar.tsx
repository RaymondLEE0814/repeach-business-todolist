'use client';

import { useEffect, useRef, useState } from 'react';
import { levelInfo, countAchievementsUnlocked } from '@/lib/gamification';

export default function GameBar({ gXp, gDone }: { gXp: number; gDone: number }) {
  const gi = levelInfo(gXp);
  const unlocked = countAchievementsUnlocked(gDone);

  // XP 증가 시 "+N XP" 팝업 + 펄스
  const prev = useRef(gXp);
  const [bump, setBump] = useState<number | null>(null);
  useEffect(() => {
    const delta = gXp - prev.current;
    prev.current = gXp;
    if (delta > 0) {
      setBump(delta);
      const id = setTimeout(() => setBump(null), 1100);
      return () => clearTimeout(id);
    }
  }, [gXp]);

  return (
    <div className={`game-bar${bump ? ' pulse' : ''}`}>
      <div className="game-level">
        <span className={`game-icon${bump ? ' pop' : ''}`}>{gi.icon}</span>
        <div>
          <div className="game-title">
            <span className="game-lv">Lv.{gi.level}</span> <b>{gi.title}</b>
          </div>
          <div className="game-sub">
            <b>{gXp}</b> XP · 완료 {gDone}개 · {gi.hasNext ? `다음 레벨까지 ${gi.xpForNext} XP` : '최고 레벨 달성'}
          </div>
        </div>
        {bump && <span className="game-bump">+{bump} XP</span>}
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
}
