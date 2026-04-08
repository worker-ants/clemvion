## 문서화 리뷰 결과

### 발견사항

---

**[WARNING]** `ENCRYPTION_KEY` 환경변수 문서화 누락
- 위치: `src/common/config/llm.config.ts`
- 상세: 새로 추가된 `ENCRYPTION_KEY` 환경변수에 대한 설명이 없음. LLM API 키 암호화에 필수적인 설정값임에도 불구하고 `.env.example` 또는 README에 문서화되지 않음
- 제안: `.env.example`에 `ENCRYPTION_KEY=` 항목과 32바이트 hex 값 생성 방법(`openssl rand -hex 32`) 추가, README에 환경변수 섹션 업데이트

---

**[WARNING]** S3 서비스 환경변수 문서화 누락
- 위치: `src/common/services/s3.service.ts`
- 상세: `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` 등 5개의 새 환경변수가 추가되었으나 문서화 없음. 하드코딩된 기본값(`minioadmin`)이 개발/운영 환경 설정 방법을 불분명하게 만듦
- 제안: README 또는 `.env.example`에 MinIO/S3 설정 섹션 추가, 개발환경에서 MinIO 사용 방법 기술

---

**[WARNING]** pgvector 확장 설치 요구사항 미문서화
- 위치: `migrations/V005__document_chunk_pgvector.sql`
- 상세: `CREATE EXTENSION IF NOT EXISTS vector` 구문이 있으나 PostgreSQL에 pgvector 확장이 사전 설치되어 있어야 함. 이 요구사항이 README나 설치 가이드에 없음
- 제안: README의 사전 요구사항 섹션에 pgvector 설치 방법 추가 (`apt install postgresql-15-pgvector` 또는 Docker 이미지 사용 안내)

---

**[INFO]** `DocumentChunk` 엔티티의 embedding 컬럼 주석은 적절함
- 위치: `src/modules/knowledge-base/entities/document-chunk.entity.ts:31-33`
- 상세: `// Vector column is handled via raw SQL; TypeORM doesn't natively support pgvector` 주석이 설계 결정 이유를 잘 설명함. 긍정적인 사례

---

**[INFO]** `LocalClient` JSDoc 주석은 간결하고 정확함
- 위치: `src/modules/llm/clients/local.client.ts:3-6`
- 상세: Ollama, vLLM 지원 명시 및 목적이 명확히 기술됨

---

**[WARNING]** `EmbeddingService.processDocument` 동시성 제한 로직 주석 부족
- 위치: `src/modules/knowledge-base/embedding/embedding.service.ts:38-43`
- 상세: `while (this.activeTasks >= MAX_CONCURRENT)` 루프가 무한 대기할 수 있는 busy-wait 패턴이지만 이에 대한 설명이 없음. `MAX_CONCURRENT = 3` 상수도 왜 3인지 근거가 없음
- 제안: 상수 위에 또는 `processDocument` 메서드에 간략한 설명 추가

---

**[WARNING]** RAG 검색 엔드포인트가 디버그용임을 API 문서에 표시 필요
- 위치: `src/modules/knowledge-base/knowledge-base.controller.ts:118-132`
- 상세: `// ── RAG Search (debug endpoint) ──` 주석이 있으나 실제 운영 환경에서 이 엔드포인트가 노출되어서는 안 됨. Swagger나 README에 경고 없음
- 제안: `@ApiExcludeEndpoint()` 데코레이터 추가 또는 운영 환경에서의 접근 제한 방법 문서화

---

**[INFO]** `parseMd` 파서가 마크다운을 그대로 반환하는 이유 불명확
- 위치: `src/modules/knowledge-base/parsers/md.parser.ts`
- 상세: 마크다운 파서가 파싱 없이 원문을 그대로 반환함. 의도적인 설계인지(청킹 단계에서 처리), 임시 구현인지 알 수 없음
- 제안: 함수에 "마크다운 문법을 보존하여 텍스트 청커가 헤더/단락 구조를 활용할 수 있도록 raw text 반환" 등의 주석 추가

---

**[INFO]** `AzureOpenAIClient`의 private 필드 강제 접근 패턴 주석 필요
- 위치: `src/modules/llm/clients/azure-openai.client.ts:11`
- 상세: `(this as unknown as { client: OpenAI }).client = ...` 패턴이 TypeScript 타입 시스템을 우회하는 workaround임을 설명하는 주석 없음
- 제안: `// Re-initialize client since parent class creates it in constructor; TypeScript private field override workaround` 형태의 주석 추가

---

**[WARNING]** `llm-client.interface.ts`의 `ChatMessage.content` nullable 처리 미문서화
- 위치: `src/modules/llm/interfaces/llm-client.interface.ts:3`
- 상세: `content: string`으로 선언되어 있으나 `ChatResult.content: string | null`과 불일치. tool call 메시지에서 content가 빈 문자열일 수 있는 케이스가 인터페이스에 설명 없음
- 제안: 각 필드에 JSDoc 주석으로 nullable/optional 케이스 설명 추가

---

**[WARNING]** `text-chunker.ts`의 토큰 추정 알고리즘 근거 미문서화
- 위치: `src/modules/knowledge-base/chunking/text-chunker.ts:13-15`
- 상세: `Math.ceil(text.length / 3)` 공식이 "1 token ≈ 4 characters for English, ~2 for CJK"라는 주석이 있으나 실제 계산은 `/3`로 두 설명 모두와 불일치
- 제안: JSDoc에 실제 근거(한영 혼합 텍스트 평균값 등)와 정확도 한계 기술, 또는 수식 수정

---

**[INFO]** README 업데이트 필요
- 위치: 프로젝트 루트 README
- 상세: Knowledge Base, LLM Config, AI Agent 노드 등 대규모 기능이 추가되었으나 README 업데이트 여부 확인 필요
- 제안: Knowledge Base 사용법, LLM Provider 설정 방법, 새 환경변수 목록을 README에 추가

---

### 요약

전반적으로 코드 내 주석 품질은 무난하나, **외부 설정 요구사항(환경변수, 시스템 의존성)**에 대한 문서화가 심각하게 부족합니다. 특히 `ENCRYPTION_KEY` 미설정 시 서비스 전체가 동작하지 않고, pgvector 미설치 시 마이그레이션이 실패하며, S3/MinIO 설정 없이는 Knowledge Base 기능을 사용할 수 없음에도 이 모든 요구사항이 코드에만 암묵적으로 존재합니다. 인터페이스 및 복잡한 알고리즘 로직(토큰 추정, 동시성 제어)에 대한 JSDoc/주석도 개선이 필요합니다. 기능 구현 품질 대비 문서화 수준이 낮아 운영 배포 시 설정 오류가 발생할 가능성이 높습니다.

### 위험도

**MEDIUM**