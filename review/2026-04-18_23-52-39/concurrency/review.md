### 발견사항

- **[WARNING]** 모듈 수준에서 선언된 `/g` 플래그 전역 정규식 — `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`를 `.test()`와 함께 사용
  - 위치: `validate-scope.ts` — 정규식 선언부 및 `validateExpressionScope` 함수 내 `.test()` 호출
  - 상세: `/g` 플래그가 있는 `RegExp` 인스턴스는 `lastIndex` 상태를 객체에 보존합니다. `.test()` 호출 후 코드는 수동으로 `lastIndex = 0`을 재설정하지만, 함수 실행 도중 예외가 발생하면 재설정이 건너뛰어져 다음 호출이 중간 위치에서 검색을 시작하는 오염된 상태로 남게 됩니다. JavaScript는 단일 스레드이므로 진정한 경쟁 조건은 아니지만, React의 동시 렌더링(Concurrent Mode)이나 비동기 래퍼 내에서 이 함수가 호출될 경우 실행이 interleave 되어 문제가 발생할 수 있습니다.
  - 제안: `.test()` 대신 `new RegExp(...).test()` 패턴으로 로컬 인스턴스를 사용하거나, 매칭 전에 명시적으로 `lastIndex = 0` 재설정을 보장하세요. 더 안전한 방법은 함수 내부에서 리터럴로 재생성하는 것입니다.

```typescript
// 현재 (위험)
if (!context.containerScope.hasLoop && LOOP_ROOT_RE.test(block)) { ... }
LOOP_ROOT_RE.lastIndex = 0;

// 권장 (항상 안전)
const loopRe = /(?<![A-Za-z0-9_$])\$loop(?![A-Za-z0-9_$])/g;
if (!context.containerScope.hasLoop && loopRe.test(block)) { ... }
```

- **[INFO]** `matchAll`로 사용되는 전역 정규식은 안전함
  - 위치: `validate-scope.ts` — `EXPR_BLOCK_RE`, `NODE_REF_RE`, `VAR_REF_RE`
  - 상세: ES2020 표준에서 `String.prototype.matchAll()`은 내부적으로 정규식을 복제하여 원본의 `lastIndex`를 수정하지 않습니다. 현재 사용 방식은 문제없습니다.

- **[INFO]** `reachable-nodes.ts`의 BFS는 완전히 순수 함수적
  - 위치: `reachable-nodes.ts` 전체
  - 상세: 모든 자료구조(`Map`, `Set`, `Array`)가 함수 호출마다 로컬로 생성되고, 공유 변경 가능 상태가 없으며, 사이클 처리(`visited` Set)도 올바르게 구현되어 있습니다. 동시성 관점에서 결함 없음.

---

### 요약

이 코드는 전반적으로 순수 동기 함수로 구성되어 있어 실질적인 동시성 위험은 낮습니다. 주목할 점은 `validate-scope.ts`에서 모듈 수준 전역 정규식 객체를 `.test()`와 함께 사용하는 패턴으로, `lastIndex` 상태가 오염될 경우 연속 호출 간에 잘못된 매칭 결과가 발생할 수 있습니다. 현재 수동 `lastIndex = 0` 재설정은 예외 경로를 보호하지 못하며, 향후 React Concurrent Mode 통합이나 비동기 컨텍스트 사용 시 잠재적 버그로 이어질 수 있습니다. `reachable-nodes.ts`는 동시성 관점에서 완전히 안전합니다.

### 위험도

**LOW**