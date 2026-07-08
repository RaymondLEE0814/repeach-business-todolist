# [계획] 마인드맵 무한 depth 트리

> 설계: **Fable** / 구현: **Opus 4.8** · 2026-06-10 · 대상 [`mindash/`](../mindash/)

## 결론(옵션 A)
카테고리는 1단 브랜치로 유지, **`todos.parent_id`(복합 self-FK `(project_id,parent_id)→(project_id,id)`, ON DELETE CASCADE)** 하나만 추가 → 할 일을 무한 중첩. 최소 변경으로 목표 달성, 전 기능 하위호환.
- 자식 todo는 부모의 `category_id` 상속(불변식) → 기존 update/삭제/진행률 쿼리 그대로 재사용.
- RLS: `can_access_project(project_id)` 그대로(무변경, 재귀 위험 없음).
- 완료 롤업: **노드 독립**(자동 연쇄 없음) → 개인 XP(completed_by=나) 오염 방지. 부모엔 서브트리 진행률만 표시.
- 트리는 프로젝트 단위 1쿼리 로드 후 **클라이언트 buildTree**(재귀 CTE 불필요).

## 확정(열린질문 → Fable 권장 기본값)
- UI 최대 깊이 5 / DB 트리거 하드리밋 8
- 부모 체크: 미완료 자식 있어도 허용(강제 롤업 X)
- 목록 뷰: 들여쓰기 재귀 표시
- 노드 이동(부모변경): 후순위(초기 릴리스 제외)
- subtasks(체크리스트) 존치 — 하위 todo(정식 작업)와 역할 구분
- 챗봇 add_todo `parent` 파라미터: 포함

## 마이그레이션 (migration_tree.sql)
parent_id 컬럼 + 복합 FK(CASCADE) + `todos_parent_idx` + 사이클/깊이 트리거(before insert/update of parent_id) + subtasks 고아정리 후 FK(CASCADE).

## 구현 단계
- P0 마이그레이션
- P1 `lib/tree.ts`(buildTree/subtreeStats/collectSubtreeIds) + load select에 parent_id,position + useMemo 트리
- P2 마인드맵 재귀 렌더(MindNode) + expanded 확장 + mm CSS(중첩 연결선은 기존 mm-leaves 재귀로 공짜)
- P3 "+ 하위/+ 할 일" 추가, 서브트리 삭제(CASCADE + 로컬 자손 제거), 깊이 제한
- P4 목록 뷰 들여쓰기 재귀, TodayView 상위 라벨
- P5 챗봇 add_todo parent

## 엣지케이스(요지)
사이클=클라검증+DB트리거 이중, 깊이폭주=UI5/DB8, 고아=FK차단+buildTree 루트승격, 카테고리경계=상속불변식, 기존데이터=백필 불필요(NULL=현행).
