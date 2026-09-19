# 신규 식별자 충돌 검토 — entity-schema-declaration-drift (--impl-prep, scope=spec/3-workflow-editor/)

## 점검 대상 재정의

target 문서 번들의 표면상 스코프는 `spec/3-workflow-editor/`(4-ai-assistant.md·0-canvas.md·2-edge.md 등)이지만,
prompt 말미의 "(main 추가)" 지시에 따라 실제 판정 대상은 `plan/in-progress/entity-schema-declaration-drift.md`
(엔티티 데코레이터 8곳 정정 + `entity-schema-declarations.e2e-spec.ts` 신설, `spec_impact: none`)다. 이 문서가
새로 도입하는 식별자는 다음 두 종류뿐이다.

1. 신규 e2e 파일 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts`
2. 엔티티 데코레이터에 새로 적어 넣는(또는 교체하는) 인덱스·제약 이름 6개: `idx_workflow_assistant_session_wf_user_active`,
   `idx_workflow_assistant_session_user_recent`, `idx_node_execution_exec_status_active`,
   `uq_workspace_personal_owner`, `chk_no_self_loop`, `chk_node_placement`. 그리고 제거되는 이름 2개:
   `IDX_node_workflow_label`, `integration_expiry_dispatch_key`.

## 발견사항

- **[INFO]** e2e 파일명은 신규이며 충돌 없음, 단 인접 파일과 검증 방향이 다름
  - target 신규 식별자: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts`
  - 기존 사용처: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (같은 디렉터리, 유사한 "인덱스 검증 e2e" 성격)
  - 상세: `find`/`ls codebase/backend/test`로 전수 확인한 결과 `entity-schema*`/`schema-declaration*` 패턴의 기존 파일은 없어 파일 경로 충돌은 없다. 다만 `deletion-cascade-indexes.e2e-spec.ts`는 **DB 카탈로그에서 직접** 인덱스 존재·정의를 검증하고(FK 인덱스 32개), 신규 파일은 **엔티티 메타데이터 ↔ DB 카탈로그를 대조**하는 반대 방향 검증이다. 이름 자체는 겹치지 않으나 두 파일 모두 "인덱스가 실제로 있는가"를 Postgres 카탈로그(`pg_index`/`pg_constraint`)로 확인하는 유사 성격이라, 파일명만으로는 역할 차이가 드러나지 않는다.
  - 제안: 블로킹 아님. 신규 파일 최상단 JSDoc(plan 이미 명시한 "엔티티 메타데이터 vs DB 카탈로그" 설명)을 그대로 유지하면 충분 — 이미 plan 본문에 그 취지가 적혀 있어 실제 구현 시 반영될 것으로 보인다.

- **[INFO]** 신규/교체 인덱스·제약 이름은 모두 기존 Flyway 마이그레이션의 실재 이름과 완전히 일치 — 충돌 없음
  - target 신규 식별자: `idx_workflow_assistant_session_wf_user_active`, `idx_workflow_assistant_session_user_recent`, `idx_node_execution_exec_status_active`, `uq_workspace_personal_owner`, `chk_no_self_loop`, `chk_node_placement`
  - 기존 사용처: `codebase/backend/migrations/V019__workflow_assistant.sql:32,35`, `V095__node_execution_exec_status_active_index.sql:20`, `V109__workspace_personal_owner_unique.sql:14`, `V001__initial_schema.sql:114,135`; 그리고 `spec/data-flow/12-workspace.md:199,455`, `spec/data-flow/11-workflow.md:78,84,154,158,242`
  - 상세: 6개 이름 전부 grep 결과 정확히 하나의 마이그레이션 파일에서만 `CREATE INDEX`/`CONSTRAINT`로 정의되어 있고, spec의 `data-flow` 문서들이 이미 그 이름을 그대로 인용하고 있다. 즉 이 plan은 **새 이름을 발명하는 것이 아니라, 코드 데코레이터가 이미 DB·spec에 존재하는 이름을 뒤늦게 정확히 반영**하는 작업이다. 다른 의미로 이미 쓰이고 있는 동일 이름은 없다.
  - 제안: 없음 (문제 없음, 그대로 진행 가능).

- **[INFO]** 제거 대상 이름(`IDX_node_workflow_label`, `integration_expiry_dispatch_key`)은 다른 참조처 없음 — 제거해도 dangling reference 없음
  - target: `nodes/entities/node.entity.ts`의 `@Index('IDX_node_workflow_label', ...)` 제거, `integrations/entities/integration-expiry-dispatch.entity.ts`의 `@Unique('integration_expiry_dispatch_key', ...)` 이름 제거
  - 기존 사용처: grep 전체 검색(`codebase`, `spec`, `plan`) 결과 두 이름 모두 선언 지점(엔티티 파일 자신)과 이번 plan 문서 외에는 등장하지 않음. `ON CONFLICT ON CONSTRAINT` 등으로 이름을 참조하는 코드도 없음(plan이 이미 "이 이름을 참조하는 코드는 없다"고 확인).
  - 제안: 없음.

- **[INFO]** `node.entity.ts`를 동시에 건드리는 다른 in-progress plan 존재 — 식별자 축은 겹치지 않음
  - target: 이번 plan이 `nodes/entities/node.entity.ts`에서 `@Index('IDX_node_workflow_label', ...)` 제거·`@Check` 정정
  - 기존 사용처: `plan/in-progress/marketplace-and-plugin-sdk.md:90` — 동일 파일의 `NodeCategory` enum에 `custom` 값을 추가하는 후속 작업을 언급
  - 상세: 같은 파일을 다루지만 축이 다르다(하나는 인덱스/CHECK 데코레이터, 다른 하나는 enum 값 추가 — 아직 착수 전 backlog 항목). 식별자 이름 충돌은 없고 병합 시 라인 인접 정도의 문제일 뿐.
  - 제안: 조치 불요, 참고만.

- **[INFO]** 직전 라운드(`08_07_50`) BLOCK:YES였던 §13 i18n 키 표는 이번 검토 대상에 재등장하지만 이미 해소된 상태로 확인됨
  - 상세: `4-ai-assistant.md` §13의 `assistant.turnStalledHint` 등 키를 `codebase/frontend/src/lib/i18n/dict/{ko,en}/assistant.ts`에서 grep한 결과 이미 존재 — 커밋 `ff530fc8a`(spec-draft-assistant-i18n-table-sync 완료)로 spec-구현 키 표가 일치한다. 이는 신규 식별자 충돌이 아니라 spec-drift 해소 확인이므로 이 checker의 본 관점(요구사항 ID/엔티티/endpoint/이벤트/env/파일경로 충돌)에는 해당 사항 없음 — CRITICAL/WARNING 없음.

## 요약

이번 라운드에서 실제로 새로 쓰기 시작하는 항목(`entity-schema-declaration-drift` plan)은 엔티티 데코레이터가 이미 실재하는 DB 인덱스·제약 이름(Flyway V001·V019·V095·V109)을 **뒤늦게 정확히 반영**하는 작업과, 그 대조를 고정하는 신규 e2e 파일 하나(`entity-schema-declarations.e2e-spec.ts`)로 구성된다. 전수 grep 결과 6개 인덱스/제약 이름 모두 기존 마이그레이션·spec 문서와 정확히 같은 의미로 이미 쓰이고 있어 "다른 의미의 재사용"에 해당하는 충돌이 없고, 제거 대상 2개 이름도 다른 참조처가 없어 안전하며, 신규 e2e 파일명도 기존 test 디렉터리와 겹치지 않는다. 표면 스코프인 `spec/3-workflow-editor/`(§13 i18n 키 등)는 이미 이전 라운드에서 해소된 상태로 재확인됐다. 신규 식별자 충돌 관점에서 이 변경은 안전하다.

## 위험도

NONE
