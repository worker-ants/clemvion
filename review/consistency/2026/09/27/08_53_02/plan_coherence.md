# Plan 정합성 검토 — `spec/conventions/review-citations.md` · `spec/conventions/swagger.md`

## 검토 범위 요약

target 은 이미 커밋된 `c8bf27c8e`(§3 DTO 행을 필드/클래스로 가르고 클래스 JSDoc 도 인용 대상 아님으로 확정) 시점의
`spec/conventions/review-citations.md`·`swagger.md` 전문이다. 관련 `plan/in-progress/**` 를 전수 대조했다.

- `plan/in-progress/spec-draft-review-citations-class-jsdoc.md` (owner: planner, status: in-progress) — 이 결정 자체의
  draft. 내용이 커밋된 target 과 **정확히 일치**한다(§3 표 두 행 분리, Rationale 신설 절, `swagger.md` 문단 필드 한정 모두 반영).
- `plan/in-progress/dto-class-jsdoc-citation.md` (owner: developer, status: in-progress) — 위 결정을 실제 코드
  (`TriggerWorkflowRefDto`·`ScheduleTriggerWorkflowRefDto` 클래스 JSDoc, `EXPECTED_DTO_JSDOC_CITATIONS`, 가드 주석,
  CHANGELOG)에 반영하는 후속 plan. 체크리스트는 planner 턴(1번)만 체크돼 있고 2~8번(실제 편집·뮤턴트 실측·리뷰·`--impl-done`·
  트래커 종결)은 미체크 — **실측**: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts` 의
  `EXPECTED_DTO_JSDOC_CITATIONS` 는 여전히 두 항목을 담고 있어(비어 있지 않음) 체크리스트 상태와 코드 상태가 일치한다 —
  아직 구현 착수 전이라는 뜻이고, 이번 `--impl-prep` 검토가 그 착수 직전 게이트다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` L1277 트래커 항목(«`Ref` DTO 클래스 JSDoc 두 곳에 리뷰
  인용이 남아 있다», developer 2026-09-06 등재)이 이 두 plan 의 상위 출처다. 항목은 아직 `[ ]`(미체크) 이고, 두 하위 plan
  모두 "완료 후 이 항목을 닫는다" 는 절차를 명시하고 있어(`spec-draft-review-citations-class-jsdoc.md` "구현 위임" 절,
  `dto-class-jsdoc-citation.md` 체크리스트 5번) 트래커 종결 책임이 누락되지 않았다.

이전 라운드(`review/consistency/2026/09/27/08_41_33`)의 plan_coherence 가 지적한 두 WARNING(swagger.md §3 미동기화,
draft 자체 Rationale 부재, 트래커 종결 주체 불명)은 모두 커밋 `c8bf27c8e` 에 반영되어 해소됐다(커밋 메시지가 W1/W2/W3 대응을
명시).

## 발견사항

없음 — target 이 plan 에서 "결정 필요" 로 남긴 항목(클래스 JSDoc 도 대상인가)에 정확히 답했고, 그 결정과 충돌하는 다른
미해결 결정·plan 은 발견되지 않았다. target 이 가정하는 선행 조건(가드가 이미 클래스·프로퍼티 JSDoc 을 함께 센다는 것,
두 DTO 가 `EXPECTED_DTO_JSDOC_CITATIONS` 로 동결돼 있다는 것)은 이미 코드에 존재해 미해소 상태가 아니다. 이 spec 변경이
무효화하거나 새로 요구하는 다른 plan 의 후속 항목도 없다 — 유일한 후속 실행 계획(`dto-class-jsdoc-citation.md`)이 이미
정확한 편집 지시·체크리스트·뮤턴트 표를 담고 있고, 트래커 종결 절차도 명시돼 있다.

## 요약

target(`review-citations.md`·`swagger.md` 의 클래스 JSDoc 관련 절)은 같은 PR 의 planner 턴이 산출해 이미 커밋된
결정이며, 그 결정이 유래한 상위 트래커 항목·후속 developer 실행 plan 과 완전히 정합한다. 이전 라운드가 잡은 두 WARNING
(짝 규약 미동기화, draft Rationale 부재)은 후속 커밋에서 해소됐고, 이번 라운드에서 새로 발견된 충돌·미해소 선행조건·
누락된 후속 항목은 없다. 유일하게 남은 것은 developer 실행(코드 편집·가드 목록 비우기·CHANGELOG·트래커 종결)이 아직
시작 전이라는 사실이며, 이는 plan 자체의 체크리스트가 정확히 반영하고 있어 정합성 결함이 아니라 정상적인 진행 상태다.

## 위험도
NONE
