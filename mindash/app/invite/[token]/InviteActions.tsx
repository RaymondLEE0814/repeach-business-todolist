'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function InviteActions({ token, canAccept }: { token: string; canAccept: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase.rpc('accept_team_invite', { p_token: token });
    setBusy(false);
    if (error) return setErr(error.message);
    const r = data as { ok: boolean; reason?: string } | null;
    if (!r?.ok) {
      return setErr(
        r?.reason === 'email_mismatch'
          ? '초대된 이메일과 로그인한 계정이 달라요.'
          : r?.reason === 'expired'
          ? '초대가 만료됐어요.'
          : r?.reason === 'team_full'
          ? '이 팀은 무료 플랜 인원(팀장 포함 3명)이 가득 찼어요. 팀장에게 업그레이드를 요청해 주세요.'
          : r?.reason === 'not_approved'
          ? '이용이 제한된 계정이에요. 관리자에게 문의해 주세요.'
          : '수락할 수 없는 초대예요.'
      );
    }
    router.push('/dashboard');
    router.refresh();
  };

  const decline = async () => {
    setBusy(true);
    await supabase.rpc('decline_team_invite', { p_token: token });
    router.push('/dashboard');
  };

  return (
    <>
      {err && <div className="form-msg error">{err}</div>}
      <button className="btn btn-dark btn-block" onClick={accept} disabled={busy || !canAccept}>
        {busy ? '처리 중…' : '팀 참여하기'}
      </button>
      <button className="btn btn-light btn-block" style={{ marginTop: 8 }} onClick={decline} disabled={busy}>
        거절
      </button>
    </>
  );
}
