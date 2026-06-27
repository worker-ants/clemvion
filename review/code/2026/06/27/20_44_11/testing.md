# Testing Review

## 발견사항

### [INFO] `wrapItemsSchema` 단언 추가 — 4헬퍼 일관성 달성
- 위치: `api-wrapped.spec.ts` L35-36 (diff)
- 상세: `wrapDataSchema`, `wrapOneOfDataSchema`, `wrapPaginatedSchema` 테스트는 이미 `schema.type`·`schema.required` 를 단언했으나 `wrapItemsSchema` 만 누락돼 있었다. 이번 diff 가 두 단언을 추가해 4헬퍼 테스트가 동일한 단언 패턴으로 통일됐다. 순수 개선이며 회귀를 방지한다.

### [INFO] `PaginationMeta` ↔ `wrapPaginatedSchema` 리터럴 계약 — 자동화 없음
- 위치: `api-wrapped.ts` `wrapPaginatedSchema` 내 `pagination` 리터럴 / `common/dto/paginated-response.dto.ts` `PaginationMeta`
- 상세: `wrapPaginatedSchema` 의 `pagination` 서브스키마(`page·limit·totalItems·totalPages`)는 `PaginationMeta` 클래스 필드와 수동 동기화된다. 이번 diff 의 JSDoc NOTE 가 명시적으로 이를 문서화하나, `PaginationMeta` 에 필드가 추가/변경될 경우 `api-wrapped.spec.ts` 의 `wrapPaginatedSchema` 테스트(`wrapPaginatedSchema matches PaginatedResponseDto shape`)는 하드코딩된 기대값을 검사하므로 **구현 코드가 DTO 와 불일치해도 테스트가 통과** 한다(테스트가 DTO 를 동적 참조하지 않기 때문). 현재 필드 4개는 일치하므로 즉각적 리스크는 없으나, 향후 드리프트 탐지 수단이 없다.
- 제안(선택): `PaginationMeta` 의 실제 `@ApiProperty` 필드 목록을 reflect-metadata 등으로 읽어 `wrapPaginatedSchema` 의 `required` 배열과 대조하는 테스트 케이스를 1개 추가하면 드리프트를 자동으로 잡을 수 있다. 단, 이는 `wrapPaginatedSchema` 설계(DTO 독립 리터럴)와 트레이드오프가 있으므로 INFO 수준.

### [INFO] 데코레이터 조합 함수 6개 — 테스트 없음 (기존 갭)
- 위치: `api-wrapped.ts` `ApiOkWrappedResponse`, `ApiCreatedWrappedResponse`, `ApiAcceptedWrappedResponse`, `ApiOkWrappedArrayResponse`, `ApiOkPaginatedResponse`, `ApiOkWrappedOneOfResponse`
- 상세: 6개의 NestJS 데코레이터 조합 함수는 `applyDecorators` + `ApiExtraModels` + 스키마 헬퍼 호출을 합성한다. 현재 스펙 파일에 이들에 대한 테스트가 없다. 스키마 빌더 자체는 잘 테스트되므로 실질 리스크는 작으나, `ApiExtraModels` 누락이나 `spread` 옵션 처리 버그를 잡는 단위 테스트가 없다. 이번 diff 가 새로 도입한 갭이 아닌 기존 상태.
- 제안(선택): 데코레이터 조합 특성상 NestJS 테스트 모듈 없이는 실제 동작 검증이 어렵다. 최소한 `ApiOkWrappedOneOfResponse` 의 `discriminator` 전달 경로는 `wrapOneOfDataSchema` 호출을 spy 하는 방식으로 단위 테스트 가능.

## 요약

이번 변경의 테스트 관련 핵심은 `api-wrapped.spec.ts` 의 `wrapItemsSchema` 테스트에 `schema.type`·`schema.required` 단언 2개를 추가해 4개 헬퍼 테스트의 단언 일관성을 완성한 것이다. 변경 자체는 올바르고 회귀 방지 효과가 있다. `api-wrapped.ts` 의 JSDoc NOTE 추가(수동 동기화 경고)는 코드 변경이 없으므로 테스트 영향 없음. 기존 갭으로는 (1) `PaginationMeta` ↔ 리터럴 자동 계약 검사 없음, (2) 데코레이터 조합 함수 6개 미테스트가 남아 있으나, 두 항목 모두 이번 diff 가 새로 도입한 갭이 아니며 순수 함수 헬퍼의 테스트 커버리지는 견고하다.

## 위험도

LOW
