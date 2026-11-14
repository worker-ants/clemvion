---
id: "CLE-AI-MEMORY-PIPELINE"
title: "에이전트 메모리 — 추출 · 회수 · 정리"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-AI-MEMORY"
ancestors: ["CLE-VISION", "CLE-AI", "CLE-AI-MEMORY"]
area: "CLE-AI"
content_hash: "66350aabdf2d80eecda0685788f1f1dcb1825036f2c4ea51b77a5c12e1755781"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "017400baa4f302b3719e5395b8aaa9e56509bae2b0307a417c1b2812e7c04078"
etag: "sha256-d1812e8f357d63b8bcd5353a222988ed1a03697f25e3fa663ff5de163ac97f15"
---
## 개요

이 문서는 [에이전트 메모리](CLE-AI-MEMORY.md) 의 하위 문서로 `persistent` 전략의 메모리 추출(턴 경계 큐 넣기 · 증분 추출 · 메모리 종류 · 추출 큐), 메모리 회수와 주입 경계, 의미 기반 중복 갱신 · TTL 만료 · 메모리 정리를 정한다. 테이블 `agent_memory` 컬럼 · 인덱스, 메모리 범위 키와 정규화, 격리는 상위 문서가 정한다.

## 메모리 추출

`persistent` 전략에서는 턴 경계마다 직전 대화에서 기억할 사실·선호를 LLM 으로 뽑아 `agent_memory` 에 저장한다. 이 작업은 백그라운드에서 비동기로 한다.

- **호출 시점**: AI 에이전트 노드는 단일 턴이면 최종 응답을 대화 스레드에 넣은 직후, 멀티턴이면 턴마다 assistant 응답을 넣은 직후에 공유 헬퍼 `scheduleMemoryExtraction` 을 부른다. 정보 추출기 노드의 멀티턴은 종결 때 한 번만 부른다([정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md)).
- **응답 경로 비차단**: 핸들러는 큐에 넣기까지만 기다리고 추출 LLM 호출은 worker 에서 한다. 회수만 동기이고 추출은 비동기다.
- **스냅샷 격리**: 기존 `scheduleBackgroundBody` 계열 백그라운드 처리 방식을 따른다. 대화 기록 항목 스냅샷을 shallow-copy 로 떼어 넘기므로 뒤이은 메인 루프의 변경이 백그라운드 작업에 스며들지 않는다.
- **추출 LLM**: 노드 설정 `extractionModelConfigId` 가 가리키는 Chat 모델 설정을 쓴다. 지정하면 그 설정의 프로바이더·자격 증명·기본 모델로 부르므로 노드의 메인 LLM 과 독립이다(다른 프로바이더의 저렴한 모델도 된다). 폴백 순서는 `extractionModelConfigId` 설정 → `llmConfigId` → `model` → `llmConfig.defaultModel` 이다(`llmConfigId` 가 없으면 워크스페이스 기본 Chat 설정). 추출은 메인 추론보다 단순해서 저렴한 설정을 지정하면 비용을 줄일 수 있다. 필드 결정 이력은 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 에서 정한다.
- **추출 호출**: worker 는 `buildExtractionTranscript(turns)` 로 user·assistant 항목만 남기고(system·tool 제외) `EXTRACTION_SYSTEM_PROMPT` 와 함께 `LlmService.chat` 을 temperature 0, JSON 응답으로 부른다. 추출 모델이 Anthropic 이면 temperature 를 보내지 않으므로 프로바이더 기본값으로 동작한다([LLM 클라이언트 「Anthropic 에 샘플링 파라미터를 보내지 않는다」](CLE-AI-LLM.md#anthropic-에-샘플링-파라미터를-보내지-않는다-2026-11-12)). 이 호출은 사용량을 쌓고 사용량 귀속은 비운다([LLM 사용량 기록](CLE-AI-USAGE.md)).
- **임베딩 설정**: 저장 임베딩과 회수 임베딩은 반드시 같은 설정(같은 모델·차원·엔드포인트)을 써야 한다. 다르면 cosine 검색이 무의미해지거나 400 에러가 난다. 어느 모델 설정을 쓰는지는 정의가 갈린다. [미결 사항](CLE-AI-MEMORY.md#미결-사항) 참조.
- **저장 형태**: 추출한 사실·선호 하나를 `content` 로, 그 임베딩을 `LlmService.embed`(`inputType='document'`)로 만들어 메모리 범위 키와 함께 저장한다. 메모리 종류는 `metadata.kind` 로 나눈다. 지식 저장소와 같은 `LlmService.embed` 경로를 쓴다.
- **지시문 저장 차단**: 저장(`saveMemories`) 전에 명백한 지시문 패턴에 걸리는 항목은 저장하지 않고 버린다(경고 로그). 패턴은 결정적 정규식 목록이다(예: ignore/disregard previous, you are now, system prompt, new instructions:, "이전 지시 무시"). 명백한 패턴만 걸러 정상 사실·선호를 잘못 막는 일을 줄인다. 이 필터는 보조 방어다([메모리 주입 경계](#메모리-주입-경계)).
- **빈 결과**: 추출 결과가 빈 배열이거나 대화 기록이 비면 아무것도 하지 않는다.
- **실패**: 추출 LLM 호출이 실패하면 throw 하고 BullMQ 기본 재시도에 맡긴다. 응답 경로와 떨어진 경로라 응답 지연에 영향이 없다.

### 추출 흐름

```mermaid
sequenceDiagram
  autonumber
  participant H as AI 노드 핸들러
  participant Svc as AgentMemoryService
  participant Q as agent-memory-extraction 큐
  participant P as 추출 processor
  participant Lc as LLM chat
  participant Le as LLM embed
  participant PG as agent_memory

  H->>H: 추출 기준점 뒤 대화 기록 항목만 스냅샷
  H->>Svc: scheduleExtraction(범위 키, 모델 설정, turns, ttlDays)
  Svc->>Q: add(extract, payload + enqueueNonce, jobId 고정)
  Svc-->>H: 수락 여부 (수락됐을 때만 추출 기준점 전진)
  Q-->>P: 작업 전달 (concurrency 2)
  P->>Lc: 추출 프롬프트 + 대화 기록 (temperature 0 · Anthropic 제외, JSON)
  Lc-->>P: [{ content, kind }]
  P->>Svc: saveMemories(항목, ttlDays)
  Svc->>Svc: 지시문 패턴 필터
  Svc->>Le: embed(contents, document)
  Svc->>PG: 유사 행 갱신 또는 새 행 추가 (한 트랜잭션)
  Svc->>PG: 만료 행 삭제와 범위당 1000건 정리
```

### 증분 추출

멀티턴은 턴마다 대화 스레드 전체를 다시 추출하지 않고, 직전 추출 뒤에 새로 쌓인 대화 기록 항목만 추출한다. 추출 기준점(`lastExtractionTurnSeq`)은 직전 추출이 다룬 마지막 대화 기록 항목의 `seq` 다. 멀티턴 재개 상태(`_resumeState`)에 영속한다. 저장 키 경로는 정의가 갈린다. [미결 사항](CLE-AI-MEMORY.md#미결-사항) 참조.

- 턴 경계마다 `seq > 추출 기준점` 인 항목만 스냅샷해 큐에 넣고, 수락되면 스냅샷의 최대 `seq` 로 기준점을 전진시킨다.
- 새 항목이 없으면 큐에 넣지 않고 기준점도 그대로 둔다.
- 큐가 작업을 버렸거나(같은 범위의 작업이 진행 중) 큐에 넣다 실패하면 기준점을 그대로 둔다. 그 항목들은 다음 턴 경계에서 다시 추출 대상이 되므로 잃지 않는다.
- 단일 턴은 한 번만 추출하므로 기준점과 상관없이 대화 기록 전체를 스냅샷한다.

아래 그림은 추출 기준점의 전이를 보여 준다.

```mermaid
stateDiagram-v2
  [*] --> 기준점없음: 단일 턴 또는 첫 추출
  기준점없음 --> 기준점N: 큐 수락, 스냅샷 최대 seq 로 설정
  기준점N --> 기준점M: 다음 턴, seq 가 N 보다 큰 항목 수락
  기준점N --> 기준점N: 작업 버림, 큐 실패, 새 항목 없음
```

### 메모리 종류

추출 프롬프트는 항목마다 `{content, kind}` JSON 객체를 돌려주게 한다. 메모리 종류(`metadata.kind`)는 `fact`·`preference`·`entity` 이고 화면 라벨은 사실·선호·엔티티다. 지식 저장소 Graph RAG 의 Entity 와 다르다.

- 파서는 객체 `{content, kind}` 와 문자열(예전 형태)을 모두 받는다.
- kind 가 없거나 지원하지 않는 값이면 `fact` 로 둔다.
- 분류 값은 `metadata.kind` 로 저장해 회수와 화면에서 사실·선호·엔티티를 나눈다.

### 추출 큐

추출은 전용 BullMQ 큐 `agent-memory-extraction`(worker concurrency 2)에서 돈다. 큐 전체 목록은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 에서 정한다.

| 항목 | 값 |
|------|----|
| producer | `AgentMemoryService.scheduleExtraction`(AI 에이전트·정보 추출기 핸들러가 턴 경계에 부른다) |
| consumer | `AgentMemoryExtractionProcessor` (concurrency 2) |
| payload | `{ workspaceId, scopeKey, llmConfigId?, model?, extractionModelConfigId?, embeddingModelConfigId?, turns[{source,text,nodeLabel}], ttlDays?, enqueueNonce }` |
| jobId | `agent-memory:<workspaceId>:<scopeKey>` 고정 |
| 완료 작업 | `removeOnComplete: true` |
| 등록 | `agent-memory.module.ts` |

- **범위 단위 직렬화**: 동시성 제한 단위는 메모리 범위다. jobId 를 고정해 같은 범위의 추출이 동시에 돌지 않게 BullMQ 가 중복을 막는다([Rationale](#전용-큐와-범위-단위-직렬화로-정한-이유)).
- **작업 버림과 수락 계약**: 같은 범위의 작업이 대기·실행·지연 중이면 새 작업은 버려진다. 서비스는 `enqueueNonce` 가 다른 것으로 이를 검출해 `scheduleExtraction` 에서 `false` 를 돌려주고, 호출하는 쪽은 추출 기준점을 전진시키지 않는다.
- **완료 즉시 삭제**: 완료 작업을 남기면 jobId 중복 방지가 완료 작업에도 걸려 같은 범위의 모든 새 작업이 영원히 버려진다. 그러면 추출 기준점이 전진하지 못하는 livelock 이 생기므로 완료 작업은 바로 지운다.

## 메모리 회수

LLM 호출 전에 메모리 범위 `(workspace_id, scope_key)` 안에서 현재 대화 컨텍스트를 쿼리로 top-k 의미 검색을 동기로 한다. 정확한 컨텍스트가 LLM 호출 시점에 있어야 하므로 회수는 동기다.

- **개수와 임계값**: `memoryTopK` 는 결과 수(기본 5), `memoryThreshold` 는 최소 유사도(기본 0.7)다. 두 필드는 에이전트 메모리 회수 전용이고 지식 저장소 검색용 `ragTopK`·`ragThreshold` 와 독립이다. 검색 대상이 다르다(`agent_memory` 와 지식 저장소). `memoryThreshold` 와 `ragThreshold` 는 기본값이 같은 0.7 이지만 다른 필드이고, `ragTopK` 는 고정 기본값이 없는 선택적 상한이다([RAG 검색](../CLE-KB/CLE-KB-SEARCH.md)).
- **회수 쿼리**: AI 에이전트 노드는 현재 사용자 메시지(`userPrompt`)를 쓴다. 비어 있으면(systemPrompt 만 있는 실행) systemPrompt 본문을 쓴다. 회수가 소리 없이 아무것도 안 하는 일을 막기 위해서다. 정보 추출기 노드는 `inputField` 를 쓴다. 비어 있으면 systemPrompt 를 쓴다([정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md)).
- **정보 추출기 노드의 회수 시점**: 추출 LLM 호출 직전에 한 번, 멀티턴이면 첫 진입에서만 회수한다. 회수 블록을 붙인 시스템 메시지가 `_resumeState.messages` 로 운반되기 때문이다([정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md)).
- **임베딩**: 회수 쿼리 임베딩은 저장과 같은 임베딩 설정을 써서 차원을 맞춘다. 회수는 `LlmService.embed(config, texts, model?, opts?, 'query')`, 저장은 `inputType='document'` 로 부른다. 같은 모델이지만 비대칭 검색 모델(e5, Gemini)에서 query 와 문서를 올바르게 나누기 위해서다. 시그니처는 [LLM 클라이언트](CLE-AI-LLM.md), 비대칭 입력 규칙은 [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) 에서 정한다.
- **입력 유형 도입 전 메모리**: `agent_memory` 에는 일괄 재임베딩 경로가 없다. 입력 유형 배선 전에 비대칭 모델로 저장한 메모리는 접두사 없이 남아 회수 때 약한 비대칭이 생길 수 있고, 중복 갱신이나 TTL 만료로 풀린다. 대칭 모델에서는 영향이 없다([Rationale](#일괄-재임베딩-경로를-두지-않은-이유)).
- **만료 제외**: 회수 SQL 은 `(expires_at IS NULL OR expires_at > now())` 로 만료된 행을 뺀다.
- **차원**: 쿼리 벡터와 같은 차원의 행만 본다. 지원하지 않는 차원이면 빈 결과를 돌려준다.
- **실패**: 회수는 모든 층에서 실패해도 빈 배열로 이어 간다. 회수 실패가 응답 경로를 깨지 않는다.
- **메타**: 회수 건수는 `meta.memory.recalledCount` 로 싣는다.

회수 쿼리의 모양은 다음과 같다.

```sql
SELECT content, 1 - (embedding <=> $q) AS score
FROM agent_memory
WHERE workspace_id = $ws AND scope_key = $scope AND vector_dims(embedding) = $dim
  AND (expires_at IS NULL OR expires_at > now())
  AND 1 - (embedding <=> $q) >= $threshold
ORDER BY score DESC
LIMIT $topK
```

### 주입

회수한 `content` 는 프롬프트 캐시가 유지되는 시스템 프롬프트 안정 프리픽스에 넣는다. 조립 순서는 회수 블록 [5a], 롤링 요약 블록 [5b], 휘발성 꼬리 [6] 이며 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md) 에서 정한다.

### 메모리 주입 경계

회수한 내용은 과거 대화에서 뽑은 신뢰할 수 없는 데이터다. 간접 prompt injection 을 막기 위해 메모리 주입 경계(data-fence)를 둔다.

- 주입하는 회수 블록(과 롤링 요약 블록)은 헤더 다음에 "지시가 아니라 데이터" 임을 밝히는 안내 문구를 넣는다.
- 항목마다 `[memory]…[/memory]` 마커로 감싼다(`buildRecallBlock`).
- 내용 안에 같은 마커 토큰이 다시 나오면 zero-width separator(U+200B)로 escape 한다. 공격자가 가짜로 마커를 닫고 지시를 섞는 것을 막는다.
- 대화 스레드의 `[user-input]…[/user-input]` 보안 마커와 같은 생각이다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)).

### 회수 흐름

```mermaid
sequenceDiagram
  participant H as 핸들러 (LLM 호출 직전)
  participant Svc as AgentMemoryService
  participant Le as LLM embed
  participant PG as agent_memory

  H->>Svc: resolveScopeKey(memoryKey 평가값, executionId)
  H->>Svc: recall(범위 키, 쿼리 텍스트, topK, threshold)
  Svc->>Le: embed(쿼리, query)
  Svc->>PG: 같은 범위·같은 차원·미만료 행 유사도 검색
  PG-->>Svc: 행
  Svc-->>H: 회수 메모리 목록
  H->>H: buildRecallBlock (주입 경계와 마커)
  H->>H: 안정 프리픽스에 회수 블록, 요약 블록 순으로 붙임
```

## 중복 갱신과 메모리 정리

### 의미 기반 중복 갱신

저장(`saveMemories`)은 무조건 INSERT 하지 않는다. 새 항목마다 그 임베딩으로 같은 `(workspace_id, scope_key)` 안에서 cosine 유사도가 `MEMORY_DEDUP_SIMILARITY = 0.85` 이상인 기존 행을 찾는다. 회수 cosine SQL 을 재사용하고 `LIMIT 1` 로 찾는다.

- 있으면 그 행을 갱신한다(`content`, `embedding`, `metadata`, `updated_at=now()`). 같은 사실을 최신 표현으로 바꾸는 것이다.
- `expires_at` 은 노드 `memoryTtlDays` 가 주어졌을 때만 `now() + ttlDays` 로 다시 정한다. 없으면 기존 `expires_at` 을 유지한다. 갱신이 기존 TTL 을 의도치 않게 늘리거나 지우지 않게 하기 위해서다.
- 없으면 새 행을 넣는다.
- 같은 배치 안 새 항목끼리의 중복도 메모리 안 cosine 비교로 막는다. 직전에 처리한 항목과 비슷하면 그 행을 다시 갱신한다.
- 중복 탐색이 실패하면(지원하지 않는 차원, 에러) 저장 경로를 막지 않고 새 행을 넣는다.
- 한 번의 저장에서 갱신과 삽입은 한 트랜잭션으로 묶는다.

### TTL 만료

노드 설정 `memoryTtlDays`(Integer, 선택, 기본은 만료 없음)가 양수이면 저장 때 `expires_at = now() + ttlDays` 를 파라미터 바인딩으로 채운다. 없거나 0 이하이면 만료가 없다(NULL). 값은 노드 설정 → 큐 payload(`ttlDays`) → processor → `saveMemories` 인자로 전달된다.

### 메모리 정리

메모리 정리(memory eviction)는 저장 트랜잭션 끝에서 한다.

1. 만료된 행을 먼저 지운다(`DELETE … WHERE expires_at < now()`).
2. 그다음 `(workspace_id, scope_key)` 마다 최신 `AGENT_MEMORY_MAX_PER_SCOPE = 1000` 건만 남긴다. 넘치면 `created_at` 이 오래된 순으로 지운다. 대화 스레드의 `STORAGE_MAX_TURNS` 정리와 같은 모양이다.

별도 cron 정리 작업은 없다. 만료분과 초과분 정리는 같은 범위에 새 저장이 일어날 때와 관리 화면 삭제로만 한다. 쿼리 필터가 만료된 행을 늘 빼므로 물리 삭제가 늦어도 회수 정확성에는 영향이 없다.

### 행의 생애

| 단계 | 계기 | 동작 |
| --- | --- | --- |
| 생성 | 추출한 새 항목과 비슷한 기존 행이 없음 | INSERT(`metadata.kind`, TTL 이 있으면 `expires_at`) |
| 갱신 | 새 항목이 기존 행과 cosine 0.85 이상 | 그 행을 갱신한다. TTL 이 없으면 기존 `expires_at` 유지 |
| 만료 | `expires_at < now()` | 회수·중복 탐색에서 바로 빠지고, 물리 삭제는 다음 저장의 정리에서 한다 |
| 용량 초과 | 범위당 1000건 초과 | `created_at` 이 오래된 순으로 지운다 |
| 수동 삭제 | 관리 화면 단건·범위 삭제 | 영구 삭제. 복구를 보장하지 않는다 |

## 구현 위치

- `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` (회수 · 저장 · 큐 넣기)
- `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.queue.ts` (큐 이름 · payload · 추출 프롬프트 · 응답 파서)
- `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.processor.ts` (추출 worker)
- `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` (`scheduleMemoryExtraction`, `buildRecallBlock`)
- `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` (`AiMemoryManager`, AI 에이전트 회수·턴 경계 큐 넣기)
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` (정보 추출기 회수·큐 넣기)

## Rationale

### 추출 기준점을 둔 이유

멀티턴은 대화 스레드에 턴을 쌓는다. 턴 경계마다 스레드 전체를 추출 LLM 에 넘기면 두 가지 문제가 생긴다.

- 같은 초기 턴을 매번 다시 추출하는 중복 LLM 호출이 턴 수에 비례해 늘어난다.
- 같은 사실이 되풀이 추출돼 저장 경로와 임베딩 호출에 쓸데없는 부하가 걸린다(중복 갱신이 있어도).

그래서 추출 기준점을 두고 `seq` 가 그보다 큰 항목만 스냅샷한다. 대화 기록 항목의 `seq` 는 단조 증가하므로([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)) 기준점 비교만으로 "직전 추출 뒤 새 항목" 을 결정적으로 가를 수 있다. 단일 턴은 한 번뿐이라 기준점이 의미가 없으므로 전체를 추출한다. "기준점이 없으면 전체" 라는 규칙 하나로 통일된다. 기준점은 실제로 큐에 들어간 스냅샷의 최대 `seq` 로만 전진하므로(새 항목이 없으면 건너뛰고 그대로 둔다) 큐 넣기와 기준점이 원자적으로 맞는다.

### 중복 갱신 임계를 0.85 로 둔 이유

정확히 같은 문자열만 중복으로 보면 "계정 등급은 gold" 와 "사용자 계정은 gold 등급" 같은 표현 변형이 따로 쌓여 범위가 중복·모순 사실로 오염된다. Mem0·Zep 도 임베딩 유사도로 같은 사실을 묶어 갱신한다.

임계 0.85 는 회수 기본 0.7 보다 높다. 회수는 "관련 있으면 가져온다" 는 recall 쪽 목적이지만, 중복 갱신은 "사실상 같은 사실만 합친다" 는 precision 쪽 목적이라 더 보수적이어야 서로 다른 사실을 하나로 덮어쓰는 잘못을 피한다. 중복 탐색 실패를 INSERT 로 흘리는 것은 중복 갱신이 품질 최적화이지 정합성 불변식이 아니어서, 실패가 저장 자체를 막으면 안 되기 때문이다.

### TTL 만료를 둔 이유

범위당 개수 상한에 더해 `expires_at` 절대 시각으로 시간 만료를 선택적으로 둔다. 개수 상한은 용량을, TTL 은 신선도를 다룬다. 둘은 서로 독립이다. 오래됐지만 1000건이 안 돼 개수 상한으로는 안 지워지는 사실을 TTL 이 정리한다.

상대값 `ttlDays` 가 아니라 절대 시각을 행에 넣는 이유는 두 가지다. 회수 필터(`> now()`)와 정리(`< now()`)가 저장 시점 기준으로 결정적이다. partial 인덱스(`WHERE expires_at IS NOT NULL`)로 만료 없는 다수 행의 인덱스 비용을 0 으로 유지한다. 기본값은 만료 없음(NULL)이라 기존 동작을 지킨다. 사용자가 `memoryTtlDays` 를 명시할 때만 만료가 켜진다.

### 메모리 종류를 분류하는 이유

분류를 LLM 응답 스키마에 넣는 비용은 작다(프롬프트 한 줄). 사실·선호·엔티티 구분은 나중에 회수 가중치, 화면 표시, 정리 정책 차등의 바탕이 된다. `fact` 폴백과 문자열 수용은 분류가 부가 정보라서 모델이 분류를 빠뜨리거나 잘못 적어도 저장이 깨지면 안 되기 때문이다.

### 전용 큐와 범위 단위 직렬화로 정한 이유

첫 버전 명세는 큐 구성(공용 백그라운드 경로와 전용 큐)을 응답 경로 비차단 불변식을 지키는 한 구현 재량으로 두었고, 나눌 경우 워크스페이스별 동시성 제한을 예로 들었다. 이를 전용 BullMQ 큐 `agent-memory-extraction`(concurrency 2)과 범위 단위 jobId 직렬화로 확정했다.

- **전용 큐**: 추출 LLM 호출 부하가 임베딩 적재(`document-embedding`)나 회수 경로와 동시성을 다투지 않게 떼어 놓는다.
- **범위 단위 제한**: 실제로 막아야 하는 경합은 같은 `(workspace_id, scope_key)` 안에서 유사 행 탐색(`findSimilarFact`) 뒤 INSERT 가 동시에 달리는 TOCTOU 중복 삽입이다. 이는 jobId 고정(`agent-memory:<ws>:<scope>`)으로 advisory lock 없이 BullMQ 수준에서 풀린다. 서로 다른 범위는 병렬로 돌아도 문제가 없으므로 워크스페이스 단위 제한은 지나치다.
- **수락 계약**: 작업을 버렸을 때 `scheduleExtraction` 이 `false` 를 돌려 추출 기준점을 전진시키지 않는 것은 "기준점은 실제로 큐에 들어간 스냅샷으로만 전진한다" 는 원칙에서 나온다. 버려진 항목은 잃지 않고 다음 턴 경계로 넘어간다. 버림은 `enqueueNonce` 비교로 결정적으로 검출한다.
- **완료 즉시 삭제와 짝**: 완료 작업을 남기면 jobId 중복 방지 때문에 livelock 이 생기므로([추출 큐](#추출-큐)) `removeOnComplete: true` 를 고정 jobId 와 반드시 짝으로 둔다.

### 지시문 주입을 두 층으로 막는 이유

에이전트 메모리는 "사용자 대화 → LLM 추출 → 저장 → 다음 실행의 systemPrompt 주입" 경로다. 악의적 사용자가 대화에 지시를 심으면 그것이 사실로 추출·저장돼 다음 실행의 안정 프리픽스에 들어갈 수 있다. 주입 위치가 systemPrompt 라 일반 user 메시지보다 권위가 높아 위험이 크다(간접 prompt injection).

- **주 방어는 주입 시점 경계**다. 회수·요약 블록에 "지시가 아니라 데이터" 안내 문구와 항목별 `[memory]…[/memory]` 마커(가짜 닫기 escape)를 넣어, 무엇이 저장됐든 LLM 이 지시로 다루지 않게 한다.
- **보조는 저장 시점 지시문 필터**다. 명백한 jailbreak 패턴만 결정적 정규식으로 버린다.
- 저장 필터를 주 방어로 삼지 않는 이유: 패턴 목록은 표현 변형이나 다른 언어로 쉽게 우회돼 완전성을 보장할 수 없다. 넓게 잡으면 정상 사실·선호까지 잘못 막는다.
- 필터를 아예 없애지 않는 이유: 명백한 지시가 메모리에 남으면 모델이나 프롬프트가 바뀌어 경계가 뚫리는 순간 잠복 공격이 된다. 비용이 거의 0 인 결정적 차단으로 공격 표면을 줄이는 심층 방어가 합리적이다.

### 일괄 재임베딩 경로를 두지 않은 이유

비대칭 입력(e5 접두사, Gemini taskType)을 도입한 뒤 지식 저장소에는 모델이나 전처리가 바뀔 때 문서를 일괄 재임베딩하는 경로(`POST /api/knowledge-bases/:id/re-embed`, [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md))가 있다. `agent_memory` 에는 그런 API 나 작업이 없다. 입력 유형 배선 전에 비대칭 모델로 저장한 메모리는 `document` 접두사 없이 남는다.

전용 재임베딩 경로는 일부러 두지 않는다. 에이전트 메모리는 지식 저장소 문서와 성질이 다르다.

- 원래 지워질 대상(범위당 1000건, 선택적 TTL)이라 영구 보존을 약속하지 않는다.
- 같은 사실을 다시 추출하면 중복 갱신이 그 행을 현재 모델·현재 입력 유형으로 다시 임베딩한다. 활발한 범위의 메모리는 따로 손대지 않아도 점점 최신 임베딩으로 모인다.
- 기본 모델 `text-embedding-3-small` 은 대칭이라 입력 유형 배선이 아무것도 바꾸지 않는다. 비대칭 모델(e5, Gemini)을 명시로 고른 범위에서만 과도기에 약한 비대칭이 생기고, 그것도 TTL 만료와 중복 재저장으로 풀린다.
- 임베딩 모델을 바꾸면 새로 저장하는 메모리는 새 차원으로 쌓인다. 회수는 쿼리 임베딩과 같은 차원의 행만 보므로 옛 차원 행은 조용히 회수에서 빠진 채 정리된다.

지식 저장소식 일괄 재임베딩 작업을 메모리에도 두는 안은 기각했다. 곧 지워질 행을 다시 임베딩하는 셈이라 비용 대비 이득이 낮고 관리 표면이 복잡해진다. 영구 보존이 필요한 사실은 처음부터 지식 저장소 문서로 올리는 것이 제품 모델에 맞다. "비대칭 모델을 도입하면 재임베딩해야 한다" 는 영구 문서의 원칙이고, 성질이 다른 에이전트 메모리는 따르지 않도록 따로 정했다. 두 결정은 충돌이 아니라 도메인에 따른 분화다.
