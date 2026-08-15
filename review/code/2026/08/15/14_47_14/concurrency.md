# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** `finalizeCancelledExecution` 의 0행-fallback 재조회는 상태머신의 "terminal = sink" 불변식에 기대어 안전하다 — 단, `FAILED` 만 예외(opt-in 재진입)라 로그 라벨이 부정확해질 수 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4899-4929` (`finalizeCancelledExecution`)
  - 상세: 새 fallback 은 guarded UPDATE(`status IN (non-terminal)`)가 0행이면 `this.executionRepository.findOneBy(...)` 로 (락 없이) 재조회해 `live.status === CANCELLED` 일 때만 emit 한다. 이 두 조회(guarded UPDATE 실패 시점 ↔ `findOneBy` 시점) 사이에는 명시적 트랜잭션/락이 없어 이론적으로 TOCTOU 창이 열려 있지만, `state/state-machine.ts` 의 `ALLOWED_TRANSITIONS`(`COMPLETED: []`, `CANCELLED: []`)가 두 상태를 순수 sink 로 고정해 두었기 때문에 — guarded UPDATE 가 0행에 매칭된 순간 DB 가 `CANCELLED`/`COMPLETED` 였다면 그 값은 이후 `findOneBy` 시점까지 절대 바뀔 수 없다. 유일한 예외는 `FAILED` 다 — `canTransition` 의 `allowRetryReentry` opt-in(`execution.retry_last_turn` 재진입)이 `FAILED → RUNNING`/`FAILED → WAITING_FOR_INPUT` 을 허용한다. 즉 guarded UPDATE 실패 시점에 DB 가 `FAILED` 였는데, 그 직후 재진입 요청이 `FAILED → RUNNING` 전이를 커밋하면 `findOneBy` 는 `RUNNING`(또는 그 이후 상태)을 본다. 이 경우 `live?.status !== CANCELLED` 분기로 떨어져 **emit 은 여전히 정확히 skip** 되므로 오발행(사후 오시그널)은 발생하지 않는다. 다만 `4919-4923` 의 warn 로그 문구 `"다른 종결자가 ${live?.status} 으로 선점"` 이 `RUNNING` 을 "종결자(finalizer)" 로 표현해, 실제로는 재진입이 실행을 되살린 것인데 로그만 보면 다른 종결 경로가 선점한 것처럼 오인될 수 있다.
  - 제안: 조치 불요(오발행 없음). 로그 정확도만 원하면 `live?.status` 가 `TERMINAL_STATUSES` 밖일 때 문구를 "동시 retry 재진입으로 상태가 바뀌어 skip" 등으로 분기해도 좋다 — 우선순위는 낮음.

- **[INFO]** 같은 fallback 의 (a) 분기(`live.status === CANCELLED`)가 emit 을 계속 발행하는 것은 종전 "무조건 emit" 동작을 보존한 것이지, 이 diff 가 새로 만든 이중 발행 표면이 아니다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4918-4930`
  - 상세: `finalizeCancelledExecution` 이 (드물게) 같은 execution 에 대해 두 경로(`runExecution` catch `:4787`, `finalizeResumedExecutionOutcome` 경유 `:2783`)에서 겹쳐 호출된다면, 먼저 커밋한 쪽이 guarded UPDATE 로 성공하고 나중 호출은 0행 → fallback → `live.status===CANCELLED` → **emit** 이라 이론적으로 `EXECUTION_CANCELLED` 가 두 번 나갈 수 있다. 그러나 이 노출면은 diff 이전 코드(반환값 무시하고 항상 emit)에서도 동일하게 존재했다 — 이번 변경은 오히려 (b) 분기(DB 가 FAILED/COMPLETED 로 선점된 경우)의 **오발행만** 닫았을 뿐 (a) 분기의 이중 발행 가능성은 건드리지 않았다(회귀 아님, 기존 노출면 유지). 두 호출부가 동일 execution 에 대해 실제로 동시에 도달 가능한지는 상위 admission/재진입 직렬화 로직(이번 diff 범위 밖)에 달려 있어 이 리뷰에서 판정하지 않는다.
  - 제안: 조치 불요(이번 diff 의 회귀 아님). 필요하면 별도 조사로 두 호출부의 상호 배타성(동일 execution 에 대한 직렬화 보장 여부)을 확인.

- **[INFO]** `finalizeGuarded` CANCELLED 분기의 `.returning(['duration_ms', 'finished_at'])` 추가는 같은 UPDATE 문 안에서 실행되어 새 TOCTOU 창을 만들지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:641-675`
  - 상세: `COALESCE(duration_ms, :newDurationMs)` 로 값을 정하는 그 UPDATE 문 자체에 `RETURNING` 을 붙였으므로, "COALESCE 가 어느 쪽을 골랐는가" 는 별도 SELECT 없이 같은 원자적 문장에서 확정된다. 되쓰기는 `(result.affected ?? 0) > 0` 가드 뒤에서만 일어나(`:658`) 0행(동시 선점) 케이스에서 `row`/`result.raw` undefined 접근 위험이 없다. `toFiniteNumber`/`toPersistedDate` 각각이 `null` 이면 in-memory 값을 그대로 두므로(`:665`, `:671`) 부분 파싱 실패가 두 컬럼을 불일치 상태로 만들지 않는다.
  - 제안: 없음.

- **[INFO]** `interaction.service.ts` 의 `durationMs` projection 추가는 순수 read-path 라 동시성 표면이 없다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:78`(`STATUS_PROJECTION_COLUMNS`), `:434-438`(`durationMs: execution.durationMs ?? null`)
  - 상세: 이미 로드된 컬럼값을 그대로 응답에 싣기만 하고 추가 쓰기·재계산이 없다.

## 요약

이번 라운드(14_47_14)의 실질 변경은 직전 라운드(13_58_27)가 이미 CRITICAL 0/WARNING 10 으로 검토·조치한 코드의 후속 상태다. 핵심 두 지점 — `finalizeCancelledExecution` 의 guarded-UPDATE 반환값 확인 + 0행 fallback 재조회, `retry-turn.service.ts` `finalizeGuarded` CANCELLED 분기의 `.returning()` 되읽기 — 를 상태머신(`state-machine.ts`)의 `ALLOWED_TRANSITIONS` 정의까지 직접 대조해 재검증했다. `CANCELLED`/`COMPLETED` 는 순수 sink 상태라 guarded UPDATE 실패 이후의 무락 재조회(`findOneBy`)가 TOCTOU 없이 안전하고, `retry-turn.service.ts` 의 `RETURNING` 은 같은 SQL 문 안에서 실행돼 별도 창을 만들지 않는다. 유일한 이론적 예외는 `FAILED → RUNNING/WAITING_FOR_INPUT` retry 재진입(opt-in)인데, 이 경로가 fallback 재조회 사이에 끼어들어도 emit 판정은 여전히 "skip" 으로 안전하게 떨어지고 로그 문구만 다소 부정확해질 뿐이다(INFO). 새로 도입된 경쟁 조건·미해결 동기화 이슈는 발견되지 않았고, CRITICAL/WARNING 은 없다.

## 위험도

LOW
