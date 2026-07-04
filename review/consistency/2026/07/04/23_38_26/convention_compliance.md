# 정식 규약 준수 검토 — exec-limits-refactor (ARCH#4 · ARCH#6 · MAINT#9)

검토 모드: impl-done, diff-base=origin/main, HEAD=`/Volumes/project/private/clemvion/.claude/worktrees/exec-limits-refactor-ef170a`

## 참고: target 문서 불일치

`_prompts/convention_compliance.md` 에 번들된 target 문서 내용은 `spec/5-system/1-auth.md`·
`10-graph-rag.md` 등 본 작업과 무관한 spec 전문이었다(실제 diff 섹션 없음). 실제 변경분은
`git diff origin/main` 로 직접 확인했다 — 아래 분석은 그 실제 diff(6개 파일, execution-limits
관련 리팩터)를 근거로 한다.

- `codebase/backend/src/modules/execution-engine/execution-limits.ts` (+42/-)
- `codebase/backend/src/modules/execution-engine/execution-limits.spec.ts` (+46)
- `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts` (import 경로 변경)
- `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` (-23, 함수 이관)
- `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.spec.ts` (-45, 테스트 이관)
- `codebase/backend/src/modules/system-status/system-status.constants.ts` (canonical resolver 재사용)

## 점검 관점별 분석

### 1. 명명 규약
`resolve<X>` / `DEFAULT_<X>` 네이밍이 `execution-limits.ts` 신규 함수(`resolveExecutionRunWorkerConcurrency`,
`DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY`)와 기존 `resolveMaxActiveRunningMs`·`resolveConcurrencyCap`·
`resolveQueueWaitTimeoutMs`·(sibling) `resolveContinuationWorkerConcurrency` 사이에 완전히 일관됨.
위반 없음.

### 2. 출력 포맷 규약
API 응답·이벤트 페이로드·에러 코드 변경 없음(순수 내부 env 파서 이관). 해당 없음.

### 3. 문서 구조 규약
spec 문서 변경 없음(`spec_impact: [none]`). plan 파일(`plan/in-progress/exec-limits-refactor.md`)
frontmatter 는 `worktree`/`started`/`owner`/`spec_impact` 스키마를 정확히 따른다
([`.claude/docs/plan-lifecycle.md`](../../../../../.claude/docs/plan-lifecycle.md) §Gate C 리스트
형식 — `spec_impact: [- none]`, bare string 아님). 위반 없음.

### 4. API 문서 규약
DTO·컨트롤러·Swagger 데코레이터 변경 없음. 해당 없음.

### 5. 금지 항목 / module-boundary·env-parsing 정합성

- **SoT 주석 정확성**: `execution-limits.ts` 신규 모듈 JSDoc 이 "SoT: spec/5-system/4-execution-engine.md
  §8 · §11" 로 명시한다. 확인 결과 §11(`Graceful Shutdown`) 의 env 변수 표(라인 1241-1247)에
  `EXECUTION_RUN_WORKER_CONCURRENCY`·`EXECUTION_MAX_ACTIVE_RUNNING_MS` 가 실제로 등재되어 있고,
  `CONTINUATION_WORKER_CONCURRENCY` 패턴 준용 서술도 spec 표 문구와 diff 의 함수 JSDoc 서술이
  일치한다. §8 은 동시성 cap·큐 대기 한도 정의 섹션과 일치. SoT 참조는 정확하다.
- **canonical resolver 재사용(MAINT#9)**: `system-status.constants.ts` 가 inline
  `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1`(loose) 를 걷어내고 기존
  `resolveContinuationWorkerConcurrency()`(strict, `continuation-execution.queue.ts` 소유)를
  재사용하도록 정정했다. 이는 spec §11 env 표가 이미 명시한 "비양수·비정수·비숫자 입력 → 1
  fallback" 계약을 코드가 실제로 준수하도록 맞춘 **버그 수정에 가까운 정합화**이며, 규약 위반이
  아니라 오히려 spec-code 불일치를 줄이는 방향.
- **함수 재배치(ARCH#4) 후 잔여 참조**: `execution-run.queue.ts` 에서 제거된
  `resolveExecutionRunWorkerConcurrency`/`DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY`를 codebase
  전체에서 grep한 결과, 남은 정의는 `execution-limits.ts`(+spec) 단일 소스이며 소비처
  (`execution-run.processor.ts`, `system-status.constants.ts`)의 import 가 모두 새 경로로
  갱신되어 있다. 구 경로(`./execution-run.queue`)로부터 해당 식별자를 import 하는 곳은 없다 —
  이관이 깨끗하다.
- **테스트 이관**: `execution-run.queue.spec.ts` 의 `describe('resolveExecutionRunWorkerConcurrency')`
  블록이 그대로 `execution-limits.spec.ts` 로 이동했고 케이스(공백 전용 문자열, MAX_SAFE_INTEGER 등)
  손실 없이 보존됨. 코드 이동에 원본 커밋의 함수 위치를 따라가는 TDD 관례(테스트는 구현과 동일
  모듈에 위치)에 부합.
- **module-boundary**: `execution-limits.ts` 가 `execution-engine.service`·`execution-run.processor`·
  `system-status.constants` 세 소비처를 명시적으로 문서화(JSDoc)하고, 순수 함수(process.env 의존만)
  라 순환 의존 위험이 없다는 진술도 실제로 이 모듈이 다른 execution-engine 내부 모듈을 import하지
  않는 것과 일치한다. `.env.example` 에는 `EXECUTION_RUN_WORKER_CONCURRENCY`·
  `CONTINUATION_WORKER_CONCURRENCY`·`EXECUTION_MAX_ACTIVE_RUNNING_MS`·`EXECUTION_QUEUE_WAIT_TIMEOUT_MS`
  가 모두 기존에 등재되어 있어 이번 이관으로 신규 등재 누락이 발생하지 않았다.
- **금지 패턴 답습 여부**: `spec/conventions/` 에는 module-boundary·env-parsing 을 명시적으로
  규정한 별도 컨벤션 파일이 없다(`error-codes.md`·`node-output.md`·`audit-actions.md` 등은 이번
  변경 범위 밖). 따라서 이 관점에서 "정식 규약 위반"으로 등급 매길 근거 자체가 없다 — 기존
  sibling 모듈(`continuation-execution.queue.ts`)의 관행을 따른 emergent pattern 정합화로 판단.

## 발견사항

없음 — CRITICAL/WARNING/INFO 등급에 해당하는 정식 규약 위반을 발견하지 못했다.

## 요약

이번 변경은 순수 리팩터(ARCH#4 함수 재배치, ARCH#6 모듈 JSDoc 확장, MAINT#9 canonical resolver
재사용 통일)로, API·DTO·이벤트 페이로드·spec 문서에 어떤 영향도 주지 않는다. 신규/이관된 함수의
명명(`resolve*`/`DEFAULT_*`)은 같은 파일·sibling 모듈과 완전히 일관되고, 모듈 JSDoc 의 SoT 참조
(`spec/5-system/4-execution-engine.md §8·§11`)는 실제 spec 본문과 대조해 정확함을 확인했다. 함수
이관 후 구 경로 참조가 하나도 남지 않았고 테스트도 함께 이동해 커버리지 손실이 없다. `spec/conventions/`
에는 이 변경이 저촉될 만한 명명·출력 포맷·문서 구조·API 문서·금지 항목 규약이 존재하지 않는다
(module-boundary/env-parsing 은 아직 정식 컨벤션 문서화 대상이 아닌 emergent pattern). 정식 규약
준수 관점에서 이번 diff 를 차단할 근거는 없다.

## 위험도

NONE

BLOCK: NO
STATUS: SUCCESS
