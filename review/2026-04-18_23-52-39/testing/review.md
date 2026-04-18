## 발견사항

### reachable-nodes.test.ts

- **[INFO]** `getContainerChain` 테스트에서 `containerId: "missing"` 케이스가 빈 배열 반환을 기대하지만, 실제로는 루프가 `start.containerId`부터 시작하므로 `start` 노드 자체가 존재하면 루프 진입 후 `byId.get("missing")`이 `undefined`가 되어 `break`함. 의도와 일치하지만 테스트 설명이 "stops gracefully when broken reference is found"라고 되어 있어 Leaf 노드 자체가 유효한 경우와 containerId만 깨진 경우를 구별하는 설명이 더 명확하면 좋음. (정도: 낮음)

- **[WARNING]** `getAncestorsInScope` 사이클 테스트 (`A → B → A`)에서 `fromA.has("B")` 만 검증하고, `fromA.has("A")` (자기 자신)가 result에 포함되지 않음을 검증하지 않음.
  - 위치: `reachable-nodes.test.ts` - "is cycle-safe" 테스트
  - 상세: `result.add(source.id)`는 `visited`에 먼저 추가된 노드는 건너뛰므로 `target.id` 자체는 result에 포함되지 않아야 하나, 사이클 케이스에서 A가 result에 들어가지 않는다는 어써션이 없음
  - 제안: `expect(fromA.has("A")).toBe(false)` 추가

- **[WARNING]** `getAncestorsInScope`에서 `toolOwnerId != null`인 노드가 체인 중간에 있을 때의 테스트 없음.
  - 위치: reachable-nodes.test.ts
  - 상세: 현재 테스트는 tool 노드가 직접 target의 predecessor인 경우만 다룸. `T(tool) → M(normal) → Y` 에서 T가 M을 통해 간접적으로 Y에 닿는 경우, M은 result에 포함되어야 하나 tool 노드 T는 포함되지 않아야 함.
  - 제안: `n("T", "http_request", { toolOwnerId: "Agent" }) → n("M", "code") → n("Y", "code")` 케이스 추가

- **[INFO]** `getContainerChain`에서 `toolOwnerId`를 가진 노드의 체인 동작에 대한 테스트 없음 (toolOwnerId가 containerId 체인에 영향 없다면 불필요하지만 명시적 확인 부재).

- **[INFO]** 빈 `nodes` 배열과 비어 있지 않은 `edges` 배열 조합에 대한 테스트 없음 (경계값). 현재 "target node does not exist" 테스트는 둘 다 비어있는 경우만 다룸.

---

### validate-scope.test.ts

- **[WARNING]** 모듈 수준 정규식(`LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`)은 `g` 플래그와 `lastIndex`를 가지므로 같은 블록에서 **두 번 연속** `$loop`를 사용하는 케이스에서 상태 오염 위험 존재. 테스트에서 이를 커버하지 않음.
  - 위치: validate-scope.test.ts / validate-scope.ts `LOOP_ROOT_RE.test(block)` 이후 `lastIndex` 리셋
  - 상세: `validateExpressionScope("{{ $loop.a + $loop.b }}", ...)` 처럼 같은 블록에 두 개의 `$loop`가 있을 때 두 번째 호출에서 `lastIndex`가 0으로 리셋되어 있는지 확인이 필요. 현재 구현은 `.test()` 이후 항상 리셋하지만 **`hasItem` 브랜치 안에서만** 리셋하므로, `hasItem: true`일 때 `ITEM_ROOT_RE`/`ITEM_INDEX_ROOT_RE`의 `lastIndex`는 리셋되지 않음.
  - 제안: `containerScope: { hasItem: true }` 상태에서 `{{ $item.a + $item.b }}`를 두 번 반복 호출하는 테스트 추가; 구현에서 `hasItem` 조건 밖에서도 `lastIndex = 0` 확인

- **[CRITICAL]** `containerScope.hasItem: true` 일 때 `ITEM_ROOT_RE`와 `ITEM_INDEX_ROOT_RE`의 `lastIndex`가 리셋되지 않음 (구현 버그).
  - 위치: validate-scope.ts - `if (!context.containerScope.hasItem)` 블록
  - 상세: `hasItem`이 `true`면 if 블록 전체를 건너뛰므로 두 정규식의 `lastIndex`가 누적됨. 다음 블록(또는 다음 `validateExpressionScope` 호출)에서 잘못된 위치부터 매칭 시작.
  - 제안: `ITEM_ROOT_RE.lastIndex = 0; ITEM_INDEX_ROOT_RE.lastIndex = 0;`을 if 블록 외부로 이동. 테스트: `hasItem: true`인 상태에서 두 expression block을 포함하는 문자열로 두 번 연속 호출하여 오탐/누락 없음을 확인

- **[WARNING]** `$itemIndex`가 `$item`과 같은 블록에 있을 때 `$item`만 에러로 잡히고 `$itemIndex`는 `ITEM_INDEX_ROOT_RE`의 lookbehind 덕분에 별도 처리됨. 그런데 현재 에러 dedup은 `seen` Set이 블록 간 공유되므로, 두 블록에서 동일한 에러가 발생해도 두 번째는 무시됨.
  - 위치: validate-scope.test.ts
  - 상세: "reports errors from every {{ }} block independently" 테스트가 있지만, 동일 에러가 여러 블록에서 반복될 때의 dedup 정책(현재는 전역 dedup)이 의도적인지 확인하는 테스트 없음.
  - 제안: `{{ $item.a }} and {{ $item.b }}` (hasItem: false)에서 에러 수가 1인지 2인지를 명시하는 테스트 추가 (현재 정책 문서화)

- **[INFO]** `$var` 정규식이 `$var.` 뒤 숫자 시작 식별자를 거부하는지 테스트 없음 (`$var.1invalid` 같은 케이스). 현재 `VAR_REF_RE`는 `[A-Za-z_$]` 시작을 강제하므로 매칭 안 됨 — 즉 에러도 안 남. 이 무음 실패가 의도적인지 확인 불가.

- **[INFO]** `$now` 같은 built-in 전역 변수가 에러 없이 통과하는 테스트가 있음("does not flag expressions..."). 하지만 `$node`, `$var`, `$loop`, `$item`, `$itemIndex` 외의 `$` 식별자들이 전부 무시됨이 명확히 문서화된 테스트는 `$now` 하나뿐. `$undefined_builtin` 같은 케이스도 무음 통과가 의도적임을 확인하는 케이스 추가 권장.

---

## 요약

`reachable-nodes.ts`와 `validate-scope.ts`의 테스트는 전반적으로 높은 품질로 작성되었으며 핵심 시나리오(container scope isolation, parallel branch leak, cycle safety, BFS promotion)를 잘 커버합니다. 그러나 **모듈-스코프 `g`-flag 정규식의 `lastIndex` 누적 버그**가 `hasItem: true` 경로에서 실제로 재현 가능하고 테스트도 없어 Critical로 분류됩니다. 그 외에도 사이클 케이스의 자기 포함 어써션 누락, tool 노드 간접 차단 검증 누락, `seen` Set의 전역 dedup 정책 문서화 부재 등 Warning 수준의 갭이 존재합니다.

## 위험도

**MEDIUM** (단, validate-scope.ts의 `lastIndex` 미리셋은 CRITICAL 버그로 실제 다중 블록 사용 시 오탐 발생 가능)