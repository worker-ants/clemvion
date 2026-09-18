# Plan 정합성 검토 — target `spec/2-navigation/`(impl-done, diff-base `origin/main`)

## 검토 범위 메모

scope 로 지정된 `spec/2-navigation/` 자체의 diff 는 0파일이다. 실제 변경은 `spec/1-data-model.md`
§3/Rationale · `spec/data-flow/10-triggers.md` §2.1 · `spec/conventions/migrations.md` §5 ·
`codebase/backend/migrations/V111__trigger_workflow_id_index.{sql,conf}` ·
`codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` (+ `.spec.ts`) ·
`trigger-deletion-releases-resources.e2e-spec.ts` 에 있으며, 이는 `spec/2-navigation/2-trigger-list.md`
frontmatter `code:` glob 이 그 코드 파일들을 물어 이번 impl-done 라운드가 이 spec 영역까지 스코프에
넣은 것이다. 이 메모의 지시대로 위 파일들과 `plan/in-progress/spec-draft-nullable-notation-followups.md`
(트래커) · `plan/complete/spec-draft-trigger-workflow-index.md`(방금 종결된 draft)를 절대경로로 직접
대조했다.

## 발견사항

- **[INFO]** `--impl-done` 체크박스가 미해결인 채로 draft 가 `plan/complete/` 로 이미 이동됨
  - target 위치: (간접) `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 가 무는 코드 변경 전체 —
    이번 impl-done 검토 그 자체가 이 항목의 유일한 잔여 게이트다
  - 관련 plan: `plan/complete/spec-draft-trigger-workflow-index.md` 체크리스트 마지막 줄 —
    `- [ ] --impl-done` (미체크) vs frontmatter `status: complete` / `completed: 2026-09-18`,
    그리고 그 바로 아래 `- [x] 트래커 반영(...) · 이 draft complete/ 이동`(이미 실행됨)
  - 상세: `.claude/docs/plan-lifecycle.md` §5 자가 점검은 "본 PR 의 변경으로 plan 의 모든 체크박스가
    `[x]` 인가" · "한 항목이라도 `[ ]` 이면 이동 skip" 을 명시한다. 같은 트래커가 가리키는 두 자매
    plan(`plan/complete/trigger-deletion-release.md:191`, `plan/complete/trigger-release-stale-comments.md:63`)
    은 실제로 특정 `--impl-done` 세션 경로(BLOCK: NO)를 인용해 `[x]` 로 체크한 **뒤** `complete/` 로
    옮긴 선례다. 이번 draft 는 그 순서를 뒤집어 `--impl-done` 이 아직 돌지 않은 시점(현재 이 세션이
    그 실행이다)에 이미 `status: complete`·`complete/` 로 이동했다. 실질적 결정 충돌이나 선행조건
    붕괴는 아니다 — impl-done 은 커밋된 diff 위에서 도는 게이트라 "모든 변경(트래커 반영·이동
    포함)을 먼저 커밋 → impl-done 실행" 순서 자체는 불가피한 면이 있다. 다만 자매 plan들의 패턴과
    달리 **이 세션 결과를 인용하는 후속 커밋(체크박스 체크)이 없으면** `plan/complete/**` 에 영구히
    "미해결 항목이 남은 complete 문서"가 남는다.
  - 제안: 이 impl-done 라운드가 BLOCK: NO 로 수렴하면, `plan/complete/spec-draft-trigger-workflow-index.md`
    의 `- [ ] --impl-done` 을 `- [x] --impl-done spec/2-navigation/ — review/consistency/2026/09/18/13_16_03
    BLOCK: NO` 형태로 갱신하는 짧은 후속 커밋을 남길 것 (자매 plan과 동일 패턴). BLOCK: YES 라면 당연히
    `codebase/**`·spec 수정 후 재검토.

## 교차 확인한 항목 (정합 — 문제 없음)

- **트래커 반영 정확성**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "부모 삭제 경로의
  성능 후속" 항목(첫째 불릿 = V111 인덱스, 셋째 불릿 = `select: {id,type,config}` 좁히기)이 실제 diff와
  숫자까지 일치한다(`spec/1-data-model.md` Rationale 의 7.52→0.04ms·11.05→0.05ms 실측표가 트래커의
  ✅ 표시 문구와 동일). 둘째 불릿(순차 처리 지연)만 의도적으로 미해결로 남겼고, 그 사실이 트래커·draft
  양쪽에 일관되게 서술돼 있다 — 범위 축소가 아니라 정확한 부분 해소.
- **새 후속 항목 중복·충돌 없음**: 트래커에 신설된 "`workflow`·`workspace` FK 중 선두 인덱스가 없는 여섯"
  항목이 다른 `plan/in-progress/**` 어디에도 (grep 전수: `integration_usage_log` · `alert_rule.workflow_id` ·
  `auth_config.workspace_id` · `knowledge_base.workspace_id` · `integration_oauth_state` ·
  `integration_oauth_preview`) 중복 등재돼 있지 않다.
  또한 이 신규 인덱스 결정(`trigger.workflow_id` 단독 컬럼, V111 형태)에 대해 다른 in-progress plan 이
  다른 결론을 내리거나 "결정 필요"로 남겨둔 흔적이 없다.
- **migrations.md §5 콜아웃 재작성 충돌 없음**: 1라운드 코드리뷰가 "교체 전용 문장이라 지금도 참"으로
  처분했던 것을 draft(S4)가 뒤집었는데, 이 반전의 근거(2라운드 코드리뷰 WARNING)가 plan 안에 명시돼
  있고, 다른 `plan/in-progress/**` 문서 어디에도 이 문구를 "교체 전용으로 고정한다"는 별도의 미해결
  결정으로 붙잡고 있지 않다(전수 grep 0건). `spec/data-flow/8-notifications.md` 의 유사 문구는 draft가
  의도적으로 그대로 두기로 결정했고 근거(주어가 다르다 — 교체 이력 vs 일반 규칙)를 남겼다.
- **선행조건 충족**: draft가 전제하는 `trigger-resource-releaser.service.ts`(`releaseExternalForParent`)와
  stale 주석 정리는 이미 `plan/complete/trigger-deletion-release.md`·`plan/complete/trigger-release-stale-comments.md`
  로 봉인돼 있어 사전 조건 미해소 문제 없음.
  같은 파일을 `spec_impact` 로 갖는 다른 in-progress plan(`spec-draft-eia-62-waiting-payload.md` ·
  `spec-update-node-cancellation-shutdown-classification.md` · `spec-conventions-engine-error-code-surface.md` ·
  `harness-review-gate-followups.md`)은 `spec/1-data-model.md` 의 무관한 절(EIA §6.2 payload · `NodeExecution.status`
  enum · 엔진 인프라 코드 나열 · harness 토큰 계측)을 다뤄 섹션 단위 충돌이 없다.
- **인입 참조 정리**: `plan/in-progress/spec-draft-trigger-workflow-index.md`(옛 경로)를 가리키는 dangling
  참조가 `spec/`·`plan/`·`codebase/` 전체에 0건 — 이동 시 인입 참조 갱신 규칙을 지켰다.
- **V111 식별자 충돌 없음**: `codebase/backend/migrations/`에 `V111__trigger_workflow_id_index.{sql,conf}`
  단일 쌍만 존재, 다른 병렬 plan 이 같은 번호를 점유하지 않았다.

## 요약

`plan/in-progress/**` 이 이 target 변경과 충돌하는 미해결 결정을 갖고 있거나, 이 변경이 가정하는 선행
plan 이 미해소 상태이거나, 후속 항목이 누락된 사례는 찾지 못했다 — 트래커(`spec-draft-nullable-notation-followups.md`)의
반영은 숫자·범위 모두 실제 diff와 정확히 일치하고, 신규 후속 항목("FK 선두 인덱스 없는 여섯")도 중복·충돌
없이 등재됐다. 유일한 절차적 흠은 `plan/complete/spec-draft-trigger-workflow-index.md` 가 `--impl-done`
체크박스를 미체크로 둔 채 이미 `complete/` 로 이동한 것인데, 이는 impl-done 게이트가 커밋된 diff 위에서만
돌 수 있다는 구조적 제약과 맞물린 순서상의 문제일 뿐 — 이 세션 결과를 인용하는 짧은 후속 커밋으로
바로잡으면 자매 plan(`trigger-deletion-release.md`·`trigger-release-stale-comments.md`)과 동일한 형태로
수렴한다.

## 위험도

LOW
