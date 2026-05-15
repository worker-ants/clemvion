### 발견사항

---

**[CRITICAL] ALTER COLUMN 실행 전 기존 인덱스 미삭제**
- 위치: `V021__variable_embedding_dimension.sql:6`
- 상세: `ALTER TABLE document_chunk ALTER COLUMN embedding TYPE vector` 는 컬럼에 종속된 인덱스가 존재하면 오류로 중단됩니다. V005 이전 마이그레이션에서 `vector(1536)` 컬럼에 HNSW/IVFFlat 인덱스를 생성했다면, 해당 인덱스를 먼저 DROP하지 않으면 이 마이그레이션 자체가 실패합니다.
- 제안: 마이그레이션 상단에 `DROP INDEX IF EXISTS <기존 인덱스명>` 구문을 추가하거나, 이전 마이그레이션에 인덱스가 없음을 명시적으로 확인해야 합니다.

---

**[WARNING] ALTER TABLE 전체 테이블 리라이트 → 독점 잠금**
- 위치: `V021__variable_embedding_dimension.sql:6`
- 상세: PostgreSQL에서 컬럼 타입 변경은 전체 테이블을 리라이트하면서 `ACCESS EXCLUSIVE` 잠금을 보유합니다. `document_chunk`가 대용량 테이블이면 이 마이그레이션 실행 중 모든 읽기/쓰기가 차단됩니다. 주석에서 인덱스는 `CONCURRENTLY` 사용을 안내하지만 ALTER TABLE 자체에 대한 가동 중단 위험은 언급이 없습니다.
- 제안: 운영 배포 전 유지보수 창을 확보하거나, pglogical/pg_repack 등을 통한 무중단 방법을 검토합니다.

---

**[WARNING] reEmbedAll이 원자적이지 않음 — 부분 실패 시 상태 불일치**
- 위치: `knowledge-base.service.ts` `reEmbedAll` 메서드
- 상세: (1) `embedding_dimension = NULL` UPDATE → (2) 문서 조회 → (3) processDocument 비동기 발사 순서로 진행됩니다. 1번 직후 프로세스가 죽거나 2번이 예외를 던지면 `embedding_dimension`은 NULL로 초기화됐지만 재임베딩 작업은 하나도 큐잉되지 않습니다. 이 KB에 이후 단건 문서가 추가되면 `embeddingDimension = null` 상태로 처리돼 새 차원이 올바르게 설정되지만, 기존 청크들은 이전 차원으로 남아 혼재됩니다.
- 제안: `embedding_dimension` 초기화와 문서 큐잉 사이에서 발생하는 예외를 잡아 복구하거나, 큐잉 실패 시 dimension을 원복하는 롤백 로직을 추가합니다.

---

**[WARNING] embeddingModel 변경 후 재임베딩 전 신규 문서 업로드 시 영구 error 처리**
- 위치: `embedding.service.ts:134–148`, `knowledge-base.service.ts` `update` 메서드
- 상세: `PATCH /knowledge-bases/:id`로 `embeddingModel`을 변경해도 `embedding_dimension`은 기존 값(예: 1536)을 유지합니다. 이 상태에서 신규 문서가 업로드·임베딩되면 `expectedDim = 1536`에 새 모델(예: 3072차원)의 벡터가 들어와 "dimension mismatch" 예외가 발생하고 문서가 `error` 상태로 영구 처리됩니다. 프론트엔드 경고 문구가 있지만 API 레벨에서는 아무런 방어 장치가 없습니다.
- 제안: 모델 변경 시 `embedding_dimension`을 함께 NULL로 초기화하거나, 모델이 변경됐을 때 신규 문서 임베딩 요청을 차단하는 validation을 추가합니다.

---

**[WARNING] KnowledgeBaseService ↔ EmbeddingService 의존성 — 모듈 등록 미확인**
- 위치: `knowledge-base.service.ts:18,36`
- 상세: `KnowledgeBaseService`가 `EmbeddingService`를 주입받고, `EmbeddingService`는 `KnowledgeBase` 리포지토리를 주입받습니다. NestJS에서 같은 모듈의 provider 간 직접 의존은 허용되지만, `EmbeddingService`가 이미 `@Inject(forwardRef(() => WebsocketService))`를 사용하는 것으로 보아 순환 참조가 있는 환경입니다. 모듈 파일(`knowledge-base.module.ts`)이 변경 목록에 없어 `EmbeddingService`가 실제로 `KnowledgeBaseModule`의 provider로 등록·export되는지 확인할 수 없습니다. 런타임 DI 오류로 이어질 수 있습니다.
- 제안: `knowledge-base.module.ts`에서 `EmbeddingService`가 providers 배열에 포함되어 있는지 확인합니다.

---

**[WARNING] reEmbedAll 중복 호출 시 청크 데이터 오염 레이스**
- 위치: `knowledge-base.service.ts` `reEmbedAll`, `embedding.service.ts` `doProcess`
- 상세: 사용자가 짧은 간격으로 재임베딩 버튼을 두 번 누르면, 같은 문서에 대해 두 개의 `processDocument(docId, true)` 호출이 큐에 쌓입니다. 첫 번째 호출이 청크를 INSERT한 뒤 두 번째 호출이 `chunkRepository.delete({ documentId })`로 방금 INSERT된 청크를 삭제하고 다시 INSERT하는 구조가 됩니다. `embedding_dimension IS NULL` 가드는 중복 dimension 설정만 막아주지, 청크 중복 처리는 막지 못합니다.
- 제안: 프론트엔드에서 재임베딩 진행 중 버튼을 비활성화하거나, `reEmbedAll` 엔드포인트에서 진행 중인 작업이 있으면 409를 반환하는 idempotency 처리를 추가합니다.

---

**[INFO] SUPPORTED_DIMS 하드코딩 — 인덱스·코드 이중 관리 필요**
- 위치: `rag-search.service.ts:8`
- 상세: 새로운 차원의 임베딩 모델을 도입할 때 DB 마이그레이션(partial HNSW 인덱스 추가)과 `SUPPORTED_DIMS` Set 수정이 모두 필요합니다. 둘 중 하나가 누락되면 해당 차원 KB는 검색에서 조용히 제외됩니다(warning 로그만 남고 에러는 없음).
- 제안: 서비스 시작 시 DB에서 실제 인덱스 차원 목록을 동적으로 조회하거나, 누락 시 명시적으로 오류를 발생시키는 방어 코드를 고려합니다.

---

**[INFO] kbReEmbedMutation 성공 핸들러의 이중 응답 구조 언래핑**
- 위치: `frontend/src/app/(main)/knowledge-bases/[id]/page.tsx:148–157`
- 상세: `res?.documentCount ?? res?.data?.documentCount ?? 0` 형태의 dual-shape 처리가 있습니다. `knowledgeBasesApi.reEmbedAll`이 이미 axios `data`를 한 번 언래핑하므로, 응답 인터셉터 구조에 따라 `documentCount`를 찾지 못하고 항상 `0`을 표시할 수 있습니다.
- 제안: `knowledgeBasesApi.reEmbedAll`의 반환 타입을 `Promise<{ message: string; documentCount: number }>` 로 명시하고, 호출 지점에서 단일 구조로만 접근합니다.

---

### 요약

이번 변경은 가변 차원 임베딩 지원이라는 목표에 충실하며 전반적인 설계는 건전합니다. 다만 **프로덕션 배포 시 실질적 위험**이 되는 두 가지가 존재합니다. 첫째, V021 마이그레이션에서 기존 `vector(1536)` 인덱스 DROP 없이 `ALTER COLUMN TYPE` 를 실행하면 마이그레이션 자체가 실패할 수 있고, 이는 롤백 없이 테이블을 불일치 상태로 남길 수 있습니다. 둘째, `embeddingModel` 변경 후 재임베딩 전 신규 문서 업로드가 차원 불일치로 영구 error 처리되는 흐름은 API 수준에서 방어되지 않아 사용자 혼란을 유발할 수 있습니다. `reEmbedAll`의 비원자적 처리와 중복 호출 레이스도 운영 환경에서 발생 가능한 사이드 이펙트입니다.

### 위험도

**HIGH**