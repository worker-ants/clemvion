---
id: "CLE-CHAT-ADAPTER-RENDER"
title: "채팅 채널 어댑터 규약 — 이벤트 렌더와 실패 안내"
type: "convention"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-ADAPTER"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-ADAPTER"]
area: "CLE-CHAT"
content_hash: "8ff1ac41ac23a4f7ab854e29a5a39e492521f8432dcee0c2bce445024721cabc"
read_as: "approved_fallback"
task: "CLE-T-FQTQ7K"
source_paths: []
mirror_sha256: "237972eca49cafdd0689e990cdcd56e774cd11d868f43c44f39a15db2dbb9af4"
etag: "sha256-cdcc808954b7d2fc15590653c3d515c6063436a8f8b849d9bee31c9cd38803ad"
---
## 개요

이 문서는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 의 하위 문서로 `renderNode` 가 이벤트마다 만드는 출력 메시지, 시각형 렌더 입력을 찾는 순서, 사용자 입력이 섞이는 본문의 멘션 무력화, 실행 실패 안내 분류 함수 `classifyExecutionFailure` 를 정한다.

## 이벤트별 렌더 매핑

`renderNode(event)` 가 처리하는 EIA 이벤트 다섯 가지와 채팅 채널 내부 이벤트, 그리고 출력 `ChannelMessage[]` 는 다음과 같다. EIA 알림 웹훅 표면은 다섯 가지 그대로이고 마지막 행은 내부 이벤트다.

| 이벤트 | 입력 | 출력 메시지 |
|---|---|---|
| `execution.waiting_for_input`(form) | `formConfig.fields[]` | 폼 모드 분기([Form 입력 흐름](CLE-CHAT-ADAPTER-FORM.md#form-입력-흐름)). 네이티브 모달이면 `form_modal` 1건(양식 열기 버튼) → 클릭 때 모달을 열고 → 제출 때 `form_submission` 을 한 번에 모아 → EIA `submit_form` 한 번 호출. 다단계 질문이면 첫 필드 `form_prompt` 1건, 이후 답할 때마다 다음 필드 |
| `execution.waiting_for_input`(buttons) | `buttonConfig.buttons[]`, `buttonConfig.nodeOutput` | `buttons` 1건. 노드가 시각형(carousel·table·chart)이면 그 앞에 시각 메시지를 붙인다. `uiMapping.visualNode`(`text`·`photo`·`auto`, 기본 `auto`)에 따라 나누고, 1차 범위는 프로바이더별 텍스트 fallback, 후속 범위는 SSR PNG 다. 1차 범위에서 `photo` 를 고르면 텍스트로 대신 보내고 warning 로그를 남기며 채널 건강도는 바꾸지 않는다. 버튼 달린 Template 의 처리는 [미결 사항](CLE-CHAT-ADAPTER.md#미결-사항) 참조 |
| `execution.waiting_for_input`(ai_conversation) | 없음 | 빈 배열(조용히 넘김). 이유는 R-CCA-6 |
| `execution.waiting_for_input`(ai_form_render) | 없음 | `ai_conversation` 과 같이 빈 배열. 채팅 채널의 인라인 폼 처리는 후속 범위다 |
| `execution.ai_message` | `message`(필수), `presentations?[]` | `text` 1건 이상(나눠 보낼 수 있다). `presentations` 가 있으면 표시물마다 1차 범위의 텍스트 fallback 으로 렌더해 텍스트 뒤에 하나씩 `await` 하며 보낸다(`Promise.all` 금지, rate limit 과 표시 순서). 표시 전용 네 가지(`carousel`·`table`·`chart`·`template`)는 시각형 fallback 을 다시 쓴다. `render_form`(`type === 'form'`)은 필드 목록과 답변 안내를 담은 1차 범위의 임시 텍스트다(R-CCA-13). `message` 와 `template` 표시물은 [멘션 무력화](#멘션-무력화) 규칙으로 보낸다. 기준은 [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md) 와 [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) |
| `execution.completed` | 없음(`status` 만). `result.outputs` 는 EIA 에서 미구현 | `text` 1건. `languageHints.executionCompleted` |
| `execution.failed` | `error.code`, `error.details.statusCode`(다른 필드 금지) | `text` 1건. [실행 실패 안내 분류](#실행-실패-안내-분류) 결과 `(key, placeholders)` 로 `languageHints[key]` 를 찾고 자리표시자를 채운다. 시스템 의무는 [채팅 채널](CLE-CHAT-CORE.md) 이 정한다 |
| `execution.cancelled` | `cancelledBy`, `error?.code` | `text` 1건. `error.code` 가 `RESUME_*` 접두 코드면 무엇이든(재개 실패 시스템 취소, [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)) 대화 세션 만료 안내 `languageHints.sessionExpired` 를 보내고, 그 밖은 일반 취소 안내를 보낸다. 이 안내 범위(`RESUME_*` 전부)의 기준은 이 규약이다 |
| `execution.node.completed`(내부, 표시 전용 Presentation 만) | `node.type ∈ {template, carousel, table, chart}`, `output` | `template` 은 `output.output.rendered` 를 `text` 1건으로 보낸다([멘션 무력화](#멘션-무력화)). 실제 `extractRendered` 는 `rendered` → `payload.rendered` → `output.rendered` 를 훑어 옛 평평한 모양도 받는다. `carousel`·`table`·`chart` 는 시각형 텍스트 fallback(`renderCarouselFallback`·`renderTableFallback`·`renderChartFallback`)을 그대로 쓴다. 버튼 있는(블로킹) 경우는 버튼 입력 대기 행이 처리하므로 미리 거른다. Form 노드는 늘 블로킹이라 대상이 아니다 |

### 시각형 렌더 입력

시각형 텍스트 fallback 은 세 진입점에서 함께 쓴다. 버튼 입력 대기(`execution.waiting_for_input` buttons), 표시 전용 완료(`execution.node.completed`), AI 표시물(`execution.ai_message.presentations[]`)이다. 노드 유형 × `visualNode` × 범위(1차 · 후속) 매트릭스, 길이 한도, 분할 규칙은 프로바이더 문서가 정한다.

`visualNode` 의 `photo` 와 메시지 종류 `image`(`ChannelMessage.body.kind`)는 같은 것을 가리킨다. 후속 범위의 SSR PNG 는 `body.kind: "image"` 메시지로 나간다. 1차 범위에서는 이 메시지를 만들지 않는다.

프로바이더 매트릭스에 적힌 `output.payload.*`, `output.items[]`, `output.{rows, columns}`, `output.rendered` 는 노드가 무엇을 만드는지를 적은 것이다(노드 출력의 `output` 기준). 렌더러가 읽는 경로가 아니다. wire 로 실릴 때는 한 겹이 더 붙어 `nodeOutput.output.<field>` 가 된다. 렌더러(`renderPresentationByType`, `extractRendered`, `extractVisualPayload`)는 다음 순서로 찾고 처음 찾은 값을 쓴다.

1. `nodeOutput.payload.<field>`: AI 에이전트 `presentations[i]` 포장
2. `nodeOutput.output.<field>`: 그래프 노드 핸들러 반환
3. `nodeOutput.config.<field>`: Carousel 정적 모드처럼 config 에만 있는 값
4. `nodeOutput.<field>`: 평평한 옛 모양

노드 출력과 wire 의 구분 기준은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이다. 프로바이더 매트릭스가 적은 Chart·Carousel 입력 모양이 노드 출력([Chart 노드](../CLE-NODE-PRES/CLE-NODE-CHART.md), [Carousel 노드](../CLE-NODE-PRES/CLE-NODE-CAROUSEL.md))과 다르다. [미결 사항](CLE-CHAT-ADAPTER.md#미결-사항) 참조.

### 멘션 무력화

Template 본문(`execution.node.completed` 의 `template`, `execution.ai_message.presentations[]` 의 `template`)과 `execution.ai_message` 의 `message` 에는 `{{ }}` 표현식이나 LLM 응답을 거쳐 사용자 입력이 섞일 수 있다. 채널 어댑터는 이 두 본문을 보낼 때 채널 전체 멘션과 사용자 멘션의 알림이 울리지 않게 한다. 워크플로우 작성자가 일부러 넣은 멘션도 알림이 가지 않는다. 방법은 프로바이더마다 다르다.

- **Telegram**: 지금처럼 MarkdownV2 예약 문자를 escape 해 보낸다([Telegram 어댑터](CLE-CHAT-TELEGRAM.md)).
- **Slack**: `&` · `<` · `>` 를 escape 한다. `<!channel>` · `<!here>` · `<@U…>` 멘션과 `<url|라벨>` 링크 문법이 글자 그대로 보인다. 맨 URL 자동 링크와 `*굵게*` 같은 서식은 그대로 된다([Slack 어댑터 — Web API 와 노드 UI 매핑 「멘션 무력화」](CLE-CHAT-SLACK-OUTBOUND.md#멘션-무력화)).
- **Discord**: escape 하지 않고 모든 발송에 `allowed_mentions: {"parse": []}` 를 붙인다. 글자는 그대로 보이고 `@everyone` · `@here` · 사용자 · 역할 멘션의 알림만 가지 않는다([Discord 어댑터 — API 호출과 UI 매핑 「멘션 무력화」](CLE-CHAT-DISCORD-API.md#멘션-무력화)).

escape 하는 프로바이더는 본문을 길이 한도에 맞춰 나눌 때 조각 경계가 escape 결과의 가운데를 지나면 그 앞에서 자른다.

## 실행 실패 안내 분류

`execution.failed` 를 안내 메시지로 바꾸기 전에 프로바이더와 무관한 순수 함수가 `(key, placeholders)` 를 정한다. 채널 어댑터(`renderNode`)는 그 결과로 `languageHints` 문구를 찾아 채우고 `text` 메시지 1건을 만든다.

```typescript
interface ExecutionFailureClass {
  /** languageHints 조회 키. 실행 실패 안내 키 여섯 개 가운데 하나. */
  key:
    | "executionFailedThirdParty4xx"
    | "executionFailedThirdParty5xx"
    | "executionFailedThirdParty"
    | "executionFailedTimeout"
    | "executionFailedRateLimit"
    | "executionFailedInternal";
  /** 자리표시자 값. 허용 목록은 {statusCode} 하나(정수). */
  placeholders: { statusCode?: number };
}

/**
 * 순수 함수. 부수 효과 없음. 프로바이더 무관.
 * 입력 허용 목록(채팅 채널 문서의 실행 실패 안내 요구사항): event.error.code 와 event.error.details?.statusCode 만.
 * details 는 unknown 이므로 statusCode 를 읽기 전에 런타임 type-guard 를 한다:
 * typeof details === 'object' && details !== null && 'statusCode' in details
 *   && typeof (details as any).statusCode === 'number'.
 * 가드가 실패하면 placeholders.statusCode 를 뺀다.
 */
function classifyExecutionFailure(event: Extract<EiaEvent, { type: "execution.failed" }>): ExecutionFailureClass;
```

분류 매핑은 다음과 같다. `error.code` enum 의 기준은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 다.

| `error.code` | 추가 조건 | 결과 `key` | placeholders |
|---|---|---|---|
| `HTTP_4XX` | `details.statusCode` ∈ [400, 499], 있을 때만 | `executionFailedThirdParty4xx` | `{ statusCode }`(없으면 뺀다) |
| `HTTP_5XX` | `details.statusCode` ∈ [500, 599], 있을 때만 | `executionFailedThirdParty5xx` | `{ statusCode }`(없으면 뺀다) |
| `HTTP_TIMEOUT`(발행 안 됨) | 없음 | `executionFailedTimeout` | `{}` |
| `HTTP_TRANSPORT_FAILED` | 없음 | `executionFailedThirdParty` | `{}` |
| `LLM_RATE_LIMIT` | 없음 | `executionFailedRateLimit` | `{}` |
| `LLM_TIMEOUT`(발행 안 됨) | 없음 | `executionFailedTimeout` | `{}` |
| `LLM_CALL_FAILED` · `LLM_RESPONSE_INVALID` · `MAX_COLLECTION_RETRIES_EXCEEDED` | 없음 | `executionFailedThirdParty` | `{}` |
| `EMAIL_SEND_FAILED` | 없음 | `executionFailedThirdParty` | `{}` |
| `EXECUTION_TIMEOUT`(Code 노드 스크립트) · `EXECUTION_TIME_LIMIT_EXCEEDED`(엔진 누적 실행 시간) · `CODE_TIMEOUT` | 없음 | `executionFailedTimeout` | `{}` |
| `CODE_EXECUTION_FAILED` · `CODE_MEMORY_LIMIT` · `HTTP_BLOCKED`(SSRF 차단) · `SUB_WORKFLOW_FAILED` · `WORKFLOW_FORBIDDEN_WORKSPACE`(워크스페이스 격리 차단) · `DB_*` · `RECURSION_DEPTH_EXCEEDED` · `MAX_ITERATIONS_EXCEEDED` · `CYCLE_DETECTED` · `INVALID_EXPRESSION` · `VARIABLE_NOT_FOUND` · `TYPE_MISMATCH` · `ERROR_PORT_FALLBACK` | 없음 | `executionFailedInternal` | `{}` |
| `WORKER_HEARTBEAT_TIMEOUT` | 분류 미정([미결 사항](CLE-CHAT-ADAPTER.md#미결-사항)) | 현재는 아래 행과 같이 `executionFailedInternal` | `{}`(백엔드 `warn` 로그) |
| 그 밖의 모든 code(`error.code === null` 포함) | 알 수 없음 | `executionFailedInternal` | `{}`(백엔드 `warn` 로그. 요구사항은 [채팅 채널 「실행 실패 안내」](CLE-CHAT-CORE.md#실행-실패-안내)) |

- **`HTTP_TIMEOUT`(발행 안 됨)**: HTTP Request 노드 핸들러는 timeout reject 를 `HTTP_TRANSPORT_FAILED` 로 합쳐 발행하므로 EIA 페이로드에 `HTTP_TIMEOUT` 이 올 경로는 지금 없다. enum 보존과 방어를 위해 행을 둔다.
- **`LLM_TIMEOUT`(발행 안 됨)**: 어느 LLM 호출 경로도 이 코드를 내지 않는다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)). LLM 타임아웃이 `LLM_CALL_FAILED` 로 오면 `executionFailedThirdParty` 로 안내된다. 단일 턴 AI 에이전트의 LLM 호출 실패는 `error` 포트 연결선이 있으면 안내가 생기지 않고, 없으면 `ERROR_PORT_FALLBACK` 행으로 안내된다([노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md)). 경로별 결과는 [AI 노드 공통 「LLM 호출 경로별 타임아웃」](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md#llm-호출-경로별-타임아웃) 이 모아 적는다. `HTTP_TIMEOUT` 과 같은 이유로 행을 둔다.
- **timeout 행의 층 구분**: 입력은 엔진 수준의 `execution.failed.error.code` 다. Code 노드 스크립트가 시간을 넘기면 엔진은 `EXECUTION_TIMEOUT` 을 발행한다. 노드 출력 층의 `output.error.code` 는 같은 상황을 `CODE_TIMEOUT` 으로 정규화하며, 이 토큰이 EIA 페이로드로 오는 경우까지 방어적으로 함께 매핑한다(두 층의 구분 기준은 에러 코드 카탈로그). `EXECUTION_TIME_LIMIT_EXCEEDED` 는 엔진 누적 실행 시간 초과로 다른 코드다. 세 코드 모두 `executionFailedTimeout` 으로 모이므로 사용자 영향은 같다.
- **`statusCode` 생략**: `details.statusCode` 가 없거나 정수가 아니면 4xx·5xx 분기는 `error.code` 만으로 정한다(HTTP Request 노드 핸들러는 두 값을 일관되게 넣는다고 가정한다). 자리표시자가 빠지면 채널 어댑터는 `{statusCode}` 를 `"?"` 로 바꾸거나 `({statusCode})` 괄호 구간을 통째로 지운다(채널 어댑터 재량). 사용자 영향은 거의 없다.
- **위치**: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` 한 파일이다. 채널 어댑터는 부르기만 하고 프로바이더별 분기는 없다.
- **locale**: 함수는 `key` 만 정한다. locale 별 기본 문구 조회는 채널 어댑터 책임이고 순서는 `languageHints[key]` → `languageLocale` 기본값 → `ko` 다([채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 의 기본 문구 표).

## Rationale

### R-CCA-5 실행 실패 분류 함수를 규약에 둔다

분류는 프로바이더가 달라도 같은 알고리즘이라(입력은 EIA 페이로드, 출력은 안내 키와 자리표시자) 규약의 순수 함수로 둔다. Form 다단계 질문과 같은 층이고 채널 어댑터별 중복 구현을 피한다. 인터페이스에 `renderError(event)` 를 새로 만들면 [R2](CLE-CHAT-ADAPTER-IFACE.md#r2-필수-함수에-ack-와-escapecontroltext-를-따로-둔다) 의 인터페이스 최소주의에 어긋나 인터페이스가 흔들리고, 분류가 프로바이더와 무관하니 함수를 나눌 이득도 없다. 알고리즘 상세(입력 타입, fallback, 자리표시자 정책)는 형식 규약이라 시스템 문서보다 규약이 자연스럽다(Cafe24 형식 규약과 노드 정의를 나눈 방식과 같다). `error.message` 를 가려서라도 넘기지 않는 이유는 노드 핸들러가 URL, query, DB 컬럼명, stack, API 키 일부를 흘릴 수 있고, 가림 지침을 문서로 강제하려면 모든 핸들러를 감사해야 해 현실적이지 않기 때문이다. 그래서 미리 검증한 일반 문구만 노출한다. 위험 평가 상세는 [채팅 채널 「R-CC-15 실행 실패 안내의 입력과 자리표시자를 허용 목록으로 제한한다」](CLE-CHAT-CORE.md#r-cc-15-실행-실패-안내의-입력과-자리표시자를-허용-목록으로-제한한다) 에 있다.

- (a) `renderNode` 시그니처는 그대로다. 분류 결과는 채널 어댑터 안에서 `renderNode` 가 직접 받아 조회·치환한다. dispatcher 가 밖에서 분류와 렌더를 잇지 않는다. 프로바이더별 mrkdwn·MarkdownV2·평문 차이를 채널 어댑터 안에서 흡수해야 하기 때문이다.
- (b) 프로바이더별 텍스트 합성 차이는 각 프로바이더 문서의 실행 실패 절이 기준이다. 분류 결과 자체는 프로바이더와 무관하다.

### R-CCA-6 ai_conversation·ai_form_render 입력 대기는 채팅 채널에서 조용히 넘긴다

빈 배열을 돌려준다. AI 에이전트 멀티턴은 턴마다 (a) `ai_message` 로 응답 본문을 내고 (b) 바로 뒤 `waiting_for_input(ai_conversation).conversationConfig.message` 가 같은 본문을 되풀이한다(프론트엔드 조정용). 둘 다 보내면 사용자에게 같은 메시지가 두 번 간다. `ai_message` 가 본문을 보내고 입력 대기 이벤트는 다음 입력을 기다린다는 신호로만 쓴다. 메신저에서는 텍스트 입력 자체가 기본 프롬프트라 따로 안내하지 않는다. `conversationConfig.message` 를 그대로 보내면 늘 중복이 된다. dispatcher 에 내용 기반 중복 제거 캐시를 두면 의도한 중복 발송까지 막는다. AI 에이전트가 `conversationConfig.message` 를 비우게 바꾸면 프론트엔드 조정·복원과 EIA SSE(Server-Sent Events) 외부 소비자가 그 값을 다르게 쓰고 있을 수 있어 영향이 크다. `ai_form_render` 입력 대기도 빈 배열을 돌려준다. `render_form` 의 폼은 앞선 `ai_message` 의 표시물로 이미 임시 텍스트가 되어 나갔기 때문이다(R-CCA-13).

- (a) 정상 AI 에이전트 노드는 첫 턴에 `ai_message` 를 내고 입력 대기에 들어간다. `ai_message` 없이 입력 대기 이벤트만 오는 경우는 정상 흐름이 아니고, 생기더라도 사용자가 바로 텍스트를 입력하면 된다.
- (b) 메신저에서는 텍스트 입력이 기본 프롬프트라 "메시지를 보내 주세요" 같은 안내는 소음이다.
- (c) 버튼·폼 입력 대기는 영향이 없다. 인라인 키보드와 폼 질문은 AI 응답과 다른 자원이라 그대로 보낸다.

### R-CCA-7 renderNode 시그니처를 union 으로 넓혀 내부 이벤트를 받는다

표시 전용 Presentation 노드(버튼 없는 Template·Carousel·Table·Chart)의 본문이 채팅 채널로 나가야 해서 채널 어댑터가 `execution.node.completed` 도 받아야 한다. 입력 union 을 `renderNode(event: EiaEvent | ChatChannelInternalEvent)` 로 넓힌다. 새 함수를 더하지 않아 [R2](CLE-CHAT-ADAPTER-IFACE.md#r2-필수-함수에-ack-와-escapecontroltext-를-따로-둔다) 의 인터페이스 최소주의를 지킨다. union 패턴은 이미 EIA 다섯 가지로 자리 잡았으므로 variant 하나를 더하는 셈이고, 구현체는 기존과 같이 `event.type` 분기를 더한다. `renderPresentationNode` 를 따로 만들면 [R2](CLE-CHAT-ADAPTER-IFACE.md#r2-필수-함수에-ack-와-escapecontroltext-를-따로-둔다) 가 피하려는 "함수가 늘어 모든 프로바이더 계약이 바뀜" 패턴이 되돌아온다. R-CCA-5 가 `renderError` 를 기각한 이유와 같다. `EiaEvent` 에 `execution.node.completed` 를 넣으면 [R3](CLE-CHAT-ADAPTER-TYPES.md#r3-eiaevent-를-별도-타입으로-정의하지-않고-eia-에-맡긴다) 의 "EIA 가 기준" 에 어긋나고 `EiaEvent` 라는 이름의 뜻(EIA 다섯 가지)이 무너지므로 `ChatChannelInternalEvent` 로 따로 둔다. EIA SSE 에는 비차단 Presentation 노드용 표시 메시지 이벤트 `execution.message` 가 따로 있다. 위젯과 EIA 클라이언트는 그 이벤트만 받고, 채널 어댑터는 `execution.node.completed` 를 계속 받는다. 그래서 두 경로가 같은 내용을 두 번 보내지 않는다([EIA 수신 API와 SSE 「표시 메시지 이벤트」](../CLE-IX/CLE-EIA-INBOUND.md#표시-메시지-이벤트)). EIA 알림 웹훅 허용 목록을 여섯 가지로 늘리지 않는 이유는 EIA 클라이언트 SDK 에 깨지는 변경이고 이 공백이 채팅 채널 전용 UX 이기 때문이다.

- (a) 구독 원천은 단일 sink `executionEvents$` 그대로다. 표시 전용 거름만 더한다. 새 sink 가 아니라 기존 sink 의 소비자다.
- (b) 발행 함수 `WebsocketService.emitToExecution` 은 트랜잭션 커밋 뒤 불리고 그 값이 `executionEvents$` 로 나간다([External Interaction API 「신뢰성과 이벤트 순번」](../CLE-IX/CLE-EIA.md#신뢰성과-이벤트-순번) 의 커밋 뒤 발행 요구사항). EIA 알림 웹훅 발송기와 같은 fan-out 경로라 `execution.node.completed` 도 같은 보장을 받는다.
- (c) 트리거 단위 레지스트리 가드([채팅 채널 「R8 트리거 단위 listener 정책」](CLE-CHAT-CORE.md#r8-트리거-단위-listener-정책))가 그대로 적용된다.
- (d) 버튼 때문에 블로킹으로 들어간 경우는 버튼 입력 대기 이벤트가 처리하므로 미리 걸러 중복을 막는다.
- (e) Form 노드는 늘 블로킹이라 대상이 아니고 `node.type` 은 네 가지로 한정한다.
- (f) Telegram 은 시각형 MarkdownV2 fallback, Slack·Discord 도 같은 fallback 정책이다. SSR PNG 는 후속 범위다.

### R-CCA-12 uiMapping.visualNode 를 세 값으로 바꾼다

`"text" | "photo" | "auto"`(기본 `"auto"`)를 택했다. 기본값이 합리적인 휴리스틱(Chart·Table 은 텍스트, Carousel 은 이미지 URL 이 있으면 이미지)이라 사용자가 고르지 않아도 알맞게 동작한다. `text_only` 를 `text` 로 바꿔 `photo`·`auto` 와 같은 급의 단어로 맞췄다. 두 값(`"photo" | "text_only"`)을 유지하면 기본값이 모호하다(1차 범위에서 `photo` 를 텍스트로 대신 보내야 해서). `auto` 하나만 두면 데이터 가독성이나 시각적 인상을 우선하려는 사용자가 텍스트나 이미지를 강제할 수 없다.

- (a) `text_only` → `text`: 영문 표기를 맞춘다. 운영 영향은 채널 어댑터가 읽을 때 바꿔 흡수한다.
- (b) `auto` 신설: 1차 범위에서도 사용자가 미리 판단하지 않아도 합리적 기본 동작을 받게 한다.
- (c) Chart·Table 의 `auto` 가 후속 범위에서도 텍스트 우선인 이유: 수치를 정확히 보여 주는 데는 PNG 보다 monospace 텍스트가 더 읽기 쉽다.
- (d) 1차 범위의 `photo` fallback 이 채널 건강도를 바꾸지 않는 이유: `degraded` 가 되는 원인은 [채팅 채널 「채널 건강도」](CLE-CHAT-CORE.md#채널-건강도) 가 정하고 fallback 은 그 원인이 아니다. 옛 근거 «`degraded` 는 외부 API 실패 신호다» 는 원인이 늘어 낡아 2026-10-05 에 고쳐 적었다(NERV Task `CLE-T-K9S0TE`). 1차 범위에 인프라가 없는 것은 사용자 에러가 아니라 정상 fallback 이다.
- (e) `text` 에서 Carousel 이미지 URL 을 무시하는 이유: 사용자가 "텍스트만" 을 명시했으므로 이미지 URL 이 있어도 텍스트만 보낸다. `auto` 는 이미지 URL 이 있으면 이미지로 나눈다.

이 변경은 이 규약, [채팅 채널](CLE-CHAT-CORE.md), 프로바이더 문서를 함께 고쳤다. 카탈로그는 프로바이더 목록이 아니라 enum 필드 하나의 변경이라 고치지 않았다. [채팅 채널](CLE-CHAT-CORE.md) 의 Rationale 에도 이 결정을 가리키는 항목이 있고, 근거는 이 절에 둔다.

### R-CCA-13 render_form 1차 범위 임시 텍스트와 렌더러 입력 모양

1. Form 표시물: AI 에이전트 `render_form` 도 1차 범위의 임시 텍스트로 보낸다. AI 에이전트가 `render_form` 을 부르고 응답 텍스트가 비어 있는 정상 패턴에서 폼을 건너뛰면, 빈 텍스트가 `isEmptyTextBody` 가드에 걸려 사용자에게 메시지가 0건 간다. 1차 범위의 임시 텍스트와 후속 범위의 네이티브 UI 두 단계로 나눈다.
2. 렌더러 입력 모양: Template·Carousel 핸들러는 `{config, output: {rendered/items/...}}` 모양으로 돌려주는데 `nodeOutput.payload` 만 보면 본문과 항목을 찾지 못해 "(카드가 없습니다.)" 가 잘못 보였다. 그래서 렌더러가 [시각형 렌더 입력](#시각형-렌더-입력) 의 순서로 여러 위치를 훑는다. 본문 규칙은 바꾸지 않고 R-CCA-7 의 union 입력 처리 안에서 렌더러를 강화한 것이다.

AI 에이전트 핸들러가 빈 `ai_message` 를 내지 못하게 막는 안은 `render_form` 턴에 텍스트가 없을 수 있는 정상 동작을 막아 UX 가 퇴행한다. `isEmptyTextBody` 가드를 없애는 안은 다른 경로의 빈 텍스트 발송(Telegram 400 "message text is empty")이 되살아날 위험이 있다. 그래서 가드는 두고 표시물만 따로 보낸다.

- (a) 폼 fallback 모양: "📝 입력이 필요해요:" 한 줄, 필드마다 한 줄(라벨, 필수 표시, 타입), 마지막 "답변을 메시지로 보내주세요." 안내. 1차 범위 한정이다.
- (b) 사용자는 자연 텍스트로 답하고 그 답은 `submit_message` 로 간다. AI 에이전트는 대기 중인 폼 호출을 `user_sent_message_instead` 사유로 취소하고 텍스트를 일반 사용자 턴으로 처리한다([AI 에이전트 노드 「멀티턴」](../CLE-NODE-AI/CLE-NODE-AGENT.md#멀티턴)). 이 결정은 발송 표면만 다룬다. 안내 문구가 이 취소 경로와 맞는지는 [미결 사항](CLE-CHAT-ADAPTER.md#미결-사항) 에 올렸다.
- (c) 이 임시 텍스트는 AI 에이전트 `render_form` 표시물(표시 도구 턴) 표면이다. 모달 격상은 블로킹 Form 노드(`execution.waiting_for_input` form) 표면이라 경로가 다르다. 블로킹 Form 노드는 폼 모드 분기(모달 또는 다단계)를 타고, `render_form` 표시물은 이 임시 텍스트를 유지한다. `ai_message` 표시물 경로의 네이티브 UI 격상은 후속 작업이다.

[채팅 채널](CLE-CHAT-CORE.md) 의 Rationale 에도 이 결정을 가리키는 항목이 있고, 근거는 이 절에 둔다.

### 사용자 입력이 섞이는 본문은 멘션 알림이 울리지 않게 보낸다 (2026-11-14)

2026-11-14 사람 결정이다(NERV 질문 `01a1d93a-a9dc-76d5-95a0-21a4753b0c50` 의 선택지 1, NERV Task `CLE-T-FQTQ7K`). Template 노드는 `{{ }}` 표현식으로 웹훅 본문, 폼 입력 같은 외부 값을 본문에 넣는다. AI 응답에도 사용자 발화나 도구 결과가 그대로 들어갈 수 있다. 그 안의 멘션 문법이 살아 있으면 워크플로우 작성자가 의도하지 않은 알림이 간다. Telegram 렌더러는 MarkdownV2 escape 를 해 왔지만 Slack · Discord 렌더러는 두 본문을 그대로 보냈다.

의무는 이 규약에 두고 방법은 프로바이더 문서에 둔다. Slack 멘션은 꺾쇠 문법이라 `&` · `<` · `>` escape 로 막는다. Discord 는 발송 옵션 `allowed_mentions` 가 있어 글자를 바꾸지 않고 알림만 막는다. 방법이 프로바이더마다 달라 규약은 무엇을 막는지만 정한다.

어댑터 인터페이스는 바꾸지 않았다. Slack 은 렌더러 안에서 escape 하고 Discord 는 API 클라이언트와 인터랙션 응답을 만드는 함수 안에서 `allowed_mentions` 를 붙인다. `renderNode` 시그니처와 어댑터 함수 목록은 그대로라 [R2](CLE-CHAT-ADAPTER-IFACE.md#r2-필수-함수에-ack-와-escapecontroltext-를-따로-둔다) 의 인터페이스 최소주의와 [R-CCA-7](#r-cca-7-rendernode-시그니처를-union-으로-넓혀-내부-이벤트를-받는다) 의 union 입력을 그대로 지킨다. 멘션을 막는 함수를 인터페이스에 따로 두면 모든 프로바이더 계약이 바뀐다. 방법이 프로바이더마다 달라 공통 시그니처로 묶을 이득도 없다. R-CCA-5 가 `renderError` 를 기각한 이유와 같다.

escape 하면 본문이 길어지므로 길이 한도에 맞춘 분할은 escape 한 뒤에 한다. 조각 경계가 escape 결과의 가운데를 지나면 받는 쪽에 깨진 글자가 보이므로 경계를 그 앞으로 당긴다.

대가로 워크플로우 작성자가 일부러 넣은 멘션도 알림이 가지 않고 Slack 에서는 `<url|라벨>` 링크 문법도 글자로 보인다. 사람이 이 대가를 받아들였다. Template 만 막고 AI 응답은 후속 작업으로 미루는 안과 `{{ }}` 치환값만 막는 안은 기각했다. 근거는 [Slack 어댑터 — Web API 와 노드 UI 매핑](CLE-CHAT-SLACK-OUTBOUND.md#rationale) 과 [Discord 어댑터 — API 호출과 UI 매핑](CLE-CHAT-DISCORD-API.md#rationale) 의 Rationale 에 있다.
