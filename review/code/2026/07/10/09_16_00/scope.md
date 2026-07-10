# 변경 범위(Scope) 리뷰 결과

## 요약된 변경 의도
plan/in-progress/suggestions-prefix-dry.md (#878 W3): `use-expression-suggestions.ts`
의 `$input.`/`$params.`/`$sourceItem.`/`$dataSource.` 4개 if-block drill 핸들러가
`buildNestedSuggestions(sample, prefix, schema)` 호출 패턴을 반복하던 것을,
`NESTED_DRILL_SOURCES` 매핑 테이블 + 단일 loop dispatcher 로 통합하는 **behavior-preserving
순수 내부 리팩터**.

### 발견사항

- **[INFO]** plan 문서가 명시한 설계와 diff 가 1:1로 일치
  - 위치: `codebase/frontend/src/components/editor/expression/use-expression-suggestions.ts:143-374`
  - 상세: plan 의 "모듈 레벨 `NESTED_DRILL_SOURCES` 테이블 { prefix, getSample, getSchema?, available? }" +
    "4개 if-block → 단일 loop" 설계가 diff 그대로 구현됨. 각 항목(`$input.`/`$params.`/`$sourceItem.`/`$dataSource.`)의
    `getSample`/`getSchema`/`available` 값이 원본 if-block 의 로직과 동일 — 예:
    `$sourceItem.`/`$dataSource.` 의 `available: (d) => !!d.sourceItemSample` 는 원본
    `&& expressionData.sourceItemSample` 가드를 loop 내 `continue` 로 정확히 대체(가드 실패 시
    해당 loop iteration만 skip → 다른 prefix 는 애초에 불일치이므로 자연스럽게 loop 종료 후
    root-variable fallback 으로 흐름, 원본의 "if 문 통과 후 하단 코드로 낙하" 와 동치).
  - 이 항목은 위반이 아니라 "설계 대비 구현 일치"를 기록하는 참고 사항.

- **[INFO]** `$var.`/`$node[...]` 핸들러, root-variable fallback, `getExpressionToken`,
  `buildNestedSuggestions` 등 나머지 코드는 전혀 손대지 않음
  - 위치: 파일 전체
  - 상세: diff 는 (a) `NESTED_DRILL_SOURCES` 테이블 신규 추가, (b) 4개 if-block 을 loop 로 치환 —
    이 두 hunk 외 다른 라인 변경 없음. import 목록도 무변경(`ExpressionData`, `JsonSchemaNode` 등
    기존 대상 그대로 재사용, 신규 import 없음). 무관한 포맷팅/공백/주석 변경도 관측되지 않음.

- **[INFO]** 신규 JSDoc/inline comment 는 삭제된 원본 if-block 주석의 내용을 테이블 항목으로
  이전한 것
  - 위치: `use-expression-suggestions.ts:143-152` (테이블 상단 JSDoc), 각 엔트리 inline comment
  - 상세: 예) `$params.` 엔트리의 comment 는 원본 `$params.` if-block 위 주석(resolver
    `paramsFromInput`, §7.2 enricher 설명)을 문구만 정리해 그대로 보존. `$sourceItem.`/`$dataSource.`
    항목 comment 도 "table nodes only"/"same shape as $sourceItem" 원본 설명 승계. 순수 리팩터에
    맞게 지식 손실 없이 이전된 것으로, 불필요한 주석 추가로 보지 않음.

- **[INFO]** plan 문서(`plan/in-progress/suggestions-prefix-dry.md`) 신규 추가는 코드 변경과
  함께 커밋되는 표준 워크플로 산출물
  - 위치: `plan/in-progress/suggestions-prefix-dry.md`
  - 상세: frontmatter(`worktree`/`started`/`owner`/`spec_area`) 및 본문이 실제 diff 범위와
    정합. "비고: 순수 내부 리팩터. spec·런타임·백엔드·사용자 가시 동작 무변경" 이라는 명시적
    선언이 diff 내용과 부합 — spec 파일 변경 없음, 코드 diff 도 동작을 바꾸지 않는 구조적
    치환뿐.

- **[INFO]** 하드코딩된 prefix 길이(`slice(7)`, `slice(8)`, `slice(12)`)가 `src.prefix.length`
  로 대체됨
  - 위치: 원본 `use-expression-suggestions.ts:96,104,126,148,162` → 신규 `line 479`
  - 상세: 매직 넘버 제거는 별도의 "불필요한 리팩토링"이 아니라 테이블 기반 dispatcher 로
    전환하는 데 필연적으로 수반되는 변경(각 prefix 문자열이 이제 테이블의 단일 소스이므로
    길이도 그로부터 파생하는 것이 자연스러움). 범위 이탈로 보지 않음.

### 요약
diff 는 plan 문서(`suggestions-prefix-dry.md`)가 사전에 명시한 설계를 정확히 그대로
구현한 것으로, 4개 중복 if-block을 데이터 테이블 + 단일 loop로 통합하는 단일 목적의
behavior-preserving 리팩터에 한정된다. 대상 파일 내 다른 핸들러(`$var.`, `$node[...]`,
root-variable fallback, 토큰 파싱 로직)는 전혀 건드리지 않았고, 무관한 포맷팅/주석/임포트
변경이나 기능 확장도 발견되지 않았다. 함께 추가된 plan 문서는 워크플로 규약상 정상적인
산출물이며 diff 범위와 내용이 정합한다.

### 위험도
NONE
