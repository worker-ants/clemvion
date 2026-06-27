### 발견사항

- **[INFO]** `GET :id/models` 엔드포인트에 명시적 `@Roles` 데코레이터 없음
  - 위치: `llm-model-config.controller.ts` L197 (`@Get(':id/models')`)
  - 상세: `previewModels`, `testConnection` 는 `@Roles('editor')` 가 명시된 반면, `listModels` 는 의도적으로 생략됨(인라인 주석 "spec §3·R-7: Viewer 이상"). 워크스페이스 멤버십 미충족 403 을 "컨트롤러 공통 인증 계층"에 위임하는 구조이므로, 해당 공통 가드가 실제로 모든 요청 경로에서 workspaceId 소속 검증을 수행하는지 확인이 필요하다. 소속 검증이 누락되면 UUID 를 알고 있는 타 워크스페이스 인증 사용자도 모델 목록을 조회할 수 있다.
  - 제안: 공통 인증 레이어가 `workspaceId` 와 `:id`(model-config UUID)의 소속 관계를 검증함을 테스트/주석으로 명확히 문서화한다. 현 코드 변경 자체로 새로 도입된 결함은 아님(기존 동작 유지).

- **[INFO]** `previewModels` — 요청 body 에 포함된 임시 API Key 의 로그 노출 가능성
  - 위치: `llm-model-config.controller.ts` L167 (`previewModels`) / `LlmPreviewService.previewModels`
  - 상세: 이 엔드포인트는 저장되지 않은 자격증명(apiKey 포함)을 body 로 수신해 Provider 를 실시간 호출한다. 컨트롤러 레벨에서는 입력을 그대로 서비스로 전달하며, Provider 오류 발생 시 서비스/클라이언트 계층의 오류 메시지에 apiKey 값이 노출되지 않는지 확인이 필요하다. 본 diff 에서 직접 변경된 코드는 아니며, `LlmPreviewService` 내부 구현 리뷰는 이번 changeset 범위 밖이다.
  - 제안: `LlmPreviewService` 및 하위 LLM 클라이언트에서 예외 메시지·스택트레이스에 apiKey 값이 포함되지 않도록 확인한다.

- **[INFO]** `ModelInfoDto` 에서 `meta?: Record<string, unknown>` 필드 제거 — 보안 개선
  - 위치: `model-config-response.dto.ts` (삭제된 `ModelItemDto.meta`)
  - 상세: 이전 `ModelItemDto` 의 `meta?: Record<string, unknown>` 는 구조가 열려 있어 예기치 않은 provider 내부 데이터(민감 정보 포함 가능)가 응답에 포함될 가능성이 있었다. 새 `ModelInfoDto` 가 `{ id, name, type }` 으로 필드를 고정함으로써 응답 표면이 줄었다. 의도치 않은 데이터 노출 위험이 감소한 긍정적 변경이다.

### 요약

본 changeset 은 Swagger OpenAPI 어노테이션과 응답 DTO 리팩터링이 핵심이며 런타임 동작은 byte-identical 로 선언되어 있다. 하드코딩된 시크릿, 인젝션 벡터, 암호화 문제, 에러 정보 직접 노출은 변경 코드에서 발견되지 않는다. Rate-limit(`SENSITIVE_ACTION_THROTTLE`), UUID 파이프(`ParseUUIDPipe`), Enum 파이프(`ParseEnumPipe`) 등 기존 방어 레이어는 그대로 유지된다. 보안 측면의 실질 위험은 `GET :id/models` 의 암묵적 인가 모델(공통 가드 위임)이 실제로 올바르게 시행되는지의 신뢰 가정에 있으나, 이는 본 diff 가 도입한 것이 아니고 pre-existing 설계이다.

### 위험도

LOW
