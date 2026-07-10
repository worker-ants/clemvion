# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `available`/`getSample` 계약이 타입으로 강제되지 않아 향후 항목 추가 시 런타임 위험
  - 위치: `codebase/frontend/src/components/editor/expression/use-expression-suggestions.ts` — `NESTED_DRILL_SOURCES` 테이블의 `$sourceItem.`/`$dataSource.` 엔트리 (최종 파일 기준 L361-374)
  - 상세: `getSample: (d) => d.sourceItemSample as Record<string, unknown>` 는 `sourceItemSample`(옵셔널)을 강제 캐스팅한다. 이 캐스팅의 안전성은 "같은 엔트리의 `available` 이 먼저 undefined 를 걸러준다"는 암묵적 계약에만 의존하며, `getSample`/`available` 이 서로 다른 필드로 분리돼 있어 타입 시스템이 그 연결을 검증하지 않는다. 향후 새 prefix 를 추가할 때 optional 소스에 `available` 게이트를 빠뜨리거나 두 함수의 로직이 어긋나면, `buildNestedSuggestions` 내부에서 `Object.keys(undefined)` 류의 런타임 에러로 이어질 수 있다. 현재는 주석(`available gate mirrors the old && expressionData.sourceItemSample guard`)으로 계약을 명시해 뒀기 때문에 지금 당장의 버그는 아니다.
  - 제안: `getSample` 반환 타입을 `Record<string, unknown> | undefined` 로 허용하고, 루프에서 `const sample = src.getSample(expressionData); if (sample === undefined) continue;` 형태로 판정하면 `available` 필드와 강제 캐스팅을 모두 제거해 계약을 타입 레벨에서 자연스럽게 보장할 수 있다. (선택 사항 — 시급하지 않음.)

- **[INFO]** `$sourceItem.` / `$dataSource.` 두 엔트리 간 잔여 중복
  - 위치: `NESTED_DRILL_SOURCES` 세 번째·네 번째 엔트리
  - 상세: 두 엔트리의 `getSample`/`available` 람다가 prefix 를 제외하고 완전히 동일하다. 이번 리팩터의 목적이 중복 제거였던 만큼, 남아 있는 이 작은 중복은 대칭성이 있어 문제라 보긴 어렵지만 완전히 사라진 것은 아니다.
  - 제안: 필요하면 `const sourceItemGetSample = (d: ExpressionData) => d.sourceItemSample as Record<string, unknown>;` 같은 공유 헬퍼로 뽑아 "동일 소스" 라는 의도를 더 명시적으로 드러낼 수 있다. 우선순위는 낮음.

- **[INFO]** 새 테이블이 기존 상수 테이블 관례(`expression-constants.ts`)와 다른 위치에 정의됨
  - 위치: `NESTED_DRILL_SOURCES` 정의부 (같은 파일, `buildNestedSuggestions` 바로 아래)
  - 상세: 같은 파일이 import 하는 `ROOT_VARIABLES`/`NODE_ACCESSORS`/`TABLE_CONTEXT_VARIABLES` 는 `expression-constants.ts` 에 정의된 순수 데이터 테이블인 반면, `NESTED_DRILL_SOURCES` 는 `ExpressionData` 를 받는 접근자 함수(`getSample`/`getSchema`/`available`)를 담고 있어 훅 파일 로컬에 둔 것으로 보인다. `ExpressionData` 타입이 `use-expression-context` 에서 오므로 별도 constants 파일로 옮기면 import 방향이 꼬일 수 있어 현재 위치는 합리적인 선택이다.
  - 제안: 별도 조치 불필요 — 다만 이 파일에 유사한 함수형 테이블이 더 늘어난다면 "함수형 테이블 vs 순수 데이터 테이블" 분리 기준을 컨벤션 문서에 짧게 남겨두는 것도 고려할 수 있다.

## 요약

`$input.`/`$params.`/`$sourceItem.`/`$dataSource.` 4개의 거의 동일한 if-블록(`buildNestedSuggestions(sample, prefix, schema)` 패턴 반복)을 `NESTED_DRILL_SOURCES` 데이터 테이블 + 단일 `for` 루프로 통합한 전형적인 behavior-preserving DRY 리팩터다. 각 엔트리에 목적을 설명하는 주석이 충분히 달려 있고(특히 `$params.`/`$sourceItem.` 가드의 유래를 명시), `available` 게이트로 기존 fall-through 동작(`$sourceItem`/`$dataSource` 미가용 시 루트 변수 목록으로 폴백)을 정확히 보존했다. 순환 복잡도와 코드 라인 수 모두 감소했고 네이밍·타입 어노테이션(`ReadonlyArray`)도 코드베이스의 기존 함수형 테이블 관례(ROOT_VARIABLES 등)와 결이 맞는다. 유일하게 지적할 만한 부분은 `available`/`getSample` 간 optional 여부 계약이 타입으로 강제되지 않고 주석에만 의존한다는 점(WARNING)이며, 이는 즉각적인 버그가 아니라 향후 확장 시의 잠재 함정에 가깝다. plan 문서(`plan/in-progress/suggestions-prefix-dry.md`)도 설계·테스트·워크플로가 명확히 구조화돼 있어 추적성 문제는 없다.

## 위험도
LOW
