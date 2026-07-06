---
worktree: (unstarted)
started: 2026-07-06
owner: planner
---

# spec-update — 발사 소스 3종 구현 반영 (Planned → 구현됨)

> 출처: 알림 파이프라인 PR3 (`notif-firing-sources-547d5c`) — `execution_failed`·`schedule_failed`·`team_invite` 발사 구현. developer 는 spec read-only 라 §1.1 표의 "미구현 (Planned)" → "구현됨" flip + 아래 결정 반영을 planner 위임 (impl-prep naming_collision WARNING + review side-effect).
> **착수 전 `/consistency-check --spec` 통과 의무.** [[spec-update-notifications-ws-emit]]·[[spec-update-notifications-email]] 와 별개 트랙(같은 spec 파일이므로 병합 처리 가능).

## flip 대상 — `spec/data-flow/8-notifications.md` §1.1 표

- [ ] `execution_failed` 행: "미구현 (Planned)" → **구현됨** (`ExecutionEngineService.dispatchExecutionFailedNotification`). 수신자 "워크플로우 owner / 실행자". **top-level 실행만**(`!parentExecutionId` — background body/sub-workflow 하위 실행 제외, `background_failed` 와 중복 회피)임을 조건 열에 명시.
- [ ] `schedule_failed` 행: "미구현 (Planned)" → **구현됨** (`ScheduleRunnerService.dispatchScheduleFailedNotification`). 조건을 **"스케줄이 execution 을 시작하지 못함(파라미터 해석·enqueue 실패)"** 으로 구체화 — 시작된 execution 의 async 실패는 `execution_failed` 가 커버(중복 아님). 수신자=워크플로우 owner.
- [ ] `team_invite` 행: "미구현 (Planned)" → **구현됨** (`WorkspaceInvitationsService.dispatchTeamInviteNotification`). 조건 "기존 가입자(비멤버) 초대 시", channel=both.
- [ ] (유지) `marketplace_update` 는 마켓플레이스 backlog 차단이라 Planned 유지.

## 반영할 결정/주의 (§1.1/§2.1 + Rationale)

- [ ] **resource_type 공유 주의** (impl-prep naming_collision WARNING): `execution_failed` 는 `resource_type='execution'`/`resource_id=executionId` 사용 — `background_failed` 의 옛 NodeExecution fallback 과 같은 키공간. §2.1 표에 `execution_failed`→`execution` 명시 + "두 계열이 동일 값 공유(현 소비처 `background-runs` 는 `background_run` 스코프)" 각주. (코드엔 이미 상호참조 주석 존재.)
- [ ] **team_invite 이메일 2통 (side-effect 재검토)**: 기존 가입자는 초대링크 이메일(`dispatchEmail`)에 더해 `team_invite`(channel=both)의 알림 이메일도 받는다 — 총 2통. spec-literal("in-app + 이메일 둘 다")로 구현했으나 UX 상 중복 가능. planner 결정: (a) 현행 유지(2통), (b) 기존 가입자에겐 초대링크 이메일 생략, (c) team_invite 를 channel=in_app 로 하향(초대링크 이메일이 email 측 담당). 결정 후 spec §1.1 team_invite 행·§관련 Rationale 에 명문화.

## 완료 조건
- 위 flip + 결정 반영 + `/consistency-check --spec` BLOCK:NO. tracker `spec-sync-data-flow-8-notifications-gaps.md` 3개 체크박스는 PR3 코드 PR 에서 `[x]`.
