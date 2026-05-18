# Rationale 연속성 검토 결과

대상: `plan/in-progress/2fa-webauthn.md`
검토 모드: spec draft 검토 (--spec)

---

### 발견사항

- **[WARNING]** 로그인 응답 필드명 변경 — 기존 `requiresTotp` / `challengeToken` 계약의 무근거 번복
  - target 위치: §3 백엔드 구현 → "기존 `/auth/login` 응답을 확장: `{ requiresTotp }` 대신 `{ requires2fa: true, methods: ['webauthn'|'totp'], challengeToken }` 로 진화"
  - 과거 결정 출처: `spec/data-flow/2-auth.md §1.2` 시퀀스 (`{ requiresTotp: true, totpToken }`), `codebase/backend/src/modules/auth/auth.service.ts:315` (`{ requiresTotp: true, challengeToken }`), `auth-response.dto.ts:13`
  - 상세: 기존 구현과 data-flow spec 모두 `requiresTotp: boolean` + `challengeToken` (또는 `totpToken` — 두 명칭이 spec/코드 간에 이미 혼재) 로 TOTP 2단계 응답을 정의한다. plan 은 이 필드명을 `requires2fa` + `methods` 배열로 바꾸겠다고 선언하면서 "호환을 위해 `requiresTotp` 도 한동안 같이 내려준다" 는 단 한 줄 외에 (a) 언제 구필드를 제거하는지, (b) `totpToken` vs `challengeToken` 의 기존 혼재를 어떻게 정리하는지, (c) 이 변경이 기존 클라이언트 소비 코드·Swagger·e2e 에 미치는 영향 범위를 새로운 Rationale 로 명시하지 않고 있다. `spec/5-system/1-auth.md §5` API 표도 아직 이 변경을 반영하지 않았고, data-flow spec 의 시퀀스 다이어그램도 그대로다. 결정 번복의 범위는 크지만 spec Rationale 갱신이 동반되지 않는다.
  - 제안: `spec/5-system/1-auth.md §1.4·§5` 와 `spec/data-flow/2-auth.md §1.2` 에 변경 배경(WebAuthn 다중 방식 지원을 위해 `methods` 배열 도입)을 Rationale 항으로 추가하고, deprecated `requiresTotp` 의 제거 타임라인(예: "WebAuthn 구현 PR 이후 한 cycle" 또는 명시된 마이그레이션 plan)을 기록한다.

- **[WARNING]** `totpToken` → `challengeToken` 명칭 혼재 — data-flow spec 과 구현 사이 불일치
  - target 위치: §3 백엔드 구현 전반 (`challengeToken`)
  - 과거 결정 출처: `spec/data-flow/2-auth.md §1.2` 시퀀스 다이어그램 (`totpToken`)
  - 상세: data-flow spec §1.2 는 `{ requiresTotp: true, totpToken }` / `POST /api/auth/login/totp { totpToken, code }` 로 명시되어 있으나, 실제 구현(`auth.service.ts`, `auth-response.dto.ts`, `auth.controller.ts`)은 이미 `challengeToken` 으로 동작한다. 이 불일치가 spec 에 아직 반영되지 않은 상태에서 WebAuthn plan 이 동일 필드명 `challengeToken` 을 그대로 WebAuthn challenge에도 재활용하는 방향을 채택했다. 기존 data-flow spec 이 정정되지 않은 채 새 기능이 쌓이면 spec이 코드의 실제 계약을 반영하지 못하는 누적 정합 결손이 생긴다.
  - 제안: §5 spec 갱신 작업(plan §5) 중에 `spec/data-flow/2-auth.md §1.2` 의 `totpToken` 을 `challengeToken` 으로 정정하고, 해당 변경이 언제 이루어졌는지 Rationale에 기록한다.

- **[WARNING]** WebAuthn challenge 임시 저장 — "별도 테이블 대신 JWT" 결정에 새 Rationale 부재
  - target 위치: §2 데이터 모델 → "WebAuthn 등록·인증 challenge 임시 저장: 별도 테이블 대신 server-issued 단명 (5분) JWT ... **JWT 채택**, payload 에 `{ kind: 'webauthn_register'|'webauthn_auth', sub, challenge, exp }` 를 담아 stateless 처리. (TOTP challenge token 과 동일 패턴)"
  - 과거 결정 출처: `spec/data-flow/0-overview.md §5` — "Stateless backend: 모든 controller·service 는 stateless. 인스턴스 간 작업 조정은 Redis (BullMQ + Pub/Sub) 가 담당."
  - 상세: JWT stateless 처리는 시스템 stateless 원칙과 일치하는 방향이고, TOTP challenge 선례(`auth.service.ts:311`)도 동일 패턴을 쓰고 있으므로 채택 자체는 합리적이다. 그러나 plan 문서가 "JWT 채택, TOTP 와 동일 패턴" 이라고만 쓰고, (a) 왜 별도 테이블(`webauthn_challenge`)이 기각되었는지, (b) JWT replay 방지(challenge의 1회성 보장) 를 어떻게 처리할 것인지 (서버측 검증 후 revoke 없이 stateless 방식만 쓰면 5분 내 재사용이 가능), (c) WebAuthn spec 의 challenge 요건(각 인증 시도마다 fresh & unique challenge)과의 정합을 어떻게 담보하는지 — 이 세 가지 설계 결정이 새 Rationale 없이 미기록 상태다. spec 5단계 갱신 항목에도 이 결정 배경을 담을 Rationale 절이 명시되어 있지 않다.
  - 제안: `spec/5-system/1-auth.md §1.4` 에 추가될 Rationale(1.4.A: 라이브러리 선택, 1.4.B: 우선순위 결정 — plan §5에 예고)에 1.4.C 로 "WebAuthn challenge 저장 방식 — stateless JWT" 항을 추가하고 기각된 DB 테이블 안과의 비교(replay 방지 트레이드오프 포함)를 기술한다.

- **[WARNING]** WebAuthn 실패 시 TOTP fallback 자동화 기각 — 결정은 올바르나 Rationale 부재
  - target 위치: §1 디자인 결정 → "WebAuthn 에 실패한 경우 '복구 코드 사용' 링크로 ... TOTP 화면으로는 자동 fallback 하지 않는다"
  - 과거 결정 출처: 해당 결정을 뒤집은 선행 Rationale 없음 (신규 결정). 단, `spec/2-navigation/9-user-profile.md` / `spec/data-flow/2-auth.md` 에는 TOTP 2FA 흐름이 단일 경로로만 기술되어 있고, 다중 2FA 방식 간 우선순위 정책이 어떤 spec 에도 아직 존재하지 않는다.
  - 상세: "TOTP fallback 자동 금지" 는 사용자 경험·보안(WebAuthn을 우회해 TOTP로 넘어가는 degradation 공격 방지) 측면에서 합리적 결정이지만, 이 원칙이 어느 spec Rationale에도 기록되어 있지 않다. plan §5의 spec 갱신 목록에 `spec/5-system/1-auth.md §1.4` Rationale 추가가 예고되어 있으나, 현재 plan 문서 내에서도 이 결정의 보안 근거가 서술되지 않아 향후 구현자가 "왜 TOTP fallback이 없는가"를 spec에서 확인할 수 없다.
  - 제안: plan §1 "사용자 흐름" 절에 결정 근거(예: WebAuthn 우선 적용 시 TOTP fallback을 허용하면 WebAuthn 비활성화 없이도 TOTP 채널로 우회 가능 — 사용자가 명시적으로 WebAuthn을 삭제해야만 TOTP로 복귀하는 설계가 더 안전)를 기술하고, spec §1.4 Rationale에 동일 내용을 반영한다.

- **[INFO]** `webauthn_recovery_codes` 와 `totp_recovery_codes` 의 별도 관리 — 유사 패턴의 분리 설계 근거 명시 권장
  - target 위치: §1 디자인 결정 → "복구 코드 — WebAuthn 전용 별도 발급", §2 데이터 모델 → "`user` 테이블에 `webauthn_recovery_codes TEXT[] NULL` 컬럼 추가"
  - 과거 결정 출처: `plan/complete/feature-roadmap/06-2fa.md` — "totp_recovery_codes TEXT[] NULL (해시 저장)". 기존 TOTP 복구 코드는 해시 저장으로 명시되어 있다.
  - 상세: plan은 WebAuthn 복구 코드를 TOTP 복구 코드와 별도 컬럼(`webauthn_recovery_codes`)으로 분리하는 결정을 내리면서, (a) 왜 하나의 공유 복구 코드 풀로 통합하지 않았는지, (b) `webauthn_recovery_codes` 도 해시 저장인지 아니면 다른 저장 방식을 택하는지가 명시되지 않았다. 기존 `totp_recovery_codes` 는 "해시 저장" 으로 명확히 기재되어 있는 반면 새 컬럼은 저장 형태 서술이 없다. TOTP 복구 코드의 선례와 다른 설계를 채택한다면 Rationale이 필요하다.
  - 제안: §2 데이터 모델에 `webauthn_recovery_codes` 의 저장 형태(해시 여부)를 명시하고, 별도 분리 이유(TOTP 비활성화 후 WebAuthn만 남은 경우 등의 독립 관리 필요성)를 plan §1 또는 spec Rationale에 추가한다.

- **[INFO]** `login_history.event` CHECK 제약 갱신을 V058로 처리 — 기존 V040 제약과의 관계 명시 권장
  - target 위치: §3 백엔드 구현 → "AuditLog/LoginHistory 의 `event` enum 에 `webauthn_failed` 추가 — `idx_login_history_event` 가드는 `check_login_history_event` CHECK 제약을 V058 로 갱신"
  - 과거 결정 출처: `codebase/backend/migrations/V040__auth_session_metadata_and_login_history.sql:39` — `chk_login_history_event` CHECK 제약에 `login_success`, `login_failed`, `totp_failed`, `logout`, `session_revoked`, `token_reuse_detected` 6개 값이 열거형으로 고정
  - 상세: 기존 제약은 `chk_login_history_event` 라는 이름이며, plan은 이를 V058 마이그레이션으로 `CHECK` 제약을 갱신한다고 기술한다. PostgreSQL에서 CHECK 제약을 갱신하려면 기존 제약을 DROP 후 재추가해야 하며, `idx_login_history_event` 언급도 있지만 V040에는 해당 이름의 인덱스가 존재하지 않는다(인덱스는 `idx_login_history_user_created`, `idx_login_history_email_created`, `idx_login_history_created` 세 개). 용어 혼용이 마이그레이션 작성 시 혼란을 줄 수 있다. 또한 spec `§4.3 LoginHistory` 이벤트 표에 `webauthn_failed` 가 추가 대상임이 plan §5 갱신 목록에 명시되어 있으나 이 필드 설명도 있어야 한다.
  - 제안: plan §3에서 "idx_login_history_event 가드" 표현을 "chk_login_history_event CHECK 제약" 으로 정정하고, V058이 DROP CONSTRAINT + ADD CONSTRAINT 패턴임을 명시한다. spec §4.3 표의 `webauthn_failed` 이벤트 추가도 plan §5 갱신 목록에 포함되어 있으므로 충분하다.

---

### 요약

target 문서(`plan/in-progress/2fa-webauthn.md`)는 기존 spec Rationale에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant를 직접 위반하는 CRITICAL 수준의 문제는 없다. 그러나 세 가지 WARNING이 발견된다. 첫째, 기존 `requiresTotp` + `challengeToken` 로그인 응답 계약을 `requires2fa` + `methods` 구조로 변경하면서 data-flow spec과 API spec 양쪽의 Rationale 갱신이 동반되지 않았다. 둘째, data-flow spec에 남은 `totpToken` 명칭과 구현의 `challengeToken` 간 기존 불일치가 새 기능 추가와 함께 해소되지 않고 누적된다. 셋째, WebAuthn challenge를 stateless JWT로 처리하는 결정과 TOTP fallback 자동화를 금지하는 결정이 각각 합리적이고 시스템 원칙과 부합하지만, 이 결정들이 spec Rationale로 기록되지 않아 미래 구현자가 "왜 이렇게 설계되었는가"를 spec에서 확인할 수 없다. plan §5의 spec 갱신 단계에서 이 세 가지 Rationale를 함께 작성하면 모두 해소 가능하다.

---

### 위험도

MEDIUM
