### 발견사항

---

**[WARNING] `use-expression-context.test.ts` - `makeNode` 시그니처 변경으로 인한 테스트 불일치**
- 위치: `use-expression-context.test.ts` diff, `makeNode("n1", "loop", "Loop", {}, { containerId: "loop1" })` 패턴
- 상세: diff에서 `makeNode`가 4개 인자(`id, type, label, config`)로 정의되어 있는데, `containerScope` 테스트에서 5번째 인자 `{ containerId: "loop1" }`를 전달하고 있습니다. 실제 수정된 시그니처가 `(id, type, label, config, extraData)` 5개 인자인지 diff에서 명확하지 않으며, 기존 호출부(`makeNode("n1", "http_request", "HTTP")`)와의 하위 호환성은 유지됩니다.
- 제안: diff를 확인하면 `extraData` 파라미터가 추가됐지만 `containerId` 필드가 `data.containerId`로 접근되는지(`scopedNodes` 매핑 코드에서 `data.containerId`) 실제 런타임에서 검증 필요.

---

**[WARNING] `validate-scope.ts` - 전역 RegExp `lastIndex` 재사용 버그 잠재성**
- 위치: `validate-scope.ts:61-67` (LOOP_ROOT_RE, ITEM_ROOT_RE, ITEM_INDEX_ROOT_RE 선언)
- 상세: 모듈 수준에서 `/g` 플래그로 선언된 정규식은 `lastIndex`를 유지합니다. `LOOP_ROOT_RE.test(block)` 호출 후 `LOOP_ROOT_RE.lastIndex = 0` 리셋을 하지만, `hasItem` 분기 내부에서 `ITEM_ROOT_RE.test(block)` 이후 `$item`이 발견되면 `ITEM_ROOT_RE.lastIndex = 0` 리셋 전에 다른 곳에서 동시 호출될 가능성(React Strict Mode의 이중 렌더링)이 있습니다.
- 제안: 정규식을 함수 내부에서 `new RegExp(...)` 로 생성하거나, `test()` 대신 `match()`를 사용하여 전역 상태 의존성 제거.

---

**[WARNING] `reachable-nodes.ts` - `getAncestorsInScope` 사이클 처리의 결과 비일관성**
- 위치: `reachable-nodes.ts`, 테스트 `"is cycle-safe"` 케이스
- 상세: 테스트는 `A → B → A` 사이클에서 `fromA.has("B")` 가 `true`임을 단언합니다. 그러나 이는 `A`에서 BFS 시 `B`가 결과에 포함됨을 의미하는데, `A`는 `B`의 ancestor이면서 동시에 descendant입니다. 사이클 그래프는 잘못된 워크플로우이지만, 테스트가 `B`가 `A`의 ancestor로 처리되는 것을 허용합니다.
- 제안: 사이클이 있는 워크플로우는 저장 시점에서 검증으로 방지해야 하며, 이 경우 동작은 허용 가능합니다. 현재 구현은 안전하게 종료되므로 Info 수준으로 수용 가능.

---

**[WARNING] `expression-input.tsx` - `scopeErrors`가 있을 때 `hasError`가 highlight를 red로 표시**
- 위치: `expression-input.tsx` diff, `hasError` 계산부
- 상세: `const hasError = !!syntaxError || scopeErrors.length > 0`로 정의되어 `ExpressionHighlight`에 전달됩니다. `ExpressionHighlight`는 `hasError`가 `true`이면 `bg-red-500/15`로 렌더링합니다. Scope 에러(amber)인 경우에도 하이라이트가 빨간색으로 표시되어 UI 색상 불일치가 발생합니다.
- 제안: `ExpressionHighlight`에 `hasWarning` prop 추가 또는 `hasError`와 `hasScopeWarning`을 분리하여 amber(`bg-amber-500/15`) 하이라이트 지원.

---

**[INFO] `use-expression-context.ts` - `$input` 필터링이 ancestor 집합과 독립적으로 동작**
- 위치: `use-expression-context.ts` diff, `incomingEdges` 필터 로직
- 상세: `$input`을 위한 predecessor 탐색은 `selectedContainerId`가 같은 노드만 허용하지만, 이 조건이 `getAncestorsInScope`에서 계산된 ancestor 집합과 독립적으로 평가됩니다. 단일 predecessor만 `$input`으로 노출하는 규칙(`incomingEdges.length === 1`)이 ancestor 집합 기반 필터링과 의미적으로 일치하는지 확인이 필요합니다.
- 제안: 현재 로직은 스펙 의도와 일치해 보이나, 동일 컨테이너 레벨에서 2개 이상의 edge가 들어오는 경우의 `$input` 동작을 스펙에서 명시할 것을 권장.

---

**[INFO] `variable-picker.tsx` - IIFE 패턴 사용**
- 위치: `variable-picker.tsx` diff, Built-in variables 섹션
- 상세: IIFE(`(() => { ... })()`)를 JSX 내에서 사용하는 것은 가독성을 떨어뜨립니다.
- 제안: `scopedBuiltIns` 변수를 컴포넌트 함수 본체에서 미리 계산하거나, 별도 컴포넌트로 분리.

---

**[INFO] `expression-constants.ts` - `BUILT_IN_PICKER_VARIABLES`에 `$loop`, `$item`, `$itemIndex` 포함**
- 위치: `expression-constants.ts:27-30`
- 상세: `BUILT_IN_PICKER_VARIABLES`는 `$loop`, `$item`, `$itemIndex`를 포함한 전체 목록을 내보냅니다. 이 배열을 사용하는 모든 소비자가 `containerScope` 필터링을 각자 구현해야 하므로, 필터링 누락 시 scope-gate가 우회됩니다.
- 제안: `getBuiltInPickerVariables(containerScope)` 형태의 함수로 export하거나, scope-filtered 버전을 constants에서 직접 제공하여 중앙화.

---

### 요약

이번 변경은 **scope-aware expression autocomplete + validation** 기능을 구현한 것으로, 핵심 알고리즘(`getAncestorsInScope`, `validateExpressionScope`)이 잘 설계되어 있고 테스트 커버리지도 충분합니다. 다만 몇 가지 주의해야 할 사항이 있습니다: ① `validate-scope.ts`의 전역 RegExp `/g` 플래그가 React Strict Mode 이중 실행 환경에서 `lastIndex` 오염을 일으킬 수 있고, ② `ExpressionHighlight`가 scope 경고 상황에서도 red highlight를 표시하여 amber 색상과 불일치하며, ③ `BUILT_IN_PICKER_VARIABLES`의 scope 필터링이 소비자별로 분산되어 누락 위험이 있습니다. 비즈니스 로직(parallel 컨테이너에서 $item/$loop 초기화, toolOwnerId 제외, 컨테이너 경계 존중)은 구현과 테스트 모두에서 정확히 반영되어 있습니다.

### 위험도

**MEDIUM**