# 정식 규약 준수 검토 결과

- **Target**: `spec/5-system/1-auth.md` (검토 모드: --impl-done, diff-base=origin/main)
- **검토 범위**: git diff origin/main...HEAD — `sessions.service.ts`, `webauthn/webauthn.controller.ts`, `webauthn/webauthn.controller.spec.ts`

---

## 발견사항

### **[WARNING]** 신규 에러 코드 `PASSWORD_REQUIRED` / `PASSWORD_INVALID` 가 규약에 미등록

- **target 위치**: `codebase/backend/src/modules/auth/auth.service.ts` L67, L74 (`verifyPasswordForUser` 메서드 내 인라인 문자열 리터럴)
- **위반 규약**: `spec/conventions/error-codes.md §1` ("적용 범위: 본 규율은 … 프로젝트 전체의 에러 코드 문자열에 적용된다"), §2 ("신규 코드는 처음부터 의미 정확한 이름을 부여해 후속 rename 압력을 만들지 않는다"), 및 `spec/conventions/error-codes.md` 전반 (신규 코드 카탈로그 SoT = `spec/5-system/3-error-handling.md §1`)
- **상세**: 이번 diff 에서 `AuthService.verifyPasswordForUser` 가 `PASSWORD_REQUIRED`(비밀번호 없는 계정·사용자 미존재) 와 `PASSWORD_INVALID`(비밀번호 불일치) 를 신규 발행한다. 이 두 코드는 `spec/5-system/3-error-handling.md` 에 카탈로그되지 않았고, `spec/conventions/error-codes.md §3` Historical-artifact 예외 레지스트리에도 없다. 또한 프론트엔드(`codebase/frontend/`) 및 `channel-web-chat` 에서는 현재 이 코드 값을 분기하지 않으나(grep 0건), 코드가 클라이언트 응답(`UnauthorizedException` envelope)으로 노출되는 공개 API 에러 코드이므로 규약 §1 적용 범위에 해당한다.
- **제안**: 두 코드를 `spec/5-system/3-error-handling.md §1` 에 카탈로그 등재한다. 이름 자체는 의미 기반(`UPPER_SNAKE_CASE`)으로 규약을 만족하므로 rename 은 불필요하다. 등재 시 트리거 조건(비밀번호 미보유 계정 / 비밀번호 불일치), HTTP 상태(401), 적용 엔드포인트(`POST /api/auth/2fa/disable`, `POST /api/auth/2fa/webauthn/recovery-codes/regenerate`, `POST /api/auth/2fa/webauthn/credentials/:id` 강제 종료 revoke 등 `verifyPasswordForUser` 호출 경로 전체)를 명시한다.

---

### **[WARNING]** 코드 주석의 spec 포인터(`data-flow/2-auth.md §1.2`)가 잘못된 섹션을 가리킴

- **target 위치**: `codebase/backend/src/modules/auth/auth.service.ts` L54 (`verifyPasswordForUser` JSDoc), `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` diff 코드 주석 (`[refactor 02 C-3 §3] … data-flow/2-auth.md §1.2`)
- **위반 규약**: 직접적인 conventions 규약 위반은 아니나, CLAUDE.md "정보 저장 위치 (단일 진실 원칙)" 에서 spec 포인터는 정확한 위치를 가리켜야 하며 틀린 포인터는 spec을 SoT 로 활용하는 원칙을 훼손한다.
- **상세**: `data-flow/2-auth.md §1.2` 는 "로그인 (Local + 2FA: WebAuthn 우선 / TOTP)" 시퀀스 다이어그램이다. 이 섹션은 `bcrypt.compare` 가 `AuthService` 소속이어야 한다는 레이어 정책을 선언하지 않는다 — 해당 섹션의 `Svc->>Svc: bcrypt.compare(...)` 표기는 단순 흐름 묘사일 뿐이다. `verifyPasswordForUser` 의 설계 근거("비밀번호 재확인을 AuthService 로 통일")는 아직 어느 spec 섹션에도 존재하지 않는다.
- **제안**: 두 가지 방안 중 선택한다. (A) spec에 근거 섹션 신설: `data-flow/2-auth.md` 에 "비밀번호 재확인(password re-verification)" 서브섹션(`§1.2` 후속 또는 신규 번호)을 추가해 `verifyPasswordForUser` 의 레이어 위치와 호출 경로를 기술하고, 코드 주석이 그 섹션을 정확히 가리키도록 수정한다. (B) 포인터 제거: 섹션 신설 없이 코드 주석에서 잘못된 `data-flow/2-auth.md §1.2` 참조를 제거하거나 더 정확한 설명으로 대체한다.

---

### **[INFO]** `spec/5-system/1-auth.md §5` 엔드포인트 표 — `recovery-codes/regenerate` 에러 응답 코드 미기재

- **target 위치**: `spec/5-system/1-auth.md §5` 의 `POST /api/auth/2fa/webauthn/recovery-codes/regenerate` 행
- **위반 규약**: 직접 위반은 아님. 인접 엔드포인트(`POST /api/auth/2fa/webauthn/register/verify`, `POST /api/auth/2fa/webauthn/authenticate/verify` 등)는 에러 코드(`WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `WEBAUTHN_INVALID`, `CHALLENGE_INVALID` 등)를 표 내 명시하는 패턴을 따른다.
- **상세**: 해당 행은 `"+ 본문에 password 재확인"` 만 기재하고, 비밀번호 실패 시 에러 코드(`PASSWORD_REQUIRED` / `PASSWORD_INVALID`, 401)를 표기하지 않는다. 위 [WARNING] 과 함께 카탈로그 등재 시 해당 표 셀에도 에러 코드를 보강하면 이 행이 누락된 패턴 불일치가 해소된다.
- **제안**: `PASSWORD_REQUIRED` / `PASSWORD_INVALID` 카탈로그 등재(위 WARNING 조치) 시 `spec/5-system/1-auth.md §5` 해당 행에 에러 코드(`PASSWORD_REQUIRED` · `PASSWORD_INVALID`, 401)를 함께 기재한다.

---

## 요약

이번 diff 의 핵심 변경(webauthn.controller 에서 raw `bcrypt.compare` 제거 → `AuthService.verifyPasswordForUser` 위임, `sessions.service.ts` 의 `comparePassword` 유틸 사용)은 파일·식별자 명명, 출력 포맷(응답 envelope shape, UPPER_SNAKE_CASE 에러 코드 형식), API 문서화 패턴(DTO·Swagger) 측면에서 정식 규약을 위반하지 않는다. 그러나 이 리팩토링 과정에서 두 개의 신규 에러 코드(`PASSWORD_REQUIRED`, `PASSWORD_INVALID`)가 공개 API 에러로 발행되기 시작했음에도 `spec/conventions/error-codes.md` 에서 요구하는 카탈로그 등재(`spec/5-system/3-error-handling.md`)가 누락됐으며, 코드 주석이 근거로 드는 spec 포인터가 실제 내용과 일치하지 않는 섹션을 가리키고 있다. 두 항목 모두 WARNING 수준으로, 채택 시 다른 시스템의 invariant 를 당장 깨뜨리지는 않으나 에러 코드 SoT 유지 원칙과 spec 포인터 신뢰성 측면에서 조치가 권장된다.

---

## 위험도

**LOW**

STATUS: COMPLETE
