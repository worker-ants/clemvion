# 부작용(Side Effect) 리뷰

## 검토 범위 요약

이번 diff 의 실질 side-effect 표면은 4곳이다: ① `finalizeCancelledExecution`
(`execution-engine.service.ts`) 의 emit 조건이 무조건 → guarded UPDATE 결과 조건부로 바뀜,
② `finalizeGuarded` CANCELLED 분기(`retry-turn.service.ts`)가 `RETURNING` 값을 파라미터
객체에 되씀, ③ `InteractionService.getStatus` 응답에 `durationMs` 필드 추가(REST 공개
인터페이스 확장), ④ `terminal-duration.ts` 에 순수 함수 `toPersistedDate` 신설. 나머지
(CHANGELOG·plan·spec·mdx·이전 라운드 review 산출물)는 문서/산출물이라 실행 경로에 영향이
없다.

## 발견사항

- **[INFO]** `finalizeCancelledExecution` 의 `EXECUTION_CANCELLED` 발행 조건이 "무조건" →
  "DB 실측 조건부"로 바뀌어, 특정 레이스(동시 writer 가 이미 FAILED/COMPLETED 로 선점)에서
  외부 webhook/SSE/WS 수신자에게 가던 이벤트가 더 이상 나가지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 함수
    `finalizeCancelledExecution` (`persisted` 분기, JSDoc "emit 조건 (2026-08-15 정정)" 문단)
  - 상세: 관측 가능한 외부 이벤트 스트림의 동작이 바뀌는 것은 이 리뷰 관점(8. 이벤트/콜백)의
    핵심 대상이라 명시적으로 기록한다. 다만 이 변경은 CHANGELOG (`CHANGELOG.md` "수신자 영향"
    절)·plan(`plan/in-progress/eia-db-wire-invariant.md`)·JSDoc 세 곳에 이미 명시 고지돼
    있고, 반대 방향 회귀(무조건 skip — 사용자가 누른 Stop 이 무음이 되는 결함)를 이전 라운드가
    이미 겪고 되돌린 이력이 있으며, 현재 코드는 (a) DB 가 CANCELLED 면 발행 (b) 다른 종결자가
    이겼으면 skip 두 갈래를 정확히 재조회로 가른다. 새 회귀는 아니며 정상화다.
  - 제안: 조치 불요 — 이미 CHANGELOG/plan/JSDoc 3중 고지 상태.

- **[INFO]** `finalizeCancelledExecution` 이 guarded UPDATE 0행일 때 `findOneBy` 재조회를
  새로 수행한다 — 이 경로에 한해 DB 라운드트립이 1회 추가된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 함수
    `finalizeCancelledExecution`, `!persisted` 분기의 `this.executionRepository.findOneBy(...)`
    호출
  - 상세: 0행 매칭(동시 writer 선점)이라는 흔치 않은 경로에서만 발생하고, PK(`id`) 단일 행
    조회라 비용이 낮다. emit 여부를 정확히 판정하기 위한 의도된 추가 읽기이며 쓰기 side
    effect 는 아니다.
  - 제안: 조치 불요.

- **[INFO]** `finalizeCancelledExecution`/`finalizeGuarded` 모두 파라미터로 받은 엔티티
  객체(`savedExecution`/`execution`)를 함수 내부에서 직접 mutate 한다 (`durationMs`,
  `finishedAt` 재대입) — 참조로 전달된 입력을 되쓰는 고전적인 side-effect 패턴
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    함수 `finalizeCancelledExecution` 의 `savedExecution.durationMs = live.durationMs ?? ...`
    / `savedExecution.finishedAt = live.finishedAt ?? ...` 대입부; 그리고
    `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 함수
    `finalizeGuarded` 의 `execution.durationMs = persistedDuration` /
    `execution.finishedAt = persistedFinishedAt` 대입부
  - 상세: 두 곳 모두 즉시 호출자가 같은 객체를 emit payload 조립에만 재사용하고 함수가 곧바로
    반환(또는 `return`)하는 좁은 스코프 안에서만 살아 있어(직접 확인:
    `execution-engine.service.ts` 의 세 호출부 — `runExecution` catch, resume 세그먼트,
    노드 경계 cancel — 모두 호출 직후 `return`; `retry-turn.service.ts` 의 `failRetryExecution`
    도 `finalizeGuarded` 반환 직후 같은 `execution` 으로 emit 조립) 실제 side effect 파급은
    없다. `resolveTerminalDurationMs` 가 이미 채워진 `durationMs` 를 그대로 반환하는 첫 분기를
    타므로, `finishedAt` 만 갱신되고 `durationMs` 되쓰기가 (드문 파싱 실패로) 누락되는 부분
    되쓰기 상황에서도 emit 값 자체는 왜곡되지 않는다. 다만 "emit 헬퍼가 입력 파라미터를
    되쓴다"는 계약은 두 함수 어디의 시그니처에도 타입으로 드러나지 않고 JSDoc 산문으로만
    설명된다 — 이 헬퍼들을 본떠 새 guarded 경로를 추가하는 다음 개발자가 파라미터를
    read-only 로 오인해 뒤에서 그 객체를 재사용(예: 로깅·다른 emit)하면 되쓰인 값을 보게
    된다.
  - 제안: 조치 불요(현재 호출 스코프에서는 안전). 다만 이 두 헬퍼를 새 호출부에서 재사용할
    계획이 생기면, JSDoc 의 "값은 방어적으로 채워 둔다"/"영속값을 in-memory 에 되쓴다" 문구
    옆에 "호출자는 이 호출 후 같은 참조로 이전 값을 기대하지 말 것" 한 줄을 명시해 두면
    향후 실수를 예방할 수 있다.

- **[INFO]** `ExecutionStatusDto`/`getStatus` 에 `durationMs` 필드 추가 — 공개 REST 응답
  인터페이스 확장이지만 additive/nullable/read-only
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
    (`durationMs?: number | null` 선언부); `codebase/backend/src/modules/external-interaction/interaction.service.ts`
    (`durationMs: execution.durationMs ?? null` 조립부), `STATUS_PROJECTION_COLUMNS` 배열에
    `'durationMs'` 추가
  - 상세: `GET /api/external/executions/:id` 응답에 새 optional/nullable 필드가 하나
    늘어난다. 기존 클라이언트는 필드를 무시하면 되므로 breaking 이 아니고, 값은 영속 컬럼을
    그대로 옮길 뿐 이 요청 경로에서 새 쓰기가 발생하지 않는다(직접 확인 — `getStatus` 응답
    조립부 전체가 `execution` 읽기 전용 프로퍼티 매핑). `??`(널 병합)을 사용해 `durationMs:
    0` 이 `null` 로 뭉개지는 회귀도 없다(회귀 테스트로 확인됨).
  - 제안: 조치 불요.

- **[INFO]** `toPersistedDate` 신규 export 함수는 순수 함수 — 전역 상태·I/O 없음
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` 함수 `toPersistedDate`
  - 상세: 입력값을 검사해 `Date | null` 을 반환할 뿐 클로저 상태·모듈 스코프 변수 변경이
    없다. `terminal-duration.ts` 는 공유 유틸이라 이 함수를 import 하는 다른 모듈에도 영향이
    없는 순수 추가다.
  - 제안: 조치 불요.

## 확인했으나 문제 없음

- **시그니처 변경 없음**: `updateExecutionStatus`(public, `Promise<boolean>`)는 이번 diff
  이전부터 이미 이 시그니처였다. 이번 변경은 `finalizeCancelledExecution` 호출부가 기존에
  버리던 반환값을 소비하기 시작한 것뿐이며, 이 public 메서드의 다른 기존 호출부(`stop()`
  등)에는 영향이 없다.
- **전역 변수 없음**: `process.env`/`console.*`/`global`/module-scope mutable 변수 도입은
  diff 전체(코드 6개 파일)에서 발견되지 않는다. `STATUS_PROJECTION_COLUMNS` 는 select 목록
  상수(`satisfies (keyof Execution)[]`)로 mutate 되지 않는다.
- **파일시스템 부작용 없음**: 코드 변경분 어디에도 신규 파일 I/O 없음.
- **네트워크 호출 없음**: 신규 외부 서비스 호출 없음 — 기존 `eventEmitter.emitExecution` /
  `executionRepository` 경로 재사용뿐.
- **환경 변수 없음**: 신규 env 읽기/쓰기 없음.
- **retry-turn.service.ts 의 `.returning(['duration_ms', 'finished_at'])` 추가**: 같은
  UPDATE 문 내에서 실행되는 `RETURNING` 절이라 추가 라운드트립이 아니며, `(result.affected ??
  0) > 0` 가드 뒤에서만 `row` 를 읽어 0행일 때 undefined 접근도 없다.
- **테스트 mock 확장(`returning: jest.fn().mockReturnThis()` 등)**: `beforeEach` 로 매
  테스트 재생성되는 로컬 mock 체인에 메서드를 추가하는 것뿐이라 테스트 간 전역 상태 누수가
  없다.
- **문서 파일(CHANGELOG.md, plan/*.md, mdx, spec/*.md, review/**)**: 전부 비-실행 산출물이라
  side effect 표면이 아니다. `review/code/2026/08/15/{13_58_27,14_47_14}/**` 는 이전 라운드
  세션의 정규 산출물이지 이번 코드 변경의 부작용이 아니다.

## 요약

이번 diff 의 실질 부작용은 (1) `EXECUTION_CANCELLED` 이벤트 발행 조건이 무조건에서 DB 실측
조건부로 바뀌어 특정 레이스에서 외부 수신자에게 가는 이벤트가 줄어드는 것과 (2) 두 종결
헬퍼가 emit 직전 파라미터 엔티티 객체를 DB 영속값으로 되쓰는 in-place mutation 두 가지다.
둘 다 CHANGELOG·plan·JSDoc 에 명시 고지된 의도된 변경이며, mutation 은 현재 호출 스코프
안에서만 소비돼 실제 파급이 없음을 직접 코드 추적으로 확인했다. REST 응답에 추가된
`durationMs` 필드는 additive·read-only·nullable 이라 인터페이스 파손이 없고, 새 유틸
함수는 순수 함수다. 신규 전역 변수·환경 변수·파일시스템·네트워크 부작용은 발견되지 않았다.
CRITICAL/WARNING 급 부작용 없음.

## 위험도

LOW
