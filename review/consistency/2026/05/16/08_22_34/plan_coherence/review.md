# Plan 정합성 Check — user-guide-sync-2026-05-16

검토 모드: `--impl-prep`
Target 파일: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/conversation-thread.md`
Target plan: `plan/in-progress/user-guide-sync-2026-05-16.md` (worktree: `user-guide-sync-4af69c`)

---

## 발견사항

### 1 — [INFO] `spec-update-cafe24-app-url-reuse.md` 의 spec 갱신이 아직 미완 — MDX 가 갱신 전 상태 기준으로 작성됨

- **target 위치**: `user-guide-sync-2026-05-16.md` §작업 범위, "integrations.mdx — Cafe24 노드 섹션 추가" — 소스로 `spec/4-nodes/4-integration/4-cafe24.md` 를 명시
- **관련 plan**: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`) — 미체크 항목 `[ ] spec 갱신` 에 "`spec/4-nodes/4-integration/4-cafe24.md §9.4` 의 install_token 소거 표기 갱신" 포함
- **상세**: user-guide-sync 는 이미 모든 태스크를 완료(`[x]`)한 상태이므로 작업 자체의 직접 충돌은 없다. 그러나 `spec-update-cafe24-app-url-reuse.md` 의 spec 갱신이 완료되어 `spec/4-nodes/4-integration/4-cafe24.md §9.4` 가 변경되면, user-guide-sync 가 작성한 `integrations.mdx` 내 install_token 관련 내용이 즉시 stale 해질 수 있다. `cafe24-app-url-reuse-f9a2e3` worktree 는 현재 존재하지 않으므로 병렬 직접 충돌은 아님.
- **제안**: `spec-update-cafe24-app-url-reuse.md` 의 spec 갱신 완료 후, `integrations.mdx` Cafe24 섹션의 install_token 관련 표현이 새 spec 과 일치하는지 확인하는 후속 태스크를 해당 plan 에 추가한다.

---

### 2 — [INFO] `conversation-thread.md` plan 에 미체크 항목이 하나 남아 있으나 `plan/in-progress/` 에 유지 중

- **target 위치**: N/A (user-guide-sync 의 spec 소스 파일들 — `spec/4-nodes/3-ai/0-common.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/conversation-thread.md`)
- **관련 plan**: `plan/in-progress/conversation-thread.md` (worktree: `conversation-thread-e509c5`, 이미 PR #17 merge 완료) — 미체크 항목: `[ ] (follow-up) tool turn opt-in push (includeToolTurns: true)` (코드 작업, spec 변경 없음)
- **상세**: `conversation-thread-e509c5` worktree 는 이미 정리되어 없고, 위 세 spec 파일에 대한 모든 spec 작업은 `[x]` 완료 상태이다. user-guide-sync 가 이 spec 파일들을 읽기 전용 소스로 사용하는 것에 대한 충돌은 없다. 남은 미체크 항목은 순수 백엔드 코드 작업이므로 spec 정합성에 영향이 없다. 추적 관점에서, 해당 follow-up 이 완료되면 `conversation-thread.md` 를 `plan/complete/` 로 이동하면 된다.
- **제안**: user-guide-sync 관점에서 별도 조치 불필요. `conversation-thread.md` 담당자가 tool turn opt-in push 완료 시 `plan/complete/` 로 이동.

---

### 3 — [INFO] `ai-agent-tool-connection-rewrite.md` 의 미해결 디자인 결정이 user-guide-sync 와 무관하게 격리됨을 확인

- **target 위치**: `user-guide-sync-2026-05-16.md` §의도적 제외 — "AI Agent 도구 연결 UX 갱신은 `ai-agent-tool-connection-rewrite` plan 에서 별도 처리"
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` — §1 디자인 결정 전체가 미해결 TBD(도구 등록 모델, 시그니처 위치, 실행 컨텍스트, 결과 라우팅, ND-AG-21 우선순위). 해당 plan 은 `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/3-workflow-editor/0-canvas.md` 등을 대상으로 하며, user-guide-sync 의 target 파일인 `spec/4-nodes/3-ai/0-common.md` 에 대한 쓰기 계획이 없음.
- **상세**: 명시적 제외 선언으로 충돌 위험이 이미 관리되고 있다. `spec/4-nodes/3-ai/0-common.md` 는 user-guide-sync 에서 읽기 전용이며 `ai-agent-tool-connection-rewrite.md` 의 spec 작업 범위에도 해당 파일이 포함되지 않는다.
- **제안**: 현 상태 유지. 다만 `ai-agent-tool-connection-rewrite.md` 가 `spec/4-nodes/3-ai/0-common.md` 에 변경을 가져올 경우 user-guide-sync 가 작성한 `ai.mdx` 의 Conversation Context 섹션이 갱신이 필요할 수 있다. 해당 plan 진행 시 MDX 갱신 후속 태스크를 추가 권장.

---

## 요약

`user-guide-sync-2026-05-16.md` 가 참조하는 네 개의 spec 파일에 대해 plan/in-progress 문서와의 충돌을 검토한 결과, CRITICAL·WARNING 수준의 이슈는 발견되지 않았다. target plan 은 이미 모든 태스크를 완료한 상태이며, 네 spec 파일 모두에 대해 쓰기가 아닌 읽기 전용 소스로 사용하고 있다. `spec-update-cafe24-app-url-reuse.md` 가 `spec/4-nodes/4-integration/4-cafe24.md §9.4` 를 갱신하면 이미 작성된 MDX 내용이 stale 해질 수 있으나, 해당 worktree 가 현재 비활성 상태이고 영향 범위가 §9.4 의 install_token 소거 표기로 한정되어 있어 INFO 로 분류한다. `conversation-thread.md` 의 미체크 항목은 순수 코드 작업으로 spec 정합성에 영향 없다.

## 위험도

LOW
