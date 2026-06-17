# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md` (구현 완료 후 검토, diff-base=`claude/engine-split-s2-aiturn`)
검토 범위: C-1 step3 — `ButtonInteractionService` / `FormInteractionService` 추출 + `ExecutionEngineService` 재배선

---

## 발견사항

- **[INFO]** `previousOutput` 레거시 필드 계속 추가 — Principle 4.2 "제거" 대상 필드를 새 재개 경로에서 능동적으로 기록
  - target 위치: `button-interaction.service.ts` L875–882 (`processButtonResumeTurn` 내 `structuredOutputPayload` 조립 블록)
  - 과거 결정 출처: `spec/conventions/node-output.md § Principle 4.2 "폐기할 필드 / 구조"` — "현재 carousel/chart/table/template 의 `output.previousOutput` → **제거**. 이전 뷰 정보는 `config` + output 의 런타임 필드 조합으로 재구성 가능 (Principle 1.1)."
  - 상세: 코드 주석(L872–876)이 이를 인지하고 "`previousOutput` 은 legacy transitional 필드 (CONVENTIONS §4.2 가 명시적으로 retirement 대상으로 표기)" 라고 적은 뒤, "removal 은 Phase 3 precondition 으로 추적된다" 며 신규 재개 세션에서도 `previousOutput: prevOutput` 을 structuredOutputPayload 에 계속 추가하고 있다. 이는 Principle 4.2 의 "제거" 결정을 번복하는 것이 아니라, 레거시 소비자 호환을 위해 유예하는 것으로 해석된다. 단, 이 유예 결정에 대한 새 Rationale 또는 plan 추적 항목이 spec 내에 없어 향후 검토자가 "왜 아직 살아있는지" 를 코드 주석에만 의존해야 한다.
  - 제안: `spec/5-system/4-execution-engine.md §Rationale` 또는 `spec/conventions/node-output.md § Principle 4.2` 에 "`previousOutput` 즉시 제거 아닌 단계적 유예 — Phase 3 완료 선행 조건" 한 항을 추가해 코드 주석의 근거를 spec 공식 기록으로 승격시킨다.

- **[INFO]** god-class strangler-fig 분리(C-1, `EngineDriver` + 추출 서비스) 결정이 spec Rationale 에 미반영
  - target 위치: 전체 diff — `ButtonInteractionService` 신설, `execution-engine.service.ts` 에서 `conversationThreadService` / `processButtonResumeTurn` / `waitForButtonInteraction` 등 제거 및 위임 전환, `ENGINE_DRIVER = useExisting: ExecutionEngineService` forwardRef 패턴
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale` 에는 `forwardRef` 가 `ExecutionEngineService ↔ WebsocketService` 순환 해소용으로만 언급됨(line 442). `EngineDriver` 토큰·strangler-fig 전략·`AiTurnOrchestrator` 선례의 결정 근거는 `plan/in-progress/refactor/c1-engine-split.md` 에만 존재하며 spec 에는 없다.
  - 상세: plan 문서(c1-engine-split.md L95–108)가 "PR4 DoD 에 spec Rationale 갱신 포함" 으로 예약해 두었으므로 이는 의도된 deferred enrichment 다. 현 상태에서 spec Rationale 이 부재할 경우 이 검토처럼 신규 pattern 의 출처를 찾기 어렵다.
  - 제안: PR3(현재 PR) 과 PR4 사이 단계에서 `§Rationale` 에 "god-class strangler-fig 분리 (C-1) — EngineDriver 내부 계약·forwardRef·추출 서비스 배치 결정" 항을 조기 작성 검토. 최소한 plan 문서의 L95 예약을 그대로 유지.

- **[INFO]** `FormInteractionService` 의 `processFormResumeTurn` 단위 테스트가 `execution-engine.service.spec.ts` 에서 제거되어 `form-interaction.service.spec.ts`(별도 파일) 로 이전됐는지 diff 에서 확인 불가
  - target 위치: `execution-engine.service.spec.ts` L1414–1833 (삭제된 `processFormResumeTurn — 4 branches (SUMMARY W1)` describe 블록)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)"` — form resume 경로의 4-branch 검증 의무는 선행 PR(B1) 의 합의 사항
  - 상세: `button-interaction.service.spec.ts` 는 독립 파일로 신설됐다. 삭제된 form 단위 테스트가 동등한 `form-interaction.service.spec.ts` 로 재작성됐는지 이 diff 에는 포함되지 않았다. FormInteractionService 추출이 C-1 step3 범위라면 form spec 도 동일 PR 에 포함되어야 한다.
  - 제안: `form-interaction.service.spec.ts` 의 존재 및 4-branch 커버리지(sentinel/non-sentinel/RUNNING/nodeExec-null)를 확인. 없다면 누락 위험.

---

## 요약

C-1 step3 의 `ButtonInteractionService` 추출과 엔진 재배선은 기존 Rationale 의 어떤 결정도 명시적으로 번복하지 않는다. 분리 방식(EngineDriver forwardRef, `useExisting` 바인딩, 메서드 verbatim 이동)은 PR2(AiTurnOrchestrator)의 확립된 선례와 완전히 일치한다. 유일한 주의 항목은 `previousOutput` 레거시 필드를 신규 resume 경로에서 계속 추가하는 것으로, Principle 4.2 의 "제거" 결정을 코드 주석으로만 유예하고 spec 에는 공식 Rationale 이 없다는 점이다. 이는 동작 정합성 문제라기보다 문서 추적 갭이며, god-class 분리 결정 전체에 대한 spec Rationale 갱신은 plan에 의해 PR4 완료 시점으로 예약되어 있다.

---

## 위험도

LOW

STATUS: SUCCESS
