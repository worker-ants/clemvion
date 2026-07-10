# 성능(Performance) 리뷰 — use-expression-suggestions.ts prefix-drill DRY

## 발견사항

- **[INFO]** 검사 순서 변경으로 `$var.` / root-fallback 토큰에 대해 매 keystroke마다 문자열 비교 2회 추가
  - 위치: `codebase/frontend/src/components/editor/expression/use-expression-suggestions.ts` L472-490 (`NESTED_DRILL_SOURCES` loop) vs 기존 `$var.` 체크(L493-510)
  - 상세: 리팩터 전에는 `$sourceItem.`/`$dataSource.` 체크가 `$var.` 체크보다 *뒤*에 위치했다(원본 diff상 첫 hunk가 `$input`/`$params`, 두 번째 hunk가 `$sourceItem`/`$dataSource`이고 그 사이 gap에 `$var.` 블록이 존재). 리팩터 후에는 4개 prefix가 하나의 loop로 합쳐지면서 `$sourceItem.`/`$dataSource.` 체크가 `$var.` 체크보다 *앞*으로 이동했다. 결과적으로 `$var.` 토큰이나 root-fallback 경로(빈 토큰, 연산자 뒤 등)를 평가할 때마다 `String.prototype.startsWith` 호출이 이전 대비 2회 더 실행된다.
  - 영향: `useExpressionSuggestions`는 `useMemo([value, cursorPos, expressionData])`로 메모이즈되어 있어 타이핑 중 매 keystroke마다 재계산되는 hot path이지만, 추가된 연산은 길이가 짧은 문자열(`$sourceItem.`, `$dataSource.`)에 대한 `startsWith` 비교로 서브마이크로초 수준이다. 체감 성능 영향은 없다고 판단.
  - 제안: 별도 조치 불필요. 다만 순서 의존성이 없는(prefix가 서로 disjoint) 구조이므로, 만약 향후 항목이 늘어나 loop 비용이 유의미해지면 자주 매칭되는 prefix(`$var.` 등)를 테이블 앞쪽에 두거나 Map 기반 첫 글자 dispatch로 전환을 고려.

- **[INFO]** (긍정적) `NESTED_DRILL_SOURCES` 테이블이 훅 바깥 모듈 스코프에 선언되어 있어 렌더/keystroke마다 재할당되지 않음
  - 위치: L333-374 (`const NESTED_DRILL_SOURCES: ReadonlyArray<...> = [...]`, `useExpressionSuggestions` 함수 정의 밖)
  - 상세: 4개 엔트리와 그 안의 `getSample`/`getSchema`/`available` 클로저는 모듈 로드 시 1회만 생성된다. 만약 이 테이블이 `useExpressionSuggestions` 본문(또는 `useMemo` 콜백) 내부에 선언되었다면 매 재계산마다 배열+클로저 4~8개가 새로 할당되어 GC 압박이 늘었을 것이나, 현재 구조는 그런 회귀를 피했다. 리팩터의 설계가 성능 관점에서 적절.

- **[INFO]** `buildNestedSuggestions` 자체의 알고리즘 복잡도는 변경 없음
  - 위치: L285-322 (unchanged)
  - 상세: `sampleKeys`/`schemaKeys`를 `Map`으로 병합 후 `filter`+`map`하는 O(sample keys + schema keys) 로직은 리팩터 이전과 동일하다. 4개의 호출부(`$input`/`$params`/`$sourceItem`/`$dataSource`)가 동일 함수를 재사용하도록 dispatcher로 묶은 것뿐이며 함수 자체의 시간/공간 복잡도에는 영향이 없다.

- **[INFO]** `$params.` 의 `getSample` 클로저가 매 호출마다 `{}` 리터럴을 새로 생성하는 fallback은 기존 동작 그대로 보존
  - 위치: L352-357
  - 상세: `raw`가 object가 아니거나 배열일 때 `{}`를 새로 반환하는 부분은 리팩터 이전 코드(`paramsFromInput`)와 동일한 동작이며 이번 diff로 새로 도입된 회귀가 아니다. 단일 소량 객체 리터럴이라 GC 부담도 무시할 수준.

## 요약

이번 변경은 4개의 반복되는 `if (trimmedToken.startsWith(prefix)) { buildNestedSuggestions(...) }` 블록을 데이터 테이블 + 단일 loop dispatcher로 통합한 순수 DRY 리팩터로, `buildNestedSuggestions`의 알고리즘 복잡도·메모이제이션 구조(`useMemo` 의존성 배열)·N+1/블로킹 I/O/캐싱 관련 특성 모두 변경되지 않았다. 테이블이 훅 바깥 모듈 스코프에 정의되어 클로저가 keystroke마다 재할당되지 않는 점은 오히려 바람직한 설계다. 유일한 미세 차이는 `$sourceItem.`/`$dataSource.` 체크가 loop 안으로 들어오면서 `$var.` 및 root-fallback 경로 평가 시 짧은 문자열 비교가 2회 추가된 것인데, 이는 서브마이크로초 단위로 실질적 성능 영향이 없다. 플랜 문서에도 명시된 대로 behavior-preserving 리팩터이며 성능 관점에서도 리스크가 거의 없다.

## 위험도
NONE
