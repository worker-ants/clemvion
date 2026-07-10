# 테스트(Testing) 리뷰 — suggestions-prefix-dry

## 대상
- `codebase/frontend/src/components/editor/expression/use-expression-suggestions.ts` — `$input.`/`$params.`/`$sourceItem.`/`$dataSource.` 4개 drill 핸들러를 `NESTED_DRILL_SOURCES` 테이블 + 단일 dispatch loop 로 통합 (behavior-preserving 리팩터).
- `plan/in-progress/suggestions-prefix-dry.md` — 계획 문서(신규).

## 검증 수행
기존 테스트 `codebase/frontend/src/components/editor/expression/__tests__/use-expression-suggestions.test.ts` 를 실제 실행하여 확인:

```
Test Files  1 passed (1)
     Tests  56 passed (56)
```

diff 대상 파일 자체는 이번 변경에서 수정되지 않았고(테이블 dispatch 로 대체된 4개 분기 각각에 대응하는 describe 블록 — `$input nested suggestions`, `$params suggestions`, `$sourceItem suggestions (table node)`, `$dataSource. suggestions (table node)` — 이 모두 그대로 재실행되어 전수 통과), plan 문서가 명시한 "기존 테스트 전수 통과 = behavior 보증" 전제가 실측으로 확인됨. 동형 패턴인 직전 커밋(#880, `OUTPUT_SCHEMA_ENRICHERS` 디스패치 테이블화)도 신규 테스트 없이 기존 회귀 테스트만으로 처리된 선례가 있어, 이 프로젝트에서 이런 behavior-preserving table-dispatch 리팩터에 신규 테스트를 요구하지 않는 것은 일관된 관행임.

## 발견사항

- **[INFO]** `$dataSource.` nested-path(하위 객체 drill) 테스트 부재 — pre-existing 갭, 이번 diff 로 신규 발생 아님
  - 위치: `__tests__/use-expression-suggestions.test.ts` `describe("$dataSource. suggestions (table node)")` (라인 876-900)
  - 상세: `$sourceItem.` 은 top-level(`$sourceItem.`) / nested(`$sourceItem.address.`) / prefix-filter(`$sourceItem.f`) 3가지를 커버하는데, `$dataSource.` 는 top-level 과 null-gate 2가지만 커버하고 nested 케이스(`$dataSource.nested.`)가 없음. 리팩터 후 두 핸들러는 `NESTED_DRILL_SOURCES` 테이블에서 완전히 동일한 `getSample`(`sourceItemSample`)·동일 `buildNestedSuggestions` 경로를 공유하게 되어 실질 회귀 위험은 낮지만, 그 대칭성이 테스트로 명시적으로 확인되지는 않음.
  - 제안: `"suggests nested fields for $dataSource.nested."` 케이스 1개 추가로 `$sourceItem` 과 대칭 커버리지 확보(우선순위 낮음, 이번 PR 필수 아님).

- **[INFO]** `available` 게이트의 "즉시 empty 반환" vs "root 목록으로 fall-through 후 결과적으로 empty" 두 내부 경로가 현재 블랙박스 테스트로는 구별 불가
  - 위치: `use-expression-suggestions.ts` `NESTED_DRILL_SOURCES` 의 `$sourceItem.`/`$dataSource.` `available` 게이트; 대응 테스트 `"does not suggest $sourceItem. fields when sourceItemSample is null"` / `"does not suggest $dataSource. fields when sourceItemSample is null"` (두 케이스 모두 `suggestions` 가 `[]`인 것만 검증)
  - 상세: 구 코드는 `available` 조건이 false 면 그 if-block을 그냥 지나쳐 root-variable 목록 필터링 로직까지 흘러갔고(결과적으로 no root variable 이 `"$sourceItem."` 라는 라벨과 정확히 일치하지 않아 empty), 신규 코드도 `continue` 로 동일하게 fall-through 한다. 즉 리팩터는 이 fall-through 의미를 정확히 보존했고 JSDoc 도 이를 명시함 — 문제는 이 fall-through 의미가 `ROOT_VARIABLES` 목록의 우연한 무관성에 의존한다는 점이며, 향후 누군가 `ROOT_VARIABLES` 에 `"$sourceItem."` 처럼 `.` 을 포함한 라벨을 추가하면(현재는 없음) fall-through 경로에서 의도치 않은 root suggestion 이 새어나갈 수 있다. 이 리스크는 리팩터 이전부터 존재했고 이번 diff 로 커진 것은 아님.
  - 제안: 우선순위 낮음. 필요하다면 "gate=false 일 때 root 목록에 `$sourceItem.`/`$dataSource.` 로 시작하는 라벨이 없다"는 불변조건을 pin 하는 주석/테스트를 추가 검토.

- **[INFO]** `NESTED_DRILL_SOURCES` 는 모듈 비공개 상수라 훅의 퍼블릭 API(`useExpressionSuggestions`)를 통한 characterization test 로만 간접 검증됨(직접 단위 테스트 불가)
  - 위치: `use-expression-suggestions.ts` L333-374
  - 상세: 테스트 용이성 관점에서는 다소 아쉽지만, 이 배열이 순수 데이터 매핑(부수효과 없음)이고 4개 브랜치 각각이 기존 describe 블록으로 개별 커버되므로 실질적 문제는 아님. 동일 패턴(#880 `OUTPUT_SCHEMA_ENRICHERS`)도 export 되어 있으나 별도 단위테스트 없이 소비 지점 통해서만 검증되는 것과 일관됨.
  - 제안: 조치 불요(현 상태로 충분).

## Mock/격리/가독성
- 테스트가 순수 함수 훅(`renderHook`)만 사용하고 외부 I/O나 network mock 이 없어 mock 적절성/테스트 격리 이슈 없음. 각 `it` 이 독립된 `expressionData` 를 조립해 넘기므로 테스트 간 상태 공유 없음.
- `cursorAfterExpr` 헬�터로 매직넘버를 피하고, KNOWN LIMITATION 주석(escaped quotes) 처럼 의도적 미해결 케이스를 명시적으로 pin 해두는 등 가독성·의도 표현이 양호함.

## 요약
`use-expression-suggestions.ts` 의 4개 drill 핸들러를 `NESTED_DRILL_SOURCES` 테이블 + 단일 loop 로 통합한 순수 behavior-preserving 리팩터로, 실제로 기존 56개 테스트를 재실행해 전수 통과를 확인했고 이는 `$input`/`$params`/`$sourceItem`/`$dataSource` 4개 분기 각각을 이미 상세히 커버하는 characterization test 이므로 회귀 게이트로 유효하다. 신규 프로덕션 로직(테이블 dispatch, `available` 게이트, `prefix.length` 기반 slice)이 기존 if-block 들과 동일한 외부 동작을 내도록 정확히 보존됐음을 코드 대조로도 확인했다(구코드에서 `$var.` 체크가 `$sourceItem`/`$dataSource` 보다 앞에 있었으나 신 코드에서는 뒤로 이동 — 다만 prefix 들이 상호 배타적이라 순서 변경이 동작에 영향 없음). 발견된 갭은 모두 pre-existing 이거나 확률이 매우 낮은 이론적 케이스로, 이번 PR 범위에서 신규 테스트를 강제할 만한 CRITICAL/WARNING 사항은 없다.

## 위험도
LOW
