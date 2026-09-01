# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[INFO]** `markNodeCancelled` 실패를 삼키는 처리가 상위 재시도 경로를 통한 자가 치유 가능성을 제거한다 — 짝 `NodeExecution` row 가 non-terminal 로 영구 잔류할 수 있음을 이미 문서화·수용
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:409` (`assertLinkedTransitionApplied` 의 `try { await this.driver.markNodeCancelled(...) } catch (err) { ... }` 블록)
  - 상세: 수정 전에는 `markNodeCancelled` 의 reject 가 그대로 전파돼 `ExecutionCancelledError` 대신 원본 예외(예: DB 쓰기 실패)가 던져졌다. 이 경우 `applyRetryLastTurn`/`processAiResumeTurn` 상위 catch 가 취소를 FAILED 로 오분류하는 것이 원래 결함이었고, 이번 변경은 그 오분류를 올바르게 닫는다(정정 방향 자체는 타당함). 다만 부수효과로, 마킹 실패 시 예외가 항상 `ExecutionCancelledError`(취소로 정상 종결되는 시그널)로 대체되므로, BullMQ worker 관점에서는 "정상 종결"로 처리되어 job 재시도가 발생하지 않는다. 수정 전에는(오분류이긴 했지만) 원본 예외가 그대로 올라가 경우에 따라 큐 재시도가 발생해 `markNodeCancelled` 를 다시 시도할 기회가 있었을 수 있다 — 수정 후에는 그 경로가 완전히 닫힌다. PR 저자도 이를 인지하고 "마킹 실패 자체는 여전히 문제다(짝 row 가 non-terminal 로 잔류한다)" 라고 명시했고, 처방을 관측(로그)으로 한정한다고 밝혔다. 새로 만든 결함은 아니며 트레이드오프가 문서화돼 있어 CRITICAL/WARNING 으로 올리지 않는다.
  - 제안: 현재 수준으로 충분하나, 향후 `markSpawnedRowFailed` 류의 zombie-row 방지 backstop(예: `recoverStuckExecutions` 확장)이 이 잔류 케이스까지 커버하는지 후속 검증을 권장한다(plan 문서가 이미 유사 갭을 추적 중이라면 그쪽에 병합).

- **[INFO]** `RetryTurnService.finalizeGuarded` 의 CANCELLED 멱등 분기는 SQL `COALESCE` 로 "그 순간의 DB 값"을 재평가해 재조회(SELECT)~UPDATE 사이 창의 ABA 문제를 정확히 회피한다 — 이번 diff 는 이 로직 자체를 바꾸지 않고 JSDoc 만 보강했으므로 재확인 목적의 기록
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:640` 부근 (`if (target === ExecutionStatus.CANCELLED)` 분기)
  - 상세: SELECT(`live`) 이후 UPDATE 시점 사이에 동시 `stop()` 이 `finished_at`/`duration_ms` 를 먼저 커밋할 수 있는데, 앱 레벨 `??` 병합 대신 UPDATE 문의 `COALESCE(finished_at, :new)` 로 DB 가 최종 판정자가 되도록 설계했고 `.returning(...)` 으로 영속값을 in-memory 에 되쓴다. 원자성·정합성 모두 타당하다. 문제 없음, 참고용 기록.

## 요약

이번 changeset(`ai-turn-orchestrator.service.ts`, `execution-engine.service.ts`, `retry-turn.service.ts` 및 관련 spec/entity/plan 파일)은 이전 라운드들에서 발견된 취소(cancel)/종결(terminal) 경계의 동시성 결함을 계속 다듬는 성격의 정정 커밋이다. `markNodeCancelled` reject 경로를 try/catch 로 감싸 취소 분류가 원본 마킹 실패에 의해 오염되지 않도록 고쳤고(부수 트레이드오프는 문서화·수용됨), `executeSync` timeout 경로가 guarded UPDATE 의 `persisted` 반환값을 소비하도록 해 관측성 비대칭을 해소했으며, `RetryTurnService` 의 종결 로직을 `markSpawnedRowFailed`/`prepareSuccessTermination` 헬퍼로 추출해 중복을 제거하고 성공 종결 시 `error` 필드를 명시적으로 비우도록(모순 레코드 방지) 고쳤다 — 세 변경 모두 기존의 JSONB 원자 consume 가드(`jsonb_exists`), `FOR UPDATE` 짝 전이 잠금, guarded status-CAS UPDATE, `COALESCE` 기반 ABA 회피 같은 기존 동시성 방어 기전을 그대로 보존하며 새로운 락/뮤텍스/원자성 위반을 도입하지 않는다. 테스트 변경분도 분기를 실제로 가르는 fixture와 호출 시점 스냅샷(사후 참조 관찰 회피) 패턴을 사용해 검증 신뢰도를 높였다. 새로운 CRITICAL/WARNING 급 동시성 결함은 발견하지 못했다.

## 위험도

LOW
