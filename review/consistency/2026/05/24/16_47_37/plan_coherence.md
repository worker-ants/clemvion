# Plan 정합성 검토 결과

- 검토 모드: `--impl-prep` (구현 착수 전)
- Target: `spec/4-nodes/3-ai` (전체 디렉토리)
- 검토 시각: 2026-05-24
- 검토자: plan-coherence-checker

---

## 발견사항

### [CRITICAL] `apply-brand-logo-049314` worktree 가 동일 spec 파일들을 동시 수정 중

- **target 위치**: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/2-text-classifier.md`, `spec/4-nodes/3-ai/3-information-extractor.md`
- **관련 plan**: `plan/in-progress/form-resubmit-fix.md` — 본 worktree (`form-resubmit-fix-b1caa8`) 가 위 네 파일을 갱신 예정. 동시에 `claude/apply-brand-logo-049314` branch 도 `spec/4-nodes/3-ai/0-common.md` 및 `spec/4-nodes/3-ai/1-ai-agent.md` 를 수정 중 (frontmatter 제거 + 본문 일부 변경).
- **상세**: `git diff origin/main..claude/apply-brand-logo-049314` 결과, `apply-brand-logo` 브랜치가 `spec/4-nodes/3-ai/0-common.md` (frontmatter 6줄 제거, `output.error` details 필드 설명 단축), `spec/4-nodes/3-ai/1-ai-agent.md` (frontmatter 제거, §6.1.d.i-ii 본문 단축·cross-ref 제거), `spec/4-nodes/3-ai/2-text-classifier.md`, `spec/4-nodes/3-ai/3-information-extractor.md` 를 건드리고 있다. 본 worktree 는 이 파일들의 `§4.1 도구 카탈로그 표`, `§6.1.d.ii`, `§6.2 step 2.c`, `§12 Rationale` 절을 가드 필드 추가 내용으로 갱신하려 하므로, 두 브랜치 모두 main 에 없는 상태에서 같은 파일의 다른 라인을 편집한다. 머지 순서에 따라 충돌 또는 의미 손실 가능.
- **제안**: `apply-brand-logo-049314` 가 먼저 main 에 머지되면 본 worktree 가 rebase 후 진행. 또는 두 브랜치 간 순서 협의 후 재착수. 현재로서는 두 브랜치가 같은 파일을 동시에 편집하는 상태이므로 한쪽이 선행 머지되기 전까지 본 worktree 의 spec 파일 편집을 보류해야 한다.

---

### [WARNING] `ai-presentation-tools.md` plan 의 미완료 항목이 target spec 과 내용 불일치 유발 가능

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §4.1 `render_form` 행 `tool_result` 칸 현황
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` §4.1 체크박스
  - `spec/conventions/conversation-thread.md §1.2` — 미완 (`[ ]`)
  - `spec/5-system/6-websocket-protocol.md §4.4` — 미완 (`[ ]`)
  - `spec/5-system/14-external-interaction-api.md §6.5` — 미완 (`[ ]`)
  - `spec/conventions/node-output.md §4.5` — 미완 (`[ ]`)
- **상세**: `ai-presentation-tools.md` 는 결정 #16 에서 "presentations 의 SoT 는 ConversationTurn 의 top-level `presentations[]` 단일 위치" 로 명시했으나, 현재 target spec (`1-ai-agent.md §7.10`) 에는 `output.result.presentations[]` 가 "execution history page 복원용 echo" 로 추가되어 있다. 이는 plan 의 결정 #16 (`output.result.*` 에 echo 하지 않는다) 과 다른 방향의 결정이 이후 spec 에 반영된 상태다. 단, 이것은 plan 이후 사용자 승인으로 변경된 결정이므로 plan 자체의 미완료 체크박스들이 현행 target spec 과 얼마나 호환되는지 확인이 필요하다.
- **제안**: `ai-presentation-tools.md` 의 미완료 spec 갱신 항목 (`conversation-thread.md §1.2`, `websocket-protocol.md §4.4`, `external-interaction-api.md §6.5`, `node-output.md §4.5`) 이 현행 target spec 과 충돌하지 않는지 해당 항목 진행 전 재확인. 특히 결정 #16 과 `§7.10` 의 echo 정책 불일치가 후속 spec 갱신 시 혼동을 유발하지 않도록 plan 의 결정 #16 항목을 취소하거나 현행 spec 반영 내용으로 업데이트할 것.

---

### [WARNING] `multiturn-error-preserve.md` plan 의 `spec/4-nodes/3-ai/1-ai-agent.md` §7.9 갱신 항목이 target 현황과 기술적으로 정합하나 미완료 상태

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.9 (Multi Turn 오류 케이스), §7.4 `_resumeState` 비교 표, §7 서두 5필드 예외 목록
- **관련 plan**: `plan/in-progress/multiturn-error-preserve.md` 영향 spec 표
  - `spec/4-nodes/3-ai/1-ai-agent.md §7.4` — `_resumeState` / `_retryState` 비교 비고 추가 (본 PR 갱신 예정)
  - `spec/4-nodes/3-ai/1-ai-agent.md §7.9` — `_retryState` JSON 예시 + retryable 설명 추가 (본 PR 갱신 예정)
  - `spec/4-nodes/3-ai/1-ai-agent.md §10` — 에러 코드 표 retryable 분류 열 추가 (본 PR 갱신 예정)
  - `spec/4-nodes/3-ai/0-common.md §5` — `details.retryable` 필수 명시 (본 PR 갱신 예정)
- **상세**: 현행 target spec 에는 이미 `_retryState`, `retryable`, `retryAfterSec`, `LLM_RATE_LIMIT` 등이 반영되어 있다 (§7.9 JSON 예시, §10 에러 코드 표, §0-common §5 `details.retryable` 필수 명시 포함). `multiturn-error-preserve.md` 가 명시한 갱신 항목이 이미 spec 에 반영된 것으로 보인다. 단, plan 의 worktree 미할당 (`worktree: multiturn-error-preserve`) 상태이며, 관련 브랜치가 active worktree 목록에 없다 — 구현(codebase) 단계가 미착수일 가능성이 높다.
- **제안**: `multiturn-error-preserve.md` 의 spec 갱신 체크박스가 이미 main 에 반영되었는지 확인 후 해당 항목을 `[x]` 로 표기. 구현(codebase) 단계는 아직 진행 중임을 본 worktree 진입 전 확인하여 충돌 없음을 재확인.

---

### [WARNING] `ai-agent-tool-connection-rewrite.md` 미해결 결정이 target spec 의 §4 "재작성 예정" 박스와 연동

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §4 "재작성 예정 (현재 제거됨)" 경고 박스, §1 `toolNodeIds`/`toolOverrides` 비활성 언급
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 디자인 결정 — 도구 등록 모델 (a/b/c), 도구 시그니처 위치, 실행 컨텍스트, 결과 라우팅, ND-AG-21 규칙 전체 **TBD 미결**.
- **상세**: target spec 의 §4 "Tool Area 연동" 전체가 비활성 상태임이 명시되어 있고, plan 은 사용자 결정을 기다리는 중이다. 본 worktree 의 작업(`form-resubmit-fix`)은 §4 영역을 직접 건드리지 않으므로 충돌은 없다. 단, `multiturn-error-preserve.md` §의존성·리스크에서 "_resumeState schema 변경 시 `_retryState` 형식도 검토 필요"라고 명시되어 있고, `ai-agent-tool-connection-rewrite.md` 가 `_resumeState` schema 에 영향을 줄 수 있다는 점이 간접 위험.
- **제안**: 본 worktree 는 `§4` 영역을 건드리지 않으므로 즉시 차단 사유 없음. 단, tool_result 가드 필드 보강 후 `ai-agent-tool-connection-rewrite.md` 결정이 내려질 때 `_resumeState.pendingFormToolCall` 포함 여부 재검토 필요임을 plan 비고에 추가할 것.

---

### [INFO] `ai-presentation-tools.md` plan 의 `worktree: ai-presentation-tools-9b7c5c` — stale 판정 수행

- `claude/ai-presentation-tools-9b7c5c` 브랜치는 현재 active worktree 목록 (`ls .claude/worktrees/`) 에 없고, git branch 목록에도 해당 브랜치가 존재하지 않는다. plan 파일에는 `worktree: ai-presentation-tools-9b7c5c` 로 기록되어 있으나 실제 디렉토리가 부재하므로 이미 머지·정리된 worktree 로 판단.
- Step 1 (`git merge-base --is-ancestor`): 브랜치 자체가 없어 cascade 불가 → Step 2 수행 불가 → Step 3 fallback.
- 단, `ai-presentation-tools.md` spec 갱신 항목 중 `[x]` (완료)로 표기된 항목(`spec/4-nodes/3-ai/1-ai-agent.md` 갱신 포함) 이 실제 main 에 반영되어 있다는 점에서 해당 브랜치는 머지 완료로 추정. plan 내 미완료 (`[ ]`) 항목은 별도 followup 으로 남아있는 상태.

---

### [INFO] `ai-timezone-kst-e2e.md` — target spec 과 직접 충돌 없음

- `worktree: (pending assign)` 상태로 아직 worktree 미할당. target spec (`spec/4-nodes/3-ai`) 파일을 변경하지 않으며 codebase 테스트 전용이다. 관련 spec 필드(`includeSystemContext`, `systemContextSections`)는 target spec에 이미 §11로 포함되어 있음.
- 제안: 없음. 단순 추적 참고.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 검토 결과:

- `ai-presentation-tools-9b7c5c` (branch `claude/ai-presentation-tools-9b7c5c`) — Step 1: 브랜치 미존재로 ancestor 검사 불가. Step 2: `gh pr list` 대상 브랜치 없어 조회 불가. Step 3: fallback active 처리. 단, `.claude/worktrees/ai-presentation-tools-9b7c5c` 디렉토리 미존재 + plan의 `[x]` 항목이 main spec에 반영된 정황으로 실질적으로 정리된 worktree로 추정. stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 `./cleanup-worktree-all.sh --yes --force` 실행 후 재검토 권장. 단, 디렉토리가 이미 없으므로 cleanup 스크립트 실행 전 branch 존재 여부 재확인.

active worktree 충돌 후보 (CRITICAL 분류된 건):
- `apply-brand-logo-049314` (branch `claude/apply-brand-logo-049314`) — Step 1: `ACTIVE` (origin/main 의 조상 아님). Step 2 불필요. **active 확정** → CRITICAL 분류.

worktree 충돌 후보 총 2건 중 stale 로 확정된 건 0건, active 1건 분석.

---

## 요약

target 영역 `spec/4-nodes/3-ai` 는 현재 **`claude/apply-brand-logo-049314`** 브랜치가 동시에 `0-common.md`, `1-ai-agent.md`, `2-text-classifier.md`, `3-information-extractor.md` 를 수정하고 있어 CRITICAL 충돌이 있다. 두 브랜치가 같은 파일의 다른 라인을 편집하므로 자동 머지 충돌이 발생하거나, 나중에 머지되는 브랜치가 상대방의 변경을 덮어쓸 위험이 있다. 본 worktree 의 spec 편집은 `apply-brand-logo-049314` 가 main 에 머지된 후 rebase 하거나, 두 브랜치의 편집 순서를 명시적으로 협의한 뒤 진행해야 한다. 그 외 WARNING 2건은 `ai-presentation-tools.md` 미완료 항목의 현행 spec 적합성 재확인 및 `multiturn-error-preserve.md` spec 갱신 완료 여부 확인 요청이며 즉각 차단 사유는 아니다. worktree 충돌 후보 2건 중 stale 확정 0건, active 1건(apply-brand-logo) 분석됨.

---

## 위험도

**HIGH**

> `apply-brand-logo-049314` active worktree 가 동일 spec 파일 4개를 편집 중이며 CRITICAL 경합이 확인됨. 구현 착수(spec 편집) 전 반드시 해소 필요.
