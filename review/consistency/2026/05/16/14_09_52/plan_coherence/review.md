# Plan Coherence Review — cafe24-coverage-order-phase5a

검토 시각: 2026-05-16  
검토 대상: `plan/in-progress/cafe24-coverage-order-phase5a.md`  
변경 파일: `backend/src/nodes/integration/cafe24/metadata/order.ts`, `planned.ts`, `spec/conventions/cafe24-api-catalog/order.md`, `spec/conventions/cafe24-api-catalog/_overview.md`

---

### 발견사항

- **[WARNING]** Phase 5a 가 참조하는 "PR #87 backlog plan" 이 Coverage 확장 트랙을 포함하지 않음
  - target 위치: `cafe24-coverage-order-phase5a.md` L9 — "`plan/in-progress/cafe24-followup-backlog.md` (PR #87) 의 '`planned → supported` 전환' 트랙의 첫 묶음"
  - 관련 plan: `plan/in-progress/cafe24-followup-backlog.md` 전체 (A-1, B-1~B-5, C-1 만 존재 — 80 lines)
  - 상세: `cafe24-followup-backlog.md` 은 보안·동시성·API 계약·DB·테스트·운영 점검 백로그만 담고 있으며 "Coverage 확장" (`planned → supported` 전환) 트랙은 한 줄도 없다. Coverage 확장은 `cafe24-node-resource-operation-ux.md` Phase 5+ 에 위임 항목으로 언급되어 있고, 해당 plan 이 backlog 으로 참조하는 문서이기는 하나 backlog plan 자체에 추적 항목이 존재하지 않는다.
  - 제안: Phase 5a plan 의 도입부 서술을 "`cafe24-node-resource-operation-ux.md` Phase 5+ (Coverage 확장 별 트랙)" 또는 "별도 Coverage 확장 트랙" 으로 정정하거나, `cafe24-followup-backlog.md` 에 Coverage 확장 섹션(예: "D. Coverage 확장 — planned → supported 전환")과 Phase 5a 를 첫 sub-plan 으로 추가해 추적 고리를 완성한다.

- **[WARNING]** `cafe24-node-resource-operation-ux.md` 이 Phase 4 완료 후에도 `plan/complete/` 로 이동되지 않음
  - target 위치: 직접 영향 없으나, Phase 5a 가 이 plan 의 Phase 5+ 항목을 이어받는 구조이므로 관련됨
  - 관련 plan: `plan/in-progress/cafe24-node-resource-operation-ux.md` Phase 4 체크리스트 — `[ ] consistency-check (--spec)` / `[ ] 본 plan 을 plan/complete/ 로 이동` 미체크
  - 상세: PR #90 (`cafe24-spec-buffer-cleanup-2b6e9c`) 이 origin/main 에 머지되어 Phase 4 의 spec 수정은 완료됐으나, 잔여 두 체크박스(consistency-check 세션 실행, git mv to complete) 가 미처리인 채 plan 이 in-progress 에 남아 있다. Phase 5+ 를 별 트랙으로 이어받은 Phase 5a 가 존재하는 시점에 부모 plan 이 in-progress 에 남아 있으면 혼동을 준다.
  - 제안: `cafe24-node-resource-operation-ux.md` 의 Phase 4 마무리 체크박스 2건을 처리(consistency-check 세션 실행 후 `git mv` to complete) 한 뒤, Phase 5+ 항목은 `cafe24-followup-backlog.md` 또는 별도 Coverage 트랙 plan 으로 이전한다.

- **[INFO]** 복수의 stale worktree 가 `git worktree list` 에 잔존하나 Phase 5a 와 직접 경합 없음
  - target 위치: 해당 없음 (worktree 목록 전반)
  - 관련 plan: `cafe24-backlog-e8a3b1`, `cafe24-node-ux-frontend-f5a3b8`, `cafe24-spec-buffer-cleanup-2b6e9c` 등 — 모두 origin/main 대비 0 commits ahead (이미 머지됨)
  - 상세: 14개 worktree 중 실제로 origin/main 보다 앞서 있는 것은 `cafe24-hmac-raw-fix-b8e2d1`(+1), `cafe24-test-connection-2d7fa4`(+1), `integration-attention-filter-053b74`(+5) 3개다. 이 3개가 건드리는 파일은 각각 `spec/2-navigation/4-integration.md` · `spec/4-nodes/4-integration/4-cafe24.md` (hmac), `cafe24-api.client.ts` / `integrations.service.ts` (test-connection), `integrations.service.ts` / `integration.dto.ts` / frontend integration 페이지 (attention-filter) 이며, Phase 5a 가 수정하는 4개 파일(`order.ts`, `planned.ts`, `order.md`, `_overview.md`) 과 겹치는 것이 없다. worktree 직렬화 조치는 불필요하나, 머지 완료된 stale worktree 를 정리하면 향후 검출 노이즈를 줄일 수 있다.
  - 제안: 머지 완료된 worktree 를 `git worktree remove` 로 정리 (CLAUDE.md 운영 규칙 준수). 우선 순위 낮음, Phase 5a PR 과 무관.

- **[INFO]** Phase 5a plan 에 `cafe24-followup-backlog.md` 의 Coverage 확장 섹션 링크 미설정
  - target 위치: `cafe24-coverage-order-phase5a.md` §후속 (다음 PR 들) 섹션
  - 관련 plan: `cafe24-followup-backlog.md` (현재 Coverage 확장 항목 부재)
  - 상세: Phase 5a 의 "후속" 섹션이 "다른 Order endpoint", "Product / Customer 등 핵심 resource" 를 언급하지만, 어느 plan 에서 추적할지가 명시되지 않았다. 현재 구조에서는 후속 Coverage PR 들의 추적 위치가 불분명하다.
  - 제안: 후속 섹션에 추적 plan 경로(`cafe24-followup-backlog.md` 또는 신규 `cafe24-coverage-backlog.md`)를 명시한다.

---

### 요약

Phase 5a plan 의 frontmatter(`worktree`, `started`, `owner`), 범위 정의, 수용 기준은 모두 명확하고 측정 가능하다. worktree 경합 위험은 없다 — 동일 파일(`order.ts`, `planned.ts`, `order.md`, `_overview.md`)을 다루는 다른 활성 worktree 가 존재하지 않는다. 주요 정합 이슈는 두 가지다. 첫째, Phase 5a 가 자신의 출처로 참조하는 `cafe24-followup-backlog.md` 에 Coverage 확장 트랙이 실제로는 없어 추적 고리가 끊겨 있다. 둘째, Phase 4 완료 후 `cafe24-node-resource-operation-ux.md` 가 아직 `plan/complete/` 로 이동되지 않아 in-progress 에 잔존하며 Phase 5+ 위임의 맥락이 흐릿하다. 두 항목 모두 작업 차단 수준은 아니나 plan 의 계보를 명확히 하기 위해 조치 권장.

---

### 위험도

LOW
