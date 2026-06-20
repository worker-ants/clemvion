# Documentation Review — refactor-auth-reverify-unify

## 발견사항

### **[INFO]** `verifyReauth` JSDoc 의 "bcrypt 검증" 표현이 `comparePassword` 위임 후에도 유지됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-auth-reverify-unify/codebase/backend/src/modules/auth/sessions.service.ts` L271
- 상세: `verifyReauth` 의 JSDoc 우선순위 항목 1번에 `bcrypt 검증` 이라고 명시되어 있다. 코드는 이미 `comparePassword` 헬퍼로 위임되어 있으나 주석은 원래 라이브러리 이름을 그대로 사용한다. 기술적으로는 동작이 동일하지만 `sessions.service.ts` 와 달리 `auth.service.ts` 는 `comparePassword` 헬퍼를 사용한다는 사실을 doc에 반영하면 일관성이 높아진다.
- 제안: "→ bcrypt 검증" → "→ `comparePassword` 헬퍼로 검증" 으로 수정.

### **[INFO]** `webauthn.controller.ts` `webauthnRegenerateRecovery` 메서드에 인라인 주석만 있고 Swagger ApiOperation 설명은 이전 13줄 블록 로직을 암묵적으로 기술
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-auth-reverify-unify/codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` L1109-L1128
- 상세: `@ApiOperation` description("비밀번호 재확인 후 기존 미사용 복구 코드를 폐기하고 10개를 새로 발급합니다.") 은 동작을 정확하게 설명하지만, 변경 후 비밀번호 재확인의 구현 경로(`AuthService.verifyPasswordForUser` 위임)는 메서드 본문 인라인 주석에서만 설명된다. 공개 API 관점에서 Swagger 설명 자체는 충분하나, 추가 개발자용 메서드 수준 JSDoc(`@see` or `@remarks`)은 없다.
- 제안: 현재 인라인 주석(`[refactor 02 C-3 §3]`)이 충분하므로 비차단 수준. 선택적으로 메서드 위에 JSDoc 블록으로 격상 가능.

### **[INFO]** `spec/data-flow/2-auth.md` §1.2 다이어그램이 `verifyPasswordForUser` 위임 흐름을 미반영
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-auth-reverify-unify/spec/data-flow/2-auth.md` L73 (`bcrypt.compare(password, password_hash)` mermaid 노트), 그리고 WebAuthn regenerate 흐름 미문서화 구간
- 상세: 이번 변경(C-3 §3)으로 `webauthn.controller.ts` 의 `webauthnRegenerateRecovery` 가 raw bcrypt 대신 `AuthService.verifyPasswordForUser` 를 위임한다. `data-flow/2-auth.md` §1.2 다이어그램의 `bcrypt.compare` 노드는 login 흐름 전용이라 직접 오탐은 아니지만, WebAuthn 복구 코드 재발급 시 비밀번호 재확인 흐름(`POST /auth/2fa/webauthn/recovery-codes/regenerate → AuthService.verifyPasswordForUser → WebAuthnService.regenerateRecoveryCodes`)이 spec 어디에도 시퀀스로 문서화되어 있지 않다. plan 파일에서도 "spec 문서(planner): data-flow/2-auth §1.2 verifyPasswordForUser 흐름 + error-codes 등재" 를 후속으로 명시했다.
- 제안: 본 변경 범위 밖의 후속 플래너 작업(plan 파일에 이미 기록됨). 비차단.

### **[INFO]** plan 파일 "범위 밖 / 후속" 섹션이 spec 변경을 명확하게 플래너에 위임하고 있으나 추적 링크 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-auth-reverify-unify/plan/in-progress/refactor-auth-reverify-unify.md` L48-L50
- 상세: "spec 문서(planner): data-flow/2-auth §1.2 verifyPasswordForUser 흐름 + error-codes 등재" 가 후속으로 명시됐으나, 담당 플래너 plan 파일 경로나 이슈 번호가 없어 완료 추적이 어렵다.
- 제안: 비차단. 후속 플래너 작업 생성 시 해당 plan 파일에서 역참조 추가.

---

## 요약

이번 변경(webauthn.controller.ts raw bcrypt → `AuthService.verifyPasswordForUser` 위임, sessions.service.ts `bcrypt.compare` → `comparePassword` 헬퍼 일치화)은 문서화 수준이 전반적으로 양호하다. 변경된 세 파일 모두 JSDoc 또는 인라인 주석으로 변경 의도(`[refactor 02 C-3 §3]` 참조)와 설계 근거를 명확히 기술한다. 테스트 파일에도 변경 목적이 주석으로 남아 있다. 유일한 미완 항목은 `verifyReauth` JSDoc 의 "bcrypt 검증" 표현 소폭 구식화와 `spec/data-flow/2-auth.md` 의 WebAuthn regenerate 흐름 미등재이나, 전자는 동작 동일성 때문에 기능 정확도에 무해하고 후자는 plan 파일에 후속 플래너 작업으로 이미 위임 기록된 상태다. 발견된 사항은 모두 INFO 수준이며 릴리즈 차단 요소 없다.

## 위험도

NONE
