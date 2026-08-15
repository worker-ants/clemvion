# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** 기존에 이미 알려져 있고 이번 diff 에서도 그대로 문서화된 이론적 race — `recoverStuckExecutions`(부팅 backstop)가 같은 stale RUNNING execution 을 재구동 중인 극히 좁은 창(job stalled 소진 == 서버 부팅 스캔 동시 발생)에 `finalizeStalledExhausted` 의 조건부 UPDATE(`WHERE status='running'`)가 정상 재구동 중인 세그먼트를 잘못 마감할 수 있음.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3331` (JSDoc, `finalizeStalledExhausted` 함수)
  - 상세: 이번 diff 는 이 race 의 존재 여부나 창(window) 크기를 바꾸지 않는다 — 두 UPDATE 를 단일 트랜잭션으로 묶은 것은 "Execution UPDATE 커밋 후 NodeExecution UPDATE 실패" 라는 **부분 커밋** 문제만 닫았을 뿐, `WHERE status='running'` 조건부 UPDATE 자체가 다른 트랜잭션(`recoverStuckExecutions`)의 동시 갱신과 겹치는 문제는 그대로다. 개발자가 이미 JSDoc 에 "수용된 기존 노출(신규 회귀 아님)"으로 명시했고 완전 fencing 은 별도 defer 항목(세그먼트-start/owner-token 영속)으로 분리돼 있다.
  - 제안: 조치 불필요 — 이미 인지·문서화·defer 처리됨. 추가 조치 시점은 해당 defer 항목 착수 시.

- **[INFO]** 락 획득 순서 불일치(pre-existing, 이번 diff 미변경) — `finalizeStalledExhausted`/`cancelParkedExecution`/`markWebChatIdleTimeout` 세 자매는 모두 `Execution` row 를 먼저 잠그고 `NodeExecution` row(들)을 나중에 잠그는 반면, `claimResumeEntry` 는 `NodeExecution` row 를 먼저(id 단건), `Execution` row 를 나중에 잠근다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1259`-`1301` (`claimResumeEntry`, 이번 diff 대상 아님) vs `:3354`-`3402` (`finalizeStalledExhausted`, 이번 diff 대상)
  - 상세: 역순 락 획득은 교착 상태의 고전적 전제 조건이다. 다만 `finalizeStalledExhausted` 의 NodeExecution cascade 는 `status='running'` 인 행만, `claimResumeEntry` 의 NodeExecution claim 은 `status='waiting_for_input'` 인 행만 대상으로 하므로, 실제로 **동일 NodeExecution row** 를 두 트랜잭션이 서로 다른 순서로 동시에 잠글 창은 상태값이 배타적이라 매우 좁다. 이번 diff 는 `claimResumeEntry` 를 건드리지 않았고, 오히려 `finalizeStalledExhausted` 를 나머지 두 자매와 같은 락 순서(Execution → NodeExecution)로 통일해 세 자매 간의 순서 일관성은 개선했다.
  - 제안: 새로 도입된 문제는 아니므로 이번 PR 블로커 아님. 향후 자매 함수군 전체의 락 순서를 표로 정리해 `claimResumeEntry` 를 나머지와 통일할지(또는 통일 불가 사유를 명시) 별도 항목으로 검토할 가치는 있다.

## 검토 상세 (문제 없음 확인)

- `finalizeStalledExhausted` 의 두 `UPDATE`(Execution → NodeExecution cascade)는 `manager.createQueryBuilder()` 로 **동일 트랜잭션 manager** 를 통해 실행되며, `dataSource.transaction()` 콜백 안에서 순차 `await` 되므로 원자성이 보장된다. 자매 `cancelParkedExecution`(`:1023`-`1089`)·`markWebChatIdleTimeout`(`:1152`-`1226`)과 패턴이 동형이다.
- `if ((result.affected ?? 0) === 0) return;`(`:3373`)은 트랜잭션 콜백 내부에서 throw 없이 반환되므로 빈 트랜잭션이 정상 커밋되고, 외부의 `finalized` 플래그(`:3353`, `:3401`, `:3403`)가 이를 정확히 반영해 emit/cleanup 을 건너뛴다 — 경합 없는 단일 스레드 클로저 캡처로 안전하다.
- emit(`this.eventEmitter.emitExecution`, `:3410`)과 cleanup(`this.finalizeRehydrationCleanup`, `:3409`)은 **커밋 이후**에 best-effort 로 실행돼, DB 원자성과 wire 통지 사이에 새로운 경쟁 조건을 만들지 않는다.
- 호출부 `ExecutionRunProcessor.onFailed`(`execution-run.processor.ts:88`-`94`)는 `void ...finalizeStalledExhausted(...).catch(...)` 로 예외를 흡수·로깅하므로, 트랜잭션 내부에서 별도 try/catch 를 두지 않아도 unhandled rejection 이 발생하지 않는다.
- 테스트(`execution-engine.service.spec.ts`)는 트랜잭션 밖 repository 사용 시 즉시 throw 하도록 무장한 `installStalledTx` 헬퍼로 "트랜잭션 밖으로 다시 나가는 회귀"를 잡고, `managerCqb` 호출 횟수·순서(Execution → NodeExecution)를 단언한다. 다만 주석에서 스스로 명시하듯 mock 은 실 DB 롤백을 흉내내지 못하므로 이 테스트는 "같은 manager 를 탄다"는 전제까지만 보증하고 원자성 자체(부분 커밋 방지)는 검증하지 않는다 — 개발자가 이미 인지하고 plan 에 실 DB e2e 트랙으로 분리해 놓았다.
- CHANGELOG.md·plan 문서(`eia-stalled-atomicity.md`, `spec-sync-external-interaction-api-gaps.md`)는 코드 변경 없이 서술만 갱신해 동시성 관점에서 별도 검토 대상 아니다.

## 요약

이번 diff 는 `finalizeStalledExhausted` 의 Execution UPDATE 와 자식 NodeExecution cascade UPDATE 가 각각 autocommit 으로 실행되던 부분 커밋 취약점을 `dataSource.transaction()` 으로 묶어 닫는다. 이미 원자화돼 있던 자매 함수 `cancelParkedExecution`·`markWebChatIdleTimeout` 과 완전히 동형인 패턴(같은 락 순서 Execution→NodeExecution, 커밋 후 best-effort emit/cleanup, `finalized` 플래그로 no-op 분기)을 그대로 적용했고, 회귀 테스트도 트랜잭션 이탈을 즉시 실패시키도록 무장했다. 새로 도입된 경쟁 조건·데드락·비동기 오류 처리 결함은 발견되지 않았다. 문서에 이미 명시된 `recoverStuckExecutions` 와의 이론적 race, 그리고 `claimResumeEntry` 와의 락 순서 불일치는 둘 다 이번 diff 이전부터 존재하던 별개 사안이라 정보성으로만 기록한다.

## 위험도

LOW
