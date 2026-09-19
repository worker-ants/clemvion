# Cross-Spec 일관성 검토 — entity-index-drift-4c8e21 (impl-done, scope=spec/3-workflow-editor/)

## 검토 대상 요약

- scope 델타(spec/3-workflow-editor): `4-ai-assistant.md` §13 i18n 키 표 정정(커밋 `ff530fc8a`, 이미 `--spec` BLOCK:NO 승인됨).
- 구현 diff(588줄/7파일): `entity-schema-declaration-drift` — 6개 엔티티(`workflow-assistant-session` · `node-execution` · `node` · `edge` · `integration-expiry-dispatch` · `workspace`)의 `@Index`/`@Unique`/`@Check`/FK `onDelete` 선언을 실제 DB(Flyway 마이그레이션)에 맞춘 declaration-only 정정 + 회귀 e2e 가드(`entity-schema-declarations.e2e-spec.ts`). `synchronize: false` 라 런타임 동작은 불변.
- 여섯 엔티티 모두 `spec/1-data-model.md` `code:` 프론트매터에 걸리므로, scope 밖이지만 판정 대상에 명시된 `spec/1-data-model.md`(§2·§3) · `spec/data-flow/12-workspace.md` · `spec/data-flow/7-llm-usage.md` · `spec/5-system/5-expression-language.md §8.3.2` · `spec/2-navigation/9-user-profile.md` · `spec/2-navigation/4-integration.md` 를 직접 열어 대조했다.

## 발견사항

- **[WARNING]** `spec/2-navigation/4-integration.md` §11.2 의 `integration_expired` 중복 방지 키 서술이 실제 DB 제약과 다르다
  - target 위치: 이번 PR 은 이 파일을 수정하지 않았지만, 판정 대상으로 명시된 `codebase/backend/src/modules/integrations/entities/integration-expiry-dispatch.entity.ts`(이번 PR 이 `@Unique` 이름만 제거하고 컬럼은 그대로 둔 파일)의 실제 제약과 대조
  - 충돌 대상: `spec/2-navigation/4-integration.md` (약 1006행) — `"**중복 방지**: (integration_id, threshold_key)로 유니크 판정. 임계치별 최대 1회."`
  - 상세: 실제 DB 제약은 `UNIQUE (integration_id, threshold, token_expires_at)` (`V009__integration_oauth_and_expiry.sql:51`)이고, 이번 PR 이 정정한 엔티티도 `@Unique(['integrationId', 'threshold', 'tokenExpiresAt'])` 로 **3컬럼**이다(`threshold_key` 라는 컬럼은 엔티티·마이그레이션·서비스 코드 어디에도 없다 — `grep -rn "threshold_key\|thresholdKey" codebase/backend/src` 0건). 실제 dedup 호출(`integration-expiry-scanner.service.ts` `claimThreshold(integrationId, threshold, tokenExpiresAt)`)도 세 값을 모두 insert 해 `ON CONFLICT DO NOTHING` 으로 판정한다. 즉 같은 `threshold` 라도 `token_expires_at` 이 바뀌면(토큰이 갱신돼 새 만료 주기로 들어가면) 새 알림이 다시 발사될 수 있다 — spec 문구 "임계치별 최대 1회" 가 함의하는 "그 integration·threshold 조합은 영구히 1회" 와 실제 3-컬럼 제약의 의미가 다르다. 이번 PR 로 엔티티 선언이 DB 와 정확히 일치하게 되면서 이 스펙-엔티티 괴리가 이 회차에서 처음 표면화됐다(엔티티는 이전에도 3컬럼이었으나 이름만 있어 "제약 이름" 관점으로만 검토됐다 — plan 의 2차 `impl-prep` 은 "인덱스·제약 **이름**" 만 grep 했다).
  - 제안: `spec/2-navigation/4-integration.md` §11.2 문구를 `(integration_id, threshold, token_expires_at)` 3컬럼 기준으로 수정하거나, 의도가 "정말 영구 1회" 라면 그것은 현재 구현과 다른 얘기이므로 별도 결정이 필요하다. spec 수정은 `project-planner` 권한 — 새 CRITICAL 은 아니므로 이번 PR 을 막을 필요는 없고 트래커 등재로 충분.

- **[INFO]** (이미 추적됨) `spec/1-data-model.md` §2 Workspace `owner_id` 행이 `ON DELETE CASCADE` 를 적지 않는다
  - target 위치: `codebase/backend/src/modules/workspaces/entities/workspace.entity.ts` — 이번 PR 이 `@ManyToOne(() => User, { onDelete: 'CASCADE' })` 를 명시(V001 실제 동작에 맞춤, 동작 변화 없음)
  - 충돌 대상: `spec/1-data-model.md` §2.2 Workspace 표의 `owner_id | UUID | FK → User` 행(삭제 동작 미기재)
  - 상세: 재확인 결과 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:4680-4683` 에 planner 항목으로 등재돼 있고(2026-09-19, 낮음), 두 라운드의 `/ai-review` RESOLUTION.md 도 "spec §2 삭제 동작(트래커 등재) — 조치 불요" 로 동일 처분했다. 새로 발견된 항목이 아니다.
  - 제안: 추가 조치 불요 — 기존 트래커 항목이 이 PR 의 정정과 정확히 일치하는지만 재확인(일치함).

- **[INFO]** (이미 추적됨) `spec/3-workflow-editor/4-ai-assistant.md` §13 i18n 표에 실제 사전 키 3개(`continueAfterBudgetButton`/`continueAfterBudget`/`exampleArrange`)가 없다
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §13 (커밋 `ff530fc8a` 로 41→42행 동기화됨)
  - 충돌 대상: `codebase/frontend/src/lib/i18n/dict/{ko,en}/assistant.ts` — 실제 사전은 44개 키, spec 표는 42행
  - 상세: 직접 대조해 확인. 그러나 `ff530fc8a` 커밋 메시지 자체가 "트래커 등재 둘: … 사전 키 셋(«이어서 진행» 버튼 · 예시 프롬프트)의 기능 서술이 spec 에 없다" 로 명시했고, `plan/in-progress/spec-draft-nullable-notation-followups.md:4685-4688` 에 planner 항목으로 등재돼 있다. 새 발견 아님.
  - 제안: 추가 조치 불요.

- **[INFO]** `spec/1-data-model.md` §3 "인덱스 전략" 표에 `Workspace` 행이 없다
  - target 위치: `codebase/backend/src/modules/workspaces/entities/workspace.entity.ts` 의 `uq_workspace_personal_owner` (이번 PR 이 실제와 일치하도록 정정)
  - 충돌 대상: `spec/1-data-model.md` §3 인덱스 전략 표(898~976행) — `AssistantSession`·`NodeExecution`·`Node`·`Integration` 등은 행이 있으나 `Workspace` 단독 행은 없음(같은 파일 Rationale "personal 워크스페이스 유일성" 절과 `spec/data-flow/12-workspace.md` 446행 근처에는 정확히 기술돼 있음 — 인덱스 자체를 spec 이 모르는 게 아니라 §3 요약 표에만 누락)
  - 상세: 모순은 아니고 완결성 갭이다. 같은 값(컬럼·WHERE·이름 `uq_workspace_personal_owner`)이 Rationale·`data-flow/12-workspace.md` 양쪽에 정확히 일치해 실질 충돌 위험은 낮다.
  - 제안: §3 표에 `Workspace | (owner_id) UNIQUE WHERE type='personal' | ...` 행 추가를 고려(선택, planner). 이번 PR 의 정정이 옳다는 근거는 이미 다른 두 곳(Rationale·12-workspace.md)에 있으므로 급하지 않음.

## 정합성 확인 (충돌 없음 — 참고용)

아래는 이번 diff 가 직접 건드린 6개 선언과 관련 spec 문서를 항목별로 대조해 **일치**를 확인한 것으로, 새 결함이 아니다.

- `workflow-assistant-session.entity.ts` 두 인덱스(`idx_workflow_assistant_session_wf_user_active` `(workflowId, userId, status, lastInteractionAt)`, `idx_workflow_assistant_session_user_recent` `(workspaceId, userId, updatedAt)`) ↔ `spec/1-data-model.md` §3 `AssistantSession` 두 행과 **컬럼 순서까지 정확히 일치**(이 스펙 파일은 이번 PR 에서 변경되지 않았다 — 즉 스펙은 정정 전부터 옳았고 엔티티만 틀려 있었다).
- `node.entity.ts` `chk_node_placement` CHECK ↔ `spec/1-data-model.md` §2.6 "container_id와 tool_owner_id는 동시에 값을 가질 수 없음" 및 `spec/5-system/5-expression-language.md §8.3.2` 의 "노드 라벨 유니크는 앱 레이어 + `#N` 안전장치, DB unique 없음" — 일치. 제거된 `@Index('IDX_node_workflow_label', …)` 도 애초에 어느 spec 도 그 인덱스 이름/컬럼조합을 요구하지 않았다.
- `edge.entity.ts` `chk_no_self_loop` CHECK ↔ `spec/1-data-model.md` §2.7 "자기 자신으로의 연결 불가" — 일치.
- `workspace.entity.ts` `uq_workspace_personal_owner` ↔ `spec/data-flow/12-workspace.md` 446~468행 Rationale "personal 워크스페이스 유일성" — 컬럼·WHERE·이름 전부 일치.
- `node-execution.entity.ts` 부분 인덱스 `idx_node_execution_exec_status_active` ↔ `spec/1-data-model.md` §3 `NodeExecution (execution_id, status) WHERE status IN ('waiting_for_input','running')` — 일치.
- `integration-expiry-dispatch.entity.ts` 의 컬럼 구성(`integrationId, threshold, tokenExpiresAt`) 자체는 위 WARNING 을 제외하면 마이그레이션과 일치.
- RBAC·API 계약·상태 전이·계층 책임 축에서는 이번 diff(엔티티 데코레이터 + e2e 테스트, `synchronize:false`)가 런타임 동작·엔드포인트·권한 모델을 전혀 바꾸지 않아 해당 없음.

## 요약

이번 PR 은 6개 엔티티의 인덱스·유니크·CHECK·FK 선언을 실제 DB 에 맞추는 declaration-only 정정이며, 대조한 5개 spec 문서(`1-data-model.md` §2·§3, `data-flow/12-workspace.md`, `data-flow/7-llm-usage.md`, `5-system/5-expression-language.md §8.3.2`) 와는 전부 일치하거나(오히려 그동안 옳았던 spec 을 엔티티가 뒤늦게 따라잡는 방향) 이미 별도 트래커에 등재된 기존 갭뿐이다. 새로 표면화된 유일한 항목은 `spec/2-navigation/4-integration.md` 의 만료 알림 중복 방지 키 서술이 실제 3-컬럼 UNIQUE 제약과 다르다는 것으로, 이번 PR 이 만든 결함은 아니지만(제약 컬럼 자체는 이번 PR 이 바꾸지 않음) 판정 대상 spec 을 열어보는 과정에서 처음 드러났다. CRITICAL 급 모순은 없다.

## 위험도

LOW
