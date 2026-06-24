# 보안(Security) 리뷰 결과

**대상**: refactor(execution-engine) M-2 — shutdown 중 시작 노드 추적 포기 드리프트 수정
**파일**: `shutdown-state.service.ts`, `shutdown-state.service.spec.ts`, 일관성 검토 산출물 (review/consistency/**)

---

## 발견사항

### [INFO] SQL WHERE IN 절 — 파라미터 바인딩 사용으로 인젝션 위험 없음

- 위치: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` — `markRemainingAsInterrupted` 메서드의 `.where('id IN (:...ids)', { ids: nodeExecutionIds })` 및 `.andWhere('status = :status', { status: ... })`
- 상세: TypeORM QueryBuilder 의 네임드 파라미터 바인딩(`:...ids`, `:status`)을 사용한다. `nodeExecutionIds` 와 `executionIds` 는 외부 사용자 입력이 아닌 서버 프로세스 내 `inFlightNodeExecutions` Map 에 저장된 내부 식별자(nodeExecutionId, executionId)를 사용하므로 SQL 인젝션 경로가 없다.
- 제안: 현행 유지. 추가 조치 불요.

### [INFO] 에러 메시지에 민감 정보 미포함 확인

- 위치: `shutdown-state.service.ts` — `logger.error(...)` 호출
- 상세: DB UPDATE 실패 시 로깅하는 에러 메시지는 `err.message` 또는 `String(err)` 만 포함하며, 사용자 데이터·시크릿·연결 문자열 등 민감 정보가 에러 객체에 포함될 가능성은 ORM 레이어에서 걸러진다. 서비스 자체는 에러를 외부(HTTP 응답 등)로 전파하지 않고 로그로만 남기는 graceful degradation 패턴을 채택한다(테스트에서도 `.resolves.not.toThrow()` 로 검증됨). 에러 내용이 클라이언트에 노출되는 경로 없음.
- 제안: 현행 유지. 추가 조치 불요.

### [INFO] 하드코딩된 시크릿 없음

- 위치: 변경된 모든 파일
- 상세: API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 없다. 'SERVER_INTERRUPTED' 문자열은 에러 코드 상수이며 민감 정보가 아니다. grace 기간은 DI 토큰(`SHUTDOWN_GRACE_MS`)으로 주입받거나 별도 상수(`DEFAULT_GRACE_MS`)를 사용한다.
- 제안: 현행 유지.

### [INFO] 인증/인가 — 해당 없음

- 위치: `shutdown-state.service.ts` 전체
- 상세: `ShutdownStateService` 는 NestJS lifecycle hook(`OnApplicationShutdown`) 전용 내부 서비스로, 외부 HTTP 엔드포인트 또는 사용자 입력을 처리하지 않는다. 인증·인가 취약점의 공격 표면이 존재하지 않는다. `onApplicationShutdown` 은 NestJS 프레임워크가 내부적으로 호출하며 외부에서 직접 트리거할 수 없다.
- 제안: 현행 유지.

### [INFO] 경쟁 조건(Race Condition) — 보안 맥락 무관

- 위치: `shutdown-state.service.ts` — `shuttingDown` 플래그와 `inFlightNodeExecutions.set()` 순서
- 상세: `shuttingDown = true` 설정 후 `registerInFlight` 호출이 여전히 가능해진 것이 M-2 수정의 핵심이다. 이는 의도된 동작이며 보안 취약점이 아니다. 경쟁 조건이 보안 문제로 연결되는 시나리오(예: 권한 우회, TOCTOU)는 이 서비스에서 발생할 수 없다. 인스턴스별 격리(`WHERE id IN (:...ids)`)가 다른 인스턴스 row 를 수정하지 않음을 보장한다.
- 제안: 현행 유지.

---

## 요약

본 변경은 `ShutdownStateService.registerInFlight` 의 early-return 4줄 제거와 대응 테스트 케이스 교체로 구성된 매우 제한적인 내부 서비스 수정이다. 외부 사용자 입력을 직접 처리하지 않으며, SQL 쿼리는 TypeORM 파라미터 바인딩을 사용해 인젝션 위험이 없다. 하드코딩된 시크릿이 없고, 에러는 외부에 노출되지 않으며, 인증/인가 공격 표면이 전무하다. 나머지 파일(consistency 검토 산출물, JSON 상태 파일)은 내부 워크플로 메타데이터로 보안 관점에서 무관하다. 보안 취약점 해당 사항이 없다.

---

## 위험도

NONE
