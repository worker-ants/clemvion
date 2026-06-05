# Plan Coherence — memory-backlog-grooming

worktree: `memory-backlog-a2-fe9c8f`
branch: `claude/memory-backlog-a2-fe9c8f`
diff base: `7afa9ae0` (main HEAD at analysis time: `9f30216f`)
검토일: 2026-06-05

---

## CRITICAL

없음.

---

## WARNING

### [WARNING] `ai-context-memory-followup-v2.md` 체크박스 3건 미동기

- **target 위치**: `plan/in-progress/ai-context-memory-followup-v2.md` lines 41, 42, 46
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` §미구현 surface (v2)
- **상세**:
  - `[ ] 메모리 가시화 UI` (line 41) — `agent-memory-admin-ui.md` 의 A1 작업이 PR #471 로 main 머지 완료 (2026-06-05). 체크박스 미갱신.
  - `[ ] 요약/추출 전용 저비용 모델 옵션` (line 46) — `agent-memory-summary-model.md` 의 A3 작업이 PR #473 으로 main 머지 완료. `ai-context-memory-auto.md §3.1` 의 scope-freeze 결정도 번복 공식 완료됨. 체크박스 미갱신.
  - `[ ] text_classifier / information_extractor 자동 주입 확장` (line 42) — `grooming plan §보류` 에서 "A2 — 별도 feature PR" 로 명시 보류됨. 현재 어떤 worktree 에서도 클레임되지 않은 상태이나, PR #475(main HEAD: information_extractor 멀티턴 checkpoint) 가 일부 surface 를 건드림. 명시적 상태 갱신 없이 방치.
  - `followup-v2.md` 는 PR #462 이후 main 에서 업데이트되지 않았고, A1·A3 PR 머지 후에도 체크박스가 열린 채 유지됨 — 후속 항목 누락.
- **제안**: `followup-v2.md` 의 위 항목을 실제 상태에 맞게 갱신:
  - line 41 (`메모리 가시화 UI`) → `[x]` 체크 + "2026-06-05 구현 완료 — PR #471" 주석 추가.
  - line 46 (`요약/추출 전용 저비용 모델 옵션`) → `[x]` 체크 + "2026-06-05 구현 완료 — PR #473 (A3)" 주석 추가.
  - line 42 (`text_classifier/information_extractor 확장`) → "(grooming plan 명시 보류 — 별도 feature PR, A2)" 인라인 메모 추가.
  - 또는 본 grooming PR 머지 후 project-planner 가 `followup-v2.md` 를 일괄 정합화.

---

### [WARNING] `ai-context-memory-auto.md §3.1` 확정 결정이 현 구현과 불일치(번복 미기록)

- **target 위치**: `plan/in-progress/ai-context-memory-auto.md` §3.1, §1(확정된 설계 결정)
- **관련 plan**: `plan/in-progress/agent-memory-summary-model.md` §결정 근거
- **상세**:
  - `ai-context-memory-auto.md §3.1` "요약 LLM 콜 모델 = v1 노드 `model`/`llmConfigId` 재사용 (scope-freeze, 신규 필드 없음)" 이 확정 결정으로 남아 있음.
  - `agent-memory-summary-model.md` 가 의도적으로 이를 번복해 `summaryModel`/`extractionModel` 2필드를 신설, PR #473 으로 main 머지 완료.
  - 결정 번복 자체는 `agent-memory-summary-model.md §결정 근거` 에 명시됐으나, `ai-context-memory-auto.md` 의 해당 항목에 번복 사실이 역참조되지 않아, 이 plan 을 SoT 로 읽는 독자가 현재 구현과 다른 결정을 사실로 오인할 수 있음.
- **제안**: `ai-context-memory-auto.md §3.1` 의 해당 bullet 에 "(A3 PR #473 에서 번복됨 — `summaryModel`/`extractionModel` 별도 필드 도입. 상세: `agent-memory-summary-model.md`)" 주석 추가. plan/complete 이동 시 함께 처리 가능.

---

## INFO

### [INFO] grooming plan A3(embeddingModel widget) 와 PR #467 동일 파일 수정 — rebase 충돌 가능성

- **target 위치**: `plan/in-progress/memory-backlog-grooming.md` §항목 A3
- **상세**: grooming worktree commit `06335914` 이 `ai-agent.schema.ts` 의 `embeddingModel` widget 을 `'text'`→`'expression'` 으로 수정함. PR #467 (`feat(ai-agent): 메모리 임베딩 모델 선택`) 도 동일 파일을 수정한 것으로 확인됨 (diff에서 `ai-agent.schema.ts` 변경 포함). `7afa9ae0` 은 #475 기준이므로 #467 은 이미 main 에 포함 — grooming 브랜치가 `git rebase origin/main` 없이 PR 을 열면 충돌 가능성 있음.
- **제안**: PR 열기 전 `git rebase origin/main` 실행 후 `ai-agent.schema.ts` 충돌 여부 확인. #467 이 이미 해당 widget 변경을 포함한다면 grooming commit A3 를 drop 하거나 중복 제거 후 squash.

### [INFO] `agent-memory-admin-ui.md` / `agent-memory-summary-model.md` plan/complete 이동 누락

- **target 위치**: `plan/in-progress/agent-memory-admin-ui.md`, `plan/in-progress/agent-memory-summary-model.md`
- **상세**: 두 plan 모두 PR MERGED(#471, #473). `plan/complete/` 이동 미완료. `plan-lifecycle.md` 규약 위반 상태.
- **제안**: grooming PR 머지 후 project-planner 가 두 파일을 `plan/complete/` 로 이동.

### [INFO] grooming plan §보류 의 A2(text_classifier/information_extractor 확장)가 `followup-v2.md` 에 역참조 없음

- **target 위치**: `plan/in-progress/memory-backlog-grooming.md` §보류
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` line 42~44
- **상세**: grooming plan 이 A2 보류를 선언했으나 `followup-v2.md` 의 해당 항목에 역참조 메모 없음. 추적 단절 위험.
- **제안**: `followup-v2.md` line 42 에 "(A2 grooming plan 보류 — 별도 feature PR)" 한 줄 추가.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

| worktree 디렉토리 | branch | stale 판정 단계 | 근거 |
|---|---|---|---|
| `agent-memory-embedding-model` | `claude/agent-memory-embedding-model` | Step 1 (ancestor) | branch HEAD `fb23297c` 가 origin/main 조상, 브랜치에 main 미포함 커밋 0건 |
| _(worktree 없음)_ | `claude/agent-memory-admin-ui-455467` | Step 2 (PR state) | PR #471 `state=MERGED` (squash merge — Step 1 통과 못함) |
| _(worktree 없음)_ | `claude/agent-memory-summary-model-fa4efb` | Step 2 (PR state) | PR #473 `state=MERGED` (squash merge — Step 1 통과 못함) |

`agent-memory-embedding-model` 워크트리 디렉토리가 `/Volumes/project/private/clemvion/.claude/worktrees/agent-memory-embedding-model` 에 남아 있음. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`memory-backlog-grooming.md` picking 항목(A1 listScopes perf, A3 embeddingModel widget, B3 경계 테스트)은 각각 고유한 범위를 가지며 현재 active worktree 와의 직접 충돌은 없다. CRITICAL 없음. 주요 위험은 두 가지: (1) `ai-context-memory-followup-v2.md` 에서 A1·A3 완료 체크박스가 PR 머지 이후에도 갱신되지 않아 후속 항목 누락 상태(WARNING); (2) grooming A3 commit 이 #467 과 동일 파일을 수정해 rebase 시 충돌 가능성(INFO). worktree 충돌 후보 3건 중 stale 3건 skip, active 0건 분석.

---

## 위험도

LOW

---

BLOCK: NO
