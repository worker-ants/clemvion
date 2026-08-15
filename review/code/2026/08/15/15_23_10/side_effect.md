# 부작용(Side Effect) 리뷰

## 검토 범위 요약

`git diff origin/main...HEAD` 기준 실질 실행 경로 변경은 6곳이다: ①
`finalizeCancelledExecution`(`execution-engine.service.ts`)의 `EXECUTION_CANCELLED`
emit 조건이 "무조건" → "guarded UPDATE 반환값 + 재조회 조건부"로 바뀜, ② 그 재조회가
새 DB 라운드트립(`findOneBy`)을 추가하고 `try/catch` 로 감싸 실패를 흡수함, ③
`finalizeGuarded` CANCELLED 분기(`retry-turn.service.ts`)가 `.returning(['duration_ms',
'finished_at'])` 값을 파라미터 엔티티 객체에 되씀(in-place mutation), ④
`InteractionService.getStatus` 응답에 `durationMs` 필드 추가(REST 공개 인터페이스
확장, `STATUS_PROJECTION_COLUMNS` 에도 컬럼 추가), ⑤ `terminal-duration.ts` 에 순수
함수 `toPersistedDate` 신설, ⑥ `execution-status-response.dto.ts` 에 `durationMs`
optional/nullable 필드 추가. 나머지(CHANGELOG·plan·spec·mdx·`review/**` 산출물 —
79개 대상 파일 중 다수)는 문서/이전 라운드 리뷰 산출물이라 실행 경로 side effect
표면이 아니다. 이 diff 는 직전 라운드(`15_00_41`)가 이미 리뷰한 코드에 두 커밋
(`bf0f86ca8`, `6f39a7167`)이 그 라운드의 W1(재조회가 try/catch 밖)·W2(`finishedAt`
되쓰기 절반 누락)를 조치해 누적된 최종 상태다 — 아래 발견사항은 그 최종 상태 기준.

## 발견사항

- **[INFO]** `finalizeCancelledExecution` 의 `EXECUTION_CANCELLED` 발행 조건이
  "무조건" → "DB 실측 조건부"로 변경 (이벤트/콜백 발생 조건 변경)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4899-4950`
    (`finalizeCancelledExecution`)
  - 상세: 종전엔 guarded UPDATE(`updateExecutionStatus`)의 반환값과 무관하게 항상
    `emitCancellationEvent` 를 호출했다. 이제 0행(`persisted=false`)이면 `findOneBy`
    로 재조회해 (a) DB 가 이미 `CANCELLED` 면 발행(DB 정본값으로 `durationMs`/
    `finishedAt` 을 맞춘 뒤), (b) 다른 종결자가 선점(FAILED/COMPLETED)했으면 skip,
    (c)/(d) 재조회 자체가 실패하거나 행이 없으면 skip(fail-closed) 네 갈래로
    나뉜다. 관측 가능한 외부 webhook/SSE/WS 이벤트 스트림의 동작이 실제로 바뀌는
    지점이라 이 리뷰 관점(8. 이벤트/콜백)의 핵심 대상이지만, `CHANGELOG.md`
    "수신자 영향" 절·`plan/in-progress/eia-db-wire-invariant.md`·함수 JSDoc(4869-4880)
    세 곳에 이미 고지돼 있고, 회귀 테스트(`execution-engine.service.spec.ts` 의
    `finalizeCancelledExecution — 0행 매칭의 두 의미` describe 블록, (a)/(b)/(c)/(d)
    네 갈래 각각)가 네 분기를 모두 포함해 결정적으로 고정한다. 반대 방향(무조건
    skip — 사용자가 누른 Stop 이 무음이 되는 결함, `b4d0ca27e`)으로 이미 한 번
    회귀한 이력이 있는 지점이라 특히 주시할 가치가 있다.
  - 제안: 조치 불요 — 3중 고지 + 4갈래 테스트로 이미 방어됨.

- **[INFO]** `finalizeCancelledExecution` 이 0행 매칭 시 새 DB 라운드트립
  (`findOneBy`)을 수행하고, 그 호출을 `try/catch` 로 감싸 실패를 emit-skip 으로
  흡수한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4924-4936`
  - 상세: 두 호출부(`runExecution` catch, `finalizeResumedExecutionOutcome`)가
    모두 이미 `catch` 블록 안이라, 이 재조회가 throw 하면 에러 핸들러 자체가
    터진다 — 그래서 `try/catch` 로 감싸 실패 시 조용히 skip(fail-closed)한다.
    설계 의도가 주석(4924-4936)에 명시돼 있고, 회귀 테스트 `(d) 재조회가 throw
    해도 호출자로 전파하지 않는다` 로 고정돼 있다. 흔치 않은 경로(동시 writer
    선점)에서만 발생하고 PK 단일 행 조회라 비용도 낮다. 새로운 쓰기 부작용은
    아니다.
  - 제안: 조치 불요.

- **[INFO]** `finalizeCancelledExecution`/`finalizeGuarded` 모두 파라미터로 받은
  엔티티 객체(`savedExecution`/`execution`)를 함수 내부에서 직접 mutate 한다
  (`durationMs`, `finishedAt` 재대입) — 참조로 전달된 입력을 되쓰는 side-effect
  패턴이 두 곳 모두에 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4947-4948`
    (`savedExecution.durationMs = live.durationMs ?? …` / `savedExecution.finishedAt
    = live.finishedAt ?? …`); `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:664-673`
    (`execution.durationMs = persistedDuration` / `execution.finishedAt =
    persistedFinishedAt`)
  - 상세: 직접 호출 그래프를 추적한 결과, 두 곳 모두 mutate 직후 같은 함수
    스코프 안에서 emit payload 조립에만 재사용되고 함수가 곧바로 반환된다 —
    `execution-engine.service.ts` 의 세 호출부(`runExecution` catch:4787,
    `finalizeResumedExecutionOutcome`:4787 경유, 노드 경계 cancel:2783)는 모두
    `finalizeCancelledExecution` 호출 직후 `return`; `retry-turn.service.ts` 의
    `failRetryExecution`(950-1003)도 `finalizeGuarded` 반환 직후 같은
    `execution` 객체로 `emitExecution` 을 조립하고 함수가 끝난다. 두 시그니처
    모두 반환 타입이 `void`/`boolean` 이라 "파라미터를 되쓴다"는 계약이 타입
    수준으로 드러나지 않고 JSDoc 산문으로만 설명된다는 점은 유지보수 관점의
    잠재 함정이지만(다음 개발자가 이 헬퍼를 새 호출부에서 재사용하며 `execution`
    을 read-only 로 오인할 수 있음), 이번 diff 의 실제 호출 스코프에서는 파급이
    없다.
  - 제안: 조치 불요(현재 스코프 안전 확인). 재사용 확장 시 JSDoc 에 "호출자는 이
    호출 후 같은 참조로 이전 값을 기대하지 말 것" 한 줄 권장(선택).

- **[INFO]** `ExecutionStatusDto`/`InteractionService.getStatus` 에 `durationMs`
  필드 추가 — 공개 REST 응답 인터페이스 확장이지만 additive/nullable/read-only
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:123-130`
    (`durationMs?: number | null` 선언); `codebase/backend/src/modules/external-interaction/interaction.service.ts:78`
    (`STATUS_PROJECTION_COLUMNS` 에 `'durationMs'` 추가), `:438`
    (`durationMs: execution.durationMs ?? null`)
  - 상세: `GET /api/external/executions/:id` 응답에 새 optional/nullable 필드가
    늘어날 뿐 기존 필드 이름·타입·의미는 그대로다. 기존 클라이언트는 필드를
    무시하면 되므로 breaking 이 아니다. 값은 이미 로드된 영속 컬럼을 그대로
    옮길 뿐(`execution.durationMs ?? null`) 이 요청 경로에서 새 쓰기가 발생하지
    않는다. `??`(널 병합)이라 `durationMs: 0` 이 `null` 로 뭉개지는 회귀도 없다
    (회귀 테스트 `durationMs 0 을 null 로 뭉개지 않는다` 로 확인).
  - 제안: 조치 불요.

- **[INFO]** `toPersistedDate` 신규 export 함수는 순수 함수 — 전역 상태·I/O 없음
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:89-96`
  - 상세: 입력값을 검사해 `Date | null` 을 반환할 뿐 클로저·모듈 스코프 변수
    변경이 없다. `terminal-duration.ts` 를 import 하는 다른 모듈에도 영향 없는
    순수 추가.
  - 제안: 조치 불요.

## 확인했으나 문제 없음

- **시그니처 변경 없음**: `updateExecutionStatus`(public, `Promise<boolean>`)는
  이번 diff 이전부터 이미 이 시그니처였다. 변경은 `finalizeCancelledExecution`
  호출부가 기존에 버리던 반환값을 소비하기 시작한 것뿐이며, 이 public 메서드의
  다른 기존 호출부(`stop()` 등)에는 영향이 없다. `finalizeGuarded` 의 시그니처도
  이번 diff 로 바뀌지 않았다(내부 구현만 `.returning()` + 되쓰기 추가).
- **전역 변수 없음**: `process.env`/`console.*`/`global`/module-scope mutable
  변수 도입이 diff 전체(실행 코드 6개 파일)에서 발견되지 않는다.
  `STATUS_PROJECTION_COLUMNS` 는 `satisfies (keyof Execution)[]` 상수 배열이고
  런타임에 mutate 되지 않는다.
- **파일시스템 부작용 없음**: 코드 변경분 어디에도 신규 파일 I/O 없음.
- **네트워크 호출 없음**: 신규 외부 서비스 호출 없음 — 기존
  `eventEmitter.emitExecution`(자체 `try/catch` 보유, `execution-engine.service.ts:1116-1134`)
  / `executionRepository` 경로 재사용뿐.
- **환경 변수 없음**: 신규 env 읽기/쓰기 없음.
- **`.returning(['duration_ms', 'finished_at'])` 추가(`retry-turn.service.ts:656`)**:
  같은 UPDATE 문 내에서 실행되는 `RETURNING` 절이라 추가 라운드트립이 아니며,
  `(result.affected ?? 0) > 0` 가드(658행) 뒤에서만 `row` 를 읽어 0행일 때
  undefined 접근도 없다.
- **테스트 mock 확장**(`returning: jest.fn().mockReturnThis()`,
  `mockExecutionRepo.findOneBy.mockResolvedValueOnce(...)` 등): `beforeEach`/
  `arrange()` 헬퍼로 매 테스트 재생성되는 로컬 mock 이라 테스트 간 전역 상태
  누수가 없다.
- **문서/이전 라운드 산출물**(`CHANGELOG.md`, `plan/*.md`, `spec/*.md`, `*.mdx`,
  `review/code/2026/08/15/{13_58_27,14_47_14,15_00_41}/**`,
  `review/consistency/2026/08/15/{13_43_10,15_01_13}/**`): 전부 비-실행
  산출물이라 side effect 표면이 아니다.

## 요약

이번 diff 의 실질 부작용은 (1) `EXECUTION_CANCELLED` 이벤트 발행 조건이
무조건에서 "DB 실측 + 재조회" 조건부로 바뀌어 특정 레이스에서 외부 수신자로
가는 이벤트 흐름이 달라지는 것과, (2) 두 종결 헬퍼(`finalizeCancelledExecution`
/ `finalizeGuarded`)가 emit 직전 파라미터 엔티티 객체를 DB 영속값으로 되쓰는
in-place mutation, (3) 0행 매칭 시 새 DB 재조회 라운드트립 1회 추가 — 세 가지다.
모두 CHANGELOG·plan·JSDoc 에 명시 고지된 의도된 변경이며, mutation 은 현재
호출 스코프 안에서만 소비돼 파급이 없음을 호출 그래프 직접 추적으로 확인했다.
재조회는 catch 블록 내부에서 안전하게 실패를 흡수하도록 `try/catch` 로 감싸져
있고, 4갈래 회귀 테스트로 각 분기가 결정적으로 고정돼 있다. REST 응답에 추가된
`durationMs` 필드는 additive·read-only·nullable 이라 인터페이스 파손이 없고,
새 유틸 함수(`toPersistedDate`)는 순수 함수다. 신규 전역 변수·환경 변수·
파일시스템·네트워크 부작용은 발견되지 않았다. CRITICAL/WARNING 급 부작용 없음.

## 위험도

LOW
