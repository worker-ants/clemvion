## 성능 코드 리뷰

### 발견사항

---

**[CRITICAL] LLM 클라이언트 인스턴스 매 호출마다 생성**
- 위치: `llm.service.ts:24` `createClient()`
- 상세: `chat()`, `embed()`, `testConnection()`, `listModels()` 호출 시마다 새 SDK 클라이언트 인스턴스가 생성됨. OpenAI/Anthropic 클라이언트는 내부적으로 HTTP 커넥션 풀을 관리하므로, 매번 재생성하면 커넥션 풀 재설정 오버헤드 및 TLS handshake가 반복 발생.
- 제안: `Map<configId, LLMClient>` 캐시를 LlmService에 두고, 동일 configId에 대해 클라이언트를 재사용. 설정 변경 시 캐시 무효화.

```ts
private readonly clientCache = new Map<string, LLMClient>();

createClient(config: LlmConfig): LLMClient {
  const cached = this.clientCache.get(config.id);
  if (cached) return cached;
  const client = this.clientFactory.create(...);
  this.clientCache.set(config.id, client);
  return client;
}
```

---

**[CRITICAL] embedding 이중 배치 처리**
- 위치: `llm.service.ts:38-44`, `embedding.service.ts:105-117`
- 상세: `EmbeddingService.doProcess()`에서 20개 단위 배치로 `llmService.embed()`를 호출하는데, `LlmService.embed()` 내부도 20개 단위로 다시 배치 분할. 즉 20개짜리 배치 1개를 넘기면 내부에서 또 1개 배치로 처리 — 중복 루프 + 불필요한 배열 슬라이싱 오버헤드.
- 제안: `LlmService.embed()`의 내부 배치 처리를 제거하거나, 호출부인 `EmbeddingService`에서 배치 없이 전체 텍스트 배열을 넘기고 `LlmService`에서만 배치 처리.

---

**[WARNING] 벡터 유사도 계산이 인덱스를 활용하지 못할 가능성**
- 위치: `V005__document_chunk_pgvector.sql`
- 상세: `embedding vector(1536)` 컬럼에 pgvector IVFFlat 또는 HNSW 인덱스가 없음. `rag-search.service.ts`의 쿼리는 `<=>` 코사인 거리 연산자를 사용하므로, 인덱스 없이 수백만 행 순차 스캔(seqscan) 발생.
- 제안: 마이그레이션에 HNSW 인덱스 추가:
```sql
CREATE INDEX idx_document_chunk_embedding 
ON document_chunk USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

---

**[WARNING] Google 클라이언트 embed()에서 N+1 API 호출**
- 위치: `google.client.ts:107-113`
- 상세: 텍스트 배열을 받아 `for` 루프로 텍스트 하나씩 API 호출. 20개 청크 처리 시 20번 HTTP 요청.
- 제안: Google의 `batchEmbedContents()` API 활용으로 단일 호출로 처리:
```ts
async embed(texts: string[], model?: string): Promise<number[][]> {
  const embeddingModel = this.genAI.getGenerativeModel({ model: model || 'text-embedding-004' });
  const result = await embeddingModel.batchEmbedContents({
    requests: texts.map(text => ({ content: { parts: [{ text }] } })),
  });
  return result.embeddings.map(e => e.values);
}
```

---

**[WARNING] document_chunk 삽입 시 N개의 개별 INSERT**
- 위치: `embedding.service.ts:121-136`
- 상세: 청크마다 개별 `queryRunner.query(INSERT ...)`를 실행. 500개 청크면 500번 DB 왕복.
- 제안: 단일 bulk INSERT:
```sql
INSERT INTO document_chunk (document_id, knowledge_base_id, content, chunk_index, embedding, token_count, metadata)
VALUES ($1, $2, $3, $4, $5::vector, $6, $7), ($8, ...), ...
```
또는 `COPY` 명령 사용. 최소한 트랜잭션 내 prepared statement 재사용.

---

**[WARNING] 폴링 기반 동시성 제어**
- 위치: `embedding.service.ts:37-40`
- 상세: `while (this.activeTasks >= MAX_CONCURRENT) { await sleep(500) }` — 500ms 폴링은 지연 편차가 크고 CPU 낭비. 동시에 여러 요청이 대기 중이면 FIFO 순서 보장 안 됨.
- 제안: Semaphore 패턴이나 queue(예: `p-limit`, `p-queue` 라이브러리) 사용.

---

**[WARNING] RAG 검색 시 매번 embedding 호출**
- 위치: `rag-search.service.ts:29-35`
- 상세: 동일한 쿼리 문자열로 반복 검색 시 매번 LLM embedding API를 호출. AI Agent 노드에서 동일 사용자 입력으로 여러 번 실행될 경우 비용/지연 낭비.
- 제안: 쿼리 embedding에 단기 캐시(LRU, TTL 5분) 적용.

---

**[WARNING] S3 대용량 파일 전체 메모리 로딩**
- 위치: `s3.service.ts:44-52`, `embedding.service.ts:86`
- 상세: `download()`가 파일 전체를 `Buffer.concat(chunks)`로 메모리에 적재. 50MB 파일이면 Node.js 힙에 50MB 버퍼 상주. 동시 처리 3개면 최대 150MB.
- 제안: 파싱이 스트리밍을 지원하는 경우(txt, md, csv) Readable 스트림을 직접 파서에 전달. PDF는 불가피하지만 나머지는 스트리밍 처리 고려.

---

**[INFO] text-chunker에서 문자열 연결 방식**
- 위치: `text-chunker.ts:52`, `pushChunk()`
- 상세: `overlap + ' ' + content` — 문자열이 크면 새 문자열 할당. 청크가 수백 개면 미미하지만, 큰 오버랩이 있을 경우 불필요한 복사 발생.
- 제안: `content.trim()` 직접 저장 후 검색 시 오버랩 처리, 또는 현재 구조 유지(허용 가능한 수준).

---

**[INFO] LlmConfigService.maskApiKey()가 findAll() 루프에서 매번 복호화 실행**
- 위치: `llm-config.service.ts:46`
- 상세: 목록 조회 시 각 설정마다 AES 복호화 수행. 설정이 많지 않아 실제 영향은 낮으나, 복호화 실패 시 조용히 `****` 반환으로 버그 숨김 가능성.
- 제안: 현재 규모에서는 허용 가능. 단, `try/catch` 내에서 오류 로깅 추가 권장.

---

### 요약

가장 심각한 성능 문제는 두 가지다: (1) LLM 클라이언트가 매 호출마다 재생성되어 커넥션 풀 이점을 잃는 것, (2) pgvector 인덱스 미설정으로 인한 벡터 유사도 검색의 전체 테이블 스캔. 이 두 가지는 프로덕션 환경에서 지연 시간과 비용에 즉각적인 영향을 준다. 그 외 document_chunk 개별 INSERT, Google embedding N+1 호출, 폴링 기반 동시성 제어는 데이터 규모가 커질수록 병목이 될 가능성이 높다. S3 대용량 파일 전체 메모리 로딩은 현재 50MB 제한에서는 관리 가능하지만, 동시 처리 증가 시 위험 요소가 된다.

### 위험도

**HIGH**