## 리뷰 결과

### 발견사항

**[WARNING]** 모듈 수준 정규식 객체의 `lastIndex` 공유 상태 문제
- 위치: `validate-scope.ts` — `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE` (모듈 상단 상수)
- 상세: `g` 플래그가 붙은 정규식을 모듈 스코프 상수로 선언하면 `.test()` 호출마다 `lastIndex`가 변경됩니다. 코드에서 각 `.test()` 후 `lastIndex = 0`으로 리셋하고 있지만, `LOOP_ROOT_RE.test(block)`가 `true`를 반환한 경우(즉, `pushUnique` 분기로 진입한 경우) `lastIndex` 리셋은 호출 **후**에 실행됩니다. 단일 스레드 JS에서는 문제 없지만, 만약 `pushUnique` 내부에서 같은 정규식을 재사용하거나 향후 비동기 코드로 변경될 경우 race condition이 발생할 수 있습니다.
- 제안: 정규식을 함수 내부에서 매번 새로 생성하거나(`/pattern/g` 인라인), 또는 `g` 플래그를 제거하고 `.test()` 전용으로 사용 (`g` 없으면 `lastIndex` 문제 없음).

```ts
// 방법 1: g 플래그 제거 (test만 사용하므로 g 불필요)
const LOOP_ROOT_RE = /(?<![A-Za-z0-9_$])\$loop(?![A-Za-z0-9_$])/;
```

**[INFO]** `NODE_REF_RE`, `VAR_REF_RE`도 모듈 수준 `g` 플래그 정규식이나 `matchAll`로 사용 중
- 위치: `validate-scope.ts` L43–L44
- 상세: `String.prototype.matchAll()`은 내부적으로 정규식을 복사하여 사용하므로 `lastIndex` 오염이 없습니다. 현재 코드에서는 안전합니다.
- 제안: 현 상태 유지 가능, 단 주석으로 명시하면 유지보수에 도움됩니다.

**[INFO]** `getAncestorsInScope` — 입력 배열/맵 변경 없음, 순수 함수 확인
- 위치: `reachable-nodes.ts` 전체
- 상세: `nodes`, `edges` 파라미터를 읽기 전용으로만 사용하고, 내부 `Map`/`Set`을 새로 생성합니다. 호출자의 데이터 구조에 부작용 없습니다.

**[INFO]** 새 공개 API 도입 (`ScopedNode`, `EdgeLite`, `getContainerChain`, `getAncestorsInScope`, `validateExpressionScope`, `ScopeValidationContext`)
- 위치: `reachable-nodes.ts`, `validate-scope.ts`
- 상세: 모두 신규 export이므로 기존 호출자에 대한 breaking change 없습니다.

---

### 요약

이번 변경은 두 개의 순수 유틸리티 모듈을 신규 도입한 것으로, 전역 상태 변경·파일시스템·네트워크·환경변수 접근이 전혀 없습니다. 유일한 주의 사항은 `validate-scope.ts`에서 `g` 플래그 정규식을 모듈 상수로 선언하고 `.test()` 호출 후 수동으로 `lastIndex = 0` 리셋을 수행하는 패턴인데, `LOOP_ROOT_RE` 분기에서 `true` 반환 시 리셋 위치가 올바르나 향후 유지보수 중 실수가 생길 수 있는 취약한 구조입니다. `g` 플래그를 제거하는 것으로 쉽게 제거 가능한 잠재적 위험입니다.

### 위험도
**LOW**