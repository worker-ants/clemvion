# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `wrapPaginatedSchema` pagination 리터럴 — 구조적 수동 동기화 의존성
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/common/swagger/api-wrapped.ts` L289-299 (`pagination` 서브스키마 객체)
  - 상세: `page`·`limit`·`totalItems`·`totalPages` 필드가 `PaginatedResponseDto`/`PaginationMeta` (`common/dto/paginated-response.dto.ts`)를 수동 복사한 리터럴로 하드코딩돼 있다. JSDoc NOTE가 이를 명시하고 있으나 NOTE는 코드 리뷰·onboarding 시 누락되면 drift가 누적된다. DTO 필드 추가/변경 시 이 리터럴이 자동으로 깨지거나 경고를 주지 않는다.
  - 제안: 이상적으로는 NestJS Swagger의 `getSchemaPath(PaginationMeta)` 또는 `@nestjs/swagger`의 `SchemaFactory.createForClass(PaginationMeta)`로 DTO에서 스키마를 파생해 수동 동기화 의존성을 제거. 단기적으로는 `pagination` 리터럴의 필드명·타입을 검증하는 별도 unit test가 유실 방지책이 된다.

- **[INFO]** `wrapOneOfDataSchema` 테스트 케이스의 `type`/`required` 단언 불완전 통일
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/common/swagger/api-wrapped.spec.ts` L99-129
  - 상세: 이번 변경으로 `wrapItemsSchema` 테스트에 `schema.type`·`schema.required` 단언이 추가돼 4헬퍼 일관성이 개선됐다. 그러나 `wrapOneOfDataSchema`의 케이스 중 "accepts a single DTO" (L99-104)·"attaches discriminator" (L110-120)·"omits discriminator by default" (L122-129) 테스트는 외곽 래퍼의 `type`/`required` 단언이 없다. `wrapOneOfDataSchema`의 첫 케이스(L88-97)는 단언이 있어 케이스 간 불일치가 남는다.
  - 제안: `wrapOneOfDataSchema`의 나머지 케이스에도 `expect(schema.type).toBe('object')` + `expect(schema.required).toEqual(['data'])` 단언을 추가하거나, 외곽 래퍼 검증은 첫 케이스 한 곳에서만 하되 나머지는 "wraps data in object" 공통 헬퍼로 추출해 반복을 줄임.

- **[INFO]** `wrapPaginatedSchema` Swagger example 값 하드코딩
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/common/swagger/api-wrapped.ts` L293-296 (`example: 1`, `example: 20`, `example: 123`, `example: 7`)
  - 상세: 런타임 로직이 아닌 Swagger 문서 예시값이라 심각도는 낮다. 단, `limit: 20`은 §4.1 기본값·`PaginationQueryDto` 기본값과 세 곳에 분산돼 있어, 기본 page size 정책 변경 시 추가 수동 갱신이 필요하다.
  - 제안: 허용 가능한 수준이나, 상수(`DEFAULT_PAGE_LIMIT = 20`)를 공유 constants 파일에서 import하면 동기화 지점을 줄일 수 있다.

- **[INFO]** spec 추가 blockquote 줄 길이
  - 위치: `/Volumes/project/private/clemvion/spec/5-system/2-api-convention.md` L656 (추가된 `>` 단락)
  - 상세: 단일 줄에 많은 정보(이유·대비·상세 링크)가 집약돼 있어 빠른 독해에 약간의 부담이 있다. 내용 자체는 정확하고 cross-reference 링크가 포함돼 유지보수에 도움이 된다.
  - 제안: 필요 시 이유·링크를 각각 별도 문장으로 분리하면 가독성이 높아지나, 현재 수준도 허용 범위다.

## 요약

이번 변경은 전반적으로 유지보수성을 개선하는 방향이다. `wrapItemsSchema` 테스트에 `type`/`required` 단언을 추가해 4개 헬퍼 테스트의 패턴 일관성을 높였고, `wrapPaginatedSchema` JSDoc에 수동 동기화 경고 NOTE를 명시해 신규 기여자에게 위험을 알린다. 주요 유지보수 리스크는 `wrapPaginatedSchema`의 `pagination` 리터럴이 `PaginatedResponseDto`와 구조적 결합 없이 수동으로 유지돼야 한다는 점이며, NOTE는 인식론적 완화에 그쳐 DTO 변경 시 리터럴이 자동으로 깨지지 않는다. `wrapOneOfDataSchema` 테스트 케이스 간 단언 불일치는 향후 리팩터 시 부분적 검증 누락의 씨앗이 될 수 있다. 전체적으로 코드는 짧고 단일 책임을 유지하며 기존 패턴을 일관되게 따른다.

## 위험도

LOW
