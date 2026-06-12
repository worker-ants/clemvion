## 검토 모드
구현 완료 후 검토 (--impl-done, scope=spec/conventions/)

## 대상 변경 요약

본 PR (`chat-channel-followups-batch-de949d`) 의 `spec/conventions/` 내 실제 변경 파일:
- `spec/conventions/error-codes.md` — §5 Rename 이력에 `WORKSPACE_REQUIRED → WORKSPACE_ID_REQUIRED` 항목 추가 + preamble "외부 노출" 문구 정확화.

`spec/conventions/cafe24-api-catalog/` 파일군(prompt payload 에 대량 포함)은 본 PR 에서 변경 없음 — 이미 main 에 존재하는 파일로 일관성 검토 컨텍스트로만 포함됨.

---

## 발견사항

충돌·차단 수준의 이슈 없음.

- **[INFO]** `fix-spec-frontmatter-catalog` 플랜 미이동 (완료 실질, `in-progress/` 잔류)
  - target 위치: 해당 없음 (본 PR 변경 무관)
  - 관련 plan: `plan/in-progress/fix-spec-frontmatter-catalog.md` — 모든 체크박스 완료, `/ai-review --impl-done BLOCK:NO` 확인(2026-06-03)
  - 상세: 플랜의 모든 작업 항목이 `[x]` 상태이나 `plan/complete/` 로 이동되지 않음. `cafe24-api-catalog` 필드 카탈로그 파일이 spec-frontmatter guard 에서 정상 제외 처리됨을 확인. 본 PR 변경(`error-codes.md`)과 직접 충돌 없음.
  - 제안: `plan/in-progress/fix-spec-frontmatter-catalog.md` 를 `plan/complete/` 로 이동. 본 PR 범위 밖이므로 차단 아님.

- **[INFO]** `cafe24-backlog-residual.md` G-1-remaining / G-3 잔여 항목 — `spec/conventions/cafe24-api-catalog/` 와 연관
  - target 위치: 해당 없음 (본 PR 는 `error-codes.md` 만 변경)
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` — G-1-remaining(field-set 확장), G-3b/c/d/e/f/h/i/j/l(DECIDE 미처리)
  - 상세: 본 PR 는 `cafe24-api-catalog/` 파일을 변경하지 않으므로 이들 항목과 직접 충돌 없음. G-1-remaining 착수 시 `cafe24-api-catalog/<resource>/<entity>.md` 파일을 수정하게 되는데, 해당 워크트리(`cafe24-backlog-residual-batch`)는 실제 git worktree 로 체크아웃되어 있지 않아 물리적 경합 없음.
  - 제안: 상태 메모 수준. G-1-remaining 착수 시 별도 worktree 배정 확인.

- **[INFO]** `exec-park-durable-resume.md` — `error-codes.md §3` 관련 언급 있음
  - target 위치: `spec/conventions/error-codes.md §5`
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` — "W3(`error-codes.md §3` skipReason scope 경계) = PR-B1 범위 밖, 후속"
  - 상세: 해당 플랜의 W3 는 `error-codes.md §3`(에러 코드 카탈로그 본문)에 대한 미결 polish 이며, 본 PR 변경 범위인 `§5 Rename 이력` 과 섹션이 다르다. 두 변경은 서로 다른 섹션을 손대므로 머지 충돌 가능성은 낮으나, W3 후속 작업자는 `§3` 수정 시 `§5` 갱신 여부를 별도 확인할 필요 없음 (직교).
  - 제안: 추적 메모. W3 후속 PR 에서 `error-codes.md §3` 만 수정하면 됨.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

- `cafe24-backlog-residual-batch` (plan frontmatter 기재) — git worktree 로 체크아웃 없음 (git worktree list 에 미존재). Step 1 cascade 불필요 — 물리적 경합 없음. SKIP (no active worktree).
- `fix-spec-frontmatter-catalog` (plan frontmatter 기재) — git worktree 로 체크아웃 없음 (git worktree list 에 미존재). SKIP (no active worktree).
- `code-node-cleanup-45ffef` (git worktree list 에서 확인된 유일한 타 active worktree) — `spec/conventions/` 를 손대는지 확인 불필요. 플랜명으로 보아 code-node 구현 트랙이며, `spec/conventions/error-codes.md` 와 영역 비중첩.

worktree 충돌 후보 2건 중 stale/no-active-checkout 2건 skip, active 경합 0건 분석.

---

## 요약

본 PR 의 `spec/conventions/` 내 실제 변경은 `error-codes.md §5` 에 `WORKSPACE_REQUIRED → WORKSPACE_ID_REQUIRED` rename 이력 1행 추가 뿐이다. 이 변경과 충돌하는 미해결 결정, 동일 파일을 손대는 active worktree, 또는 이 변경이 무효화하는 선행 plan 항목은 없다. `cafe24-backlog-residual.md` G-1-remaining 이 `cafe24-api-catalog/` 파일 대량 수정을 예고하지만 본 PR 는 해당 파일군을 변경하지 않아 경합 없다. worktree 충돌 후보 2건 모두 active git worktree 없음으로 경합 제외. 상태 정보성 INFO 3건 외 차단 항목 없음.

---

## 위험도
NONE
