## 발견사항

### [CRITICAL] DOWN 마이그레이션 - `failed` 상태 롤백 시 CHECK 위반
- **위치**: `V037__kb_retry_failed_status.sql` (DOWN 주석 섹션)
- **상세**: DOWN 절에서 `chk_doc_graph_extraction_status` 를 `'failed'` 없이 다시 추가하기 전, 현재 `failed` 상태인 행을 변환하는 UPDATE 가 없음. 롤백 실행 시 `ALTER TABLE ADD CONSTRAINT` 가 기존 `failed` 값을 가진 행 때문에 실패하거나 데이터 정합성이 깨짐.
- **제안**:
  ```sql
  -- DOWN 절에 추가
  UPDATE document SET graph_extraction_status = 'error'
    WHERE graph_extraction_status = 'failed';
  UPDATE document SET embedding_status = 'error'
    WHERE embedding_status = 'failed';
  ```

---

### [WARNING] `retryFailedDocuments` / `reEmbedAll` — UPDATE 와 큐 add 비원자성
- **위치**: `knowledge-base.service.ts:retryFailedDocuments`, `reEmbedAll`
- **상세**: `UPDATE ... SET status='pending' RETURNING id` 후 프로세스가 죽으면 문서는 `pending` 상태이지만 큐에 잡이 없음. `StuckDocumentRecoveryService` 는 `processing` 상태만 회수하므로 `pending` 고아 문서는 영원히 처리되지 않음.
- **제안**: UPDATE + addBulk 를 같은 DB 트랜잭션 또는 outbox 패턴으로 묶거나, 부트스트랩 회수 대상에 `pending + last_attempted_at < threshold` 조건도 포함 검토.

---

### [WARNING] 스펙 요구사항 미구현 — 재시도 카운트 툴팁
- **위치**: `frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` (문서 목록 뱃지 영역)
- **상세**: `spec/2-navigation/5-knowledge-base.md` 에 `embedding_retry_count > 0` 일 때 hover tooltip 으로 `embeddingErrorMessage` + 재시도 카운트를 노출하도록 명시. `retryAttemptInfo` / `lastError` i18n 키도 정의되었으나, `page.tsx` diff 에 이를 사용하는 코드가 없음.
- **제안**: 문서 목록의 상태 뱃지에 `embeddingRetryCount > 0` 시 Tooltip 컴포넌트 추가. 정의된 i18n 키 활용.

---

### [WARNING] `retryFailedDocuments` 배치 크기 제한 없음
- **위치**: `knowledge-base.service.ts:retryFailedDocuments` (addBulk 호출)
- **상세**: `failed` 문서가 수천 건일 경우 `addBulk` 단일 호출로 전체를 큐에 넣으면 Redis/BullMQ 에 순간 부하가 집중될 수 있음. 스펙에 상한이 명시되지 않았으나 운영 시 문제 발생 가능.
- **제안**: `addBulk` 를 100~500건 단위로 청크 처리하거나, API 응답 후 background job 으로 분산.

---

### [WARNING] `graphStats` `pendingDocumentCount` — NULL 상태 문서 누락 가능성
- **위치**: `knowledge-base.service.ts:getGraphStats` SQL
- **상세**: `total = COUNT(*)` 는 모든 문서를 셈. 그러나 `graph_extraction_status IS NULL` 인 문서는 `completed + failed + pending` 어디에도 포함되지 않음. `vector` 모드로 추가된 문서가 graph KB 로 이전된 경우 등 엣지 케이스에서 `completed + failed + pending ≠ total` 이 될 수 있음.
- **제안**: pending 카운트에 `OR graph_extraction_status IS NULL` 조건 추가 또는 query 주석에 전제 조건 명시.

---

### [INFO] `retryFailed` 컨트롤러 — DTO 클래스 없이 수동 검증
- **위치**: `knowledge-base.controller.ts:retryFailed` (130번째 부근)
- **상세**: `@Body() body: { scope?: ... }` 로 plain object 를 받고 수동 `includes()` 검사를 수행. NestJS class-validator DTO 클래스가 아니므로 OpenAPI 스키마에 enum 제약이 자동 반영되지 않음.
- **제안**: `RetryFailedDto` 클래스에 `@IsIn(['embedding','graph','all'])` + `@IsOptional()` 사용.

---

### [INFO] i18n 키 `retryAttemptInfo` / `lastError` 미사용 데드코드
- **위치**: `en.ts:1701`, `ko.ts:1697` (신규 추가 키)
- **상세**: 두 키 모두 위의 미구현 툴팁 용도로 정의되었으나 현재 사용처 없음. 단독으로는 무해하지만 툴팁 구현 전까지 혼란 소지.

---

### [INFO] Plan 문서 체크박스 미갱신 / 파일 목록 불일치
- **위치**: `plan/in-progress/rag-kb-retry-failure-recovery.md`
- **상세**: PR1~PR5 모두 `[ ]` 미완 상태로 남아있음. 또한 신규 파일 목록에 `embedding-progress-box.tsx` 가 열거되어 있으나 해당 컴포넌트는 `page.tsx` 에 인라인 처리되어 별도 생성되지 않음.
- **제안**: 구현 완료된 항목 체크 후 완료 시 `plan/complete/` 이동. 파일 목록에서 `embedding-progress-box.tsx` 제거.

---

### [INFO] `embeddingStats` 쿼리 — KB 데이터 로드 의존 워터폴
- **위치**: `page.tsx:embeddingStats useQuery` (`enabled: !!kb`)
- **상세**: KB 메타데이터가 로딩 완료될 때까지 통계 fetch 를 지연시킴. `id` 가 이미 URL param 으로 존재하므로 `enabled: true` 로 변경 가능.
- **제안**: `enabled: true` 로 변경하여 병렬 fetch 허용.

---

## 요약

전체 구현은 스펙(`spec/5-system/8-embedding-pipeline.md`, `10-graph-rag.md`)에 정의된 자동 재시도, 상태 분리(`error`/`failed`), stuck 회수, 일괄 재시도 API, WS 이벤트, 프론트엔드 진행 박스를 대체로 정확하게 반영하고 있다. 핵심 기능 흐름(`retryWithBackoff`, `StuckDocumentRecoveryService`, `retryFailed` API, `useKbEvents`)은 요구사항과 일치하며, 테스트 커버리지도 주요 경로를 충분히 검증한다. 단, **DOWN 마이그레이션의 `failed→error` 역변환 누락**(배포 후 롤백 불가 위험)과 **`retryFailedDocuments`·`reEmbedAll` 의 비원자적 UPDATE-큐 패턴**(pending 고아 문서 발생)이 운영 안정성에 직결되는 결함이며, 스펙에 명시된 **재시도 카운트 tooltip** 이 구현되지 않은 점도 기능 완전성 관점에서 미충족 항목이다.

## 위험도

**HIGH**