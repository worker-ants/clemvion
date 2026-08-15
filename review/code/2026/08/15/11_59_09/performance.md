# 성능(Performance) 리뷰 — EIA 종결 이벤트 `durationMs` (8차 누적 라운드)

## 방법론

이 changeset 은 같은 PR 이 오늘 이미 7차례(`09_58_24`~`11_44_10`) 리뷰·수정을 거친 누적
diff 이며, 성능 리뷰만도 4차례(`09_58_24`/`11_09_44`/`11_29_02`/`11_44_10`, 전부 LOW) 선행했다.
프롬프트 diff 가 생략된 대형 파일(`execution-engine.service.ts` 등)은 `Read`/`grep` 으로
현재 소스를 직접 열어 확인했고, 직전 성능 라운드(`11_44_10`) 이후 실제로 추가된 두 커밋
(`f5c609aa8`, `777698bbe`)의 diff 를 `git show` 로 대조해 신규 성능 관련 변경이 있는지
별도로 검증했다.

- `f5c609aa8`: JSDoc 문구 정정(호출부 "4곳"→"5곳") + `PG_INT4_MAX` 상수 재배치(고아 JSDoc
  해소, 순서만 이동) — 런타임 로직 변경 없음.
- `777698bbe`: 테스트 mock 에 `raw: [{ id, duration_ms: 600000 }]` 값 부여(이전엔 빈 배열이라
  RETURNING 스레딩이 vacuous 하게 통과) + `terminal-duration.spec.ts` 의 리터럴
  `'LEAST(2147483647'` 를 `` `LEAST(${PG_INT4_MAX}` `` 보간으로 통일 — 둘 다 테스트 전용,
  프로덕션 런타임 코드 변경 없음.

즉 직전 성능 라운드 이후 프로덕션 코드에는 **성능에 영향을 주는 변경이 없다**. 아래는
현재 소스 상태 기준의 최종 확인이다.

## 발견사항

- **[INFO]** `resolveTerminalDurationMs`를 같은 함수 안에서 동일 인자로 두 번 호출 — 이전
  라운드부터 이월, 신규 아님
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2415`(대입)
    / `:2426`(재호출), `:2579`/`:2595`, `:3566`/`:3577`, `:4756`/`:4769`, `:4884`/`:4888`,
    `:4945`/`:4967` — `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:714`
    / `:731`, `:896`/`:907`, `:949`/`:971`
  - 상세: `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ??
    savedExecution.durationMs;` 로 값을 확정한 직후, emit payload 를 만들며 같은 인자로
    `resolveTerminalDurationMs(savedExecution)` 를 다시 호출한다. 함수 내부는
    `typeof`+`Number.isFinite` 검사와 산술 1줄뿐인 순수 O(1) 함수이고, 두 번째 호출 시점엔
    이미 `savedExecution.durationMs` 가 유효한 number 로 확정돼 있어 첫 분기에서 즉시
    반환되므로 결과는 동일하지만 함수 호출이 중복된다. 호출부는 실행(execution) 1건의
    종결 시점에 1회만 실행되는 경로이며 노드 순회·배치 루프 내부가 아니므로 실질 비용은
    무시할 수준이다.
  - 제안: `durationMs: savedExecution.durationMs`로 직접 참조하거나 대입 시점 반환값을
    지역 변수에 담아 재사용. 우선순위 낮음(스타일/DRY 성격). `11_44_10` 라운드까지 근거와
    함께 명시적으로 보류된 항목이며 이번 diff 에서도 형태·개수 변화가 없어 재차단 사유
    아님 — 상태 확인 목적으로만 재기재.

## 그 외 점검 결과 (문제 없음, 재확인)

- **N+1 쿼리**: raw UPDATE 5경로(`cancelParkedExecution`/`markWebChatIdleTimeout`/
  `markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted`) 전부
  `WHERE id = :id`(+ 상태 가드) 단일 행 UPDATE 문 안에서 `.set({ durationMs: () =>
  TERMINAL_DURATION_MS_SQL })` 로 계산하고 `.returning(['id', 'duration_ms'])` 로 같은
  왕복에서 값을 되받는다. 별도 SELECT 재조회가 없어 N+1을 만들지 않으며, 노드 순회·배치
  루프 내부에서 호출되지 않는 실행 1건당 1회 종결 경로임을 `grep` 전수로 재확인했다.
- **알고리즘 복잡도**: `TERMINAL_DURATION_MS_SQL`(`CASE WHEN ... THEN NULL ELSE LEAST(...)::int
  END`)은 단일 행 UPDATE 문 안에서 계산되는 O(1) 상수식이고, `resolveTerminalDurationMs`/
  `toFiniteNumber`도 분기+산술 1줄의 O(1) 순수 함수다. 반복·재귀·정렬 등 복잡도에 영향을
  주는 구조 변경 없음.
- **메모리 할당**: 대규모 배열·객체 생성 없음. `result.raw`는 단일 행(`[0]`)만 참조.
- **캐싱**: `durationMs`는 실행 1건 종결 시점에만 계산되는 파생값이라 캐싱 대상이 아님.
- **블로킹 I/O**: 기존과 동일하게 `await` 기반 비동기 TypeORM 호출뿐. 신규 동기 I/O 없음.
- **문자열 연결**: `TERMINAL_DURATION_MS_SQL` 상수 조립은 모듈 로드 시 1회(`+`/template
  literal 결합)뿐이며 요청마다 재조립되지 않는다. 루프 내 문자열 누적 없음.
- **데이터 구조**: 기존 QueryBuilder 체인에 `setParameter`/`returning` 추가뿐, 자료구조
  변경 없음.
- **지연 로딩**: 해당 없음 — raw UPDATE 경로는 애초에 엔티티를 로드하지 않는 설계를
  유지(오히려 불필요한 선행 로드를 피하는 방향).
- **테스트 파일(`*.spec.ts`) mock 확장**: 프로덕션 런타임과 무관, 테스트 스위트 실행 비용
  증가도 무시할 수준.

## 요약

직전 성능 리뷰(`11_44_10`, LOW) 이후 프로덕션 코드에 추가된 변경은 없다(마지막 두 커밋은
JSDoc 문구 정정·상수 재배치·테스트 mock 값 보강뿐). 이번 8차 라운드에서 소스를 직접
재대조한 결과, 종결 이벤트 `durationMs` 배관은 계산을 가능한 한 단일 UPDATE 문 안(SQL
`GREATEST`/`LEAST`+`EXTRACT EPOCH`)으로 밀어넣고 `RETURNING`으로 같은 왕복에서 값을 되받는
설계를 일관되게 유지해 N+1을 만들지 않으며, 모든 헬퍼는 O(1) 순수 함수이고 모든 호출
지점이 실행 1건당 1회뿐인 종결 경로다. 유일한 잔여 지적은 완료 경로 다수에서 동일 인자로
`resolveTerminalDurationMs`를 두 번 호출하는 사소한 중복(INFO, 이전 라운드부터 이월, 실질
영향 무시 가능)이며 신규 성능 리스크는 없다.

## 위험도

LOW
