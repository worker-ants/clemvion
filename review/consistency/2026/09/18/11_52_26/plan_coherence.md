# Plan 정합성 검토 — `spec/2-navigation/`

## 검토 개요

이 PR 은 `spec/2-navigation/` 자체를 변경하지 않는다(scope 델타 0개 파일, `spec_impact: none`). 실질 target 은 `codebase/backend/src/modules/{secret-store,triggers,workspaces}/**` 9개 파일 217줄의 **주석·메서드명 전용** 수정이며, 그 주석들이 인용하는 SoT 가 `spec/2-navigation/2-trigger-list.md §4.3`(2026-09-17 결정, 이미 머지된 e63a5bc5d)이므로 plan 정합성 관점에서는 "코드 주석이 이미 확정된 spec 결정·plan 트래커와 부합하는가" 를 검증했다.

## 대조 결과

1. **트래커 원본과 1:1 대조** — `plan/in-progress/spec-draft-nullable-notation-followups.md:4599-4609` 의 developer 항목("트리거 자원 정리 구현이 남긴 stale 주석·이름 네 곳", 2026-09-17 등재·`plan/complete/trigger-deletion-release.md` 리뷰 수렴 예외)이 요구하는 4곳과, `plan/in-progress/trigger-release-stale-comments.md` 의 실측표 1~4행이 정확히 일치한다. diff 의 실제 변경 파일(9개)도 이 plan 의 실측표 1~8행과 1:1 대응하며 범위 이탈이 없다.
2. **선행 --impl-prep 피드백 반영 확인** — 직전 impl-prep 세션(`review/consistency/2026/09/18/11_26_25`, BLOCK:NO)의 plan_coherence INFO#2("`teardownChannelConfig`→`teardownRegisteredChannel` 리네임 실측표가 실제 콜사이트보다 좁다 — `trigger-resource-releaser.service.ts`/`.spec.ts` 누락")가 이번 plan 문서의 실측표 4행에 이미 반영되어 있다(`trigger-resource-releaser.service.ts(호출 1) · trigger-resource-releaser.service.spec.ts(mock 1·이벤트 라벨)`). 실제 diff 도 두 파일 모두 포함한다.
3. **독립 plan 과의 교차 검증** — `plan/in-progress/backend-lint-gate-broken-on-main.md:211`(별도 worktree, 이미 체크 완료 항목)이 "2026-09-17 트리거 삭제 자원 정리 뒤 유일한 직접 호출부는 `trigger-resource-release.ts` 의 `deleteTriggerSecretsAfterCommit`" 이라고 독립적으로 이미 명시하고 있어, 이번 PR 이 `secret-resolver.service.ts` JSDoc 에 적는 동일 사실과 충돌 없이 부합한다.
4. **spec §4.3 과의 정합** — 번들에 실린 `spec/2-navigation/2-trigger-list.md §4.3`("트리거 행을 없애는 모든 경로는 그 트리거의 자원을 정리한다", 외부 자원=행 삭제 전/비밀=커밋 후 2단 시점 분리)이 diff 의 새 주석들(`trigger-config-lock.ts`, `triggers.service.ts`, `trigger-workflow-ref.e2e-spec.ts` 등)이 서술하는 순서·소유 관계와 어긋나지 않는다. `trigger-config-lock.ts` 변경은 이전에 두 차례 과대/과소 서술로 지적받았던 "소비자 목록 나열" 패턴을 버리고 "SoT 는 spec §4.3" 으로 위임하는 구조로 바뀌어, 향후 소비자 증가 시 재발(3번째 지적 대상이었던 결함 클래스)을 구조적으로 차단한다.
5. **미해결 결정 우회 여부** — `spec-draft-nullable-notation-followups.md` 전수 grep 결과 이 PR 이 건드리는 파일·주제(트리거 삭제 자원 정리, secret 삭제 시점, teardown 메서드명)에 대한 "결정 필요/TBD/미결정" 표시는 없다. 트리거 목록 spec 자체의 다른 미해결 항목(예: `chatChannelLastError` 원문 노출 미결 항목, 동시 중복 DELETE 감사 중복 등)은 이 PR 의 diff 범위와 무관하다.

## 발견사항

- **[INFO]** 트래커 종결 표시 미완료 — 절차적 후속, 차단 아님
  - target 위치: `plan/in-progress/trigger-release-stale-comments.md` 체크리스트 마지막 항목("트래커 항목 종결 표시 · 이 plan `complete/` 이동")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4599`
  - 상세: 이 PR 이 닫으려는 트래커 항목(4599행)이 아직 `[ ]` 상태로 남아 있다. `/ai-review`·`--impl-done` 완료 후 이 plan 을 `complete/` 로 옮길 때, 해당 트래커 행에도 같은 저장소 관례(예: 4460행대의 "✅ 2026-09-17 해소 — `plan/complete/<file>.md`" 패턴)대로 완료 주석을 남겨야 트래커가 stale 상태로 남지 않는다.
  - 제안: target(코드) 변경 아님 — plan 마무리 커밋 시 `spec-draft-nullable-notation-followups.md:4599` 행에 완료 표시 추가.

발견된 CRITICAL/WARNING 없음.

## 요약

이 PR 은 순수 주석·메서드명 정정이며, 그 내용이 인용하는 spec 결정(`2-trigger-list.md §4.3`, 2026-09-17)과 이를 등재한 공유 트래커(`spec-draft-nullable-notation-followups.md:4599`) 양쪽에 대해 항목 단위로 1:1 대조했을 때 어긋남이 없다. 직전 `--impl-prep` 라운드의 plan_coherence INFO 지적(리네임 실측표 협소)도 이번 plan 문서에 이미 반영되어 재발하지 않았고, 무관한 별도 plan(`backend-lint-gate-broken-on-main.md`)의 독립 실측과도 사실관계가 일치한다. 미해결 결정을 우회하거나 다른 plan 의 후속 항목을 무효화하는 정황은 발견되지 않았다.

## 위험도
NONE
