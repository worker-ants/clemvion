# Plan 정합성 검토 — spec-draft-review-citations-class-jsdoc.md

## 발견사항

- **[WARNING]** 짝 규약 `swagger.md §3` 의 동일한 과잉 일반화가 함께 정정되지 않음
  - target 위치: `spec/conventions/review-citations.md` §3 표 신설 두 번째 행 + `## Rationale` 신설 절, 그리고 draft 의 "구현 위임" 섹션
  - 관련 plan: `plan/in-progress/spec-draft-review-citations-class-jsdoc.md` 자체의 "구현 위임 (developer, 같은 PR)" 항목 — 가드 spec 머리 주석만 언급하고 `swagger.md` 는 언급하지 않음
  - 상세: draft 의 실측(2026-09-27, `codebase/backend/dist`)은 *"JSDoc 은 공개 OpenAPI `description` 으로 나간다"* 가 **클래스에는 맞지 않는다**는 것을 확인했다. 그런데 이 문장은 review-citations.md 뿐 아니라 `swagger.md §3` (*"플러그인이 `introspectComments` 로 JSDoc 을 `description` 에 그대로 싣는다... 즉 DTO 의 `/** ... */` 는 API 소비자가 읽는 문장이다"*)에도 **필드/클래스 구분 없이** 똑같이 적혀 있다. review-citations.md 는 이 문장을 두 번 인용한다 — 신설 §3 표 행("[`swagger.md` §3](./swagger.md) 이 정한 대로")과 가드 spec 머리 주석(`dto-jsdoc-citation.spec.ts` 상단, `swagger.md §3` 를 직접 인용)에서. draft 는 review-citations.md 와 가드 spec 머리 주석의 정정은 지시하지만, 두 문서가 함께 인용하는 원 진술의 근원인 `swagger.md §3` 자체는 손대지 않는다. `swagger.md` 는 CLAUDE.md 규약 언어로 "문서한 보장이 구현보다 넓으면 안 된다"는 원칙에 해당하는 자리를 정정 없이 남기게 된다.
  - 제안: 이 draft 의 spec_impact 에 `spec/conventions/swagger.md` 를 추가하거나, "구현 위임" 절에 swagger.md §3 의 해당 문장에도 같은 필드/클래스 구분 각주를 넣도록 developer 몫을 명시할 것.

- **[WARNING]** 선행 tracker 체크리스트 항목을 닫는 절차가 위임에 빠짐
  - target 위치: draft "구현 위임 (developer, 같은 PR)" 절
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `- [ ] **Ref DTO **클래스** JSDoc 두 곳에 리뷰 인용이 남아 있다**` 항목 (약 1277행)
  - 상세: 이 draft 는 바로 그 tracker 항목이 "고치기 전에 그 문장부터 갈라야 한다"고 남긴 선행 질문에 대한 답이다 (§3 표를 필드/클래스로 가른다). 정합성 자체는 문제 없다 — 결정이 올바르게 그 질문에 답한다. 그런데 draft 의 "구현 위임" 절은 `EXPECTED_DTO_JSDOC_CITATIONS` 를 비우고 가드 머리 주석을 고치라고만 지시할 뿐, 원 tracker 의 해당 체크박스를 `- [x]` 로 닫고(또는 이동하고) 참조를 남기라는 지시가 없다. 체크박스는 실제 완료 후에만 체크해야 하므로(프로젝트 관례) 지금 미리 체크하면 안 되지만, "같은 PR" 구현 완료 시점에 누가 그 tracker 항목을 닫을지가 위임문에 없어 developer 가 놓치기 쉽다.
  - 제안: "구현 위임" 절에 "완료 후 `spec-draft-nullable-notation-followups.md` 의 해당 체크박스를 닫고 이 결정(`plan/in-progress/spec-draft-review-citations-class-jsdoc.md`)을 참조로 남긴다" 문구를 추가.

## 요약

target draft 는 `spec-draft-nullable-notation-followups.md` 가 명시적으로 planner 몫으로 남겨 둔 선행 질문("클래스 JSDoc 도 대상인가")에 정확히 답하고 있고, 이 질문과 충돌하는 다른 미해결 결정이나 선행 plan 은 발견되지 않았다(관련 클래스·규약을 참조하는 plan/in-progress 문서는 그 tracker 하나뿐). 다만 draft 자신의 실측이 반증한 "JSDoc → 공개 OpenAPI description" 이라는 진술이 `swagger.md §3` 에도 동일하게 남아 있는데 이를 갱신 대상에서 빠뜨렸고, 구현 위임 절이 원 tracker 체크리스트를 닫는 절차를 명시하지 않아 완료 후 후속 정리가 누락될 위험이 있다. 두 건 모두 CRITICAL 수준의 충돌은 아니며 target/구현 위임 절의 범위를 조금 넓히면 해소된다.

## 위험도
LOW
