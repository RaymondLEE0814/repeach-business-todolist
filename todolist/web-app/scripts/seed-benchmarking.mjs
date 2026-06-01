// 벤치마킹/레퍼런스 프로젝트를 DB에 시드하는 스크립트
// 사전조건: todos 테이블에 link 컬럼이 있어야 함 (supabase/migration_add_link.sql 실행)
// 실행: node scripts/seed-benchmarking.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const PROJECT_ID = 'benchmarking';
const PROJECT_NAME = '벤치마킹 / 레퍼런스';

const DATA = [
  { cat: '인스타그램', items: [
    ['AI 자료 인스타그램 채널', 'https://www.instagram.com/ai.ainow/', 'AI 자료/트렌드 참고용으로 보는 채널.'],
    ['Trenddalkak AI 인스타그램 채널', 'https://www.instagram.com/trenddalkak.ai?igsh=NmVlOHV5dW9wcG56', 'AI 활용 아이디어와 숏폼 콘텐츠 톤 참고용.'],
    ['웹사이트 제작 리스트', 'https://www.instagram.com/reel/DX3-RTMCSIA/?igsh=YW5jemVjdGNhYnV6', '웹사이트 제작 사례/구성 벤치마킹용.'],
    ['AI 카드뉴스 만드는 법', 'https://www.instagram.com/p/DYUvyHDmjSE/?img_index=3&igsh=NmJ1aDNkZmt6cm4x', '카드뉴스 형식과 제작 방식 참고용.'],
    ['인스타그램 영상 분석', 'https://www.instagram.com/reel/DYhMk6RCrnz/?igsh=OG9zZXpndGIyYWM4', '인스타 영상 포맷과 전개 방식 분석용.'],
  ]},
  { cat: '유튜브', items: [
    ['제미나이 주식투자 유튜브', 'https://www.youtube.com/watch?v=6vPW7teRFNo', 'AI를 활용한 주식투자 접근법 참고용.'],
    ['클로드 주식투자 유튜브', 'https://www.youtube.com/watch?v=QUvnwou7TKg', 'Claude 기반 투자 활용 아이디어 참고용.'],
  ]},
  { cat: '향후 공부 리스트', items: [
    ['클로드 코드에서 노트북LM 쓰는법', 'https://www.youtube.com/watch?v=BeSKY9jVwnQ', 'Claude Code와 NotebookLM 연계 활용 학습용.'],
    ['AI 비즈니스 10억 로드맵 공부할 내용', 'https://www.youtube.com/watch?v=pbapGhfo6Qk', 'AI 비즈니스 모델/수익화 아이디어 학습용.'],
    ['사업에서 AI 제대로 쓰는 법: 95%가 놓치는 ChatGPT 활용법 5가지', 'https://youtu.be/0hI7wNz7SBs?si=If1ZzKD4hj8Jkfrf', '실무형 AI 활용 전략 참고용.'],
  ]},
  { cat: '인터넷 사이트', items: [
    ['Tally', 'https://tally.so/', '폼/설문/리드수집 UX 참고용.'],
    ['Tilnote - Claude Code에서 Codex 플러그인 활용법 및 설치 가이드', 'https://tilnote.io/pages/69cb42b3380f446d3fa9ce51', 'Claude Code/Codex 실사용 가이드 참고용.'],
    ['에듀싱크 전자칠판회사', 'https://www.edusync.kr/?utm_source=threads&utm_medium=social&utm_content=link_in_bio', '교육 서비스/전자칠판 관련 사이트 구성 벤치마킹용.'],
    ['Programming Zombie 벤치마킹 사이트', 'https://programmingzombie.com/?utm_source=threads&utm_medium=social&utm_content=link_in_bio', '사이트 구조, 메시지, 브랜딩 톤 벤치마킹용.'],
  ]},
  { cat: '네이버 카페', items: [
    ['에이아이 나우 카페 벤치마킹', 'https://cafe.naver.com/ainows25', '커뮤니티 운영 방식과 콘텐츠 구성 벤치마킹용.'],
  ]},
  { cat: '책', items: [
    ['YES24 참고 도서/상품 페이지', 'https://www.yes24.com/product/goods/175889076', '관련 도서/상품 기획 참고용.'],
  ]},
];

const categories = DATA.map((d, i) => ({ project_id: PROJECT_ID, id: `bm-cat-${i + 1}`, name: d.cat, position: i }));
const todos = [];
DATA.forEach((d, ci) => {
  d.items.forEach(([title, link, notes], ti) => {
    todos.push({
      project_id: PROJECT_ID, id: `bm-${ci + 1}-${ti + 1}`, category_id: `bm-cat-${ci + 1}`,
      title, link, notes, completed: false, assignee: '', progress: '0', position: todos.length,
    });
  });
});

await supabase.from('projects').upsert({ id: PROJECT_ID, name: PROJECT_NAME });
const { error: cErr } = await supabase.from('categories').upsert(categories);
if (cErr) { console.error('카테고리 저장 실패:', cErr); process.exit(1); }
const { error: tErr } = await supabase.from('todos').upsert(todos);
if (tErr) { console.error('할일 저장 실패 (link 컬럼이 있는지 확인하세요):', tErr); process.exit(1); }

const { count } = await supabase.from('todos').select('*', { count: 'exact', head: true }).eq('project_id', PROJECT_ID);
console.log(`✅ 벤치마킹 프로젝트 시드 완료 — 카테고리 ${categories.length}개 / 참고자료 ${count}개`);
