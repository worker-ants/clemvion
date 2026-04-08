## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING] AzureOpenAIClient의 부모 클래스 private 필드 직접 접근**
- 위치: `azure-openai.client.ts` - constructor
- 상세: `(this as unknown as { client: OpenAI }).client = new OpenAI(...)` — 부모 클래스의 `private` 멤버를 타입 강제 캐스팅으로 재할당하는 것은 LSP(리스코프 치환 원칙) 위반이자 캡슐화 파괴입니다. 부모 클래스 구현에 의존하는 안티패턴입니다.
- 제안: `OpenAIClient` 생성자가 `client` 인스턴스를 파라미터로 받거나, `protected createClient()` 팩토리 메서드를 오버라이드할 수 있도록 구조를 변경하세요.

```ts
// OpenAIClient
constructor(apiKey: string, defaultModel: string, baseUrl?: string, clientOverride?: OpenAI) {
  this.client = clientOverride ?? new OpenAI({ apiKey, baseURL: baseUrl, timeout: 120_000 });
}
```

---

**[WARNING] EmbeddingService의 단일 책임 원칙 위반**
- 위치: `embedding.service.ts`
- 상세: 하나의 서비스가 ① 동시성 제어(concurrency limiter), ② S3 다운로드, ③ 텍스트 파싱, ④ 청킹, ⑤ 임베딩 생성, ⑥ DB 저장, ⑦ WebSocket 이벤트 발행까지 7가지 책임을 집니다. 변경 이유가 너무 많아 테스트와 유지보수가 어렵습니다.
- 제안: `DocumentProcessingOrchestrator` → `TextExtractionService` → `ChunkEmbeddingService` → `ChunkPersistenceService`로 책임을 분리하거나, 최소한 `doProcess` 내부를 각 단계별 private 메서드로 명확히 위임하세요.

---

**[WARNING] KnowledgeBaseController에 RAG 검색 디버그 엔드포인트 노출**
- 위치: `knowledge-base.controller.ts:108` — `@Post('search')`
- 상세: `// RAG Search (debug endpoint)` 주석이 달린 엔드포인트가 프로덕션 컨트롤러에 그대로 존재합니다. Body에 `knowledgeBaseIds`를 직접 수신하므로 권한 검증 없이 타 워크스페이스의 지식 베이스에 대한 검색 시도가 가능할 수 있습니다. 또한 컨트롤러가 `EmbeddingService`와 `RagSearchService` 모두를 직접 주입받아 두 가지 도메인을 혼재시킵니다.
- 제안: 디버그 엔드포인트는 제거하거나 별도의 AdminController로 이동하고, `knowledgeBaseIds`에 대해 요청 워크스페이스 소유권 검증 로직을 추가하세요.

---

**[WARNING] S3Service의 하드코딩된 기본값 (보안 위험)**
- 위치: `s3.service.ts:17-26`
- 상세: `accessKeyId` 기본값 `'minioadmin'`, `secretAccessKey` 기본값 `'minioadmin'`이 코드에 직접 박혀 있습니다. 환경변수가 누락된 채로 배포될 경우 개발용 자격증명이 프로덕션에서 사용될 수 있습니다.
- 제안: 기본값을 제거하고 필수값으로 처리하거나, 별도의 config 파일(`s3.config.ts`)로 분리하여 `ConfigModule`의 유효성 검증(`Joi` 스키마 등)을 통해 시작 시 실패하도록 하세요.

---

**[WARNING] EmbeddingService의 스핀 루프 동시성 제어**
- 위치: `embedding.service.ts:36-38`
- 상세: `while (this.activeTasks >= MAX_CONCURRENT) { await sleep(500); }` 패턴은 500ms 간격의 폴링 루프입니다. 인스턴스가 재시작되면 `activeTasks` 카운터가 초기화되어 실제 동시성 보장이 되지 않습니다. 수평 확장 시 완전히 무의미해집니다.
- 제안: 단기적으로는 `p-queue` 같은 검증된 큐 라이브러리를, 장기적으로는 BullMQ 같은 분산 큐를 도입하세요.

---

**[WARNING] LlmService의 이중 배치 처리**
- 위치: `llm.service.ts:38-47` vs `embedding.service.ts:105-115`
- 상세: `LlmService.embed()`에서 이미 20개 단위 배치 처리를 하고 있는데, `EmbeddingService.doProcess()`에서도 20개 단위로 직접 배치를 나눠 `llmService.embed()`를 반복 호출합니다. 배치 로직이 두 곳에 중복되어 있습니다.
- 제안: `EmbeddingService`에서 모든 청크 텍스트를 한 번에 `llmService.embed(chunks.map(c => c.content))`로 전달하고, 배치 처리는 `LlmService` 내부에서만 담당하도록 단일화하세요.

---

**[INFO] DocumentChunk 엔티티에 embedding 컬럼 누락**
- 위치: `document-chunk.entity.ts`
- 상세: `vector` 타입은 TypeORM이 지원하지 않아 raw SQL로 처리하는 것은 이해되지만, 엔티티에 `embedding` 필드 정의가 아예 없어 코드와 DB 스키마 간의 불일치가 문서화되어 있지 않습니다. `RagSearchService`에서 raw SQL로만 접근하므로 타입 안전성이 없습니다.
- 제안: 주석으로만 처리하는 대신 `typeorm-pgvector` 같은 확장 라이브러리 도입을 검토하거나, 최소한 엔티티 레벨에서 `@Column({ type: 'simple-array', select: false })` 등으로 컬럼 존재를 명시하세요.

---

**[INFO] LlmModule ↔ LlmConfigModule 양방향 forwardRef**
- 위치: `llm.module.ts`, `llm-config.module.ts`
- 상세: 두 모듈이 서로 `forwardRef()`로 참조하는 순환 의존성이 존재합니다. `LlmConfigController`가 `LlmService`를 직접 주입받기 때문에 발생한 구조입니다.
- 제안: `LlmConfigController`에서 `LlmService`를 제거하고, `/test`와 `/models` 엔드포인트를 별도의 `LlmController`(또는 `LlmConfigController` 내에서 `LlmConfigService`를 경유)로 이동시켜 순환 의존성을 제거하세요.

---

**[INFO] GoogleClient의 `any` 타입 사용**
- 위치: `google.client.ts:38`
- 상세: `const tools: any[] = []` — 타입 안전성이 없는 `any` 사용입니다.
- 제안: Google SDK의 `Tool` 타입으로 명시적으로 타이핑하세요.

---

**[INFO] llm.config.ts의 단일 설정 노출 범위**
- 위치: `llm.config.ts`
- 상세: 파일 이름은 `llm.config.ts`이지만 실질적으로는 암호화 키만 담고 있습니다. 다른 LLM 관련 설정(예: 기본 재시도 횟수, 타임아웃)이 서비스 코드에 하드코딩되어 있습니다(`llm.service.ts:maxRetries=3`, 클라이언트들의 `timeout: 120_000`).
- 제안: LLM 관련 공통 설정을 `llm.config.ts`로 중앙화하세요.

---

### 요약

전체적으로 LLM 멀티 프로바이더 추상화(`LLMClient` 인터페이스 + `LLMClientFactory`)와 RAG 파이프라인의 계층 분리는 잘 설계되어 있습니다. 그러나 `EmbeddingService`의 과도한 책임 집중, `AzureOpenAIClient`의 부모 클래스 캡슐화 위반, `LlmModule`과 `LlmConfigModule` 간의 순환 의존성, S3 자격증명 하드코딩 등 중요한 아키텍처 문제들이 존재합니다. 특히 동시성 제어를 인스턴스 내 카운터로 처리하는 구조는 수평 확장 시 근본적으로 동작하지 않으므로 분산 큐 도입을 조기에 검토해야 합니다.

### 위험도

**MEDIUM**