### 발견사항

---

**[WARNING]** `ITEM_ROOT_RE` / `ITEM_INDEX_ROOT_RE`의 `/g` 플래그 — 교차 호출 `lastIndex` 오염 가능
- 위치: `validate-scope.ts` L48–50, L132–150
- 상세: `hasItem: false` 컨텍스트에서 `ITEM_ROOT_RE.test(block)`이 `true`를 반환하면 `lastIndex`가 블록 내 매치 위치로 이동한다. L140이 리셋을 수행하지만, 이 리셋은 `if (!context.containerScope.hasItem)` 블록 **안**에 있다. 단일 호출 내에서는 `hasItem` 값이 일정하므로 런타임 버그가 바로 발현되지는 않는다. 그러나 `LOOP_ROOT_RE`(L130)는 블록 밖에서 항상 리셋하는 반면, `ITEM_ROOT_RE`와 `ITEM_INDEX_ROOT_RE`는 안에서만 리셋한다는 **설계 비일관성**이 있다. 향후 코드 변경 시(예: `containerScope`를 블록별로 계산하는 경우) 교차 오염으로 직결된다.
- 제안: SUMMARY 권장대로 `/g` 플래그 자체를 제거하는 것이 근본 해결책. 또는 리셋 코드를 `if` 블록 밖으로 이동.

---

**[WARNING]** `unescapeDoubleQuotedKey`가 `\"`만이 아닌 모든 백슬래시 시퀀스를 이스케이프 해제
- 위치: `validate-scope.ts` L52–54
- 상세: `raw.replace(/\\(.)/g, "$1")`는 `\\n` → `n`, `\\t` → `t`, `\\\\` → `\\` 등 모든 시퀀스를 처리한다. `allNodeKeys`에 저장된 키가 이미 이스케이프 해제된 상태라면, `{{ $node["She said\nhello"] }}`와 같이 이스케이프 시퀀스를 포함하는 표현식에서 언이스케이프 후 키가 일치하지 않아 `unknown-node` 오류를 잘못 발생시킬 수 있다. 이 경우 요구사항인 "존재하는 노드를 올바르게 참조할 수 있음"을 위반한다.
- 제안: `\"` 시퀀스만 처리하도록 제한: `raw.replace(/\\"/g, '"')`

---

**[WARNING]** `seen` Set이 블록 간 공유되어 cross-block 에러 dedup 동작이 테스트되지 않음
- 위치: `validate-scope.ts` L89, `validate-scope.test.ts`
- 상세: `{{ $item.a }} {{ $item.b }}`(`hasItem: false`)에서 `$item` 에러가 두 블록 모두에서 발생하지만, `seen` Set 공유로 첫 번째 블록의 에러만 기록된다. "reports errors from every {{ }} block independently" 테스트는 *다른* 토큰이 각 블록에서 에러를 낼 때만 커버하고, *동일* 토큰이 여러 블록에서 반복될 때의 dedup 정책을 검증하지 않는다. 이 동작이 요구사항인지 불명확하다.
- 제안: 아래 테스트로 현재 정책 명시화:
  ```ts
  it("deduplicates the same error across multiple blocks", () => {
    const errors = validateExpressionScope(
      "{{ $item.a }} {{ $item.b }}",
      ctx({ containerScope: { hasLoop: false, hasItem: false } }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].kind).toBe("out-of-scope-item");
  });
  ```

---

**[WARNING]** `hasItem: true` + `$itemIndex` 단독 사용 테스트 누락
- 위치: `validate-scope.test.ts`
- 상세: 기존 테스트 `"allows $item and $itemIndex inside a foreach container"`는 두 변수를 함께 테스트한다. `$itemIndex`만 단독으로 `hasItem: true` 컨텍스트에서 에러 없이 통과하는지 별도로 검증되지 않는다. `ITEM_INDEX_ROOT_RE`의 lookbehind `(?<![A-Za-z0-9_$])` 덕분에 `$item` 매치가 `$itemIndex`를 삼키지 않지만, 이 동작이 명시적 테스트 없이 보증되지 않는다.
- 제안:
  ```ts
  it("allows $itemIndex alone inside a foreach container", () => {
    const errors = validateExpressionScope(
      "{{ $itemIndex }}",
      ctx({ containerScope: { hasLoop: false, hasItem: true } }),
    );
    expect(errors).toEqual([]);
  });
  ```

---

**[WARNING]** 사이클 테스트에서 자기 자신 포함 여부 미검증
- 위치: `reachable-nodes.test.ts` L71–77 ("is cycle-safe" 테스트)
- 상세: `A → B → A` 사이클에서 `fromA.has("B")`만 검증. `A` 자신이 result에 포함되지 않는다는 어써션이 없다. `target.id`는 `visited`에 먼저 추가되어 result에 포함되지 않아야 하지만, 이 불변식이 사이클 케이스에서 명시적으로 검증되지 않는다.
- 제안: `expect(fromA.has("A")).toBe(false)` 추가

---

**[WARNING]** tool 노드가 체인 중간에 있는 간접 경로 테스트 누락
- 위치: `reachable-nodes.test.ts`
- 상세: 현재 `"excludes nodes owned by a tool"` 테스트는 `T(tool) → Y` 직접 연결만 다룬다. `T(tool) → M(normal) → Y` 패턴에서 M은 결과에 포함되고 T는 제외되어야 한다는 요구사항이 테스트로 보증되지 않는다. 알고리즘은 sourceId의 `toolOwnerId`를 체크하므로 M은 포함되고 T는 M의 predecessor 검색 시 제외되어야 하는데, 이 동작이 실제로 올바른지 확인되지 않았다.
- 제안:
  ```ts
  it("excludes tool nodes but includes their non-tool predecessors", () => {
    const nodes = [
      n("T", "http_request", { toolOwnerId: "Agent" }),
      n("M", "code"),
      n("Y", "code"),
    ];
    const edges = [e("T", "M"), e("M", "Y")];
    const result = getAncestorsInScope("Y", nodes, edges);
    expect(result.has("M")).toBe(true);
    expect(result.has("T")).toBe(false);
  });
  ```

---

**[INFO]** `messageFor` switch에 `default` 케이스 없음
- 위치: `validate-scope.ts` L56–69
- 상세: TypeScript exhaustive check로 컴파일 타임에는 보호되지만, 런타임 타입 캐스팅이나 JS 사용 시 `undefined`를 반환해 `message` 필드가 `undefined`가 된다.
- 제안: `default: return kind satisfies never;` 추가

---

**[INFO]** `ScopedNode.type` 인터페이스 필드가 알고리즘에서 미사용
- 위치: `reachable-nodes.ts` L26
- 상세: `getContainerChain`과 `getAncestorsInScope` 모두 `type` 필드를 사용하지 않는다. 테스트 헬퍼 가독성을 위해 전달되지만, 인터페이스 계약이 실제보다 넓게 선언되어 있다. 향후 `type` 기반 분기가 추가될 예정이 아니라면 제거해 호출자 부담을 줄이는 것이 요구사항에 더 충실하다.
- 제안: 미사용 확인 후 인터페이스에서 제거. 또는 JSDoc에 예정된 사용 명시.

---

**[INFO]** JSDoc의 "BFS"와 실제 구현(DFS) 불일치
- 위치: `reachable-nodes.ts` L62, "BFS over reverse edges"
- 상세: `stack.pop()`을 사용하므로 실제 구현은 DFS다. 탐색 결과의 **순서**는 요구사항에 영향이 없지만, 향후 순서 의존적 기능 추가 시 혼란을 유발한다.
- 제안: "graph traversal (DFS) over reverse edges"로 수정.

---

### 요약

`reachable-nodes.ts`의 그래프 탐색 알고리즘은 컨테이너 경계 격리, tool 노드 제외, 사이클 방지 등 핵심 비즈니스 규칙을 정확히 구현하고 있다. `validate-scope.ts` 역시 `$node`, `$var`, `$loop`, `$item`, `$itemIndex` 다섯 가지 참조 유형의 스코프 검증을 올바르게 수행한다. 다만 두 가지 요구사항 충족 공백이 존재한다: (1) `ITEM_ROOT_RE`/`ITEM_INDEX_ROOT_RE`의 `/g` 플래그 `lastIndex` 리셋이 `LOOP_ROOT_RE`와 달리 `if` 블록 안에만 있어 향후 컨텍스트 변경 시 교차 오염 위험이 있고, (2) `unescapeDoubleQuotedKey`의 과도한 이스케이프 해제가 특수 문자 포함 노드 키에서 `unknown-node` 오탐을 유발할 수 있다. 사이클 검증 단방향 어써션과 tool 노드 간접 경로 테스트 누락도 요구사항 커버리지 공백으로 조치가 필요하다.

### 위험도

**MEDIUM** — `unescapeDoubleQuotedKey` 광범위 이스케이프 해제가 요구사항인 "올바른 노드 참조 허용" 위반 가능성을 가지며, `/g` 플래그 구조적 비일관성이 코드 변경 시 즉시 실제 버그로 전환될 수 있음.