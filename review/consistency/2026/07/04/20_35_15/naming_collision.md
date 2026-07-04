# 신규 식별자 충돌 검토 결과

## 메모: payload 범위 정정

전달된 `_prompts/naming_collision.md` 는 `spec/5-system/` 전체(§1 인증부터 §multiple 하위
문서까지) 를 target 문서로 번들링하고 있었으나, `git -C <worktree> diff origin/main...HEAD --stat`
로 실제 변경분을 확인한 결과 이번 PR 의 diff 는 다음 두 테스트 파일에 한정된다(운영 코드·spec
문서 변경 없음):

- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (신규 unit
  테스트 3건 + `admitStub` 헬퍼 추가)
- `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` (신규 e2e 테스트 1건 + 기존
  helper `createCapWorkflow`/`execute`/`getStatus`/`poll` 에 선택적 `wsId`/`workflowCap` 파라미터 추가)

payload 의 `spec/5-system/` 전체 텍스트는 이 diff 와 무관한 과거(불변) spec 본문이므로, 신규
식별자 충돌 분석은 실제 diff(`git diff origin/main...HEAD` 로 재확인) 기준으로 수행했다. 이는
`feedback_impl_done_spec_bundle_bug` 케이스와 동일한 payload mis-scope 패턴이다.

## 발견사항

이번 diff 에서 도입되는 식별자는 모두 아래와 같이 **파일-스코프 지역 변수/함수** 또는
**테스트 title 문자열**이며, module export·public API·DTO·엔티티·endpoint·이벤트명·ENV
key·spec 파일 경로 등 "충돌이 실질적 혼선을 유발할 수 있는" 범주에 해당하는 신규 식별자는
없다.

- **[INFO]** `admitStub` 헬퍼 — 파일 로컬, 충돌 없음
  - target 신규 식별자: `admitStub` (`execution-engine.service.spec.ts:3495` 부근, `admitExecutionOrDefer`/`runExecution` 을 stub 하는 로컬 const 함수)
  - 기존 사용처: 없음. `grep -rn "admitStub" codebase/ spec/` 결과 이 파일 내 정의·3회 사용(3517/3539/3556) 뿐
  - 상세: export 되지 않는 `describe` 블록 내부 지역 헬퍼. 같은 파일 내 이미 존재하는 `admit`(admission 헬퍼, L3186 부근에서 사용) 과 이름이 유사하지만 `admit` 은 실제 서비스 메서드 호출 wrapper, `admitStub` 은 그 메서드를 mock 으로 대체하는 stub — 접미사 `Stub` 으로 이미 의도가 명확히 구분되어 있어 실질적 혼동 위험은 낮음
  - 제안: 변경 불필요. 최소 보완을 원하면 JSDoc 한 줄로 "admit(실호출) vs admitStub(mock 대체)" 구분을 명시할 수 있으나 필수는 아님

- **[INFO]** e2e helper 파라미터화 (`createCapWorkflow`, `execute`, `getStatus`, `poll`)
  - target 신규 식별자: 각 함수의 신규 선택적 파라미터 `wsId`, `workflowCap` (`execution-concurrency-cap.e2e-spec.ts`)
  - 기존 사용처: 동일 파일 내 기존 시그니처(`workspaceId` 고정 사용). 타 e2e 파일(`execution-park-resume.e2e-spec.ts`, `execution-stalled-redelivery.e2e-spec.ts`, `execution-crash-redrive.e2e-spec.ts`, `background-monitoring.e2e-spec.ts`, `re-run.e2e-spec.ts`, `workflow-execution.e2e-spec.ts`) 에도 각각 파일-로컬 `poll`/`pollExecution` 헬퍼가 존재하나 전부 파일 스코프이며 시그니처·의미가 이 프로젝트의 반복 관례(멱등 polling helper)와 일치
  - 상세: 하위호환 방식(default parameter, 기존 호출부는 그대로 workspaceId 를 기본값으로 사용)으로 확장되어 기존 테스트 3건(L175, L199)의 동작 변화 없음. 신규 e2e 테스트(L220, workspace-level cap 단독 검증)만 새 파라미터를 명시적으로 사용
  - 제안: 변경 불필요

- **[INFO]** 신규 테스트 title 4건 — 기존 title 과 충돌 없음
  - target 신규 식별자(title 문자열):
    - `원자 UPDATE 파라미터 순서·cap 매핑 회귀: [executionId, workspaceId, wsCap, workflowId, wfCap]` (unit)
    - `admission deferred → routing 등록 후 release + runExecution 미호출` (unit)
    - `admission cancelled → runExecution 미호출 + runExecutionFromQueue 는 release 안 함 (markQueueWaitTimeout 이 처리)` (unit)
    - `workspace-level cap 초과 → 다른 workflow 실행도 pending → 슬롯 해제 시 admitted` (e2e)
  - 기존 사용처: 동일 `describe` 블록 내 기존 title(`cap 여유(affected=1) → admitted...`, `cap 초과(affected=0) → deferred...`, `큐 대기 5분 초과 → cancelled...`, `cap 초과 → pending 대기 → 슬롯 해제 시 admitted (재큐)`, `cap 초과 지속 → 큐 대기 초과 시 cancelled + EXECUTION_QUEUE_WAIT_TIMEOUT`) 와 문자열 동일성 없음, 검증 관점도 상호 배타적(파라미터 순서/cap 매핑 vs 결과별 분기 vs workspace-level 단독 gating)
  - 상세: Jest 는 동일 title 중복 시에도 실행은 되지만 리포트 가독성이 떨어지는데, 이번 신규 title 4건은 기존 title 과 완전히 구분되며 서로 검증 시나리오도 겹치지 않는다(unit: admission outcome 3분기 vs 파라미터 바인딩; e2e: workspace-level cap vs 기존 workflow-level cap)
  - 제안: 변경 불필요

- **[INFO]** `PR2b §8` 참조 — 기존 라벨 재사용(신규 ID 아님)
  - target 신규 식별자: 없음. e2e describe title·파일 top comment 의 `PR2b — 동시성 cap admission gate` 문자열은 신규 도입이 아니라 diff 이전부터 이미 존재하던 라벨(`plan/in-progress/spec-draft-concurrency-cap-pr2b.md`, `spec/5-system/4-execution-engine.md §8`)을 그대로 유지
  - 기존 사용처: `plan/in-progress/spec-draft-concurrency-cap-pr2b.md`, `spec/5-system/4-execution-engine.md §8`, 그 외 `plan/complete/spec-update-pr2a-active-running-invariants.md` 등 다수
  - 상세: 신규 요구사항 ID 부여가 아니므로 충돌 검토 대상 아님(참고 목적으로만 기록)
  - 제안: 해당 없음

## 요약

이번 target diff(실제로는 `git diff origin/main...HEAD` 기준 두 테스트 파일에 한정)는 신규
public 식별자(엔티티/DTO/endpoint/이벤트명/ENV key/spec 경로 등)를 전혀 도입하지 않는다.
추가된 것은 파일-스코프 테스트 헬퍼(`admitStub`)와 기존 e2e 헬퍼의 선택적 파라미터
확장(`wsId`, `workflowCap`), 그리고 4건의 신규 테스트 title 뿐이며, 이들 모두 기존 코드베이스의
동일 관례(파일별 지역 `poll`/`pollExecution` 헬퍼, `*Stub`/`*Spy` 명명)와 일치하고 기존
title·식별자와 문자열/의미 모두 충돌하지 않는다. CRITICAL/WARNING 수준의 충돌은 발견되지
않았다.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS
