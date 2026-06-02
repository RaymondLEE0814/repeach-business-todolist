'use client';

import { useActionState } from 'react';
import { signUp, type AuthState } from '@/app/actions/auth';

const initial: AuthState = {};

export default function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, initial);

  if (state.notice) {
    return <div className="form-msg success">{state.notice}</div>;
  }

  return (
    <form action={formAction}>
      {state.error && <div className="form-msg error">{state.error}</div>}

      <div className="field">
        <label htmlFor="name">이름 / 닉네임</label>
        <input className="input" id="name" name="name" placeholder="선택 입력" autoComplete="name" />
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
        />
      </div>

      <button className="btn btn-dark btn-block" type="submit" disabled={pending}>
        {pending ? '가입 중…' : '회원가입'}
      </button>
    </form>
  );
}
