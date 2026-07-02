### 발견사항

- **[INFO]** `claimResumeEntry` 의 짝 전이(Execution UPDATE)가 결과를 확인하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `claimResumeEntry` (2) 블록 — Execution UPDATE 후 `affected` 미검사
  - 상세: NodeExecution claim(1)이 성공한 뒤 같은 트랜잭션에서 Execution 을 `waiting_for_input → running` 으로 전이하지만 그 UPDATE 결과의 `affected` 를 확인하지 않는다. 주석대로 "node claim 이 유일한 레이스 결정자"이므로 Execution 이 이미 `running`(예: 동일 executionId 의 다른 대기 노드가 먼저 claim 한 극히 드문 멀티-park 케이스)이어도 그 자체는 데이터 훼손이 아니다. 다만 만약 Execution 이 `waiting_for_input` 도 `running` 도 아닌 예기치 못한 terminal(예: 동시에 진행 중인 cancel 이 이미 `cancelled` 로 마감)로 관측되는 극단 케이스라면, NodeExecution 은 이미 `RUNNING` 으로 claim 됐는데 Execution 은 `cancelled` 로 남는 짧은 불일치 창이 이론상 존재한다. 두 UPDATE 는 동일 트랜잭션이라 commit 시점엔 일관되지만, "Execution 이 이미 cancelled 인데 그 자식 NodeExecution 을 RUNNING 으로 claim 해도 되는가"에 대한 명시적 방어(예: Execution 도 `waiting_for_input` 조건부로 실패하면 전체 rollback)는 없다.
  - 제안: 현재 설계는 `cancelParkedExecution` 이 `WAITING_FOR_INPUT` 가드로 멱등 처리되므로 실제 위험은 낮다(문서화된 trade-off). 다만 향후 다중 NodeExecution 이 하나의 Execution 을 공유하는 시나리오가 늘어난다면 Execution UPDATE 의 `affected=0` 케이스를 명시적으로 로깅하거나 방어적으로 처리하는 것을 고려할 만하다. 현 시점 CRITICAL/WARNING 은 아님.

- **[INFO]** `segmentStartMs` in-memory Map 갱신이 claim 성공 이후에만 발생 — 스레드 안전성 확인
  - 위치: `execution-engine.service.ts:900` (`claimResumeEntry` 내 `this.segmentStartMs.set(...)`)
  - 상세: Node.js 단일 스레드 이벤트 루프이므로 `Map.set` 자체는 원자적이나, 동시에 진행 중인 여러 async 흐름이 동일 `executionId` 키를 놓고 set/delete 를 교차 호출할 경우 순서에 따라 stale 값이 남을 수 있다. JSDoc(452~461행)에 "claim 이 DB 레벨 레이스 결정자이므로 동일 executionId 에 대한 set/delete 쌍 상호 배제가 보장된다"고 명시돼 있고, 실제로 `segmentStartMs.set` 은 DB claim 이 성공(단일 winner)한 경로에서만 호출되므로 설계상 안전하다. 문제 없음, 참고용 확인.

- **[INFO]** 재개 가능 상태 판정 확장(`WAITING_FOR_INPUT` 또는 `RUNNING`)의 의미 변화
  - 위치: `execution-engine.service.ts` (Execution/NodeExecution 존재·상태 검증 블록, 942행·991행 부근)
  - 상세: claim 도입 이후 rehydration 진입점에서 "재개 가능"의 정의가 `WAITING_FOR_INPUT` 단독에서 `WAITING_FOR_INPUT | RUNNING` 으로 넓어졌다. 이는 claim 이 이미 `RUNNING` 으로 전이시킨 뒤 도달하는 정상 경로이므로 의도된 확장이지만, 만약 claim 을 거치지 않고 우연히 `RUNNING` 상태인 (예: 다른 활성 세그먼트가 진행 중인) Execution/NodeExecution 에 대해 이 코드 경로가 잘못 호출되면 검증이 통과해버릴 위험이 이론적으로 존재한다. 실제로는 `claimResumeEntry` 가 유일한 정상 진입점이라 위험은 낮다.
  - 제안: 현재 주석이 이 의도를 충분히 설명하고 있어 추가 조치 불요. 향후 `RUNNING` 상태 재개 진입점이 늘어나면 "claim 을 통과한 RUNNING" 과 "다른 이유로 RUNNING" 을 구분할 필요가 있는지 재검토 권장.

### 요약

이번 변경은 §7.5 재개(rehydration) 진입 시 존재하던 비원자 `SELECT` 재검증(check-then-act) 가드를 조건부 원자 `UPDATE ... WHERE status='waiting_for_input'` 기반 DB-level claim(`claimResumeEntry`)으로 교체해 멀티 인스턴스·워커 concurrency 상향 환경에서의 진짜 경쟁 조건을 근본적으로 제거한 잘 설계된 동시성 개선이다. 핵심 안전성 근거는 다음과 같이 코드로 확인된다: (1) NodeExecution 조건부 UPDATE 가 유일한 레이스 결정자이며 Postgres 의 row-level 락(READ COMMITTED 에서도 UPDATE 는 대상 row 를 잠근다)으로 동시 두 트랜잭션 중 정확히 하나만 `affected=1` 을 받는다 — 별도 SERIALIZABLE 격리 없이도 안전. (2) NodeExecution·Execution 짝 전이가 단일 트랜잭션으로 묶여 크래시 시에도 두 엔터티가 서로 다른 상태로 갈리지 않는다(둘 다 `RUNNING` 잔류 시 `recoverStuckExecutions` 30분 stale 회수가 흡수). (3) claim 실패(`ack-and-discard`) 경로, cancel 과의 동시 픽업(별도 조건부 UPDATE 로 멱등), rollback 경로(`markNodeExecutionFailed` 가 `WAITING_FOR_INPUT` 와 `RUNNING` 둘 다 대상으로 확장)까지 spec·구현·테스트(동시 claim 경합 유닛 테스트 포함, 정확히 하나만 승리 검증)가 정합적으로 갱신됐다. `ai-turn-orchestrator.service.ts` 의 re-park 시 명시적 `WAITING_FOR_INPUT` 재설정, `recoverStuckExecutions` 의 cascade FAILED 확장도 claim 도입으로 생긴 새 orphan 케이스를 정확히 커버한다. 발견된 사항은 모두 INFO 수준으로 실사용에 즉각적 위험은 없으며, 설계 의도(주석·spec Rationale)와 실제 구현이 잘 일치한다.

### 위험도
LOW
