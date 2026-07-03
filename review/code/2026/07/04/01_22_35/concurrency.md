# 동시성(Concurrency) 리뷰 — FRESH (resolution 이후 재확인)

대상: `review/code/2026/07/04/00_57_47` 리뷰(14 reviewer, Critical 0/Warning 10)의 resolution 커밋 반영 후
재확인. 이전 concurrency reviewer 가 낸 **WARNING(W4, zombie 잔여 race)** 가 이번 resolution 에서 "문서화"로
조치되었다는 주장을 코드/스펙 실물로 재검증한다. 대상 파일: `execution-engine.service.ts`(+spec),
`graph-dispatch.types.ts`, `executions.controller.ts`(+spec), `execution-crash-redrive.e2e-spec.ts`,
`docker-compose.e2e.yml`, `spec/5-system/4-execution-engine.md` 등.

## 재확인 대상 (이전 W4)

이전 라운드 concurrency 리뷰(`review/code/2026/07/04/00_57_47/concurrency.md`)의 유일한 WARNING:
`recoverStuckExecutions` 가 "일괄 FAILED 마킹"에서 "능동 재구동(re-drive)"으로 바뀌면서, `started_at`
(heartbeat 없는 절대시각) 기준 stale 판정이 오판(원 워커가 실제로는 생존 — zombie)일 경우 두 세그먼트가
동시 구동될 수 있다는 residual race. 재구동 자체의 원자성(re-claim UPDATE…RETURNING, `skipExecutedNodes`,
guarded terminal 전이)은 견고하나 **노드 단위 in-flight fencing 부재**가 근본 원인이며 PR4(BullMQ stalled)
로 이연하기로 결정됨(Q1).

## 발견사항

- **[INFO]** zombie 잔여 race — 코드 주석 + spec §Rationale 양쪽에 명시적으로 문서화됨을 확인 (조치 완료, 재발 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2799-2802` (`redriveStuckExecution` 내부, `rehydrateContext` 호출 직전 주석) / `spec/5-system/4-execution-engine.md:998` ("case B 원자 re-claim" 문단 말미 ⚠️) / `spec/5-system/4-execution-engine.md:1301` (§Rationale, "§4.2 active-running 직렬화 불변식 재검증" 항목)
  - 상세: 코드 주석은 "⚠️ zombie 잔여 race(§Rationale): stale 판정은 heartbeat 없는 started_at 기준이라 원 워커가 아직 살아있는데(hang/네트워크 단절 후 부활) 재구동될 수 있다. 완료 노드 COMPLETED skip 으로 완화하되 in-flight 노드 단위 fencing 은 PR4 BullMQ stalled 로 완결한다(현행 fail-path 도 동일 노출 — 신규 회귀 아님)." 로 정확히 W4 의 위험 성격·완화 수준·후속 계획을 요약한다. spec 은 같은 내용을 두 곳(§7.5 case B 정의부, §Rationale)에서 대칭적으로 서술하며 "(i) boot-only 트리거 (ii) 30분 stale 임계 (iii) per-node COMPLETED skip" 3중 완화와 "현행 fail-path 도 동일 zombie 노출이므로 PR3 신규 회귀 아님"이라는 근거를 코드와 동일하게 반복해, 코드-스펙 간 서술 drift 가 없다.
  - 검증: 이전 리뷰가 요구한 최소 조치("(a) 최소한 스펙/코드 주석에 이 residual 위험을 명시")를 정확히 충족한다. 노드 단위 claim(`(c)` 옵션)은 PR4 로 명시적으로 이연되었고 이는 별도 결정(Q1)에 따른 스코프 조정이지 누락이 아니다.

- **[INFO]** `failOrphanRunningNodeExecutions` 신설이 새로운 동시성 위험을 만들지 않음 (재검증)
  - 위치: `execution-engine.service.ts` `failOrphanRunningNodeExecutions()` (신규), `redriveStuckExecution` 진입부에서 호출(L2795)
  - 상세: `UPDATE node_execution SET status='failed', ... WHERE execution_id=:id AND status='running'` 형태의 조건부 UPDATE로, WHERE 절에 `status='running'` 가드가 있어 이미 종결된(COMPLETED/FAILED) row 는 건드리지 않는다. 원 워커(zombie)가 살아있어 동시에 같은 노드를 완료 처리하는 race 가 나더라도, 두 UPDATE 는 각각 `status='running'` 조건으로 직렬화되어(먼저 커밋한 쪽이 상태를 바꾸면 나중 UPDATE 의 WHERE 조건이 false 가 됨) 이중 갱신·행 손상 없이 원자적으로 하나만 적용된다. 다만 zombie 가 이 FAILED 마킹 *이후*에 완료 처리를 시도하면 그 시점 이미 FAILED 이므로 zombie 쪽 완료 UPDATE 가 무시될 수 있다 — 이는 기존에 문서화된 "노드 단위 fencing 부재"의 한 표현형이며 별도의 신규 위험이 아니라 W4 잔여 race 의 하위 사례다.
  - 제안: 조치 불필요 — 신규 회귀 아님, 기존 문서화된 범위 내.

- **[INFO]** 원자 re-claim(`reclaimStuckRunningExecution`)·boot-lock 2-layer 방어·`skipExecutedNodes` 가드·guarded terminal 전이(`updateExecutionStatus`/`markExecutionCancelled`) — 모두 이전 라운드에서 검증된 그대로 변경 없음
  - 위치: `execution-engine.service.ts:2610-2680`(recoverStuckExecutions), `:2690-2720`(reclaimStuckRunningExecution), `runNodeDispatchLoop` L1436-1444(skipExecutedNodes 가드)
  - 상세: resolution 커밋은 이 원자성 로직 자체를 손대지 않았다(diff 상 `reclaimStuckRunningExecution`/`skipExecutedNodes` 가드 로직 불변, unit 테스트도 동일 계약을 재확인: `andWhere` WAITING_FOR_INPUT 배제, DB 오류 시 lock 해제, affected=0 시 re-drive skip 등). "동일 recovery 스캔 간 이중 재구동" 차단은 여전히 견고하다.
  - 제안: 조치 불필요.

- **[INFO]** `_test/recover-stuck-executions` 신규 e2e 트리거 경로가 동시성 관점에서 프로덕션 스캔 로직과 동일 코드 경로(`runStuckRecoveryScan` → `recoverStuckExecutions`)를 그대로 재사용
  - 위치: `executions.controller.ts:198-208`, `execution-engine.service.ts` `runStuckRecoveryScan()`
  - 상세: e2e 전용 트리거도 동일한 boot-lock(SET NX)·원자 re-claim 경로를 타므로 별도의 동시성 우회로가 생기지 않는다. 다만 e2e 환경에서 이 엔드포인트를 여러 번 연속 호출하면(예: 테스트 재시도) 매 호출이 독립적인 `recoverStuckExecutions()` 실행이 되어, 이론적으로 짧은 시간 내 중첩 호출 시 lock 이 정상적으로 직렬화한다(`acquireLock` 실패 시 조기 return) — 신규 위험 없음, e2e 스펙(`execution-crash-redrive.e2e-spec.ts`)도 단일 트리거 후 폴링하는 패턴이라 실사용상 중첩 호출 시나리오도 없다.
  - 제안: 조치 불필요.

- **[INFO]** unit/e2e 테스트 커버리지 — 이전 라운드가 "오판된 stale 에 대한 이중 실행 시나리오는 unit/e2e 어느 쪽도 커버 안 됨"이라 지적한 부분은 이번 resolution 에서도 여전히 미커버 (문서화로 대체, 예상된 결과)
  - 위치: `execution-engine.service.spec.ts` 신규 describe 블록들(`recoverStuckExecutions`, `redriveStuckExecution`, `driveStuckRedrive`), `execution-crash-redrive.e2e-spec.ts`
  - 상세: 신규 테스트는 W5(3분기: 완료/park/에러)·W7(비-RehydrationError terminal)·W8(execution 부재 skip) 등 정상 재구동 경로의 결정론적 분기를 잘 커버하지만, "zombie 가 실제로 살아있는 채로 재구동돼 이중 실행"되는 non-deterministic 레이스 자체를 재현하는 테스트는 없다(이런 레이스는 timing-dependent 라 안정적 재현이 어려움 — 합리적 트레이드오프). RESOLUTION.md 도 이를 "문서화"로만 조치한다고 명시했고 이는 Q1 결정과 일치한다.
  - 제안: 조치 불필요(테스트 부재가 새로운 결함은 아님, 기존 라운드에서 이미 인지·수용된 갭).

## 요약

이전 concurrency 리뷰가 지적한 유일한 WARNING(W4 — 크래시 재구동 zombie 잔여 race)은 이번 resolution 커밋에서 요청한 최소 조치(코드 주석 + spec §Rationale 명시)로 정확히 이행되었다. 코드 주석(`execution-engine.service.ts:2799`)과 spec 문서(§7.5 case B 정의부, §Rationale) 양쪽이 위험 성격("heartbeat 없는 절대시각 stale 판정으로 인한 zombie 오판"), 완화 수준("boot-only 트리거 + 30분 임계 + per-node COMPLETED skip"), 후속 계획("PR4 BullMQ stalled 로 완전 fencing"), 그리고 "현행 fail-path 도 동일 노출이라 신규 회귀 아님"이라는 근거를 서로 drift 없이 일관되게 서술한다. 신규로 추가된 `failOrphanRunningNodeExecutions` 도 `status='running'` WHERE 가드가 있는 조건부 UPDATE 라 새로운 경쟁 조건을 만들지 않으며(기존에 문서화된 잔여 race 의 하위 사례일 뿐), 원자 re-claim·boot-lock 2-layer 방어·`skipExecutedNodes` 멱등 가드·guarded terminal 전이 등 핵심 동시성 안전장치는 이번 resolution 에서 변경되지 않고 그대로 유지된다. 새로운 CRITICAL/WARNING 급 동시성 결함은 발견되지 않았으며, 잔존 zombie race 는 설계상 인지·수용된 residual 위험(PR4 로 이연)으로 이번 재확인에서는 INFO 수준으로 하향해 종결한다.

## 위험도

LOW
