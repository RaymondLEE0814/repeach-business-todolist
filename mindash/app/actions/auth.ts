'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type AuthState = { error?: string; notice?: string };

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const redirectTo = String(formData.get('redirect') || '/dashboard');

  if (!email || !password) {
    return { error: '이메일과 비밀번호를 입력해 주세요.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  }

  revalidatePath('/', 'layout');
  // 미승인 사용자는 대기 페이지로 (관리자 승인 전).
  // Mindash에 처음 로그인하는 (다른 사이트 전용) 계정은 여기서 pending 멤버로 편입.
  if (data.user) {
    let status: string | null = null;
    const { data: ens } = await supabase.rpc('mindash_ensure_member');
    if (ens && typeof ens === 'object' && 'status' in ens) {
      status = (ens as { status?: string }).status ?? null;
    }
    if (status === null) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', data.user.id)
        .maybeSingle();
      status = prof?.status ?? null;
    }
    if (status && status !== 'approved') redirect('/pending');
  }
  redirect(redirectTo.startsWith('/') ? redirectTo : '/dashboard');
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const name = String(formData.get('name') || '').trim();

  if (!email || !password) {
    return { error: '이메일과 비밀번호를 입력해 주세요.' };
  }
  if (password.length < 6) {
    return { error: '비밀번호는 6자 이상이어야 합니다.' };
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || (await headers()).get('origin') || '';

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // 'app' 마커로 이 가입이 Mindash 소속임을 표시 → 트리거가 이 경우만 profiles 생성
      data: { full_name: name || null, app: 'mindash' },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('already')) {
      return { error: '이미 가입된 이메일입니다. 로그인해 주세요.' };
    }
    return { error: '회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  // 이메일 확인이 꺼져 있으면 곧바로 세션이 생성됨 → 승인 대기 페이지로
  if (data.session) {
    revalidatePath('/', 'layout');
    redirect('/pending');
  }

  return {
    notice:
      '확인 이메일을 보냈습니다. 메일의 링크를 클릭해 가입을 완료한 뒤 로그인해 주세요. (가입 후 관리자 승인이 필요합니다.)',
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
