# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-deletion-cascade-indexes.md`

## 검토 범위

target 문서(`plan/in-progress/spec-draft-deletion-cascade-indexes.md`, `--spec` 검토 모드)를
`spec/conventions/**`(특히 `migrations.md`·`spec-impl-evidence.md`·`review-citations.md`)와
`.claude/docs/plan-lifecycle.md`·`project-planner/SKILL.md`의 plan frontmatter·문서 구조 규약에
대조했다. 실제 저장소의 최근 선례 커밋(`4dfa4ea94` V111·`codebase/backend/migrations/V111__trigger_workflow_id_index.sql`·
`V008__integration_usage_log_and_metadata.sql`·`V014__llm_usage_logs.sql`)과 target 이 제안하는
인덱스명·마이그레이션 절차·spec 표 서식을 직접 대조해 검증했다.

## 발견사항

- **[INFO]** 마이그레이션 로컬 검증 스텝이 체크리스트에 명시되지 않음
  - target 위치: `## 체크리스트` — `- [ ] lint · unit · build · e2e`
  - 위반 규약: `spec/conventions/migrations.md` §5 "새 마이그레이션 추가 절차" (`python3 scripts/check-migration-versions.py --base origin/main` 로컬 실행을 명시적 단계로 규정)
  - 상세: V번호 단조성·중복 검사(§5-4)는 CI(`migration-check`)가 어차피 강제하므로 이 누락이 머지를 막지는 않는다. 다만 §5 절차가 "로컬에서 먼저 통과시킨다"를 명시적 단계로 두고 있는데, target 체크리스트는 이를 "lint · unit · build · e2e" 라는 포괄 항목에 암묵적으로 묻어 두어, 실행 시점에 그 스텝이 빠질 여지가 있다.
  - 제안: 체크리스트에 `python3 scripts/check-migration-versions.py --base origin/main` 를 별도 항목으로 명시(선택 사항 — CI 가 대신 걸러내므로 CRITICAL/WARNING 아님).

- **[INFO]** 인덱스 명명 패턴(`idx_<table>_<column>`)이 target 안에서는 선례 대조로만 확인되고 문서화된 규약에는 없음
  - target 위치: `## 구현 (같은 PR, developer 턴)` — 다섯 인덱스 이름 나열
  - 위반 규약: 해당 없음 (참고: `spec/conventions/migrations.md` §1 은 **파일명** 명명만 규정하고 SQL 인덱스 식별자 명명 규칙은 규약 문서에 없음)
  - 상세: 이것은 target 의 결함이 아니다 — target 이 제안한 다섯 이름(`idx_node_execution_node_id`·`idx_integration_usage_log_node_execution_id`·`idx_integration_usage_log_workflow_id`·`idx_llm_usage_log_node_execution_id`·`idx_llm_usage_log_execution_id`)은 기존 코드베이스 선례(`V008`·`V014`·`V095`·`V106`·`V111`)의 `idx_<table>_<col(s)>` 패턴과 정확히 일치하며 63자 식별자 제한도 넘지 않는다(최장 43자). 다만 이 패턴 자체가 `spec/conventions/migrations.md`에 정식 규칙으로 성문화돼 있지 않다는 점만 기록해 둔다 — target 문서가 규약을 어긴 것은 아니다.
  - 제안: 조치 불필요. 규약 문서 쪽의 갭이며, 원한다면 별도 planner 턴에서 `migrations.md`에 명명 규칙 절을 추가할 수 있다.

## 준수 확인 (참고 — 위반 아님)

다음은 명시적으로 대조해 **일치**를 확인한 항목이다(위반이 없었다는 근거를 남긴다):

- **frontmatter**: `worktree`/`started`/`owner` 3필드 충족, `spec_impact` 가 bare string 이 아닌 실재 spec 경로 리스트(4건 모두 존재 확인) — `plan-lifecycle.md` §4·Gate C 준수.
- **문서 구조**: `project-planner/SKILL.md` "draft 작성" 규칙대로 본문 뒤 `## Rationale` 로 종결 — spec draft plan 에 요구되는 구조(spec 문서용 3섹션 Overview/본문/Rationale 과는 별도로, plan draft 는 본문+Rationale 만 요구됨)를 충족.
- **명명**: `plan/in-progress/spec-draft-<name>.md` 패턴, e2e 테스트 파일명 `deletion-cascade-indexes.e2e-spec.ts` 가 선례(`trigger-workflow-ref.e2e-spec.ts`)와 동일한 kebab-case + `.e2e-spec.ts` 규칙을 따름.
- **마이그레이션 절차**: `CREATE INDEX CONCURRENTLY` 파일당 1개(README §5), `.conf executeInTransaction=false` 동봉, "신규 추가에도 0) DROP INDEX CONCURRENTLY IF EXISTS 를 둔다"는 V111 선례를 정확히 인용(실제 `V111__trigger_workflow_id_index.sql` 내용과 대조해 일치 확인) — `migrations.md` §5 준수.
- **V번호**: 현재 main 의 max 가 V111(가장 최근 병합 `4dfa4ea94`)이므로 V112~V116 신규 할당은 단조 증가·gap 없음 원칙에 부합.
- **spec §3 표 서식**: 제안된 다섯 행이 기존 `NodeExecution`/`IntegrationUsageLog`/`LlmUsageLog` 최신 행들의 "설명 … CONCURRENTLY, V\<n\>" 서식과 partial index `WHERE … IS NOT NULL` 표기를 그대로 따름.
- **Rationale 절 삽입 위치·형식**: "맨 위 새 절"로 삽입하고 바로 아래 기존 절(«Trigger `(workflow_id)` 인덱스»)의 "같은 클래스 전수" 범위 한정을 정정 없이 교차 참조하도록 설계 — 직전 선례(`### Trigger (workflow_id) 인덱스 (2026-09-18)` 절, 실측 표 + "같은 클래스 전수" + 출처 각주 구조)와 동일한 패턴.
- **review-citations.md**: target 본문은 `review/**` 세션을 인용하지 않으며 `plan/**` 문서만 인용한다 — §3 표에서 `plan/**` 은 애초에 이 규약의 적용 대상이 아니므로 위반 여지 없음.

## 요약

target 문서는 정식 규약 준수 관점에서 CRITICAL·WARNING 급 위반이 발견되지 않았다. frontmatter 스키마(Gate C 포함), plan draft 문서 구조, 마이그레이션 명명·절차 규약(`spec/conventions/migrations.md`), spec 표 서식·Rationale 절 삽입 패턴을 모두 직전 병합 선례(V111, `4dfa4ea94`)와 대조 검증했고 일치했다. 특히 "신규 추가에도 0) DROP IF EXISTS 잔재 정리를 둔다"는, 그 선례 PR 이 `migrations.md` §5 를 일반화하며 막 확정한 규칙을 정확히 인용해 재사용하고 있어 규약 추종이 우수하다. 남은 두 항목은 모두 INFO 수준으로, 하나는 체크리스트 명시성 제안(CI 가 이미 강제), 다른 하나는 target 이 아니라 규약 문서 쪽의 미성문화 갭을 기록한 것이다.

## 위험도

NONE
