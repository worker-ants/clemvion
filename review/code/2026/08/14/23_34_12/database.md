### 발견사항

- **[INFO]** `finalizeStalledExhausted` 의 두 UPDATE(부모 `Execution` → 자식 `NodeExecution` cascade)가 트랜잭션으로 묶여 있지 않다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted` 함수 (게이트 `3264`~`3306`)
  - 상세: 이번 diff 는 두 `.createQueryBuilder().update(...)` 호출의 **에러 페이로드 값**을 `stalledError` 변수로 공유하도록 리팩터링했을 뿐, 두 쓰기 사이에 `DataSource.transaction()`/`queryRunner` 로 원자성을 도입하지 않았다. 부모 UPDATE 성공 후 자식 cascade UPDATE 전에 프로세스가 죽으면 부모는 FAILED, 일부 자식 NodeExecution 은 여전히 RUNNING 으로 남을 수 있다. 다만 이는 **이 PR 이전부터 존재하던 구조**이고(값 표현만 바뀜), 함수 상단 JSDoc 이 이미 "알려진 이론적 race(수용)" 로 문서화하고 있어 이번 변경이 새로 만든 리스크는 아니다.
  - 제안: 신규 결함은 아니므로 이번 PR 범위의 fix 는 불요. 원자성을 원하면 별도 작업으로 `queryRunner.startTransaction()` 도입을 고려.

- **[INFO]** DB 컬럼(`Execution.error`/`NodeExecution.error`, JSONB `Record<string, unknown>`)의 스키마 변경은 없다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` (신규), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  - 상세: 이번 변경은 `error` 컬럼에 **쓰는 값의 필드 구성**(키 생략 vs `null`)을 emit 시점(wire 변환)에서만 정규화하는 순수 함수(`toTerminalErrorPayload`)를 도입한 것이며, DB write 자체(`.set({...})`)는 기존과 동일하게 부분 객체(`{message}`, `{code, message}` 등)를 그대로 저장한다. 마이그레이션 파일·엔티티 컬럼 정의 변경은 diff 에 없다. 파라미터화된 쿼리(`.where('id = :id', { id: executionId })`)도 그대로 유지된다 — SQL 인젝션 관련 회귀 없음.
  - 제안: 없음(정보성).

### 요약
이번 변경은 `execution.failed` 이벤트의 `error` payload 를 문자열에서 EIA §6.4 객체 형태로 통일하는 **애플리케이션/wire 계층 리팩터링**이며, DB 레벨(인덱스·N+1·트랜잭션 경계·마이그레이션·스키마·커넥션 관리·파라미터화 쿼리)에는 실질적인 변경이 없다. `execution-engine.service.ts`/`retry-turn.service.ts` 의 기존 guarded UPDATE 패턴(조건부 `WHERE status = …`, `returning`)과 파라미터 바인딩은 그대로 유지되고, 새 쿼리·반복문 내 개별 쿼리·신규 테이블·컬럼 변경은 없다. `finalizeStalledExhausted` 의 부모/자식 두 UPDATE 가 트랜잭션으로 묶이지 않은 점은 pre-existing 이며 이미 코드 주석에 수용된 리스크로 문서화돼 있어 이번 diff 가 새로 만든 문제는 아니다.

### 위험도
NONE
