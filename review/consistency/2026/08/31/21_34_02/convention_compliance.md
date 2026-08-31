# 정식 규약 준수 검토 — error-codes 레이어 분리 (`ErrorCode` / `EngineErrorCode`)

## 검토 범위 및 방법
- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- `spec/conventions/**` 자체의 델타는 0개 파일(정상 — 이 브랜치는 코드 전용 PR). 실질 검토 대상은 8개 파일/719줄의 **구현 diff**가 기존 `spec/conventions/error-codes.md` 규약을 따르는가이다.
- 프롬프트 번들에서 `spec/conventions/error-codes.md` 본문이 예산 절단으로 생략되어 있었으므로, 워킹트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/error-codes-layer-split-6aae00/spec/conventions/error-codes.md`)에서 직접 Read 하여 검토했다. 관련 카탈로그 SoT(`spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`)도 같은 워킹트리에서 grep 대조했다.

## 발견사항

이번 diff는 CRITICAL/WARNING 급 규약 위반이 발견되지 않았다. 아래는 INFO 급 제안 2건이다.

- **[INFO]** `error-codes.md` "적용 범위" 문단이 신설 `EngineErrorCode` const 를 명시하지 않음
  - target 위치: `codebase/backend/src/nodes/core/error-codes.ts` L206-265 (신설 `EngineErrorCode` const 및 그 JSDoc)
  - 관련 규약: `spec/conventions/error-codes.md` §Overview "적용 범위" 문단 (`ErrorCode` enum 을 "명명이 중앙화된 **대표 surface**"로 지칭)
  - 상세: §Overview 는 이 규율(§1 의미 기반 명명, §2 rename 안정성)이 "`ErrorCode` enum 뿐 아니라 프로젝트 전체의 에러 코드 문자열에 적용된다"고 명시적으로 포괄하므로 정책 적용 범위 자체에는 공백이 없다. 다만 같은 파일(`error-codes.ts`)에 `ErrorCode` 와 별도로 `EngineErrorCode` 라는 두 번째 named const 가 신설된 사실은 spec 어디에도 언급이 없다 — `error-codes.md` frontmatter `code:` 필드는 파일 단위 참조라 여전히 정확하지만, 문서만 읽는 독자는 "대표 surface" 가 `ErrorCode` 하나뿐이라고 오인할 수 있다. 참고로 이 레이어 구분(엔진 레벨 `Execution.error`/`NodeExecution.error` vs 노드 레벨 `output.error.code`) 자체는 `3-error-handling.md` L121("노드 수준 런타임 에러 … 정식 목록은 `ErrorCode` enum")·L110-111(엔진 레벨 `EXECUTION_TIMEOUT`/`EXECUTION_TIME_LIMIT_EXCEEDED`)에 이미 개념적으로 존재해, 코드의 레이어 분리는 spec 이 이미 인정하던 구분을 타입으로 명문화한 것에 가깝다.
  - 제안: 규약 위반이 아니므로 필수 조치는 아니다. 명료성을 위해 `error-codes.md` "적용 범위" 문단(또는 새 하위 절)에 `EngineErrorCode`(엔진 레벨 `Execution.error`/`NodeExecution.error`)를 `ErrorCode`(노드 `output.error.code`)와 나란히 1줄 언급하면 향후 참조가 더 정확해진다. spec 변경이 필요하다면 CLAUDE.md 절차상 `project-planner` 턴으로 진행.

- **[INFO]** repo-guards 3파일 세트(`*-guard.ts`/`*-fixture.ts`/`*.spec.ts`) 패턴이 `spec/conventions/**`에 명문화되어 있지 않음
  - target 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts`, `-fixture.ts`, `engine-error-code-anchor.spec.ts` (신설 3파일)
  - 관련 규약: 해당 없음 — `spec/conventions/**` grep 결과 "repo-guards" 참조 문서 부재.
  - 상세: 신설 3파일은 기존 `redis-fail-open-catalog-guard.ts`/`-spec.ts`, `masked-reject-callers-guard.ts`/`-spec.ts` 등 기존 repo-guards 명명·구조 패턴(파서 순수 로직 분리 + 소비 spec + 필요시 픽스처)을 정확히 답습한다 — 이 자체는 기존 관행과 완전히 일치해 위반이 아니다. 다만 이 패턴이 5쌍 이상 누적됐는데도 이를 소유하는 conventions 문서가 없다.
  - 제안: 규약 위반이 아니라 승격 제안이다. 필요하면 추후 `spec/conventions/repo-guards.md` 로 패턴을 문서화하는 것을 고려할 수 있으나 이번 PR 범위 밖이며 즉각 조치는 불필요하다.

## 준수 확인 (근거 — CRITICAL/WARNING 없음을 뒷받침)

- **명명 규약(§1 의미 기반 명명, UPPER_SNAKE_CASE)**: 신설 `EngineErrorCode` 의 4개 값(`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WORKER_HEARTBEAT_TIMEOUT`/`SERVER_INTERRUPTED`/`WEBCHAT_IDLE_TIMEOUT`) 모두 UPPER_SNAKE_CASE 이며, 전부 **기존에 이미 존재하던 맨 문자열 값**을 그대로 상수화한 것 — 신규 코드 신설도 rename 도 아니다.
- **§2 rename 안정성 정책**: 이번 diff는 문자열 값을 전혀 바꾸지 않고(`'WORKER_HEARTBEAT_TIMEOUT'` → `EngineErrorCode.WORKER_HEARTBEAT_TIMEOUT`, 값은 `'WORKER_HEARTBEAT_TIMEOUT'`으로 동일) 참조 방식만 앵커로 바꿨다. 정책이 요구하는 "이름 유지" 원칙과 정확히 부합한다.
- **§3 historical-artifact 레지스트리 정합**: `error-codes.ts` 신설 JSDoc 이 `WORKER_HEARTBEAT_TIMEOUT` 에 대해 "SoT: `spec/conventions/error-codes.md §3`"라고 인용한 서술(HEARTBEAT 명칭이 실제로는 별도 채널을 암시하지 않으며 rename=breaking이라 유지)은 `error-codes.md` §3 레지스트리 행(L70)의 서술과 정확히 일치한다.
- **카탈로그 SoT(`3-error-handling.md`) 정합**: `EXECUTION_QUEUE_WAIT_TIMEOUT`(L140)·`WEBCHAT_IDLE_TIMEOUT`(L142)·`WORKER_HEARTBEAT_TIMEOUT`(L112)·`SERVER_INTERRUPTED`(`4-execution-engine.md` L1362)는 모두 이미 spec 카탈로그에 등재된 기존 코드이며, 이번 diff는 신규 미등재 코드를 도입하지 않았다.
- **ANCHORED_ELSEWHERE 예외 설계와 §4.2 정합**: 가드가 예외로 등재한 `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED` 는 `error-codes.md` §4.2 표(`details[].code` 레이어)와 정확히 일치하는 항목이며, 봉투 최상위 `code`가 아니라 `details[].code` 레이어라는 근거도 §4.2 서술과 부합한다.
- **레이어 분리(엔진 vs 노드) 자체의 spec 근거**: `3-error-handling.md` L121 이 `ErrorCode` enum 을 "노드 수준 런타임 에러(`output.error.code`)" 로 명시적으로 한정하고, 엔진 레벨 코드(`EXECUTION_TIMEOUT` 등, L110-111)를 별도로 다루고 있어 코드의 "레이어는 타입에, SoT 는 파일 하나로" 설계는 spec 이 이미 전제하던 구분을 형식화한 것으로 판단된다.
- **인용의 사실성**: JSDoc/가드 주석이 인용하는 리뷰 세션(`review/code/2026/08/31/20_43_35`, `20_59_14`)은 실제로 저장소에 존재해 날조된 근거가 아니다.

## 요약

이번 PR은 `spec/conventions/**` 를 직접 변경하지 않은 코드 전용 diff이며, 검토 결과 `spec/conventions/error-codes.md` 의 명명·rename 안정성·historical-artifact 레지스트리·내부 분류 코드(§4.2) 규약을 모두 정확히 준수한다. 신설 `EngineErrorCode` 는 새 코드를 도입하거나 기존 코드명을 바꾼 것이 아니라, 이미 spec 카탈로그(`3-error-handling.md`/`4-execution-engine.md`)에 등재돼 있던 4개 값을 맨 문자열에서 타입 앵커로 승격한 것으로, §2 rename 정책의 취지("이름은 유지하고 정확성만 향상")에 정확히 부합한다. `ANCHORED_ELSEWHERE` 예외 설계 역시 `error-codes.md` §4.2 표와 일치해 새 예외 근거를 지어내지 않았다. CRITICAL/WARNING 급 위반은 발견되지 않았으며, INFO 2건(문서 명료성 제안·guard 패턴 문서화 제안)만 남긴다.

## 위험도

NONE
