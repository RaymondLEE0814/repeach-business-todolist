'use client';

import { useActionState } from 'react';
import { submitAdInquiry, type AdInquiryState } from '@/app/actions/ad-inquiry';

const initial: AdInquiryState = { status: 'idle' };

export default function AdInquiryForm() {
  const [state, formAction, pending] = useActionState(submitAdInquiry, initial);

  if (state.status === 'success') {
    return (
      <div className="beta-card">
        <div className="beta-success">
          <div className="icon">✓</div>
          <h2 className="heading">문의가 접수되었습니다</h2>
          <p className="body muted" style={{ marginTop: 8 }}>
            영업일 기준 2~3일 내에 입력하신 이메일로 회신드리겠습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className="beta-card" action={formAction}>
      {state.status === 'error' && <div className="form-msg error">{state.message}</div>}

      {/* 허니팟 (사람에게는 보이지 않음) */}
      <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <div className="row-2">
        <div className="field">
          <label htmlFor="company">
            회사 / 브랜드명 <span className="req">*</span>
          </label>
          <input className="input" id="company" name="company" required placeholder="예: 슈퍼런" />
        </div>
        <div className="field">
          <label htmlFor="contact_name">담당자 이름</label>
          <input className="input" id="contact_name" name="contact_name" placeholder="선택 입력" />
        </div>
      </div>

      <div className="row-2">
        <div className="field">
          <label htmlFor="ad_email">
            이메일 <span className="req">*</span>
          </label>
          <input
            className="input"
            id="ad_email"
            name="email"
            type="email"
            required
            placeholder="you@company.com"
          />
        </div>
        <div className="field">
          <label htmlFor="phone">연락처</label>
          <input className="input" id="phone" name="phone" type="tel" placeholder="선택 입력" />
        </div>
      </div>

      <div className="row-2">
        <div className="field">
          <label htmlFor="ad_type">관심 광고 형태</label>
          <select className="select" id="ad_type" name="ad_type" defaultValue="">
            <option value="">선택 입력</option>
            <option value="배너 광고">배너 광고</option>
            <option value="스폰서십·브랜디드">스폰서십 · 브랜디드</option>
            <option value="뉴스레터·이메일">뉴스레터 · 이메일</option>
            <option value="제휴·기타">제휴 · 기타</option>
            <option value="아직 모름">아직 모름 (협의 희망)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="budget">예상 월 예산</label>
          <select className="select" id="budget" name="budget" defaultValue="">
            <option value="">선택 입력</option>
            <option value="50만원 미만">50만원 미만</option>
            <option value="50~200만원">50~200만원</option>
            <option value="200~500만원">200~500만원</option>
            <option value="500만원 이상">500만원 이상</option>
            <option value="미정">미정</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="ad_message">
          문의 내용 <span className="req">*</span>
        </label>
        <textarea
          className="textarea"
          id="ad_message"
          name="message"
          required
          maxLength={2000}
          placeholder="광고하려는 제품/서비스와 원하시는 방식을 자유롭게 적어주세요."
        />
      </div>

      <button className="btn btn-dark btn-block" type="submit" disabled={pending}>
        {pending ? '보내는 중…' : '광고 문의 보내기'}
      </button>
      <p className="caption text-center" style={{ marginTop: 12 }}>
        급하신 경우 대표번호 02-6012-1223으로 연락 주셔도 됩니다.
      </p>
    </form>
  );
}
