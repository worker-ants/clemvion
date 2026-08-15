STATUS=success ISSUES=1
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** `finalizeStalledExhausted` 신규 트랜잭션이 `claimResumeEntry` 와 반대 순서로 Execution/NodeExecution 을 잠근다 — 교차 함수 데드락 잠재 표면
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3357`(`finalizeStalledExhausted` — `dataSource.transaction` 블록, Execution UPDATE 먼저(3358-3375) → NodeExecution UPDATE 나중(3387-3403)) vs `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1259`(`claimResumeEntry` — NodeExecution UPDATE 먼저(1262-1270) → Execution UPDATE 나중(1280-1294))
  - 상세: 이번 PR 이 `finalizeStalledExhausted` 를 트랜잭션으로 묶으면서 자매 `cancelParkedExecution`(`:1023`)·`markWebChatIdleTimeout`(`:1152`)과 동일한 잠금 순서(Execution → NodeExecution)를 따랐다 — 이 자체는 옳다. 그런데 같은 파일의 `claimResumeEntry` 는 **반대 순서**(NodeExecution → Execution)로 같은 두 테이블을 한 트랜잭션에서 잠근다. 같은 `executionId` 를 대상으로 (a) 한 브랜치가 `RUNNING` 상태로 stalled 소진되어 `finalizeStalledExhausted` 가 Execution 행을 먼저 잠그고 자식 `RUNNING` NodeExecution 행을 잠그러 가는 동안, (b) 같은 execution 의 다른 브랜치(`WAITING_FOR_INPUT` 노드)가 동시에 `claimResumeEntry` 로 재개돼 그 NodeExecution 행을 먼저 잠그고 Execution 행을 잠그러 가면, 전형적인 lock-order 역전 데드락 조건(A→B 대 B→A)이 성립한다. 다중 브랜치 실행(그래프 병렬 분기)에서 한쪽은 크래시로 stalled 소진 중, 다른 쪽은 정상적으로 사용자 입력을 기다리다 재개되는 상황은 아키텍처상 배제되지 않는다.
  - 이 위험은 새로 만들어진 것이 아니라 **기존에도 `cancelParkedExecution`/`markWebChatIdleTimeout` 대 `claimResumeEntry` 사이에 이미 존재하던 패턴**이며, 이번 PR 은 세 번째 참여자(`finalizeStalledExhausted`)를 추가해 노출 경로를 하나 더 늘렸을 뿐이다. 또한 PostgreSQL 은 데드락을 자동 검출해 한쪽 트랜잭션을 `deadlock detected` 오류로 중단시키므로 hang 은 없고, 이번 PR 이 추가한 신규 테스트(`execution-engine.service.spec.ts` — `'트랜잭션 중간 실패는 삼키지 않고 던진다 + 종결 이벤트도 안 나간다'`)가 정확히 이 실패 모드(중간 실패 → throw, 종결 이벤트 미발행)를 mock 으로 검증해, 데드락이 발생해도 유령 상태나 거짓 emit 없이 안전하게 실패가 관측된다는 점은 확인된다. 다만 이 교차 함수 잠금 순서 충돌 자체는 함수 JSDoc(3336-3343, 이미 문서화된 `recoverStuckExecutions` race 만 언급)에도 반영돼 있지 않다.
  - 제안: 기능 차단 사유는 아니므로 이번 PR 을 막을 필요는 없다. 다만 (1) `finalizeStalledExhausted` JSDoc 에 `claimResumeEntry` 와의 잠금 순서 역전 가능성을 한 줄 남기거나, (2) 장기적으로 `claimResumeEntry` 의 잠금 순서를 Execution→NodeExecution 으로 통일해(가능하다면) 파일 전체의 잠금 순서 불변식을 하나로 고정하는 후속 항목을 트래커에 등재할 것을 권한다.

### 요약

핵심 변경(`finalizeStalledExhausted` 의 두 조건부 UPDATE 를 `dataSource.transaction()` 으로 원자화)은 동시성 관점에서 올바른 수정이다. 자매 함수(`cancelParkedExecution`/`markWebChatIdleTimeout`)와 동일한 잠금 순서·조건부 UPDATE(`status='running'`) 패턴을 그대로 따라 재진입/중복 이벤트에 대해 멱등·race-safe 하고, 부수효과(emit·cleanup)는 커밋 이후로 이동해 미확정 상태에 대한 emit 위험이 없으며, 트랜잭션 내부에서 `manager.createQueryBuilder()` 만 쓰도록 테스트로 무장해 "트랜잭션 밖으로 다시 새는" 회귀를 잡는다. 신규 테스트는 (a) 두 UPDATE 가 같은 트랜잭션 manager 를 타는지, (b) 중간 실패가 삼켜지지 않고 그대로 throw + 종결 이벤트 미발행으로 이어지는지를 명시적으로 검증해 원자성 계약의 "전제"와 "실패 시 안전성"을 함께 잠갔다(실 DB 롤백 자체는 mock 한계로 미검증이며, 이는 정본 트래커에 별도 실 DB e2e 항목으로 이미 등재돼 있어 이 리뷰에서 중복 지적하지 않는다). 유일하게 새로 짚을 만한 것은 이번에 추가된 트랜잭션의 잠금 순서(Execution→NodeExecution)가 같은 파일의 `claimResumeEntry`(NodeExecution→Execution, 기존 코드)와 반대라는 점 — 교차 함수 데드락의 잠재 표면이지만 신규 회귀가 아니라 기존에도 있던 자매 함수들과 공유하는 패턴이고, DB 자동 데드락 검출 + 이번 PR 의 실패-전파 테스트로 안전망이 있다. async/await 누락, 이벤트 루프 블로킹, 커넥션 풀 오남용은 발견되지 않았다.

### 위험도
LOW
