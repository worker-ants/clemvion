# Rationale 연속성 검토 결과

검토 모드: spec draft (--spec)
Target: `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md`
참조 Rationale 출처: `spec/5-system/1-auth.md`, `spec/data-flow/1-audit.md`

---

### 발견사항

- **[INFO]** `session_revoked` 의미 확장 — 기존 서술과 충분히 정합하나 audit.md 표 갱신 필요
  - target 위치: 변경 2 (`§4.3 login_history session_revoked 행 설명 확장`)
  - 과거 결정 출처: `spec/data-flow/1-audit.md §1.2` 표 — `session_revoked: 사용자가 활성 세션 목록에서 다른 family 강제 종료`
  - 상세: 현재 `spec/data-flow/1-audit.md §1.2` 의 `session_revoked` 행 설명은 "사용자가 활성 세션 목록에서 다른 family 강제 종료" 만 언급한다. draft 변경 2는 `spec/5-system/1-auth.md §4.3` 의 해당 행을 확장하는 내용이나, `spec/data-flow/1-audit.md §1.2` 의 같은 의미 설명은 미포함이다. 두 파일이 같은 사실의 SoT 역할을 분담하므로 data-flow audit.md §1.2 도 동일하게 갱신돼야 한다.
  - 제안: target 의 "변경 2" 범위에 `spec/data-flow/1-audit.md §1.2` `session_revoked` 행도 병기 갱신 대상으로 추가하거나, draft 의 Rationale 섹션에 "data-flow/1-audit.md §1.2 는 별도 커밋에서 갱신" 임을 명시해 누락을 방지한다.

- **[INFO]** `reset-password` 전체 revoke vs `change-password` 현재 세션 제외 revoke — 정책 차이가 명시적으로 대조되지 않음
  - target 위치: 변경 3 — 신규 Rationale §2.3.C
  - 과거 결정 출처: `spec/5-system/1-auth.md §1.1.A` 설계 원칙 "refresh 토큰 전체 revoke: 비밀번호 재설정 직후 모든 활성 세션 종료"
  - 상세: 기존 spec §1.1.A 는 `POST /auth/reset-password`(무인증 토큰 기반) 성공 시 **모든** 활성 세션을 revoke 한다. 반면 draft §2.3.C 는 `POST /users/me/change-password`(인증 세션 기반) 성공 시 **현재 세션을 제외한** 나머지만 revoke 한다. 두 endpoint 는 다른 컨텍스트라 이 차이 자체는 기각된 결정의 재도입이 아니다. 그러나 draft Rationale §2.3.C 가 "기각된 대안 (a) 전 세션 revoke" 를 명시하면서, 비교 대상이 동일 endpoint 의 두 옵션임을 강조하고 있어 reset-password 의 "전체 revoke" 원칙과의 관계가 독자에게 모호하게 남을 수 있다.
  - 제안: §2.3.C Rationale 에 "무인증 reset-password(§1.1.A)는 비밀번호 자체를 상실한 계정 탈취 시나리오라 전체 revoke 원칙이 다르게 적용된다" 는 한 문장을 추가해 두 정책의 상이한 위협 모델을 명시한다. 이는 번복이 아님을 명확히 하는 보강이다.

---

### 요약

target draft 는 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 우회하는 내용을 포함하지 않는다. A-1(`change-password` 세션 revoke 범위)은 기존 §2.3 세션 정책에 새 행을 추가하는 것이며, 새 Rationale §2.3.C 에 기각 대안과 근거를 모두 명시해 결정 연속성을 충족한다. `session_revoked` event 의 `familyId=null` bulk 재사용은 `login_history.family_id UUID?`(nullable) 스키마와 정합하며, DB CHECK 마이그레이션도 불필요하다. B-1(`user.*` ipAddress 동반)은 `auth_config.*` 기존 결정의 수평 확장으로, 기각된 대안 없는 순수 추가다. 다만 `spec/data-flow/1-audit.md §1.2` 의 `session_revoked` 행 설명이 이번 spec 변경 범위에서 누락돼 있어 두 파일 간 정합 갱신을 보완해야 하며, §2.3.C 에서 `reset-password` 전체 revoke 와의 위협 모델 차이를 한 줄 명시하면 향후 독자 혼동을 방지할 수 있다.

---

### 위험도

LOW
