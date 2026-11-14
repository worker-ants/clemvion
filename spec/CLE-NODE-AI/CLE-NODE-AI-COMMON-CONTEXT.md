---
id: "CLE-NODE-AI-COMMON-CONTEXT"
title: "AI 노드 공통 — 대화 맥락 · 메모리 · 시스템 컨텍스트"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-AI-COMMON"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI", "CLE-NODE-AI-COMMON"]
area: "CLE-NODE-AI"
content_hash: "31301265d5c020be483ad81f374ad8e548b3b1e6587f921138031eb89c5489f3"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "4e2d14811e2a6a8d86cb65946d295a8dbdf2c9205b4ae96b8641494d35a80123"
etag: "sha256-7f9428b902f39ceb3f3ce8f9849c15bbd849c5aceae432a5a04054d096c6f1a3"
---
## 개요

이 문서는 [AI 노드 공통](CLE-NODE-AI-COMMON.md) 의 하위 문서로 세 AI 노드의 대화 맥락 설정, 메모리 전략, 시스템 컨텍스트 접두와 시스템 프롬프트 조립 순서를 정한다.

## 대화 맥락 설정

세 AI 노드는 모두 대화 스레드(`ConversationThread`)에 최종 assistant 응답을 누적(push)하고, 대화 맥락 설정(Conversation Context, `contextScope`)에 따라 스레드를 LLM 입력에 자동 주입(inject)한다. 누적은 핸들러의 `pushClassifierTurn`·`pushExtractorTurn` 등이, 주입은 공유 유틸 `shared/conversation-context-injection.ts` 가 맡는다. 누적과 주입의 적용 범위 차이, 노드별 최종 assistant 텍스트 변환 규칙은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 에서 정한다.

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `contextScope` | `none` / `thread` / `lastN` | ✓ | `none` | 자동 주입할 스레드 범위 |
| `contextScopeN` | Integer | `lastN` 일 때 | `20` | `lastN` 일 때 최근 N개 턴 |
| `contextInjectionMode` | `messages` / `system_text` | 범위가 `none` 이 아닐 때 | `messages` | 주입 형식. LLM messages 배열 앞에 붙이거나 시스템 프롬프트 텍스트에 붙인다 |
| `includeToolTurns` | Boolean | | `false` | `ai_tool` 턴(지식 저장소·MCP·조건 결과)도 스레드에 누적할지. 자동 메모리 전략이면 주입 쪽에서는 무효지만 누적은 전략과 무관하게 유지한다 |
| `excludeFromConversationThread` | Boolean | | `false` | 이 노드의 user·assistant 턴을 스레드에서 뺀다(opt-out) |

- 기본값 `contextScope: 'none'` 이라 기존 워크플로우는 영향이 없다.
- 세 노드가 5필드를 같은 인터페이스로 쓴다. 스키마는 공유 조각 `buildConversationContextSchemaFields()`(`shared/conversation-context-schema.ts`), 주입은 공유 유틸 `injectConversationContext()` 를 쓴다.
- 주입 시점은 노드마다 다르다. AI 에이전트 멀티턴은 매 턴 다시 주입한다. 정보 추출기 멀티턴은 첫 진입 때 한 번 주입하고 이후 턴은 `_resumeState.messages` 로 운반한다. 텍스트 분류기는 분류 LLM 호출 직전에 주입한다.
- 주입 위치·messages 매핑·길이 상한·영속화·로드맵은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 가 단일 기준이다.

## 메모리 전략

메모리 전략(`memoryStrategy`)은 대화 맥락을 어떻게 관리할지 정한다. 대화 맥락 설정이 "어느 범위를 넣을지" 라면 메모리 전략은 "어떻게 관리할지" 다.

| 노드 | 값 | 기본값 |
|------|----|--------|
| AI 에이전트 | `manual` / `summary_buffer` / `persistent` | `manual` |
| 정보 추출기 | `manual` / `persistent` | `manual` |
| 텍스트 분류기 | 필드 없음. 늘 `manual` 처럼 대화 맥락 설정만 적용 | 없음 |

- `manual` 은 대화 맥락 설정 필드를 그대로 쓴다.
- `summary_buffer` 는 한 실행 안에서 토큰 예산을 넘으면 오래된 턴을 롤링 요약(`runningSummary`)으로 줄인다. AI 에이전트만 쓴다. 정보 추출기는 짧은 수집 대화라 요약 이득이 없어 이 값이 없다.
- `persistent` 는 AI 에이전트에서 롤링 요약에 에이전트 메모리 회수·추출을 더한다. 정보 추출기에서는 회수와 추출만 쓴다. 정보 추출기와 AI 에이전트는 같은 메모리 범위 키 규칙을 써서 같은 키면 메모리를 공유한다.
- 텍스트 분류기는 단일 턴이고 상태가 없어 자동 메모리 대상이 아니다.

범위 필드 4개(`contextScope`·`contextScopeN`·`contextInjectionMode`·`includeToolTurns`)는 `manual` 일 때만 유효하다. 자동 전략이 맥락 구성을 대신하기 때문이다. `excludeFromConversationThread` 는 스레드 누적 opt-out 이라 전략과 무관하게 유효하다. 설정 화면은 `gateOnManualMemoryStrategy` 가드로 자동 전략일 때 대화 맥락 필드 5개를 모두 숨겨 opt-out 을 설정할 방법이 없다. [미결 사항](CLE-NODE-AI-COMMON.md#미결-사항) 참조.

노드별 메모리 필드는 다음과 같다. 값의 의미와 기본값은 각 노드 문서가 정한다.

| 필드 | AI 에이전트 | 정보 추출기 |
|------|:---:|:---:|
| `memoryTokenBudget` | ✓ | |
| `memoryKey` | ✓ | ✓ |
| `memoryTopK` | ✓ | ✓ |
| `memoryThreshold` | ✓ | ✓ |
| `memoryTtlDays` | ✓ | ✓ |
| `embeddingModelConfigId` | ✓ | ✓ |
| `summaryModelConfigId` | ✓ | |
| `extractionModelConfigId` | ✓ | ✓ |

롤링 요약 동작과 실행 단계 배치는 [AI 에이전트 노드](CLE-NODE-AGENT.md), 정보 추출기의 회수·추출 시점은 [정보 추출기 노드](CLE-NODE-EXTRACTOR.md), 에이전트 메모리의 저장·범위 키·추출·회수는 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) 가 정한다.

## 시스템 컨텍스트 접두

세 AI 노드는 시스템 프롬프트 앞에 현재 시각과 시간대 같은 실행 환경 정보를 자동으로 붙인다. 이를 시스템 컨텍스트 접두(`includeSystemContext`)라 부른다. LLM 이 "최근 7일", "오늘 자정", "어제 미발송" 같은 시각 추론을 할 때 시간대가 모호해 9시간 틀리는 회귀를 미리 막는다.

대화 맥락 설정과는 뜻이 다르다. 대화 맥락 설정은 과거 턴의 user·assistant 메시지를 messages 배열이나 시스템 프롬프트 끝에 붙인다. 시스템 컨텍스트 접두는 지금 시각과 시간대를 시스템 프롬프트 앞에 한 묶음으로 붙인다.

### 설정 필드

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `includeSystemContext` | Boolean | | `true` | 접두를 켤지. `false` 면 사용자 시스템 프롬프트만 LLM 에 보낸다 |
| `systemContextSections` | String[] | | `['time', 'timezone']` | 접두에 넣을 섹션. 허용 값은 `time`·`timezone`·`workspace`·`node`. 빈 배열은 `includeSystemContext: false` 와 같다 |

- 기본값이 켜짐이라 기존 워크플로우의 LLM 호출에도 시각·시간대 줄이 붙는다. 토큰 비용은 약 30토큰이다. 응답이 달라질까 걱정되는 워크플로우는 명시적으로 `false` 로 끄거나 섹션을 줄인다.
- 기존 행 해석: 이 필드가 생기기 전에 저장한 워크플로우는 설정에 두 필드가 없다. 백엔드는 두 필드가 없으면 기본값(`true`, `['time', 'timezone']`)으로 해석한다. DB 마이그레이션으로 `false` 를 박지 않는다. 회귀가 걱정되는 워크플로우만 사용자가 알고 끈다.

### 섹션별 내용

| 섹션 | 출력 한 줄 | 데이터 출처 |
|---|---|---|
| `time` | `Current time: <ISO8601 with TZ>` | `$now`(실행 단위로 고정, UTC). 접두 본문은 아래 시간대로 바꾼 ISO 값 |
| `timezone` | `Timezone: <IANA name> (UTC<offset>)` | 아래 "시간대 결정 순서" |
| `workspace` | `Workspace: <name> (id: <uuid>)` | `context.workspace.{id, name}` |
| `node` | `Node: <nodeLabel> (type: <nodeType>, id: <nodeId>)` | `context.currentNode.{id, label, type}` |

기본 섹션으로 KST 워크스페이스에서 만든 접두 예시:

```text
## System Context
- Current time: 2026-05-18T12:45:12+09:00
- Timezone: Asia/Seoul (UTC+9)
```

UTC 워크스페이스의 접두 예시:

```text
## System Context
- Current time: 2026-05-18T03:45:12Z
- Timezone: UTC
```

### 시간대 결정 순서

접두의 시간대는 다음 순서로 정한다.

1. 워크스페이스 설정 `Workspace.settings.timezone`(IANA). 워크스페이스 설정의 필수 항목이다(원본: NAV-SC-06, [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)).
2. 서버 기본값 `process.env.TZ`(배포 환경 변수).
3. `UTC`.

각 단계의 IANA 이름은 `Intl.DateTimeFormat(...).resolvedOptions().timeZone` 으로 검증한다. 검증에 실패하면 다음 단계로 넘어간다. UTC offset 은 `$now` 시점 기준이다. DST 가 있는 시간대는 실행 시점의 offset 을 쓴다.

스케줄의 시간대는 cron 발화 기준이며 이 접두와 별개로 정한다([스케줄](../CLE-TRIG/CLE-TRIG-SCHEDULE.md)). AI 에이전트가 스케줄 트리거로 실행돼도 접두의 시간대는 워크스페이스 설정을 따른다.

### 시스템 프롬프트 조립 순서

시스템 프롬프트의 최종 본문은 다음 순서로 조립한다. 이 순서의 단일 기준은 이 절이다. 대화 스레드 주입의 책임은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md), 노드별 실행 단계는 각 노드 문서가 다룬다.

1. 시스템 컨텍스트 접두 ([시스템 컨텍스트 접두](#시스템-컨텍스트-접두))
2. 사용자 시스템 프롬프트
3. 지식 저장소 도구 안내 `KB_TOOL_GUIDANCE` (지식 저장소가 있을 때)
4. 조건 suffix (조건이 있을 때)
5. 메모리·스레드 주입 (안정 프리픽스)
    - 5a. 에이전트 메모리 회수 블록 (`memoryStrategy='persistent'` 일 때. `agent_memory` top-k 회수 결과)
    - 5b. 롤링 요약 블록 (`memoryStrategy ∈ {summary_buffer, persistent}` 일 때. `runningSummary`)
    - 5c. `manual` 스레드 주입 (`memoryStrategy='manual'`, `contextScope ≠ 'none'`, `contextInjectionMode='system_text'` 일 때만)
6. (휘발성 꼬리) 압축하지 않은 최근 원문 턴. 안정 프리픽스 1~5 보다 뒤에 둔다

- 5a·5b 는 휘발성 최근 턴(6)보다 앞에 두고 임계치에 닿을 때만 갱신해 prompt cache 접두사 안정성을 지킨다. messages 모드에서는 최근 원문 턴(6)만 messages 배열 앞에 붙이고, 5a·5b 는 여전히 system_text 안정 프리픽스에 둔다.
- messages 모드의 `manual` 스레드 주입은 시스템 프롬프트가 아니라 messages 배열 앞에 붙이므로 5c 가 적용되지 않는다.
- `includeSystemContext: false` 면 1단계만 건너뛰고 나머지 순서는 유지한다.
- 1단계는 늘 맨 앞이다. 사용자 시스템 프롬프트가 시각 정보를 덮어쓰지 못하게 하기 위해서다. 시각을 다르게 넣고 싶으면 접두 뒤 본문에서 명시한다.
- 멀티턴 후속 턴에서도 접두는 시스템 프롬프트 앞에 유지한다. `$now` 가 실행 단위로 고정이라 턴마다 다시 계산해도 값이 같다.
- 현재 구현은 조건 suffix(4) 뒤에 표시 도구 안내 `PRESENTATION_TOOLS_GUIDANCE` 를 붙인다(표시 도구가 있을 때). 이 순서는 위 목록에 정식으로 올라 있지 않다.

### 토큰 비용

- 기본(`['time', 'timezone']`): 약 30토큰
- 전체(`['time', 'timezone', 'workspace', 'node']`): 약 60~80토큰
- `meta.inputTokens` 에 그대로 더한다. 별도 회계 필드는 없다.

### Cafe24 등 MCP 도구와의 관계

이 접두와 Cafe24 도구 description 자동 suffix([Cafe24 operation 메타데이터](CLE-C24-META))는 서로 보완한다.

- 시스템 프롬프트 접두: "어제 자정" 같은 일반 시각 추론의 기준
- 도구 description suffix: 특정 도구 인자(예: `since` 필드)가 어느 시간대인지

두 채널이 맞으면 LLM 은 `$now`(UTC), 접두(워크스페이스 시간대), Cafe24 도구(KST) 사이 변환을 정확히 한다. 한 채널만 있어도 동작은 하지만 두 채널을 함께 노출하는 편이 회귀 위험이 가장 작다.

### 설정 에코

두 필드(`includeSystemContext`·`systemContextSections`)는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 7 의 설정 에코 대상이다. 단 기본값과 같으면 뺀다. 사용자가 명시적으로 바꾼 경우에만 `config` 에 나온다. 각 노드의 출력 구조 표가 이를 따른다.

## 구현 위치

- `codebase/backend/src/nodes/ai/shared/system-context-prefix.ts` (시스템 컨텍스트 접두)
- `codebase/backend/src/nodes/ai/shared/conversation-context-injection.ts` (대화 맥락 주입 공유 유틸)
- `codebase/backend/src/nodes/ai/shared/conversation-context-schema.ts` (대화 맥락 설정 공유 스키마 조각)

## Rationale

### 시스템 컨텍스트 접두를 기본으로 켠 이유

**문제**: 세 AI 노드 어디에도 LLM 에게 지금 시각과 시간대를 자동으로 알려 주는 경로가 없었다. 사용자는 시스템 프롬프트에 `"오늘은 {{ $now }}"` 같은 표현식을 직접 넣어야 했다. 그마저 `$now` 가 UTC ISO8601 이라([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)) KST 사용자가 모르는 사이 9시간 어긋난 추론을 받을 수 있었다.

**결정**: 시스템 프롬프트 앞에 `Current time` 과 `Timezone` 을 자동으로 붙인다. 기본으로 켜고, 섹션 단위로 끌 수 있게 하고, 세 노드 공통 규약으로 둔다.

- 기본 섹션은 `['time', 'timezone']` 로 최소한만 넣는다. 워크스페이스·노드 정보는 디버깅 용도라 opt-in 이다.
- 시각 정보는 LLM 추론의 일반적인 접두 패턴이고 비용도 약 30토큰으로 작다. 그래서 opt-in 이 아니라 기본 켜짐으로 두어 시각 정보 누락 회귀가 쌓이지 않게 한다.
- suffix 가 아니라 prefix 인 이유는 사용자 시스템 프롬프트의 마지막 지시(`"답변은 JSON 으로"` 등)가 묻히지 않게 하기 위해서다.
- 노드별 필드가 아니라 공통 규약 한 곳에 정의한 이유는 세 노드가 같은 맥락을 필요로 해 정의가 어긋나는 것을 막기 위해서다.
- Cafe24 도구 description 자동 suffix 와 한 묶음으로 결정했다([Cafe24 등 MCP 도구와의 관계](#cafe24-등-mcp-도구와의-관계)).
- 기존 워크플로우는 설정에 필드가 없으면 기본값으로 해석한다. DB 마이그레이션으로 `false` 를 박지 않고, 회귀가 걱정되는 워크플로우만 사용자가 알고 끈다.

### 대화 스레드를 1급 객체로 들이고 자동 주입한 이유

**문제**: AI 에이전트는 두 가지 맥락 격리에 갇혀 있었다.

1. Presentation 노드의 사용자 입력을 자동으로 알지 못했다. 사용자는 매번 `{{ $node["Form1"].output.interaction.data.email }}` 같은 식을 시스템 프롬프트에 직접 적어야 했다.
2. AI 에이전트 뒤에 또 AI 에이전트가 있으면 두 번째 노드가 첫 번째 노드의 멀티턴 messages 를 보지 못했다. `stripControlFields()` 가 `_resumeState` 를 지워 최종 응답 텍스트만 넘어갔다.

**결정**: 대화 스레드 모델을 1급 객체로 들인다. Presentation 입력과 AI 대화 턴을 한 스레드로 합치고, 노드 설정으로 자동 주입하며, messages·system_text 형식을 고르게 한다. 표현식 설탕(`$conversation`)이나 messages 노출 뒤 명시 주입하는 방식은 사용자가 매번 표현식으로 결합해야 하고, 텍스트로 요약하면 구조가 사라진다. 대화 스레드 모델은 실제 대화 흐름을 보존하고 자동으로 주입한다.

처음(v1) 경계는 단일 스레드, 문자 기반 길이 상한, 메모리 + NodeExecution 분산 저장(실행 내역) + `Execution.conversation_thread` durable park 스냅샷이었다. 자동 주입은 AI 에이전트만 했고 누적은 세 노드 모두 했다. 이후 텍스트 분류기와 정보 추출기 자동 주입이 채택돼 지금은 세 노드 모두 주입한다. 다중 스레드와 실행 내역 화면의 노드 간 스레드 뷰 재구성은 로드맵으로 남아 있고 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 에서 정한다.

### `conversationHistory` 필드를 지운 이유

옛 `conversationHistory: 'none' | 'last_n' | 'full'` 과 `historyCount` 필드는 스키마와 문서 표에 정의돼 있었지만 핸들러가 한 번도 읽지 않았다. 의도한 동작("이전 N개 대화 이력 보관")은 멀티턴 자체 messages 배열로 늘 누적됐으므로 사실상 아무 일도 하지 않았다. 대화 스레드를 들이면서 `contextScope`·`contextScopeN` 으로 완전히 바꿨고, 스키마·UI 메타·기본값 초기화 로직까지 모두 지웠다. 스키마가 `.passthrough()` 라 DB 의 옛 워크플로우 데이터에 두 키가 남아 있어도 조용히 통과한다.

### 메모리 전략을 `contextScope` 확장이 아니라 별도 필드로 둔 이유

**문제**: 자동 메모리(`summary_buffer`·`persistent`)를 들일 때 기존 `contextScope` enum 에 `auto` 값을 끼워 넣는 안이 자연스러워 보였다. 드롭다운 하나만 늘리면 되기 때문이다.

**결정**: 별도 1급 필드 `memoryStrategy` 를 둔다. `contextScope` 는 어느 범위의 스레드 턴을 넣을지(범위)이고, `memoryStrategy` 는 메모리를 어떻게 관리할지(관리)라 뜻이 다르다. enum 에 `auto` 를 섞으면 세 가지 문제가 생긴다. 한 필드에 두 뜻이 얽혀 설정 에코와 화면 `visibleWhen` 규칙이 서로 의존하게 된다. `auto` 일 때 `contextScopeN`·`contextInjectionMode`·`includeToolTurns` 의 뜻이 모호해진다. 하위 호환 에코가 복잡해진다. 별도 필드면 `manual`(기본) 경로가 기존 동작을 그대로 보존해 하위 호환 위험이 없고, 자동 전략은 직교 축으로 더해지며, `visibleWhen` 은 전략 값만 보면 된다. `manual` 이라는 단어가 `Trigger.type: 'manual'` 과 겉보기로 겹치지만 이름공간이 달라 뜻이 분명한 쪽을 택했다.

### 요약·회수 블록을 안정 프리픽스에 두는 순서

**문제**: 롤링 요약 블록과 에이전트 메모리 회수 블록을 LLM 입력 어디에 둘지 정해야 했다. messages 배열 안(휘발성 영역)과 시스템 프롬프트 안정 프리픽스 중 하나다.

**결정**: 둘 다 system_text 안정 프리픽스에 두고, 압축하지 않은 최근 원문 턴만 휘발성 꼬리로 둔다. prompt cache 는 접두사가 안정해야 맞는다. 매 턴 바뀌는 최근 원문이 앞에 오면 캐시가 매번 깨진다. 요약·회수 블록을 안정 프리픽스에 두고 임계치에 닿을 때만 갱신하면(매 턴 재요약·재회수 금지) 프리픽스가 오래 유지돼 캐시 적중이 가장 커진다. 이 결정이 스레드 주입 단계 안에 "요약·회수 블록(안정) → 최근 원문 턴(휘발성)" 의 하위 순서를 더했다.
