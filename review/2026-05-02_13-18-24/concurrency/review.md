### 발견사항

- **[WARNING]** `activeTasks` 폴링 방식의 동시성 제어
  - 위치: `embedding.service.ts` — `processDocument` / `while (this.activeTasks >= MAX_CONCURRENT)`
  - 상세: Node.js 단일 스레드 특성상 check→increment 사이에 다른 코루틴이 끼어들 수 없어 **카운터 자체는 안전**하다. 그러나 대규모 KB 재임베딩 시 (예: 200개 문서) 197개 태스크가 500ms마다 `setTimeout` 폴링을 발생시켜 이벤트 루프에 불필요한 타이머 콜백을 누적시킨다. 이 방식은 throughput이 늘어날수록 polling overhead가 선형으로 증가한다.
  - 제안: `p-limit`, `async.queue`, 또는 직접 구현한 `Semaphore(resolve queue)` 방식으로 교체해 폴링 없이 완료 시점에 대기 태스크를 깨우도록 변경.

---

- **[WARNING]** 동일 KB에 `reEmbedAll` 중복 호출 시 청크 중복 삽입 레이스
  - 위치: `knowledge-base.service.ts` — `reEmbedAll`, `embedding.service.ts` — `doProcess` / `chunkRepository.delete`
  - 상세: `reEmbedAll`은 즉시 202를 반환하고 태스크를 fire-and-forget으로 디스패치한다. 짧은 간격으로 같은 KB에 두 번 호출되면 첫 번째 run의 태스크들과 두 번째 run의 태스크들이 동시에 큐에 존재하게 된다. `doProcess` 내 `chunkRepository.delete`는 트랜잭션 밖에서 실행되므로 두 태스크가 같은 `documentId`를 동시에 처리할 경우 다음 순서가 가능하다:
    1. Task-A `DELETE` → Task-A `INSERT(chunks)` → Task-B `DELETE`(Task-A 결과 삭제) → Task-B `INSERT(chunks)`
    2. 최종 상태는 정상이지만 도중 status 플래핑, 웹소켓 이벤트 이중 발생이 발생한다.
    3. Task-A와 Task-B가 MAX_CONCURRENT 슬롯을 동시에 점유하면: `DELETE`→`INSERT`가 인터리빙되어 **동일 문서 청크가 2배 중복** 저장될 수 있다.
  - 제안: `reEmbedAll` 시작 시 해당 KB의 all-doc status를 `pending`으로 원자적으로 업데이트하고, `doProcess`에서 자기 문서의 status가 `processing`이 아닐 때만 진행하는 optimistic lock 패턴 적용. 또는 KB 레벨 재임베딩 잠금 플래그(`isReEmbedding` 컬럼)를 `UPDATE ... WHERE isReEmbedding = false RETURNING id`로 단일 진입점을 보장.

---

- **[WARNING]** `embedding_dimension` 초기화와 첫 번째 청크 INSERT 사이의 TOCTOU
  - 위치: `embedding.service.ts` — `doProcess` step 6 / `manager.query('UPDATE knowledge_base SET embedding_dimension...')`
  - 상세: `kb.embeddingDimension`을 트랜잭션 시작 **전** `kbRepository.findOne`으로 읽은 뒤, 트랜잭션 내부에서 `AND embedding_dimension IS NULL` 조건부 UPDATE를 수행한다. 두 `doProcess` 인스턴스가 모두 `embeddingDimension = null`인 상태에서 KB를 로드한 경우, 두 트랜잭션 모두 조건부 UPDATE를 시도한다. DB의 UPDATE는 row-level lock으로 **값 설정은 한 번만** 이루어지므로 실제 오염은 없다. 단, 조건 검사(`kb.embeddingDimension == null`)를 트랜잭션 안에서 `SELECT FOR UPDATE`로 다시 확인하지 않기 때문에 mismatched dimension 체크(`v.length !== expectedDim`)가 두 번째 태스크에서는 KB가 이미 dimension을 가졌더라도 **느슨하게 동작**할 수 있다.
  - 제안: `doProcess` 내 `expectedDim` 초기값 결정(`kb.embeddingDimension ?? null`)을 트랜잭션 내 `SELECT embedding_dimension FROM knowledge_base WHERE id = $1 FOR SHARE`로 이동해 일관성 검사와 저장이 같은 트랜잭션 경계 안에 있도록 변경.

---

- **[WARNING]** `activeTasks`가 프로세스-로컬 상태 — 수평 확장 시 제어 무력화
  - 위치: `embedding.service.ts:17` — `private activeTasks = 0`
  - 상세: `MAX_CONCURRENT = 3`은 단일 인스턴스 기준이다. 인스턴스가 N개 실행되면 실제 동시 임베딩 호출은 `3N`개가 가능해 OpenAI embedding API rate limit 또는 DB connection pool 한도를 초과할 수 있다.
  - 제안: 프로덕션 멀티-인스턴스 환경이라면 Redis-backed Semaphore 또는 BullMQ 큐를 사용하거나, 단일 인스턴스 운영을 문서화.

---

- **[WARNING]** DB 마이그레이션 — `CREATE INDEX`(non-CONCURRENTLY)의 테이블 잠금
  - 위치: `V021__variable_embedding_dimension.sql` — lines 18–28 (`CREATE INDEX idx_chunk_emb_hnsw_*`)
  - 상세: 일반 `CREATE INDEX`는 `ShareLock`을 획득해 인덱스 빌드 중 해당 테이블에 대한 **쓰기를 차단**한다. 운영 데이터가 많은 경우 수분~수십 분 동안 document_chunk INSERT/DELETE가 블록된다(임베딩 파이프라인 전면 중단). 파일 끝 주석이 이를 인식하고 있으나 migration 자체는 non-CONCURRENTLY로 작성되어 있다.
  - 제안: 초기 운영 전 적용이면 현재 방식이 무방하지만, 운영 중 적용 시 마이그레이션을 두 단계로 분리: (1) `ALTER TABLE`, `ADD COLUMN` (빠른 DDL), (2) 별도 마이그레이션에서 `CREATE INDEX CONCURRENTLY` (잠금 없이 빌드).

---

- **[INFO]** Fire-and-forget 태스크 — 프로세스 재시작 시 손실
  - 위치: `knowledge-base.service.ts` — `reEmbedAll` for loop
  - 상세: 큐잉된 임베딩 태스크는 인메모리이므로 서버 재시작 시 진행 중이던 모든 태스크가 유실된다. 현재 설계에서 문서 status가 `pending` 또는 `processing`으로 남아 사용자가 수동으로 재시도해야 한다.
  - 제안: 현재 요구사항 수준에서는 허용 가능. 중요도가 높아지면 BullMQ/Bull 같은 지속형 큐 도입 고려.

---

### 요약

변경사항의 핵심 동시성 구조는 Node.js 단일 스레드 모델을 전제로 설계되어 기본 카운터 레이스는 없다. 그러나 **`reEmbedAll` 중복 호출 시 동일 문서 청크 이중 삽입 가능성**, **`embedding_dimension` TOCTOU(read-outside-transaction + conditional-update)**, **`CREATE INDEX` non-CONCURRENTLY로 인한 운영 쓰기 차단** 세 가지가 실제 데이터 오염 또는 서비스 중단으로 이어질 수 있는 실질적 위험이다. 나머지(폴링 비효율, 멀티-인스턴스 concurrency 미고려)는 운영 규모가 커질 때 문제가 된다.

### 위험도

**MEDIUM**