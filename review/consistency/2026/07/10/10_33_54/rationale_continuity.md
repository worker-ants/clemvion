STATUS: OK

### 발견사항

없음 — Rationale 연속성 관점에서 CRITICAL/WARNING 급 위반을 발견하지 못했다.

검증 과정 참고: 본 checker 에게 전달된 payload(`_prompts/rationale_continuity.md`)의 "관련 Rationale 발췌" 절이 파일 크기 한도로 `spec/2-navigation/4-integration.md` 의 Rationale 중간에서 잘려, 정작 이번 리뷰의 1차 소스인 `spec/5-system/1-auth.md`·`spec/5-system/3-error-handling.md` 자체의 `## Rationale` 절(특히 1.1.B-4)이 발췌에 포함되지 못했다. 이를 보완하기 위해 실제 저장소의 `spec/5-system/1-auth.md`(L314-330 §2.3, L504-521 Rationale 1.1.B-1~6, L661-702 Rationale 2.3.A~C/1.5.D), `spec/5-system/3-error-handling.md`(§1.2.1, Rationale L472-475), 관련 코드(`sessions.service.ts` verifyReauth, `auth.service.ts` verifyPasswordForUser, `users.service.ts` changePassword), 그리고 git 이력(`8cda3c08d`, `plan/complete/spec-draft-email-change.md`, `plan/complete/refactor-auth-reverify-unify.md`, `plan/in-progress/error-codes-catalog-sot.md`)을 직접 대조해 아래 결론에 도달했다. (payload curation 스크립트의 크기 상한을 소스 문서 우선순위 기반으로 조정할 여지가 있어 보이나, 이는 orchestrator 측 개선 사항이지 target 문서의 결함은 아니다.)

**검토 관점별 판단**

1. **기각된 대안의 재도입** — 없음. target 은 오히려 §2.3 표의 "WebAuthn·이메일 OTP" 서술을 **제거**하고 Rationale 1.1.B-4 가 이미 확정한 `verifyReauth`(password OR TOTP) 로 정렬한다. 새 대안 채택이 아니라 대안 축소(정정) 방향이라 이 항목의 위반 형태(기각 대안의 무단 재도입)와 반대다.

2. **합의된 원칙 위반** — 없음. `spec/0-overview.md` Rationale 서문의 "본문은 latest-only 사실, 이유는 Rationale 참조" 원칙을 target 이 그대로 따른다 — §2.3 표/note(1a·1b)는 사실(코드·status)만 담고, "왜 WebAuthn/이메일 OTP 를 미지원으로 명시하는가"는 신규 Rationale 2.3.D(1e)에 담아 분리했다. `3-error-handling.md` Rationale(L474)의 "spec 에 문서화된 코드만 등재" 절차 원칙도 target 의 순서(§2.3 본문 문서화 1b → §1.2.1 등재 2a)가 그대로 준수한다.

3. **결정의 무근거 번복** — 해당 없음에 가까움. 이번 정정은 "번복"이 아니라 "drift 정정"으로, 근거가 매우 두텁다:
   - git 이력상 §2.3 행의 "WebAuthn 우선/이메일 OTP" 문구는 커밋 `8cda3c08d`(2FA/WebAuthn 로그인 기능 도입)에서 **§2.3 전용 Rationale 없이** 부수적으로 얹힌 문구였다 — 즉 애초에 정식 채택 결정이 아니었다.
   - `1-auth.md` 현재 Rationale 1.1.B-4(L515-516, 실측 확인)는 이미 "§2.3 강제 종료 재인증은 OAuth-only 대안으로 이메일 OTP 를 언급하지만... 구현은 세션 강제 종료와 동일한 verifyReauth(password OR TOTP) 를 재사용한다"라고 명시해, §2.3 프로즈와 구현/1.1.B-4 자체의 불일치를 **이미 인지하고 있었다.** 다만 "§2.3 의 세션-revoke 재인증 정의 자체는 본 작업(이메일 변경)에서 변경하지 않는다"고 명시적으로 범위를 유보했다.
   - `plan/complete/spec-draft-email-change.md`(L102)는 "§2.3 의 기존 '강제 종료 재인증' 행은 건드리지 않는다 — 그 reauth 정합은 refactor-auth-reverify-unify 영역"이라고 위임했으나, `plan/complete/refactor-auth-reverify-unify.md`(범위 밖 절)에는 §2.3 프로즈 정정 항목이 실제로 없어 유실됐다 — target 의 "배경(후속 종결)" 서술과 정확히 일치.
   - 그럼에도 target 은 "새 결정 아님"이라는 주장에 그치지 않고 **신규 Rationale 2.3.D(1e)** 를 명시적으로 작성해 정정 근거를 문서에 남긴다 — 점검 관점 3(결정 번복 시 새 Rationale 동반) 기준을 오히려 모범적으로 충족한다.

4. **암묵적 가정 충돌** — 없음. `9-user-profile.md`(L341-342·397), `spec/data-flow/2-auth.md` 등 §2.3 를 참조하는 다른 문서들은 이미 일관되게 "비밀번호/TOTP 재인증"만 언급하며 WebAuthn·이메일 OTP 는 어디에도 전제돼 있지 않다 — target 의 정정이 깨뜨리는 하류 invariant가 없다.

**부가 검증(참고, 본 checker 주업무 밖이나 판단 근거로 사용)**: target 이 제시한 코드 사실(REAUTH_REQUIRED=400/BadRequestException, PASSWORD_INVALID=401/UnauthorizedException, TOTP_INVALID=401, REAUTH_NOT_AVAILABLE=403 — `sessions.service.ts` L244-291 실측)과 `INVALID_PASSWORD`(changePassword 전용, `users.service.ts` L76/84) vs `PASSWORD_INVALID`(`verifyPasswordForUser`, `auth.service.ts` L81) 구분 모두 코드와 일치했다. `3-error-handling.md` §1.2.1 기존 note(L64)의 "REAUTH_REQUIRED(403)·PASSWORD_INVALID(400)" 표기가 실제로 코드와 어긋나는 오기였음도 확인 — target 의 "status 오기 정정" 서술(2b/2c)이 정확하다. 이 사실관계는 Rationale 연속성 자체보다 정확성 검증에 가깝지만, target 의 신규 Rationale bullet 이 근거로 삼는 전제가 참이라는 점에서 연속성 판단의 신뢰도를 뒷받침한다.

### 요약
target(`auth-reauth-spec-accuracy.md`)은 §2.3 "강제 종료 재인증" 행의 WebAuthn/이메일 OTP 서술을 제거하는 변경이지만, 이는 기각된 대안의 재도입이나 임의 번복이 아니라 (a) 애초 §2.3 문구가 전용 Rationale 없이 부수적으로 얹힌 미채택 서술이었고, (b) 기존 Rationale 1.1.B-4 가 이미 이 drift 를 인지하되 범위를 유보해 뒀으며, (c) `spec-draft-email-change` → `refactor-auth-reverify-unify` 계보가 위임했다가 유실한 후속을 정확히 완결하는 작업임이 git 이력·plan 이력·타 spec 문서 교차검증으로 모두 확인됐다. target 은 정정 근거를 신규 Rationale 2.3.D 로 명시적으로 남기고, 과거 Rationale(1.1.B-4)의 stale 문구도 역사 보존 형태로 동기화하며, `3-error-handling.md` 의 기존 "spec 문서화 → 카탈로그 등재" 원칙도 순서대로 준수한다. Rationale 연속성 관점에서는 모범적인 drift 정정 사례로 판단된다.

### 위험도
NONE
