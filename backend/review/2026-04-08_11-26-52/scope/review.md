## 발견사항

### [WARNING] InformationExtractorHandler: 사용되지 않는 jsonSchemaProperties 빌드
- **위치**: `information-extractor.handler.ts:96-117`
- **상세**: `jsonSchemaProperties` 객체를 상세하게 구성하지만 `llmService.chat()` 호출 시 `jsonSchema` 파라미터로 전달되지 않음. 구조화된 출력 강제를 위해 설계된 것으로 보이나 실제로 동작하지 않는 dead code
- **제안**: `jsonSchema: jsonSchemaProperties` 파라미터를 chat 호출에 추가하거나, 해당 빌드 로직을 제거

### [WARNING] AiAgentHandler: Tool 실행이 stub으로 구현됨
- **위치**: `ai-agent.handler.ts:90-102`
- **상세**: tool call 루프가 실제 노드 실행 없이 `"Tool ${tc.name} executed"` 고정 문자열을 반환하는 placeholder로 구현됨. 주석("In a full implementation...")이 미완성 코드를 명시하고 있으나, 이 상태로 포함되면 실제 tool 사용 시 잘못된 결과 반환
- **제안**: 미구현 상태를 명확히 문서화하거나, `toolNodeIds`가 설정된 경우 명시적 에러를 던지도록 처리

### [WARNING] RagSearchService: workspaceId가 접근 제어에 사용되지 않음
- **위치**: `rag-search.service.ts:37-54`
- **상세**: `workspaceId`는 LLM config 조회에만 사용되고 벡터 검색 쿼리에서 KB의 workspace 소유권 검증에 사용되지 않음. `knowledgeBaseIds`가 외부에서 전달되는 경우 다른 workspace의 KB를 검색할 수 있는 잠재적 수평 권한 상승 가능성
- **제안**: WHERE 절에 `AND kb.workspace_id = $5` 조건 추가 (document_chunk → knowledge_base JOIN 필요)

### [WARNING] AzureOpenAIClient: private 필드 우회
- **위치**: `azure-openai.client.ts:12-20`
- **상세**: `(this as unknown as { client: OpenAI }).client`로 부모 클래스의 private 필드를 강제 덮어씀. 부모 클래스 구현 변경 시 조용히 깨지는 fragile한 패턴
- **제안**: `OpenAIClient`에 `protected` 생성자 파라미터를 추가하거나, Azure용 별도 생성자 오버로드를 제공

### [INFO] KnowledgeBaseController: debug 검색 엔드포인트 포함
- **위치**: `knowledge-base.controller.ts:114-132`
- **상세**: `POST /knowledge-bases/search`가 "debug endpoint"로 주석 처리됨. 인증/인가 검증 없이 직접 벡터 검색을 노출하는 엔드포인트가 프로덕션 코드에 포함
- **제안**: 프로덕션 포함 여부를 명확히 결정하고, 포함한다면 "debug" 주석 제거 및 적절한 scope/authorization 추가

### [INFO] LlmService.embed와 EmbeddingService 양쪽에서 배치 처리 중복
- **위치**: `llm.service.ts:38-47`, `embedding.service.ts:109-120`
- **상세**: `LlmService.embed`가 자체적으로 20개씩 배치 처리하는데, `EmbeddingService`에서도 별도로 20개씩 배치 처리. 이중 배치
- **제안**: `EmbeddingService`는 `LlmService.embed`에 전체 배열을 전달하고 배치 로직은 한 곳에만 유지

### [INFO] GoogleClient: tools에 any[] 타입 사용
- **위치**: `google.client.ts:46`
- **상세**: `const tools: any[]`로 타입 안전성 포기. 다른 클라이언트들과 달리 명시적 타입 불사용
- **제안**: `@google/generative-ai` SDK 타입 또는 명시적 인라인 타입 정의 사용

### [INFO] 누락된 마이그레이션 파일
- **위치**: `migrations/`
- **상세**: V005(document_chunk)만 리뷰에 포함. `knowledge_base`, `document`, `llm_config` 테이블의 마이그레이션 파일(V003/V004로 추정)이 리뷰 범위에 없음. 실제 존재하는지 확인 필요
- **제안**: 관련 마이그레이션 파일 모두 리뷰 대상에 포함

---

## 요약

전체적으로 변경 범위는 PRD/Spec의 AI Agent, Knowledge Base, LLM Config 기능 구현에 집중되어 있으며 무관한 파일 수정이나 불필요한 리팩토링은 발견되지 않음. 다만 `InformationExtractorHandler`의 dead code(jsonSchemaProperties 미사용), `AiAgentHandler`의 tool 실행 stub 포함, `RagSearchService`의 workspace 소유권 미검증이 스펙상 완성된 기능으로 포함되기에는 문제가 있으며, `AzureOpenAIClient`의 private 필드 우회 패턴은 유지보수 위험을 가져옴.

## 위험도

**MEDIUM**