// Gemini function-calling 에이전트 루프 (chat-system-kit의 gemini.ts 패턴 적용).
// 모델이 툴(할 일 조회/추가/완료 등)을 호출하면 실제로 Supabase를 만지고 결과를 돌려준다.
import { GoogleGenAI, type Content, type Part } from '@google/genai';
import { TOOL_DECLARATIONS, runTool, type ToolCtx } from './tools';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash';
const MAX_STEPS = 12; // 한 turn 함수호출 라운드 상한 (무한루프 방지)

export type ChatMessage = { role: 'user' | 'model'; text: string };

export async function runChatAgent(opts: {
  system: string;
  messages: ChatMessage[];
  ctx: ToolCtx;
}): Promise<{ reply: string; changed: boolean; steps: number }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const contents: Content[] = opts.messages
    .filter((m) => m.text && m.text.trim())
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

  const config = {
    systemInstruction: opts.system,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
  };

  let finalText = '';
  let steps = 0;

  for (; steps < MAX_STEPS; steps++) {
    const response = await ai.models.generateContent({ model: MODEL, contents, config });
    const parts: Part[] = response.candidates?.[0]?.content?.parts ?? [];
    contents.push({ role: 'model', parts });

    for (const p of parts) {
      if (typeof p.text === 'string' && p.text.trim()) finalText = p.text;
    }

    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
    if (calls.length === 0) break;

    const respParts: Part[] = [];
    for (const call of calls) {
      const result = await runTool(call.name ?? '', (call.args ?? {}) as Record<string, unknown>, opts.ctx);
      respParts.push({ functionResponse: { name: call.name ?? '', response: result as Record<string, unknown> } });
    }
    contents.push({ role: 'user', parts: respParts });
  }

  return { reply: finalText.trim() || '처리했어요.', changed: opts.ctx.changed.v, steps };
}
