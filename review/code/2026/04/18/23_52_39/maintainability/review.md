## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING]** 모듈 수준 mutable regex 상태 (`lastIndex`) 관리가 취약함
- 위치: `validate-scope.ts` — `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE` 및 `validateExpressionScope` 내 `lastIndex = 0` 리셋 코드
- 상세: `g` 플래그가 달린 regex를 모듈 상수로 선언하면 `.test()` / `.matchAll()` 호출 시 `lastIndex`가 변경되어 상태를 공유한다. 현재 `hasItem` 분기 내부에서는 리셋하지만, `LOOP_ROOT_RE.lastIndex = 0`은 `if` 블록 **밖**에서 리셋하므로 `hasLoop === true`인 경우에도 리셋이 실행되는 혼동이 있다. 또한 예외 발생 시 리셋이 누락될 수 있다.
- 제안: regex를 함수 내부에서 매 호출마다 새로 생성하거나, `lastIndex` 의존 없이 `new RegExp(source).test(block)` 패턴으로 리팩터링. 가장 간단한 수정은 리셋을 `try/finally`로 보호하거나 상수를 source string으로 저장하고 매번 `new RegExp` 생성하는 것.

```ts
// 현재
if (!context.containerScope.hasLoop && LOOP_ROOT_RE.test(block)) { ... }
LOOP_ROOT_RE.lastIndex = 0; // hasLoop=true 일 때도 실행되나 무해하지만 혼란스러움

// 제안
const loopHit = new RegExp(LOOP_ROOT_PATTERN).test(block);
```

---

**[WARNING]** BFS인데 `stack`(DFS)이라는 이름 사용
- 위치: `reachable-nodes.ts` — `getAncestorsInScope`, `const stack`
- 상세: 알고리즘 이름과 변수명이 불일치. 실제로는 `stack.pop()`을 사용하므로 DFS지만, 함수 JSDoc 주석에는 "BFS"라고 명시되어 있다. 결과는 동일하지만(방문 순서 무관) 향후 순서가 중요한 기능 추가 시 혼란 유발.
- 제안: 변수명을 `queue`로 바꾸고 `shift()` 사용(BFS), 또는 JSDoc의 "BFS"를 "graph traversal"로 수정.

---

**[WARNING]** `getContainerChain`이 `getAncestorsInScope` 내부에서 `byId` Map을 **재생성**
- 위치: `reachable-nodes.ts` — `getContainerChain` 함수 내 `new Map(nodes.map(...))`
- 상세: `getAncestorsInScope` 호출 시 `byId` Map을 한 번 만든 뒤, `getContainerChain`을 호출하면 내부에서 동일한 `nodes` 배열로 Map을 **다시** 생성한다. 노드 수가 많으면 O(n) 비용이 두 번 발생.
- 제안: `getContainerChain`의 시그니처를 `(nodeId, byId: Map<string, ScopedNode>)`로 변경하거나, 내부 helper로 분리하여 caller가 Map을 전달하도록 리팩터링.

---

**[INFO]** `n()` / `e()` 테스트 헬퍼 이름이 너무 짧음
- 위치: `reachable-nodes.test.ts`, `validate-scope.test.ts` — `function n(...)`, `function e(...)`
- 상세: 단일 파일 내에서만 사용되므로 큰 문제는 아니지만, `buildNode` / `buildEdge` 혹은 `node` / `edge`로 명시하면 IDE 자동완성과 오류 메시지에서 의도가 더 명확하게 드러난다.
- 제안: `function node(...)`, `function edge(...)` 또는 `mk` prefix 등 팀 컨벤션에 맞춰 일관되게 명명.

---

**[INFO]** `validate-scope.ts` — `seen` Set이 블록 간에 공유됨
- 위치: `validateExpressionScope` — `const seen = new Set<string>()`가 루프 밖에 선언됨
- 상세: 현재 설계는 **전체 표현식**에 걸쳐 동일한 `(kind, token)` 쌍을 한 번만 보고하도록 dedup한다. 테스트 `"reports errors from every {{ }} block independently"`에서는 블록별 독립 동작을 기대하지만, 동일한 오류가 두 블록에서 반복되면 두 번째는 dedup된다. 현재 테스트는 이 동작과 충돌하지 않으나, 향후 "블록별 위치 정보" 기능 추가 시 `seen` 공유가 버그가 될 수 있다.
- 제안: 현재 동작이 의도적이라면 JSDoc에 명시. 위치 정보가 필요해지면 `seen`을 블록 루프 안으로 이동.

---

**[INFO]** `messageFor`의 `switch`에 `default` 케이스 없음
- 위치: `validate-scope.ts` — `function messageFor`
- 상세: TypeScript exhaustive check로 커버되지만, 런타임에는 `undefined`를 반환할 수 있다. 컴파일 타겟 변경이나 타입 캐스팅 시 silent failure.
- 제안: `default: return kind satisfies never;` 또는 assertion 추가.

---

### 요약

두 구현 파일(`reachable-nodes.ts`, `validate-scope.ts`) 모두 알고리즘 의도가 JSDoc으로 잘 문서화되어 있고, 인터페이스 설계와 함수 크기도 적절하다. 다만 **모듈 레벨 mutable regex 공유** 패턴은 동시성 환경이나 테스트 격리 문제를 유발할 수 있는 실질적 위험이며, **BFS/DFS 명칭 불일치**와 **Map 이중 생성**은 작지만 유지보수 부채로 쌓인다. 테스트 파일은 시나리오 커버리지가 충실하고 주석으로 의도를 잘 설명하나, 헬퍼 함수 이름(`n`, `e`)의 간결함이 가독성보다 타이핑 편의를 우선하고 있다.

### 위험도

**LOW** — 기능 정확성보다는 향후 변경 시 실수 유발 가능성이 있는 패턴들이 주를 이룬다. Regex 상태 공유 이슈(WARNING)가 가장 즉각적인 주의가 필요한 항목.