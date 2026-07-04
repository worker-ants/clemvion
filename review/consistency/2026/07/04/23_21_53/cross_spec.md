# Cross-Spec 일관성 검토 — exec-limits-refactor

## 사전 안내 — payload mis-scope

전달된 `_prompts/cross_spec.md` payload 는 `spec/5-system/1-auth.md`·`spec/5-system/10-graph-rag.md`·`spec/0-overview.md`·`spec/1-data-model.md` 를 번들링하고 있어, 본 작업(ARCH#4/#6/MAINT#9 — `execution-limits.ts`·`execution-run.queue.ts`·`system-status.constants.ts`·`CONTINUATION_WORKER_CONCURRENCY`)과 무관하다. `grep` 결과 payload 전체에 `execution-limits`·`CONTINUATION_WORKER_CONCURRENCY`·`resolveExecutionRunWorkerConcurrency`·`resolveContinuationWorkerConcurrency` 문자열이 전혀 없음을 확인했다 (오케스트레이터 impl-prep 번들링 오류로 추정, "impl-done spec 번들 버그" 계열 이슈와 유사).

지시에 따라 아래는 실제 spec·코드를 직접 읽어 수행한 검토다:

- `spec/5-system/4-execution-engine.md` §4.3(수평 확장) / §8(동시 실행 제한) / §9.3(BullMQ 큐 목록) / §11(Graceful Shutdown 환경변수 표)
- `spec/5-system/16-system-status-api.md` (큐 레지스트리 concurrency 요약)
- `spec/data-flow/0-overview.md` §4 (BullMQ 큐 카탈로그, SoT)
- `codebase/backend/src/modules/execution-engine/execution-limits.ts`
- `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts`
- `codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.ts`
- `codebase/backend/src/modules/system-status/system-status.constants.ts`

## 계획 검토 대상

- **ARCH#4**: `resolveExecutionRunWorkerConcurrency` 를 `queues/execution-run.queue.ts` → `execution-limits.ts` 로 이동
- **ARCH#6**: `execution-limits.ts` 모듈 JSDoc 범위 확장
- **MAINT#9**: `system-status.constants.ts` 의 continuation concurrency 계산을 inline `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1`(loose) → canonical `resolveContinuationWorkerConcurrency()`(strict) 재사용으로 교체
- ARCH#5(error-code layer)는 이번 라운드 범위 밖(defer) — 본 검토도 대상에서 제외

## 발견사항

### [INFO] MAINT#9 는 이미 spec 이 문서화한 계약에 코드를 정합화하는 변경

- target 위치: (계획 설명) `system-status.constants.ts` L44-45 `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1`
- 충돌 대상: 없음 — 오히려 `spec/5-system/4-execution-engine.md` §11 환경변수 표(`CONTINUATION_WORKER_CONCURRENCY` 행: "비양수·비정수·비숫자 입력은 1 로 fallback")·`spec/5-system/16-system-status-api.md` L24(`execution-continuation` concurrency = env `CONTINUATION_WORKER_CONCURRENCY`) 를 강화
- 상세: 현재 `system-status.constants.ts` 는 `Number(x) || 1` 로 계산해 `"3.5"` → `3`(소수 통과), `"-1"` → `-1`(그대로, `-1 || 1` 은 `-1` 이 truthy 라 fallback 안 됨), `"abc"` → `NaN || 1` → `1` 처럼 spec 표가 요구하는 "비정수·비양수도 1 로 fallback" 계약을 부분적으로만 만족한다. 반면 canonical `resolveContinuationWorkerConcurrency()`(`continuation-execution.queue.ts`)는 정규식 선검증(`/^\d+$/`) + `Number.isInteger && > 0` 이중 가드로 정확히 그 계약을 구현한다. 두 함수는 System Status 모니터링 표시값(`MonitoredQueue.concurrency`, `utilization = active/concurrency` 계산에 사용, `16-system-status-api.md` §"concurrency" 섹션)과 실제 BullMQ worker concurrency(`continuation-execution.processor.ts` 가 실사용하는 값)가 동일 env 파싱 규칙을 따라야 한다는 암묵적 전제를 갖는데, 현재는 edge-case 입력에서 두 계산이 어긋날 수 있어 System Status 화면이 실제 worker concurrency 와 다른 숫자를 보여줄 잠재 결함이 있었다. canonical 함수 재사용은 이 drift 를 제거하고 §11/§16 문서 계약과 일치시킨다.
- 제안: 계획대로 진행. spec 본문 수정 불요(§11/§16 는 이미 정확한 계약을 기술 중이며 코드가 그에 맞춰짐). 다만 `16-system-status-api.md` L18 의 "SoT 는 data-flow/0-overview.md §4, 본 표는 요약" 원칙에 따라 이번 변경으로 concurrency 표시값의 실제 계산식이 바뀌므로, PR 설명/커밋 메시지에 "표시값 자체는 정상 입력 범위에서 불변(behavior-preserving), edge-case 입력 시 계약 일치화"임을 명시하면 리뷰어 혼란을 줄일 수 있음.

### [INFO] ARCH#4 (함수 이동) — spec 은 함수명만 언급, 파일 경로를 SoT 로 고정하지 않음

- target 위치: (계획 설명) `resolveExecutionRunWorkerConcurrency` 정의를 `queues/execution-run.queue.ts` → `execution-limits.ts` 로 이동
- 충돌 대상: `spec/5-system/4-execution-engine.md` §11 환경변수 표(`EXECUTION_RUN_WORKER_CONCURRENCY` 행) — 함수명 `resolveExecutionRunWorkerConcurrency` 를 언급하나 정의 파일 경로는 명시하지 않음. `spec/data-flow/3-execution.md` L116 은 `execution-limits.ts` 를 `EXECUTION_MAX_ACTIVE_RUNNING_MS`/`resolveMaxActiveRunningMs` 의 소재로만 언급 — 이동 대상 함수와는 무관한 문장이라 충돌 없음
- 상세: 두 문서 모두 파일 배치를 규범적으로 강제하지 않으므로 이번 이동은 spec 계약을 위반하지 않는다. `execution-limits.ts` 는 이미 §8(동시성 cap)·§8(active-running 타임아웃) 두 책임을 담고 있어("PR2a"/"PR2b" 주석), `resolveExecutionRunWorkerConcurrency`(§11 worker concurrency, §4.3 수평 확장 토대)를 추가해도 "실행 관련 수치 한도·동시성 파라미터 계산" 이라는 파일의 실질 책임 범위(ARCH#6 이 그 JSDoc 을 넓히려는 지점)와 자연스럽게 부합한다.
- 제안: 코드 이동 시 import 경로가 바뀌는 5개 파일(`execution-limits.ts` 자신 제외 — `execution-engine.service.ts`, `queues/execution-run.queue.ts`(재-export 필요 여부 확인), `queues/execution-run.queue.spec.ts`, `queues/execution-run.processor.ts`, `system-status/system-status.constants.ts`)의 import 를 함께 갱신. `execution-run.queue.ts` 의 JSDoc(L102-108 "SoT: spec §11 ...")도 이동 후 "정의는 execution-limits.ts, 본 파일은 재사용"으로 갱신 권장(코드 내부 문서 일관성 — spec 변경은 불요).

### [INFO] ARCH#6 (JSDoc 확장) — 책임 경계 재정의는 코드 내부 문서일 뿐 spec 과 충돌 없음

- target 위치: `execution-limits.ts` 모듈 최상단 JSDoc
- 충돌 대상: 없음. `spec/5-system/4-execution-engine.md` §8/§11 은 "동시성 cap"·"active-running 타임아웃"·"worker concurrency" 를 모두 같은 §8/§11 아래 인접 섹션으로 다루고 있어, 코드 파일 하나가 이 세 파라미터 해석 함수를 모으는 것은 spec 구조와 대응(§8=cap+타임아웃, §11=worker concurrency)이 자연스럽다.
- 상세: JSDoc 확장이 "이 파일은 §8 전용" 같은 기존 문구를 "§8+§11(실행 한도·동시성 파라미터 전반)" 으로 넓히는 수준이라면 문제 없음. 단, JSDoc 이 실제 spec 조항 번호를 인용하는 형식(`spec/5-system/4-execution-engine.md §8`)을 이미 쓰고 있으므로(L2), 확장 시 §11 도 함께 인용해 두 섹션 모두를 SoT 로 명시하는 편이 향후 코드-스펙 추적성에 유리.
- 제안: JSDoc 갱신 시 "SoT: spec/5-system/4-execution-engine.md §8 (동시성 cap·active-running 타임아웃) / §11 (worker concurrency)" 형태로 조항 번호를 명시적으로 병기.

### 검토했으나 이슈 없음

- **데이터 모델**: 세 변경 모두 함수 이동/재사용/JSDoc 수정이며 엔티티·필드 정의에 영향 없음.
- **API 계약**: `system-status.constants.ts` 변경은 `MONITORED_QUEUES[].concurrency` 값 계산식만 바꾸고 `/api/system-status/overview` 응답 shape(§16-system-status-api.md)에는 영향 없음. 정상 입력(`CONTINUATION_WORKER_CONCURRENCY` 미설정 또는 양의 정수 문자열) 범위에서는 두 계산식이 동일한 값을 반환해 응답 값도 불변.
- **요구사항 ID**: 신규 ID 부여 없음(`spec_impact: none`과 일치).
- **상태 전이**: Execution/NodeExecution 상태 머신과 무관.
- **RBAC**: System Status 는 `spec/5-system/1-auth.md` §3.2 표에 따라 전 역할 R 권한(admin 가드 없음) — 이번 변경으로 권한 체크 로직에 손대지 않으므로 영향 없음.
- **계층 책임**: `execution-limits.ts` 가 "실행 한도·동시성 계산 유틸" 역할로, `queues/*.queue.ts` 가 "큐 상수·job 스키마" 역할로 재편되는 방향은 기존 파일 명명 관례(`*-limits.ts` vs `*.queue.ts`)와 부합하며 다른 영역(auth/graph-rag/data-model 등)의 계층 분리 결정과 충돌하지 않음.

## 요약

전달된 payload 는 이번 작업과 무관한 auth/graph-rag/data-model 영역을 번들링한 mis-scope 였으나, 실제 SoT(`spec/5-system/4-execution-engine.md` §8/§9.3/§11, `spec/5-system/16-system-status-api.md`, `spec/data-flow/0-overview.md` §4)와 대상 코드를 직접 대조한 결과, 계획된 세 변경(ARCH#4 함수 이동, ARCH#6 JSDoc 확장, MAINT#9 canonical 파서 재사용)은 모두 기존 spec 조항을 위반하지 않으며 오히려 MAINT#9 는 §11/§16 이 이미 선언한 "비양수·비정수·비숫자 입력→1 fallback" 계약에 코드(System Status 표시값 계산)를 더 정확히 정합화하는 방향이다. 파일 경로 이동에 대한 spec 상 강제(SoT-파일 고정)는 없으므로 ARCH#4/#6 도 자유롭다. Cross-spec 충돌 없음 — CRITICAL/WARNING 없음, 코드 내부 문서 일관성 차원의 INFO 3건만 제안.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS
