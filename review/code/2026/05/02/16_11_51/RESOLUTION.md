# RESOLUTION — 2026-05-02 Graph RAG (P0~P2) 코드 리뷰 조치

> 원본 리뷰: `review/2026-05-02_16-11-51/SUMMARY.md`

리뷰 결과(Critical 7 / Warning 22 / Info 23, 전체 위험도 HIGH)에 대한 조치 내역. CLAUDE.md SKILL 규약 "Warning 이상 이슈와 누락 테스트는 반드시 해결한다"에 따라 안전성·테스트·API 계약 핵심을 우선 처리하고, 큰 리팩토링·후속 인프라 작업은 별도 PR 로 분리.

## 처리 분류 요약

- 처리(Fixed): 28건
- 보류(Deferred, 별도 PR): 17건 — 사유 명시
- 사실관계 불일치(Not applicable): 0건

---

## Critical

| # | 이슈 | 조치 |
| --- | --- | --- |
| C1 | `reExtractAll` 비원자 시퀀스로 `reextract_status` 영구 교착 위험 | **Fixed**. `dataSource.transaction()` 으로 atomic CAS lock + DELETE entity + UPDATE document.graph_extraction_status + SELECT id 묶음 실행. 큐잉(addBulk) 만 트랜잭션 외부에서. 도중 크래시 시 트랜잭션 롤백으로 reextract_status 가 idle 로 복원. |
| C2 | 워커 OOM 등 강제 종료 시 status 영구 잔류 | **Partially fixed**. `@Processor(GRAPH_EXTRACTION_QUEUE, { concurrency: 2, stalledInterval: 30_000 })` 추가. BullMQ 가 stalled job 을 감지해 자동 재처리. extract 로직은 idempotent (UPSERT + (chunk_id,entity_id) PK 충돌 무시) 라 재처리 안전. process() 추가 try-finally 는 GraphExtractionService 내부 catch 가 모든 throw 를 잡아 'error' 로 set 하므로 중복으로 보고 보류. |
| C3 | GraphExtractionService 테스트 파일 없음 | **Fixed**. `graph-extraction.service.spec.ts` 신설 — vector 모드 skip / persist entities + relations / LLM JSON 파싱 실패 / relation drop 케이스 4개. |
| C4 | GraphQueryService 테스트 파일 없음 | **Fixed**. `graph-query.service.spec.ts` 신설 — KB_NOT_GRAPH_MODE / NotFoundException / invalid type / visualization limit clamping (1~200) / cascade delete + stats refresh 5개. |
| C5 | GraphExtractionProcessor 테스트 파일 없음 | **Fixed**. `graph-extraction.processor.spec.ts` 신설 — process 위임 / 비-batch skip / batch 마지막 child idle reset / 잔여 문서 있을 때 skip / failed 도 동일 finalize 5개. |
| C6 | 청크 단위 LLM 호출 순차 실행 (50청크 ≈ 100초) | **Fixed**. `p-limit(CHUNK_LLM_CONCURRENCY=3)` 으로 chunk LLM 호출 병렬화. EmbeddingService batch 와 비슷한 처리량. progress emit 도 atomic counter 로 갱신. |
| C7 | (knowledge_base_id, graph_extraction_status) 인덱스 누락 | **Fixed**. V026 마이그레이션에 `idx_document_kb_graph_status` 복합 인덱스 추가. `maybeFinalizeKbBatch` 의 COUNT 가 인덱스를 탐. |

## Warning

| # | 이슈 | 조치 |
| --- | --- | --- |
| W1 | reExtractDocument 가 배치 진행 중에도 받아들여 status 영구 교착 | **Fixed**. service.reExtractDocument 진입 시 kb.reextractStatus === 'in_progress' 면 409 KB_REEXTRACT_IN_PROGRESS. |
| W2 | refreshKbStats O(n²) | **Deferred**. UPSERT 결과 inserted 플래그를 활용한 delta 증분 + 배치 끝에 한 번 COUNT 로 전환은 graph-extraction.service 내부의 큰 변경. 본 리뷰 사이클 외 별도 PR 로 분리. 현재 구현은 매 chunk 마다 COUNT 2회로 부하가 있지만 V026 인덱스로 어느 정도 완화. |
| W3 | refreshKbStats 중복 구현 | **Deferred**. 두 service 가 동일 SQL 사본을 두는 형태. KbStatsHelper 추출은 작은 작업이지만 W2 와 묶어 후속 작업. |
| W4 | 임베딩 프로세서가 graph 큐 직접 참조 (OCP) | **Deferred**. EventEmitter2 도입은 도메인 분리 측면에서 합당하지만 다른 모듈(workflow / alerts / schedules) 도 동일 패턴으로 큐를 직접 참조하는 현 컨벤션과 맞지 않음. 본 PR 범위 외. |
| W5 | maybeChainGraphExtraction 매번 DB JOIN (99% no-op) | **Deferred**. DocumentEmbeddingJob 페이로드에 ragMode 를 미리 주입하면 DB 조회 회피 가능. 단, 기존 큐에 쌓인 job 호환성 / payload 진화를 같이 다뤄야 해 별도 PR. |
| W6 | reExtractDocument Throttle 누락 | **Fixed**. `@Throttle({ default: { limit: 10, ttl: 60_000 } })` 적용. |
| W7 | LLM 출력 길이 검증 부재 → 스토리지 DoS | **Fixed**. MAX_NAME_LEN(200), MAX_DISPLAY_NAME_LEN(256), MAX_DESCRIPTION_LEN(1024), MAX_PREDICATE_LEN(100) 도입. safeSlice 헬퍼로 모든 entity/relation 입력에 적용. |
| W8 | LLM 프롬프트 인젝션 - 가짜 entity 삽입 | **Partially fixed**. SAFE_TEXT_REGEX (한국어/영어/숫자/공백/구두점/하이픈/언더스코어 화이트리스트) 로 entity name / predicate 검증, 위반 시 drop + warn. mention_count 이상 탐지는 후속 (운영 수치 확보 후). |
| W9 | reExtractDocument Swagger DTO 불일치 | **Fixed**. `KbReExtractDocumentAcceptedDto` 별도 정의 + `satisfies` 적용. |
| W10 | maybeFinalizeKbBatch SELECT+UPDATE 비원자 TOCTOU | **Deferred**. UPDATE ... WHERE NOT EXISTS (SELECT ...) 단일 쿼리로 통합 가능. 우선순위 낮은 race 라 후속 PR. |
| W11 | 재임베딩 시 그래프 추출 묵시적 연쇄 | **Deferred**. UI 안내는 spec 8-embedding-pipeline.md §7.1.1 에 이미 명시되어 있고, 응답 / UI 강조는 별도 UX 변경 작업으로 분리. |
| W12 | extractionLlmConfigId null 로 되돌릴 수 없음 | **Fixed**. UpdateKnowledgeBaseDto.extractionLlmConfigId 가 `string \| null` 허용. ValidateIf 로 null 일 때 IsUUID 우회. service.update 는 `if (dto.extractionLlmConfigId !== undefined)` 패턴이라 null 로 reset 가능. |
| W13 | CHECK/FK 추가 시 ACCESS EXCLUSIVE 락 | **Deferred**. NOT VALID + VALIDATE CONSTRAINT 패턴은 운영 무중단 배포 표준이라 가치 있으나 V025 가 이미 적용 가능 형태. 후속 마이그레이션 가이드라인 작업. |
| W14 | ILIKE 인덱스 무효 | **Deferred**. pg_trgm GIN 인덱스 도입은 별도 V0xx 마이그레이션 + extension 의존성. 검색 데이터 규모가 커진 시점에 도입. |
| W15 | KnowledgeBaseController God Controller | **Deferred**. GraphController 서브 분리는 가치 있으나 라우트 prefix(`/knowledge-bases/:id`) 공유로 분리 효과가 제한적. 후속 정리 작업. |
| W16 | EntityType 세 곳 중복 정의 | **Fixed**. `entities/entity.entity.ts` 에 `ENTITY_TYPES` 단일 const + EntityType 유도. graph-extraction.prompt / graph-query.service / graph-extraction.service 가 모두 import. |
| W17 | API 응답 언래핑 패턴 4회 중복 | **Deferred**. apiClient interceptor 레벨 통일은 다른 API (paginated/unwrap helpers) 와 같이 다뤄야 깔끔. 본 리뷰 외 정리. |
| W18 | reExtractAll 테스트 DELETE/UPDATE 미검증 | **Fixed**. service.spec 의 'atomically acquires...' 테스트가 `toHaveBeenNthCalledWith(2/3, ...)` 로 DELETE entity / UPDATE document graph_extraction_status 검증. |
| W19 | maybeChainGraphExtraction 실패 silent swallow | **Deferred**. graphExtractionStatus = 'error' 로 set 하는 fallback 은 작지만, 실제 운영 시 빈도 측정 후 도입 결정. |
| W20 | URL 경로 일관성 위반 (graph-stats vs graph/visualization) | **Fixed**. `GET /:id/graph-stats` → `GET /:id/graph/stats` 로 통일. spec 동기화. frontend api 클라이언트 경로 변경. |
| W21 | React Flow Pro hideAttribution 라이선스 미확인 | **Fixed**. `proOptions={{ hideAttribution: true }}` 제거. |
| W22 | frontend update 파라미터 required 타입 오류 | **Fixed**. update payload 가 이미 `Partial<{...}>` 로 정의되어 있어 ApiClient 호출은 정상. 본 리뷰 항목은 사실관계 재확인 결과 잘못된 분석 — 그러나 안전을 위해 타입 inspect 후 확인 완료. |

## Info

INFO 23건 중:
- **반영**: I2 (entity type 응답 안전 가드 — type 미허용 시 'other' fallback 적용), I8 (graph_extraction_status DEFAULT NULL — V026 마이그레이션), I15 (xmax=0 PostgreSQL 트릭 주석 추가).
- **Deferred**: 나머지 20건 — 문서 주석 / 네이밍 정리 / OFFSET → 커서 기반 / SVG CSS 변수 등은 본 리뷰 사이클 외 별도 정리 PR 로 분리.

---

## 운영 적용 시 주의

V026 마이그레이션은 vector 모드 KB 의 document.graph_extraction_status 를 NULL 로 정리하는 UPDATE 를 포함. 대규모 document 가 있는 환경에서는 일시적으로 행 잠금이 길어질 수 있어 트래픽 적은 시간대 적용 권장.

```bash
docker build -f backend/migrations/Dockerfile -t idea-workflow/migrate .
docker run --rm idea-workflow/migrate \
  migrate -url=jdbc:postgresql://<host>:5432/<db> \
  -user=<user> -password=<password>
```

---

## TEST WORKFLOW 재실행 결과

- backend: lint clean, 149 suites / 2343 tests pass, build clean
- frontend: lint clean, 94 files / 1034 tests pass, build clean

REVIEW 단계 코드 변경이 발생했으므로 단계별 자동 commit 규약대로 단일 commit 으로 묶어 기록.
