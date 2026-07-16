'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordForm({ tokenHash }: { tokenHash: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [verified, setVerified] = useState(false); // verifyOtp는 1회용 → 성공 후 재호출 방지
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw.length < 6) return setErr('비밀번호는 6자 이상이어야 해요.');
    if (pw !== pw2) return setErr('두 비밀번호가 서로 달라요.');

    setBusy(true);
    // 1) 토큰 검증(최초 1회) — 성공하면 recovery 세션이 브라우저에 세팅된다
    if (!verified) {
      const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
      if (error) {
        setBusy(false);
        return setErr('링크가 만료되었거나 이미 사용되었어요. 관리자에게 새 링크를 요청해 주세요.');
      }
      setVerified(true);
    }
    // 2) 새 비밀번호로 변경
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr('새 비밀번호로 변경하지 못했어요. 이전과 다른 비밀번호로 다시 시도해 주세요.');

    setDone(true);
    router.push('/dashboard');
    router.refresh();
  };

  if (done) {
    return <div className="form-msg success">비밀번호를 변경했어요. 잠시 후 대시보드로 이동해요.</div>;
  }

  return (
    <form onSubmit={submit}>
      {err && <div className="form-msg error">{err}</div>}
      <div className="field">
        <label htmlFor="new-pw">새 비밀번호</label>
        <input
          className="input"
          id="new-pw"
          type="password"
          required
          autoComplete="new-password"
          placeholder="6자 이상"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="new-pw2">새 비밀번호 확인</label>
        <input
          className="input"
          id="new-pw2"
          type="password"
          required
          autoComplete="new-password"
          placeholder="다시 한 번 입력"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
      </div>
      <button className="btn btn-dark btn-block" type="submit" disabled={busy}>
        {busy ? '변경 중…' : '새 비밀번호로 변경'}
      </button>
    </form>
  );
}
