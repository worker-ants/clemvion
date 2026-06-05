# 유저 가이드 동반 갱신(User Guide Sync) Review

## 분석 개요

매트릭스 행 수: 19개. 매칭된 trigger: 2개 (`new-error-code`, `run-debug-flow-change`). 누락 건수: 2건.

---

## 발견사항

### [WARNING] 신규 ErrorCode `EXECUTION_TIME_LIMIT_EXCEEDED` — ERROR_KO 매핑 누락

- **변경 파일**: `codebase/backend/src/nodes/core/error-codes.ts` (파일 11)
- **매트릭스 항목**: `new-error-code` — "신규 errorCode 발행 (ErrorCode enum 추가)"
  - trigger glob: `codebase/backend/src/nodes/core/error-codes.ts`
  - targets: "backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 노출됨. errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시 (후속 plan 에서 ERROR_KO 신설 검토)"
- **누락된 동반 갱신**: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO` 테이블
- **상세**:
  - `ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED = 'EXECUTION_TIME_LIMIT_EXCEEDED'` 가 `error-codes.ts` 에 신규 추가됐고, `ExecutionTimeLimitError.code` 로 `Execution.error.code` 에 영속된다.
  - 이 error code 는 실행 실패 시 사용자에게 노출되는 경로가 있다 (실행 이력, 실행 결과 패널 등).
  - 현재 `backend-labels.ts` 의 `ERROR_KO` 테이블에는 `EXECUTION_TIME_LIMIT_EXCEEDED` 키가 없다 — ko 로케일에서 `translateBackendError` 가 fallback(영문 message) 을 그대로 노출하게 된다.
  - 매트릭스 `new-error-code` 행은 glob trigger 로 `error-codes.ts` 변경을 직접 매칭한다.
  - 주: 매트릭스 주석대로 "CRITICAL" 급으로 분류될 수 있으나, 이 코드는 시스템 내부 성격이 강하고 `execution-failure-classifier.ts` 에서 `executionFailedTimeout` 으로 분류되어 채널 레벨에서는 일반 timeout 메시지로 매핑된다. 단, 실행 결과 패널 직접 error code 노출 경로(실행 이력 detail)에서는 ko 번역이 없어 영문이 그대로 표시된다.
- **제안**:
  - `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO` 테이블에 아래 키 추가:
    ```
    EXECUTION_TIME_LIMIT_EXCEEDED: "실행 시간 한도(최대 active 실행 누적 시간)를 초과했어요.",
    ```
  - 또는 PR 본문에 "사용자 가시 노출 경로 없음" 을 명시적으로 서술해 후속 plan 으로 추적.

---

### [WARNING] 실행 엔진 active-running 타임아웃 — 05-run-and-debug docs 갱신 누락

- **변경 파일**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (파일 5), `codebase/backend/src/modules/execution-engine/execution-limits.ts` (파일 7), `codebase/backend/.env.example` (파일 1)
- **매트릭스 항목**: `run-debug-flow-change` — "실행·디버깅 흐름 변경" (semantic trigger)
  - targets: "codebase/frontend/src/content/docs/05-run-and-debug/"
- **누락된 동반 갱신**: `codebase/frontend/src/content/docs/05-run-and-debug/error-handling.mdx` 및 `.en.mdx`
- **상세**:
  - PR2a 는 실행 엔진에 새로운 실패 모드를 도입했다: 단일 Execution 의 active-running 누적 시간이 기본 30분을 초과하면 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 failed 처리된다.
  - 이는 사용자가 직접 관찰하는 실행 실패 유형이며, 기존 `EXECUTION_TIMEOUT`(Code 노드 스크립트 타임아웃)과 구별된다.
  - `05-run-and-debug/error-handling.mdx` 에는 이 새로운 타임아웃 동작(active-running 누적 기준, waiting_for_input 제외, 30분 기본, env override)에 대한 설명이 없다.
  - 사용자가 실행이 "시간 초과로 실패"했는데 왜인지 이해하지 못할 수 있다 — 특히 대화 입력을 기다리다가 재개한 워크플로우가 30분 active 시간 후 실패하는 패턴.
  - 현재 `error-handling.mdx` 에는 timeout 관련 설명이 없음을 확인했다(검색 결과 무).
- **제안**:
  - `codebase/frontend/src/content/docs/05-run-and-debug/error-handling.mdx` 및 `.en.mdx` 에 "실행 시간 한도 초과" 섹션 추가:
    - active-running 누적 시간 기준 설명 (waiting_for_input 제외 이유 포함)
    - 기본 30분, env `EXECUTION_MAX_ACTIVE_RUNNING_MS` 로 조정 가능
    - `EXECUTION_TIMEOUT`(Code 노드 스크립트)과의 차이

---

## 요약

매트릭스 19개 행 중 2개 trigger 에 매칭됐다: `new-error-code`(glob, `error-codes.ts` 신규 enum 값 `EXECUTION_TIME_LIMIT_EXCEEDED`)와 `run-debug-flow-change`(semantic, 실행 엔진 active-running 타임아웃 신규 동작). 두 trigger 모두 동반 갱신이 누락됐다: `backend-labels.ts` 의 `ERROR_KO` 매핑 미등록(ko 로케일 영문 노출 위험)과 `05-run-and-debug/error-handling.{mdx,en.mdx}` 의 새 실패 유형 미문서화. 나머지 변경 파일(migration SQL, entity, spec/e2e 테스트, review 산출물, plan)은 매트릭스 어떤 trigger 에도 매칭되지 않는다.

## 위험도

MEDIUM
