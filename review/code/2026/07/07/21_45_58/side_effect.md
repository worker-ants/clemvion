# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** 사이드이펙트 순서·조건 로직 완전 동일 — 순수 리팩터
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2462-2488`(재개 경로), `4385-4390`(초기 경로), 신설 `finalizeFailedExecution` (4409 부근)
  - 상세: `runExecution` catch 블록과 `finalizeResumedExecutionOutcome`에 각각 인라인돼 있던 "status 마킹 → error 봉인(sentinel code 보존) → finishedAt/durationMs 계산 → `executionRepository.save` → `eventEmitter.emitExecution(EXECUTION_FAILED)` → `dispatchExecutionFailedNotification`" 시퀀스를 `finalizeFailedExecution(savedExecution, error, {rehydrated?})` 사설 헬퍼로 추출했다. 두 호출부의 순서·인자·조건분기(`ErrorPortFallbackError`/`ExecutionTimeLimitError` sentinel code 보존, stack 로깅에 `(rehydrated)` 라벨만 차이)가 diff 전/후로 100% 동일하게 보존된다. 새 전역 상태·환경변수·신규 네트워크 호출은 없다.
  - 제안: 없음 (검증 목적의 관찰).

- **[INFO]** private 메서드 신설 — 외부 공개 API/시그니처 영향 없음
  - 위치: `finalizeFailedExecution(savedExecution: Execution, error: unknown, opts: { rehydrated?: boolean } = {})`
  - 상세: `private` 메서드이며 클래스 인스턴스 내부에서만 두 곳(`runExecution` catch, `finalizeResumedExecutionOutcome`)에서 호출된다. 컨트롤러/게이트웨이 등 외부에 노출되는 public 메서드 시그니처는 변경되지 않았다. 테스트 파일에서는 `service as unknown as {...}` 캐스팅으로 private 메서드에 직접 접근해 검증하는데, 이는 기존 스펙 파일의 관례(`dispatchExecutionFailedNotification`, `getNotificationsService` 등 동일 패턴 다수 존재)와 일관된다.
  - 제안: 없음.

- **[INFO]** `finally` 블록의 in-memory 캐시 정리는 헬퍼 밖에 유지 — 리팩터 경계 명확
  - 위치: 초기 경로 `runExecution` catch/finally, 재개 경로 `finalizeRehydrationCleanup`
  - 상세: 주석에 명시된 대로 "in-memory context/캐시 정리는 경로별로 상이하므로 호출자 finally 가 유지"한다. 실제로 두 호출부 모두 `finalizeFailedExecution` 호출 이후의 `finally` 블록(컨텍스트/리졸버/LLM 캐시 정리)은 변경 diff 밖에 그대로 남아있어, 헬퍼 추출이 정리 시점·순서에 영향을 주지 않는다.
  - 제안: 없음.

- **[INFO]** 회귀 가드 테스트가 실제로 4가지 부작용(status/save/emit/dispatch)을 모두 검증
  - 위치: `execution-engine.service.spec.ts:899-952` (`finalizeFailedExecution — 초기·재개 세그먼트 공유 FAILED 종결`)
  - 상세: 신규 테스트는 `rehydrated:true` 옵션으로 헬퍼를 직접 호출해 `saved.status === FAILED`, `executionRepository.save` 호출, `eventEmitter.emitExecution`이 `EXECUTION_FAILED` + `status:FAILED` payload로 호출됨, `notificationsService.createMany`가 `execution_failed` 타입으로 1회 호출됨을 모두 단언한다. PR #841에서 실제로 발생했던 "재개 경로 dispatch 누락" 버그(상태/emit은 됐지만 알림만 빠짐)를 정확히 재현·차단하는 테스트 형태다. mock 은 `beforeEach`로 매 테스트 재생성되므로 다른 테스트로의 상태 누수는 없다.
  - 제안: 없음.

- **[INFO]** 리뷰 대상 중 file 3(`plan/complete/spec-update-notifications-background-run-id.md`) 이하 파일은 문서/spec/plan 산출물이며 런타임 부작용 분석 대상이 아님
  - 위치: 파일 3~12 (plan/complete, plan/in-progress, review/consistency/**, spec/5-system/4-execution-engine.md)
  - 상세: 코드 실행 경로에 영향을 주지 않는 마크다운/JSON 문서다. `spec/5-system/4-execution-engine.md` 갱신은 §4.4(순환 DI 해법: forwardRef vs ModuleRef 지연 해석)를 구조화하는 문서 변경으로, 코드 변경(`getNotificationsService`의 ModuleRef 지연 해석 로직 자체는 이번 diff에 없음 — 이미 이전 PR에서 구현됨)을 사후 문서화하는 것으로 보인다.
  - 제안: 없음.

## 요약
이번 변경은 `execution-engine.service.ts`의 두 FAILED 종결 경로(초기 세그먼트 `runExecution` catch, 재개 세그먼트 `finalizeResumedExecutionOutcome`)에 중복돼 있던 상태 마킹·DB save·WS emit·알림 dispatch 로직을 `finalizeFailedExecution` private 헬퍼로 추출하는 순수 리팩터다. 두 호출부의 실행 순서·조건 분기·부작용(전역 상태 변경, 파일시스템, 환경 변수, 네트워크 호출, 이벤트/콜백)이 diff 전후로 완전히 동일하게 보존되며, public API 시그니처 변경도 없다. 신규 테스트는 PR #841에서 실제 발생했던 "재개 경로 알림 dispatch 누락" 버그를 구조적으로 재발 방지하는 회귀 가드로서 타당하고 충분하다. 부작용 관점에서 위험 요소는 발견되지 않았다.

## 위험도
NONE
