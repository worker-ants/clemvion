### 발견사항

---

**[WARNING]** `use-expression-context.ts`의 `FUNCTION_NAMES` 모듈 레벨 상수 초기화
- 위치: `use-expression-context.ts:8`
- 상세: `getAllFunctionNames()`가 모듈 로드 시점에 한 번 호출됩니다. 테스트 환경에서 모킹이 어렵고, 향후 동적으로 함수 목록이 바뀔 경우 반영이 불가능합니다.
- 제안: `useMemo` 내부로 이동하거나, `useMemo` 의존성에 명시적으로 포함되도록 리팩터링.

---

**[WARNING]** `variable-picker.tsx`에서 `BUILT_IN_VARIABLES`와 `use-expression-suggestions.ts`의 `ROOT_VARIABLES`가 중복 정의
- 위치: `variable-picker.tsx:28-35`, `use-expression-suggestions.ts:19-29`
- 상세: `$execution`, `$now`, `$today`, `$loop`, `$item`, `$itemIndex` 등 동일한 변수 목록이 두 파일에 따로 정의되어 있습니다. 한 쪽에서 변수를 추가/제거하면 다른 쪽과 불일치가 발생합니다.
- 제안: 공유 상수 파일(예: `expression-constants.ts`)로 추출해 단일 소스로 유지.

---

**[WARNING]** `variable-picker.tsx` 내 non-null assertion 사용
- 위치: `variable-picker.tsx:353`
- 상세: `expressionData.sourceItemSample!` — 조건부 렌더링(`expressionData.sourceItemSample &&`)으로 null이 아님을 이미 보장하고 있지만, TypeScript가 이를 narrowing하지 못해 `!`를 사용. 가독성/안전성 차원에서 불필요한 단언.
- 제안: 로컬 변수로 추출해 narrowing: `const sample = expressionData.sourceItemSample; if (!sample) return null;`

---

**[INFO]** `use-expression-suggestions.ts:205` 복잡한 정규식 - 매직 패턴
- 위치: `use-expression-suggestions.ts:205`
- 상세: `trimmedToken.replace(/^.*[+\-*/%=!<>&|?,:([\s]/, "")` — 인라인 정규식에 의미 설명이 없어 어떤 경계 문자를 처리하는지 파악하기 어렵습니다.
- 제안: 상수로 추출하거나 주석을 추가: `const OPERATOR_BOUNDARY_RE = /^.*[+\-*/%=!<>&|?,:([\s]/;`

---

**[INFO]** `use-expression-context.ts:88-89`의 반복되는 타입 단언 패턴
- 위치: `use-expression-context.ts:88-89`
- 상세: `(n.data as Record<string, unknown>).label as string ?? n.id` 패턴이 같은 블록에서 `label`, `type` 각각 반복됩니다.
- 제안: 블록 시작에서 `const data = n.data as Record<string, unknown>;` 로 추출 후 재사용 (실제로 `variables` 루프에서는 이미 이 패턴을 따르고 있어 불일치).

---

**[INFO]** `variable-picker.tsx`의 `expandedCategories` 초기 상태가 문자열 키 하드코딩
- 위치: `variable-picker.tsx:277-284`
- 상세: `"$input"`, `"$sourceItem"`, `"$node"` 등 카테고리 키가 하드코딩. 카테고리 추가 시 초기화 누락 위험이 있습니다.
- 제안: 카테고리 키를 `const CATEGORIES = ["$input", ...] as const` 형태로 정의하고, 초기 상태를 `Object.fromEntries(CATEGORIES.map(...))` 패턴으로 구성.

---

**[INFO]** `NestedFieldItem`의 expandable 판단 로직이 컴포넌트 바디에 인라인 분산
- 위치: `variable-picker.tsx:113-128`
- 상세: `isExpandable`, `childSample` 계산 로직이 컴포넌트 렌더 함수 내에 직접 기술되어 있습니다. 동일한 "object/array에서 첫 요소 추출" 로직이 `use-expression-context.ts:147-156`에도 존재합니다.
- 제안: `getChildSample(value: unknown): Record<string, unknown> | null` 유틸 함수로 추출.

---

### 요약

전체적인 코드 품질은 양호합니다. 타입 안전성과 훅 구조가 명확하고, 테스트 커버리지도 주요 경로를 잘 포함하고 있습니다. 다만 `ROOT_VARIABLES`와 `BUILT_IN_VARIABLES`의 중복 정의가 가장 높은 유지보수 위험으로, 이 두 목록이 분리되는 순간 사용자에게 일관성 없는 자동완성 경험을 초래합니다. 또한 `FUNCTION_NAMES` 모듈 레벨 초기화, `NestedFieldItem` 내 중복 추출 로직, 하드코딩된 카테고리 키 등 소소한 개선이 누적되면 코드 응집도와 변경 용이성이 향상됩니다.

### 위험도
**MEDIUM**