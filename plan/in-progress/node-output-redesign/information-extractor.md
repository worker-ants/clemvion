# Information Extractor output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. 옛 `output.output.extracted.*` 이중 중첩 폐기 + `output.result.extracted` 통일 + multi-turn `LLM_CALL_FAILED + result` 병존 패턴까지 반영.
> 잔여 권고 항목:
> - waiting 시점 `output.maxTurns` 제거 — `config.maxTurns` 와 동일 값(Principle 1.1 직교 위반).
> - waiting 시점 `output.message` (단수) 제거 — `output.messages[-1].content` 와 의미 중복 (`output.messages` 가 SSOT).
> - waiting `output.messages` ↔ 종결 `output.result.messages` 경로 통일 — ai_agent 와 동일 이슈.

> 대상 spec: `spec/4-nodes/3-ai/3-information-extractor.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/3-ai/3-information-extractor.md:160-204` — §5.1 Single Turn 정상 (`out`):

```json
{
  "config": { "mode": "single_turn", "model": "...", "schema": [...], ... },
  "output": {
    "result": {
      "extracted": { "senderName": "김철수", "orderNumber": "ORD-12345", ... },
      "endReason": "out",
      "turnCount": 1,
      "originalInput": "환불 요청합니다…"
    }
  },
  "meta": { "durationMs": 810, "model": "...", "*Tokens": ..., "turnDebug": [{...}] },
  "port": "out", "status": "ended"
}
```

§5.4 Multi Turn waiting:

```json
{
  "config": {...},
  "output": {
    "messages": [{role, content}, ...],
    "message": "<latest assistant>",
    "turnCount": 1,
    "maxTurns": 10,
    "partial": { "extracted": {...}, "missingFields": [...], "collectionRetryCount": 0 }
  },
  "meta": { "interactionType": "ai_conversation" },
  "status": "waiting_for_input"
}
```

§5.5 Multi Turn resumed (transient):

```json
{
  "output": {
    "messages": [...],
    "partial": {...},
    "interaction": { "type": "message_received", "data": { "content": ..., "role": "user" }, "receivedAt": ISO8601 }
  },
  "status": "resumed"
}
```

§5.6.1~§5.6.4 종결 (4 종): `completed` / `user_ended` / `max_turns` / `max_retries`. 종결은 `output.result.{extracted, endReason, turnCount, messages}`. `max_retries` 는 `output.error` + `output.result` 병존.

## 진단

Information Extractor 는 ai_agent 와 매우 유사한 구조 (single/multi turn × 종결 사유). 단계는 single 1개, multi 는 waiting → resumed → 종결.

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `output.result.extracted` | 적절 | Principle 8.2 — `output.result.extracted` 통일. 옛 `output.output.extracted.*` 이중 중첩 폐기 (spec §5 head footnote) |
| `output.result.{endReason, turnCount, originalInput, messages}` | 적절 | LLM 도메인 결과 |
| `output.error.{code, message, details?}` | 적절 | Principle 3.2 |
| `output.error + output.result 병존` (§5.3 multi-turn LLM_CALL_FAILED, §5.6.4 max_retries) | 적절 | 부분 수집 결과 보존 — ai_agent 와 동일 패턴 |
| `output.messages` (waiting/resumed) | **약간 일관성 미흡** | 종결 시 `output.result.messages`, 진행 중 `output.messages`. ai_agent 와 동일 미흡 |
| `output.partial.{extracted, missingFields, collectionRetryCount}` (waiting) | 적절 (output) | 진행 중 추출 스냅샷 — 다운스트림 UI 진행률 표시. `output.result.extracted` 와 위치 다름 (의도) |
| `output.maxTurns` (waiting snapshot) | **약간 부적절** | `config.maxTurns` 와 의미 중복. spec footnote: "대기 UI 진행률 표시용으로 함께 노출되는 turn budget 스냅샷" — 사용자 편의 echo 명분이지만 Principle 1.1 직교 위반 가능성 |
| `output.message` (waiting, latest assistant followup) | 적절 (output) | WS 페이로드 구성 편의용 — `output.messages[-1].content` 와 의미 중복이지만 1개 message 만 빠르게 접근 |
| `output.interaction.{type, data, receivedAt}` (resumed) | 적절 | Principle 4.5 |
| `meta.{durationMs, model, *Tokens, collectionRetryCount, turnDebug}` | 적절 (meta) | Principle 2 |
| `config.*` (raw echo, frozen snapshot) | 적절 | Principle 7 |
| `_resumeState` (internal) | 적절 — Principle 4.2 | DB strip + autocomplete 비노출 |

핵심 점검:

1. **`output.maxTurns` 중복** — `config.maxTurns` 와 같은 값. spec footnote: "raw 는 `config.maxTurns`" 라고 명시하지만 동시에 `output.maxTurns` 로도 노출. 다운스트림은 `config.maxTurns` 만 사용하면 충분. 제거 또는 `output.partial.maxTurns` 같은 wrapper 안으로 이동 검토.

2. **`output.message` (단수) ↔ `output.messages[-1].content`** — 같은 값을 두 곳에 두는 것은 다운스트림 표현식 안정성에는 좋으나 일관성 위반. 한쪽 유지 권장 — `output.messages` 가 SSOT.

3. **`output.partial` 위치** — waiting 시점에 진행 중 추출 결과 별도 wrapper. 종결 시 `output.result.extracted` 와 통합. 의도된 분리 (진행 vs 종결) 이지만 위치 통일 검토 가치.

4. **multi-turn `LLM_CALL_FAILED` + `result` 병존** (§5.3 footnote): 부분 수집 결과 보존. 합리적.

## 개선안 — 정리된 output

```json
// Single Turn 정상
{
  "config": {...},
  "output": { "result": { "extracted": {...}, "endReason": "out", "turnCount": 1, "originalInput": ... } },
  "meta": { ... },
  "port": "out", "status": "ended"
}

// Multi Turn waiting (정리안)
{
  "config": {...},
  "output": {
    "messages": [...],                           // SSOT
    // ⚠ "message": <latest> — 제거 검토 ($node["X"].output.messages[-1].content 사용)
    "turnCount": <number>,
    // ⚠ "maxTurns": <number> — 제거 검토 ($node["X"].config.maxTurns 사용)
    "partial": { "extracted": {...}, "missingFields": [...], "collectionRetryCount": ... }
  },
  "meta": { "interactionType": "ai_conversation" },
  "status": "waiting_for_input",
  "_resumeState": {...}
}

// Multi Turn resumed (transient)
{
  "config": {...},
  "output": {
    "messages": [...],
    "partial": {...},
    "interaction": { "type": "message_received", "data": {...}, "receivedAt": ISO8601 }
  },
  "meta": { "durationMs": 0, "interactionType": "ai_conversation" },
  "status": "resumed"
}

// Multi Turn 종결 (completed / user_ended / max_turns / max_retries)
{
  "config": {...},
  "output": {
    "result": { "extracted": {...}, "endReason": ..., "turnCount": ..., "messages": [...] },
    "error"?: { "code": "MAX_COLLECTION_RETRIES_EXCEEDED", ... }    // max_retries 만
  },
  "meta": { ... },
  "port": "completed" | "user_ended" | "max_turns" | "error",
  "status": "ended"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| `output.maxTurns` (waiting) | 제거 — `$node["X"].config.maxTurns` 사용 | Principle 1.1 직교 |
| `output.message` (waiting, 단수) | 제거 — `$node["X"].output.messages[-1].content` 사용 | 중복. 제거 시 다운스트림 영향 평가 |
| `output.messages` (waiting) ↔ `output.result.messages` (종결) | 위치 통일 검토 (ai_agent 와 동일 이슈) | 일관성 |

## Rationale

- ai_agent 와 동일한 LLM wrapper 패턴 — 의도된 통일.
- `output.maxTurns` 같은 "사용자 편의 echo" 는 conventions Principle 1.1 의 핵심 위반 — 후속 노드는 `config.maxTurns` 가 raw 값으로 echo 되어 있으므로 그쪽을 사용해야 한다.
- `output.partial` 분리는 진행 중 단계에서 부분 추출 가시화 의도 — 종결 시 `output.result.extracted` 로 통합되는 패턴이 명확하므로 유지.
- `_resumeState` top-level 노출은 internal 컨트랙트 — autocomplete 비노출 + DB strip 으로 방어. 합리적.
