# API 계약(API Contract) 리뷰

## 발견사항

해당 없음. 변경 전체가 내부 아키텍처 리팩터링(forwardRef 순환 제거)이며, 공개 API 계약은 불변이다.

구체적으로 검토한 8개 관점별 결과:

1. **하위 호환성**: `ModelConfigController` 에서 제거된 3개 엔드포인트(`POST preview-models`, `POST :id/test`, `GET :id/models`)는 `LlmModelConfigController` 로 verbatim 이전됐다. 라우트 프리픽스 `model-configs` 유지가 테스트(`Reflect.getMetadata('path', LlmModelConfigController) === 'model-configs'`)로 회귀 방지된다. Breaking change 없음.

2. **버전 관리**: 변경 전후 모두 버전 prefix 없음. 일관성 유지.

3. **응답 형식**: `ApiOkWrappedResponse(ModelListDto)`, `ApiOkWrappedResponse(ModelTestConnectionResultDto)` — 응답 래퍼·DTO 불변.

4. **에러 응답**: `@ApiBadRequestResponse`, `@ApiForbiddenResponse`, `@ApiNotFoundResponse` 데코레이터 및 HTTP 상태 코드 동일하게 이전됨.

5. **요청 검증**: `ParseUUIDPipe`, `@Body() dto: PreviewModelListDto`, `@Query('type') type?: 'chat' | 'embedding'` — 검증 로직 verbatim 보존.

6. **URL/경로 설계**: 3개 엔드포인트 경로 모두 불변. RESTful 규칙 유지.

7. **페이지네이션**: 해당 엔드포인트들은 페이지네이션 미적용 엔드포인트이며 변경 없음. 목록 API(`GET model-configs`)의 페이지네이션은 `ModelConfigController` 에 그대로 잔류.

8. **인증/인가**: `@ApiBearerAuth('access-token')` 클래스 레벨 유지. `preview-models` 의 `@Roles('editor')` 보존이 메타데이터 테스트로 검증된다. `testConnection`·`listModels` 의 무(無) Roles 데코레이터도 이전 동작과 동일.

## 요약

이번 변경은 `model-config ↔ llm` 모듈 간 forwardRef 순환을 끊기 위한 순수 내부 아키텍처 리팩터링으로, 공개 API 계약(라우트·HTTP 메서드·요청/응답 스키마·상태 코드·인증·인가·스로틀 설정)은 완전히 보존된다. 신규 `LlmModelConfigController` 는 `@Controller('model-configs')` 프리픽스를 명시적으로 유지하며, 이는 단위 테스트(Reflect 메타데이터 검증)로 회귀 방지가 이루어진다. API 계약 관점에서 문제 없음.

## 위험도

NONE
