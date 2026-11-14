---
id: "CLE-NODE-OUTPUT"
title: "노드 출력 규약"
type: "convention"
version: 13
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE"
ancestors: ["CLE-VISION", "CLE-NODE"]
area: "CLE-NODE"
content_hash: "af4b2c24e4c09f22bef7f50a34caab93bc77c7b645a9055f12a73fe95bc788ae"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/conventions/node-output.md"]
mirror_sha256: "058173be0deb11af98d246ec1c93167634b2526441b93c528af2a095c34be05c"
etag: "sha256-e0d888fdd415e20f0496a6d857be6548e2132e1fca0637c46f6feccc078a7dce"
---
> 구현 상태: 부분 구현 · 원문: `spec/conventions/node-output.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 모든 노드 문서가 따르는 노드 출력 규칙집이다. 노드 핸들러가 돌려주는 노드 출력(node output, `NodeHandlerOutput`)의 다섯 필드가 무엇을 뜻하고 어떤 값을 어디에 두는지 정한다. 각 노드 문서는 출력 절에서 이 규칙을 따르고, 규칙을 벗어나는 곳이 있으면 그 이유와 고칠 방법을 적는다.

설계 목표는 하나다. 워크플로우 작성자가 `$node["노드 이름"].output.*` 로 값을 꺼낼 때 노드 종류를 몰라도 어디에 무엇이 있을지 예측할 수 있어야 한다.

규칙은 Principle 0 부터 Principle 11 까지 번호를 붙인다. 다른 문서는 `[노드 출력 규약 Principle 9](CLE-NODE-OUTPUT.md#principle-9-컨테이너와-parallel-의-출력-덮어쓰기)` 처럼 번호와 앵커로 가리킨다. 번호는 바꾸지 않는다. 전체 목록은 [Principle 요약](#principle-요약)에 있다. Principle 3 · 4 · 5 · 6 · 7 · 9 · 10 의 본문은 [하위 문서](#하위-문서)에 있다.

이 문서가 다루지 않는 것은 다음과 같다.

- 엔진이 핸들러를 부르는 순서와 인터페이스: [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md)
- 입력 대기·재개의 상태 전이와 park·rehydration: [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)
- 컨테이너 본문 실행 흐름: [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md)
- 나가는 페이로드의 자격 증명 마스킹 방식: [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)
- 노드가 실패했을 때의 정책(중단·건너뛰기·재시도 등): [노드 에러 처리 정책](CLE-NODE-ERROR.md)
- 저장된 출력이 화면마다 어떻게 되살아나는지: [실행 화면 복원 규약](../CLE-EXEC/CLE-EXEC-HYDRATION.md)

## 하위 문서

- [노드 출력 규약 — 포트 · 흐름 상태 · 에러](CLE-NODE-OUTPUT-FLOW.md): Principle 3(에러 계약 · `output.error` 형태 · 에러 포트), Principle 4(블로킹 · 재개 상태 전이, `_resumeCheckpoint` · `_retryState` 보존 예외, 입력 대기 · 재개 출력 값, `interaction.data`), Principle 5(출력 포트 선택 모델), Principle 6(동적 포트 ID 이름). 맡는 요구사항: 없음.
- [노드 출력 규약 — 설정 에코](CLE-NODE-OUTPUT-ECHO.md): Principle 7(설정 에코에 싣는 값 · 싣지 않는 값, egress 마스킹, 명시 나열 방식). 맡는 요구사항: 없음.
- [노드 출력 규약 — 컨테이너 출력과 빈 입력](CLE-NODE-OUTPUT-CONTAINER.md): Principle 9(컨테이너와 Parallel 의 엔진 덮어쓰기)와 Principle 10(비었거나 null 인 입력의 대체 값), 컨테이너 · Parallel 의 완료 `meta` 와 실행 시간. 맡는 요구사항: 없음.

## 규칙

### Principle 0. 노드 출력의 다섯 필드

1. 모든 노드 핸들러는 `{ config, output, meta?, port?, status? }` 형태의 객체를 돌려준다. 다섯 필드의 뜻은 어느 노드에서든 같다.

   | 필드 | 표준 용어 | 뜻 |
   | --- | --- | --- |
   | `config` | 설정 에코(config echo) | 핸들러가 다시 싣는 원문 설정값. 표현식을 평가하기 전 형태다. 저장할 때는 원문 그대로 두고 REST·WebSocket 으로 나갈 때만 가린다([Principle 7](CLE-NODE-OUTPUT-ECHO.md#principle-7-설정-에코-원칙)). |
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
6. 내부 최상위 필드 세 개는 다섯 필드 밖 최상위 위치를 예외로 허용한다. `_resumeState`(멀티턴 입력 대기·재개 중 내부 전달), `_resumeCheckpoint`(재시작 뒤 재개용 DB 보존 부분집합), `_retryState`(재시도 가능 에러로 끝날 때 DB 보존)다. 세 필드는 표현식 해석기와 자동완성에 노출하지 않고, 자격 증명 제외 정책도 같다. 자세한 규칙은 [4.2.1](CLE-NODE-OUTPUT-FLOW.md#421-보존-예외--_resumecheckpoint--_retrystate)에 있다.
7. 출력 값이 배열이나 원시값(문자열 · 숫자 · 불리언 · `null`)이어도 다음 노드는 그 값을 그대로 받는다. `$input` 과 `$node["X"].output` 은 핸들러가 `output` 에 둔 값과 같다. `port` · `status` · `meta` 가 함께 있어도 `{ data: … }` 같은 객체로 감싸지 않는다. 사용자 코드가 `{ data: [...] }` 객체를 돌려주면 그 객체가 출력 값이다. 엔진이 포트 라우팅을 위해 이 값을 어떻게 들고 다니는지는 [노드 핸들러 계약 §포트 선택](../CLE-EXEC/CLE-EXEC-HANDLER.md#포트-선택)에 있다. 이 규칙이 아직 닿지 않는 경로는 [미결 사항](#미결-사항)에 있다.

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
- `template.config.content = "Hello {{ name }}"` 는 `output` 에 싣지 않는다. `output.rendered = "Hello Alice"` 는 표현식 해석기가 평가한 결과라 둔다. 이 형태는 [Principle 7](CLE-NODE-OUTPUT-ECHO.md#principle-7-설정-에코-원칙)과 정확히 맞는다. `config` 는 원본 템플릿이고 `output` 은 평가 결과다.
- `loop.config.count = 10` 은 `output` 에 싣지 않는다. 실제로 돈 횟수는 `meta.iterations` 나 `output.iterations.length` 로 읽는다.

#### 1.1.4 `output.view` 판별자는 쓰지 않는다

예전 초안의 `output.view.type = 'form' | 'carousel' | ...` 판별자는 폐기했다. 노드 종류는 `$node["X"]` 로 접근하는 시점에 워크플로우 정의에서 이미 알 수 있다.

### Principle 2. 실행 메트릭에는 관측 값만 둔다

| 분류 | 필수·권장 필드 |
| --- | --- |
| 공통 | `meta.durationMs: number`. Loop·ForEach·Map·Parallel 의 완료 출력은 잠정적으로 제외한다([컨테이너 · Parallel 의 완료 `meta`](CLE-NODE-OUTPUT-CONTAINER.md#컨테이너와-parallel-의-완료-meta)). 이 값을 누가 채우는지는 노드 문서가 정한다([미결 사항](#미결-사항)). Send Email 노드의 dry-run 출력에는 `meta.durationMs` 가 없다([Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md#meta-가-공통-규칙과-다른-두-곳-2026-11-13) Rationale). 이 값을 채우는 일은 NERV Task `CLE-T-22PSME` 가 맡는다 |
| AI 노드 | 아래 목록 |
| HTTP | `meta.statusCode`, `meta.durationMs` |
| DB | `meta.durationMs`, `meta.rowCount` |
| Code | `meta.durationMs`, `meta.success`, `meta.logs?`. 런타임 에러는 `output.error` 와 `port: 'error'` 로 낸다. `meta.error`, `meta.errorCode` 별칭은 폐기했다. |
| 컨테이너 · Parallel | `meta.iterations`(Loop·ForEach·Map), `meta.skippedCount?`(ForEach·Map), `meta.fellBackToEmpty`(ForEach·Map), `meta.maxIterationsReached`·`meta.exitReason`(Loop). Parallel 은 중첩 Parallel 에서 동시 실행 수를 줄였을 때만 `meta.clampedConcurrency?` 를 싣는다 |
| Split · Filter | `meta.fellBackToEmpty`([Principle 10](#principle-10-비었거나-null-인-입력의-대체-값)) |
| Merge | `meta.inputCount`, `meta.strategy`, `meta.outputFormat`, `meta.skippedKeys`, `meta.dormantFields`. `meta.strategy` · `meta.outputFormat` 은 설정 에코와 같은 값이라 이 원칙의 예외다. 예외로 둔 이유는 [Merge 노드](../CLE-NODE-LOGIC/CLE-NODE-MERGE.md#meta-에-전략과-출력-형식을-설정-에코와-함께-둔다-2026-11-12) 에 있다 |

AI 노드의 `meta` 필드는 다음과 같다.

- `meta.model`, `meta.inputTokens`, `meta.outputTokens`, `meta.totalTokens`
- `meta.thinkingTokens?`, `meta.toolCalls?`. AI 에이전트 단일 턴이 LLM 호출 단계까지 간 출력(정상 완료 · 조건 분기 · LLM 호출 실패)은 `meta.thinkingTokens` 를 늘 싣고 보고가 없으면 `0` 이다. 기준은 [AI 노드 공통 §토큰 회계](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md#토큰-회계) 다.
- `meta.contextInjection?`: 대화 스레드를 자동으로 넣었을 때 `{ appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }` 를 싣는다. 자세한 내용은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md)의 cap 절에 있다.
- `meta.memory?`: 메모리 전략(`memoryStrategy`)이 `manual` 이 아닐 때 `{ strategy, summarized, recalledCount, tokenBudgetUsed, compactedMessages? }` 를 싣는다. `ai_agent` 전용이다. `information_extractor` 는 persistent 전략(회수와 추출)을 지원하지만 `meta.memory` 는 싣지 않고 `meta.contextInjection` 만 싣는다. 필드 정의는 [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md), 전략은 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md)가 정한다.

`ai_agent` 가 쓰던 `output.metadata.*` 는 폐지한다. 토큰과 모델 정보는 모두 `meta.*` 에 둔다.

### Principle 3. 에러 계약

→ [포트 · 흐름 상태 · 에러](CLE-NODE-OUTPUT-FLOW.md#principle-3-에러-계약)

#### 3.1 분류

→ [포트 · 흐름 상태 · 에러](CLE-NODE-OUTPUT-FLOW.md#31-분류)

#### 3.2 `output.error` 표준 형태

→ [포트 · 흐름 상태 · 에러](CLE-NODE-OUTPUT-FLOW.md#32-outputerror-표준-형태)

#### 3.2.1 `details` 의 공통 표준 필드

→ [포트 · 흐름 상태 · 에러](CLE-NODE-OUTPUT-FLOW.md#321-details-의-공통-표준-필드)

#### 3.2.2 `details` 의 노드별 선택 스키마

→ [포트 · 흐름 상태 · 에러](CLE-NODE-OUTPUT-FLOW.md#322-details-의-노드별-선택-스키마)

#### 3.3 에러 포트가 있는 노드

→ [포트 · 흐름 상태 · 에러](CLE-NODE-OUTPUT-FLOW.md#33-에러-포트가-있는-노드)

### Principle 4. 블로킹과 재개 계약

→ [포트 · 흐름 상태 · 에러](CLE-NODE-OUTPUT-FLOW.md#principle-4-블로킹과-재개-계약)

#### 4.1 상태 전이

→ [포트 · 흐름 상태 · 에러](CLE-NODE-OUTPUT-FLOW.md#41-상태-전이)

#### 4.2 폐기할 필드 / 구조

→ [포트 · 흐름 상태 · 에러](CLE-NODE-OUTPUT-FLOW.md#42-폐기할-필드--구조)

#### 4.5 `interaction.data` 형태

→ [포트 · 흐름 상태 · 에러](CLE-NODE-OUTPUT-FLOW.md#45-interactiondata-형태)

### Principle 5. 출력 포트 선택 모델

→ [포트 · 흐름 상태 · 에러](CLE-NODE-OUTPUT-FLOW.md#principle-5-출력-포트-선택-모델)

### Principle 6. 동적 포트 ID 이름

→ [포트 · 흐름 상태 · 에러](CLE-NODE-OUTPUT-FLOW.md#principle-6-동적-포트-id-이름)

### Principle 7. 설정 에코 원칙

→ [설정 에코](CLE-NODE-OUTPUT-ECHO.md#principle-7-설정-에코-원칙)

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
| HTTP 요청 본문(평가 결과) | `output.requestBody`, `output.requestBodyType`. 원본은 `config` 에 있다([Principle 7](CLE-NODE-OUTPUT-ECHO.md#principle-7-설정-에코-원칙)). |
| DB 쿼리 결과 | `output.rows`, `output.rowCount`, `output.fields`, `output.insertId?`(그대로 둔다) |
| 이메일 전송 결과 | `output.messageId`, `output.accepted`, `output.rejected`, `output.subject`, `output.body`, `output.bodyType`. subject·body 원본은 `config` 에 있다. |
| 코드 실행 결과(사용자 `return` 값) | `output` 최상위. Code·Transform 은 `output.result` 로 감싸지 않는다. 사용자 코드나 연산이 형태를 정하기 때문이다. 배열이나 원시값을 돌려주면 그 값이 `output` 이다([Principle 0](#principle-0-노드-출력의-다섯-필드) 7번). |
| 표시용 런타임 필드 | `output.items`(Carousel 동적 모드), `output.rows`·`output.totalRows`(Table), `output.data`(Chart), `output.rendered`(Template). 빈 출력(`{}`)은 Form 과 Carousel 정적 모드다. 자세한 형태는 [4.3](CLE-NODE-OUTPUT-FLOW.md#43-입력-대기-상태의-출력-값-노드별)에 있다. |

`output.result` 감싸기는 AI 노드(`ai_agent`, `text_classifier`, `information_extractor`)에만 쓴다. 이 세 노드만 도메인 결과를 `output.result` 아래에 모은다. Code·Transform 은 사용자가 형태를 정하므로 `output` 최상위에 바로 둔다. 기준은 [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md)와 [Transform 노드](../CLE-NODE-DATA/CLE-NODE-TRANSFORM.md)다.

### Principle 9. 컨테이너와 Parallel 의 출력 덮어쓰기

→ [컨테이너 출력과 빈 입력](CLE-NODE-OUTPUT-CONTAINER.md#principle-9-컨테이너와-parallel-의-출력-덮어쓰기)

#### 9.1 계약

→ [컨테이너 출력과 빈 입력](CLE-NODE-OUTPUT-CONTAINER.md#91-계약)

#### 9.2 노드별 최종 출력 값

→ [컨테이너 출력과 빈 입력](CLE-NODE-OUTPUT-CONTAINER.md#92-노드별-최종-출력-값)

### Principle 10. 비었거나 null 인 입력의 대체 값

→ [컨테이너 출력과 빈 입력](CLE-NODE-OUTPUT-CONTAINER.md#principle-10-비었거나-null-인-입력의-대체-값)

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
2. 선택 필드는 표에 `?` 를 붙인다. 이 규약에서 선택인 필드라도 노드 문서가 그 케이스에서 늘 싣는다고 정하면 `?` 없이 쓴다. 예를 들어 AI 에이전트 단일 턴 케이스의 `meta.thinkingTokens` 다. 설정 에코에서 값이 `undefined` 일 수 있는 필드(사용자가 설정하지 않았고 핸들러가 기본값을 채우지 않는 필드)도 선택 필드다([Principle 7](CLE-NODE-OUTPUT-ECHO.md#principle-7-설정-에코-원칙) 규칙 4).
3. 케이스(성공, 에러, 재개 등)마다 따로 쓴다.
4. 다섯 필드 밖의 최상위 키를 쓰지 않는다([Principle 0](#principle-0-노드-출력의-다섯-필드)의 내부 필드 예외는 제외).

## Principle 요약

| # | 한 줄 요약 | 주로 영향받는 노드 |
| --- | --- | --- |
| [0](#principle-0-노드-출력의-다섯-필드) | 다섯 필드 고정 | 모든 노드 |
| [1](#principle-1-출력-값에는-비즈니스-결과만-둔다) | `output` 에는 비즈니스 데이터만 | ai_agent |
| [1.1](#principle-11-설정과-출력-값은-겹치지-않는다) | `config` 와 `output` 은 겹치지 않는다 | form, carousel, chart, template, ai_agent(멀티턴), information_extractor(멀티턴), manual_trigger, loop, parallel, workflow |
| [2](#principle-2-실행-메트릭에는-관측-값만-둔다) | `meta` 에는 실행 메트릭만(Merge 에 설정 에코 예외가 있다) | ai_agent, text_classifier, code, loop, foreach, map, parallel, merge |
| [3](CLE-NODE-OUTPUT-FLOW.md#principle-3-에러-계약) | 에러 계약 통일 | send_email, code, transform |
| [4](CLE-NODE-OUTPUT-FLOW.md#principle-4-블로킹과-재개-계약) | 블로킹·재개 구조 통일 | form, carousel, chart, table, template, ai_agent(멀티턴), information_extractor(멀티턴) |
| [5](CLE-NODE-OUTPUT-FLOW.md#principle-5-출력-포트-선택-모델) | `port` 활성화 모델 | 동적 포트가 있는 모든 노드 |
| [6](CLE-NODE-OUTPUT-FLOW.md#principle-6-동적-포트-id-이름) | 동적 포트 이름 | carousel, ai_agent, switch, text_classifier |
| [7](CLE-NODE-OUTPUT-ECHO.md#principle-7-설정-에코-원칙) | 설정 에코 원칙 | http_request, ai_agent, database_query |
| [8](#principle-8-불필요한-중첩을-없앤다) | 중첩 제거 | information_extractor, ai_agent |
| [9](CLE-NODE-OUTPUT-CONTAINER.md#principle-9-컨테이너와-parallel-의-출력-덮어쓰기) | 엔진 덮어쓰기 계약 | loop, foreach, map, parallel |
| [10](CLE-NODE-OUTPUT-CONTAINER.md#principle-10-비었거나-null-인-입력의-대체-값) | null·빈 입력 대체 값 | foreach, map, split, filter, chart |
| [11](#principle-11-출력-예시-작성-규칙) | 출력 예시 작성 규칙 | 모든 노드(문서 수준) |

## 미결 사항

주제별 미결 항목은 하위 문서로 옮겼다. 다른 문서가 이 절을 가리키면 아래 항목에서 해당 하위 문서로 간다.

- **AI 노드의 인증 실패 재시도 가능 분류(Principle 3.2.1)** · **시스템 포트 예약어 집합과 거부 계층(Principle 6)** · **출력 포트가 둘인데 `port` 를 비우는 노드(Principle 5)**: [포트 · 흐름 상태 · 에러의 미결 사항](CLE-NODE-OUTPUT-FLOW.md#미결-사항)
- **정보 추출기의 설정 에코 키 이름(Principle 7)**: [설정 에코의 미결 사항](CLE-NODE-OUTPUT-ECHO.md#미결-사항)
- **컨테이너 완료 출력의 `port`(Principle 5)** · **컨테이너 · Parallel 노드의 실행 시간(Principle 2)**: [컨테이너 출력과 빈 입력의 미결 사항](CLE-NODE-OUTPUT-CONTAINER.md#미결-사항)

이 문서에 남은 미결 항목은 다음과 같다.

- **일반 노드의 `meta.durationMs` 를 채우는 주체(Principle 2)**: 여러 노드 문서가 `meta.durationMs` 의 출처를 "엔진 주입" 으로 적는다. 2026-10-24 에 확인한 코드에서 엔진이 이 값을 넣는 곳은 폼 재개 경로뿐이다. Chart · Carousel · Table · Template 의 버튼 대기는 핸들러가 `0` 을 싣고 버튼 재개는 그 값을 바꾸지 않는다. 버튼이 없는 Chart · Carousel · Table · Template 은 `meta` 를 싣지 않는다. If/Else · Switch · Filter · Merge · Split · 변수 선언 · 변수 수정 핸들러도 이 값을 싣지 않는다. 결정 필요: 엔진이 모든 노드 완료 때 실제 값을 넣도록 바꿀지, 노드 문서를 지금 동작에 맞출지. 영향을 받는 노드 문서 목록과 후속 작업은 NERV Task `CLE-T-1GJKB2` 가 다룬다. 경위는 [컨테이너 하위 문서의 Rationale](CLE-NODE-OUTPUT-CONTAINER.md#컨테이너와-parallel-의-완료-출력에-durationms-를-싣지-않는다-잠정-2026-10-24)에 있다.
- **흐름 지시 상태 값 `started`(Principle 0)**: 이 규약은 `status` 를 엔진 흐름을 바꾸는 값으로 정의한다. [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md)의 비동기 호출은 최상위 `status: 'started'` 를 돌려준다. 자세한 내용은 그 문서의 미결 사항에 있다.
- **배열 · 원시값 `output` 이 `{ data }` 로 감싸이는 갭(Principle 0 · 8)**: 다음 노드의 `$input` 과 `$node["X"].output` 은 [Principle 0](#principle-0-노드-출력의-다섯-필드) 7번대로 배열 · 원시값을 그대로 받는다. 엔진 내부 값을 그대로 쓰는 경로는 아직 이 규칙을 따르지 않는다. 실행 결과(`Execution.outputData`)와 동기 서브워크플로 결과(워크플로우 호출 노드의 `output.result`)에는 마지막 노드의 엔진 내부 값이 들어간다. 출력 값이 배열 · 원시값(`null` 포함)이고 `port` 가 있으면 `{ data: <값>, _selectedPort: <포트> }` 이고, 객체면 `_selectedPort` 키가 붙는다. `port` 가 있는 객체 출력은 `$node["X"].output` 에도 `_selectedPort` 키가 붙는다. `$input` 에는 붙지 않는다. Background 노드 본문은 큐로 넘어온 엔진 내부 값(`nodeOutputCache` 스냅샷)만 받으므로, 본문 밖 노드의 배열 · 원시값 출력에 `port` 가 있으면 본문 안의 `$node["X"].output` 이 같은 `{ data, _selectedPort }` 형태로 보인다. DB 에서 되살린 값으로 실행을 이어 가는 경로도 같은지는 아직 확인하지 않았다. 결정 필요: 이 경로들도 핸들러 `output` 을 그대로 쓰게 할지, 실행 결과는 노드 출력 다섯 필드 전체로 둘지. 후속 작업은 NERV Task `CLE-T-JDYHCF` 가 다룬다.

## 구현 위치

- `codebase/backend/src/nodes/core/node-handler.interface.ts`: `NodeHandlerOutput` 타입
- `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/nodes/core/node-output-allowlist.ts`: `NODE_OUTPUT_ALLOWED_KEYS`

## Rationale

### 하위 문서로 옮긴 결정

다른 문서가 `CLE-NODE-OUTPUT#rationale` 로 가리키는 결정 가운데 하위 문서로 옮긴 것은 다음과 같다.

- 사설망 차단과 자격 증명 해석 실패를 에러 포트로 보낸다 (2026-05-17), `_resumeState` · `_retryState` 의 자격 증명 제외 방식 (2026-08-24), 에러 `details` 예를 구현에 맞춘다 (2026-11-13), AI 대화 노드의 재개 출력을 규약에 올린다 (2026-11-12): [포트 · 흐름 상태 · 에러의 Rationale](CLE-NODE-OUTPUT-FLOW.md#rationale)
- 설정 에코의 원문 저장 · egress 마스킹 · 명시 나열: [설정 에코의 Rationale](CLE-NODE-OUTPUT-ECHO.md#rationale)
- 엔진 덮어쓰기 형태 · 빈 입력 대체 · 완료 `meta` 의 `durationMs` · 완료 출력 표의 `skipped` · `skipped[].error.code` 예외 종료: [컨테이너 출력과 빈 입력의 Rationale](CLE-NODE-OUTPUT-CONTAINER.md#rationale)

### 노드 종류를 몰라도 값 위치를 예측할 수 있게 한다

이 규칙집의 목적은 작성자가 `$node["X"].output.*` 를 쓸 때 노드마다 형태를 외우지 않게 하는 것이다. 그래서 다섯 필드의 뜻을 모든 노드에서 같게 두고, 설정 값과 실행 결과를 서로 다른 필드에 나눴다.

### `output.view` 판별자를 폐기한 이유

초안은 `output.view.type` 으로 노드 종류를 구분하려 했다. 노드 종류는 `$node["X"]` 로 접근할 때 워크플로우 정의에서 이미 알 수 있으므로 판별자는 중복이다. 같은 이유로 Presentation 노드의 `output.type` 판별자도 폐기했다.

### 이벤트 봉투와 노드 출력의 구분을 한 곳에 둔 이유 (2026-08-24)

이 구분이 산문으로 다섯 문서에 흩어져 있었고, 사본마다 같은 결함이 따로 나왔다. 사본을 줄이는 것이 재발을 막는 유일한 방법이라 [Principle 0](#principle-0-노드-출력의-다섯-필드)을 기준으로 삼고 다른 문서가 인용하게 했다.

### wire 전용 키를 다섯 필드에 넣지 않는 이유

wire 전용 키 8개는 핸들러가 아니라 전송 조립 계층이 만든다. 계약에 넣으면 모든 핸들러가 지켜야 할 것처럼 읽힌다. 갈래 라벨은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 허용 목록 표와 같은 문구를 쓴다. 코드 JSDoc 은 접미어 없는 축약형(`wire 전용 (위젯)`, `(chat-channel)`)이라 글자가 완전히 같지는 않다. 키 배열은 정확히 같으므로 기능 위험은 없다. 라벨 통일은 남은 개발 작업이다.

### 배열 · 원시값 출력을 감싸지 않는다 (2026-11-05)

이 결정 전에는 엔진이 배열 · 원시값 출력에 `port` · `status` · `meta` 가운데 하나라도 있으면 `{ data: <값> }` 으로 감쌌다. 그래서 Code 의 `return [...]` 를 다음 노드가 `$input.data` 로 읽어야 했고, `port` 나 `meta` 를 싣는 Merge · 변수 선언 · Transform · If/Else · Switch 의 배열 출력도 늘 감싸였다. 값 위치를 예측한다는 목표와 [Principle 8.2](#82-통일된-1차-이름)에 맞지 않았다. 2026-11-05 에 이 감싸기를 없앴다(NERV Task `CLE-T-T30D5S`). 감싼 값을 `$input.data` · `$node["X"].output.data` 로 읽던 워크플로우는 이 결정 뒤 `undefined` 를 읽는다. 호환이 깨지는 변경이다. 앞서 컨테이너 입력에 한해 `meta` 만 있을 때 감싸지 않게 한 수정(NERV Task `CLE-T-3HJ8MM`)은 이 결정에 포함됐다. 엔진 쪽 구현 결정은 [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md#배열--원시값-출력의-엔진-내부-객체를-표지로-가른다-2026-11-05)에 있다. 같은 날 Code 가 `null` 을 돌려주거나 값을 돌려주지 않는 경우도 맞췄다(NERV Task `CLE-T-X3AH4F`). 전에는 다음 노드가 설정 에코를 받고 success · error 포트가 함께 열렸으나 이제 success 포트만 열리고 다음 노드는 `null` 을 받는다.

기각한 대안은 둘이다. 첫째, `$input.data` 도 같은 값을 주는 별칭은 원시값에 속성을 붙일 수 없고 배열에 `data` 속성을 붙이면 사용자 값의 모양이 바뀐다. 둘째, Code 만 감싸지 않는 노드별 적용은 노드 종류를 알아야 값 위치를 알 수 있어 규약의 목표와 맞지 않는다. 저장된 워크플로우의 `$input.data` 를 자동으로 고치는 마이그레이션도 두지 않았다. 앞 노드의 출력이 배열 · 원시값인지는 실행해 봐야 알 수 있어 표현식만 보고 고칠 곳을 가를 수 없다.

### 예외 표에서 정한 노드만 배열이 아닌 입력을 빈 배열로 바꾼다 (2026-10-24)

→ [컨테이너 출력과 빈 입력](CLE-NODE-OUTPUT-CONTAINER.md#예외-표에서-정한-노드만-배열이-아닌-입력을-빈-배열로-바꾼다-2026-10-24)
