STATUS=success

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (11_44_10)

## 리뷰 범위 및 방법

프롬프트 번들이 예산 초과로 다수 파일(특히 `execution-engine.service.ts`/`.spec.ts`,
`terminal-duration.ts`/`.spec.ts`)의 diff 를 생략했다. 이 changeset 은 이미 6차례
(`09_58_24`/`10_18_38`/`10_34_51`/`10_52_08`/`11_09_44`/`11_29_02`)의 보안 리뷰 라운드를
거쳤고 그중 CRITICAL 1건(raw SQL `duration_ms INTEGER` int4 오버플로 → UPDATE 실패 →
실행 영구 고착, `09_58_24` 발견 → `11_09_44` 에서 JS 경로 누락분까지 완전 해소)이 이미
조치·회귀 테스트로 고정된 상태다. 이번 라운드는 그 위에 새로 커밋된 diff 를 독립적으로
재검증하는 것이 목적이므로, 생략된 파일을 `Read`/`Bash(grep, git diff)`로 직접 열어
전문 대조했다:

- `codebase/backend/src/shared/utils/terminal-duration.ts` (전문 Read) — SQL 상수, 클램프,
  파라미터 이름
- `codebase/backend/src/shared/utils/terminal-duration.spec.ts` (전문 Read)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — 
  `TERMINAL_DURATION_MS_SQL`/`TERMINAL_FINISHED_AT_PARAM` 사용처 6곳 전수 `grep -n` 후
  각 raw UPDATE 5경로(`cancelParkedExecution`, `markWebChatIdleTimeout`,
  `markExecutionCancelled`, `markQueueWaitTimeout`, `finalizeStalledExhausted`)를 Read 로
  직접 확인
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — `grep -n` 으로
  `resolveTerminalDurationMs` 호출부 6곳 확인
- `git diff origin/main -- codebase/backend/src | grep -iE "password|secret|api[_-]?key|token|bearer|private[_-]?key"` 로 하드코딩 시크릿 부재 확인

## 발견사항

발견된 Critical/Warning 없음. 아래는 확인 결과(INFO)만 기록한다.

- **[INFO]** raw SQL(`TERMINAL_DURATION_MS_SQL`) 삽입 지점 전부 파라미터 바인딩 — SQL 인젝션 표면 없음
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:102-105`(상수 정의),
    사용처 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1036`(+`1038`),
    `1173`(+`1175`), `2830`(+`2832`), `2901`(+`2903`), `3354`(+`3356`)
  - 상세: `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })` 는 TypeORM `QueryBuilder.set()`
    이 함수 반환값을 SET 절에 raw SQL 문자열로 그대로 삽입하는 API 라 잠재적으로 위험한
    패턴이지만, (1) 삽입 문자열은 **하드코딩된 모듈 상수**(`terminal-duration.ts:102-105`)이고
    사용자 입력이 문자열 결합으로 섞이는 지점이 코드베이스 전체에 0건, (2) 상수 안의 유일한
    가변 플레이스홀더 `:terminalFinishedAt` 은 6개 호출처 전부 `.setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)`(서버가 생성한 `Date` 객체)로 바인딩되고, 이 변수 자체가
    `new Date()` 로만 생성돼 사용자 입력 경로가 아니다, (3) `WHERE`/`AND WHERE` 절도
    `:id`(executionId)/`:waiting`/`:pending`/`:running`/`:...statuses` named parameter 를
    그대로 유지 — `executionId` 는 이번 diff 가 건드리지 않은 기존 인터페이스 경계에서
    들어오는 리소스 식별자이고 문자열 결합 없이 파라미터화된다.
  - 제안: 없음(현행 유지). `terminal-duration.spec.ts:130-135` 에 상수·파라미터 이름 일치를
    정적으로 검증하는 테스트가 있어 향후 drift 를 잡아준다.

- **[INFO]** `RETURNING` 원본 값 흡수 시 방어적 파싱 — 비정상 값의 wire 유출 차단
  - 위치: `terminal-duration.ts` `toFiniteNumber`(:71-78), `resolveTerminalDurationMs`(:37-57)
  - 상세: pg 드라이버가 `numeric`/`bigint` 를 문자열로 반환하는 경우, `Invalid Date`, 시계
    역행(음수), `NaN`/`Infinity` 등을 전부 `null` 로 흡수해 클라이언트/webhook 수신자에게
    비정상 값(`NaN`, 음수, 원시 문자열)이 나가지 않는다.
  - 제안: 없음.

- **[INFO]** 이전 라운드 CRITICAL(int4 오버플로) 재확인 — JS·SQL 두 경로 모두 해소된 상태
  - 위치: `terminal-duration.ts:56`(JS, `Math.min(span, PG_INT4_MAX)`), `:104`(SQL,
    `LEAST(${PG_INT4_MAX}, …)`), `PG_INT4_MAX` 상수는 `:7` 한 곳에서 export 돼 두 경로가
    공유
  - 상세: `09_58_24` 라운드가 SQL 경로만의 클램프 부재를 CRITICAL 로 잡았고, `11_09_44`
    라운드가 JS 경로(`resolveTerminalDurationMs`)에도 같은 결함이 남아 있었음을 재발견해
    상수를 하나로 통합했다. `terminal-duration.spec.ts:68-79` 가 saturate 값과 "SQL 쌍둥이와
    같은 상수를 쓴다"(`toContain(String(PG_INT4_MAX))`) 를 각각 회귀 테스트로 고정한다.
    이번 라운드에서 직접 소스를 재확인한 결과 두 경로 모두 `PG_INT4_MAX` 를 참조하며
    일치한다 — 새로운 회귀 없음.
  - 제안: 없음(이미 해소, 재확인 목적 기록).

- **[INFO]** 에러 메시지·민감정보 노출 없음
  - 상세: 이번 변경은 실행 소요시간(`durationMs`, 정수 ms 또는 `null`)만 종결 이벤트
    payload 에 추가한다. `catch` 블록의 `this.logger.error/warn` 은 `err.message` 를 서버
    로그에만 남기며(예: `execution-engine.service.ts` `cancelParkedExecution`/
    `markExecutionCancelled`/`markQueueWaitTimeout` catch 블록), 이 값들이 API 응답이나
    이벤트 payload 로 클라이언트에 재노출되는 지점은 없다. 사용자 식별 정보, 자격증명,
    스택트레이스, 내부 경로 등을 새로 노출하는 지점은 발견되지 않았다.
  - 제안: 없음.

- **[INFO]** 인증/인가 경계 변경 없음
  - 상세: `executionId` 는 이번 diff 이전부터 파라미터 바인딩되어 사용되던 값이며, 모든
    raw UPDATE 의 `WHERE`/`AND WHERE` 상태 가드(`status = :waiting` 등 조건부 전이)가
    그대로 보존돼 인가 우회 표면이 새로 열리지 않았다. 이번 diff 는 emit payload 필드
    추가와 계산 로직 헬퍼화가 전부다.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿 없음
  - 상세: `git diff origin/main -- codebase/backend/src`(9개 프로덕션/테스트 파일, +605/-56)에
    대해 `password|secret|api[_-]?key|token|bearer|private[_-]?key` 패턴 grep 결과 매칭
    0건. 신규 상수는 `PG_INT4_MAX = 2147483647`(Postgres int4 상한, 공개 정보) 뿐이다.
  - 제안: 없음.

- **[INFO]** 의존성 변경 없음
  - 상세: 이번 diff 는 `package.json`/lockfile 을 건드리지 않는다. 기존 TypeORM
    `QueryBuilder` API(`.set()`, `.setParameter()`, `.returning()`)만 재사용한다.

- **[INFO]** 테스트 파일(`*.spec.ts`) mock/assertion 확장은 보안 표면과 무관
  - 상세: `chat-channel.dispatcher.spec.ts` 의 신규 `describe('toChatChannelEvent — durationMs 전파')`,
    `retry-turn.service.spec.ts`/`execution-engine.service.spec.ts` 의 `expect.any(Number)`/
    정확 매칭 확장, `terminal-duration.spec.ts` 신설은 전부 순수 함수·직렬화 로직의 값
    검증이며 인증·인가·시크릿·인젝션과 관련된 표면을 새로 만들지 않는다.

## 요약

이번 PR(6차 라운드 시점 기준)은 종결 이벤트(`completed`/`failed`/`cancelled`) payload 에
`durationMs` 를 채우는 배관 작업으로, 유일한 raw SQL 삽입(`TERMINAL_DURATION_MS_SQL`)이
하드코딩된 모듈 상수이고 그 안의 유일한 가변 요소(`terminalFinishedAt`)가 서버 생성
`Date` 객체로 항상 파라미터 바인딩되어 SQL 인젝션 위험이 없음을 소스 레벨에서 직접
확인했다. 이전 라운드가 잡은 CRITICAL(int4 오버플로 → 실행 영구 고착)은 JS·SQL 두 경로
모두 같은 상수(`PG_INT4_MAX`)로 클램프돼 회귀 테스트로 고정된 상태를 재확인했다. 하드코딩
시크릿, 인증/인가 우회, 민감정보 에러 노출, 의존성 취약점 등 다른 항목에서도 이번 diff
범위 내 신규 취약점은 발견되지 않았다.

## 위험도

NONE
