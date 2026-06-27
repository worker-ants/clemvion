## 발견사항

- **[INFO]** 컨트롤러 spec이 `@ApiOkWrappedArrayResponse(ModelInfoDto)` 데코레이터 적용 여부를 직접 검증하지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-modellistdto-fix/codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`
  - 상세: `llm-model-config.controller.spec.ts`는 `@Roles` 메타데이터를 `Reflect.getMetadata`로 검증하지만, `previewModels`·`listModels` 두 핸들러에 적용된 Swagger 스키마 메타데이터(즉, 이번 변경의 핵심인 `ApiOkResponse` schema가 `{ data: ModelInfoDto[] }` 형태인지)는 검증하지 않는다. 이 변경은 순수 OpenAPI 메타데이터 변경이므로 런타임 로직 경로가 없어 실제 회귀 위험은 낮다. TypeScript 빌드가 잘못된 타입 참조를 잡아주고, `wrapItemsSchema`는 `api-wrapped.spec.ts`에서 별도로 검증된다.
  - 제안: (선택적) `Reflect.getMetadata('swagger/apiResponse', LlmModelConfigController.prototype.previewModels)` 형태의 메타데이터 검증을 추가해 스키마 shape이 배열 래퍼(`{ data: array($ref) }`)임을 명시적으로 확인할 수 있다. 다만 NestJS Swagger 내부 메타데이터 키가 비공개 API이므로 유지 부담이 생길 수 있어 강제 사항은 아니다.

- **[INFO]** `ModelInfoDto` 필드(`name`, `type`)가 required로 변경됐지만 `class-validator` 검증 데코레이터가 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-modellistdto-fix/codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`
  - 상세: `ModelInfoDto`는 응답 DTO(Response DTO)로 `@IsString()` 등 `class-validator` 적용 대상이 아니다. 런타임 shape은 provider LLM 클라이언트 `listModels` 반환값이 결정하며, 해당 계층은 `llm.service.spec.ts`에서 `{ id, name, type }` 픽스처로 이미 검증된다(lines 646, 681–684). 따라서 이 DTO에 별도 단위 테스트가 없어도 커버리지 갭은 아니다.
  - 제안: 현행 유지 적절. 응답 DTO에는 class-validator 추가가 오히려 불필요한 오버헤드다.

- **[INFO]** `ModelListDto`·`ModelItemDto` 삭제에 대한 "삭제 안전성" 테스트가 빌드 검증에 의존
  - 위치: `plan/in-progress/mc-modellistdto-swagger-fix.md` 체크리스트
  - 상세: plan이 "빌드가 미사용 DTO 삭제 안전성 검증"이라고 명시하고 빌드 PASS를 체크했다. 실제로 `grep` 결과 `ModelListDto`·`ModelItemDto`를 참조하는 테스트 또는 런타임 코드가 없음을 확인. 빌드+타입 검사가 완전한 안전망으로 기능하므로 별도 삭제 추적 테스트는 불필요하다.
  - 제안: 현행 유지 적절.

## 요약

이번 변경은 Swagger 데코레이터 annotation 교체(`@ApiOkWrappedResponse(ModelListDto)` → `@ApiOkWrappedArrayResponse(ModelInfoDto)` ×2)와 DTO 리네이밍·필드 정합(ModelItemDto → ModelInfoDto) 뿐이며, 런타임 로직 경로가 전혀 추가·변경되지 않았다. 컨트롤러 spec은 양 핸들러의 위임 동작, `@Roles` 가드 메타데이터, 라우트 프리픽스를 검증하며 mock 픽스처가 이미 새 `{ id, name, type }` shape을 사용하고 있어 회귀 위험이 없다. `wrapItemsSchema`(`ApiOkWrappedArrayResponse`의 기반 함수)는 `api-wrapped.spec.ts`에서 독립적으로 검증되고, 서비스 계층 `listModels` 경로는 `llm.service.spec.ts`에서 충분히 커버된다. 발견된 사항은 모두 INFO 수준이며 차단 이슈가 없다.

## 위험도

LOW
