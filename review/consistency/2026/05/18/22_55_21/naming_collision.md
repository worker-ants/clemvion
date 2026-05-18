# Naming Collision Check — 2fa-webauthn.md

## 발견사항

### 발견사항 없음 (충돌 없음)

아래는 target 이 도입하는 신규 식별자를 전수 검토한 결과다.

---

### [INFO] `challengeToken` 필드명 — 기존 `tempToken` 표기 흔적 공존 가능성
- **target 신규 식별자**: `challengeToken` (로그인 응답 및 WebAuthn 인증 요청 필드)
- **기존 사용처**: `spec/2-navigation/10-auth-flow.md` §3.2 — 동일 문서 내에 "tempToken → challengeToken 정정" 이력 언급. plan §2 작업 목록에도 `spec/2-navigation/10-auth-flow.md §3.2 / §3.4 / §8 — tempToken → challengeToken 정정`을 완료(✅)로 표기함
- **상세**: `challengeToken` 은 target 이 login 응답 + WebAuthn 흐름 전반에서 일관되게 사용한다. plan §2 의 spec 갱신 체크박스가 [x] 이므로 정정이 완료된 것으로 보인다. 다만 코드베이스(`auth.service.ts`, 프론트엔드 로그인 폼 등)에 남아있는 구 `tempToken` 변수명은 구현 단계(§4, §5)에서 별도로 추적·정정해야 한다. target 은 이 부분을 명시적으로 언급하지 않아 코드 레벨 식별자 교체가 누락될 여지가 있다.
- **제안**: plan §4 `auth.service.ts` 항목에 "기존 `tempToken` 변수명을 `challengeToken` 으로 교체" 를 명시적 하위 항목으로 추가할 것을 권장한다.

---

### [INFO] `requiresTotp` deprecated 필드 — 기존 `requiresTotp` 코드와 동일 이름 공존
- **target 신규 식별자**: `requiresTotp` (backward compat deprecated 필드, 로그인 응답)
- **기존 사용처**: 현 프론트엔드 `login-form.tsx` / `LoginResponseData` 타입 — 이미 `requiresTotp: boolean` 이 사용 중
- **상세**: target 은 `requiresTotp` 를 "두 마이너 버전 후 제거" 예정인 deprecated 필드로 선언하면서도 동시에 기존 코드가 이 필드를 primary 분기 신호로 사용 중이다. 같은 이름이 "기존 primary 신호"와 "신규 deprecated 호환 필드" 두 의미로 동시에 공존하는 형태라 혼동 위험이 있다. `spec/2-navigation/10-auth-flow.md` §3.2 에 이미 "두 필드 충돌 시 `requires2fa` 가 우선" 이 명시되어 있으므로 의미 분기는 정의되어 있다.
- **제안**: plan §4 `auth.service.ts` 구현 시 `requiresTotp` 를 응답에 포함할 때 `methods` 와 `requires2fa` 가 동시에 존재하면 클라이언트가 `requiresTotp` 를 무시하는 분기를 단위 테스트로 명시적으로 잠글 것을 권장한다. follow-up §8 에 이미 "W-1 follow-up" 으로 제거 시점이 명시되어 있어 관리 가능한 수준이다.

---

### [INFO] `spec/1-data-model.md §2.21` 번호 시프트 — AssistantMessage 가 §2.22 로 이동
- **target 신규 식별자**: `§2.21 WebAuthnCredential` (데이터 모델 섹션 번호)
- **기존 사용처**: 현재 `spec/1-data-model.md` 에서 `§2.21 WebAuthnCredential` 은 이미 존재하고 `§2.22 AssistantMessage` 로 번호가 이미 시프트된 상태로 코퍼스에 반영되어 있다 (plan §2 의 해당 항목이 [x] 완료)
- **상세**: 코퍼스(`spec/1-data-model.md`) 를 확인하면 `§2.21 WebAuthnCredential` 과 `§2.22 AssistantMessage` 가 이미 적용되어 있다. 따라서 번호 충돌은 없고 target 의 spec 갱신이 이미 반영된 것으로 확인된다. 데이터 모델 내 `AssistantMessage` 를 참조하던 다른 spec 문서(`spec/3-workflow-editor/4-ai-assistant.md` 등)의 섹션 번호 앵커가 `§2.21` → `§2.22` 로 업데이트되었는지 구현 착수 전에 확인이 필요하다.
- **제안**: 구현 착수 전(`consistency-check --impl-prep`) 시점에 `grep -r "2\.21.*AssistantMessage\|AssistantMessage.*2\.21" spec/` 으로 구 번호 앵커 잔존 여부를 확인할 것을 권장한다.

---

## 전수 검토 결과 요약

| 식별자 범주 | 검토 결과 |
|---|---|
| 요구사항 ID | 신규 ID 없음 (기존 `NF-SC-10` 갱신만) |
| 엔티티/타입명 (`WebAuthnCredential`, `WebAuthnService`, `webauthn.dto.ts`, `webauthn.config.ts`) | 코드베이스 내 사전 점유 없음. 충돌 없음 |
| DB 컬럼명 (`webauthn_recovery_codes`, `credential_id`, `aaguid`, `device_name`, `last_used_at`) | User 테이블의 기존 컬럼과 중복 없음. `last_used_at` 은 여러 엔티티에 관용적으로 쓰이는 컬럼명이나 테이블이 다르므로 충돌 아님 |
| 마이그레이션 파일명 (`V057__*`, `V058__*`) | plan 에서 착수 직전 max(V) 재확인을 의무화하고 있음. 현재 시점 코퍼스에서 V057/V058 점유 확인 불가이나 절차적 보호 존재 |
| API 엔드포인트 | `/api/auth/2fa/webauthn/...` 경로군은 기존 spec 에 없는 신규 경로. `/api/auth/login/totp` 는 기존 `verify-2fa` 를 canonical 로 정리한 것이며 이 rename 도 spec §5 에 이미 반영됨. 충돌 없음 |
| 이벤트/메시지명 (`webauthn_failed` LoginHistory enum) | 기존 enum 값(`login_success`, `login_failed`, `totp_failed`, `logout`, `session_revoked`, `token_reuse_detected`)과 중복 없음. V058 에서 CHECK 제약을 DROP+ADD 로 갱신하는 절차 명시됨 |
| 환경변수 (`WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`) | 기존 코퍼스에 동일 키 없음. `FRONTEND_URL` 폴백 정책도 기존 사용처와 충돌 없음 |
| i18n 키 (`profile.security.webauthn.*`, `auth.twoFactor.webauthn.*`, `auth.login.webauthn.*`) | 기존 TOTP 관련 키(`profile.security.totp.*`, `auth.twoFactor.totp.*`)와 네임스페이스 분리됨. 충돌 없음 |
| JWT kind 값 (`webauthn_register`, `webauthn_auth`) | 기존 challenge/token kind 없음 (TOTP 는 별도 challengeToken 체계). 충돌 없음 |
| 파일 경로 | `webauthn.service.ts`, `webauthn.dto.ts`, `webauthn.config.ts`, `webauthn-credential.entity.ts` 모두 신규. `webauthn-2fa.e2e-spec.ts` 도 신규. 기존 파일과 충돌 없음 |

## 요약

target 문서(`plan/in-progress/2fa-webauthn.md`)가 도입하는 신규 식별자 중 기존 사용처와 의미 충돌을 일으키는 CRITICAL 또는 WARNING 수준의 항목은 발견되지 않았다. 세 건의 INFO 항목이 존재하지만 모두 동일 이름의 의미 충돌이 아닌 "구 식별자 잔존 정리 필요" 또는 "섹션 번호 앵커 동기화 확인" 수준의 권고 사항이다. 환경변수, 엔티티명, API 경로, 이벤트 enum 값, JWT kind, i18n 키 네임스페이스 모두 기존 사용처와 명확히 분리되어 있으며, 마이그레이션 번호 점유는 plan 자체의 절차적 보호(착수 직전 max(V) 재확인)가 이미 명시되어 있다.

## 위험도

LOW
