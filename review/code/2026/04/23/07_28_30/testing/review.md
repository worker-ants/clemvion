## Testing 코드 리뷰

### 발견사항

---

**[WARNING] `ai-agent-conditional` — `multi_turn + conditions` 조합 누락**
- 위치: `resolve-dynamic-ports.spec.ts` — `ai-agent-conditional` describe 블록
- 상세: `single_turn + conditions`와 `multi_turn + no conditions` 두 케이스는 있지만 `multi_turn + conditions` (condPorts + user_ended/max_turns/error 혼합) 조합이 없다. `aiAgentConditionalPorts`의 마지막 `if (isMultiTurn)` 분기가 실제 조건 포트 생성 경로에서 테스트되지 않음 — conditions 포함 multi_turn 시 분기 오류가 silent하게 통과될 수 있다.
- 제안: 아래 케이스 추가
  ```ts
  it('multi_turn + conditions: cond ports strong, multi_turn system ports weak', () => {
    const ports = resolveEffectiveOutputPorts(
      { mode: 'multi_turn', conditions: [{ id: 'cond_a', label: 'A' }] },
      def,
    );
    expect(ports.map(p => p.id)).toEqual(['cond_a', 'user_ended', 'max_turns', 'error']);
    expect(ports[0].isUserConfigured).toBe(true);
    expect(ports.slice(1).every(p => !p.isUserConfigured)).toBe(true);
  });
  ```

---

**[WARNING] `review-workflow.spec.ts` — 등록되지 않은 노드 타입 스킵 동작 미검증**
- 위치: `review-workflow.spec.ts` — `DANGLING_OUTPUT_PORTS` describe
- 상세: `collectDanglingOutputPorts`에서 `defsByType.get(node.type)`이 `undefined`일 때 `continue`(판정 불가 처리)하는 분기가 명시적으로 테스트되지 않음. 스냅샷에 `nodeDefs`에 없는 타입의 노드가 있어도 결과에 영향 없어야 하는데, 이 보장이 테스트로 고정되어 있지 않다.
- 제안: `nodeDefs`에 `carousel`만 있는 상태에서 `switch` 노드가 포함된 스냅샷으로 호출 시 `switch`는 무시(dangling 미보고)됨을 단언하는 케이스 추가

---

**[WARNING] `review-workflow.spec.ts` — `ai_agent` / `parallel` 타입 dangling 미검증**
- 위치: `review-workflow.spec.ts` — `DANGLING_OUTPUT_PORTS` describe 내 `makeDefs()`
- 상세: `resolve-dynamic-ports.spec.ts`에서 6종 `DynamicPortsSpec`을 전부 테스트하지만, `review-workflow.spec.ts`의 `makeDefs()`는 `carousel`(presentation-buttons)과 `switch`(switch-cases)만 포함한다. `ai_agent`(ai-agent-conditional)와 `parallel`(parallel-branches) 타입의 condition/branch 포트가 실제 review 파이프라인을 통과할 때 `DANGLING_OUTPUT_PORTS`로 올바르게 보고되는지 end-to-end 경로가 미검증이다.
- 제안: `makeDefs()`에 `ai_agent`·`parallel` 정의를 추가하고, 각각 미연결 condition/branch 포트를 가진 스냅샷에서 `DANGLING_OUTPUT_PORTS`가 발생하는 케이스 1개씩 추가

---

**[WARNING] `review-workflow.spec.ts` — 복수 노드에서 dangling이 동시 발생하는 케이스 누락**
- 위치: `review-workflow.spec.ts` — `DANGLING_OUTPUT_PORTS` describe
- 상세: 모든 양성 테스트가 단일 노드에서만 dangling을 유발한다. `collectDanglingOutputPorts`의 `byNode` 그룹화 및 `summary` 포맷팅 코드(`join('; ')`)가 복수 노드 경우에서 실행되는 경로가 없다. 노드 순서에 따른 출력 포맷 오류가 숨겨질 수 있다.
- 제안: carousel(btn_a 미연결) + switch(case_a 미연결)가 동시에 있는 스냅샷으로 호출 시 `data`에 두 노드의 포트가 모두 포함되고, `details`에 두 노드가 "; "로 구분되어 나타남을 검증하는 케이스 추가

---

**[WARNING] `workflow-assistant-stream.service.spec.ts` — `DANGLING_OUTPUT_PORTS` 통합 테스트가 `describe` 블록 없이 최상위에 위치**
- 위치: `workflow-assistant-stream.service.spec.ts` — `WORKFLOW_REVIEW_REQUIRED — DANGLING_OUTPUT_PORTS` describe
- 상세: diff를 보면 해당 `describe` 블록이 `describe('WorkflowAssistantStreamService', ...)` 안에 직접 추가된다. plan-only 가드 관련 기존 테스트들과 review-guard 관련 테스트들이 같은 depth에 혼재해 탐색성이 낮다. architecture 리뷰에서도 동일하게 지적됨.
- 제안: `describe('finish self-review (WORKFLOW_REVIEW_REQUIRED)', () => { ... })` 같은 그룹화 describe로 묶어 연관 시나리오를 모아서 읽을 수 있게 개선

---

**[INFO] `resolve-dynamic-ports.spec.ts` — `classifier-categories` 빈 배열 케이스 미검증**
- 위치: `resolve-dynamic-ports.spec.ts` — `classifier-categories` describe
- 상세: `cases`의 빈 배열 케이스는 `switch-cases`에서 테스트하지만, `classifier-categories`는 빈 `categories` 배열 시 `[fallback, error]`만 반환해야 하는 케이스가 없다. 경계 행동의 대칭성이 깨져 있다.
- 제안: `it('returns only fallback and error when categories is empty', ...)` 추가

---

**[INFO] `resolve-dynamic-ports.spec.ts` — `parallel-branches` 정확한 경계값(2, 16) 미검증**
- 위치: `resolve-dynamic-ports.spec.ts` — `parallel-branches` "clamps branchCount to [2, 16]" 테스트
- 상세: `branchCount: 100`(상한 초과)과 `branchCount: 1`(하한 미달) 만 테스트하며 정확한 경계값인 `2`(최솟값)와 `16`(최댓값)에서 길이를 확인하지 않는다.
- 제안:
  ```ts
  expect(resolveEffectiveOutputPorts({ branchCount: 2 }, def)).toHaveLength(3); // 2 branches + done
  expect(resolveEffectiveOutputPorts({ branchCount: 16 }, def)).toHaveLength(17);
  ```

---

**[INFO] `workflow-assistant-stream.service.spec.ts` — Gemini-3-flash 테스트에서 `propose_plan` SSE 이벤트 자체의 성공 여부 미검증**
- 위치: `spec.ts` — `does NOT round-trip when a plan was proposed...` 테스트
- 상세: 3개 `add_node`의 PAA 거부와 `finishReason: 'stop'` 영속은 검증하지만, `propose_plan` 호출 자체가 `ok: true`로 처리되고 SSE로 방출됐는지는 단언이 없다. plan이 실제로 생성되지 않으면 가드 자체가 발동하지 않는데 이 전제가 테스트에서 암묵적이다.
- 제안:
  ```ts
  const planEvent = events.find(
    e => e.event === 'tool_call' && (e.data as { name: string }).name === 'propose_plan'
  );
  expect((planEvent?.data as { result: { ok: boolean } }).result.ok).toBe(true);
  ```

---

**[INFO] `system-prompt.spec.ts` — `Port connectivity rules` 테스트에서 `config.conditions` 등 나머지 config 경로 미검증**
- 위치: `system-prompt.spec.ts` — `teaches outbound port connectivity...` 테스트
- 상세: 실제 프롬프트에 `config.conditions[*]`, `config.categories[*]`, `config.items[*].buttons[*]`, `config.itemButtons[*]` 가 모두 열거되어 있는데 테스트는 `config.cases`와 `config.buttons`만 확인한다. 나머지 경로 텍스트가 프롬프트에서 누락되어도 테스트가 통과한다.
- 제안: `expect(prompt).toMatch(/config\.conditions/)` 등 나머지 경로 체크 추가, 또는 전체 열거 문자열을 단일 정규식으로 검증

---

**[INFO] `review-workflow.spec.ts` — `blocking: true` 단언이 1개 테스트에만 존재**
- 위치: `review-workflow.spec.ts` — `DANGLING_OUTPUT_PORTS` describe
- 상세: `flags carousel button ports...` 케이스만 `expect(dangling?.blocking).toBe(true)`를 단언하고, `treats switch cases as strong` 등 다른 양성 케이스는 `blocking` 필드를 검증하지 않는다. `DANGLING_OUTPUT_PORTS`는 항상 blocking이어야 하는 조건이 반복 검증되지 않는다.
- 제안: switch cases 테스트에도 `expect(dangling?.blocking).toBe(true)` 추가

---

### 요약

전반적인 테스트 커버리지는 높다. `resolve-dynamic-ports.spec.ts`는 6종 DynamicPortsSpec을 체계적으로 커버하고, `review-workflow.spec.ts`의 DANGLING_OUTPUT_PORTS 섹션은 양성·음성·상한 케이스를 균형 있게 구성했으며, 통합 테스트도 실제 버그 시나리오를 재현하는 형태로 잘 작성되어 있다. 주요 위험은 `ai-agent-conditional multi_turn + conditions` 분기 누락(실제 배포되는 노드 조합에서 false negative 가능), 복수 노드 동시 dangling 케이스 미검증(summary 포맷 코드 무실행), 미등록 타입 스킵 동작의 명시적 보장 부재에 집중된다. 이들은 모두 LOW 수준의 기능 위험이며 현재 구현의 정확성에 즉각적인 문제는 없다.

### 위험도
**LOW**