# 부작용(Side Effect) Review

## 발견사항

### [INFO] `WebAuthnService.deleteCredential` 반환 타입 변경 — 기존 호출자 영향 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` `deleteCredential()`
- 상세: 반환 타입이 `Promise<void>` → `Promise<{ remaining: number }>` 로 변경됐다. 이는 시그니처 변경이나, 현재 코드베이스에서 `deleteCredential` 을 호출하는 곳은 `WebAuthnController.webauthnDelete` 단독이며 이 호출자는 이미 새 반환값을 `{ remaining }` 으로 구조 분해해 사용하도록 함께 수정됐다. 기존에 반환값을 무시하던 `void` 호출 패턴에서 누락 호출자는 확인되지 않는다.
- 제안: 코드베이스 전체에 `deleteCredential` 을 호출하는 다른 경로가 없는지 grep 으로 한 번 확인하는 것이 안전하다. 단, 현재 diff 범위 내에서는 문제 없음.

### [INFO] `AuthController` 생성자 시그니처 변경 — `AuditLogsService` 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/auth.controller.ts` 생성자
- 상세: `auditLogsService: AuditLogsService` 가 마지막 파라미터로 추가됐다. NestJS DI 컨테이너를 통해 주입되므로 직접 `new AuthController(...)` 를 호출하는 코드가 없다면 런타임 영향은 없다. 테스트 파일(`auth.controller.spec.ts`)은 이미 `auditLogsService` 를 여섯 번째 인자로 전달하도록 수정됐다. DI 경로에서의 공급은 `auth.module.ts` 에 `AuditLogsModule` import 가 추가됐으므로 정상이다.
- 제안: 이상 없음.

### [INFO] `UsersController` 생성자 시그니처 변경 — `AuditLogsService` 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/users/users.controller.ts` 생성자
- 상세: 기존 단일 인자(`usersService`) 에서 `auditLogsService` 가 추가됐다. `users.module.ts` 에 `AuditLogsModule` import 가 추가됐고 테스트도 같이 수정됐다. NestJS DI 경로 정상.
- 제안: 이상 없음.

### [INFO] `WebAuthnController` 생성자 시그니처 변경 — `AuditLogsService` 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` 생성자
- 상세: `auditLogsService` 파라미터가 마지막에 추가됐다. `WebAuthnModule` 은 `AuthModule` 내에 host 되고 `AuthModule` 에 `AuditLogsModule` import 가 추가됐으므로 DI 공급 가능. `webauthn.controller.spec.ts` 도 다섯 번째 인자로 `auditLogsService` 를 전달하도록 수정됐다.
- 제안: 이상 없음.

### [INFO] `WebAuthnController.webauthnDelete` 응답 변경 — 기존 HTTP 응답 형태 유지
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` `webauthnDelete()`
- 상세: 기존 `await this.webauthnService.deleteCredential(...)` 결과가 `void` 였으므로 반환값 없이 HTTP 204 를 응답했다. 변경 후에도 `webauthnDelete` 메서드 자체는 아무것도 `return` 하지 않으므로 HTTP 응답 바디·상태 코드(`@HttpCode(HttpStatus.NO_CONTENT)`)는 동일하게 유지된다. `{ remaining }` 은 audit log 에만 쓰이고 클라이언트로 노출되지 않는다.
- 제안: 이상 없음.

### [WARNING] `verify2fa` 에서 audit log 실패 시 응답 차단 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/auth.controller.ts` `verify2fa()` (라인 ~319), `disable2fa()` (라인 ~364)
- 상세: `await this.auditLogsService.record(...)` 호출이 `return { data: ... }` 앞에 위치한다. `AuditLogsService.record` 가 내부적으로 예외를 삼키는(swallow) 구현인지 여부가 핵심이다. `spec/data-flow/1-audit.md` 의 Overview 설명("두 `record` 모두 실패를 삼킨다 — 감사 기록 실패가 주 동작을 깨서는 안 된다는 계약")에 따르면 삼키는 구현이 계약이나, `users.controller.ts` 의 주석도 동일하게 "record 는 내부적으로 실패를 삼켜 주 동작을 깨지 않는다"고 명시한다. 만약 실제 `AuditLogsService.record` 구현이 계약대로 예외를 삼키지 않는다면 2FA 성공 응답이 차단될 수 있다. 이 변경은 기존에 감사 기록이 없던 경로에 새 `await` 호출을 추가하므로, AuditLogsService.record 구현 계약이 실제로 지켜지고 있는지 확인이 필요하다.
- 제안: `AuditLogsService.record` 구현에서 try/catch로 예외가 삼켜지고 있음을 명시적으로 검증할 것. diff 에 해당 구현 파일이 포함되어 있지 않아 직접 확인 불가. 기존 audit 기록 경로(integrations.service 등)가 이미 같은 방식으로 동작하고 있다면 문제없음.

### [INFO] `AUDIT_ACTIONS` 상수 객체 확장 — 기존 값 불변
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/audit-logs/audit-action.const.ts`
- 상세: `as const` 객체에 3개 키(`USER_PASSWORD_CHANGED`, `USER_2FA_ENABLED`, `USER_2FA_DISABLED`)가 추가됐다. 기존 키-값 쌍은 전혀 변경되지 않았으므로 기존 소비자(`AuditAction` 타입, `record` 호출부)에 영향 없다. `AuditAction` union 타입은 `[keyof typeof AUDIT_ACTIONS]` 로 파생되므로 자동으로 새 값 3개를 포함하게 된다.
- 제안: 이상 없음.

### [INFO] 모듈 임포트 추가 — 순환 의존성 가능성 확인 필요
- 위치: `users.module.ts`, `auth.module.ts`
- 상세: `UsersModule` 이 `AuditLogsModule` 을 import 하고, `AuthModule` 도 `AuditLogsModule` 을 import 한다. `AuthModule` 은 이미 `UsersModule` 을 import 하고 있다. `AuditLogsModule` 이 `UsersModule` 이나 `AuthModule` 을 역으로 import 하지 않는다면 순환 의존성 문제 없음. diff 에 `AuditLogsModule` 정의가 포함되어 있지 않지만, 기존에도 `auth-configs.service` 등이 `AuditLogsService` 를 사용하고 있어 `AuditLogsModule` 이 이미 독립 모듈임이 확인된다.
- 제안: 이상 없음.

### [INFO] 계획 문서(plan/complete/) 이동 — 파일시스템 부작용 없음
- 위치: `plan/complete/spec-draft-audit-workspace-scope.md`, `plan/complete/spec-draft-refactor-04-security-drift.md`
- 상세: 두 문서 모두 `plan/complete/` 로 이동(신규 파일 생성)되고 frontmatter 에 `completed` 날짜와 `spec_impact` 가 추가됐다. 이는 plan 라이프사이클 정책(`plan-lifecycle.md`)에 따른 의도된 이동이며 코드 동작에 영향 없다.
- 제안: 이상 없음.

## 요약

이 변경 세트는 `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` 세 감사 액션을 `AUDIT_ACTIONS` 상수에 추가하고, `UsersController.changePassword`, `AuthController.verify2fa/disable2fa`, `WebAuthnController.webauthnRegisterVerify/webauthnDelete` 에 감사 기록 호출을 삽입한다. 전역 변수·환경 변수·파일시스템·네트워크에 대한 의도치 않은 부작용은 없다. 변경된 생성자 시그니처(세 컨트롤러 모두)는 NestJS DI로 해소되고 테스트도 함께 수정됐다. `WebAuthnService.deleteCredential` 반환 타입 변경(`void` → `{ remaining: number }`)은 유일한 호출자(`WebAuthnController`)가 함께 수정됐고 HTTP 응답 형태는 동일하게 유지된다. 핵심 주의사항은 `AuditLogsService.record` 가 실패 시 예외를 삼키는 계약을 실제로 지키고 있어야 한다는 점으로, 이 계약이 깨지면 2FA 성공 응답이 차단될 수 있으나, 기존 사용 패턴과 spec 문서가 이를 보장하는 계약으로 명시하고 있어 HIGH 위험으로 보기는 어렵다.

## 위험도

LOW
