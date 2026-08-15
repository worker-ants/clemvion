# 보안(Security) Review

## 발견사항

- **[INFO]** guarded UPDATE 반환값 미확인으로 인한 "사후 오시그널"(post-hoc mis-signal) 결함이 이 diff 로 수정됨 — 보안 관점에서는 데이터 무결성/신뢰성 개선
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4891` (`finalizeCancelledExecution`, 게이트 라인 4891-4902)
  - 상세: 종전 코드는 `status IN (non-terminal)` 조건부 UPDATE 의 반환(0행=다른 writer 가 이미 terminal 로 선점)을 읽지 않고 무조건 `EXECUTION_CANCELLED` 를 발행했다. 이는 인증/인가 취약점은 아니지만, 수신자(webhook/SSE/WS 구독자)가 실제 DB 상태(FAILED)와 다른 상태(CANCELLED)를 신뢰하게 되는 **데이터 무결성 결함**이었다. 외부 연동 시스템이 이 이벤트를 신뢰해 후속 액션(예: 환불 처리, 알림 발송)을 수행한다면 잘못된 상태에 기반한 의사결정으로 이어질 수 있어 간접적 보안/신뢰성 영향이 있었다. 본 diff 는 `persisted` 를 확인해 0행이면 emit 을 skip 하도록 고쳐 이 문제를 닫는다. 새 취약점을 도입하지 않으며 오히려 방어를 강화한다.
  - 제안: 조치 불요 — 이미 올바르게 수정됨.

- **[INFO]** `retry-turn.service.ts` 의 `RETURNING` 절 도입 — SQL 인젝션 위험 없음 확인
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:655` (`.returning(['duration_ms', 'finished_at'])`), 및 값 되읽기 블록 657-678
  - 상세: `COALESCE(finished_at, :newFinishedAt)` / `COALESCE(duration_ms, :newDurationMs)` 는 TypeORM `QueryBuilder` 의 `.setParameter()` 로 바인딩되는 파라미터 플레이스홀더(`:newFinishedAt`, `:newDurationMs`)이며 사용자 입력이 문자열로 직접 보간되지 않는다. `where('id = :id', ...)` / `andWhere('status = :status', ...)` 도 동일하게 파라미터화돼 있어 SQL 인젝션 벡터가 없다. 되읽은 `result.raw[0]` 값은 `toFiniteNumber()`/`instanceof Date`/`Number.isFinite` 가드를 거쳐서만 in-memory 엔티티에 반영되므로 타입 오염 위험도 낮다.
  - 제안: 조치 불요.

- **[INFO]** REST 응답(`ExecutionStatusDto`)에 `durationMs` 필드 추가 — 신규 정보 노출 표면 아님
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:130` (게이트), `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`durationMs: execution.durationMs ?? null` 추가 라인)
  - 상세: 이 필드는 push 계열(webhook/SSE/WS) 종결 이벤트에 이미 실려 나가고 있던 값(PR #1171)을 REST 단발 조회에도 동일하게 노출하는 것으로, 새로운 권한 경계를 넘지 않는다(같은 interaction-token 인증이 적용되는 기존 `getStatus` 엔드포인트의 응답 확장). 값 자체도 실행 소요/대기 시간(ms)이라는 저민감도 운영 메타데이터이며 PII·크리덴셜이 아니다. 컬럼은 재계산 없이 영속값을 그대로 싣어(`execution.durationMs ?? null`) 클라이언트에 노출되는 정보가 서버 내부에서 계산 로직과 다르게 왜곡될 여지도 없다.
  - 제안: 조치 불요.

- **[INFO]** 취소 종결 경로에서 `error` 미저장 관행이 이번 diff 대상 spec 문서에서도 재확인됨 (긍정적 관행)
  - 위치: `spec/conventions/node-cancellation.md` (게이트 라인 224-226, "취소 시 `error` 를 저장하지 않는 것도 양쪽 공통이다 — REST 로 내부 예외 메시지가 노출되는 것을 막고")
  - 상세: 문서(비-코드)만 변경됐으나, 취소 시 내부 예외 스택/메시지를 응답에 남기지 않는 기존 설계 원칙이 재확인·유지되고 있다. 에러 메시지를 통한 정보 노출(OWASP A05 유사) 방지에 부합.
  - 제안: 조치 불요, 참고용.

## 인증/인가 · 인젝션 · 시크릿 · 암호화 점검 결과

- 인증/인가: 변경된 코드 경로(`finalizeCancelledExecution`, `finalizeGuarded`, `InteractionService.getStatus`)에 권한 검증 로직 변경 없음. 기존 interaction-token/JWT 인증 경계 그대로 유지.
- 인젝션: SQL 은 전부 TypeORM 파라미터 바인딩(`:param` + `setParameter`) 경유. 커맨드/LDAP/경로 탐색 관련 코드 변경 없음.
- 하드코딩 시크릿: diff 전체(코드·테스트·spec·plan·CHANGELOG·리뷰 산출물)에서 API 키/비밀번호/토큰 패턴 없음. 테스트의 `'owner'`, `'user'`, `'test'` 등은 도메인 fixture 문자열이며 실 크리덴셜이 아님.
- 에러 처리: `logger.warn` 로그에 실행 ID(`savedExecution.id`)와 호출 컨텍스트 태그(`logContext`)만 포함 — 스택 트레이스·크리덴셜·PII 없음.
- 의존성: 신규 외부 라이브러리 도입 없음, 기존 `@nestjs/typeorm`/`typeorm` API(`createQueryBuilder`, `.returning`) 사용 범위 내.

## 요약

이번 변경은 종결 이벤트(`EXECUTION_CANCELLED`)가 DB 에 실제로 반영되지 않은 상태를 잘못 발행하던 데이터 무결성 결함과, retry-turn 재진입 시 DB 와 wire 의 `durationMs` 값이 어긋나던 결함을 고치고, REST 재조회 응답에 `durationMs` 필드를 추가하는 작업이다. 모든 신규 SQL 은 TypeORM 파라미터 바인딩을 사용해 인젝션 벡터가 없으며, 신규 REST 필드는 기존 인증 경계 안에서 이미 push 채널에 노출되던 저민감도 값을 동일하게 노출할 뿐 새로운 권한/데이터 노출 표면을 열지 않는다. 하드코딩된 시크릿, 인증 우회, 안전하지 않은 암호화, 민감정보 로그 노출 등 CRITICAL/WARNING 급 보안 결함은 발견되지 않았다.

## 위험도

NONE
