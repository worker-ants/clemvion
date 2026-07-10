# 부작용(Side Effect) 리뷰 결과

## 리뷰 대상
- `codebase/frontend/src/components/editor/expression/use-expression-suggestions.ts`
- `plan/in-progress/suggestions-prefix-dry.md`

## 발견사항

- **[INFO]** 실행 순서 변경 확인 — 동작 영향 없음
  - 위치: `use-expression-suggestions.ts` L472-490 (`NESTED_DRILL_SOURCES` loop) vs L493 (`$var.` 분기)
  - 상세: 리팩터 전에는 소스 순서상 `$sourceItem.`/`$dataSource.` 분기가 `$var.` 분기 **뒤**에 있었으나, 리팩터 후에는 4개 drill(`$input.`/`$params.`/`$sourceItem.`/`$dataSource.`)이 하나의 loop 로 묶이며 `$var.` **앞**으로 이동했다. 다만 각 분기는 `trimmedToken.startsWith(<리터럴 prefix>)` 로 진입 여부를 판정하고, `"$var."`/`"$sourceItem."`/`"$dataSource."`/`"$input."`/`"$params."` 는 서로 어느 것도 다른 것의 prefix 가 아니므로 한 토큰이 두 분기 조건을 동시에 만족할 수 없다. 즉 상호 배타적 분기이며 순서 변경이 실질적 동작 차이를 만들지 않는다. `$sourceItem.`/`$dataSource.` 의 `available` gate 가 false 인 경우도 loop 를 그냥 통과(`continue`)해 기존과 동일하게 root-variable 목록으로 fall-through 한다.
  - 제안: 조치 불요. 다만 리뷰 근거로 남겨 향후 이 loop 에 prefix 가 겹치는 새 항목(예: `$s` 로 시작하는 다른 root)을 추가할 때는 순서 민감성이 생길 수 있음을 유의.

- **[INFO]** `getSample`/`available` 암묵적 결합 — 현재는 안전하나 향후 재사용 시 위험
  - 위치: `use-expression-suggestions.ts` L361-373 (`$sourceItem.`/`$dataSource.` 엔트리), 호출부 L476-484
  - 상세: `$sourceItem.`/`$dataSource.` 엔트리의 `getSample: (d) => d.sourceItemSample as Record<string, unknown>` 는 `sourceItemSample` 이 `undefined` 일 수 있는 타입을 강제 캐스팅한다. 런타임 안전은 같은 루프 반복 내에서 `available: (d) => !!d.sourceItemSample` 가 먼저 평가되어 `continue` 로 걸러지는 것에 전적으로 의존한다(현재 호출 순서상 안전 — `if (src.available && !src.available(expressionData)) continue;` 가 `getSample` 호출보다 먼저 실행됨). 그러나 두 함수(`available`, `getSample`)가 테이블 엔트리 안에서 독립적으로 정의되어 TypeScript 타입 시스템이 이 불변식을 보장하지 않는다. JSDoc 이 "Adding a nested-drill root = one entry here" 라고 재사용을 유도하므로, 향후 이 테이블이 현재의 단일 loop 이외의 경로(예: 다른 dispatcher, 테스트 유틸리티)에서 `available` 체크 없이 `getSample` 만 직접 호출되면 `Object.keys(undefined)` 류의 런타임 예외로 이어질 수 있다.
  - 제안: 현재 diff 범위에서는 동작 변경이 아니므로 차단 사유는 아님. 다만 `getSample` 시그니처를 `Record<string, unknown> | undefined` 로 정직하게 두고 `buildNestedSuggestions` 호출부에서 `?? {}` fallback 을 주거나, `getSample`/`available` 을 하나의 `resolve(d) => Record<string,unknown> | undefined` 함수로 합쳐 타입 캐스팅을 제거하는 방향을 후속 개선으로 고려 가능.

- **[INFO]** 신규 모듈 레벨 상수 `NESTED_DRILL_SOURCES` — 전역 상태 아님, 부작용 없음
  - 위치: `use-expression-suggestions.ts` L333-374
  - 상세: 컴포넌트/훅 스코프 밖에 선언된 `const` 배열이지만 각 엔트리의 함수는 인자 `d: ExpressionData` 외부의 어떤 가변 상태도 캡처하지 않는 순수 함수이며, 배열 자체도 어디서도 재할당·mutate 되지 않는다(`ReadonlyArray` 타입). 기존에 이미 존재하는 `ROOT_VARIABLES`/`NODE_ACCESSORS`/`TABLE_CONTEXT_VARIABLES` 와 동일한 패턴이라 컨벤션에 부합한다. `useMemo` 의 dependency 배열(`[value, cursorPos, expressionData]`)도 변경되지 않았고 이 상수를 참조할 필요가 없다(모듈 스코프 상수라 참조 안정성이 항상 보장됨).
  - 제안: 조치 불요.

- **[INFO]** 공개 API/시그니처 불변 확인
  - 위치: `use-expression-suggestions.ts` L379-383 (`export function useExpressionSuggestions`), L285-289 (`buildNestedSuggestions`)
  - 상세: export 되는 `useExpressionSuggestions(value, cursorPos, expressionData)` 의 시그니처와 반환 shape(`{ suggestions, tokenStart, tokenEnd }`)는 변경되지 않았다. 내부 헬퍼 `buildNestedSuggestions(sample, fieldPrefix, schema?)` 도 시그니처 불변이며, `$sourceItem.`/`$dataSource.` 호출부에서 이전에는 `schema` 인자를 아예 생략(→ 암묵적 `undefined`)했던 것이, 리팩터 후에는 `src.getSchema?.(expressionData)` 로 명시 전달되지만 해당 엔트리에 `getSchema` 프로퍼티 자체가 없으므로 optional chaining 이 단락되어 결과값은 동일하게 `undefined` 이다. 이 함수는 export 되지 않는 모듈 내부 헬퍼라 외부 호출자 영향도 없다.
  - 제안: 조치 불요.

- **[INFO]** 파일시스템/환경변수/네트워크/이벤트 부작용 없음
  - 위치: 대상 diff 전체
  - 상세: 순수 계산 로직 리팩터(조건문 4개 → 데이터 테이블 + 단일 loop)로, I/O·네트워크·env 접근·이벤트 발행·콜백 등록 변경이 전혀 없다. `plan/in-progress/suggestions-prefix-dry.md` 신규 파일은 프로젝트 컨벤션(`plan/in-progress/<name>.md`)에 따른 작업 추적 문서로, 의도된 파일 생성이며 부작용이 아니다.
  - 제안: 조치 불요.

## 요약
이번 변경은 `use-expression-suggestions.ts` 내 4개의 중복된 if-block(`$input.`/`$params.`/`$sourceItem.`/`$dataSource.`)을 `NESTED_DRILL_SOURCES` 테이블 기반 단일 loop 로 통합한 behavior-preserving 리팩터다. export 되는 함수 시그니처·반환 shape 는 그대로이고, `buildNestedSuggestions` 호출 시 인자 전달(특히 `schema` optional chaining)도 이전 결과와 동일하게 귀결된다. 소스 상 실행 순서가 일부 바뀌었지만(`$var.` 분기와 nested-drill loop 의 상대 순서) 각 분기가 상호 배타적인 리터럴 prefix 로 게이팅되어 실질적 동작 차이는 없다. 유일하게 주목할 점은 `$sourceItem.`/`$dataSource.` 엔트리의 `getSample` 이 `available` gate 통과를 전제로 한 타입 캐스팅에 의존한다는 것으로, 현재 단일 호출 경로에서는 안전하지만 향후 이 테이블이 다른 경로에서 재사용될 경우 잠재적 런타임 예외 소지가 있어 참고용으로 남긴다. 전역 상태 변경, 파일시스템/네트워크/환경변수 부작용, 공개 인터페이스 변경은 없다.

## 위험도
NONE
