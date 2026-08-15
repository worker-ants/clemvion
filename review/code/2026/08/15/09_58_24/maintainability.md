# 유지보수성(Maintainability) 코드 리뷰

## 검토 방법 노트

프롬프트 번들이 `execution-engine.service.ts`(55,307자)·`execution-engine.service.spec.ts`(55,350자)·
`retry-turn.service.ts`(46,060자) 등 핵심 파일의 "전체 파일 컨텍스트"를 예산 초과로 생략했으므로,
diff 만으로는 판단할 수 없는 함수 전체 형태·중복 범위·일관성은 저장소에서 `Read`/`grep` 으로 직접
확인했다(`execution-engine.service.ts` 전체 8,747줄, `retry-turn.service.ts` 관련 함수, `execution-engine.service.spec.ts`
전체에서 `setParameter`/`returning` mock 개수 실측 등). 리뷰 대상은 실제 코드 변경 6개 파일
(`execution-engine.service.ts`/`.spec.ts`, `retry-turn.service.ts`/`.spec.ts`, `terminal-duration.ts`/`.spec.ts`)에
집중했다 — `plan/**`·`spec/**`·`review/consistency/**` 파일은 문서/리뷰 산출물이라 유지보수성 관점의
"코드"가 아니므로 별도 발견사항을 만들지 않았다.

---

## 발견사항

- **[WARNING]** raw UPDATE `RETURNING` → `durationMs` 추출 boilerplate 가 5곳에 문자 그대로 반복된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    - `cancelParkedExecution`: 1045-1049
    - `markWebChatIdleTimeout`: 1180-1184
    - `markExecutionCancelled`: 2860-2864
    - `markQueueWaitTimeout`: 2909-2913
    - `finalizeStalledExhausted`: 3362-3366
  - 상세: 다섯 곳 모두 아래와 동일한 3줄짜리 표현을 반복한다.
    ```ts
    toFiniteNumber(
      (result.raw as Array<Record<string, unknown>> | undefined)?.[0]
        ?.duration_ms,
    ) ?? null
    ```
    `terminal-duration.ts` 파일의 도입부 주석이 스스로 "이 갈래를 emit 지점마다 손으로 처리하면
    한 곳씩 빠진다"고 이 PR 의 존재 이유를 설명하는데, 정작 `TERMINAL_DURATION_MS_SQL`/
    `resolveTerminalDurationMs`/`toFiniteNumber` 세 헬퍼로는 "RETURNING 원본 배열에서 첫 행의
    `duration_ms` 를 안전하게 뽑아 숫자로 좁히는" 이 마지막 한 단계가 커버되지 않아, 정확히 같은
    이유로 회피하려던 반복이 5곳에 그대로 남아 있다. 타입 단언
    (`as Array<Record<string, unknown>> | undefined`)까지 5번 복제된다.
  - 제안: `terminal-duration.ts` 에 `extractDurationMsFromReturning(raw: unknown): number | null`
    같은 헬퍼를 하나 추가해 5곳을 한 줄 호출로 대체한다. 필드 하나만 추가돼도 5곳을 동시에
    고쳐야 하는 현재 구조는, 이 PR 자체가 겪은 편집 비용(정확히 이 5곳을 모두 손으로 고침)이
    이미 실측으로 증명한다.

- **[WARNING]** `cancelParkedExecution` ↔ `markWebChatIdleTimeout` — 이미 "완전히 동형"이라고
  스스로 인정한 중복 함수 쌍에 새 로직을 또 한 번씩 손으로 복제
  - 위치: `execution-engine.service.ts` `cancelParkedExecution` 1023-1089,
    `markWebChatIdleTimeout` 1150-1224 (특히 트랜잭션 내부 1028-1049 vs 1163-1184,
    NodeExecution 동반 UPDATE 1058-1070 vs 1190-1202)
  - 상세: `markWebChatIdleTimeout` 바로 위 docstring(1018행)이 "`cancelParkedExecution`(위,
    완전히 동형 연산)과 동일하게 단일 트랜잭션으로 묶는다"라고 스스로 중복을 인정하고 있다.
    이번 PR 은 `terminalFinishedAt` 선언 → `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })`
    → `.setParameter(...)` → `.returning(['id', 'duration_ms'])` → raw 추출까지 이어지는
    거의 동일한 8~9줄짜리 신규 블록을 두 함수에 각각 손으로 추가했다. 두 함수는 이미 "WAITING
    조건부 UPDATE + 동반 NodeExecution CANCELLED + `finalizeRehydrationCleanup` +
    `emitCancellationEvent`" 골격이 100% 겹치고 차이는 `error`/`code`/`cancelledBy` 값 정도뿐이다.
  - 제안: 지금 당장 강제할 사항은 아니나(이번 PR 의 스코프는 `durationMs` 배선이지 리팩터가
    아님), 두 함수를 `cancelWaitingExecution(executionId, { code?, message?, cancelledBy,
    logContext })` 같은 사설 헬퍼로 합칠 기회가 이번에도 지나갔다는 점을 다음 리팩터 후보로
    남겨 둘 것을 권한다. 이 종류의 필드 추가(예: 다음 종결 필드)가 또 생기면 같은 8~9줄이
    세 번째로 복제될 위험이 있다.

- **[WARNING]** `retry-turn.service.ts` `completeRetryExecution` 이 이번 PR 의 안전 패턴
  마이그레이션에서 빠져, 헬퍼가 만들어진 바로 그 시나리오에서 옛 무가드 계산을 그대로 쓴다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
    `completeRetryExecution` 712-714 (대조: 같은 파일 `resumeGraphAfterRetry` 893-896)
    ```ts
    // 712-714 (변경 없음, 이번 PR 이 손대지 않은 줄)
    execution.finishedAt = new Date();
    execution.durationMs =
      execution.finishedAt.getTime() - execution.startedAt.getTime();
    ```
    ```ts
    // 893-896 (이번 PR 이 이 함수는 정확히 이 패턴으로 옮겨 놓음)
    savedExecution.finishedAt = new Date();
    savedExecution.durationMs =
      resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;
    ```
  - 상세: `terminal-duration.ts` 도입부 주석은 "`startedAt.getTime()` 이 throw 해 종결 emit
    자체가 사라지는 회귀가 났다(catch 가 삼켜 COMPLETED 가 FAILED 로 뒤집혔다)"를 헬퍼 존재
    이유로 명시한다. 그런데 정작 `completeRetryExecution` 은 그 원인이 됐던 것과 정확히 같은
    형태(`.getTime() - .getTime()`, 가드 없음)를 이번 PR 이후에도 그대로 쓴다. 게다가
    `completeRetryExecution` 은 `resumeGraphAfterRetry` 의 `nodes.length === 0`("그래프에 노드가
    없으면") defensive fallback 에서 호출되는 함수다(708행 위 707행, 792-798행) — 바로 그
    "노드 없는 그래프" 시나리오가 문서가 지목한 회귀 트리거와 동일 조건이다. 같은 함수의 emit
    호출부(730행)는 이미 `resolveTerminalDurationMs(execution)` 을 쓰도록 고쳐졌는데, 값을
    **계산**하는 712-714는 고쳐지지 않아 계산과 emit 사이에 마이그레이션이 절반만 된 상태로
    남았다 — 함수 하나 안에서 "옛 위험한 계산 → 새 안전한 조회"가 공존하는 모순된 형태다.
  - 제안: 712-714 를 `resumeGraphAfterRetry`(893-896)·engine 쪽 여러 지점과 동일하게
    `execution.durationMs = resolveTerminalDurationMs(execution) ?? execution.durationMs;`
    로 통일해 헬퍼 도입 취지를 이 함수에도 적용할 것.

- **[WARNING]** 테스트 파일의 queryBuilder mock 리터럴이 18~23곳에 반복 — 이번 diff 가 그 비용을
  실측으로 보여준다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    (19,739줄짜리 파일 전체에서 `setParameter: jest.fn()` 18곳, `returning: jest.fn()` 23곳 실측 —
    diff 상으로는 최소 16개 지점, 예: 292, 384, 401, 501, 1986, 2981, 3163, 3307, 3441, 4375,
    14780, 16283, 16873, 17429, 18963, 19398행 부근)
  - 상세: `{ update, set, where, andWhere, execute }` 형태의 `jest.fn().mockReturnThis()` 체인이
    파일 전체에 걸쳐 손으로 복제돼 있고, 이번 PR 은 `setParameter`/`returning` 두 메서드를
    추가하기 위해 그 복제된 지점 16곳 이상을 개별적으로 편집해야 했다. "필드 하나 추가에
    N곳을 고쳐야 한다"는 것 자체가 이 구조의 유지보수 비용을 이 PR 이 직접 실증한 사례다.
  - 제안: 공유 팩토리(예: `makeUpdateQueryBuilderMock(overrides?)`)를 도입해 이 mock 형태를
    한 곳에서 관리하면, 다음 필드 추가는 팩토리 1곳만 고치면 된다. 이번 PR 스코프에서 강제할
    사항은 아니나 스코프가 매우 큰 다음 리팩터 후보로 남겨 둘 만하다.

- **[INFO]** `TERMINAL_DURATION_MS_SQL` 이 `TERMINAL_FINISHED_AT_PARAM` 의 문자열 값을
  하드코딩으로 재중복 — 단위 테스트가 사후 방어할 뿐 구조적으로 어긋날 수 없게 만들지는 않음
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` 75-79
    ```ts
    export const TERMINAL_DURATION_MS_SQL =
      'GREATEST(0, (EXTRACT(EPOCH FROM (:terminalFinishedAt::timestamptz - started_at)) * 1000)::bigint)::int';
    export const TERMINAL_FINISHED_AT_PARAM = 'terminalFinishedAt';
    ```
  - 상세: 파라미터 이름 `terminalFinishedAt` 이 SQL 문자열 리터럴과 상수 값 두 곳에 각각 하드코딩돼
    있다. `terminal-duration.spec.ts` 가 `TERMINAL_DURATION_MS_SQL.toContain(':' +
    TERMINAL_FINISHED_AT_PARAM)` 로 어긋남을 검증하지만, 이는 사후 안전망이지 애초에 어긋날
    가능성을 제거하지는 않는다.
  - 제안: `TERMINAL_FINISHED_AT_PARAM` 을 먼저 선언하고
    `` `GREATEST(0, ... :${TERMINAL_FINISHED_AT_PARAM}::timestamptz ...)` `` 처럼 템플릿
    리터럴로 참조하면 drift 자체가 구조적으로 불가능해진다(기존 단위 테스트는 회귀 캐너리로
    유지해도 무방).

- **[INFO]** `resolveTerminalDurationMs` 의 파라미터명 `row` — 실제 호출부 대부분이 raw DB row 가
  아니라 로드된 TypeORM 엔티티 인스턴스를 넘긴다
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` 28-32
    (`resolveTerminalDurationMs(row: { durationMs?...; startedAt?...; finishedAt?... })`)
  - 상세: 실제 호출부(`execution-engine.service.ts`의 `savedExecution`, `retry-turn.service.ts`의
    `execution`/`savedExecution`)는 전부 로드된 `Execution` 엔티티다. 반면 함수/파일 주석은
    "부분 select 로 로드된 행"·"raw 원본 행" 을 언급하며 `row` 라는 이름을 정당화하는데, 이
    이름이 "DB 에서 막 나온 원시 레코드"를 연상시켜 엔티티 인스턴스를 넘기는 실제 사용 패턴과
    약간 어긋난다. 구조적 타이핑이라 동작에는 문제없다.
  - 제안: `row` → `subject`/`entity` 등으로 개명하면 두 종류 호출부(엔티티 vs raw RETURNING 행)
    를 모두 아우르는 이름이 된다. 강제 사항 아님.

---

## 요약

핵심 로직(`terminal-duration.ts` 의 `resolveTerminalDurationMs`/`toFiniteNumber`/
`TERMINAL_DURATION_MS_SQL`)은 단일 책임·풍부한 근거 주석·꼼꼼한 엣지케이스 테스트(부재·Invalid
Date·시계 역행·NaN·0·문자열 숫자)를 갖춰 가독성·네이밍·복잡도 면에서 모범적이다. 다만 이 헬퍼가
"5경로에 손으로 반복하면 갈린다"는 문제의식으로 만들어졌음에도, 그 문제의식이 완전히 관철되지
않은 지점이 셋 있다: (1) `RETURNING` 원본에서 `duration_ms` 를 뽑는 3줄짜리 표현이 정확히 5곳에
여전히 복제돼 있고, (2) `cancelParkedExecution`/`markWebChatIdleTimeout` 이라는 스스로 "완전히
동형"이라 부르는 중복 함수 쌍에 신규 블록이 또 한 번 손으로 두 번 붙었으며, (3) 헬퍼가 만들어진
계기(빈 그래프에서 `.getTime()` throw)와 정확히 같은 조건에서 호출되는 `completeRetryExecution`
은 마이그레이션에서 누락돼, 계산부만 옛 무가드 패턴을 유지한 채 emit 부만 새 헬퍼를 쓰는
어중간한 상태로 남았다. 테스트 파일의 queryBuilder mock 반복(18~23곳)도 이번 diff 의 편집
범위 자체가 그 비용을 실측으로 드러낸다. CRITICAL 급 결함은 없고, 전부 "지금 당장 막을 사유는
아니지만 다음에 같은 필드가 하나 더 늘면 비용이 선형이 아니라 곱으로 커진다"는 성격의 WARNING
이다.

## 위험도

MEDIUM
