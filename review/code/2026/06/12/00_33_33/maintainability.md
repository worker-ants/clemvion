# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `recordAudit` 헬퍼 추출로 중복 제거 — 양호
- 위치: `auth-configs.service.ts` `recordAudit()` private 메서드
- 상세: CRUD 5개 경로(create/update/regenerate/remove/reveal)에서 반복되던 `auditLogsService.record({...})` 호출 블록을 `recordAudit()` 단일 래퍼로 추출했다. 이전에는 같은 `resourceType`, `workspaceId`, `userId`, `ipAddress` 패턴이 5번 inline 복사됐으나 이제 한 곳에서 관리된다.
- 제안: 이상 없음.

### [INFO] `USAGE_RECENT_CALLS_LIMIT` 상수화 — 양호
- 위치: `auth-configs.service.ts` 라인 `const USAGE_RECENT_CALLS_LIMIT = 20`
- 상세: `.limit(20)` 하드코딩 매직 넘버가 의미있는 상수로 교체됐다. 주석("목록 API 기본 페이지 크기와 동일")까지 포함해 이 숫자의 의미와 다른 상수와의 관계를 명확히 설명한다.
- 제안: 이상 없음. 다만 `findAll`의 `limit = 20` 기본값과 같은 값이라 명시했는데, 이 두 상수가 실제로 항상 같아야 한다면 `DEFAULT_PAGE_LIMIT` 같은 단일 상수로 통합하면 더 강력하다 — 현재 수준도 충분히 허용 가능.

### [INFO] `AUDIT_ACTIONS` 상수 참조 통일 — 양호
- 위치: `auth-configs.service.spec.ts`, `integrations.service.spec.ts` 전반
- 상세: 테스트에서 `'auth_config.create'`, `'integration.deleted'` 같은 리터럴 문자열을 `AUDIT_ACTIONS.AUTH_CONFIG_CREATE`, `AUDIT_ACTIONS.INTEGRATION_DELETED` 상수 참조로 교체했다. 이제 액션 값이 변경되면 서비스 코드와 테스트가 함께 따라간다 (단일 진실).
- 제안: 이상 없음.

### [WARNING] `recordAudit` 시그니처 — 위치 기반 파라미터 혼동 가능성
- 위치: `auth-configs.service.ts` `recordAudit(action, workspaceId, userId, resourceId, ipAddress?)`
- 상세: 파라미터가 5개이고 모두 `string | undefined` 타입이다. 호출 측에서 `workspaceId`와 `userId`, `resourceId` 위치를 실수로 바꿔도 TypeScript가 잡지 못한다. 실제로 `auth-configs.controller.spec.ts`의 테스트가 이 스왑 방지를 목적으로 별도 작성된 점 자체가 이 위험을 인식하고 있다는 방증이다.
- 제안: `{ action, workspaceId, userId, resourceId, ipAddress }` 형태의 단일 options 객체를 받도록 리팩터링하거나, 또는 기존 `AuditLogsService.record()`를 직접 호출하되 `resourceType`만 상수로 고정하는 래퍼 패턴이 더 안전하다. 현재 코드에서 실제 스왑 버그는 없지만 향후 유지보수 중 실수 가능성이 있다.

### [INFO] `as never` 타입 캐스팅 사용 — 허용 가능 수준
- 위치: `auth-configs.controller.spec.ts` `service as never`, `body as never`
- 상세: 테스트 픽스처에서 타입 우회를 위해 `as never`를 반복 사용한다. `as unknown as T`보다 간결하고 테스트 전용 맥락에서 관례적으로 허용되는 패턴이다.
- 제안: 이상 없음. 단, 서비스 코드에서는 사용하지 말 것.

### [INFO] `ApiProperty` description 문자열 연결 — 가독성 양호
- 위치: `audit-log-response.dto.ts` `action` 필드 데코레이터
- 상세: 긴 설명을 `+` 연결보다 template literal이나 multi-line 객체가 더 읽기 쉬울 수 있지만, 현재 방식도 NestJS/Swagger 관용 패턴과 일치하고 줄 길이가 합리적이다.
- 제안: 선택적 개선. `description: [\n  '...',\n  '...',\n].join(' ')` 또는 template literal로 교체하면 편집 시 줄 경계가 명확해진다.

### [INFO] `reveal` 테스트에서 `const userId` 지역 변수 제거 — 클린업
- 위치: `auth-configs.service.spec.ts` `describe('reveal')` 블록
- 상세: 스코프 상단의 `const userId = 'user-1'`를 제거하고 모듈 상단 `USER` 상수를 일관되게 사용하도록 변경했다. 같은 값을 두 곳에서 별도 이름으로 관리하던 혼란을 해소한다.
- 제안: 이상 없음.

### [INFO] `integrations.service.spec.ts` 테스트 추가 — 구조 일관성
- 위치: 파일 5 전체
- 상세: `update` 테스트 그룹이 기존 `reauthorize` describe 블록에서 분리되어 별도 `describe('update')` 섹션으로 추가됐다. 다른 operation 블록들(remove, rotate 등)과 일관된 패턴이다.
- 제안: 이상 없음.

---

## 요약

이번 변경은 감사 로그 기록 코드의 유지보수성을 전반적으로 개선했다. `recordAudit` 헬퍼로 5곳의 중복 패턴을 제거하고, 매직 넘버를 상수화하며, 테스트에서 문자열 리터럴을 `AUDIT_ACTIONS` 상수 참조로 일원화한 점이 두드러진다. 주요 개선 기회는 `recordAudit`의 위치 기반 5개 파라미터 시그니처로, TypeScript 타입 시스템이 인자 순서 오류를 잡지 못한다는 점이 향후 잠재적 유지보수 위험으로 남는다. 전반적으로 코드베이스의 기존 스타일 및 NestJS 패턴에 잘 부합하며 중요한 회귀 우려는 없다.

## 위험도

LOW
