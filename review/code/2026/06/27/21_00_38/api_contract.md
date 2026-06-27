# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `wrapPaginatedSchema` drift-guard 테스트는 키 이름 드리프트만 감지하며 타입 드리프트는 감지하지 못함
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.spec.ts` — 신규 테스트 `wrapPaginatedSchema pagination keys stay in sync with PaginatedResponseDto runtime shape`
  - 상세: 테스트는 `Object.keys(pagination.properties).sort()` ↔ `Object.keys(PaginatedResponseDto.create(...).pagination).sort()` 를 비교해 필드명 드리프트를 잡는다. 그러나 `PaginationMeta` 필드의 타입이 `integer` → `string` 으로 바뀌어도 이 테스트는 통과한다. 즉 Swagger 스키마가 타입 오정보를 노출하는 드리프트는 테스트로 포착되지 않는다. 이는 pre-existing 설계 상충이며 본 PR 이 도입한 것이 아니다.
  - 제안: 중장기적으로는 `SchemaFactory.createForClass(PaginationMeta)` 또는 `getSchemaPath(PaginationMeta)` 로 DTO 에서 스키마를 파생해 타입 드리프트도 원천 차단. 단기적으로는 현 드리프트 테스트가 키 수준 안전망으로 충분히 유효하다.

## 요약

변경 대상 파일(`api-wrapped.ts`, `api-wrapped.spec.ts`)은 OpenAPI/Swagger 응답 스키마 빌더에 해당하여 API 계약 관련 코드에 포함된다. 그러나 실제 변경 내용은 (1) `api-wrapped.ts` 의 JSDoc NOTE 추가(런타임 함수 로직·스키마 출력 무변경)와 (2) `api-wrapped.spec.ts` 의 테스트 단언 강화에 한정된다. 기존 API 엔드포인트, 응답 스키마 구조, HTTP 상태 코드, 인증/인가, URL/경로, 페이지네이션 스키마 출력값은 전혀 변경되지 않았다. 신규 drift-guard 테스트는 `wrapPaginatedSchema` Swagger 스키마와 `PaginatedResponseDto` 런타임 키를 비교해 API 계약 정합성을 능동적으로 보호하므로 계약 관점에서 긍정적 개선이다. INFO 1건은 타입 레벨 드리프트가 여전히 감지되지 않는다는 pre-existing 설계 한계를 지적하며, 차단 사항이 아니다.

## 위험도

NONE
