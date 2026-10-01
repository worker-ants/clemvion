---
id: "CLE-NODE-OUTPUT"
title: "노드 출력 규약"
type: "convention"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-NODE"
ancestors: ["CLE-VISION", "CLE-NODE"]
area: "CLE-NODE"
content_hash: "658c7bb77c339993bdb0065327c464f517b5ff839b8705f170b9cc8444e2113d"
read_as: "approved"
task: null
source_paths: ["spec/conventions/node-output.md"]
mirror_sha256: "93d6ded88d1bbd464ee1ac8afab9e5a423de8f5b3fe7a229071d3e9262694194"
etag: "sha256-9c00e2b465bedc28476308c07973de5e5db1454b9cedc6571a601ef21f53fe9d"
---
> 구현 상태: 부분 구현 · 원문: `spec/conventions/node-output.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 모든 노드 문서가 따르는 노드 출력 규칙집이다. 노드 핸들러가 돌려주는 노드 출력(node output, `NodeHandlerOutput`)의 다섯 필드가 무엇을 뜻하고 어떤 값을 어디에 두는지 정한다. 각 노드 문서는 출력 절에서 이 규칙을 따르고, 규칙을 벗어나는 곳이 있으면 그 이유와 고칠 방법을 적는다.

설계 목표는 하나다. 워크플로우 작성자가 `$node["노드 이름"].output.*` 로 값을 꺼낼 때 노드 종류를 몰라도 어디에 무엇이 있을지 예측할 수 있어야 한다.

규칙은 Principle 0 부터 Principle 11 까지 번호를 붙인다. 다른 문서는 `[노드 출력 규약 Principle 9](CLE-NODE-OUTPUT.md#principle-9-컨테이너와-parallel-의-출력-덮어쓰기)` 처럼 번호와 앵커로 가리킨다. 번호는 바꾸지 않는다. 전체 목록은 [Principle 요약](#principle-요약)에 있다.

이 문서가 다루지 않는 것은 다음과 같다.

- 엔진이 핸들러를 부르는 순서와 인터페이스: [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md)
- 입력 대기·재개의 상태 전이와 park·rehydration: [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)
- 컨테이너 본문 실행 흐름: [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md)
- 나가는 페이로드의 자격 증명 마스킹 방식: [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)
- 노드가 실패했을 때의 정책(중단·건너뛰기·재시도 등): [노드 에러 처리 정책](CLE-NODE-ERROR.md)
- 저장된 출력이 화면마다 어떻게 되살아나는지: [실행 화면 복원 규약](../CLE-EXEC/CLE-EXEC-HYDRATION.md)

## 규칙

### Principle 0. 노드 출력의 다섯 필드

1. 모든 노드 핸들러는 `{ config, output, meta?, port?, status? }` 형태의 객체를 돌려준다. 다섯 필드의 뜻은 어느 노드에서든 같다.

   | 필드 | 표준 용어 | 뜻 |
   | --- | --- | --- |
   | `config` | 설정 에코(config echo) | 핸들러가 다시 싣는 원문 설정값. 표현식을 평가하기 전 형태다. 저장할 때는 원문 그대로 두고 REST·WebSocket 으로 나갈 때만 가린다([Principle 7](#principle-7-설정-에코-원칙)). |
   | `output` | 출력 값(output value) | 다음 노드에 넘기는 주 데이터. |
   | `meta` | 실행 메트릭 | 소요 시간·상태 코드·토큰·로그 같은 관측 값. |
   | `port` | 출력 포트 선택 | 이번에 활성화할 출력 포트 ID(`string` 또는 `string[]`). |
   | `status` | 흐름 지시 상태 | 엔진 흐름을 바꾸는 값(`waiting_for_input`, `resumed`, `ended` 등). 전체 값 목록은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)에 있다. |

2. 실시간 이벤트는 노드 출력을 통째로 싣는다. WebSocket·EIA 이벤트 봉투의 `output`(`execution.node.*` 이벤트)과 `nodeOutput`(`waiting_for_input` 이벤트)은 노드 출력 전체(= `NodeExecution.outputData`)다. 위 표의 출력 값은 이벤트에서 한 겹 아래 `output.output`, `nodeOutput.output` 에 있다. 이벤트 봉투의 필드 이름이 노드 출력 안의 필드 이름과 우연히 같아서 헷갈리기 쉽다. 이 구분은 이 절이 기준이고 다른 문서([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md), [External Interaction API](../CLE-IX/CLE-EIA.md), [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md), [대화 스레드](../CLE-IX/CLE-IX-THREAD.md))는 이 절을 인용한다.
3. 2번의 구분을 [Principle 8.1](#81-금지-패턴)의 금지 패턴(`output.output.extracted.*`)과 섞지 않는다. 8.1 은 핸들러 반환값 안의 이중 감싸기를 금지하는 규칙이다. 2번은 전송용 이벤트 봉투와 노드 출력이라는 다른 층의 이야기다.
4. EIA·WebSocket 이 `nodeOutput` 을 조립할 때 다섯 필드에 없는 키를 최상위에 얹는다. 이 wire 전용 키는 이 계약 밖이다. 소비처가 그 자리에서 읽기 때문에 얹는다. 현재 8개이고 두 갈래다.

   | 갈래 | 키 | 읽는 쪽 |
   | --- | --- | --- |
   | `wire 전용 (위젯 파서)` | `formConfig` · `conversationConfig` · `buttonConfig` · `interactionType` | `channel-web-chat` 의 `parseWaitingForInput` |
   | `wire 전용 (chat-channel 렌더러)` | `payload` · `title` · `rendered` · `nodeType` | Discord·Telegram·Slack 렌더러(평면 레거시 형태) |

5. 다섯 필드 목록을 넓히지 않는다. wire 전용 키는 핸들러가 만드는 값이 아니라 전송 조립 계층이 만드는 값이다. 정본 목록은 `codebase/backend/src/nodes/core/node-output-allowlist.ts` 의 `NODE_OUTPUT_ALLOWED_KEYS` 다. 컴파일 타임 assertion 이 다섯 필드를 묶고 나머지 8키는 리터럴 테스트가 지킨다. 범위 표는 [응답 자격 증명 마스킹 §3.8](../CLE-API/CLE-API-EGRESS.md#38-외부-nodeoutput-의-fail-closed-허용-목록-2026-08-23-2026-08-24)이 가진다. 갈래 라벨은 그 표와 같은 문구를 쓴다.
6. 내부 최상위 필드 세 개는 다섯 필드 밖 최상위 위치를 예외로 허용한다. `_resumeState`(멀티턴 입력 대기·재개 중 내부 전달), `_resumeCheckpoint`(재시작 뒤 재개용 DB 보존 부분집합), `_retryState`(재시도 가능 에러로 끝날 때 DB 보존)다. 세 필드는 표현식 해석기와 자동완성에 노출하지 않고, 자격 증명 제외 정책도 같다. 자세한 규칙은 [4.2.1](#421-보존-예외--_resumecheckpoint--_retrystate)에 있다.

### Principle 1. 출력 값에는 비즈니스 결과만 둔다

`output` 아래에는 다음 노드가 로직에 쓸 도메인 데이터만 둔다.

| `output` 에 두는 것 | `output` 에 두지 않는 것 |
| --- | --- |
| 응답 본문, 분류 결과, 추출한 필드 | 토큰 수, 소요 시간, HTTP 상태 코드 |
| 렌더링한 표시용 런타임 값 | LLM 모델 이름, 디버그 로그 |
| 사용자 입력, 버튼 클릭 기록 | 실행 횟수, 재시도 횟수 |

실행 메트릭은 [Principle 2](#principle-2-실행-메트릭에는-관측-값만-둔다)에 따라 `meta` 에 둔다.

### Principle 1.1 설정과 출력 값은 겹치지 않는다

사용자가 화면에서 설정한 리터럴 값은 `config` 에만 두고 `output` 에 복사하지 않는다.

#### 1.1.1 규칙

| 값의 성격 | 둘 곳 |
| --- | --- |
| 사용자가 화면이나 스키마로 설정한 리터럴 값(title, submitLabel, layout, chartType, format, columns 정의, fields 정의, systemPrompt, maxTurns, categories 정의 등) | `config` 만 |
| 실행 중에 계산·변형·집계·평가한 값(동적 모드로 만든 items, 평가한 rows, 집계한 차트 데이터, 렌더링한 템플릿 문자열, LLM 응답, 추출한 필드, 정규화한 HTTP 응답) | `output` 만 |
| 사용자 상호작용 데이터(폼 제출, 버튼 클릭, 사용자 메시지) | `output.interaction` |
| 실행 메트릭(소요 시간, 토큰, 상태 코드, rowCount) | `meta`([Principle 2](#principle-2-실행-메트릭에는-관측-값만-둔다)) |

#### 1.1.2 판단 기준

"이 값을 알려면 노드를 실제로 실행해야 하는가?" 로 판단한다.

1. 실행하지 않고 스키마나 설정만 봐도 알 수 있으면 `config` 에 둔다.
2. 실행해야 알 수 있으면(입력·외부 API·사용자 입력에 따라 달라지면) `output` 에 둔다.

#### 1.1.3 적용 예

- `form.config.title = "User Profile"` 은 `output` 에 다시 싣지 않는다. 다음 노드가 필요하면 `$node["F"].config.title` 로 읽는다.
- `carousel.config.layout = "card"` 는 `output` 에 싣지 않는다.
- `chart.config.chartType = "bar"` 는 `output` 에 싣지 않는다. `output.data` 는 입력을 집계한 런타임 값이라 둔다.
- `template.config.content = "Hello {{ name }}"` 는 `output` 에 싣지 않는다. `output.rendered = "Hello Alice"` 는 표현식 해석기가 평가한 결과라 둔다. 이 형태는 [Principle 7](#principle-7-설정-에코-원칙)과 정확히 맞는다. `config` 는 원본 템플릿이고 `output` 은 평가 결과다.
- `loop.config.count = 10` 은 `output` 에 싣지 않는다. 실제로 돈 횟수는 `meta.iterations` 나 `output.iterations.length` 로 읽는다.

#### 1.1.4 `output.view` 판별자는 쓰지 않는다

예전 초안의 `output.view.type = 'form' | 'carousel' | ...` 판별자는 폐기했다. 노드 종류는 `$node["X"]` 로 접근하는 시점에 워크플로우 정의에서 이미 알 수 있다.

### Principle 2. 실행 메트릭에는 관측 값만 둔다

| 분류 | 필수·권장 필드 |
| --- | --- |
| 공통 | `meta.durationMs: number` |
| AI 노드 | 아래 목록 |
| HTTP | `meta.statusCode`, `meta.durationMs` |
| DB | `meta.durationMs`, `meta.rowCount` |
| Code | `meta.durationMs`, `meta.success`, `meta.logs?`. 런타임 에러는 `output.error` 와 `port: 'error'` 로 낸다. `meta.error`, `meta.errorCode` 별칭은 폐기했다. |
| 컨테이너 | `meta.iterations?`, `meta.branches?`, `meta.matchedCount?` |

AI 노드의 `meta` 필드는 다음과 같다.

- `meta.model`, `meta.inputTokens`, `meta.outputTokens`, `meta.totalTokens`
- `meta.thinkingTokens?`, `meta.toolCalls?`
- `meta.contextInjection?`: 대화 스레드를 자동으로 넣었을 때 `{ appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }` 를 싣는다. 자세한 내용은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md)의 cap 절에 있다.
- `meta.memory?`: 메모리 전략(`memoryStrategy`)이 `manual` 이 아닐 때 `{ strategy, summarized, recalledCount, tokenBudgetUsed, compactedMessages? }` 를 싣는다. `ai_agent` 전용이다. `information_extractor` 는 persistent 전략(회수와 추출)을 지원하지만 `meta.memory` 는 싣지 않고 `meta.contextInjection` 만 싣는다. 필드 정의는 [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md), 전략은 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md)가 정한다.

`ai_agent` 가 쓰던 `output.metadata.*` 는 폐지한다. 토큰과 모델 정보는 모두 `meta.*` 에 둔다.

### Principle 3. 에러 계약

#### 3.1 분류

| 종류 | 처리 방식 |
| --- | --- |
| 사전 검증 에러(pre-flight error): 설정 오류, 스키마 검증 실패 등 | `throw`. 엔진이 노드 실행을 실패로 표시한다. |
| 런타임 에러(runtime error): 외부 API 실패, 쿼리 실패, 사설망 차단(SSRF), 통합 자격 증명 해석 실패 등 | `port: 'error'` 와 `output.error` |
| 예상 가능한 비즈니스 실패: 매칭 없음, 빈 결과 등 | 정상 `port` 를 유지하고 결과가 비었음을 드러낸다. |

통합 노드(HTTP Request·Database Query·Send Email)의 사설망 차단(`HTTP_BLOCKED`)과 자격 증명 해석 실패(`INTEGRATION_INCOMPLETE` 등)는 사전 검증 throw 가 아니라 런타임 에러 포트로 보낸다(결정 D4). 설정 형식 자체의 오류(`handler.validate` 실패)만 throw 로 남는다. 자세한 규칙은 [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md)에 있다.

#### 3.2 `output.error` 표준 형태

```json
{
  "output": {
    "error": {
      "code": "HTTP_5XX" | "DB_QUERY_FAILED" | "LLM_TIMEOUT" | ...,
      "message": "사람이 읽는 메시지",
      "details": { /* 3.2.1 공통 표준 필드 + 3.2.2 노드별 필드 */ }
    }
  },
  "port": "error"
}
```

1. `code` 는 `UPPER_SNAKE_CASE` 로 쓴다. 노드 취소로 끝난 경우의 `AbortError` 는 웹 표준 이름을 그대로 쓰는 예외다. 예외 목록과 근거는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md), 취소 규약은 [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)에 있다.
2. `message` 는 영문 원문이다. 로그와 디버깅의 기준이다. 사용자에게 보이는 곳의 한국어 표시는 프론트엔드가 `code` 를 키로 `ERROR_KO` 매핑을 적용한다. 코드 기반 현지화 정책과 적용 범위는 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md)의 Principle 3-C 가 정한다. `ErrorCode` enum 전체에 강제하지 않고, 매핑이 없으면 영문을 그대로 보인다.
3. `details` 는 두 층이다. 3.2.1 공통 표준 필드(AI 노드만 필수)와 3.2.2 노드별 선택 스키마다.

#### 3.2.1 `details` 의 공통 표준 필드

| 필드 | 타입 | 노드별 의무 | 뜻 |
| --- | --- | --- | --- |
| `retryable` | `boolean` | AI 노드(`ai_agent`, `text_classifier`, `information_extractor`)는 필수. 다른 노드는 선택(점진 채택). | 이 에러가 일시적이라 같은 호출을 다시 하면 성공할 수 있는지. `true` 는 HTTP 429, 5xx, 네트워크 타임아웃 같은 일시 장애다. `false` 는 인증 실패, 스키마 치명 오류, 사용자 취소 같은 근본 원인이다. AI 노드마다 분류가 갈린다. [미결 사항](#미결-사항) 참조. |
| `retryAfterSec` | `number` | 선택(AI 노드와 그 밖의 노드 모두) | 프로바이더가 `Retry-After` 헤더나 같은 신호를 준 경우의 권장 대기 시간(초). `retryable === true` 일 때만 채울 수 있다. `false` 와 함께 채우면 규약 위반이다. 이 불변식의 기준은 이 절이다. |

`retryable=true` 인 노드는 화면에 인라인 `[다시 시도]` 버튼과 `retryAfterSec` 카운트다운이 보인다. 예를 들어 AI 에이전트 멀티턴 대화 스레드의 `system_error` 항목이다([대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md)).

#### 3.2.2 `details` 의 노드별 선택 스키마

3.2.1 공통 필드 밖의 추가 메타는 각 노드 문서의 `output.error.details` 표가 정한다.

- AI 에이전트: `provider`, `statusCode`([AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md))
- HTTP Request: `responseHeaders`, `responseBody` 일부
- Database Query: `pgErrorCode`, `query`

AI 노드가 아닌 노드에서 `retryable`·`retryAfterSec` 는 선택이다. 쓰는 경우 이 절의 뜻을 따른다.

#### 3.3 에러 포트가 있는 노드

1. 다음 노드에는 고정 에러 포트(`error`)가 반드시 있다: `http_request`, `database_query`, `send_email`, `cafe24`, `makeshop`, `ai_agent`, `information_extractor`, `text_classifier`, `code`, `workflow`(서브 워크플로우 실패 시).
2. `transform`, `if_else`, `switch` 같은 노드는 설정 검증만 하고 실패하면 throw 한다. 런타임 에러 포트가 없다.
3. 이 가운데 AI 노드(`ai_agent`, `text_classifier`, `information_extractor`)는 에러로 끝날 때 `output.error.details.retryable` 을 분류할 의무가 있다. 기준은 [3.2.1](#321-details-의-공통-표준-필드)이다.
4. 포트 구성의 기준은 각 노드 문서의 포트 절이다. 에러 처리 정책으로 생기는 동적 에러 포트는 [노드 에러 처리 정책](CLE-NODE-ERROR.md)이 다룬다.

### Principle 4. 블로킹과 재개 계약

#### 4.1 상태 전이

블로킹 노드(Form 노드, 버튼이 있는 Presentation 노드, 멀티턴 AI 노드)는 아래처럼 흐름 지시 상태를 바꾼다.

```mermaid
stateDiagram-v2
    state "입력 대기 (waiting_for_input)" as W
    state "재개 출력 (resumed)" as R
    state "대화 종료 (ended)" as E
    [*] --> W: 블로킹 노드 도달
    W --> R: 사용자 입력 수신
    R --> [*]: 선택한 포트로 진행
    R --> W: 멀티턴 다음 턴
    R --> E: 멀티턴 종료 조건 도달
    E --> [*]
```

1. 블로킹 노드에 도달하면 `status: "waiting_for_input"` 을 돌려주고 엔진이 실행을 멈춘다. `output` 에는 이 시점에 계산한 런타임 값만 둔다([Principle 1.1](#principle-11-설정과-출력-값은-겹치지-않는다), [4.3](#43-입력-대기-상태의-출력-값-노드별)).
2. 사용자 입력을 받으면 `status: "resumed"` 로 통일한다. `output` 은 입력 대기 시점 값을 그대로 두고 `interaction` 을 더한다. `interaction` 은 `type`(`form_submitted`, `button_click`, `button_continue`, `message_received`), `data`(type 별 형태), `receivedAt`(ISO 8601)이다.
3. 멀티턴 AI 노드가 종료 조건에 닿으면 `status: "ended"` 를 돌려준다. `port` 는 조건 ID 이거나 시스템 포트(`user_ended`·`max_turns`·`error`, 정보 추출기는 `completed` 도)다. `output` 은 `{ result: {...} }` 또는 `{ error: {...} }` 다. 멀티턴 AI 에이전트에는 `out` 포트가 없다. 노드별 종료 포트는 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)와 [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md)의 포트 절이 정한다.
4. 상태가 바뀌는 시점과 엔진이 하는 일(park, 저장, 재구성)은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)가 정한다.

#### 4.2 폐기할 필드 / 구조

- `_multiTurnState` 는 `_resumeState` 로 바꿨다. 노출하지 않는 내부 필드다.
- Form 의 `output.submittedData` 는 `output.interaction.data` 로 옮긴다.
- Carousel·Chart·Table·Template 의 `output.previousOutput` 은 없앤다. 이전 표시 정보는 `config` 와 `output` 의 런타임 필드를 조합해 다시 만들 수 있다([Principle 1.1](#principle-11-설정과-출력-값은-겹치지-않는다)). 과도기 예외가 하나 있다. Presentation 재개 경로(`ButtonInteractionService`)는 재개 출력에 `previousOutput`(중첩 체인은 걷어 낸 것)을 과도기 레거시 필드로 남긴다. Phase 3 정리 때 없앤다. 기준은 코드 주석이다.
- 초안의 `output.view` 감싸기 객체는 폐기했다([1.1.4](#114-outputview-판별자는-쓰지-않는다)). 런타임 값은 `output` 최상위에 바로 둔다.
- 초안의 `output.view.type` 판별자는 폐기했다. 노드 유형은 워크플로우 정의에서 안다.
- Presentation 노드의 `output.type: 'carousel' | 'table' | ...` 판별자는 폐기했다. 이유는 같다.
- Carousel·Table·Chart 의 `output.rendered`(HTML·SVG 스냅샷)는 폐기했다. 화면이 `output` 런타임 필드와 `config` 로 직접 그린다([Table 노드](../CLE-NODE-PRES/CLE-NODE-TABLE.md), [Chart 노드](../CLE-NODE-PRES/CLE-NODE-CHART.md)). Template 의 `output.rendered` 는 표현식을 평가한 결과라 남는다([1.1.3](#113-적용-예)).

#### 4.2.1 보존 예외 — `_resumeCheckpoint` / `_retryState`

`_resumeState` 전체는 DB 에 저장할 때 `stripControlFields()` 가 반드시 지운다. 그 자격 증명 제외 부분집합인 `_resumeCheckpoint` 와 `_retryState` 는 지우지 않고 `NodeExecution.outputData` 안에 남긴다.

| 필드 | 제거 정책 | 저장 위치 |
| --- | --- | --- |
| `_resumeState` | DB 저장 때 반드시 지운다. 자격 증명·원본 설정·턴 디버그를 담을 수 있다. | 한 턴을 처리하는 세그먼트 안에서만 메모리에 있다. 입력 대기에 들어가면 세그먼트가 끝나므로 턴 사이에는 남지 않는다. 다음 턴은 `_resumeCheckpoint` 에서 다시 만든다. |
| `_resumeCheckpoint` | 입력 대기에 들어갈 때와 매 턴 저장할 때 남긴다. `_resumeState` 의 자격 증명 제외 부분집합이다. | `NodeExecution.outputData._resumeCheckpoint`(DB JSONB) |
| `_retryState` | 재시도 가능 에러로 끝날 때 남긴다. `output.error.details.retryable === true` 일 때만 `buildMultiTurnFinalOutput` 이 싣는다. | `NodeExecution.outputData._retryState`(DB JSONB). 아래 주석 참고. |

`_retryState` 의 저장 위치는 원본 행 기준이다. 마지막 턴 재시도(`retry_last_turn`)가 새로 만드는 재진입 행에는 같은 키가 `inputData._retryState` 로 들어간다. 이 값은 보존 대상이 아니라 중복 배달을 막는 표시다. `applyRetryLastTurn` 이 조건부 UPDATE 로 이 키를 원자적으로 소비하고, 소비하면 곧 사라진다. 그래서 "`_retryState` 는 `outputData` 에만 있다" 는 말은 원본 행에만 맞다. 소비 절차는 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)에 있다.

`_resumeCheckpoint` 의 규칙은 다음과 같다.

1. 서버가 다시 시작되거나 다른 인스턴스에서 재개할 때(rehydration) 쓰도록 항상 저장한다. 적용 노드와 필드 합집합은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)에 있다.
2. `_retryState` 와 같은 부분집합, 같은 마스킹 정책을 쓴다. 다만 `expiresAt`(TTL)과 `lastUserMessage` 가 없다. 재개는 도착한 사용자 메시지를 그대로 처리하고, 오래 쉰 뒤에도 가능하다.
3. 스키마가 바뀔 때를 대비해 `schemaVersion`(정수)을 함께 싣는다. 재개할 때 이 값이 현재 코드가 지원하는 버전보다 크면 안전하게 초기화한다.
4. 값이 없거나 손상됐거나 미래 버전이면 안전하게 초기화한다(`RESUME_INCOMPATIBLE_STATE`). 다시 만들 때 핵심 필드가 비어 있으면 기본값으로 채운다.
5. 재구성 로직(`buildRetryReentryState`)은 `_retryState` 와 함께 쓴다.

`_retryState` 의 규칙은 다음과 같다.

1. 필드는 `_resumeState` 와 같은 형태(messages, turnCount, model, temperature, maxTokens, knowledgeBases, RAG, MCP, pendingFormToolCall? 등)에 세 필드를 더한다.
   - `expiresAt`: ISO 8601. TTL 기본 60분.
   - `lastUserMessage?`: 실패한 턴의 사용자 메시지 원문. `truncateForErrorDetails(500)` 로 자른다. 재진입할 때 다시 보내는 데 쓴다. `_resumeState.messages` 는 턴 직전 스냅샷이라 실패한 메시지를 담지 않으므로 따로 둔다.
   - `lastUserMessageSource?`: `'ai_message'` 또는 `'form_submitted'`. 다시 보낼 메시지의 출처다.
2. 자격 증명은 `_resumeState` 와 같은 방식으로 뺀다. 옮길 키를 `buildRetryState`·`buildResumeState` 가 나열하는 allow-list 방식이라 처음부터 들어가지 않는다.
3. 표현식 해석기와 자동완성에 노출하지 않는다.
4. `lastUserMessage` 가 없으면(옛 페이로드) 다시 보내지 않고 대기 루프에 들어간다.
5. 소비: WebSocket 명령 `execution.retry_last_turn`([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md))이 `nodeExecutionId` 로 `_retryState` 를 찾는다. `expiresAt` 을 확인하고 새 노드 실행 행을 만들어 멀티턴 루프에 다시 들어간다. TTL 이 지났거나 이미 소비한 `_retryState` 는 `RETRY_STATE_NOT_FOUND` 로 응답한다.

자세한 흐름은 [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md)와 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)에 있다.

#### 4.3 입력 대기 상태의 출력 값 (노드별)

`output` 에는 이 실행 시점에 계산한 런타임 값만 둔다. 리터럴 설정 필드는 다시 싣지 않는다([Principle 1.1](#principle-11-설정과-출력-값은-겹치지-않는다)).

| 노드 | 입력 대기 `output` | 런타임 필드 설명 |
| --- | --- | --- |
| `form` | `{}` | 폼을 그리는 데 계산할 값이 없다. fields, title, submitLabel 은 모두 `config` 에서 읽는다. |
| `carousel`(정적 모드) | `{}` | `items` 가 리터럴 설정이다. 다음 노드는 `config.items` 를 읽는다. |
| `carousel`(동적 모드) | `{ items }` | `source` 표현식을 해석하고 `titleField`·`descriptionField`·`imageField` 로 매핑해 실행 중에 만든 배열. `config.items` 와 별개다. |
| `table` | `{ rows, totalRows, columns? }` | `rows` 는 정적 모드면 `columns[*].field` 기준으로 걸러 낸 행, 동적 모드면 `dataSource` 항목마다 평가한 행이다. `totalRows` 는 출력 크기 한도를 적용하기 전 데이터셋 크기(pageSize·정렬 적용 후)다. `columns` 는 동적 모드에서 `label` 표현식을 평가한 컬럼이다. 기준은 [Table 노드](../CLE-NODE-PRES/CLE-NODE-TABLE.md)다. |
| `chart` | `{ data }` | 입력을 xAxis 기준으로 실행 중에 집계한 `[{x, y}, ...]`. chartType, title 은 `config` 에 있다. |
| `template` | `{ rendered }` | 템플릿 문자열을 엔진의 표현식 해석기로 평가한 결과. `content`, `format` 은 `config` 에 있다. |
| `ai_agent`(멀티턴) | `{ result: { messages, message, turnCount } }` | 도메인 결과는 `output.result.*` 아래에 모은다. `messages` 는 대화 누적, `turnCount` 는 지금까지 진행한 턴 수다. `maxTurns` 는 설정 전용이라 싣지 않는다. 진행률은 화면이 `config.maxTurns` 를 직접 읽는다. |
| `information_extractor`(멀티턴) | `{ result: { messages, message, turnCount }, partial? }` | 위와 같고, 부분 수집한 추출 필드가 있으면 `output.partial.*` 에 둔다. `maxTurns` 는 싣지 않는다. |

#### 4.4 재개 출력의 출력 값

입력 대기 시점의 `output` 을 그대로 두고 `output.interaction` 을 더한다.

```json
{
  "output": {
    "...": "입력 대기 시점과 같은 런타임 필드",
    "interaction": {
      "type": "form_submitted" | "button_click" | "button_continue" | "message_received",
      "data": { /* interaction type 별 형태, 4.5 참조 */ },
      "receivedAt": "2026-04-19T12:34:56.789Z"
    }
  },
  "status": "resumed",
  "port": "<선택된 포트>"
}
```

#### 4.5 `interaction.data` 형태

| `interaction.type` | `data` 형태 | 적용 노드 |
| --- | --- | --- |
| `form_submitted` | `{ [fieldName]: value, via?: 'ai_render' }`. 제출한 필드 값이다. `via: 'ai_render'` 표시는 AI 에이전트의 `render_form` 도구 응답일 때만 붙는다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)). | `form`, `ai_agent`(`render_form`) |
| `button_click` | `{ buttonId, buttonLabel, selectedItem? }` | `carousel`, `table`, `chart`, `template` |
| `button_continue` | `{ buttonId, buttonLabel, url?, selectedItem? }`. `url` 은 링크 버튼 URL 이 있을 때, `selectedItem` 은 Carousel 항목 버튼일 때만 싣는다(`ButtonInteractionService`). | Presentation 노드 링크 버튼의 계속 포트 |
| `message_received` | `{ content, role: "user" }` | `ai_agent`, `information_extractor` 멀티턴. 이 재개 스냅샷은 AI 경로에서 아직 내보내지 않는다(미구현). 기준은 [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md)다. |

이 `interaction` 은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md)에 자동으로 쌓인다. 뒤에 오는 AI 에이전트 노드는 대화 맥락 설정(`contextScope`)으로 이것을 자동으로 받아 쓸 수 있다.

### Principle 5. 출력 포트 선택 모델

| 형태 | 뜻 | 쓰는 노드 |
| --- | --- | --- |
| `port: undefined` | 기본 단일 출력. 노드 정의상 출력이 1개다. | `transform`, `manual_trigger` |
| `port: string` | 여러 출력 가운데 하나를 고른다. | `if_else`, `switch`, `http_request`, `database_query`, `send_email`, `ai_agent` 등 |
| `port: string[]` | 여러 출력을 동시에 활성화한다(fan-out). | `parallel`(핸들러), `text_classifier`(다중 레이블) |

`port` 에는 출력 포트 ID 만 쓴다. 예를 들어 `ai_agent` 가 `output.port` 로 조건 ID 를 고르던 방식은 [Principle 8](#principle-8-불필요한-중첩을-없앤다)과 함께 없앤다.

### Principle 6. 동적 포트 ID 이름

1. 전역 버튼은 `config.buttons[i].id` 를 그대로 쓴다. 사용자가 설정한 ID 다.
2. 항목 버튼(Carousel 정적 모드 등)은 `${buttonId}__item_${index}` 를 쓴다. Carousel 이 쓰던 접미사를 공식 규칙으로 올린 것이다. 엔진은 `__item_\d+$` 부분을 떼어 원래 포트로 보낸다.
3. 시스템 포트 예약어는 `out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue` 다. 사용자가 설정한 ID 가 이 값과 겹치면 거부한다. 예약어 집합과 거부하는 계층은 노드마다 다르게 적혀 있다. [미결 사항](#미결-사항) 참조.
4. 설정 항목이 있는 동적 포트(Switch 케이스, 분류 카테고리, 조건, 버튼)는 항목이 가진 고정 ID(slug)를 포트 ID 로 쓴다. 형식이 맞지 않을 때만 `<prefix>_<index>` 형태의 인덱스 fallback(`case_0`, `class_0` 등)으로 떨어진다. Parallel 분기 포트는 `branch_0`, `branch_1` 처럼 `<prefix>_<index>` 형식이다. 생성과 검증 규칙은 [노드 시스템 구조와 카탈로그](CLE-NODE-ARCH.md#포트-정의-portdef)가 정한다.

### Principle 7. 설정 에코 원칙

`NodeHandlerOutput.config` 에는 워크플로우 작성자가 설정한 원본 값(표현식 평가 전)을 그대로 싣는다. 표현식(`{{ ... }}`)이 들어간 필드는 평가 전 형태를 싣고, 평가 결과는 `output.*` 에 둔다.

다음 노드는 두 경로를 다르게 쓴다.

- `$node["X"].config.<field>`: 노드를 어떻게 설정했는가(원본 템플릿)
- `$node["X"].output.<field>`: 노드가 실제로 무엇을 만들고 썼는가(평가 결과)

규칙은 다음과 같다.

1. 마스킹은 나가는 곳(egress)에서만 한다. 표현식은 원문을 읽는다. `config` 는 `NodeExecution.outputData` 에 원문으로 저장하고, REST 응답(`redactStoredDataForResponse`)과 WebSocket 전송(`maskWireEnvelope`)에서만 가린다. 두 경로 모두 공용 `deepRedactSecrets*` 를 쓴다. 방식은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)이 정한다.
2. 그래서 핸들러가 `config` 에 시크릿 평문을 싣지 않는 것이 상시 불변식이다. egress 가 가리는 것은 키 이름으로 알아보는 값뿐이고, DB 와 표현식은 원문을 본다.
3. `config` 와 `output` 이 겹치지 않는 것은 [Principle 1.1](#principle-11-설정과-출력-값은-겹치지-않는다)의 핵심 전제다. 핸들러가 `context.rawConfig` 를 다시 싣는 방식으로 이를 지킨다. 엔진 쪽 요구는 [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md)의 `ENG-RC-*`, 인터페이스는 [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md)에 있다.

항상 싣는 값은 사용자가 화면에서 설정한 비민감 값이다. 원본 형태로 싣는다.

- `method`, `url`(자격 증명을 뺀 원본), `queryType`, `mode`, `model`, `systemPrompt`(원본, `{{ }}` 포함 가능), `userPrompt`(원본), `subject`(원본), `body`(원본), `code`(원본 사용자 코드 본문, `code.config.code`), `fields`, `title`, `submitLabel`, `layout`, `items`, `columns`, `chartType`, `conditions`, `categories`, `iterationLimit`, `branchCount`, `maxTurns`, `maxCollectionRetries`, `outputFormat` 등.

`code.config.code` 는 `systemPrompt`·`userPrompt`·`body` 와 같은 부류인 사용자가 쓴 원본 텍스트다. `config.code` 에 그대로 싣는다(디버깅과 다음 노드 참조용, 비민감). 코드가 `expression-exclusions` 에 올라 있는 것은 표현식 평가 대상에서 뺀다는 뜻일 뿐이다. 싣지 않는다는 뜻이 아니다. 기준은 [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md)다.

절대 싣지 않는 값은 다음과 같다.

- 자격 증명(password, apiKey, token, secret, OAuth 자격 증명)
- URL 에 박힌 자격 증명. `https://user:pass@host` 는 `https://host` 로 정리한다.
- 파일 업로드 원본 바이너리. 참조만 싣는다.

egress 값 마스킹이 이 금지를 한 번 더 막는다. 위 금지는 핸들러의 의무지만 핸들러가 놓치거나 자유 텍스트 필드(`code`, `systemPrompt`, `body` 등) 안에 자격 증명 리터럴이 들어 있으면 잡지 못한다. 그래서 `outputData` 가 응답이나 이벤트로 나갈 때 자격 증명 값 패턴(`Bearer …`, 자격 증명이 든 URI 등)을 `***` 로 바꾼다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md), [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)). 이는 "그대로 싣는다" 원칙의 예외가 아니다. 금지 목록이 이미 자격 증명을 에코 대상에서 뺐고, 마스킹은 그 규칙을 나가는 곳에서 한 번 더 지키는 방어층이다. 자격 증명이 아닌 설정(코드 로직, 프롬프트 본문, 필드 정의)은 바뀌지 않고 실린다. DB 는 원문을 그대로 둔다. 마스커와 스캐너의 깊이 상한, 경계 연산자, 표시 좌표계는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)이 정한다.

크기가 큰 값도 싣는다.

- `form.config.fields` 가 아주 커도 그대로 싣는다. 정의상 구조 정보다.
- `ai_agent.config.systemPrompt` 가 수천 줄이어도 그대로 싣는다. 디버깅에 쓴다.

원본 설정과 평가 결과의 관계는 다음과 같다([Principle 1.1](#principle-11-설정과-출력-값은-겹치지-않는다) 재확인).

- 원본 설정 필드는 `output` 에 복사하지 않는다.
- 표현식 평가 결과는 `output.*` 에 한 번만 둔다. 이름은 [8.2](#82-통일된-1차-이름)의 카테고리별 원칙을 따른다.
- 표현식을 쓰지 않는 필드(예: `mode`, `chartType`)는 원본과 평가 결과가 같다.

`context.rawConfig` 의 변경을 막는 규칙은 다음과 같다.

1. 엔진은 `Object.freeze` 를 적용한 얕은 스냅샷을 넘긴다. 최상위 필드를 바꾸면 strict 모드에서 TypeError 가 난다.
2. 얕은 동결이다. `rawConfig.headers.foo = '...'` 같은 중첩 객체 변경은 막지 못한다. 핸들러는 rawConfig 를 읽기 전용으로 다루고, 바꿔야 하면 `structuredClone` 으로 복제한다.

설정 에코는 키를 하나씩 나열해서 만든다(결정 D1).

1. 권장 방식은 비민감 필드를 하나씩 적는 것이다.

   ```ts
   return {
     config: {
       integrationId: context.rawConfig?.integrationId,
       to: context.rawConfig?.to,
       subject: context.rawConfig?.subject,
       // ... 비민감 필드를 하나씩 적는다
     },
     output: { /* ... */ },
   };
   ```

2. spread 로 싣지 않는다. `{ ...context.rawConfig }` 나 `{ ...rawConfig, ...overrides }` 형태를 금지한다. 이유는 [Rationale](#rationale)에 있다.
3. 기준 구현은 `background.handler.ts` 의 명시 나열 블록(`notes`, `notifyOnFailure`, `maxDurationMs` 만 나열)이다. `background.handler.spec.ts` 의 자격 증명 누출 방지 테스트가 이를 강제한다. 이 테스트는 rawConfig 에 가상의 `apiKey` 를 넣어도 에코에 새지 않는지 확인한다.
4. 모든 노드 핸들러는 스키마의 비민감 필드를 항상 싣는다. 값이 `undefined` 여도 키를 둔다. 다음 노드의 누락은 이 규칙에 맞게 보강할 대상이다: `switch.hasDefault`, `if-else.strictComparison`, `map.errorPolicy`, `foreach.errorPolicy`, `carousel.maxItems`, `chart.dataField`·`groupBy`·`colors`, `template.helpers`, `table.pagination`, `variable-modification.recordValues` 등. 이 규칙과 다르게 적은 노드 문서가 있다. [미결 사항](#미결-사항) 참조.

핸들러 구현 예는 다음과 같다. 핸들러는 `context.rawConfig` 를 싣고, 평가한 값으로 동작한다.

```ts
async execute(input, config /* 평가된 설정 */, context /* { rawConfig, ... } */) {
  const evaluatedSubject = config.subject as string;          // "Hello Alice"
  const evaluatedBody = config.body as string;
  await sendMail({ subject: evaluatedSubject, body: evaluatedBody, ... });

  return {
    config: {
      // 원본을 싣는다. 사용자가 표현식으로 썼다면 "{{ name }}" 그대로.
      integrationId: context.rawConfig?.integrationId,
      to: context.rawConfig?.to,
      subject: context.rawConfig?.subject,                    // "Hello {{ name }}"
      body: context.rawConfig?.body,
      bodyType: context.rawConfig?.bodyType,
    },
    output: {
      messageId: info.messageId,
      // 평가한 값. 다음 노드가 실제로 보낸 내용을 읽는다.
      subject: evaluatedSubject,
      body: evaluatedBody,
      bodyType: config.bodyType,
    },
  };
}
```

### Principle 8. 불필요한 중첩을 없앤다

#### 8.1 금지 패턴

- `output.output.extracted.*`(`information_extractor` 가 쓰던 형태)
- `output.data.*` 를 본 결과의 1차 감싸기 객체로 쓰는 것(`ai_agent` 조건 분기가 쓰던 형태)
- `output.metadata.tokens`(`ai_agent` 가 쓰던 형태). `meta.tokens` 로 옮긴다.

#### 8.2 통일된 1차 이름

| 개념 | 둘 곳 |
| --- | --- |
| LLM 응답 텍스트·객체 | `output.result.response`(`ai_agent`) |
| 분류한 카테고리 | `output.result.category`(단일), `output.result.categories`(다중) |
| 추출한 필드 | `output.result.extracted` |
| HTTP 응답 본문 | `output.response`(관용이라 그대로 둔다)와 `output.responseHeaders` |
| HTTP 요청 본문(평가 결과) | `output.requestBody`, `output.requestBodyType`. 원본은 `config` 에 있다([Principle 7](#principle-7-설정-에코-원칙)). |
| DB 쿼리 결과 | `output.rows`, `output.rowCount`, `output.fields`, `output.insertId?`(그대로 둔다) |
| 이메일 전송 결과 | `output.messageId`, `output.accepted`, `output.rejected`, `output.subject`, `output.body`, `output.bodyType`. subject·body 원본은 `config` 에 있다. |
| 코드 실행 결과(사용자 `return` 값) | `output` 최상위. Code·Transform 은 `output.result` 로 감싸지 않는다. 사용자 코드나 연산이 형태를 정하기 때문이다. |
| 표시용 런타임 필드 | `output.items`(Carousel 동적 모드), `output.rows`·`output.totalRows`(Table), `output.data`(Chart), `output.rendered`(Template). 빈 출력(`{}`)은 Form 과 Carousel 정적 모드다. 자세한 형태는 [4.3](#43-입력-대기-상태의-출력-값-노드별)에 있다. |

`output.result` 감싸기는 AI 노드(`ai_agent`, `text_classifier`, `information_extractor`)에만 쓴다. 이 세 노드만 도메인 결과를 `output.result` 아래에 모은다. Code·Transform 은 사용자가 형태를 정하므로 `output` 최상위에 바로 둔다. 기준은 [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md)와 [Transform 노드](../CLE-NODE-DATA/CLE-NODE-TRANSFORM.md)다.

### Principle 9. 컨테이너와 Parallel 의 출력 덮어쓰기

컨테이너(Loop·ForEach·Map)와 Parallel 은 핸들러가 돌려준 `output` 과, 엔진이 반복·병렬 실행을 마친 뒤 덮어쓰는 `output` 이 다르다. 이 엔진 덮어쓰기(engine override)의 규칙을 정한다. 본문 실행 흐름은 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md)에 있다.

#### 9.1 계약

1. 입력을 그대로 출력 값에 복사하는 pass-through 는 혼란을 주므로 금지한다.
2. 핸들러가 `output: null` 을 돌려주면 엔진이 반드시 덮어쓴다.
3. 핸들러가 null 이 아닌 값을 돌려줄 때 엔진이 덮어쓰는지는 정의가 갈린다. [미결 사항](#미결-사항) 참조.

#### 9.2 노드별 최종 출력 값

| 노드 | 엔진이 덮어쓰는 최종 `output` |
| --- | --- |
| `loop` | `{ iterations: [...], count: N }`. 반복 회차마다 본문 결과를 담는다. |
| `foreach` | `{ items: [...], count: N }`. 항목마다 처리 결과를 담는다. |
| `map` | `{ mapped: [...], count: N }`. 변환 결과 배열이다. |
| `parallel` | `{ branches: [branch_0_result, branch_1_result, ...], count: N }` |

배열 키(컬렉션 키)는 노드마다 다르다. 다음 노드는 `$node["X"].output.<컬렉션 키>[i]` 와 `$node["X"].output.count` 로 읽는다.

#### 9.3 반복 중 접근

1. 본문 안에서 `$loop.index`, `$loop.iteration`, `$loop.isFirst`, `$loop.isLast` 는 그대로 쓴다.
2. `$item`, `$itemIndex` 도 그대로 쓴다. [Principle 4](#principle-4-블로킹과-재개-계약)와 관계없다.

변수 표면의 기준은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md)다.

### Principle 10. 비었거나 null 인 입력의 대체 값

| 입력 상태 | 기대 동작 |
| --- | --- |
| 배열을 기대한 필드가 `undefined` 또는 `null` | `[]` 로 대체한다. throw 하지 않는다. |
| 객체를 기대한 필드가 `undefined` 또는 `null` | `{}` 로 대체한다. throw 하지 않는다. |
| 배열을 기대한 필드가 원시값(숫자·문자열) | 정의가 갈린다. [미결 사항](#미결-사항) 참조. |
| 필수 설정 필드가 없음 | throw(사전 검증 에러, [3.1](#31-분류)) |

Filter 노드가 배열이 아닌 입력에 throw 하는 현재 동작은 유지한다. 명백한 사용자 실수이기 때문이다. `null`·`undefined` 는 `[]` 로 처리한다.

### Principle 11. 출력 예시 작성 규칙

각 노드 문서의 출력 절은 아래 형식으로 쓴다.

````markdown
### Case: <케이스 이름>

```json
{
  "config": { ... },
  "output": { ... },
  "meta": { ... },
  "port": "...",
  "status": "..."
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| output.result.X | ... | ... |
````

1. JSON 예시에서 `undefined` 필드는 빼고 쓴다.
2. 선택 필드는 표에 `?` 를 붙인다.
3. 케이스(성공, 에러, 재개 등)마다 따로 쓴다.
4. 다섯 필드 밖의 최상위 키를 쓰지 않는다([Principle 0](#principle-0-노드-출력의-다섯-필드)의 내부 필드 예외는 제외).

## Principle 요약

| # | 한 줄 요약 | 주로 영향받는 노드 |
| --- | --- | --- |
| [0](#principle-0-노드-출력의-다섯-필드) | 다섯 필드 고정 | 모든 노드 |
| [1](#principle-1-출력-값에는-비즈니스-결과만-둔다) | `output` 에는 비즈니스 데이터만 | ai_agent |
| [1.1](#principle-11-설정과-출력-값은-겹치지-않는다) | `config` 와 `output` 은 겹치지 않는다 | form, carousel, chart, template, ai_agent(멀티턴), information_extractor(멀티턴), manual_trigger, loop, parallel, workflow |
| [2](#principle-2-실행-메트릭에는-관측-값만-둔다) | `meta` 에는 실행 메트릭만 | ai_agent, text_classifier, code |
| [3](#principle-3-에러-계약) | 에러 계약 통일 | send_email, code, transform |
| [4](#principle-4-블로킹과-재개-계약) | 블로킹·재개 구조 통일 | form, carousel, chart, table, template, ai_agent(멀티턴), information_extractor(멀티턴) |
| [5](#principle-5-출력-포트-선택-모델) | `port` 활성화 모델 | 동적 포트가 있는 모든 노드 |
| [6](#principle-6-동적-포트-id-이름) | 동적 포트 이름 | carousel, ai_agent, switch, text_classifier |
| [7](#principle-7-설정-에코-원칙) | 설정 에코 원칙 | http_request, ai_agent, database_query |
| [8](#principle-8-불필요한-중첩을-없앤다) | 중첩 제거 | information_extractor, ai_agent |
| [9](#principle-9-컨테이너와-parallel-의-출력-덮어쓰기) | 엔진 덮어쓰기 계약 | loop, foreach, map, parallel |
| [10](#principle-10-비었거나-null-인-입력의-대체-값) | null·빈 입력 대체 값 | filter, foreach, split, map, merge |
| [11](#principle-11-출력-예시-작성-규칙) | 출력 예시 작성 규칙 | 모든 노드(문서 수준) |

## 미결 사항

- **엔진이 null 이 아닌 핸들러 출력도 덮어쓰는가(Principle 9.1)**: 이 규약의 옛 서술은 "핸들러가 null 을 돌려주면 엔진이 반드시 덮어쓰고, null 이 아닌 값을 돌려주면 덮어쓰지 않는다" 이다. [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md)의 컨테이너 출력 절, [ForEach 노드](../CLE-NODE-LOGIC/CLE-NODE-FOREACH.md), [Map 노드](../CLE-NODE-LOGIC/CLE-NODE-MAP.md)는 핸들러가 시작 시점에 본문에 나눠 줄 `items[]`(null 이 아님)를 돌려주고, 끝나면 엔진이 핸들러를 다시 부르지 않고 `{ items|mapped, count }` 로 무조건 덮어쓴다고 적는다(결정 D2). 옛 서술대로 구현하면 ForEach·Map 의 최종 `output` 이 원래 배열로 남는다. [Loop 노드](../CLE-NODE-LOGIC/CLE-NODE-LOOP.md)는 핸들러가 `null` 을 돌려준다. 결정 필요: "컨테이너와 Parallel 은 반환값과 상관없이 덮어쓴다" 로 이 규약을 고칠지.
- **배열을 기대한 필드에 원시값이 들어올 때(Principle 10)**: 이 규약의 옛 서술은 숫자·문자열이 들어오면 타입 불일치로 throw 하라고 한다. [Filter 노드](../CLE-NODE-LOGIC/CLE-NODE-FILTER.md)만 그렇게 한다. [Split 노드](../CLE-NODE-LOGIC/CLE-NODE-SPLIT.md), [Map 노드](../CLE-NODE-LOGIC/CLE-NODE-MAP.md), [ForEach 노드](../CLE-NODE-LOGIC/CLE-NODE-FOREACH.md)는 배열이 아닌 값을 모두 `[]` 로 바꾸고, [Merge 노드](../CLE-NODE-LOGIC/CLE-NODE-MERGE.md)는 `null`·`undefined`·원시값을 `[input]` 으로 감싸며, 모두 Principle 10 을 근거로 든다. 문자열이 들어오면 규약대로면 실패하고 노드 문서대로면 0회 실행으로 조용히 지나간다. Merge 입력이 설정 필드가 아니라서 이 원칙의 적용 대상인지도 불분명하다. 결정 필요: 원칙에 노드별 예외를 적을지, 세 노드 문서와 구현을 규약에 맞출지.
- **설정 에코에서 빼는 필드(Principle 7)**: 이 규약은 비민감 스키마 필드를 모두 항상 싣는다고 정한다. [Loop 노드](../CLE-NODE-LOGIC/CLE-NODE-LOOP.md)는 엔진이 직접 평가한다는 이유로 `breakCondition` 을 일부러 싣지 않는다. [ForEach 노드](../CLE-NODE-LOGIC/CLE-NODE-FOREACH.md) 예시는 `errorPolicy` 를 빠뜨린다. [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md)는 `outputSchema` 를 `schema` 키로 싣고 이를 미뤄 둔 알려진 결함으로 적는다. 결정 필요: 예외를 허용하고 이 규약에 예외 목록을 둘지, 노드를 규약에 맞출지.
- **시스템 포트 예약어 집합과 거부 계층(Principle 6)**: 이 규약은 예약어 9개를 두고 프론트엔드가 거부한다고 적는다. [Switch 노드](../CLE-NODE-LOGIC/CLE-NODE-SWITCH.md)는 이 원칙을 인용하면서 `default`, `out`, `error` 3개만 백엔드 `validateSwitchConfig` 에서 거부한다. [텍스트 분류기 노드](../CLE-NODE-AI/CLE-NODE-CLASSIFIER.md)는 9개를 백엔드 스키마(`RESERVED_PORT_WORDS`)에서 거부한다. [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 조건 검증은 `out`, `in`, `error`, `user_ended`, `max_turns` 를 막는다. 케이스 ID `done` 이 허용되는지가 노드마다 다르다. 결정 필요: 공통 예약어 상수 하나와 거부 계층을 정할지, 노드별 허용 범위를 적을지.
- **AI 노드의 인증 실패 재시도 가능 분류(Principle 3.2.1)**: 이 규약과 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md), [텍스트 분류기 노드](../CLE-NODE-AI/CLE-NODE-CLASSIFIER.md) 문서는 인증 실패(401·403)를 `retryable: false` 로 정한다. [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) 문서는 `LLM_CALL_FAILED` 면 무조건 `true` 로 둔다. 현재 구현은 정보 추출기 핸들러가 코드 기반이라 항상 `true` 를 채우고, 텍스트 분류기 핸들러도 자기 문서와 달리 `LLM_CALL_FAILED` 를 항상 `true` 로 채운다. 같은 인증 실패에서 노드마다 `[다시 시도]` 버튼이 보이기도 하고 안 보이기도 한다. 또 정보 추출기는 멀티턴 실패를 `retryable=true` 로 내지만 마지막 턴 재시도를 지원하지 않아 `_retryState` 를 만들지 않는다. 화면이 노드 유형으로 버튼을 막지 않으면 버튼을 눌러도 `RETRY_STATE_NOT_FOUND` 가 난다. 결정 필요: HTTP 상태 기반 분류로 통일할지, 정보 추출기의 코드 기반 예외를 규약에 적을지, 재시도 버튼 노출 조건을 어디에 둘지.
- **출력 포트가 둘인데 `port` 를 비우는 노드(Principle 5)**: `port: undefined` 는 출력이 하나인 노드용이고 여러 포트 동시 활성화는 `string[]` 로 나타낸다. [Filter 노드](../CLE-NODE-LOGIC/CLE-NODE-FILTER.md)는 출력이 둘(`match`, `unmatched`)인데 `port` 를 돌려주지 않고 두 포트를 모두 활성화한다. 결정 필요: "모든 출력 포트 활성화" 형태를 이 원칙에 더할지, Filter 가 `port: ['match', 'unmatched']` 를 돌려주게 할지.
- **컨테이너 완료 출력의 `meta.durationMs` 와 `port`(Principle 2)**: 이 규약은 `meta.durationMs` 를 모든 노드 공통 필드로 둔다. [ForEach 노드](../CLE-NODE-LOGIC/CLE-NODE-FOREACH.md)는 완료 출력에 `port` 와 `meta.durationMs` 가 없다고 적고(Parallel 만 port 를 찍는다), 같은 실행기를 쓰는 [Map 노드](../CLE-NODE-LOGIC/CLE-NODE-MAP.md)와 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md)은 `port: 'done'` 과 `meta.durationMs` 를 넣는다. 결정 필요: 공통 필수 규정에 컨테이너 예외를 적을지.
- **흐름 지시 상태 값 `started`(Principle 0)**: 이 규약은 `status` 를 엔진 흐름을 바꾸는 값으로 정의한다. [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md)의 비동기 호출은 최상위 `status: 'started'` 를 돌려준다. 자세한 내용은 그 문서의 미결 사항에 있다.

## 구현 위치

- `codebase/backend/src/nodes/core/node-handler.interface.ts`: `NodeHandlerOutput` 타입
- `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/nodes/core/node-output-allowlist.ts`: `NODE_OUTPUT_ALLOWED_KEYS`

## Rationale

### 노드 종류를 몰라도 값 위치를 예측할 수 있게 한다

이 규칙집의 목적은 작성자가 `$node["X"].output.*` 를 쓸 때 노드마다 형태를 외우지 않게 하는 것이다. 그래서 다섯 필드의 뜻을 모든 노드에서 같게 두고, 설정 값과 실행 결과를 서로 다른 필드에 나눴다.

### `output.view` 판별자를 폐기한 이유

초안은 `output.view.type` 으로 노드 종류를 구분하려 했다. 노드 종류는 `$node["X"]` 로 접근할 때 워크플로우 정의에서 이미 알 수 있으므로 판별자는 중복이다. 같은 이유로 Presentation 노드의 `output.type` 판별자도 폐기했다.

### 설정을 원문으로 저장하고 나가는 곳에서만 가린다 (2026-08-24)

예전에는 `config` 를 "해석된 설정값(자격 증명 제거)" 으로 정의했다. 이 서술은 엔진 경계(`handler-output.adapter.ts`)가 저장 전에 마스킹한다는 전제에 기대고 있었다. 그 경계는 제거됐다. 저장 전에 가리면 `$node["X"].config.<field>` 가 리터럴 `****abcd` 를 읽는다. 이는 보이는 정보가 줄어드는 정도가 아니라 기능이 오염되는 문제였다. 그래서 `config` 는 원문으로 저장하고 REST·WebSocket 으로 나갈 때만 가리기로 했다. [응답 자격 증명 마스킹 §1.1](../CLE-API/CLE-API-EGRESS.md#11-egress-only)의 egress 전용 원칙과 같은 방향이다. 근거와 경위는 [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md)의 R-5 에 있다.

같은 날 `_resumeState`·`_retryState` 의 자격 증명 제외 방식도 정리했다. 예전 서술은 `maskSensitiveFields` 경계로 가린다고 했지만 그 경계는 없어졌다. 지금은 `buildRetryState`·`buildResumeState` 가 옮길 키를 나열하므로 자격 증명이 처음부터 들어가지 않는다. 이 배제는 경계 제거와 관계없다.

### 이벤트 봉투와 노드 출력의 구분을 한 곳에 둔 이유 (2026-08-24)

이 구분이 산문으로 다섯 문서에 흩어져 있었다. 2026-08-24 한 작업에서 네 라운드에 걸쳐 같은 결함이 하나씩 나왔다. 라운드마다 사본 하나씩만 고쳐졌기 때문이다. 사본을 줄이는 것이 재발을 막는 유일한 방법이라 [Principle 0](#principle-0-노드-출력의-다섯-필드)을 기준으로 삼고 다른 문서가 인용하게 했다.

### wire 전용 키를 다섯 필드에 넣지 않는 이유

wire 전용 키 8개는 핸들러가 아니라 전송 조립 계층이 만든다. 계약에 넣으면 모든 핸들러가 지켜야 할 것처럼 읽힌다. 갈래 라벨은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 허용 목록 표와 같은 문구를 쓴다. 코드 JSDoc 은 접미어 없는 축약형(`wire 전용 (위젯)`, `(chat-channel)`)이라 글자가 완전히 같지는 않다. 첫 서술의 "그 상수의 주석과 같은 문구" 는 이후 검토(16_41_05 W3)에서 바로잡았다. 키 배열은 정확히 같으므로 기능 위험은 없다. 라벨 통일은 남은 개발 작업이다.

### 사설망 차단과 자격 증명 해석 실패를 에러 포트로 보낸다 (결정 D4, 2026-05-17)

통합 노드의 사설망 차단과 자격 증명 해석 실패를 사전 검증 throw 가 아니라 런타임 에러 포트로 보낸다. 사용자가 `error` 포트로 분기해 복구할 수 있게 하려는 것이다. 설정 형식 오류만 throw 로 남긴다.

### egress 값 마스킹을 방어층으로 둔 이유 (2026-08-17)

"절대 싣지 않는다" 목록은 핸들러의 의무다. 하지만 핸들러가 놓치거나 자유 텍스트 필드 안에 자격 증명 리터럴이 박혀 있으면 이 의무만으로는 막지 못한다. 그래서 나가는 경로에서 값 패턴을 한 번 더 가린다. 새 예외를 만든 것이 아니라 같은 금지를 다른 층에서 한 번 더 지키는 것이다.

### 설정 에코를 명시 나열로 만드는 이유 (결정 D1)

spread 로 싣지 않는 이유는 세 가지다.

1. 자격 증명 누출 위험. 스키마에 새 민감 필드가 생기면 자동으로 노출된다.
2. 회귀를 알아채기 어렵다. 어떤 필드가 실리는지 단위 테스트로 명시해 검증할 수 없다.
3. 죽은 필드가 계속 실린다. 폐기 예정 필드가 자동으로 계속 나온다.

### 엔진 덮어쓰기 형태를 하나로 맞춘 이유

예전에는 Loop·ForEach·Parallel 이 단순 배열을 각자 다른 뜻으로 썼다. 다음 노드가 노드마다 다른 형태를 다루지 않도록 [9.2](#92-노드별-최종-출력-값)의 `{ <컬렉션 키>, count }` 구조로 맞췄다.
