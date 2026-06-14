# API 계약(API Contract) 리뷰 결과

## 발견사항

### [INFO] 응답 형식 — `responseCode` 필드의 의미 이중성 (semantic overloading)

- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 라인 482–483; `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` `AuthConfigUsageCallDto.responseCode`
- 상세: `responseCode` 필드는 webhook 경로에서는 실제 HTTP 상태 코드 문자열(`'202'`)을 담고, 비-HTTP 트리거(schedule 등)에서는 HTTP 코드가 없으므로 `status` enum(`'completed'`, `'failed'` 등)으로 폴백한다. 하나의 필드에 두 가지 의미 영역(HTTP 코드 vs 워크플로 상태)이 혼합되어 있어, API 클라이언트가 값 해석 시 타입 판별 로직을 별도로 구현해야 한다. DTO 주석과 Swagger 설명에는 이 동작이 기술되어 있으나, API 응답 스키마 상 필드 타입(`string`)은 동일하다.
- 제안: 현재 구현이 spec §A.3 / WH-MG-05 의 명시적 설계 결정(비-HTTP 트리거는 status enum 폴백)을 그대로 따르고 있으므로 breaking change 는 아니다. 다만 클라이언트 측 혼동 방지를 위해 OpenAPI 응답 스키마에 `oneOf` / `description` 수준의 구분 힌트 또는 별도 `responseCodeType: 'http' | 'status'` 필드 추가를 중장기적으로 검토 권장.

### [INFO] 하위 호환성 — `GET /api/auth-configs/:id/usage` 응답 형식 확장

- 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` `AuthConfigUsageDto`; `AuthConfigUsageCallDto`
- 상세: 기존 응답에 `periodCounts` 객체(신규 필수 필드)와 `recentCalls` 각 항목에 `sourceIp`(nullable), `responseCode`(non-null) 두 필드가 추가되었다. 기존 클라이언트가 추가 필드를 무시하면 문제없으나, TypeScript/strict 스키마를 사용하는 클라이언트가 응답 타입을 고정(exhaustive check)하는 경우 컴파일 오류가 발생할 수 있다. `periodCounts` 는 이전에 없었던 필수 키이므로, 구버전 응답 타입을 캐시하거나 저장하는 클라이언트는 영향을 받는다.
- 제안: 기능 확장이며 기존 필드는 제거/변경 없이 필드가 추가만 되는 additive change 이므로 REST API 관점의 하위 호환성은 유지된다. 다만 프런트엔드 SDK / BFF 연동 코드가 있을 경우 타입 업데이트 필요성을 문서화하는 것이 좋다.

### [INFO] 페이지네이션 — `recentCalls` 고정 20건 제한 (명시적 페이지네이션 없음)

- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` `USAGE_RECENT_CALLS_LIMIT = 20`; DTO Swagger 설명 `'Up to 20 most recent executions'`
- 상세: `recentCalls` 는 최신 20건만 반환하며 커서/오프셋 기반 페이지네이션을 제공하지 않는다. spec §A.3 요건이 20건 고정임을 전제하는 것으로 보이므로 현재 구현이 계약 위반은 아니다. 그러나 향후 "전체 이력 보기" 기능 추가 시 별도 API 엔드포인트가 필요해진다.
- 제안: Swagger 응답 설명에 `recentCalls` 가 최대 20건 고정임을 명시(이미 기재됨)하고 있으므로 현재 수준에서는 적절하다. 페이지네이션 필요성이 생기면 `GET /api/auth-configs/:id/executions?cursor=&limit=` 등 별도 엔드포인트로 분리를 권장.

### [INFO] 요청 검증 — `ExecuteOptions.sourceIp` / `responseCode` 형식 검증 부재

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 567–784 `ExecuteOptions` 타입
- 상세: `sourceIp` 와 `responseCode` 는 `string | undefined` 로 선언되어 있고 TypeORM entity 에서 `VARCHAR(45)` / `VARCHAR(10)` 제약이 있지만, service 계층에서 입력값의 길이나 IP 형식을 검증하지 않는다. 외부 HTTP 요청에서 추출된 IP 문자열이 45자를 초과하거나 비정상 형식이면 DB 레벨 오류가 발생한다.
- 제안: `extractClientIp` 함수 반환값이 이미 정규화된다고 가정하더라도, `hooks.service.ts` 또는 `execution-engine.service.ts` 에서 `sourceIp` 최대 길이(45자) 체크나 기본 IP 형식 검증을 추가하면 방어 계층이 강화된다. 현재는 DB 길이 제약이 유일한 가드이므로 DB 오류 대신 명시적 400 응답으로 처리하는 것이 권장된다. (낮은 실제 위험: `extractClientIp` 가 내부 함수이고 Forwarded 헤더 첫 번째 토큰을 trim하는 구현으로 보임.)

## 요약

이번 변경은 `GET /api/auth-configs/:id/usage` 엔드포인트의 응답을 additive 방식으로 확장한다 — 기존 필드(`totalCalls`, `lastUsedAt`, `recentCalls`) 는 유지하고 `periodCounts` 객체와 `recentCalls` 항목에 `sourceIp`/`responseCode` 가 추가된다. Breaking change 는 없으며, DB 스키마(V096 마이그레이션), entity, service, DTO, 프런트엔드 인터페이스 전 계층이 일관된 필드명(`sourceIp`/`responseCode`/`periodCounts`)으로 동기화되어 있다. 주요 관찰 사항은 `responseCode` 가 HTTP 트리거와 비-HTTP 트리거에서 서로 다른 의미 도메인 값을 담는 semantic overloading 구조인데, 이는 spec §A.3 의 명시적 설계이며 Swagger 문서와 DTO 주석에 충분히 기술되어 있다. 페이지네이션과 입력 검증 관련 경미한 개선 제안이 있으나, 현재 API 계약 구현은 전반적으로 RESTful 원칙과 일관성을 잘 유지하고 있다.

## 위험도

LOW
