# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[INFO]** `markNodeCancelled` 실패를 흡수(catch)하는 것이, BullMQ worker 관점에서 재시도를 통한 자가 치유 경로를 닫는다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` `assertLinkedTransitionApplied` — `try { await this.driver.markNodeCancelled(nodeExec, node, context, executionId); } catch (err) { this.logger.error(...); }` 블록 (함수 시작부 기준 `catch (err) {` 줄)
  - 상세: 직접 읽어 확인 — 수정 전에는 `markNodeCancelled` 의 reject 가 그대로 전파돼 `ExecutionCancelledError` 가 아예 던져지지 않고, 상위가 원본 예외(예: DB 쓰기 실패)를 일반 예외로 받아 취소를 FAILED 로 오분류했다. 이번 변경(try/catch + 로그, 무조건 `throw new ExecutionCancelledError(...)`)은 그 오분류를 정확히 닫는다 — 코드를 직접 읽어 `catch` 블록 안에 `throw err` 등 재던지기가 **없음**을 확인했다(주석만 있고 실제로 삼킨다). 다만 부수효과로, 마킹 실패의 원인이 무엇이든(DB 커넥션 문제·타임아웃 등) 예외가 항상 "정상 취소 종결" 신호인 `ExecutionCancelledError` 로 대체된다. 큐 소비자(BullMQ)는 이를 실패 job 이 아니라 정상 종결로 처리하므로, 마킹 실패 시 짝 `NodeExecution` row 를 non-terminal 로 남긴 채 재시도 기회 없이 영구 방치될 수 있다. 이는 새로 만든 결함이 아니라 기존 설계(관측만 하고 분류는 바꾸지 않는다)의 의도된 트레이드오프이며, plan(`ie-resume-turn-boundary-cancel.md` INFO 4/5)에 이미 인지·수용돼 있고 감사 로그 실패 처리와 동일한 판단 축이다. `catch` 가 DB 예외와 비-DB 예외(프로그래밍 오류)를 구분하지 않고 동일하게 흡수하는 점도 같은 계열의 관찰이다.
  - 제안: 현재 수준으로 충분. 후속으로 stalled-job recovery 백스톱(`recoverStuckExecutions`)이 이 잔류 케이스(마킹 실패로 non-terminal 로 남은 짝 row)까지 실제로 커버하는지 배포 후 관측을 권장 — 이미 plan 이 추적 중인 항목과 병합 가능.

- **[INFO]** `executeSync` timeout 경로의 `updateExecutionStatus` 반환값 소비는 관측성 개선일 뿐, 원자성/락 자체에는 영향 없음 — 검증 목적 기록
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — timeout `catch` 블록의 `const persisted = await this.updateExecutionStatus(reloaded, ExecutionStatus.FAILED); if (!persisted) { this.logger.warn(...); }`
  - 상세: 직접 읽어 확인 — 이 변경 이전에도 `updateExecutionStatus` 는 `TERMINAL_STATUSES` 가드로 이미 terminal 인 execution 을 재-FAILED 하지 않는 guarded UPDATE(choke point, `assertTransition` + DB 조건부 UPDATE)였다. 이번 diff 는 그 반환값(`false` = 동시 cancel 이 이미 선점)을 버리지 않고 warn 로그로 노출하는 순수 관측성 추가이며, 락/CAS 로직 자체는 변경되지 않았다. 형제 종결 경로(`failFirstSegmentSetup`)와 로깅 대칭을 맞춘 것으로, 새 레이스나 원자성 위반을 만들지 않는다.
  - 제안: 조치 불요 — 긍정적 개선으로 기록.

- **[INFO]** `RetryTurnService` 자연 종결 경로가 `finalizeGuarded`(가드 UPDATE)를 우회하고 `driver.updateExecutionStatus` 를 직접 호출 — 참조 동일성 불변식에 의존한다는 것이 이번 diff 에서 처음으로 문서화됨(로직 자체는 무변경)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — `resumeGraphAfterRetry` 자연 종결 분기의 `this.prepareSuccessTermination(savedExecution); ... const completed = await this.driver.updateExecutionStatus(savedExecution, ExecutionStatus.COMPLETED);` 바로 위 신규 주석 블록("이 경로만 `finalizeGuarded` 를 거치지 않는다")
  - 상세: 직접 읽어 확인 — `updateExecutionStatus` 자체는 여전히 `assertTransition` + DB 단에서 원자적으로 상태를 검증/전이하는 choke point 이므로 이 경로가 무가드는 아니다. 다만 `assertTransition` 은 **in-memory `execution.status`** 를 기준으로 미리 전이 허용 여부를 판단하므로, 만약 orchestrator 가 `savedExecution` 을 재조회/교체하는 형태로 바뀌면(현재는 아님) stale 값 기준으로 잘못된 전이를 허용하거나 유효한 전이를 거부할 수 있다. 신규 주석이 이 불변식과 재발 조건을 명시적으로 남긴 것은 타당하고, 코드 동작 자체(3개 필드 in-place 대입 → `prepareSuccessTermination` 헬퍼 추출)는 순수 리팩터라 기능 변경 없음을 diff 로 확인했다.
  - 제안: 조치 불요 — 향후 orchestrator 가 엔티티를 재조회하는 형태로 바뀌는 리팩터가 들어오면 이 호출도 `finalizeGuarded` 로 통일할 것(주석에 이미 명시됨).

- **[INFO]** `RetryTurnService.retryLastTurn` 의 원자 consume(`jsonb_exists` CAS 가드 + JSONB 키 제거)은 이번 diff 로 로직이 바뀐 것이 아니라 신규 테스트로 처음 커버됨 — 동시성 안전성 재확인 목적 기록
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:217-228` 부근(`createQueryBuilder().update()...andWhere(jsonb_exists(output_data, '_retryState'))`), 신규 테스트는 `retry-turn.service.spec.ts` "원자 consume 이 jsonb_exists 가드와 JSONB 키 제거로 구성된다"
  - 상세: 소스를 직접 열어 확인 — `?` 대신 `jsonb_exists` 를 쓰는 이유(pg 드라이버가 `?` 를 바인드 파라미터로 오인)와 `-` 연산자로 컬럼 전체가 아닌 단일 키만 지우는 설계는 동시 retry 시도가 같은 spawn 을 중복 생성하지 못하게 막는 CAS 성격의 가드로, 기존 로직 그대로다. 이번 diff 는 mock 체이너가 `set`/`andWhere` 인자를 실제로 포착하게 고쳐 SQL 형태를 단언으로 고정한 것 — 락/원자성 로직 변경은 없다.
  - 제안: 조치 불요.

## 요약

changeset(`ai-turn-orchestrator.service.ts`, `execution-engine.service.ts`, `retry-turn.service.ts` 및 관련 spec/entity/plan/CHANGELOG 파일)을 직접 읽어 대조한 결과, 이번 라운드는 취소/재시도 종결 경계의 기존 동시성 방어 기전(`FOR UPDATE` 짝 전이 잠금, guarded status-CAS `updateExecutionStatus`, `jsonb_exists` 원자 consume 가드, `COALESCE` 기반 ABA 회피)을 전혀 건드리지 않고, (1) `markNodeCancelled` reject 를 흡수해 취소 분류가 마킹 실패로 오염되지 않도록 닫고, (2) `executeSync` timeout 의 guarded UPDATE 반환값을 관측 가능하게 로깅하며, (3) 종결 필드 세팅을 `markSpawnedRowFailed`/`prepareSuccessTermination` 헬퍼로 추출하고 `error` 를 명시적으로 비워 모순 레코드를 막는 방어적 정정이다. `catch (err) { throw err; }` 형태의 재던지기 은닉 같은 실질 결함은 소스를 직접 열어 검사했으나 존재하지 않았다(diff 그대로 구현됨). 새로 도입된 락/뮤텍스/원자성 위반이나 경쟁 조건은 발견하지 못했고, 유일한 관찰 포인트는 마킹 실패 흡수가 BullMQ 재시도를 통한 자가 치유 경로를 닫는다는 것인데 이는 plan 문서에 이미 인지·수용된 트레이드오프다.

## 위험도

LOW
