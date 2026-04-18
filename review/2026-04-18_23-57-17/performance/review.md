### 발견사항

---

**[WARNING]** `getAncestorsInScope` 내 `Map` 중복 생성
- 위치: `reachable-nodes.ts` - `getAncestorsInScope` 함수
- 상세: `getContainerChain`을 호출할 때 내부에서 `new Map(nodes.map(...))` 을 다시 생성합니다. `getAncestorsInScope` 자체도 동일한 `byId` Map을 생성하므로, 같은 nodes 배열에 대해 Map이 두 번 생성됩니다. 워크플로우 노드 수가 늘어날수록 O(n) 할당이 두 번 발생합니다.
- 제안: `getContainerChain`이 이미 생성된 `byId` Map을 인자로 받도록 내부 오버로드를 추가하거나, `getAncestorsInScope` 내에서 `getContainerChain` 대신 직접 체인을 순회하십시오.

---

**[WARNING]** `useExpressionContext`의 `useMemo` 의존성 배열에 `expressionData` 객체 포함 — 매 렌더마다 재계산 가능성
- 위치: `expression-input.tsx` - `useEffect` (debounced validation)
- 상세: `expressionData`는 `useExpressionContext`가 반환하는 객체입니다. `useMemo`로 메모이제이션되어 있더라도, 내부에서 `new Set<string>(allDisambiguatedKeys.values())`와 같은 새 참조를 매번 생성하면 불필요한 `useEffect` 재실행이 발생합니다. 특히 `allNodeKeys: new Set(...)` 은 매 `useMemo` 계산마다 새 객체를 반환합니다.
- 제안: `allNodeKeys`를 `useMemo` 외부에서 안정적으로 유지하거나, `useEffect` 의존성을 `value`와 특정 스칼라 값으로 분리하십시오.

---

**[WARNING]** `validate-scope.ts` — 모듈 수준 정규식의 `lastIndex` 수동 리셋
- 위치: `validate-scope.ts` - `validateExpressionScope` 함수 내 `LOOP_ROOT_RE.lastIndex = 0` 등
- 상세: `g` 플래그가 붙은 모듈 레벨 정규식을 `test()`와 함께 사용하면 `lastIndex`가 변경됩니다. 현재 코드는 수동으로 `lastIndex = 0`을 리셋하지만, 여러 블록에 걸쳐 동일 정규식을 사용할 때 경합 상태가 발생합니다. 동시 렌더링(React 18 concurrent mode)에서는 두 컴포넌트가 같은 모듈 정규식 상태를 공유하는 문제가 생길 수 있습니다.
- 제안: `test()` 대신 `(new RegExp(...)).test(block)` 또는 `block.match(pattern)` 을 사용하거나, 정규식을 `g` 플래그 없이 선언하십시오. `matchAll`을 사용하는 `NODE_REF_RE`, `VAR_REF_RE`는 매 호출마다 새 이터레이터를 생성하므로 문제없지만, `LOOP_ROOT_RE` / `ITEM_ROOT_RE` / `ITEM_INDEX_ROOT_RE`는 위험합니다.

---

**[WARNING]** `use-expression-context.ts` — `allDisambiguatedKeys` 역방향 검색이 O(n)
- 위치: `use-expression-context.ts` - `nodeRefMatch` 처리 블록
- 상세: `[...allDisambiguatedKeys.entries()].find(([, key]) => key === refLabel)` 는 Map을 배열로 펼친 후 선형 탐색합니다. 이 Map의 키는 `nodeId`, 값은 `resolvedKey`입니다. 역방향(resolvedKey → nodeId) 조회를 위해 O(n) 탐색이 발생합니다.
- 제안: `useMemo` 내에서 역방향 Map(`resolvedKeyToId: Map<string, string>`)을 추가로 생성하십시오. 생성 비용은 O(n)이지만 이후 조회가 O(1)로 개선됩니다.

---

**[INFO]** `expression-highlight.tsx` — `while` 루프 내 문자열 슬라이싱
- 위치: `expression-highlight.tsx` - `ExpressionHighlight` 컴포넌트
- 상세: `remaining = remaining.slice(...)` 를 반복하면 매 이터레이션마다 새 문자열을 생성합니다. 일반적인 표현식 입력값은 짧으므로 실용적 문제는 없지만, `multiline` 모드에서 긴 텍스트를 처리할 때 GC 압력이 증가합니다.
- 제안: 인덱스 포인터를 사용하는 방식으로 전환하면 중간 문자열 생성을 방지할 수 있습니다.

---

**[INFO]** `expression-autocomplete.tsx` — `suggestions.slice(0, 20)` 매 렌더마다 실행
- 위치: `expression-autocomplete.tsx` - JSX 내 `suggestions.slice(0, 20)`
- 상세: 렌더 함수 내에서 직접 `.slice()`를 호출하면 매 렌더마다 새 배열이 생성됩니다. `selectedIndex` 변경 시도 렌더가 유발됩니다.
- 제안: `useMemo`로 슬라이스된 배열을 메모이제이션하십시오.

---

### 요약

전반적으로 그래프 BFS, 정규식 매칭, 메모이제이션 전략이 잘 설계되어 있습니다. 가장 주목할 성능 이슈는 **모듈 레벨 `g` 플래그 정규식의 `lastIndex` 공유 문제** (React 18 concurrent mode에서 실제 버그로 이어질 수 있음)와 **`getContainerChain` 호출 시 중복 Map 생성**, **역방향 Map 선형 탐색**입니다. 나머지는 현재 워크플로우 규모(수십~수백 노드)에서는 체감 성능 저하가 없는 수준의 개선 포인트입니다.

### 위험도

**MEDIUM** — 정규식 `lastIndex` 공유 이슈는 concurrent rendering 환경에서 간헐적 오탐/누락 버그를 유발할 수 있으며, 나머지 항목은 대규모 워크플로우에서 점진적 성능 저하 가능성이 있습니다.