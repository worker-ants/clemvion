# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건)

## 전체 위험도
**LOW** — `spec/conventions/` 델타 0(코드 전용 리팩터)이며 값 문자열 변경 없음. 유일한 실질 이슈는
신설 `EngineErrorCode` const 가 `4-execution-engine.md` §Rationale 의 2026-06-14 "에러 코드
네임스페이스는 중앙 `ErrorCode` enum 을 확장하고 새 네임스페이스를 만들지 않는다" 결정과
접촉면을 가지면서 이를 언급·반박하지 않는다는 WARNING 1건.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | 신설 `EngineErrorCode` const 가 "엔진 코드를 위한 별도 네임스페이스를 만들지 않는다"는 2026-06-14 사용자 확정 결정과 반대 결론(별도 const 신설)을 취하면서 이 결정·선례(`RETRY_*`/`EXECUTION_*` 를 레이어가 달라도 한 enum 에 유지한 선례)를 언급하거나 반박하지 않음 | `codebase/backend/src/nodes/core/error-codes.ts:115-121` (`EngineErrorCode` JSDoc), `CHANGELOG.md` Unreleased, `plan/complete/exec-intake-followups.md` ARCH#5 완료 블록 | `spec/5-system/4-execution-engine.md` §Rationale "에러 코드 네임스페이스"(2026-06-14, "신규 prefix 만들지 않고 중앙 `ErrorCode` enum 확장, `EXEC_*` 분리 표기는 기각") | 해당 JSDoc 또는 plan 완료 블록에 (a) 2026-06-14 결정이 WS ack 경계 코드에 한정된 것이라 이번 신설(Execution/NodeExecution DB 영속 봉투)은 스코프 밖이라는 점을 명시하거나, (b) central enum 확장 원칙에서 벗어나는 근거를 명시. 완화 요인: 결정 표제가 "Continuation ack client-safe typed error"로 WS-ack 경계에 한정될 가능성이 있어 CRITICAL 아닌 WARNING |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec / rationale_continuity / convention_compliance / naming_collision (중복 통합) | `spec/conventions/error-codes.md` §Overview "적용 범위" 문단이 `ErrorCode` 만 "명명이 중앙화된 대표 surface"로 서술하고, 같은 파일(`error-codes.ts`)에 신설된 두 번째 const `EngineErrorCode`(엔진 `Execution.error`/`NodeExecution.error`)를 아직 언급하지 않음 (spec-drift, 식별자 의미 충돌 아님 — frontmatter `code:` 파일 경로는 여전히 정확) | `spec/conventions/error-codes.md` §Overview; `codebase/backend/src/nodes/core/error-codes.ts` 신설 `EngineErrorCode` (~L147, ~L206-265) | 다음 planner 턴에서 §Overview 에 "`ErrorCode`(노드 핸들러 `output.error.code`) / `EngineErrorCode`(엔진 `Execution.error`/`NodeExecution.error`)" 두 surface 병기 1줄 추가. 코드 전용 PR 범위 밖이라 이번 PR 필수 조치 아님 |
| 2 | convention_compliance | repo-guards 3파일 세트(`*-guard.ts`/`*-fixture.ts`/`*.spec.ts`) 명명·구조 패턴이 5쌍 이상 누적됐음에도 이를 소유하는 `spec/conventions/**` 문서가 없음. 이번 신설 3파일은 기존 관행(`redis-fail-open-catalog-guard.ts` 등)을 정확히 답습해 위반은 아님 | `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts`, `-fixture.ts`, `engine-error-code-anchor.spec.ts` (신설) | 필요 시 추후 `spec/conventions/repo-guards.md` 신설을 고려(이번 PR 범위 밖, 즉각 조치 불요) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec/conventions 델타 0, 값 변경 없음. `EngineErrorCode` 4값 모두 기존 spec 카탈로그(1-data-model/4-execution-engine/3-error-handling/14-external-interaction-api/data-flow-3-execution)에 이미 문서화. Overview 미언급 INFO 1건뿐 |
| rationale_continuity | LOW | ARCH#5 "파일 분리" 계획을 "파일 하나·const 둘"로 뒤집은 반전 자체는 3곳(JSDoc/CHANGELOG/plan)에 일관된 새 근거로 기록돼 기준3 충족. 단 2026-06-14 네임스페이스 결정과의 접촉면 미언급 WARNING 1건 |
| convention_compliance | NONE | 명명(§1)·rename 안정성(§2)·historical-artifact 레지스트리(§3)·ANCHORED_ELSEWHERE 예외(§4.2) 전부 준수. INFO 2건(Overview 명료성, repo-guards 문서화 제안) |
| plan_coherence | NONE | 근거 plan(ARCH#5)이 diff 안에서 스스로 complete/ 이관·정합화. 자매 항목(I6) 일치. in-progress 미해결 결정(`SERVER_INTERRUPTED` 상태분류)과 비충돌 확인 |
| naming_collision | NONE | 신규 식별자(`EngineErrorCode`/`EngineErrorCodeValue`, repo-guard 3파일)는 저장소 전체 grep 상 중복 없음. 값 4개는 기존 문서화된 코드의 상수화일 뿐, 신규 의미 부여 아님. 자체 회귀 테스트가 `ErrorCode`와 키 집합 비중복을 런타임 보증 |

## 권장 조치사항
1. (선택, 필수 아님) 다음 `spec/conventions/error-codes.md` 편집 시 §Overview 에 `EngineErrorCode` 를 `ErrorCode` 와 나란히 대표 surface로 1줄 병기.
2. (선택) `EngineErrorCode` JSDoc 또는 `plan/complete/exec-intake-followups.md` ARCH#5 완료 블록에 2026-06-14 "에러 코드 네임스페이스" 결정과의 관계(스코프 한정 여부)를 1~2문장으로 명시 — WARNING 해소.
3. (선택, 낮은 우선순위) repo-guards 3파일 패턴이 5쌍 이상 누적되면 `spec/conventions/repo-guards.md` 신설 고려.
