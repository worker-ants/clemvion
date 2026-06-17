# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 위배는 WARNING 이하.

## 전체 위험도
**LOW** — 두 건의 WARNING(규약 drift)과 복수의 INFO(spec/plan 동기화 지연). 즉각적 기능 오동작 없음.

---

## Critical 위배 (BLOCK 사유)

*없음*

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec / Convention Compliance | `button_continue.data` shape 에 미명세 `selectedItem?` 포함 | `button-interaction.service.ts` `processButtonResumeTurn` link 버튼 분기 | `spec/conventions/node-output.md` §4.5; `spec/5-system/4-execution-engine.md` §1.3; `spec/4-nodes/6-presentation/0-common.md` | (A) item-level 링크 버튼에서 실제로 필요하다면 세 spec 파일의 `button_continue` shape 을 `{ buttonId, buttonLabel, url, selectedItem? }` 로 갱신. (B) 불필요하다면 구현에서 `selectedItem` spread 제거 |
| W-2 | Cross-Spec / Convention Compliance | 명시 폐기 예정 `previousOutput` 을 신규 resume output 에 추가 | `button-interaction.service.ts` `processButtonResumeTurn` `structuredOutputPayload` 조립 (diff +878–882) | `spec/conventions/node-output.md` §4.2 "폐기할 필드 / 구조" | 신규 코드에서 `previousOutput` 추가를 피하거나, Phase 3 완료 전 필수 보존 근거가 있다면 `spec/conventions/node-output.md` §4.2 에 "ButtonInteractionService 를 포함한 presentation resume 경로는 Phase 3 까지 `previousOutput` 보존 예외" 항목을 공식 추가 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | spec 이 `processFormResumeTurn` / `processButtonResumeTurn` / `waitForButtonInteraction` 를 `ExecutionEngineService` 직속으로 암묵 표현 | `spec/5-system/4-execution-engine.md` §7.5 lines 941-942, 959; §1 line 83 | spec §7.5 rehydration 설명에 "form/button 처리는 각각 `FormInteractionService` / `ButtonInteractionService` 로 위임 (C-1 step3 — AiTurnOrchestrator 선례)" 구문 추가 |
| I-2 | Cross-Spec | `processFormResumeTurn` 4-branch 테스트가 engine spec 파일에서 제거됐으나 `form-interaction.service.spec.ts` 이전 여부 미확인 | `execution-engine.service.spec.ts` diff (lines 1416-1835 제거) | `FormInteractionService.spec.ts` 에 sentinel/non-sentinel/RUNNING/null 4-branch 커버리지가 존재하는지 확인. 없으면 추가 |
| I-3 | Rationale Continuity | `previousOutput` 유예 결정이 코드 주석에만 존재하고 spec Rationale 에 미등재 | `button-interaction.service.ts` L872-882 | `spec/conventions/node-output.md` §4.2 또는 `spec/5-system/4-execution-engine.md §Rationale` 에 "Phase 3 완료 전 `previousOutput` 단계적 유예" 항 추가 |
| I-4 | Rationale Continuity | god-class strangler-fig 분리(C-1) 결정 근거가 spec Rationale 에 미반영 (plan 에 PR4 완료 시 예약) | `spec/5-system/4-execution-engine.md §Rationale` | PR3↔PR4 사이에 `§Rationale` 에 "EngineDriver forwardRef·추출 서비스 배치 결정" 항 조기 작성 검토. plan 의 PR4 예약 유지 |
| I-5 | Convention Compliance | `interaction-type-registry.md` `code:` frontmatter 및 §1.2 emit 위치가 신규 서비스 파일을 미반영 | `spec/conventions/interaction-type-registry.md` §1.1-1.2 | `buttons` 행 emit 위치를 `ButtonInteractionService.waitForButtonInteraction` (via 엔진 위임) 으로 갱신; `code:` frontmatter 에 두 새 서비스 파일 추가 |
| I-6 | Plan Coherence | C-1 step1/2/3 완료됐으나 plan 체크박스 미갱신 | `plan/in-progress/refactor/02-architecture.md` C-1 항목 1-3 | 체크박스 `[x]` 로 갱신 및 완료 단계에 worktree/PR 참조 추가 |
| I-7 | Plan Coherence | step3 완료로 step4(RetryTurnService) 착수 가능 상태이나 plan 에 진행 메모 없음 | `plan/in-progress/refactor/02-architecture.md` C-1 항목 4 | "step1/2/3 완료, step4 착수 가능" 진행 메모 및 착수 전 worktree 지정 |
| I-8 | Naming Collision | spec/data-flow 시퀀스 다이어그램이 추출 후 흐름(`Eng->>FormInteraction` / `Eng->>ButtonInteraction`)을 반영하지 않음 | `spec/data-flow/3-execution.md` line 164 | spec sync 시 시퀀스 다이어그램 행위자 표기 갱신 (차단 아님) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `button_continue.data` 미명세 `selectedItem?` (W-1) + 메서드 소유자 표기 불일치 (I-1) |
| Rationale Continuity | LOW | `previousOutput` 유예 근거 spec 미등재 (I-3); god-class 분리 Rationale PR4 예약으로 deferred (I-4) |
| Convention Compliance | LOW | W-1·W-2 규약 drift (동작 파손 아님) |
| Plan Coherence | NONE | INFO 수준 체크박스 미갱신·후속 단계 메모 권장만 |
| Naming Collision | NONE | 충돌 없음; 다이어그램 동기화 지연만 관찰 |

---

## 권장 조치사항

1. **(W-1 해소)** `button_continue` data shape 결정: item-level 링크 버튼에서 `selectedItem` 이 필요한지 확인 후 (A) 세 spec 파일(`node-output.md §4.5`, `execution-engine.md §1.3`, `presentation/0-common.md`) 갱신 또는 (B) 구현 코드에서 제거.
2. **(W-2 해소)** `previousOutput` Phase 3 유예를 `spec/conventions/node-output.md` §4.2 에 공식 예외 항목으로 등재하거나, 신규 코드에서 즉시 제거.
3. **(I-2 확인)** `form-interaction.service.spec.ts` 4-branch 커버리지 존재 여부 확인.
4. **(I-5 갱신)** `interaction-type-registry.md` emit 위치 및 `code:` frontmatter 업데이트 (spec sync PR 에 포함).
5. **(I-6/I-7 추적)** plan 체크박스 갱신 및 step4 착수 메모 추가.
6. **(I-1/I-8 deferred)** spec §7.5 · data-flow 다이어그램 행위자 표기는 PR4 Rationale 갱신 시 일괄 처리 가능.