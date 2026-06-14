# 신규 식별자 충돌 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
diff-base: fc5d832b
대상 spec: `spec/5-system/14-external-interaction-api.md` (EIA §3.4 EIA-RL-06 / §9.3 R15)

---

## 발견사항

### 발견사항 1

- **[WARNING]** 신규 BullMQ 큐 `terminal-revoke-reconcile` 가 큐 카탈로그 및 모니터링 레지스트리에 미등록
  - target 신규 식별자: `TERMINAL_REVOKE_RECONCILE_QUEUE = 'terminal-revoke-reconcile'` (`codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` line 6)
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/spec/data-flow/0-overview.md` line 108 — 현재 15개 큐를 열거하는 카탈로그에 `terminal-revoke-reconcile` 이 없음
    - `/Volumes/project/private/clemvion/codebase/backend/src/modules/system-status/system-status.constants.ts` — `MONITORED_QUEUES` 배열에 `TERMINAL_REVOKE_RECONCILE_QUEUE` 가 등록되지 않음. 주석(line 51)이 "큐 추가 시 `test/system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES` 목록도 갱신하라"고 명시
    - `/Volumes/project/private/clemvion/codebase/backend/test/system-status.e2e-spec.ts` lines 25–40 — `EXPECTED_QUEUE_NAMES` 에 `terminal-revoke-reconcile` 누락. e2e 는 이 목록과 실제 반환된 큐 이름의 정합을 검증하므로 미등록 시 이 목록도 동기화가 필요
  - 상세: 큐 이름 식별자 자체는 의미 충돌(같은 문자열이 다른 의미로 이미 쓰임)이 아니다. 그러나 `spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그`가 큐의 SoT이며, 코드 주석이 "큐 추가 시 본 카탈로그를 먼저 갱신하고 레지스트리를 동기화한다"고 명시하고 있다. 새 큐가 이미 `ExternalInteractionModule.registerQueue`에 등록되어 앱이 구동되면 BullMQ Redis 에 실제 큐가 만들어지지만, spec 카탈로그·`MONITORED_QUEUES`·e2e 목록 모두 이 큐를 모르는 상태다. 시스템 상태 화면이 이 큐를 누락 표시하거나, e2e `system-status.e2e-spec.ts` 의 큐 열거 검증(`expect(names).toEqual([...EXPECTED_QUEUE_NAMES].sort())`)이 실패할 수 있다.
  - 제안: (1) `spec/data-flow/0-overview.md §4` 카탈로그에 `terminal-revoke-reconcile` 행 추가 (등록 모듈: `external-interaction.module.ts`, Producer·Consumer: `TerminalRevokeReconcilerService` 분 단위 repeatable scheduler, 작업 단위: terminal execution 의 잔존 interaction token 일괄 revoke sweep). (2) `system-status.constants.ts` 의 `MONITORED_QUEUES`에 `{ name: TERMINAL_REVOKE_RECONCILE_QUEUE, group: 'system', concurrency: 1 }` 추가 및 import 추가. (3) `test/system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES`에 `'terminal-revoke-reconcile'` 추가. 카탈로그는 spec 작성자(project-planner) 권한, 나머지 코드 변경은 developer 권한이다.

---

### 발견사항 2

- **[INFO]** 신규 상수 `RECONCILE_BATCH_LIMIT`, `RECONCILE_BATCH_MAX`, `RECONCILE_CONCURRENCY` — 충돌 없음
  - target 신규 식별자: `RECONCILE_BATCH_LIMIT = 500`, `RECONCILE_BATCH_MAX = 1000`, `RECONCILE_CONCURRENCY = 20` (`interaction-token.service.ts` 내 module-scope 상수)
  - 기존 사용처: 코드베이스 전체에 동일 이름의 상수 없음 (검색 결과 기존 파일에 미존재)
  - 상세: 이름 충돌 없음. module-scope private 상수로 namespace 오염도 없음.
  - 제안: 없음.

---

### 발견사항 3

- **[INFO]** 신규 서비스 `TerminalRevokeReconcilerService` — 충돌 없음
  - target 신규 식별자: `TerminalRevokeReconcilerService` (`terminal-revoke-reconciler.service.ts`)
  - 기존 사용처: 코드베이스 내 동일명 클래스 없음. `reconcile*` 접두사 함수(`reconcilePreParkWaitingStatus` in `executions.service.ts`)는 존재하나 다른 클래스·다른 의미라 충돌 없음.
  - 상세: 이름 충돌 없음.
  - 제안: 없음.

---

### 발견사항 4

- **[INFO]** 신규 메서드 `reconcileTerminalRevocations` — 충돌 없음
  - target 신규 식별자: `InteractionTokenService.reconcileTerminalRevocations(batchLimit?)` 공개 메서드
  - 기존 사용처: `reconcilePreParkWaitingStatus`(private 함수, `executions.service.ts`)만 존재하며 다른 클래스·다른 의미라 충돌 없음.
  - 상세: 이름 충돌 없음.
  - 제안: 없음.

---

## 요약

이번 구현(EIA-RL-06 terminal token revoke at-least-once sweep)이 도입한 신규 식별자 중 의미 충돌은 없다. 다만 신규 BullMQ 큐 `terminal-revoke-reconcile` 이 (a) `spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그`, (b) `system-status.constants.ts` `MONITORED_QUEUES`, (c) `test/system-status.e2e-spec.ts` `EXPECTED_QUEUE_NAMES` 세 곳 모두에 등록되지 않은 상태다. 기존 규약이 "큐 추가 시 카탈로그를 먼저 갱신하고 레지스트리와 e2e 목록을 동기화하라"고 명시하고 있어 이를 미이행한 것이 WARNING 수준 소견이다. 시스템 상태 화면이 새 큐를 모니터링하지 못하고, e2e 큐 열거 검증이 실패할 가능성이 있다. 나머지 신규 식별자(`TerminalRevokeReconcilerService`, `TERMINAL_REVOKE_RECONCILE_QUEUE`, `reconcileTerminalRevocations`, 모듈 내부 상수 3종)는 충돌 없음.

## 위험도

LOW
