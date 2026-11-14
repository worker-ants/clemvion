---
id: "CLE-WF-ASSIST-ERROR"
title: "워크플로우 AI 어시스턴트 — 에러 처리와 모델 설정"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-ASSIST"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-ASSIST"]
area: "CLE-WF"
content_hash: "a3d8b7b9ae00ed68c41c487679899c9127c6ae62035b1cc21da1611a0aa527a5"
read_as: "approved_fallback"
task: "CLE-T-EK4DMX"
source_paths: []
mirror_sha256: "2d9d72cb6d6be0b53007544c1049b6e7a42c0a88e07a594f3ccff427dc7a8d09"
etag: "sha256-35ab1c69ac3a47741111f3e0feb169362cc579fae726a82a5c7eb5890623d7e6"
---
## 개요

이 문서는 [워크플로우 AI 어시스턴트](CLE-WF-ASSIST.md) 의 하위 문서로 어시스턴트 턴의 에러 코드 · 에러 버블 문구와 모델 설정 선택 · 대체 규칙을 정한다. SSE `error` · `config_fallback` 이벤트의 형식은 [AI 어시스턴트 스트리밍과 세션 API](CLE-WF-ASSIST-PROTO.md#sse-이벤트), 에러 버블의 화면 배치는 [패널 화면](CLE-WF-ASSIST-UI.md#요소별-동작)에 있다.

## 에러 처리

| 코드 | 상황 | 사용자 안내 |
|------|------|-------------|
| `ASSISTANT_NO_LLM_CONFIG` | 쓸 모델 설정이 없다. 지정한 설정이 없는데 워크스페이스 기본 설정도 없거나, 지정한 설정을 찾지 못해 기본 설정으로 대신하려 했는데 기본 설정도 없을 때다([모델 설정](#모델-설정)). 설정 조회 자체가 실패하면(DB 장애 등) 이 코드가 아니라 `ASSISTANT_STREAM_FAILED` 다 | `assistant.errorNoLlmConfig` 문구와 모델 설정 화면 링크 `assistant.errorNoLlmConfigLink` |
| `ASSISTANT_TOO_MANY_TOOL_CALLS` | 한 턴의 [어시스턴트 도구 호출 한도](CLE-WF-ASSIST-LOOP.md#어시스턴트-도구-호출-한도)를 넘었다 | `assistant.errorTooManyToolCalls` 문구와 에러 버블의 "이어서 진행" 버튼. 다음 턴에 남은 단계를 이어서 한다 |
| `ASSISTANT_STREAM_FAILED` | 스트림을 열기 전에 클라이언트가 예외를 던졌거나, 모델 설정 조회가 실패했거나(DB 장애 등), 턴 처리 중 서비스 안에서 실패했다. OpenAI 계열(OpenAI·Azure·Local)은 스트림을 열 때의 실패(429, SDK 요청 타임아웃 포함)가 이 코드로 온다([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#스트리밍-에러-매핑)). 스트리밍 미지원 예외는 따로 `LLM_STREAMING_UNSUPPORTED` 로 보낸다 | `assistant.errorStreamFailed` 문구로 재시도 안내. 이 코드 하나에 OpenAI 계열의 429 · SDK 요청 타임아웃과 서버 내부 실패가 함께 담기고 코드는 원인을 나누지 않는다. 그래서 두 문구 모두 원인을 단정하지 않는다. 서버 문구는 재시도만 안내하고 사전 문구는 가능한 원인(요청 한도 초과, 응답 지연)과 재시도를 안내한다. 모델 프로바이더 간 통일은 NERV Task `CLE-T-0R5SYN` 이 정한다 |
| `LLM_RATE_LIMIT` | 429 ([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#스트리밍-에러-매핑)). OpenAI 계열은 스트림을 열 때의 429 를 `ASSISTANT_STREAM_FAILED` 로 보낸다 | `assistant.errorRateLimit` 문구로 재시도 안내. 재시도 버튼은 정의가 갈린다([미결 사항](CLE-WF-ASSIST.md#미결-사항)) |
| `LLM_CONNECTION_ERROR` | 스트림이 열린 뒤 429 가 아닌 이유로 실패했다(모든 모델 프로바이더. OpenAI 계열의 harmony 토큰 오류는 아래 행). Anthropic·Google 은 스트림을 열 때의 429 밖 실패도 이 코드로 보낸다. Anthropic 의 SDK 요청 타임아웃도 여기에 든다([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#스트리밍-에러-매핑)) | `assistant.errorConnection` 문구로 재시도 안내(네트워크 오류) |
| `LLM_OUTPUT_MALFORMED` | OpenAI 계열 스트림에 gpt-oss 계열 모델의 harmony 제어 토큰이 드러났다([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) 의 harmony 제어 토큰 거르기) | `assistant.errorOutputMalformed` 문구 |
| `LLM_STREAMING_UNSUPPORTED` | 선택한 모델 설정의 프로바이더가 스트리밍을 지원하지 않는다. `LlmService.chatStream` 이 스트림을 열기 전에 던진 예외의 코드를 그대로 보낸다([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#스트리밍-에러-매핑)). 지금의 다섯 프로바이더는 모두 스트리밍을 지원해 운영 환경의 발동 경로가 없다 | `assistant.errorStreamingUnsupported` 문구로 다른 모델 설정을 고르라고 안내한다. 재시도 안내와 "이어서 진행" 버튼은 없다 |
| `ASSISTANT_SESSION_NOT_FOUND` | 세션이 삭제됐다 | "세션이 만료되었어요. 새 대화를 시작할게요." 와 새 세션 자동 생성 (미구현, NERV Task `CLE-T-ZWQ4K2`) |
| `ASSISTANT_SESSION_NOT_YOURS` | 같은 워크스페이스의 다른 사용자 세션이다. 다른 워크스페이스의 세션은 `ASSISTANT_SESSION_NOT_FOUND` 로 온다([AI 어시스턴트 스트리밍과 세션 API](CLE-WF-ASSIST-PROTO.md#세션-rest-api)) | 접근 거부 |

편집 도구 실패에는 에러 코드가 없다. 편집 도구가 Shadow 검증에 실패해도 SSE `error` 이벤트는 나가지 않는다. 실패는 `tool_call` 이벤트의 `result.ok: false` 와 `result.error` 로 오고, 배지에 구체 사유([AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md#shadow-검증-규칙))가 보인다. 턴은 이어지고 LLM 이 다음 라운드에 복구를 시도한다.

에러 버블 동작과 코드별 사전 키는 이 표가 기준이다. 에러 버블에는 제목(`assistant.errorBubbleTitle`), 에러 코드, 안내 문구가 보인다(`assistant-message.tsx`). 안내 문구는 `ERROR_MESSAGE_KEYS` 가 에러 코드로 고른 `assistant.*` 사전 문구다([다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 규칙 1). 이 표에서 사전 키를 적은 일곱 코드가 `ERROR_MESSAGE_KEYS` 에 있다. 사전 문구가 없는 코드는 서버가 보낸 영문 `message` 로 폴백한다. 그 `message` 는 아래 문단대로 코드별 고정 영문이거나 공통 폴백 문구다.

서버는 SSE `error` 이벤트의 `message` 에 코드별 고정 영문만 싣는다. 어시스턴트 모듈(스트림 서비스와 컨트롤러)이 SSE `error` 이벤트로 보내는 모든 `message` 는 `workflow-assistant-stream-errors.ts` 한 곳에서 정한다. 세션 REST API 오류 응답의 `message` 는 HTTP 에러 응답이라 [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md) 가 정한다. 문구는 이 파일의 표에서 고르고 한도 숫자가 문구에 들어가는 `ASSISTANT_TOO_MANY_TOOL_CALLS` 만 이 파일의 함수가 만든다. `ASSISTANT_TOO_MANY_TOOL_CALLS` 의 두 갈래(라운드 상한, 도구 호출 한도)도 이 파일의 문구를 쓴다. 스트림 서비스 밖에서 컨트롤러가 잡은 예외는 `ASSISTANT_STREAM_FAILED` 의 고정 문구로 보낸다. 이 파일의 표에 없는 LLM 클라이언트 코드는 공통 폴백 문구(`The LLM stream failed. Please try again.`)를 쓴다. 모델 프로바이더 · 라이브러리 예외 원문과 LLM 클라이언트 스트림 `error` 의 `message`(진단 문구)는 서버 로그에만 남는다. [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md) 규칙 2 와 같은 동기다(CWE-209). 서버 문구를 영문으로 두는 근거는 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 규칙 3 이다.

백엔드 문구 표 · 함수(`workflow-assistant-stream-errors.ts`)와 프론트엔드 `ERROR_MESSAGE_KEYS` 는 같은 일곱 코드를 다룬다. 새 코드를 더하면 양쪽을 함께 고친다. 두 표를 맞추는 테스트와 CI 경로, 공유 상수 패키지를 두지 않은 이유는 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md#어시스턴트-에러-코드를-컴포넌트-지역-표로-매핑하는-이유-2026-10-24) 가 정본이다.

알려진 예외가 하나 있다. 같은 실패가 모델 프로바이더마다 다른 코드로 온다. `ASSISTANT_STREAM_FAILED` 한 코드에 여러 원인이 합쳐진 것도 이 공백이다(NERV Task `CLE-T-0R5SYN`, [에러 코드 규약과 카탈로그 「미결 사항」](../CLE-API/CLE-API-ERRCODES.md#미결-사항)). SSE `error` 이벤트의 코드 목록은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#625-ai-어시스턴트-스트림-도메인-문서-참조) 에도 있다.

스트리밍을 지원하지 않는 프로바이더가 선택되면 LLM 클라이언트의 `LLM_STREAMING_UNSUPPORTED` 를 SSE `error` 이벤트로 그대로 보낸다. 이 코드는 LLM 클라이언트의 스트림 `error` 이벤트로는 오지 않는다. 클라이언트에 `stream()` 이 없으면 `LlmService.chatStream` 이 스트림을 열기 전에 `BadRequestException` 을 던지고 응답 본문의 `code` 에 이 코드를 싣는다. 스트림 서비스는 잡은 예외를 `workflow-assistant-stream-errors.ts` 의 `fromStreamException` 에 넘긴다. 이 함수는 `llm.service.ts` 의 `isLlmStreamingUnsupported` 로 `HttpException` 응답 본문의 `code` 가 `LLM_STREAMING_UNSUPPORTED` 인지 본다. 맞으면 그 코드와 고정 영문을 고른다. 그 밖의 예외면 `ASSISTANT_STREAM_FAILED` 를 고른다. 예외의 `message`(프로바이더 이름 포함)는 서버 로그에만 남는다. 컨트롤러가 잡은 예외는 지금처럼 `ASSISTANT_STREAM_FAILED` 다. 코드 값은 `llm-client.interface.ts` 의 상수 `LLM_STREAMING_UNSUPPORTED` 와 타입 `LlmStreamingUnsupportedCode` 가 정한다. 어시스턴트 SSE 에러 코드 타입은 이 타입을 따로 더해 받는다. 스트림 에러 코드 유니온(`LlmStreamErrorCode`)은 바꾸지 않았다([스트리밍 미지원 코드를 스트림 에러 유니온 밖에 둔다](#스트리밍-미지원-코드를-스트림-에러-유니온-밖에-둔다-2026-11-14)). 화면 문구는 `ERROR_MESSAGE_KEYS` 가 `assistant.errorStreamingUnsupported` 로 고른다. 지금의 다섯 프로바이더는 모두 스트리밍을 지원해 운영 환경의 발동 경로는 없다. e2e 의 LLM 스텁(`LLM_STUB_MODE=true`)에는 `stream()` 이 없어 어시스턴트 e2e 에서는 이 코드가 나온다. 지정한 모델 설정을 찾지 못한 경우에도 따로 코드를 두지 않는다. 기본 설정으로 대신하고 그것도 없을 때만 `ASSISTANT_NO_LLM_CONFIG` 다([모델 설정](#모델-설정)).

턴이 실패해도 이미 적용된 편집은 에디터 스토어에 남아 있어 `Ctrl+Z` 로 되돌릴 수 있다.

"이어서 진행" 버튼은 `assistant-message.tsx` 의 `RESUMABLE_ERROR_CODES` 에 든 코드에만 붙는다. 지금은 `ASSISTANT_TOO_MANY_TOOL_CALLS` 하나다. `ASSISTANT_NO_LLM_CONFIG`, `ASSISTANT_STREAM_FAILED`, `LLM_STREAMING_UNSUPPORTED` 는 이어서 진행으로 복구할 수 없어 버튼이 없다. 버튼은 스토어의 `continueAfterBudget` 동작을 불러 현재 언어에 맞는 "이어서 진행" 메시지를 보낸다.

## 모델 설정

- 요청이나 세션이 지정한 모델 설정을 찾지 못하면(삭제됐거나 워크스페이스 밖이거나 Chat 종류가 아님) 서버는 워크스페이스 기본 설정으로 대신한다. 턴의 첫 이벤트로 `config_fallback` 을 보낸다([AI 어시스턴트 스트리밍과 세션 API](CLE-WF-ASSIST-PROTO.md#sse-이벤트)). 프론트엔드는 `assistant.configFallbackToast` 토스트로 알리고 선택 값을 "기본 Provider" 로 되돌린다. 그래서 다음 턴부터는 없는 설정 id 를 보내지 않는다.
- 기본 설정도 없으면 턴은 `ASSISTANT_NO_LLM_CONFIG` 로 끝난다. 설정 조회 자체가 실패하면(DB 장애 등) 설정이 없다는 안내가 맞지 않으므로 `ASSISTANT_STREAM_FAILED` 로 끝난다.
- 모델 설정을 지우면 세션의 `llm_config_id` 가 ON DELETE SET NULL 로 비워진다([AI 어시스턴트 스트리밍과 세션 API](CLE-WF-ASSIST-PROTO.md#어시스턴트-세션)). 그래서 새로 연 패널은 알림 없이 기본 설정을 쓴다. 대체 알림은 이미 열린 패널이 지운 설정 id 를 요청에 실어 보낼 때 나간다.
- 어시스턴트 호출에는 고른 모델 설정의 기본 파라미터(temperature · max_tokens)를 채운다. 어시스턴트는 이 두 값을 따로 정하지 않으므로 모델 설정에 저장한 값이 쓰이고, 값이 없으면 보내지 않는다. 채우는 규칙은 [LLM 서비스 「모델 설정 기본 파라미터 채우기」](../CLE-AI/CLE-AI-LLM-SERVICE.md#모델-설정-기본-파라미터-채우기) 가 정본이다.
- 사용량은 `llm_usage_log` 에 `workflow_id`·`workspace_id` 와 함께 기록한다([LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md)).

## 구현 위치

- `codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream-errors.ts` (SSE `error` 이벤트 `message` 의 단일 출처, 스트림 예외의 코드를 고르는 `fromStreamException`)
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` (스트림 예외를 SSE `error` 이벤트로 보낸다)
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` (SSE 응답, 스트림 밖 예외의 `error` 이벤트)
- `codebase/backend/src/modules/llm/interfaces/llm-client.interface.ts` (`LLM_STREAMING_UNSUPPORTED` 상수와 `LlmStreamingUnsupportedCode` 타입)
- `codebase/backend/src/modules/llm/llm.service.ts` (`chatStream` 이 던지는 스트리밍 미지원 예외, 그 예외를 가려내는 `isLlmStreamingUnsupported`)
- `codebase/frontend/src/components/editor/assistant-panel/assistant-message.tsx` (에러 버블, `ERROR_MESSAGE_KEYS` · `RESUMABLE_ERROR_CODES`)

## Rationale

### 에러 버블에 프로바이더 원문을 싣지 않는다 (2026-10-23)

2026-10-10 결정으로 고친 스트림 실패 요구사항은 에러 버블에 «에러 코드와 사유» 를 보인다고 적었다. 이 문구는 모델 프로바이더 원문 노출을 요구사항으로 굳힌다(CWE-209). 당시 스트림 서비스와 에러 버블은 SDK 예외 메시지를 그대로 보였다. [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md) 규칙 2 는 HTTP 에러 응답에 라이브러리 예외 원문을 싣지 않는다고 정한다. SSE 스트림의 `error` 이벤트는 그 규칙이 다루는 층이 아니지만 막으려는 노출(CWE-209)은 같다. 같은 모듈의 REST 컨트롤러도 같은 이유로 코드만 내보내고, harmony 제어 토큰 대응([대화 루프와 턴 가드](CLE-WF-ASSIST-LOOP.md#프로바이더-이상동작-대응))도 원시 메시지를 로그에만 남긴다. 그래서 «사유» 를 코드별 안내 문구로 정하고 원문은 서버 로그에만 남긴다. 에러 처리 표의 안내 열은 기존 요구사항이 정한 목표로 두었다. 구현은 NERV Task `CLE-T-MX8PSE` 가 맡았다.

### 에러 버블 문구는 `assistant.*` 사전 키로 고른다 (2026-10-24)

NERV Task `CLE-T-MX8PSE` 가 위 결정을 구현하면서 에러 버블 문구를 어디서 고를지 정했다. [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 규칙 5 의 `ERROR_KO` 대신 규칙 1 의 `assistant.*` 사전 키를 쓴다. 이 문서와 [AI 어시스턴트 스트리밍과 세션 API](CLE-WF-ASSIST-PROTO.md) · [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 의 개정판은 같은 Task 의 변경이라 함께 승인한다.

- **범위를 여섯 코드로 넓혔다.** 2026-10-23 결정은 세 코드(`ASSISTANT_STREAM_FAILED` · `LLM_RATE_LIMIT` · `LLM_CONNECTION_ERROR`)의 안내 문구를 다뤘다. 이번 구현에서 `ERROR_MESSAGE_KEYS` 의 여섯 코드로 넓혔다. LLM 클라이언트가 쓴 `message` 는 코드와 관계없이 서버 로그에만 남긴다.
- **새 에러 코드는 만들지 않았다.** 코드별 문구는 기존 에러 코드에 붙였다. SSE `error` 이벤트가 내는 코드 집합은 그대로다.
- **규칙 5 의 `ERROR_KO` 를 쓰지 않은 이유.** 구현 당시 승인본의 규칙 5 원천 표는 HTTP 에러 응답 봉투 코드와 노드 `output.error.code` 층만 다뤘고 SSE `error` 이벤트의 코드는 없었다. 이 문구는 어시스턴트 패널에서만 쓰고 모델 설정 링크 문구가 함께 붙는다. 그래서 패널의 다른 문구와 같은 `assistant.*` 사전에 둔다. 이 경로를 원천 표의 한 행으로 두는 규칙은 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 규칙 5 의 어시스턴트 행이 정한다.
- **기각한 대안: `ERROR_KO` 에 코드를 더한다.** 문구는 표시 면마다 하나이고 코드 문자열이 같아도 면이 다르면 표도 다르다. 근거의 정본은 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md#어시스턴트-에러-코드를-컴포넌트-지역-표로-매핑하는-이유-2026-10-24) 의 Rationale 이다.
- **기각한 대안: LLM 클라이언트가 쓴 안내문을 코드별 허용 목록으로 통과시킨다.** 처음 구현은 `LLM_OUTPUT_MALFORMED` 하나를 허용 목록에 두고 LLM 클라이언트가 쓴 한국어 안내문을 그대로 보냈다. `ASSISTANT_TOO_MANY_TOOL_CALLS` 의 서버 문구에도 "이어서 진행해줘" 같은 한국어 예시가 들어 있었다. 이 허용 목록은 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 규칙 3(백엔드 응답에 한국어를 넣지 않는다)과 어긋났고 en 로케일에서도 한국어가 보여 없앴다. 지금은 두 코드 모두 고정 영문을 보내고 화면 문구는 `assistant.errorOutputMalformed` · `assistant.errorTooManyToolCalls` 가 고른다.
- **기각한 대안: 원문을 마스킹해서 보인다.** [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-26-마지막-오류-필드는-프로바이더-원문을-싣고-자격-증명-모양만-가린다) 의 R-CC-26 처럼 자격 증명 모양만 가리고 나머지 원문은 보이는 방식이다. URL 이나 응답 본문 조각은 자격 증명 모양이 아니어도 내부 정보다. R-CC-26 의 근거 가운데 (c) 는 여기서 성립하지 않는다. 채팅 채널의 원문은 클라이언트마다 고정된 API 호스트만 부른 결과다. LLM 클라이언트의 Local · Azure 모델 프로바이더는 사용자가 설정한 `baseUrl` 을 부르므로 내부 호스트가 원문에 실릴 수 있다. (d) 의 진단 가치는 서버 로그가 대신한다. 사용자가 할 일은 코드별 안내로 충분히 알 수 있다.
- **한 코드의 두 갈래는 한 문구로 합쳤다.** 의도한 단순화다. 한도 초과 사전 문구(`assistant.errorTooManyToolCalls`)에는 서버 문구에 든 라운드 상한 · 도구 호출 한도 숫자를 넣지 않는다. 숫자는 서버 영문 `message` 에 남는다.
- **서버가 `message` 를 빼지 않은 이유.** [AI 어시스턴트 스트리밍과 세션 API](CLE-WF-ASSIST-PROTO.md) 의 `error` 이벤트 데이터는 `{code, message}` 다. 이 필드를 유지하고 원문 대신 코드별 고정 영문을 싣는다. 이 영문은 사전 문구가 없는 코드의 폴백이 된다.
- **[에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md) 개요의 에러 층 표에 SSE 행을 더하지 않은 이유.** SSE 이벤트 계약의 정본은 [AI 어시스턴트 스트리밍과 세션 API](CLE-WF-ASSIST-PROTO.md) 다. `message` 의 뜻도 그 문서가 정한다. 세션 REST API 의 오류 응답은 HTTP 에러 응답이라 그 표의 층을 그대로 따른다. 다만 `LLM_RATE_LIMIT` 은 노드 `output.error.code` 층과 SSE 층에 같은 문자열로 나간다. 문자열이 같아도 표시 면이 달라 문구는 면마다 따로 고른다. `LLM_CONNECTION_ERROR` · `LLM_OUTPUT_MALFORMED` 는 LLM 클라이언트 층 코드다([에러 코드 규약과 카탈로그 §6.17](../CLE-API/CLE-API-ERRCODES.md#617-llm-클라이언트-도메인-문서-참조)). 노드에서는 이 둘이 `LLM_CALL_FAILED` 로 바뀌어 나온다.
- **LLM 클라이언트 쪽 정정은 따로 했다.** LLM 클라이언트의 `LLM_OUTPUT_MALFORMED` 한국어 안내문은 NERV Task `CLE-T-V73FFA` 가 2026-11-13 에 고정 영문 진단 문장으로 바꿨다([LLM 클라이언트 「스트림 오류 `message` 는 진단용으로 둔다」](../CLE-AI/CLE-AI-LLM.md#스트림-오류-message-는-진단용으로-둔다-2026-11-13)). 어시스턴트 SSE 는 그 문장도 서버 로그에만 남긴다.
- **구현하지 않은 안내는 `(미구현)` 으로 남겼다.** `ASSISTANT_SESSION_NOT_FOUND` 의 세션 만료 안내와 새 세션 자동 생성은 NERV Task `CLE-T-ZWQ4K2` 가 맡는다. 모델 설정 대체와 토스트는 [아래 결정](#모델-설정을-찾지-못하면-기본-설정으로-대신한다-2026-11-13)으로 구현했다.

### 모델 설정을 찾지 못하면 기본 설정으로 대신한다 (2026-11-13)

요구사항은 지운 모델 설정을 워크스페이스 기본 설정으로 대신하고 알리라고 정했지만 처음 구현은 대신하지 않았다. 이미 열린 패널이 지운 설정 id 를 보내면 기본 설정이 있어도 턴이 `ASSISTANT_NO_LLM_CONFIG` 로 끝났다. NERV Task `CLE-T-1K2BM4` 가 이 동작을 넣으면서 세 가지를 정했다.

- **대체 판단은 어시스턴트 스트림 서비스가 한다.** `LlmService.resolveConfig` 는 AI 노드도 쓴다. 노드는 지정한 설정이 없으면 실패해야 하므로 공용 메서드는 그대로 둔다. 어시스턴트가 `NotFoundException` 을 받았을 때만 기본 설정을 다시 조회한다.
- **알림은 SSE `config_fallback` 이벤트로 보낸다.** 기각한 대안 하나는 별도 에러 코드(`ASSISTANT_LLM_CONFIG_INVALID`)로 턴을 끝내는 것이다. 기본 설정으로 답할 수 있는데 턴을 실패로 끝낼 이유가 없다. 다른 대안은 알리지 않고 대신하는 것이다. 사용자가 고른 모델이 아닌 모델이 답하므로 알려야 한다. 그래서 턴은 이어 가고 첫 이벤트로 알린다. 프론트엔드는 선택 값을 비워 다음 턴부터 없는 설정 id 를 보내지 않는다.
- **설정 조회 실패는 `ASSISTANT_STREAM_FAILED` 로 보낸다.** 전에는 DB 장애 같은 조회 실패도 `ASSISTANT_NO_LLM_CONFIG` 로 보냈다. 그러면 설정이 있는데도 모델 설정을 먼저 등록하라는 안내와 링크가 나간다. 그래서 그 갈래를 재시도 안내 코드로 옮겼다.

### 스트리밍 미지원 코드를 스트림 에러 유니온 밖에 둔다 (2026-11-14)

NERV Task `CLE-T-EK4DMX` 가 `LLM_STREAMING_UNSUPPORTED` 전달을 구현했다. 이 문서의 이전 판은 전달을 구현할 때 이 코드를 `LlmStreamErrorCode` 와 `ERROR_MESSAGE_KEYS` 두 곳에 더하라고 적었다. 구현은 `LlmStreamErrorCode` 에 넣지 않았다. 대신 `llm-client.interface.ts` 에 상수 `LLM_STREAMING_UNSUPPORTED` 와 타입 `LlmStreamingUnsupportedCode` 를 두고 어시스턴트 SSE 에러 코드 타입에 더했다.

- **`LlmStreamErrorCode` 는 스트림 `error` 이벤트 코드의 유니온이다.** LLM 클라이언트가 스트림 `error` 이벤트로 내는 코드만 담는다([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md)). `LLM_STREAMING_UNSUPPORTED` 는 그 이벤트로 오지 않고 `LlmService.chatStream` 이 예외로만 던진다. 이 코드를 유니온에 넣으면 클라이언트가 그 이벤트로 이 코드를 낸다고 잘못 읽힌다.
- **예외는 응답 본문의 `code` 로 구분한다.** 전에는 스트림 서비스가 잡은 예외를 원인과 관계없이 `ASSISTANT_STREAM_FAILED` 로 보냈다. 지금은 `fromStreamException` 이 `HttpException` 응답 본문의 `code` 를 보고 이 코드만 그대로 넘긴다. 판별은 `llm.service.ts` 의 `isLlmStreamingUnsupported` 한 곳이 맡는다. 던지는 쪽(`chatStream`)과 읽는 쪽(어시스턴트)이 코드 문자열 비교를 따로 들지 않게 했다. 나머지 예외는 여전히 `ASSISTANT_STREAM_FAILED` 다. 예외의 `message` 는 다른 코드처럼 서버 로그에만 남긴다.
- **"이어서 진행" 버튼은 붙이지 않았다.** 같은 모델 설정으로 이어서 보내도 같은 코드로 끝난다. 사용자가 할 일은 다른 모델 설정을 고르는 것이라 안내 문구(`assistant.errorStreamingUnsupported`)만 둔다.
- **위 「범위를 여섯 코드로 넓혔다」 는 2026-10-24 당시의 이력이다.** 지금 두 표가 다루는 코드는 이 코드를 더해 일곱이다.
