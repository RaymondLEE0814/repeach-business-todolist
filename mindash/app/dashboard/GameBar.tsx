'use client';

import { levelInfo, countAchievementsUnlocked } from '@/lib/gamification';

export default function GameBar({ gXp, gDone }: { gXp: number; gDone: number }) {
  const gi = levelInfo(gXp);
  const unlocked = countAchievementsUnlocked(gDone);
  return (
    <div className="game-bar">
      <div className="game-level">
        <span className="game-icon">{gi.icon}</span>
        <div>
          <div className="game-title">
            Lv.{gi.level} <b>{gi.title}</b>
          </div>
          <div className="game-sub">
            {gXp} XP · 완료 {gDone}개 · {gi.hasNext ? `다음 레벨까지 ${gi.xpForNext} XP` : '최고 레벨 달성'}
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
}
