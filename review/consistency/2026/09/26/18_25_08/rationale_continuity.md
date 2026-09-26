# Rationale 연속성 검토 — rotate-bot-token-body

## 검토 대상 요약

diff 10파일/457줄, `spec/` 델타 0 (문서 전용 OpenAPI 변경, 런타임 불변). 세 라우트
(`triggers.rotateBotToken` · `executions.continueExecution` · `hooks.receiveWebhook`)에
`@ApiBody`/`@ApiConsumes` + 문서 전용 DTO 2종(`ChatChannelRotateBotTokenRequestDto` ·
`ContinueExecutionRequestDto`)을 추가하고, `@Body()` 파라미터 타입은 인라인을 유지했다
(`workflows/dto/execute-workflow.dto.ts` 선례를 그대로 따름).

## 발견사항

### INFO — `*RequestDto` 명명 패턴이 `swagger.md §1-7` 에 아직 편입되지 않음

- target 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts` ·
  `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts` (신설 클래스명 `…RequestDto`)
- 과거 결정 출처: `spec/conventions/swagger.md` §1-7 Rationale
  (`#1-7-update-접두의-범위--왜-nested-변형에는-걸지-않는가`) — "`Update` 접두는 top-level
  요청 바디에만, 실측(18/18)이 범위를 정했다"
- 상세: §1-7 은 `Update*Dto` 접두의 적용 범위만 규정하고, 이번에 도입된 "문서 전용
  `*RequestDto`" 명명 계열(class-validator 데코레이터 없이 `@ApiBody({ type })` 로만 쓰는
  DTO)에 대한 명명 규칙은 아직 §1 어디에도 없다. 이번 PR 은 새 계열을 사실상 만들었지만
  기존 Rationale 을 갱신하지 않았다 — 다만 이는 **무단 번복이 아니다**: plan
  (`plan/in-progress/rotate-bot-token-body.md` INFO2·INFO4·INFO5)이 이미 이 갭을 인지하고
  "트래커 종결 노트에 채택안과 이유를, 전역 가드 후속 항목에 §1-7 접미 행을 함께" 등재하기로
  명시했다. 즉 결정 번복이 아니라 **의도적으로 유예된 Rationale 보완**이다.
- 제안: 체크리스트 마지막 항목("트래커 항목 닫기 · 전역 가드 후속 등재")을 실제로 수행할 때
  `swagger.md §1-7`(또는 인접 절)에 "문서 전용 `*RequestDto`" 계열을 명시적으로 추가해,
  다음 사람이 `Update*Dto` 18/18 규칙과 이번 계열을 혼동하지 않게 한다. 이번 PR 범위에서
  차단할 사유는 아니다(코드 변경 없음, planner 턴으로 넘겨도 되는 harness/spec 편집).

## 정합성 확인 (문제 없음으로 판정한 항목)

- **R-CC-10 / R-CC-21 (Bot Token 변경 single-path, PATCH 는 비밀을 쓰지 않는다)** — 이번 diff 는
  `triggers.controller.ts` 의 `rotateBotToken` 핸들러 로직·`@Body() body: { newBotToken?: string }`
  인라인 타입·수동 `INVALID_BOT_TOKEN` 검증을 그대로 유지한다(코드로 직접 확인,
  `triggers.controller.ts:308-333`). `@ApiBody({ type: ChatChannelRotateBotTokenRequestDto })` 는
  문서 레이어만 추가할 뿐 rotate 단일 경로·PATCH 차단 정책을 우회하지 않는다.
- **§5.4 `INVALID_BOT_TOKEN` 계약 vs 새 DTO** — spec 은 "`newBotToken` 누락/비-string → controller
  입력 검증에서 `INVALID_BOT_TOKEN`"이라 명시한다(스펙 본문 실측). 새 DTO 는 **class-validator
  데코레이터를 의도적으로 달지 않아** 이 계약을 보존한다 — plan 이 스스로 "데코레이터를 달면
  `VALIDATION_ERROR` 로 계약이 바뀐다"고 반증까지 문서화했고, 캐너리
  (`triggers-rotate-bot-token-body.spec.ts`)로 고정했다.
- **swagger.md §1-5 (`writeOnly` 의무)** — `newBotToken` 필드에 `@ApiProperty({ writeOnly: true })`
  적용. secret store 입력 plaintext 의무를 충족.
- **선례 정합 (`ExecuteWorkflowDto` "OpenAPI 스키마 전용" 패턴)** — 새 DTO 둘 다 동일 패턴(런타임
  파라미터는 인라인 유지, 문서만 `@ApiBody`)을 재사용했고, 이 패턴 자체는 기존 Rationale 에서
  기각된 대안이 아니라 이미 채택·문서화된 선례다. 다만 선례가 지녔던 흠(JSDoc 에 설계 서사를
  실어 공개 OpenAPI `description` 으로 노출됨)은 신규 DTO 두 개 모두 `//` 주석으로 옮겨 반복하지
  않았다(plan W4 반영) — 이는 원칙 위반이 아니라 개선.
- **spec 12-webhook WH-EP-04/05** — `hooks.controller.ts` 에 추가된 `@ApiConsumes('application/json',
  'application/x-www-form-urlencoded')` + `schema: {}` 는 "JSON, form-urlencoded 요청 본문 수신"
  요구사항과 "형태는 발신자가 정한다"는 기존 계약을 그대로 반영한다. 빈 스키마(`{}`)는 §6 이
  금지하는 "빈 껍데기"(실제로는 고정 형태가 있는데 감춘 경우)가 아니라, §1-4 가 허용하는
  "진짜 열린 map" 사례다.
- **R-CC-18 (`@WorkspaceId()` 공용 데코레이터)** — 이번 diff 는 해당 데코레이터 순서·존재를
  건드리지 않았다(컨트롤러 파라미터 목록 `@WorkspaceId() workspaceId: string` 그대로).
- **R-CC-22 (`code:` glob)** — 신설 파일 `triggers/dto/chat-channel-rotate-bot-token-request.dto.ts`
  는 `codebase/backend/src/modules/triggers/dto/**/chat-channel-*.dto.ts` glob 범위 안에 들어와
  spec coverage 를 깨지 않는다.
- **spec_impact: none 처리** — 이번 PR 은 `spec/**` 파일을 하나도 바꾸지 않았고(스코프 델타
  0파일), 자기-반증형 소정정 조건에도 해당하지 않는다(예고 문장 정정이 아니라 순수 문서화
  코드 변경). `developer` 가 `spec/` 을 건드리지 않은 것은 거버넌스 경계와도 정합.

## 요약

이번 변경은 spec `15-chat-channel.md` §5.4/§CCH-SE-04, `12-webhook.md` WH-EP-04/05,
`conventions/swagger.md` §1-5 가 이미 확정한 계약·원칙을 그대로 보존하면서 OpenAPI 문서
레이어만 추가한다. 기각된 대안(예: `@Body()` 를 DTO 클래스로 타입해 전역 파이프를 태우는 안)을
재도입하지 않았고, 관련된 모든 rotate-bot-token 관련 Rationale(R-CC-10 · R-CC-18 · R-CC-21 ·
R-CC-22 · R-CC-23)의 결정을 번복 없이 따른다. 유일한 미세한 잔여는 신설된 "문서 전용
`*RequestDto`" 명명 계열이 `swagger.md §1-7` 에 아직 정식 편입되지 않은 것인데, 이는 plan 자체가
이미 인지하고 후속 트래커 항목으로 명시 유예한 것이라 "무근거 번복"이 아니라 "의도적으로 지연된
Rationale 보완"에 해당한다.

## 위험도

LOW
