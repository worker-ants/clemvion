# 테스트(Testing) 리뷰

## 검토 범위 및 방법

이번 라운드(`01_24_51`)의 실제 코드 변경 대상은 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 한 파일이며(전체 diff 21개 파일 중 나머지 19개는 `plan/`·`review/consistency/`·`review/code/01_00_21/` 산출물이라 테스트 관점 분석 대상이 아니다), `plan/in-progress/column-guard-gaps.md` 는 배경 문서로만 참조했다. 직전 라운드(`review/code/2026/09/20/01_00_21/testing.md`)가 지적한 WARNING 1건이 이번 diff 에 그대로 남아 있는지, 그 수정(`a71642fe0`)이 실제로 문제를 없앴는지를 대상 파일과 TypeORM 소스(`node_modules/.pnpm/typeorm@0.3.31.../PostgresQueryRunner.js`)를 직접 열어 재확인했다.

## 발견사항

- **[정보 — 회귀 검증 완료]** 직전 라운드 WARNING("`QueryRunner` 커넥션 획득이 `try` 밖에 있어 실패 시 릴리스 누락 가능")이 실제로 해소됐다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 함수 `it('선언한 DB 기본값은...')` — 게이트 615~622행(connect/startTransaction), 655~662행(finally)
  - 상세: `qr.connect()` · `qr.startTransaction()` 이 이제 `try` 안으로 이동했고, `finally` 는 `if (qr.isTransactionActive) await qr.rollbackTransaction();` 를 안쪽 `try`, `qr.release()` 를 안쪽 `finally` 로 분리했다. TypeORM `PostgresQueryRunner.release()` 소스를 직접 확인한 결과 `releasePostgresConnection()` 은 `this.isReleased` 가드 뒤 `releaseCallback` 존재 여부만 보고 반환하므로, `connect()` 자체가 실패해 커넥션을 아예 획득하지 못한 경우에도 `release()` 호출이 안전하다(예외 없이 no-op) — 이 finally 구조가 커넥션 실패·트랜잭션 시작 실패·롤백 실패 세 경로 모두에서 릴리스를 보장한다. 회귀 없음.
  - 제안: 없음(확인 완료).

- **[정보]** `startTransaction()` 내부에서 `isTransactionActive` 가 `BeforeTransactionStart` 브로드캐스트 성공 직후, 실제 `START TRANSACTION` 쿼리(TypeORM `PostgresQueryRunner.startTransaction()`, `query("START TRANSACTION")` 실행) 성공 여부와 무관하게 `true` 로 남는 경로가 있다(그 사이 쿼리가 실패해도 재설정 코드가 없음). 이 경우 테스트의 `finally` 가 실제로 시작되지 않은 트랜잭션에 대해 `rollbackTransaction()`(→ `ROLLBACK`)을 호출하게 되지만, Postgres 는 활성 트랜잭션이 없는 세션에서의 `ROLLBACK` 을 오류가 아닌 NOTICE 로 처리해 실패하지 않는다. 발생 확률이 극히 낮고(네트워크 순간 단절 등) 실제 오류로 이어지지 않아 조치 불요 수준의 참고사항으로만 남긴다.
  - 위치: 해당 없음(TypeORM 라이브러리 내부 동작 — 테스트 코드 자체의 결함 아님)
  - 제안: 없음.

- **[정보 — 기존 INFO 재확인, 조치 불요]** 아래 항목들은 직전 라운드 testing.md 가 이미 지적했고 `RESOLUTION.md` 에서 "조치 없음(근거 기록)" 으로 처분된 사안으로, 이번 코드에도 그대로 남아 있음을 확인했다. 새 결함이 아니므로 등급 상향 없이 참고만 한다.
  - 부모 행(user/workspace/workflow) 원시 SQL 3연쇄가 3개 파일째 반복(공유 헬퍼 없음) — `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 게이트 619~630행.
  - 신규 라운드트립 테스트가 한 `it` 에서 두 컬럼(`model_config.kind`, `workflow_assistant_session.last_interaction_at`) 을 순차 검증 — 첫 `expect`(640행, `kind`)가 실패하면 두 번째 `expect`(654행, `lastInteractionAt`)는 실행되지 않아 진단 정보가 줄어들지만, 두 컬럼이 같은 트랜잭션·부모 행을 공유해야 해서 분리 시 픽스처가 중복되는 트레이드오프는 여전히 타당하다.
  - 두 신규 테스트의 판별력(뮤턴트 RED 확인)이 코드 상 대조군이 아니라 plan 문서(`plan/in-progress/column-guard-gaps.md` 체크리스트)에만 기록됨 — `COLUMN_LEVEL_SAMPLES` 처럼 코드로 고정된 회귀 자산은 아니지만, 테스트 자체는 여전히 유효한 회귀 가드다.
  - 검증 대상 엔티티(`ModelConfig`/`WorkflowAssistantSession`)는 실제 엔티티 정의(`codebase/backend/src/modules/model-config/entities/model-config.entity.ts`, `.../workflow-assistant/entities/workflow-assistant-session.entity.ts`)와 대조해 필수 컬럼(`provider`·`name`·`defaultModel`, `workspaceId`·`workflowId`·`userId`)이 정확히 채워져 있음을 확인 — 컴파일·런타임 결함 없음.

- **[정보]** JSDoc 이 아직 존재하지 않는 경로를 가리킴 — 결함이 아니라 마무리 커밋 이전 상태
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:29` (「근거: `plan/complete/column-guard-gaps.md`.」)
  - 상세: 이 시점에 `plan/complete/column-guard-gaps.md` 는 존재하지 않고 `plan/in-progress/column-guard-gaps.md` 로만 있다(직접 확인: `ls plan/complete/column-guard-gaps.md` → No such file). plan 체크리스트의 마지막 미완료 항목이 "트래커 해소 · 이 plan `plan/complete/` 로" 이므로, 같은 파일의 기존 두 참조(`plan/complete/entity-schema-declaration-drift.md`, `plan/complete/entity-column-declaration-drift.md`)가 이미 완료·이동된 plan 을 가리키는 것과 달리 이 참조는 마무리 커밋에서 plan 이 이동되면 비로소 유효해지는 선반영 참조다. 이 프로젝트의 통상적인 관례(마무리 커밋에서 plan 이동)를 따른 것으로 보이며 테스트 정확성에는 영향 없음.
  - 제안: 조치 불요 — 마무리 커밋에서 plan 이동과 함께 자연히 해소됨. 혹시 최종 `--impl-done` 전에 plan 이동이 누락되면 이 참조가 죽은 링크로 남으니 체크리스트 마지막 항목 완료 여부만 확인.

## 커버리지 · 엣지 케이스 · Mock · 격리 (요약 재확인)

- **커버리지**: plan 이 명시한 두 빈칸(예방 계층 자체의 회귀, `model_config.kind`/`workflow_assistant_session.last_interaction_at` 의 RETURNING 왕복)을 정확히 메운다. `COLUMN_LEVEL_SAMPLES` 리팩터(주석 추가)는 순수 문서화 변경으로 커버리지에 영향 없음.
- **Mock**: 두 신규 테스트 모두 mock/stub 미사용 — Postgres 의 실제 read-only 트랜잭션 강제와 DEFAULT 평가를 검증하는 목적상 적절하다.
- **격리**: 신규 테스트 둘 다 전용 연결(`readOnlyDataSourceOptions()` 로 만든 별도 `DataSource`, `ds.createQueryRunner()`)과 자체 트랜잭션 ROLLBACK 으로 격리되어 있고, `user`/`workspace` 유니크 컬럼(email, slug)에 `Date.now()+Math.random()`·`user.id` 기반 랜덤값을 써서 동일 파일 내 순차 실행은 물론 다른 e2e 파일과의 공유 DB 충돌 가능성도 낮다.
- **회귀**: 기존 컬럼 층 테스트(551행)는 로직 변경 없이 `log`→`sqlMemory` 개명과 헬퍼 추출만 적용돼 회귀 위험이 없다.

## 요약

직전 라운드에서 지적된 유일한 WARNING(신규 "기본값 왕복" 테스트의 `QueryRunner` 커넥션이 `try` 밖에서 획득돼 릴리스가 누락될 수 있음)은 `a71642fe0` 에서 `connect()`/`startTransaction()` 을 `try` 안으로, `release()` 를 중첩 `finally` 로 분리하는 방식으로 정확히 고쳐졌다 — TypeORM `PostgresQueryRunner.release()` 소스로 "연결 실패 시에도 release() 는 안전하다" 는 전제까지 확인했다. 나머지는 이전 라운드가 이미 INFO 로 남기고 `RESOLUTION.md` 가 "조치 없음(근거 기록)" 으로 처분한 항목들이 그대로 유지되고 있을 뿐, 새로 발견된 Critical/Warning 은 없다. 두 신규 테스트는 검증 대상 엔티티의 실제 컬럼 정의와 대조해도 정합하고, mock 없이 실제 Postgres 동작을 검증하는 방식이 목적에 맞으며, 격리·정리(cleanup)도 견고하다. 파일 최상단 JSDoc 의 `plan/complete/column-guard-gaps.md` 참조는 아직 존재하지 않는 경로를 가리키지만, 이는 plan 이동이 마무리 커밋에서 일어나는 이 프로젝트의 관례상 예상된 상태이며 테스트 자체의 결함은 아니다.

## 위험도

LOW
