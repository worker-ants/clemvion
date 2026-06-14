# 신규 식별자 충돌 검토 결과

## 발견사항

### [INFO] `TERMINAL_STATUSES` 동명 상수가 3개 파일에 존재 — 이번 diff 가 분리 리네임으로 해소 중
- target 신규 식별자: `RECONCILE_TERMINAL_STATUSES` (in `interaction-token.service.ts`)
- 기존 사용처:
  - `/Volumes/project/private/clemvion/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 710 — `private static readonly TERMINAL_STATUSES` (class 스코프, `Set<ExecutionStatus>`)
  - `/Volumes/project/private/clemvion/codebase/backend/src/modules/external-interaction/interaction.service.ts` line 33 — `const TERMINAL_STATUSES: ReadonlySet<ExecutionStatus>` (module 스코프)
  - `/Volumes/project/private/clemvion/codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — diff 적용 전 `TERMINAL_STATUSES` (배열형 `readonly ExecutionStatus[]`)가 세 번째 동명 상수로 존재했음
- 상세: 세 파일 모두 동일 3-값 집합(COMPLETED/FAILED/CANCELLED)을 참조하지만, 타입과 용도가 다르다 (Set.has() 용 vs SQL IN 배열). 이번 diff 는 `interaction-token.service.ts` 내 상수를 `RECONCILE_TERMINAL_STATUSES` 로 리네임해 SQL 배열임을 명시하고 동명 혼동을 제거한다. diff 적용 후 세 파일 모두 서로 다른 식별자를 사용하므로 충돌이 해소된다.
- 제안: diff 가 이미 올바른 방향. 추가 조치 불필요. 향후 네 번째 동명 상수를 추가할 때는 동일하게 파일-private 로 유지하거나 공통 상수 모듈로 통합한다.

### [INFO] `TERMINAL_REVOKE_RECONCILE_QUEUE` / 문자열 `'terminal-revoke-reconcile'` — 신규, 충돌 없음
- target 신규 식별자: `TERMINAL_REVOKE_RECONCILE_QUEUE = 'terminal-revoke-reconcile'` (exported from `terminal-revoke-reconciler.service.ts`)
- 기존 사용처: `MONITORED_QUEUES` 의 기존 큐 문자열 목록 (`execution-run`, `background-execution`, `execution-continuation`, `document-embedding`, `graph-extraction`, `notification-webhook`, `cafe24-token-refresh`, `makeshop-token-refresh`, `schedule-execution`, `login-history-pruner`, `notification-secret-rotator`, `chat-channel-token-rotator`, `integration-expiry-scanner`, `alerts-evaluator`) — `/Volumes/project/private/clemvion/codebase/backend/src/modules/system-status/system-status.constants.ts`
- 상세: `'terminal-revoke-reconcile'` 은 기존 어떤 큐 이름과도 겹치지 않는다. BullMQ scheduler job 이름 `terminal-revoke-reconcile-every-minute` 도 기존 패턴과 일관된다. `TERMINAL_REVOKE_RECONCILE_QUEUE` export 상수도 기존 큐 상수 네이밍 컨벤션(`*_QUEUE` suffix)을 따른다.
- 제안: 변경 없음.

### [INFO] `RECONCILE_BATCH_LIMIT`, `RECONCILE_BATCH_MAX`, `RECONCILE_CONCURRENCY` — 파일-private 신규 상수, 충돌 없음
- target 신규 식별자: 세 상수 (모두 `interaction-token.service.ts` 내 module-private, 미export)
- 기존 사용처: 없음 (코드베이스 전체 미검출)
- 상세: export 없이 파일 내에서만 사용되며, 동일 이름의 다른 상수가 없다.
- 제안: 변경 불필요.

## 요약

이번 diff 에서 새로 도입되는 식별자(`RECONCILE_TERMINAL_STATUSES`, `TERMINAL_REVOKE_RECONCILE_QUEUE`, `RECONCILE_BATCH_*`, `RECONCILE_CONCURRENCY`)는 기존 사용처와 의미 충돌이 없다. 오히려 diff 의 핵심 변경(`TERMINAL_STATUSES` → `RECONCILE_TERMINAL_STATUSES` 리네임)은 세 파일에 걸쳐 동명으로 공존하던 기존 충돌 상황을 적극적으로 해소하는 방향이다. 새 BullMQ 큐 이름 `'terminal-revoke-reconcile'` 은 기존 등록 큐와 겹치지 않으며 명명 컨벤션을 준수한다. 신규 식별자 충돌 관점의 리스크는 없다.

## 위험도

NONE
