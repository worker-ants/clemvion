# 아키텍처(Architecture) Review

## 발견사항

- **[WARNING]** `ExecutionEngineService` 내 "조건부 cancel + emit" 패턴이 4중 중복 — 신규 `markWebchatIdleTimeout` 이 다섯 번째 대신 세 번째로 합류
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `cancelParkedExecution`(L910-964), `markExecutionCancelled`(L2622-2694), `markQueueWaitTimeout`(L2702-2745), 신규 `markWebchatIdleTimeout`(L981-1058)
  - 상세: 네 메서드 모두 "`status` 가드 조건부 UPDATE(Execution) → (선택) 동반 NodeExecution cancel UPDATE → `EXECUTION_CANCELLED` emit(실패는 warn 흡수) → (선택) `releaseExecutionRouting` → 바깥 try/catch 로 DB 오류 흡수" 라는 동일 골격을 반복한다. 신규 메서드의 docstring 자체가 "`cancelParkedExecution`(WAITING 가드 + 동반 NodeExecution cancel)와 `markQueueWaitTimeout`(`error.code` + `cancelledBy:'timeout'` emit)의 합성이다" 라고 명시해 중복을 스스로 인지하고 있음에도 공통 helper 로 추출하지 않았다. 새 취소 사유가 추가될 때마다(예: 다음 채널의 idle timeout) 동일 40줄 블록이 다시 복제될 가능성이 높다.
  - 제안: `conditionallyCancelExecution(executionId, { fromStatuses, code, message, cancelledBy, cancelNodeExecution, releaseRouting }): Promise<boolean>` 형태의 private 공통 헬퍼로 통합하고, 4개 메서드를 이 헬퍼 호출로 축소. SRP/DRY 회복과 함께 향후 취소 사유 확장이 설정값 추가만으로 가능해져 OCP 에도 부합.

- **[WARNING]** BullMQ repeatable-sweep 워커 스캐폴딩이 `TerminalRevokeReconcilerService` 와 신규 `WebchatIdleReaperService` 사이에서 거의 그대로 복제됨
  - 위치: `codebase/backend/src/modules/external-interaction/webchat-idle-reaper.service.ts`(신규) vs `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts`(기존, 형제 패턴)
  - 상세: `@Processor(..., { concurrency: 1 })` + `extends WorkerHost implements OnModuleInit`, `onModuleInit` 의 `upsertJobScheduler('${QUEUE}-every-minute', { pattern: '* * * * *' }, { name, opts: { removeOnComplete/removeOnFail } })`, `process(_job)` → 위임, fail-open try/catch 로깅까지 구조가 거의 동일하다(신규 서비스는 여기에 candidate 별 chunked concurrency 처리만 추가). PR 자체 주석도 "EIA-RL-06 `terminal-revoke-reconciler` 와 동일 패턴의 형제"라고 명시한다. 현재 2개(향후 확장 시 N개) 서비스가 동일 스케줄링/장애격리 보일러플레이트를 개별 유지해야 하므로, 한쪽만 고치고 다른 쪽을 놓치는 회귀(fail-open 누락, opts 불일치 등) 위험이 존재.
  - 제안: `onModuleInit` 등록 로직과 fail-open 래퍼를 Template Method 패턴의 공통 추상 클래스(예: `MinuteRepeatableSweepWorker`)나 헬퍼 함수로 추출하고, 각 구현체는 sweep 본문(`reap`/`reconcile`)만 제공하도록 리팩터링을 고려.

- **[INFO]** `ExecutionEngineService` 가 이미 ~8,000줄 규모의 God-Service 인 상태에서 채널(webchat) 특화 어휘가 코어 엔진 계층에 그대로 유입됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L981-1058 (`markWebchatIdleTimeout`, 하드코딩된 `'WEBCHAT_IDLE_TIMEOUT'` 코드/메시지)
  - 상세: 실행 엔진은 원래 채널-불가지론적(channel-agnostic) 계층이어야 하나, 메서드명·에러코드·docstring 모두 "webchat" 이라는 특정 채널 개념을 직접 노출한다. `markExecutionCancelled`(resume 전용 code union)에서도 유사한 선례가 있어 신규 위반이라기보다 기존 컨벤션의 연장이며, repo 내 M-1/M-3 계열 god-handler 분할 백로그가 이미 이 부채를 추적 중이다. 향후 채널이 늘어날수록(텔레그램 등) 엔진 파일에 채널별 취소 사유가 계속 누적될 가능성.
  - 제안: 장기적으로는 엔진이 `cancelWaitingExecution(executionId, { code, message, cancelledBy })` 같은 범용 primitive 만 노출하고, 채널별 상수(`WEBCHAT_IDLE_TIMEOUT` 등)는 호출측(EIA 모듈)이 주입하는 방향으로 역전. 즉시 조치보다는 백로그 등재 권장.

- **[INFO]** `RECONCILE_BATCH_MAX` 상수가 서로 다른 두 sweep 개념(terminal revoke reconcile vs webchat idle reap)의 공용 batch 상한으로 재사용되어 이름이 실제 용도보다 좁음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L54, `findIdleWebchatExecutionIds` 의 clamp(L553-556)에서 재사용
  - 상세: 상수명이 "RECONCILE" 을 명시하지만 이제 reconcile 과 무관한 idle-reap 쿼리의 상한으로도 쓰인다. 기능상 문제는 없으나(둘 다 동일 안전 마진이면 충분) 가독성상 의도가 흐려진다.
  - 제안: `TOKEN_QUERY_BATCH_MAX` 등 도메인 중립적 이름으로 리네임.

## 긍정적 관찰 (참고)
- 모듈 경계가 명확하다: 조회(판정 쿼리)는 `ExecutionToken` 을 소유하는 `InteractionTokenService`(EIA 모듈)에, 상태 전이(Execution/NodeExecution mutation)는 그 엔티티를 소유하는 `ExecutionEngineService`(execution-engine 모듈)에 배치되어 있고, `WebchatIdleReaperService` 는 순수 오케스트레이션/스케줄러 어댑터 역할만 수행한다. EIA → execution-engine 방향의 `forwardRef` 는 기존에 이미 존재하던 edge 를 재사용한 것으로, 이번 변경이 새로운 순환 의존성을 만들지 않았다(`ExecutionEngineModule` 은 `ExternalInteractionModule` 을 import 하지 않음, 단방향 확인).
- `webchat-idle-reaper.types.ts` 를 서비스 구현과 분리해 `system-status.constants.ts` 가 큐 이름만 참조하고 전체 서비스 그래프를 전이 로드하지 않도록 한 설계는 `terminal-revoke-reconciler.types.ts` 선례를 정확히 따른 일관된 패턴이다.
- 멱등 조건부 UPDATE(`WHERE status = 'waiting_for_input'`) + `affected` 기반 반환값으로 race(이미 재개된 execution)를 안전하게 no-op 처리하고, reaper 쪽은 그 반환값이 `true` 일 때만 토큰 revoke 를 호출해 이중 처리를 방지하는 설계는 견고하다.
- unit(mock 기반 상태전이/쿼리 배선) + e2e(실 Postgres, cron tick 대기) 로 계층을 분리한 테스트 전략이 "real-SQL·상태전이 의존" 로직에 적절히 대응한다.

## 요약
이번 변경은 EIA-RL-07(공개 웹채팅 위젯 idle-wait execution 회수) 를 구현하며, 기존 EIA-RL-06(`terminal-revoke-reconciler`) 패턴을 형제로 재사용하는 방식으로 설계되어 모듈 경계(조회=EIA 토큰 도메인, 상태 전이=엔진 도메인, 스케줄링=얇은 오케스트레이션 어댑터)를 잘 지켰고 새로운 순환 의존성도 만들지 않았다. 다만 (1) `ExecutionEngineService` 내 "조건부 cancel+emit" 골격이 이번 추가로 네 번째 중복 인스턴스가 되었고, (2) BullMQ repeatable-sweep 워커의 스케줄링 보일러플레이트가 두 번째 형제 서비스에서도 그대로 복제되어, 향후 유사 backstop 이 늘어날수록 DRY/OCP 부채가 누적될 위험이 있다. 둘 다 기존 컨벤션의 연장선(신규 위반이라기보다 기존 패턴을 그대로 답습)이라 즉시 차단할 사안은 아니며, 리팩터링 백로그 항목으로 등재할 만한 수준이다.

## 위험도
LOW
