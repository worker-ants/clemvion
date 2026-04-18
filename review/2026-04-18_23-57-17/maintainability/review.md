### 발견사항

- **[WARNING]** `variable-picker.tsx`의 IIFE 패턴 사용
  - 위치: `variable-picker.tsx` diff, Built-in variables 섹션
  - 상세: JSX 내 `{(() => { ... })()}` 패턴은 가독성을 저하시키며, 이 패턴이 필요한 이유가 불명확함
  - 제안: 별도 컴포넌트(`ScopedBuiltIns`) 또는 렌더 함수로 추출

- **[WARNING]** `validate-scope.ts`의 모듈 레벨 정규식 상태 관리
  - 위치: `validate-scope.ts:50-53`, `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`
  - 상세: `/g` 플래그가 붙은 정규식을 모듈 상수로 선언하면 `lastIndex` 상태가 호출 간 공유됨. `lastIndex = 0` 리셋이 필요한 이유가 바로 이것이며, 실수로 리셋을 빠뜨리면 인터미턴트 버그가 발생. `NODE_REF_RE`, `VAR_REF_RE`, `EXPR_BLOCK_RE`는 `matchAll`로만 사용되어 같은 위험이 없음
  - 제안: `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`를 함수 내에서 `/g` 없이 `test()`로 호출하거나, 각 블록에서 `new RegExp(...)`로 생성하여 상태 공유 제거

- **[WARNING]** `use-expression-context.ts`의 `useMemo` 콜백 길이
  - 위치: `use-expression-context.ts` diff, `useExpressionContext` 함수
  - 상세: `useMemo` 콜백이 이미 복잡했는데 `scopedNodes` 생성, `ancestors` 계산, `containerScope` 계산, `allNodeKeys` 빌드까지 추가되어 단일 함수가 약 150줄 이상으로 성장. 여러 책임이 혼재함
  - 제안: `buildContainerScope(selectedNodeId, scopedNodes)`, `buildAvailableNodes(...)` 등 순수 함수로 분리하고 `useMemo` 콜백은 조합만 담당하게 구조 개선

- **[INFO]** `use-expression-context.ts`의 `scopedNodes` 타입 캐스팅 반복
  - 위치: `use-expression-context.ts` diff, `scopedNodes` 생성 부분
  - 상세: `(n.data ?? {}) as Record<string, unknown>` 후 각 필드마다 `as string | null | undefined` 캐스팅이 반복됨. 노드 데이터 타입이 `unknown`인 근본 원인은 스토어 타입 정의에 있음
  - 제안: 스토어의 노드 타입에 `containerId`, `toolOwnerId` 필드를 명시적으로 선언하거나, 헬퍼 함수 `toScopedNode(n: StoreNode): ScopedNode`로 캐스팅을 한 곳에 집중

- **[INFO]** `expression-constants.ts`의 `BUILT_IN_PICKER_VARIABLES` 필터와 `use-expression-suggestions.ts`/`variable-picker.tsx`의 scope 필터 중복
  - 위치: `expression-constants.ts:27-30`, `use-expression-suggestions.ts` diff, `variable-picker.tsx` diff
  - 상세: `$loop`/`$item`/`$itemIndex`를 container scope에 따라 필터링하는 로직이 suggestions와 picker 두 곳에 동일하게 복사됨
  - 제안: `filterByContainerScope(variables, containerScope)` 유틸 함수를 `expression-constants.ts`나 별도 파일에 추출하여 단일 진실 공급원 유지

- **[INFO]** `reachable-nodes.test.ts`의 `makeNode` 시그니처(`extraData` 5번째 인자) — 테스트 헬퍼와 실제 헬퍼 불일치
  - 위치: `use-expression-context.test.ts` diff, `makeNode` 함수 시그니처 변경
  - 상세: `makeNode("n1", "http_request", "HTTP", {}, { containerId: "loop1" })` — 4번째 인자 `config`와 5번째 인자 `extraData`가 분리되어 있어, `containerId`가 왜 `data` 최상위에 병합되는지 직관적이지 않음
  - 제안: `containerId`를 `config` 대신 3번째 위치의 별도 옵션 객체에 두거나, `makeNode(id, type, label, { config, containerId })` 형태로 통합

- **[INFO]** `expression-input.tsx`의 `runScopeValidation` 함수 중복 early-return
  - 위치: `expression-input.tsx` diff, `runScopeValidation` 함수
  - 상세: `!value || !value.includes("{{")` 체크가 `validateExpressionScope` 내부에도 동일하게 존재(`value.indexOf("{{") === -1`)
  - 제안: 외부 wrapper의 early-return 제거, `validateExpressionScope`의 내부 guard만 신뢰

---

### 요약

전체적으로 코드 구조는 명확하고 의도가 잘 드러나며 테스트 커버리지도 충실하다. 가장 큰 유지보수 리스크는 두 가지다: `/g` 플래그 정규식의 모듈 레벨 공유 상태(실수로 `lastIndex` 리셋을 빠뜨리면 산발적 버그 발생)와 `$loop`/`$item` 필터 로직이 suggestions·picker 두 곳에 중복된 점이다. `useExpressionContext`의 `useMemo` 콜백도 책임이 점점 누적되고 있어 향후 분리가 필요하다.

### 위험도

**LOW**