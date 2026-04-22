### 발견사항

- **[INFO] `finishReason` 변수 덮어쓰기 — 의도된 상태 변경**
  - 위치: `service.ts` 신규 블록 (`const planProposedPendingApproval = ...`)
  - 상세: `planProposedPendingApproval` 가 true 일 때 `finishReason` 을 `'tool_calls'` → `'stop'` 으로 overwrite 한다. 이 값은 (1) `yield done` SSE 이벤트, (2) `persistAssistantTurn` DB 저장에 함께 사용되므로 클라이언트·DB 양쪽에 관측된다. 의도된 변경이며 주석·메모리 문서에 명시되어 있다.
  - 제안: 별도 조치 불필요.

- **[INFO] `PLAN_AWAITING_APPROVAL` 실패 edit 이 `pendingToolCalls` 에 누적 후 persist**
  - 위치: 편집 핸들러 → `pendingToolCalls.push(...)` → `persistAssistantTurn`
  - 상세: 새 가드 이전에도 "plan-only turn" 테스트에서 PAA-실패 edit 이 persit 되는 경로는 이미 존재했다. 이번 변경으로 round-trip 이 1회로 제한되므로 오히려 실패 항목이 줄어든다. 그러나 다음 턴 rehydrate 시 LLM 컨텍스트에 PAA-실패 호출들이 노출되어 혼란을 줄 가능성은 여전히 있다.
  - 제안: 당장 문제가 되지는 않으나, gemini-3-flash 처럼 edit 을 수십 개 연발하는 케이스에서 실패 항목 수가 많을 때 LLM 이 "이미 시도했다가 거부됐음" 을 잘못 학습하는지 모니터링할 것. 필요시 `toChatMessages` 에서 PAA-실패 호출 필터링 고려.

- **[INFO] 동일 조건(`planForTurn && !planForTurn.approvedAt`)이 세 군데에 분산**
  - 위치: ① edit 핸들러 (PLAN_AWAITING_APPROVAL 반환), ② `evaluateFinishGuard` (early return null), ③ 신규 shouldContinueLoop 가드
  - 상세: 세 곳 모두 논리적으로 독립적인 결정 지점에서 같은 조건을 체크하며 서로 겹치거나 충돌하지 않는다. 다만 조건 정의가 한 곳에 없어 향후 `AssistantPlanRecord` 의 "승인 여부 판단 방식" 이 바뀔 때 세 군데를 모두 업데이트해야 한다.
  - 제안: `isAwaitingApproval(plan: AssistantPlanRecord | null): boolean` 같은 작은 헬퍼로 추출하면 변경 시 단일 지점만 수정하면 된다. 현재 규모에선 낮은 우선순위.

- **[WARNING] `planForTurn` 이 Round 2 이후에 처음 세팅되는 시나리오**
  - 위치: while 루프 내 `planForTurn` 누적 + 신규 `planProposedPendingApproval` 판정
  - 상세: Round 1 에서 edit 만 하고 `tool_calls` 로 종료 → Round 2 에서 LLM 이 `propose_plan` 을 호출 → 이때 `planProposedPendingApproval = true` 로 루프가 즉시 종료된다. Round 2 의 `pendingResultsForLlm` (propose_plan 성공 포함)은 LLM 에게 다시 피드백되지 않고 turn 이 종료된다. 이 자체는 의도에 부합하지만, Round 2 에서 propose_plan 과 함께 추가 edits 를 한 경우 그 tool_result 도 LLM 에 반환되지 않는다.
  - 제안: 현재 테스트 커버리지에는 이 multi-round propose_plan 시나리오가 없다. "Round 2 에서 propose_plan" 케이스를 회귀 테스트로 추가해 의도된 동작임을 명시적으로 고정할 것.

- **[INFO] 공개 API·인터페이스 변경 없음**
  - 위치: `streamMessage` 시그니처, `AssistantStreamEvent` 타입, SSE 이벤트 구조
  - 상세: 모든 변경은 루프 내부 로컬 변수(`finishReason`, `shouldContinueLoop`)에만 국한된다. 외부 호출자·클라이언트 컨트랙트는 영향 없음.

---

### 요약

이번 변경은 `planForTurn` 과 `shouldContinueLoop` 라는 두 개의 로컬 변수에만 국한된 내부 가드 추가다. 전역 상태·파일시스템·네트워크·환경 변수에 대한 비의도적 부작용은 없으며, `finishReason` overwrite 와 turn 조기 종료는 의도된 동작으로 주석과 메모리 문서에 충분히 문서화되어 있다. 주목할 부작용은 PAA-실패 edit 들이 persist 되어 다음 턴 LLM 컨텍스트에 노출되는 점인데, 이는 이번 변경 이전부터 존재하던 패턴이며 오히려 round 수 감소로 누적량이 줄었다. `planForTurn` 이 중간 라운드에서 처음 세팅되는 엣지 케이스 하나만 테스트 커버리지 추가가 권장된다.

### 위험도
**LOW**