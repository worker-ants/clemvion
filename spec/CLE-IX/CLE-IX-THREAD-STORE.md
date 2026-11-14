---
id: "CLE-IX-THREAD-STORE"
title: "대화 스레드 — 누적과 영속화"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-IX-THREAD"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-IX-THREAD"]
area: "CLE-IX"
content_hash: "10cee55954bd74d7420dc1587c06952c00819685433b48e0421cb5780aa396ad"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "0ac8ac6747830acc3893aec3d95fc6c84acbb3e7e2c584d340558bf3e105e895"
etag: "sha256-8525182543852cc1f0a67827001147ad191b3d567c3f74a866186efc97ec4f80"
---
## 개요

이 문서는 [대화 스레드](CLE-IX-THREAD.md) 의 하위 문서로 항목이 쌓이는 시점과 출처(자동 누적), 컨테이너별 유지 범위, 영속화(park 스냅샷과 rehydration)를 정한다. 텍스트 변환과 LLM 주입은 [텍스트 변환과 AI 노드 주입](CLE-IX-THREAD-INJECT.md) 이 정한다.

## 자동 누적

### Presentation 노드

재개 출력을 만들며 `output.interaction` 을 빌드한 뒤 엔진이 자동으로 쌓는다.

- Form 의 `interaction.type='form_submitted'` → `source: 'presentation_user'`
- Carousel·Table·Chart·Template 의 `interaction.type='button_click' | 'button_continue'` → `source: 'presentation_user'`

쌓는 시점은 `interaction.{ type, data, receivedAt }` payload 가 나오는 때다. 재개 출력의 `status` 값은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 가 정한다.

Presentation 노드가 그린 표시물(`{ config, output }`)은 스레드에 저장하지 않는다. 쌓는 것은 위 `presentation_user` 항목(사용자 인터랙션 `data` 스냅샷)뿐이고, 표시물은 `ai_assistant` 전용 필드인 `presentations[]` 에도 들어가지 않는다. 차단 없이 진행하는 Presentation 노드의 표시물은 실행 중 이벤트(WS, SSE `execution.message`)로만 전달되므로, 영속 스레드를 1차 소스로 쓰는 복원 경로(새로고침·재접속)에는 나오지 않는다. 소비 쪽 서술은 [웹채팅 위젯](../CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) 에 있다. 이것을 스레드에 싣으려면 백엔드 다섯 출처 값이나 항목 필드를 넓혀야 하므로 v2 검토 사안이다.

### AI Agent

| 시점 | 출처 |
|---|---|
| 멀티턴 사용자 메시지 도착(`output.interaction.type='message_received'`) | `ai_user` |
| 멀티턴 매 턴 끝의 최종 어시스턴트 응답(`output.result.response`) | `ai_assistant` |
| 멀티턴 조건 라우팅 때의 어시스턴트 응답(`output.result.response`) | `ai_assistant` |
| 멀티턴 `render_form` 폼 제출 | `presentation_user`(`data.via: 'ai_render'`) |
| 단일 턴 `userPrompt`(resolve 된 값) | `ai_user`(한 번) |
| 단일 턴 최종 `output.result.response` | `ai_assistant`(한 번) |
| 도구 루프 중 어시스턴트와 도구 결과 | `ai_assistant`·`ai_tool`(`includeToolTurns: true` 일 때만) |

AI 에이전트 단일 턴은 LLM 호출 전에 `ai_user` 항목을 쌓는다. LLM 호출이 실패하거나 노드가 취소되면 최종 `ai_assistant` 항목은 쌓지 않는다. 그래서 `ai_user` 항목이 응답 없이 남는다. 도구 기록(`includeToolTurns`)을 켰으면 실패나 취소 전까지 도구 반복에서 쌓은 assistant 항목과 도구 결과 항목도 남는다. 남은 항목의 처리는 [미결 사항](CLE-IX-THREAD.md#미결-사항) 에 있다.

- **정보 추출기 종결 쌓기**: 추출 노드는 단일 턴 최종 응답 뒤와 멀티턴 종결 뒤에 최종 어시스턴트 항목을 한 번 쌓는다([텍스트 변환 규칙](CLE-IX-THREAD-INJECT.md#텍스트-변환-규칙) 의 `information_extractor` 행). 어느 종결 사유에서 쌓는지와 그 이유는 [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) 가 정한다.
- **`ai_user` 쌓는 시점과 실시간 조기 표시**: 위 표의 멀티턴 `ai_user` 는 핸들러(`processMultiTurnMessageInner`)가 쌓으며 시점과 책임은 그대로다. 이와 별개로 엔진은 메시지를 받는 즉시(LLM 호출 전) WS `execution.user_message` 를 내, 실시간 대화 타임라인이 같은 논리적 턴의 `ai_user` 를 낙관적으로 먼저 보여 주게 한다. 맞춤의 권위 출처는 턴 끝의 `execution.ai_message.messages` 스냅샷이다. 새 항목 출처 값은 더하지 않는다. 낙관적 말풍선은 기존 `ai_user` 분기를 쓴다. 변환 계약은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 에 있다.

### 적용 범위

| 동작 | 적용 노드(구현됨) |
|---|---|
| 항목 쌓기 | `ai_agent`(멀티턴 user·assistant, 단일 턴 사용자 프롬프트·최종 assistant) + `text_classifier`·`information_extractor` 최종 assistant |
| 자동 주입(대화 맥락 설정) | `ai_agent`·`text_classifier`·`information_extractor`. 세 노드가 같은 인터페이스(공유 유틸 `shared/conversation-context-injection.ts`)를 쓴다 |
| 자동 메모리 주입(`memoryStrategy`) | `ai_agent`(`summary_buffer`·`persistent`) + `information_extractor`(`persistent` 만). `text_classifier` 는 지원하지 않는다(단일 턴이고 상태가 없어 회수·추출할 대상이 없다) |

쌓기와 주입을 나눠 정의하는 것은 다른 AI 노드의 최종 응답도 뒤따르는 AI Agent 가 스레드로 받게 하려는 것이다. 분류·추출 노드는 의미 있는 최종 시점이 `ai_agent` 와 다르지만(분류기는 카테고리, 추출기는 구조화 데이터) 텍스트 변환 규칙이 노드별로 정해져 세 노드 모두 쌓는다. 노드별 적용 차이의 기준은 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md), 자동 메모리 전략은 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) 와 [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) 가 정한다.

### 제외 설정

노드마다 공통 boolean 설정 `excludeFromConversationThread`(기본 `false`)가 있다. `true` 면 그 노드의 모든 쌓기를 조용히 건너뛴다(`appendInternal` 의 공통 게이트). UI 그룹은 `Conversation Context` 이고, 필드 정의는 세 AI 노드가 펼쳐 부르는 공유 조각 `shared/conversation-context-schema.ts` 의 `buildConversationContextSchemaFields` 가 기준이다.

필드를 선언하는 노드는 AI 세 노드지만 런타임 게이트는 `appendInternal` 단일 진입점에 있어 노드 종류를 가리지 않는다. Presentation 노드처럼 조각을 쓰지 않는 노드도 설정에 값이 있으면 똑같이 건너뛴다(각 스키마가 `passthrough` 라 수동·API 설정이 남는다). Presentation 쪽 서술은 [Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) 에 있다.

### 순번 원자성

`nextSeq` 의 단조 증가는 실행 컨텍스트 하나에서 직렬로 실행된다는 보장에 기댄다. v1 의 메모리·단일 인스턴스 환경에서는 한 실행의 노드 처리가 한 번에 한 노드씩 진행되므로(엔진의 `executeNode` 가 순차) `appendInternal` 의 `seq = thread.nextSeq; thread.nextSeq = seq + 1` 에 경쟁이 없다.

다음 경우에는 따로 보장이 필요하다.

- **Parallel 컨테이너**: 분기들이 같은 스레드에 동시에 쌓을 수 있다. v1 은 Parallel 안의 스레드 사용을 정의하지 않는다. v2 에서 분기별 자식 스레드나 병합 지점 재통합 정책을 정한다.
- **여러 인스턴스·Redis 분산**: 스레드를 Redis 로 옮기면 `INCR` 같은 원자 연산이나 잠금이 필요하다. v1 은 메모리 전용이다.

## 유지 범위

| 컨테이너 | 정책 |
|---|---|
| 서브 워크플로우(`executeInline`) | 부모 스레드를 물려받아 함께 쓴다 |
| Background | 적재 시점의 `turns` 배열까지 복사한 스냅샷. 격리 |
| Loop·ForEach·Map·Parallel | 부모 스레드를 물려받아 함께 쓴다 |

- **서브 워크플로우**: 워크플로우 호출 노드의 동기 `executeInline` 경로는 부모 실행 컨텍스트를 그대로 쓴다(`recursionDepth` 만 늘어남). 그래서 서브 워크플로우 안의 AI Agent 도 부모 스레드를 본다. 격리하려면 비동기 모드로 호출한다(별도 실행, 별도 스레드).
- **Background**: `scheduleBackgroundBody` 가 적재할 때 스레드의 `turns` 배열까지 복사한 스냅샷을 만든다. 최소 `{ ...thread, turns: [...thread.turns] }` 형태다. 참조만 복사하지 않고 새 배열 인스턴스를 만들어, 백그라운드가 새 항목을 쌓아도 메인 스레드의 `turns` 가 바뀌지 않게 한다. 대화 기록 항목 자체는 바뀌지 않으므로 깊은 복사까지는 필요 없다. 그래서 메인 흐름이 이후 만든 항목은 백그라운드가 보지 못하고, 백그라운드 안의 항목은 메인 스레드에 영향이 없다. "백그라운드 실패가 메인 흐름의 실행 상태에 영향을 주지 않는다" 는 격리 원칙([Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md))과 맞는다.
- **컨테이너**: Loop·ForEach·Map 은 별도 실행 컨텍스트를 만들지 않고 같은 `context.nodeOutputCache` 를 함께 쓴다. Parallel 은 병렬 분기마다 실행 컨텍스트의 얕은 복사본을 만들어 `nodeOutputCache` 를 따로 둔다. 엔진은 노드 출력을 루트 컨텍스트에 쓰고 같은 항목을 그 병렬 분기의 사본에도 옮긴다([Parallel 노드](../CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md#실행-로직)). 스레드는 넷 모두 부모 스레드를 함께 쓴다. 얕은 복사라 병렬 분기 컨텍스트도 같은 `conversationThread` 를 가리킨다. 반복 메타(인덱스 등)는 스레드에 자동으로 넣지 않는다. 필요하면 사용자가 `{{ $loop.index }}` 등으로 명시한다.

## 영속화

| 단계 | 저장소 | 비고 |
|---|---|---|
| 실행 중 | 실행 컨텍스트([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)) | `ExecutionContextService.createContext` 가 빈 스레드(`{ id: 'default', nextSeq: 0, turns: [], totalChars: 0 }`)로 시작한다. 재시작이나 다른 인스턴스의 재개 때 `rehydrateContext` 는 메모리의 스레드를 되살릴 수 없으므로, 손실 없는 재개는 아래 park 스냅샷에 기댄다 |
| 입력 대기(park) 진입 | PostgreSQL `Execution.conversation_thread jsonb NULL` | 영속 재개 스냅샷. park 직전(`waitForFormSubmission`·`waitForButtonInteraction`·`waitForAiConversation`)마다 `context.conversationThread` 전체(`runningSummary`·`summarizedUpToSeq` 포함)를 커밋한다. rehydration([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md))이 이 컬럼에서 손실 없이 되살린다. 소비처는 (a) rehydration(내부 무손실 재개), (b) SSE `waiting_for_input` 발행, (c) EIA 상태 조회 `GET /api/external/executions/:id`(읽기 전용) 세 곳이다. (b)·(c) 공개 경로는 `redactThreadForPublic` 로 가린다 |
| 실행 뒤(내역 화면) | 노드 실행에 흩어진 저장 | `output.interaction`(Presentation, `form_submitted`·`button_click`·`button_continue`), `output.result.messages`(AI 멀티턴 누적, 대기·재개 때), `output.result.response`(AI 최종 응답)가 실행 내역 화면의 기준이다. 이 경로의 스레드 보기는 다시 만들 수 있는 파생 보기이고, 영속 재개 스냅샷과 목적·소비처가 다르다 |
| WS payload | `execution.waiting_for_input` 에 `conversationThread` 스냅샷을 선택적으로 함께 싣는다 | UI 가 실시간 스레드를 보여 줄 수 있다 |

- **저장 상한**: 스레드는 최대 `STORAGE_MAX_TURNS`(500) 항목을 보관한다. 넘으면 가장 오래된 항목부터 버린다(FIFO). 버려도 `nextSeq` 는 줄지 않는다.
- **rehydration 방어 정규화**: park 스냅샷 복원은 `rehydrateConversationThread`(`conversation-thread.types.ts`) 한 진입점이 한다. 원본 jsonb 를 그대로 믿지 않고 방어적으로 정규화한다. (a) 손상된 항목은 건너뛴다(`seq` 는 음이 아닌 정수, `source` 는 enum, `text` 는 문자열인지 최소 검증). (b) `totalChars` 를 살아남은 항목으로 다시 계산한다. (c) `nextSeq` 는 저장값이 `turns.length` 이상이면 그대로 두고(버린 뒤에도 줄지 않는 불변식), 모자라거나 손상됐으면 `turns.length` 로 다시 정한다. (d) `runningSummary` 가 `MAX_RUNNING_SUMMARY_CHARS`(20,000)를 넘으면 자른다(비정상 DB 값의 프롬프트 주입·토큰 과소비 방어). 정상 jsonb 왕복에서는 손실이 없고, 정규화는 손상·어긋남에 대한 안전망이다.
- **자동 메모리 전략의 영속 경로**: `runningSummary`·`summarizedUpToSeq` 는 스레드의 일부라 park 스냅샷에 함께 커밋되고, 재시작이나 다른 인스턴스 재개 때 스레드와 함께 되살아난다. `persistent` 전략의 세션 간 영속 메모리는 스레드가 아닌 별도 테이블 `agent_memory`([에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md))에 저장된다. 대화 스레드와 분리된 저장소라 이 규약과 독립이다.
- 컬럼 정의는 [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md), 커밋 절차는 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md), 공개 노출 정책은 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) 와 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.

## 구현 위치

- `codebase/backend/src/modules/execution-engine/conversation-thread/**` (`conversation-thread.service.ts` 의 `appendInternal`·`STORAGE_MAX_TURNS`)
- `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` (`rehydrateConversationThread`·`DEFAULT_THREAD_ID`)
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` (상태 조회의 스레드 싣기)
- `codebase/backend/src/nodes/ai/text-classifier/text-classifier.handler.ts` (`pushClassifierTurn`), `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` (`pushExtractorTurn`·`pushExtractorTurnTo`)
- 전체 목록은 상위 문서 [대화 스레드](CLE-IX-THREAD.md) 의 「구현 위치」에 있다.

## Rationale

### 입력 대기 때 스레드를 실행 행에 저장한다

영속화의 "새 DB 컬럼 없음" 전제를 영속 park 재개에 한해 바꿔 `Execution.conversation_thread jsonb NULL` 컬럼을 새로 뒀다. park 직전 `context.conversationThread` 전체 스냅샷을 이 컬럼에 커밋하고 rehydration 이 여기서 손실 없이 되살린다.

- **풀려는 어긋남**: 실행 엔진과 이 규약은 rehydration 이 대화 스레드를 되살린다고 약속했으나, 실제 구현(`rehydrateContext`)은 빈 스레드(`createEmptyConversationThread()`)로 되돌려 park 뒤 재시작이나 다른 인스턴스 재개 때 스레드·`runningSummary`·멀티턴 누적이 사라졌다. 프로세스 안 실행 컨텍스트는 Redis 영속이 없어 재개하는 인스턴스가 되살릴 매체가 없었다. 이 컬럼이 그 매체를 준다.
- **실행 수준 컬럼 하나인 이유**: v1 스레드는 실행당 하나(`id: 'default'`)라 실행 범위 컬럼이 자연스럽다. 노드 실행에 흩어 저장하면 교차 노드 조회가 N+1 이다. park 마다 "지금 스레드 전체" 를 한 행에 덮어쓰면 마지막 쓰기가 곧 최신 스냅샷이라 재개 로드가 단순하다(O(1)).
- **기각한 대안: 컬럼 없이 파생 보기로 다시 만들기**: rehydration 이 노드 실행 저장(`output.interaction`·`output.result.messages`)에서 스레드를 다시 만드는 안이다. 여러 노드의 Presentation·AI 항목을 정확한 `seq`·timestamp·출처로 끼워 맞추는 정책은 실행 내역 보기용으로 v2 UI(EH-DETAIL-12)에 넘긴 미해결 과제다. `runningSummary`·`summarizedUpToSeq` 같은 스레드 메타는 노드별 출력에 저장되지 않아 손실 없이 되살릴 수 없다. 직접 스냅샷이 손실 없고 단순하다. 내역 화면용 파생 보기는 소비처가 달라 그대로 둔다.
- **"새 컬럼 없음" 원칙과의 관계**: 옛 원칙은 실행 내역 재구성에는 노드별 저장으로 충분하다는 판단이었고, 영속 재개 요구는 다루지 않았다. 이 컬럼은 채워지지 않았던 요구(손실 없는 재개)를 위한 별도 매체라 원칙을 뒤집지 않고 적용 범위를 나눈다.
- **공개 조회에 싣는 소비처가 늘었다(2026-07-09)**: EIA 상태 조회가 입력 대기일 때 이 스냅샷을 `context.conversationThread` 에 읽기 전용으로 싣는다. 임베드 웹채팅 위젯의 새로고침 기록 복원을 5분 SSE 버퍼나 서버 재시작과 관계없이 지원하려는 것이다([EIA 수신 API와 SSE](CLE-EIA-INBOUND.md)). 이미 SSE `waiting_for_input` 으로 공개 중인 데이터를 REST 로 다시 싣는 것이라 새 민감 표면이 아니다. 노드 핸들러가 항목 텍스트에 민감한 중간 결과를 남기지 않는다는 제약은 그대로이고, 이 불변식은 SSE 발행과 상태 조회가 함께 쓰는 `redactThreadForPublic` 가 출구에서 강제한다. 자유 텍스트(`turns[].text`·`runningSummary`)와 구조화 필드(`turns[].data`·`presentations[].payload` 는 깊은 가리기, `toolCalls[].arguments` 는 JSON 을 깨지 않는 가리기)를 가린다. 적용 범위의 기준은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이다.
