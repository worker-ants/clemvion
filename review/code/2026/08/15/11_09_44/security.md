STATUS=success

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (11_09_44)

## 리뷰 범위 및 방법

프롬프트 번들에서 실제 diff 가 실린 코드 파일은 10개(1~10번)이며, 나머지(11~105번)는 이전
리뷰 라운드(`09_58_24`/`10_18_38`/`10_34_51`/`10_52_08`) 산출물·plan·spec 문서로 보안 관점의
신규 코드 표면이 아니다. 핵심 검토 대상:

- `codebase/backend/src/shared/utils/terminal-duration.ts` (신규 — raw SQL 상수 정의)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (diff 생략 파일 —
  `Read`/`grep` 로 직접 대조)
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/chat-channel/{types.ts,chat-channel.dispatcher.ts}` (타입 nullable 확장)

이전 라운드 security 리뷰(`09_58_24`)가 이미 SQL 파라미터 바인딩을 상세 검증했으나, 그 이후
CRITICAL(int4 오버플로) 수정과 `driveCallStackResume` 관련 WARNING(다른 관점 reviewer, side_effect)이
있었으므로 **최신 코드가 실제로 그 수정을 반영했는지**를 `Read`/`grep` 으로 직접 재확인했다.

## 발견사항

Critical/Warning 없음. 확인(INFO)만 기록한다.

- **[INFO]** raw SQL(`TERMINAL_DURATION_MS_SQL`)의 유일한 가변 입력이 서버 생성 `Date` 로
  파라미터 바인딩되어 SQL 인젝션 표면이 없음 — 재확인 결과 변동 없음
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:87-90` (상수 정의) / 사용처
    `execution-engine.service.ts:1036,1038` / `1171,1173` / `2828,2830` / `2899,2901` /
    `3352,3354`
  - 상세: `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })` 로 raw SQL 문자열을 SET 절에
    삽입하지만, 문자열 자체는 모듈 상수(사용자 입력 无관여)이고 유일한 플레이스홀더
    `:terminalFinishedAt` 은 5곳 전부 `new Date()` 로 생성한 서버측 시각을
    `.setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)` 로 바인딩한다.
    `WHERE id = :id` / `AND WHERE status = :running` 등도 기존과 동일하게 파라미터 바인딩
    유지. 문자열 결합(concat) 없음 — 인젝션 표면 없음.
  - 제안: 없음(현행 유지).

- **[INFO]** int4 오버플로 CRITICAL 수정이 현재 코드에 실제로 반영되어 있음
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:88` (`LEAST(2147483647, …)`)
  - 상세: 이전 라운드(`09_58_24`)에서 지적된 "클램프 없는 `::int` 캐스팅이 `integer out of
    range` 로 UPDATE 문 전체를 실패시켜, 오래 대기한 실행(park/idle-wait 등)의 취소 처리
    자체가 영구 고착될 수 있다"는 CRITICAL 이 `LEAST(2147483647, …)` saturate 로 수정되어
    있음을 소스에서 직접 확인. 실패를 삼키는 catch 로 인한 가용성 저하(고착) 경로가 닫혔다.
  - 제안: 없음(현행 유지). 참고로 이 결함은 인젝션류는 아니고 가용성(DoS-adjacent) 성격의
    회귀였다.

- **[INFO]** `RETURNING` 원본 값의 방어적 파싱 — 비정상 값(NaN/Infinity/문자열/음수)의
  wire 유출 차단
  - 위치: `terminal-duration.ts` `toFiniteNumber` (:56-63), `resolveTerminalDurationMs` (:28-42)
  - 상세: pg 드라이버가 `numeric`/`bigint` 를 문자열로 반환하는 경우, `Invalid Date`, 시계
    역행(음수), `NaN`/`Infinity` 를 전부 `null` 로 흡수한다. 외부 webhook/SSE/WS 수신자에게
    비정상 값이 그대로 나가는 경로가 없다.
  - 제안: 없음.

- **[INFO]** 이전 라운드가 지적한 `driveCallStackResume` 경로의 방어 우회는 현재 코드에서
  이미 해소되어 있음 (참고용 — 이번 라운드의 신규 발견 아님)
  - 위치: `execution-engine.service.ts:2576-2577` (계산부), `:2593` (emit부) — 함수
    `driveCallStackResume`
  - 상세: 직전 side-effect 리뷰(`10_18_38/side_effect.md`)가 "이 경로만 옛 뺄셈식을 써
    시계 역행 시 음수 `durationMs` 가 그대로 wire 로 나갈 수 있다"고 지적했으나, 현재 소스는
    `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;`
    로 형제 경로와 동일하게 통일되어 있다 — 음수/NaN 가드가 이 경로에도 적용된다. 보안
    관점에서도(비정상 값의 외부 유출 방지) 문제 없음을 재확인.
  - 제안: 없음.

- **[INFO]** 타입 확장(`durationMs?: number` → `number | null`)은 인가/인증 경계와 무관
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:397,420,438`,
    `chat-channel.dispatcher.ts:534-535,572-573,589-590`
  - 상세: 컨슈머 계약 타입만 넓어졌고, `executionId`/`status`/`error.code` 등 인가·라우팅에
    쓰이는 필드는 변경 없음. `durationMs` 는 순수 정수(ms) payload 필드로, HTML/SQL/커맨드
    등 어떤 sink 에도 문자열 삽입되지 않고 JSON 필드로만 직렬화된다 — XSS/템플릿 인젝션
    표면 없음.
  - 제안: 없음.

- **[INFO]** 하드코딩 시크릿·인증/인가 로직 변경·평문 전송·안전하지 않은 해시 없음
  - 상세: 이번 diff 는 실행 소요시간 계산·전파에 국한된다. API 키/비밀번호/토큰 리터럴,
    신규 인증 우회 경로, 암호화 알고리즘 변경 지점이 없다. 에러 메시지도 기존
    `toTerminalErrorPayload` 재사용뿐이라 별도 신규 정보 노출 없음.
  - 제안: 없음.

## 요약

이번 PR 은 EIA 종결 이벤트 3종(`completed`/`failed`/`cancelled`)에 `durationMs` 를 싣기 위해
일부 raw SQL(`TERMINAL_DURATION_MS_SQL`)을 도입했지만, 유일한 가변 입력이 서버 생성
`Date` 로 항상 파라미터 바인딩되고 SQL 문자열 자체는 사용자 입력과 완전히 무관한 모듈
상수라 SQL 인젝션 위험이 없다. 이전 라운드에서 발견된 CRITICAL(int4 클램프 부재로 인한
UPDATE 실패·영구 고착)과 후속 WARNING(`driveCallStackResume` 의 방어 우회)은 현재 소스에서
직접 재확인한 결과 모두 수정 반영되어 있다. `RETURNING` 원본 값과 pg 드라이버가 반환하는
비정형 값(`bigint`/`numeric` 문자열, `NaN`, 음수)은 `toFiniteNumber`/`resolveTerminalDurationMs`
가 방어적으로 `null` 로 흡수해 wire 로 오염된 값이 나가지 않는다. 인증/인가·세션 관리·
하드코딩 시크릿·에러 메시지의 민감정보 노출 등 다른 OWASP Top 10 항목에서도 이번 diff
범위 내 신규 취약점은 발견되지 않았다.

## 위험도

NONE
