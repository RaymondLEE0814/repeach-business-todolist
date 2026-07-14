'use client';

import { useEffect, useRef, useState } from 'react';
import {
  levelInfo,
  countAchievementsUnlocked,
  COUNT_ACHIEVEMENTS,
  TIERS,
  LEVELS_PER_TIER,
  cumXpForLevel,
  titleFor,
  tierForLevel,
} from '@/lib/gamification';

export default function GameBar({ gXp, gDone }: { gXp: number; gDone: number }) {
  const gi = levelInfo(gXp);
  const unlocked = countAchievementsUnlocked(gDone);
  const [open, setOpen] = useState(false);

  const curTier = tierForLevel(gi.level);
  const isTop = curTier.tier === TIERS.length;
  // 현재 티어의 5레벨 (초월 무한 구간이면 현재 ±2 윈도우)
  const detailLevels =
    isTop && gi.level > curTier.startLevel + LEVELS_PER_TIER - 1
      ? [gi.level - 2, gi.level - 1, gi.level, gi.level + 1, gi.level + 2].filter((l) => l >= 1)
      : Array.from({ length: LEVELS_PER_TIER }, (_, i) => curTier.startLevel + i);
  const nextTier = TIERS.find((t) => t.tier === gi.tier + 1) ?? null;

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
    <>
      <div className={`game-bar${bump ? ' pulse' : ''}`}>
        <button className="game-level game-level-btn" onClick={() => setOpen(true)} title="레벨·업적 자세히 보기">
          <span className={`game-icon${bump ? ' pop' : ''}`}>{gi.icon}</span>
          <div>
            <div className="game-title">
              <span className="game-lv">Lv.{gi.level}</span> <b>{gi.title}</b> <span className="game-more">▸</span>
            </div>
            <div className="game-sub">
              <b>{gXp}</b> XP · 완료 {gDone}개 · {gi.hasNext ? `다음 레벨까지 ${gi.xpForNext} XP` : '최고 레벨 달성'}
            </div>
          </div>
          {bump && <span className="game-bump">+{bump} XP</span>}
        </button>
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

      {open && (
        <div className="lvl-modal" onClick={() => setOpen(false)}>
          <div className="lvl-card" onClick={(e) => e.stopPropagation()}>
            <div className="lvl-head">
              <span className="lvl-head-icon">{gi.icon}</span>
              <div style={{ flex: 1 }}>
                <div className="lvl-head-title">
                  Lv.{gi.level} {gi.title}
                </div>
                <div className="lvl-head-sub">
                  {gXp} XP · 완료 {gDone}개 · {gi.hasNext ? `다음 레벨까지 ${gi.xpForNext} XP` : '최고 레벨'}
                </div>
              </div>
              <button className="lvl-close" onClick={() => setOpen(false)} aria-label="닫기">
                ×
              </button>
            </div>
            <div className="lvl-xpbar">
              <div className="lvl-xpfill" style={{ width: `${gi.pct}%` }} />
            </div>

            <h4 className="lvl-section">등급 (전체 10등급 · 각 5단계)</h4>
            <div className="tier-strip">
              {TIERS.map((t) => {
                const st = gi.tier > t.tier ? 'passed' : gi.tier === t.tier ? 'current' : 'locked';
                return (
                  <div className={`tier-chip ${st}`} key={t.tier} title={`${t.name} · Lv.${t.startLevel}~`}>
                    <span className="tier-chip-icon">{t.icon}</span>
                    <span className="tier-chip-name">{t.name}</span>
                  </div>
                );
              })}
            </div>

            <h4 className="lvl-section">{curTier.name} 등급 단계</h4>
            <div className="lvl-ladder">
              {detailLevels.map((l) => {
                const status = gi.level > l ? 'done' : gi.level === l ? 'current' : 'locked';
                const { title } = titleFor(l);
                return (
                  <div className={`lvl-row ${status}`} key={l}>
                    <span className="lvl-row-icon">{tierForLevel(l).icon}</span>
                    <span className="lvl-row-name">
                      Lv.{l} {title}
                    </span>
                    <span className="lvl-row-xp">{cumXpForLevel(l)} XP~</span>
                    <span className="lvl-row-badge">
                      {status === 'done' ? '달성 ✓' : status === 'current' ? '현재' : '잠김'}
                    </span>
                  </div>
                );
              })}
            </div>
            {nextTier && (
              <p className="lvl-milestone">
                다음 등급 <b>{nextTier.icon} {nextTier.name}</b>까지 {Math.max(0, cumXpForLevel(nextTier.startLevel) - gi.xp)} XP
              </p>
            )}

            <h4 className="lvl-section">업적</h4>
            <div className="lvl-achs">
              {COUNT_ACHIEVEMENTS.map((a) => {
                const got = gDone >= a.threshold;
                return (
                  <div className={`lvl-ach ${got ? 'got' : 'locked'}`} key={a.id}>
                    <span className="lvl-ach-icon">{got ? a.icon : '🔒'}</span>
                    <div className="lvl-ach-info">
                      <div className="lvl-ach-name">{a.name}</div>
                      <div className="lvl-ach-desc">
                        {a.desc} · {got ? '달성 ✓' : `${gDone}/${a.threshold}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="lvl-note">
              XP 규칙: 할 일 완료 = 난이도만큼(쉬움 +5 · 보통 +10 · 어려움 +20 · 미루던 일 +25), 서브 퀘스트 +2. 내가 완료한 것만
              집계됩니다.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
