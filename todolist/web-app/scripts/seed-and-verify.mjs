// 실제 supabase-js 클라이언트로 시드 데이터를 넣고 다시 읽어 검증하는 일회성 스크립트
// 실행: node scripts/seed-and-verify.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { getSeedData } from '../src/data/seedData.js';
import { getSeedDataGlobal } from '../src/data/seedDataGlobal.js';

// .env 직접 파싱 (Node는 Vite env를 자동 로드하지 않음)
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const PROJECTS = [
  { id: 'repeach', name: '리피치 비즈니스 파이프라인 구축', seed: getSeedData },
  { id: 'global_med', name: '글로벌 의약대 파운데이션 론칭', seed: getSeedDataGlobal },
];

for (const proj of PROJECTS) {
  const { categories, todos } = proj.seed();

  await supabase.from('projects').upsert({ id: proj.id, name: proj.name });

  const catRows = categories.map((c, i) => ({ project_id: proj.id, id: String(c.id), name: c.name, position: i }));
  const todoRows = todos.map((t, i) => ({
    project_id: proj.id, id: String(t.id), category_id: String(t.categoryId),
    title: t.title || '', completed: !!t.completed, notes: t.notes || '',
    assignee: t.assignee || '', progress: t.progress || '0', position: i,
  }));

  const { error: cErr } = await supabase.from('categories').upsert(catRows);
  if (cErr) { console.error(`[${proj.id}] 카테고리 저장 실패:`, cErr); process.exit(1); }
  const { error: tErr } = await supabase.from('todos').upsert(todoRows);
  if (tErr) { console.error(`[${proj.id}] 할일 저장 실패:`, tErr); process.exit(1); }

  const { count: catCount } = await supabase.from('categories').select('*', { count: 'exact', head: true }).eq('project_id', proj.id);
  const { count: todoCount } = await supabase.from('todos').select('*', { count: 'exact', head: true }).eq('project_id', proj.id);
  console.log(`✅ [${proj.id}] 카테고리 ${catCount}개 / 할 일 ${todoCount}개 DB 저장·확인 완료`);
}

console.log('\n🎉 Supabase 연결 + 읽기/쓰기 검증 성공');
