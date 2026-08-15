STATUS=success

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (누적 5차 라운드)

## 리뷰 범위 및 방법

프롬프트 번들에서 크기 제한으로 diff 가 생략된 파일(`execution-engine.service.ts`,
`execution-engine.service.spec.ts`, `terminal-duration.ts`, `terminal-duration.spec.ts`,
`plan/**`)은 `git diff origin/main -- <path>` 로 직접 열어 전문 대조했다. 나머지는 프롬프트에
실린 gated unified diff 를 그대로 사용했다. 추가로 저장소 전체 diff 에 대해 하드코딩 시크릿
패턴(`api[_-]?key|secret|password|token|BEGIN (RSA|EC|PRIVATE)|AKIA…|JWT 형태`)을 grep 했다.

이 브랜치는 같은 `durationMs` 배관 작업에 대해 이미 6차례(`09_58_24`~`11_29_02`) ai-review 를
거쳤고, 매 라운드 security reviewer 가 **위험도 NONE** 으로 판정했다. 이번 라운드에서 코드
자체를 재대조한 결과 그 판정을 뒤집을 신규 결함은 발견하지 못했다.

## 발견사항

- **[INFO]** raw SQL 상수 삽입은 하드코딩 문자열 + 파라미터 바인딩으로 안전하게 처리됨
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:102-105`
    (`TERMINAL_DURATION_MS_SQL` 정의), 사용처
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
    `cancelParkedExecution`·`markWebChatIdleTimeout`·`markExecutionCancelled`·
    `markQueueWaitTimeout`·stalled 소진 UPDATE 5곳 (`.set({ durationMs: () =>
    TERMINAL_DURATION_MS_SQL })` + `.setParameter(TERMINAL_FINISHED_AT_PARAM,
    terminalFinishedAt)`)
  - 상세: `.set({ ... : () => <string> })` 는 TypeORM `QueryBuilder` 가 함수 반환 문자열을
    SET 절에 raw SQL 로 삽입하는 API 라 일반적으로 인젝션 표면이 되지만, 여기서 삽입되는
    문자열은 **모듈 상수**(사용자 입력이 전혀 섞이지 않는 리터럴)이고, 그 안의 유일한
    가변 요소인 `:terminalFinishedAt` 플레이스홀더는 5곳 전부에서 서버가 생성한 `Date`
    객체(`new Date()`)로 `setParameter` 바인딩된다. `WHERE`/`AND WHERE` 절도 기존과 동일하게
    `:id`/`:waiting`/`:pending`/`:running` 파라미터 바인딩을 유지한다. 문자열 결합
    (concatenation)이 전혀 없어 SQL 인젝션 표면이 없다.
  - 제안: 없음(현행 유지). `terminal-duration.spec.ts` 가 플레이스홀더 이름·`LEAST`/`NULL`
    형태를 정적으로 고정해 향후 drift 도 잡는다.

- **[INFO]** `RETURNING` 원본 값 흡수 시 방어적 파싱으로 비정상 값의 wire 유출을 차단
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:71`(`toFiniteNumber`),
    `:37`(`resolveTerminalDurationMs`)
  - 상세: pg 드라이버가 `bigint`/`numeric` 을 문자열로 반환하는 경우, `Invalid Date`, 시계
    역행(음수), `NaN`/`Infinity`, int4 상한 초과 등을 전부 `null` 또는 saturate 로 흡수해
    비정상 값이 그대로 클라이언트/webhook 수신자에게 전달되는 경로를 차단한다. 클라이언트
    측 파싱 오류·오정보 전파 가능성을 줄이는 방향.
  - 제안: 없음.

- **[INFO]** 상태 필터 파라미터(`:completedStatus`)는 서버 상수(enum)로만 바인딩됨
  - 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts:92,100,107`
    (`completedStatus: ExecutionStatus.COMPLETED`)
  - 상세: `dashboard.service.ts`/`statistics.service.ts` 의 AVG 집계 SQL 에 추가된
    `e.status = :completedStatus`(또는 리터럴 `'completed'`)는 사용자 입력이 아니라
    `ExecutionStatus` enum 상수 또는 하드코딩 문자열이다. 인젝션 표면 없음.
  - 제안: 없음.

- **[INFO]** 인증/인가 경계 변경 없음
  - 상세: 이번 diff 가 건드린 raw UPDATE 5곳 모두 기존 `WHERE id = :id AND status = :xxx`
    상태 가드를 그대로 유지한 채 `SET`(`durationMs`)과 `RETURNING` 절만 확장했다. 새로운
    권한 우회 표면이나 인가 로직 변경은 없다.
  - 제안: 없음.

- **[INFO]** 에러 메시지·민감정보 노출 없음
  - 상세: 신규로 wire 에 실리는 값은 실행 소요시간(`durationMs`, 정수 ms 또는 `null`)뿐이다.
    사용자 식별 정보, 자격증명, 스택트레이스, 내부 경로 등을 새로 노출하는 지점은 없다.
    기존 `toTerminalErrorPayload` 등 에러 직렬화 로직은 이번 diff 범위 밖(호출만 재사용).
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿 없음
  - 상세: 전체 diff(`git diff origin/main`)에 대해 API 키/비밀번호/토큰/인증서/JWT 형태
    패턴을 grep 했으나 실 코드에는 매치가 없었다(유일한 매치는 `review/code/.../scope.md`
    문서 안에서 "이런 패턴을 grep 했다" 는 서술 자체였다 — 실제 시크릿 아님).
  - 제안: 없음.

## 요약

이번(5차 이상) 라운드는 종결 이벤트(`completed`/`failed`/`cancelled`) payload 에
`durationMs` 를 싣는 배관 작업의 연장으로, 새로 도입된 raw SQL 상수(`TERMINAL_DURATION_MS_SQL`)는
사용자 입력과 무관한 하드코딩 문자열이고 유일한 가변 요소는 서버 생성 `Date` 를 파라미터
바인딩한다 — SQL 인젝션 위험이 없다. `RETURNING` 값은 `toFiniteNumber`/`resolveTerminalDurationMs`
로 방어적으로 좁혀져 비정상 값(문자열·NaN·음수·오버플로)이 wire 로 새지 않는다. 상태 가드
(`WHERE`/`AND WHERE`)와 인증/인가 경로는 이번 diff 로 변경되지 않았고, 하드코딩 시크릿·민감정보
노출·안전하지 않은 암호화 사용도 발견되지 않았다. 직전 6차례 라운드의 security 판정(NONE)과
일치하는 결과다.

## 위험도

NONE
