# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** Swagger 스키마 버그 수정 — double-wrap → single-wrap 정합
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/common/swagger/api-wrapped.ts` `wrapPaginatedSchema` (구 85–117행)
  - 상세: 수정 전 Swagger 스키마는 `{ data: { data: <ref>[], pagination: {...} } }` (double-wrap) 를 선언했으나 실제 wire shape 는 `{ data: <ref>[], pagination: {...} }` (single-wrap) 이었다. `PaginatedResponseDto.create()` 가 `{ data, pagination }` 두 top-level 키를 반환하고 `TransformInterceptor` 가 `'data' in obj` 조건에 의해 pass-through 하므로, Swagger 문서가 런타임과 불일치하는 문서 버그였다. 이번 변경은 문서를 실제 계약에 맞게 정정한 것이다.
  - 제안: 정정 방향 올바름. 추가 조치 불필요.

- **[INFO]** OpenAPI spec 소비자 (SDK codegen) 영향 가능성
  - 위치: `/Volumes/project/private/clemvion/spec/conventions/swagger.md` §5-2 테이블
  - 상세: Swagger/OpenAPI spec 을 기반으로 클라이언트 SDK 를 자동 생성한 경우, 이전 double-wrap spec 으로 생성된 코드는 `response.data.data` / `response.data.pagination` 접근 경로를 사용했을 것이다. 수정 후 spec 은 `response.data` (배열) / `response.pagination` top-level 접근을 문서화한다. 그러나 plan 메모에서 확인되듯 15개 사용처 전원이 `PaginatedResponseDto.create()` 반환 → 실제 wire 는 항상 single-wrap이었으므로, 실동작 기준으로는 이미 single-wrap 접근이 정답이었다. SDK codegen 사용 여부를 확인해 재생성 필요 여부 점검 권장.
  - 제안: frontend 에서 Swagger codegen 을 사용하는 경우 spec 갱신 후 SDK 재생성. 현재 plan 메모가 "frontend 무영향(doc/schema-only)" 으로 확인했으므로 즉시 조치 불필요.

- **[INFO]** 페이지네이션 스키마 — `totalCount` / `hasNextPage` 미포함
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/common/swagger/api-wrapped.ts` `wrapPaginatedSchema` pagination 프로퍼티
  - 상세: 현재 문서화된 pagination 필드는 `page`, `limit`, `totalItems`, `totalPages` 4개다. cursor 기반 페이지네이션이나 `hasNextPage` bool 필드는 포함되지 않는다. 이는 기존 `PaginatedResponseDto` 의 실제 shape 와 일치하므로 이번 변경이 신규로 도입한 문제는 아니다. 단, 향후 페이지네이션 응답 필드 추가 시 헬퍼와 spec 을 함께 갱신해야 한다.
  - 제안: 현 변경 범위에서 조치 불필요. 메모 수준 확인 사항.

## 요약

이번 변경은 신규 API 엔드포인트·라우팅·인증 추가가 없으며, 순수 OpenAPI 메타데이터 (Swagger 스키마 선언) 정합 수정이다. `wrapPaginatedSchema` 가 런타임 wire shape 와 불일치하는 double-wrap 스키마를 선언하던 문서 버그를 single-wrap 으로 교정했고, 테스트(`api-wrapped.spec.ts`) 및 spec(`swagger.md §5-2`) 도 동반 갱신되었다. 하위 호환성 관점에서 실제 API 동작(wire)은 변경 전후 동일하며, 변경 전 Swagger 스키마가 오히려 계약 위반 상태였으므로 이번 수정이 계약 정합성을 향상시킨다. SDK codegen 사용처가 있다면 재생성 여부 확인이 필요하나, plan 에서 frontend 무영향을 확인했으므로 차단 이슈는 없다.

## 위험도

LOW
