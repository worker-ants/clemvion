STATUS=success

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 리뷰 범위

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`
- `codebase/backend/src/shared/utils/terminal-duration.ts` (신규)
- `codebase/backend/src/shared/utils/terminal-duration.spec.ts` (신규)
- `plan/in-progress/eia-terminal-payload.md`, `plan/in-progress/spec-draft-eia-notification-payload-contract.md` (문서, 코드 없음)

변경 요지: 종결 이벤트(`completed`/`failed`/`cancelled`) payload 에 `durationMs` 를 싣는다. 대부분은 로드된 엔티티에서 계산하고, 엔티티를 로드하지 않는 raw `UPDATE ... RETURNING` 경로 5곳은 SQL 식(`TERMINAL_DURATION_MS_SQL`)으로 DB 에서 계산해 `RETURNING` 으로 되받는다.

## 발견사항

발견된 Critical/Warning 없음. 아래는 확인 결과(INFO)만 기록한다.

- **[INFO]** raw SQL 식 삽입이 파라미터 바인딩으로 안전하게 처리됨
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:75-79` (상수 정의), 사용처 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1036`(+`1038`), `1171`(+`1173`), `2829`(+`2831`), `2900`(+`2902`), `3353`(+`3355`)
  - 상세: `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })` 는 TypeORM `QueryBuilder.set()` 이 함수 반환값을 SET 절에 raw SQL 로 그대로 삽입하는 API다. 위험한 패턴이 될 수 있으나, 여기서는 (1) 삽입되는 문자열이 **하드코딩된 모듈 상수**(사용자 입력이 절대 섞이지 않음)이고, (2) 그 상수 안의 유일한 가변 요소인 `:terminalFinishedAt` 플레이스홀더가 5곳 전부 `.setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)` 로 `Date` 객체 바인딩되며, (3) `WHERE`/`AND WHERE` 절도 기존과 동일하게 `:id`/`:waiting`/`:pending`/`:running` 파라미터 바인딩을 유지한다. 리터럴 문자열 결합(string concatenation)이 전혀 없어 SQL 인젝션 표면이 없다.
  - 제안: 없음(현행 유지). 향후 이 상수를 수정할 때 플레이스홀더 이름 일치를 정적으로 검증하는 테스트(`terminal-duration.spec.ts:98-101`, `TERMINAL_DURATION_MS_SQL` 이 `${TERMINAL_FINISHED_AT_PARAM}` 을 참조하는지)가 이미 있어 drift 를 잡아준다 — 유지 권장.

- **[INFO]** `RETURNING` 원본 값 흡수 시 방어적 파싱
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` `toFiniteNumber` (:56-63), `resolveTerminalDurationMs` (:28-42)
  - 상세: pg 드라이버가 `numeric`/`bigint` 을 문자열로 반환하는 상황, `Invalid Date`, 시계 역행(음수), `NaN`/`Infinity` 등을 전부 `null` 로 흡수해 wire 로 비정상 값(`NaN`, 음수, 문자열)이 나가는 경로를 차단한다. 클라이언트/webhook 수신자 측 파싱 오류·정보 오염 가능성을 줄이는 방향으로 타입 안전하게 구현됨.
  - 제안: 없음.

- **[INFO]** 에러 메시지·민감정보 노출 없음
  - 상세: 이번 변경은 실행 소요시간(`durationMs`, 정수 ms)만 payload 에 추가한다. 사용자 식별 정보, 자격증명, 스택트레이스, 내부 경로 등 민감 데이터를 새로 노출하는 지점은 없다. `toTerminalErrorPayload` 등 기존 에러 직렬화 로직은 이번 diff 범위 밖(호출만 재사용)이라 별도 검토 대상 아님.
  - 제안: 없음.

- **[INFO]** 인증/인가 경계 변경 없음
  - 상세: `executionId`, `code`, `message` 등은 이번 diff 이전부터 파라미터 바인딩되어 사용되던 값이며, 이번 변경은 동일한 `WHERE`/`AND WHERE` 절 구조를 유지한 채 `SET`/`RETURNING` 만 확장했다. 상태 전이 가드(`status = :waiting` 등) 로직도 그대로 보존되어 인가 우회 표면이 새로 열리지 않았다.
  - 제안: 없음.

- **[INFO]** 테스트 mock 변경(파일 1, 3) 은 QueryBuilder 체인에 `setParameter`/`returning` stub 을 추가한 것뿐이며 보안에 영향 없는 테스트 인프라 변경.

## 요약

이번 PR 은 종결 이벤트에 `durationMs` 필드를 싣기 위해 일부 raw SQL(`GREATEST(0, EXTRACT(EPOCH FROM (:terminalFinishedAt::timestamptz - started_at)) * 1000)`)을 도입했지만, 유일한 가변 입력(`terminalFinishedAt`)이 서버가 생성한 `Date` 객체로 `setParameter` 를 통해 항상 바인딩되고 상수 SQL 문자열 자체는 사용자 입력과 무관하게 하드코딩되어 있어 SQL 인젝션 위험이 없다. 새로 추가된 `RETURNING` 값 파싱(`toFiniteNumber`)은 타입이 불확실한 DB 원본 값을 방어적으로 숫자/`null` 로 좁혀 비정상 값의 wire 유출을 막는다. 인증/인가, 시크릿, 에러 메시지 노출, 암호화 등 다른 OWASP Top 10 항목에서도 이번 diff 범위 내 새로운 취약점은 발견되지 않았다.

## 위험도

NONE
