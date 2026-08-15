STATUS=success

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 방법론 노트

프롬프트 번들에서 파일 3(`execution-engine.service.spec.ts`)·파일 4(`execution-engine.service.ts`)는 크기 제한으로 diff 가 생략돼 있었다. `git diff origin/main -- <path>` 로 두 파일의 실제 diff 전문을 직접 열어 대조했고, 의문이 남은 지점(어떤 emit 경로가 실제로 `durationMs` 값을 단언하는지)은 `Read`/`grep` 으로 스펙 파일을 직접 열어 각 `describe`/`it` 블록의 mock 설정과 assertion 을 대조했다. 아래 위치 표기는 프롬프트 게이트 숫자가 아니라 이렇게 직접 확인한 **원본 파일의 실제 줄 번호**다.

## 발견사항

- **[WARNING]** raw UPDATE 5경로 중 4곳은 `RETURNING duration_ms` **실값**이 emit payload 로 정확히 threading 되는지 검증하는 테스트가 없다 — `null`/기본값 경로만 커버됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:2978-2986`(`makeIdleQb` — `execute` 가 `raw` 필드 자체를 반환하지 않음), `:3160-3167`(`makeCancelQb` 동일), `:3207-3213`(`cancelParkedExecution` 테스트가 `durationMs: null` 만 단언)
  - 상세: `resolveTerminalDurationMs`/`toFiniteNumber` 헬퍼(`terminal-duration.spec.ts`) 자체는 잘 테스트돼 있지만, 이 헬퍼를 **호출하는 지점**(엔티티 미로드 5경로: `cancelParkedExecution`·`markWebChatIdleTimeout`·`markQueueWaitTimeout`·`markExecutionCancelled`·`finalizeStalledExhausted`)에서 "SQL 이 실제로 계산한 `duration_ms` 값이 `RETURNING` → `toFiniteNumber` → emit payload 까지 깨지지 않고 흐르는지"는 `finalizeStalledExhausted` 단 1곳(`execution-engine.service.spec.ts:4741-4744` `raw: [{ id: 'exec-stalled', duration_ms: 4242 }]`, `:4822-4828` `durationMs: 4242` 단언)만 검증한다. 나머지 4곳은 mock 의 `execute()` 가 `{ affected }` 만 반환하고 `raw` 필드 자체가 없어 `result.raw?.[0]?.duration_ms` 가 항상 `undefined` → `toFiniteNumber` 가 항상 `null` 을 반환하는 경로만 실행된다. `markExecutionCancelled` 는 `Rehydration` describe 의 공용 `buildUpdateChain`(`:14784-14786`, `raw: [{ duration_ms: 1234 }]`)을 통해 실값이 실제로 흐르는 경로를 우연히 실행하지만(`:14915-14994` "RESUME_INCOMPATIBLE_STATE" 테스트), 정작 emit 단언(`:14984-14993`)은 `expect.objectContaining({ result, error })` 뿐이라 `durationMs` 필드를 아예 검사하지 않는다 — 값이 맞는지 틀린지 증명하지 못한다.
  - 제안: 4곳 각각에 `execute` mock 이 `{ affected: 1, raw: [{ duration_ms: <숫자> }] }` 를 반환하는 경우를 추가하고, emit 단언에 `durationMs: <해당 숫자>` 를 정확히 넣는다. `markExecutionCancelled` 는 기존 `:14984-14993` 단언에 `durationMs: 1234` 한 줄만 추가하면 된다(이미 mock 은 준비돼 있다).

- **[WARNING]** `markQueueWaitTimeout`·`failFirstSegmentSetup` 은 실제 구현 본문이 **한 번도 직접 실행되지 않는다** — 항상 `jest.spyOn(...).mockResolvedValue(...)` 로 대체됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:1750-1758`(`markQueueWaitTimeout` — "격리 스텁" 주석), `:4371-4379`(`describe('admitExecutionOrDefer / markQueueWaitTimeout ...')` 지만 실제로는 `admitExecutionOrDefer` 만 직접 호출), `:3800-3802`·`:3828-3830`(`failFirstSegmentSetup` 항상 spy)
  - 상세: 두 함수 모두 이번 PR 이 새 `durationMs` 계산/SQL/`RETURNING` 배관을 추가한 자리다(`execution-engine.service.ts:2885`(`markQueueWaitTimeout`), `:623`(`failFirstSegmentSetup`)). `grep "\.failFirstSegmentSetup("`·`"markQueueWaitTimeout("` 를 spec 파일 전체에 걸어도 실제 호출은 프로덕션 코드 내부(`:2961`, `:3283`, `:695`)뿐이고, 테스트 쪽은 전부 spy 로 가로챈다. 즉 이 두 경로의 신규 `durationMs` 로직은 유닛 레벨에서 완전히 미검증 상태다.
  - 제안: `markWebChatIdleTimeout`(private 이지만 `service as unknown as {...}` 캐스팅으로 직접 호출)과 동일한 패턴으로 두 함수를 직접 호출하는 테스트를 최소 1개씩 추가하고 emit payload 의 `durationMs` 를 단언한다.

- **[WARNING]** `TERMINAL_DURATION_MS_SQL` 자체가 실제 Postgres 값 수준으로 검증된 적이 없다 — 유일한 e2e 통과 경로도 `duration_ms` 를 assert 하지 않음
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.spec.ts:110-133`(`describe('TERMINAL_DURATION_MS_SQL')` — 전부 `toContain()` 문자열 검사뿐, 실제 SQL 실행 없음), `codebase/backend/test/webchat-idle-reaper.e2e-spec.ts`(이 SQL 을 유일하게 태우는 e2e 인데 `duration_ms`/`durationMs` 문자열이 파일 전체에 0건)
  - 상세: `LEAST(2147483647, ...)` 클램프·`CASE WHEN ... THEN NULL`(음수 sentinel) 은 이번 PR 이 실제로 겪은 CRITICAL 회귀(`RESOLUTION.md` "🔴 CRITICAL — 내 SQL 이 오래 대기한 실행을 영구 고착시킬 수 있었다")를 고친 자리인데, 그 SQL 문법이 실제 Postgres 엔진에서 파싱·실행돼 올바른 숫자를 내는지 검증하는 테스트는 이 저장소 어디에도 없다. `toContain('LEAST(2147483647')` 는 문자열이 우연히 깨져도(예: 괄호 짝 오류, `::int` 캐스팅 위치 오류) 통과한다. 저자 스스로 `RESOLUTION.md` "W10" 에서 이 사실을 인정했고 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:183-188` 에 후속 항목(`e2e 에 duration_ms >= 0 sanity 단언 추가`)으로 등재했지만 **아직 미체크(`- [ ]`) 상태**이며 이번 PR 에는 반영되지 않았다.
  - 제안: 이미 트래커에 등재돼 있으므로 이번 라운드에서 조치를 강제하지는 않되, 이 SQL 이 방금 하나의 CRITICAL 버그를 냈다는 점을 감안하면 우선순위를 낮게 두지 말 것을 권고한다.

- **[WARNING]** "노드 0개 그래프 → completed emit 시 `durationMs` 가 `undefined` 로 나갈 수 있다" 회귀를 막으려고 계산을 `if (lastNodeId)` 블록 밖으로 옮겼는데, 그 정확한 시나리오를 실제 코드 경로로 검증하는 테스트가 없다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2404-2412`(조건 밖으로 이동한 지점 중 하나, 나머지 3곳도 동형), `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:3505-3537`(`mockNodeRepo.findBy.mockResolvedValue([])` 을 쓰는 유일한 describe 지만 `runExecution` 자체를 `jest.spyOn(...).mockImplementation` 으로 완전히 대체해 실제 계산 로직을 우회함), `:7055-7067`(`should emit EXECUTION_COMPLETED event` 테스트는 기본 노드 fixture 를 쓰며 0-node 그래프가 아님)
  - 상세: `plan/in-progress/eia-terminal-payload.md` "재판정 ④ § ⚠️ completed 4곳의 `undefined` 함정" 이 스스로 "실무상 도달이 어렵지만... 방어를 빼면 나중에 그 자리에서 터진다" 고 명시한 시나리오다. 즉 저자도 이 경로의 위험을 인지하고 방어 코드(조건 밖 이동)를 넣었지만, 그 방어가 실제로 동작하는지 — 노드 0개 그래프가 `runExecution` 을 실제로 통과해 `completed` 이벤트에 `durationMs: <number>` (not `undefined`) 를 싣는지 — 를 고정하는 캐너리 테스트는 추가되지 않았다.
  - 제안: `mockNodeRepo.findBy.mockResolvedValue([])` + `mockEdgeRepo.findBy.mockResolvedValue([])` 상태에서 `service.execute(...)` 를 실제로 실행하고 `EXECUTION_COMPLETED` emit payload 의 `durationMs` 가 `expect.any(Number)` 인지(그리고 `toBeUndefined()` 가 아닌지) 단언하는 테스트를 4개 completed 경로 중 최소 1곳에 추가할 것.

- **[INFO]** 신규 헬퍼(`resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL`) 자체의 유닛 커버리지는 모범적이다
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.spec.ts` 전체
  - 상세: 이미 계산된 값 보존(재계산 방지), `startedAt`/`finishedAt` 각각 부재·둘 다 부재·`null`(4가지 `it.each`), non-`Date` 값 흡수, `Invalid Date`, 시계 역행(음수) → `null`, `NaN`/`Infinity` → 계산 폴백, `0` 을 falsy 로 버리지 않음(`??` vs `||` 회귀 방지 명시), pg 드라이버의 문자열 bigint/numeric 파싱(`toFiniteNumber`) 까지 촘촘하다. 특히 "이 PR 이 실제로 겪은 회귀"(`:29-30` 주석 — 조건 밖 계산이 throw 해 종결 emit 자체가 사라진 사고)를 재현하는 `it.each` 케이스(`:31-39`)는 회귀 테스트로서 정확히 필요한 지점을 찌른다.
  - 제안: 없음 — 이 파일은 위 발견사항들의 "헬퍼 레벨은 이미 잘 돼 있는데 호출부 레벨에서 실값 threading 이 빠졌다"는 정확히 대칭적인 반례로 인용할 만하다.

- **[INFO]** `retry-turn.service.spec.ts` 의 `durationMs` 단언은 completed(2곳)·cancelled(1곳)·failed-일반(1곳) 을 `expect.any(Number)` 로 적절히 커버한다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:691, 727, 858, 894`
  - 상세: `retry-turn.service.ts` 의 raw-UPDATE(`COALESCE`) 경로(`:642-648`)는 이번 PR 이 새로 추가한 게 아니라 기존 idempotent-guard 패턴이며 `execution.durationMs`(이미 헬퍼로 계산된 JS 값)를 그대로 실어 보내므로 위 헬퍼 테스트가 간접적으로 커버한다 — 별도 조치 불요.

## 요약

신규 헬퍼(`resolveTerminalDurationMs`/`toFiniteNumber`/`terminal-duration.spec.ts`) 자체의 단위 테스트는 null-sentinel·시계 역행·NaN/Infinity·pg 드라이버 문자열 파싱까지 엣지 케이스를 촘촘히 고정해 모범적이다. 그러나 이 헬퍼를 **호출하는 지점**, 특히 엔티티를 로드하지 않는 raw UPDATE 5경로(park 취소·위젯 idle 취소·큐 대기 타임아웃·재개 실패 취소·stalled 소진)에서 "`RETURNING duration_ms` 실값이 `toFiniteNumber` 를 거쳐 emit payload 까지 깨지지 않고 흐르는지" 를 검증하는 테스트는 5곳 중 1곳(`finalizeStalledExhausted`)뿐이다. 나머지 4곳은 mock 이 `raw` 를 아예 비워 항상 `null` 경로만 실행하거나(2곳), 실값이 흐르는 mock 은 있지만 emit 단언이 `durationMs` 필드를 검사하지 않는다(1곳, `markExecutionCancelled`). `markQueueWaitTimeout`·`failFirstSegmentSetup` 두 함수는 실제 구현 본문이 유닛 테스트에서 한 번도 직접 실행되지 않고 항상 spy 로 대체된다. 이 SQL(`TERMINAL_DURATION_MS_SQL`)은 이번 PR 이 실제로 CRITICAL 정수 오버플로 버그를 냈던 바로 그 자리인데도, 값 수준(Postgres 실행 결과)을 검증하는 테스트가 아직 없다(자체 인지·트래커 등재는 돼 있으나 미해결). 마지막으로 "노드 0개 그래프의 completed emit 에서 `durationMs` 가 `undefined` 로 새는" 회귀를 막으려 계산을 조건문 밖으로 옮겼다는 방어 코드가, 정작 그 시나리오를 실제 실행 경로로 고정하는 캐너리 테스트 없이 남아 있다. 이들은 모두 확정된 버그가 아니라 커버리지 갭이지만, 같은 클래스의 코드(엔티티 미로드 raw UPDATE 종결 경로)가 이미 이번 PR 안에서 한 번 CRITICAL 버그를 낸 이력을 고려하면 가볍게 볼 갭은 아니다.

## 위험도

MEDIUM
