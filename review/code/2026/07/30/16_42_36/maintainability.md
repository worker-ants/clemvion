STATUS=success reviewed 5 files (state-machine.ts, execution-engine.service.ts, ai-turn-orchestrator.service.ts, engine-driver.interface.ts, retry-turn.service.ts); 2 WARNING + 4 INFO
===REPORT_MARKDOWN_BELOW===
# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `NON_TERMINAL_STATUSES_SQL` / `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 계산 골격과, opts 에 따라 둘 중 하나를 고르는 3항 선택 로직이 각각 별도로 중복
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/retry-atomic-claim-4d9e77/codebase/backend/src/modules/execution-engine/execution-engine.service.ts:513-518`(`NON_TERMINAL_STATUSES_SQL`), `:534-543`(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`), `:8173-8175`(`lockNonTerminalExecutionRow` 의 `statusesSql` 선택), `:8459-8461`(`updateExecutionStatus` else 분기의 `elseStatusesSql` 선택)
  - 상세: 두 static 상수 모두 `Object.values(ExecutionStatus).filter(...).map((s) => \`'${s}'\`).join(', ')` 골격이 동일하고 `.filter()` 술어만 다르다. 게다가 "opts.allowRetryReentry 면 OR_FAILED, 아니면 STATUSES" 라는 3항 선택 로직 자체도 `lockNonTerminalExecutionRow`(8173-8175)와 `updateExecutionStatus`(8459-8461) 두 곳에 토씨 하나 안 틀리고 반복돼 있다. 이 파일은 정확히 이런 종류의 손 중복(`NON_TERMINAL_STATUSES_SQL` 을 도입한 WARNING #8, 2026-07-26) 때문에 이미 한 차례 리팩터링을 거친 이력이 있는데, 이번 CRITICAL #1 수정이 같은 클래스의 중복을 한 겹 더 쌓았다(코드 자신의 JSDoc 도 이 위험을 인지하고 있으나 해소하지는 않았다).
  - 제안: `Object.values().filter().map().join()` 골격을 `private static buildStatusesSql(predicate: (s: ExecutionStatus) => boolean): string` 헬퍼로 뽑아 두 상수가 술어만 다르게 재사용하게 하고, "opts 에 따라 어떤 SQL 을 쓸지" 선택도 `private static resolveStatusesSql(opts?: { allowRetryReentry?: boolean }): string` 한 곳으로 모아 두 호출부가 공유하도록 정리.

- **[WARNING]** `{ allowRetryReentry?: boolean }` 옵션 타입이 이름 없이 5곳에 구조적으로만 동일하게 중복 선언 (이번 diff 가 그중 3곳을 신규 추가)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/retry-atomic-claim-4d9e77/codebase/backend/src/modules/execution-engine/state/state-machine.ts:45-58`(`TransitionOptions`, 유일하게 이름 붙은 버전) / `/Volumes/project/private/clemvion/.claude/worktrees/retry-atomic-claim-4d9e77/codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:81`, `:213` / `/Volumes/project/private/clemvion/.claude/worktrees/retry-atomic-claim-4d9e77/codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8171`(`lockNonTerminalExecutionRow`, 신규), `:8233`(`tryLockActiveExecutionAndSaveNodeExec`, 신규), `:8358`(`updateExecutionStatus`, 기존)
  - 상세: `state-machine.ts` 는 이미 `TransitionOptions` 라는 이름 있는 interface 를 export 하는데도, `engine-driver.interface.ts` 와 `execution-engine.service.ts` 는 그걸 import 하지 않고 구조적으로 동일한 `{ allowRetryReentry?: boolean }` 리터럴을 계속 따로 적어 이번 diff 이후 총 5곳이 됐다(신규 2곳은 `engine-driver.interface.ts:213` 과 `execution-engine.service.ts:8171`, 확장된 시그니처 1곳은 `execution-engine.service.ts:8233`). TypeScript 구조적 타이핑 때문에 지금 당장 컴파일 오류는 없지만, "opts 가 한쪽 계층에서만 조용히 어긋난다" 는 실패 양상이 바로 이번에 고친 CRITICAL #1 버그(짝 전이가 in-memory 상태머신은 통과하고도 DB 가드까지 도달하지 못해 항상 0행)의 근본 패턴과 같다 — 타입을 한 곳에서만 선언해 재사용하면, 향후 필드 추가·rename 시 컴파일러가 나머지 호출부 전체를 강제로 검사하게 된다.
  - 제안: `TransitionOptions` 를 그대로 import 하거나, `engine-driver.interface.ts` 에 `export type RetryReentryOptions = { allowRetryReentry?: boolean }` 를 한 번만 선언해 5곳 모두 재사용.

- **[INFO]** 동일 개념에 계층별로 다른 플래그 이름(`retryReentry` vs `allowRetryReentry`)이 쓰이고, 그 사이 변환 삼항식이 반복
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/retry-atomic-claim-4d9e77/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:442`(`reparkAiResumeTurn` opts 파라미터, 신규), `:457`(변환 삼항식, 신규), `:1439`, `:1508`, `:1600`, `:1619`(같은 변환 삼항식의 기존/확장 사용처)
  - 상세: orchestrator 계층(`finalizeAiNode`/`processAiResumeTurn`/`reparkAiResumeTurn`)은 `opts.retryReentry` 를 쓰고, 이를 엔진/상태머신 계층에 넘길 때마다 `retryReentry ? { allowRetryReentry: true } : undefined` 형태의 한 줄 변환을 그대로 복사해 최소 4곳에 반복한다(이번 diff 가 `reparkAiResumeTurn` 에 그중 1곳을 새로 추가). "이 호출이 retry 재진입 컨텍스트다"(orchestrator) 와 "이 전이를 허용한다"(engine) 의미를 계층별로 구분하려는 의도는 이해되지만, 이름이 갈리는 것 자체가 두 계층을 오가며 흐름을 추적할 때 인지 비용을 늘린다.
  - 제안: 최소한 변환 삼항식만이라도 `private toRetryReentryOpts(flag?: boolean)` 같은 1줄 헬퍼로 모으거나, 장기적으로 두 계층의 필드명을 통일.

- **[INFO]** `canTransition` 의 신규 OR 체인이 같은 파일의 기존 관용구(`.includes()`)와 스타일이 다름
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/retry-atomic-claim-4d9e77/codebase/backend/src/modules/execution-engine/state/state-machine.ts:72-79`(신규 OR 체인) / `:83`(같은 파일의 `.includes()` 관용구)
  - 상세: `(to === (ExecutionStatus.RUNNING as string) || to === (ExecutionStatus.WAITING_FOR_INPUT as string))` 로 목적지 2개를 나열 비교하는데, 바로 몇 줄 아래(83행) `allowed.includes(to)` 는 배열 `.includes()` 관용구를 쓴다. 이번 diff 로 "예외 쌍" 이 1개(RUNNING)에서 2개(RUNNING, WAITING_FOR_INPUT)로 늘었는데, 앞으로 더 늘면 OR 체인이 `.includes()` 보다 읽기 어려워진다.
  - 제안: `[ExecutionStatus.RUNNING, ExecutionStatus.WAITING_FOR_INPUT].includes(to as ExecutionStatus)` 형태로 통일하면 파일 내 관용구 일관성이 좋아지고 향후 확장에도 유리.

- **[INFO]** `retry-turn.service.ts`: 콜사이트 인라인 주석과 `claimSpawnedRetryRow` JSDoc 이 같은 근거를 사실상 두 번 서술
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/retry-atomic-claim-4d9e77/codebase/backend/src/modules/execution-engine/retry-turn.service.ts:322-330`(콜사이트 인라인 주석) / `:507-518`(`claimSpawnedRetryRow` JSDoc 중 동일 근거 문단)
  - 상세: 322-330 은 "claim 은 손상 판정보다 먼저 실행돼야 한다" 는 근거(BullMQ 재배달로 인한 재현 경로 포함)를 상세히 풀어쓴 뒤 330행에서 "상세 근거·백스톱 갭은 `claimSpawnedRetryRow` JSDoc 참조" 라고 스스로 위임하는데, 정작 507-518 JSDoc 도 같은 문장을 사실상 그대로 반복한다. 근거 서술이 갱신될 때 한쪽만 고쳐지면 조용히 drift 할 수 있다 — 같은 파일 상단(35-40행) `RETRY_STATE_KEY` 상수 자체가 "리터럴이 여러 곳에 흩어지면 한쪽만 리네임될 때 조용히 drift 한다" 는 동일한 이유로 도입된 것과 정확히 같은 위험 패턴이다.
  - 제안: 콜사이트 주석은 "왜 이 순서로 호출해야 하는지"만 한두 문장으로 남기고, 전체 근거(재현 시나리오 등)는 `claimSpawnedRetryRow` JSDoc 쪽에만 단일하게 유지.

- **[WARNING]** `applyRetryLastTurn` 이 라운드를 거듭할수록 책임과 분기 수가 계속 늘어남
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/retry-atomic-claim-4d9e77/codebase/backend/src/modules/execution-engine/retry-turn.service.ts:288-483`(`applyRetryLastTurn` 전체)
  - 상세: not-found 가드 → 멱등 fast-path 체크 → 원자 claim → (이론상 도달 불가능한) 방어 분기 → in-memory 동기화(`delete`) → execution/node 병렬 조회(각각 실패 시 FAILED 마킹) → context rehydrate → `_resumeState` 재구성 + cache seed → `NODE_STARTED` emit → turn 처리 위임(`processAiResumeTurn`) → 그래프 재개/실패 처리까지, 한 함수 안에 약 10단계·7개 안팎의 조기 반환이 몰려 있다. 같은 파일에서 이미 `claimSpawnedRetryRow`/`buildRetryReentryState` 를 SRP 목적으로 추출한 선례가 있어(코드 자신도 "본 메서드는 orchestration … 만 담당" 이라고 명시), "claim + 검증" 구간(301-369행)도 같은 방식으로 한 번 더 뽑아낼 여지가 있다.
  - 제안: 301-369행의 "fast-path 상태 확인 → atomic claim → 방어적 retryState 확인 → in-memory sync" 블록을 `private async claimAndLoadRetryState(spawnedRow): Promise<RetryState | null>` 류 헬퍼로 추출해, `applyRetryLastTurn` 본체에는 turn 처리 orchestration 만 남기도록 축소.

## 요약

이번 변경의 핵심(3파일에 걸친 `allowRetryReentry`/`retryReentry` opts 전파, state-machine 의 FAILED→WAITING_FOR_INPUT 예외 전이 추가, retry-turn.service.ts 의 `RETRY_STATE_KEY` 상수화·`claimSpawnedRetryRow` 추출)은 방향이 옳고 각 지점의 JSDoc 도 상세하다 — 특히 `RETRY_STATE_KEY` 도입과 `claimSpawnedRetryRow` 분리는 이 리뷰가 지적하려는 것과 같은 종류의 중복/SRP 문제를 스스로 잘 해소한 선례다. 다만 이번 CRITICAL 수정 자체가 새 옵션 shape(`{ allowRetryReentry?: boolean }`)과 새 SQL 상수(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`)를 여러 계층에 인라인으로 복제하며 퍼뜨렸고, 이는 정확히 "opts 가 한 계층에서 조용히 안 맞게 된다" 는, 이번에 고친 버그와 같은 실패 양상을 만들 잠재력을 남긴다. 기능적 위험은 없으나(현재 5곳 모두 올바르게 배선돼 있음을 코드로 확인) 향후 6번째 소비처가 추가될 때 이 중 하나를 빠뜨릴 여지를 줄이려면 타입/SQL 생성 로직을 단일 지점으로 모으는 편이 바람직하다. 그 외 `retry-turn.service.ts` 의 `applyRetryLastTurn` 길이·문서 중복은 경미하지만 라운드를 거듭할수록 누적되는 추세이므로 이번 기회에 한 번 더 추출하는 것을 권한다.

## 위험도
LOW
