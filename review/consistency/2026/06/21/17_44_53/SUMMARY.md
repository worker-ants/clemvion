# Consistency Check 통합 보고서 (--impl-prep spec/5-system/)

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 불요.

## 전체 위험도
**LOW** — 5개 checker 전원 CRITICAL/WARNING 부재(1건 WARNING 은 서두 포인터로 실질 커버, 차단 아님). 나머지 INFO.

## Critical 위배
_발견 없음_

## 경고 (WARNING)
| # | Checker | 위배 | 제안 |
|---|---------|------|------|
| 1 | Convention Compliance | `1-auth.md §4.1` Planned `user.email_changed` 행에 `audit-actions.md §3` 레지스트리 포인터 미명시 | 동 섹션 서두의 일괄 `audit-actions.md` SoT 포인터로 실질 커버됨. 다운그레이드 가능 |

## 참고 (INFO)
| # | Checker | 항목 | 조치 |
|---|---------|------|------|
| 1 | Cross-Spec | endpoint `/api/` prefix 혼용 (§2.3/§4.1 vs §1.1.B/§6.1) | §2.3/§4.1 은 기존 password 행과 동일 표기 관례 — 유지 |
| 2 | Cross-Spec | `data-flow/2-auth.md §1.7` 이메일 변경 시퀀스 미등록 | 구현 완료 후 권장 (planner) |
| 3 | Cross-Spec | `data-flow/2-auth.md §2.1` user 3컬럼 미반영 가능성 | §2.1 이 user 컬럼 명시 시 동기화 — 구현 중 확인 |
| 4 | Cross-Spec | audit-actions `user` 2행 분리 스타일 | 현행 분리 유지(workspace 선례 동형) |
| 5 | Convention | `REAUTH_NOT_AVAILABLE` 3-error-handling.md §1 미등재 | 기존 코드 재사용(신규 아님) — refactor-auth-reverify-unify 추적 영역 |
| 6 | Convention | `KB_REEXTRACT_IN_PROGRESS` 미등재 | 본 작업 무관 |
| 7 | Plan | spec-draft 단계5 미완 | spec PR merge 후 정상 |
| 8 | Plan | refactor-auth-reverify-unify defer 항목 | 해당 plan 추적 중 |
| 9 | Plan | auth-config-webhook-followups | 무관 기존 갭 |
| 10 | Plan | 1-auth frontmatter pending_plans 에 email-change 미등재 | 구현 시 WebAuthn-reauth follow-up 등록 |

## Checker별 위험도
| Checker | 위험도 |
|---------|--------|
| Cross-Spec | LOW (INFO 4) |
| Rationale Continuity | NONE (기각 대안 재도입 없음) |
| Convention Compliance | LOW (WARNING 1 실질커버, INFO 5) |
| Plan Coherence | NONE |
| Naming Collision | NONE (3컬럼·1DTO필드·4endpoint·1감사이벤트 충돌 없음) |

## 결론
구현 착수 차단 요인 없음. INFO 중 (10) WebAuthn-reauth follow-up 분리 + pending_plans 등록은 구현 단계에서 처리.
