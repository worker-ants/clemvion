# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `$params` 가 `VariablePicker` "기본 제공" 섹션에도 자동 노출되지만 검증 테스트 없음
  - 위치: `codebase/frontend/src/components/editor/expression/expression-constants.ts:1084` (`ROOT_VARIABLES`에 `$params` 추가), `expression-constants.ts:1137-1144` (`BUILT_IN_PICKER_VARIABLES` 제외 목록 `["$input", "$node", "$var"]`에 `$params` 미포함), `codebase/frontend/src/components/editor/expression/__tests__/variable-picker.test.tsx`
  - 상세: `BUILT_IN_PICKER_VARIABLES`는 `ROOT_VARIABLES`에서 `$input`/`$node`/`$var`만 제외하고 나머지를 그대로 노출한다. 이번 PR로 `$params`가 `ROOT_VARIABLES`에 추가되면서, `use-expression-suggestions.test.ts`에서 검증하는 autocomplete 경로 외에 `VariablePicker`("Insert Variable" 팝오버, `variable-picker.tsx:432-450`)의 "기본 제공(Built-in)" 목록에도 자동으로 노출되는 부수 효과가 생긴다. 그러나 `variable-picker.test.tsx`는 여전히 container-scope gating(`$loop`/`$item`/`$itemIndex`/`$today`)만 검증하고 있어, `$params`가 이 카테고리에 노출되는지 / 클릭 시 `onInsert("$params")`가 정확히 호출되는지에 대한 커버리지가 전혀 없다. 실행해보면(`variable-picker.test.tsx`) 통과는 하지만 이는 회귀 방지 역할을 못 하고 있다는 뜻 — 우연히 통과할 뿐 의도적으로 검증된 게 아니다.
  - 제안: `variable-picker.test.tsx`에 "`$params`가 기본 제공 섹션에 노출되고 클릭 시 `$params` 텍스트로 삽입된다" 테스트 1개 추가. (`$input`/`$node`/`$var`처럼 별도 드릴다운 섹션을 만들지 않고 얕은 built-in 항목으로만 노출하는 설계 의도라면, 그 의도를 주석으로 남겨두는 것도 권장.)

- **[WARNING]** `$params.` 핸들러의 방어적 타입 가드(array/null/primitive `parameters`)가 테스트로 커버되지 않음
  - 위치: `codebase/frontend/src/components/editor/expression/use-expression-suggestions.ts:1173-1177`
    ```ts
    const rawParams = expressionData.inputSample.parameters;
    const paramsSample =
      rawParams && typeof rawParams === "object" && !Array.isArray(rawParams)
        ? (rawParams as Record<string, unknown>)
        : {};
    ```
  - 상세: `ExpressionData.inputSample`은 `Record<string, unknown>`이므로 `.parameters`는 런타임에 임의의 값(배열, `null`, 문자열, 숫자 등)일 수 있다. 코드는 이를 명시적으로 가드해 `{}`로 폴백시키는데, 추가된 테스트 "returns empty for $params. when input has no parameters (non-successor node)"는 `parameters` **키 자체가 없는** 케이스(`{ someOtherField: 1 }`)만 검증한다. `parameters`가 배열이거나 `null`/primitive인 케이스(예: 백엔드/스키마 드리프트로 `output.parameters`가 예상과 다른 shape로 들어오는 상황)는 어느 테스트도 실행하지 않는다. 이 가드는 `$input.` 핸들러(`use-expression-suggestions.ts:1439-1451`, `expressionData.inputSample`을 그대로 넘김)에는 없는, `$params` 콜사이트에만 존재하는 새 로직이라 다른 테스트로 간접 커버되지도 않는다.
  - 제안: `inputSample: { parameters: null }`, `inputSample: { parameters: [] }` (또는 `"string"`) 케이스를 추가해 `suggestions`가 빈 배열로 안전하게 폴백함을 명시적으로 고정.

- **[INFO]** `$params.` 경로의 `tokenStart`/`tokenEnd` 위치 계산에 대한 명시적 회귀 테스트 부재
  - 위치: `use-expression-suggestions.test.ts` — 기존 `describe("tokenStart position for nested paths", ...)` (라인 476-499) 및 `$node` 섹션의 개별 tokenStart 테스트(예: 라인 386-393 "sets tokenStart correctly for nested $node output")와 대비해, 신규 `describe("$params suggestions", ...)`(라인 267-321)에는 동일한 성격의 `tokenStart`/`tokenEnd` 단언이 없음.
  - 상세: `$params.` 분기(`use-expression-suggestions.ts:1185-1189`)는 `end - leafLength`로 `tokenStart`를 계산하는 새 코드 경로다. 내부적으로 `buildNestedSuggestions`가 반환하는 `leafLength`를 재사용하므로 위험은 낮지만, 다른 모든 drill-down 경로(`$input`, `$node`, `$sourceItem` 등)는 커서 위치 회귀를 잡기 위한 전용 테스트를 갖고 있는 것과 비교하면 일관성이 떨어진다.
  - 제안: `"{{ $params.re }}"` 같은 케이스에 대해 `tokenStart`/`tokenEnd` 값을 명시적으로 단언하는 테스트 1개 추가(기존 컨벤션과 동일한 패턴).

- **[INFO]** 스키마+샘플이 동시에 존재하고 값이 다른 "병합(override)" 케이스가 `$params` 콜사이트 기준으로는 미검증
  - 위치: `use-expression-suggestions.test.ts:290-304` (스키마만 있는 케이스, 샘플만 있는 케이스는 각각 별도 `it`)
  - 상세: `buildNestedSuggestions`의 병합 로직("sample wins over schema") 자체는 `$node` 스위트(`"unions runtime sample with schema fields (no duplicates, sample wins)"`, 라인 791-821)로 충분히 검증되어 있어 함수 자체의 위험은 낮다. 다만 `$params` 콜사이트 고유의 매핑(`inputSchema?.properties?.parameters` → `paramsSchema`, `inputSample.parameters` → `paramsSample`)이 두 소스를 정확히 같은 하위 경로로 정렬해 넘기는지는 "스키마만" / "샘플만" 두 단독 케이스로는 완전히 보증되지 않는다(예: 스키마와 샘플이 다른 파라미터 이름을 가질 때 합집합이 올바르게 나오는지).
  - 제안: 우선순위 낮음 — 필요 시 `inputSchema`와 `inputSample.parameters`를 동시에 주고 일부만 겹치는 케이스를 추가해 두 소스가 실제로 같은 `parameters` 하위 경로에서 합쳐짐을 고정.

## 요약

`$params` root 변수 추가 + `$params.` drill-down 핸들러에 대한 신규 유닛 테스트 5건은 기존 `use-expression-suggestions.test.ts` 컨벤션(주석 헤더, `makeSuggestions`/`cursorAfterExpr` 헬퍼 재사용, 테스트 간 데이터 독립, mock 없이 순수 함수 검증)을 잘 따르며 핵심 시나리오(root 노출, 스키마 기반/샘플 기반 하위키, prefix 필터, non-successor 노드에서 빈 결과)를 모두 커버해 가독성·격리·회귀 안전성 면에서는 양호하다. 다만 `ROOT_VARIABLES` 변경이 `BUILT_IN_PICKER_VARIABLES`를 통해 `VariablePicker` UI에도 영향을 미치는 부수 효과가 전혀 테스트되지 않았고(가장 실질적인 갭), `$params.` 핸들러에 새로 추가된 타입 가드(배열/null/primitive `parameters` 방어)가 명시적으로 검증되지 않은 점이 두 번째 갭이다. 두 갭 모두 실제 실행에는 영향이 없어 보이지만(현재 코드는 방어적으로 안전하게 동작) 향후 리팩터링 시 조용히 깨질 수 있는 영역이므로 보강을 권장한다.

## 위험도

MEDIUM
