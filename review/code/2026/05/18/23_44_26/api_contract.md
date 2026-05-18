# API 계약(API Contract) 리뷰

리뷰 대상: WebAuthn 2FA 구현 관련 consistency review 산출물
변경 파일: `review/consistency/2026/05/18/23_02_30/` 및 `review/consistency/2026/05/18/23_11_17/` 하위 문서들

---

### 발견사항

변경된 파일들은 직접적인 API 구현 코드가 아닌 consistency checker 리뷰 산출물(`.md`, `.json`)입니다. 그러나 이 문서들이 분석하는 기존 코드베이스 및 WebAuthn 구현 계획에는 API 계약 관점에서 중대한 문제들이 발견·기록되어 있습니다. 해당 발견사항들은 현재 리뷰 대상 변경에서 표면화된 API 계약 위험으로 아래와 같이 정리합니다.

---

#### 1. 응답 형식 일관성 위반 (기존 코드베이스)

- **[CRITICAL]** `forgotPassword` 엔드포인트 — `{ data: ... }` 래핑 누락
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:379-381` (convention_compliance.md 파일 8 기준)
  - 상세: `return this.authService.forgotPassword(dto.email)` 가 서비스의 raw 반환값을 그대로 리턴한다. Swagger 선언은 `@ApiOkWrappedResponse(AuthMessageDto, ...)` 로 `{ data: AuthMessageDto }` 구조를 약속하지만 실제 응답과 불일치한다. `TransformInterceptor` 자동 래핑에 의존하더라도 같은 컨트롤러의 다른 메서드들과 일관성이 깨진다.
  - 제안: `return { data: await this.authService.forgotPassword(dto.email) }` 로 명시 래핑 통일.

- **[CRITICAL]** `checkEmail` 엔드포인트 — `{ data: ... }` 래핑 누락
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:411-413`
  - 상세: `return this.authService.checkEmail(dto.email)` 가 `{ available: boolean }` 을 직접 반환한다. Swagger `@ApiOkWrappedResponse(CheckEmailResultDto, ...)` 선언과 실제 응답 구조가 불일치한다.
  - 제안: `return { data: await this.authService.checkEmail(dto.email) }` 로 래핑.

#### 2. `/auth/login` 응답 스키마 불완전 문서화

- **[CRITICAL]** `LoginChallengeDto` — spec 정의 필드 `requires2fa`, `methods` 누락
  - 위치: `codebase/backend/src/modules/auth/dto/responses/auth-response.dto.ts:11-16`, `auth.service.ts:226`, `auth.controller.ts:194-200` (naming_collision.md 파일 11 기준)
  - 상세: spec `§1.4.2` 가 `/auth/login` 의 2FA 필요 시 응답을 `{ requires2fa: boolean, methods: string[], challengeToken: string, requiresTotp?: boolean }` 으로 정의하지만, 현재 코드베이스의 `LoginChallengeDto` 는 `requiresTotp: boolean` + `challengeToken: string` 만 보유한다. `requires2fa` 와 `methods` 필드가 DTO·서비스·컨트롤러 어디에도 없다. WebAuthn 구현 시 세 곳을 동시에 수정하지 않으면 타입 불일치 또는 런타임 오류가 발생한다.
  - 제안: `LoginChallengeDto` 를 `requires2fa: boolean`, `methods: string[]`, `challengeToken: string`, `requiresTotp?: boolean` 으로 확장하고, 서비스 반환 타입과 컨트롤러 응답 객체를 동시에 갱신.

- **[WARNING]** `POST /auth/login` Swagger 응답 스키마 — 2FA 분기 미문서화
  - 위치: `auth.controller.ts` — `/auth/login` 핸들러의 Swagger 데코레이터
  - 상세: 현재 `@ApiOkWrappedResponse(AccessTokenDto, ...)` 만 선언되어 있어 2FA 필요 시 반환되는 `LoginChallengeDto` 분기가 Swagger UI 에 전혀 표현되지 않는다. `LoginChallengeDto` 가 정의는 되어 있으나 컨트롤러에서 미참조(dead export) 상태다. API 클라이언트는 2FA 응답 스키마를 알 방법이 없다.
  - 제안: `@ApiOkResponse({ schema: { oneOf: [{ $ref: getSchemaPath(AccessTokenDto) }, { $ref: getSchemaPath(LoginChallengeDto) }] } })` 또는 union 응답 DTO 로 두 분기를 모두 문서화.

#### 3. 페이지네이션 응답 구조 이중 중첩

- **[WARNING]** `SessionListDto` — 이중 `data` 중첩 (`{ data: { data: SessionDto[] } }`)
  - 위치: `dto/responses/session.dto.ts:53-57`
  - 상세: `SessionListDto` 가 내부에 `data: SessionDto[]` 필드를 가지며, 컨트롤러에서 `@ApiOkWrappedResponse(SessionListDto, ...)` 로 래핑하면 실제 응답이 `{ data: { data: SessionDto[] } }` 이중 구조가 된다. 반면 컨트롤러 실제 반환값은 `{ data: sessions }` (`{ data: SessionDto[] }`) 이므로 Swagger 스키마와 구현이 불일치한다.
  - 제안: `SessionListDto` 의 `data` 필드를 `items` 또는 `sessions` 로 변경하거나, `@ApiOkWrappedArrayResponse(SessionDto, ...)` 헬퍼로 단일화.

- **[WARNING]** `LoginHistoryPageDto` — 커서 기반 페이지네이션 이중 중첩
  - 위치: `dto/responses/login-history.dto.ts:41-51`
  - 상세: `LoginHistoryPageDto` 가 `{ data: LoginHistoryItemDto[], nextCursor: string | null }` 구조를 갖는데, `@ApiOkWrappedResponse(LoginHistoryPageDto, ...)` 와 결합 시 `{ data: { data: [...], nextCursor: '...' } }` 이중 중첩 발생. 커서 페이지네이션의 실제 응답 구조가 Swagger 스키마에서 정확히 표현되지 않는다.
  - 제안: `data` 필드를 `items` 로 개명하여 `{ data: { items: [...], nextCursor } }` 구조를 명확히 표현.

#### 4. `LoginHistoryEvent` 타입 — `webauthn_failed` 누락

- **[CRITICAL]** `LoginHistoryEvent` 열거형에 `webauthn_failed` 미추가
  - 위치: `codebase/backend/src/modules/auth` — LoginHistory 관련 타입 정의 (naming_collision.md 파일 11 기준)
  - 상세: spec 및 V058 마이그레이션이 `chk_login_history_event` CHECK 제약에 `webauthn_failed` 를 추가하지만, 현재 코드베이스의 TypeORM 엔티티/열거형에 해당 값이 없다. DB 스키마와 ORM 타입 간 불일치로 `webauthn_failed` 이벤트 기록 시 TypeORM 검증 오류가 발생할 수 있다.
  - 제안: `LoginHistory` 엔티티의 `event` 열거형에 `webauthn_failed` 추가. V058 마이그레이션과 동시에 적용.

#### 5. HTTP 상태 코드 — counter 역행 시 400 vs 401 불일치

- **[WARNING]** WebAuthn counter 역행 시 `400` 응답 — spec 의 `401` 정의와 충돌
  - 위치: `plan/in-progress/2fa-webauthn.md §4 백엔드 구현 91번 줄` (rationale_continuity.md 파일 6 기준)
  - 상세: plan §4 구현 설명에 counter 역행 시 `400` 응답으로 기술되어 있으나, spec `1-auth.md §5` API 표 및 동일 plan e2e 시나리오(116번 줄)는 모두 `401` 을 명시한다. `400(Bad Request)` 은 클라이언트 요청 오류 시맨틱으로, counter 역행("즉시 신뢰 철회")의 인증 실패 맥락과 맞지 않는다.
  - 제안: plan §4 구현 설명을 `401` 로 수정. `spec/5-system/1-auth.md §5` 가 SoT.

#### 6. URL/경로 설계 — 구 endpoint 이중화 및 deprecated 처리 불명확

- **[WARNING]** `/api/users/me/enable-2fa`, `/api/users/me/confirm-2fa` — canonical 경로와의 이중화 미해소
  - 위치: `spec/2-navigation/9-user-profile.md §6.1`
  - 상세: 사용자 프로필 spec 이 `/api/users/me/enable-2fa`, `/api/users/me/confirm-2fa` 를 괄호로 `canonical: /api/auth/2fa/setup` 을 표기하면서 계속 나열한다. 이 경로들이 실제 구현된 별도 라우트인지, deprecated alias 인지, 또는 이미 제거된 구 endpoint 인지 명확하지 않아 구현자가 중복 구현할 위험이 있다.
  - 제안: spec 에서 해당 행을 deprecated 표기로 명확히 처리하거나 제거.

#### 7. 하위 호환성 — `requiresTotp` deprecated 제거 조건 불완전 추적

- **[WARNING]** `requiresTotp` deprecated 필드 제거 타임라인 — 프론트엔드 배포 조건 누락
  - 위치: `plan/in-progress/2fa-webauthn.md §4 105번 줄` (rationale_continuity.md 기준)
  - 상세: spec `§1.4.2` 는 제거 조건으로 "(1) 두 마이너 버전 후 AND (2) `methods` 만 보는 신규 프론트엔드 동일 배포 확인" 두 가지를 AND 관계로 정의한다. plan 은 (1) 조건만 언급하고 (2) 를 생략했다. follow-up plan 작성 시 (1) 만 충족되어 early removal 이 발생하면 기존 프론트엔드 클라이언트가 breaking change 에 노출된다.
  - 제안: plan §4 를 "두 마이너 버전 후 AND `methods` 만 보는 신규 프론트엔드 동일 배포 확인 후 제거" 로 보완.

#### 8. 인증/인가 — WebAuthn 엔드포인트 가드 적용

- **[INFO]** `AuthController` 혼합 컨트롤러 — `@Public()` 엔드포인트 description 인증 불필요 명시 미흡
  - 위치: `auth.controller.ts:81-83`
  - 상세: 대부분이 `@Public()` 이나 `2fa/setup`, `2fa/verify`, `2fa/disable` 은 `@UseGuards(JwtAuthGuard)` 보호가 필요해 "혼합 컨트롤러" 로 분류된다. 규약 §2-1 에 따라 `@Public()` 엔드포인트의 description 에 "인증 불필요" 명시가 필요하나 일부 누락. 엄밀한 규약 위반은 아니나 Swagger UI 에서 혼합 사실이 명확히 구분되지 않는다.
  - 제안: `@Public()` 엔드포인트 description 에 "인증 불필요" 를 명시하거나, 분리된 컨트롤러로 리팩토링.

---

### 요약

이번 변경은 WebAuthn 2FA 구현 준비 과정의 consistency review 산출물이며 직접적인 API 구현 코드 변경은 없다. 그러나 이 리뷰 문서들이 발굴한 기존 코드베이스의 API 계약 문제가 상당하다. 특히 `forgotPassword`, `checkEmail` 엔드포인트의 응답 래핑 누락(CRITICAL 2건), `LoginChallengeDto` 의 `requires2fa`·`methods` 필드 누락(CRITICAL 1건), `LoginHistoryEvent` 열거형의 `webauthn_failed` 누락(CRITICAL 1건)은 WebAuthn 구현 착수 전에 반드시 해소되어야 한다. `SessionListDto`·`LoginHistoryPageDto` 의 이중 중첩 구조도 클라이언트가 실제 받는 응답과 Swagger 스키마 간 불일치를 초래하는 WARNING 수준 문제다. `requiresTotp` 의 하위 호환성 유지 제거 조건이 plan 에서 불완전하게 추적되는 점도 향후 breaking change 위험을 내포한다. 전반적으로 WebAuthn 구현이 기존의 API 계약 불일치 위에 추가되는 구조이므로, 구현 착수 전 CRITICAL 4건 해소가 선결 조건이다.

### 위험도

HIGH
