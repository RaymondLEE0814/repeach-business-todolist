# [기능] 카드 드래그앤드롭 이동

> 설계: Fable / 구현: Opus 4.8 · 2026-06-11

## 범위 (Fable 권장)
- **Phase 1(구현 완료)**: 목록 뷰에서 **카드를 다른 카테고리(컬럼)로** 드래그 이동. @dnd-kit, 마이그레이션 0개.
- Phase 2(후순위): 컬럼 내 순서 재정렬 + 노드 위 드롭(자식으로) — position을 double precision으로.
- Phase 3(후순위, 승인 필요): **다른 프로젝트로** 이동 — DnD 아닌 카드 메뉴 + DEFERRABLE FK + RPC(마이그레이션 1개).

## Phase 1 구현
- `@dnd-kit/core` 설치, `app/dashboard/dnd.tsx`(DraggableTodo/DroppableColumn).
- 각 카드에 **드래그 핸들(⠿)** — 체크박스/링크/버튼 클릭과 충돌 없음. PointerSensor(distance 6) + TouchSensor(delay 200) → 모바일 long-press 대응.
- 컬럼=드롭존(`cat:<id>`), 드롭 시 `moveTodoToCategory`:
  - **서브트리 전체 이동**(collectSubtreeIds): 이동 노드는 새 카테고리+최상위(parent_id=null), 자손은 category_id만 일괄.
  - 낙관적 업데이트 + **root 먼저** 규칙(부분 실패 안전) + 실패 시 롤백/재로딩.
- DragOverlay에 제목 + "하위 N" 배지, 드롭 컬럼 하이라이트, 드래그 중 원본 반투명.
- 완료/XP 무영향(이동은 completed 불변). RLS: 같은 프로젝트 update = 팀원 전원 가능.

## 남은 것
- Phase 2/3는 승인 시 진행. Phase 3는 마이그레이션(DEFERRABLE FK + move RPC) 필요.
