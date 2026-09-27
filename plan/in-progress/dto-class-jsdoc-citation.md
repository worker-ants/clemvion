---
title: "응답 DTO 클래스 JSDoc 두 곳의 리뷰 인용을 `//` 로 옮기고 가드 동결 목록을 비운다"
status: in-progress
owner: developer
worktree: dto-class-jsdoc-citation
spec_impact: none
started: 2026-09-27
---

# 응답 DTO 클래스 JSDoc 인용 정리

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «`Ref` DTO **클래스** JSDoc 두 곳에 리뷰 인용이 남아 있다»
를 닫는다. 선행 질문(클래스 JSDoc 도 대상인가)은 같은 PR 의 planner 턴이 정했다 — `spec-draft-review-citations-class-jsdoc.md`,
spec 커밋 `c8bf27c8e`: **필드와 같이 쓰지 않는다**(`review-citations.md` §3 · Rationale 새 절).

## 실측 (2026-09-27)

- 동결된 두 자리(`dto-jsdoc-citation.spec.ts` `EXPECTED_DTO_JSDOC_CITATIONS`):
  - `modules/triggers/dto/responses/trigger-response.dto.ts#TriggerWorkflowRefDto` — 클래스 JSDoc 끝의 `review/consistency/2026/09/06/00_48_52` W2
  - `modules/schedules/dto/responses/schedule-response.dto.ts#ScheduleTriggerWorkflowRefDto` — 같은 인용
  - 두 클래스 모두 바로 위에 `//` 블록이 이미 있다(«왜 좁혔나» 서사) → 인용을 그 블록으로 옮기면 된다.
- 두 클래스 JSDoc 은 **지금 OpenAPI 로 나가지 않는다**(플러그인이 클래스 JSDoc 을 싣지 않음 — spec draft 실측). 그러니 이 편집은
  OpenAPI 산출물을 바꾸지 않는다.
- 같은 틀린 근거가 가드 코드에 두 곳 있다:
  - `dto-jsdoc-citation.spec.ts` 머리 주석 — *"DTO 의 JSDoc 은 `introspectComments` 로 공개 OpenAPI `description` 이 된다"*
  - `dto-jsdoc-citation-guard.ts` — *"둘 다 OpenAPI 로 나간다(클래스는 스키마 description, 프로퍼티는 필드 description)"*
- spec 연결: 가드 파일은 `review-citations.md` 의 `code:` 가 소유한다. 두 DTO 는 각 화면 spec(`2-navigation`)의 `code:` 가 소유하지만
  바뀌는 것은 주석뿐이다. → `spec_impact: none`(spec 변경은 같은 PR 의 planner draft 가 담는다).

## 방향

1. 두 클래스 JSDoc 끝의 인용을 빼고, 바로 위 `//` 블록에 «자매 참조 타입과 담는 필드가 다른 것은 의도다 — 인용» 한 줄을 둔다.
   JSDoc 의 나머지 문장(자매 타입과의 차이 · 갈아 끼우지 말 것)은 그대로 둔다 — 규칙이 막는 것은 인용이다.
2. `EXPECTED_DTO_JSDOC_CITATIONS` → `[]`. 목록 상수와 «정확히 일치» 단언은 남긴다 — 새 인용이 생기면 목록에 없어 실패한다.
3. 가드 주석 두 곳의 근거를 필드/클래스로 갈라 바로잡고(`review-citations.md` §3 링크), spec 머리 주석의 «베이스라인이 0이 아니다»
   절을 «베이스라인 0» 으로 고친다.
4. CHANGELOG — 항목 3(가드): 응답 DTO JSDoc 리뷰 인용 가드의 동결 목록이 비었다(예외 0).
5. 트래커 항목 닫기 + planner draft 를 `plan/complete/` 로(마무리 커밋).

## 뮤턴트 (예측 — 실측은 구현 뒤 채운다)

| # | 뮤턴트 | 예측 | 실측 · 죽인 케이스 |
|---|---|---|---|
| M1 | `TriggerWorkflowRefDto` 클래스 JSDoc 에 인용을 되돌림 | 래칫 «정확히 일치» RED | |
| M2 | 인용을 **필드** JSDoc(`TriggerWorkflowRefDto.id`)에 넣음 | 래칫 RED | |
| M3 | 가드가 클래스 JSDoc 을 보지 않게 함(클래스 검사 분기 제거) | 대조군 fixture 단언 RED(`ViolationClassCitationDto`) | |

## 체크리스트

- [x] planner — draft · `--spec` `review/consistency/2026/09/27/08_41_33` BLOCK: NO · spec 적용(`c8bf27c8e`)
- [x] `--impl-prep` — `review/consistency/2026/09/27/08_53_02` BLOCK: NO · Warning 0. INFO 2건(`review-citations.md` §3 콜아웃에
      순방향 포인터 · `swagger.md` §3 제목 날짜 병기)은 spec 문구 제안이라 developer 가 손대지 않는다 — 앞의 것은 planner 턴이 추가한
      Rationale 새 절이 이미 «쓰인 시점에 맞았다 · 다음 날 반증» 을 적는다.
- [x] 두 DTO · 가드 목록 · 가드 주석 · CHANGELOG
- [ ] 뮤턴트 표 실측
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 항목 닫기 · planner draft 이동
