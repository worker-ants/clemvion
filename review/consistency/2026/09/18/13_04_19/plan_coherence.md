# Plan 정합성 검토 — `plan/in-progress/spec-draft-trigger-workflow-index.md`

## 발견사항

없음 — CRITICAL·WARNING 대상 없음.

## 확인한 항목 (참고용 INFO)

- **선행 트래커 상태 일치**: 이 draft 가 닫는다고 주장하는 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  의 «부모 삭제 경로의 성능 후속» 항목(줄 4590)은 실제로 아직 `- [ ]`(미체크) 상태이고, 본문 세 불릿(인덱스 부재·
  순차 처리 지연·`select` 좁히기)이 draft 의 실측·처리 범위와 정확히 대응한다. draft 의 "트래커 반영" 절이
  둘째 불릿(순차 처리 지연)은 **의도적으로 남긴다**고 명시했고, 트래커 원문도 별개 이슈로 서술되어 있어
  범위 축소가 아니라 정확한 부분 해소다.
- **S4 되돌림의 근거**: `spec/conventions/migrations.md` §5 콜아웃에 대한 1라운드 RESOLUTION 처분("교체에
  한정된 문장이라 지금도 참" — `review/code/2026/09/18/12_43_23/RESOLUTION.md`)을 draft 의 S4 가 뒤집는데,
  이는 2라운드 코드리뷰(`review/code/2026/09/18/12_54_44/SUMMARY.md` WARNING 2)가 새로 지적한 오독 위험에
  근거한 것으로, plan 문서 어디에도 이 문구를 "교체 전용으로 고정한다"는 별도의 미해결 결정이나 합의가
  없다 — 즉 이 반전은 다른 plan 이 정한 미해결 결정을 우회하는 것이 아니라 같은 PR 안의 정상적인 리뷰
  라운드 재조정이다.
- **현재 시점 상태**: `spec/conventions/migrations.md` §5 콜아웃은 이 시점까지 실제로 수정되지 않았다(git
  log 상 해당 절 최신 커밋은 `90c1751e8`, 이번 브랜치 무관). draft 의 체크리스트도 `/ai-review`·`--impl-done`·
  `트래커 반영 · complete/ 이동`을 모두 미체크로 남겨 두고 있어, S4 가 "제안"이지 "이미 반영됨"으로
  잘못 서술되어 있지는 않다. 미해결 상태와 서술이 일치한다.
- **FK 카탈로그 교차검증**: draft 의 "선두 인덱스 없는 FK 7개" 목록(workflow: trigger/integration_usage_log/
  alert_rule, workspace: auth_config/knowledge_base/integration_oauth_state/integration_oauth_preview)을,
  이미 종결된 형제 plan 항목(`spec-draft-nullable-notation-followups.md` "trigger-config advisory lock" 5b,
  workflow CASCADE 대상 4테이블: trigger·integration_usage_log·alert_rule·**workflow_test_dataset**)과
  대조했다. `workflow_test_dataset` 은 `workflow_id`/`workspace_id` 둘 다 CASCADE 지만 각각
  `uq_workflow_test_dataset_owner_name (workflow_id, owner_id, name)`·
  `idx_workflow_test_dataset_workspace_visibility (workspace_id, visibility)` 로 이미 선두 인덱스를
  갖고 있어(`V097__workflow_test_dataset.sql` 확인) draft 의 7개 목록에서 정당하게 빠져 있다 — 두 문서가
  서로 다른 관점(CASCADE 다이어그램 vs 선두 인덱스 부재)에서 같은 테이블군을 다뤘지만 결론이 충돌하지
  않는다.
- **새 트래커 항목 중복 없음**: draft 가 추가하려는 "«workflow·workspace FK 중 선두 인덱스가 없는 여섯»
  (developer + planner)" 항목이 다른 `plan/in-progress/**` 문서(예: `deps-guard-hardening.md`,
  `harness-review-gate-followups.md` 등)에 이미 별도로 등재돼 있는지 `integration_usage_log`·
  `alert_rule.workflow_id`·`auth_config.workspace_id`·`knowledge_base.workspace_id`·
  `integration_oauth_state`·`integration_oauth_preview` 로 전수 grep — 이 draft 문서 자신과
  `spec-draft-nullable-notation-followups.md`(위 5b, 무관한 CASCADE 다이어그램 맥락) 외에는 0건.
  중복 생성이 아니다.
- **spec/1-data-model.md §3 편집 충돌 없음**: 같은 파일을 `spec_impact` 로 갖는 다른 진행 중 plan
  (`spec-draft-eia-62-waiting-payload.md`, `spec-update-node-cancellation-shutdown-classification.md`,
  `spec-conventions-engine-error-code-surface.md`, `harness-review-gate-followups.md`)은 §3 인덱스 표나
  트리거 관련 Rationale 이 아니라 각각 EIA §6.2 payload·`NodeExecution.status` enum·엔진 인프라 코드
  나열·harness 토큰 계측 등 무관한 절을 다룬다 — 섹션 단위 편집 충돌 없음.
- **선행 조건 충족**: draft 가 전제하는 `trigger-resource-releaser.service.ts` 의
  `releaseExternalForParent`/`lockParentAndListTriggerIds` (선례 `plan/complete/trigger-deletion-release.md`,
  `#1346`)와 stale 주석 정리(`plan/complete/trigger-release-stale-comments.md`)는 모두 이미 `complete/` 로
  봉인되어 있어 이 draft 가 가정하는 사전 조건은 해소된 상태다.

## 요약

`plan/in-progress/**` 범위에서 이 draft 와 충돌하는 미해결 결정, 미해소 선행조건, 또는 누락된 후속 항목을
찾지 못했다. 유일하게 검토 대상이 된 "1라운드 처분 번복"(S4)은 다른 plan 이 정한 결정을 우회하는 것이
아니라 이 PR 자체의 2라운드 코드리뷰 피드백에 따른 자기 정정이며, 트래커·형제 plan 과의 교차 대조에서도
불일치가 발견되지 않았다. 트래커 반영(첫째·셋째 불릿 닫기, 여섯 FK 신규 항목)은 아직 실행 전이지만 draft
체크리스트가 이를 정확히 미완으로 표시하고 있어 서술과 상태가 어긋나지 않는다.

## 위험도

NONE
