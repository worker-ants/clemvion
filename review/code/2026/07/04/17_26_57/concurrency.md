# 동시성(Concurrency) 리뷰 — admitExecutionOrDefer 재검증 (PR2b §8, ai-review 16_58_32 CRITICAL 후속)

## 재검증 결과 요약

**이전 라운드(16_58_32)의 CRITICAL — "단일 조건부 UPDATE 는 TOCTOU-safe 하지 않다" — 은 이번 변경으로 해소됨(RESOLVED).**

수정 전 코드는 `UPDATE execution SET status='running' WHERE id=$1 AND status='pending' AND (SELECT COUNT...) < cap` 단독이었고, 서로 다른 `executionId` 를 대상으로 하는 두 UPDATE 문이 서브쿼리 COUNT 스냅샷에 대해 상호 배제가 없어 실제 로컬 Postgres 재현으로 cap 초과가 발생했다(5/5 재현). 이번 변경은 `executionRepository.manager.transaction(...)` 내부에서 `SELECT pg_advisory_xact_lock(hashtext($1))` (lock key = `exec-cap:<workspaceId ?? workflowId>`) 를 조건부 UPDATE **이전**에 획득한 뒤 동일 트랜잭션·동일 커넥션에서 COUNT-체크-UPDATE 를 수행하도록 바뀌었다 (`execution-engine.service.ts:2644-2661`).

### 로컬 Postgres 재현 (동일 인스턴스 `clemvion-postgres-1`, pgvector/pg18)

이전 라운드와 동일한 방법론으로 실제 DB에 대해 재검증했다(격리된 `concur_test` 스키마, 실제 코드와 동일한 락+UPDATE SQL 문 사용, 테스트 후 스키마 drop).

1. **2-경쟁, cap=3(여유 1자리), 인위적 `pg_sleep(0.3)` 로 트랜잭션 내부 임계구역 확장** — 5회 반복 모두 정확히 1건만 admit, `running` count 는 항상 3 (초과 없음). 이전 라운드는 동일 조건에서 5/5 모두 초과(count=4)였던 것과 대조적.
2. **동일 조건, sleep 없이(실제 타이밍) 3회 반복** — 동일하게 매회 count=3 유지.
3. **5-경쟁(p1~p5), cap=3(여유 1자리), 동시 fork** — 3회 반복 모두 정확히 5개 중 1개만 admit, count=3 유지 (경쟁자 수를 늘려도 초과 없음).
4. **cross-workflow 시나리오** — 같은 workspace(`ws1`) 내 서로 다른 workflow(`wf1`, `wf2`)에 속한 pending row 각 1개, workspace cap=3(이미 2 running, 여유 1)에 대해 동시 admission 시도 → lock key 가 `exec-cap:ws1` 로 동일하므로 정확히 직렬화되어 1건만 admit. workspace-scope 락이 workflow 경계를 넘어 올바르게 공유됨을 확인 — 이는 이전 CRITICAL 이 정확히 노렸던 "같은 workspace, 다른 executionId" 시나리오다.

결론: `pg_advisory_xact_lock` 은 (a) admission UPDATE 이전에 획득되고, (b) 동일 `manager.transaction` 콜백 내에서 동일 커넥션을 사용하므로 COUNT 평가와 UPDATE 가 lock 보유 중에만 이루어지며, (c) TypeORM `Repository.manager.transaction()` 계약상 콜백 내 모든 `m.query()` 호출이 단일 트랜잭션/커넥션에 바인딩됨이 보장된다(별도 pool 커넥션으로 새서 락이 무의미해지는 경우 없음). 실측 결과 cap 초과가 재현되지 않았다 — **CRITICAL 은 RESOLVED로 판단.**

## 발견사항

- **[INFO]** JSDoc 주석이 실제 구현과 모순되는 문구를 아직 유지 (문서 정합성, 동시성 결함 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2603-2605` (`admitExecutionOrDefer` 함수 상단 JSDoc)
  - 상세: "**TOCTOU**: 단일 조건부 UPDATE(...)로 카운트-체크-전이를 원자화한다 — 다수 consumer 경쟁에서도 cap 초과가 없다(`pg advisory lock 불요`)" 라는 문구가 남아 있다. 그러나 바로 아래 인라인 주석(2636-2644행)과 실제 구현은 advisory lock 을 **필수로 사용**한다고 명시한다 — 이전 CRITICAL 을 고치면서 인라인 주석만 갱신하고 함수 상단 JSDoc 은 갱신하지 않은 것으로 보인다. RESOLUTION.md 항목 5는 "spec §8 서술을 advisory lock 필수로 정정"이라고 했으나 이 함수 자체의 JSDoc 은 놓친 것으로 보인다.
  - 제안: JSDoc 의 "pg advisory lock 불요" 문구를 삭제하고 인라인 주석과 일치시켜 향후 유지보수자의 혼동을 방지.

- **[INFO]** workspace 미해결(workflow lookup 실패) 시 lock-key fallback 은 잔여 edge-case 로 수용 가능
  - 위치: `execution-engine.service.ts:2635, 2644`
  - 상세: `workflow` 조회가 실패하면(예외적) `workspaceId` 가 `undefined` 이고 lock key 는 `exec-cap:<workflowId>` 로 fallback 한다. 이 경우 해당 workflow 자신에 대한 직렬화는 유지되지만, 동일 workspace 의 다른(정상 조회되는) workflow 의 admission 과는 다른 lock key 를 사용하므로 workspace-cap 관점의 상호 배제는 이 예외적 row 에 한해 깨진다. 다만 이 fallback 이 발동하는 조건 자체가 "workflow 레코드가 사라짐"이라는 이례 상황이고, RESOLUTION.md(#3)에서 이미 인지·수용(ACCEPT)된 잔여 리스크이므로 별도 조치를 요구하지 않는다.

- **[INFO]** 데드락 위험 없음 — 단일 락, 단일 트랜잭션, 별도 락 체계와 교차 없음
  - 위치: `execution-engine.service.ts:2645-2661`
  - 상세: `admitExecutionOrDefer` 는 트랜잭션당 advisory lock 을 정확히 1개만 획득하며 중첩 락이 없다. `pg_advisory_xact_lock` 은 트랜잭션 종료(COMMIT/ROLLBACK) 시 자동 해제되어 락 보유 중 예외 발생 시에도 누수되지 않는다. 코드베이스의 다른 락 체계(`RECOVERY_LOCK_KEY`, `continuationBus.acquireLock/releaseLock`)는 Redis 기반의 별개 메커니즘이라 이 Postgres advisory lock 과 상호작용하지 않는다 — 락 순서 역전에 의한 데드락 가능성 없음.

- **[INFO]** (검토 대상 외, 참고) 신규 admission 테스트의 mock 타입이 `tsc -p tsconfig.json`(spec 포함 전체 컴파일) 기준으로 타입 오류 발생 — 실행/빌드 게이트에는 영향 없음
  - 위치: `execution-engine.service.spec.ts:231(mockExecutionRepo 선언), 269-271, 3071, 3093, 3138`
  - 상세: `mockExecutionRepo: Record<string, jest.Mock>` 로 선언된 상태에서 `manager: { transaction: jest.fn(...) }` (중첩 객체)를 할당하면, 이후 `mockExecutionRepo.manager.transaction = jest.fn(...)` 재할당 지점에서 TS 가 `manager` 를 `jest.Mock` 타입(인덱스 시그니처 추론)으로 보아 `.transaction` 프로퍼티가 없다는 오류를 낸다. 다만 `nest build`(운영 빌드, `tsconfig.build.json` 이 `*.spec.ts` 제외)와 `npx jest`(런타임 통과, ts-jest 개별 파일 컴파일)는 모두 정상 통과함을 직접 확인했다 — 실질 게이트를 막지 않는 타입 엄격성 흠결이며 동시성 결함은 아니다. 참고로만 기록(다른 리뷰어 관점 — maintainability/testing 소관에 가까움).

## 위험도 판정 (재검증)

이전 CRITICAL: **해소됨(RESOLVED)**. `pg_advisory_xact_lock` 기반 워크스페이스/워크플로우 스코프 직렬화가 admission UPDATE 이전에 올바르게 삽입되었고, 로컬 Postgres 재현(2-경쟁·5-경쟁·cross-workflow 시나리오, 총 11회 반복)에서 단 한 번도 cap 초과가 발생하지 않았다 — 이전 라운드가 매번(5/5) 재현했던 것과 명확히 대조된다. 락 획득 시점(UPDATE 이전), 트랜잭션/커넥션 바인딩(단일 `manager.transaction` 콜백), lock key 스코프(workspace 우선, workflow fallback)를 모두 코드 레벨과 실제 DB 동작 레벨에서 확인했다. 데드락 위험도 확인되지 않는다(단일 락, xact 자동 해제, 타 락 체계와 비교차). 잔여 항목은 모두 INFO 수준(문서 표현 불일치, 이미 수용된 edge-case, 검토 범위 외 타입 엄격성)이며 추가 코드 수정을 요구하지 않는다.

## 위험도
NONE (이전 CRITICAL 은 RESOLVED로 재분류; 신규 CRITICAL/WARNING 없음)

STATUS: SUCCESS
