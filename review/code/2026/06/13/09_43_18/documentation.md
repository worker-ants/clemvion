# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `webauthn.service.ts` `deleteCredential` 메서드 JSDoc 중복 선언
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` diff 기준 `deleteCredential` 메서드 직전
- 상세: diff 에서 기존 단행 JSDoc `/** 개별 삭제. 마지막 credential 이면 user.webauthn_recovery_codes 도 NULL 화. */` 가 삭제 처리(- 라인)로 제거되고 새 블록 JSDoc 이 추가(+ 라인)됐다. 단, 이전 라운드 review 결과(파일 18)와 RESOLUTION.md 에 따르면 이 중복이 실제로 수정됐다고 기술되어 있으나 본 프롬프트의 diff(파일 8) 에서는 구 단행 주석 삭제 라인이 확인되지 않는다. 신 JSDoc 추가만 +로 표시됐고 구 주석 제거 -라인이 없다면 두 주석이 공존하는 상태이며, TypeDoc·IDE는 메서드에 마지막 JSDoc 블록만 귀속시키므로 구 단행 주석은 고아 주석이 되어 가독성을 해친다.
- 제안: 구 단행 `/** 개별 삭제. ... */` 주석 삭제 여부를 재확인한다. 삭제됐다면 문제 없음. 잔존한다면 제거한다.

### [INFO] `spec/data-flow/1-audit.md` Rationale 섹션의 call site 카운트 수정 결과 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/spec/data-flow/1-audit.md` Rationale 섹션 "모든 도메인 service 가 호출하는 cross-cutting concern 서술 폐기" 단락
- 상세: 이전 라운드 documentation.md(파일 18) 에서 "4개 모듈 13개 call site" stale 수치가 지적됐고, RESOLUTION.md 에서 "§1.1 표가 SoT" 로 정정했다고 기술됐다. 파일 27의 diff 를 보면 해당 Rationale 단락이 "실제 writer 는 한정된 위치(워크스페이스 도메인 service + `user.*` 인증 controller)뿐이라 폐기했다 — 정확한 호출자·call site 전수는 §1.1 표가 SoT 다" 로 갱신됐다. 구체적 숫자 주장을 표로 위임하는 방식으로 수정이 완료됐으므로 이 항목은 해소됐다.
- 제안: 추가 조치 불필요. 이 항목은 이미 수정 완료.

### [INFO] `users.module.ts` AuditLogsModule import 사유 주석 추가 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/users/users.module.ts`
- 상세: 이전 라운드 documentation.md(파일 18) 에서 `auth.module.ts` 에는 있는 사유 주석이 `users.module.ts` 에 없다고 지적됐고, RESOLUTION.md 에서 수정 완료로 기술됐다. 파일 11(전체 파일 컨텍스트)을 보면 `imports` 배열 위에 `// AuditLogsModule: UsersController.changePassword 의 user.password_changed 감사 이벤트 기록 (액터 세션 workspaceId 귀속, §Rationale 4.1.B).` 주석이 추가되어 `auth.module.ts` 와 일관성을 갖췄다. 수정 완료.
- 제안: 추가 조치 불필요.

### [INFO] `spec/5-system/1-auth.md` §4.1 구현된 액션 표 행의 셀 길이
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/spec/5-system/1-auth.md` — 파일 26 diff 중 신규 추가 행
- 상세: 추가된 표 행 `| 인증 (워크스페이스 컨텍스트) | user.password_changed, user.2fa_enabled, user.2fa_disabled — 액터의 현재 세션 workspaceId 에 귀속, controller 경계 기록 (users.controller·auth.controller·webauthn.controller). 상세 [data-flow §1.1] + §Rationale 4.1.B |` 이 단일 셀에 귀속 정책·호출 경계·링크를 모두 담아 기존 다른 행(액션명 목록 위주)보다 현저히 길다. 기능적 오류는 아니나 diff 가독성과 표 일관성이 떨어진다.
- 제안: 필수가 아니나 기존 표 스타일(다른 행은 액션명만 기재)에 맞춰 상세 설명을 §Rationale 4.1.B 링크로만 위임하고 셀을 간결화하는 것을 고려. 현재 상태도 기능상 정확하므로 강제하지 않음.

### [INFO] `audit-action.const.ts` 모듈 JSDoc 의 controller 경로 불명확
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/audit-logs/audit-action.const.ts` 모듈 JSDoc
- 상세: `기록은 세션 컨텍스트가 있는 controller 경계(users.controller·auth.controller·webauthn.controller)에서 수행한다` 라는 서술이 정확하나, `users.controller` 와 `auth.controller` 가 다른 디렉터리(`modules/users/` vs `modules/auth/`)에 있음을 모르는 독자에게 동일 경로로 오해를 줄 수 있다. 참조 링크 `(1-auth §4.1 + §Rationale 4.1.B; data-flow/1-audit.md §1.1)` 가 이미 있어 spec 에서 전체 경로를 확인할 수 있으므로 실질 영향은 낮다.
- 제안: 기존 참조 링크로 충분히 해소 가능하므로 추가 조치 필수 아님. 필요하다면 각 controller 명에 짧은 경로(`modules/users/`·`modules/auth/`)를 병기하면 명확도 향상.

### [INFO] `auth.module.ts` AuditLogsModule import 주석의 WebAuthn 범위 언급
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/auth.module.ts` 파일 4 diff
- 상세: 추가된 주석 `// user.* 인증 감사 이벤트(2fa enable/disable·WebAuthn 등록/삭제)를 AuthController·WebAuthnController 가 기록 — 둘 다 AuthModule host (§Rationale 4.1.B).` 은 scope 를 명확히 설명한다. 정확하고 충분하다.
- 제안: 변경 없음.

### [INFO] `webauthn.controller.ts` `webauthnRegisterVerify` 인라인 주석 — firstCredential 판별 로직 설명
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` diff 파일 6
- 상세: `// [Spec Auth §4.1 / Rationale 4.1.B] WebAuthn credential 등록 = 2FA enabled. 액터의 현재 세션 workspaceId 에 귀속. 첫 등록 여부는 복구 코드 발급 여부(첫 등록에만 반환)로 판별한다.` 주석이 비직관적인 `result.webauthnRecoveryCodes.length > 0` 판별 로직을 충분히 설명한다. 복잡한 로직에 대한 인라인 주석 요건을 충족한다.
- 제안: 변경 없음.

### [INFO] `spec/data-flow/1-audit.md` §1.1 표의 call site 숫자 하드코딩 잔존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/spec/data-flow/1-audit.md` §1.1 본문 "7개 위치(4개 service 모듈 + 3개 auth/user controller) 18개 call site 전수"
- 상세: Rationale 의 숫자 주장은 표로 위임됐으나 §1.1 본문 자체에는 여전히 "18개 call site" 숫자가 하드코딩돼 있다. 향후 call site 추가 시 이 숫자도 stale 해질 수 있다. 이전 라운드(파일 19 maintainability.md)에서 동일 지적이 있었고 Rationale 쪽 숫자는 제거됐으나 §1.1 본문 숫자는 그대로다.
- 제안: 강제 사항 아님. §1.1 표 자체가 SoT 이므로 본문 도입 문장의 숫자도 "§1.1 표가 현재 구현 전수" 식으로 대체하면 stale 위험을 완전히 제거할 수 있다. 현 상태도 18개 이 정확한 시점 카운트라 기능상 문제 없음.

## 요약

이번 변경은 `user.*` 감사 액션(password_changed, 2fa_enabled, 2fa_disabled) 구현과 spec 반영으로 구성된다. 코드 변경에 대한 인라인 주석은 `[Spec Auth §4.1 / Rationale 4.1.B]` 형식으로 일관되게 달려 있고 `audit-action.const.ts` 모듈 JSDoc 이 새 액션의 귀속 정책(controller 경계, 세션 workspaceId)을 상세히 설명하며 `spec/data-flow/1-audit.md` 와 `spec/5-system/1-auth.md` 의 관련 표도 현재 구현을 반영해 갱신됐다. 이전 라운드에서 지적된 두 건(users.module.ts 주석 부재, Rationale 구 숫자 stale)은 RESOLUTION.md 기준으로 이미 수정됐다. 남은 항목은 전부 INFO 수준이며 기능 정확성에 영향이 없다: webauthn.service.ts deleteCredential 구 단행 JSDoc 중복 잔존 여부 재확인, spec/5-system/1-auth.md 표 셀 장황함, spec/data-flow/1-audit.md §1.1 본문 숫자 하드코딩이 향후 stale 위험을 가지는 정도다.

## 위험도

LOW

STATUS: SUCCESS
