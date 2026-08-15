# 보안(Security) 리뷰 — EIA `durationMs` DB=wire 불변식 마무리 + `finalizeCancelledExecution` 사후 오시그널 수정

## 검토 범위 요약

이번 diff 의 실질 코드 변경은 세 곳이다.

1. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeCancelledExecution` 이 guarded UPDATE(`status IN (non-terminal)`) 의 반환값을 읽어, 0행(동시 writer 선점)이면 행을 재조회해 DB 실측(`CANCELLED`)일 때만 `EXECUTION_CANCELLED` 를 발행한다. 재조회 실패 시 fail-closed(skip + `logger.warn`).
2. `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — `finalizeGuarded` CANCELLED 재진입 분기에 `.returning(['duration_ms', 'finished_at'])` 추가, TypeORM QueryBuilder 파라미터 바인딩(`:id`, `:status`, `:newFinishedAt`, `:newDurationMs`)으로 처리.
3. `codebase/backend/src/modules/external-interaction/interaction.service.ts` + `execution-status-response.dto.ts` — `GET /api/external/executions/:id` 응답에 이미 존재하는 `duration_ms` 컬럼을 그대로 실어 `durationMs` 필드 추가(additive, nullable).

나머지(CHANGELOG, spec, plan, 테스트, mdx 문서, `review/**` 산출물)는 문서·테스트뿐이며 보안 표면과 무관하다.

## 발견사항

- **[INFO]** 재조회 실패 시 에러 메시지를 서버 로그에만 기록 — 클라이언트 노출 없음, 기존 관용구와 일치
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeCancelledExecution` 내 재조회 `catch` 블록 (`this.logger.warn(... err.message ...)`)
  - 상세: `findOneBy` 실패 시 `err instanceof Error ? err.message : String(err)` 를 NestJS `Logger.warn` 으로 서버 로그에만 남기고, API 응답이나 이벤트 payload 에는 실리지 않는다. 이 함수의 두 호출부(`runExecution` catch, `finalizeResumedExecutionOutcome`)는 이미 catch 블록 안이라 throw 를 다시 던지지 않고 조용히 skip 하는 fail-closed 설계다. 외부에 노출되는 표면이 없어 정보 노출 위험은 없다.
  - 제안: 조치 불요.

- **[INFO]** guarded UPDATE `status IN (...)` 리터럴 목록·파라미터 바인딩 — SQL 인젝션 표면 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `NON_TERMINAL_STATUSES_SQL`(`Object.values(ExecutionStatus)` 파생, line ~522), `updateExecutionStatus` else 분기의 raw UPDATE(`$1..$8` 파라미터)
  - 상세: `elseStatusesSql` 이 raw UPDATE 문자열에 템플릿 삽입되지만 값은 고정 enum 리터럴이며 사용자 입력 경로가 없다. `retry-turn.service.ts` 의 `.returning()` 추가분도 QueryBuilder `:name` 바인딩만 쓴다. 두 파일 모두 문자열 결합으로 사용자 입력을 조립하는 지점이 없다.
  - 제안: 조치 불요.

- **[INFO]** REST `durationMs` 필드 추가는 인증/인가 표면 변경 없이 기존 컬럼을 노출
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`STATUS_PROJECTION_COLUMNS`, `getStatus` 응답 조립), `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` (`durationMs` 필드)
  - 상세: `GET /api/external/executions/:executionId` 는 기존과 동일하게 §4 interaction token 인증(EIA-IN-06)을 그대로 거친다. 추가된 필드는 실행 소요 시간(ms) 정수값으로 PII·시크릿·내부 경로 등 민감정보가 아니며, 이미 webhook/SSE/WS 로 동일 값이 발행되고 있어 새로운 정보 노출이 아니다. `nullable: true` + optional 로 스키마 하위호환도 유지된다.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 상세: 전 diff(코드·테스트·문서)를 확인한 결과 API 키, 비밀번호, 토큰, 인증서 등이 직접 포함된 곳은 없다. 테스트 fixture 는 `exec-1`, `wf-1` 등 무의미한 식별자와 날짜값만 사용한다.
  - 제안: 조치 불요.

## 요약

이번 PR 은 종결 이벤트(`execution.cancelled`) 발행 시 DB 에 실제로 반영되지 않은 값을 내보내던 사후 오시그널 결함을 닫고, `retry-turn` 재진입 시 `COALESCE` 로 DB 가 보존한 값을 `RETURNING` 으로 되읽어 emit 하도록 정합화하며, REST 재조회 응답에 기존 컬럼(`durationMs`)을 additive 로 노출하는 변경이다. 모든 SQL 쓰기는 파라미터 바인딩(`$n` 또는 QueryBuilder `:name`)을 쓰고 `status IN (...)` 조건의 리터럴은 사용자 입력과 무관한 enum 파생 상수다. 신규 인증/인가 경로, 신규 엔드포인트, 사용자 입력 처리 로직 변경은 없으며, 추가된 REST 필드는 이미 push 채널로 발행되던 비민감 수치값이다. 에러 로그는 서버 사이드에만 남고 클라이언트로 반환되지 않는다. 하드코딩된 시크릿, 인젝션 벡터, 인증 우회, 안전하지 않은 암호화 사용은 발견되지 않았다.

## 위험도

NONE
