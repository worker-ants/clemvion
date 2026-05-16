# Plan 정합성 검토 — spec-draft-cafe24-cleanup.md

검토 대상: `plan/in-progress/spec-draft-cafe24-cleanup.md` (worktree: `cafe24-fields-spec-update-e7a3f2`)
검토 일시: 2026-05-16

---

### 발견사항

- **[WARNING]** CHANGELOG §10 항목에 드롭된 변경 3이 여전히 기재됨
  - target 위치: target 문서 `## CHANGELOG 추가 (§10)` 섹션
  - 관련 plan: 없음 (target 내부 불일치)
  - 상세: 변경 3 (§5 Case 번호 연속화)은 "변경 3 — **드롭 (의도된 컨벤션)**" 으로 적용하지 않기로 결정했다. 그러나 `## CHANGELOG 추가 (§10)` 에 기록된 항목 문구에는 "§5 Case 번호 연속화 (5.1·5.3·5.8 → 5.1·5.2·5.3)"가 그대로 남아 있어 실제로 적용되지 않은 변경이 CHANGELOG 에 기록된다. spec 본문에 반영 후 CHANGELOG 를 그대로 복사하면 잘못된 history 가 만들어진다.
  - 제안: target 문서의 CHANGELOG 항목에서 "§5 Case 번호 연속화 (5.1·5.3·5.8 → 5.1·5.2·5.3)" 부분을 제거하고, §5 Case 번호 불연속이 의도된 컨벤션임을 간략히 기재하거나 삭제한다.

- **[WARNING]** `user-guide-sync-2026-05-16.md` 의 위임 항목 W4 가 target 결론과 충돌 — plan 갱신 누락
  - target 위치: target 문서 `## 변경 3 (선택)` 섹션 (§5 Case 번호 연속화 드롭 결론)
  - 관련 plan: `plan/in-progress/user-guide-sync-2026-05-16.md` 후속 (spec 갱신 위임) 항목 `spec/4-nodes/4-integration/4-cafe24.md` §5 섹션 번호 불연속 정리 (W4)
  - 상세: `user-guide-sync-2026-05-16.md` (worktree: `user-guide-sync-4af69c`) 는 `review/consistency/2026/05/16/08_22_34/SUMMARY.md` W4 를 근거로 "§5 섹션 번호 불연속 정리" 를 project-planner 에 위임된 미해결 항목으로 남겨두었다. target 의 변경 3은 cross-node 컨벤션 조사 결과 이 번호 체계가 의도된 것임을 확인해 false positive 로 판정하고 드롭한다. 그러나 `user-guide-sync` plan 의 해당 위임 항목이 아직 업데이트되지 않아, 다른 작업자가 이 항목을 다시 처리 시도할 가능성이 있다.
  - 제안: target 의 spec 반영 완료 후 `user-guide-sync-2026-05-16.md` 의 W4 위임 항목에 "false positive 확인 — cross-node 컨벤션이므로 변경 불필요. `spec-draft-cafe24-cleanup.md` 참고" 주석을 추가해 중복 처리를 방지한다.

- **[WARNING]** `spec-update-cafe24-app-url-reuse.md` 의 미완 spec 갱신과 동일 파일 병렬 편집 위험
  - target 위치: target 문서 `## 영향 범위` — `spec/4-nodes/4-integration/4-cafe24.md` 1건
  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`) 후속 `[ ] spec 갱신` 항목 — `spec/4-nodes/4-integration/4-cafe24.md` §9.4 install_token 소거 표기 갱신 포함
  - 상세: `spec-update-cafe24-app-url-reuse.md` 는 `[ ] spec 갱신` 항목이 아직 미체크 상태이며, 그 안에 `spec/4-nodes/4-integration/4-cafe24.md` §9.4 의 install_token 소거 표기 갱신이 포함된다. target 도 같은 파일의 §9 Rationale 영역(§9.7 위치 정정, §9.9 신설)을 편집한다. 두 편집이 서로 다른 worktree(`cafe24-app-url-reuse-f9a2e3` vs `cafe24-fields-spec-update-e7a3f2`)에서 동시에 진행될 경우 merge 충돌이 발생할 수 있다. 현재 `spec-update-cafe24-app-url-reuse` 의 spec 갱신이 아직 착수되지 않은 상태라면 경합 위험은 낮지만, 작업 순서 명시가 없다.
  - 제안: target plan 의 `## 영향 범위` 또는 작업 항목에 "`spec-update-cafe24-app-url-reuse.md` 의 §9.4 spec 갱신 완료 이후 착수 권장 (§9 영역 병렬 편집 회피)" 를 명시한다. 또는 두 plan 이 같은 시점에 진행된다면 단일 PR 로 병합을 검토한다.

- **[INFO]** 위임 plan `spec-update-cafe24-fields-ui-buffer.md` worktree 미기재 — 현재 target 이 적절히 인수
  - target 위치: target 문서 `## 배경` — "위임 plan: `plan/in-progress/spec-update-cafe24-fields-ui-buffer.md`"
  - 관련 plan: `plan/in-progress/spec-update-cafe24-fields-ui-buffer.md` (worktree: `(none — project-planner 진입 시 새 worktree)`)
  - 상세: 위임 plan 은 frontmatter 에 `worktree: (none ...)` 으로 미기재 상태이나, target 이 `cafe24-fields-spec-update-e7a3f2` 에서 이를 인수해 작업하고 있어 정합하다. 위임 plan 의 체크리스트 `[ ] project-planner 가 spec/4-nodes/4-integration/4-cafe24.md 에 한 줄 추가` 가 target 의 변경 1 로 대응됨을 확인.
  - 제안: target 의 작업 항목 완료 후 `spec-update-cafe24-fields-ui-buffer.md` 를 `plan/complete/` 로 이동할 때 위임 체크박스도 함께 처리 표시한다.

- **[INFO]** `cafe24-spec-cleanup-f4d8e2` 워크트리의 `spec-draft-cafe24-spec-cleanup.md` 는 다른 파일 편집
  - target 위치: target 문서 전체 (대상 파일: `spec/4-nodes/4-integration/4-cafe24.md`)
  - 관련 plan: `.claude/worktrees/cafe24-spec-cleanup-f4d8e2/plan/in-progress/spec-draft-cafe24-spec-cleanup.md` (worktree: `cafe24-spec-cleanup-f4d8e2`)
  - 상세: `cafe24-spec-cleanup-f4d8e2` 는 `spec/0-overview.md` §6.2·§6.3 과 `spec/1-data-model.md` §2.19 만 편집한다. target 이 수정하는 `spec/4-nodes/4-integration/4-cafe24.md` 와 파일이 겹치지 않으므로 직접 충돌 위험은 없다.
  - 제안: 추적 메모 수준. 두 plan 이 같은 시점에 PR 을 올리더라도 파일이 분리되어 있어 merge 충돌 가능성 없음.

---

### 요약

target plan(`spec-draft-cafe24-cleanup.md`)은 `spec-update-cafe24-fields-ui-buffer.md` 위임을 정상적으로 인수했고, 변경 1·2 는 다른 plan 과 직접 충돌하는 미해결 결정이 없다. 다만 세 가지 정합성 문제가 발견된다. 첫째, CHANGELOG §10 항목에 드롭된 변경 3(§5 Case 번호 연속화)이 잘못 기재되어 있어 spec 반영 전 수정이 필요하다. 둘째, `user-guide-sync-2026-05-16.md` 가 동일 이슈(§5 번호 불연속)를 project-planner 위임 미완 항목으로 남겨두어, cross-node 컨벤션 확인 결과를 해당 plan 에 반영하지 않으면 중복 처리 시도가 생길 수 있다. 셋째, `spec-update-cafe24-app-url-reuse.md`(worktree: `cafe24-app-url-reuse-f9a2e3`)의 미완 spec 갱신이 동일 파일 §9 영역을 대상으로 하므로, 두 worktree 의 편집이 겹칠 경우 merge 충돌 위험이 있다. 위 세 항목 중 CHANGELOG 불일치(WARNING 1)는 spec 반영 전에 반드시 교정해야 한다.

---

### 위험도

MEDIUM
