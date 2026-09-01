# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음 (5개 checker 전원 실행·전문 확보 완료: cross_spec MEDIUM · rationale_continuity LOW · convention_compliance NONE · plan_coherence MEDIUM · naming_collision NONE)

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, 3개 checker(cross_spec/rationale_continuity/plan_coherence)가 각기 다른 각도에서 같은 핵심 갭을 지적: 착수 근거 plan 이 "이 항목의 실제 무게"라 명시한 "언제 central enum 을 확장하고 언제 자매 const 를 만드는가" 판단 기준을 target draft 가 다루지 않음. 추가로 cross_spec 은 `spec/1-data-model.md`·`spec/5-system/4-execution-engine.md` 와의 서술 불일치 2건을 별도로 지적.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — Critical 자체가 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `EngineErrorCode` 귀속 규칙("엔진이 싣는다")이 `Execution.error`/`NodeExecution.error` 필드 정의와 어긋나는 예시를 포함 — 이 두 필드는 실제로 `ErrorCode`(복사된 노드 실패 코드)와 `EngineErrorCode` 가 공존하는 필드이고, draft 가 든 근거인 `EXECUTION_TIME_LIMIT_EXCEEDED` 는 실측상 `EngineErrorCode` 가 아니라 `ErrorCode` 소속(`error-codes.ts:73`) | `## 변경 제안` bullet 2·3 | `spec/1-data-model.md:474`(Execution 컬럼 표 `error` 행), `:557-563`(관계 표) | `EngineErrorCode` bullet 에 "두 code family 공존" 단서 추가, 또는 `EXECUTION_TIME_LIMIT_EXCEEDED` 류 예외를 각주로 명시. `spec_impact` 에 `spec/1-data-model.md` 동반 검토 추가 |
| 2 | cross_spec | `4-execution-engine.md` §Rationale 의 "신규 코드는 중앙 `ErrorCode` 확장" 결정(2026-06-14)과 draft 가 승인하는 "자매 const" 패턴 사이에 명시적 우선순위/scope 경계 없음 | `## Rationale` "왜 자매 const 인가 (선례와의 이탈)" | `spec/5-system/4-execution-engine.md:1143`, `:1800` | (a) target 에 "이 병기는 기존 4종 값의 사후 문서화일 뿐, 향후 신규 엔진 코드에 대한 일반 원칙 선언이 아님" scoping 한 줄 추가, 또는 (b) `4-execution-engine.md` §Rationale 에 `error-codes.md` 병기를 가리키는 상호 참조 추가 |
| 3 | cross_spec + rationale_continuity + plan_coherence (동일 이슈, 3개 checker 중복 지적 — 최고 등급 채택) | 착수 근거 plan(`spec-conventions-engine-error-code-surface.md`)이 "이 항목의 실제 무게"라 명시한 질문 — "언제 central enum 을 확장하고 언제 자매 const 를 만드는가"의 판단 기준을 함께 적을지 — 에 target 이 답하지 않음. 근거인 `exec-intake-followups.md` ARCH#5 ⑤ 의 유보("의식적 이탈"·"해석의 여지가 있다")도 target Rationale 이 "재확인할 뿐 번복하지 않는다" 한 문장으로 단순화하며 지워짐 | `## 변경 제안`(53~63행), `## Rationale` "왜 자매 const 인가"(71~73행) | `plan/in-progress/spec-conventions-engine-error-code-surface.md` §함께 볼 것; `plan/complete/exec-intake-followups.md` ARCH#5 ⑤(82~92행) | (a) 판단 기준 한 문단 추가 + ARCH#5⑤ 유보 그대로 인용, 또는 (b) "판단 기준 문서화는 별도 트랙으로 분리한다"를 명시적으로 결정·기록하여 질문에 답한 흔적을 남길 것. 둘 중 하나를 반드시 선택 — 질문이 사라진 채로 두지 말 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | 병기 문구 추가 후 기존 "대표 surface"(단수) 도입부 서술과의 통합 방식이 draft 에 미확정 | `## 변경 제안`(55~65행) vs `error-codes.md` §Overview 도입부 | 실제 spec 반영 시(§5 단계) 도입부 문장도 단수→복수 표현으로 함께 조정 |
| 2 | plan_coherence | 착수 근거 plan(`spec-conventions-engine-error-code-surface.md`)의 체크리스트(미체크 2건)·`worktree: (unstarted)` frontmatter 가 draft 존재를 아직 반영하지 않음 | 착수 근거 plan 자체 | draft 적용 커밋에서 체크리스트 갱신 + `plan/complete/` 이동을 함께 수행 |
| 3 | naming_collision | `ErrorCode` 라는 이름이 코드베이스에 이미 중의적(`codebase/packages/expression-engine/src/errors.ts:5` 의 별개 `ErrorCode` enum, `EXPR_*` 값) — target 이전부터 존재, target 이 악화시키지 않음 | 참고 — target 직접 영향 없음 | 향후 expression-engine `ErrorCode` 를 spec 에 등재할 일이 생기면 "대표 surface 는 정확히 둘" 프레이밍을 "대표 surface 목록"으로 재검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `EngineErrorCode` 귀속 규칙이 `1-data-model.md` 필드 정의와 어긋나는 예시 포함 + `4-execution-engine.md` 결정과 scope 경계 미정 (WARNING 2건) |
| rationale_continuity | LOW | 착수 plan 이 요구한 "판단 기준" 질문에 target 미응답 (WARNING 1건, 나머지 실측·process 전부 정합) |
| convention_compliance | NONE | 산출 규약(파일명·frontmatter·구조) 전부 정합, 실측 표 코드베이스와 100% 일치. INFO 1건만 |
| plan_coherence | MEDIUM | 착수 근거 plan 이 "실제 무게"라 명시한 결정이 draft 에서 다뤄지지 않음(WARNING) + 체크리스트/frontmatter 미반영(INFO) |
| naming_collision | NONE | 신규 식별자 도입 없음, 충돌 없음. 기존 중의성 1건 INFO |

## 권장 조치사항
1. **(최우선, WARNING #3)** target 의 `## 변경 제안`/`## Rationale` 에 "언제 central enum 을 확장하고 언제 자매 const 를 만드는가"에 대한 판단 기준을 명시적으로 추가하거나, 추가하지 않기로 한 결정과 근거를 명시적으로 기록할 것 — 3개 checker 가 독립적으로 지적한 동일 갭이며, 착수 근거 plan 이 스스로 "이 항목의 실제 무게"라 부른 지점이다.
2. **(WARNING #1)** `EngineErrorCode` bullet 에 `Execution.error`/`NodeExecution.error` 가 두 code family 를 공존시킨다는 단서와 `EXECUTION_TIME_LIMIT_EXCEEDED` 예외를 추가하고, `spec_impact` 에 `spec/1-data-model.md` 동반 검토를 등재할 것.
3. **(WARNING #2)** `4-execution-engine.md` §Rationale 과의 우선순위/scope 관계를 draft 에 한 줄로 명확히 하거나 상호 참조를 추가할 것.
4. (INFO, 여유 있을 때) §Overview 도입부 "대표 surface" 단수 표현을 병기 목록과 통합 조정, 착수 근거 plan 체크리스트 동시 갱신.