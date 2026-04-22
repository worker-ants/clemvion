### 발견사항

- **[INFO]** 테스트가 DB 영속 상태를 검증하지 않음
  - 위치: `spec.ts` — 신규 테스트 케이스 (`chatStream` 횟수·`done` 이벤트만 단언)
  - 상세: `appendMessage` 두 번째 호출의 `finishReason: 'stop'`이 실제로 저장되는지 미검증. 다음 턴 rehydration 시 "plan 승인 대기" 상태 복원 정확성이 이 값에 의존함.
  - 제안: `expect(mocks.sessionService.appendMessage.mock.calls[1][1]).toMatchObject({ finishReason: 'stop' })` 추가

- **[INFO]** 테스트가 PAA 거부 이벤트를 확인하지 않음
  - 위치: `spec.ts` — 신규 테스트의 단언 블록
  - 상세: 3개 `add_node`가 `PLAN_AWAITING_APPROVAL`로 거부됐는지 단언 없음. 기존 테스트(`plan-only turn: finish always succeeds...`)는 동일 경로를 1개 add_node로 검증하지만, 다수 연속 발사 패턴은 미고정.
  - 제안: `events.filter(e => e.event === 'tool_call').forEach(tc => expect(tc.data.result.error).toBe('PLAN_AWAITING_APPROVAL'))` 형태로 추가

- **[INFO]** `finishReason = 'stop'` 재할당이 `shouldContinueLoop` 관점에서 중복
  - 위치: `service.ts` L736–749
  - 상세: `!planProposedPendingApproval`가 단락평가로 전체 조건을 false로 만들기 때문에, `if (planProposedPendingApproval) finishReason = 'stop'` 블록은 `shouldContinueLoop`에 영향이 없음. 실제 효과는 `persistAssistantTurn` 호출과 `yield done` 이벤트에만 작용함. 코드 자체는 올바르나, 주석이 이 미묘함을 명시하면 향후 오해를 줄일 수 있음.
  - 제안: 현재 주석에 "shouldContinueLoop의 단락평가로 이미 false지만, persistAssistantTurn/done 이벤트를 위해 명시적으로 덮어씀" 문장 보완 (선택)

- **[INFO]** 다음 턴 히스토리에 실패 tool_call 다수 적재
  - 위치: `service.ts` — `pendingToolCalls.push(...)` (PAA 처리 경로)
  - 상세: 3개 `add_node`(ok:false, PLAN_AWAITING_APPROVAL) + `propose_plan`이 모두 히스토리에 persist됨. 사용자 승인 후 다음 턴의 LLM이 "이전 턴에 edit을 3번 시도했다가 거부됐음"을 history에서 읽게 됨. 현재 구조상 의도된 동작이며 비즈니스적으로도 합리적이나, 미래 LLM이 이 컨텍스트를 잘못 해석(예: "이미 실패한 타입이라 다른 타입을 시도해야 함")할 가능성에 대한 시스템 프롬프트 가이드가 없음.
  - 제안: 필수 변경은 아니나, 시스템 프롬프트에 "PLAN_AWAITING_APPROVAL history는 이전 turn에서 approve 전 시도된 것으로 다음 turn에서 정상 재실행해야 함" 명시 검토

### 요약

`planProposedPendingApproval` 가드 구현은 요구사항(plan 제안 후 미승인 시 같은 턴 내 round-trip 금지)을 정확히 충족한다. `evaluateFinishGuard`의 기존 `planForTurn && !planForTurn.approvedAt → null` 경로와 대칭적으로 설계되어 "LLM이 finish 호출한 경우"와 "finish 없이 provider가 tool_calls로 종료한 경우" 두 경로 모두 `finishReason='stop'`으로 정상 종료된다. 구현 오류나 비즈니스 로직 괴리는 없으며, 발견된 항목은 모두 테스트 커버리지 보강 수준의 INFO이다.

### 위험도

**LOW**