# 정식 규약 준수 검토 — convention_compliance

## 검토 대상 (payload 보정)

`_prompts/convention_compliance.md` 의 target 문서 번들은 `spec/5-system/1-auth.md`·
`10-graph-rag.md`·`spec/conventions/cafe24-api-catalog/**` 로 구성되어 있으나, 이는
orchestrator payload 조립 단계의 mis-scope 로 실제 변경 대상과 무관하다 (알려진 이슈:
`impl-done spec 번들 버그` — target spec 본문이 프롬프트에 실리지 못하고 무관한 파일이
섞여 들어감). 이번 세션은 사용자가 제공한 **실제 계획(ACTUAL plan)** 을 기준으로 코드베이스
(`codebase/backend/src/modules/execution-engine/execution-limits.ts`,
`queues/execution-run.queue.ts`, `queues/continuation-execution.queue.ts`,
`system-status/system-status.constants.ts`) 와 관련 spec
(`spec/5-system/4-execution-engine.md §11`, `spec/5-system/16-system-status-api.md §3`)
을 직접 대조해 검토했다.

### 실제 계획 (plan/in-progress/exec-limits-refactor.md)

- **ARCH#4**: `resolveExecutionRunWorkerConcurrency` + `DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY`
  를 `queues/execution-run.queue.ts` → `execution-limits.ts` 로 이관 (동시성 한도 로직 응집).
  import 갱신 대상: `execution-run.processor.ts`, `system-status.constants.ts`. 테스트도 이관.
- **ARCH#6**: `execution-limits.ts` 모듈 JSDoc 을 PR2a 한정 서술에서 모듈 경계 서술로 확장.
- **MAINT#9**: `system-status.constants.ts` 의 `continuationConcurrency` 를
  inline `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1` (loose) 에서
  기존 canonical `resolveContinuationWorkerConcurrency()` (strict) 재사용으로 통일.

동작 보존(문자열/값/로직 무변경) 리팩터로 명시되어 있다.

---

## 발견사항

- **[INFO]** ARCH#4 파일 이관 시 모듈간 결합 방향 재확인 권고
  - target 위치: `execution-limits.ts` (이관 후), `queues/execution-run.queue.ts` (이관 전 원본)
  - 관련 규약: 명시적 `module-boundary` convention 문서는 `spec/conventions/**` 에 부재. CLAUDE.md
    "정보 저장 위치" 표의 암묵 원칙("기술 명세는 `spec/<영역>/*.md` 본문", 코드 응집은 리뷰 재량)에 해당.
  - 상세: `execution-limits.ts` 는 현재 zero-import 순수 함수 모듈이라 (`grep` 확인: import 없음),
    `resolveExecutionRunWorkerConcurrency` 이관 후에도 순환 의존이 발생하지 않는다. plan 의
    "순수 함수(process.env only)라 순환 의존 없음" 주장은 코드 사실과 일치한다.
  - 제안: 이관 후 `execution-run.queue.ts` 에 re-export 배럴을 남기지 말 것(단순 이관, 이중 SoT
    방지) — plan 체크리스트에 이미 "import 갱신" 이 명시되어 있어 이 방향과 일치. 별도 조치 불필요.

- **[INFO]** ARCH#6 JSDoc 확장 범위와 spec §11 표기 정합 확인
  - target 위치: `execution-limits.ts` 모듈 최상단 JSDoc (이관 후)
  - 관련 규약: `spec/5-system/4-execution-engine.md §11` env 표 — `EXECUTION_RUN_WORKER_CONCURRENCY`
    행이 "`CONTINUATION_WORKER_CONCURRENCY` 패턴 준용" 을 명시적으로 기술.
  - 상세: 현재 `execution-limits.ts` 파일 JSDoc(라인 1-8)은 "PR2a — §8 active-running 누적
    타임아웃 한도" 로 한정 서술되어 있어, ARCH#4 이관 후 동일 파일에 동시성 리졸버가 추가되면
    모듈 헤더가 실제 내용(한도 파서 3종: active-running 타임아웃, concurrency cap, queue-wait
    timeout, +worker concurrency)을 포괄하지 못해 문서-코드 괴리가 생긴다. ARCH#6 이 이를
    "모듈 경계 서술"로 확장하는 것은 정확히 이 괴리를 해소하는 조치로, 규약 위반이 아니라
    규약(spec 문서-코드 정합) 준수 방향의 보정이다.
  - 제안: 별도 조치 불필요. 확장된 JSDoc 에는 이관된 함수가 `spec §11
    EXECUTION_RUN_WORKER_CONCURRENCY` 및 `CONTINUATION_WORKER_CONCURRENCY` 패턴 준용을 계속
    참조하도록 유지하면 spec-code 포인터 체인이 끊기지 않는다.

- **[INFO]** MAINT#9 canonical parser 통일은 spec 문서화된 계약과의 정합화이지 신규 규약 위반이 아님
  - target 위치: `system-status.constants.ts` L44-45 (`continuationConcurrency` 계산부)
  - 위반(대조) 규약: `spec/5-system/4-execution-engine.md` L1245 — "`CONTINUATION_WORKER_CONCURRENCY`
    … 비양수·비정수·비숫자 입력은 1 로 fallback" 명시. 현재 코드 `Number(process.env...) || 1` 은
    `NaN`/음수/소수(예: `1.5`)/공학표기(`1e10`) 입력에서 spec 이 요구하는 strict fallback 계약과
    실제로 다르게 동작할 수 있는 loose 파싱이다 (예: `"1e10"` → `Number("1e10") = 1e10`, truthy 이므로
    fallback 미발동 — spec 의 "비숫자·공학표기는 1 로 fallback" 위반 상태가 현재 코드에 이미 존재).
  - 상세: 계획대로 `resolveContinuationWorkerConcurrency()` (정규식 `^\d+$` 선검증 strict parser)
    로 교체하면 이 기존 spec-code 불일치가 해소된다. 즉 이번 리팩터는 규약을 새로 어기는 것이
    아니라 **기존에 존재하던 규약 미준수(spec §11 명시 vs 코드 loose parsing)를 교정**하는 방향이다.
  - 제안: 계획대로 진행. 회귀 테스트(체크리스트에 명시된 "MAINT#9 continuation strict 파싱
    회귀(비정수→1)")를 통해 `1e10`·`1.5`·`-1`·빈 문자열 케이스가 모두 `1` 로 fallback 함을
    `system-status.constants.spec.ts` (현재 continuation 관련 테스트 없음 확인)에 신규 추가할 것.

- **[INFO]** `16-system-status-api.md §3` getter/canonical-parser 컨벤션과의 정합
  - target 위치: `system-status.constants.ts` 전체 (getter 함수군 vs 모듈 top-level 상수)
  - 관련 규약: `spec/5-system/16-system-status-api.md` L96 — "모듈 로드 순서·테스트 격리 영향을 받지
    않도록 모듈 스코프 상수 대신 getter 로 평가"(threshold 류는 이미 함수형 getter 로 전환된 전례,
    2026-06-10 dead code 제거).
  - 상세: `executionRunConcurrency`/`continuationConcurrency` 는 현재도, 계획 이후도 **모듈
    top-level 상수**(`const executionRunConcurrency = resolveExecutionRunWorkerConcurrency();`)
    로 유지되며 getter 함수 패턴으로는 전환되지 않는다. 이는 `getFailedDegradedThreshold()` 류
    getter 패턴과는 형태가 다르다. 다만 이 상수들은 `@Processor` 데코레이터/모듈 초기화 시 1회
    평가가 의도된 값(worker concurrency, "모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영"
    이 spec §11 에 명시)이라 threshold getter(요청마다 재평가 필요)와 성격이 다르다 — 사용자
    프롬프트가 언급한 "getter/canonical-parser convention 정렬" 은 **parser 재사용** 측면에서는
    MAINT#9 로 충족되고, **getter 전환**까지는 계획 범위·spec 요구사항 밖이다.
  - 제안: 규약 위반 아님. getter 전환은 이번 계획의 스코프가 아니며 spec 도 이 두 concurrency
    상수에 대해 getter 화를 요구하지 않는다(오히려 "모듈 로드 시 1회"를 명시). 추가 조치 불필요.

## 요약

이번 계획(ARCH#4/ARCH#6/MAINT#9)은 모두 "동작 보존" 리팩터로 신규 명명·출력 포맷·API 문서
규약을 도입하지 않으며, `spec/conventions/**` 에 명시된 어떤 금지 패턴도 답습하지 않는다.
오히려 MAINT#9 는 `spec/5-system/4-execution-engine.md §11` 이 이미 문서화한 "비정수 입력 →
1 fallback" 계약과 실제 코드(loose `Number(...) || 1`) 사이에 존재하던 기존 불일치를 canonical
strict parser 재사용으로 해소하는 정합화이며, ARCH#4/ARCH#6 은 순수 함수 이관 + 그에 따른
모듈 JSDoc 범위 보정으로 코드-문서 포인터 체인을 유지한다. 코드 확인 결과 `execution-limits.ts`
는 이관 전 zero-import 이라 순환 의존 우려도 없다. payload 자체의 mis-scope(무관한 auth/graph-rag/
cafe24 문서 번들)는 이 세션에서 실제 계획 대조로 우회했으며, 그 mis-scope 자체는 orchestrator
prompt 조립 버그이지 target 계획의 규약 위반이 아니다. CRITICAL/WARNING 없음.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS
