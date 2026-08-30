# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 diff(`origin/main`(`5fbcd20b8`) → `HEAD`, 커밋 `1a12088f2`·`519671792`·`9d5e001bf`)의
실질 코드 변경은 두 파일뿐이다:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
  `updateExecutionStatus` else 분기(`linkedNodeExec` 없이 직접 마감)의 guarded raw
  UPDATE 를 `this.executionRepository.query()` 단발 호출에서
  `this.dataSource.transaction(async (manager) => { ... manager.query(...) ... })`
  로 옮기고, 두 분기가 공유하던 종결부(epilogue)를 `finishStatusTransition` 헬퍼로
  추출했다. 함수 JSDoc 에 "자신의 트랜잭션 콜백 안에서 호출 금지 — self-deadlock" 경고와
  20곳 호출부 어휘적(lexical) 대조 결과를 남겼다.
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` —
  위 변경에 맞춰 `mockTxManagerQuery` 를 확장(위임 방식)하고 회귀 테스트 2건 추가.

나머지(`CHANGELOG.md`, `plan/in-progress/*.md` 3건, `spec/5-system/4-execution-engine.md`,
`spec/data-flow/3-execution.md`, `review/code/**`·`review/consistency/**` 하위 신규 산출물
파일들)는 전부 문서/plan/이전 리뷰 라운드 산출물이며 코드 변경이 아니다 — 전문을 읽고
시크릿·인젝션 패턴을 grep 했으나(`api[_-]?key|secret|password|token|BEGIN (RSA|PRIVATE...)`
등) 코드성 시크릿은 없었다(`secret-store.md` 라는 문서 파일명 인용뿐).

## 검증 방법

`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 를 직접
`Read`/`Grep` 으로 열어 `NON_TERMINAL_STATUSES_SQL`/`NON_TERMINAL_OR_FAILED_STATUSES_SQL`
정의(522~552행)와 `updateExecutionStatus`(8584행)~`finishStatusTransition`(8768행)
전체를 대조했다. 저장소에는 아무 것도 쓰지 않았다(`git status --short` 로 리뷰 산출물
디렉터리 외 변경 없음 확인).

## 발견사항

- **[INFO]** self-deadlock 금지 제약이 런타임 가드가 아니라 JSDoc 주석 하나로만 시행된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8565`
    (`* **호출 제약 — 자신의 트랜잭션 콜백 안에서 부르지 말 것.**`) ~ `:8584`
    (`public async updateExecutionStatus(`)
  - 상세: 이번 변경으로 else 분기도 `dataSource.transaction()` 을 열게 되면서(`:8710`),
    `updateExecutionStatus` 는 이제 **두 분기 모두** 자체 트랜잭션을 연다. JSDoc 은 "이미
    열린 트랜잭션 콜백 안에서 호출하면 같은 Execution 행을 두 커넥션이 잠그려 해
    self-deadlock" 이라고 정확히 경고하고, 현재 20개 호출부(파일 내 11 + `EngineDriver`
    경유 9)를 어휘적으로 전수 대조해 위반이 없음을 확인했다고 적어 뒀다 — 근거·범위 모두
    투명하고 좋은 문서화다. 다만 이 불변식은 **코드로 강제되지 않는다**. TypeORM 의
    `dataSource.transaction()` 은 QueryRunner 를 명시 전달하지 않는 한 이미 열린 트랜잭션에
    합류(nest)하지 않으므로, 향후 어떤 호출자가 자신의 트랜잭션 콜백 안에서(신규 기능 추가·
    리팩터 중 실수로) 이 메서드를 호출하면 그 즉시 같은 행에 대한 락 대기가 서로를 막는
    커넥션 point 고갈/무한 대기(hang)로 이어질 수 있다 — 코드 리뷰가 놓치면 컴파일·단위
    테스트 모두 조용히 통과한다(mock 은 실제 락 경합을 재현하지 않는다). 가용성(DoS류) 관점의
    latent 리스크이며, 이번 diff 가 이 위험을 새로 만든 것은 아니고(else 분기가 이제 짝
    분기와 대칭이 되어 확인 범위만 넓어졌다) 즉시 트리거되는 결함도 아니다.
  - 제안: 필수는 아니나, `EntityManager`/`QueryRunner` 존재 여부로 "이미 트랜잭션 안"을
    감지해 개발 환경에서만 assert 하는 저비용 가드(예: `manager.queryRunner?.isTransactionActive`
    체크)를 고려할 만하다. 최소한 향후 호출부 추가 PR 의 리뷰 체크리스트에 이 제약을 명시해
    두면 사람이 놓칠 확률을 줄인다.

- **[INFO]** 고빈도 상태 전이 choke point 의 DB 트랜잭션 왕복 증가 (가용성 참고, 신규
  취약점 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8710`
    (`await this.dataSource.transaction(async (manager) => {`) ~ `:8766`
  - 상세: 종전 단발 autocommit UPDATE 1왕복이 BEGIN+UPDATE+COMMIT(또는 ROLLBACK) 3왕복이
    됐고, 이 else 분기는 `updateExecutionStatus` 호출부 대부분(RUNNING/COMPLETED/FAILED/
    CANCELLED 최상위 종결 등)이 타는 hot path 다. 고부하 시 커넥션 풀 점유 시간이 늘어나는
    자원 소비 증가는 있으나, 목적(관측 불가능한 데이터 유실 방지)이 비용을 상회하고 짝 전이
    분기가 이미 같은 패턴을 쓰고 있어 형태 통일이라는 점도 동일하다. 외부 공격자가 이 경로의
    호출 빈도를 임의로 늘릴 수 있는 입력 경로는 없다(내부 실행 엔진 로직).
  - 제안: 조치 불요. 부하 테스트/모니터링에서 커넥션 풀 사용률을 관찰 대상에 포함해 두는
    정도로 충분하다.

## 그 외 확인한 것 (문제 없음)

- **SQL 인젝션**: 변경된 UPDATE 문(`:8712`~`:8724`)은 `$1`~`$8` 파라미터 바인딩을 그대로
  쓴다. 유일한 문자열 보간부 `${elseStatusesSql}`(`:8724`, `WHERE ... AND status IN
  (${elseStatusesSql})`)은 `NON_TERMINAL_STATUSES_SQL`/`NON_TERMINAL_OR_FAILED_STATUSES_SQL`
  정적 클래스 상수(`:522`, `:543` — `Object.values(ExecutionStatus)` 로 조립되는 고정
  enum 값)이며, 사용자 입력이 개입할 여지가 없다. 이번 diff 는 이 조립 방식 자체를 바꾸지
  않고 기존 쿼리를 트랜잭션 콜백 안으로 옮긴 것뿐이라 인젝션 표면에 변화가 없다.
- **하드코딩된 시크릿**: 변경된 두 코드 파일 및 diff 전체(문서 포함)에 자격증명·API 키·
  토큰·인증서 리터럴 없음.
- **인증/인가**: 인가 검증에 해당하는 `WHERE status IN (...)` 가드는 값·조립 방식 모두
  변경 없음. 오히려 트랜잭션화로 "가드가 발동한 순간 DB 는 committed 인데 애플리케이션은
  실패로 아는" 상태 불일치 창이 닫혔다 — 데이터 정합성 방향의 개선.
- **입력 검증**: 이번 diff 는 사용자 입력 처리 경로가 아니라 내부 실행 엔진의 DB 쓰기
  스코프(트랜잭션 경계)만 바꾼다.
- **에러 처리**: `updateReturningRows` throw 메시지(`` `updateExecutionStatus, execution
  ${execution.id} → ${newStatus}` ``, `:8730` 부근)는 이번 diff 이전부터 있던 형식 그대로이며
  내부 UUID·enum 값만 포함해 민감정보 노출이 아니다. 트랜잭션 래핑 자체가 "롤백 누락"이라는
  에러 처리 결함을 고치는 것이 diff 의 목적이다.
- **암호화**: 해당 없음.
- **의존성**: 신규 의존성 없음. `dataSource.transaction()` 은 짝 전이 분기가 이미 쓰던
  기존 TypeORM API 를 재사용한 것뿐이다.
- **테스트 파일(`execution-engine.service.spec.ts`)**: mock 위임 구조(`mockTxManagerQuery`
  → `mockExecutionRepo.query`)와 신규 테스트 2건은 테스트 인프라 내부 로직으로 프로덕션
  경로·보안에 영향 없음.
- **문서 파일들**(`CHANGELOG.md`, `plan/in-progress/*.md`, `spec/**`,
  `review/code/**`·`review/consistency/**` 신규 산출물)은 서술 갱신뿐이며 실행 코드가
  아니다.

## 요약

이번 diff 의 핵심은 `updateExecutionStatus` else 분기의 guarded UPDATE 를
`dataSource.transaction()` 으로 감싸, shape 위반 시 이미 실행된 UPDATE 를 함께 롤백시켜
"DB 는 terminal 인데 종결 이벤트가 영구히 유실되는" 데이터 정합성 결함을 닫는 것이다.
SQL 은 기존과 동일하게 파라미터 바인딩되며 비-파라미터 보간부는 enum 기반 정적 상수뿐이라
인젝션 위험이 없고, 시크릿·인증/인가·입력검증·암호화·의존성 어느 항목에서도 신규 취약점이
발견되지 않았다. 유일하게 기록해 둘 만한 것은 새로 명문화된 self-deadlock 금지 제약이
런타임 가드가 아니라 JSDoc 주석으로만 시행된다는 점(latent 가용성 리스크, 현재 20개
호출부는 위반 없음을 확인)과, 고빈도 경로의 DB 왕복 증가라는 의도된 트레이드오프다 — 둘 다
INFO 수준이며 즉시 조치가 필요한 결함은 아니다.

## 위험도

NONE
