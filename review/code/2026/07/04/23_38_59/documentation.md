# 문서화(Documentation) Review — exec-limits 리팩터 (ARCH#4·ARCH#6·MAINT#9)

## 검토 대상

- `codebase/backend/src/modules/execution-engine/execution-limits.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts`
- `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/system-status/system-status.constants.ts`
- `plan/in-progress/exec-intake-followups.md`, `plan/in-progress/exec-limits-refactor.md`
- `review/consistency/2026/07/04/23_21_53/**` (impl-prep 산출물)

payload 는 실제 diff 범위와 일치(이전 세션에서 보고된 "impl-done spec 번들 버그" mis-scope 는 이번 documentation.md payload 자체에는 나타나지 않음 — 파일 목록이 전부 실제 변경분). 지시된 4개 검증 항목을 코드베이스·spec 원문과 직접 대조했다.

## 검증 결과

### 1. `execution-limits.ts` 모듈 JSDoc 확장 (ARCH#6)

정확함. 현재 헤더(라인 1-18)는:
- 모듈 성격을 "env 파서 응집 모듈"로 정확히 재서술하고 §8+§11 모두 인용.
- 4개 `resolve*` 함수(`resolveMaxActiveRunningMs`, `resolveConcurrencyCap`, `resolveQueueWaitTimeoutMs`, `resolveExecutionRunWorkerConcurrency`) 를 전부 나열 — 실제 export 와 1:1 일치(누락 없음, `grep -c "^export function resolve"` = 4).
- "소비처: execution-engine.service·execution-run.processor·system-status.constants" 주장을 `grep -rl "from.*execution-limits'"` 로 직접 확인 — 정확히 이 3개 파일만 import. 과장·누락 없음.
- spec 대조: `spec/5-system/4-execution-engine.md` §11 env 표(라인 1245-1246)가 `CONTINUATION_WORKER_CONCURRENCY`/`EXECUTION_RUN_WORKER_CONCURRENCY` 의 "비양수·비정수·비숫자 입력 → 1 fallback" 계약을 이미 문서화하고 있어, JSDoc 의 "정규식 선검증 후 문서화된 기본값 fallback" 서술과 정합.

### 2. `execution-run.queue.ts` 이관 주석 (ARCH#4)

정확함. 라인 866-867 `// resolveExecutionRunWorkerConcurrency + DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY 는 … ../execution-limits.ts 로 이관됐다(ARCH#4)` — 상대 경로(`../execution-limits.ts`, 큐 파일이 `queues/` 하위이므로 한 단계 상위)까지 실제 이동 경로와 일치. 함수·상수가 실제로 `execution-limits.ts` 에 존재하고 `execution-run.queue.ts` 에서는 완전히 제거됨(재-export 배럴 없음 — 이중 SoT 회피, consistency-check convention_compliance 권고와도 일치).

### 3. MAINT#9 drift-fix 주석 (`system-status.constants.ts`)

정확함. 새 주석은 "종전 inline `Number(env) || 1` 은 spec §11 이 문서화한 계약과 어긋나(공학표기·소수 등을 loose 하게 수용) 있었다"고 서술한다.
- `resolveContinuationWorkerConcurrency` 는 `continuation-execution.queue.ts` 에 이미 존재하는 strict 정규식(`^\d+$`) 파서임을 확인(코드 라인 57-80).
- spec §11(라인 1245) 은 "비양수·비정수·비숫자 입력은 1 로 fallback" 을 명시 — 종전 `Number('1e10')||1` 같은 loose 코드는 이 계약을 실제로 위반할 수 있었다(예: `"1e10"` → truthy → fallback 미발동). 새 주석의 "drift" 진단은 사실과 일치.
- 종전 `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1` 코드는 diff 상 실제로 `resolveContinuationWorkerConcurrency()` 호출로 대체됨 — 주석이 서술하는 변경과 실제 diff 가 정확히 일치.

### 4. ARCH#5 유예(deferral) 노트 (`exec-intake-followups.md`)

정확함. 노트는 "공용 `ErrorCode` 재편+하드코딩 문자열 enum 편입+소비처 리다이렉트로 blast radius 큼"이라 서술한다. 실제 확인:
- `nodes/core/error-codes.ts` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 는 이미 enum 멤버로 존재하나 노드 핸들러 코드(HTTP/DB/Email/LLM 등)와 같은 파일·같은 객체에 혼재.
- `EXECUTION_QUEUE_WAIT_TIMEOUT`, `WORKER_HEARTBEAT_TIMEOUT` 은 `execution-engine.service.ts` 등에서 **하드코딩 문자열 리터럴**로 쓰이고 `error-codes.ts` enum 에는 없음 — "하드코딩 문자열 enum 편입" 서술과 정확히 일치하는 실제 상태.
- "타 in-progress plan(http-ssrf·node-output-redesign)이 error-codes.ts 에 항목 추가 중"이라는 충돌 근거는 이 세션에서 별도 검증하지 않았으나(다른 worktree 상태 확인 필요), 최소한 ARCH#5 의 기술적 근거(레이어 혼재·하드코딩 미편입)는 코드 사실과 부합.

## 판단: CHANGELOG 불필요 — 동의

이 리팩터는 (a) 순수 함수 파일 이관(ARCH#4), (b) JSDoc 텍스트 확장(ARCH#6), (c) 내부 파싱 로직을 동일 문서화 계약(spec §11 기존 명시)에 정합시키는 교체(MAINT#9) 로 구성되며 셋 다 유효 입력에 대한 관측 가능한 동작 변화가 없다(회귀 테스트로 동일 fallback=1 확인됨). `CHANGELOG.md` 기존 항목들은 전부 API 계약·보안·응답 포맷 등 사용자/클라이언트 관측 가능한 변경만 기재해왔다 — 이 refactor 는 그 기준에 해당하지 않는다. 또한 MAINT#9 가 다루는 env 변수(`CONTINUATION_WORKER_CONCURRENCY`, `EXECUTION_RUN_WORKER_CONCURRENCY`) 는 신규가 아니라 `.env.example`(라인 222, 230)에 이미 등재되어 있어 설정 문서 추가 필요도 없다. "no CHANGELOG needed" 판단은 타당하다.

## 추가 확인 사항 (참고, findings 아님)

- `execution-limits.spec.ts` 로 이관된 신규 테스트 4건(ARCH#4)에 대한 인라인 주석(`ARCH#4 — execution-run.queue.ts 에서 이관`, `SUMMARY#12 — 공백 전용 문자열 + 극단값 동작 명시`)은 출처·의도가 명확해 문서화 품질 양호.
- `resolveExecutionRunWorkerConcurrency` JSDoc 이 "`resolveContinuationWorkerConcurrency` 와 동일 규약"이라 서술하는데, 실제 두 함수의 정규식·fallback 조건(`^\d+$`, `Number.isInteger && >0`)이 코드 대조 결과 동일 — 정확.

## 발견사항

없음 (No findings). 4개 검증 대상 문서/주석 모두 실제 코드·spec 상태와 정확히 일치하며, CHANGELOG 생략 판단도 기존 CHANGELOG 관례·`.env.example` 기등재 상태와 부합한다.

## 요약

이번 변경은 "동작 보존" 내부 리팩터로, 수반된 4개 문서화 요소(모듈 JSDoc 확장, 이관 주석, drift-fix 설명 주석, plan 유예 노트) 모두 코드베이스의 실제 상태(함수 위치·소비처·기존 canonical resolver 존재·error-codes.ts 레이어 혼재)와 대조 검증한 결과 오차 없이 정확하다. CHANGELOG 미기재 판단도 프로젝트의 기존 CHANGELOG 기재 기준(사용자/API 관측 가능 변경) 및 env 변수가 이미 `.env.example` 에 등재되어 있다는 사실에 비추어 타당하다. 문서화 관점에서 이 PR 은 별도 조치 없이 병합 가능한 수준이다.

## 위험도

NONE

STATUS: SUCCESS
