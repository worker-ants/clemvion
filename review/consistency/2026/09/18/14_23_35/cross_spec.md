# Cross-Spec 일관성 검토 — 삭제 연쇄 FK 인덱스 (V112~V116)

## 방법론 메모 (판정에 앞서)

전달된 프롬프트 번들은 `scope=spec/conventions/` 로 지정돼 있었으나, 실려 있는 target 문서 본문은
`spec/conventions/cafe24-api-catalog/_overview.md` · `category.md` · `store.md` 등 **cafe24 API 카탈로그
전체(수천 줄)** 였고, 정작 이 PR 의 실제 diff(`## 구현 변경 사항`)는 프롬프트 어디에도 나타나지 않았다
(예산이 카탈로그 덤프에 전부 소진된 것으로 보인다 — 헤더만 있고 본문 없음).

프롬프트 자체가 "diff 본문이 안 보이면 예산 절단이니 워킹트리를 절대경로로 직접 읽으라" 고 명시하므로,
`git -C <워킹트리> diff origin/main..HEAD` 로 실제 변경분을 직접 확인했다. 실제 diff 는 다음과 같다:

- `codebase/backend/migrations/V112~V116__*.sql/.conf` (신규 FK 인덱스 5개)
- `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (신규 e2e)
- `spec/1-data-model.md`, `spec/data-flow/3-execution.md`, `spec/data-flow/5-integration.md`,
  `spec/data-flow/7-llm-usage.md` (인덱스 서술 갱신)
- `plan/in-progress/cafe24-backlog-residual.md`, `plan/in-progress/spec-draft-deletion-cascade-indexes.md` (plan 문서)

즉 이 PR 의 **실제 spec 변경 범위는 `spec/conventions/` 가 아니라 `spec/1-data-model.md` + `spec/data-flow/*`**
이다. 아래 발견사항은 이 실제 diff 를 대상으로 한 것이다.

## 발견사항

- **[INFO]** 프롬프트 번들 스코프 오귀속 — 하네스 이슈, 이번 라운드 조치 불요
  - target 위치: 본 프롬프트(`_prompts/cross_spec.md`)의 `scope=spec/conventions/` 지정 및 첨부된
    cafe24-api-catalog 전량
  - 충돌 대상: 없음 (이 PR 의 실제 spec 변경과 무관한 콘텐츠)
  - 상세: `spec/conventions/` 스코프로 지정된 이 PR 의 `--impl-done` 검토 프롬프트가 실제 diff 대신
    무관한 cafe24 API 카탈로그 전체를 실었다. 동일 증상이 앞선 라운드(`review/consistency/2026/09/18/13_55_55`,
    같은 PR 의 `--impl-prep`)에서도 발생했고, 그때 발견된 카탈로그 문서 위생 이슈 3건은 이미
    `plan/in-progress/cafe24-backlog-residual.md` (`## 카탈로그 문서 위생 셋 — 무관한 --impl-prep 이 지나가다 본 것`
    섹션, 2026-09-18)에 등재되어 별도 트랙으로 처리 중이다. 따라서 이번 라운드에서 동일 콘텐츠를 다시
    분석하거나 재등재할 필요는 없다.
  - 제안: (a) 이 PR 범위에서는 조치 불요 — 이미 트래커에 반영됨. (b) 별도로, consistency-checker 하네스의
    `--impl-done`/`--impl-prep` 번들링 로직이 "scope 매칭 디렉토리 전체"를 실 diff 유무와 무관하게 통째로
    싣는 것으로 보이는데(대용량 reference 디렉토리인 `cafe24-api-catalog/` 특히 취약), 이는 기존 메모
    (`feedback_consistency_spec_mode_budget.md`)의 재발 사례이므로 harness 팀(project-planner)이 예산 배분
    로직을 개선할 후보로 별도 기록할 만하다 (이 PR 의 스코프는 아님).

- 실제 diff(V112~V116 인덱스 + 4개 spec 문서 갱신 + e2e)에서는 데이터 모델·API 계약·요구사항 ID·상태
  전이·RBAC·계층 책임 어느 항목에서도 CRITICAL/WARNING 급 충돌을 발견하지 못했다. 근거:
  - **데이터 모델**: `spec/1-data-model.md` 에 추가된 인덱스 서술(`IntegrationUsageLog (node_execution_id)`·
    `(workflow_id)`, `LlmUsageLog (node_execution_id)`·`(execution_id)` partial, `NodeExecution (node_id)`)이
    실제 `V112~V116` SQL 의 컬럼·partial 조건·FK 방향(CASCADE/SET NULL)과 정확히 일치하고, e2e
    (`deletion-cascade-indexes.e2e-spec.ts`)의 정규식 단언도 동일 정의를 기대한다. 세 곳(마이그레이션 헤더
    주석·spec 문서·e2e 정규식) 사이에 불일치 없음.
  - **API 계약**: 이번 변경은 인덱스 추가뿐이며 endpoint·request/response shape 변경 없음. 영향 없음.
  - **요구사항 ID**: 신규 요구사항 ID 부여 없음(순수 성능 인덱스 + 서술 갱신). 영향 없음.
  - **상태 전이**: `node_execution`/`execution`/`integration_usage_log`/`llm_usage_log` 어느 엔티티의 상태
    머신도 변경되지 않았다. FK 삭제 동작(CASCADE/SET NULL) 자체도 기존 그대로이며, 이번 PR 은 그 동작을
    지원하는 인덱스만 추가했다.
  - **권한·RBAC**: 관련 변경 없음.
  - **계층 책임**: DB 인덱스 추가는 backend/migrations 레이어 책임이고 spec 문서 갱신은 그 반영이라
    기존 책임 분할과 일치. `plan/in-progress/spec-draft-deletion-cascade-indexes.md` 가 실측·근거를,
    `spec/1-data-model.md` `## Rationale` 이 결정 배경을 담아 기존 3섹션 구성(Overview/본문/Rationale)
    관례를 따른다.
  - **spec/conventions/migrations.md 정합**: 신규 파일명(`V112__node_execution_node_id_index.sql/.conf` 등)이
    §1 명명 규약(`V<번호>__<snake_case_descriptor>`, `.conf` 페어 동일 base name)을 따르고, V번호가
    기존 max(V111) 이후 gap 없이 단조 증가(V112→V116)하며, `CREATE INDEX CONCURRENTLY` 앞에 `DROP INDEX
    CONCURRENTLY IF EXISTS` 를 두는 §5 의 "인덱스 마이그레이션 별도 패턴"도 다섯 파일 모두 준수한다.
    이 컨벤션 문서가 사실상 이 PR 과 교차 검증해야 할 `spec/conventions/` 유일한 실질 대상이었고, 충돌 없음.

## 요약

이 PR 의 실제 spec 변경(`spec/1-data-model.md`, `spec/data-flow/{3-execution,5-integration,7-llm-usage}.md`)은
FK 삭제 연쇄 인덱스 5개(V112~V116)에 대한 서술 추가로 범위가 좁고, 마이그레이션 SQL·e2e 단언·spec 문서
세 곳의 정의가 서로 일치하며 `spec/conventions/migrations.md` 의 명명·CONCURRENTLY 패턴 규약도 준수한다.
데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 다른 spec 영역과의 충돌을
발견하지 못했다. 다만 이번 검토에 전달된 프롬프트 번들은 `scope=spec/conventions/` 지정에도 불구하고
무관한 cafe24 API 카탈로그 전체를 실어 실제 diff 를 담지 못한 하네스 이슈가 있었다(직접 워킹트리를
읽어 우회). 그 번들에서 나온 부수 발견 3건은 이미 이전 라운드에서 `plan/in-progress/cafe24-backlog-residual.md`
에 등재돼 처리 트랙이 있으므로 이번 라운드의 판정에는 영향이 없다.

## 위험도

NONE
