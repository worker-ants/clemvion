# 아키텍처(Architecture) 코드 리뷰

## 검토 대상 (payload 보정 없음)

전달된 `_prompts/architecture.md` payload 는 실제 변경 파일(execution-limits.ts/.spec.ts,
execution-run.processor.ts, execution-run.queue.ts/.spec.ts, system-status.constants.ts,
plan 2건, consistency 산출물)을 정확히 담고 있어 mis-scope 없음 — fallback(`git diff
origin/main...HEAD`) 불필요.

## 변경 요약

- **ARCH#4**: `resolveExecutionRunWorkerConcurrency` + `DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY`
  를 `queues/execution-run.queue.ts` → `execution-limits.ts` 로 이관. 소비처
  (`execution-run.processor.ts`, `system-status.constants.ts`) import 갱신. 테스트도
  `execution-run.queue.spec.ts` → `execution-limits.spec.ts` 로 이관.
- **ARCH#6**: `execution-limits.ts` 모듈 최상단 JSDoc 을 "PR2a 한정 서술" → "동시성·실행 한도
  env 파서 응집 모듈" 전체 서술로 확장.
- **MAINT#9**: `system-status.constants.ts` 의 `continuationConcurrency` 계산을 inline
  loose `Number(env)||1` 에서 canonical `resolveContinuationWorkerConcurrency()`(strict) 로
  교체. `executionRunConcurrency` 는 이미 이관된 canonical resolver 사용.
- 값/문자열/동작 변경 없음(테스트가 이를 증명 — 이관된 describe 블록이 그대로 통과).

## 발견사항

- **[INFO]** `execution-limits.ts` 는 순환 의존 없는 zero-import 순수 파서 모듈 — 이관 타당
  - 위치: `codebase/backend/src/modules/execution-engine/execution-limits.ts`
  - 상세: 이관 전후 모두 `import` 문이 전무한(`process.env` 만 의존) 순수 함수 모음이다.
    `execution-run.processor.ts`(consumer)·`execution-run.queue.ts`(job/우선순위 정의)·
    `system-status.constants.ts`(모니터링) 어느 쪽도 `execution-limits.ts` 를 역으로
    import 하지 않으므로 순환 의존 리스크가 없다. 응집 기준으로도 "동시 실행/큐 대기/한도"
    라는 하나의 관심사(§8, §11)를 한 모듈에 모으는 것은 SRP·응집도 관점에서 합리적 — 기존에
    `execution-run.queue.ts`(큐 정의·우선순위·jobId 스키마 담당)에 동시성 리졸버가 얹혀 있던
    것이 오히려 "큐 카탈로그 정의"와 "env 파싱 정책"이라는 서로 다른 책임의 혼재였다.
  - 제안: 없음 — 방향 적절.

- **[INFO]** 이관 후 `execution-run.queue.ts` 는 순수 잔여 주석만 남기고 re-export 배럴을
  두지 않음 — 이중 SoT 회피
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:757-758`
  - 상세: 이관 지점에 `// ... 는 동시성 한도 파서 응집을 위해 ../execution-limits.ts 로
    이관됐다(ARCH#4).` 주석만 남기고 실제 재-export 는 하지 않는다. `execution-run.processor.ts`
    가 import 경로를 `./execution-run.queue` → `../execution-limits` 로 직접 갱신했다(파일 3
    diff). 배럴 re-export 를 남겼다면 "canonical import 경로가 어디인가"에 대한 이중 SoT 가
    생겼을 것 — 이를 피한 점은 모듈 경계 명확성 측면에서 바람직하다.
  - 제안: 없음.

- **[INFO]** `execution-limits.ts` 소비 방향이 "engine 도메인 모듈 → system-status(횡단 관심사)
  모듈"로 단방향 유지 — 레이어 경계 준수
  - 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts:1-10`
  - 상세: `system-status` 모듈(모니터링/횡단 관심사)이 `execution-engine` 의
    `execution-limits.ts`(도메인 모듈)를 import 하는 방향은 유지되고, 반대 방향(엔진이
    system-status 를 아는 것)은 존재하지 않는다. 도메인 모듈이 자신의 정책(concurrency
    resolver)을 소유하고 횡단 모니터링 모듈이 이를 소비하는 구조는 타당한 의존성 방향이다.
    ARCH#4 이관으로 이 경로가 `execution-run.queue.ts` → `execution-limits.ts` 로 바뀌었을
    뿐 방향성 자체는 변하지 않았다.
  - 제안: 없음.

- **[INFO]** MAINT#9 이후에도 `resolveContinuationWorkerConcurrency` 는 여전히
  `continuation-execution.queue.ts` 에 남아 있어, 두 "worker concurrency resolver" 가
  서로 다른 모듈에 각각 위치하는 비대칭 존재 — 응집 전략의 완결성 관점 참고
  - 위치: `codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.ts:70-81`
    (resolver 원 위치, 미이관) vs `execution-limits.ts:433-444`
    (`resolveExecutionRunWorkerConcurrency`, 이관됨)
  - 상세: ARCH#4 의 근거("동시성 한도 파서 응집")를 엄격히 적용하면
    `resolveContinuationWorkerConcurrency` 도 같은 카테고리(§11 worker concurrency env
    파서)이므로 동일하게 `execution-limits.ts` 로 모이는 것이 응집 원칙과 더 정합적이다.
    현재는 `execution-limits.ts`(파서 3+1종 응집 모듈)와 `continuation-execution.queue.ts`
    (큐 정의+파서 1종 혼재)가 병존해, "resolve* 계열은 execution-limits.ts 에 응집한다"는
    ARCH#6 JSDoc 의 서술("모든 한도 resolve* 를 한 곳에 모아")과 코드 현실이 100% 일치하지는
    않는다. 단, plan(`exec-limits-refactor.md`)·consistency 산출물(`convention_compliance.md`)
    양쪽 모두 이를 **의도적 스코프 제한**(continuation resolver 는 own-spec 존재, 이번
    묶음은 이관 대상만 다룸)으로 명시하고 있어 결함이 아니라 **범위가 정해진 부분 응집**이다.
    다만 JSDoc 문구가 "모든 한도 resolve* 를 한 곳에 모아" 라고 절대적으로 서술한 점은 실제로는
    `resolveContinuationWorkerConcurrency` 를 포함하지 않는다는 점에서 약간의 과장이 있다.
  - 제안: (선택) ARCH#6 JSDoc 문구를 "execution-run 한도 resolve* 를 한 곳에 모아" 정도로
    좁히거나, "continuation worker concurrency 는 별도 모듈(`continuation-execution.queue.ts`)
    소유 — 이관 대상 아님"이라는 한 줄을 덧붙이면 문서-코드 정합이 더 정확해진다. 차단 사유
    아님(INFO).

## 요약

ARCH#4 의 이관은 순환 의존 없는 zero-import 순수 파서 모듈로 SRP/응집도를 높이는 정당한 리팩터이며, import 갱신이 정확히 이루어져(consumer 3곳: processor·system-status·spec) 이중 SoT 나 배럴 재수출로 인한 모호성도 남기지 않았다. ARCH#6 JSDoc 확장은 실제 모듈 책임 범위를 정확히 반영하려는 시도이나 "모든 resolve* 응집"이라는 절대적 문구가 `resolveContinuationWorkerConcurrency`(여전히 별도 모듈 소유)와는 완전히 부합하지 않는 사소한 과장이 있다. MAINT#9 는 순수 policy 정합화(loose→strict)로 레이어·모듈 경계에 영향 없다. 전체적으로 모듈 경계가 명확해지는 방향의 저위험 응집 리팩터다.

## 위험도

NONE

STATUS: SUCCESS
