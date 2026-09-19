# 요구사항(Requirement) 리뷰 — 엔티티 컬럼 선언 아홉 곳 정정 + 컬럼 층 가드

## 검증 방법

각 엔티티 수정 건을 실제 Flyway 마이그레이션(V001·V003·V008·V014·V016·V017·V019·V088)과 직접 대조했고,
새 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)의 판별 로직을 TypeORM 0.3.31 소스
(`RdbmsSchemaBuilder.log()`, `PostgresQueryRunner.buildCreateColumnSql`)까지 열어 정규식 매칭이
실제로 나오는 DDL 문 모양과 맞는지 확인했다. `default: 'chat'` / `default: () => 'now()'` 추가가
런타임에 영향을 주는지도 호출부(`model-config.service.ts` create 경로, `workflow-assistant-session.service.ts`)를
읽어 두 필드 모두 앱이 항상 명시적으로 값을 채우는 경로임을 확인했다. 저장소 파일은 전혀 쓰지 않았다
(`git status --short` 결과 내가 만든 변경 없음 — 워크트리에 보이는 `plan/in-progress/entity-column-declaration-drift.md`
수정은 병행 developer 세션이 TEST WORKFLOW 체크박스를 갱신한 것이지 내 작업이 아니다).

## 발견사항

- **[INFO]** 컬럼 층 수정 아홉 건 전부가 실제 DB 정의와 정확히 일치한다.
  - 위치: `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts:19`,
    `codebase/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts:18`,
    `codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts:30,33`,
    `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts:20`,
    `codebase/backend/src/modules/nodes/entities/node.entity.ts:48`,
    `codebase/backend/src/modules/edges/entities/edge.entity.ts:53-58`,
    `codebase/backend/src/modules/model-config/entities/model-config.entity.ts:46`,
    `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:75-79`
  - 상세: 5곳의 `type: 'uuid'` 는 마이그레이션에서 전부 `UUID NOT NULL`(V016 `alert_rule.workspace_id`, V017
    `workspace_invitation.workspace_id`, V008 `integration_usage_log.node_execution_id`/`workflow_id`, V014
    `llm_usage_log.workspace_id`)로 확인했다. `enumName: 'node_category'`/`'edge_type'` 은 V001 이 `CREATE TYPE node_category`·
    `CREATE TYPE edge_type` 로 만든 실제 이름과 일치한다(엔티티가 이 옵션 없이 두면 TypeORM 은 `${table}_${column}_enum` 로 추론해
    실제와 다른 타입 이름을 짓는다 — 이번 수정이 그 추론을 실제 이름으로 덮어쓴다). `model_config.kind default: 'chat'` 은 V088 `ADD COLUMN
    kind VARCHAR(20) NOT NULL DEFAULT 'chat'` 과, `workflow_assistant_session.last_interaction_at default: () => 'now()'` 는 V019
    `TIMESTAMPTZ NOT NULL DEFAULT NOW()` 와 각각 일치한다.
  - 판단: spec 본문(`spec/1-data-model.md` §2.6/§2.7/§2.16, §3)은 이 필드들을 이미 `UUID`/`Enum`으로 서술해 왔고 이번 diff 가
    새로 어긋나게 만든 지점은 없다 — 이번 변경은 "엔티티 데코레이터가 spec·DB 가 이미 합의한 사실을 뒤늦게 반영"한 것으로, spec 과
    코드 사이의 새로운 line-level 불일치는 없다(회색지대/INFO).

- **[INFO]** `default` 두 건(`model_config.kind`, `workflow_assistant_session.lastInteractionAt`)의 "런타임 영향 없음" 주장을 호출부에서 확인.
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` (create 시 `kind` 를 항상 명시적으로 채움),
    `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts:94` (`lastInteractionAt: now` 로 항상 명시적으로 채움)
  - 상세: plan 문서(`plan/in-progress/entity-column-declaration-drift.md` "런타임 영향" 절)의 "`default` 는 insert 후 RETURNING 으로만
    영향, 값은 DB 기본값과 같아 의미는 같다"는 주장을 검증했다 — 두 필드 모두 앱 코드가 생성 시 항상 값을 명시적으로 설정하므로 이 default 선언은
    실질적으로 죽은 경로(dead path)이며 기존 동작을 바꾸지 않는다. 병행 developer 세션이 방금 체크한 TEST WORKFLOW 항목(`3c2b39305` 기준
    e2e backend 354 PASS)도 이를 뒷받침한다.

- **[INFO]** 신설 가드 테스트(`entity-schema-declarations.e2e-spec.ts` "컬럼 — TypeORM 스키마 비교기…")의 정규식 판별력을 TypeORM 소스로 대조.
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:60-66` (`COLUMN_LEVEL` 패턴), `:474-486` (신규 `it`)
  - 상세: `PostgresQueryRunner.buildCreateColumnSql` 이 항상 `"컬럼명" ...` 으로 시작하고, FK/PK/유니크 제약 추가는 `ADD CONSTRAINT`
    로 시작해 `^ALTER TABLE "[^"]+" ADD "` 패턴과 겹치지 않음을 확인했다 — "인덱스·제약 문은 무시하고 컬럼 정의 문만 잡는다"는 주석의
    의도와 정규식 동작이 정확히 일치한다. `RdbmsSchemaBuilder.log()` 는 `enableSqlMemory()` 를 호출한 뒤 동기화 연산을 수행하므로 실제
    DDL 을 실행하지 않는다는 헤더 주석 주장도 소스로 확인했다(부수효과 없음 — 병렬 e2e 실행 안전).
  - 판단: plan 문서의 뮤턴트 표(C1~C9 전부 RED, A1/A2 RED, R1/R2 로 패턴 하중을 가른 것)와 정적 분석 결과가 서로를 뒷받침해, 이 가드가
    "선언 생략(예외 목록에 있는 것만 허용) vs 거짓 선언(그 외 전부 결함)" 이라는 의도된 기능을 실제로 구현했다고 판단한다.

- **[INFO]** 남은 plan 체크리스트 3개(`/ai-review`, `--impl-done`, 트래커 반영·`complete/` 이동)는 미완료 상태다.
  - 위치: `plan/in-progress/entity-column-declaration-drift.md` "체크리스트" 절
  - 상세: 이 리뷰 자체가 `/ai-review` 단계이므로 정상적인 워크플로 중간 상태다. 결함이 아니라 다음 단계 안내로만 기록한다.

## 요약

리뷰 대상 diff(엔티티 8개 컬럼 데코레이터 정정 + e2e 컬럼 층 가드 신설 + 관련 plan 문서)는 "선언과 실제 DB 가 다른 아홉 곳"이라는
의도한 기능을 완전하게 구현한다. 아홉 건 모두 실제 Flyway 마이그레이션과 line-level 로 대조했고 전부 일치했으며, `default` 추가가
런타임 동작을 바꾸지 않는다는 plan 의 주장도 호출부 검증으로 뒷받침된다. 신설 가드의 정규식은 TypeORM 소스 레벨에서 의도(컬럼 정의만
잡고 인덱스·제약·코멘트는 제외)대로 동작하며, plan 에 기록된 사전 뮤턴트 테스트 결과와도 상충하지 않는다. `spec/1-data-model.md` 는 이미
해당 필드들을 UUID/Enum 으로 서술하고 있어 이번 변경으로 새로 발생한 spec-코드 불일치는 없다(spec_impact: none 판단이 타당). TODO/FIXME/HACK
주석, 미완성 에러 처리, 반환값 누락 등 통상적 결함 패턴은 diff 어디에도 없다. 발견된 사항은 전부 INFO 수준의 확인·정합성 기록이며 CRITICAL/WARNING 은 없다.

## 위험도

NONE
