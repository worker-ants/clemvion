# 신규 식별자 충돌 검토 — 삭제 연쇄 FK 인덱스 다섯 (V112~V116)

## 검토 대상

`plan/in-progress/spec-draft-deletion-cascade-indexes.md` 의 «구현» 절이 이번 PR 에서 새로 도입하는 식별자:

- 마이그레이션 버전 5개: `V112` ~ `V116`
- Postgres 인덱스 이름 5개: `idx_node_execution_node_id` · `idx_integration_usage_log_node_execution_id` · `idx_integration_usage_log_workflow_id` · `idx_llm_usage_log_node_execution_id` · `idx_llm_usage_log_execution_id`
- 신규 e2e 파일 1개: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`
- (spec 문서 쪽은 `6e029937c` 커밋으로 이미 반영·머지됨 — `spec/1-data-model.md` §3/§2.10.1/§2.24/Rationale, `spec/data-flow/{3-execution,5-integration,7-llm-usage}.md`)

애플리케이션 코드(엔티티/DTO/endpoint/이벤트/ENV) 변경은 plan 이 명시한 대로 없음 — 해당 관점(2·3·4·5)은 이번 변경분에는 해당 사항 없음.

## 검증 방법

`codebase/`·`spec/`·`plan/` 전체에 대해 5개 인덱스 이름과 `V112`~`V116` 을 grep, 기존 마이그레이션 파일(`V001`~`V111`)의 인덱스 정의를 직접 대조, e2e 디렉터리의 기존 파일명·기존 index-검증 패턴(`indisvalid`/`pg_get_indexdef`)을 확인했다.

## 발견사항

- **[INFO]** 신규 식별자 5종 — grep 0건, 독립 재확인 완료
  - target 신규 식별자: `idx_node_execution_node_id`, `idx_integration_usage_log_node_execution_id`, `idx_integration_usage_log_workflow_id`, `idx_llm_usage_log_node_execution_id`, `idx_llm_usage_log_execution_id`
  - 기존 사용처: 없음. `codebase/backend/migrations/V002__indexes.sql`(`idx_node_execution_execution`, 컬럼이 `execution_id` 로 다름), `V034`(복합 인덱스, 이름 다름), `V008__integration_usage_log_and_metadata.sql`(`idx_integration_usage_log_integration_at`/`idx_integration_usage_log_at`), `V014__llm_usage_logs.sql`(`idx_llm_usage_log_workspace_created_at` 등) 는 모두 다른 컬럼 조합에 대한 다른 이름이라 충돌 아님
  - 상세: plan 본문이 자체적으로 "`codebase/`·`spec/`·`plan/` grep 0건" 이라 주장한 것을 이번 세션에서 `grep -rn`/`grep -rl` 로 개별 재현해 확인했다. `V112`~`V116` 도 `spec/1-data-model.md`·`spec/data-flow/{3-execution,5-integration,7-llm-usage}.md`·plan 파일 외에는 등장하지 않으며, 이는 이미 머지된 spec 커밋(`6e029937c`)과 일치해 새 충돌이 아니다. `codebase/backend/migrations/` 의 최신 파일은 `V111__trigger_workflow_id_index.sql` 이므로 `V112`~`V116` 은 단조 증가 요구([`migrations.md` §2](spec/conventions/migrations.md))를 만족한다. 인덱스 이름 규약(`idx_<table>_<column>`, `V111` 의 `idx_trigger_workflow_id` 선례)에도 부합한다. 63바이트 Postgres 식별자 한도도 모두 여유(최대 43자)
  - 제안: 없음 — 구현 착수해도 무방. 단 developer 는 실제 파일 생성 직전 `python3 scripts/check-migration-versions.py --base origin/main` (plan 체크리스트에 이미 명시됨)로 이 세션과 자신의 로컬 사이 시간차 동안 다른 PR 이 `V112` 를 선점하지 않았는지 재확인할 것 — 이는 명명 충돌이 아니라 머지 race 이므로 `migrations.md` §6.2 절차로 커버된다

- **[INFO]** 신규 e2e 파일 경로 — 기존 파일과 미충돌, 컨벤션과도 정합
  - target 신규 식별자: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`
  - 기존 사용처: 동일 이름 없음(`ls codebase/backend/test/*.e2e-spec.ts` 재확인). 가장 근접한 선례는 `trigger-deletion-releases-resources.e2e-spec.ts`(V111 의 `idx_trigger_workflow_id` 를 이 파일 안에서 `indisvalid`/`pg_get_indexdef` 로 검증)
  - 상세: 선례는 인덱스 검증을 "그 인덱스가 속한 리소스의 삭제 e2e 파일 안에 얹는" 패턴이었던 반면, 이번 plan 은 3개 테이블(`node_execution`/`integration_usage_log`/`llm_usage_log`)에 걸친 인덱스 5개를 위해 **전용 파일**을 새로 둔다. 이름 자체는 기존 어떤 파일과도 겹치지 않고 `kebab-case.e2e-spec.ts` 컨벤션도 지킨다 — 실질적 충돌은 없다. 다만 "인덱스 검증은 리소스별 삭제 e2e 안에" 라는 기존 1건의 선례와 이번 "인덱스 전용 파일" 이라는 두 번째 패턴이 향후 세 번째 인덱스 PR 에서 "어느 쪽 관례를 따를지" 를 다시 묻게 만들 소지가 있다
  - 제안: 충돌이 아니므로 변경 불요. 다만 이 PR 이 "인덱스 검증 전용 e2e 파일" 패턴의 두 번째 선례가 된다는 점을 인지하고, 다음에 유사 FK 인덱스를 추가할 때(비대상 표의 "지식 베이스 연쇄" 다음 후보 등) 이 두 패턴 중 하나로 수렴시킬지는 별도 판단 사항으로 남긴다(이번 PR 을 막을 사유는 아님)

## 요약

이번 변경(V112~V116 마이그레이션, 대응 인덱스 이름 5개, e2e 파일 1개)이 새로 도입하는 모든 식별자에 대해 `codebase/`·`spec/`·`plan/` 전수 grep 을 독립적으로 재현한 결과 기존 사용처와의 충돌은 0건이었다. 마이그레이션 버전 번호는 현재 main 최대값(`V111`)과 단조 증가·gap 없음 요구를 만족하고, 인덱스 이름은 `idx_<table>_<column>` 기존 명명 규약(V111 선례)과 정확히 일치하며, e2e 파일명도 기존 파일과 겹치지 않는다. 이번 PR 이 도입하는 새 엔티티·DTO·API endpoint·이벤트명·ENV/설정키는 없다(순수 인덱스 마이그레이션, 애플리케이션 코드 변경 없음). spec 문서(`spec/1-data-model.md`, data-flow 3개 문서)의 대응 서술은 이미 별도 커밋(`6e029937c`)으로 반영·정합돼 있음을 함께 확인했다. 유일한 관찰 사항은 CRITICAL/WARNING 이 아닌 INFO 수준으로, 인덱스 검증 e2e 를 "리소스별 파일에 얹기" 대 "전용 파일 신설" 두 패턴이 공존하게 된다는 점뿐이며 이는 이름 충돌이 아니다.

## 위험도

NONE
