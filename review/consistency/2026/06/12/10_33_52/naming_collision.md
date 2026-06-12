# 신규 식별자 충돌 검토 결과

target: `spec/5-system/10-graph-rag.md`

---

## 발견사항

### [INFO] 요구사항 ID prefix `KB-GR-*` — 기존 사용 없음, 충돌 없음

- target 신규 식별자: `KB-GR-MD-*`, `KB-GR-EX-*`, `KB-GR-DM-*`, `KB-GR-SR-*`, `KB-GR-PA-*`, `KB-GR-UI-*`, `KB-GR-OB-*`, `NF-GR-*`
- 기존 사용처: `spec/2-navigation/_product-overview.md`, `spec/4-nodes/3-ai/_product-overview.md` 등에서 `NAV-*`, `ED-*`, `ND-*` prefix 를 사용. `KB-GR-` prefix 는 다른 문서에서 발견되지 않음.
- 상세: 충돌 없음. `KB-GR-` 는 Knowledge Base + Graph RAG 의 자연스러운 조합으로, 기존 `NAV-KB-*`(Knowledge Base 화면 요구사항)와 접두어가 다름.
- 제안: 없음.

---

### [INFO] 엔티티명 `Entity`, `Relation`, `ChunkEntity` — 데이터 모델에 이미 등록, 내용 일치

- target 신규 식별자: `Entity` (§2.3), `Relation` (§2.4), `ChunkEntity` (§2.5)
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/spec-ragsources-content/spec/1-data-model.md` §2.12.2, §2.12.3, §2.12.4 에서 동일 이름으로 정의됨
- 상세: target 이 정의한 스키마와 `1-data-model.md` 의 정의가 사실상 동일하다. target §2.3 의 `Entity` 와 data-model §2.12.2 의 `Entity`, target §2.4 의 `Relation` 과 data-model §2.12.3 의 `Relation`, target §2.5 의 `ChunkEntity` 와 data-model §2.12.4 의 `ChunkEntity` 가 모두 중복 정의 형태다. `1-data-model.md §2.12.2` 가 이미 `> 관련 문서: [Spec Graph RAG]` 를 명시적으로 인용하고 있어, data-model 이 SoT 임을 이미 구조적으로 선언하고 있다.
- 제안: 이미 구현된 문서이므로 즉시 변경 필요는 없으나, 향후 spec 갱신 시 target §2.3~§2.5 를 요약 참조형(`> 권위 정의는 spec/1-data-model.md §2.12.2~§2.12.4 — 아래는 Graph RAG 관점 요약`)으로 전환해 단일 진실 원칙을 유지하도록 권장.

---

### [INFO] 엔티티명 `GraphExtractionProcessor` / `GraphExtractionService` — 명명 일관성

- target 신규 식별자: `GraphExtractionProcessor` (§3.2), `GraphExtractionService` (§3.2 본문 및 §3.2 스텝)
- 기존 사용처: target 자체의 `code:` frontmatter 에 `queues/graph-extraction.processor.ts`(Processor), `graph/**`(Service 폴더) 를 나열. `8-embedding-pipeline.md §7.1.1` 에서 "`GraphExtractionService`" 명칭을 직접 사용.
- 상세: 충돌 없음. 기존 임베딩 계통의 `DocumentEmbeddingProcessor` / `EmbeddingService` 와 네이밍 패턴이 일치.
- 제안: 없음.

---

### [INFO] API endpoint `POST /api/knowledge-bases/:id/re-extract` — 기존 `re-embed` 패턴과 일관, 충돌 없음

- target 신규 식별자: `POST /api/knowledge-bases/:id/re-extract`, `POST /api/knowledge-bases/:id/documents/:docId/re-extract`, `POST /api/knowledge-bases/:id/retry-failed`, `GET /api/knowledge-bases/:id/graph/stats`, `GET /api/knowledge-bases/:id/graph/visualization`, `GET /api/knowledge-bases/:id/entities`, `GET /api/knowledge-bases/:id/entities/:entityId`, `DELETE /api/knowledge-bases/:id/entities/:entityId`, `GET /api/knowledge-bases/:id/relations`, `DELETE /api/knowledge-bases/:id/relations/:relationId`
- 기존 사용처: `8-embedding-pipeline.md §7.3` 에 `POST /api/knowledge-bases/:id/re-embed`, `POST /api/knowledge-bases/:id/documents/:docId/re-embed` 가 정의됨. Knowledge Base 화면 spec(`spec/2-navigation/5-knowledge-base.md §3`) 에 기존 KB CRUD 및 document CRUD endpoint 가 정의됨.
- 상세: 신규 endpoint 들은 `re-embed` 패턴과 다른 동사/경로를 사용해 충돌 없음. `retry-failed` 는 `2-navigation/5-knowledge-base.md §2.4.1` 에서 `POST /api/knowledge-bases/:id/retry-failed { scope: 'embedding' | 'graph' | 'all' }` 으로 이미 참조되고 있어 내용이 일치함.
- 제안: 없음.

---

### [INFO] WebSocket 이벤트명 `document:graph_*` — `document:embedding_*` 패턴과 일관, 충돌 없음

- target 신규 식별자: `document:graph_started`, `document:graph_progress`, `document:graph_completed`, `document:graph_retry`, `document:graph_failed` (§6)
- 기존 사용처: `8-embedding-pipeline.md §8.1` 에 `document:embedding_started`, `document:embedding_progress`, `document:embedding_completed`, `document:embedding_error`, `document:embedding_retry`, `document:embedding_failed` 가 정의됨. `6-websocket-protocol.md §3.2` 에 채널 패턴 `kb:{documentId}` 가 명시됨.
- 상세: `document:graph_*` 는 `document:embedding_*` 와 prefix 만 다른 동일 패턴. 채널도 동일하게 `kb:{documentId}` 를 사용 (target §6 에 명시, `8-embedding-pipeline.md §8` 에도 동일 채널 명시). 충돌 없음.
- 제안: 없음.

---

### [WARNING] `document:graph_error` dead-declared 이벤트 — 타입 union 에는 있으나 실제 미 emit

- target 신규 식별자: `document:graph_error` (§3.2 KB-GR-OB-02 주석, §6 주석)
- 기존 사용처: target §3.2 의 KB-GR-OB-02 에 "_`_error` 는 타입 union 에만 dead-declared, 미emit_" 로, §6 에 `document:graph_error` 는 `websocket.service.ts` 의 이벤트 타입 union 에 선언돼 있으나 실제로 emit 하지 않는다고 명시함.
- 상세: `8-embedding-pipeline.md §8.1` 에는 `document:embedding_error` 가 실제로 emit 되는 이벤트로 정의되어 있음. 반면 graph 계통의 `document:graph_error` 는 타입 union 에만 존재하고 실제 emit 이 없다. 이 비대칭은 코드 소비자가 `embedding_*` 패턴을 그대로 기대하여 `graph_error` 를 구독하면 아무 이벤트도 수신하지 못하는 혼동을 유발할 수 있다. (target 자체 주석이 dead-declared 임을 명시하고 있어 Critical 이 아닌 WARNING 으로 분류)
- 제안: `document:graph_error` 를 타입 union 에서 제거하거나, embedding 계통과 동일하게 실제 emit 로 전환하는 것을 검토. 현재 spec 이 이 비대칭을 의도적으로 문서화하고 있으므로, 최소한 `6-websocket-protocol.md §8.2` 의 그래프 이벤트 참조에 이 dead-declared 사실을 명시적으로 동기화해야 함.

---

### [INFO] `ragSources` 항목의 `origin` 필드 — `9-rag-search.md §4.1` 과 일관

- target 신규 식별자: `ragSources[].origin` 값 `"seed"` / `"expanded"` (§4.3)
- 기존 사용처: `9-rag-search.md §4.1` 에 `origin?` 필드가 `cosine` / `reranked` / graph 모드의 `seed` / `expanded` 로 정의됨. target §4.3 에도 `ragSources` 의 SoT 는 `9-rag-search.md §4.1` 임을 명시.
- 상세: 충돌 없음. `9-rag-search.md §4.1` 이 이미 graph 모드의 `seed`/`expanded` 값을 허용 enum 으로 포함하고 있으며, 이 값들이 target 에서 실제로 사용됨.
- 제안: 없음.

---

### [INFO] `graphTraversal` 필드 — 기존 `ragSources` 밖에 신규 추가, 충돌 없음

- target 신규 식별자: `graphTraversal` (§4.3 출력 메타데이터)
- 기존 사용처: `9-rag-search.md §4.1` 의 `ragSources` 스키마에 `graphTraversal` 필드가 없음. `ragDiagnostics` (§4.2) 에도 없음.
- 상세: target 이 `graphTraversal` 을 `ragSources` 밖의 별도 키로 분리하는 것은 기존 `ragSources`/`ragDiagnostics` 필드명과 충돌하지 않음. target §4.3 에 `graphTraversal` 의 단일 SoT 가 본 문서임을 명시 완료.
- 제안: 없음.

---

### [INFO] `GraphTraversalSummary` 타입명 — 기존 타입과 충돌 없음

- target 신규 식별자: `GraphTraversalSummary` (§3.4 KB-GR-SR-06)
- 기존 사용처: 다른 spec 에서 이 타입명 발견되지 않음.
- 상세: 충돌 없음.
- 제안: 없음.

---

### [INFO] `StuckDocumentRecoveryService` — 기존 명칭 패턴과 일관

- target 신규 식별자: `StuckDocumentRecoveryService` (§3.2 KB-GR-EX-10)
- 기존 사용처: `8-embedding-pipeline.md` 에는 동등한 embedding stuck 회수 로직이 있으나 별도 서비스 클래스명으로 명명되지 않음. target frontmatter `code:` 에 `stuck-document-recovery.service.ts` 가 나열됨.
- 상세: 충돌 없음.
- 제안: 없음.

---

### [INFO] 에러 코드 `KB_REEXTRACT_IN_PROGRESS` — 기존 `KB_REEMBED_IN_PROGRESS` 와 패턴 일치, 충돌 없음

- target 신규 식별자: `KB_REEXTRACT_IN_PROGRESS` (§7 에러 처리)
- 기존 사용처: `8-embedding-pipeline.md §7.3.2` 에 `409 KB_REEMBED_IN_PROGRESS` 가 정의됨.
- 상세: 동일 패턴의 별개 에러 코드. 충돌 없음.
- 제안: 없음.

---

### [INFO] 마이그레이션 파일 번호 `V025~V027`, `V037` — 기존 시퀀스 내 정상 위치

- target 신규 식별자: `V025__graph_rag.sql`, `V026__graph_extraction_status_nullable_index.sql`, `V027__relation_head_tail_index.sql`, `V037__kb_retry_failed_status.sql`
- 기존 사용처: `spec/0-overview.md §2.8`, `spec/1-data-model.md` 에 V022~V023, V030~V032, V037 등 다수 마이그레이션 번호 언급. `spec/data-flow/6-knowledge-base.md` 에 V022/V023/V030~V032 언급.
- 상세: V025~V027 은 V023 과 V030 사이에 위치하므로 정상적인 시퀀스. V037 은 V032 이후에 위치. frontmatter `code:` 에 나열된 파일명들이 실제 구현 완료 상태(`status: implemented`)와 일치. 충돌 없음.
- 제안: 없음.

---

### [INFO] 파일 경로 `spec/5-system/10-graph-rag.md` — 기존 명명 컨벤션 준수

- target 신규 식별자: `spec/5-system/10-graph-rag.md`
- 기존 사용처: `spec/0-overview.md §4 문서 맵` 에 이미 `Graph RAG | (Overview 섹션 통합) | ./5-system/10-graph-rag.md` 로 등재됨. `spec/5-system/` 디렉터리의 다른 파일들은 `1-auth.md`, `8-embedding-pipeline.md`, `9-rag-search.md` 등 정수 prefix 패턴.
- 상세: 충돌 없음. 명명 컨벤션(정수 prefix + kebab-case) 준수. `spec/0-overview.md` 의 문서 맵에도 이미 등재됨.
- 제안: 없음.

---

## 요약

`spec/5-system/10-graph-rag.md` 가 도입하는 신규 식별자들(요구사항 ID `KB-GR-*`/`NF-GR-*`, 엔티티명 `Entity`/`Relation`/`ChunkEntity`, API endpoint 군, WebSocket 이벤트 `document:graph_*`, 타입명, 에러 코드, 마이그레이션 파일명, 파일 경로)은 기존 spec 코퍼스와 충돌하지 않는다. 주목할 점은 (1) `Entity`/`Relation`/`ChunkEntity` 스키마 정의가 `spec/1-data-model.md §2.12.2~§2.12.4` 와 이중으로 존재해 단일 진실 원칙 관점에서 향후 정리가 필요하고, (2) `document:graph_error` 이벤트가 타입 union 에만 dead-declared 되어 있어 `document:embedding_error` 와 비대칭인 점이 소비자 혼동 리스크를 일부 내포한다. 두 항목 모두 target 자체 주석이 비대칭 사실을 명시하고 있어 즉각적 차단 수준은 아니다.

## 위험도

LOW
