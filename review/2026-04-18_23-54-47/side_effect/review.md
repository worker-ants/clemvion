## 리뷰 결과

### 발견사항

---

**[WARNING]** 모듈 수준 `/g` 정규식 — `lastIndex` 공유 상태
- 위치: `validate-scope.ts` L48–50 (`LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`)
- 상세: 세 정규식 모두 `/g` 플래그로 선언되어 `lastIndex`가 모듈 싱글턴으로 공유됨. 현재 코드는 `.test()` 호출 후 `lastIndex = 0`을 수동 리셋하고 있어 정상 경로에서는 동작하지만, 구조적으로 호출 간 변이 가능한 전역 상태를 만든다. React Concurrent Mode나 SSR 환경에서 렌더링 interleave 시 상태 오염 가능.
- 제안: 세 정규식에서 `/g` 플래그 제거. `.test()`는 `/g` 불필요. 플래그 제거 시 `lastIndex` 수동 리셋 코드 전체 제거 가능.

---

**[INFO]** 다른 리뷰어들의 "CRITICAL 버그" 판단 — 정확성 검토 필요
- 위치: `validate-scope.ts` L132–150, `if (!context.containerScope.hasItem)` 블록
- 상세: 여러 리뷰어가 "`hasItem: true`일 때 `ITEM_ROOT_RE.lastIndex`가 리셋되지 않아 다음 블록에서 오탐" 을 CRITICAL로 분류했으나, **코드를 직접 추적하면 이 경로는 실제 버그가 아님**.
  - `ITEM_ROOT_RE.test()`는 `if (!hasItem)` 블록 안에서만 호출됨 → `hasItem: true`일 때 `.test()` 자체가 실행되지 않아 `lastIndex`가 변경되지 않음
  - `.test()`가 `false`를 반환하면 JavaScript 엔진이 `lastIndex`를 자동으로 0으로 리셋 → 수동 리셋은 중복이지만 무해함
  - 결과적으로 `hasItem: true` 진입 시점의 `lastIndex`는 항상 0

  실제 취약한 경로는 **예외 발생 시**: `.test()` 반환값이 `true`인 후 `pushUnique()` 내부에서 예외가 발생하면 `lastIndex = 0` 리셋이 누락됨. 그러나 `pushUnique()`는 순수 메모리 조작(`Set.has`, `Set.add`, `Array.push`)만 수행하므로 실질적 가능성은 극히 낮음.
- 제안: CRITICAL 판정을 WARNING으로 재분류. 근본 해결책은 동일: `/g` 플래그 제거.

---

**[WARNING]** `unescapeDoubleQuotedKey` — 이스케이프 범위 과도함
- 위치: `validate-scope.ts` L52–54
- 상세: `raw.replace(/\\(.)/g, "$1")`은 `\"` 외에 `\n`, `\t`, `\\` 등 모든 백슬래시 시퀀스를 제거함. 워크플로우 저장소에서 노드 키가 리터럴 `\n`을 포함하는 방식으로 저장된다면 `allNodeKeys.has(key)` 비교에서 false-negative 발생 가능. 단, 이 함수는 로컬 변수이고 외부에 노출되지 않아 부작용 범위는 제한적.
- 제안: `return raw.replace(/\\"/g, '"')` — `\"` 시퀀스만 처리하도록 제한.

---

**[INFO]** `reachable-nodes.ts` — 순수 함수, 부작용 없음
- 위치: `reachable-nodes.ts` 전체
- 상세: `getContainerChain`, `getAncestorsInScope` 모두 호출마다 `byId`, `incoming`, `visited`, `stack`, `result`를 로컬로 새로 생성. 입력 배열/맵을 읽기 전용으로만 사용. 전역 상태 접근 없음. 부작용 관점에서 완전히 안전.

---

**[INFO]** `LOOP_ROOT_RE.lastIndex = 0` (L130) — `if (!hasLoop)` 블록 밖에 위치
- 위치: `validate-scope.ts` L123–130
- 상세: 이 패턴은 실제로 올바름. `hasLoop: true`일 때 `.test()`가 호출되지 않아 `lastIndex`는 이미 0이므로 L130의 리셋은 무해한 중복. `hasLoop: false` + match 시 유일하게 의미 있는 리셋. 단, `/g` 제거 후에는 이 라인도 제거 대상.

---

### 요약

부작용 관점의 실질적 위험은 단 하나: `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`에 불필요한 `/g` 플래그가 붙어 `lastIndex`가 모듈 싱글턴 상태가 된다는 것이다. 현재 정상 경로에서는 수동 리셋으로 관리되어 실제 오동작이 발생하지 않으며, 다른 리뷰어들이 CRITICAL로 분류한 `hasItem: true` 경로의 `lastIndex` 버그는 코드 추적 결과 **정상 경로에서는 실제 버그가 아님** — `.test()` 자체가 실행되지 않아 `lastIndex`는 항상 0으로 유지된다. 근본 해결책은 세 정규식에서 `/g` 플래그를 제거하는 것이며, 이로써 `lastIndex` 수동 관리 코드 전체가 불필요해진다. `reachable-nodes.ts`는 완전히 순수 함수로 부작용이 없다.

### 위험도
**LOW** — 정상 경로에서는 동작이 올바르고 즉각적인 버그가 없으나, `/g` 플래그 공유 상태는 구조적 취약점으로 제거가 권장됨.