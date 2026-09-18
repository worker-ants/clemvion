# 신규 식별자 충돌 검토 — `spec/conventions/` (--impl-prep)

## 검토 방법 메모

`_prompts/naming_collision.md` 번들은 컨텍스트 예산 초과로 `spec/conventions/` 산하 274개 파일 중 6개
(`migrations.md`·`audit-actions.md`·`cafe24-api-catalog/_overview.md`·`category.md`·`store.md`·`translation.md`)
를 제외한 나머지 전부가 "본문 생략됨 — 의도된 절단" 으로 비어 있었다(예: `cafe24-api-metadata.md` 31,244자,
`conversation-thread.md` 80,407자 등). 번들만으로는 전수 검토가 불가능하므로, 번들 대신 **실제 저장소 파일을
직접 Read/grep** 하여 검토했다 — 특히 이번 세션(`fk-index-remaining-cd2eec`)이 실제로 도입하려는 신규
식별자가 무엇인지를 `plan/in-progress/spec-draft-fk-remaining-dispositions.md` (spec_impact: `spec/1-data-model.md`
등, `--impl-prep spec/conventions/` 가 체크리스트에 미완료로 남아 있음)에서 특정한 뒤, 그 식별자들을 저장소
전체에 대해 grep 했다.

## 이번 작업이 실제로 도입하는 신규 식별자

draft(`plan/in-progress/spec-draft-fk-remaining-dispositions.md` §구현)가 명시하는 신규 식별자는 다음 두 종류뿐이다.

1. **마이그레이션 V번호**: V121~V130 (10개, `spec/conventions/migrations.md` §2 V번호 정책 대상)
2. **인덱스 이름** (10개): `idx_edge_target_node_id` · `idx_llm_usage_log_llm_config_id` ·
   `idx_workflow_folder_id` · `idx_folder_parent_id` · `idx_workflow_assistant_session_llm_config_id` ·
   `idx_trigger_auth_config_id` · `idx_auth_config_workspace_id` · `idx_knowledge_base_workspace_id` ·
   `idx_workspace_member_user_id` · `idx_model_config_workspace_kind`

새 엔티티·DTO·API endpoint·webhook/queue/SSE 이벤트·ENV var·config key 는 이 작업에서 도입되지 않는다(순수
DB 인덱스 추가) — 따라서 점검 관점 2·3·4·5 는 본 target 에 해당 사항 없음(N/A).

## 실측 검증 (2026-09-18, 이 세션에서 재확인)

- `codebase/backend/migrations/` 의 현재 max V 번호: **V120**. `V121`~`V130` 파일은 아직 하나도 없음
  (`ls codebase/backend/migrations | grep -E '^V1(2[1-9]|30)__'` → 0건). draft 의 "착수 시점 main
  `6f97cb619`" 주장과 일치 — `git log -1 --oneline origin/main` 도 여전히 `6f97cb619`(로컬 HEAD
  `4dfc5787b` 는 그 위에 얹힌, 아직 origin 에 없는 로컬 커밋)로 **머지 race 없음**.
- 인덱스 이름 10개 전부 `codebase/`·`spec/`·`plan/` 전수 grep → 각 **정확히 1건**, 그 1건은 모두
  `plan/in-progress/spec-draft-fk-remaining-dispositions.md` 자기 자신(draft 본문의 "구현" 절 나열) —
  즉 코드·spec·기존 마이그레이션 SQL 어디에도 아직 쓰이지 않음(0건). 기존 `*.sql` 의 `idx_*` 이름 전체와도
  `workflow_folder|folder_parent|target_node|llm_config|auth_config_workspace|knowledge_base_workspace|
  workspace_member_user|model_config_workspace|trigger_auth_config` 부분일치 검색 결과 근접/오탈자성
  중복도 없음.
- `V121`~`V130` 토큰 각각을 `spec/`·`plan/`·`codebase/` 전수 grep → 모두 `spec/1-data-model.md` +
  해당 data-flow sink 문서(`11-workflow.md`/`7-llm-usage.md`/`10-triggers.md`/`6-knowledge-base.md`/
  `12-workspace.md`/`2-auth.md`) + draft 자신에서만 등장, 그마다 가리키는 FK/인덱스가 서로 다른 의미로
  중복 사용된 곳 없음(draft §S1~S4 가 이미 반영된 상태와 grep 결과가 일치).
- `migrations.md` §1 명명 규약(`V<번호>__<snake_case_descriptor>`)·§2 V번호 정책(단조 증가·gap 금지·재사용
  금지) 자체는 이번 세션에서 변경되지 않았고(최근 커밋은 §5 콜아웃 문구 정정뿐), 새 V번호 10개가 그 정책을
  깨지 않는다(연속 정수, 현재 max+1부터 시작).

## 참고 — target 범위 안의 기존 self-flagged 항목 (신규 아님, 정보용)

`spec/conventions/cafe24-api-catalog/_overview.md` §5 말미에 이미 기록된 문장: `store.md` 의
`privacy_*` id(`privacy_boards_get`/`privacy_join_get`/`privacy_orders_get` 등, resource 는 실제로는
`store`)가 별도 `privacy` resource(`privacy.md`, id 는 `customers_privacy_*`/`products_wishlist_customers_*`)
와 접두어상 혼동 소지가 있다는 우려가 이미 "별 트랙으로 follow-up 가능" 으로 문서화·유예되어 있다. 문자열
자체는 두 resource 간 정확히 일치하지 않아(actual ID 충돌은 0건) CRITICAL 은 아니며, 이번 세션이 새로
도입한 내용도 아니다 — 재론 대상 아님, 정보 제공 목적으로만 기록.

## 발견사항

없음 (CRITICAL 0 · WARNING 0). 이번 target(V121~V130 마이그레이션 + 10개 인덱스 이름)이 도입하는 모든
신규 식별자는 기존 코드·spec·plan 어디에도 다른 의미로 쓰이고 있지 않으며, `migrations.md` 명명·번호
정책과도 충돌하지 않는다.

## 요약

`spec/conventions/` 를 scope 로 한 `--impl-prep` 게이트가 실제로 지켜야 할 신규 식별자는 draft
`spec-draft-fk-remaining-dispositions.md` 가 명시한 V121~V130 마이그레이션 번호와 10개 인덱스 이름뿐이며,
새 엔티티·API endpoint·이벤트명·ENV var 는 이 작업에 없다. 프롬프트 번들이 예산 초과로 대부분 절단되어
있었으나 실제 저장소를 직접 grep 한 결과 두 식별자 집합 모두 기존 사용처와 충돌이 없고(각 0건 또는 draft
자기인용 1건), V번호 단조성·머지 race 도 현재 시점 기준 이상 없다. target 범위 안에 이미 알려진 채 유예된
`privacy_*` prefix 혼동 우려(cafe24 카탈로그)가 하나 있으나 이번 세션이 만든 것이 아니고 실제 ID 충돌도
아니므로 차단 사유가 아니다.

## 위험도

NONE
