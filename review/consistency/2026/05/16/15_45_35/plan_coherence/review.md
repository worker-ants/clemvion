# Plan 정합성 Review

**대상**: `plan/in-progress/spec-draft-cafe24-request-envelope.md`
**Worktree**: `cafe24-envelope-spec-b8d2e4`
**검토 시점**: 2026-05-16

---

## 발견사항

### 발견사항 없음 — 정합성 이상 없음

아래는 검토 항목별 결과이다.

---

### [INFO] cafe24-spec-buffer-cleanup-2b6e9c 가 4-cafe24.md 를 수정 완료 — 충돌 없음 확인

- target 위치: Draft #2 §4 step 8/9, §4.2 신설, §9.10 신설 (spec-draft-cafe24-request-envelope.md 전체)
- 관련 plan: `plan/in-progress/cafe24-node-resource-operation-ux.md` Phase 4 (worktree: `cafe24-spec-buffer-cleanup-2b6e9c`)
- 상세: `cafe24-node-resource-operation-ux.md` Phase 4 가 `spec/4-nodes/4-integration/4-cafe24.md` 를 수정하는 worktree(`cafe24-spec-buffer-cleanup-2b6e9c`)에서 작업 중이다. Phase 4 체크리스트를 확인하면 §2 와 §9.9 를 수정 완료(체크됨)했으나, `consistency-check (--spec)` 세션과 `plan/complete/` 이동은 미체크 상태다. 즉 해당 worktree 는 아직 PR 이 merge 되지 않은 상태일 수 있다. 그러나 target 이 추가하는 절은 §4 step 8/9(기존 step 의 부연), §4.2(신규 소절), §9.10(신규 Rationale)으로, Phase 4 가 수정한 §2, §9.9 와 **직접 겹치지 않는다**. 또한 `cafe24-spec-buffer-cleanup-2b6e9c` worktree 의 실제 diff(git worktree list + diff main..HEAD 확인 결과)에서 `spec/conventions/cafe24-api-metadata.md` 는 수정되지 않았고, `4-cafe24.md` 수정 내용도 §9.8 HMAC 알고리즘·§9.9·§2 범위에 한정된다.
- 판단: WORKTREE 경합 위험은 있으나 수정 절(section)이 서로 다르므로 git merge 시 자동 해결 가능한 수준. **단, Phase 4 의 미완 항목(consistency-check, git mv)이 먼저 완료되어야 target 이 추가하는 §9.10 이 최신 베이스라인에 온전히 붙는다.**
- 제안: `cafe24-spec-buffer-cleanup-2b6e9c` PR 이 main 에 merge 된 후 target worktree(`cafe24-envelope-spec-b8d2e4`)를 rebase 해서 §9.10 삽입 위치(§9.9 다음)를 안전하게 확보하는 것을 권장한다. plan 의 "후속" 절에 이 직렬화 조건을 명시하면 좋다.

---

### [INFO] spec-update-cafe24-request-envelope.md(인계 노트)와 target draft 의 역할 분리는 명확

- target 위치: spec-draft-cafe24-request-envelope.md 서두 "인계 노트: plan/in-progress/spec-update-cafe24-request-envelope.md"
- 관련 plan: `plan/in-progress/spec-update-cafe24-request-envelope.md` (worktree: `cafe24-request-envelope-fix-a1b2c3` — git worktree list 상 현재 미존재, PR #102 머지 완료로 정리된 것으로 추정)
- 상세: 인계 노트(`spec-update-cafe24-request-envelope.md`)는 코드 fix(PR #102) 후 project-planner 에 spec 갱신을 위임하기 위해 작성된 문서다. target draft 는 그 위임을 받아 구체적인 spec 변경안을 담은 문서로, 역할 분리가 명확하다. 두 문서 모두 in-progress 에 있으며, 후속 절("spec 본문 반영 완료 시 두 문서 모두 complete 로 이동")이 일치한다.
- 제안: 추적 메모 수준. 코드 fix worktree(`cafe24-request-envelope-fix-a1b2c3`)가 git worktree list 에 없으므로 PR #102 머지·worktree 정리가 완료된 상태임을 확인 완료.

---

### [INFO] cafe24-api-metadata.md §4 번호 이동 — 다른 plan 의 §4 링크 영향 확인

- target 위치: Draft #1 §4 신설 — 기존 §4–§7 을 §5–§8 로 일괄 번호 이동
- 관련 plan: `plan/in-progress/cafe24-node-resource-operation-ux.md` Phase 1 체크리스트 (§9.3 + `cafe24-api-metadata.md` §4 — 카탈로그 링크)
- 상세: Phase 1 체크리스트에 `spec/conventions/cafe24-api-metadata.md` §4(신규 endpoint 추가 절차, 현행 번호) 에 카탈로그 링크를 추가한 항목이 체크 완료(`[x]`)로 표시되어 있다. target 이 §4 앞에 Wire-format 규약 절을 삽입하면 기존 §4 가 §5 로 밀려나므로, Phase 1 이 추가한 §4 의 anchor 링크(`#4-신규-endpoint-추가-절차` 등)가 깨질 수 있다. 단, 이 anchor 가 다른 spec 문서에서 직접 링크로 참조되는지는 별도 확인이 필요하다.
- 제안: target spec 반영 시 `spec/conventions/cafe24-api-metadata.md` 의 anchor 가 변경되므로, `spec/4-nodes/4-integration/4-cafe24.md` 의 cafe24-api-metadata 링크와 `spec/conventions/cafe24-api-catalog/_overview.md` 의 동일 링크를 함께 갱신해야 한다. target draft 의 "영향 받지 않는 문서" 절이 `cafe24-api-catalog/` 는 endpoint 목록만 다룬다고 명시했으나, `_overview.md` 의 §4 anchor 링크 포함 여부는 반영 시 교차 확인 권장.

---

## 요약

Plan 정합성 관점에서 target(`spec-draft-cafe24-request-envelope.md`)은 다른 in-progress plan 과의 미해결 결정 충돌이나 worktree 직접 경합 없이 적절하게 설계되어 있다. `cafe24-node-resource-operation-ux.md` Phase 4(worktree `cafe24-spec-buffer-cleanup-2b6e9c`)가 동일 파일(`spec/4-nodes/4-integration/4-cafe24.md`)을 수정 중이나, 수정 절이 겹치지 않아 merge 충돌 가능성은 낮다. target 의 `cafe24-api-metadata.md` 절 번호 이동(§4 신설로 §4–§7 → §5–§8)이 Phase 1 이 추가한 anchor 링크에 영향을 줄 수 있으므로, spec 반영 시 관련 anchor 를 일괄 갱신하는 것을 권장한다. 전반적으로 plan 의 설계·범위·후속 처리 방침은 다른 진행 중 plan 과 정합하다.

## 위험도

LOW
