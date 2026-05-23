# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
Target 문서: `spec/4-nodes/`
검토 기준 plan: `plan/in-progress/**`
검토 일시: 2026-05-23

---

## 발견사항

### [INFO] ai-presentation-tools plan — spec 미완료 항목이 target 범위에 포함됨

- target 위치: `spec/4-nodes/6-presentation/0-common.md §10 AI Tool 모드 (render_*)` / `spec/4-nodes/3-ai/1-ai-agent.md §4·§6·§7`
- 관련 plan: `plan/in-progress/ai-presentation-tools.md` §4.1 Spec 작성 항목 중 체크되지 않은 항목들
- 상세:
  `ai-presentation-tools.md` 의 spec 작성 단계 중 아래 항목이 아직 미완료([ ]) 상태다:
  - `spec/conventions/conversation-thread.md §1.2` — `ConversationTurn` 표에 `presentations?: PresentationPayload[]` top-level 행 추가 및 기존 cross-ref 정리
  - `spec/5-system/6-websocket-protocol.md §4.4` — `execution.ai_message` payload 에 `presentations?` 추가, `interactionType` enum 에 `'ai_form_render'` 추가
  - `spec/5-system/14-external-interaction-api.md §6.5` — SSE payload 에 `presentations` 추가
  - `spec/conventions/node-output.md §4.5` — `form_submitted` shape 에 `data.via: 'ai_render'` sentinel 추가

  `spec/4-nodes/` 범위의 관련 변경(spec §10, ai-agent.md §4/§6/§7)은 `[x]` 완료 상태이며 main 에 반영돼 있어 구현 착수 시 target spec 은 최신 상태다. 그러나 위 미완료 spec 항목들은 `presentation` 노드의 button-click/form-submit 흐름과 직결되는 하위 규약을 아직 다 명문화하지 않은 상태다.

  현재 `render-presentation-button-click-fix-683f3a` worktree 가 구현하려는 "presentation 노드 버튼 클릭 fix" 는 `execution.click_button` WS 명령 → 포트 라우팅 → `output.interaction.type: 'button_click'` 흐름을 다루므로, `spec/conventions/node-output.md §4.5` 의 `data.via` sentinel 완성 및 `spec/5-system/6-websocket-protocol.md §4.4` 의 `interactionType` enum 갱신이 병렬로 진행 중인 미완료 항목이라는 점을 인지해야 한다.
- 제안:
  - 구현 착수 전에 위 미완료 spec 4건이 본 worktree 의 구현 범위와 겹치는지 확인한다. 겹치면 `ai-presentation-tools.md` plan 에 따라 해당 spec 을 먼저 완성하거나, spec 미완료 상태를 인지한 채로 구현하되 PR 설명에 "spec 후속 필요" 를 명기한다.
  - `ai-presentation-tools.md` 는 `plan/in-progress` 에 남아 있으므로, 두 worktree 가 동일 convention spec 파일을 동시에 편집하는 상황을 피한다.

---

### [INFO] node-output-redesign plan — `config.buttonConfig` 위치 미결 advisory

- target 위치: `spec/4-nodes/6-presentation/1-carousel.md §5.4` (Waiting — buttonConfig), `spec/4-nodes/6-presentation/0-common.md §3`
- 관련 plan: `plan/in-progress/node-output-redesign/carousel.md` — "잔여 권고: `config.buttonConfig` (runtime 생성 `buttons` 합산 + `buttonItemMap`) 의 위치 — Principle 7 exception 으로 의도적 유지 검토"
- 상세:
  `node-output-redesign/carousel.md` 은 `config.buttonConfig` 가 핸들러 runtime 생성이라 Principle 7 (config = raw echo) 와 미묘한 위배가 있으나, 프론트엔드 일관 접근 의도를 이유로 현위치를 유지하는 방향을 권고한다. 이 결정은 D1 (#145) 에서 명시적으로 `meta.buttonConfig` 이동을 보류하고 spec 표현 명확화로 종결했다.

  따라서 현 구현 착수 시 `config.buttonConfig` 는 `config` 에 위치하는 것이 spec 의 의도이며, 이를 임의로 `meta.buttonConfig` 로 옮기면 `node-output-redesign` 계획과 충돌한다.
- 제안: 구현 중 `buttonConfig` 위치 변경을 시도하지 않는다. 변경이 필요하다면 `node-output-redesign` plan 에 결정 추가 후 진행한다.

---

### [INFO] ai-agent-tool-connection-rewrite plan — 미해결 결정이 target 범위와 간접 인접

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.1 step 3a` (dispatcher 분류 순서 표)
- 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §결정 기록 — 도구 등록 모델·시그니처 위치·실행 컨텍스트·결과 라우팅·ND-AG-21 우선순위 모두 "TBD"
- 상세:
  `spec/4-nodes/3-ai/1-ai-agent.md §6.1 step 3a` 의 dispatcher 분류 순서는 현재 `cond_* → kb_* → mcp_* → render_* → tool_*` 5단계로 확정되어 있다. `tool_*` 의 구체적 동작·schema 는 `ai-agent-tool-connection-rewrite.md` 에서 결정 대기 중이다. 이 구역은 현재 target (`spec/4-nodes/`) 중 `spec/4-nodes/3-ai/` 파일이 포함되는 경우 인접 영역이 된다. 그러나 버튼 클릭 fix worktree 는 `spec/4-nodes/3-ai/` 를 주요 편집 대상으로 하지 않으므로 직접 충돌 가능성은 낮다.

  단, 구현 중 AI Agent 출력 구조(§5, §6) 를 수정해야 하는 상황이 생기면 `ai-agent-tool-connection-rewrite.md` 의 미해결 결정 항목과의 충돌 여부를 재확인한다.
- 제안: 현 구현에서 `spec/4-nodes/3-ai/1-ai-agent.md` 를 편집할 필요가 생기면 plan 정합성 재검토를 수행한다.

---

## 요약

`spec/4-nodes/` 를 대상으로 하는 이번 `--impl-prep` 검토에서 CRITICAL 또는 WARNING 수준의 충돌은 발견되지 않았다. 주요 관찰 사항은 다음과 같다. 첫째, `ai-presentation-tools.md` plan 의 spec 작성이 일부 미완료 상태로 남아 있으나, 이는 `spec/4-nodes/` 범위 밖(`spec/conventions/`, `spec/5-system/`) 의 파일들이며 현 worktree 의 구현 착수를 직접 차단하지 않는다. 다만 `presentation` 버튼 클릭·form-submit 흐름의 convention 정의가 아직 완전히 명문화되지 않았음을 인지하고 구현 경계를 명확히 할 필요가 있다. 둘째, `node-output-redesign` plan 에서 `config.buttonConfig` 위치를 의도적으로 `config` 에 유지하기로 결정했으므로 구현 중 이를 변경하지 않는다. 셋째, `ai-agent-tool-connection-rewrite.md` 의 `tool_*` 미결 결정은 현 버튼 클릭 fix 범위와 직접 교차하지 않는다.

---

## 위험도

LOW
