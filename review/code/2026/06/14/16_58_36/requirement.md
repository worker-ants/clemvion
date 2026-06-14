# 요구사항(Requirement) Review

## 발견사항

### [INFO] [SPEC-DRIFT] `terminal-revoke-reconcile` 큐가 BullMQ 큐 카탈로그(spec §4)·시스템 상태 spec 레지스트리에 미등재
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` (MONITORED_QUEUES 추가) / `spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그` / `spec/5-system/16-system-status-api.md §1 대상 큐 레지스트리`
- 상세: 코드는 `TERMINAL_REVOKE_RECONCILE_QUEUE`(`terminal-revoke-reconcile`, group `system`, concurrency 1)를 `MONITORED_QUEUES`에 추가하고 e2e 기대 목록도 갱신했다. 그러나 BullMQ 큐 카탈로그의 단일 진실인 `spec/data-flow/0-overview.md §4` 표에는 해당 큐가 없으며, `spec/5-system/16-system-status-api.md §1` 레지스트리 표에도 누락됐다. 두 spec 모두 "큐 추가 시 본 표를 먼저 갱신하고 코드를 동기화"를 명시한다. 이 경우 코드가 의도적으로 큐를 도입한 것이 명확하고(이전 review 에서 검증 완료), spec 갱신이 후행하는 SPEC-DRIFT 상태다 — 코드가 틀린 것이 아니라 spec 이 낡았다.
- 제안: 코드 유지. spec 반영 대상: (1) `spec/data-flow/0-overview.md §4` 표에 `terminal-revoke-reconcile | external-interaction.module.ts | TerminalRevokeReconcilerService (onModuleInit upsertJobScheduler) | 동일 service (@Processor) | terminal execution 잔존 iext 토큰 at-least-once revoke 스윕` 행 추가. (2) `spec/5-system/16-system-status-api.md §1` 레지스트리 표에 `terminal-revoke-reconcile | system | 1 (기본) | repeatable cron` 행 추가. 반영은 `project-planner` 가 담당.

### [INFO] [SPEC-DRIFT] 코드 상수 주석의 `[Spec EIA §9.3 R15]` 참조 및 `EIA-RL-06` 식별자가 spec 본문에 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-token-codes-revoke-outbox-2639e5/codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L41 — `/** terminal revoke reconciliation sweep 의 단일 배치 기본 상한 ([Spec EIA §9.3 R15]). */`
- 상세: 코드 주석이 `[Spec EIA §9.3 R15]`를 인용하나, `spec/5-system/14-external-interaction-api.md` Rationale 섹션은 `R13`까지만 존재하며 `R15`가 없다. 마찬가지로 모듈 JSDoc 내 `EIA-RL-06` 도 spec §3.4 신뢰성 표에는 `EIA-RL-01`~`EIA-RL-05`만 있어 해당 ID가 없다. 이는 구현이 spec 보다 앞서 추가된 요구사항 ID 를 참조하는 SPEC-DRIFT 상태다 — 코드 기능 자체는 올바르고 spec 갱신이 누락된 것이다.
- 제안: 코드 유지. spec 반영 대상: `spec/5-system/14-external-interaction-api.md` — (a) §3.4 신뢰성 표에 `EIA-RL-06` 행 추가(terminal at-least-once revoke sweep). (b) Rationale 섹션에 `R14/R15` 항으로 "terminal revoke reconciler 설계 결정 (batchLimit 기본값 500, clamp [1, 1000], concurrency 20, removeOnComplete 24h / removeOnFail 7d)" 추가. 반영은 `project-planner` 가 담당.

### [INFO] `RECONCILE_TERMINAL_STATUSES` 명칭 변경 — 기능 동등성 확인됨
- 위치: `interaction-token.service.ts` diff L36-56
- 상세: 이전 `TERMINAL_STATUSES`(SQL `IN` 절용 배열)를 `RECONCILE_TERMINAL_STATUSES`로 리네임하고, 충돌 회피 이유를 JSDoc에 명시했다. 값 자체(`COMPLETED / FAILED / CANCELLED`)는 변경 없어 기능 동등성이 유지된다. `revokeAllForExecution`이 호출되는 대상 execution 집합이 바뀌지 않아 at-least-once semantics 에 영향 없다.
- 제안: 없음.

### [INFO] `system-status.e2e-spec.ts`의 `EXPECTED_QUEUE_NAMES` 목록 갱신 — 순서 일치 확인
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` diff L34 (`'terminal-revoke-reconcile'` 추가, `'notification-secret-rotator'` 뒤)
- 상세: `MONITORED_QUEUES` 상수에서 `NOTIFICATION_SECRET_ROTATOR_QUEUE` 직후에 `TERMINAL_REVOKE_RECONCILE_QUEUE`가 삽입되었고, e2e 기대 목록도 동일 위치에 추가되어 정합성이 유지된다.
- 제안: 없음.

## 요약

이번 변경의 코드 변경 범위는 세 파일: (1) `interaction-token.service.ts`의 `TERMINAL_STATUSES` → `RECONCILE_TERMINAL_STATUSES` 리네임(주석 보강), (2) `system-status.constants.ts`에 `TERMINAL_REVOKE_RECONCILE_QUEUE` 추가, (3) `system-status.e2e-spec.ts`의 기대 큐 목록 갱신. 세 변경 모두 의도한 기능 — terminal revoke reconciler 큐를 시스템 모니터링에 등록하고 constant 네이밍 충돌을 해소하는 것 — 을 완전하고 일관되게 구현한다. 엣지 케이스·에러 경로·비즈니스 로직 측면에서 새로운 문제는 발견되지 않는다. 요구사항 관점의 주요 갭은 spec 쪽 누락이다: `terminal-revoke-reconcile` 큐가 BullMQ 큐 카탈로그(`spec/data-flow/0-overview.md §4`)와 시스템 상태 레지스트리(`spec/5-system/16-system-status-api.md §1`)에 미등재이며, 코드가 참조하는 `EIA-RL-06`과 `R15`도 spec 본문에 아직 존재하지 않는다. 모두 코드가 spec 보다 앞선 SPEC-DRIFT로, 코드를 되돌리는 것이 아니라 spec 갱신이 해결 방법이다. 코드 수정을 요구하는 CRITICAL 또는 WARNING 발견사항은 없다.

## 위험도

NONE
