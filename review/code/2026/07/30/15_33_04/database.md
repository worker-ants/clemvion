# Database Review — retry 재진입 짝 전이 DB 가드 정합화 (8R CRITICAL fix)

대상 커밋: `2ca44b769` "fix(engine): retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함 (8R CRITICAL)"
실제 diff: `state/state-machine.ts`, `execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`,
`engine-driver.interface.ts` (+ 대응 `*.spec.ts`). `retry-turn.service.ts` 는 리뷰 페이로드에
포함됐으나 이번 커밋에서 실제 변경은 0줄(scope 리뷰어 판정과 일치) — 호출 체인 이해를 위한
컨텍스트로만 참조.

## 발견사항

- **[WARNING]** 이번 fix 로 **새로 도달 가능해진** `FAILED→RUNNING`/`FAILED→WAITING_FOR_INPUT` 짝 전이 경로가, `execution.error`/`finishedAt`/`durationMs` 를 원래 실패 시점 값 그대로 non-terminal 행에 재기록한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8430-8432`(`updateExecutionStatus` 의 `linkedNodeExec` 분기 — `execution.status = newStatus;` 이후 `manager.save(Execution, execution)` full-entity save), `:8458-8461` + `:8486`(else 분기 raw UPDATE 의 `error` SET 절이 `execution.error` 를 그대로 씀). 소비 경로는 `ai-turn-orchestrator.service.ts:453-458`(`reparkAiResumeTurn` → WAITING_FOR_INPUT) / `:1615-1620`(`finalizeAiNode` else 분기 → RUNNING).
  - 상세: `RetryTurnService.applyRetryLastTurn`(`retry-turn.service.ts:373-374`, 이번 커밋에서 무변경)이 `execution` 을 딱 한 번 `findOneBy`로 로드하는 시점의 DB 값은 **원래 FAILED 로 종결됐을 때 기록된 `error`/`finishedAt`/`durationMs`** 를 그대로 갖고 있다. 이후 같은 in-memory 참조가 `finalizeAiNode`/`reparkAiResumeTurn` 을 거쳐 `updateExecutionStatus` 의 `linkedNodeExec` 분기(FOR UPDATE 잠금 + `manager.save(Execution, execution)` **full-entity save**)에 도달하는데, 이 저장은 (이 코드베이스의 다른 곳에서 이미 "full-entity save" 로 반복 지적된 패턴대로) `status` 뿐 아니라 그 순간 in-memory 엔티티가 들고 있는 **모든 컬럼**을 그대로 덮어쓴다 — `error`/`finishedAt`/`durationMs` 를 clear 하는 코드는 이번 diff 는 물론 `retry-turn.service.ts` 어디에도 없다(`execution.error =`/`execution.finishedAt =` 대입 지점을 전수 grep 했으나 `completeRetryExecution`/`failRetryExecution`(종결 시점)에서만 **새 값을 쓸 뿐** null 로 비우는 지점은 없음).
    이 fix **이전**에는 `lockNonTerminalExecutionRow`(FOR UPDATE 조회)가 FAILED 를 항상 배제해 이 전이가 구조적으로 0행이었으므로 이 저장 자체가 DB 에 커밋된 적이 없었다 — 즉 이 부작용은 이번 diff 가 "죽어있던 코드 경로를 살리면서" 처음으로 실제 도달 가능해진 것이다. 영향은 특히 **재-park(대화 계속) 케이스**에서 두드러진다: 커밋 메시지가 명시하듯 이것이 "multi-turn 재진입의 가장 흔한 시나리오"이고, 재-park 되면 Execution 은 다음 사용자 입력이 올 때까지(수 시간~영구, idle reaper 가 개입하기 전까지) `waiting_for_input` 상태를 유지한다 — 그 전 기간 내내 DB row 는 `status='waiting_for_input'` 이면서 `error`(원래 실패 메시지)·`finishedAt`(원래 실패 시각)·`durationMs` 를 함께 노출한다. `ExecutionDto`(`codebase/backend/src/modules/executions/executions.service.ts:826-840`)가 이 네 필드를 가공 없이 그대로 REST 응답에 매핑하므로, `GET /executions/:id` 폴링·프론트엔드가 "대기 중"인데 오류 배너·완료 시각·소요시간이 함께 표시되는 모순 상태를 그대로 노출할 수 있다.
    같은 클래스의 문제(`execution.error` 미클리어)가 **성공 COMPLETED 종결** 케이스로 이미 `plan/in-progress/retry-turn-terminal-guard.md` #5(P3, 4R INFO 2, "이번 diff 의 신규 회귀는 아님")로 추적 중이나, 그 항목은 `finalizeGuarded`(종결 전용 raw UPDATE)만 언급하고 있고 이번에 지목하는 **중간 non-terminal 단계**(재-park 로 장시간 지속 가능)는 다른 코드 경로(`updateExecutionStatus` 의 `linkedNodeExec` 분기)이자 이번 diff 가 처음으로 실제 도달시킨 경로라 별개로 명시할 가치가 있다.
  - 제안: `RetryTurnService.applyRetryLastTurn` 진입 직후(fresh `execution` 로드 시점, `retry-turn.service.ts:374` 부근)에 `execution.error = null;`(가능하면 `finishedAt`/`durationMs` 도 함께 검토)을 명시적으로 초기화해, 이후 어느 분기(중간 RUNNING/WAITING_FOR_INPUT 경유든 최종 COMPLETED/FAILED 경유든)로 흘러도 stale 값이 재기록되지 않게 하는 단일 지점 수정을 권장. 이렇게 하면 이번 항목과 이미 추적 중인 plan #5 를 한 번에 해소할 수 있다.

- **[WARNING]** `allowRetryReentry` 가 결정하는 "가드 대상 status 목록" 산정 로직이 SQL 조립 지점 2곳에 개별 삼항식으로 중복돼 있어, 향후 소비처 추가/리팩터링 시 opts 전달 누락이 재발할 구조적 위험이 남는다 (security 리뷰어와 동일 지점을 DB 정합성 관점에서 교차 확인)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8173-8175`(`lockNonTerminalExecutionRow` 내부 삼항), `:8459-8461`(`updateExecutionStatus` else 분기 인라인 삼항)
  - 상세: 이번 커밋 자체의 커밋 메시지가 "리뷰어는 2경로만 지목했으나 실측으로 3곳임을 확인해 함께 수정"이라고 명시할 만큼, 이 게이트가 이미 한 번 fan-out 누락으로 재발한 이력이 있다. 두 삼항식은 지금은 동일한 두 상수(`NON_TERMINAL_STATUSES_SQL`/`NON_TERMINAL_OR_FAILED_STATUSES_SQL`) 사이에서 선택하는 로직이 완전히 동형이라, 한쪽만 수정되고 다른 쪽이 갱신되지 않으면 "FAILED 를 되살릴 수 있는 조건"이 두 SQL 가드 사이에서 조용히 어긋날 수 있다(한쪽은 열려있고 다른 쪽은 닫힌 상태) — 데이터 정합성 관점에서 재발 시 이번과 같은 fail-closed(가용성 저하) 방향일 수도, 반대로 fail-open(FAILED 행 우발적 부활) 방향일 수도 있다.
  - 제안: 두 지점을 `private static resolveGuardStatusesSql(opts?: { allowRetryReentry?: boolean }): string` 같은 단일 헬퍼로 통합해, "opts 를 받아야 하는 가드 SQL 조립 지점"을 하나로 좁힐 것을 권장.

- **[INFO]** 신설된 `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 를 포함한 raw SQL 문자열 보간 — SQL 인젝션 벡터 아님 (재확인)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:513-543`(두 상수 선언), `:8176-8181`(`lockNonTerminalExecutionRow` 의 `SELECT ... FOR UPDATE`), `:8462-8473`(else 분기 `UPDATE`)
  - 상세: 두 상수 모두 `Object.values(ExecutionStatus)`(고정 6-값 TS enum)에서만 파생되며 사용자 입력이 도달할 수 없다. 가변 값(`executionId` 등)은 `$1`/`:id` 파라미터 바인딩으로 처리된다 — 기존 `NON_TERMINAL_STATUSES_SQL` 과 동일한, 이미 검증된 패턴의 반복.
  - 제안: 조치 불필요.

- **[INFO]** FOR UPDATE 행 잠금의 트랜잭션 스코프·저장 순서는 이번 opts 전파로 변경되지 않음 — 확인 완료
  - 위치: `execution-engine.service.ts:8236-8251`(`tryLockActiveExecutionAndSaveNodeExec` — `this.dataSource.transaction` 안에서 잠금 조회 → NodeExecution save), `:8414-8434`(`updateExecutionStatus` linkedNodeExec 분기 — 동일 트랜잭션 안에서 잠금 조회 → Execution save → NodeExecution save)
  - 상세: 이번 diff 는 잠금 대상 `status IN (...)` 목록만 opts 에 따라 바꿀 뿐, `FOR UPDATE` 를 감싸는 `this.dataSource.transaction` 경계·잠금 획득 후 save 하는 순서·잠그는 테이블(`execution` 단건 PK)은 그대로다. 두 소비처 모두 "execution 행 잠금 → 그 안에서 관련 row save" 순서를 유지해 교차 lock-ordering 데드락 위험을 새로 만들지 않는다. `id = $1` 단건 PK 조회라 인덱스 문제도 없고(추가 인덱스 불요), 루프 안에서 호출되는 구조도 아니라 N+1 도 해당 없음.
  - 제안: 조치 불필요.

## 검증한 항목 (문제 없음 확인)

- **인덱스**: 모든 변경 지점의 쿼리는 `execution.id = $1`(PK) 단건 조회/UPDATE — 추가 인덱스 불요.
- **N+1**: 반복문 안에서 호출되는 지점 없음.
- **마이그레이션 안전성**: 이번 diff 에 DDL/스키마 변경 없음 — 해당 없음.
- **스키마 설계**: 신규 테이블/컬럼 없음 — 해당 없음.
- **커넥션 관리**: NestJS `DataSource`/`EntityManager` 주입 + `this.dataSource.transaction(...)` 콜백 패턴 그대로 유지 — 커밋/롤백 시 커넥션이 프레임워크에 의해 정상 반환된다. 신규 수동 커넥션 획득/해제 없음.
- **대량 데이터**: 목록 조회·페이지네이션과 무관한 단건 PK 오퍼레이션만 변경됨 — 해당 없음.

## 요약

이 커밋은 `execution.retry_last_turn` 재진입의 `FAILED→RUNNING`/`FAILED→WAITING_FOR_INPUT` 짝 전이가 in-memory 상태머신(opt-in 허용)과 DB 레벨 가드(`FOR UPDATE` 조회·guarded UPDATE 모두 FAILED 무조건 배제) 사이의 불일치로 구조적으로 항상 0행이었던 결함을, `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 신설 + 3개 잠금/UPDATE 소비처(`lockNonTerminalExecutionRow`/`tryLockActiveExecutionAndSaveNodeExec`/`updateExecutionStatus` else 분기) 전체에 `opts.allowRetryReentry` 를 정확히 전파해 닫는다. 전 호출 체인(`applyRetryLastTurn`→`processAiResumeTurn({retryReentry:true})`→`finalizeAiNode`/`reparkAiResumeTurn`→`updateExecutionStatus`/`tryLockActiveExecutionAndSaveNodeExec`)을 직접 추적한 결과 플래그 전파가 빠짐없이 이어지고, `ALLOWED_TRANSITIONS[FAILED]` 는 여전히 빈 배열로 유지돼 COMPLETED/CANCELLED 로의 우발적 부활은 계속 차단된다 — 핵심 수정 자체는 정확하고, 트랜잭션 경계·잠금 순서·SQL 파라미터화도 기존 패턴을 그대로 보존해 새로운 데드락·인젝션 위험을 만들지 않는다. 다만 이 fix 가 "죽어있던" DB 쓰기 경로를 처음 살리면서, 그 full-entity save(`linkedNodeExec` 분기)/raw UPDATE(else 분기)가 원래 실패 시점의 `error`/`finishedAt`/`durationMs` 를 clear 없이 그대로 재기록한다는 부작용이 새로 관측 가능해졌다 — 특히 재-park(가장 흔한 케이스) 시 그 상태가 다음 사용자 입력까지 장시간 유지될 수 있어 REST/폴링 소비자에게 "대기 중인데 오류·완료시각이 함께 표시"되는 모순을 노출한다. 이는 이미 추적 중인 plan 항목(#5, COMPLETED 종결 케이스)과 같은 근본 원인의 다른(더 이른) 발현이며, `applyRetryLastTurn` 진입 시 `execution.error` 를 명시적으로 비우는 한 지점 수정으로 두 발현을 함께 해소할 수 있다. 추가로 `allowRetryReentry` 게이트의 SQL 조립 로직이 2곳에 중복돼 있어(이번 커밋 자체가 "2곳→3곳" 재발을 실증) 단일 헬퍼로의 통합을 권고한다. 인덱스·N+1·마이그레이션·스키마·커넥션·대량 데이터·SQL 인젝션 관점에서는 신규 위험이 없다.

## 위험도

LOW
