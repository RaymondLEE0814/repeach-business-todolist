-- ============================================================
-- Mindash 마인드맵 무한 depth 트리 — todos.parent_id (자기참조)
-- 설계 Fable / 구현 Opus · SQL Editor에 붙여넣고 [Run] (ref xdxqmoeggvnlvjgxttdf)
-- 하위호환: parent_id NULL = 기존 flat/최상위 할 일 (백필 불필요)
-- ============================================================

-- 1) parent_id 컬럼
alter table public.todos add column if not exists parent_id text;

-- 2) 자기참조 복합 FK: PK (project_id,id) 참조 → 부모-자식 같은 프로젝트 강제 + CASCADE로 서브트리 원자 삭제
alter table public.todos drop constraint if exists todos_parent_fk;
alter table public.todos
  add constraint todos_parent_fk
  foreign key (project_id, parent_id)
  references public.todos (project_id, id)
  on delete cascade;

create index if not exists todos_parent_idx on public.todos (project_id, parent_id);

-- 3) 사이클/깊이 방어 트리거 (모든 쓰기 경로 공통)
create or replace function public.check_todo_parent()
returns trigger language plpgsql as $$
declare cur text; d int := 0;
begin
  if new.parent_id is null then return new; end if;
  if new.parent_id = new.id then raise exception '자기 자신을 부모로 둘 수 없습니다'; end if;
  cur := new.parent_id;
  while cur is not null loop
    d := d + 1;
    if d > 8 then raise exception '최대 깊이(8)를 초과했습니다'; end if;
    select parent_id into cur from public.todos where project_id = new.project_id and id = cur;
    if cur = new.id then raise exception '순환 참조는 허용되지 않습니다'; end if;
  end loop;
  return new;
end $$;

drop trigger if exists todos_parent_check on public.todos;
create trigger todos_parent_check
  before insert or update of parent_id on public.todos
  for each row execute function public.check_todo_parent();

-- 4) subtasks 고아 정리 후 FK(CASCADE) — 서브트리 삭제 시 자손의 체크리스트도 자동 정리
delete from public.subtasks s
  where not exists (select 1 from public.todos t where t.project_id = s.project_id and t.id = s.todo_id);
alter table public.subtasks drop constraint if exists subtasks_todo_fk;
alter table public.subtasks
  add constraint subtasks_todo_fk
  foreign key (project_id, todo_id)
  references public.todos (project_id, id)
  on delete cascade;
