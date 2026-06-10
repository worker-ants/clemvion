# 동시성(Concurrency) Review — perf 백로그 01

## 발견사항

- **[INFO]** Dashboard 두 집계 쿼리를 직렬 await — 독립이라 병렬화 여지
  - 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts` `getSummary` (`wfCounts` await → `execAgg` await)
  - 상세: 기존 코드는 일부 count 를 `Promise.all` 로 병렬 실행했으나, 리팩터 후 `wfCounts`(workflow repo)와 `execAgg`(execution repo) 두 집계 쿼리를 순차 `await` 한다. 두 쿼리는 서로 독립(다른 repo, 공유 상태 없음)이라 `Promise.all([...])` 로 묶으면 DB 왕복 1회분 latency 를 줄일 수 있다. 6쿼리→2쿼리로 줄인 것이 본 변경의 핵심 성과이므로 기능상 문제는 아니며, 순수 latency 최적화 여지일 뿐이다. 동시성 정확성 이슈는 없음(읽기 전용, race 없음).
  - 제안: 선택적. `const [wfCounts, execAgg] = await Promise.all([wfQuery.getRawOne(), execQuery.getRawOne()]);` 로 묶으면 2왕복이 1라운드트립으로. 단, 동일 커넥션 풀 경쟁/트랜잭션 경계가 없으면 안전.

- **[INFO]** 인스턴스 레벨 lazy read-once 캐시 — 싱글스레드 전제에서 안전
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `resolveMaxNodeIterations` / `resolveParallelEngineFlag` (`??=` lazy init)
  - 상세: NestJS provider 는 singleton 이고 여러 동시 실행(execution)이 같은 인스턴스 메서드를 호출한다. 그러나 `this.x ??= this.configService.get(...)` 는 `await` 를 끼지 않는 동기 compound 연산이라 Node 이벤트 루프 상에서 원자적으로 실행된다 — 다른 execution 이 read-modify-write 중간에 끼어들 수 없다. 설사 경합해 두 번 평가되더라도 동일 결정적 config 값이라 결과가 동일(idempotent). 데이터 레이스 없음. 기존 자매 env(`resolveExecutionRunWorkerConcurrency`) 와 동일 규율이라 일관적.
  - 제안: 조치 불요. (만약 향후 `get` 자리에 `await` 가 들어가면 더블체크/once-promise 패턴 필요해지므로 그 경우만 재검토.)

- **[INFO]** S3 `deleteMany` 청크 루프는 의도적 직렬 — 백프레셔상 적절
  - 위치: `codebase/backend/src/common/services/s3.service.ts` `deleteMany`
  - 상세: 1000키 청크를 `for` + `await` 로 직렬 처리한다. `Promise.all` 병렬화도 가능하나, 대량 삭제 시 S3 throttling/커넥션 폭주를 피하는 직렬 방식이 best-effort GC 성격에 부합한다. 공유 가변 상태는 로컬 `errored` 배열뿐이고 단일 async 흐름에서만 push 하므로 race 없음. 원자성 이슈 없음.
  - 제안: 조치 불요.

- **[INFO]** WeakMap 캐시 3종(`sortedCache`, `nodeCatalogCache`, `expressionReferenceCache`) — JS 싱글스레드라 race 없음
  - 위치: `codebase/frontend/src/lib/stores/execution-store.ts` `selectSortedNodeResults`; `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts` `renderNodeCatalogCached`
  - 상세: get-miss-compute-set 패턴은 비원자적이지만 그 사이 `await` 가 없어 이벤트 루프가 양보하지 않으므로 다른 호출이 끼어들 수 없다. 최악의 경우(동일 키 동시 first-call) 도 동일 입력→동일 출력이라 idempotent. 캐시 키가 배열 reference 라 mutate 된 같은 배열은 stale 가능성이 있으나, 프로덕션 불변성 전제 + 테스트 reset 헬퍼로 방어됨(설계 주석에 명시). 정확성 문제 없음.
  - 제안: 조치 불요.

- **[INFO]** Zustand store 파생 인덱스 Map 정합성 — React 업데이트는 동시성 아님, 다만 setState 우회 시 stale 가능
  - 위치: `codebase/frontend/src/lib/stores/execution-store.ts` `addNodeResult` / `findNodeResult`
  - 상세: `nodeResults` 와 3개 인덱스 Map(`nodeResultIndexByExecId`/`lastIndexByNodeId`/`firstNoExecIdIndexByNodeId`)을 매 변이마다 동기적으로 함께 갱신한다. Zustand `set` 콜백은 동기 실행이고 JS 싱글스레드라 두 자료구조가 찢어지는 동시성 윈도우는 없다. 멀티-탭/멀티-워커 공유 상태가 아니므로 cross-thread race 부재. 인덱스가 `nodeResults` 와 어긋날 수 있는 유일 경로(raw `setState`/테스트 시딩)는 read 시 후보 row 재검증(`nodeResults[idx]?.nodeExecutionId === ...`)으로 miss 처리하도록 방어되어 있어, 잘못된 row 를 clobber 하지 않는다 — 견고.
  - 제안: 조치 불요.

## 요약

본 변경은 순수 성능 리팩터(쿼리 통합·배치 insert/delete·메모이즈 캐시·인덱스 Map)이며, 모든 대상 코드는 Node.js/브라우저 단일 스레드 이벤트 루프에서 동작한다. 새로 도입된 공유 가변 상태(인스턴스 read-once 필드, WeakMap 캐시, Zustand 파생 인덱스)는 모두 read-modify-write 사이에 `await` 가 없어 이벤트 루프상 원자적이거나, 경합해도 idempotent 한 결정적 값이라 데이터 레이스·찢김이 발생하지 않는다. 락/뮤텍스/세마포어를 새로 도입하지 않았고 데드락 가능성 없음. async/await 사용은 올바르며 누락된 await 없음. 유일한 비기능적 관찰은 dashboard 의 두 독립 집계 쿼리를 `Promise.all` 로 병렬화하면 왕복 1회를 더 줄일 수 있다는 선택적 최적화 여지(정확성과 무관)다.

## 위험도

LOW
