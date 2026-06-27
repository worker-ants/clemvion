# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** Swagger 스키마 버그 수정 확인 — double-wrap → single-wrap 정합 완료
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.ts` `wrapPaginatedSchema`
  - 상세: `wrapPaginatedSchema` 가 `{ data: <ref>[], pagination: { page, limit, totalItems, totalPages } }` (single-wrap) 를 정확히 선언한다. 이전 double-wrap(`{ data: { data: <ref>[], pagination } }`) 은 런타임 wire shape(`PaginatedResponseDto.create()` + `TransformInterceptor` pass-through) 와 불일치하는 문서 버그였으며 이번 수정으로 계약 정합성이 회복되었다. `ApiOkPaginatedResponse` 15개 사용처 전부 `PaginatedResponseDto.create()` 반환임이 확인되어 하위 호환성 문제 없음.

- **[INFO]** 테스트 단언 강화 확인 (resolution INFO 1·2 반영)
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.spec.ts` `wrapPaginatedSchema` 테스트
  - 상세: `expect(schema.type).toBe('object')` 추가 및 `pagination` 서브스키마 deep-equal 단언(`type`, `required`, 각 필드 `example` 포함)이 반영되어 API 계약 불일치 회귀를 단위 테스트 수준에서 조기 탐지 가능해졌다.

- **[INFO]** OpenAPI spec 소비자 (SDK codegen) 영향 — 비차단
  - 위치: `spec/conventions/swagger.md §5-2`, `§2-5`, `## Rationale`
  - 상세: spec 이 single-wrap 으로 정정되었다. 이전 double-wrap spec 기반 SDK codegen 이 존재했다면 `response.data.data` 접근 경로가 깨질 수 있으나, 실 wire 는 항상 single-wrap 이었으므로 실동작 기준으로는 single-wrap 접근이 이미 정답이었다. plan 확인에 따르면 frontend 무영향. SDK codegen 사용처가 없으므로 즉시 조치 불필요.

- **[INFO]** 페이지네이션 스키마 필드 범위 — 현행 DTO 일치, 향후 주의
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.ts` `wrapPaginatedSchema` pagination 프로퍼티
  - 상세: 문서화 필드는 `page`, `limit`, `totalItems`, `totalPages` 4개로 `PaginatedResponseDto` 실제 shape 와 일치한다. cursor 기반 페이지네이션이나 `hasNextPage` 미포함은 이번 변경이 신규 도입한 문제가 아니다. 향후 pagination 필드 추가 시 헬퍼·spec 동반 갱신 필요(§5 Rationale 에 언급됨).

## 요약

이번 변경은 순수 OpenAPI 메타데이터 정합 수정으로 신규 API 엔드포인트·라우팅·인증 추가가 없다. `wrapPaginatedSchema` 의 double-wrap 문서 버그를 single-wrap 으로 교정하여 런타임 wire shape 와 Swagger 스키마 간 계약 불일치를 해소했다. 실제 API 동작(wire)은 변경 전후 byte-identical 이므로 기존 클라이언트에 breaking change 가 없다. resolution 으로 반영된 INFO 1·2(테스트 단언 강화) 와 spec 갱신(§2-5 pass-through 예외 명시, §5-2 단순화, Rationale 신설)이 재발 방지 계약 문서화까지 완성했다. Critical·Warning 발견 없음.

## 위험도

LOW

STATUS=success ISSUES=0
