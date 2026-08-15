STATUS=success

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (누적 8차 라운드)

## 방법론

프롬프트 번들이 크기 제한으로 다수 파일(특히 `execution-engine.service.ts`, `terminal-duration.ts`, `terminal-duration.spec.ts` 등)의 diff/전체 컨텍스트를 생략했다. `git diff origin/main -- <path>` 로 실제 diff를 직접 열어 전량 대조했다:

- `codebase/backend/src/shared/utils/terminal-duration.ts` (신규, 전문 대조)
- `codebase/backend/src/shared/utils/terminal-duration.spec.ts` (신규, 전문 대조)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (400줄 diff, 전문 대조)
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (프롬프트 diff 전문 확인)
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`, `types.ts` (프롬프트 diff 전문 확인)

이 changeset 은 이미 이 세션에서 7차례(`09_58_24`~`11_44_10`) 보안 리뷰를 거쳤고, 각 라운드가 매번 CRITICAL 0 / WARNING 0 (NONE~LOW 위험도)으로 수렴했다. 그중 두 차례 CRITICAL(int4 오버플로 → SQL 경로, 이후 JS 경로 재발)이 나온 축은 **성능/안정성 결함**(가용성 — 실행 영구 고착)이었고, 이번 라운드까지 두 경로 모두 `PG_INT4_MAX` 상수 하나를 공유해 클램프됐음을 소스에서 직접 확인했다(`terminal-duration.ts` `resolveTerminalDurationMs`: `Math.min(span, PG_INT4_MAX)` / `TERMINAL_DURATION_MS_SQL`: `` LEAST(${PG_INT4_MAX}, …) ``). 그 결함 자체는 보안(기밀성/무결성/인증·인가) 카테고리가 아니라 가용성 회귀였으므로 이번 리포트에서는 확인 사실로만 기재한다.

## 발견사항

발견된 Critical/Warning 없음. 점검 관점별 확인 결과(INFO)만 기록한다.

- **[INFO]** raw SQL(`TERMINAL_DURATION_MS_SQL`) 삽입에 인젝션 표면 없음 — 재확인
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` (상수 정의, 함수 하단), 사용처 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })` 5곳 — `cancelParkedExecution`, `markWebChatIdleTimeout`, `markExecutionCancelled`, `markQueueWaitTimeout`, `finalizeStalledExhausted`)
  - 상세: SQL 문자열은 모듈 레벨 하드코딩 상수(`'CASE WHEN :terminalFinishedAt::timestamptz < started_at THEN NULL ELSE LEAST(2147483647, …) END'`)이고 사용자 입력이 문자열 결합으로 섞이는 지점이 없다. 유일한 가변 요소인 `:terminalFinishedAt` 플레이스홀더는 5곳 전부 `.setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)` 로 서버가 생성한 `Date` 객체가 바인딩된다(사용자 제어 값이 아니다). `WHERE id = :id AND status = :expected` 가드도 기존과 동일하게 파라미터 바인딩을 유지한다.
  - 제안: 없음(현행 유지). `terminal-duration.spec.ts`에 이미 `TERMINAL_DURATION_MS_SQL`이 `:${TERMINAL_FINISHED_AT_PARAM}` 플레이스홀더를 실제로 포함하는지 검증하는 테스트가 있어 정적 drift를 잡아준다.

- **[INFO]** `RETURNING` 원본 값의 방어적 파싱
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` `toFiniteNumber`, `resolveTerminalDurationMs`
  - 상세: pg 드라이버가 `bigint`/`numeric`을 문자열로 반환하는 상황, `Invalid Date`, 시계 역행(음수), `NaN`/`Infinity`를 전부 `null`로 흡수해 비정상 값이 wire로 나가는 경로를 차단한다. 수신자(webhook/SSE/WS 소비 측) 파싱 오류 유발 가능성을 줄이는 방향.
  - 제안: 없음.

- **[INFO]** 에러 메시지·민감정보 노출 없음
  - 상세: 이번 변경은 실행 소요시간(`durationMs`, 정수 ms 또는 `null`)만 종결 payload에 추가한다. `error.code`/`message`는 기존에 이미 존재하던 고정 문자열(`'EXECUTION_QUEUE_WAIT_TIMEOUT'`, `resumeErrorMessage(code)` 등)이고 이번 diff가 그 값의 생성 로직을 바꾸지 않았다. 스택트레이스·내부 경로·자격증명 등을 새로 실어 보내는 지점은 없다.
  - 제안: 없음.

- **[INFO]** 인증/인가 경계 변경 없음
  - 상세: 5개 raw UPDATE 경로 모두 기존 `WHERE id = :id AND status = :expected` 상태-가드 + `affected` 체크를 그대로 유지한 채 `SET`/`RETURNING` 절만 확장했다. 상태 전이 조건(예: `WAITING_FOR_INPUT`→`CANCELLED`)이 완화되거나 새로운 인가 우회 표면이 열린 지점은 없다.
  - 제안: 없음.

- **[INFO]** 타입 변경(`durationMs?: number` → `durationMs?: number | null`)은 순수 타입 확장이며 보안 영향 없음
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts`, `chat-channel.dispatcher.ts`
  - 상세: 캐스팅 확장(`{ durationMs?: number }` → `{ durationMs?: number | null }`)일 뿐 런타임 검증·인가 로직과 무관.
  - 제안: 없음.

- **[INFO]** 테스트 파일(`*.spec.ts`) mock 확장은 QueryBuilder 체인에 `setParameter`/`returning` stub을 추가한 것뿐이며 보안에 영향 없는 테스트 인프라 변경.

- **[INFO]** 의존성 변경 없음 — 이번 diff는 신규 npm 패키지를 추가하지 않는다(`import`는 전부 저장소 내부 모듈).

## 요약

이번(누적 8차) 라운드는 이전 7차 라운드가 수렴시킨 "CRITICAL/WARNING 없음" 결론을 실제 소스(`git diff origin/main`) 재대조로 재확인했다. `durationMs`를 종결 이벤트(`completed`/`failed`/`cancelled`) payload에 싣기 위해 도입한 raw SQL(`TERMINAL_DURATION_MS_SQL`)은 하드코딩된 상수 문자열이고 유일한 가변 입력(`terminalFinishedAt`)이 서버 생성 `Date` 객체로 항상 파라미터 바인딩되어 SQL 인젝션 위험이 없다. `RETURNING` 값 파싱(`toFiniteNumber`)은 타입이 불확실한 DB 원본 값을 방어적으로 숫자/`null`로 좁혀 비정상 값의 wire 유출을 막는다. 이 세션이 두 차례 겪은 CRITICAL(int4 오버플로 → UPDATE 실패 → 실행 영구 고착)은 가용성 결함이었고 이번 라운드 시점 기준 JS/SQL 두 경로 모두 `PG_INT4_MAX` 공유 상수로 클램프되어 해소된 상태를 확인했다. 인증/인가, 시크릿, 에러 메시지 노출, 암호화, 의존성 등 다른 항목에서도 이번 diff 범위 내 새로운 취약점은 발견되지 않았다.

## 위험도

NONE
