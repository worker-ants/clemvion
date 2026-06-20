# Convention Compliance Review

**Target**: `spec/5-system/1-auth.md` (검토 모드: `--impl-done`, diff-base=`origin/main`)
**Scope**: 구현 변경 사항 (`auth.controller.ts`, `auth.service.ts`, 관련 spec 파일)

---

## 발견사항

### [INFO] `verifyPasswordForUser` 메서드명 — spec 에 명시 없음
- target 위치: `auth.service.ts` 신규 메서드 `verifyPasswordForUser`
- 위반 규약: `spec/conventions/error-codes.md §1` (의미 기반 명명 원칙은 에러 코드에 국한되나, 동일 정신이 메서드 명명에도 권장됨)
- 상세: `spec/5-system/1-auth.md §1.4` 는 "TOTP 비활성화 시 비밀번호 재확인" 을 요건으로 명시한다. `verifyPasswordForUser` 는 이 재확인 동작을 Service 로 이관한 헬퍼인데, spec 에는 이 메서드명이 등장하지 않는다. spec 은 동작(비밀번호 재확인)만 정의하고 구현 메서드명을 강제하지 않으므로 위반은 아니나, `data-flow/2-auth.md §1.2` 가 `bcrypt.compare` 위치를 AuthService 로 암시하는 코멘트가 코드에 인라인되어 있으나 실제 `data-flow/2-auth.md §1.2` 다이어그램에는 로그인 시나리오만 기술되어 있고 2FA 비활성화 흐름은 별도 문서화되어 있지 않다.
- 제안: 현재 수준에서 블로킹 이슈 없음. 향후 `data-flow/2-auth.md` 에 비밀번호 재확인 흐름(`POST /api/auth/2fa/disable`) 시퀀스가 추가될 때 `verifyPasswordForUser` 역할을 명시하면 spec-impl gap 이 해소된다.

### [INFO] `PASSWORD_REQUIRED` / `PASSWORD_INVALID` 에러 코드 — spec 카탈로그 미등재
- target 위치: `auth.service.ts` `verifyPasswordForUser` 내 `throw new UnauthorizedException({ code: 'PASSWORD_REQUIRED' })` / `throw new UnauthorizedException({ code: 'PASSWORD_INVALID' })`
- 위반 규약: `spec/conventions/error-codes.md §1` (에러 코드는 의미 기반 명명; 신규 코드는 정확한 이름으로 신설), `spec/5-system/3-error-handling.md §1`(카탈로그 SoT — 본 리뷰 diff 에 포함되지 않았으나 참조 규약)
- 상세: 두 코드 모두 이번 diff 로 신규 도입된 것이 아니라 기존 `auth.controller.ts` 에 인라인으로 존재하던 것을 Service 로 이관한 것이다(코멘트 명시: "에러 코드·메시지·401 shape 동일 보존"). `error-codes.md §2` 는 기존 코드를 rename 없이 유지하는 것이 올바른 정책임을 명시하므로, 이관 자체는 규약 준수다. 단, `PASSWORD_REQUIRED` / `PASSWORD_INVALID` 가 `spec/5-system/3-error-handling.md` 에러 카탈로그에 등재되어 있는지는 본 diff 범위 밖이라 확인 불가 — 미등재 상태라면 카탈로그 보완이 필요하다.
- 제안: `spec/5-system/3-error-handling.md §1` 에 두 코드가 기재되지 않았다면 등재 추가 검토. 이 작업은 developer 가 아닌 `project-planner` 권한(spec 쓰기) 범주이므로 별도 plan 으로 위임한다.

### [INFO] `auth.controller.ts` 인라인 코멘트 — 규약 문서 참조 경로 유효성
- target 위치: `auth.controller.ts` 코멘트 `// [refactor 02 C-3] … data-flow/2-auth.md §1.2`
- 위반 규약: 직접 위반 없음
- 상세: 코멘트가 `data-flow/2-auth.md §1.2` 를 레이어 정렬 근거로 인용한다. 그러나 `data-flow/2-auth.md §1.2` 는 "로그인(Login)" 흐름 다이어그램이며, `bcrypt.compare` 가 AuthService 에 배치된다는 원칙을 담고 있으나 2FA 비활성화 흐름에 대한 직접 기술은 없다. 외부 독자가 코멘트를 따라 해당 절을 읽으면 `verifyPasswordForUser` 이관 근거가 즉시 보이지 않을 수 있다.
- 제안: 코멘트 참조를 `data-flow/2-auth.md §1.2 (bcrypt 비교를 AuthService 에 배치하는 일반 원칙)` 로 보강하거나, 향후 data-flow 에 2FA 비활성화 흐름을 추가할 때 더 명확한 참조를 달면 충분하다. 현재 수준은 INFO.

---

## 요약

이번 diff(`refactor 02 C-3`)는 `AuthController.disable2fa` 의 raw `bcrypt.compare` 로직을 `AuthService.verifyPasswordForUser` 로 이관한 순수 레이어 정렬 리팩토링이다. 에러 코드(`PASSWORD_REQUIRED` / `PASSWORD_INVALID`)·메시지·HTTP 401 응답 shape 은 기존 동작을 그대로 보존하며, 이는 `spec/conventions/error-codes.md §2` 의 "rename 은 breaking change — 기존 코드 유지" 정책과 일치한다. `spec/conventions/audit-actions.md` · `spec/conventions/swagger.md` 관련 변경은 diff 에 포함되지 않아 해당 규약 적용 대상이 아니다. 발견된 사항은 모두 INFO 수준으로, 정식 규약 직접 위반이나 다른 시스템의 invariant 를 깨는 항목은 없다.

---

## 위험도

**NONE**
