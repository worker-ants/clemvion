# 요구사항(Requirement) 리뷰 — 2FA WebAuthn 구현

리뷰 대상: 2fa-webauthn-impl worktree 변경 사항 (spec 개정 + consistency check 산출물)
리뷰 일시: 2026-05-18

---

### 발견사항

---

#### 기능 완전성

- **[CRITICAL]** 로그인 2FA 분기 — WebAuthn 우선 탐지 로직 기존 코드에 부재
  - 위치: `auth.service.ts` `login()` 메서드 (line 310–316), `LoginChallengeDto` (auth-response.dto.ts)
  - 상세: spec `§1.4.2`는 `/auth/login` 비밀번호 검증 후 WebAuthn credential 개수를 먼저 확인해 `methods: ['webauthn']` 또는 `methods: ['totp']`를 분기하도록 명시한다. 그러나 현재 `auth.service.ts`의 `login()`은 `user.twoFactorEnabled`만 확인하고 WebAuthn credential 조회를 전혀 수행하지 않는다. 결과적으로 WebAuthn을 등록한 사용자에게도 `{ requiresTotp: true, challengeToken }` 응답만 내려가며, `requires2fa`·`methods` 필드가 응답에 존재하지 않는다. 이는 spec이 요구하는 핵심 기능이 미구현인 상태다.
  - 제안: `login()` 내에서 WebAuthn credential 개수 조회(`WebAuthnCredentialRepository.countBy({ userId })`)를 수행하고, 결과에 따라 `methods`를 분기한다. `LoginChallengeDto`에 `requires2fa: boolean`, `methods: ('totp' | 'webauthn')[]`, `requiresTotp?: boolean(deprecated)` 필드를 추가한다.

- **[CRITICAL]** `loginWithTotp()` — WebAuthn credential 보유 사용자 차단 로직 부재
  - 위치: `auth.service.ts` `loginWithTotp()` (line 338–395), `auth.controller.ts` `loginTotp()` (line 218–231)
  - 상세: spec Rationale `1.4.D`는 "WebAuthn이 1개라도 등록된 사용자에게 TOTP 입력 경로를 자동으로 열어서는 안 된다"고 명확히 기술한다. 그러나 `loginWithTotp()`는 `user.twoFactorEnabled`만 검사하고 WebAuthn credential 보유 여부를 검사하지 않아, WebAuthn 사용자가 `POST /api/auth/login/totp`를 직접 호출하면 TOTP 검증 후 정식 JWT가 발급된다. 이는 spec이 명시적으로 기각한 "약한 인증 수단으로의 자동 우회"를 API 레이어에서 허용하는 보안 결손이다.
  - 제안: `loginWithTotp()` 내에서 WebAuthn credential이 1개 이상 존재하는 사용자에게 `401 WEBAUTHN_REQUIRED`를 반환하는 백스탑을 추가한다. 또는 challengeToken payload에 `method: 'totp' | 'webauthn'`을 박아 verify 단계에서 method 일치 여부를 검증한다.

- **[CRITICAL]** `LoginHistoryEvent` TypeScript 타입에 `webauthn_failed` 누락
  - 위치: `entities/login-history.entity.ts:12-18`
  - 상세: spec `§4.3` 및 data-model `§2.18.2`는 `webauthn_failed`를 LoginHistory 이벤트 Enum에 명시한다. V058 마이그레이션이 DB CHECK 제약(`chk_login_history_event`)을 확장하더라도 TypeScript 타입 유니온에 이 값이 없으면 `LoginHistoryService.record()` 호출 시 컴파일 오류가 발생한다. spec이 요구하는 `WEBAUTHN_INVALID`·`WEBAUTHN_COUNTER_REGRESSION` failure_reason 기록도 타입 불일치로 실질적으로 불가능하다.
  - 제안: V058 마이그레이션과 동일한 PR에서 `LoginHistoryEvent`에 `| 'webauthn_failed'`를 추가한다. 연관된 `LoginHistoryFailureReason` (또는 동등 타입)에도 `WEBAUTHN_INVALID`·`WEBAUTHN_COUNTER_REGRESSION`을 추가한다.

- **[CRITICAL]** WebAuthn 관련 서비스·엔티티·컨트롤러 파일 전체 미존재
  - 위치: `codebase/backend/src/modules/auth/` 전체 파일 목록
  - 상세: spec `§1.4.4` 및 `§5`는 등록(options·verify)·인증(authenticate/options·verify·recovery)·credential 관리(GET·PATCH·DELETE)·복구 코드 재발급(POST) 총 8개 이상의 엔드포인트를 정의한다. 그러나 현재 코드베이스에 `webauthn.service.ts`, `webauthn-credential.entity.ts`, WebAuthn 전용 컨트롤러 파일이 존재하지 않는다. spec에 정의된 기능의 핵심 구현 자체가 빠진 상태이며, 이 상태에서 구현을 착수하면 `auth.service.ts`의 `login()` 분기 리팩토링과 WebAuthn 엔드포인트 추가가 동시에 필요하다.
  - 제안: plan `§4`에서 명시한 순서대로 (1) `webauthn-credential.entity.ts` 신설 및 `auth.module.ts` 등록, (2) `webauthn.service.ts` 신설, (3) `auth.service.ts` `login()` 분기 리팩토링, (4) WebAuthn 컨트롤러·라우트 추가 순서를 고정하고 진행한다.

---

#### 엣지 케이스

- **[WARNING]** counter 역행 시 HTTP 응답 코드 불일치 — plan 내부에서 `400` vs `401` 충돌
  - 위치: `plan/in-progress/2fa-webauthn.md` §4 백엔드 구현 91번 줄 vs 116번 줄 e2e 시나리오
  - 상세: plan 91번 줄은 `WebAuthnService.verifyAuthentication`의 counter 역행 응답을 `400`으로 명시하나, spec `§5` API 표(`authenticate/verify` 행)와 동일 plan 116번 줄 e2e 시나리오는 모두 `401`을 따른다. `400`은 클라이언트 요청 오류(Bad Request) 시맨틱이고, counter 역행은 인증 실패(신뢰 철회) 의미이므로 spec의 `401`이 의미상 정확하다. 구현 시 plan의 `400`을 그대로 따르면 spec·e2e·실제 구현이 모두 다른 응답 코드를 갖게 된다.
  - 제안: plan 91번 줄의 `400 응답`을 `401 응답`으로 정정한다. spec `1-auth.md §5`의 `401` 정의가 SoT다.

- **[WARNING]** WebAuthn credential 마지막 삭제 시 `webauthn_recovery_codes` NULL 화 책임 미명시
  - 위치: spec `§5` DELETE endpoint, `WebAuthnService.deleteCredential` 미구현
  - 상세: spec은 "마지막 credential 삭제 시 `user.webauthn_recovery_codes`를 `WebAuthnService.deleteCredential`이 NULL 화"하며 이는 DB 트리거가 아닌 애플리케이션 레이어 책임이라고 명시한다. 그러나 현재 `deleteCredential` 구현이 없어 이 경계 케이스 처리 로직이 없다. 여러 credential이 있는 사용자가 하나씩 삭제하다 마지막을 삭제할 때 회복 코드가 남아 있으면 고아 데이터가 발생한다.
  - 제안: `deleteCredential(userId, credentialId)` 구현 시 삭제 후 `countBy({ userId }) === 0` 조건에서 `user.webauthnRecoveryCodes = null` 갱신을 원자적 트랜잭션으로 처리한다.

- **[WARNING]** 브라우저 WebAuthn 미지원 시 fallback 처리 미정의
  - 위치: spec `§1.4.4` WebAuthn 흐름, `spec/2-navigation/10-auth-flow.md §3.4.2`
  - 상세: auth-flow spec `§3.4.2`는 "브라우저가 WebAuthn 미지원이거나 사용자 인증기에 접근 불가 시 안내문 + 복구 코드 입력 링크만 노출"이라고 명시하나, 이 상태에서 서버 API가 어떤 응답을 내야 하는지(예: `navigator.credentials.get()` 자체가 실패하면 클라이언트는 어떤 API를 호출하고 서버는 어떤 상태를 반환하는지)가 spec 어디에도 정의되지 않았다. `authenticate/options` 또는 `authenticate/verify` 호출 없이 `recovery` 직접 호출하는 경로는 정의되어 있으나, 브라우저 수준 실패 시 UX 플로우와 API 계약이 불명확하다.
  - 제안: spec `§3.4.2`에 "브라우저 WebAuthn 미지원 시 `authenticate/options` 호출 없이 직접 recovery 링크를 노출하며 서버 측 별도 처리 불필요" 또는 "options 호출 시 환경 감지 에러 처리" 중 하나를 명시한다.

- **[INFO]** 빈 `webauthn_recovery_codes` 배열 vs NULL 구분 처리 미정의
  - 위치: spec `§1.4.1` 복구 코드, data-model `§2.21` WebAuthnCredential
  - 상세: spec은 "모든 복구 코드 사용 시 배열이 비면" 상태와 "credential 전체 삭제 시 NULL" 상태를 구분하지 않는다. 복구 코드 10개를 모두 소진했으나 credential은 남아있는 사용자는 NULL이 아닌 빈 배열(`[]`) 상태가 되어야 하는지, 아니면 이 상태가 허용되는지 정의가 없다. 복구 코드 소진 시 `POST .../recovery-codes/regenerate`를 유도해야 하는지도 명시되어 있지 않다.
  - 제안: spec `§1.4.1`에 복구 코드 전체 소진 시 응답 처리(재발급 안내 또는 자동 비활성 등)를 명시한다.

---

#### TODO/FIXME

- **[WARNING]** plan `§8 Follow-up` 3건이 어떤 plan에도 추적되지 않음
  - 위치: `plan/in-progress/2fa-webauthn.md §8`
  - 상세: `requiresTotp` deprecated 필드 제거, 동일 family refresh-token 강제 revoke, WebAuthn credential 보유 사용자 관리자 계정 복구 3건이 "별 PR" 예정으로 표시되어 있으나 `0-unimplemented-overview.md`나 별도 in-progress plan에 등록되지 않았다. 특히 `requiresTotp` 제거는 API 계약 변경이라 타이밍 추적이 필수다. 추적되지 않으면 영구 미완으로 남을 위험이 있다.
  - 제안: PR merge 시점에 `plan/in-progress/2fa-webauthn-followups.md`를 신설하거나 `0-unimplemented-overview.md` 적절 섹션에 추가한다.

- **[INFO]** spec `§1.4.4` counter 역행 후 "동일 family refresh-token 강제 revoke" 처리가 follow-up으로 이연
  - 위치: spec `§1.4.4` 마지막 단락 ("동일 family refresh-token 강제 revoke는 별도 follow-up")
  - 상세: 보안 관점에서 counter 역행은 인증기 복제 공격 가능성을 시사한다. 이 경우 해당 사용자의 활성 세션 전체를 revoke하는 것이 더 안전하나, spec은 이를 follow-up으로 미뤘다. 현재 구현 계획에서는 다음 인증 시도부터 차단되는 것으로 명시했으나, 이는 기존에 열려있는 세션에서 악의적 행위가 계속될 여지를 남긴다.
  - 제안: follow-up으로 추적하되, spec에 현재 상태의 보안 트레이드오프("기존 세션은 만료 전까지 유효")를 명시해 의도적 결정임을 문서화한다.

---

#### 의도와 구현 간 괴리

- **[CRITICAL]** `forgotPassword`·`checkEmail` — Swagger 선언과 실제 반환값 불일치
  - 위치: `auth.controller.ts:379-381` (`forgotPassword`), `auth.controller.ts:411-413` (`checkEmail`)
  - 상세: `forgotPassword`는 `@ApiOkWrappedResponse(AuthMessageDto, ...)`로 `{ data: AuthMessageDto }`를 선언하나 실제 반환은 `return this.authService.forgotPassword(dto.email)`로 raw 서비스 반환값이다. `checkEmail`도 동일 패턴이다. 다른 엔드포인트는 모두 `{ data: ... }`로 명시 wrap하므로 함수명·Swagger 선언의 의도와 구현이 다르다.
  - 제안: `return { data: await this.authService.forgotPassword(dto.email) }` 형태로 명시 wrap한다.

- **[WARNING]** `LoginChallengeDto.requiresTotp` — deprecated 필드임에도 primary 필드로 선언
  - 위치: `dto/responses/auth-response.dto.ts:11-17`
  - 상세: spec `§1.4.2`는 `requiresTotp`를 backward-compat deprecated 필드로 명확히 분류하고, 새 클라이언트는 `requires2fa + methods`를 사용하도록 명시한다. 그러나 현재 DTO는 `requiresTotp: boolean`만 존재하고 `requires2fa`·`methods` 필드가 없어 deprecated 필드가 primary 필드 역할을 하는 역전이 발생한다. 또한 `LoginChallengeDto`는 컨트롤러에서 import/참조되지 않아 dead export 상태다.
  - 제안: `requires2fa: boolean`, `methods: ('totp' | 'webauthn')[]`를 primary로 추가하고, `requiresTotp`는 `@ApiProperty({ deprecated: true })`로 마크한다.

- **[WARNING]** `SessionListDto.data`·`LoginHistoryPageDto.data` — 이중 `data` 중첩 구조
  - 위치: `dto/responses/session.dto.ts:53-57`, `dto/responses/login-history.dto.ts:41-51`
  - 상세: `SessionListDto`가 내부에 `data: SessionDto[]`를 갖고, 컨트롤러에서 `@ApiOkWrappedResponse(SessionListDto, ...)`로 한 번 더 wrap되면 실제 응답은 `{ data: { data: SessionDto[] } }`가 된다. 함수명과 Swagger 선언의 의도(`{ data: SessionDto[] }`)와 실제 구현(`return { data: sessions }`)이 다른 레이어에서 충돌한다.
  - 제안: `SessionListDto`의 `data` 필드를 제거하고 `items` 필드로 변경하거나, `@ApiOkWrappedArrayResponse(SessionDto, ...)`를 사용한다.

---

#### 에러 시나리오

- **[WARNING]** `optionsToken` JWT 만료 후 재시도 시 에러 처리 미정의
  - 위치: spec `§1.4.4` WebAuthn 인증 흐름, spec `§5` `authenticate/verify` 엔드포인트
  - 상세: `optionsToken`은 5분 유효 JWT다. 사용자가 인증기 조작에 5분 이상 소요하거나 탭을 방치한 후 verify를 시도하면 `INVALID_OPTIONS_TOKEN` 에러가 발생한다. spec `§5`의 register/verify 실패 응답에 `400 INVALID_OPTIONS_TOKEN`이 명시되어 있으나, 클라이언트가 이를 수신했을 때 자동으로 options를 재요청해야 하는지, 사용자에게 "다시 시도" UI를 보여야 하는지가 auth-flow spec `§3.4.2`에 정의되지 않았다.
  - 제안: `§3.4.2` WebAuthn 화면 섹션에 optionsToken 만료 에러 수신 시 클라이언트 동작(자동 재시도 또는 사용자 안내 버튼 표시)을 명시한다.

- **[WARNING]** `challengeToken`이 만료된 상태에서의 2FA 에러 처리 분기 미정의
  - 위치: spec `§1.4.2`, spec `§5` `authenticate/options` endpoint (401 `CHALLENGE_INVALID`)
  - 상세: `authenticate/options`는 만료된 challengeToken 수신 시 `401 CHALLENGE_INVALID`를 반환하도록 명시한다. 그러나 이 경우 사용자는 로그인 1단계부터 다시 시작해야 하는데, 프론트엔드 `§3.4.2` 화면에서 이 401을 수신했을 때의 리다이렉트 동작이 spec에 없다.
  - 제안: auth-flow spec `§3.4.2` 또는 `§3.2`에 challengeToken 만료(401 CHALLENGE_INVALID) 수신 시 로그인 화면으로 리다이렉트하는 동작을 명시한다.

- **[INFO]** WebAuthn credential 없는 사용자가 `/api/auth/2fa/webauthn/authenticate/options`를 호출할 경우 에러 정의 없음
  - 위치: spec `§5` `authenticate/options` endpoint
  - 상세: spec `§5`의 `authenticate/options`는 `challengeToken` 검증 실패(401 `CHALLENGE_INVALID`)만 명시하고, 해당 사용자에게 WebAuthn credential이 아예 없을 때의 응답 코드를 정의하지 않는다. credential이 없는 사용자가 직접 API를 호출하면 서버가 `generateAuthenticationOptions`에 빈 allowCredentials를 넘기거나 별도 에러를 반환해야 하는데 명시가 없다.
  - 제안: spec `§5`의 해당 엔드포인트 설명에 "credential이 없는 사용자 호출 시 404 또는 400 `NO_WEBAUTHN_CREDENTIAL`" 등의 응답을 추가한다.

---

#### 데이터 유효성

- **[WARNING]** `device_name` 필드 최대 100자 제한이 DTO 유효성 검증에 반영되어야 함
  - 위치: data-model `§2.21 WebAuthnCredential` (device_name: 최대 100자), plan `§4` PATCH endpoint
  - 상세: spec data-model은 `device_name`을 "최대 100자"로 명시한다. plan `§4`의 PATCH endpoint 구현 계획에서 이 길이 제약을 DTO `@MaxLength(100)` 검증으로 강제하는 언급이 없다. DB 컬럼 정의(`VARCHAR(100)`)와 애플리케이션 레이어 유효성 검증이 동시에 있어야 일관성이 보장된다.
  - 제안: PATCH endpoint의 request DTO에 `@MaxLength(100)` 데코레이터를 추가하고, 400 에러 응답을 Swagger에 문서화한다.

- **[WARNING]** `WEBAUTHN_RP_ID` 환경변수 미설정 시 best-effort 폴백 — 운영 안전망 부재
  - 위치: spec `§1.4.3` WebAuthn 환경변수
  - 상세: spec은 "모두 누락 시 `FRONTEND_URL`의 hostname으로 best-effort 폴백 + warn 로그"라고 명시한다. 그러나 `WEBAUTHN_RP_ID`가 잘못 설정되거나 누락되면 `@simplewebauthn/server`의 `verifyAuthenticationResponse`가 모든 인증을 거부한다. 운영 환경에서 조용히 warn만 기록하고 폴백을 사용하면 설정 오류를 발견하기 어렵다. 또한 `.env.example`에 `WEBAUTHN_*` 변수 블록이 없으면 셀프 호스팅 운영자가 누락할 가능성이 있다.
  - 제안: `webauthn.config.ts` 로드 시 `WEBAUTHN_RP_ID`가 없으면 startup log에 명확한 경고를 기록하고, 가능하면 시작 단계 validation(예: `ConfigModule.forRoot` 스키마 검증)으로 필수 변수 누락 시 앱 시작 실패를 강제한다. `.env.example`에 `WEBAUTHN_*` 블록을 추가한다.

- **[INFO]** `webauthn.config.ts`가 `common/config/index.ts`에 export 추가 없으면 ConfigModule에 미로드
  - 위치: `codebase/backend/src/common/config/` (신규 `webauthn.config.ts`)
  - 상세: naming_collision 검토에서 식별됐듯이, `common/config/index.ts`에 export를 추가하지 않으면 `ConfigModule.forRoot`의 `load: [...]` 배열에 포함되지 않아 `ConfigService.get('webauthn.*')`이 런타임에 `undefined`를 반환한다. 이 경우 `WEBAUTHN_RP_ID` 등 모든 설정이 조용히 무시되어 서비스 로직이 폴백값으로 동작한다.
  - 제안: `webauthn.config.ts` 신설 시 `common/config/index.ts`의 export 배열 및 `app.module.ts`의 `ConfigModule.forRoot({ load: [...] })` 배열에 동시에 추가한다. e2e 테스트에서 이 설정이 주입되는지 확인한다.

---

#### 비즈니스 로직

- **[CRITICAL]** `requiresTotp` deprecated 제거 조건 — plan이 spec 대비 프론트엔드 배포 확인 조건 누락
  - 위치: `plan/in-progress/2fa-webauthn.md §4` 105번 줄, spec `§1.4.2` 제거 조건
  - 상세: spec `§1.4.2`는 제거 조건을 "(1) 두 마이너 버전 후 AND (2) `methods`만 보는 새 프론트엔드가 동일 PR에서 함께 배포되어 backward-only 사용처가 사라진 것이 확인된 후 — 둘 중 늦은 시점"으로 AND 관계로 정의한다. plan 105번 줄은 (1)만 언급하고 (2)를 생략했다. follow-up plan이 (1)만 만족할 때 `requiresTotp`를 제거하면 기존 클라이언트가 즉시 손상된다.
  - 제안: plan 105번 줄을 spec `§1.4.2`의 두 조건을 모두 포함하도록 수정한다.

- **[WARNING]** 복구 코드 10개 소진 후 비즈니스 규칙 미정의
  - 위치: spec `§1.4.1` 복구 코드
  - 상세: spec은 복구 코드를 "사용 시 해당 항목 제거"로 정의하나, 10개를 모두 소진한 후 사용자가 또 다른 복구 코드 사용을 시도할 때의 응답(예: `RECOVERY_CODE_EXHAUSTED`)이 정의되지 않았다. 또한 복구 코드를 소진한 사용자가 재발급(`/recovery-codes/regenerate`)을 요청하기 위해서는 먼저 WebAuthn으로 로그인해야 하는데, WebAuthn 인증기도 분실한 경우의 계정 복구 경로가 "관리자 개입 — 본 spec 범위 밖"으로만 기술되어 구체적 절차가 없다.
  - 제안: spec `§1.4.1`에 복구 코드 소진 시 `401 RECOVERY_CODE_EXHAUSTED` 응답을 명시하고, 소진 상태에서의 UX 안내(재발급 경로 안내 또는 관리자 연락처)를 auth-flow spec에 추가한다.

- **[WARNING]** WebAuthn credential 등록·삭제 이벤트의 AuditLog 포함 여부 미결정
  - 위치: spec `§4.1` AuditLog 목록
  - 상세: TOTP의 `2fa_enable/disable`은 AuditLog 대상으로 명시되어 있으나, WebAuthn credential의 등록(`webauthn_credential_register`)·삭제(`webauthn_credential_delete`)는 AuditLog 포함 여부가 결정되지 않았다. WebAuthn credential은 TOTP와 동등하거나 더 강력한 인증 수단이므로 보안-critical 변경으로 분류되어야 한다. 현재 LoginHistory에 `webauthn_failed` 이벤트만 있고 credential 추가/삭제 감사는 누락이다.
  - 제안: spec `§4.1` 인증 카테고리 행에 `webauthn_credential_register`·`webauthn_credential_delete` 포함 여부를 명시한다. AuditLog 대신 LoginHistory 확장으로 대신할 수도 있으나 그 결정도 spec에 기재해야 한다.

- **[INFO]** spec `§1-data-model.md §2.18.2` — 마이그레이션 번호 V058이 spec에 고정 표기됨
  - 위치: `spec/1-data-model.md §2.18.2` ("WebAuthn 추가는 V058 에서 DROP CONSTRAINT + ADD CONSTRAINT 패턴으로 갱신")
  - 상세: 구현 시 실제 마이그레이션 번호가 V058이 아닐 수 있다(plan `§3` 자체에도 착수 전 max(V) 재확인 지침이 있음). spec에 미래 마이그레이션 번호가 고정되면 코드와 spec 사이에 번호 불일치가 발생했을 때 spec 신뢰도가 훼손된다.
  - 제안: spec의 V058 표기를 "다음 가용 마이그레이션 번호에서 수행"으로 변경하고, 실제 번호는 구현 완료 후 사후 갱신한다.

---

#### 반환값

- **[CRITICAL]** `auth.service.ts` `login()` 반환 타입 — 신규 응답 구조 미반영으로 모든 경로 불완전
  - 위치: `auth.service.ts:310-316`, `auth.controller.ts:178-204`
  - 상세: spec `§1.4.2`의 응답 구조는 `{ requires2fa: true, methods, challengeToken, requiresTotp? }` 또는 `{ accessToken }`이다. 현재 `login()`의 반환 타입은 `{ requiresTotp: true; challengeToken: string }` 또는 `{ accessToken }`으로, 모든 2FA 분기 경로에서 `requires2fa`·`methods` 필드가 빠진 채로 반환된다. 클라이언트는 spec 약속과 다른 응답을 받게 된다.
  - 제안: `login()` 반환 타입을 spec `§5`의 API 계약과 일치하도록 갱신하고, 컨트롤러의 응답 직렬화 코드도 동시에 갱신한다.

- **[WARNING]** WebAuthn credential PATCH endpoint — 본인 소유 아닐 때 `404` 반환 (enumeration 방지) 명시
  - 위치: spec `§5` `PATCH /api/auth/2fa/webauthn/credentials/:id` 항목
  - 상세: spec은 "본인 소유 아니면 404 (enumeration 방지)"라고 명시했다. 이는 올바른 보안 설계이나, 구현 시 `findOneBy({ id, userId })` 실패 경우와 해당 credential이 다른 사용자 소유인 경우를 동일하게 404로 처리해야 한다. 200 응답도 갱신된 row를 반환하는데 `publicKey`·`counter` 등 민감 필드가 응답에 포함되어서는 안 된다는 내용이 GET endpoint 설명(`publicKey·counter 미노출`)에만 있고 PATCH 응답에는 명시되지 않았다.
  - 제안: spec `§5` PATCH 항목에 응답 DTO 형태(`{ id, deviceName, transports, lastUsedAt, createdAt }` — publicKey·counter 미포함)를 GET 응답과 동일하게 명시한다.

---

### 요약

이번 변경의 핵심 목표인 WebAuthn(Passkey/보안 키) 2FA 추가는 spec 레이어에서 상당히 충실하게 정의되어 있다 — `spec/5-system/1-auth.md §1.4`, `spec/1-data-model.md §2.21 WebAuthnCredential`, `spec/2-navigation/10-auth-flow.md §3.4.2` 등이 일관성 있게 갱신됐고, Rationale 1.4.A~E를 통해 설계 결정의 근거도 문서화됐다. 그러나 요구사항 관점에서 심각한 문제는 코드 구현 레이어에서 집중된다. (1) `auth.service.ts`의 `login()` 메서드가 WebAuthn credential 존재 여부를 전혀 인식하지 않아 spec의 핵심 비즈니스 규칙(WebAuthn 우선·TOTP fallback 자동 금지)이 완전히 구현되지 않았고, (2) `loginWithTotp()`에 WebAuthn 사용자 차단 백스탑이 없어 spec이 명시적으로 기각한 약한 인증 수단 우회가 가능하며, (3) `LoginHistoryEvent` 타입에 `webauthn_failed`가 없어 V058 마이그레이션과 TypeScript 타입이 불일치한다. 추가로 `forgotPassword`·`checkEmail` 엔드포인트의 응답 wrap 누락, `requiresTotp` deprecated 제거 조건 불완전 기술, counter 역행 응답 코드 불일치(400 vs 401) 등이 요구사항-구현 간 괴리를 형성하고 있다. WebAuthn 관련 서비스·엔티티·컨트롤러 파일 자체가 미존재하므로 구현 착수 전 `login()` 분기 리팩토링과 신규 파일 신설 순서를 고정하고 진행해야 한다.

---

### 위험도

HIGH
