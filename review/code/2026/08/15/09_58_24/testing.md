# 테스트(Testing) 리뷰 — EIA 종결 payload `durationMs`

## 발견사항

- **[WARNING]** `markWebChatIdleTimeout` — 새로 추가된 `durationMs` 추출 로직(`result.raw[0].duration_ms` → `toFiniteNumber`)이 emit 단언에서 전혀 검증되지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:2978`(`makeIdleQb` — `execute` mock 이 `raw` 필드 자체를 주지 않음) 및 `:3054-3061`(emit 단언이 `expect.objectContaining({...})` 이고 `durationMs` 키가 목록에 없음)
  - 구현측: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1150`(`markWebChatIdleTimeout`), `durationMs` 계산·전달은 `:1160-1184`, `:1208`
  - 상세: `makeIdleQb`(`affected` 만 받아 `{ affected }` 를 resolve)는 `raw` 를 아예 세팅하지 않으므로 `result.raw` 는 `undefined` → `toFiniteNumber(undefined)` → `null` → `cancelledDurationMs = null` 로 항상 떨어진다. 그런데 emit 단언(`:3054`)이 `objectContaining` 이라 `durationMs` 키 존재 여부·값 어느 쪽도 검사하지 않는다. 결과적으로 이 PR 이 추가한 "raw UPDATE 의 RETURNING 값을 emit 에 싣는다" 는 계약이 이 경로에서는 **null-폴백 분기도, 추출 성공 분기도 둘 다 미검증**이다. `.returning(['id', 'duration_ms'])` 호출을 실수로 빼거나 `duration_ms` 철자를 틀려도 이 테스트는 그대로 GREEN 이다.
  - 대조: 같은 파일의 자매 경로 `cancelParkedExecution`(`:3207-3213`)은 정확히 이 분기(`raw` 없음 → `durationMs: null`)를 **정확 매칭**으로 고정해 두었다 — 같은 원칙을 `markWebChatIdleTimeout` 에는 적용하지 않은 누락으로 보인다.
  - 제안: `makeIdleQb` 에 `raw: [{ duration_ms: N }]` 옵션을 추가해 (a) 추출 성공 시 정확한 숫자가 emit 되는 케이스, (b) `raw` 미제공(또는 빈 배열) 시 `durationMs: null` 이 정확히 나가는 케이스 둘 다 `cancelParkedExecution`/`finalizeStalledExhausted` 처럼 정확 매칭으로 추가할 것.

- **[WARNING]** `markQueueWaitTimeout` — 동일한 갭. `mkQb` 의 `execute` mock 이 `raw: []` 로 항상 빈 배열을 주는데 emit 단언에 `durationMs` 검사가 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4372-4380`(`mkQb`), `:4526-4550`(`'큰 대기 5분 초과 → cancelled...'` 테스트, `objectContaining` 에 `durationMs` 부재)
  - 구현측: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2885`(`markQueueWaitTimeout`), `durationMs` 계산 `:2909-2913`
  - 상세: `markWebChatIdleTimeout` 과 동형의 문제 — `raw: []` 이므로 `duration_ms` 추출은 항상 폴백(`null`) 경로만 타지만, 그 값을 아무도 단언하지 않아 "폴백이 실제로 null 을 내보내는지" 조차 검증되지 않는다. 이 경로는 큐 대기시간을 `durationMs` 로 의미를 재정의한 경로(구현 주석 참고)라 특히 값 검증이 중요하다.
  - 제안: 위와 동일 — 양쪽 분기(추출 성공/폴백)를 정확 매칭으로 추가.

- **[INFO]** `markExecutionCancelled` — mock 은 `duration_ms: 1234` 라는 non-null 값을 이미 주는데, 이를 사용하는 유일한 emit 단언이 여전히 `objectContaining` 으로 `durationMs` 를 걸러낸다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:14777-14801`(`buildUpdateChain` — `raw: [{ duration_ms: 1234 }]`), `:14984-14993`(RESUME_INCOMPATIBLE_STATE emit 단언, `durationMs` 미검사)
  - 구현측: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2809`(`markExecutionCancelled`), `:2860-2864`
  - 상세: 전체 스펙 파일을 `grep -n "durationMs"` 로 훑어도 `markExecutionCancelled` 경로에 대한 `durationMs` 값 단언이 단 한 건도 없다. 다른 두 항목보다 비용이 낮다(이미 `1234` 라는 값이 mock 에 있으므로 `durationMs: 1234` 한 줄만 단언에 추가하면 됨)는 점에서 INFO 로 낮췄지만, `finalizeStalledExhausted`(`:4827`)가 같은 형태를 이미 정확 매칭으로 고정해 둔 전례가 있어 누락이 뚜렷하다.
  - 제안: `:14987-14992` 의 `objectContaining` 에 `durationMs: 1234` 를 추가.

- **[WARNING]** `TERMINAL_DURATION_MS_SQL` (raw SQL 식)이 실제 Postgres 에 대해 한 번도 실행·검증되지 않는다 — 단위 테스트는 문자열 포함(`toContain`) 검사뿐이고, 이 SQL 을 실제로 타는 유일한 e2e(`webchat-idle-reaper.e2e-spec.ts`)는 `duration_ms` 를 SELECT 도 assert 도 하지 않는다.
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.spec.ts:97-107`(`describe('TERMINAL_DURATION_MS_SQL')` — `toContain('GREATEST(0'`/`'started_at'`/파라미터명 뿐, 실제 실행 없음)
  - e2e 갭: `codebase/backend/test/webchat-idle-reaper.e2e-spec.ts:86-94`(`getExecution` 헬퍼가 `SELECT status, error` 만— `duration_ms` 미포함), `:118-119`(assert 도 `status`/`error.code` 만)
  - 구현측: `codebase/backend/src/shared/utils/terminal-duration.ts:75-76`(`GREATEST(0, (EXTRACT(EPOCH FROM (:terminalFinishedAt::timestamptz - started_at)) * 1000)::bigint)::int`)
  - 상세: `EXTRACT(EPOCH FROM ...)`, `::timestamptz` 캐스팅, `.setParameter` 바인딩 이름 일치 같은 것들은 실제 DB 엔진에서만 검증 가능한 문법·타입 문제다. 이 SQL 이 문법 오류를 내면(예: 파라미터 오타, 괄호 불일치) `markWebChatIdleTimeout`/`cancelParkedExecution`/`markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted` 5개 raw-UPDATE 경로 전부가 런타임에서만 실패한다. `webchat-idle-reaper.e2e-spec.ts` 가 이 SQL 을 실제로 태우긴 하지만(폴링 성공 여부로 "던지지 않았다" 정도는 간접 보증), `duration_ms` 컬럼 값 자체는 한 번도 실측되지 않는다 — 부호 오류·단위 오류(초 vs 밀리초)·`GREATEST(0,…)` 클램프가 실제로 동작하는지는 어떤 테스트로도 못 잡는다.
  - 제안: 최소 한 곳의 e2e(`webchat-idle-reaper.e2e-spec.ts` 또는 `execution-park-resume.e2e-spec.ts`)에서 `duration_ms` 컬럼을 SELECT 해 `expect(duration_ms).toBeGreaterThanOrEqual(0)` 정도의 sanity 단언을 추가할 것. 값의 정밀도보다 "SQL 이 실제로 유효한 정수를 만든다" 는 것만 확인해도 이 갭은 대부분 닫힌다.

- **[INFO]** `resolveTerminalDurationMs` 의 "이미 계산된 값 신뢰" 분기가 음수 가드를 우회한다 — 테스트되지 않은 비대칭.
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:33-35`(첫 분기 — `Number.isFinite` 만 확인하고 그대로 반환) vs `:41`(재계산 분기 — `span >= 0 ? span : null` 음수 가드)
  - 테스트: `codebase/backend/src/shared/utils/terminal-duration.spec.ts:12-17`(`'이미 계산된 durationMs 를 그대로 쓴다'` — `999` 양수만 사용)
  - 상세: `row.durationMs` 가 이미 유한수로 세팅돼 있으면(예: 상위 호출부가 이미 계산해 넣어둔 값) 그 값을 그대로 반환하는데, 이 분기는 `span >= 0` 가드를 거치지 않는다. 즉 `resolveTerminalDurationMs({ durationMs: -5, ... })` 를 호출하면 `-5` 가 그대로 나간다 — "시계 역행은 null" 이라는 주석의 불변식이 이 분기에는 적용되지 않는다. 현재 호출부들은 대부분 `savedExecution.durationMs` 가 아직 `undefined` 인 시점에 호출하므로 실무 도달 가능성은 낮아 보이나(설계 의도상 "이미 검증된 값은 재계산하지 않는다"), 이 비대칭 자체를 명시하는 테스트가 없다.
  - 제안: `it('이미 세팅된 durationMs 가 음수여도 그대로 반환한다(가드 미적용, 설계 의도)')` 류의 캐너리 테스트를 추가해 이 분기의 의도된 동작을 문서화·고정할 것. (버그로 보고 고치라는 뜻이 아니라, 의도라면 의도를 테스트로 박아 두라는 것.)

- **[INFO]** `retry-turn.service.ts:947-948` (`failRetryExecution`) 의 `execution.durationMs = execution.finishedAt.getTime() - execution.startedAt.getTime();` 는 이 PR 이 다른 4개 완료 경로(`driveResumeAwaited`/`driveStuckRedrive`/`runExecution`/`resumeGraphAfterRetry`)에 적용한 "`resolveTerminalDurationMs` 로 계산해 throw 를 흡수한다" 패턴을 적용받지 않은 채 남아 있다(diff 에 포함되지 않은 기존 줄).
  - 상세: `execution` 이 이 지점에서 항상 완전 로드된 엔티티라 `startedAt` 미존재 위험은 낮아 보이지만, 이 PR 의 핵심 동기(부분 select·fixture 에서 `startedAt` 이 없을 수 있다)가 정확히 이 파일의 다른 경로(`:889-896`)에서는 이미 수정됐는데 이 자리만 원본 그대로다. 새 회귀 테스트를 요구할 만큼 diff 범위 안은 아니라 INFO 로 낮춘다.
  - 제안: 후속 PR 에서 일관성 차원으로 `resolveTerminalDurationMs` 적용 검토.

## 잘 된 점 (참고)

- `terminal-duration.spec.ts` 는 순수 함수 단위 테스트로 매우 촘촘하다 — `NaN`/`Infinity`/음수(시계 역행)/`Date` 아닌 값/`Invalid Date`/`0`(falsy 방어) 등 경계값을 전부 다루고, 각 케이스에 "왜"(회귀 배경)를 주석으로 남겨 의도가 명확하다.
- `cancelParkedExecution`(`execution-engine.service.spec.ts:3207-3213`)과 `finalizeStalledExhausted`(`:4738-4827`)는 `objectContaining` 대신 정확 매칭으로 `durationMs: null` / `durationMs: 4242` 를 각각 고정해, 위에서 지적한 두 경로(`markWebChatIdleTimeout`/`markQueueWaitTimeout`)가 놓친 정밀도의 올바른 선례를 보여준다.
- `toFiniteNumber` 테스트가 pg 드라이버의 실제 관측 형태(bigint/numeric → 문자열)를 `it.each` 로 정확히 반영한다 — mock 이 실제 동작과 괴리되지 않았다.

## 요약

새로 추출된 `resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL` 헬퍼 자체는 순수 함수 레벨에서 경계값을 꼼꼼히 커버하는 양질의 테스트를 갖췄고, `cancelParkedExecution`·`finalizeStalledExhausted` 두 raw-UPDATE 경로는 정확 매칭으로 `durationMs` 전달을 제대로 고정했다. 다만 같은 패턴을 쓰는 나머지 세 raw-UPDATE 경로(`markWebChatIdleTimeout`, `markQueueWaitTimeout`, `markExecutionCancelled`)는 mock 이 `raw`/`duration_ms` 를 아예 안 주거나 준비해 두고도 emit 단언이 `objectContaining` 이라 이 PR 의 핵심 신규 로직(추출·폴백)이 사실상 미검증 상태다. 또한 raw SQL 식은 실제 DB 에 대해 값 수준으로 한 번도 검증되지 않아, 구현이 맞더라도 SQL 문법·부호·단위 오류를 잡을 안전망이 약하다. CRITICAL 급 결함은 발견되지 않았다.

## 위험도

MEDIUM
