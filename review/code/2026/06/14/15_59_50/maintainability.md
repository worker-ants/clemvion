# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 3: interaction-token.service.ts — reconcileTerminalRevocations

- **[INFO]** 매직 넘버 `500` (batchLimit 기본값)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `reconcileTerminalRevocations(batchLimit = 500)`
  - 상세: `500` 은 파일 상단에 이름 있는 상수로 선언되지 않았다. `IEXT_DEFAULT_TTL_SEC`·`IEXT_REFRESH_WINDOW_SEC`·`ITK_BYTES` 등 기존 상수 선언 패턴과 일관성이 없다.
  - 제안: `const RECONCILE_BATCH_LIMIT = 500;` 을 상수 블록에 추가하고 파라미터 기본값을 해당 상수로 교체. 이름에 의도(배치 크기 상한)가 드러나 추후 조정 시 참조 지점이 단일화된다.

- **[INFO]** `reconcileTerminalRevocations` 내부 — terminal 상태 목록 하드코딩
  - 위치: `interaction-token.service.ts` 라인 297–303 (추가된 블록)
  - 상세: `[ExecutionStatus.COMPLETED, ExecutionStatus.FAILED, ExecutionStatus.CANCELLED]` 배열이 메서드 본문에 인라인 선언되어 있다. `ExecutionStatus` enum 에 새로운 terminal 상태가 추가될 경우 이 목록이 자동으로 갱신되지 않아 누락이 생길 수 있다. 이 패턴은 다른 서비스에서 동일 상태 집합을 참조할 때 중복 선언으로도 이어진다.
  - 제안: `TERMINAL_STATUSES` 상수 배열을 별도 선언해 재사용할 수 있도록 한다. 단기 조치는 불필요하나 enum 확장 시 주의 필요.

- **[INFO]** 중복 로그 경로 — 서비스와 스케줄러 양쪽에서 sweep 결과를 로그
  - 위치: `interaction-token.service.ts` 라인 320–324 / `terminal-revoke-reconciler.service.ts` 라인 900–904
  - 상세: `reconcileTerminalRevocations` 는 `rows.length > 0` 일 때 `logger.log` 로 결과를 출력하고, `TerminalRevokeReconcilerService.reconcile()` 도 `swept > 0` 조건에서 동일한 숫자를 다시 로그한다. 운영 환경에서 동일 이벤트에 대해 두 개의 로그 라인이 발생하며, 어느 쪽이 정보의 권위 있는 소스인지 불명확해진다.
  - 제안: `reconcileTerminalRevocations` 의 성공 로그를 제거하고 `TerminalRevokeReconcilerService.reconcile()` 한 곳에서만 로그를 관리하거나, 반대로 서비스 레이어가 로그를 담당하고 reconciler 는 위임만 하도록 일원화한다.

### 파일 5: terminal-revoke-reconciler.service.ts

- **[INFO]** `process` 와 `reconcile` 의 불필요한 레이어 분리
  - 위치: `terminal-revoke-reconciler.service.ts` 라인 892–911
  - 상세: `process(_job)` 가 `reconcile()` 를 단순히 위임 호출하며, `reconcile()` 이 실제 로직(try/catch + tokenService 호출)을 담당한다. 테스트도 `service.process({} as never)` 를 통해 간접 호출하고 있어 `reconcile()` 의 독립적 존재 의의가 모호하다. 현재 `reconcile()` 이 `public` 이어서 외부에서 직접 호출 가능하지만, 테스트에서는 실제로 사용하지 않는다.
  - 제안: `process` 가 직접 try/catch 와 tokenService 호출을 담당하도록 합치거나, `reconcile` 을 `private` 으로 선언해 외부 노출을 명시적으로 제한한다. BullMQ WorkerHost 진입점은 `process` 만이므로 두 public 메서드를 유지할 실질적 이유가 없다.

- **[INFO]** 매직 넘버 — `removeOnComplete`·`removeOnFail` age 값
  - 위치: `terminal-revoke-reconciler.service.ts` 라인 885–888
  - 상세: `24 * 60 * 60`(1일)과 `7 * 24 * 60 * 60`(7일)은 곱셈식으로 의미를 추론할 수 있으나, 동일 패턴이 다른 BullMQ 서비스에도 존재한다면 중앙 상수화가 바람직하다.
  - 제안: 파일 상단에 `REMOVE_ON_COMPLETE_AGE_SEC = 24 * 60 * 60`·`REMOVE_ON_FAIL_AGE_SEC = 7 * 24 * 60 * 60` 형태의 로컬 상수를 선언하거나, 코드베이스 공통 BullMQ 상수 파일로 이동.

### 파일 1: external-interaction.module.ts

- **[INFO]** 모듈 JSDoc 주석이 신규 서비스를 반영하지 않음
  - 위치: `external-interaction.module.ts` — `Wire-up` 주석 블록 (라인 90–102)
  - 상세: `Wire-up` 목록에 `NotificationDispatcher + Processor + Fanout`·`SseAdapter` 등은 기재되어 있으나 새로 추가된 `TerminalRevokeReconcilerService` 와 `TERMINAL_REVOKE_RECONCILE_QUEUE` 가 누락되어 있다. 모듈 파악 시 주석이 불완전한 정보를 제공한다.
  - 제안: `Wire-up` 목록에 `TerminalRevokeReconcilerService (EIA-RL-06 at-least-once reconciler, 분 단위 BullMQ)` 항목 추가.

### 파일 2: interaction-token.service.spec.ts

- **[INFO]** `makeQB`·`makeService` 헬퍼의 인라인 선언 — 범위는 적절하나 중복 가능성 주시 필요
  - 위치: `interaction-token.service.spec.ts` — `describe('reconcileTerminalRevocations')` 블록 내
  - 상세: 두 헬퍼가 해당 `describe` 블록 안에 선언되어 있어 범위 명확성은 좋다. 다만 파일 다른 곳에 유사한 QueryBuilder mock 빌더가 이미 있다면 중복 선언이 된다. 현재 diff 범위에서는 확인 불가.
  - 제안: 파일 전체에서 유사한 QueryBuilder mock 이 두 곳 이상 선언되어 있다면 공통 헬퍼로 통합. 현 위치는 INFO 수준.

---

## 요약

변경된 코드는 기존 코드베이스의 NestJS 패턴(BullMQ WorkerHost, `@Optional` Repository 주입, fail-open warn 로그 패턴)을 일관되게 따르고 있으며, `TerminalRevokeReconcilerService` 는 단일 책임(스케줄러 어댑터)을 명확히 유지하고 `reconcileTerminalRevocations` 의 길이·복잡도도 적정하다. 주요 개선 여지는 (1) `batchLimit = 500` 매직 넘버가 기존 상수 선언 컨벤션에서 벗어남, (2) 서비스와 스케줄러 양쪽에서 동일 sweep 결과를 이중 로그, (3) `process`/`reconcile` 불필요한 public 레이어 분리, (4) 모듈 JSDoc 주석의 신규 wire-up 누락 — 모두 INFO 수준이며 CRITICAL·WARNING 급의 유지보수성 문제는 없다.

## 위험도

LOW
