# Rationale 연속성 검토 결과

검토 모드: --impl-done (구현 완료 후), scope=spec/5-system/, diff-base=origin/main

---

## 발견사항

### INFO-1 — user-profile Rationale 의 이메일 "별도 변경 분리" 문구가 새 구현을 반영해 업데이트됨 (정합 확인)

- **target 위치**: `spec/2-navigation/9-user-profile.md` `## Rationale` `/profile 편집 인터랙션의 분리 (§2)`
- **과거 결정 출처**: 동 spec `## Rationale` — "이메일은 기존 결정대로 '별도 변경 (확인 메일)' 으로 본 화면에서 분리한 상태를 유지한다"
- **상세**: 구 Rationale 의 결론 문장이 "이메일은 기존 결정대로 '별도 변경 (확인 메일)' 으로 본 화면에서 분리한 상태를 유지한다"에서 "이메일은 비밀번호와 동일한 sub-route 패턴(`/profile/change-email`)을 따르되, 재인증 + 신규 이메일 확인 메일 + 옛 이메일 통지를 거치는 별도 흐름으로 분리한다"로 갱신됐다. 이는 이메일 변경을 구현한 것에 대응하는 **정당한 Rationale 갱신**이며, 기각된 대안(인라인 토글 일원화·전 항목 sub-route·단일 페이지 섹션 Save)은 그대로 유지돼 연속성이 있다.
- **제안**: 별도 조치 불필요. 단, (a) 본 프로필 편집 Rationale 은 "비밀번호는 sub-route, 이메일은 별도(미구현)"였던 상태에서 "이메일도 sub-route"로 확장한 변경이므로, 향후 동 Rationale 을 읽는 관리자가 "왜 이메일이 나중에 sub-route 로 전환됐는지"를 추적하기 어려울 수 있다. 필요하면 "이메일 변경 구현 이전에는 readonly 유지였으나 §1.1.B 구현으로 전환했다"는 한 줄 history 주석을 추가해도 좋다. 차단 수준은 아니다.

---

### INFO-2 — `user.email_changed` 를 기존 "Planned" 표에서 "구현됨" 표로 이동 — Rationale 4.1.A 원칙 준수 확인

- **target 위치**: `spec/5-system/1-auth.md` §4.1 구현된 액션 표
- **과거 결정 출처**: 동 spec `## Rationale 4.1.A` — `user.*` dot-prefix 통일, 과거분사 verb 확정
- **상세**: `user.email_changed` 는 §4.1.A 의 `user.*` 네임스페이스·과거분사(`changed`) 규약을 그대로 따른다. Planned 표에서 구현 표로 이동할 때 명명 규칙·workspace 귀속 방식(4.1.B)·PII 비저장(1.1.B-6) 모두 기존 Rationale 을 정확히 따르고 있다. 규칙 위반 없음.
- **제안**: 이상 없음.

---

### INFO-3 — `session_revoked` LoginHistory enum 재사용 — Rationale 2.3.C 와 정합

- **target 위치**: `spec/5-system/1-auth.md` §4.3 LoginHistory 표 `session_revoked` 행 및 §2.3 "이메일 변경 시 처리" 행
- **과거 결정 출처**: 동 spec `## Rationale 2.3.C` — "`session_revoked` enum 값은 기존 그대로 재사용한다(§4.3) — 새 event 종류 신설이 아니므로 `login_history` event 스키마·DB CHECK 제약·마이그레이션이 불요하다"
- **상세**: 이메일 변경 확인 시 전 세션 revoke 기록을 `session_revoked`(bulk, `familyId=null`)으로 기존 enum 재사용하는 것은 Rationale 2.3.C 의 방침과 완전히 일치한다. 이메일 변경도 "전 family revoke"의 의미가 동일해 재사용이 타당하다. Rationale 2.3.C 의 "현재 family 식별 불가 → 전체 revoke + 재발급" 논리도 `/api/users/me/email-change/verify`(refresh 쿠키 Path `/api/auth` 미첨부)에 동일하게 적용되어 동형임이 명시됐다.
- **제안**: 이상 없음.

---

### INFO-4 — 이메일 OTP 배제(1.1.B-4)와 §2.3 세션-revoke 재인증 정의 유지

- **target 위치**: `spec/5-system/1-auth.md` §1.1.B 핵심 설계 "이메일 OTP 배제", Rationale 1.1.B-4
- **과거 결정 출처**: 동 spec §2.3 "강제 종료 재인증" 행 — "OAuth-only 사용자는 등록된 2FA (TOTP 또는 WebAuthn) 또는 이메일 OTP 로 대체"
- **상세**: §2.3 세션-revoke 재인증은 이메일 OTP 를 허용하지만, §1.1.B 이메일 변경 재인증에서는 이메일 OTP 를 배제한다. 이는 순환성 문제(변경 대상 메일함의 OTP 로 통과)를 이유로 명시적으로 차등 정책을 둔 것이며, Rationale 1.1.B-4 가 이 차등을 명시하고 있다. §2.3 의 이메일 OTP 허용 원칙을 번복하는 것이 아니라 이메일 변경 전용 예외를 추가한 것으로, 기존 §2.3 세션-revoke 정의 자체를 변경하지 않는다고도 명시됐다. Rationale 연속성 관점에서 이상 없음.
- **제안**: 이상 없음.

---

### INFO-5 — `@Public` 배제(Rationale 1.1.B-2)와 signup verify-email `@Public` 원칙과의 관계

- **target 위치**: `spec/5-system/1-auth.md` §1.1.B 핵심 설계 "확인은 인증 필수", Rationale 1.1.B-2
- **과거 결정 출처**: 동 spec §5 API 엔드포인트 표 — `POST /api/auth/verify-email` 은 "인증 불요 (`@Public`)"
- **상세**: signup `verify-email` 이 `@Public` 인 원칙을 이메일 *변경* verify 에서 의도적으로 배제했다. Rationale 1.1.B-2 가 "계정 활성화(아직 세션 없음) vs 식별자 교체(이미 로그인된 계정)" 의 차이를 근거로 차등을 정당화한다. 기존 `@Public` 원칙의 번복이 아니라 다른 컨텍스트에 다른 정책을 적용한 것으로, 논리적으로 일관하다.
- **제안**: 이상 없음.

---

## 요약

이메일 변경 기능(§1.1.B) 구현에 수반된 spec 변경은 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 항목이 없다. Rationale 1.1.B-1~6 는 각각의 설계 결정에 대응하는 신규 Rationale 로 추가됐고, 기존 Rationale(2.3.C 세션 revoke 범위, 4.1.A 감사 액션 명명, 4.1.B workspace 귀속)의 원칙을 그대로 따르거나 명시적으로 인용한다. user-profile Rationale 의 이메일 처리 문구 갱신은 기존 정책("별도 분리")을 유지하면서 구현 경로만 구체화한 것으로, "기각된 대안 재도입"에 해당하지 않는다. 검출된 항목은 모두 INFO 수준의 보완 제안이다.

## 위험도

NONE

STATUS: SUCCESS
