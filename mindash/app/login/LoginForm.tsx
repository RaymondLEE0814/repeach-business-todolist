'use client';

import { useActionState } from 'react';
import { signIn, type AuthState } from '@/app/actions/auth';

const initial: AuthState = {};

export default function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState(signIn, initial);

  return (
    <form action={formAction}>
      {state.error && <div className="form-msg error">{state.error}</div>}
      <input type="hidden" name="redirect" value={redirectTo} />

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
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </div>

      <button className="btn btn-dark btn-block" type="submit" disabled={pending}>
        {pending ? '로그인 중…' : '로그인'}
      </button>
    </form>
  );
}
