# Architecture Review

## 발견사항

### **[WARNING]** `UsersController.changePassword` SRP 위반 — 비즈니스 로직이 Controller 에 잔존
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/users/users.controller.ts` `changePassword` 메서드
- 상세: `changePassword` 는 현재 Controller 내에서 (1) 현재 비밀번호 bcrypt.compare 검증, (2) 신규 비밀번호 강도 검증(`validatePasswordStrength`), (3) bcrypt.hash 생성, (4) `usersService.update` 호출, (5) `auditLogsService.record` 감사 기록까지 5가지 책임을 수행한다. Controller 의 본래 책임은 HTTP 요청 바인딩 + 응답 직렬화이며, 비밀번호 검증·해시 로직은 Service 레이어 책임이다. 이번 PR 의 감사 로그 추가(⑤)는 세션 workspaceId 가 Controller 레이어에서만 살아있으므로 Controller 경계 배치가 spec §Rationale 4.1.B 에 근거해 정당화되나, 기존 ①②③④ 의 SRP 위반이 더 두드러지게 드러난다.
- 제안: 중기적으로 `UsersService.changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>` 를 도입해 ①②③④를 Service 로 이전하고, Controller 는 `payload.workspaceId` 추출 + `auditLogsService.record` 만 담당하도록 분리한다. 이번 PR 범위 밖이므로 즉각 수정 필요 없음; 별도 티켓으로 추적 권장.

---

### **[INFO]** Controller 경계 감사 기록 — 레이어 책임 예외이나 근거 명확
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/users/users.controller.ts:156-162`, `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/auth.controller.ts:318-326`, `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/auth.controller.ts:354-362`, `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:144-162`, `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:335-350`
- 상세: `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 감사 이벤트를 Service 가 아닌 Controller 경계에서 기록하는 것은 일반적인 "비즈니스 로직은 Service 에" 원칙의 예외다. 그러나 `workspaceId` 는 JWT 페이로드(`@CurrentUser()`)에서만 추출 가능하고 Service 레이어는 이 세션 컨텍스트를 알지 못하므로, Controller 경계 배치는 spec §Rationale 4.1.B 에 명시적으로 정당화되어 있다. `audit_log.workspaceId`(non-nullable) 제약을 schema 변경 없이 충족하는 유일한 방법이다.
- 제안: 현재 설계 유지. 향후 `user.*` 감사 call site 가 추가될 경우, `buildUserAuditPayload(user: JwtPayload, action: AuditAction, details?: Record<string, unknown>)` 형태의 공통 헬퍼를 `auth/utils/` 에 추출하면 call site 마다 inline 객체를 구성하는 중복을 줄이고 스키마 일관성을 강제할 수 있다. 현재 4개 call site 규모에서는 즉각 필수 아님.

---

### **[INFO]** `WebAuthnService.deleteCredential` 반환 타입 변경 — 도메인 정보 반환으로 ISP 준수
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` `deleteCredential` 메서드
- 상세: `Promise<void>` → `Promise<{ remaining: number }>` 변경은 Controller 가 감사 로그 `details.remainingCredentials` 를 채우기 위해 사용한다. `remaining` 은 Service 내부에서 이미 조회·사용하는 도메인 상태값(마지막 credential 여부 판단, recovery code null 화 결정)이므로, 이를 반환하는 것은 Controller 의 표시 관심사가 Service 인터페이스에 "누출"된 것이 아니라 도메인 결과를 호출자에게 노출하는 자연스러운 패턴이다. Controller 감사 로그 전용 데이터가 아니라 서비스 도메인 계산의 부산물을 재사용하는 것이므로 인터페이스 분리 원칙 위반이 아니다.
- 제안: 현재 설계 유지.

---

### **[INFO]** `AuditLogsModule` 이중 import — 순환 의존성 없음, NestJS singleton 보장
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/auth.module.ts:47`, `/Volumes/project/private/clemvion/codebase/backend/src/modules/users/users.module.ts:3`
- 상세: `AuditLogsModule` 이 `AuthModule`(WebAuthn·TOTP 2FA 감사)과 `UsersModule`(비밀번호 변경 감사) 양쪽에 import 된다. NestJS 모듈 시스템은 전역 singleton 공유를 보장하므로 이중 import 는 이중 인스턴스 생성이나 이중 DB 연결을 초래하지 않는다. 의존 방향은 Auth/Users → AuditLogs 단방향이며, AuditLogs 모듈이 Auth/Users 를 역참조하지 않으므로 순환 의존성 없음.
- 제안: 현재 설계 유지.

---

### **[INFO]** `AUDIT_ACTIONS` const 단일 SoT — 적절한 응집도
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/audit-logs/audit-action.const.ts`
- 상세: 액션 식별자, naming 규약(resource.verb 패턴), 도메인별 verb 시제 규칙, `user.*` workspaceId 귀속 정책, Planned vs 구현 목록이 모두 이 파일 하나에 집중되어 있다. `AuditLogsService.record()` 가 `AuditAction` union 타입으로 호출을 강제하므로 인라인 문자열 사용을 컴파일 타임에 차단한다. 새 action 추가 시 이 파일만 수정하면 되는 단일 진실 원칙이 잘 적용되어 있다.
- 제안: 변경 없음.

---

### **[INFO]** 감사 `details` 스키마 call site inline 정의 — 향후 확장성 제한 가능성
- 위치: `auth.controller.ts`(TOTP, `{ method: 'totp' }`), `webauthn.controller.ts`(등록, `{ method, credentialId, firstCredential }`; 삭제, `{ method, credentialId, remainingCredentials }`)
- 상세: `details` 는 JSONB free-form 필드라 TypeScript 타입 강제가 없으며, 각 call site 마다 inline 객체 리터럴로 정의된다. 현재 3가지 method variant(`totp` 등록/삭제, `webauthn` 등록, `webauthn` 삭제)가 다른 키 구조를 갖는다. 조회측(감사 로그 UI/API)이 `details` 를 파싱할 때 `method` 필드로 분기 처리해야 하며, 향후 새 2FA 방식이 추가될 때 call site 와 읽기측 파서가 동시에 변경되어야 하는 의존성이 암묵적으로 존재한다.
- 제안: 즉각 필수 아님. 향후 2FA 방식 추가 시 `interface UserAuditDetails { method: string }` 공통 base 타입과 각 method 별 narrowed 타입을 정의해두면 call site 타입 가이드 역할을 할 수 있다.

---

### **[INFO]** `authContextFromRequest` 함수 중복 — 기존 기술 부채
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/auth.controller.ts`, `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts`
- 상세: 이번 PR 에서 새로 추가된 코드는 아니지만, 동일한 `authContextFromRequest` 헬퍼 함수가 두 Controller 파일에 각각 독립적으로 정의되어 있다. 이는 모듈 경계(AuthModule 내 WebAuthnModule 서브모듈)를 넘는 공통 유틸의 중복으로, DRY 원칙 위반이자 모듈 경계 정의 미흡이다. 이번 변경과 직접 관련은 없으나, Controller 경계에 감사 기록이 추가되면서 Controller 크기가 커져 이 중복이 더 눈에 띈다.
- 제안: `auth/utils/auth-context.ts` 에 공통 유틸로 추출. 이번 PR 범위 외이므로 별도 티켓으로 분리.

---

## 요약

이번 변경은 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 감사 액션을 spec §4.1 + §Rationale 4.1.B 의 설계대로 Controller 경계에 구현한다. Controller 에서 감사 기록을 수행하는 것은 레이어 책임 원칙의 예외이나, JWT 세션의 `workspaceId` 가 Controller 레이어에서만 접근 가능하다는 도메인 제약이 명확히 문서화되어 있으므로 정당화된다. `AuditLogsModule` 의 단방향 의존 추가, `AUDIT_ACTIONS` const 확장, `WebAuthnService.deleteCredential` 반환 타입 변경 모두 기존 아키텍처 패턴에 일관되게 따른다. 순환 의존성, 레이어 경계 침범(비의도적), 안티패턴은 발견되지 않았다. 주목해야 할 문제는 `UsersController.changePassword` 의 SRP 위반(비밀번호 검증·해시·감사 기록이 Controller 에 혼재)이며, 이는 이번 PR 이전부터 존재하던 기술 부채가 감사 로그 추가로 더 부각된 것이다. 중기적으로 `UsersService.changePassword` 서비스 메서드 도입으로 해소를 권장한다.

## 위험도

LOW

STATUS: SUCCESS
