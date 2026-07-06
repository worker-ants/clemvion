# Consistency Check 통합 보고서 (--impl-prep, PR2 이메일 발송)

**BLOCK: NO** — Critical 없음. (cross_spec/convention_compliance/plan_coherence/naming_collision 4 checker disk-write 갭 — rationale_continuity 만 산출. 알려진 flakiness.)

## 전체 위험도
**MEDIUM** — 단일 범용 이메일 템플릿 다운스코프가 spec "type 별 템플릿" 서술과 divergence (rationale_continuity WARNING).

## Critical
없음.

## 경고 (WARNING)
| # | Checker | 위배 | 조치 |
|---|---------|------|------|
| 1 | rationale_continuity | "type 별 템플릿" → 단일 범용 템플릿 다운스코프가 spec Rationale 미동반 (`8-notifications.md` Overview L17·§1 diagram L51·§5 표 L100 = "type 별 템플릿") | downscope 채택(type별 내용은 caller-set title/message 에 이미 인코딩) + SPEC-DRIFT reflux: spec 3곳 "단일 범용 템플릿(+CTA)" 정정 + Rationale 근거를 `plan/in-progress/spec-update-notifications-email.md`(planner) 위임 |

## 참고 (INFO)
1. rationale_continuity — spec §3 에 "실패 시 email_sent_at 은 NULL 로 남는다" 명시 보강 권장 → spec-update plan 에 포함.

## 판정
BLOCK: NO → 구현 진행. 템플릿 다운스코프 divergence 는 impl-done 에서 재확인될 SPEC-DRIFT — spec-update plan 으로 planner 위임(PR1 패턴 동형). email dispatch 는 best-effort(warn only, no retry, 실패 시 email_sent_at NULL) — spec §3/Rationale 정합.
