### 발견사항

---

**[WARNING] AI Agent 핸들러의 Tool Node 실행이 미구현 (Placeholder)**
- 위치: `ai-agent.handler.ts:84-91`
- 상세: `toolNodeIds`를 받아 tool calling loop를 구현하고 있지만, 실제 tool node 실행 대신 `"Tool ${tc.name} executed"` 플레이스홀더 응답을 반환함. `// In a full implementation, this would execute the tool node` 주석이 의도와 구현의 괴리를 명시적으로 드러냄. Tool calling 기능을 스펙에 포함시켰다면 미완성 상태.
- 제안: tool node 실행 로직 구현 또는 `toolNodeIds`/`toolOverrides` 설정 자체를 비활성화하고 스펙에서 명시적으로 제외

---

**[WARNING] AiAgentHandler 테스트에서 tool calling 플레이스홀더 동작 미검증**
- 위치: `ai-agent.handler.spec.ts`
- 상세: tool calling loop 관련 테스트가 전혀 없음. `toolNodeIds`가 설정되었을 때 실제 loop 동작, `maxToolCalls` 한계 도달 시나리오, tool result 응답 처리 등이 검증되지 않음.
- 제안: tool calling 관련 테스트 추가 (또는 해당 기능이 미완성임을 명시하고 향후 구현 예정 처리)

---

**[WARNING] document_chunk 테이블에 벡터 유사도 검색 인덱스 누락**
- 위치: `V005__document_chunk_pgvector.sql`
- 상세: `rag-search.service.ts`의 `<=>` (cosine distance) 연산자를 사용하는 쿼리에 대응하는 IVFFlat 또는 HNSW 인덱스가 없음. 데이터가 쌓이면 전체 테이블 스캔(sequential scan)이 발생하여 RAG 검색 성능이 급격히 저하됨.
- 제안:
  ```sql
  CREATE INDEX idx_document_chunk_embedding ON document_chunk 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  ```

---

**[WARNING] RAG 검색이 knowledge_base_id 필터 없이 document 테이블 JOIN으로 처리됨**
- 위치: `rag-search.service.ts:44-55`
- 상세: `WHERE d.knowledge_base_id = ANY($2::uuid[])` 조건이 document 테이블에 걸려 있는데, document_chunk 테이블에 `knowledge_base_id`가 직접 존재함에도 chunk 레벨 필터로 활용하지 않음. 쿼리 플래너가 JOIN 전에 필터를 적용하는 경우도 있지만 명시적으로 chunk 레벨에서도 필터링하면 더 안전.
- 제안: `AND dc.knowledge_base_id = ANY($2::uuid[])` 조건 추가

---

**[WARNING] llm.config.ts의 encryptionKey가 빈 문자열 기본값 허용**
- 위치: `llm.config.ts:4`
- 상세: `process.env.ENCRYPTION_KEY || ''`로 빈 문자열을 기본값으로 허용. `llm-config.service.ts`에서 `encryptionKey`가 없으면 `BadRequestException`을 던지지만, 서버 시작 시 검증이 없어 런타임에서야 오류가 감지됨.
- 제안: 애플리케이션 시작 시 `ENCRYPTION_KEY` 존재 여부를 validation하거나 `config.ts`에서 필수 환경변수로 처리

---

**[WARNING] EmbeddingService의 concurrency limiter가 blocking loop 사용**
- 위치: `embedding.service.ts:37-39`
- 상세: `while (this.activeTasks >= MAX_CONCURRENT) { await new Promise(resolve => setTimeout(resolve, 500)); }` 패턴은 busy-wait로 효율적이지 않음. NestJS의 비동기 특성상 큰 문제는 아니지만, 요청이 몰릴 경우 대기 작업이 누적됨.
- 제안: Queue 기반 처리(BullMQ 등) 또는 semaphore 패턴 적용 권장

---

**[INFO] InformationExtractorHandler에서 jsonSchemaProperties를 빌드하지만 LLM 호출에 미전달**
- 위치: `information-extractor.handler.ts:83-103, 106-112`
- 상세: `jsonSchemaProperties`를 상세히 구성하지만 실제 `llmService.chat()` 호출 시 `jsonSchema` 파라미터로 전달하지 않음. 구조화된 출력(Structured Output)을 강제하는 기능이 사실상 동작하지 않음.
- 제안: `chat()` 호출에 `jsonSchema: { type: 'object', properties: jsonSchemaProperties }` 추가

---

**[INFO] KnowledgeBaseController의 search endpoint가 인증/워크스페이스 격리 미검증 가능성**
- 위치: `knowledge-base.controller.ts:122-134`
- 상세: `POST /knowledge-bases/search`에서 `knowledgeBaseIds`를 body로 받아 `ragSearchService.search()`에 전달하는데, `workspaceId`로 필터링은 되지만 `RagSearchService`의 실제 SQL 쿼리에서 `knowledge_base`와 `workspace` 간 JOIN이 없어 다른 워크스페이스의 KB ID를 넘기면 해당 document까지 검색될 수 있음.
- 제안: RAG 검색 쿼리에 `JOIN knowledge_base kb ON kb.id = d.knowledge_base_id AND kb.workspace_id = $workspaceId` 조건 추가

---

**[INFO] Document.embeddingStatus가 string 타입으로 enum 제약 없음**
- 위치: `document.entity.ts:31-32`
- 상세: `embeddingStatus`가 `pending | processing | completed | error` 4가지 값을 가져야 하지만 `string` 타입으로 선언되어 있어 잘못된 값이 저장될 수 있음.
- 제안: TypeScript enum 또는 DB 레벨 constraint 추가

---

**[INFO] S3Service의 download 메서드에서 스트림 에러 처리 없음**
- 위치: `s3.service.ts:50-57`
- 상세: `for await (const chunk of stream)` 루프에서 스트림 에러가 발생하면 catch되지 않아 unhandled rejection이 될 수 있음.
- 제안: try/catch로 감싸거나 stream error 이벤트 핸들링 추가

---

### 요약

전반적으로 LLM 설정 관리(암호화), Knowledge Base CRUD, RAG 파이프라인, 다중 LLM 제공자 추상화의 핵심 구조는 잘 설계되어 있으나, **AI Agent의 tool calling 기능이 플레이스홀더로 미완성**인 점이 가장 큰 요구사항 미충족 사항입니다. 또한 pgvector 검색 인덱스 누락으로 프로덕션 규모에서 심각한 성능 문제가 예상되며, InformationExtractor가 JSON Schema를 구성하고도 실제 LLM에 전달하지 않아 구조화 출력 기능이 의도대로 동작하지 않습니다. 워크스페이스 격리 관련 보안 이슈도 RAG 검색 레이어에서 보완이 필요합니다.

### 위험도

**MEDIUM**