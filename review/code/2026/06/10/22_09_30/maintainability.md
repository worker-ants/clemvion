# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] AuditLogsController — @Roles 데코레이터 위치
- 위치: `codebase/backend/src/modules/audit-logs/audit-logs.controller.ts` L80–83
- 상세: `@Get()` 과 `@ApiOperation` 사이에 인라인 주석이 삽입된 뒤 `@Roles('admin')` 이 배치되어 있다. NestJS 컨벤션상 데코레이터는 주석 없이 연속 배치하고 JSDoc 주석은 데코레이터 블록 전체의 위에 두는 것이 일반적이다. 현 구조는 `// [Spec…]` 주석이 `@Get()` 과 `@Roles()` 를 분리하여 데코레이터 순서를 시각적으로 파악하기 어렵게 한다.
- 제안: 보안 스펙 주석을 `@Roles` 바로 위로 이동하거나, 핸들러 메서드 위에 JSDoc 블록으로 통합하여 데코레이터 체인을 시각적으로 연속성 있게 유지한다.

### [INFO] AuditLogsService — 기본값 하드코딩 일관성
- 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` L157–158
- 상세: `page = 1`, `limit = 20`, `sort = 'created_at'`, `order = 'desc'` 가 서비스 레이어에 직접 하드코딩되어 있다. `TriggersService.findAll`(같은 파일 내 L840)도 동일하게 `page = 1, limit = 20` 을 하드코딩한다. 이 두 서비스의 기본 페이지네이션 값이 공유 상수 없이 중복된다.
- 제안: `PaginationQueryDto` 또는 공통 상수 파일에 기본값을 정의하여 중복을 제거한다. DTO 단에서 `@IsOptional() @IsInt() @Min(1) @Default(1)` 등으로 기본값을 선언하면 서비스에서 기본값 지정 로직이 사라진다.

### [INFO] AuditLogsService.getSortColumn — 허용 컬럼 중복 표현
- 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` L235–240
- 상세: `allowed` 객체에서 키와 값이 모두 동일한 문자열(`'created_at': 'created_at'` 등)이다. Set 을 사용하는 것이 더 의도가 명확하고 간결하다.
- 제안:
  ```ts
  private readonly SORT_ALLOWLIST = new Set(['created_at', 'action', 'resource_type']);
  private getSortColumn(sort: string): string {
    return this.SORT_ALLOWLIST.has(sort) ? sort : 'created_at';
  }
  ```

### [INFO] AuditLogsService.record — console.warn 사용
- 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` L228–231
- 상세: `record` 메서드에서 오류 처리에 `console.warn` 을 사용한다. `TriggersService` 를 포함한 코드베이스 전반에서 NestJS `Logger` 를 사용(`this.logger = new Logger(...)`)하는 반면, `AuditLogsService` 만 `console.warn` 으로 일관성이 깨진다.
- 제안: `AuditLogsService` 에도 `private readonly logger = new Logger(AuditLogsService.name)` 를 추가하고 `console.warn` 을 `this.logger.warn(...)` 으로 교체한다.

### [WARNING] triggers.service.spec.ts — `build()` 함수 중복 모듈 설정
- 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (신규 describe 블록, L582–638)
- 상세: 새로 추가된 `describe('TriggersService.promoteRotatedNotificationSecrets — secret store 경유 승격')` 블록의 `build()` 함수는 기존 테스트 파일에 이미 존재하는 모듈 프로바이더 설정(ChannelAdapterRegistry, ChannelListenerRegistry, ConfigService, ScheduleRunnerService, SecretResolverService 등)을 거의 동일하게 반복한다. 새 테스트 블록의 `build()` 함수는 기존 `beforeEach` 구조와 독립적으로 만들어졌다.
- 제안: 공통 프로바이더 설정을 `createBaseProviders()` 같은 헬퍼 팩토리로 추출하여 중복을 줄인다. 또는 기존 `beforeEach` 에서 `SecretResolverService` 의 `rotate` mock 을 확장하는 방식으로 기존 모듈 setup 을 재사용한다.

### [INFO] triggers.service.spec.ts — 타입 단언 `as never` 사용
- 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` L323–325, L331
- 상세: `service.findAll('ws-1', { userId: '...' } as never)` 에서 `as never` 타입 단언을 사용하여 TypeScript 타입 검사를 우회한다. 이는 DTO 타입을 정확히 표현하지 않아 타입 안전성 신호가 약해지고, 이후 DTO 변경 시 컴파일 오류로 감지되지 않을 수 있다.
- 제안: `Partial<QueryAuditLogDto>` 또는 `{ userId?: string } as QueryAuditLogDto` 처럼 더 정확한 타입 단언을 사용한다.

### [INFO] triggers.service.ts — promoteRotatedNotificationSecrets 시그니처 변경
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` L726
- 상세: `promoteRotatedNotificationSecrets(nowMs: number = Date.now())` 로 파라미터가 추가되었다. 파라미터 명 `nowMs` 는 단위(밀리초)를 포함해 의도를 명확히 전달하므로 네이밍은 적절하다. 다만 기존 코드베이스에서 이 메서드를 호출하는 `NotificationSecretRotatorService` 등의 호출부가 인자 없이 호출하는지 확인이 필요하다 (default 값이 있으므로 기능 회귀는 없으나 문서화 관점).

### [INFO] e2e spec — BASE_URL 매직 문자열
- 위치: `codebase/backend/test/audit-logs.e2e-spec.ts` L1598
- 상세: `'http://backend-e2e:3011'` 이 파일에 직접 하드코딩되어 있다. 이 값이 다른 e2e 테스트 파일에도 동일하게 존재한다면 단일 진실 원칙에 위배된다.
- 제안: 다른 e2e 파일에서 같은 값을 사용한다면 `test/helpers/` 에 공통 상수(`E2E_BASE_URL`)로 추출하는 것이 좋다. 현재는 `process.env.E2E_BASE_URL` 폴백이 있으므로 심각도는 낮다.

### [INFO] triggers.service.ts — normalizeNotificationSecretRef 와 promoteRotatedNotificationSecrets 의 유사한 ref 생성 로직
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` L1220–1225 (normalize), L734–738 (promote)
- 상세: 두 메서드 모두 `buildSecretRef({ scope: 'triggers', resourceId: trigger.id, name: 'notification-signing' })` 를 동일하게 호출하여 canonical ref 를 생성한다. 현재 C3 fix 에서 이 동일 패턴을 의도적으로 재사용하는 것은 명문화되어 있으나, ref 구성 파라미터가 분산되면 이후 변경 시 한쪽만 수정하는 실수가 생길 수 있다.
- 제안: 상수 또는 private 헬퍼 메서드(`private notificationSigningRef(triggerId: string)`)로 추출하면 "두 메서드가 같은 ref 를 쓴다"는 계약이 코드로 명시된다.

### [INFO] spec/1-data-model.md — User 테이블 확장 항목 가독성
- 위치: `spec/1-data-model.md` L1946–1955
- 상세: 새로 추가된 10개 필드가 기존 표 중간에 삽입되어 있다. 필드가 많아졌으나 인증/보안 관련 필드(email_verified, password_reset_token 등)와 프로필/설정 관련 필드(notification_preferences)가 그룹화 없이 나열된다. 문서 가독성을 위해 필드를 의미 단위로 그룹핑하는 소제목이나 주석 행을 추가하면 이해가 빠르다.

---

## 요약

이번 변경은 두 보안 갭(V-03 audit-logs Admin+ 가드 미강제, C3 notification secret rotation 무효)을 해소하는 목적에 집중되어 있으며, 전반적으로 코드 구조와 네이밍이 의도를 잘 전달한다. 컨트롤러·DTO·서비스·테스트·스펙이 일관된 방향으로 변경되어 유지보수성 기본은 갖춰져 있다. 주요 주의 사항은 (1) `AuditLogsService.record` 에서만 `console.warn` 을 사용해 Logger 일관성이 깨지는 점, (2) 새 테스트 블록에서 모듈 프로바이더 설정이 중복 작성된 점, (3) `normalizeNotificationSecretRef` 와 `promoteRotatedNotificationSecrets` 가 동일한 canonical ref 생성 파라미터를 분산 보유하는 점이다. 이들은 즉각적 기능 문제는 아니지만 향후 수정 시 불일치 위험을 높인다.

---

## 위험도

LOW
