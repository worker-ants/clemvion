---
worktree: gracious-darwin-6b9739
started: 2026-07-06
completed: 2026-07-06
owner: planner
spec_impact:
  - spec/data-flow/8-notifications.md
  - spec/2-navigation/9-user-profile.md
---

# spec-update — 발사 소스 3종 구현 반영 (Planned → 구현됨)

> 출처: 알림 파이프라인 PR3 (`notif-firing-sources-547d5c`) — `execution_failed`·`schedule_failed`·`team_invite` 발사 구현. developer 는 spec read-only 라 §1.1 표의 "미구현 (Planned)" → "구현됨" flip + 아래 결정 반영을 planner 위임 (impl-prep naming_collision WARNING + review side-effect).
> **착수 전 `/consistency-check --spec` 통과 의무.** [[spec-update-notifications-ws-emit]]·[[spec-update-notifications-email]] 와 별개 트랙(같은 spec 파일이므로 병합 처리 가능).

## flip 대상 — `spec/data-flow/8-notifications.md` §1.1 표

- [x] `execution_failed` 행: "미구현 (Planned)" → **구현됨** (`ExecutionEngineService.dispatchExecutionFailedNotification`). 수신자 "워크플로우 owner / 실행자". **top-level 실행만**(`!parentExecutionId` — background body/sub-workflow 하위 실행 제외, `background_failed` 와 중복 회피)임을 조건 열에 명시.
- [x] `schedule_failed` 행: "미구현 (Planned)" → **구현됨** (`ScheduleRunnerService.dispatchScheduleFailedNotification`). 조건을 **"스케줄이 execution 을 시작하지 못함(파라미터 해석·enqueue 실패)"** 으로 구체화 — 시작된 execution 의 async 실패는 `execution_failed` 가 커버(중복 아님). 수신자=워크플로우 owner.
- [x] `team_invite` 행: "미구현 (Planned)" → **구현됨** (`WorkspaceInvitationsService.dispatchTeamInviteNotification`). 조건 "기존 가입자(비멤버) 초대 시", channel=both.
- [x] (유지) `marketplace_update` 는 마켓플레이스 backlog 차단이라 Planned 유지.

## 채널 정합 (impl-done cross_spec CRITICAL — 코드로 해소됨)

- `execution_failed`/`schedule_failed` 는 `channel: 'both'`(인앱+이메일)로 발사 — `spec/2-navigation/9-user-profile.md §5.1` "워크플로우 실행 실패"/"스케줄 실행 실패" 기본채널(토글 미구현이라 고정)과 정합. `team_invite` 도 §5.1 "팀 초대"=인앱+이메일과 정합(both). **§5.1 변경 불요** — 코드가 §5.1 을 이미 따름. (초기 in_app 하드코딩이 §5.1 과 모순이던 것을 코드 수정으로 해소.)

## 반영할 결정/주의 (§1.1/§2.1 + Rationale)

- [x] **resource_type 공유 주의 — 해소됨**: 초기 `execution_failed` `resource_type='execution'`/`executionId` 는 (a) `background_failed` fallback 과 키공간 공유 (b) 팝오버 딥링크(`href.ts` `/workflows/<resource_id>`)가 workflow id 를 기대하는데 execution id 를 채워 404, 두 문제가 있었다. impl-done cross_spec/naming_collision CRITICAL 로 **resource_type='workflow' / resource_id=workflow.id** 로 정정 — 딥링크 정합 + 키공간 공유도 자연 해소. (§1.1 표에 반영 완료.)
- [x] **team_invite 이메일 2통 (side-effect 재검토) — 결정 (c) 채택 (2026-07-06)**: 기존 가입자는 초대링크 이메일(`dispatchEmail`)에 더해 `team_invite`(channel=both)의 알림 이메일도 받아 총 2통이었다. 후자는 토큰 없는 범용 알림 이메일(CTA=`/dashboard`)이라 기능적으로 더 약해 중복·혼란. 검토안: (a) 현행 유지(2통), (b) 초대링크 이메일 생략 — **기각**(생략되는 것이 유일한 수락 토큰 이메일이라 이메일 수락 경로가 사라지는 기능 회귀), (c) **team_invite 를 channel=in_app 로 하향 — 채택**(이메일 채널은 토큰 담은 초대링크 이메일이 단독 담당, 인앱 벨은 알림 record 담당). 반영: `spec/data-flow/8-notifications.md` §1.1 team_invite 행 + Rationale "team_invite 채널 — 이메일 중복 회피" 신설, `spec/2-navigation/9-user-profile.md` §5.1 팀 초대 각주, `workspace-invitations.service.ts`/`.spec.ts` `channel: 'both'→'in_app'`. `/consistency-check --spec` BLOCK:NO.

## 완료 조건
- [x] 위 flip + 결정 반영 + `/consistency-check --spec` BLOCK:NO. tracker `spec-sync-data-flow-8-notifications-gaps.md` 3개 체크박스는 PR3 코드 PR 에서 `[x]`.
- [x] team_invite 2통 UX 결정 (c) 채택 — spec §1.1/§5.1/Rationale + 코드/테스트 반영, consistency BLOCK:NO (`review/consistency/2026/07/06/20_57_56/SUMMARY.md`).

**완료 (2026-07-06)** — 모든 항목 처리 완료, `plan/complete/` 로 이동.
