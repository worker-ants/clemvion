# 정식 규약 준수 검토 — 삭제 연쇄 FK 인덱스 다섯 (V112~V116)

## 검토 범위 확인

- 지정 target(`spec/conventions/`)의 diff-base(`origin/main`) 대비 실제 변경 파일은 **0개**다. 이 브랜치는 `spec/conventions/` 자체를 건드리지 않았다 — 정상이며 그 자체로 CRITICAL 근거가 아니다.
- 프롬프트 번들의 `<git diff origin/main...HEAD -- code_areas>` 섹션은 예산 초과로 절단돼 있어, HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/usage-log-workflow-index-5b1e07`)에서 `git diff origin/main...HEAD --stat`, 개별 마이그레이션·e2e·spec 파일을 절대경로로 직접 Read/grep 해 검증했다. 실제 코드 델타는 `codebase/backend/migrations/V112~V116`(5쌍 .sql/.conf) + `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` + `spec/1-data-model.md`·`spec/data-flow/{3-execution,5-integration,7-llm-usage}.md`(sink 표·Rationale 갱신) + `plan/in-progress/{spec-draft-deletion-cascade-indexes.md, cafe24-backlog-residual.md}` 다.
- 적용 대상 정식 규약은 `spec/conventions/migrations.md`(전문 Read) + 그 문서가 실제 작성 가이드로 위임하는 `codebase/backend/migrations/README.md` §2·§4·§5 다. 이번 diff 에 API 응답·이벤트 페이로드·에러 코드·OpenAPI 데코레이터 변경은 없어 관점 2(출력 포맷)·4(API 문서)는 **해당 사항 없음**.

## 발견사항

- **[정보 — 위반 없음] 마이그레이션 명명·V번호·CONCURRENTLY 패턴이 `migrations.md`를 완전히 준수**
  - target 위치: `codebase/backend/migrations/V112__node_execution_node_id_index.{sql,conf}` ~ `V116__llm_usage_log_execution_id_index.{sql,conf}`
  - 근거 규약: `spec/conventions/migrations.md` §1(명명)·§2(V번호 정책)·§5(CONCURRENTLY 패턴), `codebase/backend/migrations/README.md` §4·§5
  - 확인: (1) 파일명 `V<정수>__<snake_case>.sql`/`.conf` 페어, base name 일치. (2) origin/main 현재 max 는 V111 — V112~V116 은 gap·중복 없이 단조 연속(§2). `python3 scripts/check-migration-versions.py` 류 가드가 구조적으로 이 클래스를 방어. (3) 인덱스명 `idx_node_execution_node_id`·`idx_integration_usage_log_node_execution_id`·`idx_integration_usage_log_workflow_id`·`idx_llm_usage_log_node_execution_id`·`idx_llm_usage_log_execution_id` 는 기존 `idx_trigger_workflow_id`(V111)·`idx_integration_usage_log_integration_at`(V008)·`idx_llm_usage_log_workspace_created_at`(V014) 등과 동일한 `idx_<table>_<column>` 관례를 따르고, `codebase/backend/migrations/` 전수 grep 결과 재사용·충돌 0건. (4) 5개 파일 전부 "`DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` + 동봉 `.conf executeInTransaction=false`" — README §5 "신규 추가에도 0) 을 둡니다"(V111 부터 갱신된 규칙)와 정확히 일치하며, 파일당 `CREATE INDEX CONCURRENTLY`도 정확히 1개(README §5 제한 준수). partial 인덱스(`llm_usage_log` 둘)에 별도 접미를 붙이지 않은 것도 기존 `idx_node_container` 관례와 동일.
  - 제안: 조치 불요.

- **[정보 — 위반 없음] 문서 구조 규약(Overview/본문/Rationale) 준수**
  - target 위치: `spec/1-data-model.md` 신규 `### 삭제 연쇄의 FK 인덱스 다섯 (2026-09-18)` 서브섹션
  - 근거 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview/본문/Rationale) 권장" + 같은 문서 기존 `## Rationale` 절 명명 관례(`### Trigger \`(workflow_id)\` 인덱스 (2026-09-18)` 등 `### <제목> (<날짜>)` 패턴)
  - 확인: 신규 서브섹션은 기존 `## Rationale` 최상위 헤딩 아래 올바른 위치에 추가됐고, 제목 포맷(`### <설명> (<ISO 날짜>)`)도 인접 절과 동일하다. §3 인덱스 전략 표·§2.10.1·§2.24 갱신도 기존 행 포맷(`FK ... . CONCURRENTLY, V<n>` 스타일)을 그대로 따른다.
  - 제안: 조치 불요.

- **[INFO] 마이그레이션/e2e 주석·spec Rationale 이 아직 존재하지 않는 `plan/complete/` 경로 7곳을 선반영 인용**
  - target 위치: `codebase/backend/migrations/V112~V116` 5개 `.sql` 헤더("실측·전수·쓰기 비용: `plan/complete/spec-draft-deletion-cascade-indexes.md`"), `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` JSDoc, `spec/1-data-model.md` `## Rationale` 말미 출처 각주
  - 위반 규약: 엄밀히는 `spec/conventions/**` 항목이 아니라 CLAUDE.md "정보 저장 위치" 표의 `plan/in-progress/` vs `plan/complete/` 구분 및 `.claude/docs/plan-lifecycle.md` — 참고로만 기록
  - 상세: `find plan -iname '*deletion-cascade*'` 결과 실제 파일은 `plan/in-progress/spec-draft-deletion-cascade-indexes.md`(`status: in-progress`) 뿐이고 `plan/complete/` 쪽은 아직 없다. 다만 이는 **선례가 있는 정상 흐름**이다 — 바로 앞 커밋(`4dfa4ea94`, V111)도 마이그레이션 파일에 `plan/complete/spec-draft-trigger-workflow-index.md` 를 인용하면서 **같은 커밋 안에서** 그 plan 을 `plan/complete/`로 동시 이동시켰다. 이번 브랜치는 아직 그 마무리 단계(체크박스 완료 + `plan/complete/` 이동)를 밟지 않은 것으로 보인다. 같은 세션의 `naming_collision.md`(INFO, 위험도 NONE)·`review/code/.../documentation.md` 도 동일 지점을 독립적으로 짚었다.
  - 제안: 새 규약 위반이 아니라 **아직 완료되지 않은 마무리 단계**로 판단된다 — PR 종결 전에 `plan/in-progress/spec-draft-deletion-cascade-indexes.md` 를 `plan/complete/`로 이동(+ frontmatter `status` 갱신)해 V111 선례와 동일하게 참조를 유효화할 것을 권장. 이동 전에 머지되면 7곳의 참조가 일시적으로 broken reference 가 된다.

- **[INFO] 무관한 카탈로그 위생 이슈는 적절히 별도 트래커로 이관됨 (모범 사례 확인)**
  - target 위치: `plan/in-progress/cafe24-backlog-residual.md` 신규 절 "카탈로그 문서 위생 셋 — 무관한 `--impl-prep` 이 지나가다 본 것 (2026-09-18 발견)"
  - 상세: 이전 `--impl-prep`(13:55:55) 라운드가 번들에 딸려온 `cafe24-api-catalog/_overview.md` frontmatter 부재(WARNING)·`store.md` 각주 불일치(INFO)·Overview 헤딩 스타일(INFO)을 발견했는데, 이번 PR 범위(FK 인덱스)와 무관함에도 즉시 별도 plan 항목으로 옮겨 적었다. CLAUDE.md/메모리에 기록된 "미룬 항목은 그 턴에 `plan/`에 적어라" 원칙에 정확히 부합하는 처리다.
  - 제안: 조치 불요 — 규약 준수 사례로 기록.

## 요약

이번 PR 은 `spec/conventions/` 자체를 변경하지 않았으나, 실제 구현(V112~V116 마이그레이션 5쌍 + e2e + spec 4개 문서 갱신)을 직접 대조한 결과 `spec/conventions/migrations.md`(명명·V번호·CONCURRENTLY 패턴)와 CLAUDE.md 의 문서 구조 관례(Rationale 서브섹션 포맷)를 CRITICAL/WARNING 없이 완전히 준수한다. 유일한 지적 사항은 마이그레이션·e2e·spec 주석 7곳이 아직 `plan/in-progress/`에 있는 계획 문서를 `plan/complete/` 경로로 선반영 인용한 점인데, 이는 새 규약 위반이 아니라 V111 선례(같은 커밋에서 plan 이동까지 완료)를 아직 완주하지 않은 마무리 단계 문제로, 이미 sibling checker(`naming_collision.md`)가 INFO/NONE 으로 동일하게 판단했다. 부수적으로 발견된 cafe24 카탈로그 위생 이슈는 이번 PR 범위 밖임을 정확히 인지하고 별도 plan 으로 이관한 점도 규약 준수 관행상 바람직하다.

## 위험도

NONE
