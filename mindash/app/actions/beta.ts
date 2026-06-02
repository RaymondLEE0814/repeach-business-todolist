'use server';

import { createClient } from '@/lib/supabase/server';

export type BetaState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
};

export async function submitBeta(
  _prev: BetaState,
  formData: FormData
): Promise<BetaState> {
  const email = String(formData.get('email') || '').trim();
  const userType = String(formData.get('user_type') || '').trim();
  const currentTool = String(formData.get('current_tool') || '').trim();
  const painPoint = String(formData.get('pain_point') || '').trim();
  const name = String(formData.get('name') || '').trim();
  const interestedPlan = String(formData.get('interested_plan') || '').trim();

  // 필수값 검증 (PRD: 이메일, 사용자 유형, 현재 도구, 가장 불편한 점)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'error', message: '올바른 이메일을 입력해 주세요.' };
  }
  if (!userType) {
    return { status: 'error', message: '사용자 유형을 선택해 주세요.' };
  }
  if (!currentTool) {
    return { status: 'error', message: '현재 사용하는 도구를 입력해 주세요.' };
  }
  if (!painPoint) {
    return { status: 'error', message: '가장 불편한 점을 입력해 주세요.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('beta_signups').insert({
    email,
    name: name || null,
    user_type: userType,
    current_tool: currentTool,
    pain_point: painPoint,
    interested_plan: interestedPlan || null,
  });

  if (error) {
    if (error.code === '23505') {
      return { status: 'error', message: '이미 신청하신 이메일입니다. 곧 안내드릴게요!' };
    }
    return {
      status: 'error',
      message: '신청 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }

  return {
    status: 'success',
    message: '신청이 완료되었습니다. 베타 오픈 시 가장 먼저 안내드릴게요.',
  };
}
