'use client';

import { useActionState, useState } from 'react';
import { signUp, type AuthState } from '@/app/actions/auth';

const initial: AuthState = {};

export default function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, initial);
  // 비밀번호 확인만 제어 컴포넌트로 → 즉시 불일치 피드백. 최종 검증은 서버가 한다.
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const mismatch = pw.length > 0 && pw2.length > 0 && pw !== pw2;

  if (state.notice) {
    return <div className="form-msg success">{state.notice}</div>;
  }

  return (
    <form action={formAction}>
      {state.error && <div className="form-msg error">{state.error}</div>}

      <div className="field">
        <label htmlFor="name">이름</label>
        <input className="input" id="name" name="name" required autoComplete="name" placeholder="홍길동" />
      </div>
      <div className="field">
        <label htmlFor="nickname">닉네임 (선택)</label>
        <input className="input" id="nickname" name="nickname" autoComplete="nickname" placeholder="팀에서 표시할 이름" />
      </div>
      <div className="field">
        <label htmlFor="email">이메일</label>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>
      <div className="field">
        <label htmlFor="phone">연락처 (선택)</label>
        <input
          className="input"
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="010-1234-5678"
        />
      </div>
      <div className="field">
        <label htmlFor="password">비밀번호</label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="6자 이상"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="password-confirm">비밀번호 확인</label>
        <input
          className="input"
          id="password-confirm"
          name="passwordConfirm"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="다시 한 번 입력"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
        {mismatch && <div className="field-err">비밀번호가 일치하지 않아요.</div>}
      </div>

      <button className="btn btn-dark btn-block" type="submit" disabled={pending}>
        {pending ? '가입 중…' : '회원가입'}
      </button>
    </form>
  );
}
