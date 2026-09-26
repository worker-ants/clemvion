# Cross-Spec 일관성 검토 — rotate-bot-token-body (--impl-prep)

대상 작업: `plan/in-progress/rotate-bot-token-body.md` — `rotateBotToken` / `continueExecution` /
`receiveWebhook` 3개 라우트에 문서 전용(class-validator 데코레이터 없는) request DTO + `@ApiBody`
를 추가해 OpenAPI 요청 본문 스키마를 채운다. `spec_impact: none` — 런타임·API 계약·spec 본문 변경
없음, `workflows.execute`/`ExecuteWorkflowDto` 선례를 그대로 따름.

이 전제(문서만, 런타임 무변경) 자체는 실측(78개 `@Body()` 중 DTO 아닌 4개, `ExecuteWorkflowDto`
선례 존재)으로 뒷받침되어 있어 원 계획과 충돌하지 않는다. 아래는 **문서를 실제로 작성할 때**
기존 spec 영역과 어긋날 수 있는 지점이다.

## 발견사항

- **[WARNING]** `rotateBotToken` 요청 DTO 의 `required` 선언이 spec 계약보다 느슨하게 나갈 위험
  - target 위치: `plan/in-progress/rotate-bot-token-body.md` 표 1행 (`ChatChannelRotateBotTokenRequestDto`)
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §5.4 요청 예시(`"newBotToken": "<bot-father-issued-token>" // 필수`)
    · `spec/2-navigation/2-trigger-list.md` (`botToken` 행, rotate 액션 필수 입력으로 서술)
  - 상세: 현재 `@Body() body: { newBotToken?: string }` 는 TS 타입만 optional(`?`)이고, 실제로는
    핸들러가 누락/비-string 을 400 `INVALID_BOT_TOKEN` 으로 거부해 **정책상 필수**다(§5.4 표·
    2-trigger-list.md 둘 다 "필수"로 서술). 이번 PR 이 만드는 문서 전용 DTO 가 `@Body()` 인라인
    타입을 그대로 미러링해 `newBotToken?: string` → `@ApiPropertyOptional` 로 선언하면, **새로
    발행되는 OpenAPI 문서**가 "선택 필드"로 광고하게 되어 §5.4/2-trigger-list.md 가 이미 "필수"로
    선언한 계약과 어긋난다. 런타임은 안 바뀌지만(여전히 누락 시 400), 이번 PR 로 **새로
    생성되는 문서**가 기존 spec 문서와 모순되는 신규 불일치가 생긴다 — "문서한 보장이 구현보다
    넓으면 안 된다"의 거울상("새 문서가 기존 spec 이 정한 계약보다 좁게/다르게 광고하면 안 된다")
  - 제안: DTO 필드는 `@ApiProperty({ required: true, ... })` 로 선언하고(런타임 파라미터 타입 `?`
    는 그대로 유지 — validation pipe 진입과 무관), JSDoc/description 에 "누락·비-string 시 핸들러가
    400 INVALID_BOT_TOKEN 을 던진다(class-validator 가 아니라 서비스 계층 검사)"를 명시해
    `swagger.md` §3 보안·정책 캐비엇("왜 이 값을 보내면 400 인가")과도 정합시킬 것. spec 수정은
    불필요 — DTO 작성 시 판단 기준만 남긴다.

- **[WARNING]** 신규 request DTO 파일이 `15-chat-channel.md` frontmatter `code:` glob 밖으로 벗어날 위험 (R-CC-22 재발 패턴)
  - target 위치: `plan/in-progress/rotate-bot-token-body.md` — `ChatChannelRotateBotTokenRequestDto` 파일 경로 미명시
  - 충돌 대상: `spec/5-system/15-chat-channel.md` frontmatter `code:` 의
    `codebase/backend/src/modules/triggers/dto/**/chat-channel-*.dto.ts` glob + 같은 문서
    `## R-CC-22`(같은 갭이 `#1317`·`#1319`·`#1320` 세 번 연속 재발했다는 이력)
  - 상세: 이 glob 은 파일명이 `chat-channel-` 로 시작해야 매칭된다(예:
    `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 는 매칭됨). 새 request DTO 를
    (plan 이 아직 파일명을 정하지 않았으므로) 예컨대 `rotate-bot-token-request.dto.ts` 처럼
    `chat-channel-` 접두 없이 만들면 이 glob 을 벗어나 `review_guard` 의 spec-linked 판정에
    걸리지 않는다 — R-CC-22 가 경고하는 정확히 그 실패 형태이고, 이미 3회 재발한 패턴의 4번째
    사례가 될 수 있다.
  - 제안: 파일명을 기존 응답 DTO 와 대칭으로 `chat-channel-rotate-bot-token-request.dto.ts` 로
    두면 자동으로 glob 에 포함된다. `ContinueExecutionRequestDto`(executions 모듈)·`hooks`
    쪽(DTO 미생성, 인라인 schema)은 이 chat-channel 전용 glob 대상이 아니므로 해당 없음.

- **[INFO]** 신규 DTO 클래스명 충돌 없음 확인 (기록용)
  - target 위치: 계획된 `ChatChannelRotateBotTokenRequestDto` / `ContinueExecutionRequestDto`
  - 대상: `spec/conventions/swagger.md` §5-1 ("응답 DTO 클래스명은 저장소 전체에서 유일해야
    합니다" + `dto-class-name-collision.spec.ts` AST 가드)
  - 상세: 실제 코드 grep 결과 기존 `ChatChannelRotateBotTokenDto`(응답, `dto/responses/...`)·
    `ExecutionContinueResultDto`(응답, `execution-response.dto.ts`) 와 이름이 겹치지 않는다.
    §5-1 의 "같은 개념을 층별로 나눠 선언할 때는 이름을 다르게 둔다" 선례
    (`ChatChannelBotIdentityDto` vs `ChatChannelRotateBotIdentityDto`)와도 정합한다. 조치 불필요.

- 그 외 확인해 본 항목 — 충돌 없음:
  - `continueExecution` 의 `{ formData?: unknown }` 은 `spec/data-flow/3-execution.md`
    (`REST POST /executions/:id/continue — body { formData? } 만 받으며`)와 정확히 일치.
  - `receiveWebhook` 을 "형태는 외부 발신자가 정한다(임의 JSON)"로 열린 스키마 처리하는 것은
    `spec/5-system/12-webhook.md` WH-EP-04/05(JSON/form-urlencoded 임의 본문을 그대로 워크플로우
    입력으로 전달)와 `swagger.md` §1-4 "진짜 열린 map" 예외(변형 집합이 코드로 확정되지 않고
    런타임/외부 발신자가 결정)에 정확히 해당해 §1-4 위반이 아니다.
  - 데이터 모델·요구사항 ID·상태 전이·RBAC·계층 책임 — 이번 변경은 스키마 문서 추가일 뿐이라
    다섯 축 모두 미변경. `chat-channel`/`triggers`/`hooks`/`executions` 모듈 간 책임 분할도
    그대로(문서 전용 DTO 는 해당 모듈 `dto/` 안에 위치, 기존 관례와 동일).

## 요약

`spec_impact: none` 문서 전용(OpenAPI만) 변경으로, 데이터 모델·API 런타임 계약·요구사항 ID·상태
전이·RBAC·계층 책임 어느 축도 실제로 바뀌지 않아 구조적 Cross-Spec 충돌은 없다. 다만 이번 PR 이
**새로 발행하는 문서**(OpenAPI 스키마) 자체가 기존 spec 문서와 어긋나게 작성될 수 있는 두 지점이
있다 — (1) `rotateBotToken` 요청 필드의 `required` 표기가 §5.4/2-trigger-list.md 의 "필수" 서술과
다르게(선택으로) 광고될 위험, (2) 신규 request DTO 파일명이 `15-chat-channel.md` 의 `code:` glob
을 벗어나 이미 세 번 재발한 spec-linkage 갭(R-CC-22)의 네 번째 사례가 될 위험. 둘 다 spec 수정이
아니라 구현 시 주의사항이며, 그 외 항목은 기존 spec 서술과 정확히 일치함을 확인했다.

## 위험도

LOW
