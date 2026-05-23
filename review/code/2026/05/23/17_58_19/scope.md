# 변경 범위(Scope) 리뷰

**대상 작업**: render_form submit 흐름 — silent failure + dispatch fragility 종합 수정  
**Plan**: `plan/in-progress/render-form-submit-fix.md`  
**리뷰 파일 수**: 15개

---

## 발견사항

### 코드 변경 파일 (파일 1~4)

**[INFO] 파일 2 — `execution-engine.service.ts`: unwrap 로직이 Plan 변경 범위 안에 있으나 back-compat 레이어 추가**
- 위치: `execution-engine.service.ts` L1742~L1793 (`submitted` → `formData` unwrap 블록)
- 상세: Plan (C) 항목은 `registerContinuationHandlers` 의 `'continue'` listener 가 "wrap 된 payload 를 그대로 resolvePending — 또는 unwrap 후 forward (decision)" 로 기술. 구현은 listener 는 wrap 상태로 forward 하고, `waitForFormSubmission`(Form 노드용) 의 `await` 직후에 sentinel unwrap 블록을 별도로 삽입. Plan 의 결정 메모에 명시된 "또는 unwrap 후 forward" 안이 `waitForFormSubmission` 에 적용된 형태이므로 Plan 범위 안 — 다만 Plan 본문이 이 unwrap 지점을 명시적으로 언급하지 않아 미묘하게 암묵적. 오버엔지니어링은 아님.

**[INFO] 파일 2 — `execution-engine.service.ts`: `else` warn log 분기 신설**
- 위치: diff L230~L237
- 상세: Plan (C) 항목 마지막 줄 "action.type 미매칭 케이스는 명시 warn log + loop 재진입 (현재 silent skip)" 과 정확히 대응. 범위 내.

**[INFO] 파일 1 — 테스트 2건 추가 (null/undefined payload, `type` 필드명 collision)**
- 위치: `execution-engine.service.spec.ts` L62~L134
- 상세: Plan (C) 테스트 요구사항 "form submit dispatch 매칭 / `type` 필드명 collision 회귀 / 빈 formData / null payload" 에 모두 대응. 범위 내.

**[INFO] 파일 3 — 테스트 4건 추가 (`submitForm` optimistic UI, ack 실패/성공)**
- 위치: `use-execution-interaction-commands.test.ts` L44~L357
- 상세: Plan (A) 테스트 요구사항 "submitForm 호출 시 store mutation 확인 / WS error rollback / WS ack success 동작" 과 정확히 대응. 범위 내.

**[INFO] 파일 4 — `useCallback` 의존성 배열 확장**
- 위치: `use-execution-interaction-commands.ts` L727~L728
- 상세: `[executionId]` → `[executionId, addConversationMessage, setWaitingAiResponse]` 변경. optimistic UI 추가로 인한 필수 변경이며, React Hook 규칙상 의존성 명시는 올바른 수정. 범위 내.

---

### review/ 디렉토리 파일 (파일 6~12)

**[INFO] `review/consistency/2026/05/23/17_32_57/` 일체 신규 생성**
- 위치: 파일 6~12 전체 (`_retry_state.json`, `convention_compliance.md`, `cross_spec.md`, `meta.json`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`)
- 상세: TDD 체크리스트 "(S) `/consistency-check --spec` BLOCK:NO" 항목의 산출물. 프로젝트 규약상 consistency check 는 spec 변경 전 의무 — review/ 디렉토리 산출물 신규 생성은 워크플로 절차에 따른 정상 부산물. `_retry_state.json` 은 orchestrator 가 sub-agent 진행 상태를 추적하는 파일로 worktree 안에 남는 것이 정상.

---

### spec 변경 파일 (파일 13~15)

**[INFO] 파일 13 — `spec/4-nodes/3-ai/1-ai-agent.md`: 단 1줄 추가**
- 위치: L352 (step c 직후 `c.fallback` 단락)
- 상세: Plan (S) 항목 "ai-agent §6.2 step 2 또는 §6.1.d.ii (render_form 흐름) 에 form submission round-trip 명세 보강 — `state.pendingFormToolCall` 누락 시 명시 fallback 규약" 과 정확히 대응. 범위 내.

**[INFO] 파일 14 — `spec/4-nodes/6-presentation/0-common.md`: §10.9 신설 + CHANGELOG + §Rationale**
- 위치: diff (L354~L580)
- 상세: Plan (S) 항목 "§10.9 신설 / §Rationale 단락 1건 / §9 CHANGELOG 항목" 과 정확히 대응. 범위 내.

**[INFO] 파일 15 — `spec/5-system/6-websocket-protocol.md`: 기존 행 1줄 인라인 확장**
- 위치: L191~L103 (`execution.submit_form` 행 비고 확장)
- 상세: Plan (S) "spec/5-system/6-websocket-protocol.md (해당 시)" 선택 항목. cross-ref 한 문장 추가로 기존 내용 훼손 없음. 범위 내.

---

## 요약

15개 파일 전체가 Plan `render-form-submit-fix.md` 의 S/A/C 3축 변경 범위 안에 있다. 코드(파일 1~4)는 Plan (A) frontend optimistic UI 구현과 (C) backend sentinel wrap + dispatch 명시 매칭 + warn log 신설에 각각 직접 대응하며, 추가 리팩토링이나 무관한 파일 수정은 없다. Spec(파일 13~15)은 Plan (S) 항목의 3개 문서 변경 — §10.9 신설, ai-agent fallback 규약, WS cross-ref — 과 일치한다. `review/consistency/` 산출물(파일 6~12)은 프로젝트 규약이 요구하는 consistency check 절차의 부산물로, 변경 범위 일탈이 아니다. `execution-engine.service.ts` 의 `submitted` unwrap 블록은 Plan 에 "또는 unwrap 후 forward (decision)" 으로 예고된 선택지가 적용된 결과로 범위 내이나, Plan 본문이 해당 지점을 명시하지 않아 암묵적 결정이 코드에만 문서화됐다는 INFO 수준 사항이 있다. 전반적으로 변경이 의도된 범위를 충실히 따르고 있다.

---

## 위험도

**NONE**
