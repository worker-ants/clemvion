# Security Review

## 리뷰 범위 요약

이번 diff 의 실질 코드 변경은 두 파일뿐이다.

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted()` 의 Execution UPDATE + NodeExecution cascade UPDATE 두 SQL 문을 `this.dataSource.transaction(...)` 으로 묶어 원자성을 보강 (자매 함수 `cancelParkedExecution`/`markWebChatIdleTimeout` 과 동형화).
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 위 변경에 대응하는 회귀 테스트(트랜잭션 밖 repo 호출 시 즉시 throw 하는 mock 하네스 `installStalledTx` 추가).

나머지(파일 3~13)는 `plan/*.md`, `review/consistency/**` 산출물, `spec/5-system/4-execution-engine.md` 문서 갱신으로, 애플리케이션 실행 경로나 외부 입력 처리와 무관한 문서/메타데이터 변경이다.

## 발견사항

발견된 신규 보안 결함 없음.

- **[INFO]** SQL 인젝션 표면 없음 — 확인만
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3348`-`3395` (`finalizeStalledExhausted` 내 `manager.createQueryBuilder()...update(Execution)`/`update(NodeExecution)` 블록)
  - 상세: 두 UPDATE 모두 TypeORM QueryBuilder 의 파라미터 바인딩(`where('id = :id', {...})`, `andWhere('status = :running', {...})`, `.setParameter(TERMINAL_FINISHED_AT_PARAM, finishedAt)`)만 사용한다. `durationMs: () => TERMINAL_DURATION_MS_SQL` 로 삽입되는 SQL 조각(`codebase/backend/src/shared/utils/terminal-duration.ts:120`)도 상수 문자열 + 바인딩 파라미터(`:terminalFinishedAt`)와 컴파일타임 상수(`PG_INT4_MAX`)로만 구성되어 있고 사용자 입력이 문자열 결합으로 들어가지 않는다. 트랜잭션으로 감싼 것 외에 쿼리 구성 로직 자체는 변경되지 않았다.
  - 제안: 조치 불요. (참고용 확인 사항)

- **[INFO]** 트랜잭션화는 보안이 아닌 데이터 무결성 개선이나, 무결성 훼손 자체가 잠재적 보안 리스크(orphaned RUNNING 상태로 인한 상태 조작/DoS 유사 상황)를 줄이는 방향
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `finalizeStalledExhausted` 함수 전체
  - 상세: 종전엔 Execution UPDATE 커밋 후 NodeExecution UPDATE 가 실패하면 자식 NodeExecution 이 영구 `RUNNING` 으로 잔류할 수 있었다(§7.1 코멘트에 명시). 이 diff 는 두 쓰기를 단일 트랜잭션으로 묶어 부분 커밋을 방지한다 — 공격 표면을 늘리지 않고 오히려 일관성 없는 중간 상태(잠재적으로 리소스 고갈/좀비 실행 악용 여지)를 줄인다.
  - 제안: 없음. 참고로만 기록.

- **[INFO]** 에러 메시지에 민감정보 노출 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3338-3341` (`stalledError` 객체), `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts` `onFailed`
  - 상세: `finalizeStalledExhausted` 가 DB/emit 에 싣는 `error.message` 는 고정 문자열(`'Execution failed: worker crash (stalled 재배달 attempts 소진)'`)이며 사용자 입력이나 내부 예외 스택을 그대로 노출하지 않는다. (참고: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 별도로 기록된 "종결 `error.message` 값-패턴 마스킹 비대칭" 항목은 `error instanceof Error ? error.message : String(error)` 형태로 임의 예외 메시지를 싣는 **다른** 종결 경로들에 해당하며, 이 PR 의 diff 범위 밖의 선존 갭으로 plan 문서 스스로 명시하고 있다 — 이 diff 가 만들거나 확장한 문제가 아니다.)
  - 제안: 없음(별도 트래커에서 이미 관리 중).

- **[INFO]** 테스트 mock 하드코딩 문자열은 시크릿 아님
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4899`, `:4902` 등 (`throw new Error('트랜잭션 밖 executionRepository 사용')`)
  - 상세: 테스트 전용 가드 문자열이며 API 키/토큰/자격증명과 무관.
  - 제안: 없음.

## 요약

이번 diff 는 `finalizeStalledExhausted()` 의 두 UPDATE 문을 `dataSource.transaction()` 으로 묶어 원자성을 보강하는 신뢰성/데이터 무결성 개선이며, 쿼리는 변경 전과 동일하게 TypeORM 파라미터 바인딩만 사용해 SQL 인젝션 표면이 없다. 하드코딩된 시크릿, 인증/인가 로직 변경, 사용자 입력 검증 로직 변경, 암호화 관련 변경이 전혀 없고, 에러 메시지도 고정 문자열이라 민감정보 노출 위험이 없다. 나머지 변경 파일은 plan/consistency-review 산출물과 spec 문서 갱신으로 런타임 보안 표면과 무관하다. 신규 보안 결함은 발견되지 않았다.

## 위험도

NONE
