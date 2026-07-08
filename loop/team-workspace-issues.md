# [이슈] 팀 워크스페이스 — 엣지케이스 & 열린 질문

> 짝 문서: [team-workspace-plan.md](team-workspace-plan.md) · 설계: Fable / 구현: Opus 4.8

## 엣지케이스 (구현 시 반드시 처리)
| # | 이슈 | 처리 방침 | 상태 |
|---|---|---|---|
| 1 | RLS 무한재귀 (team_members 정책→team_members) | SECURITY DEFINER 헬퍼로만 판정. 정책 본문 직접 서브쿼리 금지(주석 명문화) | 대기 |
| 2 | 마지막 leader 탈퇴/계정삭제 | 탈퇴 정책 `role<>'leader'`로 셀프삭제 차단 + `transfer_leadership` RPC. 팀 cascade 삭제 시 projects는 `set null`로 개인 강등(데이터 보존) | 대기 |
| 3 | 개인→팀 프로젝트 이전 | `update projects set team_id=X`, with check가 소속 강제. UI "팀으로 이동" | 대기 |
| 4 | **게임화 XP 오염** (팀 todos가 보이면 남의 완료까지 합산) | ⚠️P1 필수 동반수정: refreshGlobalXp를 `completed_by=userId`로 필터, subtasks는 `done_by`. backfill로 기존 XP 보존 | 대기 |
| 5 | 초대 만료 | expires_at 7일, 수락 RPC에서 지연 판정(cron 불필요) | 대기 |
| 6 | 초대 이메일 대소문자/중복 | `lower(trim(email))` + partial unique(pending) + 수락 시 on conflict do nothing | 대기 |
| 7 | 이미 멤버 초대 | 생성 전 안내 + 수락 RPC on conflict 방어 | 대기 |
| 8 | teams.owner_id 임의 변경 | update with check 또는 BEFORE UPDATE 트리거로 불변 강제(이양 RPC만 예외) | 대기 |
| 9 | member의 team_id 빼돌리기 | projects update using이 member 배제 + with check 미소속 팀 차단 | 대기 |
| 10 | 하위호환 | team_id null=기존과 논리 동치. drop 정책 목록 정확히 포함 | 대기 |
| 11 | 부분 삭제 사고 (deleteProject 수동 자식삭제) | member 버튼 숨김 + deleteProject 원자화(RPC 또는 FK cascade 정리) | 대기 |
| 12 | 성능 (can_access_project 행별 평가) | 필수 인덱스, 프로젝트 필터 유지, `(select auth.uid())` 최적화 | 대기 |
| 13 | profiles 노출 범위 | 같은 팀에게만 email/full_name, 초대 preview는 이메일 마스킹 | 대기 |
| 14 | Realtime 동시 편집 | P3 이후 Supabase Realtime 구독 검토(RLS 적용됨) | 보류 |

## 열린 질문 (사용자 확정 필요)
1. member의 팀 프로젝트 **생성** 허용? (Fable 제안: 허용)
2. member의 할 일 **삭제** 허용? (제안: 허용, 소규모 팀 가정)
3. 초대 수락 시 **이메일 일치 강제**? (제안: 강제 — 오픈 링크는 별도 '참여 코드'로)
4. **admin 역할** P1부터 UI 노출? (제안: 스키마엔 포함, UI는 leader/member 먼저)
5. **팀 게임화**: 개인 XP는 completed_by=나면 팀/개인 무관 지급 / 팀 리더보드는 추후 (제안대로?)
6. 팀 프로젝트에서 GameBar에 개인 vs 팀 진행률 표시 방식
7. 팀당 인원/팀 수 **제한(요금제 연동)** 여부 — teams에 limit 컬럼 미리 둘지
8. 초대 만료 7일 유지?

## 결정 로그
- (대기) 위 열린 질문 사용자 확정 후 P1 착수.
