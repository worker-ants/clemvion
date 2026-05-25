# Plan 정합성 검토 결과

> 검토 일시: 2026-05-25
> 검토 모드: --impl-prep
> 대상 영역: `spec/5-system/`
> 현재 worktree: `workflow-resumable-execution-phase2-cont-64f537`

---

## 발견사항

### [WARNING] spec/5-system/1-auth.md §1.5.1 Rate Limit 값 미결 — 구현 착수 전 결정 필요

- **target 위치**: `spec/5-system/1-auth.md` §1.5.1 초대 토큰 정책 표, "Rate Limit" 행
- **관련 plan**: 없음 (어떤 in-progress plan 도 이 결정을 담당하지 않음)
- **상세**: 해당 셀에 "워크스페이스·invited_by 단위 분당 N회 (구현 시 결정)" 이라고 명시되어 있다. `N` 이 미확정인 상태로 초대 토큰 흐름을 구현하면 rate limit 로직에 임의값이 들어가게 되며, 나중에 spec 과 구현이 분리 표기되는 문제가 생긴다.
- **제안**: 초대 토큰 흐름(`spec/5-system/1-auth.md §1.5`)을 구현 대상에 포함할 경우, project-planner 에 Rate Limit 값(예: 분당 5회) 결정을 먼저 위임하고 spec 갱신 후 착수. `spec/5-system/1-auth.md` 의 `status: spec-only` 이므로 구현은 어차피 별도 plan 에서 다루어야 한다. 본 impl-prep 대상 worktree(`workflow-resumable-execution-phase2-cont-64f537`)가 `1-auth.md` 를 구현 대상으로 삼지 않는다면 이 WARNING 은 해당 plan 착수 시점으로 defer 가능.

---

### [WARNING] spec/5-system/11-mcp-client.md — status: spec-only, 구현 plan 없음

- **target 위치**: `spec/5-system/11-mcp-client.md` frontmatter `status: spec-only`
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 (간접 연관)
- **상세**: `11-mcp-client.md` 는 `status: spec-only` / `code: []` 이며, 이를 구현하는 in-progress plan 이 없다. `ai-agent-tool-connection-rewrite.md` 가 AI Agent 의 일반 도구 연결(`tool_*`)을 재설계할 때 `spec/4-nodes/3-ai/1-ai-agent.md §6.1 dispatcher 분류 순서 표`를 갱신해야 한다고 명시되어 있고, 그 표에는 `mcp_*` 가 포함된다. 그러나 해당 plan 의 "결정 기록" 섹션은 아직 모두 TBD 상태다. `tool_*` 접두사 모델이 결정되기 전에 MCP Client 구현을 시작하면, MCP 도구 이름 충돌 정책이나 dispatcher 우선순위 표가 재작성 대상인 채로 구현이 진행될 수 있다. 다만 `11-mcp-client.md` 자체의 MCP 인터페이스 정의(`mcp_<sid>__<toolName>` 명명 규칙, 에러 vocabulary 등)는 내부적으로 일관되므로, `ai-agent-tool-connection-rewrite.md` 의 미결 결정은 `1-ai-agent.md` 수정에만 영향을 준다.
- **제안**: 본 impl-prep 대상 worktree 가 `11-mcp-client.md` 를 구현 대상으로 삼지 않는다면 블로커 아님. 구현 시점에 `ai-agent-tool-connection-rewrite.md §결정 기록` 이 채워진 후에 착수할 것을 plan 에 선행 조건으로 명시하도록 권장.

---

### [INFO] 2fa-webauthn-followups.md — 항목 2(e2e), 3(mobile Safari) 미완료 상태로 plan 잔류

- **target 위치**: `spec/5-system/1-auth.md` (WebAuthn 관련 섹션)
- **관련 plan**: `plan/in-progress/2fa-webauthn-followups.md` §2, §3, §10
- **상세**: 항목 2(백엔드 WebAuthn e2e), 3(mobile Safari 실기기 검증), 10(login_history 1M row 모니터링)가 미완료 체크박스로 남아 있다. 이들은 spec 변경 없이 codebase·운영 작업이므로 `spec/5-system/1-auth.md` 구현에 직접 충돌하지 않는다. 그러나 plan 이 아직 `plan/complete/` 로 이동되지 않은 채 in-progress 이므로, 다른 작업이 `1-auth.md` 를 구현 착수할 때 이 항목들의 처리 방향을 함께 확인하는 것이 좋다.
- **제안**: 추적 메모 수준. `1-auth.md` 구현 plan 착수 시, 2fa-webauthn-followups 의 미완료 codebase 항목이 해당 구현과 중복·충돌하지 않는지 확인 후 착수.

---

### [INFO] spec/5-system/10-graph-rag.md — frontmatter status 갱신이 현 worktree 에서만 반영됨

- **target 위치**: `spec/5-system/10-graph-rag.md` frontmatter
- **관련 plan**: `plan/in-progress/workflow-resumable-execution.md` (현재 worktree 의 plan)
- **상세**: `10-graph-rag.md` 는 main 브랜치에서 `status: spec-only` / `code: []` 이지만, 현재 worktree(`workflow-resumable-execution-phase2-cont-64f537`)에서 `status: implemented` + `code: [...]` 로 갱신되어 있다. 이 변경은 Phase 0 스펙 갱신의 일환으로 적법하게 이루어진 것이나, 이 worktree 의 PR 이 아직 열리지 않았으므로 main 에는 아직 반영되지 않은 상태다. 다른 agent 나 plan 이 main 의 `10-graph-rag.md` 를 `spec-only` 로 읽고 "미구현" 으로 잘못 판단할 수 있다.
- **제안**: 현 worktree 에서 PR 을 열 때 `10-graph-rag.md` frontmatter 갱신이 포함되어 있는지 확인. 별도 cleanup PR 로 먼저 병합하는 방안도 고려. 추적 메모 수준.

---

## Stale 으로 skip 한 worktree (의무)

`spec/5-system/` 하위 파일을 변경한 worktree 후보 중 stale 판정으로 skip 된 항목:

- `chat-channel-dispatcher-split-impl-d7c3ea` (branch `claude/chat-channel-dispatcher-split-impl-d7c3ea`) — Step 1 ancestor: ACTIVE (squash merge 케이스). Step 2 PR: MERGED. 변경 파일: `spec/5-system/15-chat-channel.md`. stale 처리.
- `trigger-create-multi-provider-ui-plan-677f12` (branch `claude/trigger-create-multi-provider-ui-plan-677f12`) — Step 1 ancestor: ACTIVE (squash merge 케이스). Step 2 PR: MERGED. 변경 파일: `spec/5-system/15-chat-channel.md`. stale 처리.

위 두 worktree 모두 PR 이 MERGED 상태이며 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

active 로 확인된 spec/5-system/ 변경 worktree:

- `workflow-resumable-execution-6b105e` — `workflow-resumable-execution-phase2-cont-64f537` 의 조상 커밋. 동일 작업 체인의 일부이며 별도 경합 없음. PR 없음 (worktree 만 잔류). cleanup 권장.
- `workflow-resumable-execution-phase2-a6b133` — `workflow-resumable-execution-phase2-cont-64f537` 와 동일 커밋(`edc7f68b`). 실질적으로 같은 작업. PR 없음 (worktree 만 잔류). cleanup 권장.
- `workflow-resumable-execution-phase2-cont-64f537` — 현재 impl-prep 대상. spec/5-system/4-execution-engine.md, 6-websocket-protocol.md, 10-graph-rag.md 변경 중.

**worktree 충돌 후보 3건 중 stale 2건 skip (Step 2 PR MERGED), active 1건 분석 (현재 worktree 자신의 chain).**

---

## 요약

`spec/5-system/` 전체 범위에 대한 impl-prep 검토 결과, CRITICAL 등급 이슈는 없다. `spec/5-system/1-auth.md §1.5.1` 의 Rate Limit 값("분당 N회 — 구현 시 결정")이 미확정 상태이며(WARNING), `spec/5-system/11-mcp-client.md` 는 status: spec-only 임에도 구현 plan 이 없고 `ai-agent-tool-connection-rewrite.md` 의 미결 결정이 간접 선행 조건으로 남아 있다(WARNING). 두 WARNING 모두 현재 worktree(`workflow-resumable-execution-phase2-cont-64f537`)가 `1-auth.md` 또는 `11-mcp-client.md` 를 직접 구현 대상으로 삼지 않는다면 즉시 블로커가 아니며 해당 스펙 구현 착수 시점으로 defer 가능하다. worktree 충돌 후보 4건 중 stale(PR MERGED) 2건 skip, 동일 작업 chain 2건(6b105e, phase2-a6b133)은 비경합이며 cleanup 권장.

---

## 위험도

LOW
