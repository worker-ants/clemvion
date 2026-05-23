# Plan Coherence — `ai-agent-render-button-user-message.md` vs in-progress plans

## 결론
**위험도: NONE** — `plan/in-progress/**` 의 다른 plan 과 worktree·결정 충돌 없음.

## 점검 매트릭스

| 관련 plan | 본 작업과의 관계 | 충돌 여부 |
|---|---|---|
| `plan/in-progress/ai-presentation-tools.md` | `render_*` 표현 도구 가족 도입 — 본 작업 (per-button user-message 합성) 의 상위 컨텍스트. ButtonDef 의 `defaults?: Partial<Config>` 에서 buttons 를 brand 고정 가능 (§10.3 overlay) 와 본 작업의 `userMessage` 옵션 필드는 직교 — defaults 가 emit 시 `userMessage` 를 박을 수도 있고 LLM 이 직접 emit 할 수도 있음. | 없음 |
| `plan/in-progress/ai-agent-tool-connection-rewrite.md` | `tool_*` 슬롯 재작성 — 본 작업과 명시적으로 **직교** (`ai-presentation-tools.md` plan 본문에 "도구 이름 충돌 없음 (`tool_*` 와 `render_*` prefix 다름)" 명시). dispatcher 분류 5단계 (`cond/kb/mcp/render/tool`) 패턴 유지. | 없음 |
| `plan/in-progress/spec-drift-ws-button-config.md` | WS `buttonConfig.timeout` / `nodeOutput.type` 정리 — 본 작업의 `userMessage` 필드 신설과 무관. | 없음 |
| `plan/in-progress/ai-agent-render-button-user-message.md` (본 plan) | worktree `ai-agent-render-button-user-message-521f33` 안에서 spec + backend + frontend 일괄. | 자기 자신 |

## Worktree 일치성

- 본 plan frontmatter `worktree: ai-agent-render-button-user-message-521f33` — 현재 worktree 와 일치 (`.claude/worktrees/ai-agent-render-button-user-message-521f33/`).
- 다른 plan 의 worktree (`render-presentation-button-click-fix-683f3a` 등) 는 종료된 상태이거나 별 PR — 본 작업과 격리.

## 미해결 결정

- 없음. 사용자 결정 (2026-05-23) 으로 하이브리드 + fallback 형식까지 확정. plan 내 "의사결정 메모" 4건 모두 명시적으로 결정 완료.

## Follow-up 분리

- 본 plan §"Follow-up" 에 "없음. 본 PR 안에서 spec + backend + frontend 일괄 처리" 명시 — 정합.

## STATUS
ISSUES=0
