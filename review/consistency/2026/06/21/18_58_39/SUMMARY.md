# Consistency Check 통합 보고서 (--impl-done spec/5-system/)

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 이메일 변경 흐름 신설 spec 변경은 전반적으로 일관성이 있으며, 실질 위험은 `9-user-profile.md §6.1` 재인증 범위 문구 모호성(WARNING 1건)에 국한.

## Critical 위배
없음.

## 경고 (WARNING)
| # | Checker | 위배 | target | 제안 |
|---|---------|------|--------|------|
| 1 | Cross-Spec | 재인증 범위 — `9-user-profile.md §6.1` "비밀번호 또는 등록 2FA" 가 WebAuthn 포함으로 오독 가능. §1.1.B 는 TOTP only 명시 | `9-user-profile.md §6.1` request 행 | "비밀번호 또는 등록 TOTP (WebAuthn step-up 미지원 — 인증 §1.1.B Rationale 1.1.B-4)" 로 구체화 |

## 참고 (INFO)
| # | Checker | 항목 | 조치 |
|---|---------|------|------|
| 1 | Cross-Spec | data-flow/2-auth.md §1.7 시퀀스·§2.1 컬럼 미반영 | (선택) planner follow-up |
| 2 | Cross-Spec | REAUTH_NOT_AVAILABLE error-codes.md 미등재 | 기존 코드 재사용 — refactor-auth-reverify-unify 추적 영역 |
| 3 | Rationale | §Rationale "전 항목 sub-route 폐기" 문구가 이메일 sub-route 도입과 혼동 | (선택) 문구 구체화 |
| 4 | Convention | Rationale 1.1.B-6 의 §4.1.A "예고" 표현 — §4.1.A 는 확정 규약 | 문구 수정 |
| 5 | Plan | refactor-auth-reverify-unify reauth 코드 등재 follow-up 중복 영역 — 충돌 없음 | plan 추적 |
| 6 | Plan | spec-draft-email-change §다음 단계 5 체크박스 미체크(실제 구현 완료) | [x] 갱신 |
| 7 | Plan | §1.5.D 초대 토큰 raw 저장 예외가 더 두드러짐 | security-backlog 메모 |
| 8 | Naming | data-model §2.1 User 3컬럼 행 누락 가능 | **확인 결과 이미 반영됨**(spec 커밋 074ed014) — 거짓 음성(changeset 코드 제외) |
| 9 | Naming | AUDIT_ACTIONS.USER_EMAIL_CHANGED 코드 pending | **확인 결과 이미 추가됨**(feat 커밋 50bcdad1) — 거짓 음성 |

## Checker별 위험도
| Checker | 위험도 |
|---------|--------|
| Cross-Spec | LOW (WARNING 1, INFO 2) |
| Rationale Continuity | NONE (기각 대안 재도입 없음, Rationale 6 신규 등재) |
| Convention Compliance | NONE |
| Plan Coherence | LOW |
| Naming Collision | LOW (식별자 충돌 없음; INFO 8/9 는 changeset 이 기 커밋 코드를 제외해 발생한 거짓 음성) |

## 결론
BLOCK:NO. WARNING 1(§6.1 문구) 은 본 턴에서 해소. INFO 8/9 는 이미 구현/반영된 항목의 거짓 음성(memory: 다회 review changeset 이 직전 커밋 코드 제외). 나머지 INFO 는 비차단.
