# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `USAGE_RECENT_CALLS_LIMIT` 상수 도입 — 행동 변경 없음
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (라인 ~2375)
- 상세: 하드코딩된 `.limit(20)` 을 `USAGE_RECENT_CALLS_LIMIT = 20` 상수로 교체. 값이 동일하므로 런타임 동작 변경 없음. 모듈-파일 범위 `const` 이며 전역 변수 오염 없음.
- 제안: 현재 상태 유지 적절.

### [INFO] `AuditAction` 타입 추가 export — 공개 인터페이스 확장
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` import 라인
- 상세: `import { AUDIT_ACTIONS, AuditAction }` 으로 `AuditAction` 타입을 추가 임포트. `AuditAction` 은 `audit-action.const` 에서 이미 export 되어 있으며, `auth-configs.service` 가 새로 타입을 노출하는 것이 아니라 소비하는 것임. 외부 API 변경 없음.
- 제안: 문제 없음.

### [INFO] `recordAudit` private 메서드 도입 — 내부 리팩터, 외부 계약 불변
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (라인 ~1389–1406)
- 상세: `auditLogsService.record()` 직접 호출을 `private recordAudit()` 래퍼로 일원화. 호출 결과(Promise<void>, best-effort swallow 계약)는 동일. `resourceType` 이 항상 `AUTH_CONFIG_RESOURCE_TYPE`('auth_config') 로 고정되며 이전 코드도 동일 값을 사용했으므로 출력 변화 없음.
- 제안: 문제 없음.

### [INFO] `@ApiProperty` description 확장 — Swagger 메타데이터만 변경
- 위치: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts`
- 상세: `action` 필드의 `@ApiProperty` 에 `description` 과 `example` 추가. Swagger 문서 렌더링에만 영향. 런타임 직렬화·DTO 검증·클라이언트 응답 페이로드 변경 없음.
- 제안: 문제 없음.

### [INFO] 테스트 파일 변경 — 프로덕션 부작용 없음
- 위치: `audit-logs.spec.ts`, `auth-configs.controller.spec.ts`, `auth-configs.service.spec.ts`, `integrations.service.spec.ts`, `workspaces.service.spec.ts`
- 상세: 모두 `.spec.ts` 테스트 파일이므로 프로덕션 코드에 직접적인 부작용 없음. 테스트 내 `process.env.APP_URL` 조작은 `beforeEach`/`afterAll` 으로 복원되어 테스트 간 환경 변수 오염 없음(`integrations.service.spec.ts` 의 `appUrl` describe 블록). 하드코딩된 문자열(`'auth_config.create'` 등)을 `AUDIT_ACTIONS.AUTH_CONFIG_CREATE` 상수로 교체하여 const 와 테스트 간 동기화 강화. `const userId` 지역 변수 제거 후 모듈 범위 `USER` 상수 재사용 — 스코프 단순화, 외부 영향 없음.
- 제안: 문제 없음.

### [INFO] `update` describe 신규 추가 (`integrations.service.spec.ts`) — 테스트 전용, 서비스 시그니처 검증
- 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` (라인 ~911–2143)
- 상세: `IntegrationsService.update` 가 `(id, workspaceId, userId, data)` 시그니처로 호출됨을 검증. 이 describe 는 기존 서비스 메서드의 행동을 검증할 뿐이며 서비스 자체를 변경하지 않음. 단, 테스트에서 `service.update('int-1', 'ws-1', 'user-1', { name: 'Renamed' })` 시그니처를 사용하고 있어, 실제 `IntegrationsService.update` 의 파라미터 순서와 일치하는지 구현 파일에서 확인 필요.
- 제안: 구현 파일에서 `update` 의 파라미터 순서 확인 권장 (테스트 시그니처 스왑 회귀 방지).

## 요약

이번 변경은 전반적으로 내부 리팩터링(감사 기록 래퍼 일원화), 상수 참조 통일(하드코딩 문자열 → `AUDIT_ACTIONS` 상수), Swagger 문서 보강, 테스트 커버리지 확대로 구성된다. 프로덕션 코드의 공개 API 시그니처, 전역 상태, 파일시스템, 네트워크 호출, 이벤트/콜백 계약은 변경되지 않았으며, 모든 수정은 의도된 범위 내에서 이루어졌다. `USAGE_RECENT_CALLS_LIMIT` 상수와 `recordAudit` 래퍼는 기능적으로 동일하며 새로운 부작용을 도입하지 않는다. 테스트 파일의 환경 변수 조작도 적절히 복원되어 테스트 격리가 유지된다. `IntegrationsService.update` 의 파라미터 순서가 테스트 예상과 일치하는지는 구현 파일 확인이 권장되나, 테스트 파일 자체의 변경인 만큼 실행 시 불일치가 즉각 드러날 것이다.

## 위험도

NONE
