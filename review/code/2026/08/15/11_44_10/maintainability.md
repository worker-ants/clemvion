# Maintainability Review — `durationMs` 종결 3종 emit (2026-08-15 11:44, 7차 라운드)

## 방법론

이번 changeset 은 같은 PR 이 오늘 이미 6차례(`09_58_24`~`11_29_02`) 리뷰·수정을 거친 누적 diff다.
프롬프트 diff 가 큰 파일(`execution-engine.service.ts` 등)에서 생략돼, `Read`/`grep` 으로
현재 소스를 직접 열어 이전 라운드가 지적한 항목들의 실제 해소 여부를 재검증했다.

## 발견사항

- **[INFO]** `terminal-duration.spec.ts` 가 int4 상한을 상수 참조와 리터럴 하드코딩 두 경로로
  중복 검증한다 — 파일 안에서 자기모순적 일관성
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.spec.ts:78`(정상: `TERMINAL_DURATION_MS_SQL).toContain(String(PG_INT4_MAX))`) vs `:145`(`TERMINAL_DURATION_MS_SQL).toContain('LEAST(2147483647'`)
  - 상세: 같은 파일 최상단(`:2`)에서 이미 `PG_INT4_MAX` 를 import 해 두고, 76~79행 테스트는 그 상수를 보간해 "SQL 쌍둥이와 같은 상한 상수를 쓴다" 는 명제를 정확히 검증한다. 그런데 129~146행의 별도 `describe('TERMINAL_DURATION_MS_SQL')` 블록은 같은 상수를 쓰지 않고 `'LEAST(2147483647'` 리터럴을 다시 하드코딩했다. `PG_INT4_MAX` 값이 바뀌면(예: 컬럼을 `BIGINT` 로 넓히며 상수를 재정의) 76~79행은 자동으로 새 값을 추종하지만 145행은 옛 리터럴에 계속 매칭해 **거짓 GREEN** 을 낼 수 있다 — 정확히 이 상수가 이 PR 에서 두 차례 CRITICAL(SQL 경로 미클램프, JS 경로 미클램프) 의 근거였던 값이라 drift 비용이 낮지 않다. 이미 이전 라운드(`11_29_02` testing WARNING/INFO)에서 지적됐고 이번 diff 에도 반영되지 않은 채 남아 있다.
  - 제안: `` `LEAST(${PG_INT4_MAX}` `` 로 보간해 76~79행과 같은 패턴으로 통일. 강제 사항은 아니나 저비용.

- **[INFO]** `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스에 동일한 5줄
  설명 주석이 여전히 3중 복제돼 있다 (이전 라운드부터 이월, 신규 아님)
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:392-397`, `:415-420`, `:433-438`
  - 상세: "producer 는 항상 이 키를 싣고 값을 모르면 null" / "그런데 `?` 는 유지한다(consumer 계약)" 설명이 글자 그대로 반복된다. 세 곳이 물리적으로 떨어져 있어 향후 정책이 바뀌면 한쪽만 고치고 나머지를 놓칠 drift 표면이다. `10_18_38` 라운드에서 이미 INFO 로 기록·보류됐고 이번 diff 에서도 변경이 없다 — 재차단 사유 아님, 상태 확인 목적으로만 재기재.
  - 제안: 없음(이미 보류 결정). 세 필드가 갈라질 조짐이 보이면 공유 타입/템플릿 리터럴 타입으로 통합 재검토.

## 확인 결과 (이전 라운드 지적 사항의 해소 검증)

- **JSDoc 귀속(orphan) 결함 — 해소 확인.** `terminal-duration.ts` 에서 `resolveTerminalDurationMs`
  의 JSDoc(9~35행)이 함수 선언(37행) 바로 위로 재배치돼 있다. 사이에 빈 줄이 하나 있어
  자매 파일(`terminal-error-payload.ts`, 빈 줄 없음)과 스타일이 완전히 같지는 않지만,
  TypeScript 컴파일러(`ts.getJSDocCommentsAndTags`)로 직접 파싱해 확인한 결과 빈 줄 하나는
  JSDoc 귀속에 영향을 주지 않는다(IDE hover·TypeDoc 정상 동작) — 실질적 문제 아님.
- **매직 넘버 — 해소 확인.** `TERMINAL_DURATION_MS_SQL` 의 int4 상한이 `PG_INT4_MAX` named
  export 로 승격돼 SQL 문자열은 `${PG_INT4_MAX}` 보간을 쓰고, `resolveTerminalDurationMs` 도
  같은 상수로 `Math.min(span, PG_INT4_MAX)` 클램프한다 — JS/SQL 두 쌍둥이가 이제 값 하나를
  공유한다.
- **"호출부 4곳" 오기 — 해소 확인.** `emitCancellationEvent` JSDoc 이 "호출부 5곳 모두"로
  정정돼 있고, `grep -c`로 실제 호출부 5곳(`:1077,:1210,:2860,:2909,:4886`)과 일치한다.
- **`driveCallStackResume` 만 옛 계산식을 쓰던 비일관성 — 해소 확인.** 현재 `execution-engine.service.ts:2578-2579`
  가 `resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs` 형태로, 나머지
  8개 "완료" 경로(639, 2414, 3565, 4295, 4755, 4883, 4944 + retry-turn 3곳)와 동형이다.
- **raw `RETURNING` 파싱 5중 복제, `resolveTerminalDurationMs` 동일 인자 2회 호출** — 계속
  현재 상태로 존재하나 이전 라운드에서 근거와 함께 명시적으로 보류된 항목이고 이번 diff 도
  개수·형태가 그대로다 — 재차단 사유 아님.

## 요약

7차 누적 라운드 시점 기준, 이전 라운드들이 지적한 실질적 유지보수성 결함(JSDoc 귀속 상실,
SQL 리터럴 매직 넘버, 호출부 개수 오기, `driveCallStackResume` 만 남은 계산식 비일관성)은
모두 소스에서 직접 해소를 확인했다. 핵심 로직은 `resolveTerminalDurationMs`/`toFiniteNumber`/
`TERMINAL_DURATION_MS_SQL` 세 프리미티브로 잘 응집돼 있고, 함수 하나가 여러 책임을 떠안거나
조건문이 과도하게 중첩된 곳은 없다. 남은 지적은 전부 INFO 급이며 그중 하나(`terminal-duration.spec.ts:145`
가 이미 import 된 `PG_INT4_MAX` 를 두고 값을 다시 하드코딩)만 신규로 기재할 가치가 있는
잔여 항목이고, 나머지(`types.ts` 주석 3중복, raw-RETURNING 파싱 5중복, 헬퍼 중복 호출)는
이미 이전 라운드에서 근거와 함께 보류된 상태 그대로다.

## 위험도

LOW
