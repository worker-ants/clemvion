# 요구사항(Requirement) 충족 리뷰 — EIA 종결 이벤트 `durationMs`

## 검토 범위·방법

프롬프트 번들 파일 1~6(실제 코드 변경: `execution-engine.service.ts`/`.spec.ts`,
`retry-turn.service.ts`/`.spec.ts`, 신규 `shared/utils/terminal-duration.ts`/`.spec.ts`)과
파일 24~26(spec 변경: `spec/3-workflow-editor/3-execution.md`,
`spec/5-system/14-external-interaction-api.md`, `spec/conventions/chat-channel-adapter.md`)을
중심으로 분석했다. 파일 7~23(plan/consistency 산출물)은 이미 다른 checker 들이 다뤘고 코드
자체가 아니므로 참고만 하고 본 리뷰의 발견사항 대상에서 제외했다. 대용량 파일은 프롬프트가
절단해 `Read`/`Grep` 으로 저장소에서 직접 전문을 열어 대조했다.

durationMs 를 종결 이벤트(`completed`/`failed`/`cancelled`) 16개 emit 경로 전부에 채우는
작업으로, 신규 헬퍼 `resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL`
(`terminal-duration.ts`)과 엔티티 미로드 5경로(취소 4곳 + stalled 실패 1곳)의 raw UPDATE에
`RETURNING` 확장을 도입한다.

## 발견사항

- **[CRITICAL] `duration_ms` INTEGER(int4) 오버플로 — 24.8일 이상 대기한 실행의 취소/실패 UPDATE 가 통째로 실패한다 (이 PR 이 신규로 도입한 회귀)**
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:76` (`TERMINAL_DURATION_MS_SQL`),
    호출부 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1036`
    (`cancelParkedExecution`), `:1171`(`markWebChatIdleTimeout`), `:2829`
    (`markExecutionCancelled`), `:2900`(`markQueueWaitTimeout`), `:3353`
    (`finalizeStalledExhausted`)
  - 상세: `TERMINAL_DURATION_MS_SQL` 은
    `GREATEST(0, (EXTRACT(EPOCH FROM (...)) * 1000)::bigint)::int` 로 계산값을 최종
    `::int`(Postgres int4, 범위 ±2,147,483,647)로 캐스팅한다. `execution.duration_ms` 컬럼은
    `codebase/backend/migrations/V001__initial_schema.sql:223` 에서 `INTEGER` 로 정의돼 있고,
    바로 이 저장소의 `V083__execution_active_running_ms.sql` 주석이 "int4(최대 ~2.1e9 ms ≈
    24일)" 라고 스스로 명시한 바로 그 한계다. 값이 이 범위를 넘으면 Postgres 는 `CAST` 시점에
    `integer out of range` 로 **UPDATE 문 전체를 실패**시킨다(부분 실패나 truncate 가 아니다).
    문제는 이 컬럼이 저장하는 값이 **wall-clock 총 소요**(`started_at` 부터, `waiting_for_input`
    대기 시간 포함)라는 점이다 — 바로 그 V083 마이그레이션 주석이 "사용자 입력을 며칠 기다리는
    정상 워크플로를 timeout 으로 죽이면 안 되기 때문에" `active_running_ms` 를 **별도 컬럼**으로
    분리했다고 명시한다. 즉 이 저장소는 `waiting_for_input` 대기가 무기한 길어질 수 있음을 이미
    설계 전제로 삼고 있다. 이번 PR 이전에는 취소 경로(4곳)·`finalizeStalledExhausted`(1곳)의
    raw UPDATE 가 `duration_ms` 를 전혀 건드리지 않았으므로("계산·영속조차 하지 않는다", 이번
    diff 가 고치는 바로 그 상태) 이 5경로는 대기 기간과 무관하게 항상 성공했다. 이번 PR 이
    처음으로 이 5경로의 UPDATE 문에 `duration_ms` SQL 계산을 추가했으므로, **24.8일 이상
    대기한(webchat 위젯 외 — 내부 form/button/AI 대화 대기에는 자동 idle 타임아웃이 없다) 실행을
    취소하거나(`cancelParkedExecution`/`markExecutionCancelled`/`markWebChatIdleTimeout`/
    `markQueueWaitTimeout`) stalled 로 실패 처리(`finalizeStalledExhausted`)하려는 시도가
    이제 새로 DB 에러로 실패**한다. 이 예외는 각 함수의 최상위 `try/catch`(`@remarks DB 오류는
    내부 흡수 — 호출자에 예외 전파 없음 (best-effort cancel)`)가 조용히 삼켜 `logger.error` 로만
    남고 호출자에게는 아무 신호도 가지 않는다 — 결과적으로 **취소/실패 요청이 있었는데 execution
    이 그 상태(WAITING_FOR_INPUT/RUNNING)에 영구히 고착**된다. 이 PR 이전에는 같은 상황에서 취소가
    항상 성공했으므로 이는 이 PR 이 새로 만든 회귀다.
  - 제안: `TERMINAL_DURATION_MS_SQL` 에 상한 클램프를 추가한다
    (`LEAST(2147483647, GREATEST(0, ...))`) — DB 컬럼 타입을 `BIGINT` 로 확장하는 이관이
    더 근본적이지만 이번 PR 범위를 넘으므로, 최소한 클램프로 "UPDATE 자체가 실패"를
    "값이 saturate 된 채로 취소는 성공" 으로 바꿔야 한다. 클램프 이후에도 여전히
    "24일 넘게 대기한 실행의 durationMs 는 부정확(포화값)해진다" 문제가 남지만, 최소
    취소/실패 처리 자체가 막히지는 않는다. 상수의 정확한 값(2147483647)을 하드코딩 대신
    Postgres `INT4RANGE` 유사 상수나 컬럼 검증 유틸로 한 곳에 두는 편이 안전하다.

- **[WARNING] 같은 클래스의 이상값(시계 역행/오버플로)에 대해 SQL 경로(0으로 clamp)와 JS 경로(null)가 서로 다른 sentinel 을 반환한다**
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:41`
    (`resolveTerminalDurationMs` 의 `return span >= 0 ? span : null;`) vs `:76`
    (`TERMINAL_DURATION_MS_SQL` 의 `GREATEST(0, ...)`)
  - 상세: 두 계산 경로 모두 "시계 역행이 음수를 만들면 수신자의 산술이 깨진다" 는 동일한 우려를
    docstring 에 명시하지만 해결책이 다르다 — JS 경로(`completed`/`failed`/`finalizeCancelledExecution`
    등 엔티티 로드 경로)는 음수를 `null`(값을 모름)로 처리하고, SQL 경로(취소 4곳 +
    `finalizeStalledExhausted`)는 `0`(즉시 완료)으로 clamp 한다. 동일한 이상(clock skew)이
    발생했을 때 소비자(webhook/SSE/WS 구독자)가 받는 신호가 "알 수 없음(null)" 과 "0ms 만에
    끝남" 으로 갈려, 동일 계약(EIA §6 `durationMs`)에 대해 두 가지 다른 의미를 실을 수 있다.
  - 제안: 두 경로 중 하나로 정책을 통일한다 — SQL 쪽도 `CASE WHEN ... < 0 THEN NULL ELSE ...
    END` 형태로 바꾸거나(제안), JS 쪽이 이미 `null` 을 선택한 근거("그대로 실으면 수신자의
    산술이 깨진다")가 `0` 에도 똑같이 적용되지 않는 이유를 문서화한다.

- **[WARNING] `spec/conventions/chat-channel-adapter.md` 의 `EiaEvent` TS union 이 이 PR 이 수정한 바로 옆 문장과 모순 — `durationMs?: number` 에 `| null` 이 없다**
  - 위치: `spec/conventions/chat-channel-adapter.md:149-151`
    (`durationMs?: number;` — completed/failed/cancelled 세 variant 전부 동일)
  - 상세: 같은 파일의 바로 아래 문장(이번 PR 의 diff 가 직접 수정한 부분,
    `spec/conventions/chat-channel-adapter.md:160-161`)은 *"`durationMs` 는 2026-08-15 에
    종결 3종 전부 구현됐다 — **알 수 없으면 `null`**"* 이라고 명시한다. 실제 구현
    (`resolveTerminalDurationMs`/`emitCancellationEvent` 모두 `?? null`)도 `null` 을 명시적으로
    싣는다. 그런데 바로 위 TS union 타입 선언은 `durationMs?: number`(옵셔널이라 `undefined`
    는 허용하지만 `| null` 이 없다)로, 같은 파일이 nullable 필드에 쓰는 관용구(`error` 의
    `code: string | null`, `nodeId: string | null`)를 따르지 않는다. 이 PR 이 바로 옆 줄을
    편집하면서 이 타입 선언 자체는 갱신하지 않아, 문서 내부에서 "null 이 온다"는 산문과
    "null 은 타입에 없다"는 선언이 공존한다.
  - 제안: `durationMs?: number` → `durationMs?: number | null` 로 3곳(completed/failed/cancelled
    variant) 모두 정정. 이 리뷰어는 spec 을 직접 수정하지 않으므로 `project-planner` 턴에서
    반영할 것.

- **[WARNING] 헬퍼의 "한 곳에서 결정한다" 목표에도 불구하고 4개 종결 지점이 여전히 raw `getTime()` 뺄셈으로 `durationMs` 를 계산 — 안전망 밖**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2576-2578`
    (`driveCallStackResume`), `:4943-4944`(`finalizeFailedExecution`);
    `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:713-714`
    (`completeRetryExecution`), `:948-949`(`failRetryExecution`)
  - 상세: `terminal-duration.ts` 의 헤더 docstring 은 스스로 "이 갈래를 emit 지점마다 손으로
    처리하면 한 곳씩 빠진다" 는 것을 헬퍼 도입의 동기로 명시하고, `startedAt` 이 없는 행에서
    `.getTime()` 이 throw 해 종결 emit 자체가 사라지는 회귀를 실제로 겪었다고 적는다. 그런데
    위 4개 지점은 여전히 `finishedAt.getTime() - startedAt.getTime()` 직접 계산을 유지하고
    (emit 시점에만 `resolveTerminalDurationMs` 를 통과시켜 이미 계산된 숫자를 그대로 pass-through
    하는 데 그친다), `resolveTerminalDurationMs` 가 제공하는 "startedAt 없으면 throw 대신 null"
    안전망을 계산 단계에서 실제로 타지 않는다. 이번 PR 이 고친 4곳(`driveResumeAwaited`·
    `driveStuckRedrive`·`runExecution`·`resumeGraphAfterRetry`)은 모두 이 안전망을 계산에도
    적용했는데, 위 4곳은 그 전환에서 빠졌다 — 현재는 이 4곳의 엔티티가 항상 완전 로드돼
    `startedAt` 이 보장된다고 보이므로 즉시 재현되는 버그는 아니지만, 헬퍼 자신이 경계하는
    바로 그 "한 곳씩 빠진다" 패턴이 헬퍼 도입 자체 안에서도 반복됐다.
  - 제안: 위 4곳도 `finishedAt.getTime() - startedAt.getTime()` 대신
    `resolveTerminalDurationMs(...) ?? ...` 패턴으로 통일해 계산 단계까지 안전망 안에 둘 것.
    (기능적으로 급하지 않으나 일관성·향후 회귀 방지 관점의 정리 항목.)

## 확인했으나 문제 없음 (참고)

- `resolveTerminalDurationMs`/`toFiniteNumber` 자체의 엣지 케이스(0 유효값, NaN/Infinity
  폴백, Invalid Date, 문자열 숫자, 음수)는 `terminal-duration.spec.ts` 가 촘촘히 커버하고
  구현과 정확히 일치한다.
- `markQueueWaitTimeout` 의 `durationMs` 가 "실행 시간이 아니라 큐 대기 시간" 이라는 의미
  차이는 코드 주석·EIA §6.5 신규 blockquote·`plan/in-progress/eia-terminal-payload.md`
  세 곳 모두 정확히 같은 문구로 문서화돼 있어 spec-code 불일치가 아니다.
  (`execution-engine.service.ts:2897-2899`)
  대기.
- 종결 emit 16경로(completed 6 + failed 4 + cancelled 6, 그중 emitCancellationEvent
  경유 4곳 + `finalizeStalledExhausted` 1곳 = 엔티티 미로드 5곳) 전부를 개별 추적한 결과
  플랜 문서(`재판정 ④`)가 주장하는 분류·개수와 실제 코드가 정확히 일치했다 — 과대·과소
  서술 없음.
- `emitCancellationEvent` 호출 6곳(cancelParkedExecution·markWebChatIdleTimeout·
  markExecutionCancelled·markQueueWaitTimeout·finalizeCancelledExecution·
  failRetryExecution isCancelled 분기) 전부 `durationMs` 를 명시적으로 전달하며,
  값을 모르면 `?? null` 로 귀결돼 "필드 생략" 이 아니라 "명시적 null" 이라는 EIA §6.4/§6.5
  규칙(형제 `error.code`/`nodeId` 와 동일 관용구)을 지킨다.
  `retry-turn.service.ts` `failRetryExecution` 의 `result.cancelledBy` 미충전은 이미
  spec(§6 표)·별도 plan(`retry-turn-terminal-guard.md` #2)에 추적된 기존 갭이며 이번 PR
  범위가 아니다 — 재발 지적 아님.
- TypeORM `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })` + `.setParameter(...)` +
  `.returning(['id', 'duration_ms'])` 조합은 5경로 모두 일관되고, `finishedAt` 컬럼 값과
  `TERMINAL_DURATION_MS_SQL` 내부의 `:terminalFinishedAt` 파라미터가 같은 JS `Date` 인스턴스를
  참조해 DB에 두 번 다른 방식으로 전송되더라도 같은 시각을 보장한다 — "같은 문장에서 같은 값을
  쓴다" 의도가 실제로 성립한다.
- `EiaEvent`(chat-channel-adapter.md) 의 `durationMs` nullable 표기 결함을 제외하면
  EIA §6 필드 집합 표·§6.3/§6.4/§6.5 본문·JSON 예시가 코드 구현과 line-level 로 일치한다
  (실측: `spec/5-system/14-external-interaction-api.md:575` "구현됨" 전환, §6.5 blockquote
  의 "취소 경로 6곳 중 4곳은 엔티티를 로드하지 않는 raw UPDATE" 서술이 실제
  `emitCancellationEvent` 호출부 4곳 + `finalizeCancelledExecution`/retry `isCancelled`
  분기 2곳과 정확히 대응).

## 요약

durationMs 를 종결 이벤트 16경로 전부에 채우는 핵심 기능은 정확히 구현됐고, spec(EIA §6/§6.5)·
plan 문서의 분류·개수 주장과 코드가 line-level 로 일치하며, 새 헬퍼의 단위 테스트도 엣지
케이스를 촘촘히 커버한다. 다만 이번 PR 이 처음으로 취소 4경로 + stalled 실패 1경로의 raw
UPDATE 문에 `duration_ms` SQL 계산을 추가하면서, 이 컬럼이 `INTEGER`(int4, ~24.8일 상한)이고
`waiting_for_input` 대기가 저장소 자신의 설계 전제(V083 마이그레이션 주석)상 무기한 길어질 수
있다는 사실을 간과해, **24.8일 이상 대기한 실행을 취소/실패 처리하려는 시도가 새로 DB 에러로
조용히 실패하는 회귀**를 만들었다(CRITICAL). 이 외에 음수 duration 처리 정책의 SQL/JS 비대칭,
`chat-channel-adapter.md` 의 nullable 타입 선언 누락, 헬퍼 우회 4개 지점 등은 WARNING 급
일관성·문서 결함으로 즉시 기능을 막지는 않는다.

## 위험도

HIGH
