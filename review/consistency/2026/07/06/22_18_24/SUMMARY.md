# Consistency Check 통합 보고서 (--impl-done, scope=spec/data-flow/)

**BLOCK: NO** — Critical 발견 없음.

## 전체 위험도
**LOW** — `team_invite` 채널 `both`→`in_app` 정정은 enum·인접 spec 과 정합. 유일한 흠은 auth spec
절 번호 인용 오류(§1.5.2 → §1.5.3) 로, INFO 수준이며 본 마무리에서 정정 완료.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

없음. (1차 실행 시 rationale_continuity / convention_compliance / plan_coherence 3개 checker 의
output_file 미생성 → 재실행으로 해소, 하단 "후속" 참조.)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 처분 |
|---|---------|------|------|------|
| 1 | cross_spec | `team_invite` Rationale 이 인용한 auth spec 절 번호가 어긋남 — 기존 가입자 accept 흐름은 §1.5.3("이미 가입한 사용자가 다른 워크스페이스에 초대된 경우")인데 §1.5.2("미가입자 가입 경로")로 인용 | `spec/data-flow/8-notifications.md` §Rationale "team_invite 채널 — 이메일 중복 회피" | **정정 완료** — 인용을 §1.5.3 으로 교체 + 흐름 설명 병기 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `team_invite` 채널 `both`→`in_app` 정정은 enum·다른 spec과 정합. auth spec 절 번호 인용 오류(§1.5.2→§1.5.3) INFO — 정정 완료 |
| naming_collision | NONE | 신규 식별자 미도입. 신규 heading 은 다른 문서에서 앵커로 정확히 역참조되어 충돌 없음 |
| rationale_continuity | 재실행 완료 (하단) | — |
| convention_compliance | 재실행 완료 (하단) | — |
| plan_coherence | 재실행 완료 (하단) | — |

## 권장 조치사항
1. (완료) `spec/data-flow/8-notifications.md` auth 인용 §1.5.2 → §1.5.3 정정.
2. rationale_continuity / convention_compliance / plan_coherence 재실행 (1차 output 파일 부재) — 하단 결과.

---

## 후속 (3개 유실 checker 재실행 결과) — 최종 판정

3개 누락 checker 재실행 완료. **5개 checker 전부 완료, Critical 0건 → 최종 BLOCK: NO.**

| Checker | 재실행 STATUS | Critical | 비고 |
|---------|--------------|----------|------|
| cross_spec | (1차) LOW | 0 | auth 인용 §1.5.2→§1.5.3 INFO — 정정 완료 |
| naming_collision | (1차) NONE | 0 | — |
| rationale_continuity | highest=NONE | 0 | 발견 INFO 1건은 무관 파일(`11-workflow.md §3.3` cross-ref) — 본 변경과 무관 |
| convention_compliance | highest=LOW | 0 | LOW/INFO 만 |
| plan_coherence | highest=LOW | 0 | LOW/INFO 만 |

**최종: spec-impl 정합 Critical 0 → push gate(Gate 2) 충족.** 유일한 본-변경 관련 INFO(auth 인용 절 번호)는
`spec/data-flow/8-notifications.md` Rationale 에서 §1.5.3 으로 정정 완료. 나머지 LOW/INFO 는 본 team_invite
변경과 무관한 기존 문서 cross-ref 이라 별도 grooming 이월.
