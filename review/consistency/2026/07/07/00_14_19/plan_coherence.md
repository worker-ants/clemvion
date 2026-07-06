### 발견사항

- **[INFO]** planner 위임 plan 2건이 완료 상태이나 `in-progress`에 잔류
  - target 위치: (spec 본문 문제 아님 — plan 파일 상태)
  - 관련 plan: `plan/in-progress/spec-update-notifications-background-run-id.md`, `plan/in-progress/spec-update-notifications-firing.md` (둘 다 `owner: planner`, `worktree: (unstarted)`)
  - 상세: 두 plan 이 요구한 flip 항목(§2.1/§1.1/§2.19/Rationale/12-background §8.2, §1.1 표 3종 상태 flip)이 developer 커밋 `04386bdd4`(SPEC-DRIFT reverse-flow, `notif-hardening-followups.md` 항목1 참조)에서 이미 전부 반영되어 target 문서와 실측 일치함(grep 으로 `background_run_id`/`findByBackgroundRun`/`execution_failed`/`schedule_failed`/`team_invite` 행 확인). 그러나 두 plan 파일 자체의 체크박스는 `[x]`로 이미 표시돼 있음에도 `plan/complete/`로 이동되지 않은 채 in-progress 에 남아 있다. `spec-sync-data-flow-8-notifications-gaps.md`(PR3 tracker)도 marketplace_update 를 제외한 전 항목 `[x]`로 target 과 정합.
  - 제안: project-planner 가 두 plan 을 완료 확인 후 `plan/complete/`로 이동(plan-lifecycle.md 절차). target 문서에는 갱신 불필요 — 이미 실제 코드·spec 반영 상태가 plan 서술과 일치.

- **[INFO]** `team_invite` 이메일 2통 UX 재검토는 target 에 정직하게 노출됨
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 표 `team_invite` 행 (line 74)
  - 관련 plan: `plan/in-progress/spec-update-notifications-firing.md` "team_invite 이메일 2통 (side-effect 재검토) — planner 결정 대기(OPEN)"
  - 상세: target 문서가 "⚠ 초대 링크 이메일과 별개라 기존 가입자는 이메일 2통 — UX 재검토 대기(`spec-update-notifications-firing.md`)" 로 미해결 결정을 명시적으로 남겨두고 있어, 일방적 결정 우회가 아니라 plan 이 요구한 대로 open 상태를 정확히 반영한 정상 사례.
  - 제안: 없음(현행 유지). planner 가 (a)/(b)/(c) 중 하나를 확정하면 이 행과 plan 항목을 함께 갱신.

- **[INFO]** §4.4(execution-engine) ModuleRef 지연 해석 패턴 미문서화는 target 범위 밖 별도 트랙으로 이미 추적됨
  - target 위치: 해당 없음 (target 은 `spec/data-flow/8-notifications.md`, 이 이슈는 `spec/5-system/4-execution-engine.md §4.4`)
  - 관련 plan: `spec-update-notifications-background-run-id.md` 후속 항목 `[ ]`, `notif-hardening-followups.md` "후속(followup)" 섹션 `[ ] [planner] spec §4.4 ModuleRef 문서화`
  - 상세: 코드(`getNotificationsService` ModuleRef strict:false 지연 해석)는 구현됐고 `spec/5-system/4-execution-engine.md §4.4`는 현재 `forwardRef` 패턴만 서술, ModuleRef 지연 해석 패턴은 미기재. 그러나 이는 target 문서(8-notifications.md)의 책임 범위가 아니며, 두 plan 모두 이를 별도 planner 잔여 항목으로 명확히 추적 중이라 정합성 위반이 아님.
  - 제안: 없음(다른 target 문서 갱신 시점에 처리될 사안). 참고로만 기록.

### 요약
target 문서(`spec/data-flow/8-notifications.md`)는 관련 in-progress plan 4건(`spec-sync-data-flow-8-notifications-gaps.md`, `notif-hardening-followups.md`, `spec-update-notifications-firing.md`, `spec-update-notifications-background-run-id.md`)이 서술하는 결정·구현 사실과 grep 실측 기준으로 완전히 정합한다. `background_run_id` 컬럼 신설/딥링크-attribution 분리, `execution_failed`/`schedule_failed`/`team_invite` 발사 flip 이 모두 target 에 반영됐고, 미해결로 남긴 `team_invite` 이메일 2통 UX 결정도 각주로 정직하게 노출되어 일방적 결정 우회가 없다. 유일한 잔여 사항은 이미 완료된 두 planner-owned plan 파일이 아직 `plan/complete/`로 이동되지 않은 lifecycle 정리 누락과, target 범위 밖의 §4.4 ModuleRef 문서화 후속 항목(이미 별도 추적 중)으로, 둘 다 CRITICAL/WARNING 급 충돌이 아닌 INFO 수준 메모다.

### 위험도
NONE
