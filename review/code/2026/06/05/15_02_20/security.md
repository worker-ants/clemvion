### 발견사항

- **[INFO]** `cancelParkedExecution` 에러 메시지에 `executionId` 포함
  - 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `cancelParkedExecution` 메서드 내 `this.logger.error(...)` 및 `this.logger.warn(...)` 호출부
  - 상세: `executionId` 는 내부 UUID 식별자로, 로그에 노출되어도 직접적인 보안 위협은 아니다. 그러나 에러 스택이 포함될 경우(현재 코드에서는 `err.message` 만 포함, 스택은 미포함) 내부 아키텍처 정보가 서버 로그를 통해 누출될 수 있다. 현재 구현(`String(err)` / `err.message` 에 한정)은 스택 트레이스를 직접 노출하지 않아 수용 가능한 수준이다.
  - 제안: 현행 패턴 유지. 단, 로그 집계 시스템에서 해당 로그가 외부 API 응답에 포함되지 않도록 로그 레벨·전달 경로를 관리한다.

- **[INFO]** `applyCancellation` — TOCTOU(Time-of-Check-Time-of-Use) 가능성
  - 위치: `execution-engine.service.ts` — `applyCancellation` 메서드 (`pendingContinuations.has` 체크 → `rejectPending` / `cancelParkedExecution` 분기)
  - 상세: `pendingContinuations.has(executionId)` 확인과 `cancelParkedExecution` DB 업데이트 사이에, 다른 경로가 in-memory resolver 를 제거하는 race window 가 존재한다. 그러나 (1) `cancelParkedExecution` 내부의 `andWhere('status = :waiting', ...)` DB-레벨 멱등 가드, (2) `affected === 0` 시 조기 반환으로 중복 emit 이 차단된다. 실질적인 보안 위협(인가 우회, 데이터 손상 등)이 아닌 비기능 레이스다.
  - 제안: 현행 DB-멱등 가드가 올바르게 적용되어 있으므로 추가 조치 불요.

- **[INFO]** e2e 테스트 코드 내 DB 직접 쿼리 — SQL 파라미터화 확인
  - 위치: `/codebase/backend/test/execution-park-resume.e2e-spec.ts` — `db.query(...)` 호출부 (L1165, L1172, L1196)
  - 상세: `db.query('SELECT ... WHERE id = $1', [executionId])` 등 파라미터화된 쿼리를 사용하고 있어 SQL 인젝션 위험 없음. `executionId` 는 API 응답에서 수신한 UUID 값으로, 테스트 코드 내에서 외부 입력으로 전달되지 않는다.
  - 제안: 현행 패턴 유지.

- **[INFO]** `flushResumeDrive` — 실 타이머(setTimeout) 사용
  - 위치: `execution-engine.service.spec.ts` — `flushResumeDrive` 함수 및 호출부
  - 상세: 테스트 코드 내에서만 사용되는 헬퍼이며 프로덕션 코드에 영향 없다. 보안 취약점 아님.
  - 제안: 해당 없음.

### 요약

이번 변경은 실행 엔진의 park-release 모델 전환(form/button 코루틴 즉시 해제 + durable WAITING 영속 + slow-path 재개 일원화)을 구현한다. 보안 관점에서 SQL 인젝션·XSS·커맨드 인젝션·경로 탐색·하드코딩 시크릿·인증/인가 우회·안전하지 않은 암호화 알고리즘 등의 취약점은 발견되지 않았다. `cancelParkedExecution` 의 DB 업데이트는 파라미터화된 ORM 쿼리빌더(`where('id = :id', { id: executionId })`)를 사용하며, `WAITING_FOR_INPUT` 상태 가드 + `affected` 멱등 체크로 중복 실행이 방지된다. e2e 테스트의 직접 DB 쿼리도 파라미터화되어 있다. 에러 로그에 `executionId` 가 포함되나 스택 트레이스는 미노출되어 정보 노출 위험이 낮다. 전체 변경은 보안 관점에서 수용 가능한 수준이다.

### 위험도

NONE
