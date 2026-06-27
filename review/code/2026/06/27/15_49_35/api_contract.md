# API 계약 리뷰 결과

리뷰 대상: `GET /api/model-configs/:id/models` — `type` 쿼리 런타임 검증 hardening
분석 파일: `CHANGELOG.md`, `llm-model-config.controller.ts`, `workspace-rbac.e2e-spec.ts`

---

## 발견사항

### [WARNING] ParseEnumPipe 400 응답 body 형식이 프로젝트 표준 에러 엔벌로프와 불일치 가능성

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-endpoint-hardening-dca699/codebase/backend/src/modules/llm/llm-model-config.controller.ts` L478 (`@Query('type', new ParseEnumPipe(...))`)
- 상세: NestJS `ParseEnumPipe` 가 검증 실패 시 던지는 기본 `BadRequestException` 형식은 `{ message: "Validation failed (enum string is expected)", error: "Bad Request", statusCode: 400 }` 이다. 프로젝트 표준 에러 응답은 CHANGELOG 전반에서 `{ error: { code: "...", message: "..." } }` 구조를 사용한다(예: `VALIDATION_ERROR`, `OWNER_REQUIRED`, `SOLE_OWNER_CANNOT_LEAVE` 등). 프로젝트에 공통 HTTP Exception Filter 가 있다면 변환될 수 있으나, 제공된 코드에서 이를 확인할 수 없다. 추가로 e2e 테스트(`workspace-rbac.e2e-spec.ts` L510)가 `status === 400` 만 검증하고 응답 body 구조는 검증하지 않아 불일치가 회귀로 숨겨질 수 있다.
- 제안: (a) 글로벌 Exception Filter 가 `BadRequestException` 을 표준 `{ error: { code, message } }` 로 변환하는지 확인한다. 변환된다면 `error.code` 값이 무엇인지(`VALIDATION_FAILED` 등) 특정하고 `@ApiBadRequestResponse` 에 `type` 필드로 스키마를 지정한다. (b) e2e 테스트에 `invalidType.body.error.code` 단언을 추가해 format regression 을 탐지한다.

### [INFO] `@ApiBadRequestResponse` 에 응답 body 스키마 미지정

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-endpoint-hardening-dca699/codebase/backend/src/modules/llm/llm-model-config.controller.ts` L472-L474
- 상세: `@ApiBadRequestResponse({ description: '유효하지 않은 type 파라미터 (허용값: chat | embedding)' })` 가 추가됐으나 `type` 필드(DTO 클래스 참조)가 없어 Swagger UI 에서 클라이언트가 실제 400 응답 body 형식을 확인할 수 없다. 다른 엔드포인트의 성공 응답은 `@ApiOkWrappedResponse(ModelListDto, ...)` 처럼 DTO 타입이 지정되어 있다.
- 제안: 프로젝트 표준 에러 응답 DTO(예: `ErrorResponseDto`)가 있다면 `@ApiBadRequestResponse({ type: ErrorResponseDto, description: '...' })` 형식으로 통일한다. 없다면 신규 생성하거나 inline schema 를 지정한다.

### [INFO] `type` 파라미터 대소문자 구분(case-sensitive) 동작 미문서화

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-endpoint-hardening-dca699/codebase/backend/src/modules/llm/llm-model-config.controller.ts` L478, `CHANGELOG.md` L41
- 상세: `ParseEnumPipe` 기본 동작은 case-sensitive 비교다. `Chat`, `CHAT`, `Embedding` 등은 모두 400 을 받는다. CHANGELOG 와 `@ApiQuery` description 에 이 동작이 명시되지 않았다. 특히 REST 클라이언트나 OpenAPI codegen 을 사용하는 소비자가 대소문자를 다르게 보낼 경우 예기치 않은 400 이 발생한다.
- 제안: `@ApiQuery` description 에 "대소문자 구분(`chat`, `embedding` 소문자만 허용)" 을 명기하거나, NestJS v9+ 의 `ParseEnumPipe` 옵션(`{ enumName, optional, exceptionFactory }`) 을 사용해 더 친절한 에러 메시지를 제공한다. CHANGELOG 항목에도 한 줄 추기하면 충분하다.

---

## 긍정 관찰 (이슈 아님)

- **하위 호환성(스펙 준수 클라이언트)**: `@ApiQuery` 가 이미 `enum: ['chat', 'embedding']` 을 선언하고 있었으므로 스펙을 따르던 클라이언트는 영향을 받지 않는다. 이 변경은 "문서 약속 → 런타임 강제" 의 적절한 hardening 이다.
- **단일 소스 설계**: `MODEL_TYPE_ENUM` 상수 하나에서 `ParseEnumPipe` 인자, `@ApiQuery` `enum`, `ModelTypeFilter` 타입이 모두 파생된다. Swagger 와 런타임 검증 불일치 위험이 구조적으로 제거됐다.
- **CHANGELOG 문서화**: breaking impact 범위(스펙 준수 클라이언트 무영향, 문서 외 값 호출자만 400)를 정확히 서술하고 있다.
- **스로틀 상수화**: `PROVIDER_PROBE_THROTTLE` 로 3개 핸들러의 스로틀 정책을 단일 소스로 관리한다. API 계약 변경 없이 유지보수성을 높인 리팩터링이다.
- **`@Roles` 미적용 의도 명문화**: `GET /:id/models` 의 Viewer+ 허용이 코드 주석으로 명시되어 있어 실수로 `@Roles` 를 추가하는 회귀를 억제한다.

---

## 요약

이번 변경의 핵심은 `GET /api/model-configs/:id/models` 의 `type` 쿼리 파라미터에 `ParseEnumPipe` 를 적용해 Swagger 스펙에 이미 선언된 enum 제약을 런타임에도 강제한 것이다. 스펙 준수 클라이언트에 대한 breaking change 는 없으며, 설계(단일 소스 `MODEL_TYPE_ENUM`) 와 문서화(CHANGELOG, `@ApiBadRequestResponse` 추가) 모두 적절하다. 다만 `ParseEnumPipe` 기본 400 응답 body 형식이 프로젝트 표준 에러 엔벌로프와 일치하는지 글로벌 Exception Filter 레벨에서 검증이 필요하며, e2e 테스트가 body 형식을 확인하지 않아 잠재적 불일치가 회귀로 숨겨질 수 있다는 점이 개선 포인트다. `@ApiBadRequestResponse` 의 스키마 미지정과 대소문자 구분 미문서화는 참고 수준이다.

---

## 위험도

LOW
