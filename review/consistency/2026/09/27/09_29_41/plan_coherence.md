# Plan 정합성 검토 — `spec/conventions/` (review-citations.md · swagger.md)

## 검토 범위

- target: `spec/conventions/review-citations.md` §3(응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다), `spec/conventions/swagger.md` §3(프로퍼티 JSDoc 한정)
- 구현 diff: `schedule-response.dto.ts` · `trigger-response.dto.ts`(클래스 JSDoc 인용 → `//`) · `dto-jsdoc-citation-guard.ts` · `dto-jsdoc-citation.spec.ts`(`EXPECTED_DTO_JSDOC_CITATIONS` → `[]`)
- 관련 plan: `plan/in-progress/dto-class-jsdoc-citation.md`(developer), `plan/in-progress/spec-draft-review-citations-class-jsdoc.md`(planner draft), `plan/in-progress/spec-draft-nullable-notation-followups.md`(선행 트래커)

## 발견사항

- **[INFO]** 선행 트래커 항목이 아직 `[ ]` — 이번 target 이 그 항목을 해소한다
  - target 위치: `spec/conventions/review-citations.md` §3 표 + Rationale `### §3 — 응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다 (2026-09-27)`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:1277` `- [ ] **\`Ref\` DTO **클래스** JSDoc 두 곳에 리뷰 인용이 남아 있다**`
  - 상세: 이 트래커 항목이 명시적으로 남겨둔 선행 질문(*"클래스 JSDoc 도 대상인가를 §3 표가 명시하지 않는다 — planner 몫"*)을 `spec-draft-review-citations-class-jsdoc.md` 가 같은 PR 에서 (B) 로 확정했고, developer 구현(diff 확인 — 두 클래스 JSDoc 인용을 `//` 로 이동, `EXPECTED_DTO_JSDOC_CITATIONS` 를 `[]` 로 비움, `dto-jsdoc-citation.spec.ts` 헤더 주석에서 트래커 참조 pointer 도 제거됨)이 실제로 반영했다. 다만 트래커 원본 항목은 아직 미해소(`[ ]`) 상태로 남아 있다. **결정 충돌은 아니다** — `dto-class-jsdoc-citation.md` 자신의 체크리스트가 "트래커 항목 닫기 · planner draft 이동" 을 마지막 미완료 단계(`--impl-done` 통과 후)로 이미 예정해 두었으므로, 지금 시점의 미해소는 작업 순서상 정상이다.
  - 제안: 이번 `--impl-done` 통과 후 마무리 커밋에서 `spec-draft-nullable-notation-followups.md:1277` 항목을 체크·요약하고, `dto-class-jsdoc-citation.md` + `spec-draft-review-citations-class-jsdoc.md` 두 plan 을 `plan/complete/` 로 이동할 것(이미 자체 체크리스트에 예정된 대로).

## 정합성 분석 요약

1. **미해결 결정과의 충돌** — 없음. target 이 내린 결정(B: 응답 DTO 클래스 JSDoc 도 필드와 같이 인용을 쓰지 않는다)은 `spec-draft-nullable-notation-followups.md` 가 "결정 필요" 로 남겨둔 바로 그 질문(*"클래스 JSDoc 도 대상인가"*)에 대한 답이며, 그 질문을 낸 트래커 항목 자신이 이 PR 의 developer 몫으로 위임한 사안이다. 다른 in-progress plan 에서 같은 질문에 대해 반대 결정(A: 클래스 JSDoc 허용)을 전제하는 항목은 grep 상 없음.
2. **선행 plan 미해소** — 없음. target 이 가정하는 선행 조건(§3 표가 필드/클래스를 가른다는 결정)은 같은 브랜치·같은 PR 내에서 planner turn(`spec-draft-review-citations-class-jsdoc.md`, spec 커밋 `c8bf27c8e`)이 먼저 확정했고, developer 구현이 그 결정을 뒤따랐다. 외부 plan 에 대한 미해소 의존성은 발견되지 않음.
3. **후속 항목 누락** — 위 INFO 항목 외에 추가 발견 없음. `review-citations.md`/`swagger.md` 를 참조하는 다른 in-progress plan(`spec-draft-nullable-notation-followups.md` 의 numeric·JSDoc/`//` 분리 등 기존 완료 항목들)은 이번 편집 범위(§3 DTO 행 분리)와 겹치지 않으며 무효화되지 않음.

## 요약

target(`review-citations.md` §3, `swagger.md` §3)의 결정은 `spec-draft-nullable-notation-followups.md` 가 명시적으로 "planner 몫" 이라 남겨둔 선행 질문에 대한 정식 답변이고, 그 답변과 구현(guard·DTO 편집)이 같은 브랜치 안에서 일관되게 이어진다. 유일하게 남은 것은 그 선행 트래커 항목의 체크박스 미갱신인데, 이는 `dto-class-jsdoc-citation.md` 자신의 체크리스트가 이번 `--impl-done` 통과 후 마무리 단계로 이미 예정해 둔 정상적인 순서이며 별도의 plan 불일치가 아니다. 다른 in-progress plan 과의 결정 충돌·선행조건 미해소·후속 항목 무효화는 발견되지 않았다.

## 위험도

NONE
