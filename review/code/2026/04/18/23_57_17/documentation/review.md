### 발견사항

- **[INFO]** `use-expression-context.test.ts`의 `makeNode` 시그니처 변경에서 5번째 인자(`extraData`)가 추가되었으나 테스트 내 실제 호출부(예: `containerScope` describe 블록)가 4-인자 `makeNode(id, type, label, {}, { containerId })` 형태로 사용됨 — 함수 시그니처 주석 없어 혼란 야기 가능
  - 위치: `use-expression-context.test.ts:38`
  - 상세: `makeNode("n1", ..., {}, { containerId: "loop1" })` — 4번째 인자가 `config`, 5번째가 `extraData`임이 선언부 외에 설명 없음
  - 제안: 파라미터명을 명확히 하거나, 호출 예시 한 줄 인라인 주석 추가

- **[INFO]** `expression-constants.ts`에 `$loop`, `$item`, `$itemIndex`가 `ROOT_VARIABLES`에 포함되어 있으나, 이 값들이 `containerScope`에 따라 필터링됨을 상수 정의 위치에서 알 수 없음
  - 위치: `expression-constants.ts:7–9`
  - 상세: `ROOT_VARIABLES`를 직접 사용하는 코드에서 `containerScope` 필터링을 각자 구현해야 한다는 점이 문서화되지 않음
  - 제안: JSDoc에 "일부 항목(`$loop`, `$item`, `$itemIndex`)은 containerScope에 따라 필터링 필요" 한 줄 추가

- **[INFO]** `validate-scope.ts`의 모듈 수준 JSDoc이 `@workflow/expression-engine`의 `validate()`와의 역할 분리를 잘 설명하나, `ScopeValidationContext.availableKeys` vs `allNodeKeys`의 차이(`unreachable` vs `unknown` 구분)가 타입 주석에만 존재하고 사용 예시가 없음
  - 위치: `validate-scope.ts:28–35`
  - 상세: 두 Set의 의미가 타입 주석으로 충분히 명확하나, 실제 리뷰어/사용자가 두 Set을 혼동할 여지 있음
  - 제안: 현 수준으로 충분, 추가 예시는 불필요

- **[INFO]** `reachable-nodes.ts`의 모듈/함수 JSDoc이 알고리즘 의도(BFS, container boundary, toolOwnerId 제외)를 잘 설명함 — 양호

- **[INFO]** `variable-picker.tsx`에서 IIFE(`(() => { ... })()`) 패턴을 사용해 `scopedBuiltIns`를 계산하는 부분은 인라인 주석(`/* Built-in variables — drop container-only scopes... */`)으로 충분히 설명됨 — 양호

- **[INFO]** 사용자 설명서(`/docs`) 업데이트가 `CLAUDE.md` DOCUMENTATION 지침에 명시되어 있으며, `$loop`/`$item`/`$itemIndex` scope 제한 및 scope 검증 오류 표시(amber 경고) 기능이 신규 추가됨
  - 위치: `frontend/src/content/docs/03-expression-language/` (변경 대상으로 표시됨)
  - 상세: diff에 포함되지 않았으나 `M`(modified) 상태이므로 업데이트 중인 것으로 보임 — 확인 필요
  - 제안: docs 내 `variables-and-context.mdx`에 container scope 변수(`$loop`, `$item`, `$itemIndex`) 제한 조건 및 scope 경고 UI에 대한 설명이 포함되어 있는지 최종 확인 권장

---

### 요약

전체적으로 문서화 수준이 높습니다. 모듈 JSDoc, 함수 JSDoc, 인라인 주석 모두 알고리즘 의도와 설계 결정(BFS, container boundary, toolOwnerId 제외, parallel에서의 scope 초기화)을 충분히 설명하고 있습니다. 개선 여지는 `expression-constants.ts`의 `ROOT_VARIABLES`에 필터링 필요성에 대한 힌트 한 줄과, 사용자 설명서(mdx)에 신규 scope 경고 UI 및 container scope 변수 제한이 정확히 반영되었는지 최종 확인 정도입니다. 중대한 문서화 누락은 없습니다.

### 위험도

LOW