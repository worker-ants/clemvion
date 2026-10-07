---
id: "CLE-API-EGRESS"
title: "응답 자격 증명 마스킹"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API"
ancestors: ["CLE-VISION", "CLE-API"]
area: "CLE-API"
content_hash: "24fcc071e2ecb6812e5175f76d4c2a470737c03ca3aac128caf5ab03993ea026"
read_as: "approved_fallback"
task: "CLE-T-H0GF4K"
source_paths: ["spec/2-navigation/14-execution-history.md", "spec/5-system/14-external-interaction-api.md", "spec/5-system/6-websocket-protocol.md", "spec/conventions/egress-masking.md"]
mirror_sha256: "5014ccd7ba616e7fe1bff4f95616ec4cec0190e4ae0f44341179416d2803c4cd"
etag: "sha256-9355b8363b05a587b42fc3454850f4b2b9b865dde97492f407eb9979804ab96a"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/egress-masking.md`, `spec/5-system/14-external-interaction-api.md` (R17 의 마스킹 정책 부분), `spec/5-system/6-websocket-protocol.md` (§4.1 값-패턴 마스킹 캐비엇, `llmCalls` strip Rationale), `spec/2-navigation/14-execution-history.md` (R-5 의 설정 에코 보안 trade-off) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

응답 마스킹(egress masking)은 DB 원문은 그대로 두고 REST·WebSocket·SSE·EIA 알림 웹훅·채팅 채널로 나가는 페이로드에서만 자격 증명 값을 가리는 정책이다. 이 문서는 그 정책의 원칙, 적용하는 표면의 열거, 남아 있는 틈(잔여 갭), 재제출 거부 규칙, 그리고 마스커·스캐너들의 좌표계(깊이 상한, 경계 연산자, 마커)와 호출 순서를 정한다.

응답 마스킹은 함수 하나가 아니라 여러 마스커와 스캐너가 함께 하는 일이다. 각자 자기 깊이 상한과 비교 연산자가 있고 상한을 넘으면 서로 다른 마스킹 마커(mask markers)를 남긴다. 어느 상한이 어느 연산자로 어느 마커를 어느 소비처에 남기는지, 그리고 그것들을 왜 하나로 합치지 않는지도 이 문서에 둔다.

이 문서가 정하지 않는 것은 아래가 정한다.

| 대상 | 기준 | 기계 강제 |
|---|---|---|
| 마커 **값**·집합·`isMaskedMarker` 판정 | 공유 패키지 `@workflow/masked-markers` (JSDoc) | 패키지 계약 테스트, 미러 재선언 가드 |
| 재제출 거부의 `details[].code` 정규화 | [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 트리거 파라미터 검증 사유 절 | 없음 |
| 노드 핸들러가 자격 증명을 싣지 않을 의무(설정 에코 금지) | [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 Principle 7 | 없음 |
| EIA 단발 상태 조회의 `currentNode`·`context` 노출 결정과 SSE 역할 분담 | [External Interaction API](../CLE-IX/CLE-EIA.md) 의 R17, [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) | 없음 |
| 웹훅 민감 헤더를 받는 시점에 지우는 규칙 | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 의 민감 헤더 마스킹 절 | 없음 |

- **비대상: 필드 마스킹(`***<last4>`).** 인증 설정·모델 설정 응답 DTO 가 저장된 자격 증명 필드를 끝 네 글자만 보이게 가리는 필드 단위 정책은 이 문서의 대상이 아니다. 기준은 [외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md) 과 [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) 의 마스킹·노출 정책이다. 이 문서는 나가는 페이로드를 훑어 값 패턴과 키 이름으로 바꾸는 메커니즘만 다룬다. 둘 다 "마스킹" 이라 혼동하기 쉬워 적어 둔다([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 도 같은 콜아웃을 둔다). 트리거 응답의 마지막 오류 필드는 필드 마스킹이 아니라 이 문서의 응답 마스킹(값 패턴 판정)이다(§3.10).
- **비대상: 로그 마스킹.** 서버 로그에 자격 증명이 남지 않게 하는 규칙은 [로깅과 헬스 체크](../CLE-OBS/CLE-OBS-LOGGING.md) 가 정한다.
- **인접 정책: 알려진 비밀 치환.** 채팅 채널의 프로바이더 API 클라이언트가 실패 원문을 만들 때 그 호출에 쓴 시크릿 저장소 평문을 지우는 일은 나가는 시점 마스킹이 아니다. 이 문서는 경계만 적고(§1.1) 동작은 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 14 와 [채팅 채널 어댑터 규약 「규칙」](../CLE-CHAT/CLE-CHAT-ADAPTER.md#규칙) 10 이 정한다.
- **잔여 갭: 알림 URL 의 자격 증명.** 트리거 응답의 `config.notification.url` 은 원문으로 나간다. 같은 응답의 마지막 오류에서는 `user:pass@` 를 가리므로 §3.5 가 막은 «같은 응답 안의 원문이 방어를 우회하는» 형태가 남아 있다(§3.10, NERV Task `CLE-T-RCQGCC`).
- **네트워크 egress 와 무관하다.** [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md) 의 사설망 차단(SSRF guard)이 말하는 egress 는 나가는 네트워크 목적지 제한이다. 이 문서의 egress 는 응답·이벤트 페이로드가 나가는 시점을 뜻한다. 같은 단어가 두 도메인에 있다.

## 규칙

1. **DB 는 원문을 보존한다.** 마스킹은 나가는 시점(egress)에만 한다. 자유 텍스트와 진단용 필드는 저장할 때 지우지 않는다. 시크릿 저장소에서 푼 평문은 이 규칙이 보존하는 원문에 들지 않는다. 그 값은 원문을 만든 자리에서 지운다(§1.1). 통합 `last_error` 의 암호화와 MCP 오류의 저장 전 가림은 각 문서의 결정이다(§1.1).
2. **마스킹 범위는 수신 인구가 정한다(boundary parity).** 같은 사람들이 받는 표면은 같은 마스킹을 받는다. 역할 게이트가 아니라 서버의 마스킹 일치에 안전성을 건다.
3. **적용 범위는 총칭이 아니라 열거다.** "모든 읽기 경로" 로 적지 않고 표면을 이름으로 적는다(§3).
4. **마스킹은 공유 관문에서 건다.** 새 읽기·발행 경로가 그 관문을 지나면 마스킹을 구조적으로 이어받게 한다. 호출부마다 따로 걸지 않는다.
5. **마스킹은 한 번이다.** 뒤 단계는 앞 단계가 남긴 마커를 다른 마커로 덮지 않는다. 예외는 하나다. fetch 헤더 값 검증 오류의 따옴표 안은 그 안에 든 마커까지 값 마커 하나로 바꾼다(§3.10, Rationale 「트리거 응답의 마지막 오류를 표면에 올린 이유」).
6. **`toFanoutEnvelope` 는 정한 네 단계 순서를 지키고 뒤에서 다시 마스킹하지 않는다.**
7. **`llmCalls` 는 strip-only 다.** 외부 수신자에게는 필드째 빼고 내부 WebSocket wire 에서는 값 마스킹도 하지 않고 원문을 유지한다.
8. **외부로 나가는 `nodeOutput` 은 fail-closed 허용 목록(allowlist)을 지난다.** 작성자가 정의한 워크플로우 출력(`result`)과 자유 형식 에러는 대상에서 뺀다.
9. **다시 쓰이는 값(round-trip)은 카브아웃하지 않고 소비 쪽 마커 가드로 다룬다.** 마커가 실제 입력이 되지 않도록 프리필을 건너뛰거나 제출을 막는다.
10. **수동 실행 경로는 마커와 정확히 같은 값을 거부한다.** `400` 과 `details[].code = MASKED_VALUE_RESUBMITTED` 다. 웹훅 수신과 스케줄은 대상이 아니다.
11. **좌표계 표에는 마커 값을 적지 않고 이름으로만 부른다.** 값을 적으면 문서가 패키지의 미러가 된다. wire 계약을 서술하는 곳(§3, §4)에서는 마커 문자열을 인용해도 된다.

## 1. 원칙

### 1.1 egress-only

DB 는 원문을 보존하고 나가는 페이로드만 가린다.

- 내부 소비처(LLM 컨텍스트 주입, park 할 때 저장하는 대화 스레드 스냅샷 `Execution.conversation_thread`, Background 본문)는 원문 텍스트를 그대로 쓴다.
- DB `Execution.error` 도 원문을 보존한다. 서버 로그와 사후 디버깅의 진실을 남기기 위해서다.
- 저장 시점(append) 마스킹은 채택하지 않는다. 이유는 Rationale "egress-only 를 택한 이유" 에 있다. DB 에 쌓인 원문을 줄이는 것(append 시점 마스킹)은 데이터 최소화가 요구될 때 다룰 후속 항목이다.
- **시크릿 저장소 평문은 보존하는 원문에 들지 않는다.** 시크릿 저장소에서 푼 평문(봇 토큰 등)은 DB 와 로그에 닿으면 안 된다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 14). 그래서 채팅 채널의 프로바이더 API 클라이언트(Slack · Discord · Telegram)는 실패 원문을 돌려주거나 로그에 남기기 전에 그 호출에 쓴 평문을 지운다. 이 일을 알려진 비밀 치환이라 부르고 동작은 [채팅 채널 어댑터 규약 「규칙」](../CLE-CHAT/CLE-CHAT-ADAPTER.md#규칙) 10 이 정한다. 값 패턴을 추측하지 않아 Rationale 「egress-only 를 택한 이유」 가 걱정한 오탐이 없다. 값 패턴 마스킹은 지금처럼 저장할 때 하지 않는다(2026-10-05, NERV Task `CLE-T-H0GF4K`).
- **통합의 마지막 오류는 다른 결정이다.** 통합 행의 `last_error` 는 암호화해 저장하고([통합 데이터 모델](../CLE-INT/CLE-INT-DATA.md)) MCP 호출 진단의 에러 메시지는 저장 전에 자격 증명 모양을 가린다([MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)). 둘 다 그 문서의 결정이고 이 문서의 egress-only 와 별개다.

### 1.2 받는 시점(ingestion)과 나가는 시점(egress)이 함께 있다

[웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 은 민감 헤더를 **받는 시점**에 지우고(`[REDACTED]`), 이 문서는 `Execution.error` 등을 **나가는 시점**에 가린다. 모순이 아니라 대상이 다르다.

- **구조화된 시크릿 전용 필드(알려진 헤더 key)** 는 검증 뒤 원문을 남길 이유가 없어 받는 시점에 지우는 것이 옳다.
- **자유 텍스트와 진단용 필드** 는 저장할 때 지우면 사후 디버깅의 진실이 사라져 나가는 시점이 옳다. 자유 텍스트는 대상 패턴을 미리 정할 수 없어 애초에 받는 시점에 걷어낼 수 없다.
- 두 층은 경쟁하지 않고 **쌓인다.** 키 blacklist 가 못 잡는 값 패턴을 나가는 층이 덮는다.
- 그래서 나가는 층은 받는 층의 마커를 덮지 않는다(§6). 덮으면 같은 헤더가 `$trigger.headers` 에서는 `[REDACTED]`, 실행 상세 API 에서는 `***` 로 보인다. 규칙 5 의 예외 구간(헤더 값 검증 오류의 따옴표 안)은 제외한다.
- 만든 자리의 알려진 비밀 치환(§1.1)은 받는 층과 다르게 나가는 층과 겹친다. 알려진 비밀 치환이 남긴 값 마커가 든 헤더 값 검증 오류는 나가는 층이 따옴표 안을 통째로 값 마커 하나로 바꾼다(규칙 5 의 예외, §3.10).

### 1.3 마스커의 종류

| 종류 | 무엇을 가리나 | 대표 함수 |
|---|---|---|
| 값 패턴 | 자유 텍스트 안에 박힌 자격 증명 모양(`Bearer …`, `Authorization:` 헤더, bare JWT, 자격 증명을 담은 URI, fetch 의 헤더 값 검증 오류에 실린 헤더 값 등) | `redactSecrets`(문자열), `deepRedactSecrets`(구조화 값의 문자열 leaf), `redactSecretsInJsonString`(JSON 문자열을 파싱해 가린 뒤 다시 직렬화) |
| 키 이름 | 자격 증명 키 이름과 맞는 필드의 값 | `deepRedactSecrets` 의 키 매칭, `sanitizePayloadForWs`(WebSocket), `maskSensitiveFields`(워크플로우 AI 어시스턴트 도구) |
| 필드 제거 | 디버그 전용 필드 자체 | `stripExternalOnlyFields`(`llmCalls` 를 깊이와 무관하게 제거) |
| 허용 목록 | 목록 밖의 키 | `allowlistNodeOutputKeys`, `allowlistFanoutNodeOutput` |

- 값 패턴과 키 이름 판정은 `sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS`·`CREDENTIAL_KEY_PATTERN` 을 함께 쓴다. 에러 메시지 sanitizer 와 같은 기준이다.
- `CREDENTIAL_KEY_PATTERN`(공용과 WebSocket 미러)과 값 패턴은 `token` **계열 전체**를 덮는다. bare `token` 과 `access_token`·`csrf_token`·`csrfToken`·`x-auth-token` 같은 접두형이다(2026-08-17).
- `deepRedactSecrets` 는 정상 결과 데이터를 copy-on-change 로 보존하고 이미 마스킹된 값(`[REDACTED]`, `***`, `[REDACTED_DEPTH]`)은 다시 가리지 않는다. 값 전체가 마커일 때의 이야기다. 헤더 값 검증 오류의 따옴표 안은 마커가 들어 있어도 통째로 값 마커가 된다(규칙 5 의 예외, §3.10).
- **값 마스킹만으로는 부족하다.** `deepRedactSecrets` 는 값과 키 패턴을 바꿀 뿐 `llmCalls` 같은 **필드 자체**는 남긴다. 그래서 외부 표면은 필드 제거(`stripExternalOnlyFields`)와 값 마스킹을 함께 건다.
- 알려진 비밀 치환(`replaceKnownSecret`)은 나가는 마스커가 아니라 이 표와 §7 좌표계에 없다(§1.1).

## 2. 마스킹 범위를 정하는 기준

### 2.1 수신 인구 (boundary parity)

마스킹 범위는 그 표면을 받는 사람들이 정한다.

- `GET /api/executions/:id` 에는 `@Roles` 게이트가 없어 뷰어를 포함한 워크스페이스 멤버 전원이 조회하고 프론트엔드는 실패 배너에 `error.message` 를 그대로 보인다.
- WebSocket `execution:<id>` 구독 인가는 워크스페이스 소유만 보고 역할을 받지 않는다([WebSocket 연결과 채널 구독](CLE-API-WS.md)). 수신 인구가 `GET /api/executions/:id` 와 같다.
- 그래서 내부 읽기 경로와 내부 WebSocket wire 에도 외부 표면과 같은 값 마스킹을 건다. [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md) 의 R-5 가 적은 "안전성은 역할 게이팅이 아니라 서버 egress masking parity 에 의존한다" 는 원칙과 같다. R-5 의 직접 대상은 설정(Config) 탭이라 `Execution.error` 를 규정하지는 않는다. 원칙을 가져다 쓴 것이지 기존 판정이 아니다.

### 2.2 공유 관문

마스킹은 호출부를 하나씩 고치는 방식이 아니라 소수의 공유 관문에 건다.

| 관문 | 지나는 경로 |
|---|---|
| `ExecutionsService.toResponseExecution` | 실행 REST 응답(§3.5 의 표면들) |
| `WebsocketService.emitExecutionEvent`·`emitNodeEvent` | 모든 실행·노드 이벤트 발행(내부 WebSocket wire 와 외부 fanout) |
| `toTerminalErrorPayload` | 종결 이벤트의 `error` |
| `redactThreadForPublic` | 대화 스레드의 공개 표면 |
| `TriggersService.sanitizeForResponse` | 트리거 REST 응답(§3.10 의 표면들) |

새 읽기·발행 경로가 이 관문을 지나면 마스킹을 구조적으로 이어받는다. 늘어나는 것은 표면의 발견이지 마스킹을 손으로 거는 자리가 아니다.

## 3. 적용 표면

표면은 총칭이 아니라 이름으로 적는다. "모든 내부 읽기 경로" 로 읽으면 잔여 갭이 가려진다. 원문 문서가 반복해 겪은 실패라 표면을 이름으로 못박는다.

### 3.1 대화 스레드 (`conversationThread`)

EIA 단발 상태 조회(`GET /api/external/executions/:id`)와 SSE `waiting_for_input` 은 대화 스레드를 싣는다. 노드 핸들러는 대화 기록 항목 텍스트에 민감 정보(API 키, Bearer 토큰, Authorization 헤더 등)를 남기지 않는다는 불변식이 있고 이 불변식을 런타임에 강제한다.

- REST 와 SSE 가 **같은 헬퍼 `redactThreadForPublic`** 를 거쳐 두 경로가 같게 가려진다.
- 자유 텍스트 `turns[].text`, `runningSummary` 는 `redactSecrets`(값 패턴)로 가린다.
- 구조화 필드 `turns[].data`, `presentations[].payload` 는 `deepRedactSecrets`(문자열 leaf 값 패턴과 자격 증명 키 이름)로 가린다.
- `turns[].toolCalls[].arguments`(원문 JSON 문자열)는 `redactSecretsInJsonString` 으로 **JSON 을 깨지 않고** 가린다.
- 내부 소비처(LLM 주입, park 스냅샷, Background 본문)는 원문을 유지한다(§1.1).

### 3.2 AI 응답 이벤트 `execution.ai_message`

같은 AI 턴 텍스트가 `message`·`messages[]`·`presentations[]` 로도 나가고 SSE·EIA 알림 웹훅·채팅 채널(Telegram 등 능동 발송)로 흘러간다.

- 두 발행 지점(`ai-turn-orchestrator` 의 입력 대기 분기와 종결 분기)에서 `redactSecrets`(`message`)와 `deepRedactSecrets`(`messages`, `presentations`)로 가린다.
- `messages[].toolCalls[].arguments`(중첩 JSON 문자열)도 `deepRedactSecrets` 의 JSON 안전 leaf 처리로 깨지지 않게 가린다.
- 이 마스킹은 발행 지점에 걸려 **내부 WebSocket(에디터)과 채팅 채널 능동 발송에도 적용된다.** 이 trade-off 를 받아들인 이유는 Rationale "내부 WebSocket 과 채팅 채널도 가리는 이유" 에 있다. 에디터는 외부 strip 대상이 아닌 `llmCalls` 디버그로 원문을 확인할 수 있다.

### 3.3 입력 대기 `nodeOutput.conversationConfig` 와 종결 `result`·`error`

입력 대기 발행과 EIA 단발 상태 조회는 `nodeOutput.conversationConfig.{message,messages,presentations}` 로 위 §3.1·§3.2 와 **같은 AI 텍스트**를 싣는다. 이 표면이 마스킹을 우회하지 않도록 한다.

- `ai-turn-orchestrator` 의 두 입력 대기 발행은 `conversationConfig` 를 `deepRedactSecrets` 로 가린다(에디터 전용 `turnDebug.llmCalls` 는 건드리지 않는다).
- EIA 단발 상태 조회는 세 출구(입력 대기 `nodeOutput`, 종결 `result`(COMPLETED), 종결 `error`(FAILED)) **모두**에 필드 제거와 값 마스킹을 함께 건다. `stripExternalOnlyFields` 로 디버그 전용 필드를 깊이와 무관하게 빼고 `deepRedactSecrets` 로 자격 증명 모양 값·키를 바꾼다.
- REST 는 `sanitizePayloadForWs` 를 거치지 않는 경로라 둘 다 필요하다. 2026-08-14 이전에는 이 표면에 값 마스킹만 걸려 `nodeOutput.meta.turnDebug[].llmCalls[].requestPayload`(시스템 프롬프트, 대화 이력)가 세 출구로 그대로 나갔다. WebSocket fanout 과 같은 필드 목록·같은 깊이 정책을 쓰는 공용 유틸로 맞춰 닫았다.

### 3.4 종결 이벤트 `execution.failed` 의 `error`

`execution.failed` 의 `error.message`·`error.details` 는 DB `Execution.error` 원문에서 온다. §3.3 의 종결 `error`(FAILED)와 **다른 컬럼**이다. 그쪽은 EIA 단발 상태 조회가 `Execution.outputData` 로 조립하는 값이다(이름이 같아 혼동하기 쉽다).

- 이 payload 는 내부 WebSocket 뿐 아니라 SSE 와 EIA 알림 웹훅으로 **외부 제3자**에게 나간다. WebSocket 의 `sanitizePayloadForWs` 는 자격 증명 **키 이름** 기반이라 자유 텍스트 안의 토큰을 못 잡고 `stripExternalOnlyFields` 는 `llmCalls` 만 지운다. 그래서 이 필드에는 값 패턴 방어가 없었다.
- `terminal-error-payload.ts` 의 `toTerminalErrorPayload` 가 발행 관문에서 `deepRedactSecrets` 로 `message`·`details` 를 가린다(2026-08-16). 종결 발행 4곳과 채팅 채널 재정규화 1곳이 **모두 이 함수를 거치므로**(DB 쓰기 경로는 0) 새 발행 경로가 생겨도 마스킹이 빠지지 않는다.
- `code`·`nodeId` 는 대상이 아니다. enum 문자열과 uuid 라 값 공간이 닫혀 있다.
- **`execution.cancelled` 의 `error` 는 이 마스킹 대상이 아니다.** 시스템 취소 경로는 `{code, message}` 를 손으로 조립하고 `toTerminalErrorPayload` 를 거치지 않는다. 지금은 모두 정적 상수 문자열이라 샐 위험이 없지만 구조적 보장은 아니다. [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 의 종결 이벤트 필드 집합 표가 두 이벤트의 `error` 를 한 행에 묶으므로 이 비대칭을 여기 적는다.
- DB 는 원문을 보존한다(§1.1).

### 3.5 내부 읽기 경로 (2026-08-16)

같은 `Execution.error` 를 내부 표면은 원문으로 보여 주던 비대칭을 없앴다. 형태는 바꾸지 않고 값만 가린다.

- `error` 는 `redact-stored-error.ts` 의 `redactStoredErrorForResponse`(`deepRedactSecrets` 위임, 형태 보존)가, `outputData` 는 `redactStoredDataForResponse` 가 맡는다. `inputData` 도 대상이다(2026-08-20, §4).
- 걸리는 표면은 다음 **여섯**이다. 소스 정본은 `ExecutionsService.toResponseExecution` 의 표다.
  1. `findById`
  2. `getChain`
  3. `stop`
  4. `toExecutionDto`(목록)
  5. `findById` 의 `nodeExecutions[]`
  6. `BackgroundRunsService.toNodeExecutionDto`(Background 본문 노드, [Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md))
- `POST /executions/:id/re-run` 과 WebSocket `execution.snapshot` 은 `findById` 를 다시 쓰므로 함께 덮인다.
- **`nodeExecutions[].error` 도 함께 가린다.** 실행 데이터 문서가 `Execution.error` 를 "최초 failed 노드 실행의 에러 정보를 복사" 로 정의하므로([실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md)), 최상위만 가리면 같은 문자열이 같은 응답 안에 원문으로 남아 방어가 통째로 우회된다.
- **형태는 바꾸지 않는다.** `toTerminalErrorPayload`(종결 wire 형태로 정규화)를 다시 쓰지 않는다. 내부 응답 계약(`Record<string, unknown> | null`)은 그대로 두고 값만 가린다.
- **HTTP 에러 응답 봉투와 다른 층이다.** [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 의 `message` 비노출 원칙은 요청 실패 응답의 메시지 구성 규칙이다. 여기는 도메인 데이터(`Execution.error` 컬럼 값)의 나가는 시점 마스킹이고 자격 증명 패턴만 겨냥한다. 같은 CWE-209 동기를 공유하지만 강도와 대상이 다르므로 한쪽을 근거로 다른 쪽을 판정하지 않는다.

### 3.6 실행·노드 이벤트 발행의 자유 텍스트 (2026-08-16)

§3.4 와 **또 다른 층**이다. 노드 수준 이벤트(`execution.node.*`) payload 와 `ai_message` 같은 비종결 실행 이벤트의 자유 텍스트다.

- **왜 샜나**: `sanitizePayloadForWs` 는 키 이름 기반이라 문자열 값을 그대로 넘기고 `stripExternalOnlyFields` 는 `llmCalls` 필드 제거 전용이다. 종결 이벤트만 `toTerminalErrorPayload` 가 막고 있었다. 수정하지 않은 상태의 프로브로 `error: 'Authorization: Bearer eyJ…'` 가 fanout 봉투까지 원문으로 가는 것을 실증했다.
- **처방**: `WebsocketService` 의 두 발행(`emitExecutionEvent`, `emitNodeEvent`)이 함께 쓰는 관문에서 가린다. `executionEventSubject.next` 호출부가 정확히 둘이라 한 곳만 고치면 자매가 갈린다. 두 경로가 같은 문을 지나게 했다. 대상은 필드 이름과 무관하게 **payload 전체**다. 대표 예시는 `error`(node.failed), `output`·`input`(node.completed), `message`(ai_message)다.
- **내부 WebSocket wire 와 외부 fanout 양쪽**에 건다(§2.1).
- **예외는 `llmCalls` 하나다.** 에디터 전용 원문 디버그 탈출구라 wire 에서는 원문을 유지한다(`WIRE_PRESERVED_FIELDS`). fanout 에서는 필드째 빠지므로 외부 노출은 늘지 않는다(§5).
- 앞선 키 이름 마스킹의 `[REDACTED]` 마커는 덮이지 않는다. 값 마스커가 마커에 대해 멱등하다. 값 전체가 마커일 때의 이야기이고 헤더 값 검증 오류의 따옴표 안은 예외다(규칙 5).
- WebSocket 마스커의 깊이 상한 `MAX_SANITIZE_DEPTH` 는 REST 값 마스커의 상한과 별개 불변식이다(§7).
- **도달 범위도 열거다.** `execution.node.*` 는 SSE 구독자에게 간다(`SseAdapter` 는 이벤트 종류를 거르지 않는다). `execution.node.completed` 만 채팅 채널이 추가로 구독한다. **EIA 알림 웹훅은 `FANOUT_EVENTS` 허용 목록 밖이라 받지 않는다.**
- **부작용(수용)**: 워크플로우가 정당하게 자격 증명을 다루면 그 값이 발행·읽기 표면에서 `***` 로 보인다. §3.2 와 같은 판단이며 외부 EIA 단발 상태 조회는 이미 같은 마스킹을 걸고 있었다(내부에만 없었다). 참여자와 관찰자를 나눠 가리는 방식은 실제 요구가 관측되면 검토한다.
- **설정 에코와도 충돌하지 않는다.** [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 Principle 7 은 설정 에코에서 자격 증명을 "절대 echo 금지" 로 이미 규정한다. 이 마스킹은 그 규칙을 나가는 시점에 집행하는 backstop 이지 새 예외가 아니다. 자격 증명이 아닌 설정은 바뀌지 않는다. 설정 에코에 자격 증명 패턴이 박혀 있으면 원본 그대로 echo 하는 계약보다 값 마스킹이 우선한다.

### 3.7 워크플로우 AI 어시스턴트 도구 (2026-08-23)

워크플로우 AI 어시스턴트의 LLM 도구(`explore-tools.service.ts`)는 실행의 `inputData`·`outputData`·`error` 세 필드를 내보낸다. 원래는 `maskSensitiveFields`(키 이름 기반)만 걸어 자유 텍스트 안의 자격 증명이 통과했다.

- 값 패턴 마스킹(`deepRedactSecrets`)을 겹쳐 닫았다. **유출 차단을 우선했다.** 식별 힌트(`****9876` 의 끝 네 글자)는 잃지만 자유 텍스트 안의 자격 증명을 막는다. 키 이름은 응답에 그대로 남으므로 어떤 키가 가려졌는지는 여전히 읽을 수 있다.
- `maskSensitiveFields` 자체의 형식은 바뀌지 않는다. 겹치는 것은 그 도구의 로컬 합성이다. 형식 기준은 [워크플로우 AI 어시스턴트 도구](../CLE-WF/CLE-WF-ASSIST-TOOLS.md) 다.
- 이 합성으로 `CREDENTIAL_KEY_PATTERN` 이 그 표면에도 적용돼 `token` 접두 계열이 함께 닫혔다.

### 3.8 외부 `nodeOutput` 의 fail-closed 허용 목록 (2026-08-23, 2026-08-24)

옛 방어는 deny-list(`EXTERNAL_STRIPPED_FIELDS = ['llmCalls']`) 한 칸이라 새 핸들러 키가 기본으로 통과했다. 실제로 엔진 내부 `_retryState`(`NodeExecution.outputData` 에 저장)가 그렇게 나가고 있었다. 런타임 fail-closed 허용 목록(`allowlistNodeOutputKeys`)을 도입했다.

| 표면 | 상태 | 근거 |
|---|---|---|
| EIA 단발 상태 조회 입력 대기 `nodeOutput` | **fail-closed 허용 목록** | 노드 출력(`NodeHandlerOutput`) 형태라 키 집합이 타입에 묶인다 |
| EIA 단발 상태 조회 종결 `result` | deny-list 유지 (**의도적 제외**) | `Execution.outputData` 는 작성자가 정의한 워크플로우 출력이다. 허용 목록을 걸면 정상 데이터가 잘린다 |
| EIA 단발 상태 조회 종결 `error` | deny-list 유지 (**의도적 제외**) | 위와 같다(자유 형식 에러 payload) |
| SSE·fanout `waiting_for_input` 의 `nodeOutput`, `buttonConfig.nodeOutput` | **fail-closed 허용 목록** (2026-08-23) | 같은 `nodeOutput` 이니 같은 강도여야 한다. `emitExecutionEvent`·`emitNodeEvent` 가 `toFanoutEnvelope` 한 함수를 함께 쓰는 단일 관문이라 호출부 변경 없이 닫혔다 |
| SSE·fanout `execution.node.completed`·`.failed` 의 **`envelope.output`** | **fail-closed 허용 목록** (2026-08-24) | 같은 `NodeExecution.outputData` 를 **다른 키**로 싣는 표면이다. 같은 관문에서 같은 목록으로 닫았다 |

- **내부 WebSocket(에디터)은 대상이 아니다.** `toFanoutEnvelope` 를 부를 때 wire 봉투는 이미 `broadcastToChannel` 로 나갔고 fanout 은 새 복제본을 좁힌다. 에디터 디버깅 가치를 지키는 strip-only 결정(§5)이 그대로다.
- **외부 수신자에게는 동작 변경이다.** SSE·채팅 채널로 나가는 `execution.node.completed`·`.failed` payload 의 `output` 최상위에서 목록 밖 키가 사라진다. EIA 알림 웹훅은 영향 밖이다. `FANOUT_EVENTS` 허용 목록 5종(`waiting_for_input`, `completed`, `failed`, `cancelled`, `ai_message`)에 `node.*` 가 없어 웹훅은 이 이벤트를 받지 않는다. 과거 응답에는 `_retryState` 같은 엔진 내부 필드가 이미 나갔을 수 있고 그것을 닫는 것이 이 변경의 목적이다. 알려진 소비처(웹채팅 위젯, 채팅 채널 렌더러)는 실측으로 영향이 없음을 확인했지만 **제3자 웹훅 구독자는 확인 범위 밖**이다.
- **남은 위험은 하나다.** `ai-turn-orchestrator.service.ts` 의 `finalAdapted ?? context.nodeOutputCache[node.id]` 폴백은 평탄한 view 를 `outputData` 로 쓸 수 있다(e2e 285건에서는 나타나지 않았다). 그 형태가 오면 목록 밖 키가 떨어지는 것이 fail-closed 의 정의이고 그 동작을 캐너리가 명시적으로 고정한다. "평탄한 view 를 `outputData` 로 영속하는 것이 옳은가" 는 영속 계약 문제라 별건으로 추적한다.
- 래퍼(노드 출력)와 도메인 값(`output` 필드)의 구분은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 Principle 0 이 정본이다. 이 절은 그 계약을 다시 적지 않는다.

허용 목록은 세 갈래다.

| 갈래 | 키 | 무엇이 지키나 |
|---|---|---|
| 노드 출력 공개 키 | `config`·`output`·`meta`·`port`·`status` | **컴파일 시점 assertion**. 그 타입에 공개 키가 늘면 빌드가 깨진다 |
| wire 전용 (위젯 파서) | `formConfig`·`conversationConfig`·`buttonConfig`·`interactionType` | 리터럴 테스트 |
| wire 전용 (채팅 채널 렌더러) | `payload`·`title`·`rendered`·`nodeType` | 리터럴 테스트 |

- 뒤 두 갈래는 타입에 없으므로 **리터럴 테스트가 유일한 방어**다. 목록에서 파생한 fixture 는 목록이 줄면 케이스도 함께 줄어 조용히 통과한다(실측으로 확인한 형태).
- 채팅 채널 4키를 표면별 별도 목록으로 가르지 않았다. Discord·Telegram·Slack 렌더러는 `nodeOutput` 을 평탄한 옛 형태(`nodeOutput.rendered` 등)로 읽고 위젯은 `output.rendered` 처럼 한 겹 아래로 읽는데 목록을 표면별로 나누면 손으로 맞출 지점이 둘 생긴다. 표면을 열거하는 것과 같은 이유로 **목록은 하나, 갈래는 주석**으로 둔다.
- **이름이 겹치는 두 쌍을 갈라 둔다.**
  - `nodeOutput.nodeType`(카드 렌더 서브타입 `chart`·`table`·`carousel`, 외부 노출 대상)은 wire 최상위 `waitingNodeType`(`node.type`, 외부 소비 매핑 없는 WebSocket 내부 부가 식별자)과 **다른 필드**다. 값 공간이 겹쳐 오독하기 쉽지만 담긴 객체가 다르다. 엔진은 `nodeOutput` 안에 `nodeType` 을 넣지 않으며 허용 목록 항목은 렌더러의 방어적 읽기를 깨지 않으려는 예방적 허용이다([WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md)).
  - `nodeOutput.payload`(핸들러가 만든 옛 카드 렌더 데이터)는 EIA 알림 웹훅 봉투 최상위 `payload` 와 **같은 키 이름이지만 중첩 수준이 다른 별개 필드**다. 웹훅 wire 에서는 `<봉투>.payload.….nodeOutput.payload` 로 같은 이름이 두 층에 실린다.
- 작성자 설정에 값으로 박힌 시크릿은 여전히 값·키 기반 마스킹 소관이다.

### 3.9 노드 설정 에코 `config` (2026-08-24)

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

- 간접화(`llmConfigId`·`integrationId`)는 이미 표준이다. 남은 근본 과제는 사용자 자유 입력 자리를 어떻게 다룰지이고 훨씬 어렵다. 이 좁힌 형태로 후속 작업에 올렸다.
- 새 핸들러와 통합이 `config` 에 시크릿 평문을 싣지 않게 하는 것은 이와 별개인 상시 불변식이다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 Principle 7).

### 3.10 트리거 응답의 마지막 오류 (2026-10-05)

트리거의 두 마지막 오류 필드는 실패 원인을 보여 주는 진단 원문이다. 저장값은 원문으로 두고 응답에서 값 패턴으로 가린다(NERV Task `CLE-T-H0GF4K`).

| DB 컬럼 | 응답 필드 | 담는 것 | 저장할 때 자르는 길이 |
|---|---|---|---|
| `chat_channel_last_error` | `chatChannelLastError` | 채팅 채널 어댑터 실패(렌더 · 발송 · 채널 설정)의 원문과 서버가 정한 문구([채팅 채널 「채널 건강도」](../CLE-CHAT/CLE-CHAT-CORE.md#채널-건강도)) | 1024자 |
| `notification_last_error` | `notificationLastError` | EIA 알림 웹훅 발송 실패의 원문과 서버가 정한 문구([EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md)) | 500자 |

- **표면**: `GET /api/triggers`(목록), `GET /api/triggers/:id`(상세), `POST /api/triggers`(생성), `PATCH /api/triggers/:id`(수정) 응답이다. 모두 `TriggersService.sanitizeForResponse` 를 지난다(§2.2).
- **비대상**: 스케줄 응답은 조인한 트리거를 `id` · `name` · `workflowId`(워크플로우를 불러왔으면 `workflow.name` 도)로 좁혀 두 필드를 싣지 않는다. 봇 토큰 재발급 · 알림 서명 시크릿 교체 응답도 이 필드를 싣지 않는다.
- **수신 인구**: 두 GET 은 `@Roles` 게이트가 없어 뷰어를 포함한 워크스페이스 멤버가 받는다. 실행 상세(§2.1)와 같은 사람들이라 같은 값 패턴 마스커 `redactSecrets`(`codebase/backend/src/shared/utils/sanitize-error-message.ts`, 자르지 않는다)를 건다.
- **알려진 비밀 치환과 나가는 시점 마스킹**:
  1. 만든 자리(§1.1): 채팅 채널의 프로바이더 API 클라이언트(Slack · Discord · Telegram)가 자기가 만든 실패 문장(fetch 예외, 재시도 소진 사유)을 돌려주거나 로그에 남기기 전에 그 호출에 쓴 봇 토큰을 지운다. 세부는 [채팅 채널 어댑터 규약 「규칙」](../CLE-CHAT/CLE-CHAT-ADAPTER.md#규칙) 10 이 정한다. 프로바이더가 돌려준 4xx 본문은 실패 판별 입력이라 바꾸지 않는다. 봇 토큰에 CR · LF · NUL 이 있으면 fetch 가 `Headers.append: "Bearer <토큰 전체>" is an invalid header value.`(Discord 는 `Bot <토큰>`)로 거부해 Slack 은 토큰이 이 필드 · 로그 · 응답까지 갔다(Node 24 실측). Discord 는 지금 이 필드에 닿지 않고 로그에 남았다(합성 실패의 판별 결함은 NERV Task `CLE-T-KX2Q2N`).
  2. 나가는 시점: `sanitizeForResponse` 가 두 필드에 `redactSecrets` 를 건다. 프로바이더가 되돌려 준 자격 증명, `user:pass@` URL(알림 URL 이 같은 응답에 원문으로 남는 동안은 부분적이다), JWT, `Authorization:` 헤더, fetch 헤더 값 검증 오류처럼 미리 알 수 없는 모양을 막는다.
- **마커**: 알려진 비밀 치환과 나가는 시점 마스킹은 같은 값 마커를 쓴다. 저장값 `Headers.append: "Bearer ***" is an invalid header value.` 는 응답에서 `Headers.append: "***" is an invalid header value.` 가 된다. 이 패턴은 따옴표 안에 다른 마커(`[REDACTED]` 등)가 있어도 값 마커 하나로 바꾼다. 규칙 5 의 하나뿐인 예외이고 이유는 Rationale 에 있다.
- **서명 자료**: 인바운드 서명 자료는 요청 헤더나 URL 에 싣지 않는다. Telegram `secret_token` 은 `setWebhook` 요청 본문에 있고 fetch 오류 원문은 본문을 싣지 않는다. 그래서 알려진 비밀 치환의 대상은 봇 토큰이다.
- **로그**: 로그 경로는 이 문서의 대상이 아니다(개요 「비대상: 로그 마스킹」, [로깅과 헬스 체크](../CLE-OBS/CLE-OBS-LOGGING.md) 「로그 마스킹」). 시크릿 저장소 평문을 로그 전에 지우는 규칙은 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 14 가 정하고 로깅 문서가 그곳을 가리킨다.
- **시크릿 참조**: 시크릿 저장소의 «없음» · «이미 있음» 오류는 참조를 메시지에 싣지 않는다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 18). 어댑터 실패 원문으로 이 필드에 저장될 수 있어서다. 이 변경 전에 저장된 `Secret not found: secret://…` 은 값 패턴의 단독 `secret` 키워드 패턴이 참조를 통째로 가린다(응답 비노출은 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 4).
- **한계**:
  - 저장할 때 자르므로 패턴의 끝(`@`, `" is an invalid header value`)이 잘린 값은 나가는 층이 가리지 못한다. 봇 토큰은 만든 자리에서 자르기 전에 지운다.
  - 헤더 값 검증 오류 패턴은 따옴표 안 2048자까지만 본다. 상한이 없으면 종결 문구 없는 큰 입력에서 이차 시간이 걸려서다(192KB 4.3초 → 77ms). 그보다 긴 헤더 값은 이 패턴이 가리지 않는다. 봇 토큰은 알려진 비밀 치환이 먼저 지우므로 이 상한과 무관하다(생성의 `botToken` 은 256자 상한이 있고 재발급의 `newBotToken` 은 상한이 없다. 수정(PATCH)은 봇 토큰을 받지 않는다). 한 원문에 이 오류가 둘이면 상한 안에서 그 사이 문장까지 가린다.
  - 알려진 비밀 치환은 글자 그대로 같은 문자열만 바꾼다. 인코딩된 평문(URL 인코딩, base64)은 가리지 못한다. 나가는 층도 알려진 모양만 가린다.
  - 이 변경 전에 저장된 값은 다음 갱신 때까지 DB 에 남는다. 응답에서는 봇 토큰이 실린 헤더 오류와 `secret:` 뒤의 시크릿 참조를 값 패턴이 가린다. DB 의 옛 값은 정리하지 않는다. 토큰이 실렸을 수 있는 트리거는 토큰을 재발급한다.
  - 프로바이더가 돌려준 4xx 본문은 알려진 비밀 치환을 거치지 않는다. 본문에 토큰이 실리면 나가는 층의 값 패턴만 남는다.
  - 두 필드는 `TRIGGER_RESPONSE_REDACT_COLUMNS` 에 이름으로 올라 있다. `trigger` 에 마지막 오류 같은 진단 텍스트 컬럼을 더하면 이 목록과 위 표를 함께 고친다.
  - 제어 문자가 든 봇 토큰을 입력에서 거부하지는 않는다. 그런 토큰은 생성 · 활성화에서 `degraded` 로, 재발급에서 `502 CHAT_CHANNEL_SETUP_FAILED` 로 드러난다. 채팅 채널 R-CC-23 의 기준으로는 사용자가 고칠 입력 오류라 4xx 여야 한다. 입력 거부는 NERV Task `CLE-T-FX354C` 가 다룬다.
- **남는 표면 `config.notification.url`**: 같은 응답의 알림 URL 은 원문으로 나간다. URL 에 `user:pass@` 가 있으면 마지막 오류에서는 가려도 이 필드에는 남는다. §3.5 가 «같은 응답 안의 원문이 방어를 우회한다» 고 보고 닫은 형태와 같다. 이번에 닫지 않은 이유는 이 필드가 편집 폼이 다시 보내는 왕복 값이라 규칙 9 와 함께 정해야 해서다. 그런 URL 은 fetch 가 요청을 만들지 않아 한 번도 발송되지 않으므로 등록에서 거부하는 안을 먼저 본다(NERV Task `CLE-T-RCQGCC`). 그때까지 알림 URL 의 userinfo 차단은 완전하지 않다. 사용자명만 있는 형태(`https://tok@host`)와 빈 사용자명(`https://:pw@host`)은 마지막 오류에서도 가려지지 않는다.

## 4. 다시 쓰이는 값과 재제출 거부

마스킹은 "읽혀서 다시 쓰이는 값" 과 만나면 가시성이 아니라 **데이터 무결성** 문제가 된다. 원문 문서는 이 형태를 두 번 겪었다. `Execution.inputData`(재실행 재제출)와 폼 `defaultValue` 다.

### 4.1 `inputData` 는 두 수준 모두 가린다 (2026-08-20)

| 값 | 마스킹 | 이유 |
|---|---|---|
| `Execution.inputData` (REST) | **함** (2026-08-20 부터) | 재제출 경로였으나 마커 가드가 프리필과 제출을 막는다 |
| `NodeExecution.inputData` (REST) | **함** | 재제출 소비처가 없다(표시 전용) |
| WebSocket 노드 이벤트 `input` (발행) | **함** | 위와 같은 값이 같은 프론트엔드 store 슬롯(`nodeResults[].inputData`)에 들어간다 |

세 줄이 같은 규칙을 따른다. 한 수준만 REST 에서 가리지 않으면 WebSocket 마스킹이 2초 폴링에 덮여 화면이 깜빡이고(flip-flop) wire 마스킹의 보안 이득도 사라진다. 실행 수준을 가려도 재실행이 오염되지 않는 것은 마커 가드가 프리필과 제출을 막기 때문이다. 가드가 없으면 그 오염이 되살아난다. 기본 재실행은 서버가 `original.inputData` 를 엔티티에서 직접 읽으므로 영향이 없다([재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)).

`inputData` 의 주요 자격 증명 벡터인 웹훅 민감 헤더는 받는 시점에 이미 `[REDACTED]` 다([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)). 남는 노출은 트리거 파라미터 자유 텍스트 안의 자격 증명이다.

### 4.2 소비 쪽 마커 가드

마커를 감지해 해당 필드를 다시 입력하게 **강제**하는 가드를 소비처마다 둔다.

| 소비처 | 가드 | 시점 |
|---|---|---|
| 폼 프리필 (`DynamicFormUI`) | 마커면 프리필을 건너뛰고 다시 입력하라고 안내한다 | 2026-08-17 |
| 재실행 모달 | 마커면 프리필을 건너뛰고 **세 조건이 모두 참이 될 때까지 제출을 막는다.** 사용자가 그 키를 건드렸고 현재 값에 마커가 없고 구조 필드라면 JSON 파싱에 성공했다(값만 보면 타입 변환에, 건드림만 보면 되돌린 마커에, 앞의 둘만 보면 무효 JSON 에 뚫린다). `useOriginalInput` 을 켜면 서버가 원문을 직접 읽으므로 차단도 풀린다 | 2026-08-20 |
| 에디터 히스토리 불러오기 | JSON leaf 에 마커가 **남아 있는 동안 실행을 막는다**(필드 단위로 비울 수 없는 표면이라 값을 지우지 않고 막는다) | 2026-08-20 |
| 서버 (수동 실행 경로) | 두 경로(`POST /executions/:id/re-run` 의 `inputOverride`, `POST /workflows/:id/execute` 의 파라미터)에서 값 leaf 가 마커와 **정확히 같으면 거부**한다. `400` 과 `details[].code = MASKED_VALUE_RESUBMITTED` 다. 재제출뿐 아니라 새 입력도 대상이다 | 2026-08-20 |

- **"강제" 를 안내로 낮추지 않았다.** 비우고 안내만 하면 빈 문자열이 실제 입력이 되어 오염 값만 `'***'` 에서 `''` 로 바뀐다. 그래서 두 소비처는 제출 자체를 막는다. 폼 경로가 안내로 충분한 것은 네이티브 `required` 검증에 기댈 수 있어서다.
- 마커 집합과 깊이 상한의 기준은 공유 패키지 `@workflow/masked-markers` 다(2026-08-21 이관). 백엔드 `sanitize-error-message.ts` 와 프론트엔드 `lib/utils/masked-markers.ts` 는 재export shim 이라 맞출 미러가 없다.

### 4.3 서버 재제출 거부의 범위

- **구현 위치**: 두 호출부는 기본 `resolveTriggerParameters` 가 아니라 래퍼 `resolveTriggerParametersRejectingMasked`(`reject-masked-resubmission.ts`)를 부른다. 판정기는 같은 파일의 `hasMaskedLeaf` 이고 깊이 상한 `MAX_REDACT_DEPTH` 를 함께 쓴다(§7 표 2행). **기본 함수에 넣지 않은 것은 의도다.** 기본 함수는 웹훅·스케줄도 함께 쓰므로 거기 넣으면 무관한 경로가 같은 거부 규칙을 진다. 수동 경로가 기본 함수를 직접 부르면 CI 가드(`masked-reject-callers-guard.ts`)가 RED 를 낸다.
- **범위는 수동 실행 경로 전체다.** `POST /workflows/:id/execute` 는 재제출 전용이 아니다. 같은 엔드포인트가 에디터 JSON 에디터의 자유 편집도 받고 값이 히스토리에서 왔는지 방금 친 것인지 구분할 플래그가 없다. 그래서 사용자가 수동 파라미터 값으로 리터럴 `***` 를 일부러 넣어도 거부된다.
- **판정 기준은 값의 출처가 아니라 페이로드를 쓰는 주체다.** 수동 트리거 파라미터는 워크플로우 작성자가 정의한 값 슬롯이고 이 제품은 이미 그 표면에서 마커 리터럴을 값으로 취급하지 않는다(프론트엔드 가드 `editor-toolbar.tsx` 가 출처와 무관하게 마커 leaf 를 막는다). 서버는 그 규칙을 API 수준으로 옮길 뿐이다. 두 층이 다른 규칙을 쓰면 한쪽만 통과하는 값이 생긴다.
- **웹훅 수신과 스케줄은 대상이 아니다.** 그쪽 본문은 외부 시스템이 쓰는 임의 페이로드라 리터럴 `***` 가 정상 값일 수 있다(사용자가 폼에 별표를 입력했을 수 있다).
- **알려진 제약**: 마스킹 마커 세 문자열은 수동 파라미터에서 **예약어**가 된다. 그 값을 정말 보내야 하면 앞뒤에 문자를 붙인다(정확 일치만 보므로 `a***b` 는 통과한다). 프론트엔드가 이미 같은 비용을 치르고 있고 두 층의 규칙을 갈라 두는 비용이 더 크다.
- **보장의 경계는 정확 일치다.** 값 마스킹의 **부분 치환**(`scheme://user:pass@host` → `scheme://***@host`)은 문자열 전체가 마커가 아니라 감지되지 않는다. 자격 증명은 이미 빠진 뒤라 노출 위험은 없지만 다시 쓰이는 성질은 남는다. 포함 매치로 넓히지 않는 이유는 `a***b` 같은 정상 값까지 막아 정상 워크플로우를 망가뜨리기 때문이다(프론트엔드 캐너리가 양방향으로 고정).
- 요청 DTO 설명에 이 거부 규칙을 적는 의무는 [OpenAPI 문서화](CLE-API-SWAGGER.md) 의 보안·정책 캐비엇에 있다.

## 5. `llmCalls` 는 외부 수신자에게서 뺀다 (strip-only)

`execution.ai_message` 와 입력 대기 `nodeOutput.meta.turnDebug` 의 `llmCalls[].requestPayload`·`responsePayload` 는 LLM 프로바이더와 주고받은 원본 요청·응답이다. 시스템 프롬프트, 대화 이력, 도구 정의, 사용자 입력 같은 민감 데이터를 담을 수 있다.

- `llmCalls` 는 워크스페이스 인증과 소유권으로 게이트된 **내부 WebSocket 채널(`execution:{executionId}`)에만** 싣는다.
- **모든 외부 fanout 수신자**(인터랙션 토큰 `iext_*`·`itk_*` 로 인증하는 EIA SSE, EIA 알림 웹훅, 채팅 채널 아웃바운드)와 **EIA 단발 상태 조회** 응답에서는 필드 이름 기준으로 **어느 중첩 깊이에서든** 뺀다. `ai_message` 에 한정되지 않는다.
- 채널 최종 사용자는 최종 assistant 텍스트와 `presentations` 만 받는다.
- DB 영속 경로(`NodeExecution.output_data.meta.turnDebug[i].llmCalls`)와 그것을 출처로 하는 실행 내역 디버그 패널은 영향이 없다.
- 내부 wire 에서 `llmCalls` 는 값 패턴 마스킹의 대상도 아니다(`WIRE_PRESERVED_FIELDS`). 값 마스킹은 `llmCalls` 가 아닌 자유 텍스트 필드(`error`, `message`, `output` 등)에 **추가**된 것이지 strip 을 대체한 것이 아니다. strip 은 디버그 전용 필드 자체를 외부에서 빼고 값 마스킹은 어느 필드에든 박힐 수 있는 자격 증명 패턴을 가린다.

## 6. 호출 순서: 마스킹은 한 번이다

두 층에서 지킨다.

1. **함수 안**: `deepRedactObject` 는 자격 증명 키의 값이 **이미 마커면 덮지 않는다**(`isMaskedMarker(v) ? v : VALUE_MASK_MARKER`). 앞 층이 남긴 키 마커가 값 마커로 바뀌면 두 마커의 뜻 구분이 사라진다. 키 이름 판정의 이야기다. 값 패턴 가운데 헤더 값 검증 오류 패턴만은 따옴표 안의 마커까지 값 마커로 바꾼다(규칙 5 의 예외, §3.10).
2. **호출 순서**: `WebsocketService.toFanoutEnvelope` 은 아래 네 단계이고 **뒤에서 다시 마스킹하지 않는다.** 다시 걸면 `attachRoutingContext` 가 붙인 `chatChannel` 의 키 마커를 값 마커로 덮는다(그 마커는 기존 테스트가 고정하는 계약이다).

```mermaid
flowchart LR
  A[maskWireEnvelope<br/>wire 단계 마스킹] --> B[stripExternalOnlyFields<br/>디버그 필드 제거]
  B --> C[allowlistFanoutNodeOutput<br/>fail-closed 허용 목록]
  C --> D[attachRoutingContext<br/>triggerId·chatChannel 부착]
```

- 3단계 `allowlistFanoutNodeOutput`(2026-08-24, `#1209`)은 fail-closed 허용 목록이다. 앞의 `stripExternalOnlyFields` 가 이름을 아는 것을 빼는 deny-list(fail-open)인 반면, 이쪽은 `nodeOutput`·`buttonConfig.nodeOutput`·`output` **세 자리**에서 아는 것만 남긴다.
- 순서가 중요하다. 허용 목록을 `attachRoutingContext` **뒤에** 걸면 그 함수가 얹은 `triggerId`·`chatChannel` 이 목록 밖이라 떨어진다.
- **이 순서는 구조가 아니라 규율이다.** 세 번째 발행 경로가 순서를 다르게 조립해도 컴파일러도 가드도 막지 않는다. 그래서 여기 적는다.
- **이 순서 계약을 확인한 범위는 `toFanoutEnvelope` 경로다.** 종결 에러 payload(`TerminalErrorPayload`)는 그 대상이 아니다(2026-08-29 전수 확인). 그 payload 를 채우는 `toTerminalErrorPayload` 호출부는 **5곳이고 모두 발행 쪽**(`chat-channel.dispatcher` 1, `execution-engine.service` 3, `retry-turn.service` 1, DB 쓰기 0)이다. 마스킹은 `sanitizeErrorMessage` 가 아니라 `redactTerminalError` → `deepRedactSecrets`(§7 표 2행)라는 **별도 관문**으로 걸린다. `sanitizeErrorMessage` 의 실제 범위는 알림 경로다. 두 경로는 방어 강도가 달라 하나의 "전 경로 불변식" 으로 묶지 않는다.

## 7. 마스커 좌표계

세 계열이 있다. ① 공유 `MAX_MASK_DEPTH`(표 1~3행, 백엔드와 프론트엔드가 같은 수를 본다) ② WebSocket 전용 `MAX_SANITIZE_DEPTH`(표 4행, 따로 선언) ③ 호출부가 값을 정하는 `stripExternalOnlyFields`(표 5행).

| # | 상한 | 값 | 비교 | 넘으면 | 소비처 (심볼) |
|---|---|---|---|---|---|
| 1 | `MAX_MASK_DEPTH` (`@workflow/masked-markers`) | **10** | 없음 | 없음 | **기준 상수.** 표 2·3행이 이 값을 참조한다 |
| 2 | `MAX_REDACT_DEPTH` (백엔드 지역 별칭) | **10** (표 1행 재export) | `depth >= N` | `VALUE_MASK_MARKER` | `deepRedactSecrets`(REST 응답, 저장 에러, 대화 스레드, **워크플로우 AI 어시스턴트 탐색 응답**, **종결 에러 payload 발행**(`redactTerminalError` 경유, 2026-08-29 등재)) · `hasMaskedLeaf`(수동 실행 재제출 거부 판정) |
| 3 | 프론트엔드는 별칭 없이 `MAX_MASK_DEPTH` 를 직접 import | **10** (표 1행 그대로) | 값 검사를 **먼저** 하고 `depth >= N` 에서 내려가기를 멈춤 | 스캔 범위 `0..N` | `hasMaskedMarkerLeaf`(폼 프리필 건너뛰기, 재제출 차단) |
| 4 | `MAX_SANITIZE_DEPTH` (`websocket.service.ts`, **별개 불변식**) | **10** (따로 선언) | `depth > N` | `DEPTH_MASK_MARKER` | `sanitizePayloadForWs`(WebSocket 발행) |
| 5 | `stripExternalOnlyFields(_, maxDepth)` | **호출부 지정** | `depth > maxDepth` | 하위 트리를 **보존**(손대지 않음) | 두 표면이 각자 **자매 sanitizer 의 상한**을 넘긴다 |

- **"값" 열은 깊이 값이지 행 번호가 아니다.** 지금 네 상한이 모두 `10` 이지만 표 2·3행은 표 1행을 참조하고 표 4행은 따로 선언해 우연히 같을 뿐이다. 문장에서 행을 가리킬 때는 늘 "표 N행" 으로 적는다.
- **표 5행의 호출부는 둘이다.** `InteractionService` 의 공개 표면 조립부가 `MAX_REDACT_DEPTH` 를, `WebsocketService.toFanoutEnvelope` 이 `MAX_SANITIZE_DEPTH` 를 넘긴다. `stripExternalOnlyFields` 에는 자기 상한이 없다. 표면마다 자매 sanitizer 와 어긋나면 strip 이 닿지 않는 층에 마스킹만 걸리거나 그 반대가 된다.
- **이름이 한 단어 다른 스캐너가 둘 있다.** 백엔드 `hasMaskedLeaf`(`reject-masked-resubmission.ts`, 표 2행)와 프론트엔드 `hasMaskedMarkerLeaf`(`lib/utils/masked-markers.ts`, 표 3행)다. 같은 상한을 쓰지만 파일도 스택도 다르다. 한쪽만 고치고 "양쪽 고쳤다" 고 적는 사고가 PR #1190 에서 두 번 났다.
- **인용은 심볼 기준이다.** 절대 줄 번호를 쓰지 않는다. 리팩터링마다 낡기 때문이다.
- **`maskSensitiveFields` 는 이 표에 행이 없다**(2026-08-24). 옛 소비처는 노드 설정 에코(`handler-output.adapter.ts`)와 워크플로우 AI 어시스턴트(`explore-tools.service.ts`) 둘이었는데 앞의 것이 없어졌다. 설정 에코를 표현식이 읽는데 가려져 있어 기능이 오염됐기 때문이다(§3.9). 남은 소비처는 깊이 상한이 없어 이 표의 축(깊이)에 해당하지 않는다.
- **대신 지켜야 할 축이 하나 생겼다.** 설정 에코는 이제 나가는 시점의 `deepRedactSecrets*` **하나에만** 기대므로 그 키 축이 `DEFAULT_SENSITIVE_KEYS` 를 **포함**해야 한다. `mask-sensitive-fields.util.spec.ts` 의 포함 관계 캐너리가 정본 구현으로 그것을 단언한다(목록에서 파생하므로 목록이 넓어져도 자동으로 검사한다).

값 패턴의 길이 상한(헤더 값 검증 오류 2048자)은 이 표에 없다. 넘으면 마커 없이 통과한다(§3.10). [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 가 진단 메시지를 자르는 길이와는 무관하다.

### 7.1 값이 같다고 같은 상한이 아니다

표 2행과 표 4행은 둘 다 `10` 이지만 비교가 `>=` 와 `>` 라 **마커가 놓이는 최대 깊이가 한 칸 다르다**(각각 10, 11). 표 4행을 표 1행에서 재export 하지 **않은 것도 의도다.** 값을 공유하면 다음 사람이 비교 연산자까지 같다고 읽는다.

두 스캐너(표 2행 `hasMaskedLeaf`, 표 3행 `hasMaskedMarkerLeaf`)가 `>=` 이면서 **값 검사를 깊이 검사보다 먼저** 하는 것도 이 한 칸 때문이다. 표 2행의 마스커가 정확히 depth `N` 에 마커를 넣으므로 스캐너가 깊이 검사를 먼저 하면 그 자리의 마커를 검사하지 않고 지나친다(off-by-one = fail-open).

## 8. 이 문서는 기계가 지키지 않는다

좌표계 표는 사람이 고쳐야 한다. 구현 위치 파일 목록의 존재만 테스트가 확인하고 표의 값·연산자·심볼이 소스와 맞는지는 검사하지 않는다.

- **표가 낡는 조건**: 호출부가 줄어드는 것이 아니라 **마스커가 늘거나 합쳐지거나 상한·연산자가 바뀌는 것**이다. 이 표는 마스커(함수) 좌표계이고 호출부(응답 조립부) 좌표계가 아니다. 두 좌표계는 층이 달라 호출부를 아무리 묶어도 마스커 목록은 바뀌지 않는다.
- **표를 고친 실례 (2026-08-23)**: 워크플로우 AI 어시스턴트 LLM 도구가 `deepRedactSecrets` 를 새로 겹치면서 표 2행 소비처가 실제로 늘었다. 그래서 그 열에 "워크플로우 AI 어시스턴트 탐색 응답" 을 더하고 구현 위치에 파일을 등재했다.
- **틀린 예고의 실례 (2026-08-23)**: 한때 "`inputData` 마스킹 게이트 4곳을 단일 헬퍼로 합치면 표 2행·5행 소비처가 낡는다" 고 예고했다. 합친 뒤 실측하니 표는 그대로였다. 새 래퍼(`redactStoredFieldsForResponse`)는 `deepRedactSecrets` 를 흡수하지 않고 `redactStoredDataForResponse` 위에 서서 여전히 그것을 부른다. 표 5행 호출부는 `websocket.service.ts`·`interaction.service.ts` 뿐이라 합친 게이트 4곳과 접점이 없다. 예고를 쓸 때 마스커 좌표계를 호출부 좌표계로 착각했다.

## 구현 위치

- `codebase/packages/masked-markers/src/index.ts` (`@workflow/masked-markers`: 마커 값, `MAX_MASK_DEPTH`, `isMaskedMarker`)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`SECRET_LEAK_PATTERNS`, `CREDENTIAL_KEY_PATTERN`, `redactSecrets`, `deepRedactSecrets`, `MAX_REDACT_DEPTH`, `replaceKnownSecret`)
- `codebase/backend/src/shared/utils/strip-external-only-fields.ts`
- `codebase/backend/src/shared/utils/redact-stored-error.ts` (`redactStoredErrorForResponse`)
- `codebase/backend/src/shared/utils/terminal-error-payload.ts` (`toTerminalErrorPayload`)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (`sanitizePayloadForWs`, `MAX_SANITIZE_DEPTH`, `toFanoutEnvelope`)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (`resolveTriggerParametersRejectingMasked`, `hasMaskedLeaf`)
- `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts`
- `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` (`maskSensitiveFields`, `DEFAULT_SENSITIVE_KEYS`)
- `codebase/frontend/src/lib/utils/masked-markers.ts` (`hasMaskedMarkerLeaf`)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`sanitizeForResponse`, `TRIGGER_RESPONSE_REDACT_COLUMNS`)
- `codebase/backend/src/modules/chat-channel/providers/slack/slack-client.ts`, `codebase/backend/src/modules/chat-channel/providers/discord/discord-client.ts`, `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts` (알려진 비밀 치환, §1.1)

## Rationale

### 좌표계를 문서로 둔 이유 (2026-08-22)

문서를 새로 두는 것이 자동으로 옳지는 않았다. 이 저장소는 PR #1190·#1191 에서 네 PR 을 들여 마스킹 관련 **미러를 없앴고**, JSDoc 을 되풀이하는 문서는 그 미러를 문서 층에서 되살린다. 그래서 먼저 무엇이 정말 문서에 없는지 전수로 셌다(`f65ca193c` 기준).

| 불변식 | 문서 | 코드 |
|---|---|---|
| `MAX_MASK_DEPTH`(기준 상수 이름), `MAX_SANITIZE_DEPTH`, `isMaskedMarker`, **경계 연산자** | **각 0** | 22 · 29 · 46 · 8 |
| 마커 리터럴, "깊이 상한" 서술, 재마스킹, `MAX_REDACT_DEPTH` | 1~20 | 다수 |

마커 값과 마스킹 정책은 이미 주인이 있었다. 없는 것은 정확히 좌표계였고 그것은 파일을 가로지르므로 어느 한 파일도 주인이 될 수 없다.

**틈이 실제로 문제를 냈다.** PR #1192 착수 직전 일관성 사전 검토의 이름 충돌 점검이 이 좌표계 혼동을 CRITICAL 로 판정해 착수를 막았다. "새 테스트가 좌표계를 혼동하면 잘못된 상수·연산자·마커를 겨냥한 정밀 고정 테스트가 만들어진다" 는 이유였다. 그때 올바른 상한을 겨냥할 수 있었던 것은 검토 에이전트가 파일 네 개의 JSDoc 을 대신 읽었기 때문이다. 같은 혼동의 흔적이 코드에도 있다. `masked-markers/src/index.ts` 와 `sanitize-error-message.ts` 가 **각각** "WebSocket 의 `MAX_SANITIZE_DEPTH` 는 이것이 아니다" 를 따로 적고 있다. 같은 방어 문장을 두 곳이 반복하는 것은 주인 없는 사실의 징후다.

**기각한 대안**

- **현상 유지(won't-do)**: JSDoc 네 곳이 이미 정확하고 계약 테스트도 있다. 그러나 좌표계 자체는 어느 파일에도 없었고 위 CRITICAL 이 실제로 났다.
- **세 상한을 하나로 합쳐 좌표계를 없앤다**: 가장 근본적이지만 이미 기각된 결정이다(`masked-markers/src/index.ts`: "별개 불변식이므로 합치지 않는다. 공유 프리미티브를 넓히면 무관한 경로가 오염된다"). 그 결정이 유지되는 한 좌표계는 영구적이고 영구적인 파일 간 사실은 문서를 가질 자격이 있다.
- **EIA R17 을 넓힌다**: 원문에서 R17 은 EIA 표면의 정책이 주제였다. WebSocket·노드 출력까지 걸치는 좌표계를 거기 넣으면 EIA 가 자기 표면 밖을 갖게 된다. 그래서 좌표계는 별도 규약으로 두었다. 이번 옮겨 쓰기에서 R17 의 마스킹 정책 부분을 이 문서로 모았고 단발 상태 조회의 노출 결정은 [External Interaction API](../CLE-IX/CLE-EIA.md) 에 남겼다.
- **좌표계를 기계가 검사하게 한다(새 repo-guard)**: 표를 파싱해 소스와 대조하려면 TS AST 파서가 필요하다. 이 저장소는 가드 설계에서 "유한한 문제를 무한한 문제와 바꾸지 말 것" 을 결론으로 얻었다. 대신 §8 에 문서가 낡을 수 있다는 사실과 낡는 조건을 적는 쪽을 골랐다.

### egress-only 를 택한 이유

저장 시점(append) 마스킹은 LLM 에 주입하는 스레드까지 바꾼다. 게다가 보수적인 공유 패턴(특히 `Bearer\s+\S+`)이 평범한 대화에서 오탐하면 컨텍스트를 조용히 망가뜨린다. 그래서 채택하지 않았다. 웹훅 문서의 Rationale 이 든 "DB 에 남으면 유출 표면" 우려는 여기서도 유효하다. 그 대가로 얻는 진단 가치와 저울질한 결과가 egress-only 다.

웹훅 문서는 표시 시점 마스킹을 기각하며 "모든 read 경로를 따로 마스킹해야 한다(whack-a-mole)" 를 근거로 들었다. 타당한 우려이고 이 작업이 그것을 실증했다(표면이 넷에서 여섯으로 늘었고 `inputData` 카브아웃 범위를 한 번 되돌렸다). 다만 여기서의 방어는 호출부를 흩어서 고치는 방식이 아니라 공유 관문으로 모으는 방식이다(§2.2). 그래서 받는 시점 층이 다루는 "알려진 헤더 key" 와 달리 미리 정할 수 없는 자유 텍스트를 나가는 시점에 다룰 수 있다.

시크릿 저장소 평문을 만든 자리에서 지우는 알려진 비밀 치환은 이 결정과 별개다(§1.1, 「트리거 응답의 마지막 오류를 표면에 올린 이유」).

### 내부 WebSocket 과 채팅 채널도 가리는 이유

`execution.ai_message` 마스킹은 발행 지점에 걸려 내부 WebSocket wire 와 채팅 채널 능동 발송(Telegram·Slack·Discord)에도 적용된다. 보수적 패턴(특히 `Bearer\s+\S+`, `pwd:`)이 기술적인 대화에서 오탐하면 이미 사용자에게 간 응답이 `***` 로 바뀔 수 있다. **보안을 우선**해(실제 시크릿을 외부 채널로 흘리지 않음) 이 드문 오탐을 받아들였다. 에디터는 외부 strip 대상이 아닌 `llmCalls` 디버그로 원문을 확인할 수 있다. 관찰자 표면만 가리는 식의 참여자·관찰자 분리는 뒤의 개선 여지로 남긴다.

### 내부 읽기 경로에도 마스킹을 건 이유 (2026-08-16)

옛 서술은 이 틈을 "내부 REST 와의 비대칭은 미결이다" 로 REST 표면에 한정해 적었다. 실측하니 WebSocket `execution.snapshot` 도 같은 원문을 싣고 있었다. 실제로 갈리는 축은 REST 와 WebSocket 이 아니라 **종결 발행과 그 밖의 모든 읽기 경로**였다. 처음에는 "`ExecutionsService` 4경로" 라고 적었는데 두 컬럼을 더하며 실측하니 `toResponseExecution` 의 `...rest` 가 엔티티를 통째로 펼쳐 세 표면이 한 관문을 함께 쓰고 `nodeExecutions[]` 가 따로였다. "넷" 이라는 수가 이미 낡아 있었다. 그래서 표면을 수가 아니라 이름으로 열거한다(§3.5).

### 설정 에코의 경계 마스킹을 없앤 이유 (2026-08-24)

예전에는 엔진 경계(`handler-output.adapter.ts` 의 `maskSensitiveFields`)에서 설정 에코를 저장 전에 가려 DB·WebSocket·REST 모든 경로가 가린 값을 받았다. 그런데 표현식 컨텍스트(`expression-resolver.service.ts`)가 같은 `config` 를 읽는다. `migrate-node-output-refs.ts` 가 사용자를 `$node["X"].config.<field>` 참조로 옮겨 놓은 뒤라 리터럴 `****abcd` 가 워크플로우에 흘러들었다. 그래서 경계 마스킹을 없애고 나가는 시점 마스킹만 남겼다(§3.9). 설정 탭의 안전성 결론은 그대로다. 그 엔드포인트가 REST 나가는 관문을 지나므로 뷰어가 보는 값은 여전히 가려진다. 바뀐 것은 어디서 가리느냐다. 이 변경이 만든 대가 두 가지(§3.9)는 보안·아키텍처 검토가 지적해 문서에 명시했다.

### `inputData` 카브아웃을 닫은 이유 (2026-08-20)

`Execution.inputData` 를 한동안 가리지 않은 것은 그것이 **다시 제출되는 값**이기 때문이었다. 재실행 모달이 `inputData` 로 프리필해 `inputOverride` 로 되보내고(`useOriginalInput` 기본값이 `false` 라 사용자가 손대지 않아도 제출된다), 에디터 "히스토리에서 불러오기" 도 같은 값을 textarea 에 넣어 다시 실행한다. 가리면 리터럴 `'***'` 가 새 실행의 실제 입력값이 된다. 가시성 저하가 아니라 조용한 기능 오염이다. 두 검토(`23_49_05` cross_spec, `23_50_03` side_effect)가 독립적으로 CRITICAL 을 냈고 소스 추적으로 확증했다.

- **카브아웃은 `Execution.inputData` 한 컬럼이었다.** `NodeExecution.inputData` 는 처음부터 가렸다. 노드 수준에는 재제출 소비처가 없기 때문이다(재실행은 `Execution.inputData` 만 읽는다, 실측). 초판은 카브아웃을 노드 수준까지 넓혔는데 그러면 WebSocket 발행은 가리고 REST 는 원문을 주어 같은 store 슬롯에서 2초 폴링이 마스킹 값을 원문으로 덮는 flip-flop 이 났다(`01_17_49` cross_spec CRITICAL). 축을 정확히 하면 다시 쓰이는 것만 카브아웃한다는 것이었다.
- **닫는 조건은 "프론트엔드가 마커를 감지해 해당 필드를 다시 입력하게 강제하는 가드" 였고 2026-08-20 에 세 소비처가 모두 갖췄다(§4.2).** 그래서 카브아웃이 닫혔다.
- **판단 기준을 두 축으로 다시 정했다.** 옛 기준은 "외부로도 나가는가" 하나였다. 나가면 마커 가드, 안 나가면 카브아웃이 싸다는 것이었다. 그 "싸다" 가 전제였고 무너졌다. `Execution.inputData` 는 외부 노출이 없어 카브아웃 쪽이었지만 그 예외 하나를 문서 여섯 개가 기준으로 인용하게 되면서 유지비가 가드 비용을 넘었다(그 사이 폼 가드가 서서 가드 비용은 거의 0이 됐다). 그래서 축은 둘이다.
  1. **외부로도 나가는가.** 나가면 카브아웃이 불가능하다(폼 `formConfig` 는 입력 대기 이벤트를 타고 SSE·EIA 알림 웹훅으로도 나가므로 마스킹을 끄면 바로 유출이다).
  2. **예외의 미러 유지비가 가드 비용보다 작은가.** 아니면 나가지 않아도 가드로 닫는다(`Execution.inputData`).
  두 사례는 이제 같은 갈래(마커 가드)이고 도달한 경로만 다르다.
- 이 전환으로 옛 WebSocket 문서의 "가르는 축은 필드 이름이 아니라 수준" 이라는 서술도 폐기됐다. 마스킹 범위는 수신 인구가 정하고 다시 쓰이는 값은 카브아웃이 아니라 소비 쪽 마커 가드로 다룬다.

### 마커 값을 공유 패키지로 옮긴 이유 (2026-08-21)

예전에는 두 스택이 마커 값을 손으로 복제했고 한쪽만 늘면 다른 쪽이 그 새 마커에 대해 조용히 fail-open 했다. 미러를 기계가 대조하게 만들려 했더니 CI 경로 게이팅에 막혔다(한쪽 CI 워크플로우(GitHub Actions)가 반대쪽 변경 때 검사를 건너뛴다). 그래서 값 자체를 공유 패키지로 옮겼다.

### 워크플로우 AI 어시스턴트 도구: 유출 차단을 우선한 결정 (2026-08-23)

처음에는 "값 패턴 마스킹을 단순 합성하면 안 된다" 고 적었다. `maskSensitiveFields` 는 자격 증명 키를 `****9876` 처럼 끝 네 글자 힌트를 남겨 어떤 키가 가려졌는지 알게 하는데 값 마스킹을 겹치면 그 힌트가 사라지기 때문이다. 그 경고는 당시 옳았다. 실제로 겹치자 기존 테스트 6건이 RED 였다. 무엇을 알고 선택했는지 남기려고 이 경위를 지우지 않는다. 결정은 유출 차단 우선이다. 잃는 것은 값의 끝 네 글자뿐이고 키 이름은 남는다.

### 허용 목록 확대를 한때 미뤘다가 닫은 경위 (2026-08-23, 2026-08-24)

2026-08-23 초판은 "REST 와 SSE 는 같은 강도다" 라고 적었다. 구현보다 넓은 서술이었다(`23_29_27` cross_spec CRITICAL). 입력 대기의 두 자리는 닫혔지만 `execution.node.completed`·`.failed` 는 같은 `NodeExecution.outputData` 를 `output` 이라는 다른 키로 최상위에 싣는다. 발행 지점은 **6곳**이다(`execution-engine` 2, `form-interaction` 1, `button-interaction` 1, `ai-turn-orchestrator` 2. 처음엔 `ai-turn-orchestrator` 의 두 분기를 하나로 세어 5곳이라 적었다).

그때 유예 근거는 "같은 목록을 그대로 걸 수 없다" 였다. 버튼 재개 경로가 `outputData` 에 `{type, buttonId, buttonLabel, clickedAt, selectedItem, nodeOutput, _selectedPort}` 를 저장해 정본 목록을 걸면 `{}` 가 된다는 측정이었다. 2026-08-24 에 그 근거가 반증됐다. `{}` 라는 측정 자체는 맞았다. 틀린 것은 "그 객체가 `outputData` 가 된다" 는 전제였다. `resolveButtonInteraction` 이 만드는 평탄한 record 는 `contextService.setNodeOutput` 으로 메모리 `nodeOutputCache` 에만 들어가고 `nodeExec.outputData` 에 들어가는 것은 다음 줄 `buildResumedStructuredOutput(...)` 의 결과다. 반환 타입이 노드 출력(`{config, output, port, status, meta?}`)이라 모두 목록 안이다.

실 DB 조회로 확정했다(재현이 아니라 e2e 285건을 돌린 뒤 teardown 전에 e2e postgres 를 직접 조회). `node_execution.output_data` 93행 중 84행이 object(나머지 NULL, 배열·스칼라 0행)이고 최상위 키는 `meta` 83, `config` 82, `output` 81, `port` 20, `status` 7, `conversationConfig` 1 이 전부였다. 평탄한 record 는 한 행도 없었다. 그래서 같은 목록을 그대로 걸었다.

**교훈**: "그 객체에 목록을 걸면 어떻게 되나" 를 쟀지만 물었어야 할 것은 "그 객체가 이 표면에 도달하나" 였다. 대리 지표를 재고 유예 결론을 냈다.

### `llmCalls` 를 strip-only 로 정한 이유

디버깅 타임라인이 어시스턴트 메시지 단위로 요청·응답·사용량을 보이려면 LLM 프로바이더와 주고받은 원본 payload 가 필요하다. 그러나 이 원본은 시스템 프롬프트, 대화 이력, 도구 정의 같은 민감 정보를 담는다. `execution.ai_message` 는 워크스페이스 소유권으로 게이트된 내부 WebSocket 채널과, EIA SSE·EIA 알림 웹훅·채팅 채널 아웃바운드로 갈리는 fanout 양쪽으로 간다. SSE 는 인터랙션 토큰만으로 접근하고(워크스페이스 확인 없음) 채널 최종 사용자에게 가므로 원본 payload 를 그대로 흘리면 채널 사용자에게 노출된다.

- **결정**: `llmCalls`(와 그 안의 `requestPayload`·`responsePayload`)는 인증된 내부 WebSocket 채널에만 싣고 fanout(외부) 경로에서는 뺀다. 대상은 WebSocket fanout 과 EIA 단발 상태 조회 양쪽이고 필드 이름 기준 깊이 무관이다. 이 결정은 직전의 "원본 payload 운반(v1, 마스킹 없음)" 미결 항목을 사용자 결정(채널 실사용과 strip-only)으로 확정한 것이다.
- **근거**: 원본 디버그 payload 는 본질적으로 에디터 전용 관심사다. 외부·채널 수신자는 필요하지 않으므로 단일 fanout 이음매에서 빼면 최소 변경으로 노출을 닫으면서 에디터 디버그 패널은 그대로 유지된다.
- **기각한 대안**: 값 수준 마스킹은 에디터 디버깅 가치를 해치고 부분적이다. 워크스페이스 안 뷰어·편집자 역할 게이트는 별도 RBAC 확장이 필요해 이 결정 범위를 넘는다. 여러 테넌트의 뷰어 요구가 분명해지면 다시 검토한다.
- **2026-08-14 갱신**: 이 결정은 문서상 "모든 외부 수신자" 였으나 구현이 더 좁았다. fanout 은 최상위 필드만 지웠고(depth 1) REST 단발 상태 조회는 값 마스킹만 걸려 있어, 입력 대기의 중첩 경로 두 곳(`turnDebug.llmCalls`, `nodeOutput.meta.turnDebug[].llmCalls`)이 실제로 새고 있었다. 필드 이름 기준 깊이 무관 strip 으로 바꾸고 WebSocket fanout 과 EIA REST 가 같은 공용 유틸을 부르게 맞췄다. 같은 데이터에 출구가 셋(fanout, REST 입력 대기, REST 종결)이었고 출구를 따로 조립하면 한 번에 하나씩만 고쳐진다. 실제로 세 라운드에 걸쳐 하나씩 발견됐다. 그래서 처방을 한 곳에 두었다.
- **2026-08-16 보강**: 위 "기각한 대안" 은 "`llmCalls` 를 값 수준 마스킹으로 **대체**한다" 에 대한 것이었고 그 근거(에디터 디버깅 가치 훼손)는 지금도 유효하다. 그와 별개로 `llmCalls` 가 아닌 자유 텍스트 필드에는 값 패턴 마스킹이 **추가**됐다(§3.6). 대체가 아니라 함께 있는 것이며 이 결정은 적용 대상이 분명해졌을 뿐 번복되지 않았다.

### 트리거 응답의 마지막 오류를 표면에 올린 이유 (2026-10-05)

NERV Task `CLE-T-H0GF4K` 가 채팅 채널 어댑터와 알림 발송의 실패 원문을 점검했다. Node 24 의 fetch 로 두 경로를 재현했다. Slack 봇 토큰에 CR · LF · NUL 이 있으면 헤더 값 검증 오류가 토큰 전체를 원문에 싣고 그 원문이 `chat_channel_last_error` · 서버 로그 · 트리거 응답까지 갔다. 알림 URL 에 `user:pass@` 가 있으면 fetch 가 그 URL 을 원문에 싣고 `notification_last_error` 에 남았다. 트리거 조회는 역할 게이트가 없어 뷰어도 받는다.

봇 토큰은 시크릿 저장소 평문이라 응답에서만 가리면 DB 와 로그의 유출이 남는다. 그래서 두 층으로 닫았다. 클라이언트가 원문을 만든 자리에서 그 호출의 토큰을 지우고(§1.1) 응답이 값 패턴으로 나머지를 가린다(§3.10).

기각한 대안(이 Task 의 점검에서 검토했다):

- **저장 전 값 패턴 마스킹**: 규칙 1 과 「egress-only 를 택한 이유」 가 기각한 형태다. 진단 원문이 오탐으로 조용히 망가진다. 알려진 비밀 치환은 패턴이 아니라 값이라 이 우려가 없다. 통합 쪽의 저장 전 가림(§1.1)은 그 필드의 결정이고 이 필드에 옮겨 오지 않았다. 마지막 오류 필드는 채널 건강도의 진단 원문이라 규칙 1 을 따른다.
- **비대상으로 적기**: 토큰이 실리는 경로를 재현했다.
- **원인 분류 코드와 고정 문구로 좁히기**: 채팅 채널의 R-CC-25 방식이다. 프로바이더 오류 코드(`channel_not_found`, `missing_scope`, `not_in_channel` 등)가 사용자가 고칠 원인을 알려 주는데 그 정보를 잃는다. 근거는 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 의 R-CC-26 에 있다.
- **봇 토큰 입력에서 제어 문자만 거부하기**: 이미 저장된 토큰과 다른 모양의 유입을 막지 못한다. 알려진 비밀 치환은 입력 모양과 무관하게 닫는다.
- **두 마지막 오류 필드에만 거는 국소 userinfo 패턴**(2026-10-08 일관성 검토에서 제기): `config.notification.url` 이 같은 응답에 원문으로 남는 한 효과가 없다. 두 필드는 NERV Task `CLE-T-RCQGCC` 에서 함께 맞춘다.
- **공유 userinfo 패턴을 사용자명만 있는 형태까지 넓히기**(구현 계획 1차에서 시도했다 철회): 이 패턴은 대화 스레드 · 실행 에러 · 재실행 입력에도 걸린다. 사용자명만 있는 URL 은 워크플로우 입력에 흔해 재제출 표면(§4)에서 부분 치환된 값이 그대로 실행될 수 있다. 알림 URL 의 자격 증명은 `config.notification.url` 과 함께 NERV Task `CLE-T-RCQGCC` 에서 다룬다.

공유 마스커에 더한 헤더 값 검증 오류 패턴은 fetch 를 쓰는 다른 경로(HTTP Request 노드 등)의 오류와, MCP 진단처럼 저장 전에 가리는 경로에도 걸린다. 수량자에는 2048자 상한을 뒀다. 상한이 없으면 종결 문구 없는 큰 입력에서 이차 시간이 걸린다(§3.10 한계). 자격 증명이 아닌 사용자 헤더 값도 `***` 로 보인다. 오류 종류(`is an invalid header value`)는 남아 원인을 읽을 수 있고 헤더 값은 자격 증명일 때가 많아 이 오탐을 받아들였다.

이 패턴은 따옴표 안을 통째로 값 마커 하나로 바꿔 안에 든 다른 마커도 덮는다. 규칙 5 를 이 패턴 하나에서 좁힌 이유다. 마커를 건너뛰려면 패턴이 마커 경계를 알아야 해 복잡해진다. 이 오류 원문에 다른 마커가 들 일도 드물다(알려진 비밀 치환이 남긴 값 마커 정도다). 들어도 그 구간은 가려야 할 헤더 값이다. 키 마커(`[REDACTED]`)까지 덮는 것은 알려진 부산물이다. 이 오류 문장은 받는 층을 거쳐 온 값이 아니라서 표면 사이에 마커가 갈리는 일은 생기지 않는다. 동작은 캐너리로 고정했다. MCP 클라이언트는 소비자 전용 모양을 자기 훅에 두었지만 이 패턴은 fetch 가 모든 소비자에 내는 일반 형태라 공유 목록에 둔다.

같은 응답의 `config.notification.url` 은 원문으로 나간다. §3.5 가 «같은 응답 안의 원문이 방어를 우회한다» 고 보고 닫은 형태라 `notificationLastError` 의 `user:pass@` 가림은 이 필드가 남는 동안 실효가 작다. 이 필드는 편집 폼이 다시 보내는 왕복 값이라 규칙 9 와 함께 정해야 해서 §3.5 원칙의 한시 예외로 남겼다. 같은 이유(왕복 값)로 세웠다가 소비 쪽 마커 가드가 선 뒤 닫은 `inputData` 카브아웃(Rationale 「`inputData` 카브아웃을 닫은 이유」)과 같은 길을 밟는다. 해소 조건은 NERV Task `CLE-T-RCQGCC` 가 userinfo 가 든 알림 URL 을 등록에서 거부하거나 응답에서 가리는 것이다. 그때 §3.10 · 개요 · 이 문단을 같은 변경에서 고친다.

2026-10-08 보강: 같은 Task 의 코드 · 일관성 검토에서 알려진 비밀 치환의 범위(클라이언트가 만든 실패 문장, 4xx 본문 제외, 양끝 공백 변형), 규칙 5 의 예외, 헤더 값 패턴의 2048자 상한을 더했다.
