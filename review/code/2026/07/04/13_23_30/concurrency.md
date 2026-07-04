# 동시성(Concurrency) Review

## 스코프 확인

본 diff 는 5개 파일 모두 `spec/**/*.md` 문서이며 실제 코드(`codebase/**`) 변경은 포함되지 않는다.
다만 내용 자체가 PR4(`maxStalledCount:1` BullMQ stalled-job 자동 재배달 도입)의 동시성 설계를
상세히 서술하므로, "코드 없음 → 해당 없음" 으로 스킵하지 않고 스펙에 기술된 동시성 모델의
정합성·리스크 공개 수준을 리뷰 대상으로 삼았다.

## 발견사항

- **[INFO]** Zombie-worker fencing 잔여 race 는 스펙이 이미 명시적으로 인지·공개
  - 위치: `spec/5-system/4-execution-engine.md` §7.5 case B 각주 (diff L873), §Rationale "PR4 — BullMQ stalled 자동 재배달" (신설, diff L928-937)
  - 상세: PR4 는 `maxStalledCount:1`(lock 만료 기반 stalled 검출)로 "정상 크래시"는 fencing 하지만, lock 만료 후 실제로는 살아있다가 뒤늦게 부활하는 zombie 워커(hang/네트워크 단절 후 복귀)는 여전히 배제되지 않는다고 스스로 인정한다. 이 경우 원 워커와 재배달받은 새 워커가 동일 Execution 의 같은 세그먼트를 동시에 구동할 수 있다(§4.2 직렬화 불변식 위반 가능 케이스). 완화책은 `maxStalledCount:1`(무한 재배달 없음으로 blast radius bound) + per-node `execution_node_log` COMPLETED skip(이중 구동돼도 완료 노드는 재실행 안 함) 두 가지뿐이며, 완전한 fencing(owner-token/segment-start 영속)은 defer 되어 있다.
  - 제안: 문서화 자체는 정직하고 충분하다. 다만 실제 구현(코드) 리뷰 시 다음을 반드시 확인할 것 — (1) `execution_node_log` skip 로직이 진짜로 "이미 처리된 노드"를 재실행 없이 건너뛰는지, (2) 두 세그먼트가 동시에 같은 미완료 노드(zombie 가 아직 처리 중인 노드)에 대해 이중으로 side-effect(HTTP/DB/이메일 등 non-idempotent Integration 노드)를 낼 가능성이 §7.3 "at-least-once 경계"로 충분히 커버되는지. 이 review 는 spec 변경만 대상이라 코드 검증은 별도 concurrency 리뷰(코드 변경 PR) 시 필수.

- **[INFO]** `finalizeStalledExhausted` 와 부팅 backstop `recoverStuckExecutions` 간 narrow race 문서화
  - 위치: `spec/5-system/4-execution-engine.md` §Rationale "PR4" 마지막 항목 (diff L937)
  - 상세: stalled 재배달이 attempts 를 소진해 `finalizeStalledExhausted`(WORKER_HEARTBEAT_TIMEOUT 로 종결)가 발동하는 순간과, 부팅 backstop `recoverStuckExecutions`(WHERE `status='running'` 조건부 re-claim)가 같은 stale RUNNING row 를 잡는 순간이 겹치면, 조건부 UPDATE 경쟁으로 인해 정상 재구동 중인 세그먼트가 `WORKER_HEARTBEAT_TIMEOUT` 로 잘못 마감될 수 있다고 스스로 명시.
  - 제안: 두 종결 경로 모두 `WHERE status='running'` 조건부 원자 UPDATE 를 쓰는 것으로 보이므로 affected=0/1 판정 자체는 안전(레이스는 있어도 이중 종결이나 오손 데이터는 아님, 단지 "누가 먼저 종결하는가"의 우선순위 문제). 코드 구현 시 두 UPDATE 문의 트랜잭션 격리 수준과 `affected` 체크가 실제로 spec 서술대로 구현됐는지 확인 필요.

- **[INFO]** `maxStalledCount:0 → 1` 전환의 설계 근거는 타당
  - 위치: `spec/data-flow/3-execution.md` §1.1 (diff L1143-1144), `spec/5-system/4-execution-engine.md` §4/§7.1/§9.2 (diff 다수)
  - 상세: PR3 까지는 `maxStalledCount:0` 으로 자동 재배달을 원천 차단해 "poison/non-idempotent 세그먼트의 운영 중 무인 재실행"을 막았고, PR4 에서 `maxStalledCount:1`(정확히 1회 상한)로 bounded 하게 확장했다. `jobId=executionId` 유지(re-enqueue 아닌 native stalled 재처리)로 §9.2 `exec:run:seq` 는 여전히 미사용이라는 점도 정합적으로 정정되어 있다. bounded blast radius(1회) + 관측(`ExecutionRunDlqMonitorService`)이 함께 도입된 점은 동시성 리스크 관리 관점에서 적절한 단계적 확장이다.
  - 제안: 없음 (설계 타당).

- **[INFO]** at-least-once 경계와 Integration 노드 멱등성 의존 관계는 이번 diff 로 변경되지 않음
  - 위치: `spec/5-system/4-execution-engine.md` §7.3 참조 (diff 미포함, 기존 유지)
  - 상세: PR4 는 "완료 노드 skip = exactly-once, RUNNING-at-crash 노드 = at-least-once(Integration 노드 책임)" 경계를 그대로 계승한다고 명시. 신규 동시성 리스크를 추가하는 것이 아니라 기존 PR3 모델의 트리거 소스만 하나 늘리는 구조로, 원자성 관점에서 새로운 결함을 도입하지 않는다.
  - 제안: 없음.

## 요약

이번 diff 는 순수 spec 문서 변경으로 실제 코드는 포함되지 않는다. 내용은 BullMQ stalled-job 자동 재배달(`maxStalledCount:0→1`)을 도입하는 PR4 의 동시성 설계를 기록한 것이며, 원자적 재배달(같은 jobId 재처리로 re-enqueue/seq 불필요), bounded blast radius(1회 재배달 상한), 관측성(DLQ 모니터) 추가라는 점에서 견고하게 설계되어 있다. 특히 주목할 점은 문서가 잔여 zombie-worker fencing race(lock 만료 후 부활하는 워커로 인한 이중 세그먼트 구동 가능성)와 stalled-exhaustion vs 부팅 backstop 간의 narrow race 를 회피하지 않고 명시적으로 인정·공개하고 있다는 것이다. 이 두 race 는 모두 "신규 회귀가 아니라 기존 fail-path 도 동일하게 노출되어 있던 것"이라는 근거와 함께 완화책(재배달 1회 상한, per-node skip)이 제시되어 있어 문서 품질 관점에서는 문제가 없다. 다만 이 스펙이 서술하는 대로 실제 코드(`runExecutionFromQueue`, `redriveStuckExecution`, `finalizeStalledExhausted`, `recoverStuckExecutions`)가 구현되어 있는지는 이번 문서 diff만으로는 검증 불가하며, 별도의 코드 레벨 concurrency 리뷰가 필요하다.

## 위험도

LOW (spec 문서 변경만 포함되어 있고, 서술된 설계 자체는 정합적이며 잔여 위험을 스스로 공개하고 있음. 코드 구현 검증은 범위 밖)

STATUS: SUCCESS
