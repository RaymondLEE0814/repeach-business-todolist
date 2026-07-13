'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Workspace from './Workspace';
import TodayView from './TodayView';
import TeamPanel from './TeamPanel';
import { setChatContext } from './chatContext';

type Project = { id: string; name: string; team_id: string | null };
type Team = { id: string; name: string };
type Membership = { team_id: string; role: string };

const roleLabel = (r: string | null) => (r === 'leader' ? '팀장' : r === 'admin' ? '관리자' : '팀원');

export default function DashboardShell({
  initialProjects,
  initialTeams,
  memberships,
  userId,
  userEmail,
}: {
  initialProjects: Project[];
  initialTeams: Team[];
  memberships: Membership[];
  userId: string;
  userEmail: string;
}) {
  const supabase = createClient();
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [roleMap, setRoleMap] = useState<Record<string, string>>(() =>
    Object.fromEntries(memberships.map((m) => [m.team_id, m.role]))
  );
  const [context, setContext] = useState<string>('personal'); // 'personal' | teamId
  const [mode, setMode] = useState<'workspace' | 'today'>('workspace');
  const [showPanel, setShowPanel] = useState(false);
  const [addingTeam, setAddingTeam] = useState(false);
  const [teamName, setTeamName] = useState('');

  const teamId = context === 'personal' ? null : context;
  const myRole = teamId ? roleMap[teamId] ?? 'member' : null;
  const canManage = context === 'personal' ? true : myRole === 'leader' || myRole === 'admin';

  const visibleProjects = useMemo(
    () =>
      context === 'personal'
        ? initialProjects.filter((p) => !p.team_id)
        : initialProjects.filter((p) => p.team_id === context),
    [initialProjects, context]
  );

  const currentTeam = teams.find((t) => t.id === teamId) ?? null;

  // 챗봇이 읽을 현재 컨텍스트 동기화
  useEffect(() => {
    setChatContext({ teamId, teamName: currentTeam?.name ?? null });
    return () => setChatContext({ teamId: null, teamName: null });
  }, [teamId, currentTeam?.name]);

  const createTeam = async () => {
    const name = teamName.trim();
    if (!name) return;
    const { data, error } = await supabase.rpc('create_team', { p_name: name });
    if (error) return alert('팀 생성 실패: ' + error.message);
    const id = data as string;
    setTeams((t) => [...t, { id, name }]);
    setRoleMap((m) => ({ ...m, [id]: 'leader' }));
    setContext(id);
    setAddingTeam(false);
    setTeamName('');
    setShowPanel(true);
  };

  return (
    <>
      {/* 상단 바: 컨텍스트(개인/팀) 좌 + 모드(워크스페이스/오늘) 우 */}
      <div className="dash-toprow">
      <div className="ctx-tabs">
        <button
          className={`ctx-tab${context === 'personal' ? ' active' : ''}`}
          onClick={() => {
            setContext('personal');
            setShowPanel(false);
          }}
        >
          🏠 개인
        </button>
        {teams.map((t) => (
          <button
            key={t.id}
            className={`ctx-tab${context === t.id ? ' active' : ''}`}
            onClick={() => {
              setContext(t.id);
              setShowPanel(false);
            }}
          >
            👥 {t.name}
          </button>
        ))}
        {addingTeam ? (
          <span className="ctx-addteam">
            <input
              className="ws-input"
              autoFocus
              placeholder="새 팀 이름"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createTeam();
                if (e.key === 'Escape') setAddingTeam(false);
              }}
            />
            <button className="btn btn-dark btn-sm" onClick={createTeam}>
              만들기
            </button>
            <button className="btn btn-light btn-sm" onClick={() => setAddingTeam(false)}>
              취소
            </button>
          </span>
        ) : (
          <button
            className="ctx-tab ctx-add"
            onClick={() => {
              setAddingTeam(true);
              setTeamName('');
            }}
          >
            + 팀 만들기
          </button>
        )}
      </div>
        <div className="dash-modetabs">
          <button className={`dash-modebtn${mode === 'workspace' ? ' active' : ''}`} onClick={() => setMode('workspace')}>
            🗂 워크스페이스
          </button>
          <button className={`dash-modebtn${mode === 'today' ? ' active' : ''}`} onClick={() => setMode('today')}>
            ☀️ 오늘 · 이번 주
          </button>
        </div>
      </div>

      {/* 팀 헤더 + 관리/진행상황 */}
      {teamId && currentTeam && (
        <div className="team-head">
          <span className="team-head-name">👥 {currentTeam.name}</span>
          <span className="team-head-role">{roleLabel(myRole)}</span>
          <button className="btn btn-light btn-sm" onClick={() => setShowPanel((s) => !s)}>
            {showPanel ? '관리 닫기' : '팀 관리'}
          </button>
          {(myRole === 'leader' || myRole === 'admin') && (
            <a className="btn btn-light btn-sm" href={`/dashboard/team/${teamId}/progress`}>
              📊 진행상황
            </a>
          )}
        </div>
      )}

      {teamId && showPanel && currentTeam && (
        <TeamPanel
          teamId={teamId}
          teamName={currentTeam.name}
          myRole={myRole ?? 'member'}
          userId={userId}
          userEmail={userEmail}
          onRenamed={(name) => setTeams((ts) => ts.map((t) => (t.id === teamId ? { ...t, name } : t)))}
          onLeft={() => {
            setTeams((ts) => ts.filter((t) => t.id !== teamId));
            setRoleMap((m) => {
              const next = { ...m };
              delete next[teamId];
              return next;
            });
            setContext('personal');
            setShowPanel(false);
          }}
        />
      )}

      {mode === 'workspace' ? (
        <Workspace key={context} initialProjects={visibleProjects} userId={userId} teamId={teamId} canManage={canManage} />
      ) : (
        <TodayView projects={initialProjects} userId={userId} />
      )}
    </>
  );
}
