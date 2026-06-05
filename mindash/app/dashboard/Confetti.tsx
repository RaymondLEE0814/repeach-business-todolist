'use client';

import type { CSSProperties } from 'react';

export default function Confetti({ fireKey }: { fireKey: number }) {
  if (!fireKey) return null;
  const colors = ['#ff3e00', '#0090ff', '#00ca48', '#ffbb26', '#9f4fff', '#ff58ae'];
  return (
    <div className="confetti" key={fireKey} aria-hidden>
      {Array.from({ length: 30 }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / 30 + Math.random() * 0.5;
        const dist = 120 + Math.random() * 200;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist - 60;
        const rot = Math.random() * 720 - 360;
        const style = {
          background: colors[i % colors.length],
          animationDelay: `${Math.floor(Math.random() * 90)}ms`,
          ['--tx']: `${tx.toFixed(0)}px`,
          ['--ty']: `${ty.toFixed(0)}px`,
          ['--rot']: `${rot.toFixed(0)}deg`,
        } as CSSProperties;
        return <i key={i} style={style} />;
      })}
    </div>
  );
}
