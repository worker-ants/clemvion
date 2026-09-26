---
title: 요청 본문 스키마 가드 — `@Body()` 설계 타입이 클래스가 아니면 `@ApiBody` 필수 (swagger §5-4 규칙 + reflection 가드)
status: in-progress
owner: developer
worktree: request-body-guard
spec_impact:
  - spec/conventions/swagger.md
started: 2026-09-26
---

# 요청 본문 스키마 가드

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «요청 본문 스키마의 규칙과 가드» 의 1(규칙) · 2(가드)와 3 의
헬퍼 JSDoc 문구를 닫는다. 3 의 DTO 어순 리네임과 1 의 §1-7 명명 행은 **남긴다** — 기존 이름(`ExecuteWorkflowDto` · `ReRunRequestDto` 등)을
어떻게 다룰지 정하는 별 결정이라 가드와 섞지 않는다(트래커 항목을 그 둘로 좁힌다).

## 실측 (2026-09-26, `src/modules` 컨트롤러의 `@Body()` 78개)

`rotate-bot-token-body`(#1408) 뒤: DTO 클래스 74 · 인라인 타입 4(`rotateBotToken` · `continueExecution` · `receiveWebhook` · `execute`) —
인라인 넷은 전부 `@ApiBody` 를 갖는다. → 가드 베이스라인 **0**.

## 방향

- **규칙(planner)** — `swagger.md` §5-4 체크리스트에 «요청 본문을 받는 라우트는 본문 스키마를 광고한다» 한 줄: 클래스로 받거나, 받을 수
  없으면 문서 전용 DTO 를 `@ApiBody` 로. frontmatter `code:` 에 가드 등재. Rationale 한 절. planner draft → `--spec`.
- **가드(developer)** — `src/repo-guards/__tests__/request-body-advertised{-guard,}.ts`. 판정은 **reflection**: 라우트 인자 메타데이터로
  `@Body()` 자리를 찾고 `design:paramtypes` 의 그 자리가 전역 `CustomValidationPipe` 의 비검증 목록(`Object` · `String` · `Number` ·
  `Boolean` · `Array` · 없음)이면 그 핸들러에 `@ApiBody`(swagger `apiParameters` 의 `in: 'body'`)가 있어야 한다. `@ApiExcludeEndpoint()`
  · `@ApiExcludeController()` 는 묻지 않는다. 컨트롤러 적재 · 라우트 순회는 형제 가드 `forbidden-response-codes-guard.ts` 의 함수를 쓴다.
  - **왜 AST 가 아닌가**: `interface` · 타입 별칭 참조는 런타임에 `Object` 가 된다 — AST 로는 클래스 참조와 구별되지 않는다. 판정 축은
    파이프가 받는 바로 그 값(`design:paramtypes`)이어야 한다.
  - 대조군은 spec 안의 클래스(인라인 무광고 · 인라인 + `@ApiBody` · DTO 클래스 · 인터페이스 타입 · 제외 라우트 · `@Body()` 없는 라우트).
- 곁가지: `shared/testing/swagger-probe.ts` `bodyParamDesignType` JSDoc 의 «Nest 메이저 업그레이드» → «마이너 · 패치 포함»(`18_17_12` INFO4).
- CHANGELOG — 항목 3(가드 신설).

## 체크리스트

- [ ] spec draft `--spec` · 반영(planner)
- [ ] `--impl-prep`
- [ ] 가드 · 대조군 · 곁가지 — RED 확인(인라인 무광고 대조군)
- [ ] 뮤턴트
- [ ] CHANGELOG
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 항목 좁히기(남는 §1-7 · 리네임) · 닫힌 부분 기록
