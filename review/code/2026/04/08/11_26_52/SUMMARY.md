파일 쓰기 권한이 없어 직접 출력합니다.

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 보안(IDOR, 자격증명 하드코딩, 파일 검증 미흡), 성능(벡터 인덱스 누락, N+1 쿼리), 핵심 서비스 테스트 전무, 동시성 경쟁 조건 등 즉시 수정이 필요한 다수의 HIGH/CRITICAL 이슈 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | S3 자격증명 하드코딩 (`minioadmin`/`minioadmin`) — 환경변수 미설정 시 개발용 자격증명이 프로덕션에 그대로 사용됨 | `s3.service.ts` constructor | fallback 기본값 제거, 환경변수 미설정 시 앱 시작 실패 처리 |
| 2 | 성능 | LLM 클라이언트가 매 호출마다 새 인스턴스 생성 — HTTP 커넥션 풀 이점 없음, TLS handshake 반복 | `llm.service.ts:24` `createClient()` | `Map<configId, LLMClient>` 캐시 도입, 설정 변경 시 캐시 무효화 |
| 3 | 동시성 | `EmbeddingService.activeTasks` busy-wait TOCTOU — `await` 후 컨텍스트 전환 시 `MAX_CONCURRENT` 초과 가능 | `embedding.service.ts:36-40` | `p-limit` 라이브러리 또는 세마포어 패턴으로 교체 |
| 4 | 테스트 | `S3Service` 테스트 전무 — upload/download/delete 및 스트림 에러 케이스 미검증 | `s3.service.ts` | `s3.service.spec.ts` 작성, AWS SDK mock 사용 |
| 5 | 테스트 | `EmbeddingService` 테스트 전무 — 가장 복잡한 비즈니스 로직(파싱→청킹→임베딩→저장→이벤트)이 완전 미검증 | `embedding.service.ts` | Repository, S3Service, LlmService, DataSource mock 후 전체 흐름 테스트 |
| 6 | 테스트 | `RagSearchService` 테스트 전무 — 벡터 유사도 쿼리, 임계값 필터링, 에러 처리 미검증 | `rag-search.service.ts` | `rag-search.service.spec.ts` 작성 |
| 7 | 테스트 | `KnowledgeBaseService` 테스트 전무 — CRUD, 파일 타입 검증, S3 연동, documentCount 갱신 미검증 | `knowledge-base.service.ts` | Repository·S3Service mock 후 각 메서드 테스트 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | DB/성능 | pgvector 벡터 유사도 검색 인덱스(HNSW/IVFFlat) 누락 — `<=>` 연산 시 전체 테이블 순차 스캔 | `V005__document_chunk_pgvector.sql` | `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)` 추가 |
| 2 | 보안 | RAG 검색 IDOR — `knowledgeBaseIds`에 대한 workspace 소유권 검증 없어 타 워크스페이스 KB 데이터 열람 가능 | `rag-search.service.ts:40-52` | SQL에 `JOIN knowledge_base kb ON kb.id = dc.knowledge_base_id AND kb.workspace_id = $N` 추가 |
| 3 | DB/성능 | document_chunk 개별 INSERT N+1 — 청크 수백 개를 트랜잭션 내 반복 INSERT | `embedding.service.ts:127-147` | 단일 bulk INSERT 또는 `unnest` 활용 |
| 4 | 기능 | `AiAgentHandler` tool 실행이 stub — `"Tool X executed"` 고정 문자열 반환, 실제 노드 실행 없음 | `ai-agent.handler.ts:90-102` | 미구현 명시 또는 `toolNodeIds` 설정 시 명시적 예외 발생 |
| 5 | 기능 | `InformationExtractorHandler`에서 `jsonSchemaProperties` 빌드 후 LLM 호출 시 미전달 — 구조화 출력 기능 무효 | `information-extractor.handler.ts:83-112` | `chat()` 호출에 `jsonSchema: { type: 'object', properties: jsonSchemaProperties }` 추가 |
| 6 | 아키텍처 | `AzureOpenAIClient`가 부모 private 필드를 `(this as unknown as {...}).client`로 강제 덮어씀 | `azure-openai.client.ts:11-20` | `OpenAIClient` 생성자에 `clientOverride?: OpenAI` 파라미터 추가 또는 `protected` 필드로 변경 |
| 7 | 보안 | `LlmConfigService.update()`에서 `encryptionKey` 존재 검증 없음 — 빈 키로 암호화 가능 | `llm-config.service.ts:update()` | `create()`와 동일하게 `apiKey` 처리 전 `encryptionKey` 검증 추가 |
| 8 | 성능/아키텍처 | `EmbeddingService` 폴링 기반 동시성 제어 (`while + sleep(500)`) — 비효율, 멀티 인스턴스 무의미 | `embedding.service.ts:36-40` | `p-limit` 또는 BullMQ 큐 기반 처리로 대체 |
| 9 | 아키텍처 | `LlmModule` ↔ `LlmConfigModule` 순환 의존성 (`forwardRef`) | `llm.module.ts`, `llm-config.module.ts` | `LlmConfigController`에서 `LlmService` 직접 주입 제거, `LlmConfigService` 경유로 개선 |
| 10 | 아키텍처 | `EmbeddingService` 단일 책임 원칙 위반 — 다운로드·파싱·청킹·임베딩·DB저장·이벤트 emit 7개 책임 집중 | `embedding.service.ts` | 각 단계를 private 메서드로 추출 |
| 11 | 성능 | `LlmService.embed`와 `EmbeddingService` 양쪽에서 배치 처리 중복 | `llm.service.ts:38-47`, `embedding.service.ts:105-117` | 배치 로직을 `LlmService` 한 곳에만 유지 |
| 12 | 성능 | `GoogleClient.embed()` N+1 API 호출 — 텍스트 배열을 순차 개별 호출 | `google.client.ts:107-113` | `batchEmbedContents()` API 활용 |
| 13 | DB | `document_count` 비정규화 컬럼 race condition — 동시 업로드 시 count 불일치 | `knowledge-base.service.ts` | `UPDATE ... SET document_count = document_count + 1` 원자적 업데이트 사용 |
| 14 | 보안 | 파일 업로드 MIME/매직바이트 미검증 — 확장자만으로 파일 타입 결정 | `knowledge-base.service.ts:uploadDocument()` | `file-type` 라이브러리로 Buffer 매직바이트 검증 추가 |
| 15 | 보안 | 파일명 경로 탐색(Path Traversal) — `file.originalname`을 S3 키에 직접 포함 | `knowledge-base.service.ts:uploadDocument()` | `path.basename()` + sanitize 처리 |
| 16 | 동시성 | `setDefault` 비원자 2단계 업데이트 — clear 후 set 사이 default 없는 상태 발생 가능 | `llm-config.service.ts:setDefault()` | 두 UPDATE를 단일 DB 트랜잭션으로 묶기 |
| 17 | API | 비동기 re-embed 엔드포인트 HTTP 상태코드 200 — 비동기 작업 시작은 202가 적합 | `knowledge-base.controller.ts:119` | `@HttpCode(HttpStatus.ACCEPTED)` 추가 |
| 18 | API | `PATCH /llm-configs/:id/set-default` HTTP 메서드 의미 불명확 | `llm-config.controller.ts:55-59` | `@Post(':id/set-default')`로 변경 권장 |
| 19 | API | `CreateLlmConfigDto.apiKey` `@IsNotEmpty()` 누락 — 빈 API 키로 생성 가능 | `create-llm-config.dto.ts:15-17` | `@IsNotEmpty()` 데코레이터 추가 |
| 20 | 문서화 | `ENCRYPTION_KEY` 환경변수 미문서화 | `llm.config.ts` | `.env.example`에 항목 추가, `openssl rand -hex 32` 생성 방법 안내 |
| 21 | 문서화 | S3 환경변수 5개 미문서화 | `s3.service.ts` | README/.env.example에 MinIO/S3 설정 섹션 추가 |
| 22 | 문서화 | pgvector 확장 설치 요구사항 미문서화 | `V005__document_chunk_pgvector.sql` | README 사전 요구사항에 pgvector 설치 방법 추가 |
| 23 | 보안 | RAG 검색 debug 엔드포인트가 프로덕션 컨트롤러에 포함 | `knowledge-base.controller.ts:114-132` | 인가 추가 또는 `@ApiExcludeEndpoint()` |
| 24 | 테스트 | `AiAgentHandler` tool calling 루프 테스트 없음 | `ai-agent.handler.spec.ts` | tool 호출→응답→종료 시나리오 테스트 추가 |
| 25 | 테스트 | `InformationExtractorHandler` 재시도 로직(maxRetries=2) 테스트 없음 | `information-extractor.handler.spec.ts` | JSON 파싱 실패 재시도 및 최종 에러 throw 테스트 추가 |
| 26 | 테스트 | `LlmService` 테스트 없음 | `llm.service.ts` | `llm.service.spec.ts` 작성 |
| 27 | 테스트 | `LLMClientFactory` 테스트 없음 | `llm-client.factory.ts` | `llm-client.factory.spec.ts` 작성 |
| 28 | 테스트 | 파서(md, txt, pdf) 및 `ParserFactory` 테스트 없음 | `parsers/` | `parser.factory.spec.ts` 작성 |
| 29 | 테스트 | `TextChunker` 오버랩 동작 테스트 없음 | `text-chunker.spec.ts` | `chunkOverlap > 0` 설정 시 청크 간 내용 겹침 검증 추가 |
| 30 | 테스트 | `LlmConfigService.findAll` API 키 마스킹 테스트 없음 | `llm-config.service.spec.ts` | 목록 전체 항목 마스킹 적용 여부 테스트 추가 |
| 31 | 보안 | 암호화 키 강도 미검증 — 짧거나 약한 키도 허용 | `llm.config.ts` | startup validation에 최소 32바이트(64 hex chars) 검증 추가 |
| 32 | DB | RAG 검색 쿼리 `embedding IS NOT NULL` 필터 없음 | `rag-search.service.ts` | `AND dc.embedding IS NOT NULL` 조건 추가 |
| 33 | 동시성 | `uploadDocument` fire-and-forget 에러 완전 무시 (`void err`) | `knowledge-base.controller.ts:107-111` | catch 블록에 최소한 로깅 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API | `POST /knowledge-bases/search` RESTful 경로 설계 이슈 | `knowledge-base.controller.ts` | 별도 경로로 분리 |
| 2 | API | 파일 업로드 `@UploadedFile`에 `ParseFilePipe` 없음 | `knowledge-base.controller.ts:101` | `ParseFilePipe` 또는 null 체크 추가 |
| 3 | 아키텍처 | `DocumentChunk` 엔티티에 `embedding` 컬럼 매핑 없음 | `document-chunk.entity.ts` | `typeorm-pgvector` 검토 또는 명시적 문서화 |
| 4 | 코드품질 | `GoogleClient`에서 `any[]` 타입 사용 | `google.client.ts:38` | `Tool` 타입으로 명시 |
| 5 | 의존성 | `S3Service`가 `KnowledgeBaseModule`에만 등록 | `knowledge-base.module.ts` | `CommonModule`/`SharedModule`로 이동 |
| 6 | 의존성 | `uuid v13`과 `@types/uuid v10` 메이저 버전 불일치 | `package.json` | 버전 맞춤 |
| 7 | 보안 | LLM API 키 마스킹 시 앞 4자리 노출 — OpenAI 키 prefix 고정으로 정보 유출 | `llm-config.service.ts:maskApiKey()` | 뒤 4자리만 노출 |
| 8 | DB | `LlmConfig.apiKey` 컬럼 길이 500 — 암호화 후 초과 가능성 | `llm-config.entity.ts` | 컬럼 길이 1000 또는 `text` 타입 변경 |
| 9 | 문서화 | 토큰 추정 공식 불일치 — `/ 3` vs 주석의 `/4`, `/2` | `text-chunker.ts:13-15` | 공식 또는 주석 수정 |
| 10 | 테스트 | `AiAgentHandler` JSON 파싱 실패 폴백 동작 미검증 | `ai-agent.handler.spec.ts` | invalid JSON 반환 케이스 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | HIGH | S3 자격증명 하드코딩, RAG IDOR, 파일 업로드 MIME 미검증, 경로 탐색 취약점 |
| performance | HIGH | LLM 클라이언트 매번 재생성, pgvector 인덱스 누락, N+1 INSERT |
| testing | HIGH | 핵심 서비스(S3, Embedding, RagSearch, KnowledgeBase, Llm) 테스트 전무 |
| concurrency | HIGH | EmbeddingService TOCTOU, setDefault 비원자 업데이트, RAG 워크스페이스 격리 |
| database | HIGH | pgvector 인덱스 누락, N+1 INSERT, document_count race condition |
| requirement | MEDIUM | tool 실행 stub, jsonSchemaProperties 미전달, pgvector 인덱스 누락 |
| maintainability | MEDIUM | EmbeddingService SRP 위반, AzureOpenAIClient private 우회, 폴링 동시성 |
| api_contract | MEDIUM | search 경로, re-embed 202 미사용, set-default 메서드, apiKey 검증 누락 |
| side_effect | MEDIUM | 워크스페이스 격리 누락, tool 실행 stub, update() 암호화 키 미검증 |
| architecture | MEDIUM | EmbeddingService SRP, AzureOpenAIClient 캡슐화 위반, LlmModule 순환 의존성 |
| dependency | MEDIUM | LlmModule 순환 의존성, AzureOpenAIClient private 우회, BullMQ 미활용 |
| documentation | MEDIUM | 환경변수(ENCRYPTION_KEY, S3) 미문서화, pgvector 요구사항 미문서화 |
| scope | MEDIUM | tool 실행 stub, jsonSchemaProperties dead code, RAG workspace 검증 누락 |

## 발견 없는 에이전트
없음 (모든 에이전트에서 발견사항 존재)

---

## 권장 조치사항

1. **[즉시] S3 자격증명 하드코딩 제거** — 환경변수 미설정 시 앱 시작 실패 처리
2. **[즉시] RAG 검색 IDOR 수정** — workspace 소유권 JOIN 조건 추가
3. **[즉시] pgvector HNSW 인덱스 추가** — 마이그레이션 V005 수정
4. **[즉시] 핵심 서비스 테스트 작성** — S3Service, EmbeddingService, RagSearchService, KnowledgeBaseService, LlmService
5. **[단기] `InformationExtractorHandler` jsonSchema 전달** — `chat()` 호출에 파라미터 추가
6. **[단기] `AiAgentHandler` tool stub 처리** — 미구현 명시 또는 예외 발생
7. **[단기] `EmbeddingService` 동시성 제어 교체** — `p-limit` 또는 BullMQ 활용
8. **[단기] document_chunk bulk INSERT 전환** — N+1 해소
9. **[단기] `LlmConfigService.update()` 암호화 키 검증 추가**
10. **[단기] startup validation에 `ENCRYPTION_KEY` 강도 및 S3 필수 환경변수 검증 추가**
11. **[중기] 파일 업로드 보안 강화** — MIME/매직바이트 검증, 파일명 sanitize
12. **[중기] `LlmModule` ↔ `LlmConfigModule` 순환 의존성 제거**
13. **[중기] `AzureOpenAIClient` 부모 클래스 구조 개선**
14. **[중기] 환경변수 문서화** — `.env.example` 및 README 업데이트
15. **[중기] 나머지 테스트 보강** — 파서, LLMClientFactory, 재시도 로직, 오버랩 동작 등