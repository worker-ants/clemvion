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

## 검토 경고 처리

| 출처 | 지적 | 처분 |
| --- | --- | --- |
| `--impl-prep` `17_20_45` W1 | `newBotToken` 을 선례처럼 선택으로 적으면 안 된다 — 핸들러가 누락을 400 으로 거부 | `@ApiProperty`(필수). JSDoc 에 «없거나 문자열이 아니면 400 `INVALID_BOT_TOKEN`» |
| `--impl-prep` `17_20_45` W2 | secret store 입력 plaintext 는 `writeOnly: true` 의무(`swagger.md` §1-5 — 예시가 바로 `botToken`) | `@ApiProperty({ writeOnly: true })` + 렌더 캐너리가 `writeOnly` 를 단언 |
| `--impl-prep` `17_20_45` W3 · W5 | 파일명이 `15-chat-channel.md` `code:` glob(`dto/**/chat-channel-*.dto.ts`)에 들어야 하고, 응답 DTO(`…-response.dto.ts`)와 대칭이면 좋다 | `dto/chat-channel-rotate-bot-token-request.dto.ts` |
| `--impl-prep` `17_20_45` W4 | 선례 `ExecuteWorkflowDto` 의 class JSDoc 은 설계 서사를 담아 공개 OpenAPI 로 나간다(`swagger.md` §3) — 복제하지 말 것 | 새 DTO 두 개는 설계 서사를 `//` 주석에, JSDoc 에는 소비자 설명만 |
| `--impl-prep` `17_20_45` INFO2 · INFO4 · INFO5 | `*RequestDto` 접미가 §1-7 에 없다 · 트래커 처방 문구(«요청 DTO 승격»)와 채택안이 다르다 · 전역 가드 후속 등재 | 트래커 종결 노트에 채택안과 이유를, 전역 가드 후속 항목에 §1-7 접미 행을 함께 |

## 체크리스트

- [x] `--impl-prep` — `review/consistency/2026/09/26/17_20_45` BLOCK: NO(Warning 5 — 위 표)
- [x] 문서 전용 DTO 둘 · `@ApiBody` 셋 — `bb1ff4d8f`
- [x] 캐너리(모듈별) · 뮤턴트 — 6/6 예측대로 KILLED

  | # | 뮤턴트 | 예측 / 실측 | 죽인 케이스 |
  | --- | --- | --- | --- |
  | M1 | `rotateBotToken` 본문을 DTO 로 타입 | KILLED / KILLED | 캐너리 둘(설계 타입 `Object` · 비-string · 여분 키가 파이프 통과) |
  | M2 | `newBotToken` 의 `writeOnly` 제거 | KILLED / KILLED | 렌더(`writeOnly`) |
  | M3 | `@ApiBody` 가 형제 응답 DTO 를 가리킴 | KILLED / KILLED | 가드(`@ApiBody` 대상) |
  | M4 | continue 본문을 필수로 | KILLED / KILLED | 가드(본문은 선택) |
  | M5 | webhook 의 form-urlencoded 누락 | KILLED / KILLED | 가드(WH-EP-04) |
  | M6 | 헬퍼가 첫 파라미터를 본문 자리로 | KILLED / KILLED | 세 모듈의 설계 타입 캐너리 |
- [x] CHANGELOG — 항목 1(요청 본문 스키마 광고)
- [x] TEST WORKFLOW (lint · unit · build · e2e) — 첫 lint 가 새 헬퍼의 `no-unsafe-argument` 경고로 실패 → `ecaed6534` 로 고치고 1단계부터 재실행, 전부 PASS(e2e 412)
- [x] `/ai-review` — 1R `review/code/2026/09/26/17_55_14`(Critical 0 · Warning 3 → W1 조치 `fafc6b8ac` · W2 유지 · W3 마무리 커밋) · 2R 전수
      14명 `review/code/2026/09/26/18_17_12`: Critical 0 · Warning 0 — 정지 규칙 충족. 2R INFO4(헬퍼 JSDoc 의 «메이저 업그레이드» 를 «마이너 ·
      패치 포함» 으로)는 코드 라운드를 새로 열지 않고 트래커 후속 항목에
- [ ] `--impl-done`
- [ ] 트래커 항목 닫기 · 전역 가드 후속 등재
