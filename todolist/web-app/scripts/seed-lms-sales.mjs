// 노동청 환급 LMS / 평생교육사 영업 프로젝트를 DB에 시드하는 스크립트
// 원본: todolist_LMS_sales/lms_sales.md
// 실행: node scripts/seed-lms-sales.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const PROJECT_ID = 'lms_sales';
const PROJECT_NAME = '노동청 환급 LMS 영업';

const DATA = [
  { cat: '평생교육사 실무교육 시장조사', items: [
    '평생교육사 자격/실무교육 제도 조사',
    '노동청 환급과정(고용보험 환급) 등록 요건 조사',
    '평생교육사 실무교육 수요 규모 추정',
    '경쟁 교육기관 리스트업',
    '경쟁사 커리큘럼/가격 분석',
    '환급 단가·환급률 구조 파악',
    '타겟 수강생/기관 페르소나 정의',
    '시장조사 결과 리포트 작성',
  ]},
  { cat: '교과목·과정 설계 (AI활용 상품 다학과)', items: [
    '평생교육사 실무교육 교과목 목록 정리',
    '학과(다학과)별 과정 구성안 작성',
    'AI 활용 교과목 상품 기획',
    '과정별 학습목표/커리큘럼 설계',
    '차시별 강의계획서 작성',
    '교안·교재 제작 계획 수립',
    '강사 풀 확보 계획',
    '노동청 환급과정 인가 신청 준비',
    '과정 운영 일정/기수 설계',
  ]},
  { cat: 'LMS 공급 비즈니스 (등록 1300개 업체)', items: [
    '노동청 환급과정 등록 1300개 업체 리스트 확보',
    '업체 데이터 정제·세그먼트 분류',
    'LMS 공급 가치 제안(밸류) 정의',
    'LMS 도입 패키지/가격정책 설계',
    '파일럿 도입 업체 후보 선정',
    '업체 컨택 우선순위 정리',
    '아웃바운드 영업 시퀀스 설계',
    'LMS 데모 환경 준비',
    '계약·공급 프로세스 정의',
  ]},
  { cat: '기술기반 영업 채용', items: [
    '기술영업(SI) 직무 정의',
    '채용 JD 작성',
    '채용 공고 게시',
    '급여/인센티브 구조 설계',
    '면접 질문지 작성',
    '기술 이해도 평가 기준 정의',
    '후보자 인터뷰 진행',
    '온보딩·제품교육 자료 준비',
  ]},
  { cat: 'SI 소개서·제안서 제작', items: [
    'SI 사업 소개서 목차 구성',
    '회사 역량/레퍼런스 정리',
    'SI 수행 프로세스 정리',
    '제안서 템플릿 제작',
    '고객 유형별 제안서 커스터마이징 가이드',
    '견적 산정 기준 정리',
    '제안서 디자인·PDF 제작',
  ]},
  { cat: '기술 소개서 제작', items: [
    'LMS 기술 아키텍처 정리',
    '핵심 기능 명세 정리',
    'AI 기능 설명 정리',
    '보안/DRM 기능 설명 정리',
    '연동·확장성 설명 정리',
    '기술 스택/인프라 소개 정리',
    '기술 소개서 디자인·PDF 제작',
  ]},
];

const categories = DATA.map((d, i) => ({ project_id: PROJECT_ID, id: `lms-cat-${i + 1}`, name: d.cat, position: i }));
const todos = [];
DATA.forEach((d, ci) => {
  d.items.forEach((title, ti) => {
    todos.push({
      project_id: PROJECT_ID, id: `lms-${ci + 1}-${ti + 1}`, category_id: `lms-cat-${ci + 1}`,
      title, completed: false, notes: '', assignee: '', progress: '0', link: '', position: todos.length,
    });
  });
});

await supabase.from('projects').upsert({ id: PROJECT_ID, name: PROJECT_NAME });
const { error: cErr } = await supabase.from('categories').upsert(categories);
if (cErr) { console.error('카테고리 저장 실패:', cErr); process.exit(1); }
const { error: tErr } = await supabase.from('todos').upsert(todos);
if (tErr) { console.error('할일 저장 실패:', tErr); process.exit(1); }

const { count } = await supabase.from('todos').select('*', { count: 'exact', head: true }).eq('project_id', PROJECT_ID);
console.log(`✅ 노동청 환급 LMS 영업 프로젝트 시드 완료 — 카테고리 ${categories.length}개 / 할 일 ${count}개`);
