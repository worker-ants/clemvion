# Consistency Check 통합 보고서 (--spec, 1차) — **BLOCK: YES → draft 정정 후 재검증(10_33_54)로 이관**

target: `plan/in-progress/auth-reauth-spec-accuracy.md` (§2.3 재인증 drift 정정 + 카탈로그 세부 코드 등재)

## 판정
- **naming_collision = BLOCK: YES** (2 CRITICAL). 나머지 4 checker BLOCK: NO.
- CRITICAL 은 **spec 설계가 아니라 draft 산문의 근접명명 오귀속** — 코드검증값으로 정정 후 재검증 세션(10_33_54)에서 확정.

## Critical (naming_collision) — draft 산문 오귀속 (정정 완료)
| # | 오귀속 (1차 draft) | 코드 ground truth | 정정 |
|---|---|---|---|
| 1 | `PASSWORD_INVALID` "재인증·**로그인** 공용" | 로그인 실패는 `LOGIN_FAILED`(401) 반환. `PASSWORD_INVALID` 는 `verifyReauth`(sessions.service.ts:266) + `verifyPasswordForUser`(auth.service.ts:81; 2FA해지·WebAuthn관리) | "로그인" 제거, `verifyPasswordForUser` 공용으로 정정 |
| 2 | 주석 `INVALID_PASSWORD` "비밀번호 변경·**2FA 해지**" | 2FA 해지는 `PASSWORD_INVALID`(verifyPasswordForUser). `INVALID_PASSWORD` 는 `changePassword`(users.service.ts:76/84) **전용** | "2FA 해지" 제거, change-password 전용으로 정정 |

## WARNING (cross_spec·convention_compliance·rationale_continuity) — 전부 정정 draft 반영
1. `PASSWORD_INVALID` 귀속 오류 (위 CRITICAL 1 과 동일 근원) — 정정.
2. `PASSWORD_INVALID` vs `INVALID_PASSWORD`(§1.3 예정) 근접명명 disambiguation 누락 — §1.2.1 주석에 "다른 코드" 명시 추가.
3. §2.3 정정 시 backward-ref(`§1.1.B` L79 · `Rationale 1.1.B-4` L515) stale — 동일 PR 에서 1c/1d 로 동기화 추가.

## INFO — 정정 draft 반영
- (rationale) §2.3 정정 결정 Rationale 을 `1-auth.md` 자체에도 — 신규 §2.3.D 추가(1e).
- (rationale) 배경에 `spec-draft-email-change → refactor-auth-reverify-unify` 유실 계보 인용 추가.
- (cross_spec) `PASSWORD_REQUIRED` 미등재 — 범위 밖 deferred 로 명시(§1.2.1 주석 + plan).
- (plan_coherence) `error-codes-catalog-sot.md §후속` line 52 체크박스 갱신 — 변경 3 으로 추가.
- (naming) `REAUTH_REQUIRED` vs `AUTH_REQUIRED` — 저위험, 무조치.

## Checker별
| Checker | 판정 | 비고 |
|---|---|---|
| cross_spec | BLOCK: NO (MEDIUM) | §2.3 정렬은 코드·Rationale·9-user-profile 정합. PASSWORD_INVALID 귀속만 WARNING |
| rationale_continuity | BLOCK: NO (LOW) | 결정(§2.3 정렬)은 1.1.B-4 와 완전 정합. backward-ref 동기화만 필요 |
| convention_compliance | BLOCK: NO (LOW) | 표 형식·UPPER_SNAKE·status·slug·frontmatter 규약 준수. disambiguation 만 |
| plan_coherence | BLOCK: NO | 완료/진행 plan 후속 정확 이행. error-codes-catalog-sot 체크박스 갱신 권고 |
| naming_collision | **BLOCK: YES** | 위 2 CRITICAL — 정정 후 10_33_54 재검증 |

→ 정정 draft 재검증: `review/consistency/2026/07/10/10_33_54/`.
