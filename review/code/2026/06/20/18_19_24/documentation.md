### 발견사항

- **[INFO]** `sessions.service.ts` `verifyReauth` JSDoc 코멘트 갱신 불완전
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-auth-reverify-unify/codebase/backend/src/modules/auth/sessions.service.ts` L789-799 (private `verifyReauth` 메서드 JSDoc)
  - 상세: JSDoc 1번 항목이 `comparePassword 헬퍼로 검증`으로 업데이트되어 변경 내용이 반영되었다. 그러나 JSDoc은 `comparePassword`가 무엇인지(어디서 왔는지)를 설명하지 않으며, `password.util`에서 import된 헬퍼임을 명시하지 않는다. 단순 설명 수준이라 비차단이지만 유틸리티의 출처·역할(bcrypt 래퍼)을 한 줄 첨언하면 가독성이 향상된다.
  - 제안: `comparePassword` JSDoc 또는 `@see ../../common/utils/password.util` 참조 주석 추가

- **[INFO]** `revokeFamily` JSDoc에 5번째 파라미터(`currentRefreshToken`) 설명은 있으나 `@param` 태그가 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-auth-reverify-unify/codebase/backend/src/modules/auth/sessions.service.ts` L642-647
  - 상세: 메서드 설명 블록에 `currentRefreshToken` 의 역할(self-revoke 차단)이 서술형으로 적혀 있지만 NestJS/TSDoc 표준의 `@param` 태그로 구조화되어 있지 않다. `listActiveSessions`도 동일하게 `@param` 없음. 일관성 차원에서 INFO 수준.
  - 제안: `@param userId`, `@param familyId`, `@param auth`, `@param ctx`, `@param currentRefreshToken - null이면 self-revoke 검사 생략` 형식의 @param 태그 추가

- **[INFO]** `webauthn.controller.ts` `webauthnRegenerateRecovery` 메서드 인라인 주석이 API 문서(`@ApiUnauthorizedResponse`)와 범위가 다름
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-auth-reverify-unify/codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` L1638-1660
  - 상세: 기존 코드에서는 `PASSWORD_REQUIRED`(비밀번호 없는 경우)와 `PASSWORD_INVALID`(틀린 경우) 두 종류의 401을 직접 던졌다. 리팩터 후 `AuthService.verifyPasswordForUser`에 위임되었으므로, `@ApiUnauthorizedResponse` 설명("비밀번호 불일치 또는 토큰 만료")이 `PASSWORD_REQUIRED` 케이스도 포함하는지 명확하지 않다. 에러 코드가 동일하게 보존됐다는 것은 plan 문서에 명시되어 있으나 Swagger 문서 자체에는 이 두 케이스가 노출되지 않는다.
  - 제안: `@ApiUnauthorizedResponse`의 `description`을 `'비밀번호 미설정(PASSWORD_REQUIRED), 불일치(PASSWORD_INVALID), 또는 토큰 만료'`처럼 세분화하거나, 최소한 `@ApiUnauthorizedResponse` 에 두 401 코드를 예시로 추가

- **[INFO]** `sessions.service.spec.ts` 새 테스트 케이스의 인라인 주석 참조 태그가 이 파일에만 국한됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-auth-reverify-unify/codebase/backend/src/modules/auth/sessions.service.spec.ts` L94-95
  - 상세: `// [ai-review C-3 §3 W#2/W#3]` 참조 태그가 `sessions.service.spec.ts`에 삽입되어 있다. 이 태그는 왜 이 테스트가 추가되었는지의 맥락을 제공하는 유용한 근거이나, `webauthn.controller.spec.ts`의 신규 테스트 블록에도 동일 형태의 태그(`[refactor 02 C-3 §3]`)가 있어 두 파일 간 태그 스타일이 미묘하게 다르다(`C-3 §3` vs `refactor 02 C-3 §3`). 사소한 일관성 문제.
  - 제안: 팀 내 ai-review 태그 명명 규약 통일 (e.g., 항상 `[refactor XX C-Y §Z]` 형식) — 현재 내용상 오류는 없음

- **[INFO]** plan 문서의 "범위 밖/후속" 섹션에 spec 문서 업데이트 필요성이 명시되어 있으나 실제 spec 파일은 미변경
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-auth-reverify-unify/plan/in-progress/refactor-auth-reverify-unify.md` L1735-1741
  - 상세: `data-flow/2-auth.md §1.2`, `spec/5-system/3-error-handling.md §1`, `1-auth.md` 등 여러 spec 문서에 업데이트 필요가 인식되어 있고 plan에 명확히 기록되어 있다. 이 changeset이 behavior-preserving 리팩터이고 spec drift가 INFO 수준(비차단)으로 처리된 점은 합리적이다. 단, 후속 플래너 작업이 실행되지 않으면 spec-impl 갭이 누적된다.
  - 제안: plan 항목이 complete로 이동될 때 spec 업데이트 플래너 작업을 별도 plan으로 분기하거나 해당 spec 파일에 `<!-- TODO: verifyPasswordForUser 위임 경로 등재 필요 -->` 형태의 마커 추가 검토

### 요약

이번 변경은 `bcrypt.compare` 직접 호출을 `comparePassword` 헬퍼 또는 `AuthService.verifyPasswordForUser`로 일원화하는 behavior-preserving 리팩터다. 기존 JSDoc과 Swagger 문서는 변경 내용을 대체로 반영했으며(`comparePassword 헬퍼로 검증`, 인라인 참조 주석 등), plan 문서도 후속 spec 업데이트 항목을 명시적으로 기록했다. 다만 `revokeFamily`와 `listActiveSessions`의 공개 메서드에 @param 태그가 구조화되지 않은 점, `webauthnRegenerateRecovery`의 Swagger `@ApiUnauthorizedResponse`가 리팩터 후 두 401 케이스를 다 커버하는지 명시하지 않는 점, 그리고 spec 파일들의 실제 업데이트가 후속 작업으로 미뤄진 점이 INFO 수준의 개선 여지로 남는다. 전체적으로 문서화 품질은 적절하며 차단 요소는 없다.

### 위험도

LOW
