### 발견사항

- **[WARNING]** `enrichInfoExtractorOutputSchema`에서 `JSON.parse(JSON.stringify(...))` 사용
  - 위치: `use-expression-context.ts`, `enrichInfoExtractorOutputSchema` 함수 내 `const cloned = JSON.parse(JSON.stringify(baseSchema))`
  - 상세: 이 함수는 `useMemo` 내부의 `filteredNodes.map()` 안에서 `information_extractor` 노드마다 호출됩니다. `nodes` 의존성이 변경될 때마다 (노드 설정 편집, 이동 등 포함) 재실행되며, 직렬화/역직렬화 기반 딥클론은 `structuredClone()`이나 타겟 머지 방식 대비 불필요한 CPU·메모리 비용을 발생시킵니다.
  - 제안: `JSON.parse(JSON.stringify(...))` → `structuredClone(baseSchema)` 로 교체하거나, 클론 없이 `{ ...baseSchema, properties: { ...baseSchema.properties, output: { ...outputNode, properties: { ...existingProps, ...userProps } } } }` 형태의 얕은 병합 구조로 리팩터링. 스키마가 3단계 이하이므로 스프레드 방식이 성능상 우수합니다.

- **[WARNING]** `useExpressionContext` 내부 `nodes.find()` 선형 탐색
  - 위치: `use-expression-context.ts:137` — `const sourceNode = nodes.find((n) => n.id === sourceId)`
  - 상세: `resultMap`은 이미 `Map`으로 구성되어 있지만 노드 ID → 노드 객체 조회는 여전히 선형 탐색입니다. 워크플로우 노드가 수십 개 수준이면 무시할 수 있지만, 노드가 많을수록 매 memo 재계산 시 불필요한 순회가 발생합니다.
  - 제안: memo 상단에서 `const nodeMap = new Map(nodes.map(n => [n.id, n]))` 구성 후 재사용. `availableNodes` 구성에서 `resultMap.get(n.id)`와 일관된 패턴으로 정렬됩니다.

- **[INFO]** `buildNestedSuggestions`에서 키스트로크마다 `Map` + 배열 신규 할당
  - 위치: `use-expression-suggestions.ts:108–131`
  - 상세: `useExpressionSuggestions`의 `useMemo`가 `[value, cursorPos, expressionData]` 변경 시 재실행되므로, 키 입력마다 `merged` Map과 중간 배열이 새로 생성됩니다. 스키마·샘플 키가 수십 개 수준인 현재 도메인에서는 GC 압력이 낮지만, 향후 대형 스키마 시 주의가 필요합니다.
  - 제안: 현재 규모에서는 허용 범위. 향후 스키마 키가 100개 이상으로 늘어날 경우 `expressionData`를 더 세분화된 의존성으로 분리하여 memo 재계산 범위를 줄이는 방향 고려.

- **[INFO]** `getExpressionToken`에서 키스트로크마다 2회 선형 스캔
  - 위치: `use-expression-suggestions.ts:60–95`
  - 상세: 정방향 quote 카운트 스캔(O(n))과 역방향 토큰 추출 스캔(O(n))이 각 키스트로크마다 실행됩니다. `between`의 길이가 일반적인 표현식 입력(≤ 300자) 수준이므로 현재는 무시 가능하나, 정방향 스캔 결과를 역방향 스캔의 초기 `inString` 상태에 그대로 활용하므로 단일 패스 통합은 불가합니다.
  - 제안: 현재 입력 길이 범위에서 실질적 문제 없음. 허용.

- **[INFO]** `dropStaleEdges` 내 `validOutputs`/`validInputs` 함수 스코프 클로저 캐시
  - 위치: `edge-utils.ts:113–143`
  - 상세: `outputsByNode`/`inputsByNode` Map이 함수 호출 내 클로저로 유지되어 노드당 1회만 `resolveDynamicPorts`를 호출합니다. 로드타임 1회성 실행이므로 성능상 적절합니다. 단, `validOutputs`/`validInputs`가 inner function으로 정의되어 매 `dropStaleEdges` 호출 시 함수 객체가 재생성되나, 로드타임 단일 호출이므로 실질적 문제 없음.
  - 제안: 현재 사용 패턴에서 허용.

---

### 요약

전체적으로 성능 설계는 양호합니다. `useMemo` 의존성 관리, `Map` 기반 노드/결과 캐싱, `dropStaleEdges`의 로드타임 단일 실행 등 주요 최적화 포인트가 잘 적용되어 있습니다. 주요 위험 요소는 `enrichInfoExtractorOutputSchema` 내 `JSON.parse(JSON.stringify())` 딥클론으로, `nodes` 변경마다 information_extractor 노드 수만큼 반복 실행되어 config 편집 중 체감 지연을 유발할 수 있습니다. `structuredClone` 또는 구조적 스프레드 방식으로 교체하면 해당 경로의 성능이 개선됩니다.

### 위험도
**LOW**