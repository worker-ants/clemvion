# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/` 구현 완료 후 검토 (diff-base=origin/main)  
실제 변경 파일: `spec/5-system/1-auth.md`, `spec/2-navigation/9-user-profile.md`, `spec/1-data-model.md`, `spec/conventions/audit-actions.md`, `spec/data-flow/1-audit.md`

---

## 발견사항

### [INFO] "별도 프로세스(미구현)" 상태에서 "전용 페이지(sub-route)" 구현 완료로 전환 — 기각이 아닌 이행

- **target 위치**: `spec/2-navigation/9-user-profile.md` §2 편집 방식 표 및 §2.1 프로필 필드 표
- **과거 결정 출처**: `spec/2-navigation/9-user-profile.md` `## Rationale` "프로필 편집 인터랙션의 분리 §2"
- **상세**: 구 Rationale 은 "이메일은 기존 결정대로 '별도 변경 (확인 메일)' 으로 본 화면에서 분리한 상태를 유지한다"고 기록하며 구현을 "(현 단계 미구현)"으로 표시했다. 이 문구는 이메일 변경 자체를 거부한 것이 아니라 구현을 연기한 것이었다. 신규 target 은 해당 계획을 실제로 구현하여 `전용 페이지(sub-route)`로 승격시켰으며, Rationale 도 "이메일은 비밀번호와 동일한 sub-route 패턴(`/profile/change-email`)을 따르되..."로 갱신되었다. 기각이 아닌 이행이므로 연속성 위반 없음.
- **제안**: 별도 조치 불필요.

### [INFO] "전 항목 sub-route 폐기 대안"과 이메일 sub-route 도입의 혼동 가능성

- **target 위치**: `spec/2-navigation/9-user-profile.md` §2 편집 방식 표 (`전용 페이지(sub-route) | 이메일`)
- **과거 결정 출처**: `spec/2-navigation/9-user-profile.md` `## Rationale` "폐기된 대안 — 전 항목 sub-route"
- **상세**: 구 Rationale 이 기각한 "전 항목 sub-route"는 "환경설정·이름까지 모두 별도 라우트로 분리"하는 안이다. 신규 target 은 이름·환경설정은 인라인 토글로 그대로 두고, 비밀번호와 동일한 패턴으로 이메일 전용 sub-route 만 추가했다. 기각된 대안의 재도입이 아니며, 위험 수준에 비례한 마찰 원칙(고위험 항목은 sub-route)을 일관되게 적용한 것이다. 그러나 문서 독자가 "전 항목 sub-route 기각" 항목과 헷갈릴 여지가 있으므로, 폐기 대안 문구를 "환경설정·이름 등 저위험 항목까지 모두 sub-route"로 소폭 명확화하면 혼동을 제거할 수 있다.
- **제안**: 기각 대안 설명을 "환경설정·이름 등 저위험 항목까지 모두 별도 라우트로 분리" 로 구체화하는 것을 권장 (비차단).

### [INFO] `session_revoked` enum 재사용 범위 확장 — 기존 Rationale 2.3.C 와 일관

- **target 위치**: `spec/5-system/1-auth.md` §4.3 LoginHistory 이벤트 표 `session_revoked` 행
- **과거 결정 출처**: `spec/5-system/1-auth.md` `## Rationale` "2.3.C — 비밀번호 변경 시 세션 revoke 범위" 말미 "`session_revoked` enum 값은 기존 그대로 재사용"
- **상세**: 구 Rationale 은 비밀번호 변경 시 `session_revoked` enum 재사용을 "새 event 종류 신설이 아니므로 schema·마이그레이션 불요"로 근거를 기록했다. 신규 target 은 이메일 변경 confirm 성공 시에도 동일 enum 값을 재사용하며 "enum 값 재사용이라 DB CHECK·마이그레이션 불요"로 동일 논리를 명시했다. 이는 기각된 대안이 아니라 기존 패턴의 일관 확장이다.
- **제안**: 별도 조치 불필요.

### [INFO] 이메일 변경 재인증에서 이메일 OTP 명시 배제 — §2.3 강제 종료 재인증과 의도적 차등, Rationale 기록 완비

- **target 위치**: `spec/5-system/1-auth.md` §1.1.B "이메일 OTP 배제" 항목
- **과거 결정 출처**: `spec/5-system/1-auth.md` §2.3 세션 정책 표 "강제 종료 재인증" 행 ("OAuth-only 사용자는 ... 이메일 OTP 로 대체")
- **상세**: §2.3 강제 종료 재인증은 OAuth-only 사용자에게 이메일 OTP 대체 수단을 허용하는데, 이메일 변경 재인증은 이를 배제한다. 표면적으로는 동일 `verifyReauth` 경로에서 두 가지 정책이 갈리는 것처럼 보인다. 그러나 신규 target 은 Rationale 1.1.B-4 에서 "변경 대상 메일함과의 순환성 때문"이라는 이유를 명확히 기록하며, "§2.3 의 세션-revoke 재인증 정의 자체는 본 작업에서 변경하지 않는다"고 명시했다. 의도적 차등이 Rationale 에 기록되어 있으므로 연속성 위반 없음.
- **제안**: 별도 조치 불필요.

---

## 요약

이번 변경(`spec/5-system/1-auth.md` §1.1.B 신설, `spec/2-navigation/9-user-profile.md` 이메일 변경 흐름 구체화, `spec/1-data-model.md` 필드 추가, `spec/data-flow/1-audit.md` 감사 엔트리 추가)은 Rationale 연속성 관점에서 전반적으로 건전하다. 과거 Rationale 에서 기각된 대안의 재도입이나 합의된 invariant 위반은 발견되지 않았다. "이메일 변경은 미구현" 으로 연기됐던 결정이 이제 구현으로 이행됐으며, 6개의 신규 Rationale(1.1.B-1~6)이 각 결정의 근거·기각 대안을 충실히 기록했다. 이메일 OTP 배제, 인증 필수 verify, SHA-256 해시 저장, 세션 처리 등 주요 설계 결정이 모두 기존 원칙과 일관되거나 명시적 차등 근거를 갖추고 있다. 발견된 INFO 항목들은 모두 독자 친화성 향상을 위한 보완 제안이며 차단 사안이 아니다.

---

## 위험도

NONE
