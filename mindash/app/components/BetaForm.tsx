'use client';

import { useActionState } from 'react';
import { submitBeta, type BetaState } from '@/app/actions/beta';

const initial: BetaState = { status: 'idle' };

export default function BetaForm() {
  const [state, formAction, pending] = useActionState(submitBeta, initial);

  if (state.status === 'success') {
    return (
      <div className="beta-card">
        <div className="beta-success">
          <div className="icon">✓</div>
          <h2 className="heading">신청이 완료되었습니다</h2>
          <p className="body muted" style={{ marginTop: 8 }}>
            베타 오픈 시 가장 먼저 안내드릴게요. 입력하신 이메일을 확인해 주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className="beta-card" action={formAction}>
      {state.status === 'error' && (
        <div className="form-msg error">{state.message}</div>
      )}

      <div className="row-2">
        <div className="field">
          <label htmlFor="name">이름 / 닉네임</label>
          <input className="input" id="name" name="name" placeholder="선택 입력" />
        </div>
        <div className="field">
          <label htmlFor="email">
            이메일 <span className="req">*</span>
          </label>
          <input
            className="input"
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div className="row-2">
        <div className="field">
          <label htmlFor="user_type">
            사용자 유형 <span className="req">*</span>
          </label>
          <select className="select" id="user_type" name="user_type" required defaultValue="">
            <option value="" disabled>
              선택해 주세요
            </option>
            <option value="개인">개인</option>
            <option value="프리랜서">프리랜서 / 1인 사업자</option>
            <option value="소규모 팀">소규모 팀 (2~5명)</option>
            <option value="소규모 기업">소규모 기업 (5~10명)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="interested_plan">관심 요금제</label>
          <select className="select" id="interested_plan" name="interested_plan" defaultValue="">
            <option value="">선택 입력</option>
            <option value="Free">Free (0원)</option>
            <option value="Personal Pro">Personal Pro (월 3,900원)</option>
            <option value="Freelancer">Freelancer (월 7,900원)</option>
            <option value="Team Starter">Team Starter (월 19,000원)</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="current_tool">
          지금 쓰는 도구 <span className="req">*</span>
        </label>
        <input
          className="input"
          id="current_tool"
          name="current_tool"
          required
          placeholder="예: 노션, 엑셀, Todoist, 카카오톡, 구글 캘린더…"
        />
      </div>

      <div className="field">
        <label htmlFor="pain_point">
          가장 불편한 점 <span className="req">*</span>
        </label>
        <textarea
          className="textarea"
          id="pain_point"
          name="pain_point"
          required
          placeholder="지금 일정/프로젝트 관리에서 가장 답답한 점을 적어주세요."
        />
      </div>

      <button className="btn btn-dark btn-block" type="submit" disabled={pending}>
        {pending ? '신청 중…' : '베타 신청 완료하기'}
      </button>
      <p className="caption text-center" style={{ marginTop: 12 }}>
        가격은 확정 결제가 아니라 베타 예상 요금제입니다.
      </p>
    </form>
  );
}
