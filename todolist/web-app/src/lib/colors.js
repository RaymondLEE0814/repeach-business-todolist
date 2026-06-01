// Family 브랜드 팔레트 — 카테고리별 색상 인코딩(장식용 액센트)
export const BRAND_COLORS = [
  '#ff3e00', // ember orange
  '#00ca48', // meadow green
  '#0090ff', // sky blue
  '#ffbb26', // sunburst yellow
  '#9f4fff', // violet pop
  '#ff58ae', // flamingo
];

// 카테고리 id 문자열을 안정적으로 색상에 매핑
export const categoryColor = (id) => {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return BRAND_COLORS[h % BRAND_COLORS.length];
};
