STATUS=success

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (r8, 10:34)

## 리뷰 범위 및 방법

프롬프트 번들에서 diff 가 생략된 파일(4, 5번: `execution-engine.service.spec.ts`,
`execution-engine.service.ts`)은 `git diff origin/main -- <path>` 로 직접 대조했고,
정확한 인용을 위해 `grep -n`/`Read` 로 현재 소스의 실제 줄 번호를 재확인했다. 그 외 파일은
프롬프트에 첨부된 unified diff 의 게이트 숫자를 그대로 썼다.

- `CHANGELOG.md` — 문서
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`
- `codebase/backend/src/modules/chat-channel/types.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (신규 raw SQL 5경로)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (테스트 mock)
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts` (테스트)
- `codebase/backend/src/shared/utils/terminal-duration.ts` (신규)
- `codebase/backend/src/shared/utils/terminal-duration.spec.ts` (신규, 테스트)
- `plan/**`, `review/**`, `spec/**` — 문서/산출물, 런타임 코드 없음

변경 요지: 종결 이벤트(`completed`/`failed`/`cancelled`) payload 에 `durationMs` 를 싣는다.
대부분은 로드된 엔티티에서 JS 로 계산(`resolveTerminalDurationMs`)하고, 엔티티를 로드하지
않는 raw `UPDATE ... RETURNING` 경로 5곳(`cancelParkedExecution`·`markWebChatIdleTimeout`·
`markExecutionCancelled`·`markQueueWaitTimeout`·`finalizeStalledExhausted`)은 SQL 상수
(`TERMINAL_DURATION_MS_SQL`)로 DB 에서 계산해 `RETURNING` 으로 되받는다.

## 발견사항

Critical/Warning 없음. 확인된 사항(INFO)만 기록한다.

- **[INFO]** raw SQL `SET` 절 삽입이 파라미터 바인딩으로 안전하게 처리됨 — SQL 인젝션 표면 없음
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:87-90`(`TERMINAL_DURATION_MS_SQL` 상수 정의). 사용처(현재 실측 줄번호) — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1036`(+`setParameter` `:1038`, `returning` `:1043`), `:1171`(+`:1173`, `:1178`), `:2828`(+`:2830`, `:2847`), `:2899`(+`:2901`, `:2904`), `:3352`(+`:3354`, `:3357`)
  - 상세: `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })` 는 TypeORM `QueryBuilder.set()` 이 함수 반환값을 SET 절에 raw SQL 로 그대로 삽입하는 API라 잠재적으로 위험한 패턴이지만, 여기서는 (1) 삽입 문자열이 **하드코딩된 모듈 상수**(사용자 입력이 전혀 섞이지 않음)이고, (2) 상수 안의 유일한 가변 요소(`:terminalFinishedAt` 플레이스홀더)가 5곳 전부 `.setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)` 로 서버가 생성한 `Date` 객체로 바인딩되며, (3) 기존 `WHERE id = :id` / `AND WHERE status = :waiting|:pending|:running` 절도 그대로 파라미터 바인딩을 유지한다. 문자열 결합(concatenation) 이 전혀 없어 SQL 인젝션 벡터가 없다.
  - 제안: 없음(현행 유지). `terminal-duration.spec.ts` 에 있는 "상수가 `:${TERMINAL_FINISHED_AT_PARAM}` 을 실제로 포함하는지" 정적 assertion 이 drift 를 잡아주므로 유지 권장.

- **[INFO]** (이전 라운드 CRITICAL — 현재 코드에서 수정 확인) `duration_ms` INTEGER(int4) 오버플로 → UPDATE 전체 실패 → 취소 영구 고착
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:87-90`
  - 상세: `TERMINAL_DURATION_MS_SQL` 은 `LEAST(2147483647, (EXTRACT(EPOCH FROM (...)) * 1000)::bigint)::int` 로 int4 상한을 클램프하고, 시계 역행(음수)은 `CASE WHEN … THEN NULL` 로 처리한다. 클램프가 없으면 `::int` 캐스팅이 `integer out of range` 로 UPDATE 문 전체를 실패시키고, 이 SQL 을 쓰는 5경로가 하필 "오래 대기한 실행을 취소/마감"하는 자리(park 취소·위젯 idle 취소·재개 실패 취소·큐 대기 타임아웃·stalled 소진)라 24.8일 초과가 정상 시나리오다 — 실패가 최상위 catch 에 삼켜지면 실행이 영구 고착되는 가용성(availability) 결함이 될 수 있었다. `terminal-duration.spec.ts:125-127`(`int4 상한으로 클램프`)와 `:130-133`(`음수는 NULL`)이 이 방어를 회귀 테스트로 고정하고 있어 재발 시 즉시 잡힌다.
  - 제안: 없음(이미 조치·테스트로 고정됨). 참고 기록 목적.

- **[INFO]** `RETURNING` 원본 값 흡수 시 방어적 파싱 — 비정상 값의 wire 유출 차단
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:56-63`(`toFiniteNumber`), `:28-42`(`resolveTerminalDurationMs`)
  - 상세: pg 드라이버가 `numeric`/`bigint` 를 문자열로 반환하는 상황, `Invalid Date`, 시계 역행(음수), `NaN`/`Infinity` 등을 전부 `null` 로 흡수해 클라이언트/webhook 수신자에게 `NaN`·음수·비정상 문자열이 그대로 노출되는 경로를 차단한다.
  - 제안: 없음.

- **[INFO]** 인증/인가 경계·상태 전이 가드 변경 없음
  - 상세: 5개 raw UPDATE 모두 기존 `WHERE id = :id AND status = :waiting|:pending|:running` 가드를 그대로 유지한 채 `SET`/`RETURNING` 만 확장했다. 새로 열린 인가 우회 표면이 없다. `emitCancellationEvent` 시그니처에 `durationMs?: number | null` 옵션이 추가됐을 뿐, 호출 권한·인증 로직은 diff 범위 밖.
  - 제안: 없음.

- **[INFO]** 에러 메시지·민감정보 노출 없음
  - 상세: 이번 변경은 실행 소요시간(`durationMs`, 정수 ms 또는 `null`)만 payload 에 추가한다. 자격증명·스택트레이스·내부 경로 등을 새로 노출하는 지점은 없다. `toTerminalErrorPayload` 등 기존 에러 직렬화 로직은 이번 diff 에서 호출만 재사용될 뿐 변경되지 않았다.
  - 제안: 없음.

- **[INFO]** `chat-channel.dispatcher.ts` 의 무검증 타입 캐스팅은 기존 패턴의 연장 — 신규 표면 아님
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:533-535`, `:571-573`, `:588-590`
  - 상세: `(event.payload as { durationMs?: number | null }).durationMs` 는 런타임 검증 없는 타입 단언이다. 다만 이 payload 는 외부 사용자 입력이 아니라 **내부 이벤트 버스가 실행 엔진 자체에서 emit 한 값**이고, 이전부터 존재하던 캐스팅 패턴(`{ durationMs?: number }`)을 `| null` 로 넓힌 것뿐이라 이번 diff 가 새로 여는 신뢰 경계는 없다.
  - 제안: 없음(현행 유지). 장기적으로 이벤트 payload 에 런타임 스키마 검증(zod 등)을 두면 전체 클래스가 줄어들지만, 이 PR 범위를 넘는 아키텍처 결정이다.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음, 신규 의존성 없음, 암호화·해시 로직 변경 없음
  - 상세: diff 전체(코드+문서)에 API 키·토큰·비밀번호·인증서 패턴 없음. `package.json`/lock 파일 변경 없음(신규 라이브러리 도입 없음). 암호화·해시 알고리즘 관련 코드 미포함.
  - 제안: 없음.

- **[INFO]** 테스트 파일(`execution-engine.service.spec.ts`, `retry-turn.service.spec.ts`, `terminal-duration.spec.ts`) 변경은 QueryBuilder 체인에 `setParameter`/`returning` mock 을 추가하고 fixture 값을 확장한 것뿐 — 보안 영향 없는 테스트 인프라 변경.

## 요약

이번 PR 은 종결 이벤트(`completed`/`failed`/`cancelled`)에 `durationMs` 를 싣기 위해 일부 raw SQL(`TERMINAL_DURATION_MS_SQL`)을 5개 UPDATE 경로에 도입했지만, 유일한 가변 입력(`terminalFinishedAt`)이 서버가 생성한 `Date` 객체로 `setParameter` 를 통해 항상 바인딩되고 SQL 문자열 자체는 사용자 입력과 무관한 모듈 상수라 SQL 인젝션 위험이 없다. `RETURNING` 값 파싱(`toFiniteNumber`/`resolveTerminalDurationMs`)은 타입이 불확실한 DB 원본 값을 방어적으로 숫자/`null` 로 좁혀 비정상 값의 wire 유출을 막는다. 직전 리뷰 라운드(`09_58_24`)가 지적했던 int4 오버플로에 의한 "취소 영구 고착"(가용성 결함) 은 `LEAST(2147483647, …)` 클램프로 이미 수정됐고 단위 테스트로 회귀가 고정돼 있음을 현재 코드에서 재확인했다. 인증/인가 경계·상태 전이 가드(`WHERE status = :waiting|:pending|:running`)는 이번 diff 에서 변경되지 않았고, 하드코딩된 시크릿·신규 취약 의존성·암호화 약화·민감정보 에러 노출도 발견되지 않았다.

## 위험도

NONE
