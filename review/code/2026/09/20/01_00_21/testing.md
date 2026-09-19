# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** 새 기본값 왕복 테스트의 `QueryRunner` 커넥션 획득이 `try` 밖에 있어 실패 시 릴리스가 안 될 수 있다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:614-617` (`const qr = ds.createQueryRunner();` / `await qr.connect();` / `await qr.startTransaction();` / `try {`)
  - 상세: `qr.connect()` 는 커넥션 풀에서 전용 커넥션을 체크아웃한다. 이 두 줄이 `try` 블록 **밖**에 있어, `connect()` 는 성공했는데 `startTransaction()` 이 실패하는 경우(혹은 향후 두 호출 사이에 코드가 추가되는 경우) `finally` 의 `qr.release()`(라인 654-657)가 실행되지 않아 커넥션이 반환되지 않는다. 같은 파일의 기존 패턴(`readOnly.initialize()` 를 감싸는 컬럼 층 테스트, 583-588행 근방)은 `initialize()` 자체가 실패하면 애초에 해제할 자원이 없어 안전하지만, 이 테스트는 `connect()` 가 성공한 뒤 `startTransaction()` 이 실패하는 시나리오에서 실제로 자원이 새는 차이가 있다. `finally` 안에서도 `rollbackTransaction()` 이 던지면 그 다음 줄의 `release()` 가 스킵되는 것도 같은 종류의 문제다.
  - 제안: `qr.connect()`/`qr.startTransaction()` 을 `try` 안으로 옮기고, `finally` 에서 `if (qr.isTransactionActive) await qr.rollbackTransaction();` 로 방어한 뒤 `release()` 를 별도로(가능하면 또 다른 `try/finally` 또는 `Promise.allSettled` 로) 호출해 롤백 실패가 release 를 막지 않게 한다. 발생 확률은 낮지만(정상 경로에서는 거의 안 일어남), 새면 이후 테스트들의 풀 여유를 갉아먹어 무관한 테스트가 간헐적으로 타임아웃하는 디버깅하기 어려운 flake 를 만든다.

- **[INFO]** 기본값 왕복 테스트에서 부모 행(user/workspace/workflow)은 원시 SQL, 대상 엔티티(ModelConfig/WorkflowAssistantSession)는 TypeORM API — 두 스타일이 섞여 있다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:618-647`
  - 상세: `user`/`workspace`/`workflow` 는 `qr.query(...)` 원시 INSERT 로, 정작 검증 대상인 `ModelConfig`/`WorkflowAssistantSession` 은 `qr.manager.create/save` 로 만든다. 원시 SQL 은 그 세 테이블의 NOT NULL 컬럼 목록을 테스트 파일에 다시 하드코딩하는 셈이라, 나중에 그 테이블에 기본값 없는 새 NOT NULL 컬럼이 추가되면 이 테스트가 "기본값 정정과 무관한" INSERT 실패로 깨져 원인 파악을 흐릴 수 있다. 검증 대상이 아닌 세 테이블도 TypeORM `manager.create/save` 로 만들면 스키마 변경에 더 강해지고 파일 안 스타일도 일관돼진다. 다만 실용적 트레이드오프로 이해할 수 있는 수준이라 INFO 로 남긴다.

- **[INFO]** 두 신규 테스트 모두 검증 성격상 mock 이 필요 없고, 실제로 mock 을 쓰지 않았다 — 적절함
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:594-658`
  - 상세: 예방 계층(읽기 전용 세션) 테스트와 DB 기본값 RETURNING 테스트는 둘 다 Postgres 의 실제 동작(트랜잭션 read-only 강제, DEFAULT 표현식 평가)을 검증하는 것이 목적이라 mock/stub 을 쓰면 검증 대상 자체가 사라진다. 실 DB(read-only 세션 별도 연결, 트랜잭션 ROLLBACK)를 그대로 쓴 것은 이 테스트 성격에 맞는 선택이다. 감점 요인 아님 — 참고로 기록.

- **[INFO]** 두 신규 테스트의 판별력(discriminating power)이 코드 자체에는 남아 있지 않고 plan 문서(수동 뮤테이션 확인)에만 기록되어 있다
  - 위치: `plan/in-progress/column-guard-gaps.md` 체크리스트 항목 2번째, `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:594-658`
  - 상세: plan 은 "읽기 전용 옵션 제거 → RED", "`kind` default 제거 → RED", "`lastInteractionAt` default 제거 → RED" 를 수동으로 확인했다고 적었다(`d8fb708d5`). 이 자체는 좋은 관행(설계 근거를 뮤턴트로 반증)이지만, 같은 파일의 `COLUMN_LEVEL_SAMPLES`(판별력을 코드 상수로 고정해 두는 "판별력 대조군" 테스트, 537-548행)와 달리 이 두 신규 테스트는 판별력의 증거가 실행 가능한 회귀 자산이 아니라 plan 서술에만 남는다. 코드 리뷰 시점 이후 누군가 `readOnlyDataSourceOptions()` 의 `extra` 를 실수로 완화해도, 이번 커밋의 판별력 검증은 재실행되지 않는다(테스트 자체는 여전히 통과하는 회귀 테스트이므로 실제 방어력은 있다 — 다만 "코드로 고정된 대조군"은 아니라는 차이). 조치 불요 수준의 참고사항.

## 요약

리뷰 대상 중 실제 테스트 코드 변경은 `entity-schema-declarations.e2e-spec.ts` 한 파일이며(나머지는 plan/consistency 산출물), plan(`plan/in-progress/column-guard-gaps.md`)이 짚은 두 빈칸 — 예방 계층(읽기 전용 세션) 자체의 회귀 테스트, 그리고 `model_config.kind` · `workflow_assistant_session.last_interaction_at` 의 DB 기본값이 값 생략 insert 뒤 엔티티로 RETURNING 되는지 — 을 정확히 메운다. 두 신규 테스트 모두 자체 트랜잭션/전용 커넥션으로 격리되어 기존 테스트와 상태를 공유하지 않고, mock 없이 실제 Postgres 동작을 검증하는 것이 검증 목적에 맞으며, plan 체크리스트에 따르면 세 가지 뮤턴트(읽기 전용 옵션 제거·두 default 제거)로 판별력을 수동 확인했다. `readOnlyDataSourceOptions()` 추출과 `log`→`sqlMemory` 개명은 회귀 위험 없는 순수 리팩터링으로 확인했다. 유일하게 실질적인 지적은 신규 기본값 왕복 테스트의 `QueryRunner` connect/startTransaction 이 `try` 밖에 있어 실패 시 커넥션 릴리스가 스킵될 수 있다는 자원 정리 견고성 문제이며, 발생 확률은 낮고 즉시 회귀를 유발하지는 않는다.

## 위험도
LOW
