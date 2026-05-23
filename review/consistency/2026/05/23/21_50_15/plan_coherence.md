# Plan 정합성 검토 — ai-presentation-form-inline

검토 대상: `plan/in-progress/ai-presentation-form-inline.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-23

---

## 발견사항

### [WARNING] `ai-presentation-tools.md` 미완료 체크박스와 동일 spec 파일 중복 손질

- target 위치: `plan/in-progress/ai-presentation-form-inline.md` §4.1 Spec 갱신 전체
- 관련 plan: `plan/in-progress/ai-presentation-tools.md` §4.1 의 4개 미완료 항목:
  - `[ ]` `spec/conventions/conversation-thread.md` §1.2 갱신
  - `[ ]` `spec/5-system/6-websocket-protocol.md` §4.4 갱신
  - `[ ]` `spec/5-system/14-external-interaction-api.md` §6.5 갱신
  - `[ ]` `spec/conventions/node-output.md` §4.5 갱신
- 상세: `ai-presentation-tools.md` plan 은 위 4개 항목을 `[ ]` (미완료) 로 표기하고 있으나, 실제로는 PR #269 (MERGED, 2026-05-22) 에서 해당 파일들이 이미 수정됐다. plan 문서 자체가 갱신되지 않아 미완료 외관을 띠고 있을 뿐이다. 실제 spec 파일을 확인하면:
  - `spec/conventions/conversation-thread.md §1.2` — `presentations?: PresentationPayload[]` 행이 이미 존재 (line 42)
  - `spec/5-system/6-websocket-protocol.md §4.4` — `ai_form_render`, `conversationConfig.pendingFormToolCall: {toolCallId}` 이미 반영
  - `spec/conventions/node-output.md` — PR #269 파일 목록에 포함
  따라서 target plan 은 이미 갱신된 spec 파일 위에 추가 변경을 더하는 것이며 실제 충돌 위험은 낮다. 단, `ai-presentation-tools.md` 의 `[ ]` 표기가 "미완료 작업이 진행 중인 worktree 에 있는 것처럼" 오해될 수 있어 정합 혼란 원인이 된다.
- 제안: `ai-presentation-tools.md` 의 4개 `[ ]` 항목을 `[x]` 로 갱신 후 plan 을 `plan/complete/` 로 이동. target plan 진행 전 이 정리를 선행하거나, 최소한 target plan 착수 전 `ai-presentation-tools.md` 가 사실상 완료됐음을 plan 에 명시.

---

### [WARNING] WS spec §4.4 `formConfig` 위치 결정과 기존 spec 의 충돌 가능성

- target 위치: `plan/in-progress/ai-presentation-form-inline.md` §2.7 및 §4.1 마지막 항목 (`spec/5-system/6-websocket-protocol.md §4.4 formConfig 행 본문 정정`)
- 관련 plan: `plan/in-progress/ai-presentation-tools.md` §2 결정사항 #12, #13
- 상세: target plan §2.7 은 `ai_form_render` 케이스의 `formConfig` 를 `conversationConfig.pendingFormToolCall.formConfig` 안으로 nest 하겠다고 결정한다. 현재 WS spec §4.4 (line 334) 는 `formConfig` 를 `interactionType = form 또는 ai_form_render` 시 top-level 에 두고 있다. `ai-presentation-tools.md` §4.1 `[ ]` WS spec 갱신 항목은 `pendingFormToolCall?: {toolCallId}` 만 명시하고 `formConfig` 위치 변경은 언급하지 않는다. 따라서 target plan 이 일방적으로 `formConfig` 위치를 재정의하는 셈이다. 그러나 frontend 코드가 이미 `pendingFormToolCall.formConfig` 를 읽고 있고 (target plan §1.2 에서 직접 언급), target plan 이 code-first 현실을 spec 에 반영하는 것이므로 방향 자체는 올바르다. 단, 이 결정이 `ai-presentation-tools.md` 결정사항 목록과 명시적으로 연결되지 않아 추적 단절이 있다.
- 제안: `ai-presentation-form-inline.md` §4.1 WS spec 항목에 "이 변경은 `ai-presentation-tools.md` §2 결정 #12/#13 의 spec drift 후속 정리" 임을 cross-ref 한 줄 추가.

---

### [WARNING] `conversation-thread.md §9.7` 에 `resumeFromAiRenderForm` store action 누락

- target 위치: `plan/in-progress/ai-presentation-form-inline.md` §4.4 (`lib/stores/execution-store.ts` `resumeFromAiRenderForm` 신규 action)
- 관련 plan: 없음 (현재 spec `§9.7.1` 표)
- 상세: target plan 은 `resumeFromAiRenderForm` 신규 store action 을 추가한다. `spec/conventions/conversation-thread.md §9.7.1` 표에는 lifecycle 액션별 reset 정책이 명시돼 있고 `resumeFromForm` / `resumeFromButtons` / `resumeFromConversation` 이 이미 있다. target plan §4.1 에서 `spec/conventions/conversation-thread.md §9.7` 에 `waiting_for_input (interactionType=ai_form_render)` 행을 신설한다고 명시하지만, §9.7.1 표에 `resumeFromAiRenderForm` 의 reset 정책 (입력 affordance reset: ✅, conversation snapshot reset: ❌) 을 추가하는 것이 누락되어 있다. 이 행 없이는 spec §9.7.1 이 불완전하다.
- 제안: `ai-presentation-form-inline.md §4.1 spec/conventions/conversation-thread.md` 항목에 "§9.7.1 표에 `resumeFromAiRenderForm` 행 추가 (입력 affordance reset: ✅, conversation snapshot reset: ❌)" 를 명시.

---

### [INFO] `ai-presentation-tools.md` plan 문서 미갱신 — stale 상태

- target 위치: `plan/in-progress/ai-presentation-tools.md` (참조 관계)
- 관련 plan: `plan/in-progress/ai-presentation-tools.md`
- 상세: `ai-presentation-tools.md` 의 worktree `ai-presentation-tools-9b7c5c` 는 PR #269 (MERGED), #271 (MERGED) 으로 모두 완료됐다. 그러나 plan 문서의 §4.1~§4.4 체크박스 다수가 여전히 `[ ]` 로 남아 있다. 이는 plan 이 `plan/complete/` 로 이동되지 않은 상태이며, 현재 `plan/in-progress/` 안에 있어 "진행 중" 으로 오인될 수 있다.
- 제안: `ai-presentation-tools.md` 를 `plan/complete/` 로 `git mv` 이동. target plan 진행과 병렬로 처리 가능.

---

### [INFO] `multiturn-error-preserve.md` plan 문서 미갱신 — stale 상태

- target 위치: `plan/in-progress/multiturn-error-preserve.md` (참조 관계)
- 관련 plan: `plan/in-progress/multiturn-error-preserve.md` (worktree: `multiturn-error-preserve`)
- 상세: PR #289 (MERGED, 2026-05-23) 가 `spec/conventions/conversation-thread.md`, `spec/5-system/6-websocket-protocol.md` 등 target plan 이 손대는 동일 파일들을 수정했다. `multiturn-error-preserve.md` plan 문서는 `plan/in-progress/` 에 잔류해 있으나 branch 자체가 삭제됐다. spec 파일 변경이 이미 main 에 반영됐으므로 target plan 은 최신 spec baseline 위에서 작업 가능하다.
- 제안: `multiturn-error-preserve.md` 를 `plan/complete/` 로 이동.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

| worktree | branch | 판정 |
|---|---|---|
| `ai-presentation-tools-9b7c5c` (plan frontmatter — 물리 디렉토리 없음) | `claude/ai-presentation-tools-9b7c5c` | Step 2: PR #269, #271 모두 `MERGED` — **stale** |
| `harness-plan-bundle-1b9221` | `claude/harness-plan-bundle-1b9221` | Step 1: ACTIVE → Step 2: PR #294 `MERGED` — **stale** |
| `plan-coherence-stale-worktree-fix-0e2222` | `claude/plan-coherence-stale-worktree-fix-0e2222` | Step 2: PR #290 `MERGED` — **stale** |
| `plan-stale-audit-81be6e` | `claude/plan-stale-audit-81be6e` | Step 2: PR #291 `CLOSED` — **stale** |
| `spec-coverage-path-fix-1f9ffd` | `claude/spec-coverage-path-fix-1f9ffd` | Step 2: PR #296 `MERGED` — **stale** |
| `spec-coverage-slash-command-51dd66` | `claude/spec-coverage-slash-command-51dd66` | Step 2: PR #295 `MERGED` — **stale** |
| `spec-frontmatter-rollout-323a71` | `claude/spec-frontmatter-rollout-323a71` | Step 2: PR #293 `CLOSED` — **stale** |
| `user-guide-reverse-coverage-53a0eb` | `claude/user-guide-reverse-coverage-53a0eb` | Step 2: PR #292 `CLOSED` — **stale** |
| `multiturn-error-preserve` (plan frontmatter — 물리 디렉토리 없음) | `claude/multiturn-error-preserve` | Step 1: branch 미존재 (삭제됨). PR #289 `MERGED` 확인 — **stale** |

위 모든 worktree 는 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target plan `ai-presentation-form-inline` 은 선행 plan (`ai-presentation-tools`) 이 PR #269-#271 로 이미 main 에 반영한 spec baseline 위에서 작동하므로 **미해결 결정 우회나 active worktree 경합은 없다**. 주요 주의 사항은 두 가지다: (1) `ai-presentation-tools.md` 가 plan/in-progress/ 에 `[ ]` 체크박스를 달고 잔류해 "진행 중 작업" 으로 오인될 수 있으며, target plan 이 동일 spec 파일에 추가 변경을 가하기 전에 완료 처리하는 것이 추적 혼란을 없앤다. (2) WS spec §4.4 `formConfig` 위치 변경은 target plan 이 단독으로 결정하는 형태이나 code-first 현실을 정리하는 방향이므로 content 자체는 적절하다 — cross-ref 한 줄만 추가하면 된다. worktree 충돌 후보 9건 전원이 stale 판정으로 skip 되어 active worktree 경합은 0건이다.

---

## 위험도

LOW
