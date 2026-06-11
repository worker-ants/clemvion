# API 계약(API Contract) 리뷰 결과

## 발견사항

- **[INFO]** `kind` 파라미터의 유효성 검증 분리 설계 적절성 확인
  - 위치: `list-model-configs-query.dto.ts` L54-56, `model-config.controller.ts` L517-524
  - 상세: `kind` 값의 포맷 검증(`@IsString`)은 DTO에서, 의미 검증(허용 값 목록)은 `parseKind` 헬퍼에서 이중 레이어로 처리한다. 에러 코드 `MODEL_CONFIG_INVALID`를 보존하기 위해 `@IsIn`을 사용하지 않는 설계는 의도적이며 주석에 명시되어 있다. HTTP 400 응답과 에러 코드의 일관성이 유지된다.

- **[INFO]** `kind` 없이 요청 시 에러 응답 경로 확인
  - 위치: `model-config.controller.ts` L517-524, `parseKind` 함수
  - 상세: `kind`가 `undefined`이거나 허용 목록에 없을 때 `BadRequestException({ code: 'MODEL_CONFIG_INVALID', message: ... })`로 400을 반환한다. 기존 `@Query('kind') kind: string` 방식과 에러 경로가 동일하게 유지되므로 breaking change 없음.

- **[INFO]** `limit: 9999 → 100` 변경의 하위 호환성
  - 위치: `codebase/frontend/src/lib/api/model-configs.ts` L726
  - 상세: 이전 `limit: 9999`는 백엔드 `@Max(100)` 제약 위반으로 400(VALIDATION_ERROR)을 반환했다. 변경 후 `limit: 100`은 서버 제약 내 값으로, 기존 동작이 실제로 깨져 있었다(버그 수정). 클라이언트 관점에서 이전에 9999가 동작 중이었다면 breaking change이나, 서버 `@Max(100)` 제약이 이미 존재했으므로 실질적으로 9999는 항상 400을 반환했다. 수정이 올바르다.

- **[INFO]** `findAll` 시그니처 변경에 따른 하위 호환성
  - 위치: `model-config.controller.ts` L546-555
  - 상세: `@Query('kind') kind: string, @Query() query: PaginationQueryDto` 두 파라미터가 `@Query() query: ListModelConfigsQueryDto` 단일 파라미터로 통합됐다. 이는 내부 메서드 시그니처 변경이며, HTTP API의 요청/응답 형식(URL, 쿼리 파라미터, 응답 스키마)에는 영향 없다. 외부 클라이언트 계약 유지됨.

- **[INFO]** Swagger 문서 단일 소스 정책 확인
  - 위치: `list-model-configs-query.dto.ts` L51-52, `model-config.controller.ts` L543
  - 상세: `kind`의 Swagger 문서는 컨트롤러의 `@ApiQuery({ name: 'kind', enum: MODEL_CONFIG_KINDS, required: true })`가 단일 소스이며, DTO에 `@ApiProperty` 중복 선언 없음. 문서 일관성 적절.

- **[INFO]** `getAll` 헬퍼의 `search` 파라미터 화이트리스트 누락 가능성 (범위 외)
  - 위치: `codebase/frontend/src/lib/api/model-configs.ts` L794
  - 상세: `getAll` 메서드에서 `params.search`를 전달하나, `ListModelConfigsQueryDto`는 `PaginationQueryDto`를 상속하므로 `search`는 이미 화이트리스트에 있다(`PaginationQueryDto.search`). 문제 없음.

## 요약

이번 변경은 `GET /model-configs` 엔드포인트에서 `kind` 쿼리 파라미터가 NestJS `forbidNonWhitelisted` ValidationPipe에 의해 거부되던 버그를 수정한다. 전용 `ListModelConfigsQueryDto`를 도입해 `kind`를 화이트리스트에 등록하고, `@IsIn` 대신 `parseKind` 헬퍼로 의미 검증을 위임하는 설계는 에러 코드 `MODEL_CONFIG_INVALID` 계약을 보존한다. HTTP API의 외부 계약(URL, 파라미터, 응답 스키마, 에러 형식)에는 breaking change 없으며, 클라이언트 측 `limit: 9999 → 100` 수정은 서버의 기존 `@Max(100)` 제약을 준수하는 버그 수정이다. 요청 검증, 에러 응답 형식, 인증/인가, 페이지네이션 모두 기존 계약을 유지한다.

## 위험도

NONE
