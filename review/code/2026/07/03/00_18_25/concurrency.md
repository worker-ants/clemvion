# 동시성(Concurrency) Review

대상: `06 C-2` — 재개(rehydration) 진입을 비원자 SELECT 재검증에서 DB 원자 조건부 UPDATE(`claimResumeEntry`)로 교체.

## 발견사항

- **[INFO]** 갱신 누락된 stale 주석 — `isNodeExecutionWaiting` 잔존 언급
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:680`
  - 상세: `registerContinuationHandlers` 근처 주석이 "`applyContinuation / applyCancellation / isNodeExecutionWaiting` public 메서드" 라고 옛 메서드명을 그대로 인용한다. 실제 메서드는 이번 변경으로 `claimResumeEntry` 로 개명됨. 동작에는 영향 없는 문서 drift.
  - 제안: 주석을 `claimResumeEntry` 로 갱신.

- **[INFO]** `claimResumeEntry` 의 legacy bypass(`__no_node_exec__` / 빈 id)는 claim 없이 `true` 반환
  - 위치: `execution-engine.service.ts` `claimResumeEntry` 본문
  - 상세: 이 우회 경로는 기존 `isNodeExecutionWaiting` 에서도 동일하게 존재했던 것으로, 이번 변경이 새로 도입한 약점은 아니다. 다만 legacy nodeExecutionId 를 쓰는 continuation 타입(`cancel` 은 애초 제외)이 향후 재도입되면 이 경로엔 원자성 보장이 없다는 점은 인지해 둘 가치가 있다 — 현재는 해당 안 됨(cancel/retry_last_turn 은 claim 호출 자체를 안 함, 나머지 타입은 실제 `nodeExecutionId` 를 사용).
  - 제안: 코드 변경 불필요, 향후 회귀 방지용 인지 사항으로만 기록.

- **[INFO]** claim 성공 후 rehydration 단계 사이의 "의미상" 창은 있으나 동시 실행 위험은 없음
  - 위치: `rehydrateAndResume` (claim 과 `nodeExec` 재조회 사이), `execution-engine.service.ts:952-970`
  - 상세: `claimResumeEntry` 로 이미 단일 worker 만 `RUNNING` 전이에 성공한 뒤, `rehydrateAndResume` 내부에서 다시 `nodeExecutionRepository.findOneBy` 로 row 를 읽어 `WAITING_FOR_INPUT || RUNNING` 인지 검사한다. 이 재조회는 원자적 락이 아니라 단순 SELECT 지만, claim 을 통과한 시점에 이미 배타적으로 이 worker 만 처리 권한을 가지므로 재조회 자체가 경쟁의 대상이 되지 않는다(다른 worker 는 claim 단계에서 이미 걸러짐). 설계상 이 지점은 "claim 이후 사후 검증"의 역할이지 별도 동시성 게이트가 아니므로 문제 없음.
  - 제안: 없음 — 설계 의도대로 동작.

- **[INFO]** `claimResumeEntry`/`markNodeExecutionFailed`/`cancelParkedExecution` 세 조건부 UPDATE 간 상호작용은 각각 독립적인 단일-UPDATE 원자성으로 안전하게 직교
  - 위치: `execution-engine.service.ts` (claim: `status='waiting_for_input'` 매치, cancel: `status='waiting_for_input'` 매치, markNodeExecutionFailed: `status IN ('waiting_for_input','running')` 매치)
  - 상세: `cancel` vs `resume`(claim) 동시 픽업 시나리오를 검토함 — 두 경로 모두 `WHERE status = 'waiting_for_input'` 조건부 단일 UPDATE 이므로, DB 레벨에서 먼저 커밋되는 쪽이 row 를 선점하고 나머지는 `affected=0` 으로 자연 no-op 된다. `cancelParkedExecution` 은 `WAITING_FOR_INPUT` 만 매치하므로 claim 이 먼저 `RUNNING` 으로 전이시킨 뒤 cancel 이 도착하면 cancel 은 no-op 된다 — 이 경우 진행 중인 rehydration/turn 처리는 계속 진행되고, 다음 `waiting_for_input` park 시점에 비로소 취소가 반영된다는 것이 주석에 명시돼 있다(`applyRetryLastTurn`/§7.4 취소 경로 주석과 일치). 데드락 가능성 없음(각 UPDATE 는 단일 row, 단일 조건, 짧은 트랜잭션).
  - 제안: 없음 — 기존 설계·주석과 일치, 회귀 없음.

- **[INFO]** 테스트의 동시성 시뮬레이션(`Promise.all` 두 `claimResumeEntry` 호출)은 실제 DB 원자성을 검증하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` "동시 재개 — 두 claim 중 하나만 affected=1" 테스트
  - 상세: 이 unit 테스트는 `createQueryBuilder` mock 을 `mockReturnValueOnce(first).mockReturnValueOnce(second)` 로 미리 결정해 "첫 번째만 성공"을 시뮬레이션한다 — 실제 competing UPDATE 의 DB-level 원자성(row-lock)을 검증하는 것이 아니라, 서비스 코드가 `affected` 값을 올바르게 boolean 으로 매핑하는지만 검증한다. 실제 원자성 보장은 PostgreSQL 의 `UPDATE ... WHERE` row-level lock 에 의존하며, unit 레벨에서는 원천적으로 검증 불가능하다.
  - 제안: draft plan(`spec-draft-c2-atomic-claim.md`)에 명시된 "form park 에 continuation job 2건 인위 enqueue 후 turn 이중 실행 0" dockerized e2e 착수 조건이 실제 원자성을 검증하는 유일한 계층이다. 코드 리뷰 시점에는 아직 e2e 가 구현 완료 상태인지 diff 에 포함되지 않아 확인 불가 — 구현 완료 여부를 별도 확인 권장(리뷰 범위 밖일 수 있음).

## 요약

핵심 변경은 재개(rehydration) 진입 가드를 비원자 `SELECT` check-then-act 에서 단일 조건부 `UPDATE ... WHERE status='waiting_for_input'` 기반 원자 claim(`claimResumeEntry`)으로 교체한 것으로, 고전적인 check-then-act 경쟁 조건(TOCTOU)을 DB row-level 원자성으로 정확히 닫는 정석적인 해법이다. `affected` 카운트로 승자를 가르는 패턴은 이미 spec 내 `_retryState` claim 소비 패턴과 일치하며, `markNodeExecutionFailed` 의 롤백 대상에 `RUNNING` 을 추가해 "claim 후 rehydration 실패 시 stuck RUNNING" 회귀를 함께 방지한 점, `cancelParkedExecution` 과의 상호작용(양쪽 다 독립적 단일-UPDATE 원자성으로 자연 직교)도 코드·주석·spec 문서(§1.1/§1.2/§7.4/§7.5) 전반에 일관되게 반영되어 있다. spec draft 도 consistency-check Critical(rationale_continuity)을 rev2 에서 해소해 기존 2026-06 "running hop 기각" 결정과의 충돌 없이 "재개 진입 gate 추가"로 스코프를 좁힌 점이 확인된다. 발견된 이슈는 모두 INFO 등급의 문서/주석 drift 또는 참고 사항 수준이며, 실질적 경쟁 조건·데드락·비원자성 문제는 발견되지 않았다.

## 위험도

LOW
