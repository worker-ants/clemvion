# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `default` 선언 추가로 INSERT 시 TypeORM 의 `RETURNING` 조회가 새로 발생 — 실제 런타임 동작 변화, e2e 로 검증 완료(리뷰 도중 체크리스트 갱신 관측)
  - 위치: `codebase/backend/src/modules/model-config/entities/model-config.entity.ts:46` (`kind` 컬럼 `default: 'chat'` 추가), `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:75-79` (`lastInteractionAt` 컬럼 `default: () => 'now()'` 추가)
  - 상세: `plan/in-progress/entity-column-declaration-drift.md` 가 "런타임 영향" 절에서 밝히듯, TypeORM 은 `default` 가 선언된 컬럼을 insert 후 `RETURNING` 으로 다시 읽어 엔티티 객체에 채운다(`ReturningResultsEntityUpdator`). 값 자체는 기존 DB 기본값과 동일해 의미상 회귀는 아니지만 **쿼리 형태(추가 RETURNING 절)가 실제로 바뀌는 진짜 런타임 부작용**이다. 두 컬럼 모두 애플리케이션 코드(`model-config.service.ts`, `workflow-assistant-session.service.ts`)가 항상 값을 명시적으로 넘기므로 값 불일치 위험은 낮다. 리뷰 시작 시점엔 plan 하단 체크리스트의 `TEST WORKFLOW (lint · unit · build · e2e)` 항목이 미체크(`- [ ]`) 상태였으나, **리뷰 도중 그 파일이 외부에서 갱신되는 것을 관측**했다 — 지금은 `- [x] TEST WORKFLOW … e2e PASS(backend 354 — 새 컬럼 가드 포함 · Playwright 51). default 선언으로 insert 뒤 RETURNING 이 늘어나는 런타임 변화도 전체 e2e 로 확인` 으로 바뀌어 있다. 이 파일 수정은 본 리뷰가 만든 것이 아니다(본 세션은 이 경로에 Write/Edit 를 실행한 적이 없다) — 정상 워크플로 진행(구현 세션 또는 오케스트레이터)에 의한 것으로 보이며, 결과적으로 이 항목이 우려했던 "미검증" 상태는 리뷰 종료 시점 기준으로 해소됐다.
  - 제안: 조치 불필요(이미 e2e 로 확인됨). 병합 전 최종적으로 `plan` 체크리스트의 이 갱신이 실제 커밋(`3c2b39305` 등)에 반영돼 있는지만 재확인.

- **[INFO]** 신규 e2e 가드가 TypeORM 의 비공개/문서화되지 않은 내부 API(`createSchemaBuilder().log()`)에 의존
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — `it('컬럼 — TypeORM 스키마 비교기가 컬럼 정의 변경을 내지 않는다 …')` 블록 (`ds.driver.createSchemaBuilder().log()` 호출부)
  - 상세: 이 메서드가 카탈로그만 읽고 DDL 을 실행하지 않는다는 사실은 `plan/in-progress/entity-column-declaration-drift.md` 가 TypeORM 0.3.31 소스를 직접 읽어 확인했다고 적고 있고, 호출부 주석도 동일하게 설명한다 — 현재로선 read-only 로 판단할 근거가 있다. 다만 이는 TypeORM 의 공개 계약이 아니라 특정 버전의 내부 구현 세부사항이므로, 향후 TypeORM 업그레이드 시 이 전제가 깨지면 e2e 가 실행되는 실제 Postgres(`clemvion_e2e`) 스키마에 의도치 않은 DDL 을 낼 잠재적 경로가 된다.
  - 제안: 지금 당장 조치는 불필요. TypeORM 버전을 올릴 때 이 테스트가 여전히 read-only 인지(`upQueries`/`downQueries` 만 반환하고 실제 DB 상태가 변하지 않는지) 재확인하는 메모를 plan 이나 코드 주석에 남겨두면 다음 업그레이드 담당자가 놓치지 않는다.

- **[INFO]** `enumName` 추가(`Edge.type` → `'edge_type'`, `Node.category` → `'node_category'`)는 메타데이터 정정으로, 애플리케이션 CRUD 경로에서 파라미터 캐스팅 방식이 바뀔 가능성을 완전히 배제하는 실측은 diff 안에 없음
  - 위치: `codebase/backend/src/modules/edges/entities/edge.entity.ts:53-58`, `codebase/backend/src/modules/nodes/entities/node.entity.ts:48`
  - 상세: 병행 실행된 consistency-check(`review/consistency/2026/09/19/16_54_09/naming_collision.md` INFO #9)가 두 enum 타입 이름이 `V001__initial_schema.sql`/`V003__add_trigger_category.sql` 이래 실제 DB 에 존재해 온 기존 이름임을 확인했고, `synchronize: false` 라 DDL 도 실행되지 않는다. 리포지토리 API(`find`/`save`)를 통한 일반 CRUD 는 Postgres 의 unknown-type 파라미터 암묵적 캐스팅에 의존하므로 `enumName` 값 자체가 쿼리 실행에 영향을 주는 경로는 낮다. 저장소 안에서 `Edge`/`Node` 에 대해 raw QueryBuilder 로 `type`/`category` 를 파라미터 비교하는 코드도 발견되지 않았다(grep 결과 엔티티·DTO 선언 두 곳뿐).
  - 제안: 조치 불필요. 참고로만 남긴다.

## 부작용이 아닌 것으로 확인한 것들 (오탐 방지용 기록)

- 8개 엔티티 컬럼 데코레이터 변경(`type: 'uuid'` · `enumName` · `default`)은 전부 TypeORM 메타데이터이며 `synchronize: false` 로 DDL 을 발생시키지 않는다 — 선언을 실제 DB 사실에 맞추는 정정일 뿐 스키마 변경이 아니다.
- `ModelConfig.kind`, `WorkflowAssistantSession.lastInteractionAt` 모두 서비스 계층에서 항상 값을 명시적으로 넘기는 호출부만 확인됨(`model-config.service.ts`, `workflow-assistant-session.service.ts`) — DB 기본값에 의존해 값이 달라지는 호출 경로 없음.
- 어떤 함수/메서드 시그니처도, TS 필드 타입도, export 되는 공개 인터페이스도 바뀌지 않았다.
- 새 전역 변수 없음 — `UNDECLARED_COLUMNS`·`COLUMN_LEVEL` 은 테스트 파일 module-scope 의 `Readonly` 상수이며 기존 `FK_ACTION` 과 같은 패턴.
- 환경 변수 신규 읽기/쓰기 없음 — e2e 커넥션의 `process.env.DB_*` 는 기존 파일에 이미 있던 코드.
- 네트워크 호출 신규 없음 — e2e 테스트가 여는 Postgres 연결은 기존 test suite 가 이미 열던 것과 동일 커넥션.
- `plan/*.md`, `review/**/*.md`, `*_retry_state.json`, `meta.json` 등은 개발/리뷰 워크플로가 의도적으로 생성한 산출물(plan 문서, consistency-check 세션 로그)이며 애플리케이션 런타임 파일시스템 부작용이 아니다.

## 리뷰 중 관측한 워킹트리 변경 (본 세션이 만들지 않음)

리뷰 도중 `plan/in-progress/entity-column-declaration-drift.md` 가 외부에서 갱신되는 것을 관측했다(`git status --short` 로 확인, 본 세션은 이 경로에 Write/Edit 를 실행하지 않았다). 변경 내용은 체크리스트의 `TEST WORKFLOW` 항목을 `- [ ]` → `- [x]`(e2e PASS 근거 포함)로 바꾼 것뿐이며, 본 리뷰의 판단(위 첫 번째 발견사항)과 상충하지 않고 오히려 그 우려를 해소하는 방향이다. 병렬 세션/오케스트레이터의 정상 진행으로 보이나, 이 리뷰가 참조한 스냅샷과 최종 커밋 시점의 파일 상태가 다를 수 있다는 점은 통합 시 유의할 것.

## 요약

이번 변경은 8개 TypeORM 엔티티의 컬럼 데코레이터를 실제 DB 스키마 사실에 맞게 정정하고(`type`/`enumName`/`default`), 그 정합성을 검증하는 e2e 가드 한 케이스를 추가한 것이 핵심이다. `synchronize: false` 환경이라 이 정정들이 DDL 을 실행하지 않으며, 시그니처·공개 인터페이스·전역 상태·환경 변수·네트워크 호출 어느 것도 바뀌지 않았다. 유일하게 실질적인 런타임 부작용은 `default` 를 새로 선언한 두 컬럼(`ModelConfig.kind`, `WorkflowAssistantSession.lastInteractionAt`)에서 INSERT 시 TypeORM 이 `RETURNING` 절로 값을 재조회하게 된다는 점인데, plan 문서가 스스로 인지·서술한 의도된 결과이고 모든 호출부가 값을 명시적으로 넘기며, 리뷰 도중 확인한 바로는 이미 전체 e2e 로 검증까지 완료됐다. 신규 e2e 가드가 TypeORM 내부 API(`createSchemaBuilder().log()`)의 read-only 특성에 의존하는 점, `enumName` 변경의 쿼리 캐스팅 영향이 diff 자체로는 실측되지 않은 점을 낮은 리스크로 기록해 둔다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
