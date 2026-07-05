# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 응답 필드는 스키마 변경 없이 값 채움만 확장된 순수 additive 변경
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` L317-334, `codebase/backend/src/modules/triggers/triggers.service.ts` L776-860
  - 상세: `TriggerDto.cronExpression`/`timezone`/`nextRunAt` 세 필드는 이미 `@ApiPropertyOptional`로 optional 선언되어 있었고 Swagger 스키마 자체는 변경되지 않았다(JSDoc 주석만 "단건 조회 시에만"→"목록·단건 조회 모두"로 정정). `findAll()`은 `type === 'schedule'`인 행에 대해서만 `Object.assign`으로 세 필드를 덧붙이며, `type !== 'schedule'`(webhook/manual) 행은 기존과 동일하게 필드가 `undefined`로 응답 JSON에서 생략된다. 기존 클라이언트가 이 optional 필드를 참조하지 않았다면 영향이 없고, 참조하던 프런트(`triggers/page.tsx`)는 이미 이 필드를 기대하고 있었으므로(목록 행에서 비어 있던 갭을 메우는 방향) 하위 호환성 문제가 없다.
  - 제안: 별도 조치 불요. 현행 유지.

- **[INFO]** 페이지네이션 봉투·엔드포인트·인증 계약 불변 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` L49-64
  - 상세: `GET /api/triggers`의 URL, `@ApiBearerAuth`, `@ApiOkPaginatedResponse(TriggerDto, ...)` 데코레이터, `PaginatedResponseDto.create(enriched, totalItems, page, limit)` 호출 시그니처가 모두 그대로다. 인가는 컨트롤러 레벨 가드(전역 workspace 스코프)로 기존과 동일하게 적용되며, 신규 enrichment 는 `WHERE ... AND workspaceId`로 스코프된 `scheduleRepository.find`를 사용해 cross-workspace 데이터 노출 위험이 없다(L838 `where: { triggerId: In(...), workspaceId }`).
  - 제안: 없음.

- **[INFO]** N+1 회피를 위한 배치 조회가 페이지 크기에 비례한 `IN` 절만 사용하며 목록 API 응답 시간/구조에 구조적 영향 없음
  - 위치: `triggers.service.ts` L832-841
  - 상세: 이 페이지의 schedule 트리거 id만 모아 단일 `find({ where: { triggerId: In(...) } })` 호출을 하므로 페이지당 최대 `limit`(기본 20)건 스코프. 응답 스키마·페이지네이션 메타(page/limit/totalItems)에는 영향 없음.
  - 제안: 없음.

## 요약

`GET /api/triggers` 목록 응답에 schedule 타입 트리거의 `cronExpression`/`timezone`/`nextRunAt`를 채워 반환하도록 한 변경으로, 해당 세 필드는 `TriggerDto`에 이미 optional로 선언되어 있던 필드값을 목록 조회 경로까지 확장 enrichment 한 것뿐이라 스키마·엔드포인트·페이지네이션 봉투·인증/인가·버전 관리 어느 관점에서도 breaking 요소가 없다. non-schedule 행은 종전과 동일하게 필드가 생략되고, workspace 스코프 필터도 유지되어 데이터 노출 범위 변경도 없다. Swagger JSDoc 주석 정정도 실제 동작과 일치하도록 갱신되어 문서-코드 정합성도 개선되었다.

## 위험도

NONE
