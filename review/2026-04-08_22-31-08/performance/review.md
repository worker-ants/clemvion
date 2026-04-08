## 성능 코드 리뷰

### 발견사항

---

**[WARNING]** `classifyToolCalls` 내 중첩 선형 탐색
- 위치: `ai-agent.handler.ts` — `classifyToolCalls` 메서드
- 상세: `conditionIds`를 `Set`으로 만드는 것은 올바르나, 이후 `matchedCondition`을 찾는 루프에서 `conditions.findIndex((c) => c.id === ctc.name)`를 `conditionToolCalls` 배열마다 반복 호출합니다. conditionToolCalls × conditions 크기의 O(n×m) 탐색입니다. 실제 조건 수가 많지 않아 현재는 무시할 수준이나, 구조적으로 개선 가능합니다.
- 제안: `Set` 대신 `Map<id, index>`를 만들어 단일 패스로 최소 인덱스를 찾습니다.

```ts
private classifyToolCalls(toolCalls: ToolCall[], conditions: ConditionDef[]): ConditionClassification {
  const conditionIndexMap = new Map(conditions.map((c, i) => [c.id, i]));
  const conditionToolCalls: ToolCall[] = [];
  const normalToolCalls: ToolCall[] = [];
  let lowestIndex = Infinity;
  let matchedCondition: ConditionDef | null = null;

  for (const tc of toolCalls) {
    const idx = conditionIndexMap.get(tc.name);
    if (idx !== undefined) {
      conditionToolCalls.push(tc);
      if (idx < lowestIndex) { lowestIndex = idx; matchedCondition = conditions[idx]; }
    } else {
      normalToolCalls.push(tc);
    }
  }
  return { conditionToolCalls, normalToolCalls, matchedCondition };
}
```

---

**[WARNING]** 혼합 도구 호출 시 `Array.some`의 반복 선형 탐색
- 위치: `ai-agent.handler.ts` — 세 곳의 tool loop (`executeSingleTurn`, `executeMultiTurn` 첫 턴, `processMultiTurnMessage`)
- 상세: `classification.conditionToolCalls.some((ct) => ct.id === tc.id)`를 각 tool call마다 실행합니다. conditionToolCalls × toolCalls 크기의 O(n×m). 실제 tool call 수가 `maxToolCalls`(기본 10)로 제한되지만, 세 곳에 동일한 패턴이 중복됩니다.
- 제안: `classifyToolCalls` 결과를 `Set<id>`로 변환하여 재사용합니다.

```ts
const conditionCallIds = new Set(classification.conditionToolCalls.map((ct) => ct.id));
// 이후 conditionCallIds.has(tc.id) 로 O(1) 조회
```

---

**[WARNING]** `buildTools` 가 호출될 때마다 `toolOverrides` 전체를 `find`로 순회
- 위치: `ai-agent.handler.ts` — `buildTools` 메서드
- 상세: `toolNodeIds.map()` 안에서 `toolOverrides.find((o) => o.nodeId === nodeId)`를 노드마다 반복합니다. O(n×m). `buildTools`는 각 LLM 루프 반복마다 동일한 config로 호출될 수 있습니다.
- 제안: `Map`으로 인덱싱하거나, 호출부에서 결과를 변수에 캐싱합니다. 현재 코드에서 `tools`는 루프 진입 전 한 번만 계산되므로 실제 영향은 낮지만, `toolOverrides`가 커질 경우를 대비한 방어적 개선이 권장됩니다.

---

**[INFO]** `ConditionsSection` — `updateCondition`에서 매 키 입력마다 전체 배열 재생성
- 위치: `ai-configs.tsx` — `updateCondition` 함수
- 상세: `conditions.map((c, idx) => ...)` 로 전체 배열을 새로 생성하고 `onChange`를 통해 상위 상태를 업데이트합니다. 조건이 많아지면 타이핑마다 비용이 발생하나, 실용적인 조건 수(10개 이하)에서는 무시 가능합니다.
- 제안: 현재 규모에서는 조치 불필요. 조건이 많아질 경우 `useCallback`으로 핸들러를 메모이제이션 고려.

---

**[INFO]** `custom-node.tsx` — `useMemo` 내 `conditions.filter().map()` 이중 패스
- 위치: `custom-node.tsx` — `ai_agent` 분기
- 상세: `conditions.filter((c) => c.id).map(...)` 는 두 번 순회합니다. 조건 수가 적으므로 실질 영향 없음.
- 제안: `reduce`로 단일 패스로 병합 가능하나 가독성을 위해 현행 유지 권장.

---

**[INFO]** `buildConditionSystemPromptSuffix` — 매 실행마다 새 문자열 생성
- 위치: `ai-agent.handler.ts` — `buildConditionSystemPromptSuffix`
- 상세: `conditions.map(...).join('\n')`으로 매 실행마다 새 문자열을 생성합니다. 동일 config로 반복 실행 시 결과가 동일하나 캐싱하지 않습니다. 실행 빈도와 조건 수를 고려하면 현재는 무시 가능.
- 제안: 필요 시 `llmConfigId + conditions hash` 키로 메모이제이션 가능하나 현재 규모에서는 불필요.

---

### 요약

전반적으로 이번 변경은 조건 분류 로직을 명확히 분리하고 올바른 방향으로 구현되었습니다. 주요 성능 관심사는 `classifyToolCalls`와 tool loop 내 `Array.some` 호출의 중첩 선형 탐색으로, `conditionIndexMap`과 `conditionCallIds Set` 활용으로 O(n+m)으로 개선 가능합니다. 다만 현재 시스템에서 조건 수와 tool call 수가 각각 10~20개로 제한되므로 실질적인 성능 저하는 없으며, 구조적 코드 품질 차원의 개선 사항입니다. 프론트엔드는 `useMemo` 의존성이 올바르게 설정되어 있어 불필요한 리렌더링 위험은 낮습니다.

### 위험도

**LOW**