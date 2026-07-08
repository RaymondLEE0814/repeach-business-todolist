'use client';

import { useState } from 'react';
import Workspace from './Workspace';
import TodayView from './TodayView';

type Project = { id: string; name: string };

export default function DashboardShell({ initialProjects, userId }: { initialProjects: Project[]; userId: string }) {
  const [mode, setMode] = useState<'workspace' | 'today'>('workspace');
  return (
    <>
      <div className="dash-modetabs">
        <button className={`dash-modebtn${mode === 'workspace' ? ' active' : ''}`} onClick={() => setMode('workspace')}>
          🗂 워크스페이스
        </button>
        <button className={`dash-modebtn${mode === 'today' ? ' active' : ''}`} onClick={() => setMode('today')}>
          ☀️ 오늘 · 이번 주
        </button>
      </div>
      {mode === 'workspace' ? (
        <Workspace initialProjects={initialProjects} userId={userId} />
      ) : (
        <TodayView projects={initialProjects} userId={userId} />
      )}
    </>
  );
}
