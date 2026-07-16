'use client';

import { Fragment, useState, useTransition } from 'react';
import { setUserStatus, setAdmin, issueTempPassword, issueResetLink } from '@/app/actions/admin';

export type AdminUserRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string | null;
  approvedAt: string | null;
  isAdmin: boolean;
};

const STATUS_META: Record<AdminUserRow['status'], { label: string; cls: string }> = {
  pending: { label: '승인 대기', cls: 'st-pending' },
  approved: { label: '승인됨', cls: 'st-approved' },
  rejected: { label: '거절됨', cls: 'st-rejected' },
};

function fmt(d: string | null): string {
  if (!d) return '-';
  return d.slice(0, 10);
}

export default function AdminUsers({
  rows,
  currentUserId,
}: {
  rows: AdminUserRow[];
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  // 비밀번호 재설정: 펼쳐진 행 + 1회 표시 결과(임시비번/링크)
  const [resetOpenId, setResetOpenId] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ userId: string; kind: 'temp' | 'link'; value: string; email: string } | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  const run = (id: string, fn: () => Promise<{ ok: boolean; reason?: string }>) => {
    setBusyId(id);
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setBusyId(null);
      if (!res.ok) setMsg({ text: res.reason ?? '처리에 실패했습니다.', ok: false });
      else setMsg({ text: '변경되었습니다.', ok: true });
    });
  };

  // 재설정 패널 토글 — 닫거나 다른 행을 열면 결과(임시비번)를 즉시 지운다
  const toggleReset = (id: string) => {
    setSecret(null);
    setCopied(false);
    setMsg(null);
    setResetOpenId((cur) => (cur === id ? null : id));
  };

  const runReset = (
    id: string,
    kind: 'temp' | 'link',
    fn: () => Promise<{ ok: boolean; reason?: string; secret?: string; email?: string }>
  ) => {
    setBusyId(id);
    setMsg(null);
    setSecret(null);
    setCopied(false);
    startTransition(async () => {
      const res = await fn();
      setBusyId(null);
      if (!res.ok || !res.secret) setMsg({ text: res.reason ?? '처리에 실패했습니다.', ok: false });
      else setSecret({ userId: id, kind, value: res.secret, email: res.email ?? '' });
    });
  };

  const copySecret = () => {
    if (!secret) return;
    navigator.clipboard?.writeText(secret.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shown = rows.filter((r) => filter === 'all' || r.status === filter);

  return (
    <div className="admin-users">
      <div className="admin-filters">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
          <button
            key={f}
            className={`admin-filter${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? '전체' : STATUS_META[f].label}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`admin-msg${msg.ok ? ' ok' : ' err'}`}>{msg.text}</div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>사용자</th>
              <th>상태</th>
              <th>가입일</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const meta = STATUS_META[r.status];
              const busy = pending && busyId === r.id;
              const isSelf = r.id === currentUserId;
              const resetOpen = resetOpenId === r.id;
              const name = r.fullName || r.email?.split('@')[0] || '이 사용자';
              return (
                <Fragment key={r.id}>
                <tr className={busy ? 'row-busy' : ''}>
                  <td>
                    <div className="admin-user-cell">
                      <span className="admin-user-name">
                        {r.fullName || r.email?.split('@')[0] || '(이름 없음)'}
                        {r.isAdmin && <span className="admin-badge">🛡️ 관리자</span>}
                      </span>
                      <span className="admin-user-email">{r.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`st-badge ${meta.cls}`}>{meta.label}</span>
                  </td>
                  <td className="admin-date">{fmt(r.createdAt)}</td>
                  <td>
                    <div className="admin-actions">
                      {r.status !== 'approved' && (
                        <button
                          className="btn btn-dark btn-sm"
                          disabled={busy}
                          onClick={() => run(r.id, () => setUserStatus(r.id, 'approved'))}
                        >
                          승인
                        </button>
                      )}
                      {r.status === 'approved' && !r.isAdmin && (
                        <button
                          className="btn btn-light btn-sm"
                          disabled={busy}
                          onClick={() => run(r.id, () => setUserStatus(r.id, 'pending'))}
                        >
                          승인취소
                        </button>
                      )}
                      {r.status !== 'rejected' && !r.isAdmin && (
                        <button
                          className="btn btn-light btn-sm admin-danger"
                          disabled={busy}
                          onClick={() => run(r.id, () => setUserStatus(r.id, 'rejected'))}
                        >
                          거절
                        </button>
                      )}
                      {!r.isAdmin ? (
                        <button
                          className="btn btn-light btn-sm"
                          disabled={busy}
                          onClick={() => run(r.id, () => setAdmin(r.id, true))}
                          title="관리자로 지정 (자동 승인)"
                        >
                          관리자 지정
                        </button>
                      ) : (
                        !isSelf && (
                          <button
                            className="btn btn-light btn-sm"
                            disabled={busy}
                            onClick={() => run(r.id, () => setAdmin(r.id, false))}
                            title="관리자 해제"
                          >
                            관리자 해제
                          </button>
                        )
                      )}
                      {!r.isAdmin && (
                        <button className="btn btn-light btn-sm" disabled={busy} onClick={() => toggleReset(r.id)}>
                          {resetOpen ? '닫기' : '비밀번호 재설정'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {resetOpen && (
                  <tr className="admin-reset-row">
                    <td colSpan={4}>
                      <div className="admin-reset-panel">
                        <p className="admin-reset-help">
                          임시 비밀번호를 만들거나 재설정 링크를 만들어 카카오톡 등으로 직접 전달하세요. 임시 비밀번호를
                          만들면 기존 비밀번호는 즉시 사용할 수 없게 돼요.
                        </p>
                        <div className="admin-reset-actions">
                          <button
                            className="btn btn-dark btn-sm"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `${name}님의 비밀번호를 임시 비밀번호로 바꿀까요? 기존 비밀번호는 즉시 사용할 수 없게 됩니다.`
                                )
                              )
                                runReset(r.id, 'temp', () => issueTempPassword(r.id));
                            }}
                          >
                            임시 비밀번호 만들기
                          </button>
                          <button
                            className="btn btn-light btn-sm"
                            disabled={busy}
                            onClick={() => runReset(r.id, 'link', () => issueResetLink(r.id))}
                          >
                            재설정 링크 만들기
                          </button>
                        </div>
                        {secret?.userId === r.id && (
                          <>
                            <div className="admin-secret">
                              <code>{secret.value}</code>
                              <button className="btn btn-light btn-sm" onClick={copySecret}>
                                {copied ? '복사됨 ✓' : '복사'}
                              </button>
                            </div>
                            <p className="admin-secret-note">
                              {secret.kind === 'temp'
                                ? `이 비밀번호는 지금 한 번만 보여요. 복사해서 ${secret.email} 사용자에게 전달하세요.`
                                : `링크는 1회용이고 일정 시간이 지나면 만료돼요. 복사해서 ${secret.email} 사용자에게 전달하세요.`}
                            </p>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className="admin-empty">
                  해당하는 사용자가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
