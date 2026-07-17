'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { parseQuotaError, QUOTA_COPY } from '@/lib/plan';

type Member = { user_id: string; role: string; full_name: string | null; email: string | null };
type Invite = { id: string; email: string; role: string; token: string; expires_at: string };

const roleLabel = (r: string) => (r === 'leader' ? '팀장' : r === 'admin' ? '관리자' : '팀원');

export default function TeamPanel({
  teamId,
  teamName,
  myRole,
  userId,
  userEmail,
  onRenamed,
  onLeft,
}: {
  teamId: string;
  teamName: string;
  myRole: string;
  userId: string;
  userEmail: string;
  onRenamed: (name: string) => void;
  onLeft: () => void;
}) {
  const supabase = createClient();
  const isManager = myRole === 'leader' || myRole === 'admin';
  const isLeader = myRole === 'leader';

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(teamName);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: mem } = await supabase.from('team_members').select('user_id,role').eq('team_id', teamId);
    const ids = (mem ?? []).map((m) => m.user_id);
    const { data: profs } = ids.length
      ? await supabase.from('profiles').select('id,email,full_name').in('id', ids)
      : { data: [] as { id: string; email: string; full_name: string }[] };
    const pmap = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
    setMembers(
      (mem ?? []).map((m) => ({
        user_id: m.user_id,
        role: m.role,
        full_name: pmap[m.user_id]?.full_name ?? null,
        email: pmap[m.user_id]?.email ?? null,
      }))
    );
    if (isManager) {
      const { data: inv } = await supabase
        .from('team_invites')
        .select('id,email,role,token,expires_at')
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setInvites((inv as Invite[]) ?? []);
    }
    setLoading(false);
  }, [supabase, teamId, isManager]);

  useEffect(() => {
    load();
  }, [load]);

  const sendInvite = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return alert('올바른 이메일을 입력해 주세요.');
    setBusy(true);
    const { data, error } = await supabase
      .from('team_invites')
      .insert({ team_id: teamId, email: e, role: inviteRole, invited_by: userId })
      .select('id,email,role,token,expires_at')
      .single();
    setBusy(false);
    if (error) {
      if (error.code === '23505') return alert('이미 대기 중인 초대가 있는 이메일입니다.');
      const q = parseQuotaError(error.message);
      if (q) return alert(QUOTA_COPY[q].body);
      return alert('초대 실패: ' + error.message);
    }
    setInvites((v) => [data as Invite, ...v]);
    setEmail('');
    copyLink((data as Invite).token);
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard?.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const revokeInvite = async (id: string) => {
    setInvites((v) => v.filter((x) => x.id !== id));
    await supabase.from('team_invites').update({ status: 'revoked' }).eq('id', id);
  };

  const changeRole = async (m: Member, role: string) => {
    setMembers((ms) => ms.map((x) => (x.user_id === m.user_id ? { ...x, role } : x)));
    const { error } = await supabase.from('team_members').update({ role }).eq('team_id', teamId).eq('user_id', m.user_id);
    if (error) {
      alert('역할 변경 실패: ' + error.message);
      load();
    }
  };

  const kick = async (m: Member) => {
    if (!window.confirm(`${m.full_name || m.email || '이 팀원'}을(를) 팀에서 제외할까요?`)) return;
    setMembers((ms) => ms.filter((x) => x.user_id !== m.user_id));
    const { error } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', m.user_id);
    if (error) {
      alert('제외 실패: ' + error.message);
      load();
    }
  };

  const rename = async () => {
    const n = newName.trim();
    if (!n) return;
    const { error } = await supabase.from('teams').update({ name: n }).eq('id', teamId);
    if (error) return alert('이름 변경 실패: ' + error.message);
    onRenamed(n);
    setRenaming(false);
  };

  const leaveOrDelete = async () => {
    if (isLeader) {
      if (!window.confirm(`'${teamName}' 팀을 삭제할까요? 팀 프로젝트는 개인 프로젝트로 전환됩니다.`)) return;
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) return alert('삭제 실패: ' + error.message);
    } else {
      if (!window.confirm(`'${teamName}' 팀에서 나갈까요?`)) return;
      const { error } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId);
      if (error) return alert('탈퇴 실패: ' + error.message);
    }
    onLeft();
  };

  return (
    <div className="team-panel">
      {/* 멤버 */}
      <div className="team-section">
        <div className="team-section-head">
          <h3>팀원 {members.length > 0 ? `(${members.length})` : ''}</h3>
          {isManager &&
            (renaming ? (
              <span className="ctx-addteam">
                <input className="ws-input" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setRenaming(false); }} />
                <button className="btn btn-dark btn-sm" onClick={rename}>저장</button>
              </span>
            ) : (
              <button className="ws-add" style={{ width: 'auto' }} onClick={() => { setNewName(teamName); setRenaming(true); }}>
                팀 이름 변경
              </button>
            ))}
        </div>
        {loading ? (
          <p className="muted">불러오는 중…</p>
        ) : (
          <div className="team-members">
            {members.map((m) => (
              <div className="team-member" key={m.user_id}>
                <span className="tm-avatar">{(m.full_name || m.email || '?').slice(0, 1).toUpperCase()}</span>
                <div className="tm-info">
                  <div className="tm-name">
                    {m.full_name || m.email?.split('@')[0] || '사용자'}
                    {m.user_id === userId && <span className="tm-you">나</span>}
                  </div>
                  <div className="tm-email">{m.email}</div>
                </div>
                {isLeader && m.role !== 'leader' ? (
                  <select className="select tm-role" value={m.role} onChange={(e) => changeRole(m, e.target.value)}>
                    <option value="member">팀원</option>
                    <option value="admin">관리자</option>
                  </select>
                ) : (
                  <span className={`tm-badge role-${m.role}`}>{roleLabel(m.role)}</span>
                )}
                {isManager && m.role !== 'leader' && m.user_id !== userId && (
                  <button className="ws-x" onClick={() => kick(m)} title="팀에서 제외">
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 초대 (운영진만) */}
      {isManager && (
        <div className="team-section">
          <div className="team-section-head">
            <h3>멤버 초대</h3>
          </div>
          <div className="team-invite-form">
            <input className="input" type="email" placeholder="초대할 이메일" value={email}
              onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendInvite(); }} />
            {isLeader && (
              <select className="select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ width: 'auto' }}>
                <option value="member">팀원</option>
                <option value="admin">관리자</option>
              </select>
            )}
            <button className="btn btn-dark btn-sm" onClick={sendInvite} disabled={busy}>
              초대 링크 생성
            </button>
          </div>
          <p className="caption" style={{ marginTop: 6 }}>
            링크를 만들어 카톡·메일로 전달하세요. 초대한 이메일로 로그인한 사람만 수락할 수 있습니다.
          </p>
          {invites.length > 0 && (
            <div className="team-invites">
              {invites.map((iv) => (
                <div className="team-invite" key={iv.id}>
                  <span className="ti-email">{iv.email}</span>
                  <span className="tm-badge role-member">{roleLabel(iv.role)}</span>
                  <button className="btn btn-light btn-sm" onClick={() => copyLink(iv.token)}>
                    {copied === iv.token ? '복사됨 ✓' : '링크 복사'}
                  </button>
                  <button className="ws-x" onClick={() => revokeInvite(iv.id)} title="초대 취소">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 위험 구역 */}
      <div className="team-danger">
        <button className="btn btn-light btn-sm" onClick={leaveOrDelete}>
          {isLeader ? '팀 삭제' : '팀 나가기'}
        </button>
      </div>
    </div>
  );
}
