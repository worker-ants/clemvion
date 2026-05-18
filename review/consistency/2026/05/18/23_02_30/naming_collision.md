# 신규 식별자 충돌 Check — naming_collision

검토 대상: `plan/in-progress/2fa-webauthn.md`
검토 모드: spec draft 검토 (--spec)
검토 기준: 코퍼스 (`spec/`, `plan/in-progress/`, `spec/conventions/`)

---

## 발견사항

### 1. INFO — `challengeToken` 명칭, 기존 `tempToken`·`optionsToken` 과의 혼재 가능성

- **target 신규 식별자**: `challengeToken` (로그인 2FA 단계 응답 필드 + WebAuthn authenticate/verify 요청 본문)
- **기존 사용처**:
  - `spec/2-navigation/10-auth-flow.md §3.2` — `{ requires2fa, methods, challengeToken }` 으로 이미 정정됨 (✓)
  - `spec/2-navigation/10-auth-flow.md §3.4.2` — `POST /api/auth/2fa/webauthn/authenticate/options { challengeToken }` 명시 (✓)
  - `plan/in-progress/2fa-webauthn.md §4` — `generateRegistrationOptions` 의 응답 payload 안 `optionsToken` (`kind: webauthn_register`, exp 5분) 은 별도 토큰으로 정의됨
  - 동일 plan §4 인증 흐름: `authenticate/options { challengeToken }` → `authenticate/verify { challengeToken, optionsToken, response }`
- **상세**: `challengeToken`(로그인 2FA 단계에서 사용자를 식별하는 임시 토큰)과 `optionsToken`(WebAuthn challenge를 포함한 stateless JWT — 5분 유효) 은 서로 다른 토큰이다. 두 이름이 같은 request body 안에 공존하므로(`authenticate/verify` 요청에 둘 다 필요) 구현자가 혼동하지 않도록 spec에 명확히 구분이 되어 있는지 확인 필요. 현재 `spec/5-system/1-auth.md §5` 가 canonical 정의이며 코퍼스에서는 해당 섹션을 직접 확인할 수 없었으나, plan 본문의 기술은 두 토큰의 역할을 명시하고 있음.
- **제안**: 코퍼스에서 직접 충돌이 검출되지는 않음. 다만 `spec/5-system/1-auth.md §5` (API 표)에서 두 토큰의 payload shape 차이(`challengeToken`은 `/auth/login` 이 발급하는 2FA 진입 토큰; `optionsToken`은 WebAuthn challenge 내장 5분 JWT)를 한 곳에 병기해 구현자 혼동을 방지할 것을 INFO 수준으로 제안.

---

### 2. INFO — `§2.21 WebAuthnCredential` 섹션 번호 시프트, ERD 참조 일관성

- **target 신규 식별자**: `spec/1-data-model.md §2.21 WebAuthnCredential` (신규 엔티티), `spec/1-data-model.md §2.22 AssistantMessage` (기존 §2.21 → 시프트)
- **기존 사용처**:
  - 코퍼스 `spec/1-data-model.md §2.21` — 이미 `WebAuthnCredential` 로 갱신 완료됨 (plan §2 에서 `[x]` 처리)
  - 코퍼스 `spec/1-data-model.md §2.22` — 이미 `AssistantMessage` 로 갱신 완료됨
  - `spec/1-data-model.md §1 ERD` — plan §2 마지막 체크박스 `[ ]` (미완): ERD 다이어그램에 `WebAuthnCredential (User 1:N)` 관계 미반영
- **상세**: §2.21/§2.22 본문 변경은 완료되었으나 §1 ERD 다이어그램만 아직 미반영 상태(`[ ]`). ERD에는 `User ──┬── Workspace (1:N)` 트리가 있으나 `WebAuthnCredential` 가지가 없다. 이는 내부 참조 불일치이며 번호 충돌은 아니다.
- **제안**: plan §3(데이터 모델/마이그레이션) 착수 전에 §1 ERD 항목(`[ ]`)을 완료하여 spec 내부 일관성을 확보. 현재 상태 그대로 구현에 진입해도 기능상 문제는 없으나 문서 참조자 혼동 여지.

---

### 3. INFO — `webauthn_recovery_codes` vs `totp_recovery_codes` 컬럼명, 패턴 일관성

- **target 신규 식별자**: `webauthn_recovery_codes` (User 테이블 TEXT[] 컬럼)
- **기존 사용처**: `totp_recovery_codes` (User 테이블 TEXT[] 컬럼, 기존 구현)
- **상세**: 두 컬럼 모두 SHA-256 해시 배열이며 동일 패턴(`xxxx-xxxx-xxxx` 포맷, 10개 발급, 사용 시 항목 제거)을 따른다. 이름 패턴이 `<method>_recovery_codes` 로 일관되어 있어 직접 충돌은 없다. 코퍼스의 `spec/1-data-model.md §2.1 User` 표에 두 컬럼 모두 이미 명시됨.
- **제안**: 충돌 없음. 단, `webauthn_recovery_codes` 의 NULL 화 책임(`WebAuthnService.deleteCredential` 애플리케이션 레이어)이 spec에 명확히 적혀 있는 점은 이미 코퍼스 §2.1에서 확인됨.

---

### 4. INFO — 마이그레이션 파일 번호 V057·V058 점유 선언

- **target 신규 식별자**: `V057__webauthn_credentials_and_recovery.sql`, `V058__login_history_webauthn_failed_event.sql`
- **기존 사용처**:
  - plan `§3` 주석: "착수 직전 max(V) 재확인 필수" — V057 이 비어있는지 확인하도록 명시
  - `plan/in-progress/replay-rerun.md` 가 동일 번호를 점유했을 가능성 언급 (`spec/1-data-model.md` 를 `spec-overview-followups-2026-05-18.md` 와 동시 수정 리스크 명시)
- **상세**: V057·V058은 plan에서만 선언되었고 실제 파일 존재 여부는 코퍼스에서 직접 확인할 수 없음. 그러나 plan 자체에 "착수 전 max(V) 재확인" 지침이 있어 프로세스 차원에서 처리됨. 다른 in-progress plan(`replay-rerun.md`)이 동일 번호를 사용한다면 직렬화 필요.
- **제안**: 구현 착수 시 `consistency-check --impl-prep` 실행 지침(plan §7 두 번째 항목)이 V057 번호 점유 확인을 포함한다고 명시되어 있어 절차 차원에서 안전장치가 있음.

---

### 5. WARNING — `optionsToken` 필드명, `challengeToken` 과의 혼동 가능성 (API 요청 body)

- **target 신규 식별자**: `optionsToken` (WebAuthn authenticate/verify 요청 body 필드 — plan §4 기술)
- **기존 사용처**:
  - `spec/2-navigation/10-auth-flow.md §3.4.2` — `POST /api/auth/2fa/webauthn/authenticate/verify { challengeToken, optionsToken, response }` 로 명시 (✓ 이미 spec에 반영)
  - 동일 spec §1.4.C Rationale — challenge JWT payload: `{ kind, sub, challenge, exp }` (`optionsToken`)
- **상세**: `optionsToken`은 WebAuthn challenge를 담은 5분 유효 stateless JWT이고, `challengeToken`은 `/auth/login` 이후 2FA 사용자를 식별하는 별도 JWT이다. 두 토큰이 같은 endpoint 요청 body에 공존하므로(`/authenticate/verify`) 이름이 충분히 구별되지 않으면 구현 시 혼동 가능하다. `challengeToken`이라는 이름은 "challenge"를 연상시켜 WebAuthn challenge(실제로는 `optionsToken` 안에 있는 random nonce)와 혼동될 수 있다.
- **제안**: `spec/5-system/1-auth.md §5` API 표 또는 §1.4 설명부에서 두 토큰의 역할과 발급 주체를 명확히 구분하는 1~2줄 설명을 추가할 것을 권장. 예: "challengeToken — /auth/login 에서 발급, 2FA 단계 사용자 식별용. optionsToken — /2fa/webauthn/*/options 에서 발급, WebAuthn challenge nonce 포함 5분 유효". 식별자 자체를 변경하지 않아도 무방하나 문서 명확화가 필요.

---

### 6. INFO — `webauthn_failed` LoginHistory 이벤트 enum 값, CHECK 제약 갱신 방식

- **target 신규 식별자**: `webauthn_failed` (LoginHistory.event enum 추가 값)
- **기존 사용처**:
  - `spec/1-data-model.md §2.18.2` — 이미 `event` Enum 표에 `webauthn_failed` 포함됨 (plan §2에서 `[x]`)
  - CHECK 제약명: `chk_login_history_event` (V040 도입). V058에서 DROP + ADD CONSTRAINT 패턴으로 갱신 예정
- **상세**: spec에 이미 반영 완료. 기존 `chk_login_history_event` 제약명이 그대로 재사용되고 V058에서 DROP+ADD 패턴을 사용하는 것은 같은 이름의 제약이 갱신되는 구조로 충돌이 아니다.
- **제안**: 충돌 없음. V058이 DROP CONSTRAINT + ADD CONSTRAINT 단일 statement로 처리되므로 기존 행에 영향 없음은 plan에도 명시됨.

---

### 7. INFO — `WebAuthnRegisterVerifyDto` DTO명 검토

- **target 신규 식별자**: `WebAuthnRegisterVerifyDto` (response DTO)
- **기존 사용처**: 코퍼스에 동일 명칭 미발견. 기존 2FA 관련 DTO로는 TOTP 관련 DTO들이 존재하는 것으로 추정되나 코퍼스에서 직접 확인 불가.
- **상세**: `WebAuthnRegisterVerifyDto`는 "등록 검증(Registration Verification)" 응답 DTO인데, 이름만으로는 "등록 옵션(Options)"과 "등록 검증(Verify)" 중 어느 단계의 응답인지 바로 명확하지 않을 수 있다. 그러나 `WebAuthnRegisterOptionsDto`와 대응 관계가 자명하므로 실제 혼동 위험은 낮다.
- **제안**: 충돌 없음. 명명 패턴 `WebAuthn<Phase><Step>Dto` 형태로 일관성 있음.

---

### 8. INFO — `spec/1-data-model.md` 동시 수정 리스크 (spec-overview-followups-2026-05-18 plan 과의 충돌)

- **target 신규 식별자**: `spec/1-data-model.md` 수정 (plan §2 완료)
- **기존 사용처**:
  - `plan/in-progress/2fa-webauthn.md 의존성·리스크` 절: "spec/1-data-model.md 를 spec-overview-followups-2026-05-18.md 와 동시 수정 → 후자 plan 작업 시 본 plan merge 여부 확인 후 rebase 필요" 명시
  - `plan/in-progress/0-unimplemented-overview.md` — `spec-overview-followups-2026-05-18.md` 가 in-progress 목록에 있음
- **상세**: 파일 경로 충돌은 식별자 충돌이 아니라 worktree 동시 편집 충돌이다. `spec/1-data-model.md` 가 두 worktree에서 동시 수정 중일 경우 merge 충돌 발생 가능. 이는 이미 target plan 자체에서 리스크로 명시하고 있어 인지됨.
- **제안**: 충돌은 이미 인지된 상태. `consistency-check --impl-prep` 의 `plan_coherence` checker가 이를 검출하므로 구현 착수 전 해당 checker 결과를 확인할 것.

---

## 요약

`plan/in-progress/2fa-webauthn.md` 가 도입하는 신규 식별자들(WebAuthnCredential 엔티티, webauthn_recovery_codes 컬럼, webauthn_failed 이벤트 enum, V057·V058 마이그레이션 파일, /api/auth/2fa/webauthn/* 엔드포인트 군, challengeToken·optionsToken 필드, WebAuthn* DTO 클래스)은 코퍼스 내 기존 식별자와 **동일 이름·다른 의미**로 충돌하는 사례가 없다. plan §2(spec 갱신)가 이미 완료([x])된 덕분에 spec 본문에 신규 식별자가 이미 반영되어 있고, 기존 TOTP 관련 식별자(`totp_recovery_codes`, `login/totp` 엔드포인트 등)와 충분히 구별되는 네임스페이스(`webauthn_*`)를 사용하고 있다. 주목할 점은 `challengeToken`(2FA 진입 식별 토큰)과 `optionsToken`(WebAuthn challenge JWT)이 같은 요청 본문에 공존하여 이름상 혼동 가능성이 있다는 것(WARNING 1건)이며, ERD 미반영·마이그레이션 번호 선점·동시 편집 리스크는 모두 plan에서 이미 인지하고 절차적 안전장치를 두고 있어 INFO 수준으로 분류된다.

## 위험도

LOW
