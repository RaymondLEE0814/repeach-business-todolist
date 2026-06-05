'use client';

import { useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant' | 'system' | 'error'; text: string };

const HINT = '자연어로 일정을 관리해보세요. 예: "내일 제안서 초안 쓰기 추가해줘", "오늘 할 일 뭐야?", "제안서 완료 처리해줘"';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'system', text: HINT }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const scroll = () =>
    setTimeout(() => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }), 0);

  const send = async () => {
    const message = input.trim();
    if (!message || busy) return;
    const history = msgs
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text }));
    setInput('');
    setBusy(true);
    setMsgs((m) => [...m, { role: 'user', text: message }]);
    scroll();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsgs((m) => [...m, { role: 'error', text: json.error || `요청 실패 (${res.status})` }]);
      } else {
        setMsgs((m) => [...m, { role: 'assistant', text: json.reply || '(빈 응답)' }]);
        if (json.changed) window.dispatchEvent(new CustomEvent('mindash:data-changed'));
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: 'error', text: '네트워크 에러: ' + ((e as Error)?.message || e) }]);
    } finally {
      setBusy(false);
      scroll();
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    // 한글 IME 가드: 조합 중 Enter는 무시(마지막 음절 중복 전송 방지)
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    send();
  };

  return (
    <>
      <button className="cs-fab" onClick={() => setOpen((o) => !o)} aria-label="일정 비서" title="일정 비서">
        {open ? '×' : '✦'}
      </button>
      {open && (
        <div className="cs-chat">
          <div className="cs-chat-head">
            <span className="cs-title">✦ 일정 비서</span>
            <button className="cs-close" onClick={() => setOpen(false)} aria-label="닫기">
              ×
            </button>
          </div>
          <div className="cs-chat-body" ref={bodyRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`cs-msg ${m.role}`}>
                {m.text}
              </div>
            ))}
            {busy && <div className="cs-msg log">생각 중…</div>}
          </div>
          <div className="cs-chat-foot">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder='예: "내일 보고서 작성 추가해줘" — Enter 전송'
              rows={1}
            />
            <button className="cs-btn" onClick={send} disabled={busy || !input.trim()} aria-label="보내기">
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}
