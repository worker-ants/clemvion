# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] GET :id/models / POST :id/test / POST preview-models — @ApiTooManyRequestsResponse 누락
- **위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — 3개 핸들러 모두
- **상세**: 세 핸들러 모두 `@Throttle(PROVIDER_PROBE_THROTTLE)` (분당 10회)가 적용되어 있으나, OpenAPI 데코레이터로 `@ApiTooManyRequestsResponse`가 선언되어 있지 않다. `workspaces.controller.ts` 의 초대 엔드포인트(`createInvitation`, `resendInvitation`)는 동일한 스로틀 정책과 함께 `@ApiTooManyRequestsResponse({ description: '요청 빈도 초과 (분당 10건)' })`가 명시되어 있어 컨트롤러 간 OpenAPI 문서화 비대칭이 발생한다.
- **제안**: 세 핸들러에 `@ApiTooManyRequestsResponse({ description: '요청 빈도 초과 (분당 10회)' })`를 추가해 Swagger 스키마에 429 응답을 노출한다. 기능 동작에는 영향이 없으나 API 클라이언트가 Swagger 문서로 rate-limit 정책을 인지할 수 없다.

### [INFO] capModelList — 클라이언트가 절단 여부를 관측할 수 없음 (의도된 설계)
- **위치**: `codebase/backend/src/modules/llm/list-models-cap.ts` + 두 서비스 적용 지점
- **상세**: 500건 초과 시 응답이 조용히 500개로 절단되며 클라이언트는 절단 여부를 응답에서 판별할 수 없다. 계획 문서(`mc-config-polish.md`)에 "truncated 플래그를 추가하면 `ModelInfo[]` → `{models,truncated}` 로 breaking change 가 되어 silent 캡으로 선회"라는 배경이 명시되어 있으므로, 이는 팀이 인지하고 수용한 설계 트레이드오프다. 정상 provider(수십 개)에서는 이 상한에 절대 닿지 않으며, 응답 계약 `ModelInfo[]`은 유지된다.
- **제안**: 현재 설계를 유지하되, 후속 별도 PR에서 `X-Truncated: true` 응답 헤더 방식(breaking 아님)을 검토할 수 있다. 현재 범위에서는 허용 가능.

### [INFO] ModelListDto Swagger 스키마와 실제 wire shape 불일치 (범위 외, 사전 인지)
- **위치**: `ModelListDto` — 이번 변경 대상 아님
- **상세**: 계획 문서에 "ModelListDto({models:[]}) Swagger 가 실제 wire shape(bare ModelInfo[])와 불일치 — 본 PR 범위 아님"으로 명시. 이번 변경이 신규 유발한 문제가 아니며, 별도 트랙으로 처리 예정임이 확인된다.
- **제안**: 별도 PR에서 Swagger DTO를 실제 `ModelInfo[]` wire shape에 맞게 정정.

---

## 요약

이번 변경은 API 계약 관점에서 전체가 후방 호환(backward-compatible)이다. 핵심 변경 4건 모두 클라이언트 계약을 건드리지 않는다. (1) `SENSITIVE_ACTION_THROTTLE` 추출은 값이 동일한 상수 참조 전환이라 실행 동작 변화 없음. (2) `MODEL_TYPE_ENUM`/`ModelTypeFilter` DTO 이전은 런타임 타입을 변경하지 않으며 `@ApiQuery enumName` 추가는 OpenAPI 스키마 개선이지 런타임 검증 변경이 아님. (3) `capModelList` 500건 상한은 응답 타입 `ModelInfo[]`를 유지하고 정상 provider(수십 개)에서는 투명하므로 기존 API 클라이언트에 영향이 없음. 유일한 지적사항은 세 throttle 적용 엔드포인트에서 `@ApiTooManyRequestsResponse` 선언이 누락되어 Swagger 문서에 429 시나리오가 빠진 것으로, 기능 버그가 아닌 문서화 갭이다.

## 위험도

LOW

---

STATUS=success ISSUES=0
