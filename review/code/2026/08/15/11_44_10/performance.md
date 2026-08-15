STATUS=success

===REPORT_MARKDOWN_BELOW===
# 성능(Performance) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (11:44 라운드)

## 방법론 노트

이번 프롬프트는 이전 다섯 라운드(`09_58_24`~`11_29_02`)의 리뷰 산출물(`review/**`)과
`plan/**` 문서까지 누적 포함한 changeset 이며, 프롬프트 크기 제한으로 파일 5·6·9·10
(`execution-engine.service.{ts,spec.ts}`, `terminal-duration.{ts,spec.ts}`)의 diff 가
생략돼 있어 저장소를 직접 열어 대조했다:

- `git show f5c609aa8 --stat` 로 직전 리뷰(`11_29_02`) 이후의 유일한 신규 커밋을 확인 —
  production 로직 변경은 **없다**. `execution-engine.service.ts` 는 JSDoc 주석 문구
  정정(`4곳` → `5곳`) 1줄, `terminal-duration.ts` 는 `PG_INT4_MAX` 상수의 파일 내
  위치만 재배치(JSDoc 고아 수정)했다. 나머지는 `CHANGELOG.md` 문구 정정과 spec
  mock(`markWebChatIdleTimeout` 테스트의 `raw` 반환값) 보정이다.
- `grep -n "resolveTerminalDurationMs\|TERMINAL_DURATION_MS_SQL\|toFiniteNumber"` 로
  `execution-engine.service.ts`·`retry-turn.service.ts` 의 호출부 전수(현재 줄 번호 기준)를
  재확인해 이전 라운드 지적이 유효한지 대조했다.

성능과 실질적으로 관련 있는 프로덕션 파일은 여전히 3개뿐이다:
`execution-engine.service.ts`, `retry-turn.service.ts`, `terminal-duration.ts`(신규).
나머지(`*.spec.ts`, `chat-channel/*`, `CHANGELOG.md`, `plan/**`, `review/**`, `spec/**`)는
런타임 성능과 무관하다.

## 발견사항

- **[INFO]** `resolveTerminalDurationMs` 를 같은 종결 흐름 안에서 두 번 호출 — 필드 확정
  직후 emit payload 를 만들며 동일 인자로 재호출한다 (이전 세 라운드에서 반복 지적된
  항목과 동일 클래스, 코드 위치만 유지)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:639`(대입) /
    `:668`(재호출, `failFirstSegmentSetup`)
  - 위치: 같은 파일 `:2415`/`:2426`, `:2579`/`:2595`, `:3566`/`:3577`, `:4756`/`:4769`,
    `:4884`/`:4888`, `:4945`/`:4967`
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:714`(대입) /
    `:730`(재호출, `completeRetryExecution`), `:896`/`:907`(`resumeGraphAfterRetry`),
    `:949`/`:971`(`failRetryExecution`)
  - 상세: `x.durationMs = resolveTerminalDurationMs(x) ?? x.durationMs;` 로 필드를 확정한
    직후, 몇 줄 뒤 emit payload 조립 시 `durationMs: resolveTerminalDurationMs(x)` 로 같은
    `x` 를 인자로 다시 호출한다. 헬퍼 진입부의 `typeof row.durationMs === 'number' &&
    Number.isFinite(...)` 분기가 첫 호출로 이미 채워진 값을 즉시 반환하므로 결과는 항상
    동일하고 함수 호출만 중복된다. 헬퍼 본체는 O(1) 순수 함수이고 호출 지점 전부가
    실행(execution) 1건 종결 시 1회만 실행되는 경로(노드 순회·배치 루프 안이 아님)라
    실측 영향은 무시할 수준이다.
  - 제안: `durationMs: x.durationMs` 로 직접 참조하거나 대입 시점 반환값을 지역 변수에
    담아 재사용. 세 라운드째 동일 판단(우선순위 낮음, 트래커 등재 대상 아님)이 유지된다.

## 그 외 점검 결과 (문제 없음으로 판정, 이전 라운드와 동일)

- **N+1 쿼리/호출**: 엔티티를 로드하지 않는 raw `UPDATE` 5경로(`cancelParkedExecution`,
  `markWebChatIdleTimeout`, `markExecutionCancelled`, `markQueueWaitTimeout`,
  `finalizeStalledExhausted`)는 `durationMs: () => TERMINAL_DURATION_MS_SQL` 을 같은 `SET`
  절에 넣고 `.returning(['id', 'duration_ms'])` 로 **같은 UPDATE 문장 안에서** 값을
  되받는다(`execution-engine.service.ts:1036/1173/2830/2901/3354`). 별도 SELECT 재조회
  왕복을 추가하지 않는다 — N+1 을 예방하는 방향의 설계. 모든 종결 경로가 실행 1건당
  1회 호출이며 루프 내부 호출이 아니다.
- **알고리즘 복잡도**: `TERMINAL_DURATION_MS_SQL`
  (`CASE WHEN … THEN NULL ELSE LEAST(2147483647, EXTRACT(EPOCH FROM (...)) * 1000) END`)은
  단일 행 `WHERE id = :id` UPDATE 안에서 DB 가 계산 — O(1), PK 매칭. `resolveTerminalDurationMs`/
  `toFiniteNumber` 도 원시값 처리뿐인 O(1) 함수.
- **메모리 할당**: 대규모 배열·객체 생성 없음. `RETURNING` 은 단일 행만 반환한다.
  `terminal-duration.ts` 는 상태 없는 순수 함수 + 상수 2개(`PG_INT4_MAX`,
  `TERMINAL_FINISHED_AT_PARAM`)뿐.
- **캐싱**: `durationMs` 는 실행 1건 종결 시점의 파생값이라 캐싱 대상이 아니다.
- **블로킹 I/O**: 기존과 동일하게 전부 `await` 기반 TypeORM QueryBuilder 호출. 신규 동기
  I/O 없음.
- **불필요한 연산**: `TERMINAL_DURATION_MS_SQL` 문자열 조립은 모듈 로드 시 1회 평가되는
  상수이며 요청 경로에서 반복 조립되지 않는다. 위 INFO 항목 외 중복 계산 없음.
- **데이터 구조**: 변경 없음 — 기존 QueryBuilder 체인에 `setParameter`/`returning` 을
  추가한 것뿐이고, `durationMs?: number | null` 은 원시값 그대로 유지.
- **지연 로딩**: 해당 없음 — 종결 시점에 즉시 필요한 값.
- **금번 라운드 신규 diff(f5c609aa8)**: production 로직 변경 없음(JSDoc 문구·상수 위치
  재배치, spec mock 보정, CHANGELOG 문구 정정). 성능 프로파일에 영향 없음.

## 요약

이번 라운드(`11_44_10`)에서 직전 라운드(`11_29_02`) 이후 추가된 유일한 커밋
(`f5c609aa8`)은 JSDoc 문구 정정·상수 재배치·테스트 mock 보정뿐이며 프로덕션 로직은
전혀 바뀌지 않았다. 성능과 관련된 세 파일(`execution-engine.service.ts`,
`retry-turn.service.ts`, `terminal-duration.ts`)의 실질 구현은 여러 라운드를 거치며
이미 안정화됐다 — 계산을 SQL(`CASE WHEN … LEAST(...)`)로 밀어 넣고 `RETURNING` 으로
같은 UPDATE 문장에서 값을 되받아 N+1 을 만들지 않고, 신규 헬퍼는 전부 O(1) 순수
함수이며 호출 지점 15곳 전부 실행 1건당 1회뿐인 종결 경로다. 유일한 지적은 종결
10개 지점에서 같은 인자로 `resolveTerminalDurationMs` 를 두 번 호출하는 사소한 중복
(INFO)이며, 이는 네 라운드째 동일하게 관측·보류된 항목으로 실질 성능 영향은 무시할
수준이다. 이번 changeset 은 새로운 성능 리스크를 도입하지 않았다.

## 위험도

LOW
