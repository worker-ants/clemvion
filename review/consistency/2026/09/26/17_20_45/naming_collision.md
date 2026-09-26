# 신규 식별자 충돌 검토 — rotate-bot-token-body (--impl-prep)

## 스코프 확인

번들된 target 문서는 `spec/5-system/15-chat-channel.md` 전체(2715줄)이지만, 이는 `code:` glob 매칭으로
scope 에 끌려온 **기존·이미 구현된** spec(`status: partial`)이다. 실제 작업 plan
(`plan/in-progress/rotate-bot-token-body.md`, `spec_impact: none`)은 이 spec 문서를 전혀 고치지 않는다 —
`rotateBotToken` / `continueExecution` / `receiveWebhook` 세 라우트에 **문서 전용(runtime 불변)**
OpenAPI `@ApiBody` 데코레이터를 붙이는 작업이다. 따라서 "target 문서가 새로 도입하는 식별자"는
spec 쪽에는 없고, plan 이 예고한 **두 개의 신규 DTO 클래스명**뿐이다:

- `ChatChannelRotateBotTokenRequestDto` (신규, `triggers` 모듈)
- `ContinueExecutionRequestDto` (신규, `executions` 모듈)
- `receiveWebhook` 은 신규 클래스 없이 인라인 `@ApiBody({ required: false, schema })` — 식별자 신설 없음

이 두 식별자를 기준으로 기존 spec/codebase 전체를 grep 대조했다.

## 점검 결과

### 1. 요구사항 ID 충돌 — 해당 없음
plan 은 새 요구사항 ID를 부여하지 않는다. `CCH-SE-04`(rotate-bot-token 원 요구사항)는 그대로 참조만 한다.

### 2. 엔티티/타입명 충돌

- **[WARNING] `ChatChannelRotateBotTokenDto` (기존 응답 DTO) ↔ `ChatChannelRotateBotTokenRequestDto` (신규 요청 DTO)**
  - target 신규 식별자: `ChatChannelRotateBotTokenRequestDto`
  - 기존 사용처: `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts:71` (`export class ChatChannelRotateBotTokenDto`), `triggers.controller.ts:42,299,315`
  - 상세: 두 클래스는 같은 엔드포인트(`POST /api/triggers/:id/chat-channel/rotate-bot-token`)의 요청/응답을 나눠 맡으므로 의미 충돌은 아니지만, 어간(`ChatChannelRotateBotToken`)이 동일하고 한쪽만 `Request` 접미가 붙어 grep·import 자동완성에서 구분이 즉시 안 된다(응답 쪽은 폴더(`dto/responses/`)로만 request/response 를 구분하는 기존 관례와도 접미사 대칭이 어긋남 — 응답은 접미사 없음, 요청만 `Request`).
  - 제안: 그대로 진행해도 기능상 문제는 없음. 다만 파일 배치 시 응답과 대칭되는 `dto/chat-channel-rotate-bot-token-request.dto.ts`(플랫, `dto/responses/` 밖)로 두어 "폴더가 request/response 를 가른다"는 기존 패턴(`chat-channel-config.dto.ts` flat vs `dto/responses/*.ts`)과 정합시킬 것을 권장.

- **[INFO] plan 이 스스로 인용한 선례(`ExecuteWorkflowDto`, 접미사 없음)와 접미사 스타일이 다름**
  - target 신규 식별자: `ChatChannelRotateBotTokenRequestDto` / `ContinueExecutionRequestDto` (둘 다 `Request` 접미)
  - 기존 사용처: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:26` (`export class ExecuteWorkflowDto`) — plan 문서가 "그대로 따른다"고 명시한 선례
  - 상세: 선례는 접미사 없이 `<Verb><Entity>Dto` 형태다. 이번 신규 클래스 둘은 `<Entity><Verb>RequestDto`/`<Verb><Entity>RequestDto` 로 어순·접미사 모두 다르다. 다만 `Request` 접미 자체는 저장소에 이미 존재하는 관례(`AssistantMessageRequestDto`, `EmailChangeRequestDto`, `re-run.dto.ts` 계열)라 **신규 패턴 창조는 아니며** 실질적 충돌도 아니다 — "문서 전용 DTO는 이렇게 짓는다"는 정본 규칙이 `spec/conventions/swagger.md` 에 없어 두 선례가 병존하게 된다는 점만 기록.
  - 제안: 명명 자체를 막을 근거는 없음. `swagger.md` §1-7 은 `Update` 접두(부분 갱신 바디) 범위만 다루고 이 케이스(문서 전용 action-body DTO)는 다루지 않는다 — 규칙 공백은 이 PR 의 plan 도 "안 하는 것" 섹션에서 이미 별도 planner 턴으로 유예함을 확인.

- **[없음] `ContinueExecutionRequestDto` 자체 충돌** — grep 결과 저장소 어디에도 사전 사용 없음. 인접 기존 응답 DTO는 `ExecutionContinueResultDto`(`executions/dto/responses/execution-response.dto.ts:223`)로 어간이 `ExecutionContinue`(응답) vs `ContinueExecution`(신규 요청)로 **어순이 반대**다. 의미 충돌은 아니지만 같은 엔드포인트의 요청/응답 클래스명이 명사·동사 순서가 뒤바뀌어 있어 나란히 놓고 읽으면 오탈자처럼 보일 소지가 있다.

### 3. API endpoint 충돌 — 해당 없음
신규 endpoint 없음. 세 라우트(`POST /api/triggers/:id/chat-channel/rotate-bot-token`, `POST /api/executions/:id/continue`, `POST /api/hooks/:endpointPath`) 모두 기존 spec(15-chat-channel.md §5.4, 4-execution-engine.md, 12-webhook.md)에 이미 정의돼 있고 plan 은 OpenAPI 문서화만 추가한다.

### 4. 이벤트/메시지명 충돌 — 해당 없음
webhook/queue/SSE 이벤트 신설 없음.

### 5. 환경변수·설정키 충돌 — 해당 없음
신규 ENV var·config key 없음(런타임 불변이 plan 의 명시 전제).

### 6. 파일 경로 충돌 — 문제 없음
- `triggers/dto/chat-channel-rotate-bot-token-request.dto.ts`(추정 경로) — 기존 `find` 결과 미존재, 충돌 없음. `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 와 이름이 유사하지만 폴더가 달라 실제 경로 충돌은 아님(위 WARNING 참고).
- `executions/dto/continue-execution-request.dto.ts`(추정 경로) — 기존 `find` 결과 미존재, 충돌 없음.
- `hooks` 쪽은 신규 파일 없이 컨트롤러 인라인 데코레이터만 추가 예정이라 경로 충돌 대상 자체가 없음.

## 요약

이번 target 은 `spec/5-system/15-chat-channel.md` 전체를 번들했지만 실제 작업(plan `rotate-bot-token-body`, `spec_impact: none`)은 spec 을 고치지 않고 `rotateBotToken`/`continueExecution`/`receiveWebhook` 세 라우트에 문서 전용 `@ApiBody` DTO 를 추가하는 좁은 범위다. 실제 신규 식별자는 `ChatChannelRotateBotTokenRequestDto`·`ContinueExecutionRequestDto` 두 클래스명뿐이며, 저장소 전수 grep 대조 결과 기존 식별자와의 실질 충돌(CRITICAL)은 발견되지 않았다. 응답 DTO(`ChatChannelRotateBotTokenDto`)와 어간이 같은 신규 요청 DTO의 접미사 비대칭, 그리고 plan 이 인용한 선례(`ExecuteWorkflowDto`, 무접미)와의 명명 스타일 차이는 기능적 충돌이 아닌 가독성 수준의 WARNING/INFO 로만 남긴다.

## 위험도

LOW
