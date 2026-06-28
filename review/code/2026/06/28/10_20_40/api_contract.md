# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] DB CHECK 제약이 API 계약 방어를 강화 — NOT VALID 선택 적절
- 위치: `codebase/backend/migrations/V102__trigger_endpoint_path_uuid_check.sql`
- 상세: `chk_trigger_endpoint_path_uuid` 제약은 ValidationPipe(@IsUUID('4')) 를 우회하는 직접 DB 쓰기 경로(e2e fixture INSERT, 향후 seed 스크립트 등)에 대해 이중 방어를 제공한다. NOT VALID 를 선택해 레거시 비-UUID 슬러그 row 에 의한 배포 차단 위험을 제거한 판단이 타당하다. NULL 허용(schedule/manual 타입)도 정확하게 반영됐다.
- 제안: 없음. 운영 전수 클린 확인 후 `VALIDATE CONSTRAINT` 승격 별도 마이그레이션을 계획 문서에 이미 기재되어 있으므로 현 상태가 적절하다.

### [INFO] UpdateTriggerDto Swagger 설명이 API 계약을 정확히 기술
- 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts`, 변경 전 Line 51-52 vs 변경 후
- 상세: 이전 설명 "생성 후 endpointPath 변경은 service 가 거부한다"는 클라이언트가 PATCH 요청 시 항상 오류를 예상하도록 오도할 수 있는 거짓 API 계약이었다. 수정된 설명은 "webhook 트리거는 변경 가능하나 변경 시 기존 URL 은 404 가 된다. schedule 타입 트리거에 한해 service 가 변경을 거부한다(VALIDATION_ERROR)"로 실제 동작과 일치한다. API 계약 정확도 개선.
- 제안: Swagger `@ApiPropertyOptional` description 에 schedule 타입에서의 에러 코드(`VALIDATION_ERROR`)가 명시돼 있어 클라이언트가 분기 처리할 수 있으나, 향후 스케줄 거부 시 반환되는 HTTP 상태 코드(400 vs 422)도 Swagger 설명에 명시하면 더 완전한 계약이 된다.

### [INFO] e2e 픽스처 endpointPath 가 실 API 제약과 정합
- 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` (Line 84-86), `codebase/backend/test/helpers/e2e-chat-channel-fixture.ts` (Line 78-80)
- 상세: 기존 `e2e-${triggerId.slice(0,8)}` / `${slug}-e2e-${randomBytes(6).toString('hex')}` 형식은 DTO 및 DB CHECK 제약(`chk_trigger_endpoint_path_uuid`)을 모두 위반하는 값이었다. `randomUUID()` 로 수정함으로써 직접 INSERT 경로도 V102 제약 하에서 통과하게 된다. API 라우팅 키(`/api/hooks/:endpointPath`)가 실제 서비스와 동일한 형식을 사용하게 돼 e2e 가 계약을 충실히 검증한다.
- 제안: 없음.

### [INFO] B2 e2e 케이스 — ValidationPipe 파이프라인 계약 검증 적절
- 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` (신규 `B2` it-block)
- 상세: 비-UUID endpointPath 로 `POST /api/triggers` 시 400 + `VALIDATION_ERROR` 코드를 e2e 레벨에서 검증한다. DTO unit 테스트와 별개로 실 파이프라인 경로를 커버해 회귀를 방어하며, HTTP 상태 코드 400 과 에러 코드 `VALIDATION_ERROR` 가 프로젝트 에러 응답 규약과 일치한다.
- 제안: 없음.

### [INFO] system-status.e2e-spec.ts — `workspace-invitations-pruner` 중복 제거
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` (삭제된 3줄)
- 상세: `EXPECTED_QUEUE_NAMES` 에서 `workspace-invitations-pruner` 중복 항목을 제거했다. 이 변경은 API 계약 자체와 무관하나, 시스템 상태 API 큐 목록 검증의 정확도를 높인다. `EXPECTED_QUEUE_NAMES` 는 여전히 `workspace-invitations-pruner` 를 1회 포함하므로 계약 검증 누락이 없다.
- 제안: 없음.

## 요약

이번 변경의 API 계약 관점 핵심은 두 가지다. (1) `endpointPath` 필드를 v4 UUID 로 강제하는 정책을 DTO 유효성 검증에서 DB CHECK 제약(V102 migration)까지 수직 관통시켜 모든 쓰기 경로에서 계약이 일관되게 적용되도록 했다. (2) `UpdateTriggerDto` 의 Swagger 설명이 실제 서비스 동작(webhook mutable, schedule 거부)과 불일치하던 거짓 계약을 정정했다. 에러 응답 형식(`{ error: { code } }`)·HTTP 상태 코드(400/401/404/410)·인증/인가 적용은 모두 기존 규약을 준수하며 이번 변경이 어떤 breaking change 도 도입하지 않는다. NOT VALID 선택으로 레거시 데이터에 의한 배포 차단 위험을 제거한 판단도 적절하다.

## 위험도

NONE
