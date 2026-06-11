# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] `testConnection` 응답 스키마에 `dimension` 필드 추가 — additive 변경
- 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts` (파일 4), `ModelTestConnectionResultDto`
- 상세: `dimension?: number` 필드가 선택적(`@ApiPropertyOptional`)으로 추가됐다. 기존 클라이언트는 이 필드를 무시할 수 있으므로 하위 호환성 파괴 없음. `success`, `latencyMs`, `message` 필드는 변경되지 않았다.
- 제안: 이상 없음. 선택적 필드 추가는 안전한 확장이다.

### [INFO] `testConnection` 내부 구현 경로 변경 — 외부 계약 형식은 유지
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` 251-276 라인 (diff)
- 상세: `LlmConfigService.findEntity` (kind=chat 고정) 에서 `ModelConfigService.findEntity` (kind 무관)로 조회 경로가 변경됐다. API 응답 스키마 자체는 그대로이며, embedding 설정에 대한 기존 `MODEL_CONFIG_NOT_FOUND` 오류를 수정하는 회귀 픽스다.
- 제안: 이상 없음.

### [INFO] `listModels` 내부 조회 경로 변경 — 외부 계약 형식은 유지
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` 290-293 라인 (diff)
- 상세: `listModels` 도 동일하게 `ModelConfigService.findEntity`로 전환. `LLM_MODEL_LIST_FAILED` 에러 코드·응답 형식·타임아웃(30s)은 변경 없다.
- 제안: 이상 없음.

### [INFO] 프론트엔드 `testMutation` — `mutationFn` 인자 타입 변경
- 위치: `codebase/frontend/src/components/models/model-config-manager.tsx` (파일 7), `testMutation`
- 상세: `mutationFn` 이 `(id: string)` 에서 `(config: ModelConfigData)` 로 변경됐다. API 엔드포인트 자체(POST `/model-configs/:id/test-connection`)는 그대로이며, 호출부(`onClick`)도 동시에 `config.id` → `config` 로 업데이트됐다. 외부 API 계약에는 영향 없음.
- 제안: 이상 없음.

### [INFO] 차원 자동 저장 — `PATCH /model-configs/:id` 호출 추가
- 위치: `codebase/frontend/src/components/models/model-config-manager.tsx` (파일 7), `onSuccess` 핸들러
- 상세: 연결 테스트 성공 후 embedding kind이고 `result.dimension`이 존재하면 `modelConfigsApi.update(config.id, { dimension: dim })` 을 자동 호출한다. 이 호출은 fire-and-forget 패턴으로 실패 시 무시(toast.error 없음). PATCH 페이로드가 `{ dimension: number }` 단일 필드라면 서버의 부분 업데이트 스키마가 이를 수용해야 하나, 현재 diff 에서 서버 측 `UpdateModelConfigDto` 는 변경이 없다. 기존 구현이 부분 PATCH를 지원한다고 가정하면 이상 없다.
- 제안: `UpdateModelConfigDto`가 `dimension` 단독 PATCH를 허용하는지 확인 권장. 현재 diff 범위 내에서는 문제 없음.

## 요약

이번 변경은 `testConnection` API 응답에 선택적 `dimension` 필드를 추가(additive)하고, 내부적으로 kind-agnostic 조회 경로로 전환해 embedding 설정에 대한 회귀를 수정한다. 모든 응답 형식 변경은 선택적 필드 추가에 해당하므로 기존 API 클라이언트와 하위 호환성을 유지한다. 에러 코드(`LLM_CONFIG_NOT_FOUND`, `LLM_MODEL_LIST_FAILED`, `LLM_STREAMING_UNSUPPORTED`)·HTTP 상태 코드·URL 경로·인증 방식·페이지네이션은 변경되지 않았다. 프론트엔드의 자동 차원 저장은 기존 `PATCH /model-configs/:id` 엔드포인트를 재사용하므로 추가 API 계약 변경 없음.

## 위험도

NONE
