# API 계약(API Contract) 리뷰 결과

## 발견사항

- **[INFO]** `AuditLogDto.action` 필드 설명 강화 — 하위 호환 개선
  - 위치: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts` (라인 39–49)
  - 상세: `@ApiProperty` 의 `description` 이 추가되어 `action` 필드에 "DB 는 자유 문자열 컬럼이므로 위 union 밖의 레거시 값이 과거 row 에 존재할 수 있다 — 클라이언트는 enum 으로 단정하지 말 것" 이라는 명시적 경고를 포함한다. 응답 타입 자체는 여전히 `string` 이고 스키마 구조 변경이 없으므로 기존 클라이언트에 대한 breaking change 가 아니다. 오히려 클라이언트가 예상치 못한 값을 안전하게 처리하도록 안내하는 좋은 문서화다.
  - 제안: 추가 조치 불필요. 단, 향후 `action` 필드에 enum 값을 API 스펙 레벨에서 열거하려면 `enum` 배열 + `enumName` 을 함께 기재하되 `additionalPropertiesAllowed` / "open enum" 패턴을 명확히 표시할 것.

- **[INFO]** `AUDIT_ACTIONS` 상수 도입으로 매직 스트링 제거 — 내부 계약 개선
  - 위치: `auth-configs.service.spec.ts`, `integrations.service.spec.ts` 전반
  - 상세: 테스트에서 `'auth_config.create'`, `'integration.deleted'` 등의 매직 스트링을 `AUDIT_ACTIONS.*` 상수로 교체했다. 이는 API 응답(`action` 필드)의 실제 값을 단일 소스에서 관리하게 하여 향후 값 변경 시 일관성을 보장한다. 클라이언트 가시 API 계약에는 직접 영향 없음.
  - 제안: 추가 조치 불필요.

- **[INFO]** `recordAudit` 내부 래퍼 도입 — 서비스 내부 리팩토링
  - 위치: `auth-configs.service.ts` (라인 54–83)
  - 상세: `auditLogsService.record(...)` 를 직접 호출하던 5개 경로를 `recordAudit(action, workspaceId, userId, resourceId, ipAddress)` 로 통합했다. 인자 순서가 `action, workspaceId, userId, resourceId` 로 고정되었으므로 내부 호출 순서 일관성이 확보된다. 공개 API 서명에는 변경 없음.
  - 제안: 추가 조치 불필요. `recordAudit` 시그니처의 인자 순서(action 선행)가 controller 레이어에서 전달되는 순서와 일관되도록 향후 확장 시 유지할 것.

- **[INFO]** `USAGE_RECENT_CALLS_LIMIT` 상수화 — 하드코딩 제거
  - 위치: `auth-configs.service.ts` (라인 64, 517)
  - 상세: `getUsage` 내의 하드코딩된 `.limit(20)` 을 `USAGE_RECENT_CALLS_LIMIT = 20` 상수로 대체했다. `getUsage` API 응답의 `recentCalls` 배열 크기가 명시적으로 관리된다. API 응답 구조 자체는 변경 없음.
  - 제안: `getUsage` 응답 DTO 에 `recentCalls` 최대 건수를 OpenAPI 문서 (`@ApiProperty({ maxItems: 20 })` 등)로 노출하는 것을 검토할 것. 현재 응답 DTO 는 익명 인터페이스 반환 타입이라 문서화가 부족하다.

- **[INFO]** `controller.spec.ts` — `req.ip undefined` 전파 테스트 추가
  - 위치: `auth-configs.controller.spec.ts` (라인 195–205)
  - 상세: trust proxy 미설정 시 `req.ip` 가 `undefined` 인 경우 서비스로 `undefined` 를 그대로 전달하는 동작을 테스트로 보장한다. 이는 감사 로그의 `ipAddress` 필드가 `null` 이 아닌 `undefined` 로 기록될 수 있음을 의미한다. `AuditLogDto` 의 `ipAddress` 필드는 `@ApiPropertyOptional({ nullable: true })` 로 선언되어 있어 `null` 을 기대한다.
  - 제안: 서비스 또는 컨트롤러 레이어에서 `req.ip ?? null` 로 정규화하여 `ipAddress` 가 DB 에 `NULL` 로 저장되고 API 응답에서 `null` 로 직렬화되도록 통일하는 것을 검토할 것. 현재는 `undefined` 가 서비스까지 전달되어 `ipAddress: undefined` 로 audit 기록될 수 있고, 이는 OpenAPI 스키마(`nullable: true` 로 `null` 기대)와 미묘하게 불일치한다.

## 요약

이번 변경은 주로 감사 로그 CRUD 경로에 `auth_config.*` 액션을 추가하고 내부 코드를 정리한 리팩토링이다. 공개 API 스키마 변경은 `AuditLogDto.action` 필드에 설명 텍스트가 보강된 것뿐이며, 이는 하위 호환적이고 클라이언트 안정성에 기여한다. Breaking change 는 없다. 한 가지 주목할 점은 `req.ip` 가 `undefined` 일 때 `null` 정규화 없이 서비스로 전달되어 `ipAddress` 가 `undefined` 로 기록될 수 있는데, 이는 OpenAPI DTO(`nullable: true`)와의 미묘한 불일치다. 그러나 실제 DB 저장 및 직렬화 동작은 TypeORM/JSON 직렬화 방식에 의존하므로 실제 응답에서 `null`/`undefined` 중 어느 쪽이 되는지 확인이 필요하다. 전반적으로 API 계약 위험은 낮다.

## 위험도
LOW
