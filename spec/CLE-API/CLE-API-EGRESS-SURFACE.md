---
id: "CLE-API-EGRESS-SURFACE"
title: "응답 자격 증명 마스킹 — 실행 표면"
type: "convention"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-EGRESS"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-EGRESS"]
area: "CLE-API"
content_hash: "8cd4b5e64dff5fd8f75e6176d2d40210753b9ab289169ed91595e458342d93bf"
read_as: "approved_fallback"
task: "CLE-T-CYTWVC"
source_paths: []
mirror_sha256: "c3672307cbbf03677fc1a08518aa678102e7f2c7176707170d26cbe768b2c099"
etag: "sha256-f55b0121abad6af8e942446f8c703c72b580289aea201a1764f89eefcca25160"
---
## 개요

이 문서는 [응답 자격 증명 마스킹](CLE-API-EGRESS.md) 의 하위 문서로 실행·노드 데이터가 나가는 표면마다 무엇을 어떻게 가리는지 이름으로 열거해 정한다. §N 은 원문 절 번호이고 「규칙 N」 · §1 · §2 는 부모에, 나머지 절은 부모의 [하위 문서](CLE-API-EGRESS.md#하위-문서) 가 가리키는 문서에 있다.

## 3.1 대화 스레드 (`conversationThread`)

EIA 단발 상태 조회(`GET /api/external/executions/:id`)와 SSE `waiting_for_input` 은 대화 스레드를 싣는다. 노드 핸들러는 대화 기록 항목 텍스트에 민감 정보(API 키, Bearer 토큰, Authorization 헤더 등)를 남기지 않는다는 불변식이 있고 이 불변식을 런타임에 강제한다.

- REST 와 SSE 가 **같은 헬퍼 `redactThreadForPublic`** 를 거쳐 두 경로가 같게 가려진다.
- 자유 텍스트 `turns[].text`, `runningSummary` 는 `redactSecrets`(값 패턴)로 가린다.
- 구조화 필드 `turns[].data`, `presentations[].payload` 는 `deepRedactSecrets`(문자열 leaf 값 패턴과 자격 증명 키 이름)로 가린다.
- `turns[].toolCalls[].arguments`(원문 JSON 문자열)는 `redactSecretsInJsonString` 으로 **JSON 을 깨지 않고** 가린다.
- 내부 소비처(LLM 주입, park 스냅샷, Background 본문)는 원문을 유지한다(§1.1).

## 3.2 AI 응답 이벤트 `execution.ai_message`

같은 AI 턴 텍스트가 `message`·`messages[]`·`presentations[]` 로도 나가고 SSE·EIA 알림 웹훅·채팅 채널(Telegram 등 능동 발송)로 흘러간다.

- 두 발행 지점(`ai-turn-orchestrator` 의 입력 대기 분기와 종결 분기)에서 `redactSecrets`(`message`)와 `deepRedactSecrets`(`messages`, `presentations`)로 가린다.
- `messages[].toolCalls[].arguments`(중첩 JSON 문자열)도 `deepRedactSecrets` 의 JSON 안전 leaf 처리로 깨지지 않게 가린다.
- 이 마스킹은 발행 지점에 걸려 **내부 WebSocket(에디터)과 채팅 채널 능동 발송에도 적용된다.** 이 trade-off 를 받아들인 이유는 부모 Rationale [「내부 WebSocket 과 채팅 채널도 가리는 이유」](CLE-API-EGRESS.md#내부-websocket-과-채팅-채널도-가리는-이유) 에 있다.

## 3.3 입력 대기 `nodeOutput.conversationConfig` 와 종결 `result`·`error`

입력 대기 발행과 EIA 단발 상태 조회는 `nodeOutput.conversationConfig.{message,messages,presentations}` 로 위 §3.1·§3.2 와 **같은 AI 텍스트**를 싣는다. 이 표면이 마스킹을 우회하지 않도록 한다.

- `ai-turn-orchestrator` 의 두 입력 대기 발행은 `conversationConfig` 를 `deepRedactSecrets` 로 가린다(에디터 전용 `turnDebug.llmCalls` 는 건드리지 않는다).
- EIA 단발 상태 조회는 세 출구(입력 대기 `nodeOutput`, 종결 `result`(COMPLETED), 종결 `error`(FAILED)) **모두**에 필드 제거와 값 마스킹을 함께 건다. `stripExternalOnlyFields` 로 디버그 전용 필드를 깊이와 무관하게 빼고 `deepRedactSecrets` 로 자격 증명 모양 값·키를 바꾼다.
- REST 는 `sanitizePayloadForWs` 를 거치지 않는 경로라 둘 다 필요하다. WebSocket fanout 과 같은 필드 목록·같은 깊이 정책을 쓰는 공용 유틸을 쓴다(값 마스킹만 걸려 `llmCalls` 가 세 출구로 새던 경위는 [재제출 거부와 마스커 좌표계 문서](CLE-API-EGRESS-PIPELINE.md#llmcalls-를-strip-only-로-정한-이유) 의 2026-08-14 갱신).

## 3.4 종결 이벤트 `execution.failed` 의 `error`

`execution.failed` 의 `error.message`·`error.details` 는 DB `Execution.error` 원문에서 온다. §3.3 의 종결 `error`(FAILED)와 **다른 컬럼**이다. 그쪽은 EIA 단발 상태 조회가 `Execution.outputData` 로 조립하는 값이다(이름이 같아 혼동하기 쉽다).

- 이 payload 는 내부 WebSocket 뿐 아니라 SSE 와 EIA 알림 웹훅으로 **외부 제3자**에게 나간다. 키 이름 기반 `sanitizePayloadForWs` 와 `llmCalls` 만 지우는 `stripExternalOnlyFields` 로는 자유 텍스트 안의 토큰을 못 잡아 이 필드에는 값 패턴 방어가 없었다.
- `terminal-error-payload.ts` 의 `toTerminalErrorPayload` 가 발행 관문에서 `deepRedactSecrets` 로 `message`·`details` 를 가린다(2026-08-16). 종결 발행 4곳과 채팅 채널 재정규화 1곳이 **모두 이 함수를 거치므로**(DB 쓰기 경로는 0) 새 발행 경로가 생겨도 마스킹이 빠지지 않는다.
- `code`·`nodeId` 는 대상이 아니다. enum 문자열과 uuid 라 값 공간이 닫혀 있다.
- **`execution.cancelled` 의 `error` 는 이 마스킹 대상이 아니다.** 시스템 취소 경로는 `{code, message}` 를 손으로 조립하고 `toTerminalErrorPayload` 를 거치지 않는다. 지금은 모두 정적 상수 문자열이라 샐 위험이 없지만 구조적 보장은 아니다. [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 의 종결 이벤트 필드 집합 표가 두 이벤트의 `error` 를 한 행에 묶으므로 이 비대칭을 여기 적는다.
- DB 는 원문을 보존한다(§1.1).

## 3.5 내부 읽기 경로 (2026-08-16)

같은 `Execution.error` 를 내부 표면은 원문으로 보여 주던 비대칭을 없앴다. 형태는 바꾸지 않고 값만 가린다.

- `error` 는 `redact-stored-error.ts` 의 `redactStoredErrorForResponse`(`deepRedactSecrets` 위임, 형태 보존)가, `outputData` 는 `redactStoredDataForResponse` 가 맡는다. `inputData` 도 대상이다(2026-08-20, §4).
- 걸리는 표면은 다음 **여섯**이다. 소스 정본은 `ExecutionsService.toResponseExecution` 의 표다.
  1. `findById`
  2. `getChain`
  3. `stop`
  4. `findByWorkflow`(목록)
  5. `findById` 의 `nodeExecutions[]`
  6. `BackgroundRunsService.toNodeExecutionDto`(Background 본문 노드, [Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md))
- `POST /executions/:id/re-run` 과 WebSocket `execution.snapshot` 은 `findById` 를 다시 쓰므로 함께 덮인다.
- **`nodeExecutions[].error` 도 함께 가린다.** 실행 데이터 문서가 `Execution.error` 를 "최초 failed 노드 실행의 에러 정보를 복사" 로 정의하므로([실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md)), 최상위만 가리면 같은 문자열이 같은 응답 안에 원문으로 남아 방어가 통째로 우회된다.
- **형태는 바꾸지 않는다.** `toTerminalErrorPayload`(종결 wire 형태로 정규화)를 다시 쓰지 않는다. 내부 응답 계약(`Record<string, unknown> | null`)은 그대로 두고 값만 가린다.
- **HTTP 에러 응답 봉투와 다른 층이다.** [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 의 `message` 비노출 원칙은 요청 실패 응답의 메시지 구성 규칙이다. 여기는 도메인 데이터(`Execution.error` 컬럼 값)의 나가는 시점 마스킹이고 자격 증명 패턴만 겨냥한다. 같은 CWE-209 동기를 공유하지만 강도와 대상이 다르므로 한쪽을 근거로 다른 쪽을 판정하지 않는다.

## 3.6 실행·노드 이벤트 발행의 자유 텍스트 (2026-08-16)

§3.4 와 **또 다른 층**이다. 노드 수준 이벤트(`execution.node.*`) payload 와 `ai_message` 같은 비종결 실행 이벤트의 자유 텍스트다.

- **왜 샜나**: `sanitizePayloadForWs` 는 키 이름 기반이라 문자열 값을 그대로 넘기고 `stripExternalOnlyFields` 는 `llmCalls` 필드 제거 전용이다. 종결 이벤트만 `toTerminalErrorPayload` 가 막고 있었다. 수정하지 않은 상태의 프로브로 `error: 'Authorization: Bearer eyJ…'` 가 fanout 봉투까지 원문으로 가는 것을 실증했다.
- **처방**: `WebsocketService` 의 두 발행(`emitExecutionEvent`, `emitNodeEvent`)이 함께 쓰는 관문에서 가린다. `executionEventSubject.next` 호출부가 정확히 둘이라 한 곳만 고치면 자매가 갈린다. 두 경로가 같은 문을 지나게 했다. 대상은 필드 이름과 무관하게 **payload 전체**다. 대표 예시는 `error`(node.failed), `output`·`input`(node.completed), `message`(ai_message)다.
- **내부 WebSocket wire 와 외부 fanout 양쪽**에 건다(§2.1).
- **예외는 `llmCalls` 하나다.** 에디터 전용 원문 디버그 탈출구라 wire 에서는 원문을 유지한다(`WIRE_PRESERVED_FIELDS`). fanout 에서는 필드째 빠지므로 외부 노출은 늘지 않는다(§5).
- 앞선 키 이름 마스킹의 `[REDACTED]` 마커는 덮이지 않는다. 값 마스커가 마커에 대해 멱등하다(헤더 값 검증 오류의 예외는 규칙 5).
- WebSocket 마스커의 깊이 상한 `MAX_SANITIZE_DEPTH` 는 REST 값 마스커의 상한과 별개 불변식이다(§7).
- **도달 범위도 열거다.** `execution.node.*` 는 SSE 구독자에게 간다(`SseAdapter` 는 이벤트 종류를 거르지 않는다). `execution.node.completed` 만 채팅 채널이 추가로 구독한다. **EIA 알림 웹훅은 `FANOUT_EVENTS` 허용 목록 밖이라 받지 않는다.**
- **부작용(수용)**: 워크플로우가 정당하게 자격 증명을 다루면 그 값이 발행·읽기 표면에서 `***` 로 보인다. §3.2 와 같은 판단이며 외부 EIA 단발 상태 조회는 이미 같은 마스킹을 걸고 있었다(내부에만 없었다). 참여자와 관찰자를 나눠 가리는 방식은 실제 요구가 관측되면 검토한다.
- **설정 에코와도 충돌하지 않는다.** [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 Principle 7 이 설정 에코의 자격 증명 echo 를 이미 금지하므로 이 마스킹은 그 규칙의 나가는 시점 backstop 이다. 자격 증명이 아닌 설정은 바뀌지 않는다. 설정 에코에 자격 증명 패턴이 박혀 있으면 원본 그대로 echo 하는 계약보다 값 마스킹이 우선한다.

## 3.7 워크플로우 AI 어시스턴트 도구 (2026-08-23)

워크플로우 AI 어시스턴트의 LLM 도구(`explore-tools.service.ts`)는 실행의 `inputData`·`outputData`·`error` 세 필드를 내보낸다. 원래는 `maskSensitiveFields`(키 이름 기반)만 걸어 자유 텍스트 안의 자격 증명이 통과했다.

- 값 패턴 마스킹(`deepRedactSecrets`)을 겹쳐 닫았다. **유출 차단을 우선했다.** 식별 힌트(`****9876` 의 끝 네 글자)는 잃지만 자유 텍스트 안의 자격 증명을 막는다. 키 이름은 응답에 그대로 남으므로 어떤 키가 가려졌는지는 여전히 읽을 수 있다.
- `maskSensitiveFields` 자체의 형식은 바뀌지 않는다. 겹치는 것은 그 도구의 로컬 합성이다. 형식 기준은 [워크플로우 AI 어시스턴트 도구](../CLE-WF/CLE-WF-ASSIST-TOOLS.md) 다.
- 이 합성으로 `CREDENTIAL_KEY_PATTERN` 이 그 표면에도 적용돼 `token` 접두 계열이 함께 닫혔다.

## 3.8 외부 `nodeOutput` 의 fail-closed 허용 목록 (2026-08-23, 2026-08-24)

옛 방어는 deny-list(`EXTERNAL_STRIPPED_FIELDS = ['llmCalls']`) 한 칸이라 새 핸들러 키가 기본으로 통과했다. 실제로 엔진 내부 `_retryState`(`NodeExecution.outputData` 에 저장)가 그렇게 나가고 있었다. 런타임 fail-closed 허용 목록(`allowlistNodeOutputKeys`)을 도입했다.

| 표면 | 상태 | 근거 |
|---|---|---|
| EIA 단발 상태 조회 입력 대기 `nodeOutput` | **fail-closed 허용 목록** | 노드 출력(`NodeHandlerOutput`) 형태라 키 집합이 타입에 묶인다 |
| EIA 단발 상태 조회 종결 `result` | deny-list 유지 (**의도적 제외**) | `Execution.outputData` 는 작성자가 정의한 워크플로우 출력이다. 허용 목록을 걸면 정상 데이터가 잘린다 |
| EIA 단발 상태 조회 종결 `error` | deny-list 유지 (**의도적 제외**) | 위와 같다(자유 형식 에러 payload) |
| SSE·fanout `waiting_for_input` 의 `nodeOutput`, `buttonConfig.nodeOutput` | **fail-closed 허용 목록** (2026-08-23) | 같은 `nodeOutput` 이니 같은 강도여야 한다. `emitExecutionEvent`·`emitNodeEvent` 가 `toFanoutEnvelope` 한 함수를 함께 쓰는 단일 관문이라 호출부 변경 없이 닫혔다 |
| SSE·fanout `execution.node.completed`·`.failed` 의 **`envelope.output`** | **fail-closed 허용 목록** (2026-08-24) | 같은 `NodeExecution.outputData` 를 **다른 키**로 싣는 표면이다. 같은 관문에서 같은 목록으로 닫았다 |

- **내부 WebSocket(에디터)은 대상이 아니다.** `toFanoutEnvelope` 를 부를 때 wire 봉투는 이미 `broadcastToChannel` 로 나갔고 fanout 은 새 복제본을 좁힌다. 에디터 디버깅 가치를 지키는 strip-only 결정(§5)이 그대로다.
- **외부 수신자에게는 동작 변경이다.** SSE·채팅 채널로 나가는 `execution.node.completed`·`.failed` payload 의 `output` 최상위에서 목록 밖 키가 사라진다. EIA 알림 웹훅은 영향 밖이다(`FANOUT_EVENTS` 허용 목록 5종 `waiting_for_input`, `completed`, `failed`, `cancelled`, `ai_message` 에 `node.*` 가 없다). 과거 응답에는 `_retryState` 같은 엔진 내부 필드가 이미 나갔을 수 있고 그것을 닫는 것이 이 변경의 목적이다. 알려진 소비처(웹채팅 위젯, 채팅 채널 렌더러)는 실측상 영향이 없지만 **제3자 웹훅 구독자는 확인 범위 밖**이다.
- **남은 위험은 하나다.** `ai-turn-orchestrator.service.ts` 의 `finalAdapted ?? context.nodeOutputCache[node.id]` 폴백은 평탄한 view 를 `outputData` 로 쓸 수 있다(e2e 285건에서는 나타나지 않았다). 그 형태가 오면 목록 밖 키가 떨어지는 것이 fail-closed 의 정의이고 그 동작을 캐너리가 명시적으로 고정한다. "평탄한 view 를 `outputData` 로 영속하는 것이 옳은가" 는 영속 계약 문제라 별건으로 추적한다.
- 래퍼(노드 출력)와 도메인 값(`output` 필드)의 구분은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 Principle 0 이 정본이다.

허용 목록은 세 갈래다.

| 갈래 | 키 | 무엇이 지키나 |
|---|---|---|
| 노드 출력 공개 키 | `config`·`output`·`meta`·`port`·`status` | **컴파일 시점 assertion**. 그 타입에 공개 키가 늘면 빌드가 깨진다 |
| wire 전용 (위젯 파서) | `formConfig`·`conversationConfig`·`buttonConfig`·`interactionType` | 리터럴 테스트, `NodeHandlerOutput` 키와 이름이 겹치면 빌드가 깨지는 assertion |
| wire 전용 (채팅 채널 렌더러) | `payload`·`title`·`rendered`·`nodeType` | 리터럴 테스트, `NodeHandlerOutput` 키와 이름이 겹치면 빌드가 깨지는 assertion |

- 뒤 두 갈래는 노드 출력 타입에 없다. 그래서 막는 수단이 둘로 나뉜다(2026-11-06).
  - 목록이 줄어드는 것은 **리터럴 테스트**가 막는다. 목록에서 파생한 fixture 는 목록이 줄면 케이스도 함께 줄어 조용히 통과한다(실측으로 확인한 형태).
  - 이름 충돌은 **컴파일 시점 assertion** 이 막는다. `NodeHandlerOutput` 의 키(엔진 내부 `_resumeState`·`_retryState` 포함)가 wire 전용 8키와 겹치면 빌드가 깨진다. 8키의 리터럴 union 과 `NODE_OUTPUT_ALLOWED_KEYS` 배열은 양방향으로 묶어 둘이 어긋나면 빌드가 깨진다.
- **이름 기반 허용 목록의 한계.** 허용 목록은 키 이름만 본다. 엔진 내부 필드가 wire 전용 8키와 같은 이름으로 `nodeOutput` 최상위에 붙으면 목록을 통과한다. `NodeHandlerOutput` 타입에 선언된 필드는 위 assertion 이 막는다. 타입 밖에서 붙는 필드는 막지 못한다. 그래서 리뷰에서 두 가지를 확인한다.
  - (가) `nodeOutput` 최상위에 새 필드를 붙일 때 이름이 wire 전용 8키와 겹치지 않는가.
  - (나) 새 발행 경로가 `toFanoutEnvelope` 를 지나는가. 타입과 소스 스캔 테스트가 막지만 별칭을 거친 단언은 막지 못한다(§6).
- 채팅 채널 4키를 표면별 별도 목록으로 가르지 않았다. Discord·Telegram·Slack 렌더러는 `nodeOutput` 을 평탄한 옛 형태(`nodeOutput.rendered` 등)로 읽고 위젯은 `output.rendered` 처럼 한 겹 아래로 읽는데 목록을 표면별로 나누면 손으로 맞출 지점이 둘 생긴다. 표면을 열거하는 것과 같은 이유로 **목록은 하나, 갈래는 주석**으로 둔다.
- **이름이 겹치는 두 쌍을 갈라 둔다.**
  - `nodeOutput.nodeType`(카드 렌더 서브타입 `chart`·`table`·`carousel`, 외부 노출 대상)은 wire 최상위 `waitingNodeType`(`node.type`, 외부 소비 매핑 없는 WebSocket 내부 부가 식별자)과 **다른 필드**다. 값 공간이 겹쳐 오독하기 쉽지만 담긴 객체가 다르다. 엔진은 `nodeOutput` 안에 `nodeType` 을 넣지 않으며 허용 목록 항목은 렌더러의 방어적 읽기를 깨지 않으려는 예방적 허용이다([WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md)).
  - `nodeOutput.payload`(핸들러가 만든 옛 카드 렌더 데이터)는 EIA 알림 웹훅 봉투 최상위 `payload` 와 **같은 키 이름이지만 중첩 수준이 다른 별개 필드**다. 웹훅 wire 에서는 `<봉투>.payload.….nodeOutput.payload` 로 같은 이름이 두 층에 실린다.
- 작성자 설정에 값으로 박힌 시크릿은 여전히 값·키 기반 마스킹 소관이다.

## 3.9 노드 설정 에코 `config` (2026-08-24)

노드 핸들러가 노드 출력에 싣는 실행 시 설정(설정 에코, `NodeHandlerOutput.config`)이다. 실행 상세의 설정 탭이 이 값을 보이고 뷰어도 그 탭을 본다([실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md)).

- **DB 에는 원문으로 저장하고 나가는 자리에서만 가린다.** REST 는 `redactStoredDataForResponse`, WebSocket 은 `maskWireEnvelope` 이고 둘 다 공유 `deepRedactSecrets*` 를 쓴다. `Execution.error`·`outputData` 가 이미 따르던 egress-only 원칙(§1.1)에 설정 에코도 맞췄다.
- **표현식은 원문을 읽는다.** 그래서 DB 를 직접 읽는 사람은 원문을 본다. 엔진 경계 마스킹을 없앤 경위는 Rationale "설정 에코의 경계 마스킹을 없앤 이유" 에 있다.
- **안전 전제**는 두 마스커의 키 축이 어긋나지 않는 것이다. §7 의 포함 관계 캐너리가 이를 확인한다.

이 변경의 대가는 둘이다.

1. **같은 워크스페이스 안 노드 사이 자격 증명 전달.** 표현식이 `config` 를 원문으로 읽으므로 작성자는 한 노드의 `config.apiKey` 를 다른 노드 본문에 실어 제3자 엔드포인트로 보낼 수 있다. 예전 경계 마스킹이 이 경로도 막았지만 그 차단은 기능 결함의 부산물이었다(정상 워크플로우도 함께 깨졌다). 워크플로우 작성 권한이 있는 사용자는 애초에 노드 설정에서 그 자격 증명을 볼 수 있다. 워크스페이스 경계는 넘지 않는다.
2. **생성 시점 한 곳의 안전(safe-by-construction)에서 출구마다 지키는 안전(safe-by-convention)으로 바뀌었다.** `NodeHandlerOutput.config` 에는 원문과 마스킹 값을 가르는 브랜딩이 없어 두 관문을 우회하는 새 출구가 생겨도 컴파일러가 잡지 못한다. 지금 출구는 둘이고 둘 다 공유 마스커를 지난다(실측). **새 출구를 여는 사람은 이 절을 읽어야 한다.**

두 대가는 자격 증명이 노드 `config` 에 평문 문자열로 앉는 자리에서만 생긴다. 그 자리는 좁다.

| 노드·모드 | 해당 여부 | 이유 |
|---|---|---|
| Send Email | 해당 없음 | 자격 증명은 `integrationId` 가 가리키는 통합에서 오고 `config` 에 앉지 않는다([Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md)) |
| HTTP Request `authentication='integration'` | 해당 없음 | 같은 `integrationId` 간접화다. 설정 에코는 필드를 명시 열거하고 `url` 은 `sanitizeUrlCredentials` 결과로 바꾼다([HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md)) |
| HTTP Request `authentication='custom'` | **남는 표면** | 사용자가 `headers`·`body` 에 값을 직접 적는 모드다. 스키마가 없어 간접화할 참조도 없다 |

- 간접화(`llmConfigId`·`integrationId`)는 이미 표준이다. 남은 과제는 사용자 자유 입력 자리를 다루는 일이고 이 좁힌 형태로 후속 작업에 올렸다.
- 새 핸들러와 통합이 `config` 에 시크릿 평문을 싣지 않게 하는 것은 이와 별개인 상시 불변식이다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 Principle 7).

## 3.11 지식 저장소 · Background 채널 발행 (2026-11-06)

`execution:` 밖의 두 구독 채널에도 내부 WebSocket wire 와 같은 값 마스킹을 건다(NERV Task `CLE-T-7ZYES5`).

| 구독 채널 | 발행 관문 | 이벤트 정의 |
|---|---|---|
| `kb:<documentId>` | `WebsocketService.emitKbEvent` | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 의 지식 저장소 문서 이벤트 절, [지식 저장소 데이터](../CLE-KB/CLE-KB-DATA.md) |
| `background:run:<id>` | `WebsocketService.emitBackgroundRunEvent` | [WebSocket 이벤트와 명령 — 채널별 부가 이벤트 「8. Background 본문 실행 이벤트」](CLE-API-WS-EVENTS-CHANNELS.md#8-background-본문-실행-이벤트-server--client) |

- **수신 인구**: 구독 인가가 역할을 보지 않아 뷰어도 받는다. `execution:<id>` 와 같다(§2.1).
- **처방**: 그래서 `execution:` wire 와 같은 `maskWireEnvelope` 를 건다. 값 패턴과 키 이름을 함께 본다. 키 이름 마스킹(`sanitizePayloadForWs`) 뒤에 건다.
- **지금 wire 값은 바뀌지 않는다.** 두 채널에 실리는 값은 발행처가 이미 정제한다. kb 의 `error` 는 `sanitizeLlmErrorMessage` 가 고정 문구로 바꾼 값이다. background 의 `errorMessage` 는 `sanitizeErrorMessage` 를 거친다. 나머지는 숫자 · UUID · 시각과 상태 값(`completed`·`failed`)이다. 바뀌는 것은 발행처가 정제를 잊었을 때 관문이 막는다는 점이다(규칙 4).
- **fanout 이 없다.** 두 채널은 외부 fanout 으로 가지 않아 `stripExternalOnlyFields` 와 허용 목록은 걸지 않는다.
- **키 마커를 덮지 않는다.** 앞선 키 이름 마스킹이 남긴 `[REDACTED]` 는 그대로 남는다(규칙 5). §3.6 의 `execution:` wire 와 같은 동작이고 헤더 값 검증 오류의 예외도 같다.
- **깊이 상한을 넘는 payload 는 `[REDACTED_DEPTH]` 가 아니라 값 마커 `***` 로 끝난다.** 값 마스커(`deepRedactSecretsPreserving`, 상한 `MAX_REDACT_DEPTH`, `depth >= N`, 봉투 최상위부터 센다)가 키 마스커(`sanitizePayloadForWs`, 상한 `MAX_SANITIZE_DEPTH`, `depth > N`, payload 최상위부터 센다)보다 얕은 곳에서 하위 트리를 자르기 때문이다(§7.1). 마커를 덮는 것(규칙 5)이 아니라 그 하위 트리가 더 얕은 곳에서 잘린 결과이고 원문은 어느 쪽이든 나가지 않는다. `execution:` 채널(§3.6)과 같은 동작이다. 지금 두 채널의 payload 는 한 겹이라 이 상한에 닿지 않는다.
- **대상 밖 두 채널**: `notifications:<userId>` 는 본인만 받아 수신 인구가 다르다. `workflow:<id>` 는 구독 인가만 있고 서버 발행처가 없다.

## Rationale

### 내부 읽기 경로에도 마스킹을 건 이유 (2026-08-16)

옛 서술은 이 틈을 REST 표면의 미결 비대칭으로 적었지만 WebSocket `execution.snapshot` 도 같은 원문을 싣고 있었다. 실제로 갈리는 축은 **종결 발행과 그 밖의 모든 읽기 경로**였다. "`ExecutionsService` 4경로" 라는 수도 실측하니 낡아 있었다(`toResponseExecution` 의 `...rest` 가 엔티티를 펼쳐 세 표면이 한 관문을 함께 쓰고 `nodeExecutions[]` 가 따로였다). 그래서 표면을 수가 아니라 이름으로 열거한다(§3.5).

### 설정 에코의 경계 마스킹을 없앤 이유 (2026-08-24)

예전에는 엔진 경계(`handler-output.adapter.ts` 의 `maskSensitiveFields`)에서 설정 에코를 저장 전에 가려 DB·WebSocket·REST 모든 경로가 가린 값을 받았다. 그런데 표현식 컨텍스트(`expression-resolver.service.ts`)가 같은 `config` 를 읽는다. `migrate-node-output-refs.ts` 가 사용자를 `$node["X"].config.<field>` 참조로 옮겨 놓은 뒤라 리터럴 `****abcd` 가 워크플로우에 흘러들었다. 그래서 경계 마스킹을 없애고 나가는 시점 마스킹만 남겼다(§3.9). 설정 탭의 안전성 결론은 그대로다. 그 엔드포인트가 REST 나가는 관문을 지나므로 뷰어가 보는 값은 여전히 가려진다. 바뀐 것은 어디서 가리느냐다. 이 변경의 대가 두 가지는 §3.9 에 적었다.

### 워크플로우 AI 어시스턴트 도구: 유출 차단을 우선한 결정 (2026-08-23)

처음에는 "값 패턴 마스킹을 단순 합성하면 안 된다" 고 적었다. `maskSensitiveFields` 는 자격 증명 키를 `****9876` 처럼 끝 네 글자 힌트를 남겨 어떤 키가 가려졌는지 알게 하는데 값 마스킹을 겹치면 그 힌트가 사라지기 때문이다. 그 경고는 옳았고 실제로 겹치자 기존 테스트 6건이 RED 였다. 무엇을 알고 선택했는지 남기려고 이 경위를 둔다. 결정은 유출 차단 우선이다. 잃는 것은 값의 끝 네 글자뿐이고 키 이름은 남는다.

### 허용 목록 확대를 한때 미뤘다가 닫은 경위 (2026-08-23, 2026-08-24)

2026-08-23 초판의 "REST 와 SSE 는 같은 강도다" 는 구현보다 넓은 서술이었다. 입력 대기의 두 자리는 닫혔지만 `execution.node.completed`·`.failed` 는 같은 `NodeExecution.outputData` 를 `output` 이라는 다른 키로 최상위에 싣는다. 발행 지점은 **6곳**이다(`execution-engine` 2, `form-interaction` 1, `button-interaction` 1, `ai-turn-orchestrator` 2).

그때 유예 근거는 "같은 목록을 그대로 걸 수 없다" 였다. 버튼 재개 경로가 `outputData` 에 `{type, buttonId, buttonLabel, clickedAt, selectedItem, nodeOutput, _selectedPort}` 를 저장해 정본 목록을 걸면 `{}` 가 된다는 측정이었다. 2026-08-24 에 그 근거가 반증됐다. 측정은 맞았고 "그 객체가 `outputData` 가 된다" 는 전제가 틀렸다. `resolveButtonInteraction` 이 만드는 평탄한 record 는 `contextService.setNodeOutput` 으로 메모리 `nodeOutputCache` 에만 들어가고 `nodeExec.outputData` 에 들어가는 것은 다음 줄 `buildResumedStructuredOutput(...)` 의 결과다. 반환 타입이 노드 출력(`{config, output, port, status, meta?}`)이라 모두 목록 안이다.

실 DB 조회로 확정했다(e2e 285건 실행 뒤 e2e postgres 직접 조회). `node_execution.output_data` 93행 중 84행이 object(나머지 NULL, 배열·스칼라 0행)이고 최상위 키는 `meta` 83, `config` 82, `output` 81, `port` 20, `status` 7, `conversationConfig` 1 이 전부였다. 평탄한 record 는 한 행도 없었다. 그래서 같은 목록을 그대로 걸었다.

**교훈**: "그 객체에 목록을 걸면 어떻게 되나" 를 쟀지만 물었어야 할 것은 "그 객체가 이 표면에 도달하나" 였다. 대리 지표를 재고 유예 결론을 냈다.

### 지식 저장소 · Background 채널에도 값 마스킹을 건 이유 (2026-11-06)

두 채널은 뷰어도 받는다. 수신 인구가 `execution:` 과 같아 규칙 2 에 따라 같은 마스킹을 건다(§3.11). 지금 새는 값은 없다. 발행처가 이미 정제하기 때문이다.

기각한 대안은 «걸지 않고 발행처 정제에 맡긴다» 이다. NERV Task `CLE-T-7ZYES5` 가 걸지 않을 경우 그 근거를 남기라고 열어 둔 선택지였다. 이 형태는 발행처마다 정제를 기억해야 한다. 규칙 4 가 피하려는 형태라 기각했다. payload 가 필드 몇 개라 비용은 작다.
