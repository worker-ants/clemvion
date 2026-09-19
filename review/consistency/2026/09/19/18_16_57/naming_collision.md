# 신규 식별자 충돌 검토 — naming_collision

## 사전 확인 (스코프·번들 불일치)

- 지정 스코프 `spec/3-workflow-editor/` 의 `origin/main` 대비 델타는 **0개 파일**이다 (프롬프트 자체 명시). 실제 코드 diff(`git diff origin/main..HEAD`, 9개 backend entity/test 파일 + `plan/in-progress/entity-column-declaration-drift.md`)는 프롬프트에 번들된 `spec/3-workflow-editor/*.md`(canvas·edge·execution 등) 본문과 직접 대응하지 않는다 — 프롬프트에 `## 구현 변경 사항` diff 섹션 자체가 존재하지 않아(예산 절단), 워킹트리를 절대경로로 직접 확인했다.
- 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/entity-column-drift-b83f15`)에서 `git diff origin/main..HEAD`로 실측한 변경 파일:
  - `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts`
  - `codebase/backend/src/modules/edges/entities/edge.entity.ts`
  - `codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts`
  - `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts`
  - `codebase/backend/src/modules/model-config/entities/model-config.entity.ts`
  - `codebase/backend/src/modules/nodes/entities/node.entity.ts`
  - `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts`
  - `codebase/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts`
  - `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (가드 확장)
  - `plan/in-progress/entity-column-declaration-drift.md` (신규 plan, `spec_impact: none` 명시)

이 변경은 각 파일 diff 를 직접 읽어 확인한 결과, 전부 **기존 컬럼 데코레이터의 옵션 보정**이다 — 예: `@Column({ name: 'workspace_id' })` → `@Column({ name: 'workspace_id', type: 'uuid' })`, `@Column({ type: 'enum', enum: EdgeType, default: EdgeType.DATA })` → 동일 + `enumName: 'edge_type'`, `@Column({ length: 20 })` → `+ default: 'chat'`, `last_interaction_at` 에 `default: () => 'now()'` 추가. **새 컬럼·새 엔티티·새 DTO·새 endpoint·새 이벤트·새 ENV var·새 spec 파일 경로 중 어느 것도 도입되지 않았다.** `enumName: 'node_category'`/`enumName: 'edge_type'` 도 신규 명명이 아니라 plan 문서(`entity-column-declaration-drift.md`)가 실측한 **기존 DB 카탈로그의 실제 타입 이름**을 코드 쪽에 뒤늦게 반영한 것이다.

## 발견사항

없음. 6개 점검 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·ENV/설정키·파일 경로) 모두 이 diff 범위 내에서 **신규 식별자 자체가 존재하지 않아** 충돌 여지가 없다.

## 요약

이번 변경은 아홉 개 TypeORM 엔티티 컬럼 선언을 실제 DB 스키마(uuid 타입·enum 타입 이름·기본값)에 맞춰 정정하고 스키마 비교 가드를 컬럼 층까지 확장한 것으로, `spec/3-workflow-editor/` 의 신규 식별자 도입과는 무관하며(스코프 델타 0, 사실상 무관한 backend 영역) diff 자체도 새 이름을 만들지 않고 기존 DB 실재에 이름을 맞추는 정정이다. 따라서 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
