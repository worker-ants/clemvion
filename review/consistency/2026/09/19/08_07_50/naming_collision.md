# 신규 식별자 충돌 검토

## 검토 범위에 대한 선행 관찰

이번 `--impl-prep` 호출의 target 은 `spec/3-workflow-editor/`(캔버스·엣지·실행/디버깅·팔레트 등)이지만,
실제 작업 중인 plan 은 `plan/in-progress/entity-schema-declaration-drift.md`(TypeORM 엔티티 데코레이터의
인덱스·제약 선언을 실제 DB(Flyway V001~V132)와 맞추는 backend-only 정정)이다. 이 plan 은
`codebase/backend/src/modules/**/entities/*.entity.ts` 6개 파일과 신규 e2e 가드
(`codebase/backend/test/entity-schema-declarations.e2e-spec.ts`) 만 건드리며, `spec/3-workflow-editor/`
와는 도메인이 겹치지 않는다(체크리스트의 `- [ ] --impl-prep spec/3-workflow-editor/` 항목 자체가 다른 plan
템플릿에서 복사된 것으로 보인다). 따라서 본 checker 가 실제로 대조해야 할 "신규 식별자"는 사실상
`spec/3-workflow-editor/` 번들(이미 병합·구현된 안정 상태의 스펙) 안에는 존재하지 않는다 — 아래는 그럼에도
번들에 등장하는 요구사항 ID·엔티티·API·에러코드·이벤트명 후보를 전수 grep 하여 충돌 여부를 실측한 결과다.

## 실측한 후보와 결과 (충돌 없음)

- **요구사항 ID** `ED-PL-03`/`ED-PL-04`/`ED-SP-05`/`ND-BG-05` — `spec/3-workflow-editor/_product-overview.md`·
  `spec/4-nodes/_product-overview.md` 의 기존 PRD 표 항목과 1:1 대응. 다른 의미로 재사용된 곳 없음.
- **엔티티** `WorkflowTestDataset`(V097) — `spec/1-data-model.md §2.13.3`·
  `codebase/backend/src/modules/workflow-test-datasets/**` 와 일치. 신규 도입이 아니라 이미 구현된 엔티티.
- **에러 코드** `DUPLICATE_NAME` — `workflow-test-datasets.service.ts`/`.controller.ts`/e2e 스펙과 정확히 일치,
  다른 도메인에서 같은 이름을 다른 의미로 쓰는 곳 없음.
- **에러 코드** `INVALID_STATE` — `spec/5-system/2-api-convention.md`(422 기본값)·`3-error-handling.md`·
  `4-execution-engine.md`·`http-exception.filter.ts` 전체에서 "REST core 422" 라는 동일 의미로만 쓰이고,
  WS 쪽 `INVALID_EXECUTION_STATE`·EIA 쪽 `STATE_MISMATCH` 와의 의도적 분리도 문서화돼 있어 충돌 없음.
- **에러 코드** `CONTAINER_INVALID_CHILD`/`CONTAINER_CYCLE`/`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` —
  `editor-store.ts`·`execution-engine.service.ts`·`shadow-workflow.ts` 등 코드와 관련 spec 전체가 동일 의미로만
  참조.
- **인덱스/제약 이름**(entity-schema-declaration-drift 대상) `idx_workflow_assistant_session_wf_user_active`
  (V019) · `idx_node_execution_exec_status_active`(V095) · `uq_workspace_personal_owner`(V109) ·
  `chk_no_self_loop`/`chk_node_placement`(V001) — 각각 정확히 1개 마이그레이션 파일에서만 정의되는 실제 DB
  객체명이며, plan 은 이 기존 이름을 엔티티 데코레이터 문자열로 옮겨 적는 것뿐이라 신규 식별자가 아님. 다른
  엔티티가 같은 이름을 다른 대상에 붙이는 사례 없음.
- **심볼** `ROOT_ENTITIES`(신규 e2e 가드가 재사용) — `app.module.ts`·`root-entities.ts`·기존 e2e 스펙 2건과
  동일 목적으로만 쓰여 충돌 없음.
- **파일 경로** `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — 저장소에 동명 파일 없음
  (`find` 0건), 기존 `*.e2e-spec.ts` 명명 컨벤션과도 일치.

## 발견사항

없음 (CRITICAL/WARNING 대상 없음).

- **[INFO]** impl-prep 스코프와 실제 작업 도메인 불일치
  - target 신규 식별자: 해당 없음 (신규 식별자 충돌 자체가 아님)
  - 기존 사용처: `plan/in-progress/entity-schema-declaration-drift.md` 체크리스트의
    `- [ ] --impl-prep spec/3-workflow-editor/` 항목
  - 상세: 이 plan 의 실제 diff 범위는 backend 엔티티 데코레이터 6개 파일 + 신규 e2e 가드이며 `spec/3-workflow-editor/`
    와 무관하다. 이번 naming-collision 검토가 이 scope 로 호출된 탓에 실질적으로 대조할 "신규 식별자"가 없었다
    (위 항목들은 전부 이미 구현·병합된 기존 식별자였다). 다른 plan 템플릿에서 복사되며 scope 문자열이 갱신되지
    않은 것으로 보인다.
  - 제안: 체크리스트 항목을 실제 대상(예: 해당 없음이면 항목 삭제, 또는 backend entity 변경에 맞는 스코프)으로
    정정하면 이후 impl-prep 게이트가 실제로 관련 있는 코퍼스를 검토하게 된다. 신규 식별자 충돌 관점에서는 이
    plan 자체에 조치가 필요한 사안은 아니다.

## 요약

target 으로 지정된 `spec/3-workflow-editor/` 번들에 등장하는 요구사항 ID·엔티티명·API 엔드포인트·에러 코드·
이벤트명·인덱스/제약 이름을 전수 grep 대조한 결과 다른 의미로 이미 쓰이고 있는 충돌은 발견되지 않았다 — 해당
번들은 신규 초안이 아니라 이미 구현·병합된 안정 상태의 스펙이었고, 실제 진행 중인 작업(엔티티 스키마 선언
정정)은 이 스펙 영역과 도메인이 겹치지 않아 신규 식별자 자체가 발생하지 않았다. impl-prep 호출의 scope 파라미터가
실제 작업 대상과 어긋나 보인다는 점만 INFO 로 남긴다.

## 위험도

NONE
