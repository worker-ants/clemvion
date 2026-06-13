# Architecture Review

## 발견사항

### **[INFO]** Controller 경계에서의 감사 로그 기록 — 의도된 설계이나 레이어 책임 경계 주목 필요
- 위치: `users.controller.ts:155-161`, `auth.controller.ts:308-326`, `webauthn.controller.ts:144-162`, `webauthn.controller.ts:335-350`
- 상세: `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 감사 이벤트를 Service 가 아닌 Controller 경계에서 기록하는 것은 spec §Rationale 4.1.B 에 명시된 **의도된 결정**이다. 이유는 `workspaceId` 가 JWT 세션(Controller 레이어)에서만 살아있고, Service 레이어가 그 컨텍스트를 모르기 때문이다. 따라서 일반적인 "비즈니스 로직은 Service 에" 원칙의 예외이지만 그 근거가 명확하다.
  - 다만 이로 인해 동일한 `auditLogsService.record(...)` 패턴이 3개 Controller(7개 call site)에 반복된다. 향후 `user.*` 계열 감사 액션이 더 늘어나면 중복 코드가 증가할 수 있다.
- 제안: 현재 규모에서는 수용 가능하다. 만약 `user.*` 감사 call site 가 더 늘어날 경우, `audit payload 빌더` 헬퍼(예: `buildUserAuditPayload(user: JwtPayload, action, details?)`)를 공통 util 로 추출하면 call site 가 늘어도 스키마 일관성을 유지할 수 있다.

---

### **[INFO]** `WebAuthnService.deleteCredential` 반환 타입 변경 — 인터페이스 분리 관점
- 위치: `webauthn.service.ts:931-932` (diff 기준), 전체 파일 `2466-2487`
- 상세: 기존 `Promise<void>` → `Promise<{ remaining: number }>` 변경은 Controller 가 감사 로그 `details.remainingCredentials` 를 채우기 위해 필요한 정보를 Service 로부터 받는 구조다. Service 반환값에 Controller 의 표시 관심사(감사 details 내용)가 흘러들어오지 않도록 `remaining` 을 Service 의 본래 도메인 상태(마지막 credential 여부 판단, recovery code null 화 로직)로도 사용하므로, 이 정보는 실제로 도메인적으로도 의미 있다. 과도한 결합 없이 자연스러운 변경이다.
- 제안: 현재 설계 유지. `remaining` 은 감사 전용 데이터가 아니라 서비스 도메인 결과이므로 책임 혼선 없음.

---

### **[INFO]** `AuditLogsModule` 가 두 모듈(`AuthModule`, `UsersModule`)에 각각 import — 모듈 의존성 정상
- 위치: `auth.module.ts:47-48`, `users.module.ts:3-4`
- 상세: `AuditLogsModule` 이 `AuthModule` 과 `UsersModule` 양쪽에 import 된다. NestJS 의 모듈 시스템은 singleton 공유를 보장하므로 이중 import 는 이중 인스턴스를 생성하지 않는다. 단방향 의존(Auth/Users → AuditLogs)이므로 순환 참조 없음.
- 제안: 현재 설계 유지.

---

### **[INFO]** `AUDIT_ACTIONS` const 파일의 주석 문서가 설계 결정을 직접 포함 — 적절한 응집도
- 위치: `audit-action.const.ts` 전체
- 상세: action 의 도메인 규약(naming 규약, user.* 의 workspaceId 귀속 정책, Planned vs 구현 목록)을 const 파일 JSDoc 에 담고 있다. 이 파일이 단일 SoT 임을 강화하는 좋은 패턴이다. 향후 Planned 액션 목록과 구현 상태가 sync out-of-date 될 위험이 있으나, spec 파일과 양쪽에서 유지하는 구조이므로 허용 가능.
- 제안: 변경 없음.

---

### **[WARNING]** `users.controller.ts`의 비밀번호 해시·검증 로직이 Controller 에 잔존 — SRP 부분 위반
- 위치: `users.controller.ts:3019-3150` (전체 파일), 특히 `bcrypt.hash`, `bcrypt.compare`, `validatePasswordStrength` 호출
- 상세: 이번 변경(감사 로그 추가)과 직접 관련은 없으나, `changePassword` 의 비밀번호 검증·해시 로직이 Controller 에 위치해 있는 기존 문제가 감사 로그 추가로 더 두드러진다. Controller 가 HTTP 요청 바인딩, 입력 검증, 비즈니스 로직(비밀번호 검증·해시), 감사 로그까지 모두 담당하고 있어 단일 책임 원칙을 위반한다.
  - 이번 PR 의 감사 로그 기록 자체는 올바른 위치(세션 컨텍스트가 있는 Controller 경계)에 배치됐으나, `usersService.changePassword()` 같은 서비스 메서드가 없어 비즈니스 로직이 Controller 에 남아있다.
- 제안: 중기적으로 `UsersService.changePassword(userId, currentPassword, newPassword): Promise<void>` 를 도입해 해시·검증 로직을 Service 로 이전하고, Controller 는 세션 `workspaceId` 추출 + 감사 기록만 담당하도록 분리를 권장한다. 이번 PR 범위 밖이므로 즉각 수정 필요는 아니다.

---

### **[INFO]** WebAuthn credential 삭제 시 응답 없음(204) 이지만 감사 로그는 await — 정상
- 위치: `webauthn.controller.ts:1781-1813`
- 상세: `@HttpCode(HttpStatus.NO_CONTENT)` 이며 반환값 없는 메서드에서 감사 로그를 `await` 한다. `record()` 는 spec 계약상 실패를 삼키므로 HTTP 응답에 영향 없다. `await` 를 붙인 것은 data-flow §1.2 의 "삼키되 await" 계약 준수다.
- 제안: 변경 없음.

---

### **[INFO]** 감사 로그 call site 의 `details` 구조가 method 별로 다름 — 확장성 관점
- 위치: `auth.controller.ts:1019-1026`, `webauthn.controller.ts:1418-1423`, `webauthn.controller.ts:1444-1449`
- 상세: TOTP 경로는 `{ method: 'totp' }`, WebAuthn 등록은 `{ method: 'webauthn', credentialId, firstCredential }`, WebAuthn 삭제는 `{ method: 'webauthn', credentialId, remainingCredentials }` 로 details 스키마가 call site 마다 inline 정의된다. `details` 는 JSONB free-form 이어서 타입 강제가 없다. 조회측(audit log UI/API)이 `details` 를 파싱할 때 method 별로 분기 처리가 필요하다.
  - 현재는 3개 call site 로 관리 가능하지만, 향후 2FA 방식이 추가될 때 call site 와 읽기측 파서가 모두 변경되어야 한다.
- 제안: `user.2fa_*` details 의 공통 base 타입(`{ method: string }`)을 인터페이스로 정의해두면 향후 타입 가이드로 활용할 수 있다. 즉각 필수 사항은 아니다.

---

## 요약

이번 변경은 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 감사 액션을 spec §4.1의 설계대로 controller 경계에 구현한다. 핵심 아키텍처 결정(감사 기록을 Service 가 아닌 JWT 세션이 살아있는 Controller 경계에서 수행)은 spec §Rationale 4.1.B 에 명시적으로 정당화되어 있으며, `AuditLogsModule` 의 단방향 의존 추가와 `AUDIT_ACTIONS` const 확장은 기존 설계 패턴에 일관되게 따른다. `WebAuthnService.deleteCredential`의 반환 타입 변경도 도메인적으로 자연스럽다. 주목할 기존 문제는 `UsersController.changePassword`가 비밀번호 해시·검증·감사 기록을 모두 담당하는 SRP 위반이나, 이는 이번 PR 이전부터 존재하던 문제이고 감사 기록은 올바른 위치에 배치됐다. 순환 의존성, 레이어 경계 침범, 안티패턴은 발견되지 않았다.

## 위험도

LOW

STATUS: SUCCESS
