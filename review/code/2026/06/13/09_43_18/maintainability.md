### 발견사항

- **[INFO]** `webauthn.service.ts` `deleteCredential` 메서드 위에 구 단행 JSDoc 잔존
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` `deleteCredential` 메서드 직전
  - 상세: 변경 전 단행 주석(`/** 개별 삭제. 마지막 credential 이면 user.webauthn_recovery_codes 도 NULL 화. */`)이 삭제되지 않은 채 새 JSDoc 블록이 추가됐다. TypeDoc 등 문서 생성 도구는 마지막 JSDoc 블록만 메서드에 귀속하므로 구 주석은 고아가 되어 가독성을 해친다.
  - 제안: 구 단행 주석을 삭제하고 새 JSDoc 블록 하나만 남긴다.

- **[INFO]** `auth.controller.ts` `verify2fa` · `disable2fa` 두 메서드에 동일 패턴 감사 블록 반복
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/auth.controller.ts` `verify2fa` (신규 블록) · `disable2fa` (신규 블록)
  - 상세: 두 메서드 모두 `auditLogsService.record({ workspaceId: user.workspaceId, userId: user.sub, action: ..., resourceType: 'user', resourceId: user.sub, details: { method: 'totp' } })` 패턴을 인라인으로 반복한다. 현재 두 곳이라 허용 가능하지만, 향후 `user.*` 액션이 추가되거나 `record` 시그니처가 바뀌면 두 곳을 동시 수정해야 한다.
  - 제안: 현재 수준에서는 강제 필요 없음. 향후 call site 가 늘어나면 `private recordUserAudit(user: JwtPayload, action: AuditAction, details?: object)` 형태의 소형 헬퍼로 추출을 고려한다.

- **[INFO]** `webauthn.controller.ts`에 `authContextFromRequest` 함수가 `auth.controller.ts`와 완전 동일하게 중복 선언됨
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` (함수 선언) vs `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/auth.controller.ts` (함수 선언)
  - 상세: 이번 PR 에서 새로 추가된 코드가 아닌 기존 기술 부채다. 그러나 이번 PR 에서 두 컨트롤러 모두 수정됐으므로 언급 가치가 있다. 동일 함수가 두 파일에 존재하면 한쪽만 수정될 위험이 있다.
  - 제안: `codebase/backend/src/modules/auth/utils/auth-context.ts` 같은 공유 util 로 이동. 본 PR 범위 밖이므로 별도 티켓으로 처리.

- **[INFO]** `users.controller.spec.ts` 에 비밀번호 불일치 시나리오 테스트 setup 중복
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/users/users.controller.spec.ts` — "should not record an audit log when password change fails" 와 "should reject when current password does not match" 두 케이스
  - 상세: 두 테스트 모두 `bcrypt.hash('OldP@ssw0rd1', 4)` + `findById.mockResolvedValue` setup 이 동일하다. 전자는 `auditLogsService.record` 미호출, 후자는 `service.update` 미호출을 단언한다. 단언 목적은 다르지만 시나리오 setup 이 완전히 중복되어 유지보수 시 한쪽만 갱신되는 드리프트 위험이 있다.
  - 제안: 두 단언을 하나의 `it` 블록으로 합치거나, `beforeEach` 블록에 공통 setup 을 추출해 중복 제거한다.

- **[INFO]** `spec/data-flow/1-audit.md` Rationale 섹션에 구 call site 카운트 하드코딩 잔존
  - 위치: `/Volumes/project/private/clemvion/spec/data-flow/1-audit.md` Rationale 마지막 단락 ("모든 도메인 service 가 호출하는 cross-cutting concern" 섹션)
  - 상세: 본문 §1.1 은 "7개 위치 18개 call site" 로 갱신됐으나, Rationale 마지막 문장에 "4개 모듈 13개 call site 뿐" 이라는 구 숫자가 남아 있다. 향후 call site 가 추가될 때마다 하드코딩 숫자를 수동 갱신해야 하는 구조 자체도 stale 위험을 내포한다.
  - 제안: Rationale 문장의 숫자를 삭제하고 "§1.1 표가 현재 call site 의 단일 진실" 로 대체해 숫자 주장 없이 링크만 남긴다.

- **[INFO]** `users.module.ts` 에 `AuditLogsModule` import 이유 주석 부재 — `auth.module.ts` 와 일관성 불일치
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/users/users.module.ts`
  - 상세: `auth.module.ts` 는 `AuditLogsModule` import 옆에 사유 주석이 달려 있으나, `users.module.ts` 는 없다. 동일 모듈을 동일한 이유로 import 하는 두 파일 간 일관성이 깨진다. (해당 PR 의 RESOLUTION 에서 이미 Fix 됐다고 표시되어 있으므로, 실제 파일이 갱신됐는지 확인 필요.)
  - 제안: `// user.password_changed 감사 이벤트 기록 — UsersController.changePassword (§Rationale 4.1.B)` 수준의 단행 주석을 추가한다.

- **[INFO]** `auth.controller.spec.ts` `it` 블록 내부에서 `bcrypt.hash` 직접 호출 (round=4)
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/auth.controller.spec.ts` — "records user.2fa_disabled on disable2fa after password reconfirm" 및 "does not record an audit log when disable2fa password is wrong" 케이스
  - 상세: 두 `it` 블록 각각에서 `await bcrypt.hash('OldP@ssw0rd1', 4)` 를 독립적으로 호출한다. round=4 라 영향은 미미하지만 동일 해시를 두 번 생성하는 비용 중복이며, 값 변경 시 두 곳을 동시 수정해야 한다.
  - 제안: `beforeAll` 또는 `beforeEach` 에서 해시를 한 번 생성해 재사용한다. 기능 영향 없으므로 필수 아님.

### 요약

이번 변경(`user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` 감사 액션 구현)은 기존 코드베이스의 패턴(`AUDIT_ACTIONS` const 참조, controller 경계 기록, workspaceId 세션 귀속)을 충실히 준수하여 일관성이 높다. 네이밍은 spec 에 명시된 도메인 규약을 그대로 따르고, 함수 길이·중첩 깊이·매직 넘버 관점에서 새로 도입된 코드에 문제는 없다. 모듈 배선(`AuditLogsModule` import)도 기존 패턴을 따른다. 유지보수성 관점의 주요 문제는 (1) `webauthn.service.ts` 고아 단행 JSDoc, (2) `users.controller.spec.ts` 중복 테스트 setup, (3) `spec/data-flow/1-audit.md` Rationale 하드코딩 숫자 stale, (4) `authContextFromRequest` 함수 이중 선언(기존 부채) 으로, 모두 INFO 수준이며 즉각 운영 영향은 없다. Critical 또는 Warning 수준의 유지보수성 결함은 발견되지 않았다.

### 위험도

LOW

STATUS: SUCCESS
