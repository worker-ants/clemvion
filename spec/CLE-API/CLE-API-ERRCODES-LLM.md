---
id: "CLE-API-ERRCODES-LLM"
title: "에러 코드 카탈로그 — LLM 클라이언트 · AI 어시스턴트"
type: "convention"
version: 4
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-ERRCODES"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-ERRCODES"]
area: "CLE-API"
content_hash: "bedfc8e28be56ba0cdfda48e701b99b726d570b01f27381050646d32774cad79"
read_as: "approved_fallback"
task: "CLE-T-B7YTQX"
source_paths: []
mirror_sha256: "e59e1d82c72386bdf2a15ee8e5f2631032de155e1d9e0d42794e73c0309aba01"
etag: "sha256-8d28a3b8ee82500952c980a0b9669164fb35b26bdfe8a5d0e0b13990482348c1"
---
## 개요

이 문서는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 하위 문서로 카탈로그 가운데 LLM 클라이언트 코드(§6.17), AI 어시스턴트 세션 API 코드(§6.19), AI 어시스턴트 스트림 코드(§6.25)를 정한다.

## 6.17 LLM 클라이언트 (도메인 문서 참조)

LLM 클라이언트 층(`*.client.ts`)이 프로바이더 원본 에러를 좁혀 매핑하는 코드와 모델 설정 미리보기 경로의 코드다. 노드 출력의 LLM 부류(§6.6)와 층이 다르다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `LLM_RATE_LIMIT` | 429 (프로바이더 응답) | 프로바이더 속도 제한. `chat` 은 지수 백오프로 최대 3회 다시 시도한다(`withRetry`). `chatStream` 은 앱 수준 재시도를 거치지 않는다. 스트림을 열 때의 429 도 프로바이더와 상관없이 스트림 `error` 이벤트의 이 코드로 온다([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#스트리밍-에러-매핑)) | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_CONNECTION_ERROR` | 없음 | 위에 해당하지 않는 모든 클라이언트 호출 실패의 기본값(인증 실패, 모델 없음, 컨텍스트 초과 포함). 스트림을 열 때의 실패(SDK 요청 타임아웃 포함)도 프로바이더와 상관없이 스트림 `error` 이벤트의 이 코드로 온다([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#스트리밍-에러-매핑)) | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_OUTPUT_MALFORMED` | 없음 | gpt-oss 계열 harmony 제어 토큰 노출(OpenAI 스트리밍 경로). `message` 는 고정 영문 진단 문장이다. 사용자에게 보일 문구는 호출하는 쪽이 코드로 고른다 | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_CREDENTIALS_REQUIRED` | 400 | 미리보기 요청에서 local 이 아닌 프로바이더의 apiKey 누락 | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_MODEL_LIST_FAILED` | 400 | 미리보기나 `:id/models` 호출 중 프로바이더 응답 실패. 정리한 메시지를 보인다 | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `LLM_STREAMING_UNSUPPORTED` | 없음 | 클라이언트에 `stream()` 이 없을 때 `LlmService.chatStream` 이 스트림을 열기 전에 던지는 예외의 코드. 예외는 `BadRequestException` 이고 응답 본문의 `code` 에 이 코드가 실린다. `chatStream` 을 부르는 곳이 어시스턴트 스트림뿐이라 HTTP 응답으로 나가지 않고 SSE `error` 이벤트로 나간다(§6.25) | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |

세분화 코드 `LLM_AUTH_ERROR`(401), `LLM_MODEL_NOT_FOUND`(404), `LLM_CONTEXT_EXCEEDED`(400)는 계획이며 미구현이다. 지금은 `LLM_CONNECTION_ERROR` 로 모인다.

## 6.19 AI 어시스턴트 세션 API (도메인 문서 참조)

어시스턴트 세션 REST API 가 내는 코드다. 이 표의 `WORKFLOW_NOT_FOUND` 는 이 API 에서만 쓴다. 워크플로우 · 노드 · 연결선 경로의 없는 워크플로우는 404 `RESOURCE_NOT_FOUND` 이고, 어시스턴트의 탐색 도구가 모델에게 돌려주는 같은 이름의 문자열은 HTTP 응답이 아니라 도구 결과 값이다. 서브 워크플로우 노드의 `SUB_WORKFLOW_NOT_FOUND`(§6.6)와도 다른 표면이다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `WORKFLOW_NOT_FOUND` | 404 | 세션 생성 본문이나 세션 목록 조회의 `workflowId` 가 요청의 워크스페이스에 없음. 없는 id 와 다른 워크스페이스의 id 를 구분하지 않는다. 「참조의 소속」 의 예외 3 이다 | [AI 어시스턴트 스트리밍과 세션 API](../CLE-WF/CLE-WF-ASSIST-PROTO.md#세션-rest-api), [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) |
| `ASSISTANT_SESSION_NOT_FOUND` | 404 | 세션이 없거나 요청의 워크스페이스 세션이 아님 | [AI 어시스턴트 스트리밍과 세션 API](../CLE-WF/CLE-WF-ASSIST-PROTO.md#세션-rest-api) |
| `ASSISTANT_SESSION_NOT_YOURS` | 403 | 같은 워크스페이스의 다른 사용자가 만든 세션임. 다른 워크스페이스의 세션은 위 404 로 가린다 | [AI 어시스턴트 스트리밍과 세션 API](../CLE-WF/CLE-WF-ASSIST-PROTO.md#세션-rest-api) |

## 6.25 AI 어시스턴트 스트림 (도메인 문서 참조)

어시스턴트 메시지 스트림(`POST /api/workflow-assistant/sessions/{id}/messages`)의 SSE `error` 이벤트가 내는 코드다. 이벤트 데이터는 `{code, message}` 이고 HTTP 에러 응답 봉투가 아니다([AI 어시스턴트 스트리밍과 세션 API](../CLE-WF/CLE-WF-ASSIST-PROTO.md#sse-이벤트)). `message` 는 코드별 고정 영문이고 화면 문구는 프론트엔드가 코드로 고른다. 같은 API 의 세션 REST 코드는 §6.19 다.

| 코드 | 설명 | 정의 문서 |
|------|------|-----------|
| `ASSISTANT_NO_LLM_CONFIG` | 쓸 모델 설정이 없음. 지정한 설정이 없는데 워크스페이스 기본 설정도 없거나, 지정한 설정을 찾지 못해 기본 설정으로 대신하려 했는데 기본 설정도 없음. 기본 설정이 있으면 에러 없이 대신하고 `config_fallback` 이벤트로 알린다 | [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md#에러-처리) |
| `ASSISTANT_STREAM_FAILED` | `LlmService.chatStream` 이 스트림 `error` 이벤트가 아닌 예외를 던짐(클라이언트 생성 실패 등. 스트리밍 미지원은 뺀다), 모델 설정 조회 실패(DB 장애 등), 턴 처리 중 서비스 내부 실패. 원인을 나누지 않는다. LLM 의 429 · SDK 요청 타임아웃은 스트림을 열 때도 §6.17 코드로 온다 | [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md#에러-처리) |
| `ASSISTANT_TOO_MANY_TOOL_CALLS` | 한 턴의 LLM 호출 라운드 상한이나 도구 호출 예산을 넘음. `message` 에 한도 숫자가 들어간다 | [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md#어시스턴트-도구-호출-한도) |

LLM 클라이언트 스트림의 `LLM_RATE_LIMIT` · `LLM_CONNECTION_ERROR` · `LLM_OUTPUT_MALFORMED`(§6.17)도 같은 이벤트에 코드 그대로 실린다. 스트림을 열 때의 실패도 프로바이더와 상관없이 이 코드로 온다. 다만 `message` 는 클라이언트의 진단 문구가 아니라 어시스턴트의 코드별 고정 영문이다. 정의는 §6.17 행이라 이 표에 다시 두지 않는다. 스트리밍을 지원하지 않는 프로바이더의 `LLM_STREAMING_UNSUPPORTED`(§6.17)는 LLM 클라이언트의 스트림 `error` 이벤트로 오지 않는다. `LlmService.chatStream` 이 스트림을 열기 전에 던진 예외에 실려 오고, 어시스턴트는 그 예외를 SSE `error` 이벤트로 바꿀 때 이 코드를 그대로 싣는다. `message` 는 이 코드도 어시스턴트의 고정 영문이다. 다섯 프로바이더가 모두 스트리밍을 지원해 운영 환경의 발동 경로는 없다. e2e 의 LLM 스텁에는 `stream()` 이 없어 어시스턴트 e2e 에서는 이 코드가 나간다.

`ASSISTANT_STREAM_FAILED` 를 원인별 코드로 나눌지(규칙 6)는 [에러 코드 규약과 카탈로그 「미결 사항」](CLE-API-ERRCODES.md#미결-사항) 의 「`ASSISTANT_STREAM_FAILED` 의 원인 묶음」 항목에서 정한다.

편집 도구 실패는 에러 코드가 아니다. `tool_call` 이벤트의 `result.ok: false` 로 오고 턴은 이어진다. 설계 단계에 있던 `ASSISTANT_TOOL_FAILED` · `ASSISTANT_LLM_CONFIG_INVALID` · `ASSISTANT_STREAMING_UNSUPPORTED` 는 발행된 적이 없어 등재하지 않는다(규칙 9).

## Rationale

### 어시스턴트 세션 코드를 도메인 참조 절로 올렸다 (2026-10-05)

어시스턴트 세션 REST API 의 `WORKFLOW_NOT_FOUND` · `ASSISTANT_SESSION_NOT_FOUND` · `ASSISTANT_SESSION_NOT_YOURS` 는 구현이 이미 내던 코드인데 카탈로그에 없었다. [데이터 모델 개요 「참조의 소속」](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 이 세션 생성 `workflowId` 를 표에 올리고 404 `WORKFLOW_NOT_FOUND` 를 예외로 적으면서(사람 결정, NERV Task `CLE-T-QTRRE6`) 같은 API 의 세 코드를 §6.19 에 함께 등재했다. 발행하는 코드는 등재한다는 규칙 8 을 따랐다.

- **`WORKFLOW_NOT_FOUND` 를 `RESOURCE_NOT_FOUND` 로 바꾸지 않았다.** 이미 나가던 코드이고 이름을 바꾸면 규칙 5 의 이름 바꾸기 비용이 든다. 같은 본문의 `llmConfigId` 도 도메인 코드(404 `MODEL_CONFIG_NOT_FOUND`)라 이 API 안에서는 도메인 코드가 일관된다. 다른 워크플로우 경로의 `RESOURCE_NOT_FOUND` 와 갈리는 점은 §6.19 머리말에 적어 이 API 한정으로 묶었다.
- **세션 코드 둘의 뜻은 구현을 따랐다.** 정의 문서가 «워크스페이스 · 사용자 경계» 를 모두 `ASSISTANT_SESSION_NOT_YOURS` 로 적었으나 구현은 다른 워크스페이스의 세션을 404 `ASSISTANT_SESSION_NOT_FOUND` 로 가린다. 없는 것과 다른 워크스페이스의 것을 구분하지 않는 규칙과 맞는 쪽이 구현이라 정의 문서를 같은 변경에서 고쳤다.

### 어시스턴트 스트림 코드를 도메인 참조 절 6.25 로 등재했다 (2026-11-13)

NERV Task `CLE-T-YFDSY7` 이다. 어시스턴트 메시지 스트림의 SSE `error` 이벤트는 `ASSISTANT_NO_LLM_CONFIG` · `ASSISTANT_STREAM_FAILED` · `ASSISTANT_TOO_MANY_TOOL_CALLS` 를 내는데 이 카탈로그에 행이 없었다(규칙 8). §6.21~6.24 를 더한 2026-11-05 결정의 구조를 따랐다.

- **§6.1~6.24 는 그대로 두고 §6.25 를 더했다.** §6.19 에 합치는 안은 택하지 않았다. §6.19 의 코드는 HTTP 에러 응답으로, §6.25 의 코드는 SSE 이벤트로 나가 나가는 곳이 다르다. 번호를 다시 매기면 절 앵커와 링크가 깨진다.
- **LLM 클라이언트 코드는 행을 두 번 두지 않았다.** 스트림이 그대로 넘기는 세 코드의 정의는 §6.17 행이다. §6.25 는 넘긴다는 사실과 `message` 가 바뀐다는 점만 적는다.
- **발행된 적 없는 세 코드는 등재하지 않았다(규칙 9).** `ASSISTANT_LLM_CONFIG_INVALID` 자리는 기본 설정으로 대신하고 `config_fallback` 이벤트로 알리는 동작이 맡는다(사람 결정, 2026-11-13. 구현은 NERV Task `CLE-T-1K2BM4`). `ASSISTANT_STREAMING_UNSUPPORTED` 자리는 LLM 클라이언트의 `LLM_STREAMING_UNSUPPORTED` 를 그대로 넘기는 것으로 정했다(사람 결정, 2026-11-13. 구현은 NERV Task `CLE-T-EK4DMX`). 같은 뜻의 코드를 하나 더 두지 않기 위해서다. `ASSISTANT_TOOL_FAILED` 는 편집 도구 실패가 `tool_call` 결과로 오므로 코드가 아니다.

### 스트리밍 미지원 코드 전달을 현재 동작으로 적었다 (2026-11-14)

NERV Task `CLE-T-EK4DMX` 가 2026-11-13 결정대로 `LLM_STREAMING_UNSUPPORTED` 를 어시스턴트 SSE `error` 이벤트에 그대로 싣게 구현했다. 이전 판 §6.25 는 이 전달을 아직 구현하지 않았다고 적었다. 구현에 맞춰 §6.25 를 현재 동작으로 고쳤다.

- **§6.25 표에 행을 더하지 않았다.** 정의는 §6.17 행이고 §6.25 는 넘긴다는 사실만 적는다는 2026-11-13 원칙을 그대로 따랐다.
- **예외로 오는 경로를 따로 적었다.** 같은 문단의 다른 LLM 코드는 클라이언트의 스트림 `error` 이벤트로 오고 이 코드만 스트림을 열기 전 예외로 온다. 둘을 한 문장으로 묶으면 이 코드도 스트림 이벤트로 오는 것처럼 읽혀 나눠 적었다. 이 코드를 스트림 에러 코드 유니온(`LlmStreamErrorCode`)에 넣지 않은 이유는 [에러 처리와 모델 설정](../CLE-WF/CLE-WF-ASSIST-ERROR.md#스트리밍-미지원-코드를-스트림-에러-유니온-밖에-둔다-2026-11-14) 이 정본이다.
- **§6.17 행의 설명을 던지는 곳에 맞췄다.** 이전 판은 「스트리밍을 지원하지 않는 프로바이더에 `stream()` 호출」이라 적어 클라이언트의 `stream()` 이 던지는 것처럼 읽혔다. 실제로는 `LlmService.chatStream` 이 클라이언트에 `stream()` 이 없는 것을 보고 스트림을 열기 전에 던진다. HTTP 칸은 「없음」으로 두었다. 예외 종류는 `BadRequestException` 이지만 `chatStream` 을 부르는 곳이 어시스턴트 스트림뿐이라 HTTP 응답으로 나가지 않는다.

### 어시스턴트 스트림 코드의 프로바이더 분기를 없앴다 (2026-11-14)

NERV Task `CLE-T-0R5SYN` 이다. OpenAI 계열 클라이언트는 스트림을 열 때의 실패를 예외로 던졌고 어시스턴트는 그 예외를 `ASSISTANT_STREAM_FAILED` 로 보냈다. 그래서 같은 429 가 Anthropic · Google 이면 `LLM_RATE_LIMIT` 로, OpenAI 계열이면 `ASSISTANT_STREAM_FAILED` 로 나갔다. 2026-11-14 에 사람이 세 클라이언트 모두 열 때의 실패를 스트림 `error` 이벤트로 내기로 정했다([LLM 클라이언트 「스트림 열기 실패를 모든 프로바이더에서 `error` 이벤트로 낸다」](../CLE-AI/CLE-AI-LLM.md#스트림-열기-실패를-모든-프로바이더에서-error-이벤트로-낸다-2026-11-14)).

- **규칙 4 와 어긋나던 점은 없어졌다.** 같은 429 와 SDK 요청 타임아웃이 프로바이더와 상관없이 같은 §6.17 코드로 나간다.
- **규칙 6 과 어긋나던 점은 줄었다.** 429 와 SDK 요청 타임아웃이 `ASSISTANT_STREAM_FAILED` 에서 빠졌다. 남은 원인은 `chatStream` 이 이벤트가 아닌 예외로 끝난 경우(클라이언트 생성 실패 등), 모델 설정 조회 실패, 서비스 내부 실패다. 모델 설정 조회 실패를 이 코드로 보내는 것은 2026-11-13 결정을 따른다([에러 처리와 모델 설정](../CLE-WF/CLE-WF-ASSIST-ERROR.md#모델-설정을-찾지-못하면-기본-설정으로-대신한다-2026-11-13)). 나머지 원인을 코드로 나눌지는 [에러 코드 규약 「미결 사항」](CLE-API-ERRCODES.md#미결-사항) 에 남겼다.
- **새 코드는 만들지 않았다.** 429 와 SDK 요청 타임아웃은 이미 있는 §6.17 코드로 옮겨 갔다.
