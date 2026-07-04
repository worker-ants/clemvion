# 동시성(Concurrency) Review — exec-limits 리팩터 (ARCH#4·ARCH#6·MAINT#9)

## 검토 범위

- `codebase/backend/src/modules/execution-engine/execution-limits.ts` — `resolveExecutionRunWorkerConcurrency`
  + `DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY` 를 `execution-run.queue.ts` 에서 이관(ARCH#4) + 모듈
  JSDoc 확장(ARCH#6).
- `codebase/backend/src/modules/execution-engine/execution-limits.spec.ts` — 이관된 테스트 describe.
- `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts` — import 경로만
  변경(`./execution-run.queue` → `../execution-limits`). `@Processor({ concurrency: resolveExecutionRunWorkerConcurrency(), ... })`
  호출부 자체는 무변경.
- `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` / `.spec.ts` — 이관 후
  잔여 참조·테스트 제거.
- `codebase/backend/src/modules/system-status/system-status.constants.ts` — MAINT#9: `continuationConcurrency`
  계산을 inline `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1` (loose) 에서
  canonical `resolveContinuationWorkerConcurrency()` (strict, `^\d+$` 선검증) 재사용으로 교체.
- `plan/in-progress/exec-intake-followups.md`, `plan/in-progress/exec-limits-refactor.md`,
  `review/consistency/**` — 문서/계획 산출물 (동시성 코드 아님).

## 분석

### ARCH#4/ARCH#6 — resolver 이관

- `resolveExecutionRunWorkerConcurrency` 는 `process.env` 만 읽는 순수 함수이며 모듈 간 공유
  가변 상태가 전혀 없다. 이관 전후로 로직·정규식·반환값이 완전히 동일(diff 확인: 함수 본문
  1자도 변경 없음, 파일 위치만 이동). 소비처는 두 곳뿐:
  1. `execution-run.processor.ts` — `@Processor` 데코레이터 인자로 **모듈 로드 시 1회** 평가되어
     BullMQ worker 의 실제 concurrency 로 소비된다. import 경로만 바뀌었고 호출 타이밍·결과값은
     불변이므로 워커 동시 처리 슬롯 수(work-stealing 처리량/backpressure)에 영향 없음.
  2. `system-status.constants.ts` — 모니터링 표시용 `executionRunConcurrency` 상수, 이 역시 모듈
     로드 시 1회 평가로 이관 전후 동일 타이밍.
  - 두 소비처가 동시에 import 하더라도, resolver 는 상태를 갖지 않는 순수 함수이므로 이관에 따른
    새로운 경쟁 조건·초기화 순서 문제(circular import 등)가 생기지 않는다. 실제로
    `execution-limits.ts` 는 이관 전 zero-import 모듈이라 순환 의존 가능성 자체가 없다(코드 확인).
  - JSDoc 확장(ARCH#6)은 주석 변경뿐이라 런타임 동작에 영향 없음.
- 결론: ARCH#4/ARCH#6 은 순수한 코드 응집 이동으로, 동시성 관점에서 **행위 변경 없음**. worker
  concurrency 값(기본 1, env `EXECUTION_RUN_WORKER_CONCURRENCY` override)과 그 평가 시점(모듈
  로드/DI 이전, `@Processor` 데코레이터 인자로 정적 평가)이 모두 이관 전과 동일.

### MAINT#9 — system-status continuation 파싱 loose → strict

- 변경 전: `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1`. 변경 후:
  `resolveContinuationWorkerConcurrency()` (execution-run 과 동일 규약: `raw.trim()` 에 `^\d+$`
  정규식 선검증 후 `Number.isInteger && > 0` 재확인, 그 외 전부 기본값 1).
- 이 값은 **오직 `system-status.constants.ts` 의 `MONITORED_QUEUES[].concurrency` 필드**에만
  쓰이며, 이는 system-status 모니터링 API 가 `utilization = active/concurrency` 를 계산해 화면에
  보여주는 **표시용 분모**다. `continuation-execution.processor.ts` 의 실제 `@Processor({ concurrency: ... })`
  호출부는 이 변경과 무관하게 자신의 `resolveContinuationWorkerConcurrency()` 호출을 그대로
  유지한다(이번 diff 대상 아님) — 즉 **실제 BullMQ 워커 동시성(work-stealing 슬롯 수)은 이번 변경으로
  전혀 바뀌지 않는다.**
- loose→strict 전환으로 동작이 달라지는 경우는 `CONTINUATION_WORKER_CONCURRENCY` 가 **소수·공학표기·
  음수·비숫자**로 오설정된 misconfiguration 케이스뿐이다. 예: `"1e10"` → 이전엔
  `Number("1e10")=1e10` (truthy) 라 그 거대한 값이 그대로 채택되어 모니터링 utilization 분모가
  비정상적으로 커지는 표시 버그가 있었으나, strict 파서는 이를 `1` 로 fallback 한다. 이는 표시값의
  정합성 개선이며, 실 워커 concurrency·동시 처리 슬롯 수·backpressure 동작과는 분리되어 있어
  회귀 위험이 없다.
- 원자성/경쟁조건 관점: 두 resolver 모두 side-effect 없는 순수 함수, 공유 mutable 상태 없음.
  `continuationConcurrency`/`executionRunConcurrency` 는 module-level `const` 로 1회 평가 후
  불변 — 다중 요청/다중 워커 스레드 간 동시 접근에도 read-only 라 경쟁 조건 여지가 없다.

### 기타 관점 점검

- 데드락/락 사용: 해당 변경 범위에 락(mutex/semaphore/advisory lock) 도입·제거 없음.
- async/await: 변경된 코드 전부 동기 함수(`resolveExecutionRunWorkerConcurrency`,
  `resolveContinuationWorkerConcurrency`)이며 await 대상 없음. `execution-run.processor.ts` 의
  `process()`/`onFailed()` 로직은 이번 diff 로 건드리지 않음(단순 import 경로 변경).
  `finalizeStalledExhausted` fire-and-forget 패턴(`void ... .catch(...)`)도 변경 없음 — 기존
  패턴 유지.
- 리소스 풀링: BullMQ worker concurrency(리소스 풀 크기에 해당하는 개념) 자체 값은 두 워커
  (`execution-run`, `continuation`) 모두 **이번 변경으로 값이 바뀌지 않는다** — 이관/파서 통일은
  값의 산출 경로만 정리했을 뿐 실제 풀 크기 산정 로직(env override, 기본 1)은 그대로.

## 발견사항

없음 (No findings). 이관·파서 통일 모두 동작 보존이며, 동시성 관련 위험(경쟁 조건·데드락·
동기화 결함·비원자적 복합 연산·이벤트 루프 블로킹·리소스 풀 크기 변경)이 발견되지 않음.

## 요약

이번 변경은 (1) 순수 env 파서 함수(process.env 만 읽는 stateless 함수)의 파일 위치 이관과
문서화 확장(ARCH#4/ARCH#6), (2) 모니터링 표시용 concurrency 값 산출을 기존에 이미 존재하던
canonical strict parser 재사용으로 통일(MAINT#9)한 것으로, 세 항목 모두 실제 BullMQ worker
concurrency(동시 처리 슬롯 수·work-stealing 처리량·backpressure)에는 영향을 주지 않는다.
`execution-run.processor.ts` 의 `@Processor` concurrency 값은 정상 입력 대상 이관 전후 완전히
동일하며, MAINT#9 는 misconfigured env(공학표기·소수 등) 상황에서 system-status 모니터링
utilization 계산의 분모만 spec 문서화된 계약(비정수→1 fallback)에 맞게 교정한다. 두 resolver
모두 side-effect 없는 순수 함수이고 module-level 상수는 1회 평가 후 불변이라 경쟁 조건·데드락·
동기화 결함의 여지가 없다. 동시성 관점에서 위험 없음.

## 위험도

NONE

STATUS: SUCCESS
