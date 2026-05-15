## 성능 코드 리뷰

### 발견사항

---

**[WARNING] 모듈 레벨 정규식의 `lastIndex` 상태 공유 문제**
- 위치: `validate-scope.ts` — `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE` 선언부 및 `validateExpressionScope` 내부
- 상세: 전역 `/g` 플래그 정규식은 `lastIndex`를 내부 상태로 보유합니다. `.test()` 호출 후 `lastIndex = 0` 리셋을 수동으로 하고 있으나, `LOOP_ROOT_RE.test(block)`가 `true`를 반환하면 `pushUnique` 호출 후 리셋하고, `false`면 리셋을 건너뜁니다 — 즉 `false` 분기에서는 `lastIndex`가 이미 0으로 초기화되어 있어 문제없지만, 향후 코드 수정 시 리셋 누락으로 인한 간헐적 오탐/미탐이 발생할 위험이 높습니다.
- 제안: 모듈 레벨 상수를 `/g` 없이 정의하고 `matchAll` 대신 `new RegExp(..., 'g')`를 함수 내부에서 생성하거나, `lastIndex` 리셋 의존을 제거합니다. 테스트 케이스가 독립 실행되면 문제없지만 연속 호출 시 버그 위험이 있습니다.

```ts
// 개선안: 함수 내부에서 생성
const loopRe = /(?<![A-Za-z0-9_$])\$loop(?![A-Za-z0-9_$])/g;
if (!context.containerScope.hasLoop && loopRe.test(block)) { ... }
```

---

**[INFO] `getAncestorsInScope`에서 매번 `Map` 재구성**
- 위치: `reachable-nodes.ts:71` (`byId`), `reachable-nodes.ts:79` (`incoming`)
- 상세: `getAncestorsInScope`는 호출마다 `nodes` 배열을 순회해 `byId` Map과 `incoming` Map을 새로 생성합니다. 에디터에서 키 입력마다 자동완성 제안을 계산한다면, 같은 `nodes`/`edges` 배열에 대해 매번 O(N+E) 전처리가 반복됩니다.
- 제안: 호출자(`use-expression-suggestions.ts` 등)에서 `nodes`/`edges`가 변경될 때만 Map을 재구성하여 메모이제이션하거나, `getAncestorsInScope`를 두 단계로 분리합니다 — `buildGraph(nodes, edges)` → `computeAncestors(graph, targetId)`.

---

**[INFO] `getContainerChain`이 `getAncestorsInScope` 내에서 `byId` Map을 독립적으로 재구성**
- 위치: `reachable-nodes.ts:48` (`getContainerChain`), `reachable-nodes.ts:71,97` (호출 지점)
- 상세: `getAncestorsInScope`가 `byId` Map을 이미 만든 뒤 `getContainerChain`을 호출하는데, `getContainerChain`은 내부에서 또 `new Map(nodes.map(...))` 을 수행합니다. 노드 수가 많으면 Map 구성 비용이 2배로 발생합니다.
- 제안: `getContainerChain`에 `byId: Map<string, ScopedNode>` 파라미터를 추가하는 내부 오버로드를 만들거나, 이미 구성된 Map을 전달하도록 리팩토링합니다.

---

**[INFO] BFS에서 스택 프레임으로 객체 리터럴 반복 생성**
- 위치: `reachable-nodes.ts:100,105` (`stack.push({ id, level })`)
- 상세: 노드/엣지 수가 많은 워크플로우에서 BFS 순회 시 `{ id, level }` 객체가 방문 노드 수만큼 생성됩니다. 이는 GC 압력을 높일 수 있습니다.
- 제안: 스택을 두 개의 병렬 배열(`idStack: string[]`, `levelStack: (string|null)[]`)로 분리하면 객체 할당 없이 동일한 연산을 수행할 수 있습니다. 노드 수십 개 수준이면 무시 가능하나, 대형 워크플로우(100+ 노드)에서는 체감될 수 있습니다.

---

**[INFO] 테스트 파일 — 불필요한 Array.from 변환**
- 위치: `reachable-nodes.test.ts` 다수
- 상세: `expect(Array.from(result).sort()).toEqual([...])` 패턴이 반복됩니다. 테스트 성능 자체에는 무영향이나, `expect([...result].sort())` 이 더 간결합니다. 실제 성능 문제 아님.

---

### 요약

전반적으로 코드 품질이 높고 알고리즘 선택(BFS + visited Set)도 적절합니다. 핵심 성능 위험은 두 가지입니다: (1) 모듈 레벨 `/g` 정규식의 `lastIndex` 수동 관리 — 현재 테스트는 통과하지만 연속 호출 환경에서 간헐적 오류를 유발할 수 있는 잠재적 버그이며, (2) 에디터 자동완성처럼 고빈도 호출 환경에서 `getAncestorsInScope`가 매번 그래프 Map을 재구성하는 O(N+E) 선형 전처리 비용 — 메모이제이션 또는 그래프 사전 빌드로 개선할 수 있습니다. 나머지는 INFO 수준의 소규모 최적화 기회입니다.

### 위험도

**LOW** — 정규식 `lastIndex` 이슈가 실제 버그로 발화될 경우 WARNING으로 상승 가능.