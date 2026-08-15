STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# Security Review — `finalizeStalledExhausted` 트랜잭션화 (16_44_28)

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted`
  의 Execution/NodeExecution 두 조건부 UPDATE 를 `dataSource.transaction()` 으로 원자화 (자매
  `cancelParkedExecution`/`markWebChatIdleTimeout` 과 동형)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 대응 회귀 테스트
  3건 + `installStalledTx` 헬퍼
- 그 외 `CHANGELOG.md`, `plan/**`, `review/**`, `spec/5-system/4-execution-engine.md` — process/문서
  산문 (실행 코드 아님, 코드 유입 표면 없음)

## 점검 관점별 확인

1. **인젝션**: 두 UPDATE 모두 TypeORM `QueryBuilder` 의 파라미터 바인딩(`:id`, `:running`,
   `:executionId`)만 사용한다. 문자열 결합·raw SQL 삽입 없음. `durationMs: () => TERMINAL_DURATION_MS_SQL`
   은 함수가 반환하는 SQL 표현식이지만 사용자 입력이 아니라 고정 상수(헬퍼 정의)다. SQL 인젝션 표면 없음.
2. **하드코딩된 시크릿**: 전체 diff(`git diff origin/main...HEAD`)를
   `api[_-]?key|secret|password|token|BEGIN ... PRIVATE KEY|Bearer ...` 패턴으로 grep — 매칭 0건
   (리뷰 산문 중 "owner-token" 은 설계 용어이지 실제 자격증명 아님).
3. **인증/인가**: `finalizeStalledExhausted(executionId: string)` 은 HTTP 컨트롤러에서 직접 호출되지
   않는다. 유일 호출부는 `execution-run.processor.ts` 의 BullMQ `@OnWorkerEvent('failed')` 핸들러
   `onFailed` 이고, `executionId` 는 job 데이터(`job.data.executionId`)에서 온다 — 큐에 이미 등록된
   내부 작업 식별자이지 요청 시점의 사용자 입력이 아니다. 이 변경으로 인가 경계가 새로 생기거나
   약화되지 않았다.
4. **입력 검증**: 함수 시그니처·호출 경로 모두 이번 diff 로 바뀌지 않았다. `executionId` 는 조건부
   `WHERE id = :id AND status = :running` 로만 쓰이므로 타입 강제(파라미터 바인딩)가 곧 새니타이징
   역할을 한다.
5. **OWASP Top 10**: 해당 사항 없음(신규 엔드포인트·직렬화·역직렬화·외부 입력 파싱 없음). 트랜잭션
   원자화는 오히려 "부분 커밋으로 인한 데이터 무결성 저하"를 닫는 개선으로, 데이터 정합성 측면의
   보안 속성(가용성/무결성)을 향상시킨다.
6. **암호화**: 해당 없음(암호화/해시 로직 변경 없음).
7. **에러 처리**: `stalledError = { code: 'WORKER_HEARTBEAT_TIMEOUT', message: 'Execution failed:
   worker crash (stalled 재배달 attempts 소진)' }` 는 고정 상수 메시지로 스택 트레이스·내부 경로·
   DB 오류 원문을 포함하지 않는다. 트랜잭션 콜백에서 발생한 실제 예외(`deadlock detected` 등)는
   함수 밖으로 throw 되지만, 유일 호출부가 `.catch((err_) => this.logger.error(...))` 로 서버 로거에만
   기록하고 클라이언트/이벤트로는 전파하지 않는다 — 회귀 테스트(`트랜잭션 중간 실패는 삼키지 않고
   던진다 + 종결 이벤트도 안 나간다`)가 `emitSpy` 미호출을 단언해 이 경계를 잠갔다. 민감 정보 노출
   경로 없음.
8. **의존성 보안**: 신규 패키지/버전 변경 없음. 기존 `DataSource.transaction()` API(TypeORM)만 사용.

## 발견사항

없음.

## 요약

이번 변경은 `finalizeStalledExhausted` 의 Execution/NodeExecution 두 조건부 UPDATE 를
`dataSource.transaction()` 으로 원자화해 부분 커밋(자식 `NodeExecution` 영구 `RUNNING` 잔류) 결함을
닫는 순수 정합성 개선이다. 두 UPDATE 모두 파라미터 바인딩만 사용해 SQL 인젝션 표면이 없고,
`executionId` 는 BullMQ job 데이터에서 오는 내부 식별자로 HTTP 인가 경계와 무관하며, 에러 메시지는
고정 상수이고 예외 전파 경로도 서버 로거로만 흡수된다(클라이언트 노출 없음). diff 전체에 하드코딩된
시크릿·자격증명도 없다. 새로 도입된 보안 취약점은 발견되지 않았다.

## 위험도

NONE
