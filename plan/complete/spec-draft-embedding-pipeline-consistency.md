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
| §6.2 DDL 예시 | IVFFlat 단일 인덱스 | DDL 코드블록 유지 + 노트 "실제 운영 인덱스는 V022/V023(/V030~V032, `spec/data-flow/6-knowledge-base.md §2.3` 참조) 으로 차원별 partial HNSW(vector / halfvec) 분리. 본 DDL 은 컨셉 예시" 추가 |
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
| §2.12.1 DocumentChunk 인덱스 | `ivfflat (embedding vector_cosine_ops) — 유사도 검색 성능` | `차원별 partial HNSW (V022 vector + V023 halfvec, V030~V032 후속 정비) — 유사도 검색 성능. 마이그레이션 상세는 spec/data-flow/6-knowledge-base.md §2.3 및 backend/migrations/ 참조` |

### 5. `spec/5-system/10-graph-rag.md` (신규 추가 대상)

| 위치 | 현재 | 변경 |
|---|---|---|
| §2.3 / §4.2 KB-GR-OB-02 (line 37, 123) | "WebSocket 이벤트 (... `kb:graph_stats_updated`)" / "✅ (`kb:graph_stats_updated` 등)" | `kb:graph_stats_updated` 언급 제거. "그래프 통계 카운트는 `document:graph_completed` payload 의 `entityCount` / `relationCount` 또는 REST `GET /:id/graph/stats` 폴링으로 조회" 로 교체 |
| §6 이벤트 표 헤더 | "기존 `document:embedding_*` 이벤트와 같은 패턴으로 다음을 추가한다." | 채널 명시 추가: "채널 `kb:{documentId}` 로 broadcast (8-embedding-pipeline.md §8 과 동일)." |
| §6 이벤트 표 line 527 | `kb:graph_stats_updated` 행 | **행 삭제** (dead path) |

### 6. `spec/data-flow/6-knowledge-base.md` (신규 추가 대상)

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
