# 테스트(Testing) 코드 리뷰

## 검토 방법

`chat-channel.dispatcher.ts` / `execution-engine.service.ts` / `executions.service.ts` 및 대응하는
3개 `.spec.ts` 를 `Read` 로 전문 대조했고, 신규·회귀 테스트는 실제로 실행해 확인했다
(`chat-channel.dispatcher.spec.ts` + `executions.service.spec.ts` = 66 passed,
`execution-engine.service.spec.ts` 전체 = 441 passed). 파일 6·7(`plan/in-progress/*.md`)은
체크리스트/서술 갱신이라 테스트 대상 코드가 아니다. 파일 8 이후(`review/code/14_01_46/**`,
`review/consistency/14_18_42/**`, `review/consistency/17_05_10/**`)는 이전 라운드의 리뷰 산출물이
그대로 신규 파일로 커밋된 것으로, 코드가 아니라 감사 기록이라 테스트 관점 평가 대상이 아니다.

## 발견사항

- **[WARNING]** `execution-engine.service.ts` 의 신규 `Array.isArray(rows)` 가드가 **throw** 하는
  경로의 호출부(`runExecutionFromQueue`) 레벨 영향이 어떤 테스트로도 검증되지 않는다 —
  구조적으로 대칭인 형제 시나리오(`runExecution` 이 reject)는 명시적으로 테스트되는데, 이쪽만
  비어 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3659`
    (`this.eventEmitter.registerExecutionRouting(executionId, ...)` — admission 이전에 이미 등록됨),
    `:3669` (`const admission = await this.admitExecutionOrDefer(execution, input);` — **try/catch
    밖**), `:3683-3696` (`try { await this.runExecution(...) } catch { ...; releaseExecutionRouting;
    ... }` — `runExecution` 만 감싼다). 테스트 갭: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    의 `admitStub` 헬퍼(약 4819-4835행, `'admitted'|'deferred'|'cancelled'` 만 지원, reject 지원 없음)
    와 그 아래 `runExecutionFromQueue` describe 블록(4837-4919행) — 형제 테스트
    `'runExecution 가 reject 하면 catch 가 routing context 명시 release (안전망)'`(4896-4919행)는
    존재하지만, `admitExecutionOrDefer` 자체가 reject 하는 대응 테스트는 없다. 18854-18980행 부근의
    W5/W7 도 `admitExecutionOrDefer` 를 `mockResolvedValue('admitted')` 로 고정해 통과시킬 뿐,
    reject 경로는 다루지 않는다.
  - 상세: `registerExecutionRouting` 은 admission 검사 **이전**(`triggerId` 가 있으면 3657-3663행)에
    이미 호출된다. 그 직후 `admitExecutionOrDefer` 가 (이번 diff 의 신규 가드로 인해) throw 하면,
    예외는 `runExecutionFromQueue` 밖으로 그대로 전파된다 — `if (admission !== 'admitted')` 분기도,
    `runExecution` 을 감싸는 `try/catch`(3683-3696행, 여기서만 `releaseExecutionRouting` 호출)도
    거치지 않는다. 즉 `WebsocketService.executionRouting` Map(`websocket.service.ts:410-413`)의
    해당 executionId 엔트리는 **정상 흐름의 어떤 release 경로도 타지 않는다** — 유일한 회수 경로는
    `EXECUTION_CANCELLED` 같은 terminal 이벤트 emit 시 자동 release(`emitExecutionEvent` 의
    `TERMINAL_EXECUTION_EVENTS` 분기)뿐인데, admission throw 시 DB 트랜잭션이 롤백돼 execution 은
    `pending` 그대로 남고 그 이벤트도 발생하지 않는다. 유일한 회수는 `recoverOrphanPendingExecutions`
    (§8 orphan pending backstop)인데, 이는 **`onApplicationBootstrap` 에서만** 실행된다
    (`execution-engine.service.ts:900,913` — `@Cron`/`@Interval` 아님). 즉 이 가드가 실제로 발동하면
    (드라이버가 배열 아닌 값을 반환하는, docstring 이 "극히 드묾" 이라 인정하는 상황) 다음 프로세스
    재기동 전까지 라우팅 컨텍스트가 인스턴스 메모리에 남는다 — 크지는 않지만(작은 객체 1개), 이 PR 이
    바로 이 throw 경로를 처음으로 명시적 회귀 테스트 대상으로 승격시킨 만큼, 그 caller-level 결과도
    같은 라운드에서 테스트에 편입하는 편이 자연스럽다. `RESOLUTION.md`(파일 8)가 스스로 "호출부는
    그 둘을 다르게 다룬다(전자는 defer, 후자는 전파)" 고 caller-level 전파를 근거로 들면서도, 정작
    그 전파의 관측 가능한 결과(라우팅 release 여부)는 검증하지 않았다.
  - 제안: `runExecutionFromQueue` describe 블록(4818행 부근)에 `admitStub` 을
    `mockRejectedValueOnce(...)` 를 지원하도록 확장하거나 별도 테스트를 추가해, admission 이
    throw 할 때 `mockWebsocketService.releaseExecutionRouting` 이 호출되는지(현재는 안 됨) 또는
    호출돼야 하는지를 명시적으로 고정한다. 만약 "release 안 함 + boot-time backstop 이 최종 회수"가
    의도된 설계라면 그 사실 자체를 테스트로 문서화하고, 아니라면 `admitExecutionOrDefer` 호출도
    `try/catch` 범위 안으로 넣어 `runExecution` 과 동일한 안전망을 공유시키는 편을 검토.

## 확인된 양호 사항

- **`toChatChannelEvent` null → debug/warn 로그 레벨 분기** (`chat-channel.dispatcher.spec.ts:769-839`):
  `handle()` 경유로 양방향(정상 skip→debug, 에러성→warn)을 각각 `not.toHaveBeenCalledWith` 로 반대
  로그도 안 찍힘을 함께 확인한다 — 삼항을 한쪽으로 고정하는 회귀를 놓치지 않는 형태. 실제 코드
  (`chat-channel.dispatcher.ts:192-207`, `isSubFilterNull` 삼항)와 line-level로 대조해 정확히
  일치함을 확인했고, 두 fixture(`execution.node.completed`+`http_request`,
  `execution.ai_message`+`{not:'string'}`)가 실제로 각 분기(`toChatChannelEvent` 내부 케이스)를
  태우는지도 직접 추적해 확인했다(우연한 통과 아님).
- **`makeDispatcherHarness` 공통화** (`chat-channel.dispatcher.spec.ts:715-763`): 이전 라운드
  WARNING(fixture 중복)을 해소한 리팩터. `buildDispatcher`/`buildDispatcherForNull` 양쪽 사용처가
  옵션(`renderResult`/`lookupState`)만 다르게 열고 나머지 생성자·adapter·triggerRepository fixture
  는 단일 정의를 공유하도록 정리됐다. 기존 "form 게이팅 state persist" 두 테스트(876-916행)를 실행해
  회귀 없음을 직접 확인(`state` 참조 공유가 `lookupState` 객체를 통해 정확히 유지됨).
- **`snapshotCache` LRU 상한/방향 테스트** (`executions.service.spec.ts:518-562`): 경계값(256→257)과
  방향(가장 오래된 키가 밀리는지, 직전 읽기로 갱신된 키는 살아남는지)을 함께 고정한다. "무언가 하나
  지운다"만 보는 뮤턴트를 놓치지 않는 설계. `executions.service.ts` 의 `writeSnapshotCache`/
  `readSnapshotCache`(166-202행)의 delete-then-reinsert 패턴과 정확히 대조해 일치를 확인했다.
  격리도 확인됨 — `service` 인스턴스(따라서 `snapshotCache` 인스턴스 필드)는 파일 최상위
  `beforeEach`(106행)에서 매 테스트 재생성되므로, 같은 describe 안의 다른 완료-상태 캐시 테스트가
  남긴 잔여 엔트리가 이 256/257 카운트를 오염시키지 않는다(직접 코드 추적으로 확인, 실행 결과도
  일치).
- **`admitExecutionOrDefer` non-array 방어 테스트 자체** (`execution-engine.service.spec.ts:4491-4512`):
  현재 프로덕션 코드(`execution-engine.service.ts:2931-2936`, `throw new Error(...)`)와 정확히
  일치 — 이전 라운드에서 `return false`(defer)로 잘못 구현했다가 리뷰로 되돌린 이력이 `RESOLUTION.md`
  에 기록돼 있고, 현재 diff 의 테스트(`rejects.toThrow(/배열이 아님/)`)는 되돌려진 최종 코드(throw)와
  맞다 — stale 테스트 아님. 형제 테스트들(`cap 여유→admitted`, `cap 초과→deferred`,
  `queuedAt=null→admission 진행`)과 나란히 실행해 441 passed 로 회귀 없음을 확인했다.
- **`SNAPSHOT_CACHE_MAX_ENTRIES` export** — 값(256)을 심볼과 별도로 리터럴로도 단언
  (`executions.service.spec.ts:519`)해, 심볼만 참조하면 상한이 조용히 바뀌어도 테스트가 따라가는
  함정을 스스로 방지한다.

## 요약

핵심 프로덕션 변경 2건(`execution-engine.service.ts` 의 `Array.isArray` fail-closed 가드,
`executions.service.ts` 의 export 전환)과 그에 대응하는 신규 테스트 3세트는 모두 line-level 로
실제 소스와 대조해 정확했고, 실행 결과도 전부 GREEN(441/66 passed)이었다 — 방향성 있는 단언(로그
레벨 양방향, LRU evict 방향)까지 갖춰 "그냥 통과" 형태의 취약한 테스트가 아니다. 다만 admission
가드가 **throw** 로 확정되면서 그 예외가 `runExecutionFromQueue` 호출부까지 전파될 때의 결과(특히
admission 이전에 이미 등록된 `registerExecutionRouting` 이 release 되지 않는 경로)는 이번 diff 가
추가한 어떤 테스트에도 없다 — 구조적으로 거의 동일한 형제 시나리오(`runExecution` reject)는
명시적으로 테스트돼 있어 비대칭이 두드러진다. 프로덕션에서 실제로 이 가드가 발동할 가능성은 낮다고
코드 주석 스스로 인정하지만("정상 postgres 드라이버는 항상 배열 반환"), 이 PR 이 바로 그 경로를
처음으로 회귀 테스트 대상으로 승격시킨 라운드인 만큼 caller-level 결과도 같은 라운드에서 테스트로
고정하는 편이 일관적이다. Mock 사용은 파일 관례와 일치하고(전역 `Logger.prototype` spy 는
`try/finally` 복원), 격리도 매 테스트 fresh 인스턴스로 견고했다.

## 위험도

LOW
