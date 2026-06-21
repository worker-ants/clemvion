# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-email-change.md`
검토 관점: 기존 spec Rationale에서 기각·폐기된 결정의 재도입, 합의 원칙 위반, 무근거 번복, 암묵적 가정 충돌

---

## 발견사항

### [WARNING] §2.3 재인증 계약 재사용 시 이메일 OTP 수단 묵살

- **target 위치**: `확정된 설계 §1` 및 `§2.1 신규 본문 §1.1.B "이메일 변경 흐름"` 재인증 단계 (a) 항, `§4 에러 코드 REAUTH_NOT_AVAILABLE`
- **과거 결정 출처**: `spec/5-system/1-auth.md §2.3 세션 정책` 표 `강제 종료 재인증` 행
- **상세**:
  기존 §2.3 재인증 계약은 "비밀번호 재확인 필수. OAuth-only 사용자는 등록된 2FA (TOTP 또는 WebAuthn) **또는 이메일 OTP** 로 대체"를 명문화하고 있다. target은 이 계약을 재사용한다고 선언하면서도("§2.3 강제 종료와 동일한 재인증 계약"), 실제 request 흐름에서는 "password_hash 보유 → 비밀번호 검증 / 없으면 등록된 2FA factor"만 기술하고 이메일 OTP 수단을 다루지 않는다. 그 결과 password_hash도 2FA도 없는 계정을 REAUTH_NOT_AVAILABLE로 차단하는 결정이 등장하는데, 이는 기존 §2.3이 이메일 OTP를 통해 그 공백을 메우는 방식과 충돌한다.

  이메일 OTP를 이 흐름에서 의도적으로 배제하는 결정은 보안상 합리적 이유가 있을 수 있다(이메일 변경 flow에서 이메일 OTP를 재인증 수단으로 쓰면 새 이메일 주소와의 혼동 등 ambiguity 발생). 그러나 해당 판단을 Rationale에 명시하지 않은 채 §2.3 계약을 "재사용"한다고만 기술하면, §2.3에서 허용하는 이메일 OTP 경로가 이 흐름에서는 실제로 막혀 있다는 사실이 spec 소비자에게 혼란을 준다.
- **제안**:
  Rationale R5(OAuth-only 무2FA 차단) 항목 또는 §1.1.B 설계 원칙에 "이메일 OTP는 본 흐름에서 이메일 변경 대상 주소와의 ambiguity로 인해 재인증 수단으로 채택하지 않는다"는 명시적 제외 근거를 추가한다. 또는 §2.3 재인증 계약 재사용 문구를 "§2.3 계약의 재인증 수단 중 이메일 OTP를 제외한 범위로 준용"으로 좁혀 기술한다.

---

### [INFO] @Public verify 기각 근거는 target Rationale(R2)에 명시됨 — 정합 확인

- **target 위치**: `Rationale R2`
- **과거 결정 출처**: 기존 spec에 이메일 변경 verify에 대한 선행 결정이 없으므로 신규 결정에 해당
- **상세**:
  signup의 verify-email이 @Public인 것과 달리, 이메일 변경 verify를 인증 필수로 두는 설계는 기존 @Public 패턴의 암묵적 규범과 달라 보일 수 있다. 그러나 target R2는 이 차이의 근거(토큰-사용자 바인딩으로 누출 링크 단독 공격 차단)를 명시하고 있으며, @Public verify를 명시적으로 기각 대안으로 열거하고 있어 결정 번복 시 새 Rationale 명시 요건을 충족한다.
- **제안**: 없음 (정합).

---

### [INFO] 세션 처리 — Rationale 2.3.C 재사용 선언이 본문과 정합

- **target 위치**: `확정된 설계 §4`, `§2.1 §1.1.B 3.c`, `Rationale R3`
- **과거 결정 출처**: `spec/5-system/1-auth.md Rationale 2.3.C` — 비밀번호 변경 시 세션 revoke 범위
- **상세**:
  target은 "전 family revoke + 현재 디바이스 재발급"을 비밀번호 변경과 동형으로 두고, 그 근거로 Rationale 2.3.C를 명시적으로 공유·재사용한다. refresh 쿠키 Path가 /api/auth로 한정되어 /api/users/me/* 요청에는 첨부되지 않아 현재 family 식별 불가 → 전체 revoke 불가피라는 invariant를 그대로 적용하고 있어 정합적이다.
- **제안**: 없음 (정합).

---

### [INFO] user.email_changed 감사 액션 — Rationale 4.1.A 예고와 정합

- **target 위치**: `§2.4 §4.1 감사` 섹션
- **과거 결정 출처**: `spec/5-system/1-auth.md Rationale 4.1.A` — "향후 user-profile 계열 감사(예: user.email_changed)와 동일 네임스페이스로 묶인다"
- **상세**:
  Rationale 4.1.A는 이미 user.email_changed를 향후 감사 액션 예시로 명시적으로 예고했다. target이 이를 Planned 액션으로 채택하는 것은 번복이 아니라 예고된 결정의 실현이다. workspace 귀속 기준(액터 세션 workspaceId)도 4.1.B의 원칙을 그대로 따른다.
- **제안**: 없음 (정합).

---

### [INFO] 토큰 SHA-256 at-rest 저장 — 기존 원칙과 정합

- **target 위치**: `§1 데이터 모델 email_change_token`, `§2.2 §1.1 표 갱신`
- **과거 결정 출처**: `spec/5-system/1-auth.md §1.1` 표 "토큰 at-rest 저장" 행 및 `spec/1-data-model.md §2.1 User email_verify_token / password_reset_token`
- **상세**:
  기존 email_verify_token, password_reset_token 모두 SHA-256 해시로 저장하는 원칙이 확립되어 있다. target이 email_change_token도 동일 패턴으로 설계하는 것은 합의된 원칙의 일관 적용으로 정합적이다.
- **제안**: 없음 (정합).

---

## 요약

target 문서 spec-draft-email-change.md는 기존 spec의 Rationale에서 명시적으로 기각된 대안을 재도입하거나 합의된 시스템 invariant를 직접 위반하는 사항은 발견되지 않았다. 가장 주목할 부분은 기존 §2.3 재인증 계약을 "재사용"한다고 선언하면서도 §2.3이 명시한 이메일 OTP 대체 수단을 이 흐름에서 묵살하고 있다는 점이다. 이메일 OTP 배제는 보안 논리상 설득력 있는 이유가 있지만(이메일 변경 대상 주소와의 ambiguity), 그 이유가 Rationale에 기술되지 않아 "§2.3 계약 재사용"이라는 선언과 실제 구현 범위 사이에 간극이 생긴다. 이를 WARNING으로 분류한다. 나머지 설계 결정들(SHA-256 at-rest, 세션 전 family revoke + 재발급, user.email_changed 감사 액션, verify 인증 필수)은 모두 기존 Rationale 결정의 정합적 확장 또는 예고된 결정의 실현이며, 새 Rationale가 충분히 동반된다.

## 위험도

LOW
