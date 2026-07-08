// 마인드맵/목록의 무한 depth 트리 빌드 (순수 함수).
// 카테고리는 1단, 그 아래 할 일을 parent_id로 무한 중첩. flat 데이터(parent_id null)는 전부 depth 0 루트.

type Base = {
  id: string;
  category_id: string;
  parent_id: string | null;
  position: number | null;
  completed: boolean;
};

export type Node<T extends Base> = T & { children: Node<T>[]; depth: number };

export function buildTree<T extends Base>(items: T[]): {
  rootsByCategory: Map<string, Node<T>[]>;
  byId: Map<string, Node<T>>;
} {
  const byId = new Map<string, Node<T>>();
  for (const t of items) byId.set(t.id, { ...t, children: [], depth: 0 });

  const rootsByCategory = new Map<string, Node<T>[]>();
  for (const n of byId.values()) {
    const parent = n.parent_id ? byId.get(n.parent_id) : undefined;
    if (parent) parent.children.push(n);
    else {
      const arr = rootsByCategory.get(n.category_id) ?? [];
      arr.push(n);
      rootsByCategory.set(n.category_id, arr);
    }
  }

  const sortRec = (list: Node<T>[], depth: number) => {
    list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));
    for (const c of list) {
      c.depth = depth;
      if (depth < 20) sortRec(c.children, depth + 1); // 방어적 재귀 상한
    }
  };
  rootsByCategory.forEach((list) => sortRec(list, 0));
  return { rootsByCategory, byId };
}

// 자신 포함 서브트리 완료 집계
export function subtreeStats<T extends Base>(n: Node<T>): { total: number; done: number } {
  let total = 1;
  let done = n.completed ? 1 : 0;
  for (const c of n.children) {
    const s = subtreeStats(c);
    total += s.total;
    done += s.done;
  }
  return { total, done };
}

// 자신 포함 서브트리의 모든 id (로컬 삭제용)
export function collectSubtreeIds<T extends Base>(n: Node<T>): string[] {
  const out = [n.id];
  for (const c of n.children) out.push(...collectSubtreeIds(c));
  return out;
}
