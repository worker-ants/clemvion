### 발견사항

---

**[INFO]** `getAncestorsInScope`의 사이클 테스트 검증이 단방향
- 위치: `reachable-nodes.test.ts:71–77`
- 상세: `A → B → A` 사이클에서 `fromA.has("B")` 만 검증하고, `fromA.has("A")` false 여부(자기 자신이 조상에 포함되지 않는지)를 검증하지 않음
- 제안: `expect(fromA.has("A")).toBe(false)` 추가

---

**[WARNING]** `parallel` 컨테이너의 브랜치 격리 테스트에서 엣지 방향 의존성
- 위치: `reachable-nodes.test.ts:130–151`
- 상세: `b2b → P` 엣지가 있으므로 `P`의 incoming에 `b2b`가 있고, BFS가 `P`의 outer level에서 `b2b`를 볼 수 있는 잠재적 경로가 있음. 현재 구현은 `b2b.containerId === "P"` ≠ `P.containerId (null)`이므로 올바르게 차단되지만, 이 차단이 의도적으로 테스트되고 있지 않음. `b2b`가 결과에 없는 이유를 명확히 검증하는 테스트가 없음
- 제안: `result.has("P")`가 false인 이유를 주석으로 명확히 설명 (또는 별도 테스트 추가)

---

**[WARNING]** `validate-scope.ts`에서 module-level 정규식의 `lastIndex` 리셋이 일관되지 않음
- 위치: `validate-scope.ts:94–118`
- 상세: `LOOP_ROOT_RE.test(block)` 호출 후 `lastIndex = 0` 리셋은 `if` 블록 밖에 있으나, `ITEM_ROOT_RE`와 `ITEM_INDEX_ROOT_RE`는 `if (!context.containerScope.hasItem)` 블록 안에서 리셋됨. `containerScope.hasItem === true` 일 때 `ITEM_ROOT_RE.lastIndex`가 0으로 리셋되지 않아 다음 루프 순회에서 잘못된 match 위치에서 시작할 수 있음
- 제안: `ITEM_ROOT_RE.lastIndex = 0`과 `ITEM_INDEX_ROOT_RE.lastIndex = 0`을 `if` 블록 밖으로 이동

```ts
// 현재
if (!context.containerScope.hasItem) {
  if (ITEM_ROOT_RE.test(block)) { ... }
  ITEM_ROOT_RE.lastIndex = 0;        // hasItem=true면 실행 안 됨!
  ...
}

// 수정
if (!context.containerScope.hasItem) {
  if (ITEM_ROOT_RE.test(block)) { ... }
  if (ITEM_INDEX_ROOT_RE.test(block)) { ... }
}
ITEM_ROOT_RE.lastIndex = 0;          // 항상 리셋
ITEM_INDEX_ROOT_RE.lastIndex = 0;
```

---

**[WARNING]** `validate-scope.test.ts`에서 `hasItem=true` 케이스의 `$itemIndex` 단독 허용 테스트 누락
- 위치: `validate-scope.test.ts:전체`
- 상세: `$item + $itemIndex` 복합 케이스는 테스트되지만, `$itemIndex` 단독으로 `hasItem=true` 컨텍스트에서 허용되는지 테스트가 없음. 위 `lastIndex` 버그와 맞물려 신뢰성 공백 발생
- 제안: 아래 테스트 추가

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

**[INFO]** `getContainerChain`의 broken reference 처리와 `getAncestorsInScope`의 연계 테스트 없음
- 위치: `reachable-nodes.test.ts:186–192`
- 상세: `getContainerChain`이 broken reference에서 빈 배열을 반환하는 단위 테스트는 있으나, `getAncestorsInScope`에서 broken `containerId`를 가진 노드를 대상으로 호출했을 때 정상 동작하는지(crash 없이 빈 set 반환)에 대한 통합 테스트가 없음
- 제안: `getAncestorsInScope("Leaf", [n("Leaf", "code", { containerId: "missing" })], [])` 케이스 추가

---

**[INFO]** `deduplicates` 테스트가 블록 간 중복은 검증하지 않음
- 위치: `validate-scope.test.ts:103–109`
- 상세: 같은 블록 내 중복만 테스트. `{{ $node["Ghost"].a }} {{ $node["Ghost"].b }}` 처럼 서로 다른 블록에서 같은 토큰이 반복될 때 `seen` Set이 블록 간에 공유되므로 1개만 보고되어야 하나, 이 동작을 명시적으로 검증하는 테스트 없음
- 제안: 블록 간 중복 deduplicate 케이스 테스트 추가 (현재 동작은 맞음, 명세만 누락)

---

### 요약

핵심 로직(`getAncestorsInScope`, `validateExpressionScope`)의 구현 의도와 실제 동작은 전반적으로 일치하며 비즈니스 규칙(스코프 격리, 툴 노드 제외, 컨테이너 경계)이 코드에 정확히 반영되어 있습니다. 다만 `validate-scope.ts`의 module-level 정규식 `lastIndex` 리셋 누락은 `hasItem=true` 환경에서 여러 `{{ }}` 블록이 있을 때 false positive를 낼 수 있는 실질적 버그이며, 이를 검증하는 테스트도 없어 요구사항 충족에 실질적 공백이 있습니다.

### 위험도

**MEDIUM** — `lastIndex` 리셋 버그가 다중 블록 + `hasItem=true` 환경에서 오탐을 유발할 수 있음