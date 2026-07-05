# Consistency SUMMARY — impl-done spec/5-system/ (18_37_10)

모드: `--impl-done` — V-14 rerun 모달 typed 폼 + ID 링크 사후 정합. (cross_spec·rationale·convention·naming 은 impl-prep payload 오배선 이력 때문에 명시 diff 컨텍스트로 실행.)

## BLOCK: NO

Critical 0. Warning 2(cross_spec new-tab UX·naming 타입 중복, 둘 다 선존/후속) + INFO. spec 무변경(§10.2 이미 명시).

## Checker 결과

| Checker | 위험도 | 판정 |
|---|---|---|
| cross_spec | LOW | WARNING: §10.2 모달 new-tab vs §3.7 chain badge same-tab(다른 UI 요소·선존). 스키마 계약·coerce 정합·re-run API shape·라우팅·RBAC 무관 확인 |
| rationale_continuity | NONE | §10.2 verbatim·RR-PL-01~07 무충돌·config/output 직교 유지. INFO: fallback 문서화(planner) |
| convention_compliance | NONE | TriggerParameterDefinition=0-common §1 일치·i18n 준수·RERUN_* 재사용. INFO: raw `<a>` |
| plan_coherence | NONE | V-14 체크박스·잔여목록 정확 |
| naming_collision | LOW | WARNING: `TriggerParameterDefinition`(canonical 이름) vs editor `TriggerParameter`(동일 shape) 중복 — 후속 통합 |

## 조치

cross_spec/rationale spec-doc(§10.2 fallback·new-tab UX 구분)·naming 타입 통합은 후속 이관. CRITICAL 정합 위배 없음 → BLOCK: NO.
