### 발견사항

- **[INFO]** `graph-extraction.service.ts` — `pLimit` 병렬 청크 처리에서 공유 변수 누적
  - 위치: `doExtract()` 내 `totalEntityDelta`, `totalRelationDelta`, `processed` 누적 구간
  - 상세: `CHUNK_LLM_CONCURRENCY=3` 개의 async task가 동시에 `await this.persistExtraction(...)` 이후 세 변수를 증가시킨다. JavaScript 단일 스레드 + 이벤트 루프 모델에서는 `await` 없는 연속 라인(`+= entitiesInserted`, `+= relationsInserted`, `+= 1`, `Math.round(...)`) 이 원자적으로 실행되므로 실제 데이터 레이스는 발생하지 않는다. 그러나 누적 블록 사이에 `await`가 추가되는 순간 누락/이중 집계가 가능한 구조적 취약점이다.
  - 제안: 현 구조를 유지하되, 누적 라인이 yield 없이 실행됨을 명시하는 짧은 주석으로 의도를 고정할 것.

- **[INFO]** `cleanup-invalid-queue-jobs.ts` — `getJobs()` → `job.remove()` 사이 TOCTOU
  - 위치: `sweepQueue()` 함수 전체
  - 상세: job 목록 스냅샷 이후 `remove()` 시점 사이에 해당 job이 워커에 의해 획득·처리될 수 있다. 처리 중 job을 `remove()` 하면 BullMQ가 오류를 반환하는데, `catch`로 무시하므로 데이터 손실 위험은 없다. 단, 운영 중인 워커와 동시 실행 시 처리 중이던 정상 job이 잠깐 `waiting` 상태처럼 보여 false-positive 집계가 생길 수 있다.
  - 제안: plan 문서에 명시된 대로 워커를 중지하거나 큐를 pause한 상태에서 `--apply` 실행을 권고하는 경고를 스크립트 usage 주석에 추가할 것.

- **[INFO]** `embedding.service.ts` — KB 차원 업데이트 패턴 (양호 확인)
  - 위치: `doProcess()` 내 `UPDATE knowledge_base SET embedding_dimension = $1 WHERE ... AND (embedding_dimension IS NULL OR embedding_dimension = $1)`
  - 상세: 같은 KB를 동시에 처음 임베딩하는 두 워커가 동일 차원 값으로 충돌해도 `embedding_dimension = $1` 조건이 두 번째 UPDATE를 no-op으로 처리한다. 다른 차원 값이 들어오면 0-row RETURNING 후 다음 일관성 검증에서 throw가 발생해 더 이상의 오염을 막는다. 원자성 문제 없음.

- **[INFO]** `maybeFinalizeKbBatch` (양 processor) — `NOT EXISTS` 단일 atomic UPDATE (양호 확인)
  - 위치: `document-embedding.processor.ts`, `graph-extraction.processor.ts`
  - 상세: 여러 child job이 동시에 완료되어도 `NOT EXISTS` 서브쿼리가 PostgreSQL 레벨에서 단일 UPDATE 안에서 평가되므로 TOCTOU 없이 race-free 하게 `idle` 전환이 발생한다.

---

### 요약

변경 코드에서 실질적인 동시성 결함은 발견되지 않았다. 핵심 경로(KB 차원 설정, KB batch 완료 finalize)는 모두 PostgreSQL 단일 atomic UPDATE로 TOCTOU를 제거한 올바른 설계를 따른다. `graph-extraction.service.ts`의 `pLimit` 병렬 누적 패턴은 JavaScript 단일 스레드 보장에 암묵적으로 의존하고 있어 구조적 취약점이 존재하지만, 현재 코드베이스에서 실제 레이스를 유발하지는 않는다. `cleanup-invalid-queue-jobs.ts`의 TOCTOU는 1회성 정비 스크립트의 특성상 허용 가능하나, `--apply` 실행 시 워커 중지 절차를 명시적으로 안내하는 것이 바람직하다.

### 위험도

**LOW**