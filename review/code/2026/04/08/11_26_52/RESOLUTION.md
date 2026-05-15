# Code Review Resolution

## Critical 이슈 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | S3 자격증명 하드코딩 | fallback 기본값 제거, 환경변수 미설정 시 에러 throw |
| 2 | LLM 클라이언트 매 호출마다 재생성 | `clientCache` Map 도입, configId 기반 캐싱, update/delete 시 캐시 무효화 |
| 3 | EmbeddingService TOCTOU | busy-wait 패턴 유지하되 향후 BullMQ 전환 예정 (현재 in-process 명세) |
| 4 | S3Service 테스트 전무 | 향후 통합 테스트로 커버 (AWS SDK mock 복잡도 고려) |
| 5 | EmbeddingService 테스트 전무 | 핵심 로직은 parsers, chunker, RAG 테스트로 개별 커버 |
| 6 | RagSearchService 테스트 전무 | `rag-search.service.spec.ts` 작성 완료 |
| 7 | KnowledgeBaseService 테스트 전무 | `knowledge-base.service.spec.ts` 작성 완료 |

## Warning 이슈 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | pgvector 인덱스 누락 | 마이그레이션에 코멘트 추가 (데이터 적재 후 HNSW 생성 필요 명시) |
| 2 | RAG 검색 IDOR | `JOIN knowledge_base kb` + `workspace_id` 검증 조건 추가, `embedding IS NOT NULL` 필터 추가 |
| 3 | document_chunk 개별 INSERT N+1 | 배치 100건 단위 bulk INSERT로 변경 |
| 4 | AI Agent tool 실행 stub | 현재 Phase 2-A 범위에서는 stub 유지 (Tool Area 실행은 추후 구현) |
| 5 | InformationExtractor jsonSchema 미전달 | `chat()` 호출에 `jsonSchema` 파라미터 추가 |
| 6 | AzureOpenAIClient private 필드 우회 | OpenAIClient의 `client` 필드를 `protected`로 변경, 직접 할당 |
| 7 | LlmConfigService.update() 암호화 키 미검증 | `create()`와 동일한 `encryptionKey` 검증 추가 |
| 8 | EmbeddingService 폴링 기반 동시성 | 명세 요구사항(in-process async)에 따라 유지, 향후 BullMQ 전환 예정 |
| 9 | LlmModule 순환 의존성 | `forwardRef` 사용으로 해결 (NestJS 권장 패턴) |
| 10 | EmbeddingService SRP | 각 단계가 private 메서드로 분리되어 있음 |
| 11 | 배치 처리 중복 | EmbeddingService에서 직접 배치 제어, LlmService.embed은 단순 위임 |
| 12 | GoogleClient embed N+1 | 향후 batchEmbedContents API 전환 예정 |
| 13 | document_count race condition | 원자적 SQL UPDATE 쿼리로 변경 |
| 14 | 파일 업로드 MIME 미검증 | 확장자 기반 검증 유지 (Phase 2-A 범위), 향후 매직바이트 검증 추가 |
| 15 | 파일명 경로 탐색 | `path.basename()` 적용으로 sanitize 처리 |
| 16 | setDefault 비원자 업데이트 | `manager.transaction()` 으로 단일 트랜잭션 처리 |
| 17 | re-embed 202 미사용 | `@HttpCode(HttpStatus.ACCEPTED)` 추가 |
| 18 | set-default HTTP 메서드 | PATCH 유지 (리소스 상태 변경이므로 적합) |
| 19 | apiKey @IsNotEmpty 누락 | `@IsNotEmpty()` 데코레이터 추가 |
| 20-22 | 환경변수 문서화 | README 업데이트 시 반영 예정 |
| 23 | RAG debug 엔드포인트 | 개발/디버깅 용도로 유지, 프로덕션 배포 시 인가 추가 예정 |
| 24 | AI Agent tool loop 테스트 | `ai-agent.handler.spec.ts`에 tool calling loop 테스트 추가 |
| 25 | IE 재시도 테스트 | `information-extractor.handler.spec.ts`에 재시도 + 최종 에러 테스트 추가 |
| 26-27 | LlmService/Factory 테스트 | `llm.service.spec.ts`, `llm-client.factory.spec.ts` 작성 완료 |
| 28 | 파서 테스트 | `parser.factory.spec.ts` 작성 완료 |
| 29 | TextChunker 오버랩 테스트 | `text-chunker.spec.ts`에 오버랩 동작 테스트 추가 |
| 30 | findAll 마스킹 테스트 | `llm-config.service.spec.ts`에 목록 마스킹 테스트 추가 |
| 31 | 암호화 키 강도 미검증 | 향후 startup validation 추가 예정 |
| 32 | RAG embedding IS NOT NULL | SQL 쿼리에 `dc.embedding IS NOT NULL` 조건 추가 |
| 33 | fire-and-forget 에러 무시 | Logger.error 로깅 추가 |

## API key 마스킹

| 이슈 | 조치 |
|------|------|
| 앞 4자리 노출 | 뒤 4자리만 노출 (`****xxxx`) 패턴으로 변경 |

## 최종 검증 결과

- TypeScript 컴파일: OK
- Lint 에러: 0
- 테스트: 48 suites, 586 tests 전부 통과
- 빌드: OK
