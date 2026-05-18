# 아키텍처(Architecture) 리뷰 — 2FA WebAuthn 구현 계획 및 spec 개정

리뷰 대상: consistency-check 세션 산출물 (spec draft / impl-prep 양 라운드) + spec 파일 변경  
분석 기준: SOLID 원칙, 결합도/응집도, 레이어 책임 분리, 디자인 패턴, 순환 의존성, 추상화 수준, 모듈 경계, 확장성

---

### 발견사항

---

#### SOLID 원칙

- **[CRITICAL]** 단일 책임 원칙(SRP) — `auth.service.ts`의 `login()` 가 2FA 방식 결정 책임을 단독으로 포함  
  - 위치: `auth.service.ts` `login()` (line 310–316), `loginWithTotp()` (line 338–395)  
  - 상세: 현재 `login()` 는 비밀번호 검증 + 2FA 방식 탐지 + challengeToken 발급을 한 메서드에서 담당한다. WebAuthn 이 추가되면 "어떤 2FA 방식이 활성인지 결정하는 규칙" 이 `login()` 안에 인라인으로 쌓이게 된다. spec §1.4.2 의 분기 로직(WebAuthn credential 개수 조회 → methods 배열 결정)이 서비스 메서드 본문에 직접 기술되면 향후 새 2FA 방식 추가 시 이 메서드를 반드시 수정해야 하는 구조가 된다.  
  - 제안: `TwoFactorMethodResolver` 같은 전략(Strategy) 또는 도메인 서비스를 분리해 "어떤 방식을 써야 하는지" 결정 책임을 격리한다. `login()` 는 비밀번호 검증 후 resolver 를 호출하고 결과를 응답으로 직렬화하는 역할만 남긴다.

- **[WARNING]** 개방-폐쇄 원칙(OCP) — 신규 2FA 방식 추가 시 `auth.service.ts` 다수 메서드를 열어야 함  
  - 위치: `auth.service.ts` `login()`, `loginWithTotp()` + 신규 추가 예정 WebAuthn 경로  
  - 상세: TOTP / WebAuthn 외에 세 번째 2FA 방식이 필요해지면 `login()` 분기, `loginWithTotp()` backstop 체크, DTO 등 여러 위치를 동시에 열어야 한다. 현재 설계는 2FA 방식이 열거형으로 고정되어 있어 확장 시 폐쇄되어 있지 않다.  
  - 제안: 2FA 방식을 인터페이스(`ITwoFactorMethod`)로 추상화하고, TOTP / WebAuthn 각각을 구현체로 분리한다. `login()` 은 등록된 구현체 목록을 순회해 활성 방식을 결정하는 형태로 OCP 를 충족한다.

- **[WARNING]** 의존성 역전 원칙(DIP) — `WebAuthnCredential` 엔티티 등록 위치 혼동  
  - 위치: `auth.module.ts` `TypeOrmModule.forFeature`, plan §4 ("app.module.ts 의 entities 배열에 추가")  
  - 상세: plan §4 가 `app.module.ts entities 배열` 로 표기해 NestJS 모듈 시스템의 추상화(forFeature 패턴)를 우회하는 것처럼 읽힌다. `WebAuthnCredential` 을 `AuthModule` 안의 `forFeature` 에 등록하지 않으면 `WebAuthnService` 가 Repository 를 주입받을 때 구체적인 글로벌 TypeORM 설정에 의존하게 되어 DIP 위반이 된다.  
  - 제안: `AuthModule` 의 `TypeOrmModule.forFeature([..., WebAuthnCredential])` 에 추가하고, 하이레벨 모듈(`AppModule`)의 `forRootAsync` entities 배열에는 프로젝트 패턴에 맞춰 추가 여부를 확인한다.

---

#### 결합도 / 응집도

- **[CRITICAL]** `auth.service.ts` — `loginWithTotp()` 에 WebAuthn 존재 여부 backstop 미구현으로 인한 책임 결합  
  - 위치: `auth.service.ts` `loginWithTotp()` (line 338–395)  
  - 상세: WebAuthn 추가 후에도 `loginWithTotp()` 가 WebAuthn credential 보유 여부를 내부에서 확인하지 않으면, TOTP 서비스가 WebAuthn 인증 정책("WebAuthn 등록 사용자는 TOTP 경로로 진입 불가") 을 암묵적으로 깨뜨린다. 두 서비스(TOTP Service, WebAuthn Service)의 보안 정책이 서로 독립적으로 강제되지 않아 결합도가 높아지는 방향이다.  
  - 제안: 인증 방식 결정 로직을 상위 레이어(AuthService 또는 별도 2FA Policy Service)에서 단일 진입점으로 관리하고, `loginWithTotp()` 는 "이미 TOTP 가 허용된 흐름" 임을 전제한 상태에서 호출되도록 설계한다. 또는 `loginWithTotp()` 내부에서 credential 조회로 backstop 을 추가해 자기 보호성을 확보한다.

- **[WARNING]** `LoginChallengeDto` — 하나의 DTO 가 두 개의 서로 다른 응답 형태를 커버  
  - 위치: `dto/responses/auth-response.dto.ts:11-17`  
  - 상세: `POST /auth/login` 응답은 (a) 정상 로그인 (`accessToken`) 과 (b) 2FA 필요 (`requires2fa`, `methods`, `challengeToken`, `requiresTotp?`) 두 분기를 가진다. 단일 DTO 에 이 두 형태를 담으면 DTO 의 응집도가 낮아지고, deprecated 필드(`requiresTotp`) 와 신규 필드(`requires2fa`, `methods`) 가 혼재해 소비 측 코드가 분기를 이해하기 어려워진다.  
  - 제안: `AccessTokenResponseDto` 와 `TwoFactorChallengeResponseDto` 로 분리하고, 컨트롤러에서 Swagger `oneOf` 로 문서화한다. 각 DTO 의 응집도를 높여 소비 측이 어떤 분기인지 타입 수준에서 명확하게 인식하도록 한다.

---

#### 레이어 책임 분리

- **[CRITICAL]** 프레젠테이션/비즈니스 레이어 혼용 — `auth.controller.ts` 응답 wrapping 누락  
  - 위치: `auth.controller.ts:379-381` (`forgotPassword`), `auth.controller.ts:411-413` (`checkEmail`)  
  - 상세: 두 엔드포인트에서 서비스의 반환값을 직접 리턴해 `{ data: ... }` wrapping 이 누락됐다. 컨트롤러(프레젠테이션 레이어)가 응답 직렬화 규칙을 선택적으로 적용하면 WebAuthn 관련 신규 엔드포인트에서도 동일한 패턴이 반복될 위험이 있다. `TransformInterceptor` 의 자동 wrap 에 의존하는지 여부도 명확하지 않아 Swagger 문서와 실제 응답 구조 사이의 계약이 불분명하다.  
  - 제안: WebAuthn 엔드포인트 구현 전에 `forgotPassword` / `checkEmail` 의 wrap 누락을 수정하고, 프레젠테이션 레이어 전체에서 일관된 `{ data: ... }` 직렬화 규칙을 적용한다. `TransformInterceptor` 자동 처리 여부를 코드 내 주석 또는 모듈 문서로 명확히 표기한다.

- **[WARNING]** 데이터 레이어 책임 — `WebAuthnService.deleteCredential` 이 `user.webauthn_recovery_codes` NULL 화를 담당  
  - 위치: spec `1-auth.md §5` DELETE 엔드포인트 설명, spec `1-data-model.md §2.1`  
  - 상세: "마지막 credential 삭제 시 `webauthn_recovery_codes` NULL 화는 애플리케이션 레이어(`WebAuthnService.deleteCredential`)의 책임이며 DB 트리거가 아니다" 라는 결정은 명시적이고 의도적이다. 그러나 이 비즈니스 규칙이 `WebAuthnService` 안에만 묶여 있으면, 향후 다른 경로(예: 관리자 API, 일괄 삭제 배치)에서 credential 을 삭제할 때 동일 규칙을 독립적으로 재구현해야 하는 위험이 생긴다.  
  - 제안: `deleteCredential()` 를 호출하는 모든 경로가 반드시 이 서비스를 통하도록 아키텍처 경계를 문서화한다. 향후 배치 삭제 등이 생기면 도메인 이벤트(`WebAuthnCredentialDeleted`) 또는 repository 훅으로 NULL 화 책임을 격상하는 것을 검토한다.

- **[WARNING]** `SessionListDto` / `LoginHistoryPageDto` 이중 중첩 — 데이터 레이어 모델이 프레젠테이션 레이어 직렬화 규칙과 충돌  
  - 위치: `dto/responses/session.dto.ts:53-57`, `dto/responses/login-history.dto.ts:41-51`  
  - 상세: DTO 내부에 `data: T[]` 필드를 두고 이를 다시 `@ApiOkWrappedResponse` 로 감싸면 `{ data: { data: [...] } }` 이중 중첩이 발생한다. 이는 데이터 구조 설계(DTO 정의)와 직렬화 규약(`{ data: ... }` 래핑) 이 동일 레이어에서 중복으로 적용된 안티패턴이다.  
  - 제안: `SessionListDto.data` 를 `sessions` 또는 `items` 로 개명해 래퍼와의 충돌을 해소한다. `LoginHistoryPageDto` 도 동일 패턴 적용. WebAuthn 관련 목록 응답(`GET /api/auth/2fa/webauthn/credentials`) 설계 시 이 패턴이 반복되지 않도록 사전 정의한다.

---

#### 디자인 패턴

- **[CRITICAL]** JWT 클레임 패턴 불일치 — challengeToken (`mfa_challenge: boolean`) vs optionsToken (`kind: string`)  
  - 위치: `auth.service.ts:311-314` challengeToken 발급, spec `1-auth.md §1.4.4` optionsToken payload  
  - 상세: 두 JWT 가 토큰 종류를 식별하는 방식이 다르다. challengeToken 은 `mfa_challenge: true` (boolean flag 패턴), optionsToken 은 `kind: 'webauthn_auth'|'webauthn_register'` (enum 타입 패턴). `authenticate/verify` 엔드포인트는 두 토큰을 동시에 검증해야 하므로 검증 코드에서 두 패턴을 각각 다르게 처리해야 한다. 이는 일관성 없는 인터페이스로 구현 오류의 온상이 된다.  
  - 제안: challengeToken 도 `kind: 'mfa_challenge'` 를 추가해 optionsToken 과 동일한 패턴으로 통일한다. `mfa_challenge: true` 는 기존 클라이언트 호환을 위해 병기하고, verify 핸들러는 `kind` 필드 하나만 확인하면 되는 구조로 단순화한다.

- **[WARNING]** Strategy 패턴 미적용 — `auth.service.ts` 에 2FA 방식별 분기가 조건문으로 구현 예정  
  - 위치: plan §4 백엔드 구현 구조, spec `1-auth.md §1.4.2`  
  - 상세: 현재 설계는 `login()` 에서 WebAuthn credential 개수를 확인해 `methods` 배열을 결정하는 if/else 구조가 될 가능성이 높다. 2FA 방식이 TOTP / WebAuthn 두 가지인 현재도 복잡도가 허용 가능하나, 세 번째 방식 추가 시 조건문이 선형으로 증가하는 안티패턴(if-else chain)이 된다.  
  - 제안: `ITwoFactorHandler` 인터페이스와 `TOTP_HANDLER`, `WEBAUTHN_HANDLER` 토큰을 정의해 NestJS DI 컨테이너가 방식별 핸들러를 주입하도록 설계한다. `login()` 는 핸들러 목록을 순회해 활성 방식을 결정하는 Generic 로직만 갖는다. 현 단계에서 바로 적용이 부담스럽다면 최소한 분기 로직을 `TwoFactorPolicyService` 로 추출해 단일 책임을 분리한다.

- **[INFO]** Stateless JWT challenge 패턴 — 아키텍처적으로 올바른 선택  
  - 위치: spec `1-auth.md Rationale 1.4.C`, spec `1-data-model.md §2.21`  
  - 상세: `webauthn_challenge` 별도 테이블 대신 stateless JWT(`optionsToken`)를 채택한 결정은 아키텍처적으로 타당하다. DB 단명 row 의 TTL 관리·인덱스·cleanup 배치 부담을 제거하고, 수평 확장(stateless) 환경에서도 별도 세션 스토어 없이 작동한다. `kind` + 만료 시간으로 교차 사용 차단도 가능하다.  
  - 제안: 해당 패턴을 적용할 때 `kind` 검증을 verify 핸들러에서 첫 번째로 실행해 잘못된 토큰 종류가 조기에 거부되도록 순서를 명시한다.

---

#### 순환 의존성

- **[WARNING]** `AuthModule` 내 `WebAuthnService` ↔ `AuthService` 잠재적 순환 참조  
  - 위치: plan §4 구조에서 `WebAuthnService` 신설, `auth.service.ts` 의 `login()` 이 WebAuthn credential 개수 조회 필요  
  - 상세: `AuthService.login()` 이 `WebAuthnService.getCredentialCount()` 를 호출하고, `WebAuthnService` 가 challengeToken 검증 등에서 `AuthService` 의 JWT 유틸을 참조하면 순환 의존이 발생할 수 있다. NestJS 에서는 `forwardRef()` 로 우회 가능하지만 이는 설계 결함의 증상이다.  
  - 제안: JWT 발급·검증 로직을 `JwtUtilService` 또는 기존 `JwtService` 래퍼로 분리해 두 서비스가 공통 의존성을 아래 방향으로만 참조하도록 의존성 방향을 단방향으로 유지한다. `AuthService` → `WebAuthnService` 방향은 허용하되, `WebAuthnService` → `AuthService` 역방향은 금지한다.

---

#### 추상화 수준

- **[WARNING]** spec 에 구체적 마이그레이션 번호(V057·V058) 고정 — 과도한 구체화  
  - 위치: `spec/1-data-model.md §2.18.2`, plan §3  
  - 상세: spec 이 미래의 구체적 마이그레이션 번호를 박아두면 spec 의 추상화 수준이 구현 세부사항 레벨까지 내려온다. 번호가 실제 파일과 어긋나면 spec 신뢰도가 하락한다. spec 은 "무엇을 변경하는가" (LoginHistory event enum 에 webauthn_failed 추가) 를 기술하고 번호는 구현 산출물이 결정해야 한다.  
  - 제안: spec 본문에서 마이그레이션 번호를 제거하고 "다음 가용 번호에서 수행" 으로 대체한다. 구현 완료 후 실제 번호를 spec 에 사후 기재(각주 형태)하거나 생략한다.

- **[INFO]** `webauthn_recovery_codes` NULL 화 책임 레벨 적절 — 애플리케이션 레이어 명시  
  - 위치: `spec/1-data-model.md §2.1`, spec `1-auth.md §5` DELETE 설명  
  - 상세: NULL 화 책임을 DB 트리거가 아닌 `WebAuthnService.deleteCredential` 에 명시한 것은 적절한 추상화 수준이다. 트리거는 테스트·디버깅이 어렵고, 애플리케이션 레이어에서 명시적으로 처리하면 관련 로직을 추적·테스트하기 용이하다.  
  - 제안: 없음. 단, 다중 credential 삭제(배치) 경로가 나중에 생길 경우 반드시 이 서비스를 통하도록 아키텍처 경계를 지킨다.

---

#### 모듈 경계

- **[CRITICAL]** `auth.module.ts` 가 WebAuthn, TOTP, 세션, 로그인 이력 등을 단일 모듈로 포함 — 모듈 경계 비대화 예고  
  - 위치: `codebase/backend/src/modules/auth/` 전체 구조  
  - 상세: 현재 `AuthModule` 은 회원가입, 로그인, OAuth, 세션 관리, TOTP, 로그인 이력을 이미 포함하고 있다. WebAuthn 서비스 / 컨트롤러 / 엔티티가 추가되면 단일 NestJS 모듈의 책임이 과도하게 커진다. NestJS 의 모듈 경계는 단순 파일 분리가 아닌 DI 컨텍스트 격리를 의미하며, 지나치게 큰 모듈은 테스트 격리와 의존성 가시성을 해친다.  
  - 제안: 단기적으로는 `WebAuthnModule` 을 `auth/` 하위 하위 모듈로 정의하고 `AuthModule` 에서 import 하는 구조를 검토한다. 중기적으로 `TotpModule`, `SessionModule` 도 분리해 각 모듈이 명확한 단일 책임을 갖도록 한다. 이를 통해 WebAuthn 단위 테스트 시 TOTP, 세션 등 무관한 서비스를 mock 할 필요가 없어진다.

- **[WARNING]** `webauthn.config.ts` 가 `common/config/index.ts` 에 export 미등록 시 ConfigModule 미주입  
  - 위치: `codebase/backend/src/common/config/` 모듈 경계  
  - 상세: NestJS `ConfigModule.forRoot` 의 `load` 배열에 `webauthn.config` 가 포함되지 않으면 `ConfigService.get('webauthn.*')` 호출 시 런타임에서 undefined 가 반환된다. 모듈 경계를 명확하게 관리하지 않아 설정 주입이 누락되는 패턴은 실제 서비스 환경에서 디버깅이 어려운 결함이 된다.  
  - 제안: `webauthn.config.ts` 를 `common/config/index.ts` 에 export 하고, `app.module.ts` 의 `ConfigModule.forRoot({ load: [..., webauthnConfig] })` 에 포함한다. 기존 config 파일 추가 절차와 동일한 체크리스트를 plan 에 명시한다.

---

#### 확장성

- **[WARNING]** `LoginHistoryEvent` TypeScript 타입 유니온 — 신규 이벤트 타입 추가 시 여러 파일 수정 필요  
  - 위치: `login-history.entity.ts:12-18`  
  - 상세: `LoginHistoryEvent` 가 리터럴 유니온(`'login_success' | 'login_failed' | ...`)으로 정의되면 `webauthn_failed` 추가 시 entity 파일 + 마이그레이션 CHECK 제약 + 서비스 타입 검사가 동시에 변경되어야 한다. 이는 Open-Closed 와 확장성 모두에 영향을 준다.  
  - 제안: `LoginHistoryEvent` 를 `enum` 또는 `const` 객체로 중앙화하고, TypeORM column 과 마이그레이션 CHECK 제약 값이 같은 소스에서 파생되도록 한다. 예: `Object.values(LoginHistoryEvent).join("', '")` 로 CHECK 제약 문자열 생성. 이렇게 하면 새 이벤트 타입 추가 시 단일 위치만 변경한다.

- **[INFO]** `@simplewebauthn/server` 라이브러리 채택 — 확장성 관점에서 적절한 선택  
  - 위치: spec `1-auth.md Rationale 1.4.A`  
  - 상세: `@simplewebauthn/*` 은 서버·브라우저 양쪽 페어를 같은 메인테이너가 관리하고, registration/authentication generate-verify 인터페이스가 대칭이다. 향후 WebAuthn 레벨 3 확장(가로평가·attestation 형식 추가) 도 같은 인터페이스로 수용 가능하다.  
  - 제안: 없음. 라이브러리 버전 고정(lock)과 보안 업데이트 정책을 `spec/5-system/1-auth.md` 또는 `PROJECT.md` 에 명시하는 것을 권장한다.

- **[INFO]** TOTP / WebAuthn 복구 코드 풀 분리 설계 — 향후 방식 추가 시 확장 용이  
  - 위치: spec `1-auth.md Rationale 1.4.B`, `spec/1-data-model.md §2.1`  
  - 상세: `user.totp_recovery_codes` 와 `user.webauthn_recovery_codes` 를 각각 별도 컬럼으로 분리한 설계는 방식별 독립 폐기·재발급이 가능해 확장성이 높다. 한 방식의 비활성화가 다른 방식의 복구 코드에 영향을 주지 않는다.  
  - 제안: 없음.

---

### 요약

이번 변경 세트는 WebAuthn 2FA 를 기존 TOTP 에 추가하는 대규모 spec 개정과 구현 착수 준비로 구성된다. spec 수준에서는 인증 방식 선택 규칙(`WebAuthn 우선, TOTP fallback 자동 금지`), stateless JWT challenge, 복구 코드 풀 분리 같은 핵심 아키텍처 결정이 Rationale 과 함께 명확히 기술되어 있어 설계 의도의 일관성은 높다. 그러나 구현 착수 직전 시점의 현행 코드베이스와 비교하면 두 가지 중대한 구조적 문제가 식별된다. 첫째, `auth.service.ts` 의 `login()` / `loginWithTotp()` 가 WebAuthn credential 존재 여부를 전혀 인식하지 않아 Rationale 1.4.D("TOTP 자동 fallback 금지")가 코드 레벨에서 집행되지 않는 상태이며, 이를 수정하려면 서비스 메서드 다수를 동시에 변경해야 한다. 이는 단일 책임 원칙 위반이자 2FA 정책 강제 책임이 분산된 결과다. 둘째, `AuthModule` 이 이미 과부하된 상태에서 WebAuthn 서비스·엔티티·컨트롤러까지 합류하면 모듈 경계가 무너져 테스트 격리와 의존성 가시성이 더욱 악화된다. 또한 JWT 클레임 패턴(boolean flag vs. `kind` enum), 응답 DTO wrapping 불일치, spec 의 마이그레이션 번호 고정, `LoginHistoryEvent` 타입 확장 구조 등 중간 수준의 설계 개선이 필요한 항목이 다수 존재한다. WebAuthn 구현에 착수하기 전에 `login()` 분기 리팩토링 + `loginWithTotp()` backstop + `LoginChallengeDto` 확장을 선행하는 것이 전체 아키텍처 안정성을 위한 최우선 과제다.

---

### 위험도

HIGH
