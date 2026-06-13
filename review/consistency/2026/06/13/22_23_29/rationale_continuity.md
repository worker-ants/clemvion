# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md`
검토 모드: spec draft (--spec)

---

### 발견사항

- **[INFO]** `session_revoked` 의미 확장이 기존 Rationale 와 부합하나 login_history event enum CHECK 제약 갱신 불요 여부를 명시 누락

  - target 위치: 변경 2 — §4.3 `session_revoked` 행 설명 확장 (bulk revoke 트리거 추가)
  - 과거 결정 출처: `spec/data-flow/1-audit.md § Rationale "Action 은 application union 으로 강제, event 는 DB CHECK 로 고정"` + `spec/5-system/1-auth.md §Rationale 1.4.G`
  - 상세: `login_history.event` 는 DB CHECK 제약(`chk_login_history_event`, V040 기준 7종)으로 enum 이 고정되어 있고, "event 종류 추가 시 마이그레이션이 필요하다"고 명문화되어 있다. 변경 2 는 `session_revoked` 의 **설명** 을 확장하는 것(기존 enum 값을 재사용)이라 enum 신설이 없어 마이그레이션 불요는 자명하다. 그러나 target 문서는 이 점을 명시하지 않아 검토자가 CHECK 제약 갱신이 필요한지 의문이 남는다.
  - 제안: Rationale §A-1 또는 변경 2 비고에 "enum 값(`session_revoked`) 은 기존 그대로 — DB CHECK 제약 및 마이그레이션 불요" 한 줄을 추가한다.

- **[INFO]** 기각 대안 (a)의 복원 위험에 대한 중복 명시 — 오히려 명료함 향상

  - target 위치: 변경 3 — Rationale §2.3.C "기각된 대안 (a) 전 세션 revoke + 재발급 없음"
  - 과거 결정 출처: target 문서의 배경 단락(A-1 = 옵션 B 선택, 옵션 a 기각), 사용자 결정 기록
  - 상세: target 이 대안 (a)를 Rationale 내에 명시적으로 "기각"으로 기록하고 있는 것은 Rationale 연속성 원칙(기각 대안을 문서화)을 정확히 따른 것이다. 충돌 없음 — INFO 로 기록.
  - 제안: 현행 유지.

- **[INFO]** `reset-password` 전 세션 revoke 후 재발급 없음 — 기존 §1.1.A 서술과 정합 확인

  - target 위치: 변경 3 — §2.3.C "무인증 reset-password 와의 위협 모델 대조"
  - 과거 결정 출처: `spec/5-system/1-auth.md §1.1.A` "refresh 토큰 전체 revoke: 비밀번호 재설정 직후 모든 활성 세션 종료"
  - 상세: target 의 §2.3.C 는 `POST /auth/reset-password` 가 전 세션 revoke + 재발급 없음 → 로그인 화면으로 보낸다고 기술한다. 이는 기존 §1.1.A 의 "모든 refresh token revoke + 재로그인" 서술과 일치한다. target 이 두 경로의 위협 모델 차이를 명문화하는 것은 새 정보 추가일 뿐 기존 결정의 번복이 아니다.
  - 제안: 현행 유지.

- **[INFO]** `ipAddress` 동반 패턴의 user.* 수평 확장 — auth_config 계열 Rationale 에 수평 확장 근거 명시 없음

  - target 위치: 변경 5 — B-1 user.* 5개 행에 `ipAddress 동반` 추가
  - 과거 결정 출처: `spec/data-flow/1-audit.md §1.1` "auth_config 계열은 모두 `ipAddress` 를 함께 전달" (기존 서술), `spec/5-system/1-auth.md §Rationale 2.3.B` (extractClientIp 정책)
  - 상세: auth_config 계열이 ipAddress 를 동반하는 것은 기존 코드·spec 상 사실로 기록되어 있으나, 그 이유("포렌식" 목적)가 별도 Rationale 항으로 정식화된 적이 없다. target 은 "auth_config.* 가 이미 따르는 ipAddress 동반 패턴의 수평 확장 — 새 결정 아님"으로 처리한다. 이는 결정 번복이 아니라 패턴 확대 적용이므로 Rationale 신규 항 없이 처리해도 원칙 위반은 아니다. 단, auth_config 계열에 ipAddress 를 넣은 원래 근거가 별도 Rationale 항에 없어 독립적 포렌식 정당화가 누락된 상태다.
  - 제안: target Rationale 의 B-1 항에 "auth_config 계열의 ipAddress 동반은 포렌식·사후 감사 목적으로 도입됐으며(data-flow §1.1 기존 서술), user.* 확장도 동일 근거" 한 줄을 추가하면 추후 검토자의 질문을 선차단할 수 있다.

---

### 요약

target draft 는 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 항목이 없다. A-1(옵션 B 채택)은 사용자 결정을 공식화하면서 기각 대안 (a)(전 세션 revoke + 재발급 없음)와 (b')(현재 family 제외 revoke — 쿠키 Path 제약으로 구현 불가)를 Rationale §2.3.C 에 명시하여 연속성 원칙을 준수했다. reset-password 와의 위협 모델 대조 역시 기존 §1.1.A 서술과 일관된다. B-1 의 ipAddress 확장은 auth_config 계열의 기존 패턴을 수평 적용한 것으로 새 결정이 아니다. 단, `session_revoked` enum 값이 DB CHECK 로 고정된 상황에서 값 재사용(신설 없음)임을 target 이 명시하지 않아 독자의 혼동이 생길 여지가 있고, auth_config ipAddress 동반의 원초적 Rationale 가 이 draft 에서도 선언되지 않았다는 두 가지 INFO 수준의 보완 지점이 있다.

### 위험도

NONE
