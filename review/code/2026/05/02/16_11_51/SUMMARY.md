파일 쓰기 권한이 필요합니다. 권한을 허용해 주시면 SUMMARY.md를 저장할 수 있습니다.

아래는 완성된 통합 보고서입니다:

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 운영 배포 시 `reextract_status` 영구 교착 버그와 핵심 파이프라인 무테스트 상태가 즉각적인 리스크를 유발하며, 인덱스 누락·순차 LLM 호출은 중·대규모 데이터셋에서 성능 병목이 됨

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성·DB·요구사항 | **`reExtractAll` 비원자 시퀀스** — CAS lock → DELETE → UPDATE → `addBulk`가 트랜잭션 없이 실행. 중간 크래시 시 `reextract_status = 'in_progress'` 영구 고착, 수동 DB 개입 없이 복구 불가 | `knowledge-base.service.ts` — `reExtractAll` | DB 조작(CAS + DELETE + UPDATE)을 `dataSource.transaction()`으로 묶고 성공 후에만 `addBulk` 호출 |
| 2 | 동시성 | **워커 OOM 등 강제 종료 시 문서 `processing` 영구 잔류** — finally 경로 미실행으로 `maybeFinalizeKbBatch`의 카운트가 0이 되지 않아 `reextract_status` 잠금 영구 해제 불가 | `graph-extraction.processor.ts` — `process()`, `graph-extraction.service.ts` — `extractDocument` | `process()`에 `try-finally` 래퍼 추가로 어떤 경우에도 document status를 `'error'`로 fallback. BullMQ `stalledInterval` 설정 |
| 3 | 테스트 | **`GraphExtractionService` 테스트 파일 없음** — `extractDocument`, `persistExtraction`(`xmax=0` insert 감지, entity dedup), `refreshKbStats`, 트랜잭션 원자성 전부 미테스트 | `graph/graph-extraction.service.ts` (343줄) | `graph-extraction.service.spec.ts` 생성. 최소 커버: vector 모드 skip / LLM 파싱 실패 / entity dedup mention_count 증가 / persistExtraction 원자성 |
| 4 | 테스트 | **`GraphQueryService` 테스트 파일 없음** — graph API 전체, `type` 파라미터 400 검증, limit 클램핑, cascade 삭제 후 stats 재계산 미검증 | `graph/graph-query.service.ts` (323줄) | `graph-query.service.spec.ts` 생성. vector 모드 KB에 graph API 호출 시 `KB_NOT_GRAPH_MODE` 400 케이스 필수 포함 |
| 5 | 테스트 | **`GraphExtractionProcessor` 테스트 파일 없음** — `maybeFinalizeKbBatch` idle 복원 로직, `onFailed` finalize 동작 미검증 | `queues/graph-extraction.processor.ts` | `graph-extraction.processor.spec.ts` 생성. TOCTOU race 시뮬레이션 포함 |
| 6 | 성능 | **청크 단위 LLM 호출 순차 실행** — 청크 50개 기준 LLM 50회 직렬 호출(~100초). `EmbeddingService`가 배치 처리하는 것과 대조적 | `graph-extraction.service.ts` — `extractDocument` for 루프 | `p-limit(3)` 병렬화 |
| 7 | 성능·DB | **`(knowledge_base_id, graph_extraction_status)` 복합 인덱스 누락** — 1,000건 배치 재추출 시 `maybeFinalizeKbBatch`가 인덱스 없이 COUNT(*) 1,000번 실행 | `V025__graph_rag.sql`, `graph-extraction.processor.ts` | V026 마이그레이션에 `CREATE INDEX idx_document_kb_graph_status ON document(knowledge_base_id, graph_extraction_status)` 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성·부작용 | **`reExtractDocument`가 배치 진행 중 `reextract_status` 영구 교착 유발** — `in_progress` 중 단건 재추출 시 해당 문서가 `pending`으로 리셋되어 배치 finalize 영구 건너뜀 | `knowledge-base.service.ts` — `reExtractDocument` | 진입 시 `reextractStatus === 'in_progress'`이면 409 반환 |
| 2 | 성능·DB | **`refreshKbStats` — 문서마다 전체 COUNT(*) O(n²) 부하** | `graph-extraction.service.ts:~302`, `graph-query.service.ts:~307` | UPSERT `inserted` 플래그로 delta 증분 UPDATE. 전수 COUNT는 배치 완료 시점에만 1회 |
| 3 | 아키텍처·유지보수성 | **`refreshKbStats` 완전 중복 구현** — 동일 SQL이 두 서비스에 복사. SQL 변경 시 한 곳만 수정하면 silent divergence | `graph-extraction.service.ts`, `graph-query.service.ts` | `KbStatsHelper` 서비스로 추출 |
| 4 | 아키텍처 | **임베딩 프로세서가 그래프 추출 큐를 직접 참조 (OCP 위반)** | `document-embedding.processor.ts` — `@InjectQueue(GRAPH_EXTRACTION_QUEUE)` | `EventEmitter2` 기반 이벤트로 도메인 분리 |
| 5 | 성능·DB | **`maybeChainGraphExtraction` — 모든 임베딩 완료마다 DB JOIN 쿼리 (99%가 no-op)** | `document-embedding.processor.ts` | `DocumentEmbeddingJob`에 `ragMode` 포함, DB 조회 없이 early return |
| 6 | 보안·API | **`reExtractDocument` Throttle 누락** — `editor` 권한만 있으면 LLM API 호출 무제한 발사 가능 | `knowledge-base.controller.ts` — `reExtractDocument` | `@Throttle({ default: { limit: 10, ttl: 60_000 } })` 추가 |
| 7 | 보안 | **LLM 추출 결과 필드 길이 검증 부재** — 수 MB 데이터 삽입으로 스토리지 DoS 가능 | `graph-extraction.service.ts` — `persistExtraction` | `name.slice(0, 256)`, `description?.slice(0, 1024)` 등 길이 제한 + DB VARCHAR 제약 |
| 8 | 보안 | **LLM 단계 프롬프트 인젝션** — 허용 스키마 내 가짜 entity/relation 삽입 가능 | `graph-extraction.service.ts` — `callLlmForChunk` | name/predicate 허용 문자셋 제한, mention_count 이상 탐지 검토 |
| 9 | API 계약·문서화 | **`reExtractDocument` Swagger DTO와 실제 응답 불일치** — `ReEmbedAcceptedDto`(documentCount 포함) 재사용, 실제는 `{ message: string }` | `knowledge-base.controller.ts` — `reExtractDocument` | `KbReExtractDocumentAcceptedDto` 별도 정의 |
| 10 | 동시성 | **`maybeFinalizeKbBatch` SELECT+UPDATE 비원자 TOCTOU** — CRITICAL 케이스와 결합 시 finalize 영구 실패 | `graph-extraction.processor.ts:53–67` | `UPDATE ... WHERE NOT EXISTS (SELECT 1 FROM document WHERE ... graph_extraction_status IN ('pending','processing'))` 단일 원자 쿼리 |
| 11 | 부작용 | **재임베딩 시 그래프 추출 묵시적 연쇄 실행** — 사용자가 임베딩만 재실행했는데 LLM 비용 추가 발생, UI 안내 없음 | `document-embedding.processor.ts` | `re-embed` 응답/UI에 graph 모드 KB 경고 추가 또는 `skipGraphExtraction` 파라미터 |
| 12 | 부작용 | **`extractionLlmConfigId` null로 되돌릴 수 없음** — 워크스페이스 기본값 복원 불가 | `update-knowledge-base.dto.ts` | `@ValidateIf((o) => o.extractionLlmConfigId !== null)` 조합으로 null 허용 |
| 13 | DB | **CHECK/FK 제약 추가 시 `ACCESS EXCLUSIVE` 락** — 운영 중 배포 시 서비스 중단 위험 | `V025__graph_rag.sql` | `NOT VALID` + `VALIDATE CONSTRAINT` 분리 적용 |
| 14 | 성능·DB | **ILIKE 앞치환 와일드카드 — B-tree 인덱스 무효화** | `graph-query.service.ts` — `listEntities`, `listRelations` | `pg_trgm` + GIN 인덱스: `CREATE INDEX idx_entity_name_trgm ON entity USING gin(name gin_trgm_ops)` |
| 15 | 아키텍처 | **`KnowledgeBaseController` God Controller화** — entity/relation CRUD·시각화·통계까지 단일 컨트롤러에 집중 | `knowledge-base.controller.ts` | `GraphController`(`/knowledge-bases/:id/graph`) 서브컨트롤러 분리 |
| 16 | 유지보수성 | **`EntityType` 유니온 타입 세 곳에 독립 정의** — 신규 타입 추가 시 컴파일 에러 없이 drift 가능 | `entity.entity.ts`, `graph-extraction.prompt.ts`, `graph-query.service.ts` | `ENTITY_TYPES` 상수 배열 단일 export, 나머지 파일 참조 |
| 17 | 유지보수성·API | **API 응답 언래핑 패턴 4회 중복 + `getEntities`/`getRelations` 미적용으로 불일치** | `frontend/src/lib/api/knowledge-bases.ts` | `apiClient` interceptor 레벨 통일 또는 `unwrapApiData<T>()` 헬퍼 |
| 18 | 테스트 | **`reExtractAll` 테스트에서 DELETE·UPDATE 호출 미검증** — 2~3번째 query 제거해도 통과 | `knowledge-base.service.spec.ts:175` | `toHaveBeenNthCalledWith(2, ...)`, `(3, ...)` 검증 추가 |
| 19 | 테스트 | **`maybeChainGraphExtraction` 실패 경로 미테스트 + silent swallow** — 큐 미적재 상황 감지 불가 | `document-embedding.processor.ts:106` | 실패 시 `graphExtractionStatus = 'error'` 업데이트 + 테스트 추가 |
| 20 | API 계약 | **URL 경로 일관성 위반** — `graph/visualization` vs `graph-stats` | `knowledge-base.controller.ts` | `GET :id/graph/stats`로 통일 |
| 21 | 의존성 | **`proOptions={{ hideAttribution: true }}` — React Flow Pro 라이선스 미확인** | `graph-visualization.tsx:147` | Pro 구독 여부 확인. 무료 플랜이면 제거 |
| 22 | 문서화 | **프론트엔드 API `update` 신규 파라미터 `required`로 잘못 타입 지정** | `frontend/src/lib/api/knowledge-bases.ts:144–153` | `Partial<{...}>` 또는 각 필드에 `?` 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | **LLM 오류 메시지가 `document.metadata`에 저장** — API URL 등 내부 정보 노출 가능 | `graph-extraction.service.ts` catch 블록 | 오류 메시지 정규화, 기술 상세는 서버 로그에만 |
| 2 | 보안 | **entity `type` 필드 app 레벨 검증 없음** — DB CHECK 제약이 최종 방어선 | `graph-extraction.service.ts` — `persistExtraction` | `VALID_ENTITY_TYPES.includes(e.type) ? e.type : 'other'` fallback |
| 3 | 보안 | **`search` 파라미터 최대 길이 미제한** | `graph-query.service.ts` | `@MaxLength(200)` 추가 |
| 4 | 동시성 | **`refreshKbStats` 비원자 SELECT+UPDATE** — 캐시 일시 부정확. 허용 가능 수준 | `graph-extraction.service.ts`, `graph-query.service.ts` | 단일 서브쿼리 UPDATE로 원자화 |
| 5 | API 계약 | **`limit` 파라미터 Swagger 범위 미명시** | `knowledge-base.controller.ts` — `graphVisualization` | `@ApiQuery({ minimum: 1, maximum: 200 })` + `ParseIntPipe` |
| 6 | API 계약 | **entity 목록 `type` 쿼리 파라미터 Swagger 미선언** | `knowledge-base.controller.ts` — `listEntities` | `@ApiQuery({ name: 'type', required: false, enum: EntityType })` |
| 7 | API 계약 | **entity 상세 청크 목록 LIMIT 100 하드코딩 + truncated 플래그 없음** | `graph-query.service.ts` — `getEntityDetail` | 응답에 `truncated: boolean` 추가 |
| 8 | 아키텍처 | **`document.graph_extraction_status DEFAULT 'pending'` — vector 모드 문서에도 적용** | `V025__graph_rag.sql:23` | `DEFAULT NULL`, graph 모드 KB 문서에만 `'pending'` 명시 |
| 9 | 아키텍처 | **`forwardRef` 순환 의존성 징후** | `graph-extraction.service.ts:53` | 이벤트 이미터 기반 단방향 의존 전환 (중장기) |
| 10 | 유지보수성 | **`ChunkEntity` vs `GraphEntity`/`GraphRelation` 네이밍 불일치** | `chunk-entity.entity.ts`, `entity.entity.ts`, `relation.entity.ts` | `GraphChunkEntity`로 통일 |
| 11 | 유지보수성 | **`<select>` 인라인 className 4곳 중복** | `knowledge-bases/page.tsx`, `entity-list.tsx`, `graph-visualization.tsx` | `NativeSelect` 공통 컴포넌트 추출 |
| 12 | 유지보수성 | **`extractDocument` 과도한 책임** (9가지 역할) | `graph-extraction.service.ts` | `prepareExtraction` / `runExtractionLoop` / `finalizeExtraction`으로 분리 |
| 13 | 유지보수성 | **`knowledge-bases/page.tsx` 폼 상태 11개 분산** | `knowledge-bases/page.tsx:45-65` | `CreateKbFormDialog` 컴포넌트 분리 |
| 14 | 유지보수성 | **`entity-list.tsx` 인라인 모달** — 포커스 트랩·ESC·접근성 없음 | `entity-list.tsx:165-248` | `EntityDetailDialog` 컴포넌트 추출 또는 Radix `Dialog` |
| 15 | 문서화 | **`xmax = 0` PostgreSQL 트릭 주석 없음** | `graph-extraction.service.ts` UPSERT 블록 | `-- xmax=0 means newly inserted row` 한 줄 추가 |
| 16 | 문서화 | **`GraphEntity` 클래스명 불일치 이유 미기재** | `entity.entity.ts:22` | TypeORM `@Entity` 충돌 방지 이유 주석 |
| 17 | 문서화 | **마이그레이션 롤백 절차 부재** | `V025__graph_rag.sql` | `-- DOWN:` 롤백 쿼리 주석 추가 |
| 18 | 문서화 | **`graphVizTruncated` i18n `N` placeholder 미처리** | `en.ts:1673` | `{{limit}}` placeholder 추가 |
| 19 | DB | **시각화 쿼리 head·tail 동시 필터 인덱스 미스** | `graph-query.service.ts` — `getGraphVisualization` | `idx_relation_kb_head_tail` 복합 인덱스 (중장기) |
| 20 | DB | **OFFSET 기반 페이지네이션** — 대용량 deep pagination 시 O(offset) | `graph-query.service.ts` | 성장 시 커서 기반 전환 검토 |
| 21 | 부작용 | **SVG 컨텍스트 CSS 변수 미해석 가능성** | `graph-visualization.tsx` — `toEdges` | 실제 색상값 또는 `getComputedStyle` 사용 |
| 22 | 부작용 | **TypeORM 엔티티에 `@Index` 데코레이터 누락** | `entity.entity.ts`, `chunk-entity.entity.ts` | Flyway 환경에서는 무관하나 선언적 일관성 위해 추가 |
| 23 | 범위 | **`reembedStatus` 필드 범위 외 추가** | `frontend/src/lib/api/knowledge-bases.ts` | 허용 가능 수준. 별도 커밋 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | **HIGH** | GraphExtractionService·GraphQueryService·GraphExtractionProcessor 테스트 파일 전무 |
| Performance | **HIGH** | 청크 LLM 순차 실행(N×지연), graph_extraction_status 인덱스 누락, refreshKbStats O(n²) |
| Concurrency | **HIGH** | reExtractAll 비원자 + 워커 크래시 시 reextract_status 영구 교착 |
| Requirement | **HIGH** | reExtractAll 비원자 트랜잭션, reExtractDocument 배치 잠금 무시, maybeChainGraphExtraction silent failure |
| Database | **HIGH** | reExtractAll 비원자, CHECK/FK 락, 다수 인덱스 누락, refreshKbStats O(n²) |
| Architecture | **MEDIUM** | refreshKbStats 중복, 임베딩→그래프 직접 결합, God Controller, forwardRef |
| Security | **MEDIUM** | reExtractDocument throttle 누락, LLM 출력 길이 미검증, 프롬프트 인젝션 |
| API Contract | **MEDIUM** | reExtractDocument DTO 불일치, 응답 언래핑 불일치, URL 경로 비일관성 |
| Side Effect | **MEDIUM** | 재임베딩→그래프 추출 묵시적 연쇄, reExtractDocument 배치 중 교착, 크래시 복구 경로 없음 |
| Maintainability | **MEDIUM** | refreshKbStats 중복, EntityType 이중 정의, API 응답 정규화 반복 |
| Documentation | **LOW** | reExtractDocument Swagger DTO 불일치, update 파라미터 타입 오류 |
| Scope | **LOW** | 범위 내 집중. 경미한 초과 2건 |
| Dependency | **LOW** | 신규 외부 패키지 없음. React Flow Pro 라이선스 확인 필요 |

---

## 발견 없는 에이전트

없음 — 13개 에이전트 모두 1건 이상의 발견사항을 보고함

---

## 권장 조치사항

### 즉시 (배포 전 필수)
1. **`reExtractAll` 트랜잭션 원자화** (`knowledge-base.service.ts`)
2. **워커 크래시 fallback** — `try-finally` + BullMQ `stalledInterval` (`graph-extraction.processor.ts`)
3. **`reExtractDocument` 배치 중 409 차단** (`knowledge-base.service.ts`)
4. **`reExtractDocument` Throttle 추가** (`knowledge-base.controller.ts`)
5. **`idx_document_kb_graph_status` 인덱스 추가** (V026 마이그레이션)
6. **`graph_extraction_status DEFAULT NULL`** — vector 모드 오염 방지 (V026 포함)

### 단기 (다음 스프린트)
7. **`GraphExtractionService` + `GraphQueryService` + `GraphExtractionProcessor` 테스트 작성**
8. **청크 LLM 호출 `p-limit(3)` 병렬화** (`graph-extraction.service.ts`)
9. **`refreshKbStats` → `KbStatsHelper` 추출 + delta 증분 전환**
10. **`maybeFinalizeKbBatch` 원자 쿼리 통합** (`graph-extraction.processor.ts`)
11. **`EntityType` 단일 정의 통일** (`entity.entity.ts` → export)
12. **API 응답 언래핑 통일** (`knowledge-bases.ts`)

### 중장기
13. 임베딩 → 그래프 도메인 `EventEmitter2` 분리
14. `GraphController` 서브컨트롤러 분리
15. 마이그레이션 CHECK/FK `NOT VALID` + `VALIDATE CONSTRAINT` 패턴 적용
16. `pg_trgm` GIN 인덱스 추가 (entity/relation 검색)
17. `DocumentEmbeddingJob`에 `ragMode` 포함