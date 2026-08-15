# 동시성(Concurrency) 리뷰

## 발견사항

- **[WARNING]** `finalizeCancelledExecution` (a) 분기 — 동시 finalizer 레이스 시 `EXECUTION_CANCELLED` 중복 발행 가능성이 닫히지 않았다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4884` (`finalizeCancelledExecution`), 분기 조건 `:4938`, 값 되쓰기 `:4947`, emit 호출 `:4950`
  - 상세: guarded UPDATE 가 0행이면 재조회해 `live.status === CANCELLED` 일 때만 emit 하도록 이번 diff 가 고쳤다. 이 자체는 옳은 개선이다(구 코드는 무조건 emit — DB가 FAILED 여도 cancelled 를 쐈다). 그러나 "0행 = 다른 writer 가 CANCELLED 로 이미 커밋" 케이스(코드 주석이 스스로 "(a) DB 가 이미 CANCELLED")에서는, **guarded UPDATE 를 시도한 모든 동시 finalizer 가 각자 재조회 후 각자 emit** 한다 — 재조회-후-emit 시점에 "내가 이미 emit 했는지"를 확인하는 단일 관문(single-flight guard)이 없다. 이 코드 자체의 주석이 "동시 writer 가 이미 다른 terminal 상태로 선점" 을 희귀 레이스가 아니라 이 PR 전체가 방어하려는 반복 시나리오로 다루고 있고(`retry-turn.service.ts` 의 `finalizeGuarded` 도 같은 실행에 대해 CANCELLED 목표로 별도 COALESCE-UPDATE 를 실행하며 성공 시 `failRetryExecution` 이 자체적으로 `EXECUTION_CANCELLED` 를 emit 한다 — 이쪽도 emit 소스다), 두 개 이상의 finalizer 경로가 같은 execution 에 대해 같은 CANCELLED 전이를 "관측"하면 각각 독립적으로 `emitExecution` 을 호출해 **서로 다른 `seq`/delivery-id 를 가진 별개 이벤트로 두 번(N 번) 발행**된다. `X-Clemvion-Delivery`/`seq` 기반 dedup(EIA-NX-04/EIA-RL-01)은 "같은 논리적 이벤트의 재전송" 을 위한 장치이지, "같은 DB 전이를 서로 다른 finalizer 가 각자 새로 emit" 하는 이 케이스를 겨냥한 것이 아니다 — 클라이언트가 seq 로 정렬은 해도 두 이벤트를 같은 것으로 병합할 근거가 없다.
  - 참고: 이 문제는 **이번 diff 가 새로 만든 것이 아니다** — 구 코드(무조건 emit)는 0행 매칭 시 DB 상태와 무관하게 항상 emit 했으므로 이 케이스를 포함해 더 넓은 범위에서 중복 발행이 가능했다. 이번 변경은 "DB 와 모순되는" 중복(케이스 b)만 제거했고, "DB 와 일치하지만 여전히 중복" 인 케이스(a)는 범위 밖으로 남았다. 실제 재현 가능성은 execution 당 동시 처리 워커 수(BullMQ concurrency/stalled 재배달 정책)에 달려 있어, 이 diff 만으로 단정할 CRITICAL 은 아니라고 판단해 WARNING 으로 분류한다.
  - 제안: (1) 이미 job-level/advisory lock 으로 execution 당 단일 finalizer 만 이 경로에 도달함이 보장된다면 그 근거를 주석/spec 에 명시해 이 리뷰가 재-flag 하지 않도록 한다. (2) 보장되지 않는다면 `EXECUTION_CANCELLED` emit 직전에 "이번 호출이 실제로 이 전이를 커밋했는가"(즉 `persisted===true` 이거나, 0행 재조회 케이스에서는 별도의 원자적 "emit 권한" 마커 — 예컨대 guarded UPDATE 에 `RETURNING` 을 걸어 0행이면 완전히 skip, terminal 알림은 오직 최초 커미터만) 로 좁히는 것을 검토할 것. 최소한 EIA spec (§6 근처)에 "동일 CANCELLED 전이에 대해 최대 N 개의 독립 emit 이 가능하며 payload 값은 동일하다" 는 캐비엇을 남기면 외부 소비자가 dedup 전략을 세울 수 있다.

- **[INFO]** `finalizeCancelledExecution` 재조회 경로의 TOCTOU 는 실질적으로 닫혀 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4919-4948`
  - 상세: guarded UPDATE(0행) 이후 `findOneBy` 로 다시 읽는 것 자체는 "읽은 시점과 판정 시점 사이" 간극이 있어 보이지만, 이 저장소의 상태 머신은 terminal 상태에서의 outgoing 전이를 금지한다(`canTransition`) — 즉 한번 CANCELLED/FAILED/COMPLETED 로 관측되면 이후 값이 다시 바뀌지 않는다. 재조회는 오직 "이미 종결된 값" 을 읽는 것이라 추가적인 lost-update 창을 만들지 않는다. 재조회 실패(예외)·행 부재 케이스도 모두 fail-closed(emit skip)로 처리되어 있고, 회귀 테스트(`execution-engine.service.spec.ts` 신규 `describe('finalizeCancelledExecution — 0행 매칭의 두 의미'`)가 (a)/(b)/(c: 행 없음)/(d: 재조회 예외) 네 갈래를 모두 커버한다.

- **[INFO]** `retry-turn.service.ts` `finalizeGuarded` CANCELLED 분기 — `RETURNING` 추가는 원자적이며 새 레이스를 만들지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:631-663` (COALESCE UPDATE + `.returning(['duration_ms', 'finished_at'])`)
  - 상세: `COALESCE(col, :new)` 가 실제로 어느 쪽 값을 골랐는지는 같은 UPDATE 문의 `RETURNING` 으로 원자적으로 되받으므로 SELECT-then-write 형 TOCTOU 창이 생기지 않는다. `(result.affected ?? 0) > 0` 가드 뒤에서만 `row` 를 읽어 undefined 접근도 없다. `toFiniteNumber`/`toPersistedDate` 가 pg 드라이버의 문자열/숫자·문자열/Date 이중 형태를 모두 안전하게 좁힌다(0 값도 `typeof === 'number' && isFinite` 로 정확히 살아남아 `??` 경계 문제 없음). `result.raw` 배열이 `affected>0` 인데 비어 있는 이론적 edge case에서는 `execution.durationMs`/`finishedAt` 이 되쓰기 전 로컬 값으로 조용히 남는 fallback 이 있으나, 이는 PostgreSQL/TypeORM 조합에서 발생하지 않는 케이스이고 저장소의 다른 `toFiniteNumber` 소비 지점과 동일한 방어적 관용구라 별도 조치가 필요한 수준은 아니다.

- **[INFO]** `interaction.service.ts`/`execution-status-response.dto.ts` `durationMs` 추가 — 동시성 영향 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:78`(`STATUS_PROJECTION_COLUMNS`), `:435`(`durationMs: execution.durationMs ?? null`)
  - 상세: 이미 로드된 컬럼값을 그대로 응답에 싣는 순수 read-path 라 추가 쓰기·재계산이 없고 경쟁 조건 표면이 없다.

## 요약

이번 diff 의 핵심(`finalizeCancelledExecution` 의 극성 재정정, `retry-turn.service.ts` 의 `RETURNING` 추가)은 모두 SQL 레벨 원자적 guarded UPDATE(+`RETURNING`)에 기반해 SELECT-then-write 형 TOCTOU 를 새로 만들지 않았고, 값 되쓰기(`toFiniteNumber`/`toPersistedDate`)도 pg 드라이버의 다형 반환 형태를 안전하게 처리한다. 다만 `finalizeCancelledExecution` 이 "0행 = 다른 writer 가 CANCELLED 로 이미 커밋" 케이스에서 재조회 후 emit 하도록 고친 결과, **여러 finalizer 가 같은 execution 의 같은 CANCELLED 전이를 동시에 관측하면 각자 독립적으로 `EXECUTION_CANCELLED` 를 emit 해 값은 같지만 `seq`/delivery-id 가 다른 중복 이벤트가 나갈 수 있는 잔여 표면**이 있다. 구 코드(무조건 emit)보다 범위는 좁아졌지만(“DB 와 모순되는” 중복은 제거됨) 완전히 닫히지는 않았다 — 이 diff 가 새로 만든 결함은 아니고, execution 당 동시 처리가 실제로 몇 중으로 일어나는지(job/advisory lock 유무)에 좌우되는 문제라 WARNING 으로 등재해 후속 확인을 권한다. 그 외 새로 도입된 데드락·미동기화 공유 상태·await 누락·이벤트 루프 블로킹은 발견되지 않았다.

## 위험도

LOW
