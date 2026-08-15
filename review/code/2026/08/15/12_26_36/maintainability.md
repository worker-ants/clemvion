# Maintainability Review — `durationMs` 종결 3종 emit (2026-08-15 12:26, 9차 누적 라운드)

## 방법론

이 changeset 은 같은 PR 이 오늘 이미 8차례(`09_58_24` ~ `11_59_09`) 코드 리뷰·수정을 거친
누적 diff다. 프롬프트 diff 는 다수 파일(`execution-engine.service.ts`,
`execution-engine.service.spec.ts`, `terminal-duration.ts`/`.spec.ts` 등)에서 예산 초과로
생략돼, `git diff origin/main -- <path>` 와 `Read`/`grep` 으로 실제 소스를 직접 열어 확인했다.
직전 라운드(`11_59_09`)가 남긴 유일한 신규 INFO(“JSDoc 산문이 `PG_INT4_MAX` 를
`2147483647` 리터럴로 설명”)가 최종 커밋 `ef1ed21d7` 로 해소됐는지도 재검증했다.

핵심 리뷰 대상은 생산 코드 7개 파일이다: `terminal-duration.ts`(신규 헬퍼),
`execution-engine.service.ts`(16 emit 경로 중 대다수 배관), `retry-turn.service.ts`,
`chat-channel/{dispatcher,types}.ts`, `dashboard/statistics service.ts` 2개. `review/**`,
`plan/**` 하위 다수 파일은 이 저장소 표준 워크플로 산출물(리뷰·consistency 결과 커밋)이라
코드가 아니므로 이번 관점 리뷰 대상에서 제외했다.

## 발견사항 (잔여 — 전부 과거 라운드에서 근거와 함께 이미 보류된 항목, 재차단 아님)

- **[INFO]** raw UPDATE 5경로의 `RETURNING` 파싱 스니펫이 verbatim 복제돼 있고, 그중
  `toFiniteNumber(...) ?? null` 의 `?? null` 부분은 논리적으로 무의미하다(엄밀히는 신규
  관찰이지만 상위 중복 자체는 8라운드 전부터 보류된 항목이라 같은 급으로 묶는다)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1045-1049`
    (`cancelParkedExecution`), `:1182-1186`(`markWebChatIdleTimeout`), `:2861-2865`
    (`markExecutionCancelled`), `:2910-2914`(`markQueueWaitTimeout`), `:3363-3367`
    (`finalizeStalledExhausted`)
  - 상세: `toFiniteNumber(v: unknown): number | null` 은 항상 `number | null` 을 반환하고
    `undefined` 를 반환할 수 없다(`codebase/backend/src/shared/utils/terminal-duration.ts` 의
    선언·구현 확인). 그런데 5곳 전부 `toFiniteNumber(...) ?? null` 형태로 재차 `?? null` 을
    붙인다 — `null ?? null` 이든 `숫자 ?? null` 이든 `??` 우측이 절대 평가에 영향을 주지
    않는 죽은 코드다. 다음 편집자가 "혹시 `toFiniteNumber` 가 `undefined` 를 낼 수 있나?"
    라고 오해할 여지를 만든다. 스니펫 전체(원본 필드 캐스팅+옵셔널 체이닝)의 5중 복제는
    이미 `09_58_24` RESOLUTION W5 에서 "QueryBuilder 체인이라 얇은 헬퍼로 감싸면 오히려
    호출부가 읽기 어려워진다. 6번째가 생기면 재검토" 로 명시적으로 보류됐고, 지금도
    정확히 5곳으로 재검토 트리거(6번째)에 도달하지 않았다.
  - 제안: 강제 아님. `toFiniteNumber` 의 반환 타입 자체가 `?? null` 을 불필요하게 만드므로
    다음에 이 스니펫을 손댈 때 함께 제거하면 저비용으로 사소한 혼동을 줄일 수 있다.

- **[INFO]** `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스에 동일한
  5줄 설명 주석이 3중 복제돼 있다 (`10_18_38` 라운드부터 이월, 이번 diff 도 변경 없음)
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:392-397`, `:415-420`, `:433-438`
  - 상세: "producer 는 항상 이 키를 싣고 값을 모르면 null" / "그런데 `?` 는 유지한다(consumer
    계약)" 설명이 글자 그대로 반복된다. 세 곳이 물리적으로 떨어져 있어 향후 정책이 바뀌면
    한쪽만 고치고 나머지를 놓칠 drift 표면이지만, 이미 여러 라운드에서 INFO 로 보류됐고
    이번 라운드도 형태·개수 변화가 없다.
  - 제안: 없음(이미 보류 결정). 세 필드가 갈라질 조짐이 보이면 공유 타입/템플릿 리터럴
    타입으로 통합 재검토.

- **[INFO]** `resolveTerminalDurationMs(x)` 를 completed 경로 8곳(`execution-engine.service.ts`
  6곳 + `retry-turn.service.ts` 2곳)에서 각각 대입 시 1회·emit payload 조립 시 1회, 총 2회
  동일 인자로 호출한다 (성능 라운드가 이미 INFO 로 기록, 가독성 관점에서도 동일 결론)
  - 위치: 예 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2412`
    (대입) / `:2424`(재호출), `retry-turn.service.ts:895-896`(대입) / `:907`(재호출)
  - 상세: 두 번째 호출이 안전한 이유(첫 분기 `typeof durationMs === 'number' &&
    Number.isFinite(...)` 가 이미 확정값을 그대로 통과시킴)를 독자가 헬퍼 내부까지 읽어야
    알 수 있다 — 국소적으로는 사소하지만 "왜 같은 표현식을 두 번 쓰는가" 를 헬퍼 구현에
    암묵적으로 의존한다. 영향은 O(1) 순수 함수 재호출뿐이라 무시할 수준.
  - 제안: 없음(강제 아님). 다음 편집 때 대입 결과를 지역 변수로 재사용하면 이 암묵적
    의존을 없앨 수 있다.

## 확인 결과 (직전 라운드 지적의 해소 검증)

- **JSDoc 산문의 `2147483647` 리터럴 drift (`11_59_09` INFO) — 해소 확인.**
  `terminal-duration.ts:89` 가 `` `LEAST({@link PG_INT4_MAX}, …)` `` 로 정정돼 SQL 상수
  정의(`:104`)·테스트 단언(`terminal-duration.spec.ts:78,145`) 전부 `PG_INT4_MAX` 참조로
  통일됐다(`git show ef1ed21d7` 로 직접 확인).
- **`emitCancellationEvent` 호출부 개수·raw-UPDATE 파싱 경로 수 — 변화 없음.** `grep -c
  "emitCancellationEvent("` 5곳, `grep -c "toFiniteNumber("` 5곳으로 지난 라운드와 동일.
- **`dashboard.service.ts`/`statistics.service.ts` 의 신규 `status = :completedStatus` /
  `status = 'completed'` 필터** — 각 파일 기존 스타일(파라미터 바인딩 vs 리터럴)을 그대로
  따라 파일 내부 일관성은 유지된다. 두 파일 사이의 스타일 차이는 이 PR 이 만든 것이 아니라
  기존 컨벤션이며, 컬럼/상태 리터럴 하드코딩 이슈는 이미 `09_58_24` W7 로 등재돼 별도
  트래킹 중이다.

## 요약

9차 누적 라운드 기준 CRITICAL/WARNING 은 없다. 핵심 로직(`resolveTerminalDurationMs`/
`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL`)은 세 개의 작고 순수한 프리미티브로 잘
응집돼 있고, 함수 하나가 과도한 책임을 떠안거나 조건문이 깊게 중첩된 곳은 없다. 네이밍
(`terminalFinishedAt`, `cancelledDurationMs`, `stalledDurationMs`)과 raw-UPDATE 5경로의
구조(계산→`RETURNING`→emit)가 전부 동형이라 패턴을 한 번 익히면 나머지를 바로 읽을 수
있고, `dashboard`/`statistics` 서비스의 1~2줄 SQL 필터 추가도 각 파일 기존 스타일을
그대로 따른다. 직전 라운드가 남긴 유일한 신규 항목(JSDoc 리터럴 drift)은 최종 커밋에서
해소가 확인됐다. 남은 지적은 전부 INFO 급이며 모두 이전 여러 라운드에서 근거와 함께
명시적으로 보류된 항목(주석 3중복·raw-UPDATE 파싱 5중복·헬퍼 이중호출)이고, 이번 라운드는
그 보류 결정을 재검증했을 뿐 개수·형태 악화는 없다. 그중 `?? null` 이 논리적으로 죽은
코드라는 점만 이번에 새로 정밀화해 기록했으나 이 역시 상위 보류 결정의 범위 안에 있다.

## 위험도

LOW
