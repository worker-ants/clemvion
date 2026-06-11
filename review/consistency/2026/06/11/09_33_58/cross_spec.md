# Cross-Spec 일관성 검토 결과

- target: `spec/data-flow/2-auth.md`
- 검토 모드: `--impl-done`, scope=`spec/data-flow/`, diff-base=`origin/main`
- 검토 일시: 2026-06-11

---

## 발견사항

### [WARNING] `rememberMe` 효과(30일 만료) 가 data-flow 에서 누락

- **target 위치**: `spec/data-flow/2-auth.md` §1.2 (로그인 다이어그램), §2.1 Schema 매핑표 `refresh_token` 행
- **충돌 대상**: `spec/1-data-model.md §2.18.1 RefreshToken` — `expires_at: 만료 시각 (7일 기본, rememberMe 시 30일)` / `spec/5-system/1-auth.md §2.3` — `Refresh Token: HttpOnly Cookie, 7일`
- **상세**: data-flow §1.2 로그인 다이어그램은 `rememberMe` 를 요청 파라미터로 받지만 INSERT 에서 `expires_at` 분기(7일/30일)를 표현하지 않는다. §2.1 Schema 매핑표의 `refresh_token` 행도 `expires_at` 값만 기재하고 `rememberMe` 분기 로직을 언급하지 않아, 구현자가 `rememberMe=true` 시 30일 만료 적용 여부를 data-flow 만으로는 알 수 없다. `spec/1-data-model.md §2.18.1` 과 `spec/5-system/1-auth.md §2.3` 이 이미 정의한 정책과 암묵적 충돌이다.
- **제안**: data-flow §1.2 INSERT 스텝에 `expires_at = rememberMe ? now+30d : now+7d` 조건을 추가하고, §2.1 Schema 매핑표 `expires_at` 컬럼 설명에 분기 주석을 덧붙인다.

---

### [WARNING] WebAuthn counter 역행 시 refresh token 전체 revoke 가 data-flow 에서 누락

- **target 위치**: `spec/data-flow/2-auth.md` §1.2 (WebAuthn 인증 분기), §2.1 Schema 매핑표
- **충돌 대상**: `spec/5-system/1-auth.md §1.4.4` — "counter 역행이 감지되면… 해당 사용자의 활성 refresh token 전체를 즉시 revoke 한다"
- **상세**: data-flow §1.2 의 `webauthn_failed` 분기는 credential row 삭제와 LoginHistory 기록만 언급한다. `spec/5-system/1-auth.md §1.4.4` 가 명시한 "counter 역행 시 refresh token 전체 revoke" 동작이 data-flow 다이어그램과 Schema 매핑표 어디에도 표현되어 있지 않다. 흐름 다이어그램만 보면 세션 강제 종료가 일어나지 않는 것처럼 보인다.
- **제안**: §1.2 WebAuthn counter 역행 분기에 `Svc->>PG: UPDATE refresh_token SET is_revoked=true WHERE user_id=? (counter_regression 경로)` 스텝과 LoginHistory `webauthn_failed(WEBAUTHN_COUNTER_REGRESSION)` 기록을 추가한다. §2.1 Schema 매핑표에 `refresh_token: counter 역행 revoke` 행도 추가한다.

---

### [WARNING] 로그아웃 시 family 전체 revoke 범위가 시스템 spec 과 미묘하게 다름

- **target 위치**: `spec/data-flow/2-auth.md` §1.6 로그아웃
- **충돌 대상**: `spec/5-system/1-auth.md §2.4 토큰 갱신 플로우 step 4` — "이전 Refresh Token 즉시 무효화" (단일 토큰 표현) + `spec/5-system/1-auth.md` 로그아웃 정의 — "호출 디바이스 family 전체 revoke"
- **상세**: data-flow §1.6 은 로그아웃을 "family 전체 revoke" 로 올바르게 기술하고 있다. 그러나 `spec/5-system/1-auth.md §2.4` step 4 는 단일 토큰 무효화처럼 서술("이전 Refresh Token 즉시 무효화")되어 있어 같은 auth spec 내부에서 불일치가 있다. data-flow 와의 직접 충돌은 아니지만 참조 독자가 혼동할 수 있다.
- **제안**: 이 이슈는 data-flow 가 아닌 `spec/5-system/1-auth.md §2.4` 의 수정이 필요하다. §2.4 step 4 를 "이전 Refresh Token 즉시 무효화 (refresh 회전) / 로그아웃 시 동일 family 전체 revoke" 로 구분하거나, 두 경로를 명확히 나누는 노트를 추가한다.

---

### [INFO] 세션 동시 한도(5개) 및 비활동 만료(30일) 정책이 data-flow 에서 미언급

- **target 위치**: `spec/data-flow/2-auth.md` §3.1 상태 전이, §2.1 Schema 매핑표
- **충돌 대상**: `spec/5-system/1-auth.md §2.3` — "동시 세션: 기본 5개(관리자 설정 가능), 초과 시 가장 오래된 세션 자동 종료" / "비활동 만료: 30일간 미사용 시 Refresh Token 무효화"
- **상세**: data-flow 는 흐름 관점 문서이므로 정책 세부를 모두 반복할 의무는 없다. 그러나 동시 세션 한도 초과 시 자동 종료는 로그인 INSERT 시점에 side-effect 로 발생하는 data mutation 이므로(가장 오래된 family revoke) data-flow §1.2 INSERT 스텝에서 누락되면 구현 시 빠뜨릴 수 있다. 비활동 만료(30일 미사용)의 경우 현재 구현에서 `last_used_at` 기반 스캔 배치가 존재하는지 여부가 spec 어디에도 명확하지 않다.
- **제안**: data-flow §1.2 로그인 다이어그램에 "동시 세션 초과 시 가장 오래된 family revoke" 스텝(또는 Note)을 추가하고, 비활동 만료 배치 존재 여부를 `spec/5-system/1-auth.md §2.3` 에 구현 상태(implemented/planned)로 명시한다.

---

### [INFO] `email_verify_token` DB 저장 방식 표기 비일관 (raw vs SHA-256)

- **target 위치**: `spec/data-flow/2-auth.md` §1.1 다이어그램 (line 44: `email_verify_token` 필드 직접 표기), §2.1 Schema 매핑표 `email_verify_token` 항목
- **충돌 대상**: `spec/1-data-model.md §2.1 User` — `email_verify_token: 이메일 인증 토큰 SHA-256 해시 (24h 유효)` / `spec/5-system/1-auth.md §1.1` — "이메일 인증 토큰(`emailVerifyToken`)은 SHA-256 해시로만 저장한다"
- **상세**: data-flow §1.1 다이어그램 step 4 는 `INSERT INTO "user" (email_verify_token, ...)` 로 표기하고, step 5 에서 `이메일 인증 메일 발송 (email_verify_token)` 으로 raw token 을 메일에 실어 보내는 흐름을 암시한다. 하지만 data-flow 본문 어디에도 "DB 에는 SHA-256 해시, 메일에는 raw token" 분리가 명시되지 않아 표기 상 `email_verify_token` 이 raw 인지 hash 인지 불분명하다. `spec/1-data-model.md §2.1` 과 정보 불일치를 야기한다. 보안 속성(DB 에 raw 미저장)이 흐름 독자에게 전달되지 않는다.
- **제안**: §1.1 다이어그램 INSERT 스텝에 `email_verify_token = sha256(rawToken)` 주석을 추가하거나, step 5 에 "MailService 에 rawToken 전달, DB 에는 sha256 저장" 분리를 명시한다.

---

### [INFO] OAuth 로그인 성공 시 `login_history.event=login_success` 기록 누락

- **target 위치**: `spec/data-flow/2-auth.md` §1.3 OAuth 다이어그램, §2.1 Schema 매핑표
- **충돌 대상**: `spec/data-flow/1-audit.md §1.2` — `AuthService` 가 `login_success` 를 기록하는 caller 중 하나로 명시 / `spec/5-system/1-auth.md §1.2` (OAuth 흐름)
- **상세**: data-flow §1.3 OAuth 다이어그램은 `INSERT refresh_token` 까지는 표현하지만 `login_history.event=login_success` 기록을 포함하지 않는다. `spec/data-flow/1-audit.md §1.2` 는 `auth.service.ts` 의 `login_success` 기록을 SoT 로 명시하며, 로컬 로그인 §1.2 는 이를 명시적으로 포함하고 있다. OAuth 경로에서의 누락은 커버리지 갭 혹은 문서 불완전성이다.
- **제안**: OAuth 다이어그램 말미에 `Svc->>Hist: event=login_success` 스텝을 추가하거나, OAuth 경로에서 `login_success` 를 기록하지 않는다면 그 이유를 Rationale 에 명시한다.

---

## 요약

`spec/data-flow/2-auth.md` 는 로컬 로그인·OAuth·refresh 회전·세션 revoke·로그아웃의 핵심 흐름을 `spec/5-system/1-auth.md` 및 `spec/1-data-model.md` 와 전반적으로 정합하게 기술한다. 회전 원자성(트랜잭션 + 조건부 UPDATE)·family-based 세션 모델·reuse 탐지 의미론 등 핵심 불변식은 모두 일관되게 서술되어 있다. 다만 `rememberMe` 시 30일 만료 분기, WebAuthn counter 역행 시 refresh token 전체 revoke, 동시 세션 한도 초과 자동 종료 등 세션 정책의 일부 data mutation 이 흐름 다이어그램에서 누락되어 구현 시 빠뜨릴 수 있는 WARNING 2건이 확인됐다. `email_verify_token` SHA-256 분리 표기·OAuth `login_success` 기록은 정보 누락 수준의 INFO 이다. CRITICAL 충돌은 없다.

## 위험도

LOW
