# 신규 식별자 충돌 검토

## 검토 개요

target scope(`spec/conventions/`)의 diff 는 0개 파일이다 — 이 PR 은 spec/conventions 를 바꾸지 않는다. 실제 변경은 `spec/1-data-model.md`, `spec/data-flow/{2-auth,6-knowledge-base,7-llm-usage,10-triggers,11-workflow,12-workspace}.md`, `codebase/backend/migrations/V121~V130` (신규 인덱스 10개), `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`, `plan/in-progress/spec-draft-fk-remaining-dispositions.md` 다. 이 PR 이 실제로 도입하는 신규 식별자는 **DB 인덱스명 10개 + Flyway 버전 10개 + plan 파일 1개 + spec Rationale 절 제목 1개**뿐이며, 신규 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV/설정키는 도입하지 않는다. 아래는 그 신규 식별자들에 대한 충돌 점검 결과다.

## 점검 방법

- `git -C <worktree> diff origin/main...HEAD --stat` 로 변경 파일 전수 확인 (58 files).
- 신규 Flyway 버전(V121~V130): `git ls-tree -r origin/main --name-only`(base) + `git log --all --name-only`(병렬 세션 선점 여부) 대조 — origin/main 최댓값 V120, 전 브랜치 통틀어 V121~V130 을 쓰는 다른 커밋 없음.
- 신규 인덱스명 10개(`idx_edge_target_node_id` 등) 각각을 `*.ts`/`*.sql`/`*.md` 전수에서 grep — 이 PR 산출물(migration/e2e/plan/review) 밖에서 발견되지 않음.
- `idx_model_config_workspace_kind` 와 기존 V089 UNIQUE 인덱스(`model_config_workspace_kind_default_unique`)를 직접 대조 — 별개 이름, 접두사(`idx_` vs `..._default_unique`) 도 겹치지 않음.
- `spec/1-data-model.md` 의 `### ` 제목 전수 나열 — 신규 Rationale 제목 "쓸 인덱스가 없는 FK 서른하나의 처분 (2026-09-18)" 이 기존 30개 제목과 중복 없음.
- `plan/in-progress/spec-draft-fk-remaining-dispositions.md` 파일명 전수 검색 — 기존 plan 트리에 동명 파일 없음.

## 발견사항

없음.

- **Flyway 버전 번호(V121~V130)**: origin/main 의 최댓값이 V120 이므로 연속·비중복. `git log --all` 전수 조회에서도 동일 번호를 쓰는 경쟁 커밋이 없어 병렬 세션 충돌(메모리 교훈 "백로그 착수 전 병렬 세션 머지 확인")도 해당 없음.
- **인덱스명 10개** (`idx_edge_target_node_id` · `idx_llm_usage_log_llm_config_id` · `idx_workflow_folder_id` · `idx_folder_parent_id` · `idx_workflow_assistant_session_llm_config_id` · `idx_trigger_auth_config_id` · `idx_auth_config_workspace_id` · `idx_knowledge_base_workspace_id` · `idx_workspace_member_user_id` · `idx_model_config_workspace_kind`) 모두 `spec/conventions/migrations.md §1` 의 명명 규약(`V<NNN>__snake_case`)과 기존 관례(`idx_<table>_<column>`)를 따르며, 코드베이스 전체에서 이 PR 산출물 밖 사용처가 없다.
- **`idx_model_config_workspace_kind` vs 기존 V089 `model_config_workspace_kind_default_unique`**: 컬럼 집합은 같지만(`workspace_id, kind`) 조건이 다르고(신규는 무조건, 기존은 `WHERE is_default = true`) 이름도 별개이며, e2e 테스트 주석("기존 …UNIQUE 와 구분된다")과 spec 본문 양쪽에서 구분을 명시하고 있어 혼동 여지가 낮다.
- **plan 파일 `spec-draft-fk-remaining-dispositions.md`**: 신규 파일이며 기존 `plan/**` 트리에 동명 파일이 없다. `spec_impact` frontmatter 도 실재 spec 경로 리스트로 정상 구성돼 있다.
- **spec Rationale 절 제목**: `spec/1-data-model.md` 에 추가된 "### 쓸 인덱스가 없는 FK 서른하나의 처분 (2026-09-18)" 은 인접한 "삭제 연쇄의 FK 인덱스 다섯"·"그래프 RAG 삭제 연쇄의 FK 인덱스 넷" 두 선례와 제목이 겹치지 않고, 본문에서 서로 교차 참조(«28개와 셈법이 놓친 셋을 처분» 등)하며 관계를 명시하고 있어 충돌이 아니라 의도된 연작 시리즈다.
- `spec/conventions/` 자체는 변경이 없어 그 영역이 소유한 명명 규약(감사 액션·Cafe24 카탈로그·API 메타데이터 등)과의 충돌 가능성도 없다.

## 요약

이 PR 은 DB 인덱스 10개(V121~V130)와 관련 spec 서술만 추가하는 순수 성능 작업으로, `spec/conventions/` 를 전혀 건드리지 않았고 새로 도입한 식별자(Flyway 버전·인덱스명·plan 파일명·Rationale 제목) 역시 origin/main·병렬 브랜치·기존 spec 어디와도 충돌하지 않는다. 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV 변수 등 이번 관점에서 다루는 다른 카테고리의 신규 식별자는 애초에 도입되지 않았다. 신규 식별자 충돌 관점에서 이 PR 을 막을 근거는 없다.

## 위험도

NONE
