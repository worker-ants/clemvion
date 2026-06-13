### 발견사항

- **[INFO]** `webauthn.service.ts`에 JSDoc 중복 주석 존재
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` 라인 2460-2464
  - 상세: `deleteCredential` 메서드 직전에 구 주석(`/** 개별 삭제. 마지막 credential 이면 user.webauthn_recovery_codes 도 NULL 화. */`)과 신 JSDoc(`/** credential 삭제. 삭제 후 남은 credential 수... */`)이 두 줄로 병치되어 있다. diff에서 구 주석이 삭제되지 않고 남은 것으로, 독자에게 혼란을 줄 수 있다.
  - 제안: 구 단행 주석(`/** 개별 삭제... */`)을 삭제하고 신 JSDoc 하나만 남긴다.

- **[INFO]** `auth.controller.ts`에서 `verify2fa`와 `disable2fa` 두 곳에 감사 로그 블록이 복붙된 구조이나 추상화 없음
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts` 라인 1019-1026, 1035-1042
  - 상세: TOTP 관련 감사 호출 블록(`auditLogsService.record({ workspaceId, userId, action, resourceType, resourceId, details: { method: 'totp' } })`)이 두 메서드에서 패턴이 동일하다. 이 수준의 중복(두 곳, 비슷한 파라미터 구조)은 현재 파일 크기와 범위 내에서 큰 문제는 아니나, 추후 감사 시그니처가 바뀌면 두 곳을 동시에 수정해야 한다.
  - 제안: 허용 범위이나, WebAuthn 측도 포함해 컨트롤러 내 `recordUserAudit(user, action, details?)` 같은 소형 헬퍼를 두면 향후 변경 지점을 단일화할 수 있다. 현재 수준에서는 강제 필요 없음.

- **[INFO]** `webauthn.controller.ts`에 `authContextFromRequest` 함수가 `auth.controller.ts`와 완전 동일하게 중복 정의됨
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` 라인 1518-1523 vs `codebase/backend/src/modules/auth/auth.controller.ts` 라인 1126-1132
  - 상세: 이번 PR에서 새로 추가된 코드는 아니지만, 두 파일 모두 동일한 함수를 각자 선언하고 있다. 이는 기존 코드베이스의 기술 부채로, 이번 변경과 무관하게 공유 유틸로 이동하면 좋다.
  - 제안: `auth/utils/client-ip.ts` 또는 `auth/utils/auth-context.ts`에 공유 함수로 이동. 단, 이번 PR 범위 외 사안이므로 별도 티켓으로 처리 가능.

- **[INFO]** `spec/data-flow/1-audit.md`의 call site 수 카운트(`18개 call site`)가 하드코딩 숫자
  - 위치: `spec/data-flow/1-audit.md` 라인 3352
  - 상세: "7개 위치(4개 service 모듈 + 3개 auth/user controller) 18개 call site 전수"라는 구체적 숫자가 명시되어 있다. call site가 추가될 때마다 이 숫자를 수동으로 갱신해야 한다. 이전에도 동일한 패턴("13개 call site")이 존재했고 이번에 18개로 갱신됐는데, 나중에 숫자가 stale해지면 문서 신뢰도가 떨어진다.
  - 제안: "7개 위치... 18개 call site" 대신 "§1.1 표가 현재 call site 전수" 식으로 표를 SoT로 명시하고 숫자 주장은 제거하거나, "이 숫자는 §1.1 표 행 수와 일치 유지 필요"를 주석으로 명시한다. 단, 이미 Rationale 섹션에 업데이트 관행이 있어 LOW 이하.

- **[INFO]** `users.controller.spec.ts`에서 "should not record an audit log when password change fails"와 "should reject when current password does not match" 두 테스트가 완전히 동일한 시나리오를 다른 이름으로 테스트
  - 위치: `codebase/backend/src/modules/users/users.controller.spec.ts` 라인 2859-2888
  - 상세: 두 테스트 모두 `currentPassword: 'WrongPass1!'`로 비밀번호 불일치 시나리오를 테스트하며, setup 코드(`bcrypt.hash`, `findById.mockResolvedValue`)도 동일하다. 첫 번째는 "auditLogsService.record가 호출되지 않아야 한다"를 단언하고, 두 번째는 "service.update가 호출되지 않아야 한다"를 단언한다.
  - 제안: 두 테스트를 하나로 합치거나, 중복 setup을 제거하고 의도를 명확히 구분한다. 현재 구조는 setup이 2배 반복되어 유지보수 시 한쪽만 수정될 위험이 있다.

### 요약

이번 변경은 `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` 세 감사 액션을 스펙에 맞춰 컨트롤러 경계에 추가한 것으로, 전반적으로 기존 코드베이스의 패턴(AUDIT_ACTIONS const 사용, controller 경계 기록, workspaceId 귀속)을 충실히 준수하고 있다. 주요 유지보수성 문제는 `webauthn.service.ts`의 이중 JSDoc 주석(구 주석 미삭제)과 `users.controller.spec.ts`의 테스트 중복 정도로 낮은 수준이며, `authContextFromRequest` 함수의 이중 선언은 기존 기술 부채다. 코드 구조, 네이밍, 중첩 깊이, 매직 넘버 측면에서 문제가 없고 모듈 구성과 의존성 선언(`AuditLogsModule` import)도 패턴에 일관성 있게 추가됐다. 즉각적인 수정을 요하는 결함은 없다.

### 위험도
LOW
