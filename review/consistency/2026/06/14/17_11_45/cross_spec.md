# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/14-external-interaction-api.md` (impl-done 구현 범위)
구현 diff: `3064c9c6...HEAD` — `interaction-token.service.ts` 상수 rename + `system-status.constants.ts` 큐 등록 + `system-status.e2e-spec.ts` 큐 이름 추가

---

## 발견사항

### **[WARNING]** BullMQ 큐 카탈로그 미동기 — `terminal-revoke-reconcile`
- **target 위치**: diff — `system-status.constants.ts` 의 `MONITORED_QUEUES` 에 `terminal-revoke-reconcile` 큐 추가
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그` 및 **§1 Infrastructure 표 Queue 행**
- **상세**:
  - `spec/data-flow/0-overview.md §1` 의 Queue 행은 "현재 등록된 큐 (15개): `agent-memory-extraction`, `alerts-evaluator`, `background-execution`, `cafe24-token-refresh`, `makeshop-token-refresh`, `chat-channel-token-rotator`, `document-embedding`, `execution-continuation`, `execution-run`, `graph-extraction`, `integration-expiry-scanner`, `login-history-pruner`, `notification-secret-rotator`, `notification-webhook`, `schedule-execution`" 으로 명시한다.
  - `spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그` 표에도 `terminal-revoke-reconcile` 행이 없다.
  - `MONITORED_QUEUES` 에서는 이 큐가 추가됐고 e2e 도 `'terminal-revoke-reconcile'` 이름을 검증한다.
  - `spec/data-flow/0-overview.md §4` 주석: "큐가 늘어나면 본 표와 해당 도메인 spec 의 `외부 의존` 섹션 모두 갱신한다. … 큐 추가/삭제 시 **본 카탈로그를 먼저 갱신하고** 그 레지스트리를 동기화한다." — 순서 규약을 위반한 채 코드가 먼저 배포됨.
  - 실제 큐 수는 16개이지만 spec 은 여전히 15개라고 선언한다.
- **제안**: `spec/data-flow/0-overview.md` 를 다음과 같이 갱신:
  1. §1 Queue 행: "현재 등록된 큐 (16개)" + 목록에 `terminal-revoke-reconcile` 추가
  2. §4 카탈로그 표: `terminal-revoke-reconcile` 행 추가 (등록 모듈 `external-interaction.module.ts` / Producer `TerminalRevokeReconcilerService` (BullMQ repeatable, 분 단위 `* * * * *`) / Consumer 동일 service / 작업 단위 terminal execution 의 잔존 interaction token 일괄 revoke sweep)
  3. `spec/5-system/14-external-interaction-api.md §9.3 / §10 / §R15` 에는 이미 `TerminalRevokeReconcilerService` 가 기술되어 있으므로 추가 변경 불필요.

### **[INFO]** `interaction-token.service.ts` 내 상수명 rename — 명명 비일관성 해소
- **target 위치**: diff — `TERMINAL_STATUSES` → `RECONCILE_TERMINAL_STATUSES` (파일 내 private 상수, 코드 주석으로 분리 근거 명시됨)
- **충돌 대상**: `interaction.service.ts` 의 `TERMINAL_STATUSES: ReadonlySet<ExecutionStatus>` (동명이지만 `ReadonlySet` 타입, `.has()` 용)
- **상세**: 두 파일에 동명 `TERMINAL_STATUSES` 가 별개 타입으로 존재하던 이름 충돌을 해소한 rename 이다. diff 코드 주석이 이 분리 근거를 정확히 기술하고 있으며, 두 상수가 다른 파일의 private scope 이라 런타임 충돌은 없다. Spec 요구사항(`ExecutionStatus.COMPLETED/FAILED/CANCELLED`) 을 두 파일이 동일하게 열거하므로 데이터 모델 충돌 없음. Spec 문서 갱신 불필요.

---

## 요약

이번 구현 diff 의 범위는 작다 — (1) `interaction-token.service.ts` 의 private 상수 `TERMINAL_STATUSES → RECONCILE_TERMINAL_STATUSES` rename (이름 충돌 해소), (2) `system-status.constants.ts` 의 `MONITORED_QUEUES` 에 `terminal-revoke-reconcile` 큐 등록, (3) `system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES` 갱신. 데이터 모델·API 계약·상태 전이·RBAC 등에서 기존 spec 과의 직접 모순은 없으나, `spec/data-flow/0-overview.md §1/§4` 의 BullMQ 큐 카탈로그가 새 `terminal-revoke-reconcile` 큐를 반영하지 못해 카탈로그 선행 갱신 규약(§4 주석)을 위반하는 WARNING 이 존재한다. 이 drift 는 운영 가시성(spec-to-code 정합)과 신규 개발자 온보딩에만 영향을 미치며 시스템 작동을 방해하지는 않는다.

---

## 위험도

LOW
