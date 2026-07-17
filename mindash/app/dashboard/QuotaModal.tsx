'use client';

import { QUOTA_COPY, type QuotaCode } from '@/lib/plan';

// 한도 도달 시 업그레이드 안내 모달. 비파괴 원칙(기존 데이터 유지)을 카피로 전달.
export default function QuotaModal({ code, onClose }: { code: QuotaCode | null; onClose: () => void }) {
  if (!code) return null;
  const { title, body } = QUOTA_COPY[code];
  const hard = code === 'project_todos_hard';
  return (
    <div className="quota-backdrop" onClick={onClose}>
      <div className="quota-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="quota-icon">{hard ? '📦' : '⭐'}</div>
        <h2 className="quota-title">{title}</h2>
        <p className="quota-body">{body}</p>
        <div className="quota-actions">
          {!hard && (
            <a href="/pricing" className="btn btn-dark btn-block" target="_blank" rel="noreferrer">
              요금제 보기
            </a>
          )}
          <button className="btn btn-light btn-block" onClick={onClose}>
            {hard ? '확인' : '나중에 할게요'}
          </button>
        </div>
      </div>
    </div>
  );
}
