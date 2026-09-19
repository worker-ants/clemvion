# Plan 정합성 검토 — spec/3-workflow-editor/ (--impl-prep)

대상 작업: `plan/in-progress/entity-schema-declaration-drift.md` (엔티티 인덱스·제약 데코레이터 8곳 정정,
`spec_impact: none`). Target 번들: `spec/3-workflow-editor/{4-ai-assistant,0-canvas,2-edge,3-execution,
_product-overview,1-node-common,5-version-history}.md` + `plan/in-progress/**` 다수(대부분 예산 초과로 절단).

## 발견사항

- **[WARNING] `--impl-prep` 스코프가 변경 파일 전체의 spec 소유 영역을 덮지 못한다**
  - target 위치: `plan/in-progress/entity-schema-declaration-drift.md` 체크리스트 `- [ ] --impl-prep spec/3-workflow-editor/`
  - 관련 plan: `spec/2-navigation/9-user-profile.md` (`code: codebase/backend/src/modules/workspaces/**`,
    `pending_plans: plan/in-progress/spec-sync-user-profile-gaps.md`) · `spec/2-navigation/4-integration.md`
    (`code: codebase/backend/src/modules/integrations/**`)
  - 상세: 이 plan 이 고치는 8곳 중 발견 #4(`workspaces/entities/workspace.entity.ts` — `@Index(['ownerId','type'])`
    → `uq_workspace_personal_owner` 로 교체)와 #5(`integrations/entities/integration-expiry-dispatch.entity.ts` —
    `@Unique` 이름 제거)는 `spec/3-workflow-editor/` 가 아니라 각각 `spec/2-navigation/9-user-profile.md`,
    `spec/2-navigation/4-integration.md` 의 `code:` glob 이 소유한다. 이번 `--impl-prep` 호출은 `spec/3-workflow-editor/`
    로만 스코프됐으므로 이 두 파일에 대한 정합성은 이번 라운드에서 검사되지 않았다. `9-user-profile.md` 는 `pending_plans`
    로 `spec-sync-user-profile-gaps.md` 를 명시적으로 걸어 두고 있어 — 그 트래커에 workspace 소유권/personal 타입 관련
    미해결 결정이 있다면 이번 체크가 놓친다(직접 확인한 결과 해당 트래커·`cafe24-backlog-residual.md` 등 integration 계열
    plan 에서 `ownerId`/`owner_id`/`workspace.entity`/`integration_expiry_dispatch` 관련 언급은 0건이었다 — 즉 **현재는
    실제 충돌이 확인되지 않았지만**, 이는 이번 검토가 아니라 별도 grep 으로 확인한 것이다). `node-executions/entities/
    node-execution.entity.ts`(발견 #2)는 어떤 spec 의 `code:` 에도 걸려 있지 않아(전수 grep 0건) 애초에 소유 spec 문서가
    없다 — 이는 이 PR 이 만든 갭이 아니라 기존 상태다.
  - 제안: plan 체크리스트의 `--impl-prep`/`--impl-done` 항목을 `spec/3-workflow-editor/` 단독이 아니라
    `spec/2-navigation/`(최소 `9-user-profile.md`+`4-integration.md`) 를 포함하도록 넓히거나, 별도 라운드로
    한 번 더 돌려 두 파일의 `code:` 소유 영역에 대한 정합성을 확정할 것. `--impl-done` 은 diff-scope 라 최종적으로는
    잡힐 가능성이 높지만, 결정 충돌이 있다면 구현 이후(late-stage)에 드러나 왕복 라운드가 늘어난다(선례:
    `feedback_impl_done_block_yes_planner_turn`).

## 검토 상세 (충돌 없음 확인)

- `spec/1-data-model.md` §3 은 이미 `AssistantSession` 인덱스를 `(workflow_id, user_id, status,
  last_interaction_at DESC)` 로 정확히 기술하고 있다(발견 #1) — 엔티티 데코레이터만 어긋났었고 spec 은 처음부터
  맞았다. `spec_impact: none` 과 정합.
- `spec/1-data-model.md:231` "자기 자신으로의 연결 불가 (`source_node_id != target_node_id`)"(발견 #6),
  `:176` "container_id 와 tool_owner_id 는 동시에 값을 가질 수 없음"(발견 #7) 은 이미 올바른 SQL 표현을 서술하고
  있다 — 데코레이터의 인용부호 버그만 고치는 것이라 spec 변경 불필요.
  `spec/3-workflow-editor/0-canvas.md` 의 `pending_plans: ai-agent-tool-connection-rewrite.md`(unstarted, AI
  Agent Tool Area 재설계)와 `spec/3-workflow-editor/2-edge.md` 의 동일 `pending_plans` 는 노드/엣지 인덱스·제약과
  무관한 주제(도구 연결 UX 재설계)라 충돌 없음.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (원 트래커) 의 발견 #1 관련 항목(줄 4649~4652)은
  "고치면 `spec/3-workflow-editor/4-ai-assistant.md` 의 `code:` 에 걸려 `--impl-done` 범위가 는다 — 그 영역을
  건드리는 다음 PR 이 함께 고친다" 고 **이 plan 이 정확히 지금 하는 일을 미리 예고**해 두었다 — 정합.
  같은 트래커의 인접 열린 항목("캔버스 저장이 노드를 빼면 실행 이력이 사라짐 — 보존 정책 결정 필요",
  "`0-canvas.md` §8.1 changeSummary 자동 생성 서술", "AI 어시스턴트 사전 키 셋 누락")은 모두 이 plan 이 건드리는
  인덱스/제약 데코레이터와 다른 층(캐스케이드 정책·i18n·UX 서술)이라 일방적 결정 우회나 후속 항목 무효화가 없다.
- `node-output-redesign/**`(node.entity.ts·edge.entity.ts 필드 값과 무관, 노드별 출력 포맷 재설계)와
  `ai-agent-tool-connection-rewrite.md`(unstarted) 는 이 plan 의 변경(인덱스·제약 데코레이터, 컬럼/필드 형태
  불변)과 겹치는 결정이 없다.
- `backend-lint-gate-broken-on-main.md` 의 원 이슈(lint 게이트 붕괴)는 `#1104` 로 이미 해소·머지됐다 — 현재
  누적된 후속 섹션들은 이 plan 의 TEST WORKFLOW 단계를 막는 선행 조건이 아니다.

## 요약

이 plan 은 `synchronize: false` 하에서 엔티티 데코레이터가 실제 DB 와 다르게 선언된 8곳을 정정하는 순수 선언
정합화 작업이며, 대조한 spec 문서(`1-data-model.md`, `3-workflow-editor/*`)는 이미 올바른 DB 상태를 서술하고
있어 spec 과 충돌하는 결정도, 우회하는 미해결 결정도 확인되지 않았다. 유일한 실질적 지적은 이 변경이 건드리는
6개 파일의 spec 소유권이 `spec/3-workflow-editor/` 외에 `spec/2-navigation/9-user-profile.md`·
`4-integration.md` 로도 걸쳐 있는데, 이번 `--impl-prep` 호출이 후자 둘을 스코프에 넣지 않았다는 점이다 — 별도
grep 으로 확인한 바 그 문서들의 대기 중 plan 에서 실제 충돌은 발견되지 않았으나, 이는 이번 검토 프로세스가
보장한 것이 아니라 보완 확인일 뿐이므로 plan 체크리스트에 스코프 확장을 반영할 것을 권한다.

## 위험도
LOW
