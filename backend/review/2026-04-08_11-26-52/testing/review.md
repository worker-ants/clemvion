### 발견사항

---

**[CRITICAL] S3Service 테스트 없음**
- 위치: `src/common/services/s3.service.ts`
- 상세: `upload`, `download`, `delete` 메서드 전체에 테스트가 없음. 특히 `download`의 스트림 처리 로직은 엣지 케이스(빈 스트림, 스트림 에러) 검증이 필요.
- 제안: `@aws-sdk/client-s3`를 mock하여 각 메서드와 에러 케이스를 테스트하는 `s3.service.spec.ts` 작성

---

**[CRITICAL] EmbeddingService 테스트 없음**
- 위치: `src/modules/knowledge-base/embedding/embedding.service.ts`
- 상세: 가장 복잡한 비즈니스 로직(문서 파싱 → 청킹 → 임베딩 → DB 저장)을 담당하지만 테스트가 전혀 없음. `processDocument`의 동시성 제한(`MAX_CONCURRENT`), 재임베딩(`reEmbed`), 빈 텍스트 처리, 트랜잭션 롤백 로직이 검증 안 됨.
- 제안: Repository, S3Service, LlmService, DataSource를 mock하여 정상 흐름 및 에러 케이스 테스트

---

**[CRITICAL] RagSearchService 테스트 없음**
- 위치: `src/modules/knowledge-base/search/rag-search.service.ts`
- 상세: `search` (벡터 유사도 쿼리)와 `buildContext`에 테스트가 없음. 빈 `knowledgeBaseIds`, 빈 쿼리, DB 쿼리 실패 시 빈 배열 반환 경로 미검증.
- 제안: `DataSource.query`를 mock하여 정상 결과, 임계값 필터링, 에러 시 graceful 처리를 테스트하는 `rag-search.service.spec.ts` 작성

---

**[CRITICAL] KnowledgeBaseService 테스트 없음**
- 위치: `src/modules/knowledge-base/knowledge-base.service.ts`
- 상세: CRUD, 파일 타입 검증, S3 업로드, `documentCount` 갱신 로직 전체에 테스트 없음. 허용되지 않은 파일 타입 거부, S3 삭제 실패 시 경고만 내고 진행하는 로직 미검증.
- 제안: Repository와 S3Service를 mock하여 각 메서드 및 에러 케이스 테스트

---

**[WARNING] AiAgentHandler - 툴 사용 루프 테스트 없음**
- 위치: `src/modules/execution-engine/handlers/ai/ai-agent.handler.spec.ts`
- 상세: 툴 호출 루프(`while (result.toolCalls?.length)`)에 대한 테스트가 없음. `maxToolCalls` 초과 시 루프 종료, 여러 번의 연속 툴 호출 등의 동작 미검증.
- 제안: `mockLlmService.chat`이 첫 호출엔 `toolCalls`를 반환하고 두 번째엔 없는 응답을 반환하도록 설정하여 루프 테스트 추가

---

**[WARNING] AiAgentHandler - 빈 프롬프트로 execute 실행 시 동작 미검증**
- 위치: `ai-agent.handler.spec.ts:62`
- 상세: RAG 테스트에서 `userPrompt: 'Question'`은 있지만 `userPrompt`가 비어있을 때 RAG 검색이 건너뛰어지는 로직 미검증.
- 제안: 빈 `userPrompt`로 execute 호출 시 `ragSearchService.search`가 호출되지 않는 케이스 추가

---

**[WARNING] InformationExtractorHandler - 재시도 로직 테스트 없음**
- 위치: `src/modules/execution-engine/handlers/ai/information-extractor.handler.spec.ts`
- 상세: JSON 파싱 실패 시 최대 2회 재시도하는 로직(`maxRetries = 2`)에 대한 테스트 없음. 모든 시도 실패 시 에러 throw도 미검증.
- 제안: `mockLlmService.chat`이 유효하지 않은 JSON을 반환하는 케이스와 최종 에러 케이스 테스트 추가

---

**[WARNING] TextChunker - 오버랩 동작 미검증**
- 위치: `src/modules/knowledge-base/chunking/text-chunker.spec.ts`
- 상세: `chunkOverlap > 0`일 때 이전 청크의 끝 내용이 다음 청크 시작에 포함되는 실제 동작을 검증하는 테스트가 없음.
- 제안: 오버랩 있는 설정으로 분할했을 때 인접 청크 간 내용이 겹치는지 확인하는 테스트 추가

---

**[WARNING] parser.factory.ts - 지원하지 않는 파일 타입 에러 테스트 없음**
- 위치: `src/modules/knowledge-base/parsers/` (spec 파일 없음)
- 상세: `md.parser.ts`, `txt.parser.ts`, `pdf.parser.ts`, `parser.factory.ts`에 테스트 없음. 특히 `parseDocument`에서 지원하지 않는 타입 throw, `parsePdf`의 `pdf-parse` 에러 처리 미검증.
- 제안: `parser.factory.spec.ts` 작성 — 지원 타입별 분기와 unsupported 타입 에러를 검증. `pdf.parser.spec.ts`는 `pdf-parse`를 mock.

---

**[WARNING] LlmConfigService - findAll 마스킹 테스트 없음**
- 위치: `src/modules/llm-config/llm-config.service.spec.ts`
- 상세: `findAll`에서 목록의 모든 항목이 API 키가 마스킹되어 반환되는지 검증하는 테스트가 없음.
- 제안: `mockRepo.createQueryBuilder`의 `getMany`가 암호화된 키를 가진 배열을 반환하도록 하고 모든 항목에 마스킹 적용 여부 확인

---

**[WARNING] LlmService 테스트 없음**
- 위치: `src/modules/llm/llm.service.ts`
- 상세: `withRetry` 로직(지수 백오프, rate limit 감지), `resolveConfig`(default config 없을 때 예외), `embed` 배치 처리에 대한 테스트 없음.
- 제안: `llm.service.spec.ts` 작성 — rate limit 시 재시도, 최대 재시도 초과 에러, default config 미존재 시 `BadRequestException` 테스트

---

**[WARNING] LLMClientFactory - 유효하지 않은 provider 에러 테스트 없음**
- 위치: `src/modules/llm/llm-client.factory.ts`
- 상세: `create` 메서드의 분기 로직(Azure/Local의 baseUrl 필수, 알 수 없는 provider 에러)에 대한 테스트가 없음.
- 제안: `llm-client.factory.spec.ts` 작성

---

**[INFO] AiAgentHandler - JSON 파싱 실패 폴백 테스트 없음**
- 위치: `ai-agent.handler.spec.ts`
- 상세: `responseFormat: 'json'`이지만 LLM이 유효하지 않은 JSON을 반환했을 때 원본 문자열을 그대로 반환하는 폴백 동작 미검증.

---

**[INFO] CsvParser - 따옴표 포함 셀, 이스케이프 처리 테스트 없음**
- 위치: `csv.parser.spec.ts`
- 상세: `"value with, comma"` 형태의 RFC 4180 CSV 파싱 동작이 검증되지 않음. `csv-parse`가 처리하므로 실제로는 동작하지만 회귀 방지 차원에서 테스트 권장.

---

### 요약

이번 변경에서 핵심 비즈니스 로직인 `EmbeddingService`, `RagSearchService`, `KnowledgeBaseService`, `LlmService`, `S3Service`에 단위 테스트가 전혀 존재하지 않으며, 이는 CRITICAL 수준의 커버리지 공백이다. AI 핸들러(`AiAgentHandler`, `InformationExtractorHandler`)와 청킹/파서 레이어에는 기본적인 테스트가 있으나 재시도 로직, 툴 호출 루프, 오버랩 동작 등 주요 엣지 케이스가 누락되어 있다. `LlmConfigService` 테스트는 암호화/복호화 핵심 흐름을 잘 검증하고 있어 품질이 양호한 편이나, 서비스 레이어 전반의 테스트 부재는 프로덕션 배포 전 반드시 보완이 필요하다.

### 위험도
**HIGH**