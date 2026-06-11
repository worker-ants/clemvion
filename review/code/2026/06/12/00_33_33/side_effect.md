# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] AuditLogDto.action @ApiProperty description 확장 — 런타임 부작용 없음
- 위치: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts` L36-46
- 상세: `@ApiProperty` 데코레이터의 description 문자열을 확장한 순수 문서화 변경. NestJS `@ApiProperty`는 Swagger 스키마 메타데이터만 등록하므로 런타임 동작·시그니처·직렬화에 영향 없음. `action` 필드 타입(`string`)은 그대로 유지되어 기존 직렬화·역직렬화에 변경 없음.
- 제안: 이상 없음.

### [INFO] `AuditAction` 타입 추가 export — 기존 import에 영향 없음
- 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (import 측: `auth-configs.service.ts` L1152)
- 상세: `AUDIT_ACTIONS`에 더해 `AuditAction` 타입이 새로 named export됨. 기존에 `AUDIT_ACTIONS`만 import하던 코드는 변경 없이 동작. 추가 export이므로 하위 호환성 유지.
- 제안: 이상 없음.

### [INFO] `recordAudit` private 메서드 도입 — 내부 리팩터, 호출자 없음
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L1170-1191
- 상세: `this.auditLogsService.record(...)` 직접 호출 5개를 `this.recordAudit(...)` 래퍼로 일원화. `private` 메서드이므로 외부 공개 API에 노출되지 않음. 인자 순서(action → workspaceId → userId → resourceId → ipAddress)는 기존 record() payload 객체와 동일한 필드를 보존. 인자 순서 오류 가능성을 테스트(auth-configs.service.spec.ts)가 커버.
- 제안: 이상 없음.

### [INFO] `USAGE_RECENT_CALLS_LIMIT = 20` 모듈 스코프 상수 도입
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L1161-1162
- 상세: 파일 스코프(모듈 내부) `const`로 전역 변수가 아님. `getUsage` 쿼리의 `.limit(20)` 매직 넘버를 상수로 추출한 것이어서 동작 변경 없음.
- 제안: 이상 없음.

### [INFO] 테스트 파일 변경 — 프로덕션 부작용 없음
- 위치: `auth-configs.controller.spec.ts`, `auth-configs.service.spec.ts`, `integrations.service.spec.ts`, `workspaces.service.spec.ts`
- 상세: 모두 `*.spec.ts` 파일이므로 프로덕션 런타임에 포함되지 않음. 인라인 문자열(`'auth_config.create'` 등)을 `AUDIT_ACTIONS.AUTH_CONFIG_CREATE` 상수 참조로 교체한 것은 타입 안전성 향상. `integrations.service.spec.ts`에 `update`/`reauthorize` 신규 describe 블록 추가는 커버리지 확대이며 기존 테스트 격리성(beforeEach mocks reset) 유지.
- 제안: 이상 없음.

### [INFO] `userId` 지역 변수 제거 (`reveal` 테스트) — 상수 `USER`로 통합
- 위치: `auth-configs.service.spec.ts` L600-601 (diff: `const userId = 'user-1'` 삭제)
- 상세: 동일 스코프 내 `const USER = 'user-1'`(파일 상단)로 통합. 값이 동일하여 테스트 의미 변경 없음. 지역 변수 제거이므로 클로저·공유 상태 오염 없음.
- 제안: 이상 없음.

### [INFO] `workspaceId` 필드 추가 (`remove` audit 테스트)
- 위치: `auth-configs.service.spec.ts` L392 (diff: `+ workspaceId: WS`)
- 상세: `expect.objectContaining({ ... workspaceId: WS ... })` 추가 — 프로덕션 서비스 로직이 이미 `workspaceId`를 `recordAudit`에 전달하고 있으므로 테스트 강화만. 프로덕션 부작용 없음.
- 제안: 이상 없음.

## 요약

이번 변경은 감사 로그 action 문자열을 인라인 리터럴에서 `AUDIT_ACTIONS` const 참조로 교체하고, auth_config 계열 audit 호출을 `recordAudit` private 메서드로 리팩터링한 내용이 핵심이다. 모든 변경은 프로덕션 런타임 부작용(전역 상태 변경, 파일시스템 조작, 네트워크 호출, 공개 API 시그니처 변경, 환경 변수 접근)을 전혀 수반하지 않는다. `AuditAction` 타입 추가 export와 `USAGE_RECENT_CALLS_LIMIT` 상수 도입도 하위 호환적이며, `@ApiProperty` description 확장은 Swagger 문서에만 반영된다. 테스트 파일 변경은 프로덕션 번들에 포함되지 않는다.

## 위험도

NONE
