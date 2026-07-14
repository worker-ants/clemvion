# Consistency SUMMARY (--impl-done) — @nestjs/swagger 핀 제거 + deep-import 교체

- 모드: `--impl-done` · scope=`spec/5-system/14-external-interaction-api.md` (+ diff 로 `spec/conventions/swagger.md` 커버) · diff-base=origin/main
- 대상 커밋: `3f1df0dcd` (§2)
- checker 5종: cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision

## BLOCK: NO

| checker | 위험도 | 요지 |
|---|---|---|
| cross_spec | NONE | external-interaction spec 의 data-model/API-contract drift 없음 — type-source-only 변경, DTO 스키마 출력 불변 |
| rationale_continuity | NONE | swagger 11.2.7 핀은 spec `## Rationale` 가 아닌 plan §2 에만 추적됐고 명시된 완료조건("교체 후 핀 제거")을 정확히 이행 — 기각 대안 재도입·합의 위반 없음 |
| convention_compliance | NONE (1 INFO) | `spec/conventions/swagger.md` 는 내부 import 출처를 규율하지 않음 — 위반 아님. 헬퍼 이름·시그니처·반환 스키마 shape 불변(§5/§6 보존). INFO: deep-import 회피 원칙 문서화는 선택(JSDoc 이미 존재) |
| plan_coherence | LOW (1 INFO) | plan §2 완료조건과 정합. INFO: 본문에 완료 주석 미반영 → 갱신함(2026-07-14 완료 블록 추가) |
| naming_collision | NONE | 파일-로컬 `type SchemaObject` alias 는 공개 식별자 shadow 없음 |

**Critical 0 → 차단 없음.** spec 연결 코드 변경(external-interaction DTO spec 2곳 + common/swagger)이 spec 본문·conventions·Rationale·plan 어느 것과도 충돌하지 않음. 유일한 실질 조치(plan §2 완료 주석)는 반영 완료.
