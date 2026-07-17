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
  const passwordConfirm = String(formData.get('passwordConfirm') || '');
  const name = String(formData.get('name') || '').trim();
  const nickname = String(formData.get('nickname') || '').trim();
  const phone = String(formData.get('phone') || '').trim();

  if (!name) {
    return { error: '이름을 입력해 주세요.' };
  }
  if (!email || !password) {
    return { error: '이메일과 비밀번호를 입력해 주세요.' };
  }
  if (password.length < 6) {
    return { error: '비밀번호는 6자 이상이어야 해요.' };
  }
  if (password !== passwordConfirm) {
    return { error: '비밀번호가 일치하지 않아요.' };
  }
  // 연락처는 선택. 입력했을 때만 형식 검증(숫자만 추출, 0으로 시작하는 9~11자리).
  const phoneDigits = phone.replace(/\D/g, '');
  if (phone && !/^0\d{8,10}$/.test(phoneDigits)) {
    return { error: '연락처 형식을 확인해 주세요. 예: 010-1234-5678' };
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || (await headers()).get('origin') || '';

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // 'app' 마커로 이 가입이 Mindash 소속임을 표시 → 트리거가 이 경우만 profiles 생성
      data: {
        full_name: name,
        nickname: nickname || null,
        phone: phoneDigits || null,
        app: 'mindash',
      },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('already')) {
      return { error: '이미 가입된 이메일이에요. 로그인해 주세요.' };
    }
    return { error: '회원가입에 실패했어요. 잠시 후 다시 시도해 주세요.' };
  }

  // 이메일 확인이 꺼져 있으면 곧바로 세션이 생성됨 → 자동승인이므로 바로 대시보드로
  if (data.session) {
    revalidatePath('/', 'layout');
    redirect('/dashboard');
  }

  return {
    notice: '확인 이메일을 보냈어요. 메일의 링크를 클릭해 가입을 완료한 뒤 로그인하면 바로 시작할 수 있어요.',
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
