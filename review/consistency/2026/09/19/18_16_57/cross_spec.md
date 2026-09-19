# Cross-Spec 일관성 검토 — entity-column-drift (impl-done, scope=spec/3-workflow-editor/)

## 검토 대상 재확정

`spec/3-workflow-editor/` 델타는 0(정상 — 코드 전용 PR). 실제 구현 diff(9파일/320줄, `origin/main...HEAD`)는:

- 엔티티 8파일 9곳 — `alert-rule`·`workspace-invitation`·`llm-usage-log`·`integration-usage-log`(2곳)의 `@Column`에 `type: 'uuid'` 추가, `node.category`/`edge.type` enum 에 `enumName`(`node_category`/`edge_type`) 추가, `model-config.kind` 에 `default: 'chat'` 추가, `workflow-assistant-session.last_interaction_at` 에 `default: () => 'now()'` 추가.
- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — TypeORM 스키마 비교기(`log()`)로 컬럼 층 drift 를 잡는 가드 확장(읽기 전용 세션 + 카탈로그 스냅샷 이중 방어, 패턴 판별력 대조군 테스트 포함).

`spec/1-data-model.md`(scope 밖 루트 파일, 이 작업이 실제로 대조되는 spec)와 대조한 결과는 아래와 같다.

## 발견사항

없음 — CRITICAL/WARNING 급 충돌을 찾지 못했다.

### 대조 상세 (근거로 남김)

- `AlertRule.workspace_id`, `WorkspaceInvitation.workspace_id`, `LlmUsageLog.workspace_id`, `IntegrationUsageLog.node_execution_id`/`workflow_id` — `spec/1-data-model.md` §2.24·§2.25·§2.10.1 모두 이 필드들을 `UUID` 타입으로 명시한다. 추가된 `type: 'uuid'` 는 이미 존재하던 DB 실제 타입(플랜 실측)과 spec 서술 양쪽에 코드를 맞추는 정정이지, 새 정의를 도입하지 않는다. 충돌 없음.
- `Node.category`(7값: trigger/logic/flow/ai/integration/data/presentation) — `spec/1-data-model.md` §2.6 값 목록과 diff 후 enum 값 자체는 불변(변경분은 Postgres enum **타입 이름**만 `node_category` 로 고정). spec 은 Postgres 타입 이름을 서술하지 않으므로 이 계층에서 다툴 대상이 없다. `spec/3-workflow-editor/0-canvas.md`·`4-nodes/0-overview.md` 등 category 값을 참조하는 문서들도 값역 서술이라 영향 없음.
- `Edge.type`(data/error, 기본 data) — §2.7 서술과 일치. `enumName: 'edge_type'` 추가도 동일하게 타입 이름만의 정정.
- `ModelConfig.kind` 의 `default: 'chat'` — §2.16 표는 `kind` 를 Enum 으로만 서술하고 기본값을 명시하지 않는다(누락이지 모순은 아니다). 새 기본값이 §2.16 본문·Rationale 이 서술하는 "chat 이 원래 유일 kind 였다"는 마이그레이션 서사와도 상충하지 않는다.
- `WorkflowAssistantSession.last_interaction_at` 의 `default: () => 'now()'` — §2.20 표는 이 필드를 "마지막 메시지/도구 호출 시각"으로만 서술한다. `spec/data-flow/11-workflow.md` 의 세션 생성 시퀀스(L100)는 INSERT 시 `last_interaction_at` 을 애플리케이션이 명시적으로 채우는 것으로 그려, DB 기본값은 그 값이 누락된 경우의 폴백일 뿐 — 두 서술이 서로 배타적이지 않다. `spec/3-workflow-editor/4-ai-assistant.md` 에도 이 컬럼의 기본값에 관한 별도 서술이 없어 상충 지점이 없다.
- 위 아홉 곳 모두 `plan/in-progress/entity-column-declaration-drift.md` 의 실측 표(선언 vs 실제 DB)와 1:1 대응하며, "선언이 실제 DB 를 뒤늦게 반영"하는 방향의 정정이다 — 새 요구사항·API 계약·상태 전이·RBAC·계층 책임 변경이 아니므로 본 검토의 6개 관점(데이터 모델/API/요구사항 ID/상태 전이/RBAC/계층 책임) 중 어느 것도 새로 건드리지 않는다.
- e2e 가드(`entity-schema-declarations.e2e-spec.ts`)는 테스트 코드일 뿐 API/데이터 계약을 변경하지 않는다. 읽기 전용 세션·카탈로그 스냅샷 방어는 구현 세부사항이며 spec 서술 대상이 아니다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 diff 로 추가된 새 항목(`spec/0-overview.md` Rationale 이 ORM 을 Prisma 로 잘못 적음)은 planner 몫 후속 작업으로 이미 tracker 에 등재되어 있고, 본 diff 의 코드 변경과는 별개 사안이다(cross-spec CRITICAL 대상 아님, 기존 문서 부정확성의 사실 정정 대기 항목).

## 요약

이번 PR 은 8개 엔티티 파일의 컬럼 선언(uuid 타입·enum 타입 이름·기본값)을 실제 DB 스키마와 `spec/1-data-model.md` 서술에 맞춰 사후 정정하고, 그 drift 를 재발 방지하는 e2e 가드를 컬럼 층까지 확장한 것이다. 아홉 곳 모두 spec 이 이미 서술한 값(UUID 타입·enum 값역)과 일치시키는 방향이며 새로운 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임을 도입하지 않는다. `spec/3-workflow-editor/` 범위와는 Node/Edge 엔티티를 통해서만 접점이 있고 그 접점에서도 값역·의미 변경이 없어 충돌이 없다. Cross-spec 관점에서 이 diff 는 안전하다.

## 위험도

NONE
