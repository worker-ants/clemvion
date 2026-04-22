# Code Review 조치 결과

리뷰 일시: 2026-04-22 16:42:34
조치 일시: 2026-04-22 16:55

전체 위험도: **LOW** — Critical 0건, Warning 11건, Info 10건. Warning 전부 + 누락
테스트 3건 + 일부 Info 항목을 같은 PR 안에서 즉시 조치했다.

---

## Warning 조치 내역

| # | 발견사항 요약 | 조치 결과 | 변경 파일·위치 |
|---|---------------|-----------|----------------|
| W1 | 힌트 우선순위 주석(`error > stalled > planApprove > completed`)과 코드 실행 순서(`stalled → completed → planApprove`) 불일치 | else-if 순서를 주석/스펙과 일치하도록 `stalled → planApprove → completed` 로 재배치. 주석에도 "else-if 순서는 위 우선순위와 동일하게 배치" 명시 추가 | `frontend/src/lib/stores/assistant-store.ts` done 이벤트 분기 |
| W2 | `WorkflowAssistantStreamService` 클래스 JSDoc 이 구 guard 동작을 그대로 기술 | "Progress-aware: block 이후 LLM 이 edit/plan tool 을 추가 성공시키면 가드가 다시 발동... block 후 어떤 진척도 없이 또 finish 호출하면 stuck 으로 간주해 안전 탈출... `toolCallsBudget` + 라운드 상한(`MAX_TOOL_LOOP_ROUNDS`)" 으로 갱신 | `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` 클래스 JSDoc |
| W3 | 스펙 §2.3 가 "LLM 이 짧은 한국어 메시지로 approve 요청" 으로 미갱신 | "`propose_plan` 직후 별도 prose 없이 바로 `finish` 호출 — plan card 의 '계획대로 진행' 버튼과 클라이언트가 자동 주입하는 `systemHint: planApproveConfirm` 안내가 사용자 액션을 유도. `openQuestions` 가 있을 때만 한국어 prose 로 질문 재고지" 로 수정 | `spec/3-workflow-editor/4-ai-assistant.md` §2.3 |
| W4 | `openQuestions` 잔존 plan 에서 planApprove hint 가 plan card 안내와 충돌 | planApprove 분기 조건에 `!updated.plan.openQuestions?.length` 추가. 회귀 가드 테스트도 추가 | `frontend/src/lib/stores/assistant-store.ts` + `assistant-store.test.ts` |
| W5 | `evaluateFinishGuard` 파라미터 7개로 누적 — 같은 guard 상태 분산 | `interface FinishGuardState { finishBlockCount; editsSinceLastFinishBlock; planClearedThisTurn }` 도입. 서비스 내부 state 변수도 단일 객체(`guardState`)로 교체. 이후 새 guard 조건이 추가되어도 reset 누락 위험 감소 | `backend/.../workflow-assistant-stream.service.ts` `FinishGuardState` 신규 + 호출부 |
| W6 | `evaluateFinishGuard` JSDoc 에 신규 파라미터 설명 누락 | `@param history`/`@param planForTurn`/`@param pendingToolCalls`/`@param state`/`@param pendingUserRequest` 로 5개 파라미터 모두 설명 추가 | `backend/.../workflow-assistant-stream.service.ts` `evaluateFinishGuard` JSDoc |
| W7 | 스펙 "Turn completion hint" 의 우선순위 표기에서 `planApprove` 누락 | `(우선순위: error > stalled > planApprove > completed)` 로 수정. Plan approval hint 행 설명에도 `openQuestions` 예외 명시 | `spec/3-workflow-editor/4-ai-assistant.md` §3.2 |
| W8 | Progress-aware guard 의 라운드 상한 부재 — 비용 폭주 위험 | `MAX_TOOL_LOOP_ROUNDS = 50` 상수 도입. 매 라운드 진입 시 카운트 → 초과하면 `ASSISTANT_TOO_MANY_TOOL_CALLS` error event + done(error) 으로 종료. 50 라운드면 50-step plan 도 충분히 커버 | `backend/.../workflow-assistant-stream.service.ts` 상수 + 루프 진입부 |
| W9 | 실패한 edit(`ok:false`)이 `editsSinceLastFinishBlock` 에 산입되지 않음을 검증하는 테스트 부재 | `LABEL_CONFLICT` 가 반환되도록 의도적으로 충돌하는 add_node 두 라운드 → 두 번째 finish 통과 (실패는 진척이 아님) 시나리오 spec 추가 | `backend/.../workflow-assistant-stream.service.spec.ts` |
| W10 | `propose_plan` 성공이 `editsSinceLastFinishBlock` 를 증가시키는 경로 미검증 | block 후 다음 라운드에서 s2 를 note 로 바꾼 새 propose_plan + finish → 새 plan SSE 발행 + 정상 종료 검증 spec 추가 | `backend/.../workflow-assistant-stream.service.spec.ts` |
| W11 | `summarizePlanState` 에서 openQuestions 잔존 시 'completed' 방지 미검증 | "all actionable steps done but openQuestions remain" → `'pending'` 반환 spec 추가 | `frontend/.../assistant-store.test.ts` |

---

## Info 항목 (선택 조치)

| # | 발견사항 | 조치 |
|---|---------|------|
| I1 | `handleSseEvent`/`summarizePlanState` 가 테스트 목적으로 export 됨 | 테스트 적용 범위가 작아 별도 분리 없이 export 유지. JSDoc 에 "Exported for unit testing — production callers go through `sendMessage`." 명시함 |
| I2 | `propose_plan` 반복으로 라운드 늘어날 가능성 | W8 의 `MAX_TOOL_LOOP_ROUNDS` 가 동시에 방어하므로 별도 조치 없음 |
| I3 | `system-prompt.spec.ts` (b) regex 양방향 alternation 복잡 | regex 를 두 방향 모두 허용하는 형태로 보존 — 분리 시 한쪽만 매칭되어도 통과해 의미가 약해진다고 판단 (현행 유지) |
| I4 / I5 | sendMessage / approveActivePlan 동시성 micro-window | 본 PR 범위 밖, 별도 추적 |
| I6 | `planApproveConfirm` 키 이중 사용 (서버 전송 + UI hint) | 의미가 동일한 안내문이라 분리 시 중복 i18n 발생. 현행 유지 |
| I7 | `done` 이벤트 페이로드에 `turnKind` 명시 검토 | 클라이언트 4중 조건이 단순하고 서버-클라이언트 모두 한 곳에 모여 있어 즉시 변경 효익이 낮다고 판단. 후속 작업으로 분리 |
| I8 | `FinishBlockTracker` 클래스 캡슐화 | W5 의 `FinishGuardState` 인터페이스로 부분적으로 해소. 이후 메서드 분리는 후속 |
| I9 / I10 | locale-store 결합 / openQuestions 미발동 테스트 | I9 현행 합리적; I10 은 W4 와 함께 실제 spec 으로 추가됨 |

---

## TEST WORKFLOW 재실행 결과

| 단계 | Backend | Frontend |
|------|---------|----------|
| lint | ✅ Clean | ✅ Clean |
| unit test | ✅ 1640 pass (이전 1638 + 신규 2) | ✅ 1034 pass (이전 1032 + 신규 2) |
| build | ✅ Success | ✅ Success |

`workflow-assistant` 모듈 단독: 128 pass (이전 126 + W9, W10 신규 2).
`assistant-store` spec: 12 pass (이전 10 + W4, W11 신규 2).

---

## 후속 핫픽스 (사용자 피드백 반영)

리뷰 조치 완료 후 사용자 보고: "계획 수립 직후에 유저 컨펌 없이 진행을 하려고 해. 컨펌 이후에 임의 중단되는걸 재시도하길 원했어."

### 원인

`evaluateFinishGuard` 가 **승인 대기 중인 plan**과 **승인된 실행 중 plan** 을 구분하지 않고 동일하게 PLAN_NOT_COMPLETE 로 finish 를 막았다. LLM 이 plan-only 턴에서 잘못 edit 를 시도하면:

1. add_node → PLAN_AWAITING_APPROVAL 거부 (kind='edit', ok=false 로 pendingToolCalls 에 기록)
2. finish → 가드가 editThisTurn=true 로 인식, 미완 plan 발견 → block "남은 step 실행하라"
3. LLM 이 가드 메시지를 해석해 다시 edit 시도 → 다시 PLAN_AWAITING_APPROVAL → 핑퐁

Progress-aware 가드 도입으로 라운드 한도(`MAX_TOOL_LOOP_ROUNDS`) 내에서 재시도가 늘어나 사용자 눈에 더 자주 노출됐다.

### 수정

**`backend/.../workflow-assistant-stream.service.ts` `evaluateFinishGuard`**
1. **Plan-only 턴 fast-path** — `planForTurn` 이 set 됐고 미승인 (`!planForTurn.approvedAt`) 이면 가드 즉시 비활성. PLAN_AWAITING_APPROVAL 가 별도로 canvas 변경을 막으므로 finish 를 통과시키는게 안전하고, LLM 의 자가 대화 핑퐁이 1라운드 안에 종결된다.
2. **`editThisTurn` 의미 강화** — 성공한 edit (`tc.kind === 'edit' && result.ok === true`) 만 "이번 턴 실행 발생" 으로 간주. 모든 edit 이 ok:false 로 실패한 턴은 가드 활성화 자체를 건너뜀 → 핑퐁 추가 방어선.

**`backend/.../prompts/system-prompt.ts`** plan-only 턴 규칙 강화
- "The next (and last) tool call on this turn MUST be `finish`" 명시
- "every edit will be rejected with PLAN_AWAITING_APPROVAL and retrying is a useless loop" 추가 (LLM 이 시도 자체를 회피하도록)

**테스트 변경 / 추가** (`workflow-assistant-stream.service.spec.ts`)
- 기존 stuck-escape 테스트를 history-plan 시나리오로 재구성 (plan-only fast-path 가 이전 시나리오를 1라운드로 만듦)
- W9(`failed edits don't progress counter`) 를 새 의미에 맞춰 "실패만 한 턴은 가드 활성화 자체 안 됨" 으로 재구성
- **신규**: "plan-only turn: finish always succeeds even when LLM mistakenly tries edits" — 본 보고된 시나리오를 직접 회귀 가드

**스펙** (`spec/3-workflow-editor/4-ai-assistant.md`)
- §4.3 `finish` tool 설명에 "Plan-only 턴 fast-path" 와 "모든 edit 실패 턴 비활성" 명시
- §10 `finish` guard 반복 block 표 동일 갱신

### 검증

| 단계 | Backend | Frontend |
|------|---------|----------|
| lint | ✅ Clean | ✅ Clean |
| unit test | ✅ 1641 pass (이전 1640 + 핫픽스 +1, 기존 테스트 2건 의미 보강) | ✅ 1034 pass |
| build | ✅ Success | ✅ Success |

`workflow-assistant` 모듈 단독: 129 tests (이전 128 + plan-only fast-path 신규 1).

---

## 최종 변경 파일 목록

- `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` — `FinishGuardState` 인터페이스, `MAX_TOOL_LOOP_ROUNDS` 가드, JSDoc 갱신, 호출부 리팩토링
- `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts` — W9 / W10 신규 테스트 2건
- `backend/src/modules/workflow-assistant/prompts/system-prompt.ts` — plan-only 턴 prose 생략 규칙 (1차 PR 분)
- `backend/src/modules/workflow-assistant/prompts/system-prompt.spec.ts` — plan-only 규칙 신규 spec (1차 PR 분)
- `frontend/src/lib/stores/assistant-store.ts` — 힌트 우선순위 재배치, openQuestions 가드, planApprove 신규 분기
- `frontend/src/lib/stores/__tests__/assistant-store.test.ts` — done event systemHint 시나리오, openQuestions 케이스, summarizePlanState 경계값
- `spec/3-workflow-editor/4-ai-assistant.md` — §2.3, §3.2, §4.3, §10 동기화
