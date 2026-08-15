STATUS=success

===REPORT_MARKDOWN_BELOW===
# 성능(Performance) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (11:29 라운드)

## 방법론 노트

이번 라운드의 프롬프트 diff 는 대부분 이전 두 리뷰 라운드(`09_58_24`, `10_18_38`)의 산출물
(`review/code/2026/08/15/{09_58_24,10_18_38}/**`, `plan/**`)까지 포함한 누적 changeset이다.
성능과 실질적으로 관련 있는 파일은 여전히 다음 3개뿐이며, 이 diff 는 프롬프트 크기 제한으로
생략돼 있어 `git diff origin/main --stat` / `Read` / `grep` 으로 저장소를 직접 열어 대조했다:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (152 insertions / 36 deletions)
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (24 changed lines, 프롬프트에 전문 포함)
- `codebase/backend/src/shared/utils/terminal-duration.ts` (신규, 107 lines, 프롬프트에 전문 포함)

나머지(`*.spec.ts` 테스트 mock 확장, `chat-channel/dispatcher.ts`·`types.ts` 의 타입 narrowing,
`CHANGELOG.md`, `plan/**`, `review/**`)는 프로덕션 런타임 성능에 영향을 주지 않는다.

## 발견사항

- **[INFO]** `resolveTerminalDurationMs` 를 같은 종결 흐름 안에서 두 번 호출 — 필드 확정 직후
  emit payload 를 만들며 동일 인자로 재호출한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:639`(대입) /
    `:668`(재호출, `failFirstSegmentSetup`)
  - 위치: 같은 파일 `:2415`/`:2426`, `:2579`/`:2595`, `:3566`/`:3577`, `:4756`/`:4769`,
    `:4884`/`:4888`, `:4945`/`:4967` (각각 completed/cancelled/failed 종결 5개 메서드)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:713-714`(대입) /
    `:730`(재호출, `completeRetryExecution`), `:895-896`/`:907`(`resumeGraphAfterRetry`),
    `:948-949`/`:971`(`failRetryExecution`)
  - 상세: `x.durationMs = resolveTerminalDurationMs(x) ?? x.durationMs;` 로 필드를 확정한 직후,
    몇 줄 뒤 emit payload 를 만들며 `durationMs: resolveTerminalDurationMs(x)` 로 **같은 `x`**
    를 인자로 다시 호출한다. `resolveTerminalDurationMs` 는 진입부에서
    `typeof row.durationMs === 'number' && Number.isFinite(row.durationMs)` 를 검사하는데,
    첫 호출이 이미 그 필드를 유효한 숫자로 채워 놓았으므로 두 번째 호출은 이 분기에서
    즉시 반환한다 — 결과는 항상 동일하고 함수 호출만 중복이다. 총 10개 지점에서 반복되는
    형태다.
  - 영향: `resolveTerminalDurationMs` 본체는 `typeof`+`Number.isFinite` 검사와 `Date.getTime()`
    산술 한 줄뿐인 O(1) 순수 함수이고, 호출 지점 전부가 노드 순회·배치 루프가 아니라 실행
    (execution) 1건이 종결되는 시점에 딱 한 번 실행되는 경로다. 실질 성능 영향은 무시할
    수준이며 스타일/DRY 성격에 가깝다.
  - 제안: `durationMs: x.durationMs` 로 이미 대입된 필드를 직접 참조하거나, 대입 시점의
    반환값을 지역 변수에 담아 재사용. 우선순위는 낮음.

## 그 외 점검 결과 (문제 없음으로 판정)

- **N+1 쿼리/호출**: 엔티티를 로드하지 않는 raw `UPDATE` 5경로(`cancelParkedExecution`,
  `markWebChatIdleTimeout`, `markExecutionCancelled`, `markQueueWaitTimeout`,
  `finalizeStalledExhausted`)는 `durationMs: () => TERMINAL_DURATION_MS_SQL` 을 같은 `SET`
  절에 넣고 `.returning(['id', 'duration_ms'])` 로 **같은 UPDATE 문장 안에서** 값을 되받는다.
  UPDATE 후 별도 SELECT 로 재조회하는 왕복을 추가하지 않았다 — 오히려 N+1 을 예방하는
  방향의 설계다. 모든 종결 경로가 실행(execution) 1건당 1회 호출이며, 노드 순회·배치 루프
  내부에서 호출되지 않는다(`grep`으로 15개 호출부 전수 확인).
  - 참고(이 PR 범위 밖): `recoverOrphanPendingExecutions`(`execution-engine.service.ts` 내,
    이번 diff 미포함 — `git diff origin/main` 확인 결과 무변경)는 orphan pending 실행 목록을
    순회하며 `await this.markQueueWaitTimeout(id)` 를 직렬 호출하는 pre-existing 패턴이다.
    boot-only/on-demand 스캔이고 admission cap+5분 timeout 으로 대상 집합이 유계라는 주석이
    이미 있으며, 이 PR 이 그 루프나 호출 빈도를 바꾸지 않았다 — 새 회귀 아님.
- **알고리즘 복잡도**: `TERMINAL_DURATION_MS_SQL`
  (`CASE WHEN … THEN NULL ELSE LEAST(2147483647, EXTRACT(EPOCH FROM (...)) * 1000) END`)은
  단일 행 `WHERE id = :id` UPDATE 문 안에서 DB 가 계산 — O(1), PK 매칭이라 인덱스 스캔도
  상수 시간. `resolveTerminalDurationMs`/`toFiniteNumber` 도 원시값 처리뿐인 O(1) 함수.
- **메모리 할당**: 대규모 배열·객체 생성 없음. `result.raw` 는 `RETURNING` 단일 행(`[0]`)만
  참조하고 즉시 버려진다. 신규 파일 `terminal-duration.ts` 도 상태를 갖지 않는 순수 함수 +
  상수 2개뿐.
- **캐싱**: `durationMs` 는 실행 1건의 종결 시점에만 계산되는 파생값이라 캐싱 대상이 아니다
  (반복 호출·재사용되는 계산이 아님). 캐시 무효화 전략도 해당 없음.
- **블로킹 I/O**: 기존과 동일하게 전부 `await` 기반 TypeORM QueryBuilder 호출. 새로 동기 I/O
  를 추가하지 않았다.
- **불필요한 연산**: 문자열 연결(`TERMINAL_DURATION_MS_SQL` 조립)은 모듈 로드 시 1회 평가되는
  상수이며 요청 경로에서 반복 조립되지 않는다. 위 [INFO] 항목 외 중복 계산 없음.
- **데이터 구조**: 변경 없음 — 기존 QueryBuilder 체인에 `setParameter`/`returning` 을 추가한
  것뿐이고, 엔티티 필드(`durationMs?: number`)는 원시 숫자 그대로 유지.
- **지연 로딩**: 해당 없음(즉시 계산이 필요한 종결 시점 값).
- **테스트 파일(`*.spec.ts`) mock 확장**: `setParameter`/`returning` mock 을 다수의 QueryBuilder
  체인 리터럴에 반복 추가했다(scope 리뷰가 이미 "파일 전역 default mock 파급"으로 실측
  확인). 프로덕션 런타임과 무관하고 테스트 스위트 실행 비용 증가도 무시할 수준.

## 요약

이번 라운드에서 실제로 변경된 프로덕션 코드(`execution-engine.service.ts`,
`retry-turn.service.ts`, 신규 `terminal-duration.ts`)는 이전 두 라운드의 리뷰·수정을 거치며
이미 안정화된 상태다. 계산을 가능한 한 SQL(`CASE WHEN … LEAST(...)`)로 밀어 넣고
`RETURNING` 으로 같은 UPDATE 문장 안에서 값을 되받는 설계를 택해 추가 SELECT 왕복(N+1)을
만들지 않았고, 신규 헬퍼(`resolveTerminalDurationMs`/`toFiniteNumber`)는 전부 O(1) 순수
함수이며 호출 지점 15곳 전부가 실행(execution) 1건당 1회뿐인 종결 경로다(노드 수·행 수에
비례하는 반복 패턴 없음). 유일한 지적은 종결 10개 지점에서 같은 인자로
`resolveTerminalDurationMs` 를 두 번 부르는 사소한 중복 계산(INFO)이며, 이는 직전
`09_58_24` 라운드의 성능 리뷰가 이미 같은 클래스로 지적·보류한 항목이 코드 위치만 이동한
채 그대로 남아 있는 것이다(이번 라운드에서 추가된 새 지점 3곳도 동일 패턴). 실질 성능
영향은 무시할 수준이며 이번 changeset 이 새로운 성능 리스크를 도입하지 않았다.

## 위험도

LOW
