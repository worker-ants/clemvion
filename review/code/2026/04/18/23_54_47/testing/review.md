## 발견사항

### validate-scope.ts / validate-scope.test.ts

- **[CRITICAL]** `hasItem: true` 시 `ITEM_ROOT_RE` / `ITEM_INDEX_ROOT_RE`의 `lastIndex` 미리셋 버그 — 테스트 커버 없음
  - 위치: `validate-scope.ts` L132–150, `if (!context.containerScope.hasItem)` 블록
  - 상세: `hasItem === true`이면 블록 전체를 건너뛰므로 두 정규식의 `lastIndex`가 누적된다. 예를 들어 `validateExpressionScope("{{ $itemIndex }} {{ $itemIndex }}", ctx({ containerScope: { hasLoop: false, hasItem: true } }))` 를 두 번 연속 호출하면, 첫 번째 호출에서 `ITEM_INDEX_ROOT_RE.lastIndex`가 리셋되지 않고 남아 두 번째 호출에서 틀린 위치부터 매칭을 시작한다. 현재 테스트에는 이 경로가 전혀 없다.
  - 제안: `/g` 플래그를 삭제하는 것이 근본 해결책. 삭제 후 세 정규식에서 `lastIndex = 0` 리셋 코드 전체 제거. 그리고 아래 테스트 추가:

```ts
it("allows $itemIndex alone inside a foreach container", () => {
  const errors = validateExpressionScope(
    "{{ $itemIndex }}",
    ctx({ containerScope: { hasLoop: false, hasItem: true } }),
  );
  expect(errors).toEqual([]);
});

it("produces no false positives when called repeatedly with hasItem: true", () => {
  const c = ctx({ containerScope: { hasLoop: false, hasItem: true } });
  validateExpressionScope("{{ $itemIndex }}", c); // 첫 번째 호출
  const errors = validateExpressionScope("{{ $itemIndex }}", c); // 두 번째 호출
  expect(errors).toEqual([]);
});
```

- **[WARNING]** 사이클 테스트에서 자기 자신 포함 여부 미검증
  - 위치: `reachable-nodes.test.ts` L71–77 ("is cycle-safe" 테스트)
  - 상세: `fromA.has("B") === true` 만 assert하고 `fromA.has("A") === false` (target 자신이 결과에 포함되지 않아야 함)를 검증하지 않는다. 알고리즘이 초기에 `visited.add(target.id)`로 A를 visited에 넣으므로 A는 result에 들어가지 않지만, 이 불변식이 테스트로 고정되어 있지 않아 회귀 시 탐지 불가.
  - 제안: `expect(fromA.has("A")).toBe(false)` 추가

- **[WARNING]** tool 노드가 체인 **중간**에 있는 간접 경로 테스트 없음
  - 위치: `reachable-nodes.test.ts`
  - 상세: 현재 "excludes nodes owned by a tool" 테스트는 `T(tool) → Y` 직접 연결만 검증한다. `T(tool) → M(normal) → Y` 구조에서 M은 결과에 포함되어야 하지만 T는 제외되어야 하는 조건이 테스트되지 않는다.
  - 제안:

```ts
it("excludes tool node in indirect path but includes intermediate normal node", () => {
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

- **[WARNING]** 블록 간 동일 에러 dedup 정책이 테스트로 명세화되지 않음
  - 위치: `validate-scope.ts` L89 (`const seen = new Set<string>()` — 루프 밖), `validate-scope.test.ts`
  - 상세: `seen` Set이 블록 루프 밖에 선언되어 서로 다른 `{{ }}` 블록에서 동일한 `(kind, token)` 쌍이 발생해도 첫 번째만 보고된다. 현재 "reports errors from every {{ }} block independently" 테스트는 서로 다른 토큰을 사용하므로 이 dedup 동작을 실제로 검증하지 않는다. 의도적 정책이라면 명시적 테스트가 있어야 한다.
  - 제안:

```ts
it("deduplicates identical errors across multiple {{ }} blocks (cross-block dedup)", () => {
  // hasItem=false: $item in both blocks — 두 번째 블록은 seen으로 억제됨
  const errors = validateExpressionScope(
    "{{ $item.a }} and {{ $item.b }}",
    ctx({ containerScope: { hasLoop: false, hasItem: false } }),
  );
  // 현재 정책: 전역 dedup → 1개
  expect(errors).toHaveLength(1);
  expect(errors[0].kind).toBe("out-of-scope-item");
});
```

- **[WARNING]** `getAncestorsInScope`에 broken `containerId` 노드 전달 시 동작 테스트 없음
  - 위치: `reachable-nodes.test.ts`
  - 상세: `getContainerChain`의 broken reference 단위 테스트는 있으나, `getAncestorsInScope` 수준에서 `containerId: "missing"`인 노드가 target일 때 crash 없이 빈 Set을 반환하는지 통합 검증이 없다.
  - 제안:

```ts
it("returns empty set gracefully when target has a broken containerId", () => {
  const nodes = [n("Leaf", "code", { containerId: "missing" })];
  const result = getAncestorsInScope("Leaf", nodes, []);
  expect(result.size).toBe(0);
});
```

- **[INFO]** 테스트 격리 — 모듈 수준 `/g` 정규식 상태 공유로 테스트 실행 순서에 따라 결과가 달라질 수 있음
  - 위치: `validate-scope.ts` L48–50
  - 상세: `/g` 플래그가 남아 있는 한 테스트가 격리되어 보여도 실제로는 모듈 싱글톤 상태를 공유한다. Vitest의 기본 격리(`isolate: true`)는 모듈을 재임포트하지 않으므로 `lastIndex` 오염이 테스트 간에 전파된다. 현재 모든 테스트가 `hasItem: false`라서 표면적으로는 통과하지만 `/g` 플래그를 제거하기 전까지 잠재적 순서 의존성이 존재한다.
  - 제안: 근본 해결은 `/g` 플래그 제거. 임시 대책으로 `beforeEach`에서 `LOOP_ROOT_RE.lastIndex = ITEM_ROOT_RE.lastIndex = ITEM_INDEX_ROOT_RE.lastIndex = 0` 추가 (단, 이 필드는 private이므로 export 필요).

- **[INFO]** `unescapeDoubleQuotedKey`의 과도한 이스케이프 범위에 대한 테스트 없음
  - 위치: `validate-scope.ts` L52–54, `validate-scope.test.ts`
  - 상세: `raw.replace(/\\(.)/g, "$1")`는 `\n`, `\t` 등 모든 백슬래시 시퀀스를 벗긴다. `$node["key\\nwith\\nnewlines"]`처럼 실제 저장 키가 `key\nwith\nnewlines`가 아닌 리터럴 `\n`인 경우 false-negative가 발생할 수 있다. 현재 테스트는 `\"` 케이스만 다룬다.
  - 제안: `\"` 외 이스케이프 시퀀스가 있는 키에 대한 동작을 명세화하는 테스트 추가 또는 `unescapeDoubleQuotedKey`를 `\"` 전용으로 수정:

```ts
it("does not unescape non-quote sequences in node keys", () => {
  // 저장된 키는 리터럴 \n이 아닌 실제 개행이어야 하는 경우
  const errors = validateExpressionScope(
    '{{ $node["key\\nval"].x }}',
    ctx({ allNodeKeys: new Set(["key\\nval"]) }),
  );
  // 현재 구현은 이를 "key\nval"로 언이스케이프 → unknown-node
  // 원하는 동작이 무엇인지 명세화 필요
  expect(errors).toHaveLength(0); // 또는 1 — 팀 결정 후 테스트 고정
});
```

---

## 요약

`reachable-nodes.ts`의 테스트는 컨테이너 경계, 사이클, 중첩 구조 등 핵심 불변식을 잘 커버하고 있으나, 사이클 자기 포함 assertion 누락과 tool 노드 간접 경로 테스트 부재가 회귀 탐지 공백을 만든다. `validate-scope.ts`의 테스트는 더 심각한데, **`/g` 플래그 버그(CRITICAL)가 직접 재현되는 테스트가 전혀 없다** — `hasItem: true` 경로에서 `ITEM_ROOT_RE`/`ITEM_INDEX_ROOT_RE`의 `lastIndex`가 누적되는 버그가 구현에 존재하지만 현재 테스트 스위트는 이를 전혀 잡지 못한다. `/g` 플래그 제거 + 누락된 테스트 4건(hasItem:true + $itemIndex 단독, 연속 호출, cross-block dedup 정책, broken containerId 통합)을 추가하는 것이 최우선 조치다.

## 위험도

**MEDIUM** — Critical 버그(`hasItem: true` 경로 lastIndex 누적)가 존재하고 이를 잡는 테스트가 전무하다. 다중 블록 표현식에서 오탐이 실제로 발생 가능하다.