# Text Classifier output 개선안

> 대상 spec: `spec/4-nodes/3-ai/2-text-classifier.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/3-ai/2-text-classifier.md:115-149` — §5.1 Single-label (port `<category.id>` 또는 `fallback`):

```json
{
  "config": { "categories": [...], "inputField": "{{ $input.text }}", "multiLabel": false, "model": "gpt-4o-mini" },
  "output": {
    "result": {
      "category": "Billing",
      "confidence": 0.95,
      "evidence": ["환불"],
      "originalInput": "환불 요청드립니다"
    }
  },
  "meta": {
    "durationMs": 420, "model": "gpt-4o-mini",
    "inputTokens": 50, "outputTokens": 10, "totalTokens": 60,
    "thinkingTokens": 0,
    "llmCalls": [{...}]
  },
  "port": "class_0"
}
```

§5.2 Multi-label (port `class_<i>` fan-out 또는 `fallback`):

```json
{
  "config": {...},
  "output": {
    "result": {
      "categories": [{ "name": "Billing", "confidence": 0.9, "evidence": [...] }, ...],
      "originalInput": "..."
    }
  },
  "port": ["class_0", "class_1"]
}
```

§5.3 에러 (port `error`):

```json
{
  "output": {
    "error": { "code": "LLM_CALL_FAILED", "message": "...", "details": { "originalInput": "..." } },
    "originalInput": "환불 요청드립니다"
  },
  "port": "error"
}
```

## 진단

Text Classifier 는 분류 노드 (단계 1개). single/multi label × 정상/fallback/에러 = 5 케이스.

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `output.result.category` (single) / `output.result.categories` (multi) | 적절 | Principle 8.2 — LLM 계열 통일 wrapper |
| `output.result.confidence` / `evidence` | 적절 | 도메인 결과 (`includeConfidence` / `includeEvidence` 옵션 시) |
| `output.result.originalInput` | 적절 (output) | LLM 에 투입된 resolved 입력 — 디버깅 / 후속 노드 참조용 |
| `output.error.{code, message, details?}` | 적절 | Principle 3.2 |
| `output.error.details.originalInput` (truncated 500자) | 적절 — `output.originalInput` (full) 와 별개 | 에러 envelope 의 PII / 대용량 방지 |
| `output.originalInput` (top-level, 에러 시) | **약간 부적절** | `output.result.originalInput` 와 동일 의미인데 에러 시는 `output.result` 가 없으므로 top-level 로 노출됨. 일관성 깨짐 — 정상/에러 모두 `output.originalInput` 로 통일하거나, 에러 시 `output.result.originalInput` 만 두는 방식 검토 |
| `meta.{durationMs, model, *Tokens, llmCalls}` | 적절 (meta) | Principle 2 |
| `config.*` (raw echo) | 적절 | Principle 7 |
| `port: <category.id> | 'fallback' | 'error' | string[]` (multi) | 적절 | Principle 5 fan-out + Principle 6 동적 포트 (`class_<i>` fallback id) |

핵심 점검:

1. **`output.originalInput` 위치 일관성** — 정상 시 `output.result.originalInput` (안쪽), 에러 시 `output.originalInput` (top-level). 다운스트림 표현식의 안정성을 위해 위치 통일 권장:
   - 옵션 A: 항상 `output.result.originalInput` (에러 시 result 가 부분 보존되도록)
   - 옵션 B: 항상 `output.originalInput` (top-level — wrapper 밖)
   - 옵션 C: 현재 그대로 — spec footnote 가 의도 명시 (truncate 정책 분리)
   - 본 plan 은 옵션 A 권장 — `output.error` 와 `output.result` 가 병존하는 ai_agent 패턴과 정합.

2. **`meta.llmCalls`** — turnDebug 와 유사한 디버깅 구조. text_classifier 는 single-call 노드이므로 `llmCalls` 배열 길이 1. ai_agent 의 `meta.turnDebug[i].llmCalls` 와 위치만 다르고 의도 동일. 통일 검토 가치 있음 (모두 `meta.llmCalls` 또는 모두 `meta.turnDebug[*].llmCalls`).

3. **`output.result.originalInput` 위치** — 도메인 결과 wrapper 안에 디버깅용 raw input 을 두는 것이 적절한지. spec footnote: "재진입/디버깅 시 원문 재확인용". 합리적이나 `meta` 에 두는 대안도 있음 (LLM 입력은 비즈니스 데이터로 보기 어려움).

## 개선안 — 정리된 output

```json
// Single-label 정상
{
  "config": {...},
  "output": {
    "result": {
      "category": <string | null>,
      "confidence"?: <number>,
      "evidence"?: [<string>, ...],
      "originalInput": <string>            // ⚠ 위치 일관성 검토
    }
  },
  "meta": { ... },
  "port": "<category.id>" | "fallback"
}

// Multi-label 정상
{
  "config": {...},
  "output": {
    "result": {
      "categories": [{ "name": ..., "confidence"?, "evidence"? }, ...],
      "originalInput": <string>
    }
  },
  "meta": { ... },
  "port": [<category.id>, ...] | "fallback"
}

// 에러
{
  "config": {...},
  "output": {
    "error": { "code": ..., "message": ..., "details": { "originalInput": <truncated 500자> } }
    // ⚠ output.originalInput (top-level) 제거 권장 — output.error.details.originalInput 만 사용
    //    또는 output.result.originalInput 으로 통일
  },
  "meta": { ... },
  "port": "error"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| `output.originalInput` (top-level, 에러 시) | `output.error.details.originalInput` (이미 존재) 또는 `output.result.originalInput` 로 통일 | 위치 일관성 |

## Rationale

- LLM 카테고리 통일 wrapper (`output.result.*`) 는 ai_agent / information_extractor 와 정합 — 유지.
- `output.originalInput` 의 위치 분기 (정상=안, 에러=밖) 는 spec 작성 시 `result` wrapper 가 없는 케이스 (에러) 를 구하기 위한 임시 해결로 보임. 통일 권장.
- `evidence` cap (20 항목 × 200자, DoS 방지) 은 spec §4 마지막 줄 명시 — 보안 메트릭으로서 합리적.
