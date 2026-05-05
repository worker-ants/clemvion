### 발견사항

- **[WARNING]** 마이그레이션 스크립트의 TOCTOU(Time-of-Check-Time-of-Use) 경쟁 조건
  - 위치: `migrate-button-ids.ts` — `main()` 함수의 SELECT → 메모리 처리 → UPDATE 흐름
  - 상세: 전체 노드를 `ds.query(SELECT ...)` 로 읽은 뒤, 메모리에서 `backfillButtonIds`를 적용하고, 이후 트랜잭션에서 `UPDATE node SET config = $1` 를 실행한다. SELECT와 UPDATE 사이의 창(window)에 애플리케이션 서버가 같은 노드에 `update_node`를 처리하면 migration이 그 변경을 무음으로 덮어쓴다. 마이그레이션에서 사용하는 UPDATE 조건이 `WHERE id = $2` 뿐이어서 낙관적 잠금(optimistic locking) 또는 비관적 잠금(pessimistic locking)이 전혀 없다.
  - 제안: 가장 안전한 방법은 maintenance window(서비스 트래픽 차단 상태)에서만 `--apply`를 실행하는 운영 절차 가이드를 스크립트 상단 주석에 명시하는 것이다. 만약 live 상태에서도 실행해야 한다면 SELECT 쿼리에 `FOR UPDATE`를 추가하거나, `UPDATE node SET config = $1 WHERE id = $2 AND config = $3`(기존 값 일치 확인)로 조건을 강화해 의도치 않은 덮어쓰기를 방지해야 한다.

- **[INFO]** 트랜잭션 내 순차적 UPDATE의 장기 보유 가능성
  - 위치: `migrate-button-ids.ts` — `ds.transaction` 블록
  - 상세: 단일 트랜잭션 안에서 `pendingUpdates`를 `for...of`로 순회하며 노드별 UPDATE를 실행한다. 노드 수가 많을 경우 트랜잭션이 장시간 유지되어 애플리케이션 쿼리와 행 수준 락 경합이 발생할 수 있다. Node.js는 `await`가 있어도 트랜잭션은 커밋 전까지 DB 레벨 락을 보유한다.
  - 제안: 대규모 데이터 환경이라면 일정 크기(예: 500건)씩 배치로 나눠 여러 트랜잭션으로 처리하거나, `LOCK TABLE node IN ROW EXCLUSIVE MODE`같은 advisory lock으로 운영 쿼리와의 경합 구간을 명확히 하는 것이 좋다.

- **[INFO]** `ShadowWorkflow`의 가변 상태(`Map`, 배열)
  - 위치: `shadow-workflow.ts` — `nodes`, `edges`, `labelConflictCounts`, `recentFailedAddNodeLabels`
  - 상세: 모두 `Map`/`Array` 기반 가변 인스턴스 상태다. Node.js는 단일 이벤트 루프이므로 현재 동기 연산 구간에서는 경쟁 조건이 발생하지 않는다. 단, 향후 `worker_threads`로 이동하거나 한 세션을 여러 요청 핸들러가 공유하게 되면 동기화가 필요하다.
  - 제안: 현재 구조에서는 무해하나, 인스턴스 공유 여부를 문서화해 둘 것을 권장한다.

- **[NONE]** `button-slug.util.ts`의 순수 함수들
  - `labelToSlug`, `uniqueSlug`, `normalizeNodeButtonIds` 모두 외부 상태를 참조·변경하지 않는 순수 함수이며, `normalizeNodeButtonIds`는 입력 객체를 변경하지 않고 사본을 반환한다. 동시성 관점에서 완전히 안전하다.

---

### 요약

변경된 코드의 핵심 로직(`button-slug.util.ts`, `shadow-workflow.ts` 훅 연결)은 순수 함수 설계와 Node.js 단일 스레드 모델을 적절히 따르고 있어 동시성 문제가 없다. 유일한 실질적 위험은 `migrate-button-ids.ts`의 SELECT→처리→UPDATE TOCTOU 패턴으로, live 트래픽이 있는 상태에서 `--apply`를 실행하면 애플리케이션이 그 사이에 수정한 `node.config`를 migration이 덮어쓸 수 있다. 스크립트 자체의 주석이 "shadow auto-generate 활성화 *이전*에 실행"이라고 명시하고 있어 의도적인 사전 실행을 전제로 하지만, 실수로 live 환경에서 실행될 경우를 대비한 방어 코드(optimistic locking 또는 운영 절차 강제)가 없다는 점이 아쉽다.

### 위험도
**LOW** (migration 스크립트의 TOCTOU는 운영 절차로 충분히 통제 가능하며, 나머지 코드는 동시성 위험 없음)