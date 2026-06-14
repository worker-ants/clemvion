# 부작용(Side Effect) 리뷰

## 발견사항

### 코드 파일 (파일 1, 3, 4, 5)

- **[INFO]** `BullModule.registerQueue({ name: TERMINAL_REVOKE_RECONCILE_QUEUE })` 신규 등록 — 모듈 부트 시 Redis 에 `bull:terminal-revoke-reconcile:*` 키 네임스페이스가 생성된다.
  - 위치: `codebase/backend/src/modules/external-interaction/external-interaction.module.ts` diff +46
  - 상세: 새 큐 이름이 기존 큐(`notification-webhook`)와 다르고 상수(`TERMINAL_REVOKE_RECONCILE_QUEUE`)로 관리되므로 키 충돌 없음. 의도된 상태 생성이며 부작용 없음.
  - 제안: 없음.

- **[INFO]** `TerminalRevokeReconcilerService.onModuleInit()` — 앱 시작 시 Redis 에 BullMQ repeatable scheduler entry를 upsert 한다.
  - 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` L879-890
  - 상세: `upsertJobScheduler`는 idempotent 하므로 멀티 인스턴스에서도 중복 생성 없음. scheduler ID가 큐 상수 이름에서 파생되므로 큐 상수 변경 시 old scheduler entry가 Redis에 orphan으로 남을 수 있으나, 이는 의도된 설계로 문서화되어 있다.
  - 제안: 없음(허용된 트레이드오프).

- **[INFO]** `reconcileTerminalRevocations()` 신규 메서드 추가 — 기존 `InteractionTokenService` 시그니처에 새로운 public 메서드를 추가한다.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` diff +288-326
  - 상세: 기존 public 메서드 시그니처 변경 없음. 신규 메서드 추가만이며, 매개변수 `batchLimit`에 기본값(500)이 있으므로 기존 호출자에 영향 없음. 해당 메서드는 `TerminalRevokeReconcilerService`에서만 호출되고 module exports에 포함되지 않는다.
  - 제안: 없음.

- **[INFO]** `reconcileTerminalRevocations()` 내부에서 `revokeAllForExecution()`을 순차 반복 호출 — DB(`executionTokenRepository.find`, `delete`) 와 Redis(`blacklist SET`) 에 대한 쓰기 부작용이 발생한다.
  - 위치: `interaction-token.service.ts` L310-319
  - 상세: `revokeAllForExecution()`은 이미 기존 fast-path(`NotificationFanout`)에서 호출되며 idempotent 하게 설계되어 있다(blacklist SET 중복 실행 무해, row DELETE 이미 없으면 no-op). 따라서 reconciler와 fanout이 동시에 동일 executionId를 처리해도 안전하다. fail-open 처리(try/catch per-execution)로 개별 실패가 다른 execution 처리를 막지 않는다.
  - 제안: 없음(idempotent 설계가 충분히 보호).

- **[INFO]** `ExecutionStatus` import 신규 추가 — `interaction-token.service.ts`가 `../executions/entities/execution.entity`에 의존성을 추가한다.
  - 위치: `interaction-token.service.ts` diff +267
  - 상세: 단방향 의존성 추가. `executions` 모듈은 `forwardRef`로 이미 연결되어 있으므로 순환 참조 신규 발생 없음. 전역 상태 변경 없음.
  - 제안: 없음.

- **[INFO]** `TerminalRevokeReconcilerService`가 `providers`에 추가되고 `exports`에는 포함되지 않음 — 모듈 내부 singleton 으로만 존재한다.
  - 위치: `external-interaction.module.ts` diff +54
  - 상세: export 미포함이므로 다른 모듈에 공개 API로 노출되지 않는다. 내부 BullMQ `@Processor` 데코레이터가 Worker를 자동 등록하므로, 모듈 초기화 시 BullMQ Worker 프로세스가 시작되는 부작용이 발생하나 이는 의도된 동작이다.
  - 제안: 없음.

### 테스트/문서 파일 (파일 2, 4, 6~11)

- **[INFO]** 테스트 파일(`interaction-token.service.spec.ts`, `terminal-revoke-reconciler.service.spec.ts`)과 문서 파일(`plan/complete/`, `review/consistency/`)은 런타임 부작용을 생성하지 않는다.
  - 상세: 모두 새 파일 추가 또는 기존 테스트 확장이며, 실 서비스 코드의 전역/공유 상태를 변경하지 않는다. `review/` 디렉터리 내 JSON 파일(`_retry_state.json`, `meta.json`)은 orchestrator 상태 추적용이며 런타임 영향 없음.
  - 제안: 없음.

## 요약

이번 변경은 BullMQ repeatable scheduler 기반의 terminal revoke reconciler를 새 서비스(`TerminalRevokeReconcilerService`)와 새 메서드(`reconcileTerminalRevocations()`)로 추가한다. 모든 외부 부작용(Redis 큐 등록, scheduler upsert, DB read/write, Redis blacklist SET)은 의도된 설계 범위 내에 있으며, 핵심 로직인 `revokeAllForExecution()`이 이미 idempotent 하게 설계되어 있어 fast-path와 reconciler의 중복 실행이 안전하다. 기존 public 메서드 시그니처 변경은 전혀 없고, 신규 public 메서드는 모듈 exports에 포함되지 않으며, 신규 큐 이름은 상수로 격리되어 있다. 의도치 않은 전역 상태 변경, 파일시스템 부작용, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경은 발견되지 않는다.

## 위험도

NONE
