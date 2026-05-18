# 부작용(Side Effect) 리뷰 — 2FA WebAuthn 구현 변경

리뷰 대상: review/consistency 산출물 (파일 1~13) + spec 문서 변경 (파일 14~19)  
리뷰 일시: 2026-05-18

---

### 발견사항

---

#### 1. 의도치 않은 상태 변경

- **[WARNING]** `WebAuthnService.deleteCredential` 의 `user.webauthn_recovery_codes` NULL 화 — 호출 경로 다중화 위험
  - 위치: `spec/5-system/1-auth.md §5` DELETE 엔드포인트 설명 + `spec/1-data-model.md §2.21 WebAuthnCredential` counter 필드 설명
  - 상세: spec 은 "마지막 credential 삭제 시 `WebAuthnService.deleteCredential` 가 `user.webauthn_recovery_codes` 를 NULL 화한다"고 애플리케이션 레이어 책임으로 명시한다. counter 역행 감지 시에도 동일 서비스 경로에서 row 를 삭제한다. 두 경로(사용자 명시 삭제 / 자동 counter 역행 삭제) 모두 단일 `deleteCredential()` 를 거치지 않거나, credential count 확인 없이 복구 코드를 NULL 화하면 아직 다른 credential 이 남아있음에도 복구 코드가 삭제되는 공유 상태 오염이 발생한다. spec 에 "마지막 credential 일 때만 NULL 화"라고 명시되어 있으나, counter 역행 삭제 경로가 동일 가드를 거치는지 코드 레벨에서 보증하지 않으면 공유 User 상태가 의도치 않게 변경된다.
  - 제안: `deleteCredential(credentialId, userId)` 내부에서 DELETE 후 남은 credential count 를 조회해 0 이면 `webauthn_recovery_codes = NULL` 업데이트하는 단일 책임 구현을 명시적으로 spec 에 절차로 기록하고, counter 역행 삭제 경로도 동일 함수를 통하도록 구현 안내를 plan §4 에 추가.

- **[WARNING]** `loginWithTotp()` — WebAuthn 사용자에게 TOTP 경로를 개방한 채 access/refresh 토큰을 발급하는 공유 세션 상태 오염
  - 위치: `review/consistency/2026/05/18/23_11_17/rationale_continuity.md` 발견사항 2 (CRITICAL)
  - 상세: 현재 `auth.service.ts loginWithTotp()` 는 WebAuthn credential 보유 여부를 확인하지 않는다. WebAuthn 사용자가 `POST /api/auth/login/totp` 를 직접 호출하면 TOTP 검증을 통과해 access/refresh 토큰(서버 세션 상태)이 발급된다. spec Rationale 1.4.D 가 명시적으로 기각한 "약한 수단 자동 우회" 패턴이 그대로 공유 인증 상태를 오염시킨다. WebAuthn 구현 추가 이후 기존 TOTP 경로가 의도치 않은 진입점으로 남는 전형적인 부작용이다.
  - 제안: `loginWithTotp()` 에 "WebAuthn credential count > 0 이면 401 WEBAUTHN_REQUIRED" 백스탑을 추가하거나, challengeToken payload 에 `method: 'totp' | 'webauthn'` 을 박아 verify 단계에서 의도한 method 인지 검증한다.

---

#### 2. 전역 변수 / 모듈 레벨 공유 상태

- **[INFO]** `webauthn.config.ts` 의 `registerAs('webauthn', ...)` — `common/config/index.ts` 미등록 시 ConfigModule 전역 상태 누락
  - 위치: `review/consistency/2026/05/18/23_11_17/naming_collision.md` 발견사항 3
  - 상세: `webauthn.config.ts` 를 `registerAs` 로 등록해도 `common/config/index.ts` 에 export 를 추가하지 않으면 `ConfigModule.forRoot` 에 로드되지 않아 앱 전역 Config 레지스트리에 반영되지 않는다. 런타임에 WebAuthn 환경변수 전체가 `undefined` 로 주입되는 전역 설정 상태 누락이 발생한다.
  - 제안: plan §4 구현 시 `common/config/index.ts` 에 `webauthn.config` export 추가를 체크리스트로 명시.

---

#### 3. 파일시스템 부작용

- **[INFO]** `_retry_state.json` 생성 (파일 7) — 세션 디렉토리 내 영구 잔류 파일
  - 위치: `review/consistency/2026/05/18/23_11_17/_retry_state.json`
  - 상세: `_retry_state.json` 은 orchestrator 가 재시도 추적을 위해 생성하는 파일이다. 이 파일이 `review/consistency/` 세션 디렉토리 안에 영구 커밋되면 이후 review/consistency 세션을 `ls` 로 열람하거나 consistency-checker 가 기존 세션을 스캔할 때 불필요한 파일로 잡힌다. 기능 부작용은 아니나, 리뷰 아카이브의 예상치 못한 파일 생성에 해당한다.
  - 제안: `_retry_state.json` 을 `.gitignore` 또는 세션 종료 후 삭제 정책 대상으로 분류하거나, `_prompts/` 처럼 언더스코어 prefix 폴더 안에 두어 명시적으로 내부 임시 파일임을 표현.

---

#### 4. 시그니처 변경

- **[CRITICAL]** `auth.service.ts login()` 반환 타입 변경 — 기존 호출자 다중 영향
  - 위치: `review/consistency/2026/05/18/23_11_17/rationale_continuity.md` 발견사항 1 (CRITICAL) + `review/consistency/2026/05/18/23_11_17/naming_collision.md` 발견사항 1 (CRITICAL)
  - 상세: WebAuthn 구현 시 `login()` 의 반환 타입이 `{ requiresTotp: true; challengeToken: string }` 에서 `{ requires2fa: boolean; methods: string[]; challengeToken: string; requiresTotp?: boolean }` 로 변경된다. `auth.controller.ts loginController()` 가 이 반환값을 직접 클라이언트에 직렬화하므로, `login()` 의 반환 타입 변경이 컨트롤러의 응답 형태에 즉시 영향을 준다. `LoginChallengeDto` 도 동시에 변경되어야 하며, 기존 클라이언트(릴리스 < 2026-05-18) 는 `requiresTotp` 만 읽는 deprecated 경로를 타다가 필드가 없어지면 undefined 를 받게 된다. spec 이 `requiresTotp` 를 deprecated 로 유지한다고 명시하지만 구현 시점에 세 곳(service 반환 타입 / DTO / 컨트롤러 응답 객체)이 동시에 변경되지 않으면 타입 불일치 런타임 오류가 발생한다.
  - 제안: `LoginChallengeDto` 확장, `auth.service.ts login()` 반환 타입 갱신, `auth.controller.ts` 응답 객체 수정을 동일 커밋 단위로 묶는다. 기존 클라이언트 호환을 위해 `requiresTotp` 는 deprecated 마킹과 함께 유지.

- **[CRITICAL]** `LoginHistoryEvent` 타입 유니온 변경 — `LoginHistoryService.record()` 콜사이트 전체 영향
  - 위치: `review/consistency/2026/05/18/23_11_17/naming_collision.md` 발견사항 2 (CRITICAL)
  - 상세: `login-history.entity.ts` 의 `LoginHistoryEvent` 에 `'webauthn_failed'` 를 추가하면 이 타입을 매개변수로 받는 `LoginHistoryService.record(event: LoginHistoryEvent, ...)` 의 시그니처는 형식상 유지되지만, TypeScript strict 환경에서 기존 콜사이트가 명시적 유니온 타입을 사용한다면 exhaustive check (switch-case) 가 실패할 수 있다. V058 마이그레이션과 entity 변경이 동일 PR 에 없으면 DB CHECK 제약이 넓어졌는데 TypeScript 타입은 여전히 좁아 타입 단언(as any)이 필요해진다.
  - 제안: V058 마이그레이션과 `LoginHistoryEvent` 타입 확장을 동일 PR/커밋에 포함. 기존 switch-case 를 exhaustive 체크로 작성했다면 `webauthn_failed` 분기 추가.

---

#### 5. 인터페이스 변경 (공개 API)

- **[CRITICAL]** `/api/auth/login` 응답 계약 변경 — 기존 클라이언트에 미치는 영향
  - 위치: `spec/5-system/1-auth.md §1.4.2`, `spec/2-navigation/10-auth-flow.md §3.2` (파일 15, 18)
  - 상세: 기존 응답 `{ requiresTotp: boolean, challengeToken: string }` 에서 신규 응답 `{ requires2fa: boolean, methods: string[], challengeToken: string, requiresTotp?: boolean }` 으로 변경된다. `requiresTotp` 가 optional 로 바뀌므로 기존 클라이언트가 `if (response.requiresTotp)` 처럼 boolean 체크를 한다면 `undefined` 는 falsy 라 2FA 단계를 건너뛰는 결과가 발생할 수 있다. spec 은 backward-compat 로 `requiresTotp` 를 계속 내려준다고 명시하지만, optional 로 선언하면 타입 정의만 보고 클라이언트가 대응하지 않을 위험이 있다.
  - 제안: 응답에서 `requiresTotp` 는 deprecated 표시와 함께 제거 전까지 **항상(not optional)** 포함하여 내려준다. spec §1.4.2 의 "제거 조건 충족 시" 비로소 필드를 드롭.

- **[WARNING]** `POST /api/auth/verify-2fa` 폐기 선언 — 기존 클라이언트 무효화
  - 위치: `spec/2-navigation/10-auth-flow.md §3.4.1` 및 API 표 (파일 15)
  - 상세: spec 변경으로 `POST /api/auth/verify-2fa { tempToken, code }` 가 `POST /api/auth/login/totp { challengeToken, code }` 로 교체된다. 기존 endpoint 를 그대로 제거하면 아직 구 클라이언트(릴리스 < 이번 PR)를 사용하는 사용자의 TOTP 검증이 모두 404 로 실패한다. spec 문서에는 "폐기" 표기만 추가되었고, 실제 alias route 또는 deprecation grace period 에 대한 정의가 없다.
  - 제안: 구 `/api/auth/verify-2fa` 를 일정 기간 alias route 로 유지하거나, plan §8 follow-up 에 클라이언트 마이그레이션 완료 후 제거하도록 명기.

- **[WARNING]** `spec/1-data-model.md §2.21 AssistantMessage → §2.22` 섹션 번호 시프트 — 다른 spec 참조 링크 무효화
  - 위치: `spec/1-data-model.md` (파일 14), `spec/3-workflow-editor/4-ai-assistant.md` (파일 17)
  - 상세: 파일 17에서 `Spec 데이터 모델 §2.20~2.21` 참조를 `§2.20·§2.22` 로 수정한 것이 확인되었다. 그러나 코드베이스 내 다른 spec 파일, plan, README 등에 `§2.21 AssistantMessage` 를 문자열로 직접 참조하는 링크가 있을 경우 일제히 dead link 가 된다. `spec/3-workflow-editor/4-ai-assistant.md` 외 타 문서의 수정 여부가 이 diff 에서 확인되지 않는다.
  - 제안: `grep -r "2\.21" spec/` 으로 다른 문서의 §2.21 참조를 전수 검색하고 §2.22 로 갱신.

---

#### 6. 환경 변수

- **[WARNING]** `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN` 신규 환경변수 — `.env.example` 미등록 + CORS_ORIGINS 와 의미 혼재
  - 위치: `spec/5-system/1-auth.md §1.4.3` (파일 18), `review/consistency/2026/05/18/23_11_17/naming_collision.md` 발견사항 3
  - 상세: 세 개의 신규 환경변수가 도입된다. 모두 없으면 `FRONTEND_URL` hostname 으로 best-effort 폴백하는 로직이 spec 에 명시되어 있으나, 폴백 로직 자체가 잘못된 RP_ID 를 조용히 적용하여 WebAuthn 인증 실패를 유발할 수 있다(origin 불일치). 또한 `WEBAUTHN_ORIGIN` 은 CORS_ORIGINS 와 값이 동일할 수 있는데 별도 변수로 관리하는 이유가 `.env.example` 주석에 없으면 운영자가 한쪽만 설정하는 실수가 발생한다.
  - 제안: `codebase/backend/.env.example` 에 `WEBAUTHN_*` 블록을 추가하고, `WEBAUTHN_ORIGIN` 과 `CORS_ORIGINS` 의 용도 차이를 inline 주석으로 설명. 폴백 동작을 WARN 로그가 아닌 startup validation(ConfigService 또는 NestJS OnModuleInit guard) 으로 차단하는 방안 검토.

---

#### 7. 네트워크 호출

- **[INFO]** `@simplewebauthn/server` 의 외부 attestation 검증 — 예상치 못한 외부 호출 가능성
  - 위치: `spec/5-system/1-auth.md §1.4.4` 및 Rationale 1.4.A
  - 상세: `@simplewebauthn/server` 의 `verifyRegistrationResponse` 는 attestation format 에 따라 외부 FIDO MDS(Metadata Service) 또는 인증기 제조사 인증서 endpoint 를 조회할 수 있다. 기본 설정에서 attestation 검증을 `none` 으로 제한하지 않으면 등록 시 예상치 못한 외부 네트워크 호출이 발생하고, 인터넷이 차단된 셀프 호스팅 환경에서는 타임아웃으로 등록이 실패한다. spec 에 attestation 정책이 명시되지 않았다.
  - 제안: plan §4 또는 spec §1.4.4 에 `verifyRegistrationResponse` 호출 시 `expectedType: ['none']` 또는 `attestationType: 'none'` 으로 attestation 검증을 제한하는 정책을 명시. 셀프 호스팅 환경 문서(`NF-SC-08`)에도 이 제약 기재.

---

#### 8. 이벤트 / 콜백

- **[INFO]** `LoginHistoryService.record('webauthn_failed', ...)` 발생 경로 추가 — 기존 LoginHistory 구독자 영향
  - 위치: `spec/5-system/1-auth.md §4.3` (파일 18), `spec/1-data-model.md §2.18.2` (파일 14)
  - 상세: `webauthn_failed` 이벤트가 LoginHistory 에 추가된다. 만약 백엔드에 LoginHistory 이벤트를 구독하거나 polling 하는 컴포넌트(예: 알림 생성, 이상 탐지, rate-limit 집계)가 있다면, 새 이벤트 타입을 처리하지 못하는 else 분기나 exhaustive switch-case 가 실패하거나 오작동할 수 있다. 현재 코드베이스에서 LoginHistory 이벤트를 구독하는 컴포넌트 존재 여부가 이 diff 에서 확인되지 않는다.
  - 제안: `grep -r "totp_failed\|login_failed\|LoginHistoryEvent" codebase/backend/src/` 로 기존 event 소비 코드를 탐색하고, `webauthn_failed` 분기를 추가하거나 default 핸들러가 올바르게 동작하는지 확인.

---

### 요약

이번 변경에서 부작용 관점의 핵심 위험은 세 가지다. 첫째, `/api/auth/login` 응답 형태 변경과 `auth.service.ts login()` 반환 타입 변경이 컨트롤러·DTO·기존 클라이언트 세 계층에 동시에 부작용을 미치며, 특히 `requiresTotp` 가 optional 로 선언될 경우 구 클라이언트에서 2FA 단계를 건너뛰는 보안 결손이 발생할 수 있다(CRITICAL). 둘째, 기존 `loginWithTotp()` 가 WebAuthn 사용자에게도 TOTP 경로를 열어두어 공유 세션 상태(access/refresh 토큰 발급)가 spec Rationale 1.4.D 가 금지한 방식으로 변경된다(CRITICAL). 셋째, `WebAuthnService.deleteCredential` 내 `webauthn_recovery_codes` NULL 화 로직이 counter 역행 자동 삭제 경로와 사용자 명시 삭제 경로 양쪽에서 단일 책임으로 처리되지 않으면 다른 credential 이 남아있음에도 복구 코드가 사라지는 공유 상태 오염이 발생한다(WARNING). 환경변수 도입과 관련해서 `WEBAUTHN_ORIGIN` 의 `.env.example` 미등록 및 폴백 정책의 조용한 실패 가능성도 운영 환경에서 WebAuthn 인증 전면 장애로 이어질 수 있어 보완이 필요하다.

---

### 위험도

HIGH
