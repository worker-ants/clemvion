# AI Agent output 개선안

> 대상 spec: `spec/4-nodes/3-ai/1-ai-agent.md` (§7 출력 구조)

## 현재 output (spec 인용)

AI Agent 의 출력은 7 케이스로 분기된다 (spec §7.1~§7.9). 대표 케이스 발췌:

`spec/4-nodes/3-ai/1-ai-agent.md:296-356` — §7.1 Single Turn 정상 (`out` 포트):

```json
{
  "config": { "mode": "single_turn", "model": "{{ vars.model }}", "systemPrompt": "...", "userPrompt": "{{ $input.message }}", "responseFormat": "text" },
  "output": {
    "result": {
      "response": "AI 의 텍스트 응답 또는 JSON 객체",
      "endReason": "out",
      "turnCount": 1
    }
  },
  "meta": {
    "durationMs": 1234, "model": "gpt-4o",
    "inputTokens": 1250, "outputTokens": 350, "totalTokens": 1600,
    "thinkingTokens": 0, "toolCalls": 2,
    "ragSources": [...], "ragDiagnostics": {...}, "mcpDiagnostics": {...},
    "turnDebug": [{...}]
  },
  "port": "out", "status": "ended"
}
```

§7.4 Multi Turn waiting:

```json
{
  "config": { "mode": "multi_turn", "model": "...", "systemPrompt": "...", "maxTurns": 20, ... },
  "output": { "messages": [{role, content}, ...] },
  "meta": { ..., "interactionType": "ai_conversation", "turnDebug": [...] },
  "status": "waiting_for_input",
  "_resumeState": { /* internal — expression resolver 비노출 */ }
}
```

§7.5 Multi Turn resumed (transient):

```json
{
  "output": {
    "messages": [...],
    "interaction": { "type": "message_received", "data": { "content": ..., "role": "user" }, "receivedAt": ISO8601 }
  },
  "status": "resumed",
  "_resumeState": {...}
}
```

§7.6/§7.7/§7.8 multi-turn 종결: `output.result.{response, endReason, turnCount, messages, condition?}`.

§7.3/§7.9 에러: `output.error.{code, message, details?}` + `port: 'error'`.

## 진단

AI Agent 는 매우 복잡한 노드 — single/multi turn × 정상/조건매칭/사용자종료/최대턴/에러 = 7 케이스. 단계도 multi-turn 에서 waiting → resumed → 종결로 다단계.

전반적 평가: **현 spec 은 conventions 와 매우 잘 정합** — AI 카테고리의 LLM 공통 wrapper (`output.result.*` / `output.error.*` / `output.interaction.*`) 가 통일되어 있고, `output.metadata.*` 같은 옛 패턴은 명시적으로 폐기됨 (spec §7 head footnote).

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `output.result.response` / `endReason` / `turnCount` (LLM 정상 결과) | 적절 (output) | Principle 8.2 — LLM 계열 도메인 결과는 `output.result.*` |
| `output.result.condition.{id, label, reason}` (조건 매칭) | 적절 (output) | 조건 도구 호출 결과 |
| `output.result.messages` (multi-turn) | 적절 (output) | 누적 대화 |
| `output.error.{code, message, details?}` | 적절 | Principle 3.2 표준 envelope |
| `output.messages` (waiting/resumed 시 — `output.result` 밖) | **약간 일관성 미흡** | 종결 시 `output.result.messages`, 진행 중 `output.messages` — 두 위치. spec 이 의도적 분리 (Principle 1.1 / 4.3: waiting 시점은 result 가 아닌 진행 상태) |
| `output.interaction.{type, data, receivedAt}` (resumed) | 적절 | Principle 4.4 / 4.5 |
| `meta.{durationMs, model, *Tokens, toolCalls, ragSources, ragDiagnostics, mcpDiagnostics, turnDebug}` | 적절 (meta) | Principle 2 — LLM 메트릭. 옛 `output.metadata.tokens` → `meta.tokens` 마이그레이션 완료 (spec §0 footnote) |
| `_resumeState` (top-level) | 적절 — internal | Principle 4.2 — credential / 누적 메모리 비대화 우려로 expression autocomplete 비노출 |
| `config` raw echo (모든 단계 frozen snapshot 통해 동일 raw 보장) | 적절 | Principle 7 — multi-turn frozen snapshot 으로 일관 보장 |

핵심 점검:

1. **`output.messages` (waiting/resumed) ↔ `output.result.messages` (종결) 의 일관성**:
   - waiting 시점: `output.messages` (LLM 호출 전·진행 중 대화 누적)
   - resumed 시점: `output.messages` + `output.interaction`
   - 종결 시점: `output.result.messages` (`output.result` wrapper 안)
   - spec 이 의도적: waiting/resumed 는 진행 상태 (run-results UI 의 References / LLM Usage 탭에 노출), 종결은 도메인 결과. 그러나 다운스트림 표현식 입장에서는 같은 `messages` 데이터를 다른 경로로 접근 — `$node["X"].output.messages` (waiting) vs `$node["X"].output.result.messages` (종결).
   - **개선 제안**: 종결 시 `output.messages` 도 함께 두어 경로 통일 (output.result.* 와 별개로). 또는 waiting 시 `output.result.messages` 로 통합. 현 spec 의 분리는 시멘틱 의도가 강하므로 변경 영향 평가 필요.

2. **multi-turn `error` + `result` 병존** (§7.9 footnote): 부분 수집 결과 보존을 위해 의도적. Principle 3 변형 (정상 envelope + error envelope 병존) — Information Extractor 와 동일 패턴. 합리적.

3. **`meta.turnDebug[*]` 의 RAG/MCP delta** — 각 turn 의 ragSources delta 와 노드 전체 누적 (`meta.ragSources`) 의 합 관계가 spec §8 마지막 줄에 명시. 일관성 OK.

4. **`_resumeState` top-level 노출** — 5필드 invariant 의 예외이지만 spec 명시: "internal 전달 필드, expression resolver 에서는 노출하지 않는다" (§7 footnote). DB 저장 시 strip 정책도 명시. 합리적.

## 개선안 — 정리된 output

대부분 conventions 부합. 미시 보강:

- waiting/resumed 시점의 `output.messages` 와 종결 시점의 `output.result.messages` 의 경로 통일 검토 (spec 변경 영향 평가 후).

```json
// Single Turn 정상
{
  "config": { "mode": "single_turn", ... },
  "output": { "result": { "response": ..., "endReason": "out", "turnCount": 1 } },
  "meta": { "durationMs": ..., "model": ..., "*Tokens": ..., "toolCalls": ..., "ragSources"?, "ragDiagnostics"?, "mcpDiagnostics"?, "turnDebug": [...] },
  "port": "out", "status": "ended"
}

// Multi Turn waiting
{
  "config": { "mode": "multi_turn", ... },
  "output": { "messages": [...] },              // ⚠ 검토: output.result.messages 로 통일?
  "meta": { ..., "interactionType": "ai_conversation", "turnDebug": [...] },
  "status": "waiting_for_input",
  "_resumeState": { ... }
}

// Multi Turn 종결 (조건매칭 / user_ended / max_turns)
{
  "config": {...},
  "output": { "result": { "response": ..., "endReason": ..., "turnCount": ..., "messages": [...], "condition"? } },
  "meta": { ... },
  "port": "<condition.id>" | "user_ended" | "max_turns",
  "status": "ended"
}

// 에러 (single/multi)
{
  "config": {...},
  "output": { "error": { "code": ..., "message": ..., "details"? }, "result"? /* multi-turn 부분 보존 */ },
  "meta": { ... },
  "port": "error", "status": "ended"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (대부분 정리되어 있음) | — | 옛 `output.metadata.*` 는 `meta.*` 로 마이그레이션 완료 |
| `output.messages` (waiting/resumed) ↔ `output.result.messages` (종결) | 경로 통일 검토 | 다운스트림 표현식의 일관성 — 단 시멘틱 분리 의도가 강해 변경 영향 평가 필요 |

## Rationale

- AI Agent 의 7 케이스는 LLM single/multi turn × 종결 사유 조합으로 본질적 — 단순화 불가.
- LLM 공통 wrapper (`output.result.*` / `output.error.*` / `output.interaction.*`) 는 ai_agent / text_classifier / information_extractor 3 노드에서 통일되어 다운스트림 표현식 일관성 제공.
- `_resumeState` top-level 노출은 5필드 invariant 위반이지만 multi-turn internal state 의 보존 요구를 만족하는 유일한 방법 — expression autocomplete 비노출로 사용자 인터페이스에서는 invariant 유지.
- waiting/종결 시점의 `messages` 위치 차이는 시멘틱 의도지만, 다운스트림 분기 코드의 복잡성을 키움 — 통일 검토 가치 있음.
