STATUS=success

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (2026-08-15 10:34)

## 방법론

prompt bundle 에서 핵심 구현 파일(`execution-engine.service.ts`, `execution-engine.service.spec.ts`)의
diff 가 크기 제한으로 생략돼 있어, `git diff origin/main -- codebase/backend/...` 및 `Read` 로 두
서비스 파일·신규 헬퍼(`terminal-duration.ts`)·타입(`chat-channel/types.ts`)·spec(`14-external-interaction-api.md`)
전문을 직접 대조했다. 이 작업은 이미 3라운드(`09_58_24`→`10_18_38`→현재)에 걸쳐 다수의 code-review /
consistency-check 서브에이전트가 검토했고 RESOLUTION.md 두 건이 CRITICAL 1건(int4 클램프)·WARNING
다수를 조치 완료로 기록해 두었다. 이번 라운드는 (a) 그 조치들이 실제 소스에 반영됐는지 직접 재확인하고
(b) 이전 라운드가 놓친 새 결함이 있는지를 중심으로 봤다.

## 발견사항

- **[WARNING]** `retry-turn.service.ts` 의 CANCELLED 재진입(멱등) 분기에서, **DB 에 실제로 영속되는
  `durationMs` 값과 WS/webhook 으로 emit 되는 `durationMs` 값이 어긋날 수 있다** — 이 PR 이 세운
  "DB 와 wire 가 같은 값을 쓴다" 불변식(CHANGELOG, spec §6.5, `terminal-duration.ts` JSDoc 전반의
  설계 근거)을 이 경로만 어긴다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
    - `finalizeGuarded` 의 `live.status === target` 멱등 분기, `target === ExecutionStatus.CANCELLED`
      서브분기 — SQL `COALESCE(finished_at, :newFinishedAt)` / `COALESCE(duration_ms, :newDurationMs)`
      (파일 함수 `finalizeGuarded` 내부, `.set({...})` 블록. `execution.status = live.status;` 대입부
      바로 아래 `if (target === ExecutionStatus.CANCELLED)` 분기)
    - `failRetryExecution` — `execution.finishedAt = new Date();` / `execution.durationMs = resolveTerminalDurationMs(execution) ?? execution.durationMs;` 대입 직후 `finalizeGuarded` 호출, 그 다음 `emitExecution(..., { status: finalStatus, durationMs: resolveTerminalDurationMs(execution), ... })`
  - 상세: 이 분기는 문서화된 시나리오를 그대로 겨냥한다 — 사용자가 `stop()` 을 눌러 DB 가 **T1**
    시각으로 이미 `CANCELLED`(`finishedAt`/`durationMs` 포함)를 커밋했는데, retry-turn 의 AI 턴
    처리는 다음 turn 경계(`assertExecutionNotCancelled`)에서야 취소를 감지해 `ExecutionCancelledError`
    를 던진다. `failRetryExecution` 이 이 예외를 받으면:
    1. `execution.finishedAt = new Date()` 로 **T2**(재진입 catch 시각, T1 보다 늦음)를 대입한다.
    2. `execution.durationMs = resolveTerminalDurationMs(execution) ?? execution.durationMs` —
       이 시점 `execution` 은 `applyRetryLastTurn` 시작 시 로드된 **stale 객체**(그 이후 갱신되지
       않음, 파일 자체 JSDoc: *"이 서비스의 `execution` 은 재진입 시작 시점에 로드된 뒤 갱신되지
       않는다"*)라 `execution.durationMs` 는 아직 `null`/`undefined` 다. 따라서
       `resolveTerminalDurationMs` 는 `startedAt` ~ **T2**(방금 대입한 값)로 새로 계산한 값을
       반환한다 — 이는 T1 이후로도 흐른 시간까지 포함해 **DB 의 실제 취소 시각(T1) 기준 값보다
       크다.**
    3. `finalizeGuarded` 가 호출되면 `live.status`(fresh SELECT) 가 이미 `CANCELLED===target` 이므로
       COALESCE 분기로 들어간다. `duration_ms` 컬럼이 이미 NOT NULL(T1 값)이므로
       `COALESCE(duration_ms, :newDurationMs)` 는 **T1 값을 그대로 보존**하고 `:newDurationMs`(T2
       계산값)를 버린다 — 정확히 파일 자신의 §2.3 계약("`stop()` 이 쓴 `finishedAt`/`durationMs`
       가 보존된다")대로 동작한다. `finalizeGuarded` 는 이 UPDATE 에 `.returning(...)` 이 없고
       반환값은 `boolean` 뿐이라, 실제로 DB 에 남은 값(T1)을 in-memory `execution` 객체로 되읽지
       않는다.
    4. `failRetryExecution` 은 `finalizeGuarded` 가 `true` 를 반환하면 곧바로
       `emitExecution(..., { durationMs: resolveTerminalDurationMs(execution), ... })` 를 호출한다.
       이때 `execution.durationMs` 는 **여전히 2번에서 계산한 T2 값**이다(3번에서 `execution`
       객체가 갱신된 적 없음) — 즉 **DB 에는 T1 값이 영속됐는데 WS/webhook 구독자에게는 T2(더 큰)
       값이 나간다.**
    - 이 시나리오는 희귀한 레이스가 아니라 **"retry-turn AI 처리 중 사용자가 Stop 을 누른다"** 는
      일반적인 흐름에서 결정적으로 발생한다(취소 감지가 다음 turn 경계까지 지연되는 것이 이 코드의
      설계 자체). `finalizeGuarded` 의 COALESCE 로 DB 값을 보호하도록 만든 것도 바로 이 시나리오를
      겨냥한 의도적 설계다(`review/code/2026/07/27/23_46_36/RESOLUTION.md` Critical #1 참조) — 다만
      그 설계가 세워진 시점엔 `durationMs` 가 emit payload 에 없었으므로 wire 유출 문제가 없었다.
      이번 PR 이 `durationMs` 를 emit 에 추가하면서 **처음으로 이 divergence 가 외부에 노출**된다.
    - 직전 라운드(`review/code/2026/08/15/10_18_38/testing.md:39`)가 이 정확한 코드 구간
      (`retry-turn.service.ts:642-648`)을 검토했으나 "기존 idempotent-guard 패턴이고
      `execution.durationMs`(이미 헬퍼로 계산된 JS 값)를 그대로 실어 보내므로 헬퍼 테스트가 간접
      커버 — 별도 조치 불요" 로 결론지었다. 그 검토는 **계산 로직 자체의 커버리지**(음수/NaN 가드)
      만 확인했을 뿐, **COALESCE 가 그 JS 값을 실제로 버릴 수 있다는 점**(그리고 emit 은 그 사실을
      모른 채 버려진 값을 그대로 내보낸다는 점)은 짚지 않았다.
    - 테스트 확인: `retry-turn.service.spec.ts:1234-1296`("CANCELLED 멱등 분기") 는 SQL 이
      `COALESCE(...)` 형태인지·`error` 가 SET 절에서 빠졌는지·이벤트가 발행되는지만 단언하고,
      **emit 된 `durationMs` 의 실제 값**은 검사하지 않는다(mock 의 `execute()` 가 `{ affected: 1 }`
      만 반환 — `raw`/RETURNING 없음). 직접 `npx jest retry-turn.service.spec.ts` 실행 결과 43/43
      통과 — 즉 이 divergence 는 현재 테스트로 검출되지 않는다.
  - 제안: `finalizeGuarded` 의 CANCELLED-COALESCE 분기에 `.returning(['finished_at', 'duration_ms'])`
    를 추가해 실제 persist 된 값을 되읽고, `failRetryExecution` 이 emit 하기 전에 `execution.durationMs`
    (및 `finishedAt`)를 그 반환값으로 갱신하도록 한다. 또는 `finalizeGuarded` 가 `boolean` 대신
    `{ persisted: boolean; finishedAt?: Date; durationMs?: number | null }` 를 반환해 호출부가
    "실제로 DB 에 쓰인 값"으로 emit 하도록 계약을 바꾼다. 회귀 테스트는 "DB 에 이미 T1 값이 있는
    상태에서 T2 로 재진입 → emit 된 `durationMs` 가 T1 기준 값과 일치"를 mock 의 `raw`/RETURNING 을
    채워 단언해야 한다(현재처럼 SQL 문자열 형태만 검사하면 이 클래스의 회귀를 못 잡는다).

- **[INFO]** (재확인, 이미 조치됨) `driveCallStackResume` 완료 경로 — 직전 라운드
  (`review/code/2026/08/15/10_18_38/side_effect.md` W1, `RESOLUTION.md` "W1 — 내 '전수 grep' 이
  불완전했다")가 이 함수만 `resolveTerminalDurationMs` 를 거치지 않은 원시 뺄셈으로 남아 있다고
  지적했다. 커밋 `6bedc7e3c` 로 조치됐음을 직접 `Read` 로 재확인했다 —
  `execution-engine.service.ts:2576-2577` 이 현재
  `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;`
  이고, 파일 전체에서 `getTime()` 기반 원시 durationMs 계산은 더 이상 남아 있지 않다
  (`grep -n "getTime()"` 결과 durationMs 와 무관한 1곳(`2958`, 큐 대기 시간 메트릭)뿐).

- **[INFO]** 16개 종결 emit 지점(completed 6·failed 4·cancelled 6) 전수를 `grep`/`Read` 로 직접
  대조한 결과, **전부** `durationMs` 를 payload 에 싣는다 — 함수 완전성 관점에서 누락 없음.
  - `execution-engine.service.ts`: `EXECUTION_COMPLETED` 4곳(`:2421,2590,3572,4764`) 전부
    `durationMs: resolveTerminalDurationMs(...)`; `EXECUTION_FAILED` 3곳(`:668,3397,4965`) 전부 포함;
    `emitCancellationEvent(...)` 호출 5곳(`:1078,1209,2859-2863,2908-2912,4886`) 전부
    `durationMs` 를 넘긴다.
  - `retry-turn.service.ts`: `completeRetryExecution`(`:730`)·`resumeGraphAfterRetry`(`:907`) 2곳
    completed, `failRetryExecution`(`:971`) 1곳(failed/cancelled 겸용) 전부 포함.

- **[INFO]** 엣지 케이스 처리(`resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL`)는
  실측(`npx jest terminal-duration.spec.ts` 25/25 통과)으로 확인했다: 이미 계산된 값 재사용(재계산
  방지로 DB-wire 값을 일치시키려는 의도, 위 발견사항과 대비되는 지점), `startedAt`/`finishedAt`
  각각·둘 다 부재 시 `null`(throw 안 함 — 이 PR 의 동기가 된 실제 회귀 재현), non-`Date` 값·
  `Invalid Date`·시계 역행(음수)·`NaN`/`Infinity` 전부 `null`, `durationMs === 0` 을 falsy 로 버리지
  않음(`??` 사용 확인). SQL 쪽은 `LEAST(2147483647, …)` int4 클램프(직전 라운드 CRITICAL 조치, 실제
  소스에 반영 확인)와 음수 → `NULL`(sentinel 일관성) 둘 다 소스에 존재.

- **[INFO]** spec 정합성(`spec/5-system/14-external-interaction-api.md` §6/§6.5) — 필드 집합 표(:575)와
  §6.5(:801-814)가 구현과 line-level 로 일치한다: `durationMs` 3종 전부·`null` 부재 표현·5경로
  raw UPDATE+RETURNING·`markQueueWaitTimeout` 이 "큐 대기 시간"이라는 의미 caveat 모두 실제 코드
  주석(`execution-engine.service.ts` `markQueueWaitTimeout` 내부 주석)과 대응한다. `chat-channel/types.ts`
  의 `durationMs?: number | null` (3개 인터페이스) 도 §6 표의 "구현됨 + null 가능" 서술과 일치.

- **[INFO]** (기존 추적, 재발 아님) `result.cancelledBy` 가 `retry-turn.service.ts` `failRetryExecution`
  의 CANCELLED emit 에 여전히 없다 — spec 표(`14-external-interaction-api.md:573`)가 스스로 "경로
  1곳 누락"으로 명시해 둔 **pre-existing** 갭이고 `plan/in-progress/retry-turn-terminal-guard.md` 에
  별도 추적 중이다. 이번 PR 의 diff(`durationMs` 추가)와 무관해 새 CRITICAL 로 세우지 않는다.
  REST `GET /api/external/executions/:id` 의 `durationMs` 부재(push-vs-pull 비대칭)도 동일하게
  `spec-sync-external-interaction-api-gaps.md` 에 이미 등재돼 있어 중복 보고하지 않는다.

## 요약

핵심 기능("종결 이벤트 3종 전부에 `durationMs` 를 싣는다")은 16개 emit 지점 전수에 걸쳐 완전히
구현됐고, 이전 라운드가 지적한 int4 오버플로 CRITICAL·`driveCallStackResume` 누락·타입 캐스팅
불일치는 소스 재확인 결과 모두 조치가 실제로 반영돼 있다. 다만 이번 라운드에서 새로 확인한 문제로,
`retry-turn.service.ts` 의 CANCELLED 재진입(멱등) 분기는 `finalizeGuarded` 가 SQL `COALESCE` 로
DB 값(사용자가 실제 Stop 을 누른 시각 기준 `durationMs`)을 올바르게 보존하면서도, 그 보존된 실제
값을 in-memory 로 되읽지 않아 **emit 되는 `durationMs` 는 여전히 이번 재진입 시도의(더 큰) 계산값을
낸다** — "DB 와 wire 가 같은 값을 쓴다"는 이 PR 이 다른 5경로에서 명시적으로 세운 불변식을 이 경로만
어기며, 이는 희귀한 레이스가 아니라 "retry-turn 처리 중 Stop" 이라는 일반적인 흐름에서 결정적으로
재현된다. 기존 테스트는 SQL 형태(COALESCE 문자열)만 단언하고 emit 값을 검사하지 않아 이 클래스의
회귀를 잡지 못한다.

## 위험도

MEDIUM
