# Maintainability Review — `durationMs` 종결 3종 emit (2026-08-15 11:59, 8차 누적 라운드)

## 방법론

이 changeset 은 같은 PR 이 오늘 이미 7차례(`09_58_24` ~ `11_44_10`) 리뷰·수정을 거친 누적
diff다. 프롬프트 diff 는 대부분 파일(특히 `execution-engine.service.ts`)에서 예산 초과로
생략돼, `Read`/`grep`/`git log`/`git diff origin/main`(merge-base `e3825cc2c`)로 저장소를
직접 열어 8라운드 전체의 실제 소스 상태를 확인했다. 직전 라운드(`11_44_10`)가 남긴 CRITICAL 1건
(축소하면 W1·W3·W4·INFO2)은 최종 커밋 `777698bbe` 로 조치됐고, 그 조치까지 포함해 재검증했다.

핵심 대상: `terminal-duration.ts`/`.spec.ts`(신규 헬퍼), `execution-engine.service.ts`
(16 emit 경로 배관), `retry-turn.service.ts`, `chat-channel/{dispatcher,types}.ts`.
`review/**` 하위 다수 파일은 이 저장소의 표준 워크플로 산출물(리뷰/consistency 결과 커밋)이며
코드가 아니라 이번 관점의 리뷰 대상에서 제외했다.

## 발견사항

- **[INFO]** `terminal-duration.ts` JSDoc 산문이 여전히 `PG_INT4_MAX` 값을 리터럴
  `2147483647` 로 하드코딩해 설명한다 — 코드(SQL 상수)와 문서 표현이 어긋난 잔여 drift
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:89`
    (`1. **\`LEAST(2147483647, …)\`` 상한** — ...`)
  - 상세: 직전 라운드(`11_44_10` INFO2)가 지적한 "테스트가 상수 대신 리터럴을 재하드코딩"
    문제는 실코드(`terminal-duration.ts:104` SQL 상수 정의, `terminal-duration.spec.ts:145`
    단언)에서 전부 `${PG_INT4_MAX}` 보간으로 통일됐음을 확인했다(`777698bbe`). 다만 SQL 상수
    바로 위 JSDoc 설명문(87~98행)은 여전히 `2147483647` 을 산문 안에 그대로 적는다. 실행에
    영향은 없는 순수 문서지만, 이 상수가 이 PR 에서 두 차례 CRITICAL(SQL 미클램프·JS
    미클램프)의 근거였던 값이라 향후 컬럼을 `BIGINT` 로 넓히며 `PG_INT4_MAX` 를 재정의할 때
    이 한 줄만 갱신을 놓치면 문서가 코드와 어긋난 채로 남는다.
  - 제안: `` `LEAST(\`${PG_INT4_MAX}\`, …)` `` 형태로 산문에서도 상수명을 언급하거나, 숫자
    뒤에 "(`PG_INT4_MAX`)" 를 병기. 강제 사항 아님 — 저비용이라 다음 편집 때 함께 처리 권장.

## 확인 결과 (직전 라운드 지적 사항의 최종 해소 검증)

- **`terminal-duration.spec.ts` 리터럴 하드코딩(`11_44_10` INFO2) — 해소 확인.**
  `:145` 가 `` `LEAST(${PG_INT4_MAX}` `` 보간으로 바뀌어 `76~79행`(`resolveTerminalDurationMs`
  블록의 "SQL 쌍둥이와 같은 상한 상수를 쓴다" 테스트)과 동일 패턴으로 통일됐다. `PG_INT4_MAX`
  가 바뀌어도 두 테스트가 함께 추종한다.
- **`emitCancellationEvent` 호출부 개수 오기(`11_44_10` W3, "4곳"→"5곳") — 해소 확인.**
  `terminal-duration.ts:20` 이 "5곳" 으로 정정됐고, `grep -n "emitCancellationEvent("
  execution-engine.service.ts` 실측 결과 실제 호출부는 정확히 5곳(`:1077,:1210,:2860,:2909,
  :4886`)이다.
- **`markQueueWaitTimeout`/`markWebChatIdleTimeout` mock vacuous 단언(`11_44_10` W1) —
  테스트 신뢰도 문제였고 소스 가독성과는 별개 축이나, 함께 확인**: mock 이 이제
  `raw: [{ id: 'e3', duration_ms: 600000 }]` 를 반환하도록 바뀌어 RETURNING 경로가 실제로
  실행된 상태에서 `durationMs: 600000` 정확 매칭을 단언한다 — 테스트가 스스로 무엇을
  검증하는지 이제 코드만 읽어도 명확하다.
- **plan 문서 취소선 절반 적용(`11_44_10` W4) — 소스 범위 밖이라 이번 라운드 재확인 생략**
  (별도 문서 리뷰 관점 대상).

## 잔여 (기존 라운드가 근거와 함께 이미 보류 — 재확인만, 재차단 아님)

- `resolveTerminalDurationMs(x)` 를 완료 경로 8곳(`execution-engine.service.ts` 6곳 +
  `retry-turn.service.ts` 2곳)에서 각각 두 번(대입 시 1회, emit payload 조립 시 1회) 호출하는
  사소한 중복 — `09_58_24` performance 라운드가 INFO 로 이미 기록, 영향 무시 가능 수준이라
  재차단하지 않는다.
- raw UPDATE 5경로(`execution-engine.service.ts`)의
  `toFiniteNumber((result.raw as Array<Record<string, unknown>> | undefined)?.[0]?.duration_ms)
  ?? null` 파싱 패턴 반복 — `09_58_24` RESOLUTION W5 가 "QueryBuilder 체인이라 얇은 헬퍼로
  감싸면 오히려 호출부가 읽기 어려워진다. 6번째가 생기면 재검토" 로 명시적으로 보류.
  이번 라운드에도 정확히 5곳으로 개수 변화 없음(재검토 트리거 미도달).
- `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스(`chat-channel/types.ts`
  `:392-397`, `:415-420`, `:433-438`)의 동일 5줄 주석 3중 복제 — `10_18_38` 라운드부터 INFO 로
  보류, 이번 diff 에도 변경 없음.

## 요약

8차 누적 라운드 시점 기준, 지난 7라운드가 지적한 실질적 유지보수성 결함(JSDoc 귀속 상실, SQL
리터럴/테스트 리터럴 매직넘버, 호출부 개수 오기, 계산식 비일관성, vacuous mock)은 최종 커밋
`777698bbe` 까지 포함해 소스에서 직접 해소를 확인했다. 핵심 로직(`resolveTerminalDurationMs`/
`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL`)은 세 프리미티브로 잘 응집돼 있고, 이번 라운드가
새로 만든 코드(테스트 mock 값 채움 + 주석 1줄 정정)는 규모가 작고 기존 스타일과 일치한다.
함수 하나가 과도한 책임을 떠안거나 조건문이 깊게 중첩된 곳은 없으며, 네이밍·컨벤션 일관성도
저장소 기존 패턴(`toTerminalErrorPayload` 와 동일 설계)을 따른다. 새로 발견한 항목은 SQL
상한 상수를 설명하는 JSDoc 산문이 여전히 리터럴 숫자를 쓰는 저비용 문서 drift 하나뿐이며(신규
INFO), 나머지 잔여 항목은 전부 과거 라운드가 근거와 함께 명시적으로 보류한 것들로 개수·형태
변화가 없어 재차단하지 않는다.

## 위험도

LOW
