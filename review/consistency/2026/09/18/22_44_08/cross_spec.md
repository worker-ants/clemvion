# Cross-Spec 일관성 검토 — `spec/conventions/migrations.md` (--impl-prep, V121~V130 FK 인덱스 착수)

## 검토 범위

target = `spec/conventions/` (핵심은 `migrations.md`). 착수할 작업은 이 convention 이 규정하는 절차로
`spec/1-data-model.md` §3·§2.24·Rationale 과 6개 data-flow 문서(`11-workflow.md`·`7-llm-usage.md`·
`10-triggers.md`·`6-knowledge-base.md`·`12-workspace.md`·`2-auth.md`)가 이미 기술한 V121~V130 인덱스
10개를 실제 마이그레이션 파일로 구현하는 것이다. `spec/1-data-model.md`·data-flow 6개 파일·
`codebase/backend/migrations/`·`codebase/backend/migrations/README.md`·
`plan/in-progress/spec-draft-fk-remaining-dispositions.md` 를 직접 Read 하여 대조했다.

## 발견사항

교차 영역 모순을 찾지 못했다. 판정 대상으로 명시된 세 가지를 각각 확인했다.

### 1. 마이그레이션 형태 vs `migrations.md` §1·§2·§5 / README §4·§5

- **번호 연속성**: `codebase/backend/migrations/` 실물 최신 파일은 `V120__relation_tail_entity_id_index.sql`
  이고 `origin/main` (`6f97cb619`) 도 동일 — 이 worktree 의 base 와 일치한다. V121~V130 은 gap·중복 없이
  다음 정수를 이어간다 (`migrations.md` §2 단조 증가 규칙 충족).
- **CONCURRENTLY 패턴**: `migrations.md` §5 의 "인덱스를 만드는 마이그레이션은 별도 패턴" 각주와
  README §5 "신규 추가에도 0) 을 둡니다"(2026-09-18, V111 선례) 가 요구하는
  `DROP INDEX CONCURRENTLY IF EXISTS <새 이름>` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS <새 이름>`
  2-statement 형태를, plan 의 "구현" 절이 그대로 채택했다(V117~V120 선례 인용). `.conf
  executeInTransaction=false` 페어링도 명시돼 있다 — 어긋남 없음.
- **파일당 CREATE 하나**: plan 이 10개 인덱스마다 별도 V번호(V121~V130)로 쪼갠다고 명시 — README §5
  "한 statement 컨벤션"(`CREATE` 개수 = 1) 과 합치.

### 2. spec §3 / data-flow 행이 말하는 인덱스 정의·번호 vs plan

`spec/1-data-model.md` §3 "인덱스 전략" 표의 10개 신규 행(V121~V130)과 plan "처분" 표를 컬럼·조건·번호
단위로 대조했다 — 완전히 일치한다.

| V번호 | §3 정의 | plan 정의 | 일치 |
|---|---|---|---|
| V121 | Edge (target_node_id) | `idx_edge_target_node_id ON edge (target_node_id)` | O |
| V122 | LlmUsageLog (llm_config_id) WHERE llm_config_id IS NOT NULL | `idx_llm_usage_log_llm_config_id ON llm_usage_log (llm_config_id) WHERE llm_config_id IS NOT NULL` | O |
| V123 | Workflow (folder_id) WHERE folder_id IS NOT NULL | `idx_workflow_folder_id ON workflow (folder_id) WHERE folder_id IS NOT NULL` | O |
| V124 | Folder (parent_id) WHERE parent_id IS NOT NULL | `idx_folder_parent_id ON folder (parent_id) WHERE parent_id IS NOT NULL` | O |
| V125 | AssistantSession (llm_config_id) WHERE llm_config_id IS NOT NULL | `idx_workflow_assistant_session_llm_config_id ON workflow_assistant_session (llm_config_id) WHERE llm_config_id IS NOT NULL` | O |
| V126 | Trigger (auth_config_id) WHERE auth_config_id IS NOT NULL | `idx_trigger_auth_config_id ON trigger (auth_config_id) WHERE auth_config_id IS NOT NULL` | O |
| V127 | AuthConfig (workspace_id) | `idx_auth_config_workspace_id ON auth_config (workspace_id)` | O |
| V128 | KnowledgeBase (workspace_id) | `idx_knowledge_base_workspace_id ON knowledge_base (workspace_id)` | O |
| V129 | WorkspaceMember (user_id) | `idx_workspace_member_user_id ON workspace_member (user_id)` | O |
| V130 | ModelConfig (workspace_id, kind) | `idx_model_config_workspace_kind ON model_config (workspace_id, kind)` | O |

6개 data-flow sink 파일에서 각 행에 붙은 V번호·인덱스 정의도 §3 과 동일 문구로 미러돼 있다
(`11-workflow.md` edge/workflow/workflow_assistant_session 행, `7-llm-usage.md` llm_usage_log/model_config 행,
`10-triggers.md` trigger 행, `6-knowledge-base.md` knowledge_base 행, `12-workspace.md`·`2-auth.md`
workspace_member 행). `folder`·`auth_config` 는 data-flow 에 별도 "생성" sink 행 자체가 없어 §3 표에만
적는다고 plan 이 명시적으로 밝혔고(§S4 말미), 실측으로도 그 두 엔티티의 INSERT sink 행이 어느
data-flow 문서에도 없음을 확인했다 — 누락이 아니라 문서 구조상 대상이 없는 경우다.

### 3. 새 이름의 기존 인덱스·제약 충돌 (특히 V130 vs `model_config_workspace_kind_default_unique`)

- `codebase/backend/migrations/V089__model_config_kind_default_unique.sql` 이 만든 기존 인덱스는
  `model_config_workspace_kind_default_unique ON model_config (workspace_id, kind) WHERE is_default = true`
  — **partial** unique 인덱스다. V130 이 만들 `idx_model_config_workspace_kind ON model_config
  (workspace_id, kind)` 는 조건절이 없는 **full** 인덱스이며 이름도 다르다. Postgres 레벨에서 이름 충돌
  없음, 정의도 다르므로 기능적으로 대체 관계가 아니라 **공존**한다 — spec §3·data-flow 7-llm-usage.md
  둘 다 "부분 UNIQUE 는 `is_default` 조건 없는 조회가 쓰지 못한다" 고 그 관계를 명시적으로 설명하고
  있어 spec 서술과 실제 DB 객체 관계가 일치한다.
- 나머지 9개 신규 인덱스 이름(`idx_edge_target_node_id` 등)을 `codebase/`·`spec/`·`plan/` 전체에서 grep
  했을 때 V121~V130 정의 문구 자체를 제외하면 0건 — 기존 TypeORM `@Index` 데코레이터·다른 마이그레이션
  파일과 이름 충돌 없음.

## 요약

target(`spec/conventions/migrations.md`)의 번호 정책·CONCURRENTLY 절차 규약은 착수 예정인
V121~V130 FK 인덱스 마이그레이션과 형태·순서 면에서 어긋나지 않으며, `spec/1-data-model.md` §3 인덱스
전략 표와 6개 data-flow sink 문서가 기술하는 인덱스 정의·V번호는 상호 간 및 plan 문서와 완전히
일치한다. 특별히 우려됐던 V130 신규 인덱스와 기존 `model_config_workspace_kind_default_unique`
(V089) 의 관계도 이름·조건절이 달라 충돌이 아니라 상호 보완(부분 UNIQUE vs 전체 목록 조회용)으로
spec 서술과 실제 DB 정의가 일치한다. Cross-Spec 관점에서 구현 착수를 막을 근거를 찾지 못했다.

## 위험도

NONE
