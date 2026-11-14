---
id: "CLE-AI-MEMORY"
title: "에이전트 메모리"
type: "feature"
version: 4
status: "approved"
requirements: ["REQ-MEMORY-001", "REQ-MEMORY-002", "REQ-MEMORY-003", "REQ-MEMORY-004", "REQ-MEMORY-005", "REQ-MEMORY-006", "REQ-MEMORY-007", "REQ-MEMORY-008", "REQ-MEMORY-009", "REQ-MEMORY-010", "REQ-MEMORY-011", "REQ-MEMORY-012", "REQ-MEMORY-013", "REQ-MEMORY-014", "REQ-MEMORY-015", "REQ-MEMORY-016", "REQ-MEMORY-017", "REQ-MEMORY-018", "REQ-MEMORY-019", "REQ-MEMORY-020", "REQ-MEMORY-021", "REQ-MEMORY-022", "REQ-MEMORY-023", "REQ-MEMORY-024", "REQ-MEMORY-025", "REQ-MEMORY-026", "REQ-MEMORY-027", "REQ-MEMORY-028", "REQ-MEMORY-029", "REQ-MEMORY-030", "REQ-MEMORY-031", "REQ-MEMORY-032", "REQ-MEMORY-033", "REQ-MEMORY-034", "REQ-MEMORY-035", "REQ-MEMORY-036", "REQ-MEMORY-037", "REQ-MEMORY-038", "REQ-MEMORY-039", "REQ-MEMORY-040", "REQ-MEMORY-041", "REQ-MEMORY-042", "REQ-MEMORY-043", "REQ-MEMORY-044", "REQ-MEMORY-045", "REQ-MEMORY-046", "REQ-MEMORY-047", "REQ-MEMORY-048", "REQ-MEMORY-049", "REQ-MEMORY-050", "REQ-MEMORY-051", "REQ-MEMORY-052", "REQ-MEMORY-053"]
basis_superseded: false
parent: "CLE-AI"
ancestors: ["CLE-VISION", "CLE-AI"]
area: "CLE-AI"
content_hash: "79ae2a01f772edacf592559999fda18f2f133f9a9dc8e3c51db479b7220fe492"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/1-data-model.md", "spec/2-navigation/16-agent-memory.md", "spec/2-navigation/_product-overview.md", "spec/5-system/17-agent-memory.md", "spec/5-system/_product-overview.md", "spec/data-flow/13-agent-memory.md"]
mirror_sha256: "65f77944b304b08ac121ac792b836157a750dac6d6c2a6a69f819f86eb57b005"
etag: "sha256-c9e2afab339ef46a7d20fa0185b85eefbeb6769591c83e9520fec25cc4d6f761"
---
> 구현 상태: 구현됨 · 원문: `spec/5-system/17-agent-memory.md`, `spec/2-navigation/16-agent-memory.md`, `spec/data-flow/13-agent-memory.md`, `spec/1-data-model.md` (§2.23), `spec/5-system/_product-overview.md` (§8), `spec/2-navigation/_product-overview.md` (§3.13) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

에이전트 메모리(Agent Memory, `AgentMemory`)는 AI 노드가 실행을 넘어 사용자와 대화에 관한 사실·선호를 기억하는 저장소다. 메모리 전략(`memoryStrategy`)이 `persistent` 인 노드만 쓴다. 노드는 대화에서 사실·선호를 뽑아 저장하고(메모리 추출), 다음 호출에서 의미 검색으로 가져와 LLM 컨텍스트에 넣는다(메모리 회수). 원문 명세의 "세션" 은 이 문서에서 워크플로우 실행 한 건을 뜻한다.

챗봇·어시스턴트 시나리오의 두 문제를 푼다.

- 대화 창 밖으로 밀려난 초기 정보가 완전히 사라진다.
- 실행이 바뀌면 같은 사용자를 매번 처음 보는 것처럼 대화가 끊긴다.

`summary_buffer` 전략의 롤링 요약(running summary, `runningSummary`)은 한 실행 안의 작업 메모리를 줄이는 장치다. `persistent` 는 AI 에이전트 노드에서 이 롤링 요약을 포함하고, 그 위에 실행을 넘는 추출 메모리 층을 더한다. 구현 방식은 Mem0·Zep 같은 추출·회수 패턴을 지식 저장소의 pgvector 인프라 위에 얹은 것이다.

메모리를 만들고 쓰는 노드는 두 가지다.

- **AI 에이전트 노드**: 메모리를 만들고(턴 경계 추출) 쓴다(LLM 호출 직전 회수). 롤링 요약도 함께 쓴다.
- **정보 추출기 노드**: `memoryStrategy: 'persistent'` 이면 같은 저장소·메모리 범위 키·추출·회수·격리 규칙을 쓴다. 메모리 범위 키 해석(`resolveScopeKey(memoryKey, executionId)`)이 같으므로 같은 키를 쓰면 AI 에이전트와 메모리를 공유한다. 롤링 요약은 쓰지 않는다. 회수 시점(추출 LLM 호출 전 1회, 멀티턴은 첫 진입에만), 회수 쿼리(`inputField`, 비면 systemPrompt), 멀티턴 추출 시점(종결 때 1회)이 AI 에이전트와 다르며 [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) 에서 정한다.
- 텍스트 분류기 노드는 단일 턴이고 상태가 없어 메모리 대상이 아니다.
- `manual`·`summary_buffer` 전략은 이 파이프라인을 전혀 타지 않는다. 추출도 회수도 `persistent` 에서만 일어난다. 이 불변식이 깨지면 회귀다. 롤링 요약은 `agent_memory` 가 아니라 대화 스레드의 `runningSummary` 에 저장한다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)).

이 문서는 저장소(테이블 `agent_memory`), 메모리 범위 키, 격리를 정한다. 추출·회수 파이프라인, 중복 갱신과 메모리 정리는 [에이전트 메모리 — 추출 · 회수 · 정리](CLE-AI-MEMORY-PIPELINE.md) 에서, 관리 API 와 관리 화면은 [에이전트 메모리 — 관리 API · 화면](CLE-AI-MEMORY-ADMIN.md) 에서 정한다. 범위 밖 문서는 다음과 같다.

- 노드 설정 필드(`memoryStrategy`, `memoryTokenBudget`, `memoryKey`, `memoryTopK`, `memoryThreshold`, `memoryTtlDays`, `extractionModelConfigId`, `embeddingModelConfigId`)와 노드 처리 순서 안의 위치: [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)
- 메모리 전략 전반과 시스템 프롬프트 조립 순서: [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md)
- 추출 입력이 되는 대화 기록: [대화 스레드](../CLE-IX/CLE-IX-THREAD.md)
- 임베딩 경로와 비대칭 입력: [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md)
- 사용량 기록: [LLM 사용량 기록](CLE-AI-USAGE.md)

## 요구사항

- REQ-MEMORY-001 WHEN 메모리 전략이 `persistent` 인 AI 노드가 메모리를 저장하면 THE SYSTEM SHALL 지식 저장소와 분리된 `agent_memory` 테이블에 pgvector 인프라를 재사용해 저장한다. (원본: AGM-01)
- REQ-MEMORY-002 WHEN `agent_memory` 테이블을 만들면 THE SYSTEM SHALL `(workspace_id, scope_key, created_at)` 인덱스, `(workspace_id, scope_key, updated_at)` 인덱스, 차원별 pgvector partial 인덱스를 둔다. (원본: AGM-02)
- REQ-MEMORY-003 WHEN 노드 `memoryKey` 평가값이 truthy 이면 THE SYSTEM SHALL 정규화한 그 값을 메모리 범위 키로 쓴다. (원본: AGM-03)
- REQ-MEMORY-004 IF `memoryKey` 가 없거나 빈 값이면 THE SYSTEM SHALL 실행 ID(`execution_id`)를 메모리 범위 키로 쓴다. (원본: AGM-03)
- REQ-MEMORY-005 WHEN `memoryKey` 평가값으로 메모리 범위 키를 만들면 THE SYSTEM SHALL null byte 와 C0/C1 제어 문자를 지우고 앞뒤 공백을 자른다. (원본: AGM-03)
- REQ-MEMORY-006 IF 정규화 결과가 빈 문자열이면 THE SYSTEM SHALL 실행 ID 를 메모리 범위 키로 쓴다. (원본: AGM-03)
- REQ-MEMORY-007 IF 정규화 결과가 512자를 넘으면 THE SYSTEM SHALL `<원문 prefix>:<sha256hex>` 형태로 결정적으로 줄인다. (원본: AGM-03)
- REQ-MEMORY-008 WHEN 메모리를 회수·추출·정리·조회·삭제하면 THE SYSTEM SHALL 실행 컨텍스트나 인증 컨텍스트의 `workspace_id` 로 늘 거른다. (원본: AGM-07)
- REQ-MEMORY-009 WHEN 턴 경계에 이르면 THE SYSTEM SHALL 메모리 추출을 큐에 넣기까지만 기다리고 추출 LLM 호출은 응답 경로 밖에서 한다. (원본: AGM-04)
- REQ-MEMORY-010 WHEN 추출할 대화 기록을 넘기면 THE SYSTEM SHALL 대화 기록 항목 스냅샷을 shallow-copy 로 떼어 뒤이은 턴 변경에 오염되지 않게 한다. (원본: AGM-04)
- REQ-MEMORY-011 WHEN 추출 LLM 을 고르면 THE SYSTEM SHALL `extractionModelConfigId` 설정, 노드 `llmConfigId` 설정, 노드 `model`, 설정의 기본 모델 순서로 폴백한다. (원본: AGM-04)
- REQ-MEMORY-012 WHEN 메모리를 저장하거나 회수하면 THE SYSTEM SHALL 저장과 회수에 같은 임베딩 모델 설정을 써 차원을 맞춘다.
- REQ-MEMORY-013 IF 추출 항목이 명백한 지시문 패턴에 걸리면 THE SYSTEM SHALL 그 항목을 저장하지 않고 경고 로그를 남긴다.
- REQ-MEMORY-014 WHILE 멀티턴 실행인 동안 THE SYSTEM SHALL 추출 기준점보다 `seq` 가 큰 대화 기록 항목만 추출 대상으로 보낸다. (원본: AGM-08)
- REQ-MEMORY-015 IF 추출 기준점 뒤에 새 대화 기록 항목이 없으면 THE SYSTEM SHALL 추출을 큐에 넣지 않는다. (원본: AGM-08)
- REQ-MEMORY-016 WHEN 추출 작업이 큐에 실제로 들어가면 THE SYSTEM SHALL 추출 기준점을 스냅샷의 최대 `seq` 로 전진시킨다. (원본: AGM-08)
- REQ-MEMORY-017 WHEN 단일 턴 실행이 추출하면 THE SYSTEM SHALL 추출 기준점과 상관없이 대화 기록 전체를 보낸다. (원본: AGM-08)
- REQ-MEMORY-018 WHEN 추출 LLM 이 응답하면 THE SYSTEM SHALL 항목을 `{content, kind}` 로 읽어 메모리 종류를 `metadata.kind` 에 저장한다. (원본: AGM-11)
- REQ-MEMORY-019 IF 메모리 종류가 없거나 `fact`·`preference`·`entity` 밖의 값이면 THE SYSTEM SHALL `fact` 로 저장한다. (원본: AGM-11)
- REQ-MEMORY-020 WHEN 추출 작업을 큐에 넣으면 THE SYSTEM SHALL 전용 큐 `agent-memory-extraction` 에 jobId `agent-memory:<workspaceId>:<scopeKey>` 로 넣어 같은 범위의 추출을 직렬화한다.
- REQ-MEMORY-021 IF 같은 범위의 추출 작업이 이미 대기·실행·지연 중이면 THE SYSTEM SHALL 새 작업을 버리고 추출 기준점을 전진시키지 않는다.
- REQ-MEMORY-022 WHEN 추출 작업이 완료되면 THE SYSTEM SHALL 그 작업을 큐에서 바로 지운다.
- REQ-MEMORY-023 IF 추출 작업을 큐에 넣지 못하면 THE SYSTEM SHALL 에러를 흡수하고 대화를 계속한다.
- REQ-MEMORY-024 WHEN 메모리 전략이 `persistent` 인 AI 에이전트 노드가 LLM 을 부르기 직전이면 THE SYSTEM SHALL 같은 범위에서 `memoryTopK`(기본 5)·`memoryThreshold`(기본 0.7) 기준으로 메모리를 동기 회수한다. (원본: AGM-05)
- REQ-MEMORY-025 WHEN 회수한 메모리를 주입하면 THE SYSTEM SHALL 시스템 프롬프트 안정 프리픽스의 회수 블록 자리에 넣는다. (원본: AGM-05)
- REQ-MEMORY-026 WHEN 메모리를 회수하면 THE SYSTEM SHALL 만료된 행을 결과에서 뺀다. (원본: AGM-05, AGM-10)
- REQ-MEMORY-027 WHEN 회수한 메모리를 주입하면 THE SYSTEM SHALL 데이터임을 밝히는 안내 문구를 넣고 항목마다 `[memory]…[/memory]` 마커로 감싼다.
- REQ-MEMORY-028 IF 회수한 내용 안에 같은 마커 토큰이 있으면 THE SYSTEM SHALL zero-width separator(U+200B)로 escape 한다.
- REQ-MEMORY-029 IF AI 에이전트 노드의 현재 사용자 메시지가 비어 있으면 THE SYSTEM SHALL 시스템 프롬프트 본문을 회수 쿼리로 쓴다.
- REQ-MEMORY-030 IF 회수가 실패하면 THE SYSTEM SHALL 빈 결과로 이어 가고 응답 경로를 깨지 않는다.
- REQ-MEMORY-031 WHEN 회수를 마치면 THE SYSTEM SHALL 회수 건수를 `meta.memory.recalledCount` 에 싣는다.
- REQ-MEMORY-032 WHEN 추출 항목을 저장하면 THE SYSTEM SHALL 같은 범위에서 cosine 유사도 0.85 이상인 기존 행을 찾아 그 행을 갱신한다. (원본: AGM-09)
- REQ-MEMORY-033 IF 유사도 0.85 이상인 기존 행이 없으면 THE SYSTEM SHALL 새 행을 넣는다. (원본: AGM-09)
- REQ-MEMORY-034 IF 기존 행을 갱신할 때 `memoryTtlDays` 가 없으면 THE SYSTEM SHALL 기존 `expires_at` 을 유지한다. (원본: AGM-09)
- REQ-MEMORY-035 IF 중복 탐색이 실패하면 THE SYSTEM SHALL 새 행을 넣는 쪽으로 진행한다. (원본: AGM-09)
- REQ-MEMORY-036 WHEN 노드 설정 `memoryTtlDays` 가 양수이면 THE SYSTEM SHALL 저장 때 `expires_at` 을 `now() + ttlDays` 로 채운다. (원본: AGM-10)
- REQ-MEMORY-037 WHEN 메모리 저장을 마치면 THE SYSTEM SHALL 만료된 행을 지운 뒤 범위마다 `created_at` 기준 최신 1000건만 남긴다. (원본: AGM-06, AGM-10)
- REQ-MEMORY-038 WHEN 뷰어 이상이 `GET /api/agent-memories/scopes` 를 부르면 THE SYSTEM SHALL 범위 키별 메모리 건수와 최신 `updated_at` 을 `q` 부분 일치와 `limit`/`offset` 페이지로 돌려준다. (원본: AGM-12)
- REQ-MEMORY-039 WHEN 뷰어 이상이 `GET /api/agent-memories` 를 `scopeKey` 와 함께 부르면 THE SYSTEM SHALL 그 범위의 메모리 행을 `created_at` 내림차순으로 `kind` 필터를 적용해 돌려준다. (원본: AGM-12)
- REQ-MEMORY-040 WHEN 메모리 행을 응답하면 THE SYSTEM SHALL 임베딩 벡터를 빼고 `id`·`content`·`kind`·`scopeKey`·`createdAt`·`updatedAt`·`expiresAt` 만 싣는다. (원본: AGM-12)
- REQ-MEMORY-041 WHEN 편집자 이상이 `DELETE /api/agent-memories/:id` 를 부르면 THE SYSTEM SHALL 그 행을 영구 삭제하고 204 를 돌려준다. (원본: AGM-13)
- REQ-MEMORY-042 IF 삭제 대상 행이 다른 워크스페이스에 속하면 THE SYSTEM SHALL 404 를 돌려준다. (원본: AGM-13)
- REQ-MEMORY-043 WHEN 편집자 이상이 `DELETE /api/agent-memories?scopeKey=` 를 부르면 THE SYSTEM SHALL 그 범위의 메모리를 모두 영구 삭제하고 삭제 행 수를 `X-Deleted-Count` 응답 헤더에 싣는다. (원본: AGM-13)
- REQ-MEMORY-044 WHEN 백엔드가 CORS 응답을 만들면 THE SYSTEM SHALL `exposedHeaders` 에 `X-Deleted-Count` 를 넣는다. (원본: AGM-13)
- REQ-MEMORY-045 WHEN 워크스페이스 멤버가 사이드바를 보면 THE SYSTEM SHALL "Agent Memory" 메뉴를 보여 준다. (원본: NAV-AM-01)
- REQ-MEMORY-046 WHEN 관리 화면을 열면 THE SYSTEM SHALL 범위 키·건수·최신 갱신 시각의 범위 목록을 검색과 "더 보기" 페이지로 보여 준다. (원본: NAV-AM-02)
- REQ-MEMORY-047 WHEN 사용자가 범위를 고르면 THE SYSTEM SHALL 내용·메모리 종류 배지·시각·만료 예정 시각의 메모리 목록을 종류 필터와 "더 보기" 페이지로 보여 준다. (원본: NAV-AM-03)
- REQ-MEMORY-048 WHEN 편집자 이상이 메모리 행의 삭제를 누르면 THE SYSTEM SHALL 확인 모달을 거쳐 그 행을 삭제하고 목록을 갱신한다. (원본: NAV-AM-04)
- REQ-MEMORY-049 WHEN 편집자 이상이 범위의 삭제를 누르면 THE SYSTEM SHALL 건수 경고가 있는 확인 모달을 거쳐 범위 전체를 삭제한다. (원본: NAV-AM-05)
- REQ-MEMORY-050 IF 범위 삭제 응답의 `X-Deleted-Count` 가 0 이면 THE SYSTEM SHALL 성공 토스트 대신 중립 토스트를 보여 준다. (원본: NAV-AM-05)
- REQ-MEMORY-051 WHILE 사용자가 편집자 미만인 동안 THE SYSTEM SHALL 관리 화면의 삭제 버튼을 보여 주지 않는다. (원본: NAV-AM-06)
- REQ-MEMORY-052 IF 워크스페이스에 쌓인 메모리가 없으면 THE SYSTEM SHALL 빈 상태 안내와 AI 에이전트 노드 `memoryStrategy` 설정 안내 링크를 보여 준다. (원본: NAV-AM-06)
- REQ-MEMORY-053 WHEN 최종 사용자 식별자가 도입되면 THE SYSTEM SHALL `memoryKey` 기본값을 실행 ID 대신 사용자 ID 로 올린다. (미구현)

## 하위 문서

- [에이전트 메모리 — 추출 · 회수 · 정리](CLE-AI-MEMORY-PIPELINE.md): 턴 경계 추출(큐 · 증분 추출 · 메모리 종류), 회수와 주입 경계, 의미 기반 중복 갱신 · TTL 만료 · 메모리 정리. 요구사항: REQ-MEMORY-009 ~ REQ-MEMORY-037
- [에이전트 메모리 — 관리 API · 화면](CLE-AI-MEMORY-ADMIN.md): 조회 · 삭제 관리 API 와 사이드바 "Agent Memory" 관리 화면. 요구사항: REQ-MEMORY-038 ~ REQ-MEMORY-052

요구사항 REQ-MEMORY-001 ~ 008(저장소 · 메모리 범위 키 · 격리)과 REQ-MEMORY-053(사용자 식별자 도입)은 이 문서가 맡는다.

## 데이터 모델

저장소는 테이블 `agent_memory` 다. pgvector 확장을 지식 저장소 청크(`DocumentChunk`)와 같은 방식으로 재사용하지만 지식 저장소와는 분리된 별도 테이블이다. 컬럼 정의는 이 절이 기준이다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `workspace_id` | UUID | FK → Workspace (CASCADE). 회수·추출·정리 모두 이 컬럼으로 거른다([격리](#격리)) |
| `scope_key` | String | 메모리 범위 키. 정규화한 `memoryKey` 평가값 또는 `execution_id`. `(workspace_id, scope_key)` 가 메모리 네임스페이스 하나다 |
| `content` | Text | 추출한 사실·선호 텍스트. 회수 때 LLM 컨텍스트에 넣는다 |
| `embedding` | Vector | `content` 임베딩. 차원이 정해지지 않은 vector 컬럼이며 지식 저장소 청크 임베딩과 같은 확장·차원 정책을 쓴다([문서 임베딩](../CLE-KB/CLE-KB-EMBED.md)) |
| `metadata` | JSONB | 추출 출처와 메모리 종류. `kind ∈ fact/preference/entity`. 나머지 키 구성은 정의가 갈린다. [미결 사항](#미결-사항) 참조 |
| `created_at` | Timestamp | 추출 시각. 메모리 정리의 기준이다 |
| `updated_at` | Timestamp | 마지막 갱신 시각. 중복 갱신 때 `now()` 로 바꾼다 |
| `expires_at` | Timestamp? | TTL 만료 시각. 기본 NULL(만료 없음). `memoryTtlDays` 가 있으면 `now() + ttlDays`. 회수는 만료되지 않은 행만 보고, 정리는 만료된 행을 지운다 |

`agent_memory` 에는 임베딩 모델 전용 컬럼을 두지 않는다. 노드 설정 필드와 설정 해석으로 충분하다.

### 인덱스

| 인덱스 | 마이그레이션 | 용도 |
|--------|--------------|------|
| `idx_agent_memory_scope (workspace_id, scope_key, created_at)` | V073 | 범위별 회수 필터와 메모리 정리 정렬(`ORDER BY created_at`)을 인덱스로 처리한다 |
| 차원별 partial HNSW (`embedding`) | V074(384), V075(512), V076(768), V077(1024), V078(1536), V079(3072, halfvec) | cosine 유사도 검색(회수·중복 탐색). 지원 차원 집합은 지식 저장소와 공유한다(`SUPPORTED_EMBEDDING_DIMS`). IVFFlat 은 쓰지 않는다 |
| `idx_agent_memory_expires_at (expires_at) WHERE expires_at IS NOT NULL` | V080 | TTL 만료 스캔을 빠르게 한다. 만료 없는 다수 행에는 인덱스 비용이 없다 |
| `(workspace_id, scope_key, updated_at)` | V086 (CONCURRENTLY) | 관리 화면 범위 목록(`GET /api/agent-memories/scopes`)의 `MAX(updated_at)` 정렬을 index-only 로 처리한다. `created_at` 인덱스와 겹치지 않는다 |

인덱스 전략 전반은 [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md) 에서 정한다.

## 메모리 범위 키

메모리 네임스페이스는 `(workspace_id, scope_key)` 두 값이다. 메모리 범위 키(`scope_key`)는 이렇게 정한다.

- 노드 `memoryKey`(표현식)의 평가값이 truthy 이면 그 값을 쓴다. 실행을 넘어 기억이 이어진다(개인화). 같은 키를 쓰는 다음 실행이 같은 메모리를 회수한다.
- `memoryKey` 가 없거나 빈 값이면 `execution_id` 를 쓴다. 기억이 한 실행 안에 머문다. 실행 사이에 쌓이지 않으므로 안전한 기본값이다.
- `workspace_id` 는 늘 필수 필터다. 사용자가 `memoryKey` 를 어떻게 주든 워크스페이스 경계를 넘지 못한다.

### 정규화

`memoryKey` 평가값은 표현식 결과라 제어 문자나 아주 긴 값이 들어올 수 있으므로 결정적으로 정규화한 값을 메모리 범위 키로 쓴다.

1. null byte 와 C0/C1 제어 문자를 지우고 앞뒤 공백을 자른다. 메모리 범위 키는 토큰 하나이므로 탭과 줄바꿈도 지운다.
2. 정규화 결과가 빈 문자열이면(제어 문자와 공백뿐이던 경우, 평가값이 truthy 였어도) `execution_id` 를 쓴다.
3. 512자(`SCOPE_KEY_MAX_LENGTH`)를 넘으면 `<원문 prefix>:<sha256hex>` 형태로 SHA-256 결정적 축약을 한다. 합친 길이는 상한 이하다. 같은 입력은 늘 같은 범위로 간다.

정규화는 사용자에게 보이는 동작이다. 관리 API 는 정규화한 `scope_key` 를 보여 준다. 512자를 넘는 키를 쓰는 사용자는 해시로 줄인 키로 범위를 찾고 지운다. 제어 문자만 다른 두 `memoryKey` 는 같은 범위로 합쳐진다.

## 격리

모든 회수·추출·정리·관리 쿼리는 `workspace_id` 필터를 강제한다. 모든 엔티티에 공통인 방식이다. `memoryKey` 는 사용자가 쓰는 표현식이므로 그 값만으로 워크스페이스 경계를 넘는 키를 만들 수 없어야 한다. 키는 늘 `(workspace_id, scope_key)` 로 묶이고, `workspace_id` 는 실행 컨텍스트의 권한 있는 값에서만 온다. 사용자가 넣을 수 없다.

## 관리 API

다른 문서가 이 절을 가리키므로 자리만 남긴다. 내용은 [에이전트 메모리 — 관리 API · 화면](CLE-AI-MEMORY-ADMIN.md#관리-api) 에서 정한다.

## 남은 로드맵

- **사용자 식별자 도입**(미구현): 최종 사용자 식별자(웹채팅 인증·위젯 세션)가 생기면 `memoryKey` 기본값을 익명 `execution_id` 대신 사용자 ID 로 올린다.

## 미결 사항

- **메모리 임베딩 설정 출처**: 에이전트 메모리 명세 본문과 에이전트 메모리 data-flow, [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) 는 노드 설정 `embeddingModelConfigId` 를 쓴다고 적는다. 이 필드는 모델 설정의 Embedding 목록에서 고르는 선택 위젯(`embedding-config-selector`)이고 노드 `llmConfigId` 와 독립이다. 지정하지 않으면 워크스페이스 기본 Embedding 설정(`ModelConfigService.resolveEmbedding`)을 쓰고, 둘 다 없으면 `NotFoundException` 이며 하드코딩 폴백은 없다. 이 값은 노드 설정 → 회수 호출과 큐 payload → processor → `saveMemories` 로 똑같이 전달된다. 반면 LLM 사용량 data-flow 의 임베딩 호출자 표는 메모리 저장·회수가 노드 `llmConfigId`(Chat 설정) 또는 워크스페이스 기본을 쓴다고 적고([LLM 사용량 기록](CLE-AI-USAGE.md)), 에이전트 메모리 data-flow 의 외부 의존 표도 LLM 도메인을 "`llm_config_id` 해석(`LlmService.resolveConfig`)" 으로 적는다. Chat 설정으로 임베딩하면 차원 불일치가 날 수 있다. 현재 구현은 `agent-memory.service.ts` 가 `embeddingModelConfigId` 로 `resolveEmbedding` 을 부른다. 결정 필요.
- **추출 기준점 저장 키 경로**: 에이전트 메모리 명세와 [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) 는 `_resumeState.memoryState.lastExtractionTurnSeq` 를 적는다. 메모리 관련 재개 상태를 `memoryState` 아래로 묶어 평면 키가 늘어나는 것을 막고 나중에 메모리 상태 키를 더할 자리를 두려는 것이다. 읽을 때는 옛 평면 키 `_resumeState.lastExtractionTurnSeq` 로 폴백해 배포 시점에 park 중이던 실행과 호환한다. 기준점을 잃어도 중복 갱신이 흡수하지만 폴백으로 재추출 1회도 피한다는 설명이다. 반면 에이전트 메모리 data-flow 와 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md), 비기능 요구사항 AGM-08 원문은 재개 상태의 평면 키 `lastExtractionTurnSeq` 로 적고, data-flow 는 `_resumeState` 에 영속한다고만(Redis 직렬화, 새 DB 컬럼 없음) 적는다. 현재 구현은 AI 에이전트가 `memoryState` 아래에 쓰고, 읽을 때 `memoryState` 를 먼저 보고 평면 키로 폴백한다(`agent-memory-injection.ts`, `ai-turn-executor.ts`). 정본 경로와 평면 키 폴백을 언제까지 둘지 결정 필요.
- **`metadata` 구조**: 에이전트 메모리 명세와 데이터 모델은 `{ source_node_id?, source_execution_id?, kind?, … }` 로 적는다. 에이전트 메모리 data-flow 는 `{ kind, source: 'turn_boundary_extraction' }` 로 적는다. 현재 구현은 `agent-memory-extraction.processor.ts` 가 `{ kind, source: 'turn_boundary_extraction' }` 을 저장하고 `source_node_id`·`source_execution_id` 는 쓰지 않는다. 출처 ID 키를 계획으로 둘지, 실제 저장 형태로 정의를 좁힐지 결정 필요.

## 구현 위치

- `codebase/backend/src/modules/agent-memory/entities/agent-memory.entity.ts`
- 추출 · 회수 · 정리: [에이전트 메모리 — 추출 · 회수 · 정리](CLE-AI-MEMORY-PIPELINE.md#구현-위치)
- 관리 API · 화면: [에이전트 메모리 — 관리 API · 화면](CLE-AI-MEMORY-ADMIN.md#구현-위치)

## Rationale

### 메모리 범위 키를 memoryKey 나 실행 ID 로 정한 이유

실행을 넘는 메모리에는 "누구의 메모리인가" 를 가리키는 키가 필요하다. Mem0·Zep 은 호출하는 쪽이 넘기는 `user_id` 를 받지만 지금 제품에는 최종 사용자 식별자가 없다. 웹채팅 첫 버전은 익명이고, `Execution.executed_by` 는 워크플로우를 만든 로그인 사용자이지 대화 상대가 아니다.

그래서 호출하는 쪽이 키를 넘기는 방식을 따르되 표현식 필드 `memoryKey` 로 열었다. 사용자가 자기 데이터(외부 시스템 고객 ID, 세션 토큰 등)를 표현식으로 넣으면 실행을 넘어 개인화가 되고, 넣지 않으면 `execution_id` 로 한 실행 안에 머무는 것이 안전한 기본값이 된다. 실행 사이에 쌓이지 않으므로 사용자 사이 메모리 유출이 구조적으로 불가능하다. 익명 기본값이 "기억 없음" 이 아니라 "이 실행 안에서만 기억" 이라서 롤링 요약의 작업 메모리와 자연스럽게 이어진다. 식별자 인프라가 생기면 기본값을 사용자 ID 로 올리면 되고, 그때까지 안전한 격리를 보장한다.

### pgvector 를 재사용하고 별도 벡터 DB 를 두지 않은 이유

Pinecone·Weaviate·Qdrant 같은 별도 벡터 DB 대신 기존 pgvector 인프라(`LlmService.embed`, RAG 검색 경로)를 재사용한다.

- 지식 저장소가 이미 pgvector 위에 있어 임베딩 생성·차원 관리·유사도 인덱스 운영 경험이 한 스택에 모여 있다. 메모리만 별도 벡터 DB 로 떼면 운영 표면·장애 지점·일관성 경계가 두 배가 된다.
- 메모리 규모(범위당 1000건 이하)는 pgvector partial 인덱스로 충분하다. 전용 벡터 DB 의 대규모 ANN 최적화가 필요한 규모가 아니다.
- `workspace_id` 격리·트랜잭션·백업이 메인 DB 와 같은 경계 안에서 자연히 지켜진다.

### 지식 저장소와 인프라는 같이 쓰고 테이블과 큐는 나눈 이유

`agent_memory` 는 지식 저장소 청크의 pgvector 패턴(차원을 정하지 않은 vector 컬럼, 차원별 partial HNSW, `SUPPORTED_EMBEDDING_DIMS` 공유)을 그대로 따르지만 테이블과 큐를 나눴다. 셋이 모두 다르기 때문이다.

- 회수 대상: 문서 청크와 추출한 사용자 사실
- 생애: 한 번 적재하면 바뀌지 않는 청크와, 중복 갱신·TTL·정리가 일어나는 메모리
- 부하: 처리량이 큰 임베딩과, rate limit 이 빡빡한 추출 chat

재사용은 인프라(pgvector) 수준이지 테이블 수준이 아니다.
