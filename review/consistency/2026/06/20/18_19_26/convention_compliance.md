# 정식 규약 준수 검토 결과

**검토 모드**: --impl-done  
**Target 문서**: `spec/5-system/1-auth.md`  
**Diff base**: `origin/main`  
**검토 일시**: 2026-06-20

---

## 발견사항

### [INFO] `spec/5-system/1-auth.md` — `verifyPasswordForUser` 도입에 대한 spec 본문 미반영

- **target 위치**: `spec/5-system/1-auth.md` §5 API 엔드포인트 표, §2.3 세션 정책 "강제 종료 재인증" 행
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` (spec 파일 frontmatter `status` + `code:` 의무)
- **상세**: diff 는 `webauthn.controller.ts` 에서 인라인 bcrypt 비밀번호 검증 로직을 제거하고 `AuthService.verifyPasswordForUser()` 로 위임하도록 리팩토링했다. 이 변경 자체는 구현 레이어 내부의 레이어 정렬 개선이므로 spec 변경을 유발하지 않는다. `spec/5-system/1-auth.md` §5 의 `/api/auth/2fa/webauthn/recovery-codes/regenerate` 엔드포인트 설명("인증 필수 + 본문에 `password` 재확인")은 변경 이전과 이후 동일 계약을 유지한다. 따라서 규약 위반은 아니며 spec 이 현행 구현을 올바르게 기술하고 있다.
- **제안**: 특이사항 없음. INFO 수준 확인.

---

### [INFO] `spec/5-system/1-auth.md` — `data-flow/2-auth.md §1.2` 포인터 명시 부재

- **target 위치**: `spec/5-system/1-auth.md` §1.4.4 WebAuthn 흐름, §2.3 세션 정책
- **위반 규약**: 엄격한 규약 위반이 아니나, diff 의 코드 주석(`[refactor 02 C-3 §3] … data-flow/2-auth.md §1.2`)이 `data-flow/2-auth.md §1.2` 를 구현 정합 근거로 인용한다. `data-flow/2-auth.md §1.2` 를 확인하면 비밀번호 검증(`bcrypt.compare`) 흐름이 Mermaid 다이어그램에 기술되어 있다.
- **상세**: `data-flow/2-auth.md §1.2` 의 Mermaid 시퀀스는 직접 `bcrypt.compare` 를 명시하고 있다(`Svc->>Svc: bcrypt.compare(password, password_hash)`). 구현에서 `bcrypt.compare` 를 `comparePassword` 유틸로 래핑했으므로, data-flow 의 해당 Mermaid 행이 구현 세부를 너무 구체적으로 노출한다. 그러나 data-flow 문서(`spec/data-flow/2-auth.md`)는 `spec/conventions/spec-impl-evidence.md §1` 의 frontmatter 의무 대상(`spec/5-system/**`, `spec/conventions/**` 등) **밖**이며 — `spec/data-flow/` 는 적용 대상 목록에 없다. 따라서 이 관찰은 frontmatter 의무 위반이 아니다.
- **제안**: 향후 data-flow 문서 갱신 시 `bcrypt.compare` → `comparePassword(…)` 로 표기를 일치시킬 수 있으나, 현 상태로 규약 위반은 없다. 선택적 개선.

---

### [INFO] 에러 코드 `PASSWORD_REQUIRED` / `PASSWORD_INVALID` — spec 에 미등재

- **target 위치**: `codebase/backend/src/modules/auth/auth.service.ts` L67, L74 (`verifyPasswordForUser` 발행 에러 코드)
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명, `UPPER_SNAKE_CASE`) · `spec/5-system/1-auth.md §5` (엔드포인트 에러 코드 명세)
- **상세**: 신규 헬퍼 `AuthService.verifyPasswordForUser()` 가 `PASSWORD_REQUIRED`(401) · `PASSWORD_INVALID`(401) 두 에러 코드를 발행한다. 두 코드 모두 `UPPER_SNAKE_CASE` 를 준수해 `error-codes.md §1` 의 표기 규약을 따른다. 의미 기술도 명확하다(`PASSWORD_REQUIRED` = passwordHash 없음, `PASSWORD_INVALID` = 불일치). 단, `spec/5-system/1-auth.md §5` 의 `/api/auth/2fa/webauthn/recovery-codes/regenerate` 엔드포인트 설명에 에러 코드가 열거되어 있지 않다(기존 코드베이스에서 직접 throw 하던 코드도 spec 에 명시되지 않은 상태였으므로 회귀는 아님). 또한 `codebase/backend/src/nodes/core/error-codes.ts` 의 중앙 `ErrorCode` enum 에도 이 두 코드가 등재되어 있지 않다(auth.service.ts 인라인 문자열 리터럴로 발행).
- **제안**: 규약 위반이 아니지만(기존 패턴과 동일), 향후 에러 카탈로그 정비 시 `PASSWORD_REQUIRED` · `PASSWORD_INVALID` 를 `spec/5-system/1-auth.md §5` 엔드포인트 에러 목록 또는 `3-error-handling.md §1` 카탈로그에 등재하면 spec-impl 정합이 더 강화된다.

---

## 요약

`spec/5-system/1-auth.md` 는 정식 규약(`spec/conventions/`)을 전반적으로 준수하고 있다. 이번 diff 의 핵심 변경 — `SessionsService.revokeFamily` 5번째 인자(`currentRefreshToken`) self-revoke 분기 커버리지 보완, 그리고 `WebAuthnController.webauthnRegenerateRecovery` 의 인라인 bcrypt 제거 및 `AuthService.verifyPasswordForUser` 위임 — 은 모두 구현 레이어 내부 정렬로, spec 이 기술하는 계약(엔드포인트 경로·동작·에러 형태)을 변경하지 않는다. `spec/5-system/1-auth.md` 의 frontmatter(`id: auth`, `status: partial`, `code:`, `pending_plans:`)는 `spec-impl-evidence.md §1·§2` 요건을 충족하며, 문서 3섹션 구조(Overview / 본문 §1~§5 / Rationale)도 CLAUDE.md 권장 구조와 일치한다. 발견된 항목은 모두 INFO 등급의 개선 제안으로, 규약 직접 위반이나 invariant 파괴가 없다.

---

## 위험도

NONE
