# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 운영 배포 시 테이블 전체 잠금·서비스 중단 위험, 재임베딩 중복 실행 데이터 오염, 보안 입력 검증 부재가 복합적으로 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Database / Side Effect | `ALTER TABLE document_chunk ALTER COLUMN embedding TYPE vector` — 기존 인덱스를 DROP하지 않으면 마이그레이션 자체가 실패하고, 성공하더라도 `ACCESS EXCLUSIVE LOCK`으로 테이블 전체 리라이트 중 모든 읽기·쓰기가 차단됨 | `V021__variable_embedding_dimension.sql:6` | 마이그레이션 상단에 `DROP INDEX IF EXISTS <기존 인덱스명>` 추가; 운영 적용 시 유지보수 창 확보 또는 무중단 컬럼 교체 패턴(신규 컬럼 추가 → 배치 복사 → 컬럼 교체) 검토 |
| 2 | Database / Performance | `CREATE INDEX ... USING hnsw` 3개를 `CONCURRENTLY` 없이 직렬 실행 — `ShareLock`으로 인덱스 빌드 완료까지 INSERT/UPDATE/DELETE 전면 차단, 대규모 테이블에서 수십 분 소요 가능 | `V021__variable_embedding_dimension.sql:18–28` | `CREATE INDEX CONCURRENTLY` 사용; Flyway는 `executeInTransaction=false` 설정 필요; 인덱스 생성을 별도 마이그레이션으로 분리 |
| 3 | Performance | `reEmbedAll`이 백프레셔 없이 문서 전체를 동시 fire-and-forget 발사 — 100개 문서면 100개 Promise가 동시 생성되고 각 태스크가 500ms 폴링 루프에 진입, CPU·메모리 급증 | `knowledge-base.service.ts` `reEmbedAll()` for 루프 | `p-limit` 또는 세마포어로 동시 실행 상한 강제; `MAX_CONCURRENT` 제어를 외부 루프로 이동 |
| 4 | Performance | 폴링 방식 동시성 제한자 — `while (activeTasks >= MAX_CONCURRENT) { await sleep(500) }` 패턴이 대기 태스크 수만큼 타이머 콜백을 누적시킴 | `embedding.service.ts:37–40` | 세마포어 패턴으로 교체; 완료 시 `resolve()` 호출로 대기자를 직접 wake-up |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `embeddingModel` 허용 목록 검증 없음 — `@IsString()` + `@MaxLength(100)` 만 적용; 임의 문자열이 LLM API에 그대로 전달돼 비용 낭비·Prompt Injection 경로 가능 | `update-knowledge-base.dto.ts:38–48` | `@Matches(/^[\w\-.:\/]{1,100}$/)` 또는 서버 측 허용 목록(allowlist) 검증 추가; `SUPPORTED_DIMS`·DTO·허용 목록을 중앙 상수로 통합 관리 |
| 2 | Security | `POST /:id/re-embed` rate limiting 누락 — 다른 엔드포인트에는 `@Throttle`이 있으나 이 엔드포인트는 없어 editor 권한 사용자가 반복 호출로 LLM API 예산 소진·DB 과부하 유발 가능 | `knowledge-base.controller.ts:143–172` | `@Throttle({ default: { limit: 3, ttl: 60_000 } })` 적용; KB별 중복 실행 방지 플래그 추가 |
| 3 | Database / Concurrency | `reEmbedAll` 트랜잭션 부재 — `embedding_dimension = NULL` 초기화 후 프로세스 크래시 시 dimension은 NULL이지만 청크는 이전 차원값으로 남아 검색 불능 상태 발생 | `knowledge-base.service.ts:112–135` | `reEmbedStatus` 컬럼('pending'→'processing'→'completed') 추가 또는 롤백 로직 구현; 최소한 `lastReEmbedRequestedAt` 타임스탬프 기록 |
| 4 | Concurrency / Side Effect | `reEmbedAll` 중복 호출 시 청크 이중 삽입 레이스 — 같은 문서에 두 태스크가 동시 처리될 때 `DELETE → INSERT` 인터리빙으로 청크 데이터 오염 가능 | `knowledge-base.service.ts` + `embedding.service.ts` `doProcess` | KB 레벨 재임베딩 잠금 플래그(`isReEmbedding`) 도입; `UPDATE ... WHERE isReEmbedding = false RETURNING id` 단일 진입점 보장; 프론트엔드 진행 중 버튼 비활성화 |
| 5 | Side Effect / API Contract | `embeddingModel` 변경 후 재임베딩 전 신규 문서 업로드 시 영구 error 처리 — 기존 `embeddingDimension`(예: 1536)이 유지된 상태에서 새 모델(예: 3072차원) 임베딩 시 dimension mismatch 예외로 문서가 영구 error 상태 | `knowledge-base.service.ts` `update()` | `embeddingModel` 변경 시 `embeddingDimension = NULL` 함께 초기화; 또는 API 응답에 `reEmbedRequired: boolean` 플래그 포함 |
| 6 | Dependency / Maintainability | `SUPPORTED_DIMS` ↔ SQL partial HNSW 인덱스 이중 관리 의존성 — 새 차원 도입 시 마이그레이션 추가와 상수 수정을 함께 해야 하지만 강제 메커니즘 없음; 한쪽 누락 시 해당 KB가 검색에서 조용히 제외 | `rag-search.service.ts:8` + `V021__variable_embedding_dimension.sql` | 공유 상수 파일(`embedding-dimensions.const.ts`)로 분리; 마이그레이션 파일명 규칙 또는 단위 테스트로 계약 검증; 누락 시 `ERROR` 레벨 로깅으로 변경 |
| 7 | Architecture | `PATCH /knowledge-bases/:id` 응답에 재임베딩 필요 여부 미표시 — 모델 변경 후 검색이 의미적 불일치 또는 pgvector 타입 오류 상태로 동작할 수 있으나 API 응답에 표현되지 않음 | `knowledge-base.service.ts` `update()` | 응답에 `{ reEmbedRequired: boolean }` 플래그 추가 또는 UI에서 "재임베딩 필요" 배지 표시 |
| 8 | API Contract | `GET /llm-configs/:id/models?type=` `@ApiQuery` 데코레이터 누락 — Swagger UI에 파라미터가 노출되지 않아 API 클라이언트 자동 생성 시 누락 | `llm-config.controller.ts:209` | `@ApiQuery({ name: 'type', required: false, enum: ['chat', 'embedding'] })` 추가 |
| 9 | Architecture | 비즈니스 로직이 컨트롤러에 위치 — `type` 파라미터 필터링이 컨트롤러에서 처리됨 | `llm-config.controller.ts:212–218` | `llmService.listModels(id, workspaceId, { type })` 시그니처로 서비스 레이어로 이동 |
| 10 | Performance | 전체 청크 임베딩을 메모리에 누적 후 INSERT — 1000청크 × 3072차원 ≈ 24MB 단일 힙 객체; 대용량 문서에서 GC 압박·OOM 위험 | `embedding.service.ts:129` `allEmbeddings` | 배치 임베딩 직후 즉시 INSERT하는 스트리밍 방식으로 변경 |
| 11 | Performance | RAG 검색 그룹 직렬 처리 — (model, dim) 그룹마다 `embed()` + SQL을 순차 await; 독립적 그룹을 병렬화 가능 | `rag-search.service.ts:101–135` | `await Promise.all([...groups.values()].map(g => searchGroup(g)))` 패턴으로 병렬화 |
| 12 | Testing | `RagSearchService` unsupported dimension 경로 테스트 없음 — `embeddingDimension`이 512 등 `SUPPORTED_DIMS` 미포함 값일 때 빈 결과 반환 동작 미검증 | `rag-search.service.spec.ts` 전체 | `embeddingDimension: 512` fixture로 결과 `[]` 및 embed 미호출 검증 테스트 추가 |
| 13 | Testing | `KnowledgeBaseController.reEmbedAll` 컨트롤러 테스트 없음 — 권한 검증, 202 응답, 404 케이스 미검증 | `knowledge-base.controller.ts:143–170` | 컨트롤러 spec에 성공·404 케이스 추가 |
| 14 | Testing | 멀티배치(청크 수 > 20) 차원 일관성 미테스트 — 배치 간 `expectedDim` 불일치 경로 미커버 | `embedding.service.spec.ts` 전체 | 21개 이상 청크 반환 mock으로 멀티배치 테스트 추가 |
| 15 | Testing | `EmbeddingModelCombobox` 컴포넌트 테스트 없음 — graceful degrade, enabled/disabled 조건, datalist 렌더링 미검증 | `embedding-model-combobox.tsx` | `@testing-library/react` + msw로 단위 테스트 추가 |
| 16 | Testing | `handleSaveSettings` payload diff 로직 테스트 없음 — 필드별 비교·trim 검증·조기 return 분기 미커버 | `[id]/page.tsx:175–202` | 순수 함수 추출 후 단위 테스트 또는 컴포넌트 테스트로 커버 |
| 17 | Testing | `reEmbedAll` 일부 문서 실패 시 `.catch` 핸들러 동작 미검증 | `knowledge-base.service.ts:120–135` | 첫 번째 호출 reject·두 번째 resolve 케이스로 `.catch` 및 `documentCount` 정확성 검증 |
| 18 | Requirement / Frontend | 프론트엔드 `payload` 타입 불일치 — `Record<string, string | number>`가 `mutationFn` 인자 타입에 assignable하지 않아 `tsc --strict` 빌드 시 오류 가능 | `[id]/page.tsx:175–185` | `{ name?: string; description?: string; embeddingModel?: string; chunkSize?: number; chunkOverlap?: number }` 타입으로 명시 |
| 19 | Requirement | 청크 크기·중첩 범위 프론트엔드 검증 누락 — 범위 외 값 입력 시 백엔드 400만 반환하고 구체적 피드백 없음 | `[id]/page.tsx:193–196` | 사전 검증 추가 (`cs < 100 || cs > 8000` 등) + 에러 토스트 |
| 20 | Maintainability | 응답 envelope 이중 파싱 — `res?.documentCount ?? res?.data?.documentCount ?? 0` 임시 로직이 컴포넌트에 인라인 존재; `documentCount`가 항상 0 fallback 가능 | `[id]/page.tsx:148–160` | `knowledge-bases.ts` `reEmbedAll`에서 envelope 벗겨 `{ documentCount: number }` 타입으로 반환 |
| 21 | Maintainability | 인라인 모달 3개 구조 중복 — `fixed inset-0 z-50 ...` 오버레이 패턴이 복사·반복됨 | `[id]/page.tsx:316–437` | `ConfirmModal` 컴포넌트 추출 또는 shadcn/ui Dialog 활용 |
| 22 | Architecture | ORM 우회 raw SQL 사용 — `embedding_dimension = NULL` 업데이트에만 `dataSource.query(raw SQL)` 사용; 나머지 업데이트는 repository 패턴 | `knowledge-base.service.ts:112–115` | `kbRepository.update({ id }, { embeddingDimension: null as unknown as number })` 로 통일 |
| 23 | Concurrency | `embedding_dimension` 초기화와 첫 청크 INSERT 사이 TOCTOU — `expectedDim` 결정을 트랜잭션 외부에서 수행, 두 태스크의 mismatched dimension 검사가 느슨하게 동작 가능 | `embedding.service.ts` `doProcess` | `expectedDim` 초기값 결정을 트랜잭션 내 `SELECT ... FOR SHARE`로 이동 |
| 24 | Dependency | `KnowledgeBaseModule` `EmbeddingService` 등록 여부 미확인 — diff에 `knowledge-base.module.ts` 미포함; DI 오류 가능 | `knowledge-base.service.ts:37` | `knowledge-base.module.ts` providers 배열에 `EmbeddingService` 등록 확인 |
| 25 | API Contract | `POST /:id/re-embed` 재임베딩 중 검색 일시 중단이 API에 미문서화 — NULL 초기화 이후 재임베딩 완료 전 KB가 검색에서 제외되는 동작이 응답 스펙에 없음 | `knowledge-base.service.ts` `reEmbedAll()` | `@ApiOperation.description`에 "재임베딩 진행 중 해당 KB 검색 제외" 명시; 프론트엔드 확인 모달에 안내 문구 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `memory/kb-embedding-model-selection.md` 미완료 상태로 커밋 — `(작업 중. 완료 시 갱신.)` 그대로 PR 포함 | `memory/kb-embedding-model-selection.md` 마지막 줄 | 완료 상태 및 결과 요약으로 갱신; 로컬 절대경로 참조 제거 |
| 2 | Documentation | `reEmbedAll` 주석의 "비동기 큐" 표현이 실제 구현(fire-and-forget)과 불일치 | `knowledge-base.service.ts:109–112` | `// fire-and-forget 으로 실행하고 처리 수만 즉시 반환`으로 수정 |
| 3 | Documentation | spec 참조 경로 형식 불일치 — `embedding.service.ts`는 `spec 8-embedding-pipeline.md`, SQL 파일은 전체 경로 표기 | `embedding.service.ts:137` | 전체 경로(`spec/5-system/8-embedding-pipeline.md §5.3`)로 통일 |
| 4 | Maintainability | `?? null` 불필요한 이중 처리 — `kb.embeddingDimension`이 이미 `number | null` 타입 | `embedding.service.ts:127` | `let expectedDim = kb.embeddingDimension;` |
| 5 | Maintainability | 오류 메시지 한/영 혼재 — 앞부분 영어 + 끝부분 한국어; 로그·DB metadata에 저장됨 | `embedding.service.ts:143` | 영어로 통일하거나 로그용/사용자노출용 분리 |
| 6 | Maintainability | `reEmbedAll` 컨트롤러가 DTO 대신 plain object 반환 | `knowledge-base.controller.ts:162–164` | `satisfies KbReEmbedAcceptedDto` 타입 체크 강화 |
| 7 | Testing | `EmbeddingService` spec에서 `buildModule`을 `beforeEach` 대신 각 `it` 블록 내부에서 호출 | `embedding.service.spec.ts` | `beforeEach`로 통일 |
| 8 | Testing | `RagSearchService` spec의 `buildKbsQueryReturn` 이중 Promise 래핑 | `rag-search.service.spec.ts:8–14` | rows 배열 직접 반환으로 단순화 |
| 9 | Testing | 차원 불일치 테스트의 mock embed가 청크 수와 다른 벡터 개수 반환 | `embedding.service.spec.ts` ~148 | `mockResolvedValue([[...], [...]])` 청크 수 맞춤 |
| 10 | Testing | `UpdateKnowledgeBaseDto.embeddingModel` 경계값 테스트 없음 — 101자·빈 문자열·공백 전용 미검증 | `update-knowledge-base.dto.ts:31–42` | 경계값 테스트 추가 |
| 11 | Requirement | i18n 키 `updated`/`updateFailed`/`nameRequired`가 en/ko diff에 미포함 | `[id]/page.tsx:133,135,165` | 사전 파일 존재 여부 확인 후 없으면 추가 |
| 12 | Dependency | pgvector ≥ 0.5(HNSW) 런타임 요구사항이 패키지 의존성으로 미관리 | `V021__variable_embedding_dimension.sql:2` 주석 | README/인프라 문서에 pgvector 최소 버전 명기; CI DB 이미지 버전 고정 |
| 13 | Architecture | `EmbeddingModelCombobox`가 워크스페이스 컨텍스트를 스스로 해결 — 단일 책임 위반 | `embedding-model-combobox.tsx:32–50` | `defaultConfigId`를 prop으로 받거나 Context로 주입 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Performance | **HIGH** | 백프레셔 없는 전체 동시 발사 + 폴링 동시성 제어 + 블로킹 HNSW 인덱스 생성 |
| Database | **HIGH** | `ALTER COLUMN` 전체 잠금 + `CREATE INDEX` 비 CONCURRENTLY + reEmbedAll 트랜잭션 부재 |
| Side Effect | **HIGH** | 기존 인덱스 미삭제로 마이그레이션 실패 가능 + 모델 변경 후 신규 문서 영구 error |
| Architecture | **MEDIUM** | fire-and-forget 내구성 부재 + 컨트롤러 비즈니스 로직 + SUPPORTED_DIMS 묵시적 결합 |
| API Contract | **MEDIUM** | embeddingModel 변경 시 embeddingDimension 미초기화 + silent skip 미문서화 |
| Concurrency | **MEDIUM** | reEmbedAll 중복 호출 청크 이중 삽입 + TOCTOU + 프로세스-로컬 activeTasks |
| Security | **MEDIUM** | embeddingModel allowlist 검증 없음 + re-embed throttle 없음 |
| Testing | **MEDIUM** | 핵심 경로(unsupported dim, 멀티배치, 컨트롤러, 프론트엔드 컴포넌트) 커버리지 누락 |
| Requirement | **MEDIUM** | 입력 검증 부재 + 프론트엔드 타입 불일치 + 재호출 방지 미흡 |
| Maintainability | **LOW** | search() 책임 집중 + SQL 텍스트 하드코딩 테스트 + 모달 구조 중복 |
| Scope | **LOW** | KB 설정 모달이 의도적으로 기존 필드까지 노출 (명시적 수락 권장) |
| Dependency | **LOW** | SUPPORTED_DIMS ↔ 마이그레이션 동기화 강제 수단 없음 + EmbeddingService 모듈 등록 미확인 |
| Documentation | **LOW** | @ApiQuery 누락 + reEmbedAll 주석 "큐" 표현 오해 소지 |

## 발견 없는 에이전트
없음 — 모든 13개 에이전트가 발견사항 보고

---

## 권장 조치사항

1. **[즉시 — 배포 차단]** `V021` 마이그레이션에 기존 인덱스 `DROP IF EXISTS` 추가 후, `CREATE INDEX CONCURRENTLY`를 별도 마이그레이션으로 분리; 운영 배포 전 `document_chunk` 테이블 크기 기준 잠금 시간 사전 측정
2. **[즉시 — 데이터 오염 방지]** `reEmbedAll`에 KB 레벨 잠금 플래그(`isReEmbedding`) 추가하여 중복 호출 차단; 프론트엔드 확인 버튼 진행 중 비활성화
3. **[즉시 — 보안]** `embeddingModel` DTO에 패턴 검증 추가; `re-embed` 엔드포인트에 `@Throttle` 적용
4. **[단기]** `embeddingModel` 변경 시 `embeddingDimension = NULL` 함께 초기화하여 신규 문서 영구 error 방지; API 응답에 `reEmbedRequired` 플래그 포함
5. **[단기]** `reEmbedAll` 동시 발사에 `p-limit` 적용 + `embedding.service.ts` 폴링 세마포어 교체; `allEmbeddings` 메모리 누적을 스트리밍 INSERT로 변경
6. **[단기]** `SUPPORTED_DIMS` 공유 상수 파일로 분리; 알 수 없는 차원 진입 시 로그 레벨 `WARN→ERROR` 격상
7. **[단기]** 누락 테스트 추가: unsupported dimension 경로, 컨트롤러 `reEmbedAll`, `EmbeddingModelCombobox`, `handleSaveSettings` diff 로직
8. **[단기]** 프론트엔드 `payload` 타입 명시; `reEmbedAll` API 반환 타입 확정 후 이중 envelope 파싱 제거
9. **[중기]** `reEmbedAll` fire-and-forget을 BullMQ 등 지속형 큐로 전환하여 프로세스 재시작 시 태스크 유실 방지; KB에 `reEmbedStatus` 상태 필드 추가
10. **[중기]** `search()` 메서드를 `groupKbsByModel`, `searchGroup`, `mergeAndRank` private 헬퍼로 분리; 페이지 컴포넌트 설정 로직을 `useKbSettings` 훅으로 추출