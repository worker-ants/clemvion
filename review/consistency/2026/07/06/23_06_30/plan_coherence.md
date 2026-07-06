# Plan 정합성 Check — spec/data-flow/8-notifications.md (impl-done)

## 조사 메모

전달받은 payload 의 "진행 중 plan 문서 모음" 절에는 `ai-agent-tool-connection-rewrite.md` /
`cafe24-backlog-residual.md` / `chat-channel-discord-gateway.md` / `chat-channel-slack-socket-mode.md` /
`chat-channel-visual-ssr-png.md` 5개만 포함돼 있었으나, 실제 `plan/in-progress/` 디렉터리에는 본 target
과 직접 관련된 `notif-hardening-followups.md` / `spec-update-notifications-background-run-id.md` /
`spec-update-notifications-firing.md` / `spec-sync-data-flow-8-notifications-gaps.md` 가 존재해 payload
누락으로 판단, 워크트리에서 직접 Read 해 검토했다.

## 발견사항

검토 결과 CRITICAL/WARNING 급 불일치는 발견되지 않았다.

- **[INFO]** `spec-update-notifications-background-run-id.md` 완료 후 미이관
  - target 위치: 없음 (plan 라이프사이클 사안)
  - 관련 plan: `plan/in-progress/spec-update-notifications-background-run-id.md` 전체
  - 상세: 해당 plan 의 "flip / 갱신 대상" 6개 항목이 모두 `[x]` 이고, `spec/data-flow/8-notifications.md`
    §1.1(`background_failed`/`execution_failed` 행), §2.1(`notification` 적재·조회 행), Rationale
    ("딥링크와 attribution 을 별도 컬럼으로 분리") 이 실제로 해당 내용을 전부 반영하고 있음을 확인했다.
    `spec/1-data-model.md §2.19`, `spec/4-nodes/1-logic/12-background.md §8.2` 갱신 여부는 본 target 범위
    밖이라 직접 재확인하지 않았으나 plan 상 완료 표기됨. 완료 조건("`/consistency-check --spec` BLOCK:NO")
    까지 충족되면 `plan/complete/` 로 이관 대상이다.
  - 제안: 본 PR 또는 후속 커밋에서 plan-lifecycle 규칙에 따라 `plan/complete/` 로 이동 (developer/planner
    워크플로 통상 절차 — 코드 자체의 문제는 아님).

- **[INFO]** `notif-hardening-followups.md` 항목 3 (dispatchEmails 동기 처리) 미결 — target 과 정합 확인
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 `team_invite` 행 ("UX 재검토 대기" 각주)
  - 관련 plan: `plan/in-progress/notif-hardening-followups.md` 항목 3, `plan/in-progress/spec-update-notifications-firing.md`
    "team_invite 이메일 2통" 미결 항목
  - 상세: 두 plan 모두 `team_invite` 채널/이메일 중복 UX 를 "사용자 판단 대기" 로 명시적으로 열어두고 있다.
    target 문서(§1.1 `team_invite` 행)도 동일하게 "UX 재검토 대기(`spec-update-notifications-firing.md`)" 로
    각주 처리하고 있어 **일방적 결정 없이 미해결 상태를 그대로 반영**했다. 충돌 없음.
  - 제안: 조치 불요 — 향후 이 결정이 나면 두 plan + target §1.1/Rationale 을 함께 갱신.

- 그 외 `background_run_id` 컬럼 신설, 딥링크/attribution 분리, `execution_failed` 재개세그먼트 dispatch 추가,
  `ModuleRef` 지연 해석 등 본 diff 의 핵심 변경 사항은 모두 `notif-hardening-followups.md` 항목 1·2 의 설계
  결정("option a — 별도 필드", "버그 A/B" 근인 분석)과 1:1 대응하며, 해당 plan 의 체크리스트도 전부 `[x]` 로
  구현 완료를 기록하고 있어 **선행 plan 미해소나 후속 항목 누락은 확인되지 않았다.**
- `execution-engine-residual-gaps.md` 등 다른 in-progress plan 에서 `notificationsService`/`forwardRef`/
  `ModuleRef`/`dispatchExecutionFailedNotification`/`finalizeResumedExecutionOutcome` 관련 언급을 검색했으나
  매치 없음 — 본 diff 와 충돌하거나 무효화해야 할 후속 항목은 없다.

## 요약

Target(`spec/data-flow/8-notifications.md`)의 이번 변경은 `plan/in-progress/notif-hardening-followups.md`
(구현 트랙)와 `plan/in-progress/spec-update-notifications-background-run-id.md`(spec 반영 트랙)가 사전에
설계·기록한 결정을 그대로 코드/문서에 반영한 것으로, 두 plan 의 체크리스트가 모두 완료 처리돼 있고 target
문서 내용과 완전히 대응한다. `team_invite` 이메일 중복이라는 유일한 미해결 결정도 target 이 일방적으로
정하지 않고 "재검토 대기"로 정직하게 남겨 plan 과 정합한다. 유일한 지적은 실질적 비정합이 아니라 plan
라이프사이클 절차(완료된 spec-update plan 을 `plan/complete/` 로 이관)에 대한 INFO 메모다.

## 위험도
NONE
