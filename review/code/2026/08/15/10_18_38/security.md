STATUS=success

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (2차 라운드, `09_58_24` CRITICAL 클램프 반영 후)

## 리뷰 범위 및 방법

프롬프트 번들에서 실제 프로덕션 diff가 생략된 두 파일(`execution-engine.service.ts`,
`execution-engine.service.spec.ts`)은 `git diff origin/main -- <path>` 로 직접 열어 전문을
대조했다. 그 외 파일(신규 헬퍼 `terminal-duration.ts`/`.spec.ts`, `retry-turn.service.ts`,
`chat-channel/types.ts`, `CHANGELOG.md`, `plan/**`, `spec/**`, `review/**` 산출물)은 프롬프트
diff 로 충분히 확인했다. 전체 diff(`git diff origin/main --stat`, 51 files)에 대해 시크릿
패턴(`api[_-]?key|secret|password|token|bearer|-----BEGIN`)을 추가로 grep 했다 — 전부 규약
문서 인용/변수명이며 실제 하드코딩된 자격증명은 없었다.

이번 라운드는 직전 라운드(`09_58_24`)가 지적한 CRITICAL(`duration_ms` INTEGER 상한 미클램프로
인한 UPDATE 실패 → 취소 대상 실행의 영구 고착, 가용성 문제)이 `TERMINAL_DURATION_MS_SQL` 의
`LEAST(2147483647, …)` 클램프로 실제로 해소된 상태를 대상으로 한다(`terminal-duration.ts:87-90`,
테스트는 `terminal-duration.spec.ts:125-127`).

## 발견사항

Critical/Warning 없음. 확인된 사항(INFO)만 기록한다.

- **[INFO]** raw SQL 삽입이 파라미터 바인딩으로 안전하게 처리됨 (SQL 인젝션 표면 없음)
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` (`TERMINAL_DURATION_MS_SQL`
    상수 정의부), 사용처 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    의 `cancelParkedExecution`·`markWebChatIdleTimeout`·`markExecutionCancelled`·
    `markQueueWaitTimeout`·`finalizeStalledExhausted` 5개 함수 내 `.set({ durationMs: () =>
    TERMINAL_DURATION_MS_SQL })` 호출부
  - 상세: `TERMINAL_DURATION_MS_SQL` 은 사용자 입력이 섞이지 않는 모듈 상수 리터럴이고, 유일한
    가변 요소인 `:terminalFinishedAt` 플레이스홀더는 5곳 전부 `.setParameter(TERMINAL_FINISHED_AT_PARAM,
    terminalFinishedAt)` 로 서버가 생성한 `Date` 객체를 바인딩한다. 문자열 결합(concat/template
    literal 로 값 삽입)이 전혀 없다. `WHERE`/`AND WHERE` 절도 기존과 동일하게 `:id`/`:waiting`/
    `:pending`/`:running` 파라미터 바인딩을 유지한다.
  - 제안: 없음(현행 유지). `terminal-duration.spec.ts` 의 "상수가 선언한 파라미터 이름을 실제로
    쓴다" 테스트가 상수·바인딩 이름의 drift 를 정적으로 잡아준다.

- **[INFO]** `RETURNING` 원본 값 흡수 시 방어적 파싱 — 비정상 값의 wire 유출 차단
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` `toFiniteNumber`(:56-63),
    `resolveTerminalDurationMs`(:28-42)
  - 상세: pg 드라이버가 `bigint`/`numeric` 을 문자열로 반환하는 상황, `Invalid Date`, 시계
    역행(음수), `NaN`/`Infinity` 를 전부 `null` 로 흡수한다. 수신자(webhook/SSE/WS 구독자)의
    파싱 오류나 오염된 값(`NaN`, 음수 등) 노출 가능성을 차단하는 방향으로 방어적이다.
  - 제안: 없음.

- **[INFO]** 인증/인가 경계 변경 없음
  - 상세: 5개 raw UPDATE 경로의 `WHERE id = :id AND status = :waiting/:pending/:running` 상태
    가드는 이번 diff 에서 그대로 보존됐다 — 취소·마감 가능한 상태 전이 조건이 넓어지거나
    좁아지지 않았다. `durationMs` 는 `SET`/`RETURNING` 절에만 추가됐다.
  - 제안: 없음.

- **[INFO]** 에러 메시지·민감정보 노출 없음
  - 상세: 신규 필드 `durationMs` 는 정수 밀리초(또는 `null`)이며 스택트레이스·자격증명·내부
    경로 등을 담지 않는다. `toTerminalErrorPayload` 등 기존 에러 직렬화 로직은 이번 diff 범위
    밖(재사용만)이다.
  - 제안: 없음.

- **[INFO]** 가용성(DoS-adjacent) 회귀 재발 방지 확인
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:87-90` (`TERMINAL_DURATION_MS_SQL`
    의 `LEAST(2147483647, …)`), 테스트 `codebase/backend/src/shared/utils/terminal-duration.spec.ts:125-127`
  - 상세: 직전 라운드(`review/code/2026/08/15/09_58_24/RESOLUTION.md`)가 지적한 CRITICAL —
    `duration_ms` 컬럼이 `INTEGER`(int4, ≈24.8일 상한)인데 클램프 없는 `EXTRACT(EPOCH …) * 1000`
    이 오래 대기한 실행(park/idle-wait 취소 등)의 취소 UPDATE 를 통째로 실패시켜 해당 실행을
    영구 고착시킬 수 있었던 문제 — 이번 라운드의 소스에는 클램프가 반영돼 있고 정적 테스트로
    고정돼 있다. 재발 없음을 확인.
  - 제안: 없음. (W10 로 등재된 "SQL 식이 실 Postgres 값 수준으로 검증된 적이 없다" 는 `RESOLUTION.md`
    가 이미 후속 트래커로 넘긴 항목이며 성격상 테스트 커버리지 이슈이지 보안 취약점은 아니다.)

- **[INFO]** 신규 의존성 없음 / 하드코딩된 시크릿 없음
  - 상세: `import` 는 프로젝트 내부 모듈(`../../shared/utils/terminal-duration`)만 추가됐다.
    `package.json`/lockfile 변경 없음. 전체 diff 시크릿 패턴 grep 결과 실제 자격증명 없음.

## 요약

이번 diff는 종결 이벤트(`completed`/`failed`/`cancelled`) payload 에 `durationMs` 를 채우는
배관 작업으로, 유일한 raw SQL(`TERMINAL_DURATION_MS_SQL`)은 하드코딩된 상수 문자열 + 파라미터
바인딩(`setParameter`)만으로 구성돼 SQL 인젝션 표면이 없다. `RETURNING` 으로 되받은 DB 원본
값은 `toFiniteNumber`/`resolveTerminalDurationMs` 가 방어적으로 숫자 또는 `null` 로 좁혀
비정상 값의 wire 유출을 막는다. 기존 상태 가드(`WHERE status = :waiting` 등)와 인증/인가 경로는
그대로 보존됐고, 신규 시크릿·의존성·에러 메시지 정보 노출도 없다. 직전 라운드가 지적한
가용성 관련 CRITICAL(int4 상한 미클램프로 인한 실행 영구 고착)은 `LEAST(2147483647, …)` 클램프로
이번 소스에 이미 반영·테스트로 고정돼 있어 재발이 없음을 확인했다. 신규 보안 취약점 없음.

## 위험도

NONE
