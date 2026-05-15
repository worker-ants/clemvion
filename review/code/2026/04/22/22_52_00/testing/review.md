### 발견사항

---

**[WARNING] service spec의 `appendMessage.mock.calls[1]` 인덱스 의존성이 취약함**
- 위치: `workflow-assistant-stream.service.spec.ts` — "scrubs the leaked JSON" 및 "ignores non-plan JSON-like prose" 테스트
- 상세: `mocks.sessionService.appendMessage.mock.calls[1][1]`으로 assistant 메시지를 꺼내는 방식은 호출 순서(0 = user 저장, 1 = assistant 저장)를 가정한다. 서비스가 `appendMessage`를 추가 호출하는 방향으로 바뀌면 인덱스가 어긋나도 컴파일 에러 없이 조용히 통과된다.
- 제안: `appendMessage.mock.calls.find(([_, msg]) => msg.role === 'assistant')?.[1]` 패턴처럼 역할 기반으로 조회하거나, Jest의 `toHaveBeenNthCalledWith` matcher를 사용한다.

---

**[WARNING] `recoverLeakedPlan` — `steps: []`(빈 배열) 케이스에 대한 명시적 테스트 없음**
- 위치: `recover-leaked-plan.spec.ts` — "returns null for JSON that is not a propose_plan shape" 블록
- 상세: `isProposePlanShape`는 `o.steps.length === 0`을 거부하지만, `steps: []` 자체를 입력으로 주는 테스트 케이스가 없다. 다른 개발자가 빈 배열 허용 방향으로 조건을 수정해도 기존 테스트가 회귀를 잡지 못한다.
- 제안: 기존 "returns null for JSON that is not a propose_plan shape" it-block에 아래 케이스를 추가한다.
  ```typescript
  const emptySteps = `{ "title": "plan", "steps": [] }`;
  expect(recoverLeakedPlan(emptySteps)).toBeNull();
  ```

---

**[WARNING] 멀티-델타 스트리밍 상황에서 leak 복구 시나리오가 테스트되지 않음**
- 위치: `workflow-assistant-stream.service.spec.ts` — "emits a synthetic plan SSE event" 테스트
- 상세: 실제 스트리밍에서 JSON은 여러 `text_delta` 이벤트로 쪼개져 도착한다. 현재 테스트는 전체 JSON이 단일 `text_delta`로 도착하는 경우만 다룬다. 복구 로직은 최종 누적 `assistantText`에서 실행되므로 동작은 맞지만, 테스트 커버리지가 실사 패턴을 반영하지 못한다.
- 제안: `text_delta` 이벤트를 3~4개로 쪼개 JSON을 분할 전송하는 it-block을 하나 추가한다.

---

**[INFO] recovered plan과 `evaluateFinishGuard` 상호작용 테스트 없음**
- 위치: `workflow-assistant-stream.service.spec.ts`
- 상세: `buildPlanFromArgs`로 만들어진 복구 plan에는 `approvedAt`이 없다. `evaluateFinishGuard`는 `planForTurn && !planForTurn.approvedAt`이면 guard를 통과시키므로, 복구된 plan이 있는 턴에서 finish를 호출해도 guard가 발동하지 않는다. 이 의도된 동작(미승인 plan 턴 = finish 허용)이 regression으로 깨지는 경우를 잡을 테스트가 없다.
- 제안: 복구된 plan이 있는 상태에서 `finish` tool_call_end가 오면 `PLAN_NOT_COMPLETE` 없이 정상 종료되는지 확인하는 테스트를 추가한다.

---

**[INFO] `system-prompt.spec.ts` — `{ "steps":` 매칭 근거가 인라인 코드에 의존함**
- 위치: `system-prompt.spec.ts:522` — `expect(prompt).toMatch(/\{\s*"steps"\s*:/)`
- 상세: BAD 예시 JSON(`"summary": "...", "steps": [...]`)에서는 `{` 직후에 `"steps"`가 오지 않는다. 실제로 매칭되는 것은 프롬프트 bullet point의 인라인 코드 `` `{ "steps":` ``다. 프롬프트 문장이 `{ "summary":` 예시만 남기고 `{ "steps":` 인라인 코드를 삭제하면 이 테스트는 실패한다. 의도는 올바르지만 매칭 근거가 명확하지 않다.
- 제안: 테스트 주석에 "인라인 코드 `` `{ "steps":` ``가 bullet point에 있어야 함"을 명시하거나, 더 구체적인 패턴(`` /`\{ "steps":` `` `)으로 좁힌다.

---

**[INFO] 동일 텍스트 내 중복 JSON leak 발생 시 두 번째 블록 제거 누락**
- 위치: `workflow-assistant-stream.service.ts:668` — `assistantText.replace(leak.matched, '')`
- 상세: `String.prototype.replace`는 첫 번째 매칭만 제거한다. 하나의 턴에 동일 JSON이 두 번 등장하는 극단적 케이스에서는 두 번째 블록이 남는다. `recoverLeakedPlan`은 첫 번째 매치만 반환하므로 동작은 일관되지만, 이 제한이 테스트로 문서화되지 않았다.
- 제안: 현재 동작이 의도된 것이라면 `recover-leaked-plan.spec.ts`에 "두 번째 블록은 제거되지 않는다"는 명시적 케이스를 추가한다.

---

### 요약

전체적으로 테스트 설계 수준이 높다. `recoverLeakedPlan`의 단위 테스트는 정상 경로, 오탐 방지, 브레이스 스캐너 안전성, 멀티 후보 처리까지 잘 커버하고 있으며, 서비스 통합 테스트도 4가지 주요 시나리오(복구 발동, 텍스트 스크럽, 실제 툴콜 존재 시 중복 방지, 오탐 억제)를 포괄한다. 다만 `mock.calls[1]` 인덱스 의존성은 서비스 내부 구현 변경에 취약한 실질적인 유지보수 위험 요소이며, 멀티-델타 스트리밍 시나리오 누락은 실사와 테스트 간 패턴 괴리를 만든다. `steps: []` 케이스와 recovered plan의 guard 상호작용은 소규모 추가로 커버 가능한 회귀 위험이다.

### 위험도

**LOW**