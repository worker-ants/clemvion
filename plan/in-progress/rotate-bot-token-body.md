---
title: OpenAPI 가 요청 본문을 모르는 라우트 3곳 — rotate-bot-token · execution continue · webhook 에 `@ApiBody`(런타임 불변)
status: in-progress
owner: developer
worktree: rotate-bot-token-body
spec_impact: none
started: 2026-09-26
---

# 요청 본문 스키마가 없는 라우트

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «`rotate-bot-token` 엔드포인트에 OpenAPI 데코레이터가 전무하다» 를
닫는다. 등재(2026-09-11) 뒤 **응답 DTO**(`ChatChannelRotateBotTokenDto`, #1326)와 **에러 데코레이터**(400 · 502 · 404, #1324)는 이미
붙었다 — 남은 것은 **요청 본문**이다.

## 실측 (2026-09-26, `src/**/*.controller.ts` 의 `@Body()` 파라미터 78개, AST)

DTO 클래스가 아닌 것 4개:

| 자리 | 타입 | `@ApiBody` | 처분 |
| --- | --- | --- | --- |
| `triggers` `rotateBotToken` | `{ newBotToken?: string }` | 없음 | 문서 전용 DTO `ChatChannelRotateBotTokenRequestDto` + `@ApiBody` |
| `executions` `continueExecution` | `{ formData?: unknown }` | 없음 | 문서 전용 DTO `ContinueExecutionRequestDto` + `@ApiBody({ required: false })` |
| `hooks` `receiveWebhook` | `unknown` | 없음 | `@ApiBody({ required: false, schema })` — 형태는 외부 발신자가 정한다(임의 JSON) |
| `workflows` `execute` | 인라인 객체 | **있음** | 없음 — 이 PR 이 따르는 선례 |

→ OpenAPI 에 `requestBody` 가 없는 라우트 **3**.

## 방향 — 문서만, 런타임은 한 줄도 바꾸지 않는다

`@Body()` 파라미터 타입을 DTO 로 **바꾸지 않는다**. 전역 `CustomValidationPipe` 는 metatype 이 `Object` 면 검증을 건너뛰는데, 클래스로
타입하는 순간 `whitelist` · `forbidNonWhitelisted` 가 켜진다:

- `rotateBotToken` — spec `15-chat-channel.md` §5.4 는 `newBotToken` 누락 · 비-string 을 **`INVALID_BOT_TOKEN`** 으로 적는다(핸들러가
  직접 검사). 클래스로 타입하면 비-string 이 파이프의 `VALIDATION_ERROR` 가 되고(데코레이터를 달면), 데코레이터가 없으면 **모든 요청**이
  거부된다 — 어느 쪽이든 계약 변경이다.
- 세 자리 모두 지금은 여분 키가 조용히 통과한다 — 클래스로 타입하면 400 이 된다.

그래서 `workflows.execute` 선례(`ExecuteWorkflowDto` — «OpenAPI 스키마 전용», 캐너리 `workflows-execute-body.spec.ts`)를 그대로 따른다:
문서 전용 DTO 는 class-validator 데코레이터 **없이** `@ApiBody({ type })` 로만 쓰고, 파라미터는 인라인 타입을 유지한다. 모듈마다 캐너리 —
① `@Body()` 자리의 `design:paramtypes` 가 `Object` 다(DTO 로 타입되지 않았다) ② `@ApiBody` 가 맞는 DTO 를 가리킨다 ③ 렌더된 스키마.

CHANGELOG — OpenAPI 가 세 엔드포인트의 요청 본문 스키마를 광고한다(항목 1, 응답은 그대로).

## 안 하는 것

- **본문 검증을 파이프로 옮기기** — 위 계약 변경이다. 필요하면 별도 결정(planner).
- **전역 가드**(«`@Body()` 가 클래스가 아니면 `@ApiBody` 필수») — 이 PR 뒤 0곳이지만 `swagger.md` 에 요청 본문 규칙이 없다(§1-7 은 이름만).
  가드를 세우려면 규칙 문단부터 planner 턴이다. 트래커 등재.

## 체크리스트

- [ ] `--impl-prep`
- [ ] 문서 전용 DTO 둘 · `@ApiBody` 셋
- [ ] 캐너리(모듈별) · 뮤턴트
- [ ] CHANGELOG
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 항목 닫기 · 전역 가드 후속 등재
