# 정식 규약 준수 검토 결과

**검토 모드**: 구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/3-ai)
**검토 일시**: 2026-06-21
**대상 경로**: `spec/4-nodes/3-ai` (0-common.md, 1-ai-agent.md, 2-text-classifier.md, 3-information-extractor.md)

---

## 발견사항

### [INFO] `0-common.md` — frontmatter `status: partial` 이지만 `pending_plans` 목록이 양호하게 유지됨
- target 위치: `spec/4-nodes/3-ai/0-common.md` frontmatter
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` (partial 시 `pending_plans` 의무)
- 상세: `status: partial` + `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]` 조합은 규약에 적합하다. 위반 없음 — 확인용 기록.
- 제안: 없음.

---

### [INFO] `1-ai-agent.md` — frontmatter `status: partial`, `pending_plans` 복수 항목 적절
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3`
- 상세: `status: partial` + `pending_plans` 3개 항목(`ai-agent-tool-connection-rewrite.md`, `ai-context-memory-followup-v2.md`, `exec-park-durable-resume.md`) 선언. 규약 충족.
- 제안: 없음.

---

### [INFO] `2-text-classifier.md` — `status: implemented` 이나 `code:` 경로가 3개 — 규약 충족
- target 위치: `spec/4-nodes/3-ai/2-text-classifier.md` frontmatter
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` (`implemented` 시 `code:` ≥1 매치 의무)
- 상세: 3개의 코드 경로가 선언돼 있으며 `pending_plans` 가 없다. 규약 준수.
- 제안: 없음.

---

### [INFO] `3-information-extractor.md` — `status: implemented` 이고 `code:` 4개, `pending_plans` 없음 — 규약 충족
- target 위치: `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3`
- 상세: `status: implemented` + `pending_plans` 없음은 규약에 부합. `code:` 경로 4개 선언.
- 제안: 없음.

---

### [CRITICAL] `0-common.md §5` 및 `1-ai-agent.md §7` — "CONVENTIONS Principle 11" 참조가 `node-output.md` 에 존재하지 않음
- target 위치: `spec/4-nodes/3-ai/0-common.md` §5 제목 "응답 형식 규약 (Principle 11)" 및 본문; `spec/4-nodes/3-ai/1-ai-agent.md` §7 서두 "CONVENTIONS Principle 0~11 포맷" 및 §11.7 참조
- 위반 규약: `spec/conventions/node-output.md` — Principle 번호 체계. 실제 node-output.md 에는 Principle 0~9 만 존재하며 Principle 10, 11 이 없다
- 상세: `0-common.md §5` 가 "CONVENTIONS Principle 11" 이라는 번호를 권위 SoT 로 명시하고, `1-ai-agent.md §7` 서두도 "CONVENTIONS Principle 0~11 포맷" 을 선언한다. 그러나 실제 `spec/conventions/node-output.md` 에는 Principle 9 (Container 노드 output overwrite contract) 까지만 정의돼 있다. 구현자가 `node-output.md` 에서 "Principle 11" 을 탐색하면 해당 항목이 없어 wrapper 규약을 확인할 수 없다. 이는 타 시스템이 가정한 invariant(CONVENTIONS 를 참조하면 해당 Principle 번호가 존재해야 한다는 가정)가 깨지는 상황으로 CRITICAL 에 해당한다.
- 제안: 두 가지 중 하나를 선택한다.
  (A) `spec/conventions/node-output.md` 에 "Principle 10" 또는 "Principle 11" 섹션을 추가하여 AI 노드 `output.result.*` / `output.error.*` / `output.interaction.*` wrapper 규약을 공식 정의한다.
  (B) `0-common.md §5` 및 `1-ai-agent.md §7` 의 "CONVENTIONS Principle 11" 참조를 실제 `node-output.md` 의 구체 섹션(`§3.2`, `§4.5`, `§8.2` 등)을 직접 링크하는 것으로 교체한다.

---

### [WARNING] `1-ai-agent.md §7.3` — `details.retryAfterSec` 의 `retryable === true` 전제 invariant 가 필드 표에 미기술
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.3 Single Turn 모드 — 오류, 필드 설명 표의 `output.error.details.retryAfterSec` 행
- 위반 규약: `spec/conventions/node-output.md §3.2.1` invariant: "`retryable === false` 와 함께 `retryAfterSec` set 시 spec 위반 (convention-compliance checker 가 발견)"
- 상세: JSON 예시에서 `retryable: true`, `retryAfterSec: 30` 을 함께 set 한 것은 invariant 를 준수한다. 그러나 필드 표에서 `retryAfterSec` 행 설명은 "재시도 권장 대기 초 (있을 때). §7.9 멀티턴과 동일 형식" 으로만 기술되어 `retryable === true` 일 때만 set 가능하다는 invariant 가 명시되지 않았다. `node-output.md §3.2.1` SoT 에는 이 invariant 가 있지만, AI 노드 문서만 보는 구현자가 놓칠 수 있다.
- 제안: §7.3 필드 표의 `retryAfterSec` 행 설명에 "(`retryable === true` 일 때만 set — CONVENTIONS §3.2.1 invariant)" 를 추가한다.

---

### [WARNING] `node-output.md §4.3` 과 `1-ai-agent.md §7.4` — `output.result.message` 첫 진입 기본값이 conventions 에 미정의
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.4 필드 표, `output.result.message` 행
- 위반 규약: `spec/conventions/node-output.md §4.3` Waiting 상태 노드별 표 — `ai_agent (multi)` 행에 `message` 의 첫 진입 기본값(`""`)이 기술되지 않음
- 상세: `1-ai-agent.md §7.4` 필드 표에서 `output.result.message` 를 "현재 턴의 assistant 응답 (waiting 시점) — 첫 진입 시 `""`" 로 정의하지만, 규약 SoT 인 `node-output.md §4.3` 의 `ai_agent (multi)` 행은 `{ result: { messages, message, turnCount } }` 목록만 있고 첫 진입 기본값이 명시되지 않았다. 규약을 확장하는 형태로 보이지만, 두 문서 간에 규범적 정의의 위치가 분산된 상태다.
- 제안: `node-output.md §4.3` 의 `ai_agent (multi)` 설명에 "첫 진입 시 `message: ""`" 를 명기하거나, §7.4 가 해당 값의 단일 SoT 임을 `node-output.md` 에서 cross-reference 링크로 명시한다.

---

### [WARNING] `1-ai-agent.md §4 Tool Area` — 비활성 기능 설명이 과도하게 잔존
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §4 "Tool Area 연동" 전체 및 §4.1 일부
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` (`status: partial` 에서 spec 이 약속하는 surface 와 실제 구현 상태의 정합 기대)
- 상세: §4 서두에 "재작성 예정 (현재 제거됨)" 경고가 있지만 그 아래에 `toolNodeIds`, `toolOverrides`, ToolOverride 구조 표, 도구 이름 규칙, 도구 설명 파생 규칙 등이 풀 형태로 기술돼 있다. `pending_plans: ai-agent-tool-connection-rewrite.md` 로 추적은 되고 있으나, 구현자가 §4 본문을 보면 실제 구현 상태(제거됨)와 상충하는 내용을 현행 규약으로 오해할 위험이 있다.
- 제안: §4 본문을 "재작성 예정 경고 + 영향 없는 기능 목록(조건/KB/MCP)" 으로 최소화하거나, `ToolOverride` 구조 표 등 비활성 섹션에 `[DEPRECATED — ai-agent-tool-connection-rewrite.md 완료 시 갱신]` 마커를 추가한다.

---

### [INFO] `0-common.md §5` — `output.interaction.{type, data, receivedAt}` AI 노드 사용 타입 범위가 미명시
- target 위치: `spec/4-nodes/3-ai/0-common.md` §5, wrapper 표 `output.interaction` 행
- 위반 규약: `spec/conventions/node-output.md §4.5` (interaction.data payload 규격 — 4가지 type 전체 열거)
- 상세: `node-output.md §4.5` 는 `message_received` / `form_submitted` / `button_click` / `button_continue` 4가지 `interaction.type` 을 정의한다. `0-common.md §5` wrapper 표에는 "멀티턴 resume 직후 1회 emit (Principle 4.5)" 라고만 기술되어 AI 노드가 실제로 사용하는 type 범위(`message_received`, `form_submitted` 2가지)가 명시되지 않았다. 독자가 `button_click` 도 AI 노드에서 발행되는지 혼동할 수 있다.
- 제안: §5 wrapper 표의 `output.interaction` 행 설명에 "AI 노드 사용 타입: `message_received` (채팅 메시지 수신) / `form_submitted` (render_form 제출)" 을 추가한다.

---

### [INFO] `1-ai-agent.md §7.1` `meta.*` 확장 필드 — `node-output.md §2` 에 크로스 레퍼런스 부재
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 meta 필드 표
- 위반 규약: `spec/conventions/node-output.md §2` (LLM 계열 meta 필드 목록)
- 상세: `meta.ragSources`, `meta.ragDiagnostics`, `meta.mcpDiagnostics`, `meta.turnDebug`, `meta.memory`, `meta.presentationSchemaViolations` 등 AI Agent 전용 meta 확장 필드들은 `node-output.md §2` 의 LLM 계열 권장 필드 목록에 없다. 이 필드들은 `0-common.md §6, §7` 에서 정의된 규약이므로 규약 위반은 아니지만, `node-output.md §2` 에서 이 확장들을 AI 노드 전용 추가 메타로 cross-reference 하지 않아 conventions 문서만 보는 독자가 이 필드들의 존재를 알 수 없다.
- 제안: `node-output.md §2` LLM 계열 필드 목록 아래에 "AI 노드 추가 meta 확장 필드: `spec/4-nodes/3-ai/0-common.md §6, §7` 참조" 를 추가한다.

---

## 요약

`spec/4-nodes/3-ai` 영역 전체는 `spec/conventions/spec-impl-evidence.md` frontmatter 규약을 완전히 준수하고, `node-output.md` Principle 0~9 에 대한 실질적 위반도 없다. 단 **CRITICAL 항목 1건**: `0-common.md §5` 와 `1-ai-agent.md §7` 전반에서 반복 인용되는 "CONVENTIONS Principle 11" 이 실제 `spec/conventions/node-output.md` 에 존재하지 않아 구현자가 권위 SoT 를 탐색할 때 실패를 유발한다. 이는 타 시스템이 가정하는 invariant 가 깨지는 직접 위반이다. **WARNING 3건**: (1) `1-ai-agent.md §7.3` 필드 표에서 `retryAfterSec` 의 `retryable === true` 전제 invariant 미기술, (2) `node-output.md §4.3` 과 `1-ai-agent.md §7.4` 사이 `output.result.message` 첫 진입 기본값 정의 위치 분산, (3) `1-ai-agent.md §4` 의 비활성 Tool Area 설명 과잉 잔존. INFO 3건은 문서 간 cross-reference 보강 및 AI 노드 interaction.type 범위 명시 제안이다.

## 위험도

MEDIUM
