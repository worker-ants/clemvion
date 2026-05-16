# Plan 정합성 검토 — Phase 4 Cafe24 Node UX Overhaul

검토 대상: `spec/4-nodes/4-integration/4-cafe24.md` (§2 + §9.9 + CHANGELOG) + `plan/in-progress/cafe24-node-resource-operation-ux.md`
worktree: `cafe24-spec-buffer-cleanup-2b6e9c`
검토 시점: 2026-05-16

---

## 발견사항

### [CRITICAL] `spec/4-nodes/4-integration/4-cafe24.md` 를 동시에 수정하는 두 번째 worktree 존재

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` 전체 (§2, §9.3, §9.7, §9.9, CHANGELOG 포함)
- **관련 plan**: `plan/in-progress/` 에는 해당 worktree plan 이 명시되어 있지 않으나, `cafe24-spec-cleanup-f4d8e2` worktree가 동일 파일을 수정 중임이 git diff 로 확인됨
- **상세**: `git worktree list` 결과 `cafe24-spec-cleanup-f4d8e2` 브랜치(`claude/cafe24-spec-cleanup-f4d8e2`)가 활성 상태이고, `git diff main -- spec/4-nodes/4-integration/4-cafe24.md` 에서 해당 worktree가 §2 (편집 버퍼 줄 삭제), §9.3 (카탈로그 링크 재작성), §9.7 (scope 본문 이동 방식 변경), §9.9 (구 buffer-split Rationale 완전 삭제) 를 수정하고 있음. Phase 4 (`cafe24-spec-buffer-cleanup-2b6e9c`) 는 같은 파일의 §2와 §9.9를 다른 내용으로 재작성하고 있음.

  구체적 충돌 지점:
  - `cafe24-spec-cleanup-f4d8e2`: §9.9를 "내부 버퍼 분리" 구 Rationale 을 **삭제**하고 §9.7 scope 본문도 재배치함. §9.3 카탈로그 링크를 **단순화**(catalog 링크 제거, 설명 축약).
  - `cafe24-spec-buffer-cleanup-2b6e9c` (Phase 4): §9.9를 "(A) KeyValueEditor / (B) 메타데이터 기반 동적 폼" 두 안 비교로 **신규 작성**하고 §2의 편집 버퍼 줄을 다른 방식으로 처리함. §9.3 카탈로그 링크를 **보존**.

  두 worktree 모두 `spec/4-nodes/4-integration/4-cafe24.md` 를 서로 다른 방향으로 수정하고 있어 merge 시 실질적인 3-way conflict 가 발생한다.
- **제안**: Phase 4 PR 을 먼저 머지하거나, `cafe24-spec-cleanup-f4d8e2` 를 Phase 4 기준으로 rebase 한 후 충돌을 해소해야 한다. CLAUDE.md "공유 자원 직렬화" 정책에 따라 어느 쪽 plan 이 우선하는지 명시하고 한 쪽 작업을 일시 중단한다.

---

### [WARNING] `cafe24-node-resource-operation-ux.md` frontmatter 의 `worktree` 필드가 Phase 4 실제 worktree 와 불일치

- **target 위치**: `plan/in-progress/cafe24-node-resource-operation-ux.md` frontmatter 1–3행
- **관련 plan**: 동일 파일 (self-reference)
- **상세**: frontmatter 에 `worktree: cafe24-node-ux-catalog-4b8f2c (Phase 1) / cafe24-node-ux-impl-9d3e1a (Phase 2~)` 로 기재되어 있으나, Phase 4 의 실제 작업은 `cafe24-spec-buffer-cleanup-2b6e9c` worktree 에서 진행 중임. `git worktree list` 와 `cafe24-spec-buffer-cleanup-2b6e9c` 의 `git diff main` 이 이를 확인. Phase 3 frontmatter 항목(`cafe24-node-ux-frontend-f5a3b8`)도 merge 완료된 worktree임에도 여전히 기재되어 있다.

  CLAUDE.md 는 "frontmatter 의 `worktree` 필드는 동시 작업 추적과 worktree 충돌 검출에 사용된다"고 명시하므로 오기가 탐지 누락을 유발한다.
- **제안**: `cafe24-node-resource-operation-ux.md` frontmatter 를 `worktree: cafe24-spec-buffer-cleanup-2b6e9c` 로 갱신한다. 이미 merge 된 Phase 1~3 worktree 는 history 참고용 주석으로 처리하거나 제거한다.

---

### [WARNING] `cafe24-node-resource-operation-ux.md` 의 "Phase 4" 항목 내용이 plan 본문의 "Phase 4" 와 다름

- **target 위치**: `plan/in-progress/cafe24-node-resource-operation-ux.md` "Phase 4 — Coverage 확장" 절 (line 66–69)
- **관련 plan**: 동일 파일
- **상세**: plan 본문의 Phase 4 는 "Planned → Supported 전환 PR" 과 "사용자 피드백 통로" 를 범위로 정의하고 있다. 그러나 호출자 설명에 따르면 현재 PR (Phase 4) 의 실제 작업 범위는 "§2 + §9.9 + CHANGELOG 정리(spec cleanup)" 이며, "Planned → Supported 전환" 등은 `cafe24-followup-backlog.md` 로 defer 되었다. plan 의 "Phase 4" 절 내용이 실제 Phase 4 PR 작업과 맞지 않아, plan 을 읽는 다음 진입자가 Phase 4 가 무엇인지 혼동할 수 있다.
- **제안**: `cafe24-node-resource-operation-ux.md` 의 Phase 4 절을 현재 PR 의 실제 범위(§2/§9.9 spec cleanup)로 재기술하고, 원래 "Coverage 확장" 항목은 `cafe24-followup-backlog.md` 참조로 교체한다.

---

### [WARNING] `cafe24-spec-cleanup-f4d8e2` 에 대응하는 in-progress plan 이 `plan/in-progress/` 에 없음

- **target 위치**: `plan/in-progress/` 전체 목록
- **관련 plan**: `cafe24-spec-cleanup-f4d8e2` worktree (활성, `claude/cafe24-spec-cleanup-f4d8e2` 브랜치)
- **상세**: 활성 worktree `cafe24-spec-cleanup-f4d8e2` 가 `spec/4-nodes/4-integration/4-cafe24.md` 를 포함한 다수 spec 파일을 수정하고 있으나, `plan/in-progress/` 에 해당 worktree 를 `worktree:` 필드로 가리키는 plan 이 존재하지 않는다. `cafe24-spec-cleanup-f4d8e2` 내부의 `plan/in-progress/` 에는 `spec-update-cafe24-fields-ui-buffer.md` 가 있지만 frontmatter `worktree: (none)` 으로 기재되어 있어 충돌 탐지에서 누락된다. CLAUDE.md 규정상 모든 in-progress plan 은 `worktree` 필드를 명시해야 한다.
- **제안**: `cafe24-spec-cleanup-f4d8e2` 에서 진행 중인 spec 변경에 대한 plan 을 `plan/in-progress/` 에 생성(또는 기존 plan frontmatter 를 갱신)하여 worktree 필드를 `cafe24-spec-cleanup-f4d8e2` 로 설정한다.

---

### [INFO] `cafe24-node-resource-operation-ux.md` 의 미완 Phase 2/3 항목이 plan 에 잔존 — `complete/` 이동 불가 조건 확인

- **target 위치**: `plan/in-progress/cafe24-node-resource-operation-ux.md` Phase 2 체크리스트 (line 46–55) + Phase 3 체크리스트 (line 59–65)
- **관련 plan**: 동일 파일
- **상세**: Phase 2 의 백엔드 구현 체크박스 9개, Phase 3 의 프런트 체크박스 6개가 모두 미체크 상태다. 호출자 설명에서 Phase 3 은 PR #88 로 merge 됐다고 하나, plan 문서에서는 Phase 3 항목이 체크되어 있지 않다. Phase 2 항목도 별도 PR로 완료됐다면 plan 을 갱신해야 한다. CLAUDE.md 분류 기준상 미체크 체크박스가 하나라도 있으면 `in-progress/` 유지가 맞으므로 현재 위치는 올바르나, 실제 완료된 항목을 체크하지 않으면 plan 상태가 현실을 반영하지 못한다.
- **제안**: Phase 2/3 의 완료된 항목을 체크 처리하고, 아직 미완인 항목(Phase 4 consistency-check + plan-move 등)만 남긴 뒤 plan 의 현황을 반영한다.

---

### [INFO] `cafe24-followup-backlog.md` 가 두 worktree 에 동시 존재

- **target 위치**: `plan/in-progress/cafe24-followup-backlog.md` (양쪽 worktree 모두)
- **관련 plan**: `cafe24-backlog-e8a3b1` worktree + `cafe24-spec-buffer-cleanup-2b6e9c` worktree 양쪽 모두 동일 경로의 파일을 보유
- **상세**: `find` 결과 `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-backlog-e8a3b1/plan/in-progress/cafe24-followup-backlog.md` 와 `.../cafe24-spec-buffer-cleanup-2b6e9c/plan/in-progress/cafe24-followup-backlog.md` 가 내용 동일. Phase 4 PR 이 머지될 때 `cafe24-followup-backlog.md` 도 포함되므로, `cafe24-backlog-e8a3b1` 의 해당 파일과 merge conflict 가 발생할 수 있다. 두 worktree 가 같은 plan 파일을 소유하고 있어 단일 진실 원칙 위배.
- **제안**: `cafe24-followup-backlog.md` 의 정식 home 을 `cafe24-backlog-e8a3b1` 으로 지정하고, `cafe24-spec-buffer-cleanup-2b6e9c` 에서는 해당 파일을 삭제하거나 Phase 4 PR scope 외로 처리한다.

---

## 요약

Phase 4 spec-cleanup PR 은 `spec/4-nodes/4-integration/4-cafe24.md` 의 §2/§9.9 정리를 완료하여 §9.9 follow-up 루프를 닫는 적절한 작업이다. 그러나 같은 파일을 수정하는 `cafe24-spec-cleanup-f4d8e2` worktree 가 동시에 활성화되어 있고, 해당 worktree 의 §9.3 카탈로그 링크 삭제·§9.7 재배치·§9.9 완전 삭제 방향이 Phase 4 의 변경과 서로 다른 결론을 취하고 있어 merge 시 실질적인 3-way conflict 가 불가피하다 (CRITICAL). 또한 `cafe24-node-resource-operation-ux.md` frontmatter 의 worktree 필드가 Phase 1~3 기준으로 남아 있어 Phase 4 의 실제 작업 위치(`cafe24-spec-buffer-cleanup-2b6e9c`)를 탐지하지 못한다 (WARNING). Plan 본문의 Phase 4 절 내용이 실제 PR 범위와 다른 점, `cafe24-spec-cleanup-f4d8e2` 에 대응하는 plan 의 worktree 필드 누락, `cafe24-followup-backlog.md` 의 두 worktree 중복 존재도 정리가 필요하다. 이 중 CRITICAL 항목(동시 worktree 충돌)은 CLAUDE.md "공유 자원 직렬화" 정책에 따라 두 PR 의 작업 순서를 명시적으로 직렬화하기 전에는 해소되지 않는다.

## 위험도

HIGH
