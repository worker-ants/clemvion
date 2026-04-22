### 발견사항

---

**[WARNING]** `hasReachableAncestorContainer`가 호출될 때마다 전체 노드 Map을 재생성
- 위치: `review-workflow.ts` — `hasReachableAncestorContainer` 함수
- 상세: 이 함수는 `collectOrphans` 내부에서 reachable하지 않은 노드마다 한 번씩 호출된다. 함수 내부에서 매번 `new Map(allNodes.map(...))` 으로 전체 노드를 순회하며 Map을 생성한다. 노드 N개 중 O개가 orphan이라면 O×N 번의 Map 엔트리 생성이 발생한다. 워크플로우가 50노드 × 30개 orphan이면 1,500번의 객체 할당이 일어난다.
- 제안: `byId` Map을 `collectOrphans` 상단에서 한 번 만들어 `hasReachableAncestorContainer`에 인자로 주입한다.

```typescript
// collectOrphans 상단
const byId = new Map(snapshot.nodes.map((n) => [n.id, n]));
// ...
if (hasReachableAncestorContainer(node.id, byId, reachable)) continue;

function hasReachableAncestorContainer(
  nodeId: string,
  byId: Map<string, ShadowSnapshot['nodes'][number]>,
  reachable: Set<string>,
): boolean { ... }
```

---

**[WARNING]** `buildUnknownNodeTypeResult`가 호출될 때마다 전체 타입 Set을 정렬
- 위치: `shadow-workflow.ts` — `buildUnknownNodeTypeResult` 메서드
- 상세: `[...this.knownNodeTypes].sort()` 는 O(n log n)이며, `knownNodeTypes`는 생성자 이후 변경되지 않는다. LLM이 잘못된 타입을 연속으로 시도하면 매번 동일한 정렬 결과를 재계산한다. 카탈로그가 60개 타입이라면 UNKNOWN_NODE_TYPE 오류마다 불필요한 spread + sort가 실행된다.
- 제안: 생성자에서 정렬된 배열을 한 번 계산하여 필드에 저장한다.

```typescript
private readonly sortedKnownTypes: string[];

constructor(...) {
  this.sortedKnownTypes = [...knownNodeTypes].sort().slice(0, KNOWN_TYPES_MAX);
  ...
}
```

---

**[WARNING]** `evaluateReviewGuard`에서 `shadow.snapshot()`을 두 번 호출
- 위치: `workflow-assistant-stream.service.ts` — `evaluateReviewGuard` 메서드
- 상세: trivial 체크용으로 `snapshot()` 한 번, `buildReviewChecklist` 인자로 `shadow.snapshot()` 다시 한 번 호출한다. `snapshot()`은 `[...this.nodes.values()].map((n) => ({ ...n }))` 처럼 전체 노드·엣지를 clone하므로 호출당 O(N+E) 할당이 발생한다.
- 제안: 첫 번째 호출 결과를 재사용한다.

```typescript
const snapshot = shadow.snapshot();
const nonTriggerCount = snapshot.nodes.filter(...).length;
if (nonTriggerCount <= 1) return null;

const checklist = buildReviewChecklist({
  shadowSnapshot: snapshot, // 재사용
  ...
});
```

---

**[INFO]** `checkRequestCoverage`의 `labelCorpus.includes(t)` — 부분 문자열 오탐 가능성 및 반복 탐색
- 위치: `review-workflow.ts` — `checkRequestCoverage` 함수
- 상세: 모든 노드 라벨을 공백으로 join한 문자열에 `includes(t)`를 사용한다. 토큰 `"ab"`가 라벨 `"abc"` 내에 부분 포함될 경우 hit로 계산된다 (false positive). 또한 토큰마다 O(corpusLength) 탐색이 반복된다. 정확도와 성능 모두 라벨을 각각 토큰화한 뒤 Set 교집합 방식이 우수하다.
- 제안: 라벨을 `tokenize`로 분해한 Set을 만들어 교집합으로 커버리지를 계산한다.

---

**[INFO]** `levenshtein`에 early termination 없음
- 위치: `shadow-workflow.ts` — `levenshtein` 함수, `closestKnownType` 메서드
- 상세: 임계값이 3이므로 DP 누적값이 3을 초과한 시점에 이미 후보에서 탈락할 수 있지만 끝까지 계산한다. 타입 카탈로그 크기가 수십 개 수준이라 절대 비용은 낮지만, 행 단위로 min값을 체크해 early exit를 추가하면 평균 케이스 성능이 개선된다.

---

**[INFO]** `recordFailedAddNode`의 `while` 루프가 항상 최대 1회만 실행됨
- 위치: `shadow-workflow.ts` — `recordFailedAddNode` 메서드
- 상세: 한 번에 항목 하나만 추가하므로 `while` 조건이 참인 경우는 최대 1회다. `if`로 교체하면 의도가 명확해진다.

---

### 요약

전반적인 알고리즘 선택은 적절하다. BFS 기반 orphan 탐지, 롤링 윈도우 FIFO, 턴 스코프 스키마 캐시 등 핵심 구조의 복잡도는 타당한 수준이다. 다만 세 가지 구체적 비효율이 있다: `hasReachableAncestorContainer` 내 Map 반복 생성(O(N²) 잠재 패턴), `buildUnknownNodeTypeResult`의 호출마다 재실행되는 Sort, `evaluateReviewGuard`의 이중 snapshot 클론. 이 중 첫 번째는 워크플로우 규모에 따라 실측 영향이 생길 수 있으며, 나머지 둘은 수정 난이도가 낮아 권장한다. `checkRequestCoverage`의 substring 매칭은 성능보다 정확도 문제가 더 크다.

### 위험도

**MEDIUM** — 프로덕션 단일 턴 범위에서 대부분 무시 가능한 수준이지만, orphan Map 재생성 패턴은 노드 수가 늘어날수록 선형으로 악화되어 선제적 수정이 권장된다.