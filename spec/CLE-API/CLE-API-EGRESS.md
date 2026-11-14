---
id: "CLE-API-EGRESS"
title: "응답 자격 증명 마스킹"
type: "convention"
version: 6
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API"
ancestors: ["CLE-VISION", "CLE-API"]
area: "CLE-API"
content_hash: "a2174e247f6a8699c120ad8282c57fc92fb05f67728fa79d96e2f3dc1b15caef"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/2-navigation/14-execution-history.md", "spec/5-system/14-external-interaction-api.md", "spec/5-system/6-websocket-protocol.md", "spec/conventions/egress-masking.md"]
mirror_sha256: "fd27532e6277575b6b6ea3803e8748fb0af39f5efbbd710eed11a88cfcefd642"
etag: "sha256-2da45a5c507f95a1f6b61abaa6566627bb56bf4d2e06546084798df52712fae5"
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
- **인접 정책: 알려진 비밀 치환.** 프로바이더 API 클라이언트가 실패 원문에서 그 호출의 시크릿 평문을 지우는 일은 나가는 시점 마스킹이 아니다. 경계는 §1.1, 동작은 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 14 와 [채팅 채널 어댑터 규약 「규칙」](../CLE-CHAT/CLE-CHAT-ADAPTER.md#규칙) 10 이 정한다.
- **잔여 갭: 알림 URL 의 자격 증명.** 트리거 응답의 `config.notification.url` 은 원문으로 나간다. 같은 응답의 마지막 오류에서는 `user:pass@` 를 가리므로 §3.5 가 막은 «같은 응답 안의 원문이 방어를 우회하는» 형태가 남아 있다(§3.10, NERV Task `CLE-T-RCQGCC`). 해소되면 이 항목과 트리거 하위 문서의 §3.10 · Rationale 을 같은 변경에서 고친다.
- **네트워크 egress 와 무관하다.** [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md) 의 사설망 차단(SSRF guard)이 말하는 egress 는 나가는 네트워크 목적지 제한이다. 이 문서의 egress 는 응답·이벤트 페이로드가 나가는 시점을 뜻한다. 같은 단어가 두 도메인에 있다.

## 규칙

1. **DB 는 원문을 보존한다.** 마스킹은 나가는 시점(egress)에만 한다. 자유 텍스트와 진단용 필드는 저장할 때 지우지 않는다. 시크릿 저장소에서 푼 평문은 이 규칙이 보존하는 원문에 들지 않는다. 그 값은 원문을 만든 자리에서 지운다(§1.1). 통합 `last_error` 의 암호화와 MCP 오류의 저장 전 가림은 각 문서의 결정이다(§1.1).
2. **마스킹 범위는 수신 인구가 정한다(boundary parity).** 같은 사람들이 받는 표면은 같은 마스킹을 받는다. 역할 게이트가 아니라 서버의 마스킹 일치에 안전성을 건다.
3. **적용 범위는 총칭이 아니라 열거다.** "모든 읽기 경로" 로 적지 않고 표면을 이름으로 적는다(§3).
4. **마스킹은 공유 관문에서 건다.** 새 읽기·발행 경로가 그 관문을 지나면 마스킹을 구조적으로 이어받게 한다. 호출부마다 따로 걸지 않는다.
5. **마스킹은 한 번이다.** 뒤 단계는 앞 단계가 남긴 마커를 다른 마커로 덮지 않는다. 예외는 하나다. fetch 헤더 값 검증 오류의 따옴표 안은 그 안에 든 마커까지 값 마커 하나로 바꾼다(§3.10, Rationale 「트리거 응답의 마지막 오류를 표면에 올린 이유」).
6. **`toFanoutEnvelope` 는 정한 네 단계 순서를 지키고 뒤에서 다시 마스킹하지 않는다.** fanout subject 는 `toFanoutEnvelope` 가 만든 봉투(`FanoutEnvelope` 타입)만 받는다(§6).
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
- `deepRedactSecrets` 는 정상 결과 데이터를 copy-on-change 로 보존하고 이미 마스킹된 값(`[REDACTED]`, `***`, `[REDACTED_DEPTH]`)은 다시 가리지 않는다. 값 전체가 마커일 때이고 헤더 값 검증 오류의 따옴표 안은 예외다(규칙 5, §3.10).
- **값 마스킹만으로는 부족하다.** `deepRedactSecrets` 는 값과 키 패턴을 바꿀 뿐 `llmCalls` 같은 **필드 자체**는 남긴다. 그래서 외부 표면은 필드 제거(`stripExternalOnlyFields`)와 값 마스킹을 함께 건다.
- 알려진 비밀 치환(`replaceKnownSecret`)은 나가는 마스커가 아니라 이 표와 §7 좌표계에 없다(§1.1).

## 2. 마스킹 범위를 정하는 기준

### 2.1 수신 인구 (boundary parity)

마스킹 범위는 그 표면을 받는 사람들이 정한다.

- `GET /api/executions/:id` 에는 `@Roles` 게이트가 없어 뷰어를 포함한 워크스페이스 멤버 전원이 조회하고 프론트엔드는 실패 배너에 `error.message` 를 그대로 보인다.
- WebSocket `execution:<id>` 구독 인가는 워크스페이스 소유만 보고 역할을 받지 않는다([WebSocket 연결과 채널 구독](CLE-API-WS.md)). 수신 인구가 `GET /api/executions/:id` 와 같다.
- 그래서 내부 읽기 경로와 내부 WebSocket wire 에도 외부 표면과 같은 값 마스킹을 건다. [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md) 의 R-5 가 적은 "안전성은 역할 게이팅이 아니라 서버 egress masking parity 에 의존한다" 는 원칙과 같다. R-5 의 직접 대상은 설정(Config) 탭이라 `Execution.error` 를 규정하지는 않는다. 원칙을 가져다 쓴 것이지 기존 판정이 아니다.
- `kb:<documentId>`·`background:run:<id>` 구독 인가도 워크스페이스 소유만 보고 역할을 보지 않는다([WebSocket 연결과 채널 구독](CLE-API-WS.md)). 그래서 수신 인구가 `execution:<id>` 와 같다(§3.11). `notifications:<userId>` 는 본인만 받아 수신 인구가 다르다.

### 2.2 공유 관문

마스킹은 호출부를 하나씩 고치는 방식이 아니라 소수의 공유 관문에 건다.

| 관문 | 지나는 경로 |
|---|---|
| `ExecutionsService.toResponseExecution` | 실행 REST 응답(§3.5 의 표면들) |
| `WebsocketService.emitExecutionEvent`·`emitNodeEvent` | 모든 실행·노드 이벤트 발행(내부 WebSocket wire 와 외부 fanout) |
| `WebsocketService.emitKbEvent`·`emitBackgroundRunEvent` | 지식 저장소 문서 처리 · Background 본문 실행 이벤트 발행(내부 WebSocket wire 만, fanout 없음, §3.11) |
| `toTerminalErrorPayload` | 종결 이벤트의 `error` |
| `redactThreadForPublic` | 대화 스레드의 공개 표면 |
| `TriggersService.sanitizeForResponse` | 트리거 REST 응답(§3.10 의 표면들) |

새 읽기·발행 경로가 이 관문을 지나면 마스킹을 구조적으로 이어받는다. 늘어나는 것은 표면의 발견이지 마스킹을 손으로 거는 자리가 아니다.

## 3. 적용 표면

표면은 이름으로 적는다(규칙 3). "모든 내부 읽기 경로" 로 읽으면 잔여 갭이 가려진다. 표면별 규칙은 [하위 문서](#하위-문서) 에 있다. 이 절의 3.8 · 3.10 과 §4 · 4.3 제목은 다른 문서가 거는 앵커를 지키려고 남긴 링크 자리다. 나머지 절은 다른 문서가 앵커로 걸지 않아 자리를 두지 않았다.

### 3.8 외부 `nodeOutput` 의 fail-closed 허용 목록 (2026-08-23, 2026-08-24)

→ [응답 자격 증명 마스킹 — 실행 표면](CLE-API-EGRESS-SURFACE.md#38-외부-nodeoutput-의-fail-closed-허용-목록-2026-08-23-2026-08-24)

### 3.10 트리거 응답의 마지막 오류 (2026-10-05)

→ [응답 자격 증명 마스킹 — 트리거 응답의 마지막 오류](CLE-API-EGRESS-TRIGGER.md#310-트리거-응답의-마지막-오류-2026-10-05)

## 4. 다시 쓰이는 값과 재제출 거부

→ [응답 자격 증명 마스킹 — 재제출 거부와 마스커 좌표계](CLE-API-EGRESS-PIPELINE.md#4-다시-쓰이는-값과-재제출-거부)

### 4.3 서버 재제출 거부의 범위

→ [응답 자격 증명 마스킹 — 재제출 거부와 마스커 좌표계](CLE-API-EGRESS-PIPELINE.md#43-서버-재제출-거부의-범위)

## 하위 문서

이 문서에는 요구사항 줄이 없다. 하위 문서는 원문 절 번호(§N)를 쓴다.

| 하위 문서 | 맡는 것 | 요구사항 |
|---|---|---|
| [응답 자격 증명 마스킹 — 실행 표면](CLE-API-EGRESS-SURFACE.md) | 실행·노드 데이터가 나가는 표면(§3.1~§3.9, §3.11: 대화 스레드, AI 응답, 입력 대기·종결 payload, 내부 읽기 경로, 이벤트 발행, 워크플로우 AI 어시스턴트 도구, `nodeOutput` 허용 목록, 설정 에코, 지식 저장소 · Background 채널)과 그 Rationale | 없음 |
| [응답 자격 증명 마스킹 — 트리거 응답의 마지막 오류](CLE-API-EGRESS-TRIGGER.md) | 트리거 응답의 마지막 오류 마스킹(§3.10), 알려진 비밀 치환과의 관계, 규칙 5 의 예외와 그 Rationale | 없음 |
| [응답 자격 증명 마스킹 — 재제출 거부와 마스커 좌표계](CLE-API-EGRESS-PIPELINE.md) | 다시 쓰이는 값과 재제출 거부(§4), `llmCalls` strip-only(§5), 호출 순서(§6), 마스커 좌표계(§7), 기계 강제의 한계(§8)와 그 Rationale | 없음 |

## 구현 위치

- `codebase/packages/masked-markers/src/index.ts` (`@workflow/masked-markers`: 마커 값, `MAX_MASK_DEPTH`, `isMaskedMarker`)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`SECRET_LEAK_PATTERNS`, `CREDENTIAL_KEY_PATTERN`, `redactSecrets`, `deepRedactSecrets`, `MAX_REDACT_DEPTH`, `replaceKnownSecret`)
- `codebase/backend/src/shared/utils/strip-external-only-fields.ts`
- `codebase/backend/src/shared/utils/redact-stored-error.ts` (`redactStoredErrorForResponse`)
- `codebase/backend/src/shared/utils/terminal-error-payload.ts` (`toTerminalErrorPayload`)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (`sanitizePayloadForWs`, `MAX_SANITIZE_DEPTH`, `toFanoutEnvelope`, `maskWireEnvelope`, `emitKbEvent`, `emitBackgroundRunEvent`)
- `codebase/backend/src/modules/websocket/websocket-events.types.ts` (`FanoutEnvelope`, `FanoutExecutionChannelEvent`)
- `codebase/backend/src/nodes/core/node-output-allowlist.ts` (`NODE_OUTPUT_ALLOWED_KEYS`, wire 전용 키 이름 충돌 assertion)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (`resolveTriggerParametersRejectingMasked`, `hasMaskedLeaf`)
- `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts`
- `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` (`maskSensitiveFields`, `DEFAULT_SENSITIVE_KEYS`)
- `codebase/frontend/src/lib/utils/masked-markers.ts` (`hasMaskedMarkerLeaf`)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`sanitizeForResponse`, `TRIGGER_RESPONSE_REDACT_COLUMNS`)
- `codebase/backend/src/modules/chat-channel/providers/slack/slack-client.ts`, `codebase/backend/src/modules/chat-channel/providers/discord/discord-client.ts`, `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts` (알려진 비밀 치환, §1.1)

## Rationale

### egress-only 를 택한 이유

저장 시점(append) 마스킹은 LLM 에 주입하는 스레드까지 바꾼다. 게다가 보수적인 공유 패턴(특히 `Bearer\s+\S+`)이 평범한 대화에서 오탐하면 컨텍스트를 조용히 망가뜨린다. 그래서 채택하지 않았다. 웹훅 문서의 Rationale 이 든 "DB 에 남으면 유출 표면" 우려는 여기서도 유효하다. 그 대가로 얻는 진단 가치와 저울질한 결과가 egress-only 다.

웹훅 문서는 표시 시점 마스킹을 기각하며 "모든 read 경로를 따로 마스킹해야 한다(whack-a-mole)" 를 근거로 들었다. 타당한 우려이고 이 작업이 그것을 실증했다(표면이 넷에서 여섯으로 늘었고 `inputData` 카브아웃 범위를 한 번 되돌렸다). 다만 여기서의 방어는 호출부를 흩어서 고치는 방식이 아니라 공유 관문으로 모으는 방식이다(§2.2). 그래서 받는 시점 층이 다루는 "알려진 헤더 key" 와 달리 미리 정할 수 없는 자유 텍스트를 나가는 시점에 다룰 수 있다.

시크릿 저장소 평문을 만든 자리에서 지우는 알려진 비밀 치환은 이 결정과 별개다(§1.1, 「트리거 응답의 마지막 오류를 표면에 올린 이유」).

### 내부 WebSocket 과 채팅 채널도 가리는 이유

`execution.ai_message` 마스킹은 발행 지점에 걸려 내부 WebSocket wire 와 채팅 채널 능동 발송(Telegram·Slack·Discord)에도 적용된다. 보수적 패턴(특히 `Bearer\s+\S+`, `pwd:`)이 기술적인 대화에서 오탐하면 이미 사용자에게 간 응답이 `***` 로 바뀔 수 있다. **보안을 우선**해(실제 시크릿을 외부 채널로 흘리지 않음) 이 드문 오탐을 받아들였다. 에디터는 외부 strip 대상이 아닌 `llmCalls` 디버그로 원문을 확인할 수 있다. 관찰자 표면만 가리는 식의 참여자·관찰자 분리는 뒤의 개선 여지로 남긴다.

### 마커 값을 공유 패키지로 옮긴 이유 (2026-08-21)

예전에는 두 스택이 마커 값을 손으로 복제했고 한쪽만 늘면 다른 쪽이 그 새 마커에 대해 조용히 fail-open 했다. 미러를 기계가 대조하게 만들려 했더니 CI 경로 게이팅에 막혔다(한쪽 CI 워크플로우(GitHub Actions)가 반대쪽 변경 때 검사를 건너뛴다). 그래서 값 자체를 공유 패키지로 옮겼다.

### 트리거 응답의 마지막 오류를 표면에 올린 이유 (2026-10-05)

→ [응답 자격 증명 마스킹 — 트리거 응답의 마지막 오류](CLE-API-EGRESS-TRIGGER.md#트리거-응답의-마지막-오류를-표면에-올린-이유-2026-10-05)
