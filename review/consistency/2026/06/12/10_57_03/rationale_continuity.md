# Rationale 연속성 검토 결과

**검토 대상**: `spec/5-system/1-auth.md`
**검토 모드**: spec draft 검토 (--spec)
**검토일**: 2026-06-12

---

## 발견사항

### 발견된 CRITICAL/WARNING/INFO 없음 — 전반적으로 정합

target 문서(`spec/5-system/1-auth.md`)를 기존 spec Rationale 발췌와 교차 검토한 결과, 아래 4가지 점검 관점에서 유의미한 위반이 발견되지 않았다.

---

### [INFO] §1.4.2 강제 종료 재인증과 WebAuthn 우선 규칙의 상호 참조

- **target 위치**: `§2.3 세션 정책` 표 `강제 종료 재인증` 행 — "두 방식 모두 등록한 사용자는 §1.4.2 의 우선순위(WebAuthn 우선) 를 따른다"
- **과거 결정 출처**: target 문서 내 `Rationale 1.4.D` ("WebAuthn 등록 사용자에게 로그인 화면이 TOTP 입력란을 함께 노출하지 않는다") — 로그인 2FA 화면에 국한된 근거
- **상세**: 강제 종료 재인증은 `/auth/login` 2FA 화면과 다른 UX 컨텍스트(세션 관리 화면)다. `§1.4.2` 우선순위 규칙이 이 재인증 흐름에도 동일하게 적용된다고 명시했으나, 1.4.D Rationale 는 "로그인 화면에서 TOTP 입력란을 노출하지 않는" 맥락으로 작성됐다. 재인증 흐름에 같은 우선순위를 적용하는 설계 선택 자체는 합리적이나, 이 적용 확장에 대한 별도 근거가 Rationale 에 없다.
- **제안**: `Rationale 2.3.B` 항목으로 "강제 종료 재인증에서의 WebAuthn 우선 원칙 확장 — §1.4.D 와 같은 맥락으로 약한 수단 자동 노출 금지"를 간략히 추가하면 추후 변경 시 명시적 근거가 된다. (현재 기각된 대안이나 invariant 위반은 아니므로 INFO 수준)

---

### [INFO] §1.4.1 복구 코드 폐기 규칙 — WebAuthn "사용자 명시적 재발급" 근거 부재

- **target 위치**: `§1.4.1 복구 코드` 표 `폐기` 행 — "사용자 명시적 '복구 코드 재발급' 도 지원"
- **과거 결정 출처**: `Rationale 1.4.B` — 풀 분리 이유만 기술. `Rationale 1.4.E` — counter 역행 시 삭제 vs suspend
- **상세**: TOTP 측 복구 코드 재발급은 "비활성→재활성으로 재발급"이라고 §5 API 표에 명시돼 있어 암묵적으로 Rationale에 기반이 있다. WebAuthn 측의 `POST /api/auth/2fa/webauthn/recovery-codes/regenerate` 경로가 도입된 맥락(보안 재설정, 도난 기기 우려 등)의 Rationale 항목이 없다. 비밀번호 재확인 요구(API 표에 "본문에 `password` 재확인"으로 명시)는 올바른 접근이나 왜 이 엔드포인트가 필요한지의 설계 근거가 없다.
- **제안**: `Rationale 1.4.B` 말미 또는 별도 `1.4.B-1` 항에 "WebAuthn 복구 코드 재발급 허용 이유 — 도난/분실 기기 시나리오에서 사용자가 복구 코드를 갱신할 수단 제공. 비밀번호 재확인으로 인증 강도 유지"를 추가하는 것을 권장한다. (선택 사항 — 기각된 대안 재도입이나 invariant 위반은 아님)

---

### [INFO] §4.1 감사 액션 `auth_config.reveal` — 현재형 통일 근거가 Rationale 에만 존재

- **target 위치**: `§4.1 기록 대상 액션` 표 `설정` 카테고리 — `auth_config.create`, `auth_config.update`, `auth_config.delete`, `auth_config.regenerate`, `auth_config.reveal`
- **과거 결정 출처**: target 문서 내 `Rationale 4.1.A` — "auth_config 은 `reveal`·`regenerate` 처럼 과거분사가 부자연스러운 동사가 섞여 CRUD 동사 현재형으로 통일"
- **상세**: 본문 §4.1 Action naming 규약 단락에도 "auth_config 은 `reveal`·`regenerate` 처럼 과거분사가 부자연스러운 동사가 섞여 CRUD 동사 현재형(`create`/`update`/`delete`/`regenerate`/`reveal`)으로 통일한다"고 명시돼 있어 본문-Rationale 간 완전 정합이다. 추가 위반 없음.
- **제안**: 정합 확인 — 추가 조치 불필요.

---

## 요약

`spec/5-system/1-auth.md` target 문서는 기존 Rationale 발췌와 전반적으로 강한 정합을 보인다. 명시적으로 기각된 대안의 재도입(`suspend` vs 삭제 결정 1.4.E, TOTP fallback 자동 허용 1.4.D, 초대 토큰 해시 저장 1.5.D, raw 저장 채택, 공통 복구 코드 풀 1.4.B 기각 등)이 target 에서 번복된 사례는 발견되지 않았다. 합의된 invariant(단방향 모듈 의존성 1.4.H, 단일 트랜잭션 보호, WebAuthn 비활성 시 fail-open 아닌 503, JWT stateless challenge 1.4.C)도 모두 준수된다. 발견된 사항은 모두 INFO 수준의 Rationale 보완 제안으로, 현재 문서 상태에서 설계 오류나 위험한 결정 번복은 없다.

## 위험도

NONE
