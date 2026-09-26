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

- [x] spec draft `--spec` · 반영(planner) — `review/consistency/2026/09/26/18_59_58` BLOCK: NO(W1 제외 범위 · INFO4 반영) · planner 커밋 `f71f5df06`
- [x] `--impl-prep` — `review/consistency/2026/09/26/19_09_17` BLOCK: NO(Warning 0). INFO: 트래커 «AST» → «reflection» 정정 · draft 이동(마무리 커밋) · `15-chat-channel.md` §7 파일 트리에 #1408 의 요청 DTO 누락 · §5-4 제목 «새 엔드포인트» 와 소급 항목의 괴리(셋째) — 뒤 둘은 planner 몫이라 남는 트래커 항목에
- [x] 가드 · 대조군 · 곁가지 — `1c19eebc7`. 실측(`src/modules`): 컨트롤러 35 · `@Body()` 자리 78 · 비클래스 4(전부 `@ApiBody`) · 위반 0.
      대조군은 위반을 정확히 넷 잡는다(인라인 · 인터페이스 · `unknown` · 키 지정 `String`). RED 는 실제 코드에서 `@ApiBody` 를 빼는 뮤턴트 G8 이 보인다
- [x] 뮤턴트 — 8/8 예측대로(G3 은 처음에 예측대로 SURVIVED → 대조군을 더해 KILLED)

  | # | 뮤턴트 | 예측 / 실측 | 죽인 케이스 |
  | --- | --- | --- | --- |
  | G1 | `@ApiBody` 를 못 봄 | KILLED / KILLED | 본 판정 · 대조군 둘 |
  | G2 | 비클래스 판정이 늘 거짓 | KILLED / KILLED | floor(`unschematized > 0`) · 대조군 둘 |
  | G3 | 설계 타입 없음(`undefined`) 항 제거 | SURVIVED / SURVIVED → 대조군 추가(`866678c8f`) 뒤 KILLED / KILLED | 새 대조군(emit 되지 않은 자리) |
  | G4 | `@ApiExcludeEndpoint` 도 묻는다 | KILLED / KILLED | 대조군 셋 |
  | G5 | `@ApiExcludeController` 도 묻는다 | KILLED / KILLED | 대조군 셋 |
  | G6 | 본문 자리 대신 쿼리 자리 | KILLED / KILLED | 헬퍼 테스트 · floor · 본 판정 · 대조군 |
  | G7 | 파이프 목록에서 `Object` 제거 | KILLED / KILLED | floor · 대조군 둘 — 파이프와 가드가 같은 상수를 쓴다 |
  | G8 | `rotateBotToken` 의 `@ApiBody` 제거(실제 코드) | KILLED / KILLED | 본 판정 |
- [x] CHANGELOG — 항목 3(가드 신설)
- [x] TEST WORKFLOW (lint · unit · build · e2e) — 전부 PASS(e2e 412)
- [x] `/ai-review` — 1R `review/code/2026/09/26/19_32_47`(Critical 0 · Warning 2 → `8bc7e8f19`, 커버리지 뮤턴트 R1~R6 KILLED) · 2R 전수 14명
      `review/code/2026/09/26/19_54_03`: Critical 0 · Warning 1(파이프 spec 의 자기참조 순회 — 목록 축소는 가드 spec 이 이미 잡는다) → 수렴
      예외 + 트래커. 2R codebase 수정 0건으로 정지 규칙 충족
- [ ] `--impl-done`
- [ ] 트래커 항목 좁히기(남는 §1-7 · 리네임) · 닫힌 부분 기록
