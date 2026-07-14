'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type AdminActionResult = { ok: boolean; reason?: string };

const REASONS: Record<string, string> = {
  not_admin: '관리자 권한이 없습니다.',
  bad_status: '잘못된 상태 값입니다.',
  cannot_block_admin: '관리자 계정은 거절/승인취소할 수 없습니다.',
  last_admin: '마지막 관리자는 해제할 수 없습니다.',
  not_found: '해당 사용자를 찾을 수 없습니다.',
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false as const };
  const { data: adm } = await supabase
    .from('mindash_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return { supabase, ok: !!adm };
}

export async function setUserStatus(
  userId: string,
  status: 'pending' | 'approved' | 'rejected'
): Promise<AdminActionResult> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { ok: false, reason: '관리자 권한이 없습니다.' };

  const { data, error } = await supabase.rpc('mindash_set_user_status', {
    p_user: userId,
    p_status: status,
  });
  if (error) return { ok: false, reason: error.message };
  const res = data as { ok: boolean; reason?: string };
  revalidatePath('/admin');
  return { ok: res.ok, reason: res.reason ? REASONS[res.reason] ?? res.reason : undefined };
}

export async function setAdmin(userId: string, grant: boolean): Promise<AdminActionResult> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { ok: false, reason: '관리자 권한이 없습니다.' };

  const { data, error } = await supabase.rpc('mindash_set_admin', {
    p_user: userId,
    p_grant: grant,
  });
  if (error) return { ok: false, reason: error.message };
  const res = data as { ok: boolean; reason?: string };
  revalidatePath('/admin');
  return { ok: res.ok, reason: res.reason ? REASONS[res.reason] ?? res.reason : undefined };
}
