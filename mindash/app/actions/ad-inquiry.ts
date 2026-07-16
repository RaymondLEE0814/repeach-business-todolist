'use server';

import { createClient } from '@/lib/supabase/server';

export type AdInquiryState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
};

export async function submitAdInquiry(
  _prev: AdInquiryState,
  formData: FormData
): Promise<AdInquiryState> {
  // 허니팟: 봇이 채우면 저장 없이 성공처럼 응답(실패를 알리지 않음)
  const honeypot = String(formData.get('website') || '').trim();
  if (honeypot) return { status: 'success' };

  const company = String(formData.get('company') || '').trim();
  const contactName = String(formData.get('contact_name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const adType = String(formData.get('ad_type') || '').trim();
  const budget = String(formData.get('budget') || '').trim();
  const message = String(formData.get('message') || '').trim();

  if (!company) {
    return { status: 'error', message: '회사 / 브랜드명을 입력해 주세요.' };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'error', message: '올바른 이메일을 입력해 주세요.' };
  }
  if (!message) {
    return { status: 'error', message: '문의 내용을 입력해 주세요.' };
  }
  // 길이 상한 (DB 오염 방지)
  if (company.length > 100 || contactName.length > 50 || phone.length > 30) {
    return { status: 'error', message: '입력값이 너무 깁니다. 짧게 작성해 주세요.' };
  }
  if (message.length > 2000) {
    return { status: 'error', message: '문의 내용은 2,000자 이내로 작성해 주세요.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('ad_inquiries').insert({
    company,
    contact_name: contactName || null,
    email,
    phone: phone || null,
    ad_type: adType || null,
    budget: budget || null,
    message,
  });

  if (error) {
    return {
      status: 'error',
      message: '문의 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }

  return { status: 'success' };
}
