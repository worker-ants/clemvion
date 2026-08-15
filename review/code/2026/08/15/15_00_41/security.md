# 보안(Security) Review

## 발견사항

- **[INFO]** guarded UPDATE 반환값 미확인으로 인한 "사후 오시그널"(post-hoc mis-signal) 결함이 이 diff 로 수정됨 — 보안 관점에서는 데이터 무결성/신뢰성 개선
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4899-4929` (`finalizeCancelledExecution`)
  - 상세: 종전 코드는 `status IN (non-terminal)` 조건부 UPDATE 의 반환(0행=다른 writer 가 이미 terminal 로 선점)을 읽지 않고 무조건 `EXECUTION_CANCELLED` 를 발행했다. 인증/인가 취약점은 아니지만, 수신자(webhook/SSE/WS 구독자)가 실제 DB 상태(FAILED 등)와 다른 상태(CANCELLED)를 신뢰하게 되는 데이터 무결성 결함이었다. 외부 연동 시스템이 이 이벤트를 신뢰해 후속 액션을 수행한다면 잘못된 상태에 기반한 의사결정으로 이어질 수 있어 간접적 보안/신뢰성 영향이 있었다. 이번 diff 는 `persisted` 를 확인해 0행이면 `findOneBy({ id: savedExecution.id })` 로 재조회, `CANCELLED` 일 때만 emit 하도록 고쳐 문제를 닫는다. 재조회는 기존 guarded UPDATE 와 동일하게 `id`(PK) 단일 스코프이고 기존 `updateExecutionStatus` 의 `WHERE id = $1 AND status IN (...)` 조건과 조회 스코프가 일치해(직접 확인) 새 테넌트/권한 경계 축소·확장이 없다. 새 취약점을 도입하지 않으며 오히려 방어를 강화한다.
  - 제안: 조치 불요.

- **[INFO]** `retry-turn.service.ts` 의 `RETURNING` 절 도입 — SQL 인젝션 위험 없음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:656` (`.returning(['duration_ms', 'finished_at'])`), 되읽기 블록 `:658-674`
  - 상세: `COALESCE(finished_at, :newFinishedAt)` / `COALESCE(duration_ms, :newDurationMs)` 는 TypeORM `QueryBuilder.setParameter()` 로 바인딩되는 파라미터 플레이스홀더이며 문자열 결합이 없다. `where`/`andWhere` 도 동일하게 `:id`/`:status` 파라미터화. 되읽은 `result.raw[0]` 값은 `toFiniteNumber()`(숫자 좁히기)와 신규 `toPersistedDate()`(`codebase/backend/src/shared/utils/terminal-duration.ts:89-96`, Date/ISO 문자열만 허용, 그 외는 `null`)를 거쳐서만 in-memory 엔티티에 반영되므로 드라이버가 예상 밖 타입을 반환해도 오염되지 않는다.
  - 제안: 조치 불요.

- **[INFO]** REST 응답(`ExecutionStatusDto`)에 `durationMs` 필드 추가 — 신규 정보 노출 표면 아님
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:123-130`, `codebase/backend/src/modules/external-interaction/interaction.service.ts:434-438`
  - 상세: 이 값은 push 계열(webhook/SSE/WS) 종결 이벤트에 이미 실려 나가던 값(직전 PR)을 REST 단발 조회에도 동일하게 노출하는 것으로, 기존 interaction-token 인증 경계 안에서의 응답 확장이며 새 권한 경계를 넘지 않는다. 값 자체도 실행 소요/대기 시간(ms)이라는 저민감도 운영 메타데이터이며 PII·크리덴셜이 아니다. 컬럼은 재계산 없이 영속값을 그대로 실어(`execution.durationMs ?? null`) 서버 내부 계산 로직이 노출값과 달라질 여지도 없다.
  - 제안: 조치 불요.

- **[INFO]** 신규 로그(`this.logger.warn`)에 민감정보 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4919-4923`
  - 상세: 로그는 `savedExecution.id`, `logContext`, `live?.status` 만 포함한다. 스택 트레이스·요청 바디·크리덴셜·PII 없음. 서버 로그로만 남고 클라이언트 응답에 노출되지 않는다.
  - 제안: 조치 불요.

## 인증/인가 · 인젝션 · 시크릿 · 암호화 점검 결과

- 인증/인가: 변경된 경로(`finalizeCancelledExecution`, `finalizeGuarded`, `InteractionService.getStatus`)에 권한 검증 로직 변경 없음. `findOneBy({ id })` 재조회 스코프가 기존 guarded UPDATE 의 `WHERE id = $1` 스코프와 일치함을 소스 대조로 확인(`execution-engine.service.ts:8674`).
- 인젝션: 신규 SQL/QueryBuilder 호출 전부 파라미터 바인딩(`$n` 또는 `:name` + `setParameter`) 경유. 문자열 결합 없음. 커맨드/LDAP/경로 탐색 관련 코드 변경 없음.
- 하드코딩 시크릿: diff 전체(코드·테스트·spec·plan·CHANGELOG·문서)에서 API 키/비밀번호/토큰/인증서 패턴 없음. 테스트의 `'owner'`, `'user'`, `'test'` 등은 도메인 fixture 문자열.
- 암호화: 관련 변경 없음(평문 전송·해시 알고리즘 표면 아님).
- 에러 처리: 클라이언트로 반환되는 새 필드(`durationMs`)는 계산되지 않은 저민감도 숫자이고, 새 예외/에러 메시지 노출 경로 없음.
- 의존성: 신규 외부 라이브러리 도입 없음. 기존 `@nestjs/typeorm`/`typeorm` API(`createQueryBuilder`, `.returning`) 사용 범위 내.

## 요약

이번 변경은 (1) `finalizeCancelledExecution` 이 guarded UPDATE 의 반환값을 확인하지 않아 DB 에 실제로 반영되지 않은 `EXECUTION_CANCELLED` 이벤트를 발행하던 데이터 무결성 결함을 닫고, (2) retry-turn 재진입 시 DB 와 wire 의 `durationMs`/`finishedAt` 값이 어긋나던 문제를 `RETURNING` 되읽기로 해소하며, (3) REST 재조회 응답에 이미 push 채널에 노출되던 `durationMs` 를 additive/nullable 로 추가하는 작업이다. 모든 신규 SQL 은 파라미터 바인딩을 사용해 인젝션 벡터가 없고, 재조회(`findOneBy`)의 조회 스코프는 기존 guarded UPDATE 와 동일해 새 권한 경계 이슈가 없다. 신규 REST 필드는 기존 인증 경계 안에서 이미 노출되던 저민감도 값을 동일하게 노출할 뿐이다. 하드코딩된 시크릿, 인증 우회, 권한 검증 누락, 안전하지 않은 암호화, 민감정보 로그/에러 노출 등 CRITICAL/WARNING 급 보안 결함은 발견되지 않았다.

## 위험도

NONE
