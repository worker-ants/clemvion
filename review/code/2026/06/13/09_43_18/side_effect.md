# 부작용(Side Effect) Review

## 발견사항

### [WARNING] `AuditLogsService.record` swallow 계약 미확인 — 주 동작 차단 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/auth.controller.ts` `verify2fa()` (라인 ~316-326), `disable2fa()` (라인 ~332-341); `users.controller.ts` `changePassword()` (라인 ~914-920); `webauthn.controller.ts` `webauthnRegisterVerify()` (라인 ~669-680), `webauthnDelete()` (라인 ~695-706)
- 상세: 모든 신규 `await this.auditLogsService.record(...)` 호출이 `return` 구문 직전에 위치한다. spec 주석과 `users.controller.ts` 인라인 주석 모두 "record 는 내부적으로 실패를 삼켜 주 동작을 깨지 않는다"라고 명시하나, 이 diff 에는 `AuditLogsService.record` 구현 파일이 포함되어 있지 않다. 기존 `auth-configs.service` 등의 call site 패턴에서 swallow 계약이 이미 운영 검증된 것으로 추정되나, 이번 변경이 **기존에 감사 기록이 없던 경로 5곳**에 신규 `await` 호출을 일괄 삽입하는 시점이므로, `record` 구현의 try/catch swallow 여부를 명시적으로 확인하지 않으면 구현 계약이 깨진 경우 2FA 성공 응답 및 비밀번호 변경 응답 전체가 차단될 수 있다.
- 제안: `AuditLogsService.record` 구현 파일(`audit-logs.service.ts`)에서 try/catch 또는 `.catch()` 로 예외가 삼켜지고 있음을 확인한다. 기존 call site(`integrations.service` 등)가 이미 동일 계약으로 정상 운영 중이라면 위험은 LOW 수준으로 감소한다.

---

### [INFO] `WebAuthnService.deleteCredential` 반환 타입 변경 (`Promise<void>` → `Promise<{ remaining: number }>`) — 호출자 영향
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` `deleteCredential()`
- 상세: 시그니처 변경이다. 현재 코드베이스에서 `deleteCredential` 을 호출하는 곳은 `WebAuthnController.webauthnDelete` 단독이며, 이 호출자는 이미 `{ remaining }` 구조 분해를 사용하도록 함께 수정됐다. 기존 `void` 반환을 무시하던 다른 호출자는 diff 내에서 확인되지 않는다. `Promise<void>` → `Promise<{ remaining: number }>` 변경은 TypeScript 타입 호환성 관점에서 기존 호출자가 반환값을 무시하면 컴파일 에러 없이 통과하므로 컴파일 타임 보호가 미흡하다. 런타임에는 영향 없다.
- 제안: 코드베이스 전체에서 `deleteCredential` 을 호출하는 다른 경로가 없는지 grep 으로 확인하는 것이 안전하다. diff 범위 내에서는 이상 없음.

---

### [INFO] `AuthController` 생성자 시그니처 변경 — `AuditLogsService` 파라미터 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/auth.controller.ts` 생성자 (라인 ~103-311)
- 상세: `private readonly auditLogsService: AuditLogsService` 가 마지막(6번째) 파라미터로 추가됐다. NestJS DI 컨테이너 경로(운영)는 `auth.module.ts` 에 `AuditLogsModule` import 가 추가돼 공급 정상. 직접 `new AuthController(...)` 를 호출하는 테스트도 `auditLogsService` mock 을 여섯 번째 인자로 전달하도록 함께 수정됐다. 기타 직접 생성 경로 없음.
- 제안: 이상 없음.

---

### [INFO] `UsersController` 생성자 시그니처 변경 — `AuditLogsService` 파라미터 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/users/users.controller.ts` 생성자 (라인 ~41-43)
- 상세: 기존 단일 인자(`usersService`) 에서 `auditLogsService` 가 추가됐다. `users.module.ts` 에 `AuditLogsModule` import 추가로 DI 공급 정상. 테스트도 `AuditLogsService` mock provider 를 함께 등록하도록 수정됐다. 기타 직접 생성 경로 없음.
- 제안: 이상 없음.

---

### [INFO] `WebAuthnController` 생성자 시그니처 변경 — `AuditLogsService` 파라미터 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` 생성자 (라인 ~77-79)
- 상세: `auditLogsService` 파라미터가 다섯 번째로 추가됐다. `WebAuthnController` 는 `AuthModule.controllers` 에 등록돼 있고 `AuthModule` 에 `AuditLogsModule` import 가 추가됐으므로 DI 공급 정상. 신규 테스트 파일(`webauthn.controller.spec.ts`)도 다섯 번째 인자로 mock 을 전달한다.
- 제안: 이상 없음.

---

### [INFO] `WebAuthnController.webauthnDelete` HTTP 응답 형태 유지 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` `webauthnDelete()`
- 상세: 기존에는 `await this.webauthnService.deleteCredential(...)` 결과가 `void` 였고 메서드 자체도 반환값 없이 HTTP 204 를 응답했다. 변경 후 `{ remaining }` 을 구조 분해해 audit log 에만 사용하고 `webauthnDelete` 메서드는 여전히 `return` 없이 종료한다. `@HttpCode(HttpStatus.NO_CONTENT)` 데코레이터가 그대로 유지되므로 HTTP 응답 바디·상태코드에 변화 없다. `remaining` 은 클라이언트로 노출되지 않는다.
- 제안: 이상 없음.

---

### [INFO] `AUDIT_ACTIONS` 상수 객체 확장 — 기존 값 불변
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/audit-logs/audit-action.const.ts`
- 상세: `as const` 객체에 3개 키(`USER_PASSWORD_CHANGED`, `USER_2FA_ENABLED`, `USER_2FA_DISABLED`)가 추가됐다. 기존 키-값 쌍은 전혀 변경되지 않았으므로 기존 소비자(`AuditAction` 타입 참조, 기존 `record` 호출부)에 영향 없다. `AuditAction` union 타입은 `(typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]` 로 파생되므로 자동으로 새 값 3개를 포함하게 된다. 확장만 있고 축소·수정 없음.
- 제안: 이상 없음.

---

### [INFO] `AuditLogsModule` 을 `AuthModule`·`UsersModule` 양쪽에 import — 순환 의존성 위험 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/auth.module.ts` (라인 ~434), `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/users/users.module.ts` (라인 ~950)
- 상세: `UsersModule` 이 `AuditLogsModule` 을 import 하고, `AuthModule` 도 `AuditLogsModule` 을 import 한다. `AuthModule` 은 이미 `UsersModule` 을 import 한다. `AuditLogsModule` 이 `UsersModule` 이나 `AuthModule` 을 역으로 import 하지 않는다면 순환 의존성 없음. 기존에 `auth-configs.service` 등이 이미 `AuditLogsService` 를 사용하고 있어 `AuditLogsModule` 이 독립 모듈임이 확인된다. NestJS 모듈 시스템은 동일 모듈의 이중 import 에 대해 singleton 을 보장하므로 이중 인스턴스 생성 없음.
- 제안: 이상 없음.

---

### [INFO] `plan/complete/` 파일 신규 생성 — 코드 동작 무관
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/plan/complete/spec-draft-audit-workspace-scope.md`, `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/plan/complete/spec-draft-refactor-04-security-drift.md`
- 상세: 두 문서 모두 `plan/complete/` 에 신규 생성됐다. `plan-lifecycle.md` 규약에 따른 의도된 이동이며, 코드 실행 경로·상태·의존성에 영향 없다.
- 제안: 이상 없음.

---

## 요약

이 변경 세트는 `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` 세 감사 액션을 controller 경계에 삽입하는 것으로, 전역 변수·환경 변수·파일시스템·외부 네트워크에 대한 의도치 않은 부작용은 없다. 세 컨트롤러의 생성자 시그니처 변경은 NestJS DI 로 해소되고 테스트도 함께 수정됐으며, `WebAuthnService.deleteCredential` 반환 타입 변경은 유일한 호출자가 함께 수정됐고 HTTP 응답에 영향 없다. `AUDIT_ACTIONS` 상수는 순수 확장이라 기존 소비자에 영향 없다. 핵심 주의사항은 `AuditLogsService.record` 가 try/catch 로 예외를 삼키는 계약을 실제 구현에서 지키고 있어야 한다는 점이다 — 이 계약이 깨지면 2FA 성공 응답·비밀번호 변경 응답이 차단될 수 있으나, spec 문서·인라인 주석·기존 운영 call site 모두 swallow 계약을 명시하고 있어 실질 위험은 낮다.

## 위험도

LOW

STATUS: SUCCESS
