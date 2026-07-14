'use client';

import { useState, useTransition } from 'react';
import { setUserStatus, setAdmin } from '@/app/actions/admin';

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
              return (
                <tr key={r.id} className={busy ? 'row-busy' : ''}>
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
                    </div>
                  </td>
                </tr>
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
