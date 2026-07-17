'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type AdminActionResult = { ok: boolean; reason?: string };
export type PasswordResetResult = { ok: boolean; reason?: string; secret?: string; email?: string };

const REASONS: Record<string, string> = {
  not_admin: '관리자 권한이 없습니다.',
  bad_status: '잘못된 상태 값입니다.',
  cannot_block_admin: '관리자 계정은 거절/승인취소할 수 없습니다.',
  last_admin: '마지막 관리자는 해제할 수 없습니다.',
  not_found: '해당 사용자를 찾을 수 없습니다.',
  target_admin: '관리자 계정의 비밀번호는 여기서 초기화할 수 없습니다. Supabase 대시보드를 이용해 주세요.',
  not_configured:
    '비밀번호 초기화가 아직 설정되지 않았습니다. 서버 환경변수 SUPABASE_SERVICE_ROLE_KEY를 추가한 뒤 다시 시도해 주세요.',
  reset_failed: '비밀번호 초기화에 실패했습니다. 잠시 후 다시 시도해 주세요.',
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

// 혼동 문자(0 O o 1 l I) 제외 — 카톡으로 받아 눈으로 보고 타이핑하는 시나리오
const TEMP_PW_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
function generateTempPassword(len = 10): string {
  let out = '';
  for (let i = 0; i < len; i++) out += TEMP_PW_ALPHABET[randomInt(TEMP_PW_ALPHABET.length)];
  return out;
}

// A/B 공통 전처리: 관리자 검증 → 대상 관리자 차단 → service_role 클라이언트 확보 → 대상 이메일 조회
async function prepareReset(
  userId: string
): Promise<{ ok: false; reason: string } | { ok: true; admin: NonNullable<ReturnType<typeof createAdminClient>>; email: string }> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { ok: false, reason: REASONS.not_admin };
  // 관리자 계정(자기 자신 포함)은 여기서 초기화 불가 — 계정 사칭 벡터 차단
  const { data: adm } = await supabase.from('mindash_admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (adm) return { ok: false, reason: REASONS.target_admin };
  const admin = createAdminClient();
  if (!admin) return { ok: false, reason: REASONS.not_configured };
  const { data: got, error } = await admin.auth.admin.getUserById(userId);
  if (error || !got.user?.email) return { ok: false, reason: REASONS.not_found };
  return { ok: true, admin, email: got.user.email };
}

// A안 — 임시 비밀번호 발급 (기존 비밀번호는 즉시 무효)
export async function issueTempPassword(userId: string): Promise<PasswordResetResult> {
  const pre = await prepareReset(userId);
  if (!pre.ok) return { ok: false, reason: pre.reason };
  const temp = generateTempPassword();
  const { error } = await pre.admin.auth.admin.updateUserById(userId, { password: temp });
  if (error) return { ok: false, reason: REASONS.reset_failed };
  return { ok: true, secret: temp, email: pre.email };
}

// B안 — 재설정 링크 발급 (기존 비밀번호는 그대로, 사용자가 링크에서 직접 변경)
export async function issueResetLink(userId: string): Promise<PasswordResetResult> {
  const pre = await prepareReset(userId);
  if (!pre.ok) return { ok: false, reason: pre.reason };
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (await headers()).get('origin') || '';
  const { data, error } = await pre.admin.auth.admin.generateLink({ type: 'recovery', email: pre.email });
  if (error || !data.properties?.hashed_token) return { ok: false, reason: REASONS.reset_failed };
  // action_link(Supabase /verify URL)는 카톡 미리보기 봇이 GET하면 1회용 토큰이 소모된다.
  // 대신 hashed_token으로 우리 페이지 URL을 조립 → 검증은 사용자가 버튼을 누를 때만 일어난다.
  const link = `${siteUrl}/reset-password?token_hash=${data.properties.hashed_token}`;
  return { ok: true, secret: link, email: pre.email };
}

export async function setUserPlan(userId: string, plan: 'free' | 'pro'): Promise<AdminActionResult> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { ok: false, reason: '관리자 권한이 없습니다.' };
  const { data, error } = await supabase.rpc('mindash_set_user_plan', { p_user: userId, p_plan: plan });
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
