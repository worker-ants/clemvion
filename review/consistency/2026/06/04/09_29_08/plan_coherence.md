# Plan 정합성 검토 결과

검토 모드: --impl-done (구현 완료 후)
Target spec 영역: `spec/4-nodes/3-ai/`
분석 기준: `plan/in-progress/**` 진행 중 plan 전체

---

## 발견사항

### [CRITICAL] spec/4-nodes/3-ai/1-ai-agent.md 동일 파일 동시 수정 — active worktree 경합

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §1 (config 표), §6.1/§6.2 (실행 로직), §7 (출력 구조, Config echo 정책)
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` — frontmatter `worktree: ai-context-memory-9c7e6e`
- **상세**:
  - `persistent-enhance-32f236` (현재 target worktree) 과 `ai-context-memory-9c7e6e` (PR #459, OPEN, active) 가 `spec/4-nodes/3-ai/1-ai-agent.md` 에 동시에 수정을 가하고 있다.
  - 두 worktree 의 diff 를 비교한 결과 **겹치는 편집 범위**가 다음과 같이 구체적으로 식별된다:
    - §1 config 표: `contextScope`/`contextScopeN`/`contextInjectionMode`/`includeToolTurns`/`excludeFromConversationThread` 5행 설명 문구 + `memoryStrategy`/`memoryTokenBudget`/`memoryKey`/`memoryTopK`/`memoryThreshold` 신규 행 — 두 worktree 모두 동일 영역을 편집 (내용은 대부분 일치하나 `ai-context-memory-9c7e6e` 에는 `memoryTtlDays` 행이 없고 `persistent-enhance-32f236` 에 추가됨)
    - §2 설정 UI ASCII 다이어그램 Memory 섹션 추가 — 두 worktree 모두 동일 영역 편집
    - §6.1 실행 로직 step 1.3 / 1.5 / 2.7 — 두 worktree 모두 편집 (내용은 대부분 일치하나 `persistent-enhance-32f236` 의 2.7 에 "증분 추출(watermark)" + "kind 분류" + "의미 dedup" 내용이 추가되어 있음)
    - §6.2 d.5/d.6 — 두 worktree 모두 편집
    - §7 Config echo 정책 — `persistent-enhance-32f236` 이 `memoryTtlDays` 를 열거에 추가
  - **경합 위험**: PR #459 가 main 에 먼저 머지되면 `persistent-enhance-32f236` 의 spec 변경과 충돌하는 merge conflict 가 발생한다. 반대의 경우에도 동일.
  - `ai-context-memory-9c7e6e` 는 Step 1 (git merge-base --is-ancestor) 결과 ACTIVE, Step 2 (gh pr list) 결과 PR #459 `OPEN` → stale 아님, CRITICAL 유지.
- **제안**: `ai-context-memory-9c7e6e` (PR #459) 가 base 가 되어야 하는지, `persistent-enhance-32f236` 이 PR #459 위에 rebase 해야 하는지 결정 필요. 또는 PR #459 를 먼저 머지한 뒤 `persistent-enhance-32f236` 에서 rebase + spec 충돌 해소 후 진행하는 순서화가 권장된다.

---

### [CRITICAL] spec/5-system/17-agent-memory.md 동일 파일 동시 수정

- **target 위치**: `spec/5-system/17-agent-memory.md` 전체 (신규 파일 — 두 worktree 모두 신규 생성)
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` — frontmatter `worktree: ai-context-memory-9c7e6e`
- **상세**:
  - `ai-context-memory-9c7e6e` 는 `17-agent-memory.md` 를 신규 생성하며 기본 persistent 메모리 spec (테이블 구조, 스코프 키, 추출/회수 파이프라인)을 작성했다 (114 diff lines 추가).
  - `persistent-enhance-32f236` 은 동일 파일을 더 확장하여 AGM-08 (증분 추출 watermark), AGM-09 (의미기반 dedup), AGM-10 (TTL 만료), AGM-11 (추출 kind 분류) 등 v2 surface 를 반영한 152 diff lines 로 작성되어 있다.
  - 두 worktree 가 같은 파일을 다른 내용으로 신규 생성하는 상태 — 머지 시 충돌 확정.
- **제안**: `persistent-enhance-32f236` 의 `17-agent-memory.md` 는 PR #459 의 버전을 base 로 그 위에 v2 항목을 추가한 형태여야 한다. PR #459 를 먼저 머지하고 `persistent-enhance-32f236` 에서 rebase 후 v2 전용 추가분만 남기는 방식으로 정리 필요.

---

### [CRITICAL] spec/conventions/conversation-thread.md 동일 파일 동시 수정

- **target 위치**: `spec/conventions/conversation-thread.md`
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` — frontmatter `worktree: ai-context-memory-9c7e6e`
- **상세**:
  - `persistent-enhance-32f236` 과 `ai-context-memory-9c7e6e` 가 모두 `spec/conventions/conversation-thread.md` 를 수정하고 있다. `persistent-enhance-32f236` 은 `§6.2 d.6` 의 물리 압축(compactedMessages) 반영과 요약/추출 관련 변경을 포함하며, `ai-context-memory-9c7e6e` 도 동일 파일을 편집한다 (`runningSummary`, `summarizedUpToSeq` 등 기초 spec 반영). 두 worktree 의 변경이 같은 섹션에 겹쳐 있어 충돌 위험이 있다.
- **제안**: 위 CRITICAL 1·2 와 동일한 순서화 (PR #459 선행 머지 후 rebase) 로 해소.

---

### [WARNING] `ai-context-memory-followup-v2.md` 의 v2 surface — target 에서 일부 항목만 구현 반영됨

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 d.6, §7 Config echo, `spec/5-system/17-agent-memory.md` §3·§4 등
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` §미구현 surface (v2)
- **상세**:
  - `ai-context-memory-followup-v2.md` 에는 v2 surface 로 7개 항목이 열거되어 있다. 그 중 `persistent-enhance-32f236` 이 구현·반영한 항목은 멀티턴 물리 압축 (✅), 증분 추출 + dedup (✅), TTL 만료 (✅), 추출 분류 kind (✅) — 4건이다.
  - 미구현 상태인 3건 (메모리 가시화 UI, text_classifier/information_extractor inject 확장, tokenizer-exact 토큰 카운트) 은 `ai-context-memory-followup-v2.md` 에 `[ ]` 로 남아 있으며, `persistent-enhance-32f236` 의 spec/코드도 이 항목들을 건드리지 않는다. 따라서 **충돌은 없다**.
  - 단, 4건 구현 완료 항목의 `[x]` 체크박스 갱신이 **`ai-context-memory-9c7e6e` worktree 에만 반영된 상태**이며, plan/in-progress 의 main 파일(`/Volumes/project/private/clemvion/plan/in-progress/ai-context-memory-followup-v2.md`)은 PR #459 머지 후에야 갱신될 것이다. 현재 `persistent-enhance-32f236` 은 plan 파일을 직접 편집하지 않으므로 plan 상태와 구현 상태 간 임시 불일치가 존재한다.
- **제안**: PR #459 머지 후 plan 파일이 main 에 반영되면 자동 해소. 별도 plan 갱신 불필요.

---

### [WARNING] `spec/4-nodes/3-ai/0-common.md` 동일 파일 동시 수정

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` §10 (Conversation Context), §11.4 (ordering)
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` — frontmatter `worktree: ai-context-memory-9c7e6e`
- **상세**:
  - 두 worktree 가 `0-common.md` 에 동일 크기의 변경(각 61 diff lines)을 가하고 있다. §10 memoryStrategy 관련 설명 추가 및 §11.4 ordering 표 갱신이 겹친다.
  - 내용이 거의 동일하게 수렴하는 것으로 보이나 (두 diff의 라인 수가 동일), 머지 시 conflict resolver 가 필요한 상황이다.
- **제안**: CRITICAL 항목과 동일한 순서화로 해소.

---

### [INFO] `ai-agent-tool-connection-rewrite.md` — 미해결 결정과 무충돌 확인

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §4 (Tool Area), §6.1 step 3a dispatcher 분류 순서
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md`
- **상세**:
  - `ai-agent-tool-connection-rewrite.md` 의 "결정 기록" 섹션은 도구 등록 모델·시그니처 위치·실행 컨텍스트 등 5개 항목이 TBD 로 미해결 상태다.
  - `persistent-enhance-32f236` 의 spec 변경은 이 TBD 항목들(`tool_*` 관련 설계, Tool Area UX 등)에 대해 **일방적 결정을 내리지 않는다**. `§4 Tool Area` 는 여전히 "재작성 예정 (현재 제거됨)" 박스로 비활성 상태이며 target 도 이를 그대로 유지한다.
  - `§6.1 step 3a` dispatcher 분류 순서 표에 `render_*` 가 추가되어 있으나 이는 `ai-presentation-tools.md` plan 에서 이미 결정된 항목이고 `tool_*` 재작성 결정과 직교한다.
  - 충돌 없음.

---

### [INFO] `spec/conventions/node-output.md` — 단독 수정, 타 plan 과 무경합

- **target 위치**: `spec/conventions/node-output.md`
- **관련 plan**: 해당 파일을 수정하는 다른 active plan 없음
- **상세**: `persistent-enhance-32f236` 이 `node-output.md` 를 수정하고 있으나, 동일 파일을 수정하는 다른 active worktree 가 확인되지 않는다. 경합 위험 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보를 아래의 cascade 로 판정한 결과:

| worktree | branch | Step 1 (ancestor) | Step 2 (PR state) | 판정 |
|---|---|---|---|---|
| `ai-context-memory-9c7e6e` | `claude/ai-context-memory-9c7e6e` | ACTIVE (exit 1) | PR #459 `OPEN` | **ACTIVE** — CRITICAL 분류 유지 |

stale 으로 skip 한 worktree: **0건**

---

## 요약

`persistent-enhance-32f236` 이 구현 완료한 AI Agent persistent 메모리 v2 surface (증분 추출·의미 dedup·TTL·kind 분류·멀티턴 물리 압축) 는 `ai-context-memory-followup-v2.md` plan 에서 예정된 항목들을 정확하게 구현하고 있으며, 미해결 결정 항목(`ai-agent-tool-connection-rewrite.md` TBD 5건)과의 충돌은 없다. 그러나 이 worktree 가 수정하는 spec 파일들 (`spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/17-agent-memory.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/conventions/conversation-thread.md`) 이 OPEN PR #459 (`claude/ai-context-memory-9c7e6e`, `ai-context-memory-followup-v2.md` plan, ACTIVE) 와 동일하게 수정 중이어서 **3건 CRITICAL + 1건 WARNING 의 worktree 경합 위험**이 존재한다. `persistent-enhance-32f236` 의 변경은 PR #459 의 변경을 superset 으로 포함하므로, PR #459 를 먼저 main 에 머지한 뒤 `persistent-enhance-32f236` 을 rebase + 충돌 해소하는 순서화가 필수다. worktree 충돌 후보 1건 모두 ACTIVE (stale skip 0건).

---

## 위험도

**CRITICAL**
