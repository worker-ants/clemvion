# 보안(Security) 코드 리뷰 — 2FA WebAuthn 구현 계획 및 Spec/코드 변경

리뷰 대상: consistency-check 결과물(review/consistency), spec 변경(spec/1-data-model.md, spec/5-system/1-auth.md, spec/2-navigation/10-auth-flow.md, spec/2-navigation/9-user-profile.md, spec/data-flow/2-auth.md), 기존 auth 모듈 코드(codebase/backend/src/modules/auth)

---

### 발견사항

- **[CRITICAL]** WebAuthn 인증 경로에서 TOTP 우회(인증 강도 다운그레이드) 가능
  - 위치: `auth.service.ts` `loginWithTotp()` 메서드 (consistency-check `rationale_continuity.md` 발견사항 2, line 338–395)
  - 상세: `loginWithTotp()` 가 `user.twoFactorEnabled` 만 확인하고 WebAuthn credential 보유 여부를 검사하지 않는다. WebAuthn credential 이 등록된 사용자가 `POST /api/auth/login/totp` 를 직접 호출하면 TOTP 검증이 통과되어 정식 access/refresh 토큰이 발급될 수 있다. spec §1.4.D 는 "WebAuthn 등록 사용자에게 TOTP 자동 fallback 을 UI 에서 제공하지 않는다"고 기술하지만, 이는 UI 제약이지 API 레이어 제약이 아니다. 공격자(또는 호기심 많은 사용자)가 클라이언트 UI 를 우회해 `login/totp` API 를 직접 호출할 수 있고, 이 경우 phishing-resistant WebAuthn 을 등록했음에도 피싱에 취약한 TOTP 경로로 인증이 완료된다. 이는 OWASP A01(Broken Access Control), A07(Identification and Authentication Failures)에 해당한다.
  - 제안: `loginWithTotp()` 서비스 함수 내부에서 WebAuthn credential 보유 여부를 조회하고, 1개 이상이면 `401 WEBAUTHN_REQUIRED` 응답을 반환하는 백스탑을 추가한다. challengeToken payload 에 `method: 'totp' | 'webauthn'` 을 포함시켜 verify 단계에서 method 일치 여부를 검증하는 방식도 함께 고려한다.

- **[CRITICAL]** 로그인 2FA 분기에서 WebAuthn credential 보유 여부 미확인 — 약한 인증으로 자동 우회
  - 위치: `auth.service.ts` `login()` 메서드 (consistency-check `rationale_continuity.md` 발견사항 1, line 310–316)
  - 상세: `login()` 은 비밀번호 검증 후 `user.twoFactorEnabled` 만 확인해 challengeToken 을 발급한다. WebAuthn credential 이 있는 사용자도 `methods: ['totp']` 응답을 받게 되어, 클라이언트는 phishing-resistant WebAuthn 대신 TOTP 화면을 표시한다. 사용자가 WebAuthn 을 등록한 의도(보다 강한 인증)가 무력화된다. spec §1.4.2 의 "WebAuthn 우선, TOTP fallback 자동 금지" 원칙이 현재 구현에서는 적용되지 않는다. `LoginChallengeDto` 에도 `requires2fa`, `methods` 필드가 없어 신규 응답 계약과 다르다.
  - 제안: `login()` 에서 `user.twoFactorEnabled` 확인 전에 WebAuthn credential 수를 조회하는 단계를 추가하고, 결과에 따라 `methods: ['webauthn']` 또는 `methods: ['totp']` 를 분기한다. `LoginChallengeDto` 에 `requires2fa: boolean`, `methods: string[]`, `requiresTotp?: boolean (deprecated)` 을 추가한다.

- **[CRITICAL]** `webauthn_recovery_codes` 평문 노출 — 일회성 표시 보안 설계 실구현 시 주의
  - 위치: spec/5-system/1-auth.md §1.4.4 등록 흐름: "첫 등록이면 webauthn_recovery_codes 10개 발급 + 평문 응답 (일회성 표시)"
  - 상세: 복구 코드는 첫 등록 시 평문으로 한 번만 내려주고 이후 SHA-256 해시만 저장하는 올바른 설계다. 그러나 구현 시 이 "일회성 표시" 응답이 서버 측에서 캐싱되거나, 로깅 미들웨어에 의해 응답 body 가 기록되거나, 에러 시 재발급 없이 재전송하는 패턴이 나타날 경우 복구 코드가 영구 평문 노출된다. 현재 spec 에는 이 위험을 방지하는 구현 제약이 명시되지 않았다.
  - 제안: (1) 응답 로깅 미들웨어에서 WebAuthn 등록 verify 응답 body 를 제외하거나 마스킹 처리. (2) 서버에는 반드시 SHA-256 해시만 저장하고 평문은 메모리에서 즉시 파기. (3) 복구 코드를 발급 후 재조회하는 API endpoint 를 만들지 않는다(재발급은 별도 `/recovery-codes/regenerate` 사용). spec §1.4.4 에 이 제약을 명문화한다.

- **[CRITICAL]** counter 역행 후 동일 family refresh-token 미폐기 — 세션 유지 위험
  - 위치: spec/5-system/1-auth.md §1.4.4: "동일 family refresh-token 강제 revoke 는 별도 follow-up (현 단계에서는 다음 인증 시도부터 차단되는 것으로 충분)"
  - 상세: counter 역행은 인증기 복제·클론 공격 또는 인증기 펌웨어 오류를 의미한다. spec 은 credential row 를 삭제하지만, 해당 사용자가 이미 발급받아 보유 중인 access token / refresh token family 는 즉시 폐기하지 않는다. 공격자가 복제된 인증기로 counter 를 역행시킨 뒤 기존에 발급된 세션으로 계속 접근하는 시나리오가 가능하다. "다음 인증 시도부터 차단"은 이미 활성 세션을 가진 공격자에게 유효하지 않다. OWASP A07(Identification and Authentication Failures)에 해당.
  - 제안: counter 역행 감지 시 해당 사용자의 전체 refresh_token family (또는 최소한 동일 세션 family) 를 즉시 revoke 한다. "별도 follow-up"으로 미루지 말고 이 단계에서 구현하도록 plan §4 의 WebAuthnService.verifyAuthentication 구현 명세에 포함시킨다.

- **[WARNING]** challengeToken payload 에 `method` 클레임 없음 — 교차 사용 방어 취약
  - 위치: `auth.service.ts` line 311–314: challengeToken payload `{ sub, mfa_challenge: true, rememberMe, exp }` (consistency-check `naming_collision.md` 발견사항 5, `rationale_continuity.md` 발견사항 7)
  - 상세: challengeToken 에 `method` 또는 `kind` 클레임이 없으면, 동일 challengeToken 을 TOTP verify endpoint 와 WebAuthn authenticate/options endpoint 양쪽에서 모두 수락하는 상황이 발생할 수 있다. 공격자가 challengeToken 을 탈취한 뒤 의도와 다른 2FA 경로로 인증 시도하는 것을 서버가 감지하지 못한다. optionsToken 에는 `kind: 'webauthn_register' | 'webauthn_auth'` 가 있어 흐름 내 교차 사용은 방어되지만, challengeToken 자체의 method 바인딩이 없다.
  - 제안: challengeToken 발급 시 `{ sub, mfa_challenge: true, rememberMe, method: 'totp' | 'webauthn', exp }` 를 포함시켜, verify 핸들러에서 의도한 method 인지 검증한다. 이렇게 하면 WebAuthn 사용자의 challengeToken 이 `login/totp` endpoint 에서 거부된다.

- **[WARNING]** WebAuthn credential 삭제 시 `webauthn_recovery_codes` NULL 화 책임이 애플리케이션 레이어에만 있음 — 코드 버그 시 고아 데이터
  - 위치: spec/1-data-model.md §2.1: "이 NULL 화는 애플리케이션 레이어(`WebAuthnService.deleteCredential`) 의 책임이며 DB 트리거가 아니다"
  - 상세: 마지막 credential 삭제 시 `user.webauthn_recovery_codes` 를 NULL 로 설정하는 로직이 `WebAuthnService.deleteCredential` 애플리케이션 코드에만 있다. 이 코드가 예외를 던지거나, 향후 다른 경로로 credential 을 삭제하는 코드가 추가될 때 누락될 경우, 사용자의 WebAuthn credential 은 모두 삭제되었으나 `webauthn_recovery_codes` 는 유효한 해시 값으로 남아 있게 된다. 공격자가 이 고아 복구 코드를 사용하면 WebAuthn credential 없이도 WebAuthn 복구 경로(`/webauthn/recovery`)로 토큰을 발급받을 수 있다.
  - 제안: (1) `deleteCredential` 트랜잭션 안에서 credential 수 조회 + NULL 화를 단일 DB transaction 으로 묶는다. (2) `webauthn_recovery_codes` NULL 화 조건을 "credential count = 0" 으로 DB-level trigger 또는 CHECK 로 강제하는 방안을 검토한다. (3) `/webauthn/recovery` endpoint 에서 challengeToken 검증 후 `webauthn_credential` 이 0 개인 사용자라면 복구 코드도 거부하도록 추가 가드 로직을 둔다.

- **[WARNING]** `optionsToken` JWT 재사용 가능성 — 5분 윈도우 내 replay 미완전 차단
  - 위치: spec/5-system/1-auth.md Rationale 1.4.C: "replay 방어: JWT 만료 5분 + `kind` 검증으로 의도 다른 흐름 교차 사용 차단"
  - 상세: spec 은 "같은 5분 윈도우 안에서 동일 JWT 의 두 번째 verify 가 시도되면 `@simplewebauthn/server` 의 verify 는 challenge·response 짝의 cryptographic uniqueness 로 거부한다"고 기술하지만, 이는 WebAuthn 표준의 authenticatorData 내부 challenge 검증에 의존한 설명이다. `optionsToken` JWT 자체는 stateless 이므로 서버 측에서 "이미 소비된 optionsToken" 여부를 추적하지 않는다. WebAuthn spec 의 counter 증가가 한 번만 일어난다는 점이 replay 방어의 주된 근거인데, counter = 0 인 passkey(소프트웨어 기반)는 counter 를 증가시키지 않아 이 방어가 적용되지 않을 수 있다.
  - 제안: `@simplewebauthn/server verifyAuthenticationResponse` 의 `requireUserVerification: true` 옵션을 명시하고, counter 가 0 인 인증기에 대한 정책(허용 또는 경고 로그)을 구현 spec 에 명시한다. 운영 환경에서 옵션을 의도적으로 완화(`requireUserVerification: false`)하는 상황을 방지하기 위해 기본값을 코드 주석으로 문서화한다.

- **[WARNING]** WebAuthn credential `publicKey` 와 `counter` 노출 금지 — API 응답 설계
  - 위치: spec/5-system/1-auth.md §5: "`GET /api/auth/2fa/webauthn/credentials` 응답: `[{id, deviceName, transports, lastUsedAt, createdAt}]` (publicKey·counter 미노출)"
  - 상세: spec 이 `publicKey` 와 `counter` 를 credential 목록 응답에서 제외하도록 명시한 것은 올바르다. 그러나 구현 시 TypeORM entity 를 그대로 직렬화하거나, exclude 데코레이터 누락, 또는 새로운 조회 경로 추가 시 의도치 않게 공개 키 또는 counter 값이 노출될 수 있다. 공개 키 노출은 WebAuthn 의 암호학적 보안 강도를 직접 위협하지는 않으나, counter 값이 노출되면 replay 공격자에게 기준값 정보를 제공한다.
  - 제안: Response DTO(`webauthn-response.dto.ts`) 에서 `publicKey`, `counter` 를 원천적으로 제외하고, entity 에 `@Exclude()` 또는 class-transformer 설정을 적용한다. 단위 테스트에서 `publicKey` 및 `counter` 가 응답에 포함되지 않음을 명시적으로 검증한다.

- **[WARNING]** 복구 코드 SHA-256 해시 저장 — 솔트 없음, 레인보우 테이블 공격 가능성
  - 위치: spec/5-system/1-auth.md §1.4.1: "`user.totp_recovery_codes`: SHA-256 해시 배열, 사용 시 항목 제거" / "`user.webauthn_recovery_codes`: SHA-256 해시 배열"
  - 상세: 복구 코드를 SHA-256 으로만 저장하고 솔트를 사용하지 않는 구조다. 복구 코드 포맷이 `xxxx-xxxx-xxxx` (각 세그먼트 4자리 hex/alphanumeric) 로 추측되므로, DB 가 탈취될 경우 사전 계산된 레인보우 테이블 또는 완전 탐색으로 복구 코드를 역산할 수 있다. 12자리 코드의 경우 무작위성은 충분하지 않을 수 있다. 비교적으로 TOTP 복구 코드는 일반적으로 bcrypt 또는 Argon2 로 저장한다. SHA-256 은 속도가 빠르기 때문에 오프라인 공격 비용이 낮다.
  - 제안: 복구 코드 해시를 SHA-256 에서 bcrypt(cost 12) 또는 Argon2id 로 교체하는 것을 검토한다. 이미 결정된 설계라면(totp_recovery_codes 와의 일관성), 최소한 `PBKDF2(code + per-user-salt, 100000, sha256)` 수준으로 강화한다. 또는 복구 코드 길이를 충분한 엔트로피(예: base32 16자 이상)로 늘려 brute-force 비용을 높인다.

- **[WARNING]** `WEBAUTHN_ORIGIN` 환경변수 누락 시 `FRONTEND_URL` hostname 폴백 — 운영 환경 미설정 위험
  - 위치: spec/5-system/1-auth.md §1.4.3: "모두 누락 시 `FRONTEND_URL` 의 hostname 으로 best-effort 폴백 + warn 로그"
  - 상세: WebAuthn 에서 `expectedOrigin` 불일치는 인증 거부의 핵심 보안 검증이다. `FRONTEND_URL` 폴백은 단일 도메인 SaaS 환경에서는 동작하지만, 셀프 호스팅 환경에서 `FRONTEND_URL` 이 올바르게 설정되지 않거나, 리버스 프록시가 다른 origin 을 사용하는 경우, 폴백 값이 실제 클라이언트 origin 과 다를 수 있다. 이 경우 모든 WebAuthn 인증이 실패하거나(서비스 장애) 또는 의도하지 않은 origin 이 허용(보안 취약)된다.
  - 제안: `WEBAUTHN_ORIGIN` 이 미설정된 경우 warn 로그에 그치지 말고, 개발 환경에서는 허용하되 production 환경(`NODE_ENV=production`)에서는 시작 실패(`throw Error`)하도록 강제한다. `.env.example` 에 `WEBAUTHN_*` 블록을 추가하고 필수/선택 여부를 명시한다.

- **[WARNING]** `forgotPassword` / `checkEmail` 응답 wrapping 누락 — Swagger 문서 불일치 (인증/인가 우회보다 정보 노출 관점)
  - 위치: `auth.controller.ts:379-381`, `auth.controller.ts:411-413` (consistency-check `convention_compliance.md` CRITICAL 발견사항)
  - 상세: `forgotPassword` 와 `checkEmail` 이 서비스 반환값을 `{ data: ... }` 로 감싸지 않고 직접 반환한다. 기능상 `TransformInterceptor` 가 자동 wrap 하면 무해할 수 있으나, Swagger 문서는 `{ data: AuthMessageDto }` / `{ data: CheckEmailResultDto }` 를 약속하고 있다. 이 불일치가 클라이언트 측 응답 파싱 로직 혼동을 유발하며, `checkEmail` 의 경우 이메일 존재 여부를 다른 형태로 노출하면 사용자 열거(User Enumeration) 공격에 활용될 수 있다. 직접적 보안 취약점은 아니나 응답 형태 예측 불가로 인한 클라이언트 로직 버그 경로.
  - 제안: `return { data: await this.authService.forgotPassword(dto.email) }` / `return { data: await this.authService.checkEmail(dto.email) }` 로 통일한다.

- **[WARNING]** `credential_id` UNIQUE 인덱스 필요 — 동시 등록 경쟁 조건
  - 위치: spec/1-data-model.md §2.21 WebAuthnCredential: "`credential_id` | String | UNIQUE"
  - 상세: spec 이 `credential_id UNIQUE` 를 명시하고 있어 설계는 올바르다. 그러나 구현 시 TypeORM entity 에 `@Unique('credential_id')` 데코레이터 또는 마이그레이션 V057 에 UNIQUE 제약이 반드시 포함되어야 한다. 누락될 경우 동일 credential_id 로 두 번의 등록이 동시에 시도되면(race condition) 중복 row 가 삽입될 수 있다. credential_id 충돌 시 `verifyAuthenticationResponse` 의 counter 기반 replay 방어가 무력화된다.
  - 제안: V057 마이그레이션에 `ALTER TABLE webauthn_credential ADD CONSTRAINT uq_webauthn_credential_id UNIQUE (credential_id);` 를 명시적으로 포함하고, TypeORM entity 에도 `@Unique(['credentialId'])` 를 병기한다. plan §3 마이그레이션 SQL 체크리스트에 이 항목을 추가한다.

- **[INFO]** `PATCH /api/auth/2fa/webauthn/credentials/:id` — 본인 소유 검증 "404 반환"은 올바르나 구현 시 누락 주의
  - 위치: spec/5-system/1-auth.md §5: "본인 소유 아니면 404 (enumeration 방지)"
  - 상세: 403 대신 404 를 반환하는 enumeration 방지 설계는 보안 모범 사례다. 구현 시 `WHERE id = :id AND user_id = :currentUserId` 조건으로 단일 조회 후 not found 시 404 를 반환해야 한다. `WHERE id = :id` 로 먼저 조회한 뒤 `user_id` 를 별도로 비교하는 2-step 패턴은 타이밍 공격에 노출될 수 있다.
  - 제안: 단일 `findOne({ where: { id, userId } })` 쿼리로 처리하고, null 시 `NotFoundException` 을 던진다. `DELETE` endpoint 도 동일 패턴을 적용한다.

- **[INFO]** WebAuthn credential 등록·삭제 AuditLog 누락 — 보안 이벤트 추적 공백
  - 위치: spec/5-system/1-auth.md §4.1 (consistency-check `cross_spec.md` WARNING 발견사항)
  - 상세: TOTP 의 `2fa_enable/disable` 은 AuditLog 대상으로 기재되어 있으나, WebAuthn credential 의 등록·삭제 이벤트는 AuditLog 에 포함 여부가 미결이다. credential 관리는 로그인 2FA 경로를 직접 변경하는 보안-critical 행위로, 감사 추적이 없으면 사고 대응 시 증거 확보가 불가능하다.
  - 제안: `webauthn_credential_register`, `webauthn_credential_delete` 이벤트를 AuditLog 또는 LoginHistory 에 기록한다. spec §4.1 에 해당 액션 포함 여부를 명시적으로 결정하고 기재한다.

- **[INFO]** `webauthn_recovery_codes` 재발급 시 기존 미사용 코드 폐기 — 타이밍 공백
  - 위치: spec/5-system/1-auth.md §5 `/api/auth/2fa/webauthn/recovery-codes/regenerate`: "기존 미사용 코드 폐기 후 10개 새로 발급"
  - 상세: 재발급 API 가 트랜잭션 내에서 기존 코드 NULL 화 + 신규 코드 INSERT 를 atomic 하게 처리하지 않으면, 두 작업 사이에 구 코드로 복구 시도가 성공하는 짧은 창이 발생할 수 있다. 실제 악용 가능성은 낮으나, 원자성 보장이 명시되지 않았다.
  - 제안: 재발급 트랜잭션을 `@Transaction()` 또는 `queryRunner` 로 묶어 원자성을 보장한다. plan §4 구현 명세에 이 제약을 추가한다.

- **[INFO]** `LoginChallengeDto.requiresTotp` deprecated 필드 — `@ApiProperty` 에 `deprecated: true` 누락
  - 위치: `dto/responses/auth-response.dto.ts:11-17` (consistency-check `rationale_continuity.md` WARNING 발견사항)
  - 상세: spec §1.4.2 는 `requiresTotp` 를 deprecated 로 명시하지만, 현재 DTO 의 `@ApiProperty` 에 `deprecated: true` 가 없어 Swagger UI 에서 클라이언트 개발자가 이 필드를 새 계약의 primary 필드로 인식할 수 있다. deprecated 필드를 primary 로 사용하는 신규 클라이언트가 생길 경우 제거 조건 충족이 어려워진다.
  - 제안: `@ApiProperty({ deprecated: true })` + JSDoc `@deprecated` 를 함께 추가한다.

---

### 요약

이번 변경은 2FA WebAuthn 구현을 위한 spec 갱신 및 consistency check 결과물로, 아직 실제 구현 코드는 포함되지 않고 spec·plan 단계다. 보안 관점에서 가장 심각한 문제는 두 가지 인증 우회 경로다. 첫째, `auth.service.ts` 의 `loginWithTotp()` 가 WebAuthn credential 보유 여부를 검사하지 않아, WebAuthn 등록 사용자가 TOTP API 를 직접 호출해 phishing-resistant 인증을 우회할 수 있는 구조가 현재 코드에 존재한다. 이는 구현 착수 전 반드시 수정해야 할 아키텍처 결함이다. 둘째, counter 역행 감지 시 credential row 는 삭제하지만 이미 발급된 세션(refresh token family) 을 즉시 revoke 하지 않아, 인증기 복제 공격자가 기존 세션으로 계속 접근할 수 있다. 또한 복구 코드를 SHA-256 솔트 없이 저장하는 설계는 DB 탈취 시 오프라인 brute-force 에 취약하고, 마지막 credential 삭제 시 복구 코드 NULL 화 책임이 애플리케이션 레이어에만 있어 코드 버그 시 고아 복구 코드가 남을 위험이 있다. challengeToken 에 method 클레임이 없는 점도 교차 경로 인증 시도 방어에 공백을 만든다. 전반적으로 spec 의 보안 원칙 자체(WebAuthn 우선, TOTP fallback 금지, credential 삭제 정책, 복구 코드 풀 분리)는 FIDO2 보안 모범 사례를 잘 반영하고 있으나, 기존 코드와의 통합 경계에서 여러 보안 결손이 예측된다.

---

### 위험도

HIGH
