### 발견사항

- **[WARNING]** 모듈 수준 `/g` 플래그 정규식의 `lastIndex` 공유 상태
  - 위치: `validate-scope.ts` L46–49 — `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`
  - 상세: JavaScript는 단일 스레드이므로 진정한 경쟁 조건은 없으나, React Concurrent Mode에서 렌더링이 중단(interleave)되거나 비동기 컨텍스트에서 호출될 경우 동일 인스턴스를 공유하는 `lastIndex`가 오염될 수 있음. 특히 `hasItem === true`일 때 `ITEM_ROOT_RE`/`ITEM_INDEX_ROOT_RE`의 `lastIndex = 0` 리셋이 실행되지 않아 다음 호출이 잘못된 위치부터 매칭을 시작하는 실질적 버그가 존재함. 예외 발생 시에도 리셋이 누락됨.
  - 제안: `/g` 플래그 제거가 근본 해결책. `.test()` 전용 정규식에는 `g` 플래그가 불필요하며 제거 시 `lastIndex` 관리 코드 전체가 불필요해짐.

```ts
// Before (위험)
const LOOP_ROOT_RE = /(?<![A-Za-z0-9_$])\$loop(?![A-Za-z0-9_$])/g;

// After (안전)
const LOOP_ROOT_RE = /(?<![A-Za-z0-9_$])\$loop(?![A-Za-z0-9_$])/;
```

- **[INFO]** `matchAll` 사용 정규식(`EXPR_BLOCK_RE`, `NODE_REF_RE`, `VAR_REF_RE`)은 안전함
  - 위치: `validate-scope.ts` L43–44
  - 상세: ES2020 표준에서 `String.prototype.matchAll()`은 내부적으로 정규식을 복제하여 원본 `lastIndex`를 변경하지 않음. 현재 사용 방식에는 문제 없음.

- **[INFO]** `reachable-nodes.ts` 전체 함수는 동시성 관점에서 완전히 안전
  - 위치: `reachable-nodes.ts` 전체
  - 상세: 모든 자료구조(`Map`, `Set`, `Array`)가 함수 호출마다 로컬로 생성되며 공유 변경 가능 상태가 없음. 사이클 처리(`visited` Set)도 올바르게 구현되어 있음.

---

### 요약

이 코드는 순수 동기 함수로 구성되어 있어 실질적인 동시성 위험은 낮습니다. 유일한 주의 사항은 `validate-scope.ts`의 모듈 수준 `/g` 플래그 정규식으로, `hasItem === true` 경로에서 `ITEM_ROOT_RE`/`ITEM_INDEX_ROOT_RE`의 `lastIndex`가 리셋되지 않는 구현 버그가 실재합니다. JavaScript 단일 스레드 특성상 즉각적 경쟁 조건은 아니지만 React Concurrent Mode 또는 비동기 래퍼 환경에서 상태 오염으로 이어질 수 있으며, 이미 다중 블록 + `hasItem: true` 조합에서 오탐을 유발하는 버그입니다. `/g` 플래그 제거로 모든 관련 위험을 일괄 해소할 수 있습니다.

### 위험도

**LOW**