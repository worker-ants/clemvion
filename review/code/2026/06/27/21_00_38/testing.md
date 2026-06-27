# 테스트(Testing) Review

## 발견사항

- **[INFO]** drift-guard 테스트가 키 이름만 비교하고 타입·example 값은 검사하지 않음
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.spec.ts` — `'wrapPaginatedSchema pagination keys stay in sync with PaginatedResponseDto runtime shape'` 테스트 (L184–198)
  - 상세: 신규 drift-guard 테스트는 `Object.keys(pagination.properties).sort()` vs `runtimeKeys` 를 비교해 **필드 이름** 의 추가/삭제 drift 는 잡는다. 그러나 `PaginationMeta` 가 기존 필드의 타입(`type: 'integer'` → `'string'`)이나 `example` 값을 변경해도 이 테스트는 통과한다. 기존 `'wrapPaginatedSchema matches PaginatedResponseDto shape'` 테스트가 값까지 검사하므로 실질적 gap 은 제한적이나, 두 테스트의 보완 관계가 명시적이지 않아 향후 한 쪽만 보고 안전하다고 오판할 수 있다.
  - 제안: drift-guard 테스트 상단 주석에 "타입·example 값 검증은 `wrapPaginatedSchema matches PaginatedResponseDto shape` 테스트에 위임" 을 추가하거나, 필드별 `type` 속성도 비교하는 단언(`runtimeKeys.forEach(k => expect((pagination.properties[k] as any).type).toBe('integer'))`)을 추가 — 후자가 더 완전한 drift guard.

- **[INFO]** drift-guard 테스트의 unsafe type assertion — null 분기 시 Jest 오류 대신 TypeError 발생
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.spec.ts` L191–195
  - 상세: `wrapPaginatedSchema(SampleDto).properties?.pagination as { properties: Record<string, unknown>; required: string[] }` 캐스트 후 `pagination.properties` 와 `pagination.required` 를 직접 접근한다. `properties?.pagination` 이 `undefined` 인 경우(리그레션 시) TypeScript 런타임 수준에서 TypeError 가 발생하고 Jest 가 `assertion failed` 가 아닌 `TypeError: Cannot read properties of undefined` 를 보고해 실패 원인이 불명확해진다.
  - 제안: 캐스트 전 `expect(pagination).toBeDefined()` 단언을 추가해 실패 진단 품질을 높인다.

- **[INFO]** `PaginatedResponseDto.create([], 0, 1, 1)` 인자 의미 불명
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.spec.ts` L188–190
  - 상세: 네 번째 인자가 각각 data/totalItems/page/limit 임을 함수 시그니처를 보지 않으면 알 수 없다. `limit=1` 과 같이 의미 없는 최솟값으로 호출하는 이유도 불명확하다. 테스트 가독성 차원에서 주석 또는 변수명으로 의도를 드러낼 필요가 있다.
  - 제안: `PaginatedResponseDto.create(/* data */ [], /* totalItems */ 0, /* page */ 1, /* limit */ 1)` 처럼 인라인 주석을 달거나, 전용 상수(`const DUMMY_PAGE = 1, DUMMY_LIMIT = 1`)로 추출한다.

- **[INFO]** `wrapOneOfDataSchema` 보조 테스트 케이스의 envelope 단언 부재 — 기존 의도적 선택이나 패턴 불일치 잔존
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.spec.ts` L129–158 (`wrapOneOfDataSchema` 2·3·4번째 케이스)
  - 상세: 이번 변경으로 `wrapItemsSchema` 테스트에 `schema.type`·`schema.required` 단언이 추가되어 4헬퍼 중 3개(wrapData·wrapItems·wrapPaginated 1차)가 envelope 을 검증한다. `wrapOneOfDataSchema` 의 나머지 3 케이스(degenerate·discriminator·no-discriminator)는 behavior 검증에 집중하는 의도적 설계이며 RESOLUTION.md 에 명시돼 있다. 다만 코드를 처음 보는 독자는 일관성 결여로 오해할 수 있다.
  - 제안: 이미 RESOLUTION.md 에 근거가 기록돼 있으므로 추가 조치 필수는 아님. 원한다면 해당 테스트에 `// behavior-only: envelope assertion은 첫 케이스에 통합` 주석으로 의도를 명시.

- **[INFO]** 데코레이터 조합 함수(`ApiOkPaginatedResponse`, `ApiOkWrappedResponse` 등) 통합 테스트 부재
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.ts` L430–438 (`ApiOkPaginatedResponse`)
  - 상세: `wrapPaginatedSchema` 스키마 빌더는 단위 테스트로 완전히 커버되나, 이를 `ApiExtraModels + ApiOkResponse` 와 조합하는 데코레이터 팩토리(`ApiOkPaginatedResponse` 등)는 테스트가 없다. NestJS DI context 가 필요해 unit test 가 어렵다는 사정이 있으나, 최소한 `applyDecorators` 호출 여부·`ApiExtraModels` 인자 전달 여부는 mock 으로 검증 가능하다. 기존 갭이므로 본 diff 의 차단 이슈는 아니나, 중요도를 인식하고 별 트랙으로 남긴다.
  - 제안: 별도 태스크 — `applyDecorators` 와 `@nestjs/swagger` decorator 를 spy 로 대체해 `ApiOkPaginatedResponse(SampleDto)` 가 올바른 schema 를 전달하는지 검증하는 통합 단위 테스트 추가.

## 요약

이번 변경의 테스트 측면은 전반적으로 긍정적이다. `wrapItemsSchema` 테스트에 `type`/`required` 단언을 추가해 4 헬퍼 테스트 패턴 일관성을 완성했고, `PaginatedResponseDto.create()` 런타임 pagination 키와 스키마 리터럴 키를 동적으로 대조하는 drift-guard 테스트를 새로 추가해 `PaginationMeta` 필드 변경 시 자동 탐지 메커니즘을 마련했다. 테스트 격리·Mock 불필요성(순수 함수 반환값 직접 검사)은 모범적이다. 주요 잔여 갭은 (1) drift-guard 가 키 이름만 비교하고 타입·example 값은 검사하지 않는다는 점(기존 shape 테스트가 보완하나 명시적 연결 부재), (2) 타입 캐스트 전 `defined` 단언 미설치로 인한 실패 진단 품질 저하, (3) 데코레이터 조합 함수 통합 테스트 부재(기존 갭)이며, 모두 INFO 수준으로 차단 이슈는 없다.

## 위험도

LOW
