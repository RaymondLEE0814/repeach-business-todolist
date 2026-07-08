# [계획] Mindash 팀(그룹) 워크스페이스

> 핵심 로직·설계: **Fable 모델** 작성 · 구현: **Opus 4.8**
> 작성일: 2026-06-10 · 구현 대상: [`mindash/`](../mindash/)
> 이슈 트래커: [team-workspace-issues.md](team-workspace-issues.md)

## 설계 원칙 (한 줄)
모든 접근 제어가 `projects.owner_id`로 수렴하는 현 구조를 유지하고, **`projects.team_id`(nullable) 하나만 추가**해서:
- `team_id IS NULL` → 개인 프로젝트(기존 규칙 그대로, 하위호환)
- `team_id IS NOT NULL` → 팀 프로젝트(소속 팀원 접근 OR 규칙 추가)

전 테이블 단일 술어: `접근 = (owner_id = auth.uid()) OR (team_id IS NOT NULL AND is_team_member(team_id))`

**무한재귀 차단**: RLS 정책 안에서 `team_members`를 직접 서브쿼리하면 `infinite recursion` 발생 → 판정은 전부 `SECURITY DEFINER` 헬퍼 함수(`is_team_member`, `team_role`, `can_access_project`, `shares_team_with`)로 캡슐화.

## 데이터 모델 (신규/변경)
```sql
-- teams(id uuid pk, name, owner_id→auth.users, created_at)
-- team_members(team_id, user_id, role[leader|admin|member], joined_at, pk(team_id,user_id))
-- team_invites(id, team_id, email(lower), role, token uuid unique, status[pending|accepted|declined|revoked|expired],
--              invited_by, accepted_by, created_at, expires_at=+7d)  -- pending 중복 방지 partial unique(team_id,email)
-- projects  += team_id uuid null references teams on delete set null   (팀 삭제 시 개인 프로젝트로 강등=데이터 보존)
-- todos     += assigned_to uuid, completed_by uuid, completed_at timestamptz
-- subtasks  += done_by uuid
```
헬퍼 함수: `is_team_member(team)`, `team_role(team)`, `can_access_project(project_id text)`, `shares_team_with(user)` — 모두 `security definer set search_path=public stable`.
RPC: `create_team(name)`, `accept_team_invite(token)`, `decline_team_invite(token)`, `get_invite_preview(token)`, `transfer_leadership(team,new)`, `team_progress(team)`.

## 권한 매트릭스 (요약)
| 행동 | leader | admin | member |
|---|---|---|---|
| 팀 보기/멤버 목록 | O | O | O |
| 팀 이름변경 | O | O | X |
| 팀 삭제 | O | X | X |
| 멤버 초대/취소 | O | O | X |
| 역할 변경 | O | X | X |
| 멤버 강퇴 | O | O(member만) | X |
| 팀 프로젝트 CRUD(할일/카테고리/서브) | O | O | O |
| 팀 프로젝트 삭제/이름변경 | O | O | X |
| 팀원 진행상황(집계) 조회 | O | O | X(본인만) |

## RLS 핵심
- teams/team_members/team_invites: 헬퍼로 판정(재귀 회피). 초대는 token으로 SELECT 열지 않음(수락은 RPC).
- projects/categories/todos/subtasks: 기존 "own" 정책 drop → `can_access_project`(owner OR 팀원) 기반 정책으로 교체.
- profiles: 같은 팀이면 서로 이름/이메일 조회 가능(`shares_team_with`) — 팀장 대시보드용.

## 초대 흐름 (SMTP 미연결 → 링크 코드)
초대 생성 → **초대 링크 `/invite/<token>` 복사 버튼**(카톡 등으로 전달) → 접속(미로그인 시 `/login?next=`) → `get_invite_preview` → 수락(`accept_team_invite` RPC, 이메일 일치 검증 + 원자적 멤버 추가). 대시보드에 "내 이메일로 온 pending 초대" 배너로 복구 경로 제공. 추후 Resend 연결 시 같은 링크를 메일 발송만 추가.

## 진행상황 가시성
`todos.completed_by/completed_at` + `assigned_to` 기반. 팀원은 팀 프로젝트 todos를 RLS로 이미 읽을 수 있어 특권 우회 불필요. `team_progress(team)` RPC로 팀원별 담당완료율·최근7일완료·마지막활동 집계(첫 줄 `team_role in(leader,admin)` 게이트).

## UI 변경 (과한 재작성 없이)
- **컨텍스트 스위처**(대시보드 상단): [내 워크스페이스][팀 A][팀 B] → projects를 team_id로 필터해 기존 Workspace에 전달. Workspace는 거의 무변경.
- `/dashboard/team/[id]`: 멤버·초대·역할 관리.
- `/dashboard/team/[id]/progress`: 팀장 진행상황.
- `/invite/[token]`: 수락 페이지.
- Workspace 변경점: (a) 프로젝트 생성 시 현재 컨텍스트 team_id 포함, (b) toggle에 completed_by/at 세팅, (c) refreshGlobalXp를 completed_by=나로 필터(⚠️ 필수 동반수정), (d) member면 삭제 버튼 숨김.

## 챗봇(tools.ts) 영향
RLS만으로 팀 프로젝트 자동 인식. 조정: list_projects/todos에 team_id·팀명 표기, add_todo 폴백을 개인 프로젝트 우선, complete_todo에 completed_by/at 세팅, create_project에 team 파라미터(선택). ToolCtx 구조 무변경.

## 단계별 구현 (Opus)
- **P1 데이터+RLS** (`migration_teams.sql` 1본 + 클라 소폭): 테이블/컬럼/backfill, 헬퍼 4 + create_team, 정책 교체, XP 오염 수정, 하위호환 검증(계정 2개).
- **P2 초대**: accept/decline/preview RPC, `/invite/[token]`, pending 배너.
- **P3 팀 워크스페이스 UI**: 스위처, 팀 관리 화면, team_id-aware 생성/역할별 버튼, tools.ts 조정.
- **P4 팀장 진행상황**: team_progress RPC, progress 화면, 최근 완료 피드.

## 하위호환 원칙
team_id null 경로는 기존 정책과 논리 동치 → 기존 개인 워크스페이스·챗봇 쿼리 무수정 동작. 단 정책 이름이 바뀌므로 drop 목록을 마이그레이션에 정확히 포함.

---
전체 상세 설계(SQL 스케치·RPC 본문·상태 다이어그램)는 이 문서의 근거가 된 Fable 설계 원문 기준이며, 구현 시 각 P 단계 커밋 메시지와 마이그레이션 파일에 반영한다.
