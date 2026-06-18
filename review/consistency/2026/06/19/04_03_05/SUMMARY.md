# Consistency Check 통합 보고서 (impl-done)

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — WARNING 1건(명명 중복: `StructuredInteraction` vs `PresentationInteractionPayload`). 나머지 전부 INFO (대부분 "충돌/위반 없음" 확인).

## Critical 위배
해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | 위치 | 처분 |
|---|---------|------|------|------|
| 1 | NamingCollision | `StructuredInteraction`(button-interaction.service.ts:79) 과 `PresentationInteractionPayload`(conversation-thread.service.ts:40) 가 동일 개념(node-output.md §4.4 interaction)을 다른 타이트닝으로 중복 정의 — shape drift 위험 | button + conversation-thread | **이연(pre-existing)**: 두 타입 모두 본 refactor 이전부터 존재. 내 변경은 StructuredInteraction 을 module-level export 노출만. 통합(alias/canonical 단일화)은 cross-module refactor — ai-review 03_51_29 W1(StructuredInteraction → shared/)과 동일 concern → **type-consolidation 후속**(별도). 회귀·런타임 충돌 아님. |

## 참고 (INFO) 주요
- I-1/6 (CrossSpec/Rationale): StructuredInteraction.type union = node-output.md §4.5 4값 일치, 충돌 없음.
- I-2 (clickedBy 누락 = 기존 verbatim, diff 외), I-3/12 (previousOutput 과도기 = node-output.md §4.2 명시 범위, Phase 3 정리 예정), I-4 (ButtonClickPayload = §7.4 일치, payload schema 명문화 기회).
- I-5/7 (순수함수 추출/read-timing = C-1 Rationale 연장, 위반 없음; spec Rationale 한 줄 추가 선택).
- I-9 (`INVALID_BUTTON_ID` ErrorCode enum 미등재 — 내부 엔진 throw, 형식 준수; enum 등재/JSDoc 선택), I-10 (주석 spec 경로 약칭).
- I-11 (SPEC-DRIFT planner 2건 plan 추적중 — 별도 조치 불요), I-13/14/15 (ButtonClickPayload/ButtonInteractionResolution/신규 export 충돌 없음).

## Checker별 위험도
| Checker | 위험도 | 핵심 |
|---------|--------|------|
| CrossSpec | NONE | interaction.type·payload·previousOutput 모두 spec 정합 |
| RationaleContinuity | NONE | C-1 Rationale 연장 behavior-preserving, 기각 대안 재도입 없음 |
| ConventionCompliance | NONE | CRITICAL/WARNING 위반 없음, 형식 INFO 3건 |
| PlanCoherence | NONE | plan 완료 항목 일치, planner 후속 추적중 |
| NamingCollision | LOW | StructuredInteraction/PresentationInteractionPayload 중복(W1, pre-existing) |

## 권장 조치
1. (WARNING — 이연) StructuredInteraction/PresentationInteractionPayload 단일 canonical 통합 → type-consolidation 후속(cross-module).
2. (planner) §Rationale C-1 순수함수 분리·read-timing 한 줄 + node-output.md §4.2 button_continue — plan SPEC-DRIFT 후속 추적중.
3. (선택) INVALID_BUTTON_ID enum 등재·주석 경로 명시.

> impl-done **BLOCK:NO** — SPEC-CONSISTENCY 게이트 충족. W1 = pre-existing cross-module 타입중복(회귀 아님) → 수렴, type-consolidation 후속 등재.
