# Cross-Spec 일관성 검토 — FK 인덱스 열 (V121~V130)

## 검토 범위 및 방법

- **scope 선언(`spec/conventions/`) 델타는 0개 파일** — 정상. 이 PR 은 `spec/conventions/` 를 바꾸지 않았다.
- 번들 예산이 `migrations.md` 본문과 실제 diff 를 모두 절단했으므로, 프롬프트가 지시한 대로 HEAD 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/fk-index-remaining-cd2eec`) 를 절대경로로 직접 읽어 판정했다:
  - 신규 마이그레이션 10쌍 `V121__edge_target_node_id_index.{sql,conf}` ~ `V130__model_config_workspace_kind_index.{sql,conf}`
  - `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`
  - `spec/1-data-model.md` §3 인덱스 전략 표 + `## Rationale`
  - `spec/data-flow/{2-auth,6-knowledge-base,7-llm-usage,10-triggers,11-workflow,12-workspace}.md` 의 Sink 행
  - `spec/conventions/migrations.md`, `codebase/backend/migrations/README.md` §4·§5
  - `plan/in-progress/spec-draft-fk-remaining-dispositions.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`

## 발견사항

### [INFO] `plan/complete/spec-draft-fk-remaining-dispositions.md` 선인용 — 아직 이동 전
- target 위치: 10개 마이그레이션 헤더 주석("실측: `plan/complete/spec-draft-fk-remaining-dispositions.md`"), `spec/1-data-model.md ## Rationale`, e2e 스펙 파일 주석 — 전부 동일 경로를 인용
- 충돌 대상: 실제 파일은 `plan/in-progress/spec-draft-fk-remaining-dispositions.md` (frontmatter `status: in-progress`) 에 있다. `plan/complete/` 아래엔 존재하지 않는다.
- 상세: 인용 시점 기준으로는 dangling reference 다. 다만 target 문서 자신(prompt 번들)이 "이 PR 마지막 커밋에서 `plan/complete/` 로 옮긴다 — 그 이동을 전제한 선인용" 이라고 명시하고 있어 계획된 순서 위반은 아니다. `git status` 스냅샷에서도 해당 파일이 `plan/in-progress/` 에 `M`(수정) 상태로 남아 있어, 최종 이동 커밋이 아직 실행되지 않았다.
- 제안: 이 PR 을 마무리하는 커밋에서 `git mv plan/in-progress/spec-draft-fk-remaining-dispositions.md plan/complete/` 를 실제로 수행했는지 확인. 이동 전에 push 되면 문서 간 참조가 끊긴 채로 main 에 들어간다.

### [INFO] `AuthConfig.workspace_id`(V127) 는 data-flow Sink 표에 대응 행이 없음
- target 위치: `spec/1-data-model.md:931` (AuthConfig §3 행), `spec/1-data-model.md:1159` (Rationale)
- 충돌 대상: `spec/data-flow/*.md` 전체 — `auth_config` 테이블의 Sink 행은 `10-triggers.md` 에서 `trigger.auth_config_id` 참조로만 언급되고, `auth_config` 자체의 생성/삭제 Sink 행(및 그 위의 FK CASCADE·V127 인덱스)을 소유한 data-flow 문서가 없다.
- 상세: 이번 PR 이 갱신한 6개 data-flow 파일(`2-auth`·`6-knowledge-base`·`7-llm-usage`·`10-triggers`·`11-workflow`·`12-workspace`) 목록에는 처음부터 AuthConfig 전용 sink 파일이 포함되어 있지 않다 — PR 이 새로 만든 공백이 아니라 기존 구조(AuthConfig sink 행 부재)를 그대로 물려받은 것으로 보인다. `1-data-model.md` §3 표와 실제 마이그레이션(V127)은 서로 완전히 일치하므로 데이터 모델 자체의 모순은 아니다.
- 제안: cross-spec 관점의 실익은 낮음 — 별도 트래커 항목으로만 남기고 이번 PR 범위에서 처리할 필요는 없음.

## 판정 상세 (교차 검증 결과 — 문제 없음, 기록용)

1. **인덱스 이름·테이블·컬럼·부분조건**: V121~V130 열 개 전부가 `spec/1-data-model.md §3` 표의 대응 행과 글자 그대로 일치한다 (`idx_edge_target_node_id` on `edge(target_node_id)`, `idx_llm_usage_log_llm_config_id` on `llm_usage_log(llm_config_id) WHERE ... IS NOT NULL`, … `idx_model_config_workspace_kind` on `model_config(workspace_id, kind)`). 6개 data-flow 파일의 Sink 행(`workflow`·`edge`·`workflow_assistant_session`·`model_config`·`llm_usage_log`·`trigger`·`knowledge_base`·`workspace_member`)도 동일 V번호·컬럼·partial 조건으로 정확히 미러링되어 있다. e2e 스펙(`deletion-cascade-indexes.e2e-spec.ts`)의 정규식 10개도 동일 정의와 일치한다. 데이터 모델 충돌 없음.
2. **형식 준수**: `.sql`/`.conf` 페어 명명, `V<번호>__snake_case` 패턴, 연속 번호(V120 다음 V121~V130, gap·중복 없음)가 `spec/conventions/migrations.md §1·§2` 를 만족한다. 각 파일이 `executeInTransaction=false` + `CREATE INDEX CONCURRENTLY` 정확히 1개, 그 앞의 `DROP INDEX CONCURRENTLY IF EXISTS <새 이름>`(신규 추가 패턴)까지 `README.md §5` "신규 추가에도 0) 을 둡니다" 규칙과 정확히 일치한다(선례 V111 형식 그대로).
3. **헤더 실측 수치**: 각 마이그레이션 헤더의 "W=10,000 에서 V121~V129 전 → 후" 3-지표(29.1→0.15ms / 306.8→1.8ms / 3,161→49.6ms)가 `spec/1-data-model.md ## Rationale` 의 동일 표와 정확히 일치한다. 개별 지표(예: V121 엣지 28.8ms/304.7ms/2,835ms, V126 트리거 사용처 조회 2.97→0.006ms 등)도 spec Rationale 본문과 grep 일치. spec 이 코드보다 넓게 말하는 곳은 발견되지 않았다(오히려 spec 이 "부분 인덱스 셈법 보정" 등 코드 실측을 정확히 반영해 좁혔다).

FK 제약 이름(`fk_trigger_auth_config` 등)도 `V001__initial_schema.sql` 원본 선언과 대조해 일치를 확인했다. 요구사항 ID·상태 전이·RBAC·계층 책임 관점에서는 이 변경이 건드리는 영역이 없다(순수 인덱스 추가 + 이미 커밋된 spec 정의를 코드가 뒤따라 구현).

## 요약

이번 diff(V121~V130 인덱스 + e2e)는 이미 별도 커밋(`4dfc5787b`)으로 반영된 `spec/1-data-model.md §3`·Rationale·6개 data-flow Sink 행과 열 개 항목 모두 이름·컬럼·partial 조건·측정치까지 글자 그대로 일치하며, `spec/conventions/migrations.md`·`migrations/README.md` 의 신규-추가 CONCURRENTLY 패턴도 정확히 준수한다. 유일한 잔여 사항은 아직 실행되지 않은 plan 파일 이동(`in-progress`→`complete`) 선인용으로, target 문서 스스로 "PR 마지막 커밋에서 처리" 라고 명시한 계획된 절차이며 데이터 모델·API·상태·RBAC·계층 책임 어느 축에서도 실질적 모순은 발견되지 않았다.

## 위험도

LOW
