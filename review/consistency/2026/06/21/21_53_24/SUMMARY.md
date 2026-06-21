# Consistency Check 통합 보고서 (--impl-done spec/5-system/, 후속)

**BLOCK: NO** — Critical 발견 없음. WARNING 1 + INFO 다수, 전부 advisory(비차단).

## 전체 위험도
**LOW** — 구현 설계 충돌 없음. WARNING 1건은 **이미 머지된** 1-auth.md 의 명칭 nit.

## Critical 위배
없음.

## 경고 (WARNING)
| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| 1 | Naming Collision | `1-auth.md §1.1.B`/Rationale 1.1.B-4 가 재인증을 `verifyReauth`(private)로 지칭, `data-flow/2-auth.md §1.7.1` 은 `reauthenticate`(public). 코드는 정확 — public `reauthenticate` 가 private `verifyReauth` 를 위임 | **deferred(advisory)** — 양쪽 다 같은 흐름을 가리키며 코드 정합. 1-auth.md(머지된 spec) 수정은 impl-done 가드 재트리거(루프) → 본 후속에서 미수정. 1-auth.md Rationale 1.1.B-4 에 "reauthenticate(verifyReauth 위임)" 한 줄 정정은 별도 planner 작업으로 처리 권장 |

## 참고 (INFO) — 전부 비차단
| # | 항목 | 처리 |
|---|------|------|
| 1 | `user.email_changed` 1-auth §4.1 구현 표 명시 | 1차 PR(a2e488e7)에서 §4.1 인증 행에 추가됨 — changeset 이 머지 spec 제외해 생긴 false-negative |
| 2 | data-flow §1.7.1 4-depth(####) 도입 | (선택) §1.8 승격 — 기능 무관 |
| 3 | data-flow §2.2 throttle 표에 email-change 행 | (선택) planner 보강 |
| 4 | refactor-auth-reverify-unify 와 §1.2 용어 정합 | 해당 plan 추적 영역 |
| 5 | followup plan EXPLAIN deferred 항목 잔류 | 정상(deferred 명시됨) |
| 6/7/8 | clearPendingEmailChange/emailTakenByOther/V101 신규 식별자·rationale 갱신 | 충돌 없음 |

## Checker별 위험도
Cross-Spec NONE · Rationale NONE · Convention NONE · Plan LOW · Naming LOW(WARNING 1 — 머지 spec 명칭 nit)

## 결론
**BLOCK: NO** — push 가능. WARNING 1 은 머지된 1-auth.md 의 명칭 harmonization nit(코드 정합·비차단)으로, impl-done 재루프 회피 위해 별도 planner 작업으로 분리. INFO 전부 비차단.
