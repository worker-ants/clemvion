## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING]** 모듈 수준 mutable regex 상태 — `/g` 플래그 + `lastIndex` 수동 관리
- 위치: `validate-scope.ts` L48–50 (`LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`), L130–150 (리셋 코드)
- 상세: 세 정규식 모두 `.test()` 전용으로만 사용되는데 `/g` 플래그를 달고 있어 `lastIndex` 상태를 호출 간에 공유한다. `LOOP_ROOT_RE.lastIndex = 0`은 `if` 블록 **밖**에 위치해 있어 `hasLoop=true`인 경우에도 리셋이 실행되나(`test()`가 호출 안 되므로 무해하지만) 의도가 혼란스럽다. 더 심각하게, `ITEM_ROOT_RE`와 `ITEM_INDEX_ROOT_RE`의 리셋 코드는 `if (!context.containerScope.hasItem)` **안**에 있어 `hasItem: true`인 경우에는 리셋이 전혀 실행되지 않는다. 다음 `{{ }}` 블록 처리 시 잘못된 위치에서 매칭이 시작되어 false positive를 낸다.
- 제안: `/g` 플래그 자체를 제거하는 것이 근본 해결책. `lastIndex` 리셋 코드 전체도 함께 제거 가능.

```ts
// 현재 (위험)
const ITEM_ROOT_RE = /(?<![A-Za-z0-9_$])\$item(?![A-Za-z0-9_$])/g;
// ...
if (!context.containerScope.hasItem) {
  if (ITEM_ROOT_RE.test(block)) { ... }
  ITEM_ROOT_RE.lastIndex = 0; // hasItem=true면 이 줄에 도달하지 않음!
}

// 수정 (g 플래그 제거)
const ITEM_ROOT_RE = /(?<![A-Za-z0-9_$])\$item(?![A-Za-z0-9_$])/;
// lastIndex 리셋 코드 불필요 → 전체 제거
```

---

**[WARNING]** JSDoc "BFS" 표현과 실제 DFS 구현 불일치
- 위치: `reachable-nodes.ts` L62 (JSDoc `"Algorithm: BFS over reverse edges"`), L89 (`const stack`), L105 (`stack.pop()`)
- 상세: 함수 JSDoc에 "BFS over reverse edges"라고 명시했으나, `stack` 자료구조에 `pop()`을 사용하므로 실제 구현은 DFS다. 탐색 결과의 Set 멤버십에는 영향 없으나, 이후 순서 의존적 기능(예: 우선순위 기반 제안)을 추가할 때 알고리즘을 잘못 이해한 상태로 코드를 수정할 위험이 있다. 테스트 파일에도 "BFS should terminate"라는 주석이 있어 혼란이 전파된다.
- 제안: JSDoc을 `"DFS over reverse edges"` 또는 `"graph traversal over reverse edges"`로 수정. 필요하다면 `stack` → `queue` + `shift()`로 실제 BFS로 전환.

---

**[WARNING]** `getContainerChain`이 `getAncestorsInScope` 내부에서 `byId` Map을 중복 생성
- 위치: `reachable-nodes.ts` L42 (`getContainerChain` 내부), L76 (`getAncestorsInScope` 내부), L98 (`getContainerChain` 호출)
- 상세: `getAncestorsInScope`는 L76에서 `byId` Map을 생성한 뒤 L98에서 `getContainerChain`을 호출하는데, `getContainerChain`은 내부 L42에서 동일한 `nodes` 배열로 Map을 **다시** 생성한다. 노드 수가 N일 때 O(N) 비용이 두 번 발생하며, 에디터 키 입력마다 호출되는 함수라는 점에서 불필요한 반복이다.
- 제안: `getContainerChain`의 시그니처에 선택적 `byId` 파라미터를 추가하거나, 내부 구현을 분리해 caller가 이미 구성한 Map을 전달하도록 변경.

```ts
// 개선안
function getContainerChain(
  nodeId: string,
  nodes: ScopedNode[],
  byId?: Map<string, ScopedNode>, // 이미 구성된 Map 재사용
): ScopedNode[]
```

---

**[INFO]** `ScopedNode.type` 필드 — 알고리즘 내부 미사용 dead field
- 위치: `reachable-nodes.ts` L26 (`ScopedNode` 인터페이스)
- 상세: `type` 필드는 인터페이스에 선언되어 있으나 `getContainerChain`과 `getAncestorsInScope` 어디에서도 참조하지 않는다. 호출자가 제공해야 할 데이터 계약이 실제 필요보다 넓게 선언된 것으로, 미래에 필드 삭제 시 호출부 전체를 수정해야 하는 부채가 된다.
- 제안: 현재 알고리즘에서 사용하지 않으면 인터페이스에서 제거. 향후 컨테이너 타입 판별 목적이라면 JSDoc에 `// reserved for future container-type filtering` 명시.

---

**[INFO]** `unescapeDoubleQuotedKey` — 이스케이프 범위 과도
- 위치: `validate-scope.ts` L52–54
- 상세: `raw.replace(/\\(.)/g, "$1")`는 `\\n`, `\\t`, `\\\\` 등 모든 백슬래시 시퀀스를 제거한다. 노드 키 비교 시 `\n`이 포함된 키가 저장된 방식과 다르게 언이스케이프될 수 있고, 함수 이름 `unescapeDoubleQuotedKey`가 `\"`만 처리한다는 의도를 암시하므로 구현과 불일치한다.
- 제안: `return raw.replace(/\\"/g, '"');`로 범위 제한.

---

**[INFO]** `seen` Set의 전역 dedup 동작이 문서화되지 않음
- 위치: `validate-scope.ts` L89 (`const seen = new Set<string>()` — 블록 루프 밖 선언)
- 상세: 같은 오류가 서로 다른 `{{ }}` 블록에서 발생해도 두 번째는 무시된다. 이 동작이 의도적인지 아닌지가 코드와 테스트 어디에도 명시되지 않아, 향후 "블록별 위치 정보" 기능 추가 시 혼란을 유발할 수 있다. 현재 테스트 "deduplicates"는 단일 블록 내 중복만 검증한다.
- 제안: JSDoc 또는 인라인 주석으로 정책 명시: `// seen is shared across blocks — identical errors are reported only once per expression`.

---

**[INFO]** `messageFor` switch에 `default` 케이스 없음
- 위치: `validate-scope.ts` L56–68
- 상세: TypeScript exhaustive check로 컴파일 타임에는 안전하나, 런타임에 외부에서 잘못된 `kind` 값이 캐스팅되어 전달되면 `undefined`를 반환해 UI에서 silent failure가 발생한다.
- 제안: `default: return kind satisfies never;` 추가.

---

**[INFO]** 테스트 헬퍼 `n()`, `e()` 이름이 너무 짧음
- 위치: `reachable-nodes.test.ts` L9–20, `validate-scope.test.ts`
- 상세: 단일 파일 내 사용이라 기능상 문제는 없으나, IDE 오류 메시지나 스택 트레이스에서 의도가 불명확하고 팀 온보딩 시 직관적이지 않다.
- 제안: `node()`, `edge()` 또는 팀 컨벤션에 맞는 이름으로 통일.

---

### 요약

두 모듈 모두 알고리즘 의도가 JSDoc으로 잘 문서화되어 있고, 인터페이스 설계와 함수 크기도 적절하다. 핵심 유지보수 위험은 두 가지다: (1) `validate-scope.ts`의 모듈 수준 `/g` 정규식 공유 상태 — 특히 `ITEM_ROOT_RE`/`ITEM_INDEX_ROOT_RE`의 `lastIndex` 리셋이 `hasItem: true` 분기에서 누락되어 실제 버그가 재현 가능하며, `/g` 플래그 제거라는 간단한 수정으로 전체 위험이 해소된다. (2) `reachable-nodes.ts`의 BFS/DFS 명칭 불일치 — 결과 정확성에는 영향 없으나 향후 순서 의존적 기능 추가 시 오해를 유발할 수 있다. `getContainerChain` 내 `byId` Map 이중 생성은 작은 유지보수 부채이며 호출 빈도에 따라 성능 영향도 있다.

### 위험도

**LOW** — 정규식 `lastIndex` 미리셋 버그(`hasItem: true` 경로)는 실제 오탐을 유발하는 실질적 버그이나, 수정 난이도가 낮다(`/g` 플래그 제거). 나머지는 향후 변경 시 실수를 유발할 패턴들로 즉각적 기능 오류는 아니다.