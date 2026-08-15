# 유지보수성(Maintainability) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 검토 방법

프롬프트 번들에서 크기 제한으로 diff 가 생략된 파일(`execution-engine.service.ts`,
`execution-engine.service.spec.ts`, `terminal-duration.ts`, `terminal-duration.spec.ts`)은
`git diff origin/main -- <path>` 로 직접 열어 대조했다. `review/**`, `plan/**` 은 코드가 아닌
과거 리뷰/추적 산출물이라 유지보수성 관점 대상에서 제외했다(코드 파일 16개 + 문서 2개 focus).

## 발견사항

- **[WARNING]** `RETURNING` 값 추출 보일러플레이트가 5곳에 문자 그대로 반복된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1045-1049`,
    `:1182-1186`(`markWebChatIdleTimeout`), `:2861-2865`(`markExecutionCancelled`),
    `:2910-2914`(`markQueueWaitTimeout`), `:3363-3367`(`finalizeStalledExhausted`)
  - 상세: 다섯 곳 모두
    ```ts
    toFiniteNumber(
      (result.raw as Array<Record<string, unknown>> | undefined)?.[0]
        ?.duration_ms,
    ) ?? null;
    ```
    를 그대로 복붙했다. `unknown` 캐스팅·배열 인덱싱·optional chaining 이 얽힌 표현이라
    다음에 6번째 raw-UPDATE 종결 경로가 추가될 때 이 형태를 손으로 다시 베낄 가능성이 높고,
    그 과정에서 인덱스나 필드명(`duration_ms`)이 어긋나도 타입 체커가 잡아주지 못한다(전부
    `unknown` 캐스팅이라). 추가로 `toFiniteNumber` 는 시그니처상 `number | null` 만 반환하고
    `undefined` 를 절대 돌려주지 않으므로(`codebase/backend/src/shared/utils/terminal-duration.ts`
    의 `toFiniteNumber` 구현 참조) 뒤에 붙는 `?? null` 은 다섯 곳 전부 죽은 코드다 — 읽는
    사람은 "혹시 undefined 도 나오나?" 하고 반대로 의심하게 된다.
  - 제안: `terminal-duration.ts` 에 `extractReturnedDurationMs(result: { raw?: unknown }): number | null` 같은 헬퍼를 하나 추가해 다섯 호출부를 한 줄 호출로 줄이고, 그 안에서 `?? null` 죽은 코드도 함께 정리한다. `resolveTerminalDurationMs`/`toFiniteNumber` 를 이미 한 파일에 모으기로 한 이 PR 의 설계 방향과도 맞다.

- **[WARNING]** "확정 후 재계산" 대입 관용구가 두 파일에 걸쳐 11회 문자 그대로 반복된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:639, 2415, 2579, 3566, 4296, 4756, 4884, 4945` / `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:714, 896, 949`
  - 상세: 전부
    ```ts
    X.durationMs = resolveTerminalDurationMs(X) ?? X.durationMs;
    ```
    형태다(`X` 는 `row`/`savedExecution`/`execution`/`reloaded`). 헬퍼(`resolveTerminalDurationMs`)를
    도입한 목적 자체가 "이 계산을 emit 지점마다 손으로 처리하면 한 곳씩 빠진다"(헬퍼 JSDoc,
    `terminal-duration.ts:16`)인데, 정작 "대입" 쪽 관용구는 여전히 11곳에 손으로 복붙돼 있다.
    지금은 전부 동일해 안전하지만, 다음에 이 대입 규칙이 바뀌면(예: `?? X.durationMs` 폴백
    조건이 달라지면) 11곳을 모두 찾아 고쳐야 하고, 하나라도 놓치면 헬퍼가 막으려던 바로 그
    종류의 결함(경로별로 다른 동작)이 재발한다.
  - 제안: `applyResolvedDuration<T extends { durationMs?: number | null; startedAt?: Date | null; finishedAt?: Date | null }>(entity: T): T { entity.durationMs = resolveTerminalDurationMs(entity) ?? entity.durationMs; return entity; }` 같은 얇은 in-place 헬퍼를 추가해 11개 호출부를 `applyResolvedDuration(row);` 한 줄로 줄이는 편이 헬퍼 도입 취지와 일관된다.

- **[INFO]** 같은 인자로 `resolveTerminalDurationMs` 를 두 번 호출 — 값을 재사용하지 않고 재계산
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2415`(대입)/`:2426`(재호출), `:2579`/`:2595`, `:3566`/`:3577`, `:4756`/`:4769`, `:4884`/`:4888`, `:4945`/`:4967` · `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:714`/`:730`, `:896`/`:907`, `:949`/`:971`
  - 상세: `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;` 로 이미 확정한 값을, 몇 줄 뒤 emit payload 에서 `durationMs: resolveTerminalDurationMs(savedExecution)` 로 **다시 계산**한다. 함수 내부가 `typeof` 체크 한 줄이라 비용은 무시할 수준(performance reviewer 도 같은 지점을 INFO 로 별도 지적)이지만, 유지보수성 관점에서는 "왜 같은 값을 두 번 계산하는가"를 다음 편집자가 매번 다시 확인해야 하는 자리다 — 첫 대입 결과(`savedExecution.durationMs`)를 그대로 참조하면 계산이 한 번으로 줄고 "이 두 값이 항상 같다"는 사실을 코드 스스로 보장한다.
  - 제안: `durationMs: savedExecution.durationMs` 로 직접 참조하거나, 대입 시점에 지역 변수로 받아 emit 에서 재사용. 위 WARNING 의 헬퍼가 반환값을 주도록 만들면(`const durationMs = applyResolvedDuration(row).durationMs;`) 이 문제도 함께 해소된다.

- **[INFO]** consumer-계약 안내 주석이 세 인터페이스에 문자 그대로 5줄씩 반복된다
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:392-397`(`EiaCompletedEvent`), `:415-420`(`EiaFailedEvent`), `:433-438`(`EiaCancelledEvent`)
  - 상세: `// EIA §6 — producer 는 **항상**...` 로 시작하는 동일한 5줄 주석(레거시 키 부재 설명 · 29개 fixture 언급 · 직전 PR 판단 참조)이 40줄 간격으로 세 번 반복된다. 코드 중복은 아니지만, 이 설명이 나중에 갱신될 때(예: `error.nodeId` 판단이 바뀌거나 fixture 개수가 달라지면) 세 곳을 모두 찾아 동기화해야 하며 하나만 갱신되면 서로 다른 근거가 남는다 — 이 세션의 교훈 목록에 있는 "SoT 한쪽만 갱신" 패턴과 같은 리스크 형태다.
  - 제안: 세 인터페이스 앞(또는 파일 상단)에 한 번만 설명을 적고 각 필드에는 `durationMs?: number | null; // ↑ 위 설명 참조` 처럼 짧게 가리키거나, 공유 타입 별칭에 JSDoc 을 한 번만 달아 재사용. 강제 사항은 아니며 지금 세 곳이 실제로 100% 동일하므로 즉각적인 drift 위험은 낮다.

- **[INFO]** 같은 "완료만 집계" 필터를 파일마다 다른 방식으로 표현 — 크로스파일 일관성
  - 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts:100`(`e.status = :completedStatus`, 파라미터 바인딩) vs `codebase/backend/src/modules/statistics/statistics.service.ts:97, 225`(`e.status = 'completed'`, 하드코딩 리터럴)
  - 상세: `dashboard.service.ts` 는 이번 PR 에서 `ExecutionStatus.COMPLETED` 를 `:completedStatus` 파라미터로 바인딩했지만, `statistics.service.ts` 는 이번 PR 이 추가한 두 필터 모두 문자열 리터럴 `'completed'` 를 SQL 문자열 안에 직접 이어붙였다(파일 내 기존 형제 라인들 — `successCount`/`failedCount`/`cancelledCount` — 과는 스타일이 맞지만, 자매 모듈인 dashboard 와는 어긋난다). 두 파일이 정확히 같은 개념(종결 상태 중 completed 만 집계)을 다른 방식으로 표현하는 셈이라, 향후 `ExecutionStatus` enum 값이 바뀌면 statistics 쪽은 컴파일러가 못 잡는다.
  - 제안: 필수는 아니나, 다음에 이 영역을 만질 때 `statistics.service.ts` 도 `:completedStatus` 파라미터 바인딩으로 맞추는 편이 오탈자·enum drift 방어에 유리하다. 현재 PR 범위에서 강제할 정도는 아니다.

## 요약

이번 변경은 16개 종결 emit 경로에 `durationMs` 를 채우는 배관 작업으로, 계산 로직(`resolveTerminalDurationMs`)과 SQL 상수(`TERMINAL_DURATION_MS_SQL`)를 신규 공유 유틸(`terminal-duration.ts`)로 정확히 한 곳에 모았고, 그 파일 자체는 함수가 짧고 단일 책임이며 JSDoc 이 "왜 이렇게 짰는가"(startedAt 부재·int4 클램프·NULL sentinel 통일)를 근거와 함께 설명해 가독성이 높다. 다만 이 헬퍼를 소비하는 쪽(주로 `execution-engine.service.ts`)에서는 "raw UPDATE 결과에서 duration_ms 를 뽑아내는" 5줄짜리 표현과 "계산 후 재대입" 1줄짜리 표현이 각각 5회·11회 문자 그대로 반복돼, 헬퍼 도입이 막으려던 "한 곳씩 빠지는" 리스크가 소비 지점 자체에는 아직 남아 있다. `types.ts` 의 설명 주석 3중 반복과 dashboard/statistics 간 상태 필터 표현 방식 차이는 경미한 추가 관찰이다. CRITICAL 급 구조 문제는 없으며, 지적된 중복은 대부분 "같은 곳에서 값이 갈릴 위험"을 낮추는 작은 헬퍼 추출로 해소 가능한 수준이다.

## 위험도

LOW
