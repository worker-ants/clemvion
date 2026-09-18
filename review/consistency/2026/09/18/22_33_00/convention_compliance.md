# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-fk-remaining-dispositions.md`

## 발견사항

- **[INFO]** 변경안(S1·S4) 인용 라인의 backtick 중첩이 draft 자체에서 렌더링을 깬다
  - target 위치: `## 변경안` S1 각 bullet(예: `Folder` 행, `AuthConfig`/`ModelConfig`/`AssistantSession` 행)과 S4 표의 "인덱스 칸에 더할 것" 열
  - 위반 규약: 특정 `spec/conventions/*` 항목은 아님 — 문서 구조 규약(§3, Overview/본문/Rationale)이나 명명 규약 위반은 아니고 순수 markdown 이스케이핑 스타일 문제
  - 상세: `` `| Folder | (parent_id) WHERE parent_id IS NOT NULL | FK `ON DELETE CASCADE` — … |` `` 처럼 바깥을 단일 backtick 한 쌍으로 감싼 줄 안에 `` `ON DELETE CASCADE` ``·`` `(workspace_id, parent_id)` `` 같은 내부 backtick 쌍이 또 있다. CommonMark 단일 backtick 스팬은 첫 내부 backtick에서 끝나므로, 이 줄들은 draft 파일을 그대로 렌더링(GitHub 등)했을 때 backtick 문자가 노출되며 깨진다. 다만 이 바깥 backtick 쌍은 "이 텍스트를 그대로 삽입하라"는 draft 저자의 인용 장치이지 최종 `spec/1-data-model.md` 표 셀에 그대로 들어갈 문자는 아니다 — 실제 삽입될 내부 텍스트(예: `FK `ON DELETE CASCADE``)는 기존 §3 표의 실제 행(예: 921행 `NodeExecution` 행의 `FK `ON DELETE CASCADE` 의 자식 조회…`)과 동일한 단일-backtick 스타일이라 **최종 spec 반영본에는 문제가 없다**. 문제는 이 draft 문서 자체를 읽을 때만 발생하는 표시 이슈다.
  - 제안: 영향이 draft 가독성에 한정되고 최종 spec 반영 내용에는 전이되지 않으므로 규약 갱신도 target 수정도 필수는 아니다. 다음에 같은 draft 를 쓸 때 바깥 인용을 이중 backtick(`` `` … `` ``)으로 감싸면 자체 렌더링도 깨지지 않는다.

## 준수 확인 (근거)

아래는 이번 검토에서 실제로 대조한 정식 규약과 target 의 부합 지점 — 위반이 아니라 확인 근거로 기록한다.

- **마이그레이션 명명·버전 정책** (`spec/conventions/migrations.md` §1·§2, `codebase/backend/migrations/README.md` §5): target 이 제안한 `V121~V130` 은 현재 main 의 max `V120` 에서 gap 없이 단조 증가(레포 실측 `ls codebase/backend/migrations` 로 V120 이 최댓값임을 확인)하고, 파일당 `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 한 개 + `.conf executeInTransaction=false` 패턴은 README §5 "신규 추가에도 0) 을 둡니다"(V111 이후 규칙)를 정확히 인용하고 있다.
- **인덱스 식별자 명명 선례**: 제안된 `idx_edge_target_node_id`·`idx_llm_usage_log_llm_config_id`·`idx_folder_parent_id`·`idx_workspace_member_user_id` 등은 실제 V111~V120 파일에서 확인한 `idx_<table>_<column>` 패턴과 일치한다(`grep CREATE INDEX V11*.sql V12*.sql` 로 대조). 2-컬럼 `idx_model_config_workspace_kind`(V130, `(workspace_id, kind)`) 도 기존 `idx_schedule_workspace_next_run`(V110, `(workspace_id, next_run_at)`)·`idx_integration_workspace_service_mall`(V072) 같은 "`_id`/`_type` 접미 생략" 축약 관례를 그대로 따른다.
- **`spec/1-data-model.md` §3 표 서식**: 제안된 신규 행(`WorkspaceMember`·`Workflow(folder_id)`·`Edge(target_node_id)`·`Trigger(auth_config_id)`·`AuthConfig`·`ModelConfig`·`AssistantSession(llm_config_id)`·`LlmUsageLog(llm_config_id)`·`KnowledgeBase`·`Folder(parent_id)`)는 기존 §3 표의 실제 행 서식 — `\| Table \| (col) [WHERE …] \| 설명 … CONCURRENTLY, VNNN \|`, 인라인 backtick 은 목적 칸의 코드 조각(`ON DELETE CASCADE`, 다른 인덱스 컬럼 목록 등)에만 사용 — 과 동일하다(921·914·956행 등과 직접 대조).
- **Rationale 섹션 규약**: S3 이 추가하는 새 절 제목 `### 쓸 인덱스가 없는 FK 서른하나의 처분 (2026-09-18)`는 바로 위에 이미 있는 `### 그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (2026-09-18)` 절과 동일한 "`### <제목> (날짜)`" 헤딩 패턴을 따른다. `project-planner` SKILL.md §3 "draft 작성: … 본문 끝에 `## Rationale` 로 결정 근거 명시" 요건도 draft 자체가 `## Rationale` 로 끝나는 구조로 충족한다.
- **plan frontmatter 스키마** (`.claude/docs/plan-lifecycle.md §4`): `worktree`/`started`/`owner` 필수 3필드가 모두 존재하고 `worktree: fk-index-remaining-cd2eec` 는 실제 세션 worktree 와 일치한다. `spec_impact` 는 in-progress 단계에서는 의무가 아니지만(§4, Gate C 는 완료 시점 강제) 조기에 선언한 값(7개 spec 경로) 은 모두 리포에 실존하는 파일이다(`spec/1-data-model.md`, `spec/data-flow/{2-auth,6-knowledge-base,7-llm-usage,10-triggers,11-workflow,12-workspace}.md`).
- **frontmatter-evidence 제외 대상과 정합**: S1~S3 이 건드리는 `spec/1-data-model.md` 는 `spec/conventions/spec-impl-evidence.md §1 EXCLUDE_BASENAMES` 에 명시적으로 등재된 "frontmatter 불요" 파일이고, S4 가 건드리는 `spec/data-flow/**` 전체도 같은 문서 §1 에서 "frontmatter 자체가 없다"고 명시된 대상이다 — target 이 이 두 예외 영역에만 spec 변경을 배치한 것은 규약과 정확히 맞물린다(frontmatter 필드 추가·수정 지시가 draft 어디에도 없다).
- **체크리스트 명령 표기**: `- [ ] --impl-prep spec/conventions/` 같은 축약 표기는 `/consistency-check --impl-prep <spec/영역>` (developer SKILL.md) 의 관용적 축약이며, 기존 `plan/complete/*.md` 다수에서 같은 축약이 쓰인 선례를 확인했다(예: `auth-config-webhook-followups.md`).
- **API 문서/출력 포맷 규약**: target 은 API 응답·이벤트 페이로드·에러 코드·Swagger/OpenAPI 데코레이터를 전혀 다루지 않는다(순수 DB 인덱스·마이그레이션·spec 문서 변경) — `spec/conventions/swagger.md`·`error-codes.md` 는 적용 범위 밖(N/A)이며, 위반도 오적용도 없다.

## 요약

target 문서(`plan/in-progress/spec-draft-fk-remaining-dispositions.md`)는 마이그레이션 명명·버전 정책(`spec/conventions/migrations.md`, `migrations/README.md §5`), `spec/1-data-model.md §3` 인덱스 표 서식, Rationale 섹션 헤딩 패턴, plan frontmatter 3필드 스키마, frontmatter-evidence 제외 영역(`1-data-model.md`·`data-flow/**`) 처리를 모두 기존 정식 규약·실제 선례와 대조해 확인했으며 CRITICAL·WARNING 급 위반을 찾지 못했다. 유일하게 기록할 만한 점은 draft 본문 안의 변경안 인용 줄들이 단일 backtick 중첩으로 draft 자체 렌더링이 깨질 수 있다는 INFO 수준 지적뿐이며, 이는 최종 spec 반영 내용에는 전이되지 않는다. API 응답·이벤트·에러코드·Swagger 관련 규약은 문서 성격상 해당 사항이 없다.

## 위험도

NONE
