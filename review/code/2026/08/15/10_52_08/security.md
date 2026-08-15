STATUS=success

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (10_52_08)

## 리뷰 범위

프롬프트 번들에서 실제 코드 변경이 있는 파일은 다음 10개다(나머지는 `plan/**`·`review/**` 산출물·spec 문서로 실행 코드 없음). 프롬프트 예산으로 diff 가 생략된 파일(execution-engine.service.ts/.spec.ts, spec-sync 트래커)은 `git diff origin/main -- <path>` 로 직접 열어 전문을 대조했다.

- `CHANGELOG.md`
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`, `.spec.ts`
- `codebase/backend/src/modules/chat-channel/types.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `.spec.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`, `.spec.ts`
- `codebase/backend/src/shared/utils/terminal-duration.ts`, `.spec.ts` (신규)
- `spec/3-workflow-editor/3-execution.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/chat-channel-adapter.md` (문서, 코드 없음)

변경 요지: 종결 이벤트(`completed`/`failed`/`cancelled`) payload 에 `durationMs`(밀리초, `number | null`)를 싣는다. 대부분은 로드된 엔티티에서 계산하고, 엔티티를 로드하지 않는 raw `UPDATE ... RETURNING` 경로 5곳(`cancelParkedExecution`·`markWebChatIdleTimeout`·`markExecutionCancelled`·`markQueueWaitTimeout`·`finalizeStalledExhausted`)은 SQL 상수(`TERMINAL_DURATION_MS_SQL`)로 DB 에서 계산해 `RETURNING` 으로 되받는다. 본 라운드 이전에 이미 두 차례 리뷰(`09_58_24`, `10_18_38`)를 거쳐 CRITICAL(int4 상한 미클램프로 인한 UPDATE 실패·영구 고착)이 발견·수정됐고, 이번 diff 는 그 수정이 반영된 최종본이다.

## 발견사항

발견된 Critical/Warning 없음. 확인 결과(INFO)만 기록한다.

- **[INFO]** raw SQL 삽입은 상수 문자열 + 파라미터 바인딩으로 인젝션 표면이 없음 (재확인)
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` (`TERMINAL_DURATION_MS_SQL` 정의, 함수 `export const` 선언부), 사용처 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1036`+`:1038`, `:1171`+`:1173`, `:2828`+`:2830`, `:2899`+`:2901`, `:3352`+`:3354`
  - 상세: `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })` 는 TypeORM `QueryBuilder.set()` 이 함수 반환 문자열을 SET 절에 raw SQL 로 그대로 삽입하는 API 라 원칙적으로 위험한 패턴이 될 수 있다. 그러나 삽입 문자열은 (1) 모듈 상수로 하드코딩돼 있어 사용자 입력이 전혀 섞이지 않고, (2) 유일한 가변 요소인 `:terminalFinishedAt` 플레이스홀더는 5곳 전부 바로 다음 줄에서 `.setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)` 로 서버가 생성한 `Date` 객체가 바인딩되며, (3) `WHERE`/`AND WHERE` 절도 `:id`/`:waiting`/`:pending`/`:running` 등 기존과 동일한 파라미터 바인딩을 유지한다. 문자열 연결(concatenation) 지점이 없어 SQL 인젝션 표면이 없다. 상수-플레이스홀더 일치는 `terminal-duration.spec.ts` 의 `TERMINAL_DURATION_MS_SQL` `toContain(':' + TERMINAL_FINISHED_AT_PARAM)` 테스트로 정적으로 잠겨 있다.
  - 제안: 없음(현행 유지).

- **[INFO]** `RETURNING` 원본 값 흡수 시 방어적 파싱으로 비정상 값의 wire 유출을 차단
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` — `resolveTerminalDurationMs`, `toMillis`, `toFiniteNumber` 함수 전체
  - 상세: pg 드라이버가 `bigint`/`numeric` 을 문자열로 반환하는 경우, `Invalid Date`, 시계 역행(음수), `NaN`/`Infinity` 를 전부 `null` 로 흡수한다. int4 상한(`LEAST(2147483647, …)`)과 음수 sentinel(`CASE WHEN … THEN NULL`)이 SQL 쪽에도 동일하게 적용돼 JS 경로와 SQL 경로가 같은 이상 상황에 같은 값(`null`)을 낸다 — DoS(UPDATE 전체 실패로 인한 영구 고착)와 값 오염(음수/NaN 유출) 둘 다 막는 방어가 실장돼 있다. 이 부분은 직전 라운드에서 CRITICAL 로 지적·수정된 항목이며, 현재 코드에서 클램프·sentinel 이 실제로 존재함을 재확인했다.
  - 제안: 없음.

- **[INFO]** 에러 메시지·민감정보 노출 없음
  - 상세: 이번 변경은 실행 소요시간(`durationMs`, 정수 ms 또는 `null`)만 payload 에 추가한다. 사용자 식별 정보, 자격증명, 스택트레이스, 내부 파일 경로 등 민감 데이터를 새로 노출하는 지점은 없다. `toTerminalErrorPayload` 등 기존 에러 직렬화 로직은 이번 diff 범위 밖(호출만 재사용)이다.
  - 제안: 없음.

- **[INFO]** 인증/인가 경계 변경 없음
  - 상세: `executionId` 는 이번 diff 이전부터 파라미터 바인딩되어 사용되던 값이며, `WHERE`/`AND WHERE` 절의 상태 전이 가드(`status = :waiting` 등)도 그대로 보존된다. `emitCancellationEvent` 시그니처에 `durationMs?: number | null` 옵션 필드가 추가됐을 뿐 인가 로직은 손대지 않았다.
  - 제안: 없음.

- **[INFO]** 타입 완화(`durationMs?: number` → `durationMs?: number | null`)는 인젝션·검증 우회와 무관
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` (`EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent`), `chat-channel.dispatcher.ts` 3곳(`execution.completed`/`.failed`/`.cancelled` 케이스)
  - 상세: consumer 타입을 `number | null` 로 넓힌 것은 wire 표현(`null`=값 모름, 키 부재=레거시 이벤트)을 구분하기 위한 것으로, 외부 입력을 신뢰하는 방향의 변경이 아니다. `toChatChannelEvent` 는 여전히 내부 이벤트 버스(서버 생성 이벤트)만 소비하며 이번 diff 가 그 신뢰 경계를 넓히지 않는다.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 상세: `git diff origin/main -- codebase/ CHANGELOG.md` 를 `password|secret|api[_-]?key|token|bearer|authorization|private[_-]?key|BEGIN (RSA|EC|OPENSSH)|credential` 정규식으로 grep 했으나 매치 없음.

- **[INFO]** 테스트 mock/fixture 변경(`chat-channel.dispatcher.spec.ts`, `execution-engine.service.spec.ts`, `retry-turn.service.spec.ts`, `terminal-duration.spec.ts`)은 QueryBuilder 체인에 `setParameter`/`returning` stub 추가와 `durationMs` 값 단언 확장뿐이며 보안에 영향 없는 테스트 인프라 변경이다.

## 요약

이번 PR 은 종결 이벤트(`completed`/`failed`/`cancelled`)에 `durationMs` 를 싣기 위해 일부 raw SQL 을 도입했지만, SQL 문자열 자체는 완전히 하드코딩된 모듈 상수이고 유일한 가변 입력(`terminalFinishedAt`, 서버 생성 `Date`)은 5곳 전부 `.setParameter()` 로 바인딩돼 문자열 연결이 전혀 없어 SQL 인젝션 위험이 없다. 직전 두 리뷰 라운드에서 발견·수정된 CRITICAL(int4 컬럼 상한 미클램프로 인한 UPDATE 실패 → 오래 대기한 실행의 영구 고착, 일종의 가용성/DoS 결함)은 이번 diff 에 `LEAST(2147483647, …)` 클램프와 `RETURNING` 값의 방어적 파싱(`toFiniteNumber`/`resolveTerminalDurationMs`)으로 실제로 반영되어 있음을 코드 레벨에서 재확인했다. 인증/인가 가드(`WHERE status = :waiting` 등)는 그대로 보존되고, 하드코딩 시크릿·평문 전송·민감정보 노출·인젝션 등 다른 OWASP Top 10 항목에서도 새 취약점은 발견되지 않았다.

## 위험도
NONE
