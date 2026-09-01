# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-error-code-two-surfaces.md`

## 검토 범위

target 은 `spec/conventions/error-codes.md` §Overview "적용 범위" 문단에 `EngineErrorCode` 를
`ErrorCode` 와 병기하자는 spec draft(`--spec` 모드)다. 아래는 이 draft 가 (a) `spec/conventions/**`
자체의 명명·구조 규약, (b) project-planner 의 draft 산출 규약(`.claude/skills/project-planner/SKILL.md`)
을 따르는지에 대한 검토다.

## 실측 검증 (draft 의 "실측" 표 대조)

draft 가 제시한 근거를 코드베이스에서 직접 재확인했다 — 모두 정확했다.

| 확인 항목 | draft 주장 | 실측 |
|---|---|---|
| `ErrorCode` 선언 위치 | `error-codes.ts:8` | `export const ErrorCode = {` 가 정확히 8행 |
| `EngineErrorCode` 선언 위치 | 같은 파일 `:147` | `export const EngineErrorCode = {` 가 정확히 147행 |
| overlap 테스트 | `error-codes.spec.ts:59` | 59행이 `expect(overlap).toEqual([]);` (해당 `it` 블록 내) |
| 규약 문서 미기재 | "그 사실이 규약 문서 어디에도 없다" | `grep EngineErrorCode spec/conventions/error-codes.md` 0건 — 정확 |
| 트리거 plan 이 planner 턴 지정 | `spec-conventions-engine-error-code-surface.md` 참조 | 해당 plan 을 직접 열어 확인 — "developer 가 쓴 문장도 아니고 규약 서술" 이라는 판단 근거까지 일치 |
| `Execution.error`/`NodeExecution.error` 필드명 | 엔진이 이 두 필드에 싣는다 | `spec/1-data-model.md:557` 이하가 이미 이 두 필드명을 정의하고 전역에서 이 표기를 그대로 쓰고 있음 — 신규 조어 아님 |

## 발견사항

- **[INFO]** 병기 문구와 기존 "대표 surface"(단수) 서술의 통합 방식이 draft 에 미확정
  - target 위치: `## 변경 제안` (target 문서 55~65행)
  - 위반 규약: 직접 위반 아님 — `spec/conventions/error-codes.md` §Overview 원문 "명명이
    중앙화된 **대표 surface**"(단수 서술)와의 정합
  - 상세: draft 는 추가할 불릿 3개만 제시하고, 기존 문장 "`ErrorCode` enum(... — 명명이
    중앙화된 **대표 surface**)뿐 아니라 ..." 를 그대로 둘지 "대표 surface(들)" 로 고칠지를
    명시하지 않았다. `ErrorCode`/`EngineErrorCode` 두 surface 를 나열하면서 앞 문장이 단수
    "대표 surface" 로 남으면 나열 목록과 도입부 문장이 어색하게 어긋날 수 있다.
  - 제안: §5 "spec 반영" 단계(실제 `error-codes.md` 수정 시점)에서 도입부 문장도 함께
    조정하도록 draft 에 한 줄 추가 — 또는 planner 가 실제 반영 시 자연스럽게 처리한다면
    이 항목은 문제 없음(현재도 CRITICAL/WARNING 은 아님).

## 준수 확인 (위반 없음 — 참고용 근거)

- **파일 명명**: `plan/in-progress/spec-draft-error-code-two-surfaces.md` — project-planner
  SKILL §작업 워크플로 3 "`plan/in-progress/spec-draft-<name>.md`" 패턴과 정확히 일치.
- **본문 구조**: `## Overview` 로 시작, `## Rationale` 로 종료 — 동일 SKILL "본문 끝에
  `## Rationale` 로 결정 근거 명시" 요구 충족.
- **frontmatter**: `worktree`/`started`(ISO)/`owner` 필수 3필드 모두 존재
  (`.claude/docs/plan-lifecycle.md §4`). `worktree: easy-a-harness-hygiene` 는 실제 CWD 와 일치.
  `spec_impact` 는 YAML 리스트(`- spec/conventions/error-codes.md`) 형식으로 Gate C 스키마
  (`feedback_spec_impact_gate_c_list`) 요구를 만족 — bare string 아님.
- **자기-반증형 소정정 예외 판정**: target 이 스스로 "developer 의 예외에 해당하지 않는다" 고
  명시한 근거(① 규약 서술이지 예고·트리거가 아님, ② developer 가 쓴 문장이 아님)가 CLAUDE.md
  §자기-반증형 소정정의 5조건 중 조건 2(예고·트리거 한정)에 정확히 부합한다 — 오적용 없음.
  planner 트랙으로 분리 등재한 판단 자체가 규약을 올바르게 따른 것이다.
  `code:` frontmatter(`error-codes.md` — `codebase/backend/src/nodes/core/error-codes.ts`
  단일 파일)도 `ErrorCode`/`EngineErrorCode` 모두 그 한 파일에 있어 변경 불필요 — 정합.
  `spec/conventions/error-codes.md` §3 의 `WORKER_HEARTBEAT_TIMEOUT` 행이 이미 `EngineErrorCode`
  소속 코드(코드 실측으로 확인)를 다루고 있어, §Overview 만 그 surface 를 누락하고 있었다는
  draft 의 문제 진단도 근거가 있다.
- **명명·출력 포맷·API 문서·금지 항목**: draft 는 신규 API endpoint·DTO·에러 코드 값을
  발행하지 않고 기존에 이미 코드베이스에 존재하는 두 const 를 문서에 병기하는 것뿐이라
  이 네 관점에서 직접 해당하는 위반은 없음.

## 검토 방법상 제약 (target 결함 아님)

번들된 정식 규약 중 `error-codes.md` 가 §1.4 "표기(UPPER_SNAKE_CASE)" SoT 로 참조하는
`spec/conventions/node-output.md`·`spec/conventions/swagger.md` 는 이번 bundle 에서
컨텍스트 예산 초과로 절단됐다(`_prompts/convention_compliance.md` 679~707행,
"의도된 절단" 명시). target 이 §1 표기 규약을 재선언하지 않으므로 직접 영향은 없다고
판단했으나, 완전한 교차 확인은 못했다는 점을 기록한다.

## 요약

target draft 는 project-planner 의 spec-draft 산출 규약(파일 명명·frontmatter 스키마·
Overview/Rationale 구조)을 정확히 따르고 있고, "실측" 섹션의 모든 수치·인용(파일 라인,
테스트 라인, 트리거 plan 근거)이 코드베이스 대조 결과와 일치했다. 제안 내용(`ErrorCode`/
`EngineErrorCode` 병기)도 기존 `error-codes.md` §3 레지스트리·`spec/1-data-model.md` 의
`Execution.error`/`NodeExecution.error` 필드명과 정합되며 새로운 명명·포맷·금지 패턴을
도입하지 않는다. CRITICAL/WARNING 급 위반은 발견되지 않았고, 유일한 INFO 는 실제 spec
반영 시 도입부 단수 서술("대표 surface")과 병기 목록의 문장 통합 방식을 명확히 하라는
사소한 제안이다.

## 위험도

NONE
