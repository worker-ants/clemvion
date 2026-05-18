# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/2fa-webauthn.md`
검토 모드: `--spec` (spec draft 검토)
검토 일시: 2026-05-18

---

### 발견사항

- **[INFO]** `spec/1-data-model.md` §2.1 User 테이블의 `two_factor_enabled` 필드 의미 모호성
  - target 위치: plan §1 "WebAuthn 우선, TOTP fallback" 디자인 결정
  - 충돌 대상: `spec/1-data-model.md` §2.1 User — `two_factor_enabled | Boolean | TOTP 2FA 활성 여부`
  - 상세: `two_factor_enabled` 는 현재 "TOTP 2FA 활성 여부" 로만 정의되어 있다. plan 에서 WebAuthn credential 이 1개 이상 존재하는 경우 TOTP 비활성(`two_factor_enabled = false`)이어도 WebAuthn 이 2FA 역할을 수행한다. 이 경우 `two_factor_enabled = false` 인데도 2FA 가 실질적으로 활성화된 사용자가 존재하게 되어, 필드 이름·설명이 현행 의미를 온전히 반영하지 못하게 된다. plan §2 작업에서 이미 `spec/1-data-model.md §2.1` 을 갱신 완료(`[x]`)로 표시하고 있으나, 갱신된 spec 본문에서도 `two_factor_enabled | Boolean | TOTP 2FA 활성 여부` 표현이 그대로 남아 있어 향후 독자가 혼동할 수 있다.
  - 제안: `spec/1-data-model.md §2.1` 의 `two_factor_enabled` 설명을 "TOTP 2FA 활성 여부 (WebAuthn credential 등록 여부와는 독립)" 처럼 명시적으로 분리 기술 권장.

- **[INFO]** `spec/2-navigation/10-auth-flow.md` §8 엔드포인트 표의 WebAuthn 경로 표현 단순화
  - target 위치: plan §2 `spec/2-navigation/10-auth-flow.md §3.2 / §3.4 / §8 갱신 [x]`
  - 충돌 대상: `spec/2-navigation/10-auth-flow.md` §8 API 엔드포인트 표 — `POST | /api/auth/2fa/webauthn/authenticate/options · /verify · /recovery | WebAuthn 2FA 흐름. canonical 정의는 auth spec §5`
  - 상세: §8 API 표에 세 경로를 `options · /verify · /recovery` 로 한 행에 묶어 "canonical 은 auth spec §5" 로 위임하고 있다. 현재 spec 본문에는 이 세 경로가 개별 행으로 분리되지 않아 일관성 점검 도구가 endpoint 단위로 파싱하기 어렵다. 기능적 충돌은 없으나 다른 auth 경로들은 모두 개별 행으로 정의되어 있어 표기 비일관성이 존재한다.
  - 제안: `spec/2-navigation/10-auth-flow.md §8` 에서 WebAuthn 3개 경로를 각각 개별 행으로 분리하거나, auth spec §5 의 표기 방식과 통일 권장.

- **[INFO]** `spec/1-data-model.md` §1 엔티티 관계 개요 다이어그램에 WebAuthnCredential 미반영
  - target 위치: plan §2 `spec/1-data-model.md §2.21 WebAuthnCredential 신규 엔티티 추가 [x]`
  - 충돌 대상: `spec/1-data-model.md` §1 엔티티 관계 개요 다이어그램 (`User ──┬── Workspace ...`)
  - 상세: plan 에서 §2.21 WebAuthnCredential 을 User 의 연관 엔티티로 신규 추가하도록 기술하고 있으나, §1 의 ERD 텍스트 다이어그램에는 `WebAuthnCredential` 이 등장하지 않는다. 신규 엔티티 추가 시 §1 다이어그램에도 `User ── WebAuthnCredential (1:N)` 관계를 명시해야 도식이 spec 본문과 일치한다. plan §2 작업 목록에 §1 ERD 갱신이 포함되어 있지 않다.
  - 제안: plan §2 에 `spec/1-data-model.md §1` ERD 다이어그램 갱신 항목 추가 권장.

- **[WARNING]** `login` 응답 필드 `requiresTotp` 의 deprecated 처리 타임라인이 두 spec 간 불일치
  - target 위치: plan §4 `auth.service.ts` — `requiresTotp` 는 backward compat 필드. "두 마이너 버전 후 제거 (W-1 follow-up)"
  - 충돌 대상: `spec/2-navigation/10-auth-flow.md` §3.2 — `응답의 requiresTotp 는 deprecated 호환 필드이며 두 필드 충돌 시 requires2fa 가 우선한다. 자세한 deprecate 타임라인은 auth spec §1.4.2 를 따른다`
  - 상세: plan 은 "두 마이너 버전 후 제거" 라고 명시하고 follow-up §8 에서 이를 별도 PR 로 분리한다. `spec/2-navigation/10-auth-flow.md` 는 "auth spec §1.4.2 를 따른다" 고 위임한다. 그런데 auth spec §1.4.2 에 실제 타임라인이 기재되어 있는지, plan 의 "두 마이너 버전" 과 일치하는지 현 코퍼스에서 확인이 불가능하다. 만약 auth spec §1.4.2 에 다른 타임라인이 있거나 아직 기재되지 않았다면 세 문서 간 불일치가 발생한다.
  - 제안: `spec/5-system/1-auth.md §1.4.2` 에 deprecate 타임라인("두 마이너 버전 후 제거")을 명시하고, plan §8 follow-up 항목과 auth-flow spec §3.2 모두가 같은 표현을 참조하도록 정렬.

- **[WARNING]** WebAuthn 복구 코드와 TOTP 복구 코드의 재발급 엔드포인트 경로 패턴 불일치
  - target 위치: plan §4 백엔드 구현 — `/api/auth/2fa/webauthn/recovery-codes/regenerate` (JWT 필수 + 비밀번호 재확인)
  - 충돌 대상: `spec/2-navigation/9-user-profile.md §2.2 보안 표 + §6.1 API 표` (코퍼스에 포함되지 않으나 plan §2 에서 함께 갱신 대상으로 열거됨) 및 기존 TOTP 복구 코드 엔드포인트 패턴
  - 상세: TOTP 복구 코드 재발급 경로는 기존 spec 에 존재하지만 코퍼스에 포함된 `spec/2-navigation/10-auth-flow.md §8` 표에는 명시되지 않았다. plan 의 WebAuthn 복구 코드 재발급 경로는 `/api/auth/2fa/webauthn/recovery-codes/regenerate` 이다. 만약 TOTP 쪽에 `/api/auth/2fa/totp/recovery-codes/regenerate` 형태가 이미 있다면 WebAuthn 경로는 대칭 패턴으로 정합하지만, TOTP 경로가 `/api/auth/2fa/recovery-codes/regenerate` 처럼 method prefix 없이 설계되어 있다면 양쪽이 다른 네임스페이스 규약을 따르게 된다.
  - 제안: `spec/5-system/1-auth.md §5` API 표에서 TOTP 복구 코드 경로와 WebAuthn 복구 코드 경로의 네임스페이스 규약을 나란히 기재하고, 두 경로가 대칭 패턴임을 명시.

- **[WARNING]** `challengeToken` vs `tempToken` 용어 — `spec/data-flow/2-auth.md` 정합 필요
  - target 위치: plan §2 `spec/data-flow/2-auth.md §1.2 — totpToken → challengeToken 정정 [x]`
  - 충돌 대상: `spec/data-flow/2-auth.md` (코퍼스에 포함되지 않으나 plan 갱신 대상으로 명시)
  - 상세: plan §2 에서 `spec/data-flow/2-auth.md §1.2` 의 `totpToken → challengeToken` 정정을 [x] 로 완료 처리하고, `spec/2-navigation/10-auth-flow.md §3.2` 도 `tempToken → challengeToken` 정정을 [x] 로 표시한다. 그러나 코퍼스에 포함된 `spec/2-navigation/10-auth-flow.md` 본문은 이미 `challengeToken` 을 일관되게 사용 중이다. plan 의 `[x]` 표시가 실제 spec 파일에 반영되었는지 독립적으로 확인할 수 없다. 만약 `spec/data-flow/2-auth.md` 에 옛 `totpToken` / `tempToken` 표현이 잔존한다면 시퀀스 다이어그램과 auth-flow spec 간에 용어 불일치가 남게 된다.
  - 제안: `spec/data-flow/2-auth.md` 전문을 직접 확인하여 `totpToken` / `tempToken` 잔존 여부를 재검증. 잔존 시 즉시 갱신 필요.

- **[CRITICAL]** `WebAuthn authenticate` 엔드포인트 요청 body 구조 — plan vs auth-flow spec 불일치
  - target 위치: plan §4 백엔드 구현 — `verifyAuthentication(userId, optionsToken, response)` 및 auth controller 엔드포인트 설명: `/api/auth/2fa/webauthn/authenticate/verify { challengeToken, optionsToken, response }`
  - 충돌 대상: `spec/2-navigation/10-auth-flow.md §3.4.2` — `POST /api/auth/2fa/webauthn/authenticate/verify { challengeToken, optionsToken, response }`
  - 상세: 두 문서가 request body 에 `challengeToken` 과 `optionsToken` 을 모두 포함하는 것으로 기술하여 겉보기엔 일치한다. 그러나 `/authenticate/options` 호출 시 request body 에 대해서는 plan 이 `{ challengeToken }` 으로 명시하지만 auth-flow spec §3.4.2 는 `POST /api/auth/2fa/webauthn/authenticate/options { challengeToken }` 을 명시한다. 실질적인 문제는 `authenticate/options` 가 `@Public` 데코레이터(인증 불요)를 사용하는 반면 plan §4 anonymous 영역 보안 정책(W-6)에서 "challengeToken 만으로 사용자를 식별 — anonymous + email 흐름은 도입하지 않음" 이라고 기술하는데, auth-flow spec §3.4.2 는 이 `authenticate/options` 경로가 `@Public` 임을 명시하지 않아 독자가 JWT 인증이 필요한지 혼동할 수 있다. 더 나아가 `authenticate/options` 에서 서버가 `challengeToken` 에서 `userId` 를 추출해 allowCredentials 를 채우는 설계인데, 이 토큰 검증 실패 시의 응답 코드(400 vs 401)가 두 spec 어디에도 명시되지 않아 auth controller 구현 시 차이가 생길 수 있다.
  - 제안: `spec/5-system/1-auth.md §5` API 표에서 `authenticate/options` 경로에 인증 방식(`@Public`, `challengeToken` 으로 식별)과 토큰 검증 실패 에러 코드(400 `INVALID_CHALLENGE_TOKEN`)를 명시. auth-flow spec §3.4.2 에도 이 사실을 교차 참조로 추가.

- **[CRITICAL]** `WebAuthn` 첫 번째 credential 삭제 시 동작 — plan 과 data-model spec 의 기술 불일치
  - target 위치: plan §4 백엔드 — `deleteCredential(userId, id)` — "마지막 삭제 시 `webauthn_recovery_codes` NULL 화"
  - 충돌 대상: `spec/1-data-model.md §2.21 WebAuthnCredential` — "모든 credential 삭제 시 [`spec/5-system/1-auth.md §1.4`] 흐름을 따른다"
  - 상세: plan §4 는 "마지막 credential 삭제 시 `webauthn_recovery_codes` NULL 화" 를 `deleteCredential` 의 책임으로 기술한다. data-model spec §2.21 은 "모든 등록·인증·삭제 시 auth spec §1.4 흐름을 따른다" 고 포괄적으로 위임한다. plan §1(디자인 결정)에서도 "모든 credential 삭제 시 컬럼 NULL 로 비움" 이라고 기술하여 세 곳이 모두 동일한 규칙을 기술하고 있다. 그러나 data-model spec §2.1 User 테이블의 `webauthn_recovery_codes` 설명에는 "모든 credential 삭제 시 NULL 로 비움" 이 이미 포함되어 있다. 이 규칙이 서비스 레이어(`webauthn.service.ts`)에도 속하고 data-model spec 에도 속한다면, 구현자가 data-model spec 만 읽었을 때 "DB 트리거가 처리하는가, 아니면 애플리케이션 레이어가 처리하는가" 가 불명확하다. 현재 plan 은 애플리케이션 레이어(`deleteCredential` 메서드) 에서 처리함을 명시하지만, data-model spec 은 이를 애플리케이션 책임으로 명시하지 않는다.
  - 제안: `spec/1-data-model.md §2.1` `webauthn_recovery_codes` 행 설명에 "(애플리케이션 레이어 책임 — DB 트리거 아님)" 를 추가하거나, auth spec §1.4 의 삭제 흐름 설명에 책임 주체를 명시. 두 spec 이 동일한 책임 귀속을 기술하도록 정렬.

---

### 요약

`plan/in-progress/2fa-webauthn.md` 가 갱신 완료(`[x]`)로 표시한 spec 파일들(`spec/1-data-model.md`, `spec/2-navigation/10-auth-flow.md`, `spec/data-flow/2-auth.md` 등)은 현 코퍼스 기준으로 대체로 정합하나, 두 건의 CRITICAL 이슈가 식별되었다. 첫째, WebAuthn `authenticate/options` 엔드포인트의 인증 방식(`@Public`)과 토큰 검증 실패 에러 코드가 auth-flow spec 과 auth spec 어디에도 명시되지 않아 백엔드 구현 시 계약 충돌이 발생할 수 있다. 둘째, "마지막 credential 삭제 시 `webauthn_recovery_codes` NULL 화" 책임이 애플리케이션 레이어 임을 data-model spec 이 명시하지 않아 구현자 혼동이 예상된다. WARNING 3건은 `requiresTotp` deprecated 타임라인 정렬, 복구 코드 재발급 엔드포인트 네임스페이스 대칭 확인, `challengeToken` 용어 정정 완료 재검증에 관한 것이다. INFO 3건은 모두 기존 충돌보다는 명명·다이어그램 동기화 권장 사항이다.

---

### 위험도

HIGH
