# Cross-Spec 일관성 Check Payload

본 파일은 orchestrator 가 Cross-Spec 일관성 checker 용으로 작성한 입력입니다. target 문서(draft)가 기존 `spec/**` 의 다른 영역과 충돌하는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (Cross-Spec 일관성)

1. **데이터 모델 충돌** — target 이 정의하는 엔티티·필드가 다른 영역의 동일 엔티티 정의와 모순되는가
2. **API 계약 충돌** — endpoint·HTTP method·request/response shape 이 다른 spec 의 정의와 어긋나는가
3. **요구사항 ID 충돌** — 요구사항 ID(예: `NAV-*`, `ED-AI-*`)가 다른 영역에서 다른 의미로 이미 사용 중인가
4. **상태 전이 충돌** — 같은 도메인 엔티티의 상태 머신이 영역마다 다르게 기술되어 있는가
5. **권한·RBAC 모델 충돌** — 새 권한 구조가 기존 RBAC 규칙과 어긋나는가
6. **계층 책임 충돌** — frontend/backend 경계·노드 카테고리 간 책임 분할이 기존 결정과 일치하는가

## 검토 모드
spec draft 검토 (--spec)

## Target 문서
경로: `plan/in-progress/spec-draft-embedding-pipeline-consistency.md`

```
---
worktree: spec-pipeline-consistency-4c9e1f
started: 2026-05-15
owner: project-planner
---

# Spec draft: embedding-pipeline 정합성 정비

## 배경

`plan/in-progress/spec-update-embedding-pipeline-consistency.md` 에 정의된 항목 (PR #40 cleanup-script-prod 의 사전 일관성 검토 결과로 파생) 을 본 draft 로 흡수한다. 실제 spec 본문에 반영하기 직전 `/consistency-check --spec` 의무 검토를 받는 단계.

본 draft 의 1차 consistency-check (2026-05-15T23:50:03, BLOCK: YES) 결과 — 변경 대상 파일이 4개로 불충분해 Critical 2건이 잡혔다. 6개 파일로 확장 + Rationale 보강 후 재검토 예정.

## 권위 결정 (코드 기반)

backend WebSocket 구현을 확인하여 latest 권위를 확정했다:

- `backend/src/modules/websocket/websocket.service.ts:113-125` — `KbEventType` union 에 정확히 12개 이벤트:
  - embedding 6: `document:embedding_started`, `_progress`, `_completed`, `_error`, `_retry`, `_failed`
  - graph 6: `document:graph_started`, `_progress`, `_completed`, `_error`, `_retry`, `_failed`
- `emitKbEvent()` 가 채널 `kb:${documentId}` 로 broadcast (line 151-165). KB ID 가 아니라 **document ID 가 채널 키**.
- payload 에 `documentId`, `timestamp` 자동 첨부.
- `frontend/src/lib/websocket/use-kb-events.ts` 가 12개 이벤트를 모두 listen 하며 `kb:${docId}` 채널 구독.

**dead path 발견**: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:42-46` 가 `emitExecutionEvent(`kb:${kbId}`, 'kb:graph_stats_updated' as never, …)` 호출. 그러나 `emitExecutionEvent` 는 channel 을 `execution:${첫인자}` 로 prefix 하므로 실제로 frontend 의 `kb:` 구독에 도달하지 못한다. type union 에도 없음 (`as never` 강제 캐스트). → **본 spec 정비에서는 권위에서 제외 (코드 측 결함은 후속 plan 으로 분리)**.

## 변경 대상 spec 문서 (6개, 원자적 반영)

**Critical 해소 조건**: 아래 6 파일 변경을 단일 PR 에 묶어 원자적으로 반영. 중간 상태에서 옛 표기(`embedding:{knowledgeBaseId}`, 점 표기 이벤트, `document:graph_extracted` 등)가 잔존하지 않도록 한 커밋 또는 연속 커밋으로 push.

### 1. `spec/5-system/8-embedding-pipeline.md`

| 위치 | 현재 | 변경 |
|---|---|---|
| §1 헤더 | `## 1. 개요` | 형식 통일은 본 PR 범위 밖. **건드리지 않음** (consistency check WARNING #7 회피 — 번호 헤더 일관성 보존) |
| §2 본문 끝 | "실패 시: status: error, **Document.metadata**에 에러 메시지 저장." | "실패 시: status: error, **Document.embedding_error_message** 에 에러 메시지 저장 (sanitize 거친 사용자 노출용)." |
| §6.1 DocumentChunk 표 | 6필드 inline | 그대로 유지 + 상단에 "권위 정의는 `spec/1-data-model.md §2.12.1`" 한 줄 추가. **표 자체는 보존** (정보 손실 위험 회피) |
| §6.2 DDL 예시 | IVFFlat 단일 인덱스 | DDL 코드블록 유지 + 노트 "실제 운영 인덱스는 V022/V023(/V030~V033, `spec/data-flow/knowledge-base.md §2.3` 참조) 으로 차원별 partial HNSW(vector / halfvec) 분리. 본 DDL 은 컨셉 예시" 추가 |
| §8 WebSocket 알림 표 | embedding 6개만 (started/progress/completed/error/retry/failed) | embedding 6 + graph 6 = 12개. 채널 명명규약 그대로 (`kb:${documentId}`). graph 6개는 §10-graph-rag.md §6 으로 위임 + footnote. |
| §8 헤더 끝 | (없음) | "이 이벤트들은 §9.2 의 상태 전이와 직접 대응되며, `embedding_error` 의 의미 변경(2026-05-11) 이후 일시 오류만 의미한다" 교차 참조 추가 |
| §9.4 retry-failed | `scope: 'embedding' \| 'graph' \| 'all'` | 표기 유지 + footnote "프론트엔드 UI 는 `'embedding'` 과 `'graph'` 두 버튼만 노출. `'all'` 은 운영/스크립트용" |
| `## Rationale` | 작업 일지 형식 | 형식 정리 + 신규 결정 4건 한 줄씩 추가 (아래 "Rationale 보강" 참조) |

### 2. `spec/5-system/6-websocket-protocol.md`

| 위치 | 현재 | 변경 |
|---|---|---|
| §3.2 채널 패턴 표 line 110 | `embedding:{knowledgeBaseId}` `Knowledge Base 임베딩 진행 상태` | `kb:{documentId}` `Knowledge Base 문서별 임베딩·그래프 추출 상태` |
| §4.3 임베딩 이벤트 섹션 | 채널 `embedding:{knowledgeBaseId}` + 점 표기 4개 이벤트 | 섹션 제목 "KB 문서 이벤트 (Server → Client)", 채널 `kb:{documentId}`, embedding 6 + graph 6 = 12개. error/retry/failed 의미 구분 명시. payload 권위는 backend 구현 기준. |
| (Rationale 신설) | 없음 | `## Rationale` 섹션 신설. "채널 단위를 KB → 문서로 전환. 문서별 독립 진행 상태 추적 + frontend 실제 구독 패턴 반영. 이벤트 표기 점 → 콜론+언더스코어는 backend KbEventType union 정렬." 한 단락. |

### 3. `spec/2-navigation/5-knowledge-base.md`

| 위치 | 현재 | 변경 |
|---|---|---|
| §2.4.1 line 105 | `POST /api/knowledge-bases/:id/retry-failed { scope: 'embedding'\|'graph' }` | `{ scope: 'embedding' \| 'graph' \| 'all' }` + "UI 는 vector/graph 두 분리 버튼이라 `scope: 'embedding'` 또는 `'graph'` 만 전송. `'all'` 은 운영/스크립트용" 한 줄 |
| §2.7.1 line 139 | `document:graph_started/progress/completed/error`, `kb:graph_stats_updated` | `document:graph_started/progress/completed/error/retry/failed` (`kb:graph_stats_updated` 제거 — dead path) |

### 4. `spec/1-data-model.md`

| 위치 | 현재 | 변경 |
|---|---|---|
| §2.12.1 DocumentChunk 인덱스 | `ivfflat (embedding vector_cosine_ops) — 유사도 검색 성능` | `차원별 partial HNSW (V022 vector + V023 halfvec, V030~V033 후속 정비) — 유사도 검색 성능. 마이그레이션 상세는 spec/data-flow/knowledge-base.md §2.3 및 backend/migrations/ 참조` |

### 5. `spec/5-system/10-graph-rag.md` (신규 추가 대상)

| 위치 | 현재 | 변경 |
|---|---|---|
| §2.3 / §4.2 KB-GR-OB-02 (line 37, 123) | "WebSocket 이벤트 (... `kb:graph_stats_updated`)" / "✅ (`kb:graph_stats_updated` 등)" | `kb:graph_stats_updated` 언급 제거. "그래프 통계 카운트는 `document:graph_completed` payload 의 `entityCount` / `relationCount` 또는 REST `GET /:id/graph/stats` 폴링으로 조회" 로 교체 |
| §6 이벤트 표 헤더 | "기존 `document:embedding_*` 이벤트와 같은 패턴으로 다음을 추가한다." | 채널 명시 추가: "채널 `kb:{documentId}` 로 broadcast (8-embedding-pipeline.md §8 과 동일)." |
| §6 이벤트 표 line 527 | `kb:graph_stats_updated` 행 | **행 삭제** (dead path) |

### 6. `spec/data-flow/knowledge-base.md` (신규 추가 대상)

| 위치 | 현재 | 변경 |
|---|---|---|
| §2.5 (line 68-103) mermaid emit 라인 | `document:embedding_started/completed/retry/failed`, `document:graph_extracted`, `document:graph_retry/failed` | `document:graph_extracted` → `document:graph_completed` (코드 권위 정렬). 누락된 `_progress`, `_error` 도 mermaid 노드의 흐름에 부합하면 추가. mermaid 다이어그램은 의미 변경 없이 라벨만 갱신. |
| §2.5 (line 197-198) 이벤트 출처 표 | `document:embedding_started/completed/failed/retry` / `document:graph_started/completed/failed/retry` | 6개씩 완전 명시: `document:embedding_started/progress/completed/error/retry/failed`, `document:graph_started/progress/completed/error/retry/failed`. 출처(`EmbeddingService.emitEvent` / `GraphExtractionService.emitEvent`) 그대로. |
| §2.3 인덱스 목록 | (현재) | 그대로 — `1-data-model.md §2.12.1` 가 본 spec 으로 포괄 참조 가능하도록 변경됨 (위 §4 항목 참조) |

## Rationale 보강 (8-embedding-pipeline.md `## Rationale`)

CLAUDE.md 원칙: Rationale 은 "결정의 배경·근거·폐기된 대안" 위주. 작업 일지 보존 + 결정 사항 4건 추가 + 형식 다듬기.

조치:
- 폐기된 `memory/kb-embedding-model-selection.md` 경로 참조 1줄 제거 (해당 메모는 `plan/complete/archive/from-memory/` 로 이미 흡수됨)
- 옛 flat review 경로 `review/2026-05-02_13-18-24/` 참조 1줄 제거 (review 경로 nested ISO 로 변경됨)
- 후속 검토 5개 항목 중 V024 로 완료된 2개 (`reEmbedAll → BullMQ 큐`, `EmbeddingService MAX_CONCURRENT → 세마포어`) 에 "→ V024 로 완료" 표시
- 섹션 헤더 "### 작업 메모: 지식베이스 임베딩 모델 사용자 선택 (2026-05-02 완료)" → "### 결정: 다중 차원 임베딩 + KB 단위 모델 선택 (2026-05-02)"
- **신규 결정 4건 추가** (consistency-check WARNING #5, INFO #3, #4, #5 흡수):
  - "`Document.metadata` 에러 저장 구 방식은 전용 컬럼 `embedding_error_message` 도입 (V024 후속) 으로 폐기됨"
  - "IVFFlat → partial HNSW 전환 — pgvector 0.7+ halfvec 으로 3072 차원에도 partial 인덱스 부착 가능해졌고, 차원별 cast 가 인덱스 정의와 SQL 표현식을 일치시킨다"
  - "`retry-failed` API 의 `scope: 'all'` 은 초기 5-knowledge-base 표에서 누락되어 있었으며, 8-embedding-pipeline §9.4 와 정합화. UI 는 vector/graph 분리 버튼이라 두 단일 값만 사용"
  - "`kb:graph_stats_updated` 이벤트 — kb-stats.helper.ts 가 `emitExecutionEvent` 로 호출해 채널이 `execution:kb:…` 로 변환되어 frontend 의 `kb:` 구독에 도달 불가한 dead path. spec 에서 제거, backend 코드 결함은 후속 plan 처리"
- 본문 형식은 그대로 유지 (배경 → 결정 → 핵심 결과 → 검증 → 후속) — 정보 손실 위험 회피

## 후속 plan (별도 분리 필요)

본 spec 정비에서 다루지 않는 항목은 신규 plan `plan/in-progress/kb-graph-stats-dead-path.md` 로 분리해 dev 위임:

- `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:42-46` 의 `kb:graph_stats_updated` emit 처리. 옵션: (1) `emitKbEvent` 로 전환 + 새 이벤트 type 추가, (2) 코드 제거. 결정은 dev.
- 결정에 따라 spec 에 이벤트 재도입 필요 시 본 PR 의 spec 변경을 reverse.

## 검토 후 단계

- [ ] 본 draft 에 대해 `/consistency-check --spec plan/in-progress/spec-draft-embedding-pipeline-consistency.md` 재호출 (1차 BLOCK: YES 해소 검증)
- [ ] Critical 0 확인 → 6 spec 파일 본문에 반영 (단일 PR 원자 반영)
- [ ] `plan/in-progress/spec-update-embedding-pipeline-consistency.md` 의 모든 항목 [x] 처리 → `git mv` 로 `plan/complete/` 이동
- [ ] 본 draft 파일도 spec 반영 완료 시 삭제 또는 `plan/complete/` 이동
- [ ] `plan/in-progress/kb-graph-stats-dead-path.md` 신규 plan 생성 (dead path 후속, dev 위임)
- [ ] PR 생성

```

## 관련 spec 본문 (다른 영역 포함)

### 관련 spec 본문

#### `spec/0-overview.md`
```
# Spec: 시스템 아키텍처 개요

> 관련 문서: [데이터 모델](./1-data-model.md) · [브랜드 가이드](./6-brand.md) · [노드 Output 규약](./conventions/node-output.md)

---

## Overview (제품 정의)

> 출처: `prd/0-overview.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수.

---

### 1. 제품 비전

**"흐름은 설계하는 것이 아니라, 자라나야 한다."**

Clemvion은 AI 에이전트와 노코드 워크플로우 빌더를 통합한 실행 플랫폼이다. 시각적 캔버스에서 노드를 연결해 복잡한 비즈니스 자동화를 구현하되, 워크플로우 안에 AI 에이전트 노드를 삽입함으로써 각 단계가 단순 실행이 아닌 **판단과 적응**을 수행하게 한다. 개발자에게는 고급 설정과 코드 편집 옵션을, 비개발자에게는 직관적인 드래그 앤 드롭 인터페이스와 AI 어시스턴트와의 대화형 편집을 제공한다.

브랜드 스토리·정체성은 [`brand.md`](./6-brand.md)를 참조한다.

---

### 2. 목표

| 구분 | 목표 |
|------|------|
| **사용자 가치** | 반복 업무를 자동화하여 생산성 향상. AI Agent를 활용한 지능형 워크플로우 구축 |
| **비즈니스 가치** | SaaS와 셀프 호스팅 양립으로 다양한 고객층 확보. 마켓플레이스를 통한 생태계 구축 |
| **기술 목표** | 확장 가능한 노드 시스템, 안정적 워크플로우 실행 엔진, 실시간 디버깅 지원 |

---

### 3. 타겟 사용자

#### 3.1 비개발자
- 마케팅, 운영, CS 등 비즈니스 부서 담당자
- 반복 업무 자동화 필요성을 느끼는 사용자
- 직관적 UI를 통해 워크플로우를 구성

#### 3.2 개발자
- 빠른 프로토타이핑 및 자동화 파이프라인 구축
- 코드 편집, 커스텀 노드 개발, API 직접 호출 등 고급 기능 활용
- 셀프 호스팅 환경 운영

#### 3.3 팀/조직
- 워크플로우 공유 및 협업
- 역할/권한 기반 접근 관리
- 조직 단위 통합(Integration) 설정 공유

---

### 4. 사용 단위

- **개인**: 개인 워크스페이스에서 독립적으로 워크플로우 생성/관리
- **팀/조직**: 팀 워크스페이스를 통해 워크플로우 공유, 역할/권한 관리, 공통 Integration 설정 관리

---

### 5. 배포 방식

| 방식 | 설명 |
|------|------|
| **SaaS** | 클라우드 호스팅, 멀티 테넌트 환경, 구독 기반 과금 |
| **셀프 호스팅** | 온프레미스 또는 프라이빗 클라우드 배포, 단일/멀티 테넌트 선택 가능 |

두 배포 방식 모두 동일한 기능을 제공하며, 환경 독립적 설계를 통해 설정만으로 배포 방식을 전환할 수 있어야 한다.

---

### 6. 현재 구현 상태 및 남은 로드맵

#### 6.1 구현 완료 (✅)

| 영역 | 기능 |
|------|-----------|
| **내비게이션** | 대시보드, 워크플로우 목록, 트리거 목록, 스케줄, 통합, Knowledge Base, LLM 설정, 인증 설정, 통계, 사용자 매뉴얼(/docs), 사용자 프로필 |
| **워크플로우 에디터** | 캔버스 기반 노드 편집, 엣지 연결, 실행·디버깅, 버전 히스토리 |
| **노드 시스템** | Trigger(Manual), Logic(If/Else·Switch·Loop·ForEach·Map·Filter·Split·Merge·Parallel·Background·Variable Decl/Mod), Flow(Workflow), AI(AI Agent·Text Classifier·Information Extractor), Integration(HTTP·Database·Send Email), Data(Transform·Code), Presentation(Carousel·Chart·Form·Table·Template) |
| **AI 플랫폼** | LLM Config(프로바이더·모델·API Key — v1 의 5개 provider OpenAI/Anthropic/Google/Azure OpenAI/Local Ollama·vLLM 모두 스트리밍 ✅), Knowledge Base(문서 업로드·임베딩·RAG 검색), **Graph RAG**(KB 모드 선택 + entity/relation 자동 추출 + Hybrid 검색 + Entity/Relation 목록·삭제 + 3D 그래프 시각화 — 상세: [PRD 9](./5-system/10-graph-rag.md)) |
| **Workflow AI Assistant** | 에디터 내 채팅형 AI로 자연어 요청 → 노드·엣지 자동 구성. Clarify → Plan → Execute 3단계 대화 루프, SSE 스트리밍, 세션 영속. 상세: [PRD 2 §10](./3-workflow-editor/_product-overview.md#10-ai-assistant-ed-ai-), [PRD 6 §3.6](./4-nodes/3-ai/_product-overview.md#36-workflow-ai-assistant). |
| **팀 워크스페이스·RBAC** | 데이터 모델(`Workspace.type = personal \| team`, `WorkspaceMember.role`) + 백엔드 모듈(`backend/src/modules/workspaces`) + 프런트엔드 UI(워크스페이스 전환, 멤버 초대·역할·소유권 이전). 회원가입 시 개인 워크스페이스가 자동 생성되고 `X-Workspace-Id`는 서버가 자동 매핑한다. |
| **시스템** | 인증/인가(개인·팀 워크스페이스), REST API, 에러 처리, 표현식 엔진(`{{ }}`), 실행 엔진(Redis 큐 + 워커 풀, 분산 continuation bus), WebSocket 실시간 상태, Webhook 수신, 실행 이력 |

#### 6.2 백엔드만 존재 / 부분 구현 (🚧)

| 영역 | 상태 |
|------|------|
| **Parallel 노드 (P1)** | `PARALLEL_ENGINE=v1` 환경변수로 활성화하면 `ParallelExecutor`가 `p-limit` + `Promise.allSettled`로 분기를 동시 실행한다(off 시 기존 순차 동작). branchCount(2~16), maxConcurrency(0=무제한, 1~16) 지원. 분기 내 블로킹 노드·back-edge·중첩 Parallel은 금지. Merge `wait_all` 조합으로 결과 합산 가능. P2에서 중첩 Parallel과 waitAll=false를 추가할 예정이다. |
| **조직 레벨 Integration 공유** | 팀 워크스페이스 단위 Integration 공유는 후속 단계에서 도입 예정이다. |

#### 6.3 로드맵 / 미구현 (❌)

| 영역 | 내용 |
|------|------|
| **Graph RAG 후속 (P2+)** | community detection / 글로벌 요약 / 도메인별 entity 타입 사전 / KB 단위 prompt override. P0~P2 본체는 §6.1 에서 ✅. 상세: [PRD 9 §8](./5-system/10-graph-rag.md#8-미결--후속-검토). |
| **Logic 확장 노드** | Parallel P2(중첩 Parallel, waitAll=false). |
| **마켓플레이스** | 워크플로우 템플릿·AI Agent 프리셋·Integration 플러그인·커스텀 노드 게시 기능. |
| **배포 자동화 확장** | 공식 Docker/Kubernetes 배포 가이드, 셀프 호스팅 번들. |
| **확장 SDK** | 노드 플러그인 SDK, 외부 커스텀 노드 개발/게시. |
| **Cafe24 통합** | spec 완료(2026-05-13). 워크플로 `cafe24` 노드 + AI Agent Internal MCP Bridge 양방향 노출. 18 카테고리 메타데이터 기반 단일 노드. 후속 implementation 진행 예정 ([Spec Cafe24 노드](./4-nodes/4-integration/4-cafe24.md) · [Spec 통합 §5.8](./2-navigation/4-integration.md#58-cafe24)). |
| **Internal MCP Bridge 패턴 확장** | Cafe24 이후 Shopify·Naver Smartstore 등 first-party 이커머스 통합을 같은 [Spec MCP Client §2.3](./5-system/11-mcp-client.md#23-internal-bridge) 패턴으로 추가. |

---

### 7. 용어 정의

| 용어 | 정의 |
|------|------|
| **Workflow** | 노드와 엣지로 구성된 자동화 프로세스의 단위. 특정 트리거에 의해 실행되거나 수동으로 실행 가능 |
| **Node** | 워크플로우 내에서 하나의 작업 단위를 나타내는 구성 요소. 입력을 받아 처리하고 출력을 생성 |
| **Edge** | 두 노드 간의 연결. 데이터 흐름의 방향과 경로를 정의 |
| **Port** | 노드의 입출력 연결 지점. 입력 포트(Input Port)와 출력 포트(Output Port)로 구분 |
| **Trigger** | 워크플로우의 실행을 시작하는 이벤트. Webhook, 스케줄(Cron), 수동 실행 등의 유형 존재 |
| **Canvas** | 워크플로우를 시각적으로 편집하는 작업 공간 |
| **Integration** | 외부 서비스(Google, GitHub 등)와의 연동 설정 |
| **Knowledge Base** | AI Agent의 RAG(Retrieval-Augmented Generation)를 위한 지식 저장소. KB 단위로 `vector` / `graph` 검색 모드를 선택할 수 있다 |
| **Graph RAG** | 문서에서 추출한 entity / relation 으로 구성된 지식 그래프를 RAG 검색에 활용하는 방식. 본 제품에서는 vector seed → 그래프 확장 → rerank 의 Hybrid 흐름으로 동작한다 ([PRD 9](./5-system/10-graph-rag.md)) |
| **Entity / Relation** | Graph RAG 의 구성 요소. Entity 는 문서 chunk 에서 추출한 의미 단위(인물·조직·개념·위치·이벤트). Relation 은 두 entity 사이의 방향성 있는 관계 (head, predicate, tail) |
| **Execution** | 워크플로우의 한 번의 실행 인스턴스. 실행 상태, 각 노드별 입출력 데이터, 로그를 포함 |
| **Workspace** | 사용자 또는 팀이 워크플로우, Integration, 설정 등을 관리하는 독립된 공간 |
| **Marketplace** | Agent 설정, 워크플로우 템플릿, Integration 플러그인을 공유/설치하는 공간 |
| **Schedule** | 워크플로우를 주기적으로 실행하기 위한 Cron Job 규칙 |
| **LLM** | Large Language Model. AI Agent 노드에서 사용하는 언어 모델 |
| **RAG** | Retrieval-Augmented Generation. Knowledge Base에서 관련 정보를 검색하여 AI 응답 품질을 향상시키는 기법 |

---

### 8. 문서 맵

본 spec/ 트리는 docs-consolidation(2026-05-12)으로 옛 `prd/`·`memory/`·`user_memo/` 를 흡수해 **제품의 단일 진실(single source of truth)** 로 통합되었다.

| 영역 | 위치 | 진입 문서 |
| --- | --- | --- |
| 제품 개요 + 시스템 아키텍처 | `spec/0-overview.md` | 본 문서 |
| 데이터 모델 | `spec/1-data-model.md` | 핵심 엔티티 정의 |
| 브랜드 가이드 | `spec/6-brand.md` | — |
| 정식 규약 | `spec/conventions/` | 노드 Output 규약, Swagger 패턴 등 |
| 내비게이션 화면 | `spec/2-navigation/` | `_product-overview.md` + 화면별 문서 |
| 워크플로우 에디터 | `spec/3-workflow-editor/` | `_product-overview.md` + 캔버스·노드 공통·엣지·실행·AI Assistant |
| 노드 시스템 | `spec/4-nodes/` | `_product-overview.md` + `0-overview.md` + 카테고리별 폴더 (`1-logic/` ~ `7-trigger/`) |
| 시스템 공통 | `spec/5-system/` | `_product-overview.md` + 영역별 spec (인증·API 규칙·실행 엔진·LLM Client·임베딩·RAG·Graph RAG·MCP·Webhook 등) |
| 데이터 흐름 | `spec/data-flow/` | `0-overview.md` + 도메인별 흐름·schema 매핑 (auth·workspace·workflow·execution·knowledge-base·integration·triggers·llm-usage·file-storage·notifications·audit·observability) |

문서 컨벤션:
- **`_product-overview.md`** — 다중 spec 파일을 가진 영역의 제품 정의(옛 PRD). 영역의 사용자 가치·요구사항·요구사항 ID.
- **`_layout.md`** — 영역 공통 레이아웃 (현재는 `2-navigation/` 만 사용).
- **`0-overview.md` / `0-common.md`** — 영역·카테고리 내부의 기술 아키텍처·공통 규약.
- **`N-name.md`** — 정렬된 상세 spec. 본문 끝에 `## Rationale` 섹션으로 결정 근거 inline. 단일 spec 파일 영역(예: webhook, graph-rag)은 본문 상단에 `## Overview (제품 정의)` 섹션을 직접 둔다.

별도 보관소:
- `plan/in-progress/` · `plan/complete/` — 작업 추적 라이프사이클
- `plan/complete/archive/from-memory/` — 옛 `memory/` 의 1회성 분석·진행 로그
- `plan/complete/archive/from-user-memo/` — 옛 `user_memo/` 의 초기 기획·노드 개선안

> 구체 파일 목록은 본 문서가 박제하지 않는다. 폴더 구조는 `ls spec/` 또는 IDE 트리에서 확인한다.

---

## 1. 시스템 구성 개요

```
┌─────────────────────────────────────────────────────────┐
│                      Client (SPA)                       │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │Navigation│  │Workflow Editor│  │  Settings/Config  │  │
│  │  Views   │  │   (Canvas)    │  │     Views         │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API / WebSocket
┌───────────────────────┴─────────────────────────────────┐
│                    API Gateway                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Auth · Rate Limiting · Request Routing          │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
  ┌─────────────────────┼─────────────────────┐
  │                     │                     │
  ▼                     ▼                     ▼
┌──────────┐   ┌───────────────┐   ┌──────────────────┐
│ Core API │   │  Execution    │   │  Integration     │
│ Service  │   │  Engine       │   │  Service         │
│          │   │               │   │                  │
│ - CRUD   │   │ - Scheduler   │   │ - OAuth Manager  │
│ - Search │   │ - Worker Pool │   │ - Connector Pool │
│ - Version│   │ - State Mgmt  │   │ - Webhook Mgr    │
└────┬─────┘   └──┬─────┬──────┘   └────────┬─────────┘
     │            │     │                    │
     │            ▼     │                    │
     │   ┌─────────────┐│                    │
     │   │ Message     ││                    │
     │   │ Queue       ││                    │
     │   │ (Redis BQ)  ││                    │
     │   └──────┬──────┘│                    │
     │          ▼       │                    │
     │   ┌─────────────┐│                    │
     │   │  Workers    ││                    │
     │   │ (N 인스턴스)││                    │
     │   └─────────────┘│                    │
     │                   │                    │
     ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                    Data Layer                             │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────┐ │
│  │PostgreSQL│  │   Redis   │  │  Vector  │  │ Object │ │
│  │(Primary) │  │(Cache/Pub)│  │   DB     │  │Storage │ │
│  └──────────┘  └───────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 주요 컴포넌트

### 2.1 Client (SPA)
- **기술**: React 기반 SPA
- **역할**: 내비게이션 화면, 워크플로우 에디터(캔버스), 설정 화면 렌더링
- **통신**: REST API(CRUD), WebSocket(실시간 실행 상태, 협업)

### 2.2 API Gateway
- 인증/인가 검증
- Rate Limiting
- 요청 라우팅
- CORS 관리

### 2.3 Core API Service
- 워크플로우, 노드, 트리거, 스케줄 등의 CRUD
- 검색 및 목록 조회
- 버전 관리
- 팀/워크스페이스 관리

### 2.4 Execution Engine
- 워크플로우 실행 오케스트레이션
- 노드 그래프 순회 및 실행
- 스케줄러 (Cron Job 기반 트리거)
- **Message Queue** (Redis 기반) — 실행 태스크를 큐에 발행
- **Worker Pool** (N개 인스턴스, 수평 확장) — 큐에서 태스크를 소비하여 노드 실행
- 실행 상태 관리 및 장애 시 복구

### 2.5 Integration Service
- OAuth 인증 플로우 관리
- Third-party API 커넥터 풀
- Webhook 수신/발신 관리
- 연동 상태 모니터링

### 2.6 Data Layer
- **PostgreSQL**: 주 데이터베이스 (워크플로우, 사용자, 설정 등)
- **Redis**: 캐시, 실행 상태 Pub/Sub, 세션 관리
- **Vector DB**: Knowledge Base 임베딩 저장/검색
- **Object Storage**: S3 호환 스토리지 (AWS S3 / MinIO). 파일 업로드, Knowledge Base 원본 문서 등 저장

### 2.7 Object Storage (S3 호환)

| 항목 | 설명 |
|------|------|
| 호환성 | AWS S3 API 호환 (AWS S3, MinIO 등) |
| SaaS | AWS S3 사용 |
| 셀프 호스팅 | MinIO 기본 제공 (Docker Compose에 포함) |

**버킷 구조:**

```
{bucket}/
  kb/                              # Knowledge Base 원본 문서 (구현됨)
    {kbId}/
      {documentId}/
        {sanitizedFilename}
  {workspaceId}/                   # Form/Avatar 영역 (계획)
    forms/                         # Form 노드 파일 업로드
      {executionId}/
        {fileId}_{originalName}
    avatars/                       # 프로필 이미지
      {userId}.{ext}
```

| 영역 | 키 패턴 | 상태 | 코드 |
|------|---------|------|------|
| Knowledge Base 원본 문서 | `kb/{kbId}/{documentId}/{sanitizedFilename}` | 구현됨 | `backend/src/modules/knowledge-base/knowledge-base.service.ts:723` |
| Form 노드 업로드 / Avatar | `{workspaceId}/forms/...`, `{workspaceId}/avatars/...` | 계획 (코드 미구현) | — |

> KB 원본 키는 `workspaceId` 를 prefix 로 두지 않는다. `kbId` 자체가 workspace 에 종속되므로 (KB 메타데이터의 FK) 키 공간이 겹치지 않으며, 키 길이가 짧아 S3 list/delete 비용이 낮다. 버킷 이름은 `S3_BUCKET` 환경변수 (기본 `workflow-storage`, `backend/.env.example:55`) 로 지정한다.

### 2.8 DB 마이그레이션 (Flyway)

| 항목 | 설명 |
|------|------|
| 도구 | **Flyway** |
| 버전 관리 | SQL 기반 마이그레이션 파일, `V{version}__{description}.sql` 네이밍 |
| 롤백 지원 | 각 마이그레이션에 대응하는 undo 스크립트 작성 (`U{version}__{description}.sql`) |
| CI/CD 연동 | 배포 파이프라인에서 `flyway migrate` 자동 실행. 마이그레이션 실패 시 배포 중단 |
| 환경 분리 | dev/staging/production 환경별 설정 파일 분리 (`flyway-{env}.conf`) |
| 기준선 | 최초 배포 시 `flyway baseline`으로 기준점 설정 |

---

## 3. 공통 UI 패턴

### 3.1 레이아웃
- 좌측 고정 사이드바 + 우측 메인 컨텐츠 영역
- 에디터 화면은 사이드바를 축소하거나 숨길 수 있음

### 3.2 목록 화면 패턴
- 상단: 검색바 + 필터 + 생성 버튼
- 중앙: 테이블/카드 형태 목록
- 하단: 페이지네이션 또는 무한 스크롤
- 각 항목: 우클릭 또는 더보기(...) 메뉴로 액션 (편집, 복제, 삭제)

### 3.3 상세/설정 패널 패턴
- 우측 슬라이드 패널 또는 모달
- 변경사항 자동 저장 (에디터) 또는 저장/취소 버튼 (설정)
- 유효성 검증 즉시 피드백

### 3.4 상태 표시 패턴
- **Badge/Tag**: Active(초록), Inactive(회색), Error(빨강), Processing(파랑 스피너)
- **Toast**: 성공/실패/정보 알림
- **Skeleton**: 로딩 중 UI 플레이스홀더

### 3.5 반응형 및 테마
- 최소 해상도: 1280x720
- 라이트/다크 테마 지원
- 에디터는 데스크탑 전용 (모바일에서는 뷰어 모드만 제공)

---

## 4. 영역별 진입 문서

docs-consolidation(2026-05-12) 으로 PRD/Spec 가 통합되었다. 옛 PRD 의 식별자(예: `NAV-WF-*`, `ED-AI-*`, `ND-IF~ND-BG`) 는 각 영역의 `_product-overview.md` 안에서 그대로 사용되고, 상세 spec 은 동일 폴더의 번호 매겨진 문서로 분배된다.

| 영역 | 제품 정의 (전 PRD) | 상세 spec |
|------|-------------------|-----------|
| 내비게이션 | [`./2-navigation/_product-overview.md`](./2-navigation/_product-overview.md) | [`./2-navigation/`](./2-navigation/) 의 화면별 문서 |
| 워크플로우 에디터 | [`./3-workflow-editor/_product-overview.md`](./3-workflow-editor/_product-overview.md) | [`0-canvas`](./3-workflow-editor/0-canvas.md) · [`1-node-common`](./3-workflow-editor/1-node-common.md) · [`2-edge`](./3-workflow-editor/2-edge.md) · [`3-execution`](./3-workflow-editor/3-execution.md) · [`4-ai-assistant`](./3-workflow-editor/4-ai-assistant.md) |
| 노드 시스템 | [`./4-nodes/_product-overview.md`](./4-nodes/_product-overview.md) | [`./4-nodes/0-overview.md`](./4-nodes/0-overview.md) + 카테고리별 폴더 |
| AI 플랫폼 (LLM/KB/Assistant) | [`./4-nodes/3-ai/_product-overview.md`](./4-nodes/3-ai/_product-overview.md) | [`./4-nodes/3-ai/`](./4-nodes/3-ai/) · [`./5-system/7-llm-client.md`](./5-system/7-llm-client.md) |
| 통합·KB·마켓플레이스 | [`./4-nodes/4-integration/_product-overview.md`](./4-nodes/4-integration/_product-overview.md) | [`./4-nodes/4-integration/`](./4-nodes/4-integration/) · [`./2-navigation/4-integration.md`](./2-navigation/4-integration.md) · [`./2-navigation/5-knowledge-base.md`](./2-navigation/5-knowledge-base.md) · [`./2-navigation/8-marketplace.md`](./2-navigation/8-marketplace.md) |
| 비기능 요구사항 | [`./5-system/_product-overview.md`](./5-system/_product-overview.md) | [`./5-system/`](./5-system/) 의 영역별 문서 |
| 실행 이력 | (Overview 섹션 통합) | [`./2-navigation/14-execution-history.md`](./2-navigation/14-execution-history.md) |
| Webhook | (Overview 섹션 통합) | [`./5-system/12-webhook.md`](./5-system/12-webhook.md) |
| Graph RAG | (Overview 섹션 통합) | [`./5-system/10-graph-rag.md`](./5-system/10-graph-rag.md) |
| 브랜드 가이드 | — | [`./6-brand.md`](./6-brand.md) |
| 노드 Output 규약 | — | [`./conventions/node-output.md`](./conventions/node-output.md) |

---

## 5. 배포 환경 분리

| 항목 | SaaS | 셀프 호스팅 |
|------|------|-------------|
| 인증 | 자체 인증 + OAuth 소셜 로그인 | 자체 인증 + LDAP/SAML 옵션 |
| 데이터 격리 | 멀티 테넌트 (논리적 격리) | 단일 테넌트 (물리적 격리) |
| 스케일링 | 자동 수평 확장 | 수동 구성 (Docker Compose / K8s) |
| 업데이트 | 자동 롤링 업데이트 | 수동 버전 업그레이드 |
| 마켓플레이스 | 중앙 마켓플레이스 접근 | 프록시 또는 오프라인 패키지 |
| 모니터링 | 내장 대시보드 + 관리형 알림 | Prometheus/Grafana 연동 가이드 |

```

#### `spec/1-data-model.md`
```
# Spec: 데이터 모델

> 관련 문서: [Spec 아키텍처 개요](./0-overview.md) · [PRD 개요](./0-overview.md) · [PRD 노드 시스템](./4-nodes/_product-overview.md)

---

## 1. 엔티티 관계 개요

```
User ──┬── Workspace (1:N)
       │       │
       │       ├── Folder (1:N, 자기참조 parent_id)
       │       ├── Workflow (1:N)
       │       │       ├── Node (1:N)
       │       │       ├── Edge (1:N)
       │       │       ├── WorkflowVersion (1:N)
       │       │       └── Execution (1:N)
       │       │               └── NodeExecution (1:N)
       │       │
       │       ├── Integration (1:N)
       │       └── IntegrationUsageLog (1:N)
       │       ├── Schedule (1:N)
       │       ├── Trigger (1:N)
       │       ├── KnowledgeBase (1:N)
       │       │       └── Document (1:N)
       │       │
       │       ├── LLMConfig (1:N)
       │       ├── AuthConfig (1:N)
       │       ├── AuditLog (1:N)
       │       ├── Notification (1:N)
       │       └── AssistantSession (1:N)
       │               └── AssistantMessage (1:N)
       │
       └── WorkspaceMember (N:M via join)
```

---

## 2. 핵심 엔티티

### 2.1 User

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| email | String | 고유, 로그인 식별자 |
| password_hash | String | 비밀번호 해시 (bcrypt) |
| name | String | 표시 이름 |
| avatar_url | String? | 프로필 이미지 URL |
| locale | String | 언어 설정 (기본: "ko") |
| theme | Enum | light / dark |
| two_factor_enabled | Boolean | 2FA 활성 여부 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.2 Workspace

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| name | String | 워크스페이스 이름 |
| type | Enum | personal / team |
| owner_id | UUID | FK → User |
| slug | String | URL 슬러그 |
| settings | JSONB | 워크스페이스 설정 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.3 WorkspaceMember

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| user_id | UUID | FK → User |
| role | Enum | owner / admin / editor / viewer |
| invited_at | Timestamp | 초대 시각 |
| joined_at | Timestamp? | 합류 시각 |

### 2.4 Workflow

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 워크플로우 이름 |
| description | String? | 설명 |
| is_active | Boolean | 활성 상태 |
| tags | String[] | 태그 목록 |
| folder_id | UUID? | FK → Folder (정리용) |
| settings | JSONB | 워크플로우 레벨 설정 |
| current_version | Integer | 현재 버전 번호 |
| created_by | UUID | FK → User |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.5 Folder

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 폴더 이름 |
| parent_id | UUID? | FK → Folder (중첩 폴더 지원) |
| sort_order | Integer | 정렬 순서 (기본: 0) |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

**제약 조건:**
- `(workspace_id, parent_id, name)` UNIQUE — 같은 위치에 동일 이름 불가
- 중첩 깊이 제한: 최대 5단계

### 2.6 Node

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| type | Enum | 노드 유형 (if_else, switch, loop, ..., ai_agent, text_classifier, information_extractor, http_request, ..., transform, code, carousel, table, chart, form, template) |
| category | Enum | logic / flow / ai / integration / data / presentation |
| label | String | 사용자 지정 노드 이름 |
| position_x | Float | 캔버스 X 좌표 |
| position_y | Float | 캔버스 Y 좌표 |
| config | JSONB | 노드별 설정 값 |
| is_disabled | Boolean | 비활성 여부 |
| description | String? | 메모/설명 |
| container_id | UUID? | FK → Node. 컨테이너 노드(Loop/ForEach/Map) 내부에 배치된 경우. 엣지 연결/삭제로 자동 동기화(§11.2.1 canvas 스펙 참조). Background 는 컨테이너 멤버십을 사용하지 않고 `background` 포트 엣지로 본문을 식별한다 ([PRD 3 §4.11 ND-BG-05 대안 구현](./4-nodes/_product-overview.md#411-background) / [Spec 실행 엔진 §3.3](./5-system/4-execution-engine.md#33-background-실행)) |
| tool_owner_id | UUID? | FK → Node. AI Agent의 Tool Area에 등록된 경우 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

**제약 조건:**
- `container_id`와 `tool_owner_id`는 동시에 값을 가질 수 없음 (CHECK 제약)
- `container_id`가 참조하는 노드의 type은 `loop`, `foreach`, `map` 중 하나여야 함 (Background는 도입 시 추가)
- `container_id` 체인은 순환하지 않아야 함 — 실행 시 `CONTAINER_CYCLE` 에러로 거부
- 트리거 카테고리 노드(`manual_trigger` 등)는 `container_id`를 가질 수 없음 — 실행 시 `CONTAINER_INVALID_CHILD` 에러로 거부
- `tool_owner_id`가 참조하는 노드의 type은 `ai_agent`여야 함

**Node.type 전체 목록:**

| category | type | 설명 |
|----------|------|------|
| logic | if_else | 조건 분기 |
| logic | switch | 다중 분기 |
| logic | loop | 반복 |
| logic | variable_declaration | 변수 선언 |
| logic | variable_modification | 변수 수정 |
| logic | split | 배열 분리 |
| logic | map | 배열 변환 |
| logic | foreach | 순차 반복 |
| logic | parallel | 병렬 실행 |
| logic | merge | 데이터 합산 |
| logic | background | 백그라운드 실행 |
| flow | workflow | 서브 워크플로우 호출 |
| ai | ai_agent | AI Agent 실행 |
| ai | text_classifier | 텍스트 분류 |
| ai | information_extractor | 정보 추출 |
| integration | http_request | 범용 HTTP 요청 |
| integration | database_query | 데이터베이스 쿼리 |
| integration | send_email | 이메일 발송 (SMTP) |
| integration | cafe24 | Cafe24 Admin API (Resource × Operation 동적 폼). 같은 Integration 이 AI Agent MCP 도구로도 사용 ([Spec Cafe24 노드](./4-nodes/4-integration/4-cafe24.md)) |
| data | transform | 데이터 변환 (연산 체인) |
| data | code | JavaScript 코드 실행 |
| presentation | carousel | 캐러셀(슬라이드) 시각화 |
| presentation | table | 테이블 시각화 |
| presentation | chart | 차트 시각화 |
| presentation | form | 사용자 입력 폼 (Human-in-the-loop) |
| presentation | template | 템플릿 기반 콘텐츠 생성 |

### 2.7 Edge

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| source_node_id | UUID | FK → Node (출력 노드) |
| source_port | String | 출력 포트 식별자 (예: "true", "false", "default", "out_0") |
| target_node_id | UUID | FK → Node (입력 노드) |
| target_port | String | 입력 포트 식별자 (기본: "in") |
| type | Enum | 엣지 유형: `data` (기본) / `error` (에러 포트 엣지) |
| condition | JSONB? | 엣지 조건 (조건부 라우팅용) |
| created_at | Timestamp | 생성 시각 |

**제약 조건:**
- `(source_node_id, source_port, target_node_id, target_port)` UNIQUE — 동일 연결 중복 방지
- 자기 자신으로의 연결 불가 (`source_node_id != target_node_id`)
- source_node와 target_node는 같은 workflow_id에 속해야 함

### 2.8 Trigger

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| workflow_id | UUID | FK → Workflow |
| type | Enum | webhook / schedule / manual |
| name | String | 트리거 이름 |
| is_active | Boolean | 활성 상태 |
| config | JSONB | 트리거별 설정 |
| endpoint_path | String? | Webhook URL 경로 (type=webhook) |
| auth_config_id | UUID? | FK → AuthConfig (Webhook 인증) |
| last_triggered_at | Timestamp? | 마지막 실행 시각 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.9 Schedule

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| trigger_id | UUID | FK → Trigger |
| cron_expression | String | Cron 표현식 |
| timezone | String | 타임존 (IANA) |
| is_active | Boolean | 활성 상태 |
| next_run_at | Timestamp | 다음 실행 예정 시각 |
| last_run_at | Timestamp? | 마지막 실행 시각 |
| parameter_values | JSONB | 워크플로우 Manual Trigger 노드 스키마에 대응하는 파라미터 값 맵. 값 문자열에 `{{ $now }}`, `{{ $schedule.* }}` 등 제한 표현식 사용 가능. 기본값 `{}`. |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.9.1 Trigger ↔ Schedule 동기화 규칙

Schedule은 Trigger의 서브타입이다. 양쪽의 라이프사이클과 상태는 동기화된다.

| 이벤트 | 동작 |
|--------|------|
| Schedule 생성 | Trigger 자동 생성 (type=`schedule`, 동일 이름, 동일 워크플로우, is_active 동기화) |
| Schedule 이름 변경 | 연결된 Trigger 이름도 동기화 |
| Schedule is_active 변경 | 연결된 Trigger is_active도 동기화 (역방향도 동일) |
| Schedule 삭제 | 연결된 Trigger cascade 삭제 |
| Trigger(type=schedule) 삭제 | 연결된 Schedule cascade 삭제 |
| Trigger(type=schedule) 직접 생성 | 금지 — Schedule 화면에서만 생성 가능 |

**제약 조건:**
- Schedule.trigger_id는 NOT NULL — 반드시 Trigger와 1:1 매핑
- Trigger(type=schedule)는 반드시 1개의 Schedule을 가짐

---

### 2.10 Integration

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| service_type | String | 서비스 유형 (google, github, http, database, email, webhook, mcp, cafe24). `mcp` 의 사용처·credentials 스키마는 [Spec MCP Client](./5-system/11-mcp-client.md) · [Spec 통합 §5.6](./2-navigation/4-integration.md#56-mcp-server). `cafe24` 는 [Spec 통합 §5.8](./2-navigation/4-integration.md#58-cafe24) · [Spec Cafe24 노드](./4-nodes/4-integration/4-cafe24.md) — 같은 Integration 이 워크플로 노드와 AI Agent MCP Bridge 양쪽에서 사용된다 ([Spec MCP Client §2.3 Internal Bridge](./5-system/11-mcp-client.md#23-internal-bridge)) |
| name | String | 사용자 지정 별칭 |
| auth_type | Enum | oauth2 / api_key / bearer_token / basic / connection_string / smtp / webhook_outbound / none. `none` 은 인증이 없는 공용 MCP 서버 등에 사용 |
| credentials | JSONB (encrypted) | 인증 정보 (암호화 저장). OAuth의 경우 `scopes: string[]` 포함 |
| scope | Enum | personal / organization |
| status | Enum | connected / expired / error / pending_install |
| install_token | String? | Cafe24 Private 앱 설치 흐름 식별 키. `oauth/begin (app_type=private)` 시 **16바이트를 `base64url` (no padding, 22자) 인코딩**해 발급, callback 성공 또는 TTL 만료 시 NULL. Cafe24 private 전용 — 다른 service_type 에서는 항상 NULL. **형식 변경 (2026-05-15)**: 옛 32바이트 hex (64자) 는 Cafe24 App URL 100자 한도 초과로 폐기 — 본 문서 Rationale 의 "install_token 형식" 항 참조. 정식 라이프사이클은 [Spec 통합 화면 §6 상태 전이](./2-navigation/4-integration.md#6-상태-전이) 와 [§9.2 API](./2-navigation/4-integration.md#92-인증--회전--scope) |
| install_token_issued_at | Timestamp? | Cafe24 Private `install_token` 발급 시각. TTL 스캐너 (`pending-install-ttl` job) 가 `now - 24h` 와 비교해 만료 판단 — 초과 시 `status='expired', status_reason='install_timeout', install_token=NULL` 로 전이. 재사용/새 발급 시 갱신, callback 성공 시 NULL. 옛 (V044 이전) 행은 NULL → 스캐너가 `created_at` 으로 fallback 하여 동일 24h TTL 적용 (배포 직후 일괄 expired 처리 없음 — `created_at` 이 이미 24h 이상 지난 행만 자연스럽게 expired 됨). V044 추가 |
| mall_id | String? | Cafe24 `mall_id` 의 plain projection — `credentials.mall_id` 와 동일 값을 plain 컬럼으로 복제. `(workspace_id, mall_id)` 부분 UNIQUE 인덱스가 SQL 레벨에서 중복 cafe24 통합을 거부하고, decrypt 없이 O(1) lookup 가능. cafe24 외 service_type 에서는 항상 NULL. 옛 (V045 이전) 행은 NULL — 다음 ORM save (callback / reauth) 시 backfill. **비즈니스 규칙**: 같은 workspace 내 같은 `mall_id` 의 cafe24 통합은 `app_type` 무관 최대 1행 — 한 mall 에 public·private 을 동시에 보유하면 토큰·webhook 처리 주체가 분기되어 사용자 혼란과 회계 충돌을 유발하므로 spec 차원에서 금지. Public App 지원 시 재검토 대상. V045 추가 |
| status_reason | String? | 상태별 사유 코드 (모두 `snake_case`). `error` → `insufficient_scope` / `auth_failed` / `network` / `unknown` (현행) — `credentials_unreadable` 은 기존 분기로 정합성 유지. `expired` → `token_expired` / `refresh_failed` / `install_timeout`. `pending_install` → callback 실패 분기 코드 (`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`). `resource_not_found` 는 row 가 사라진 케이스라 DB 갱신 불가 → 후보값 제외 ([Spec 통합 화면 §10.4](./2-navigation/4-integration.md#104-에러-매핑)). `connected` → NULL. ※ DB 저장값은 `snake_case`, 동일 의미의 API 에러 코드는 `OAUTH_*` `UPPER_SNAKE_CASE` (의도적 분리) |
| token_expires_at | Timestamp? | 토큰 만료 시각 (OAuth) |
| last_used_at | Timestamp? | 마지막 노드 실행에서 사용된 시각 (캐시) |
| last_rotated_at | Timestamp? | 자격 증명 마지막 회전 시각 (OAuth 재인증 또는 비OAuth 교체) |
| last_error | JSONB? | 최근 호출 실패의 요약 `{ code, message, at }` |
| created_by | UUID | FK → User |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

**제약조건**: `UNIQUE(workspace_id, name)` — 워크스페이스 내 별칭 유일성

### 2.10.1 IntegrationUsageLog

> 관련 문서: [Spec 통합 화면 §Recent activity](./2-navigation/4-integration.md)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| integration_id | UUID | FK → Integration (CASCADE) |
| node_execution_id | UUID | FK → NodeExecution |
| workflow_id | UUID | FK → Workflow (비정규화, 조회 최적화) |
| status | Enum | success / failed |
| error | JSONB? | 실패 시 에러 요약 `{ code, message }` |
| duration_ms | Integer | 호출 소요 시간 |
| at | Timestamp | 호출 시각 |

**보존 기간**: 90일. 일일 배치로 기한 초과 레코드 정리.

**인덱스**: `(integration_id, at DESC)` — 상세 페이지 최근 활동 조회용

### 2.11 KnowledgeBase

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 컬렉션 이름 |
| description | String? | 설명 |
| embedding_model | String | 임베딩 모델 식별자 (default: text-embedding-3-small) |
| embedding_dimension | Integer? | 저장된 청크들의 벡터 차원. 첫 임베딩 후 자동으로 채워지고, KB 재임베딩 시 NULL 로 reset |
| chunk_size | Integer | 청크 크기 (기본: 1000) |
| chunk_overlap | Integer | 청크 오버랩 (기본: 200) |
| document_count | Integer | 문서 수 (캐시) |
| reembed_status | Enum | KB 전체 재임베딩 잠금 상태: `idle` / `in_progress` (default: idle). 진입 시 atomic compare-and-swap |
| rag_mode | Enum | 검색 모드: `vector` (default) / `graph`. **생성 시에만 결정, 사후 변경 불가** ([Spec Graph RAG](./5-system/10-graph-rag.md)) |
| extraction_llm_config_id | UUID? | `rag_mode = 'graph'` 일 때 그래프 추출에 사용할 LLMConfig (chat 모델). NULL 이면 워크스페이스 default LLMConfig |
| max_hops | Integer | graph 검색 시 그래프 확장 깊이 (1 또는 2, default 1). `vector` 모드에서는 무시 |
| vector_seed_top_k | Integer | graph 검색 시 vector seed 개수 (default 5). `vector` 모드에서는 무시 |
| expanded_chunk_limit | Integer | graph expansion 후 회수할 청크 상한 (default 15). `vector` 모드에서는 무시 |
| entity_count | Integer | KB 의 entity 총 수 (캐시). `vector` 모드는 항상 0 |
| relation_count | Integer | KB 의 relation 총 수 (캐시). `vector` 모드는 항상 0 |
| reextract_status | Enum | KB 전체 그래프 재추출 잠금: `idle` / `in_progress` (default: idle). `vector` 모드에서는 사용 안 함 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.12 Document

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase |
| name | String | 문서 이름 |
| file_type | Enum | txt / md / pdf / csv |
| file_url | String | 원본 파일 저장 경로 |
| file_size | Integer | 파일 크기 (bytes) |
| embedding_status | Enum | `pending` / `processing` / `completed` / `error` / `failed`. `error` = in-flight 재시도 중 일시 오류, `failed` = 최대 재시도 소진 또는 비재시도성 오류로 인한 최종 실패 |
| embedding_retry_count | Integer | 임베딩 재시도 누적 횟수. 성공 시 0 으로 리셋 |
| embedding_last_attempted_at | Timestamp? | 마지막 임베딩 시도 시각. stuck 회수 임계 비교에 사용 |
| embedding_error_message | Text? | 마지막 임베딩 오류 메시지 (sanitize 거친 사용자 노출용). 성공 시 NULL |
| graph_extraction_status | Enum? | `pending` / `processing` / `completed` / `error` / `failed`. `vector` 모드 문서는 NULL. 의미는 `embedding_status` 와 동일 |
| graph_retry_count | Integer | 그래프 추출 재시도 누적 횟수. 성공 시 0 |
| graph_last_attempted_at | Timestamp? | 마지막 그래프 추출 시도 시각 |
| graph_error_message | Text? | 마지막 그래프 추출 오류 메시지 |
| chunk_count | Integer | 생성된 청크 수 |
| tags | String[] | 태그 |
| metadata | JSONB | 메타데이터 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.12.1 DocumentChunk

> 관련 문서: [Spec 임베딩 파이프라인](./5-system/8-embedding-pipeline.md)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| document_id | UUID | FK → Document (CASCADE) |
| chunk_index | Integer | 청크 순서 (0-based) |
| content | Text | 청크 텍스트 원본 |
| embedding | Vector | 벡터 임베딩 (pgvector) |
| token_count | Integer | 청크의 토큰 수 |
| metadata | JSONB | `{ page?: number, section?: string }` |

**제약조건**: `UNIQUE(document_id, chunk_index)`

**인덱스**: `ivfflat (embedding vector_cosine_ops)` — 유사도 검색 성능

### 2.12.2 Entity

> 관련 문서: [Spec Graph RAG](./5-system/10-graph-rag.md). `rag_mode = 'graph'` 인 KB 에서만 사용된다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase (CASCADE) |
| name | String | 정규화된 entity 이름 (소문자·trim) |
| display_name | String | 사용자 표시용 원형 |
| type | Enum | `person` / `organization` / `concept` / `location` / `event` / `other` |
| description | Text? | LLM 추출 짧은 설명 |
| mention_count | Integer | KB 내 청크에서 언급된 횟수 (캐시) |
| last_seen_chunk_id | UUID? | 마지막 등장 청크 (FK → DocumentChunk) |
| created_at | Timestamp | 첫 추출 시각 |
| updated_at | Timestamp | 마지막 갱신 시각 |

**제약조건**: `UNIQUE(knowledge_base_id, name, type)`

**인덱스**: `(knowledge_base_id, type)`, `(knowledge_base_id, mention_count DESC)`

### 2.12.3 Relation

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase (CASCADE) |
| head_entity_id | UUID | FK → Entity |
| tail_entity_id | UUID | FK → Entity |
| predicate | String | 관계 서술어 (예: `founded`, `employs`). P0 free-form, snake_case 권장 |
| evidence_chunk_id | UUID? | 추출 근거 청크 (FK → DocumentChunk) |
| weight | Integer | 동일 (head, predicate, tail) 가 여러 chunk 에서 발견된 누적 횟수 |
| created_at | Timestamp | 첫 추출 시각 |
| updated_at | Timestamp | 마지막 갱신 시각 |

**제약조건**: `UNIQUE(knowledge_base_id, head_entity_id, predicate, tail_entity_id)`

**인덱스**: `(knowledge_base_id, head_entity_id)`, `(knowledge_base_id, tail_entity_id)`

### 2.12.4 ChunkEntity

| 필드 | 타입 | 설명 |
|------|------|------|
| chunk_id | UUID | FK → DocumentChunk (CASCADE) |
| entity_id | UUID | FK → Entity (CASCADE) |
| mention_text | String? | 청크에서 등장한 원형 표기 (정규화 전) |

**제약조건**: `PRIMARY KEY (chunk_id, entity_id)`

**인덱스**: `(entity_id)` — entity → chunk 역방향 회수 (검색 expansion 단계)

### 2.13 Execution

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| trigger_id | UUID? | FK → Trigger (트리거에 의한 실행 시) |
| status | Enum | pending / running / completed / failed / cancelled / waiting_for_input |
| started_at | Timestamp | 실행 시작 시각 |
| finished_at | Timestamp? | 실행 종료 시각 |
| duration_ms | Integer? | 실행 소요 시간 |
| input_data | JSONB? | 실행 입력 데이터 |
| output_data | JSONB? | 실행 최종 출력 데이터 |
| error | JSONB? | 에러 정보. 최초 failed NodeExecution의 에러를 참조/복사 (아래 참조) |
| executed_by | UUID? | FK → User (수동 실행 시) |
| parent_execution_id | UUID? | FK → Execution (서브 워크플로우 실행 시 부모 실행) |
| recursion_depth | Integer | 서브 워크플로우 호출 깊이 (root = 0) |

> 실행된 노드의 순서(옛 `execution_path UUID[]` 컬럼)는 별도 append-only 테이블 **ExecutionNodeLog** (§2.13.1) 가 보관한다. 다중 인스턴스에서 동시 INSERT 시 절대 순서를 보장하지 못하던 array 컬럼 모델은 V036 에서 DROP 되었고, V035 에서 도입된 `execution_node_log` 가 대체한다.

### 2.13.1 ExecutionNodeLog

`(execution_id, id)` 정렬이 곧 노드 실행 순서. BIGSERIAL `id` 는 PostgreSQL sequence 가 부여하므로 다중 backend 인스턴스에서도 concurrency-safe 하다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL | PK. sequence 부여 순서가 곧 실행 순서 |
| execution_id | UUID | FK → Execution (ON DELETE CASCADE) |
| node_id | UUID | 실행된 노드 ID |
| created_at | TimestampTZ | append 시각 (기본 `NOW()`) |

**인덱스**: `(execution_id, id)` — 단일 execution 의 노드 순서 조회 (`findById` 가 `executionPath: string[]` 응답을 본 테이블의 정렬 쿼리로 채움).

### 2.14 NodeExecution

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| execution_id | UUID | FK → Execution |
| node_id | UUID | FK → Node |
| status | Enum | pending / running / completed / failed / skipped / waiting_for_input |
| started_at | Timestamp | 실행 시작 시각 |
| finished_at | Timestamp? | 실행 종료 시각 |
| duration_ms | Integer? | 소요 시간 |
| input_data | JSONB | 노드 입력 데이터 |
| output_data | JSONB? | 노드 출력 데이터 |
| error | JSONB? | 에러 정보 `{ code, message, stack? }` |
| retry_count | Integer | 재시도 횟수 |
| interaction_data | JSONB? | 사용자 인터랙션 기록 — Form 제출 또는 버튼 클릭 정보. `{ interactionType: "form_submit" \| "button_click" \| "button_continue", buttonId?, buttonLabel?, clickedAt, clickedBy }` |

**Execution.error ↔ NodeExecution.error 관계:**

| 항목 | 설명 |
|------|------|
| 원본 | NodeExecution.error — 개별 노드 실행 실패 시 기록 |
| 복사 | Execution.error — 워크플로우 실행이 `failed` 상태로 전이될 때, **최초 failed NodeExecution**의 에러 정보를 복사 |
| 구조 | `{ nodeId: "uuid", code: "ERROR_CODE", message: "에러 설명" }` |
| 용도 | 실행 목록에서 Execution 단위로 에러 원인을 즉시 파악 가능 (NodeExecution 조회 없이) |

### 2.15 WorkflowVersion

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| version | Integer | 버전 번호 |
| snapshot | JSONB | 워크플로우 전체 스냅샷 (nodes, edges, settings) |
| change_summary | String? | 변경 사항 요약 |
| created_by | UUID | FK → User |
| created_at | Timestamp | 생성 시각 |

### 2.16 LLMConfig

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| provider | String | 프로바이더 (openai, anthropic, local 등) |
| name | String | 사용자 지정 이름 |
| api_key | String (encrypted) | API Key (암호화 저장) |
| base_url | String? | 커스텀 엔드포인트 URL (로컬 모델용) |
| default_model | String | 기본 모델 ID |
| default_params | JSONB | 기본 파라미터 (temperature, max_tokens 등) |
| is_default | Boolean | 기본 프로바이더 여부 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.17 AuthConfig

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 인증 설정 이름 |
| type | Enum | api_key / bearer_token / basic_auth |
| config | JSONB (encrypted) | 인증 설정 상세 (암호화) |
| ip_whitelist | String[]? | 허용 IP 목록 |
| is_active | Boolean | 활성 상태 |
| last_used_at | Timestamp? | 마지막 사용 시각 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.18 AuditLog

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| user_id | UUID | FK → User |
| action | String | 수행 액션 (workflow.create, trigger.update 등) |
| resource_type | String | 대상 리소스 유형 |
| resource_id | UUID | 대상 리소스 ID |
| details | JSONB | 변경 상세 |
| ip_address | String | 요청 IP |
| created_at | Timestamp | 발생 시각 |

> AuditLog는 워크스페이스 단위 리소스 변경을 기록한다. 워크스페이스 컨텍스트가 없는 인증 이벤트(로그인 성공/실패, 세션 강제 종료 등)는 별도의 **LoginHistory** 테이블에 보관한다.

### 2.18.1 RefreshToken

세션 단위는 `family_id` 다. refresh 회전 시 row가 새로 발급되지만 동일 family는 하나의 "디바이스 세션"으로 간주한다. 사용자에게 노출되는 "활성 세션" 은 `is_revoked = false` 인 같은 family의 가장 최신 row 메타데이터를 보여준다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | FK → User (cascade) |
| token_hash | String | SHA-256(refresh_token), UNIQUE |
| family_id | UUID | 세션 식별자 (회전 시에도 유지) |
| is_revoked | Boolean | 강제/자연 만료 여부 |
| expires_at | Timestamp | 만료 시각 (7일 기본, rememberMe 시 30일) |
| device_label | String? | UA에서 파생된 표시 라벨 ("Chrome on macOS") |
| user_agent | String? | 발급 시점 raw UA |
| ip_address | String? | 발급 시점 클라이언트 IP (CF-Connecting-IP 우선) |
| last_used_at | Timestamp? | refresh 호출마다 갱신 |
| last_used_ip | String? | 마지막 활동 IP |
| created_at | Timestamp | 발급 시각 |

### 2.18.2 LoginHistory

인증 이벤트(로그인 성공·실패, TOTP 실패, 로그아웃, 세션 강제 종료, refresh token 재사용 감지)를 사용자 단위로 시간순 기록한다. 사용자가 직접 본인 이력을 조회한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID? | FK → User (cascade). 실패한 로그인에서 매칭 사용자가 없는 경우 NULL 가능 |
| email | String | 시도된 이메일 (enumeration 추적용) |
| event | Enum | login_success / login_failed / totp_failed / logout / session_revoked / token_reuse_detected |
| ip_address | String? | 클라이언트 IP |
| user_agent | String? | raw UA |
| device_label | String? | UA에서 파생된 표시 라벨 |
| family_id | UUID? | 관련 세션의 family_id (해당 시) |
| failure_reason | String? | INVALID_PASSWORD / ACCOUNT_LOCKED / TOTP_INVALID 등 |
| created_at | Timestamp | 발생 시각 |

보존 정책: 180일 경과 row는 일일 배치로 자동 삭제.

### 2.19 Notification

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| user_id | UUID | FK → User (수신자) |
| type | Enum | execution_failed / background_failed / schedule_failed / integration_expired / marketplace_update / team_invite |
| title | String | 알림 제목 |
| message | String | 알림 내용 |
| resource_type | String? | 관련 리소스 유형 (workflow, integration 등) |
| resource_id | UUID? | 관련 리소스 ID |
| is_read | Boolean | 읽음 여부 (기본: false) |
| channel | Enum | in_app / email / both |
| email_sent_at | Timestamp? | 이메일 발송 시각 |
| created_at | Timestamp | 생성 시각 |

### 2.20 AssistantSession

Workflow AI Assistant의 채팅 세션. 단일 워크플로우 단위로 존재하며, 페이지 새로고침/재접속 시에도 이어서 대화할 수 있다. 상세: [Spec 3-workflow-editor/4: AI Assistant](./3-workflow-editor/4-ai-assistant.md).

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace (cascade 삭제) |
| workflow_id | UUID | FK → Workflow (cascade 삭제) — 세션은 단일 워크플로우에 종속 |
| user_id | UUID | FK → User — 세션 생성자 |
| title | String? | 세션 제목 (첫 메시지 요약 또는 사용자 편집) |
| llm_config_id | UUID? | FK → LLMConfig — 지정 없으면 workspace default 사용 |
| status | Enum | active / archived — archived는 UI 상에서 숨김 |
| message_count | Int | 메시지 수 캐시 (비정규화) |
| last_interaction_at | Timestamp | 마지막 메시지/도구 호출 시각 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.21 AssistantMessage

AssistantSession에 속하는 개별 메시지. 사용자 입력, assistant 응답, 도구 호출 결과를 시간 순서대로 기록한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| session_id | UUID | FK → AssistantSession (cascade 삭제) |
| role | Enum | user / assistant / tool / system — 시스템 메시지는 감사/디버그용, 일반적으로 프롬프트 빌더가 매 요청마다 동적으로 조립하므로 저장되지 않음 |
| content | Text? | 사용자/어시스턴트 텍스트 본문. role=tool인 경우 null 가능 |
| tool_calls | JSONB? | role=assistant에서 함께 발행된 tool_call 목록. 각 항목: `{id, name, arguments, kind: 'explore'\|'plan'\|'edit', result, planStepId?}` |
| tool_call_id | String? | role=tool에서 어떤 tool_call의 결과인지 참조 |
| plan | JSONB? | `propose_plan` tool-call 발행 시 스냅샷. `{title, summary, steps[], openQuestions[], approvedAt?}` |
| usage | JSONB? | `{inputTokens, outputTokens, totalTokens, thinkingTokens?, model}` — role=assistant의 턴 종료 시점에만 채움 |
| finish_reason | String? | `stop` / `tool_calls` / `length` / `content_filter` / `aborted` — role=assistant에만 |
| created_at | Timestamp | 생성 시각 |

> `tool_calls[].result` 는 Shadow 검증 결과 또는 탐색 결과의 축약본을 담아 사용자가 히스토리에서 맥락을 재현할 수 있도록 한다. 단, 대용량 원본(예: 50MB 워크플로우)은 요약 형태로만 기록한다(§9.1).

---

## 3. 인덱스 전략

| 테이블 | 인덱스 | 목적 |
|--------|--------|------|
| Workflow | (workspace_id, is_active) | 워크스페이스별 활성 워크플로우 조회 |
| Workflow | (workspace_id, name) | 이름 검색 |
| Node | (workflow_id) | 워크플로우별 노드 조회 |
| Node | (container_id) | 컨테이너별 자식 노드 조회 |
| Node | (tool_owner_id) | AI Agent별 Tool Area 노드 조회 |
| Edge | (workflow_id) | 워크플로우별 엣지 조회 |
| Edge | (workflow_id, type) | 워크플로우별 엣지 유형 조회 |
| Edge | (source_node_id) | 노드별 아웃바운드 엣지 |
| Execution | (workflow_id, started_at DESC) | 워크플로우별 실행 이력 |
| Execution | (status) | 상태별 실행 조회 |
| NodeExecution | (execution_id) | 실행별 노드 실행 조회 |
| ExecutionNodeLog | (execution_id, id) | 단일 실행의 노드 진행 순서 조회 |
| Trigger | (workspace_id, type) | 유형별 트리거 조회 |
| Trigger | (workspace_id, endpoint_path) UNIQUE | Webhook URL 라우팅 (워크스페이스 단위 유니크) |
| Schedule | (next_run_at, is_active) | 스케줄러 다음 실행 대상 조회 |
| AuditLog | (workspace_id, created_at DESC) | 감사 로그 조회 |
| RefreshToken | (user_id, family_id) WHERE is_revoked = false | 사용자별 활성 세션 그룹 조회 |
| LoginHistory | (user_id, created_at DESC) | 사용자별 로그인 이력 조회 |
| LoginHistory | (email, created_at DESC) | 미가입 이메일 시도 추적 |
| Integration | (workspace_id, service_type) | 서비스별 연동 조회 |
| Integration | (workspace_id, name) UNIQUE | 워크스페이스 내 별칭 유일성 |
| AssistantSession | (workflow_id, status, last_interaction_at DESC) | 워크플로우별 최근 활성 세션 조회 |
| AssistantSession | (workspace_id, user_id, updated_at DESC) | 사용자별 세션 목록 |
| AssistantMessage | (session_id, created_at ASC) | 세션 내 메시지 시간순 페이징 |
| Integration | (workspace_id, status) | 만료/에러 상태 배지 카운트 + `pending_install` TTL 스캐너 조회 + 중복 방지 lookup 겸용 ([Spec 통합 화면 §6](./2-navigation/4-integration.md#6-상태-전이)) |
| Integration | (install_token) WHERE install_token IS NOT NULL | Cafe24 Private App URL (`/3rd-party/cafe24/install/:installToken`) 의 단일 row 식별. NULL 비저장 부분 인덱스로 인덱스 크기 최소화. V043 |
| Integration | (workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL UNIQUE | Cafe24 통합 중복 방지 SQL 강제 + workspace 별 mall lookup O(1). 한 workspace 안에서 같은 mall_id 의 cafe24 통합은 최대 1행 (public 과 private 동시 보유 불가). V046 (V045 컬럼 추가와 분리 — CONCURRENTLY 와 ALTER 가 한 마이그레이션에 공존 불가) |
| Integration | (token_expires_at) | 만료 스캐너 배치 조회 |
| IntegrationUsageLog | (integration_id, at DESC) | 연동별 최근 호출 이력 |
| IntegrationUsageLog | (at) | 보존기간 초과 레코드 정리 배치 |
| Folder | (workspace_id, parent_id) | 워크스페이스별 폴더 조회 |
| Notification | (user_id, is_read, created_at DESC) | 사용자별 미읽은 알림 조회 |
| Notification | (workspace_id, created_at DESC) | 워크스페이스별 알림 조회 |

## Rationale

### Execution.execution_path → ExecutionNodeLog (V035 → V036)

옛 `execution.execution_path UUID[]` 컬럼은 단일 인스턴스 환경에서는 동작했으나, 다중 backend 인스턴스가 동시에 `array_append()` 로 갱신할 때 인스턴스 간 절대 순서가 보장되지 않았다. 대체 모델로 append-only 테이블 `execution_node_log` 를 도입했고, BIGSERIAL `id` 가 PostgreSQL sequence (concurrency-safe) 로 부여되므로 `(execution_id, id)` 정렬이 곧 노드 실행 순서가 된다.

이행은 lock 영향 최소화를 위해 두 단계로 분리되었다.

- `backend/migrations/V035__execution_node_log_create.sql` — 테이블 생성 + `UNNEST WITH ORDINALITY` 로 기존 array 데이터 이행. `executeInTransaction=false`.
- `backend/migrations/V036__execution_drop_execution_path.sql` — 컬럼 DROP. `lock_timeout=3s` 로 운영 영향 최소화.

설계·운영 세부는 [`spec/5-system/4-execution-engine.md §7.4`](./5-system/4-execution-engine.md) 참고. 외부 API 응답의 `executionPath: string[]` 시그니처는 유지되며, `findById` 가 본 테이블의 정렬 쿼리로 채운다.

### install_token 형식 (32byte hex → 16byte base64url, 2026-05-15)

옛 32바이트 hex (64자) 는 Cafe24 Developers App URL 입력 필드의 100자 한도를 path prefix 단축만으로는 못 맞춰 함께 단축. 16바이트 (128-bit) 면 capability token 으로 NIST/OWASP 권장 (96-bit 이상) 을 충분히 상회. DB 컬럼 `install_token` 은 `String?` 으로 길이 제약이 없어 schema 변경 불필요 — 마이그레이션 entry 신규 추가 없음. 상세 배경·대안 비교는 [Spec 통합 화면 §9.2 Rationale "Cafe24 App URL 100자 한도 대응" 항](./2-navigation/4-integration.md#rationale).

```

#### `spec/2-navigation/0-dashboard.md`
```
# Spec: 대시보드

> 관련 문서: [Spec 레이아웃](./_layout.md) · [Spec 인증 플로우](./10-auth-flow.md) · [PRD 내비게이션](./_product-overview.md) · [Spec 워크플로우 목록](./1-workflow-list.md) · [Spec 실행 내역](./14-execution-history.md)

---

## 1. 개요

대시보드(`/dashboard`)는 로그인 후 최초 랜딩 화면이다. 워크플로우 상태와 최근 실행 이력을 한눈에 파악하고, 빠른 액션을 수행할 수 있다.

---

## 2. 화면 구성

```
┌────────────────────────────────────────────────────────────────┐
│  Dashboard                                  [+ New Workflow]   │
│  ──────────────────────────────────────────────────────────── │
│                                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Total WF │ │ Runs(7d) │ │ Success  │ │ Avg Time │         │
│  │   12     │ │    87    │ │  94.2%   │ │   4.3s   │         │
│  │ 10A / 2I │ │          │ │          │ │          │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                │
│  ┌─────────────────────────────┐ ┌──────────────────────────┐ │
│  │ Recent Workflows            │ │ Recent Executions        │ │
│  │ ─────────────────────────── │ │ ──────────────────────── │ │
│  │ 1. Data Sync       2m ago  │ │ Data Sync  ✅ 3.2s  14:02│ │
│  │ 2. Email Campaign  1h ago  │ │ Report Gen ❌ 1.0s  14:01│ │
│  │ 3. Report Gen      3h ago  │ │ Email Camp ✅ 5.1s  13:58│ │
│  │ 4. Email Notify    1d ago  │ │ Email Ntfy ✅ 0.8s  13:55│ │
│  │ 5. DB Backup       2d ago  │ │ ...                      │ │
│  │                             │ │                          │ │
│  │ [View All →]                │ │                          │ │
│  └─────────────────────────────┘ └──────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. 요약 카드

상단에 4개의 요약 카드를 가로 배치한다.

| 카드 | 표시 내용 | 설명 |
|------|-----------|------|
| Total Workflows | 총 워크플로우 수 + Active/Inactive 구분 | Active: 트리거가 활성화된 워크플로우, Inactive: 비활성 |
| Runs (7d) | 최근 7일 실행 횟수 | 전주 대비 증감 표시 (선택) |
| Success Rate | 최근 7일 성공률 (%) | `completed / (completed + failed) × 100` |
| Avg Time | 최근 7일 평균 실행 시간 | 단위: 초(s) 또는 분(m) 자동 전환 |

---

## 4. 최근 워크플로우

최근 수정 또는 실행 기준으로 상위 5개 워크플로우를 표시한다.

| 항목 | 설명 |
|------|------|
| 정렬 기준 | `max(updatedAt, lastExecutedAt)` 내림차순 |
| 표시 필드 | 워크플로우 이름, 마지막 활동 시간 (상대 시간) |
| 클릭 동작 | 워크플로우 에디터(`/workflows/:id`)로 이동 |
| "View All" 링크 | `/workflows` (워크플로우 목록)로 이동 |
| 빈 상태 | "No workflows yet. Create your first workflow!" + [+ New Workflow] 버튼 |

---

## 5. 최근 실행 이력

최근 실행 완료/실패 기준 10건을 표시한다.

| 열 | 설명 |
|----|------|
| 상태 | ✅ completed / ❌ failed / ⏳ running |
| 워크플로우 이름 | 실행된 워크플로우 이름 |
| 트리거 | 실행 출처(`subworkflow`/`manual`/`schedule`/`webhook`/`unknown`) 아이콘 + 라벨. 분류 규칙·보조 라벨 정책은 [실행 내역 spec §2.4 Trigger 출처 분류](./14-execution-history.md#trigger-출처-분류) 참조 |
| 소요 시간 | 실행 소요 시간 (초/분) |
| 시각 | 실행 완료 시각 (상대 시간 또는 HH:mm) |

| 동작 | 설명 |
|------|------|
| 행 클릭 | 해당 실행의 상세 페이지(`/workflows/:workflowId/executions/:executionId`)로 이동. 상세 스펙은 [Spec 실행 내역](./14-execution-history.md) 참조 |
| 빈 상태 | "No executions yet. Run a workflow to see results here." |

---

## 6. 빠른 액션

| 액션 | 위치 | 동작 |
|------|------|------|
| + New Workflow | 페이지 헤더 우측 | 새 워크플로우 생성 → 에디터로 이동 |

---

## 7. API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/dashboard/summary | 요약 카드 데이터 (워크플로우 수, 실행 횟수, 성공률, 평균 시간) |
| GET | /api/dashboard/recent-workflows | 최근 워크플로우 5건 |
| GET | /api/dashboard/recent-executions | 최근 실행 이력 10건 |

**응답 예시 — `/api/dashboard/summary`**:

```json
{
  "totalWorkflows": 12,
  "activeWorkflows": 10,
  "inactiveWorkflows": 2,
  "runs7d": 87,
  "successRate": 94.2,
  "avgExecutionTime": 4.3
}
```

---

## 8. 반응형

| 브레이크포인트 | 레이아웃 |
|----------------|----------|
| ≥ 1280px | 요약 카드 4열, 최근 워크플로우·실행 이력 2열 |
| 768px ~ 1279px | 요약 카드 2열, 최근 워크플로우·실행 이력 1열 (세로 스택) |
| < 768px | 요약 카드 1열, 최근 워크플로우·실행 이력 1열 |

```

#### `spec/2-navigation/1-workflow-list.md`
```
# Spec: 워크플로우 목록 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#31-workflow-list-워크플로우-목록) · [Spec 레이아웃](./_layout.md) · [Spec 캔버스](../3-workflow-editor/0-canvas.md) · [데이터 모델 - Workflow](../1-data-model.md#24-workflow)

---

## 1. 화면 구조

```
┌─────────────────────────────────────────────────────────┐
│  Workflows                         [+ New Workflow]     │
│                                                         │
│  ┌──────────────────┐  ┌──────┐  ┌─────────────────┐   │
│  │ 🔍 Search...     │  │Filter│  │ Sort: Updated ▼ │   │
│  └──────────────────┘  └──────┘  └─────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ● My Workflow 1            Active    2 min ago      │ │
│  │   3 nodes · webhook trigger            ⋮           │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ ○ Data Pipeline            Inactive  1 hour ago     │ │
│  │   12 nodes · schedule trigger          ⋮           │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ ● Shared: Team Bot        Active    5 min ago       │ │
│  │   8 nodes · webhook trigger   👥 Team  ⋮           │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│                    1  2  3  ... 10  →                    │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 기능 상세

### 2.1 워크플로우 목록 테이블

| 컬럼 | 내용 |
|------|------|
| 상태 표시 | Active(●초록) / Inactive(○회색) 아이콘 |
| 이름 | 워크플로우 이름. 클릭 시 에디터로 진입 |
| 트리거 요약 | 연결된 트리거 유형 및 개수 |
| 노드 수 | 워크플로우에 포함된 노드 수 |
| 마지막 실행 | 마지막 실행 시각 (상대 시간 표시) |
| 공유 표시 | 팀 워크스페이스에 속한 모든 워크플로우에 팀 뱃지(👥 Team) 표시. 개인 워크스페이스에서는 표시하지 않는다. ([Rationale §1](#rationale)) |
| 더보기 메뉴(⋮) | 편집, 복제, 활성/비활성 토글, 내보내기, 삭제 |

### 2.2 검색

- 워크플로우 이름 기준 실시간 검색 (debounce 300ms)
- 검색 결과가 없을 경우 "검색 결과가 없습니다" 메시지 표시

### 2.3 필터

| 필터 항목 | 옵션 | 비고 |
|-----------|------|------|
| 상태 | 전체 / Active / Inactive | 상시 노출 |
| 소유 | 내 워크플로우 / 공유된 워크플로우 / 전체 | **팀 워크스페이스 활성 시에만 노출**. "공유된 워크플로우" = `createdBy ≠ 현재 사용자`. 개인 워크스페이스에서는 필터 자체가 사라진다. UI 의 세 옵션은 서버 `GET /api/workflows?ownership=` 의 `mine` / `shared` / `all` 에 1:1 매핑된다 — 개인 워크스페이스 컨텍스트에서는 클라이언트가 파라미터를 보내지 않고, 받더라도 서버는 무시한다 |
| 태그 | 태그 멀티 선택 | 상시 노출 |
| 폴더 | 폴더 선택 (있을 경우) | 상시 노출 |

> 팀 뱃지(§2.1 공유 표시)는 워크스페이스 단위의 "공유" 정의를 따르고, 소유 필터는 그 안에서 내 것/남의 것을 다시 구분하는 보조 도구다. 두 정의가 어긋나지 않는 이유는 [Rationale §1](#rationale) 참고.

### 2.4 정렬

| 정렬 기준 | 방향 |
|-----------|------|
| 최근 수정순 (기본) | 내림차순 |
| 이름순 | 오름차순/내림차순 |
| 생성일순 | 내림차순 |
| 마지막 실행순 | 내림차순 |

### 2.5 새 워크플로우 생성

- "**+ New Workflow**" 버튼 클릭
- 워크플로우 이름 입력 다이얼로그 표시 (기본값: "Untitled Workflow")
- 생성 후 즉시 에디터로 진입

### 2.6 더보기 메뉴 액션

| 액션 | 동작 |
|------|------|
| 편집 | 에디터로 진입 |
| 복제 | 워크플로우 복사본 생성 (이름에 "(Copy)" 추가) |
| 활성/비활성 | 상태 토글. 비활성 시 트리거/스케줄 중지 |
| 내보내기 | JSON 파일로 다운로드 |
| 삭제 | 확인 다이얼로그 후 삭제. 연결된 트리거/스케줄도 함께 비활성화 |

### 2.7 빈 상태

- 워크플로우가 없을 때: 일러스트 + "첫 번째 워크플로우를 만들어 보세요" 메시지 + 생성 버튼
- 마켓플레이스 템플릿 추천 링크

---

## 3. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/workflows | 목록 조회 (쿼리: search, status, tag, sort, order, page, limit, ownership). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수. `ownership` 은 팀 워크스페이스 컨텍스트에서만 의미가 있으며 (`mine` / `shared` / `all`, default `all`), 개인 워크스페이스에서는 서버가 무시한다 (= `all` 처럼 동작) |
| POST | /api/workflows | 새 워크플로우 생성 |
| PATCH | /api/workflows/:id | 워크플로우 수정 (이름, 상태 등) |
| POST | /api/workflows/:id/duplicate | 워크플로우 복제 |
| DELETE | /api/workflows/:id | 워크플로우 삭제 |
| GET | /api/workflows/:id/export | JSON 내보내기 |
| POST | /api/workflows/import | JSON 가져오기 |

---

## Rationale

### 1. "공유 워크플로우" 의 정의 — 팀 워크스페이스 전체

NAV-WF-07 의 "공유" 기준으로 두 옵션을 검토했다:

- (a) **팀 워크스페이스에 속한 모든 워크플로우** = 공유 (선택)
- (b) `createdBy ≠ 현재 사용자` 또는 명시적 sharedWith 컬럼 = 공유 (폐기)

(a) 를 채택한 이유:

- PRD 의 NAV-WF-07 원문("팀 워크스페이스에서 공유된 워크플로우 구분 표시")이 워크스페이스 단위의 격리·공유를 전제로 하고 있어, 워크스페이스 = 공유 단위라는 정의와 자연스럽게 부합한다.
- 데이터 모델상 워크플로우 격리는 이미 `workspaceId` 로 처리되며(`backend/src/modules/workflows/entities/workflow.entity.ts`), `sharedWith` 컬럼이나 추가 마이그레이션 없이 구현 가능하다.
- (b) 는 같은 팀 안에서 "내 것" 과 "남의 것" 을 다시 분리하는 정의지만, 그 구분은 §2.3 의 **소유 필터** 가 담당하므로 뱃지에서까지 중복으로 표현할 필요가 없다.

결과적으로 뱃지(워크스페이스 = 공유)와 필터(작성자 단위 세분화)가 역할 분담된다.

```

#### `spec/2-navigation/10-auth-flow.md`
```
# Spec: 인증 UI 플로우

> 관련 문서: [PRD 비기능 요구사항 §2](../5-system/_product-overview.md#2-보안) · [Spec 인증/인가](../5-system/1-auth.md) · [Spec 사용자 프로필](./9-user-profile.md) · [데이터 모델 - User](../1-data-model.md#21-user)

---

## 1. 화면 구성 개요

인증 화면은 사이드바가 없는 **전체 화면 레이아웃**을 사용한다.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│              ┌────────────────────────┐                      │
│              │        [Logo]          │                      │
│              │                        │                      │
│              │    (인증 폼 영역)       │                      │
│              │                        │                      │
│              └────────────────────────┘                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- 중앙 정렬 카드 형태 (최대 너비 400px)
- 배경: 제품 브랜드 색상 또는 그래디언트
- 반응형: 모바일에서 카드가 전체 너비 확장

---

## 2. 회원가입 (Register)

### 2.1 화면

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Create your account           │
│                                  │
│    Name:     [______________]    │
│    Email:    [______________]    │
│    Password: [______________]    │
│              (패스워드 강도 바)    │
│                                  │
│    □ I agree to Terms of Service │
│                                  │
│    [      Create Account      ]  │
│                                  │
│    ─── or continue with ───      │
│                                  │
│    [🔵 Google] [⚫ GitHub]       │
│                                  │
│    Already have an account?      │
│    → Sign in                     │
└──────────────────────────────────┘
```

### 2.2 필드 검증

| 필드 | 검증 규칙 | 실시간 피드백 |
|------|-----------|--------------|
| Name | 필수, 2~50자 | 입력 즉시 |
| Email | 필수, 이메일 형식 | blur 시 형식 검증 + 중복 확인 API 호출 |
| Password | 필수, 최소 8자, 대소문자+숫자+특수문자 중 3가지 이상 | 입력 중 강도 바 표시 (약함/보통/강함) |
| Terms | 필수 체크 | 미체크 시 버튼 비활성화 |

### 2.3 비밀번호 강도 바

| 강도 | 조건 | 색상 |
|------|------|------|
| 약함 | 8자 미만 또는 1가지 문자 유형 | 빨강 |
| 보통 | 8자 이상 + 2가지 문자 유형 | 주황 |
| 강함 | 8자 이상 + 3가지 이상 문자 유형 | 초록 |

### 2.4 처리 플로우

```
1. 입력 검증 (클라이언트)
2. POST /api/auth/register { name, email, password, invitationToken? }
3. 성공 → 이메일 인증 안내 화면으로 이동 (단, invitationToken 흐름은 §2.6 분기 참고)
4. 실패 → 인라인 에러 표시 (이메일 중복, 토큰 만료/이메일 불일치 등)
```

### 2.6 초대 토큰을 통한 가입 (`?invitationToken=…`)

미가입자가 메일 링크를 클릭하면 회원가입 페이지는 `?invitationToken=…` 쿼리를 받아 다음 처리를 수행한다:

| 단계 | 처리 |
|------|------|
| 1. 토큰 메타 prefetch | `GET /api/invitations/:token` 로 워크스페이스 이름·초대자·이메일·만료 조회. 401/410 등 실패 → 에러 화면으로 라우팅 |
| 2. 이메일 prefill + readOnly | 응답의 `email` 을 입력란에 채우고 readOnly 로 고정. 다른 이메일로 가입 자체 차단 |
| 3. 헤더 안내 | "**{workspace}** 에 초대받으셨어요" + 초대자 이름 노출 |
| 4. 가입 제출 | `POST /api/auth/register { name, password, invitationToken }` — 이메일은 토큰에서 서버가 신뢰 |
| 5. 트랜잭션 처리 | 서버에서 [Spec 인증/인가 §1.5.2](../5-system/1-auth.md#152-흐름-미가입자-가입-경로) 의 단일 트랜잭션 (User 생성 + WorkspaceMember 추가 + invitation.acceptedAt) 수행. 실패 시 전체 롤백 |
| 6. 가입 성공 후 | 이메일 인증 안내 화면 대신 **초대된 워크스페이스로 컨텍스트 진입** (§6.1 의 개인 워크스페이스 자동 생성은 발화하지 않음) |
| 7. 에러 분기 | `invitation_email_mismatch` (서버가 거의 차단하지만 안전망), `invitation_expired`, `invitation_already_used` → "이 초대는 더 이상 유효하지 않아요. 워크스페이스 관리자에게 재발송을 요청하세요" 안내 |

### 2.5 이메일 인증 안내 화면

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    📧 Verify your email          │
│                                  │
│    We sent a verification link   │
│    to gehrig@example.com         │
│                                  │
│    [   Resend Email   ]          │
│                                  │
│    Didn't receive?               │
│    Check spam folder or          │
│    → use a different email       │
└──────────────────────────────────┘
```

- 이메일 인증 링크 클릭 → `GET /api/auth/verify-email?token={token}`
- 인증 성공 → 자동 로그인 + 개인 워크스페이스 생성 + 대시보드(`/dashboard`)로 리다이렉트
- 인증 토큰 유효기간: 24시간
- 재발송: 60초 쿨다운

---

## 3. 로그인 (Sign In)

### 3.1 화면

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Sign in to your account       │
│                                  │
│    Email:    [______________]    │
│    Password: [______________]    │
│                                  │
│    □ Remember me                 │
│    → Forgot password?            │
│                                  │
│    [        Sign In          ]   │
│                                  │
│    ─── or continue with ───      │
│                                  │
│    [🔵 Google] [⚫ GitHub]       │
│                                  │
│    Don't have an account?        │
│    → Create account              │
└──────────────────────────────────┘
```

### 3.2 처리 플로우

```
1. 입력 검증 (이메일 형식, 비밀번호 비어있지 않음)
2. POST /api/auth/login { email, password }
3. 2FA 미설정 → JWT 발급 → 대시보드(`/dashboard`)로 리다이렉트
4. 2FA 설정됨 → 2FA 입력 화면으로 이동 (임시 토큰 포함)
5. 로그인 실패 → "Invalid email or password" 에러 (구체적 이유 미노출)
6. 5회 실패 → 계정 10분 잠금 + "Account locked. Try again in 10 minutes."
```

### 3.3 "Remember me" 동작

| 체크 | Refresh Token 유효기간 |
|------|----------------------|
| 미체크 | 7일 (기본) |
| 체크 | 30일 |

### 3.4 2FA 입력 화면

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Two-factor authentication     │
│                                  │
│    Enter the 6-digit code from   │
│    your authenticator app        │
│                                  │
│    [  _  _  _  _  _  _  ]       │
│                                  │
│    → Use a recovery code         │
│                                  │
│    [       Verify            ]   │
│    [       ← Back            ]   │
└──────────────────────────────────┘
```

- 6자리 숫자 자동 포커스 이동
- `POST /api/auth/verify-2fa { tempToken, code }`
- 성공 → JWT 발급 → 리다이렉트
- 실패 → "Invalid code. Please try again."
- 복구 코드 입력 모드 전환 시 단일 입력 필드로 변경

---

## 4. 비밀번호 재설정 (Forgot Password)

### 4.1 Step 1: 이메일 입력

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Reset your password           │
│                                  │
│    Enter the email associated    │
│    with your account             │
│                                  │
│    Email: [______________]       │
│                                  │
│    [    Send Reset Link     ]    │
│    [    ← Back to Sign In   ]   │
└──────────────────────────────────┘
```

- `POST /api/auth/forgot-password { email }`
- **성공/실패 모두 동일 안내 화면** 표시 (이메일 존재 여부 노출 방지)

### 4.2 Step 2: 안내 화면

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    📧 Check your email           │
│                                  │
│    If an account exists for      │
│    gehrig@example.com,           │
│    we sent a password reset      │
│    link.                         │
│                                  │
│    [   Resend Email   ]          │
│    [   ← Back to Sign In   ]    │
└──────────────────────────────────┘
```

### 4.3 Step 3: 새 비밀번호 입력

이메일의 재설정 링크 클릭 시 표시:

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Set new password              │
│                                  │
│    New Password:                 │
│    [______________]              │
│    (패스워드 강도 바)              │
│                                  │
│    Confirm Password:             │
│    [______________]              │
│                                  │
│    [    Reset Password     ]     │
└──────────────────────────────────┘
```

- `POST /api/auth/reset-password { token, newPassword }`
- 성공 → "Password updated. Sign in with your new password." + 로그인 화면으로 이동
- 토큰 만료/무효 → "This link has expired. Request a new one." + 재요청 링크
- 재설정 토큰 유효기간: 30분
- 사용 후 토큰 즉시 무효화

---

## 5. OAuth 소셜 로그인

### 5.0 활성화된 Provider 노출

회원가입·로그인 화면 진입 시 서버에서 `GET /api/auth/oauth/providers` 를 호출하여 현재 자격증명이 설정된 provider 목록을 받는다.

| 응답 | UI 동작 |
|------|---------|
| `{ data: { providers: ["google", "github"] } }` | "Or continue with" 구분선과 두 버튼 모두 표시 |
| 일부만 포함 (예: `["google"]`) | 해당 버튼만 단일 컬럼으로 표시 |
| 빈 배열 `[]` | 구분선과 버튼 모두 비표시 (이메일/비밀번호 폼만 노출) |

- Provider 활성화 기준: `OAUTH_STUB_MODE=true` (개발) 또는 `{PROVIDER}_CLIENT_ID` 환경변수가 설정된 경우
- 응답은 `Cache-Control: public, max-age=300` 으로 5분 캐싱 (Next.js Server Component `fetch` 의 `revalidate: 300` 와 정합)
- 이 API 호출이 실패하면 안전 기본값으로 빈 배열 처리하여 SSO UI 비표시 (이메일/비밀번호 로그인은 정상 동작)

### 5.1 플로우

```
┌─────────┐     ┌─────────────┐     ┌────────────┐     ┌──────────┐
│ 클라이언트│────→│ 서버         │────→│ OAuth 제공자│────→│ 콜백 처리 │
│ (버튼)   │     │ /auth/oauth/ │     │ (Google 등)│     │          │
│          │     │ :provider   │     │            │     │          │
└─────────┘     └─────────────┘     └────────────┘     └──────────┘
     │                                                        │
     │              5. JWT 발급 + 리다이렉트                    │
     │←──────────────────────────────────────────────────────│
```

### 5.2 상세 단계

| 단계 | 동작 |
|------|------|
| 1 | 사용자가 "Continue with Google/GitHub" 버튼 클릭 |
| 2 | `GET /api/auth/oauth/:provider` → 서버가 OAuth URL 생성 (`state` 파라미터 포함) |
| 3 | 브라우저를 OAuth 제공자의 인증 페이지로 리다이렉트 (또는 팝업) |
| 4 | 사용자가 OAuth 제공자에서 인증 승인 |
| 5 | OAuth 제공자가 `GET /api/auth/oauth/:provider/callback?code=...&state=...`로 리다이렉트 |
| 6 | 서버가 `code`로 토큰 교환 → 프로필 조회 → 사용자 조회/생성 |
| 7 | JWT 발급 → 프론트엔드 리다이렉트 URL로 이동 (토큰은 HttpOnly Cookie) |

### 5.3 OAuth 콜백 처리 상세 (`/api/auth/oauth/:provider/callback`)

| 단계 | 처리 |
|------|------|
| state 검증 | 서버가 생성한 state 값과 일치하는지 확인 (CSRF 방지) |
| 코드 교환 | `code` → OAuth 제공자 토큰 엔드포인트에서 `access_token` 교환 |
| 프로필 조회 | `access_token`으로 사용자 프로필(이메일, 이름, 아바타) 조회 |
| 사용자 매칭 | 이메일로 기존 사용자 검색 |
| 기존 사용자 | OAuth 프로바이더 정보 연결 → 로그인 처리 |
| 신규 사용자 | 자동 회원가입 → 개인 워크스페이스 생성 → 로그인 처리 |
| JWT 발급 | Access Token + Refresh Token 발급 |
| 리다이렉트 | `{frontend_url}/callback?success=true&token={accessToken}` (Refresh Token은 httpOnly Cookie로 설정, Access Token은 짧게 URL 파라미터로 전달되며 클라이언트가 즉시 메모리에 저장 후 URL 정리) |

### 5.4 OAuth 에러 처리

| 에러 | 처리 |
|------|------|
| state 불일치 | `{frontend_url}/callback?error=invalid_state` |
| 코드 교환 실패 | `{frontend_url}/callback?error=token_exchange_failed` |
| 이메일 미제공 | `{frontend_url}/callback?error=email_required` (GitHub private email 등) |
| 서버 오류 | `{frontend_url}/callback?error=server_error` |

프론트엔드의 `/callback` 페이지:
- `success=true` + `token` → `setAccessToken(token)` 후 대시보드(`/dashboard`)로 리다이렉트
- `error=*` → 에러 메시지 표시 + "다시 시도" 버튼 + 로그인 화면 링크

---

## 6. 첫 워크스페이스 자동 생성

### 6.1 트리거 조건

아래 경우에 개인 워크스페이스가 자동 생성된다:

| 경로 | 조건 |
|------|------|
| 이메일 회원가입 | 이메일 인증 완료 시 **(단, `invitationToken` 으로 가입한 경우 제외 — 초대된 워크스페이스로 진입)** |
| OAuth 소셜 로그인 (최초) | 신규 사용자 자동 가입 시 |

> 초대 토큰으로 가입한 사용자는 초대된 팀 워크스페이스에 곧바로 멤버로 추가되므로 별도의 개인 워크스페이스를 자동 생성하지 않는다. 이후 사용자가 개인 워크스페이스를 원하면 워크스페이스 관리 화면에서 직접 만들 수 있다.

### 6.2 생성 규칙

| 항목 | 값 |
|------|-----|
| Workspace.name | "{사용자 이름}'s Workspace" |
| Workspace.slug | 사용자 이메일 로컬 파트 + 랜덤 4자리 (예: `gehrig-a1b2`) |
| Workspace.type | `personal` |
| WorkspaceMember.role | `owner` |
| Workspace.timezone | 브라우저 타임존 (Accept-Language 헤더에서 추론) 또는 `UTC` |

---

## 7. 인증 상태 관리

### 7.1 라우트 가드

| 라우트 | 인증 필요 | 미인증 시 |
|--------|-----------|-----------|
| `/auth/*` (로그인, 가입 등) | X | — |
| `/auth/callback` | X | — |
| 그 외 모든 라우트 | O | `/auth/login`으로 리다이렉트 (원래 URL을 `redirect` 파라미터에 보존) |

### 7.2 로그인 후 리다이렉트

- 로그인 성공 시 `redirect` 파라미터가 있으면 해당 URL로 이동
- 없으면 기본: `/dashboard` (대시보드)

### 7.3 로그아웃

1. `POST /api/auth/logout` 호출 (Refresh Token 무효화)
2. 클라이언트: Access Token 메모리에서 제거, Cookie 삭제
3. `/auth/login`으로 리다이렉트

---

## 8. API 엔드포인트

기존 [Spec 인증/인가](../5-system/1-auth.md#5-api-엔드포인트) 엔드포인트에 추가:

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/auth/register | 회원가입 (본문에 `invitationToken?` 동봉 시 [§2.6](#26-초대-토큰을-통한-가입-invitationtoken) 흐름) |
| GET | /api/invitations/:token | 초대 토큰 메타 조회 (가입 페이지 prefill 용, 인증 불요) |
| POST | /api/auth/verify-email | 이메일 인증 확인 (쿼리: token) |
| POST | /api/auth/resend-verification | 인증 이메일 재발송 |
| POST | /api/auth/login | 로그인 |
| POST | /api/auth/verify-2fa | 2FA 코드 검증 |
| POST | /api/auth/logout | 로그아웃 |
| POST | /api/auth/refresh | 토큰 갱신 |
| POST | /api/auth/forgot-password | 비밀번호 재설정 요청 |
| POST | /api/auth/reset-password | 비밀번호 재설정 |
| GET | /api/auth/oauth/providers | 활성화된 OAuth provider 목록 (UI 노출 제어용, 5분 캐싱) |
| GET | /api/auth/oauth/:provider | OAuth 시작 (리다이렉트) |
| GET | /api/auth/oauth/:provider/callback | OAuth 콜백 |
| POST | /api/auth/check-email | 이메일 중복 확인 (가입 폼 실시간 검증용) |

```

#### `spec/2-navigation/11-error-empty-states.md`
```
# Spec: 에러 페이지 / 빈 상태 UI

> 관련 문서: [Spec 레이아웃](./_layout.md) · [Spec 아키텍처 개요](../0-overview.md) · [Spec 에러 처리](../5-system/3-error-handling.md)

---

## 1. 에러 페이지

시스템 수준의 에러가 발생하면 전체 화면을 에러 페이지로 교체한다. 모든 에러 페이지는 **아이콘/일러스트 + 제목 + 설명 + CTA 버튼** 구조를 따른다.

### 1.1 공통 레이아웃

```
┌──────────────────────────────────────┐
│                                      │
│           (아이콘/일러스트)           │
│                                      │
│              제목 (H1)               │
│         설명 텍스트 (Body)           │
│                                      │
│           [ CTA 버튼 ]              │
│                                      │
└──────────────────────────────────────┘
```

- 화면 중앙 정렬
- 사이드바는 에러 유형에 따라 표시/숨김 (인증 관련 에러는 숨김)
- 다크/라이트 테마 모두 지원

### 1.2 에러 페이지 정의 (5종)

| 에러 | HTTP 코드 | 아이콘 | 제목 | 설명 | CTA |
|------|-----------|--------|------|------|-----|
| 세션 만료 | 401 | 🔒 자물쇠 | 세션이 만료되었습니다 | 보안을 위해 자동 로그아웃 되었습니다. 다시 로그인해주세요. | **다시 로그인** → 로그인 페이지 |
| 권한 없음 | 403 | 🚫 차단 | 접근 권한이 없습니다 | 이 페이지에 접근할 권한이 없습니다. 워크스페이스 관리자에게 문의하세요. | **워크스페이스 목록으로** → 워크스페이스 선택 화면 |
| 페이지 없음 | 404 | 🔍 돋보기 | 페이지를 찾을 수 없습니다 | 요청하신 페이지가 존재하지 않거나 이동되었습니다. | **대시보드로 이동** → 대시보드 |
| 서버 에러 | 500 | ⚠️ 경고 | 문제가 발생했습니다 | 서버에서 예기치 않은 오류가 발생했습니다. 잠시 후 다시 시도해주세요. | **다시 시도** → 현재 페이지 새로고침, **대시보드로 이동** → 대시보드 |
| 네트워크 오류 | — | 📡 연결 끊김 | 네트워크에 연결할 수 없습니다 | 인터넷 연결을 확인하고 다시 시도해주세요. | **다시 시도** → 현재 페이지 새로고침 |

### 1.3 에러 페이지 동작 규칙

| 규칙 | 설명 |
|------|------|
| 401 감지 | API 응답 401 수신 시 현재 페이지를 세션 만료 에러 페이지로 교체. 로그인 후 원래 URL로 리디렉트 |
| 403 감지 | API 응답 403 수신 시 권한 없음 에러 페이지 표시 |
| 404 감지 | 존재하지 않는 라우트 접근 또는 API 404 응답 시 표시 |
| 500 감지 | API 응답 5xx 수신 시 서버 에러 페이지 표시 |
| 네트워크 오류 | API 호출 실패 (네트워크 타임아웃, DNS 실패 등) 시 표시 |
| 사이드바 표시 | 401: 숨김, 403/404/500/네트워크: 표시 (로그인 상태 유지 중이므로) |

---

## 2. 빈 상태 (Empty State)

데이터가 없는 화면에서 사용자에게 안내 문구와 행동 유도 버튼을 표시한다.

### 2.1 공통 패턴

```
┌──────────────────────────────────────┐
│                                      │
│              (아이콘)                │
│                                      │
│           안내 문구 (Body)           │
│                                      │
│           [ CTA 버튼 ]              │
│                                      │
└──────────────────────────────────────┘
```

- 목록 영역 중앙에 표시
- 상단의 검색/필터 바는 유지
- 아이콘은 해당 리소스를 상징하는 라인 아이콘

### 2.2 화면별 빈 상태 정의

| 화면 | 아이콘 | 안내 문구 | CTA |
|------|--------|-----------|-----|
| Dashboard — 최근 워크플로우 | 워크플로우 아이콘 | 아직 워크플로우가 없습니다. 첫 워크플로우를 만들어보세요. | **워크플로우 만들기** → 워크플로우 생성 |
| Dashboard — 최근 실행 | 실행 아이콘 | 아직 실행 기록이 없습니다. 워크플로우를 실행하면 여기에 표시됩니다. | — (CTA 없음) |
| Workflows 목록 | 워크플로우 아이콘 | 워크플로우가 없습니다. 자동화를 시작하려면 새 워크플로우를 만들어보세요. | **새 워크플로우** → 워크플로우 생성 |
| Triggers 목록 | 트리거 아이콘 | 트리거가 없습니다. 워크플로우를 자동으로 시작하려면 트리거를 추가하세요. | **트리거 추가** → 트리거 생성 |
| Schedule 목록 | 달력 아이콘 | 스케줄이 없습니다. 워크플로우를 정기적으로 실행하려면 스케줄을 추가하세요. | **스케줄 추가** → 스케줄 생성 |
| Integration 목록 | 연결 아이콘 | 연동된 서비스가 없습니다. 외부 서비스를 연결하여 워크플로우에서 활용하세요. | **서비스 연결** → 연동 추가 |
| Executions 목록 | 실행 아이콘 | 실행 기록이 없습니다. 워크플로우를 실행하면 여기에서 결과를 확인할 수 있습니다. | **워크플로우 목록** → 워크플로우 목록 이동 |

### 2.3 검색 결과 없음

검색 또는 필터 적용 결과가 0건인 경우, 일반 빈 상태와 다른 메시지를 표시한다.

```
┌──────────────────────────────────────┐
│                                      │
│              🔍 아이콘               │
│                                      │
│   검색 결과가 없습니다.             │
│   다른 키워드로 검색하거나           │
│   필터를 변경해보세요.               │
│                                      │
│         [ 필터 초기화 ]             │
│                                      │
└──────────────────────────────────────┘
```

| 항목 | 설명 |
|------|------|
| 아이콘 | 돋보기 아이콘 |
| 안내 문구 | "검색 결과가 없습니다. 다른 키워드로 검색하거나 필터를 변경해보세요." |
| CTA | **필터 초기화** → 검색어 및 필터를 모두 초기화하여 전체 목록 표시 |
| 적용 범위 | 검색바 또는 필터가 존재하는 모든 목록 화면 공통 |

```

#### `spec/2-navigation/12-workflow-version-history.md`
```
# Spec: 워크플로우 버전 이력

> 관련 문서: [Spec 워크플로우 편집기](../3-workflow-editor/) · [데이터 모델 - WorkflowVersion](../1-data-model.md)

---

## 1. 개요

워크플로우 편집기 내부에서 캔버스의 변경 이력을 버전 단위로 추적·복원할 수 있다.

- **자동 스냅샷**: 사용자가 캔버스를 저장(`POST /workflows/:id/save`)할 때마다 서버는 동일 트랜잭션 직후 `workflow_version` 레코드를 자동으로 생성한다.
- **불변 스냅샷**: 각 버전은 저장 시점의 노드/엣지 전체 상태를 `jsonb` snapshot 으로 보관한다. 이후 캔버스가 바뀌어도 과거 버전은 변하지 않는다.
- **복원 가능**: 임의의 과거 버전을 현재 상태로 덮어쓸 수 있고, 복원 동작 자체가 새로운 버전으로 기록되어 “Restored from vN” 로 표기된다.

---

## 2. 진입점

워크플로우 편집기 우측 “⋯ (More)” 드롭다운 → **Version History** 항목을 클릭하면 우측에 사이드 패널이 열린다.

```
┌──── Editor Toolbar ────────────────────────── [Save] [Run▾] [⋯] ─┐
│ ...                                                              │
├────────────┬────────────────────────────┬────────────────────────┤
│  Palette   │   Canvas                   │   Version History 패널 │
│            │                            │   ─────────────────── │
│            │                            │   ☐ Compare versions  │
│            │                            │   v3 · 2026-04-14 ... │
│            │                            │   v2 · ...            │
│            │                            │   v1 · ...            │
└────────────┴────────────────────────────┴────────────────────────┘
```

---

## 3. 사이드 패널 동작

| 영역 | 동작 |
|------|------|
| 헤더 | 닫기(X) 버튼 |
| Compare 토글 | 활성 시 버전 항목에 체크박스 노출. 두 개 선택 후 "Diff" 버튼 클릭 → Diff 다이얼로그 열림 |
| 버전 항목 (목록 모드) | 버전 번호 / 작성자 / 생성 시각 / 변경 요약 + `상세(Eye)` · `복원(↺)` 액션 버튼 |
| 빈 상태 | "No versions yet. Save the canvas to create the first version." |
| 에러 상태 | "Failed to load versions" |

목록은 `version DESC` (최신 위) 정렬.

---

## 4. 상세 다이얼로그

선택한 버전의 snapshot 을 단일 다이얼로그에서 읽기 전용으로 표시한다.

- 워크플로우 메타 (이름, 설명)
- 노드 목록 (label / type / 좌표 / disabled 여부)
- 엣지 목록 (`source:port → target:port`)

---

## 5. Diff 다이얼로그

두 개의 버전을 동시에 fetch 하여 클라이언트 사이드로 비교한다. 낮은 버전이 “before”, 높은 버전이 “after”.

- **Name 변경**: before/after 강조
- **Added nodes / Removed nodes**: id 기준 비교
- **Modified nodes**: 동일 id 의 `label, type, category, positionX, positionY, config, isDisabled, description, containerId, toolOwnerId` 중 달라진 필드명 출력
- **Added edges / Removed edges**: `source:port → target:port` key 기준

---

## 6. 복원 다이얼로그

“복원” 액션 클릭 시 확인 다이얼로그 노출:

> The current canvas will be replaced with the snapshot from vN. The replacement is itself recorded as a new version, so you can always restore back.

확인 시 `POST /workflows/:id/versions/:versionId/restore` 호출. 성공하면 `workflow-versions` 쿼리 캐시 무효화 + **페이지 리로드**(편집기 in-memory 상태와 서버 상태가 완전히 교체되므로).

---

## 7. API 스펙

### 7.1 버전 목록

`GET /workflows/:wfId/versions`

응답: `WorkflowVersion[]` (version DESC). `creator` relation 포함.

### 7.2 버전 상세

`GET /workflows/:wfId/versions/:versionId`

응답: `WorkflowVersion` 단건 + `snapshot` 포함.

스냅샷 스키마:
```ts
interface VersionSnapshot {
  name: string;
  description: string | null;
  nodes: Array<{
    id: string;
    type: string;
    category: string;
    label: string;
    positionX: number;
    positionY: number;
    config: Record<string, unknown>;
    isDisabled: boolean;
    description: string | null;
    containerId: string | null;
    toolOwnerId: string | null;
  }>;
  edges: Array<{
    id: string;
    sourceNodeId: string;
    sourcePort: string;
    targetNodeId: string;
    targetPort: string;
    type: string;
    condition: Record<string, unknown> | null;
  }>;
}
```

### 7.3 복원

`POST /workflows/:id/versions/:versionId/restore`

응답: `{ workflow, nodes, edges }` (saveCanvas 와 동일).

### 7.4 캔버스 저장

`POST /workflows/:id/save` body 에 `changeSummary?: string` 필드 추가됨. 버전 이력에 그대로 표기된다.

---

## 8. 데이터 모델

`workflow_version` 테이블 (기존 정의):

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid (PK) | |
| workflow_id | uuid (FK→workflow, ON DELETE CASCADE) | |
| version | int | `(workflow_id, version)` UNIQUE |
| snapshot | jsonb | 위 스키마 |
| change_summary | text NULL | |
| created_by | uuid (FK→user) | |
| created_at | timestamptz | |

---

## 9. 동작 보장

- 캔버스 저장과 버전 생성은 동일 사용자 관점에서 **원자적으로 보여야** 한다. 캔버스 트랜잭션 커밋 직후 버전이 생성되며, 버전 생성 실패 시 (드물지만) 이미 캔버스는 저장된 상태이므로 다음 저장에서 자동으로 따라잡힌다.
- 워크플로우 삭제 시 `ON DELETE CASCADE` 로 모든 버전이 함께 삭제된다.
- 복원으로 생성되는 새 버전의 `change_summary` 는 항상 `Restored from vN` 형식.

```

#### `spec/2-navigation/13-user-guide.md`
```
# Spec: User Guide (`/docs`)

> 관련 문서: [PRD 내비게이션](./_product-overview.md) · [Spec 레이아웃](./_layout.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md) · [Spec 캔버스](../3-workflow-editor/0-canvas.md)

---

## 1. 목적

제품의 UI만으로는 파악이 어려운 개념(워크플로우 구조, 노드 종류, 표현식 언어, 실행/디버깅, 연동/설정)을 **제품 내부에서** 한글로 안내한다. 별도 외부 문서 사이트 대신 `/docs` 경로로 제공하여 에디터 작업 중 즉시 접근 가능하게 한다.

## 2. 정보 구조 (IA)

```
/docs
├── 01-getting-started/
│   ├── what-is-this       # 제품 소개
│   ├── ui-tour            # 화면 구성
│   └── first-workflow     # 첫 워크플로우 만들기
├── 02-nodes/
│   ├── overview           # 노드 개념
│   ├── triggers           # Trigger 노드
│   ├── logic              # Logic 노드
│   ├── flow               # Flow 노드
│   ├── data               # Data 노드
│   ├── ai                 # AI 노드
│   ├── integrations       # Integration 노드
│   └── presentation       # Presentation 노드
├── 03-workflow-editor/
│   ├── overview           # AI 어시스턴트 개요 (UI · 대화 루프 · 도구 · 세션 · v1 한계 · 오류)
│   └── walkthrough        # AI 어시스턴트 직접 써 보기 (자연어 → 4-노드 워크플로우)
├── 04-expression-language/
│   ├── basics             # 표현식 기본
│   ├── variables-and-context  # 변수·컨텍스트
│   └── cheatsheet         # 요약 치트시트
├── 05-run-and-debug/
│   ├── running-a-workflow # 실행 방법
│   ├── run-results        # 실행 이력 조회
│   ├── error-handling     # 에러 정책
│   └── version-history    # 버전 히스토리
├── 06-integrations-and-config/
│   ├── integration-management  # 통합 관리
│   ├── llm-config             # LLM 설정
│   ├── knowledge-base         # 지식 저장소
│   └── mcp-servers            # MCP 서버 통합 (AI Agent 도구 호출용)
├── 07-workspace-and-team/
│   └── workspaces-and-members  # 개인·팀 워크스페이스, 멤버 초대, 공유 표시
└── 99-faq/                     # 항상 사이드바 맨 아래 (§5 규칙)
    └── faq
```

## 3. 라우트

| 경로 | 동작 |
| --- | --- |
| `/docs` | 허브 페이지 — `/docs/01-getting-started/what-is-this`로 리다이렉트 (또는 섹션 카드 노출) |
| `/docs/[...slug]` | 동적 MDX 렌더링. 슬러그는 파일 경로와 1:1 (예: `/docs/02-nodes/ai` → `content/docs/02-nodes/ai.mdx`) |
| 존재하지 않는 슬러그 | `notFound()` 호출 → 표준 404 |

## 4. 프론트매터 스키마

모든 MDX 파일 상단에 아래 YAML 프론트매터를 둔다.

| 키 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- |
| `title` | 필수 | string | 페이지 제목. 사이드바와 본문 H1에 사용 |
| `section` | 필수 | string | 섹션 키 (예: `02-nodes`) — 디렉터리명과 일치 |
| `order` | 필수 | number | 섹션 내 정렬 기준 |
| `summary` | 필수 | string | 사이드바 미리보기 및 OG 설명 |
| `spec` | 선택 | string[] | 1차 소스 spec 파일 경로 |
| `code` | 선택 | string[] | 검증에 사용할 코드 경로(glob 허용) |
| `draft` | 선택 | boolean | true면 production 빌드에서 제외 |

예시:

```yaml
---
title: "AI 노드"
section: "02-nodes"
order: 6
summary: "자연어 처리·분류·추출 노드의 사용법을 알아봐요."
spec: ["spec/4-nodes/3-ai/0-common.md", "spec/5-system/7-llm-client.md"]
code: ["backend/src/nodes/ai/**", "frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx"]
---
```

## 5. 섹션 순서

섹션 디렉터리명의 숫자 프리픽스(`01-`, `02-` ...)가 사이드바 표시 순서를 결정한다. 페이지 내 순서는 `order`로 결정한다.

**FAQ 섹션은 항상 사이드바 맨 아래에 위치한다.** 신규 섹션이 자유롭게 `08-`, `09-` ... 로 늘어나더라도 FAQ 가 아래로 밀려나도록, FAQ 디렉터리는 `99-faq` 와 같이 충분히 큰 숫자 프리픽스를 사용한다. `registry.ts` 의 `SECTION_LABELS` 도 `99-faq` 키로 라벨을 등록한다.

## 6. 딥링크 규약

- 사이드바 네비·Empty State·FieldHelp·다른 매뉴얼 페이지 간 링크 모두 `/docs/<dir>/<slug>` 형태를 따른다.
- 페이지 내 앵커는 `rehype-slug`가 헤딩 텍스트를 슬러그화한 값으로 자동 생성한다(예: `/docs/02-nodes/ai#fallback`).
- 에디터에서 매뉴얼로 이동하는 링크는 새 탭(`target="_blank"`)으로 열어 작업 맥락을 보존한다.
- 매뉴얼 간 링크는 기본 탭 전환(`<Link>`)을 사용한다.

## 7. 작성 정책

| 항목 | 규칙 |
| --- | --- |
| 독자 | 비기술자 + 개발자 모두. 각 페이지 "랜딩 → 상세 → 팁/참고" 3층 구조 |
| 문체 | 정중한 해요체. 세부 원칙은 [`_glossary.md`](../../frontend/src/content/docs/_glossary.md) |
| 소스 | `spec/*.md` 를 1차 소스로 재작성. `backend/src/nodes/**` 스키마와 `frontend/src/components/editor/settings-panel/node-configs/*` 로 필드명 검증 |
| 이미지 | 텍스트·ASCII·코드 예시 우선. 스크린샷은 후속 작업 |
| 예제 표현식 | `{{ ... }}` 문법. `@workflow/expression-engine`이 파싱 가능한 문법이어야 함 |

## 8. 공용 MDX 컴포넌트

| 컴포넌트 | 용도 |
| --- | --- |
| `<Steps>` | 순서형 가이드. 자식은 `<li>` |
| `<FieldTable>` | 필드 표. 컬럼: 이름·필수·타입·설명·기본값 |
| `<Callout type="note\|tip\|warn">` | 강조 박스 |
| `<Example>` | 코드/표현식 예제. 언어 태그 필수 |

## 9. 네비게이션 생성

빌드타임에 `frontend/src/lib/docs/registry.ts`가 `frontend/src/content/docs/**/*.mdx`를 스캔해 섹션 트리를 만든다.

- 프론트매터 `draft: true`인 파일은 production에서 제외
- `_`로 시작하는 파일·디렉터리는 스캔에서 제외(예: `_glossary.md`)
- 섹션 디렉터리에 `index.mdx`가 있으면 해당 섹션의 랜딩 페이지

## 10. 접근·표시

| 항목 | 규칙 |
| --- | --- |
| 사이드바 표시 | 모든 로그인 사용자 (권한 제한 없음) |
| 비로그인 표시 | 현재는 로그인 필수(`(main)` 그룹이 보호됨). 차후 공개 경로로 분리 가능 |
| 검색 | 현재는 미포함. 콘텐츠 증가 시 별도 추가 |
| 인쇄용 CSS | 미포함 |

## 11. 성능

| 항목 | 기준 |
| --- | --- |
| 렌더 방식 | 서버 컴포넌트에서 MDX 정적 import — 빌드 시 HTML 사전 생성 |
| 클라이언트 번들 누수 방지 | MDX 컴파일러·`fs` 접근은 서버 전용. `'use client'` 파일에서 `@/content/**` import 금지 |
| 빌드 시 검증 | `registry.ts` 단위 테스트에서 모든 `spec:`/`code:` 경로 존재 확인 |

## 12. 품질 체크 (배포 전)

- 모든 MDX 프론트매터의 `spec:`/`code:` 경로 실존
- 용어 사전 준수(금지어 검사)
- 모든 내부 `/docs/...` 링크가 실존 slug
- `FieldHelp` 딥링크 앵커가 실존
- 페이지별 3층 구조 준수
- 해요체 일관성

```

#### `spec/2-navigation/14-execution-history.md`
```
# Spec: 워크플로우 실행 내역

> 관련 문서: [PRD 실행 내역](./14-execution-history.md) · [Spec 대시보드](./0-dashboard.md) · [Spec 워크플로우 목록](./1-workflow-list.md) · [Spec 실행/디버깅](../3-workflow-editor/3-execution.md) · [데이터 모델 - Execution](../1-data-model.md#213-execution)

---

## Overview (제품 정의)

> 출처: `prd/7-execution-history.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수.

---

### 1. 개요

워크플로우 실행 내역 기능은 사용자가 특정 워크플로우의 모든 실행 이력을 조회하고, 개별 실행의 노드별 상세 결과를 확인할 수 있는 기능이다. 대시보드, 워크플로우 목록, 에디터 등 다양한 진입점에서 접근할 수 있다.

#### 1.1 배경

현재 실행 결과는 워크플로우 에디터 내부에서만 확인할 수 있어, 과거 실행 이력을 돌아보거나 특정 워크플로우의 실행 패턴을 파악하기 어렵다. 대시보드의 Recent Executions에서 워크플로우를 클릭해도 아무 동작이 없으며, 실행 이력을 체계적으로 탐색할 수 있는 별도의 화면이 필요하다.

#### 1.2 목표

- 워크플로우별 실행 이력을 한눈에 파악
- 개별 실행의 노드별 상세 결과 확인 

... (truncated due to size limit) ...
