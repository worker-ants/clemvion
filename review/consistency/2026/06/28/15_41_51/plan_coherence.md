# Plan 정합성 검토 결과

검토 범위: `spec/5-system/` (diff-base `origin/main`, impl-done 모드)
변경 파일: `spec/5-system/12-webhook.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`

---

## 발견사항

### [WARNING] spec-sync-webhook-gaps 계획 완료 후 plan 이동 및 spec frontmatter 미갱신

- **target 위치**: `spec/5-system/12-webhook.md` — frontmatter `status: partial`, `pending_plans: [plan/in-progress/spec-sync-webhook-gaps.md]`
- **관련 plan**: `plan/in-progress/spec-sync-webhook-gaps.md` — 3개 항목 전부 `[x]` (WH-EP-07 비활성 chatChannel 202 분기 / WH-EP-05-2 400 필드 목록 / WH-NF-02 1MB 게이트) 완료
- **상세**: `spec-sync-webhook-gaps.md` 의 모든 체크박스가 이 PR 에서 `[x]` 처리됐다. `.claude/docs/plan-lifecycle.md §2` 는 "모든 체크박스 `[x]` + 미해결 follow-up 0건이 되는 PR 안에 `chore(plan): mark <name> complete` 형태의 별 commit 으로 `complete/` 이동" 을 강제하며, plan 이동만 담은 별 PR 을 금지한다. 그러나 이 PR 은 plan 을 `in-progress/` 에 그대로 두고 있다. 아울러 `12-webhook.md` frontmatter 의 `status: partial` 및 `pending_plans` 참조도 갱신되지 않아 spec 이 stale 로 남는다.
- **제안**: 동일 PR 에서 (1) `plan/in-progress/spec-sync-webhook-gaps.md` → `plan/complete/spec-sync-webhook-gaps.md` 로 이동, (2) `spec/5-system/12-webhook.md` frontmatter 의 `status` 를 `partial` → `implemented` 로 갱신하고 `pending_plans` 항목을 제거해야 한다.

---

## 요약

이번 target 변경(`spec/5-system/12-webhook.md` · `2-api-convention.md` · `3-error-handling.md`)은 `plan/in-progress/spec-sync-webhook-gaps.md` 에서 미결로 남아 있던 WH-NF-02 인증 webhook 1MB 게이트 결정(옵션 C)을 구현 완료 후 spec 에 반영한 것으로, 미해결 결정과의 충돌(관점 1)이나 다른 plan 의 선행 조건 미해소(관점 2)는 없다. 단, 모든 항목이 완료된 `spec-sync-webhook-gaps.md` 가 `in-progress/` 에 잔류하고 있고 `12-webhook.md` 의 `pending_plans` · `status` 가 미갱신된 점이 plan-lifecycle 규약(`plan-lifecycle.md §2`)과 어긋난다. 이는 plan 이동 누락 패턴으로 WARNING 에 해당하며, 현행 PR 안에서 plan 이동 + spec frontmatter 정정으로 해소해야 한다.

---

## 위험도

LOW
