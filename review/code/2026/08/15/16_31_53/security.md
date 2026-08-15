STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# Security Review — `finalizeStalledExhausted` 트랜잭션화 + plan/문서 갱신

## 리뷰 범위

실질 코드 변경은 두 파일뿐이다:
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted` 의 Execution UPDATE + NodeExecution cascade UPDATE 를 `this.dataSource.transaction(async (manager) => {...})` 로 원자화 (자매 `cancelParkedExecution`/`markWebChatIdleTimeout` 과 동형).
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `installStalledTx` 헬퍼 도입 + 회귀 테스트 3건 보강.

나머지(`CHANGELOG.md`, `plan/**`, `review/**`)는 process 문서로 실행 코드가 아니며 보안 표면에 영향 없음(하드코딩 시크릿 여부만 grep 으로 확인 — 없음).

## 점검 관점별 확인

1. **인젝션(SQL 등)**: 두 UPDATE 모두 TypeORM `QueryBuilder` 의 `where('id = :id', {...})` / `andWhere('status = :running', {...})` / `setParameter(...)` 파라미터 바인딩만 사용한다. 문자열 결합·템플릿 리터럴 조합이 없어 SQL 인젝션 표면이 없다. `durationMs: () => TERMINAL_DURATION_MS_SQL` 은 사용자 입력이 아니라 코드 내 상수 SQL 표현식이다. 변경 전과 SQL 구성 방식이 동일하고(리포지토리 → `manager` 로 바뀐 것뿐), 새로 도입된 raw string 조합도 없다.
2. **하드코딩된 시크릿**: diff 전체를 `api[_-]?key|secret|password|token|bearer|private[_-]?key|BEGIN ... PRIVATE KEY|AKIA...` 패턴으로 grep — 매칭 0건(리뷰 문서 산문 중 "owner-token" 이라는 설계 용어 1건뿐, 실제 자격증명 아님).
3. **인증/인가**: 이 함수는 BullMQ 워커의 `onFailed`(`@OnWorkerEvent('failed')`) 콜백에서만 호출되는 내부 시스템 경로다. HTTP 컨트롤러·외부 입력 파라미터가 관여하지 않으므로 이번 diff 로 인가 경계가 바뀌지 않는다. `executionId` 는 BullMQ job 데이터에서 오며 이번 변경으로 검증 로직이 약화되지 않았다(기존과 동일하게 `WHERE id = :id AND status = :running` 조건부 UPDATE).
4. **입력 검증**: 이 함수에 새로운 외부 입력 경로가 추가되지 않았다. `executionId` 취급 방식(파라미터 바인딩)도 변경 전과 동일.
5. **OWASP Top 10**: 해당 사항 없음 — 순수 내부 DB 트랜잭션 원자성 리팩터. A03(Injection) 은 위 1번에서 확인. A01(Broken Access Control)/A07(Auth Failures) 관련 코드 경로 접촉 없음.
6. **암호화**: 해시/암호화·평문 전송 관련 코드 변경 없음.
7. **에러 처리**: `this.dataSource.transaction(...)` 이 throw 하면 (자매 두 함수와 달리) 함수 레벨 `try/catch` 없이 호출자로 전파되지만, 유일한 호출부(`execution-run.processor.ts` 의 `onFailed`)가 `.catch((err) => this.logger.error(...))` 로 흡수한다. 로그에 실리는 정보는 내부 로거(`this.logger.error`)로만 가며 사용자 응답 경로에 노출되지 않는다 — 민감정보 유출 경로 아님(이 관찰은 이미 이전 라운드 `database.md`/`maintainability.md` 에서 INFO 로 기록됨, 보안 등급 아님).
8. **의존성 보안**: 새 패키지·버전 변경 없음(`this.dataSource.transaction` 은 기존 TypeORM API).

## 발견사항

없음. 이번 diff 는 사용자 입력·인증 경계·시크릿·직렬화 형식에 영향을 주지 않는 순수 내부 트랜잭션 원자성 수정이며, 두 UPDATE 모두 기존과 동일하게 파라미터 바인딩만 사용한다.

## 요약

`finalizeStalledExhausted` 를 `dataSource.transaction` 으로 감싼 변경은 이미 원자적이던 자매 함수(`cancelParkedExecution`, `markWebChatIdleTimeout`)와 동일한 패턴을 재사용한 순수 정합성(원자성) 개선이며, 쿼리는 계속 파라미터 바인딩만 사용해 SQL 인젝션 표면이 없다. 새로운 외부 입력 경로·인증/인가 경계 변경·하드코딩 시크릿이 없고, 에러는 최종적으로 호출부 `.catch()` 로 흡수되어 사용자에게 노출되지 않는다. 함께 포함된 `plan/**`·`CHANGELOG.md`·`review/**` 변경은 전부 프로세스 문서로 실행 코드나 보안 표면에 영향을 주지 않는다.

## 위험도

NONE
