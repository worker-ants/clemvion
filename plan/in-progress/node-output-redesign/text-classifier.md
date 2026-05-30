# Text Classifier output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. Phase 4 (ai-review 후속 — `meta` 정합 + 측정 기준 통일) 까지 반영된 상태. 2026-05-16 구현 분석에서 schema autocomplete 잔재 1건 신규 검출 (`error: z.string()` legacy 필드).
> 잔여 권고 항목:
> - `output.originalInput` 위치 일관성 — 정상 시 `output.result.originalInput`, 에러 시 `output.originalInput` (top-level) 로 분기. ai_agent 의 `output.error + output.result` 병존 패턴과 정합하도록 `output.result.originalInput` 으로 통일 검토 (또는 에러 시 `output.error.details.originalInput` 만 유지).
> - `meta.llmCalls` (text_classifier) vs `meta.turnDebug[i].llmCalls` (ai_agent / information_extractor) — single-call 노드와 multi-turn 노드의 위치 차이. 통일 검토 가치 있으나 의미가 다름.
> - **(2026-05-16 신규)** schema `output` autocomplete (`text-classifier.schema.ts:124`) 의 `error: z.string().optional()` legacy 필드 — Principle 3 envelope (`{code, message, details}`) 이전 잔재, 제거 권고.
> - **(2026-05-16 신규)** `output.error.details.originalInput` 500자 cap 의 boundary unit-test 누락.

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
- (2026-05-18) ConversationThread v2 연동 (conversation-thread §2.3 / §7 v2 로드맵) 도입 시 final-assistant push 인터페이스 (single-label: `output.result.category`, multi-label: `categories.map(c => c.name).join(', ')`, §1.4 v2 표기 행) 와 충돌하지 않도록 output 재설계 — `output.result.{category|categories}` 단일 SoT 유지가 v2 push hook 의 안전한 진입점.

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/ai/text-classifier/{text-classifier.handler.ts, text-classifier.schema.ts, text-classifier.handler.spec.ts, text-classifier.schema.spec.ts, text-classifier.thread.spec.ts, text-classifier.component.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - single-label 정상 — `text-classifier.handler.ts:433-453` 의 `processSingleLabelResult` return `{ config: configEcho, output: { result: { category, confidence?, evidence?, originalInput } }, meta: {...}, port: <portIds[i]>|'fallback' }` 가 spec §5.1 과 일치 (`status` 없음 — 종결 단계 단일).
   - multi-label 정상 — `:518-537` `processMultiLabelResult` return `{ output: { result: { categories, originalInput } }, port: matchedPorts | 'fallback' }` 가 spec §5.2 와 일치. fan-out (`port: string[]`) 패턴은 Principle 5 정합.
   - 에러 — `:184-209` `try/catch` 블록이 `{ output: { error:{code:'LLM_CALL_FAILED', message, details:{originalInput:truncated}}, originalInput }, port:'error' }` 반환. spec §5.3 과 일치하나 **`output.originalInput` (top-level) 이 정상 시 `output.result.originalInput` (안쪽) 과 위치 비대칭** — plan 의 기존 잔여 권고 그대로 검증됨.

2. **schema ↔ spec config 정합성**:
   - `textClassifierNodeConfigSchema` (`text-classifier.schema.ts:37-95`) 의 모든 필드 (`llmConfigId`, `model`, `inputField`, `categories`, `instructions`, `includeConfidence`, `includeEvidence`, `multiLabel`) 가 spec §1 표와 동일. default 값 일치 (`includeConfidence:false`, `includeEvidence:false`, `multiLabel:false`).
   - `categoryDefSchema` (`:16-35`) 의 `id`/`name`/`description`/`examples` 4 필드도 spec §1 의 CategoryDef 와 정합 — `id` 의 `[a-zA-Z0-9_-]+` regex + 64 max + `hidden: true` UI 메타 일치.

3. **validate 일관성**:
   - `:74-80` `handler.validate()` 는 `evaluateMetadataBlockingErrors` (warningRules + `validateConfig` SSOT). SSOT 침범 없음.
   - `warningRules` (`schema.ts:201-217`) 의 `no-llm-provider` / `no-categories` / `no-input-field` 와 `validateTextClassifierConfig` (`:144-175`) 의 per-category `name`/`__none__`/`id 중복` 검증이 spec §6 표와 일치. duplicate id 차단(`:152-170`) 은 review W-4 회귀 방어.

4. **에러 컨트랙트 (Principle 3)**:
   - `:163-210` 의 try/catch — `LLM_CALL_FAILED` envelope. `output.error.details.originalInput` (truncate 500자) + `output.originalInput` (full) 분리는 spec §5.3 footnote 와 일치.
   - **gap**: spec §6 의 `LLM_RATE_LIMIT` / `LLM_RESPONSE_INVALID` 는 "reserved — 현재 핸들러는 `LLM_CALL_FAILED` 로 통합 / fallback 으로 회복" 으로 명시 — handler 는 429 도 catch-all 로 `LLM_CALL_FAILED` 로 묶고, JSON 파싱 실패는 `:415-424` substring fallback 으로 회복. spec ↔ impl 정합 (예약 상태).

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 0 (5필드): 정상 / 에러 모두 `{ config, output, meta, port }` 4 필드 — `status` 생략 (종결 단계 단일이라 합리적). 부합.
   - Principle 1.1 (config↔output 직교): `output.originalInput` (에러 시 top-level) 이 `config.inputField` 와 의미적으로는 다르다 (`inputField` = raw expression `{{ }}`, `originalInput` = resolved 입력) — 직교성은 유지. 그러나 정상 `output.result.originalInput` 와 에러 `output.originalInput` 의 위치 비대칭이 다운스트림 표현식 분기를 강제. 기존 plan §"진단 1" 권고 그대로.
   - Principle 2: `meta.{durationMs, model, *Tokens, llmCalls}` 정합. `llmCalls` 는 ai-agent 의 `turnDebug[i].llmCalls` 와 위치만 다르고 의도 동일 (single-call 노드는 turn wrapper 불필요) — 기존 plan §"진단 2" 의 통일 검토 권고 유효.
   - Principle 3: `output.error.{code, message, details}` 표준 envelope 부합.
   - Principle 5: `port: string` (single-label) / `port: string[]` (multi-label fan-out) / `port: 'fallback' | 'error'`. Principle 6 의 `class_<i>` index fallback (`:27-29` `buildCategoryPortIds` → `resolveStablePortId`) 적용. 부합.
   - Principle 7: `:104-116` `configEcho` 가 `categories`(raw)/`inputField`(raw, `{{ }}` 보존)/`multiLabel` 을 항상 echo, optional `llmConfigId`/`model`/`instructions` 는 정의된 경우만 echo. spec §5.1 예시와 일치.
   - Principle 8.2: `output.result.{category|categories}` 통일 wrapper 부합.

6. **handler 테스트 (`text-classifier.handler.spec.ts`)**:
   - validate / single-label 정상·fallback·JSON parse 실패·substring fallback / multi-label / `includeEvidence` 의 cap·필터·empty fallback / `includeConfidence` 0 falsy 안전 / custom `category.id` 라우팅·`class_<i>` index fallback / `error` 포트·meta 메트릭 (`:331-396`) 까지 폭넓게 커버 (총 1077 줄).
   - `meta.durationMs` 측정 기준 단일화 (성공 / fallback / error 모두 `executeStartedAt` 기준) 가 명시되어 있고 (`:87-90`) 테스트가 검증 (`:345-367`).
   - **미세 누락**: spec §5.3 의 `output.error.details.originalInput` truncate 500자 cap 의 boundary test (501자 입력 → 500자) 가 직접 케이스로 보이지 않음.
   - ConversationThread push (`pushClassifierTurn` `:54-70`) 은 별도 `text-classifier.thread.spec.ts` (134 줄) 가 spec §1.4 v2 의 single-label/multi-label `appendAiAssistantMessage` 호출을 검증.

7. **횡단 일관성 (AI 3종)**:
   - LLM common wrapper 부합 — `output.result.*` / `output.error.*` 정합.
   - `originalInput` 패턴 — 정상 `output.result.originalInput` / 에러 `output.originalInput` (top-level) + `output.error.details.originalInput` (truncated). ai-agent 의 multi-turn `output.result + output.error 병존` (§7.9 footnote) 과 시멘틱 의도가 비슷하나 path 다름. **info-extractor 도 single-turn 에러 시 `output.error.details.originalInput` 만 두는 단일 위치 정책** — text_classifier 만 top-level + details 두 곳에 둠.
   - error 코드 명명 — `LLM_CALL_FAILED` 는 3 노드 공통. text-classifier 는 단일 코드만 발화 (다른 코드는 reserved). info-extractor 는 `LLM_RESPONSE_INVALID` / `MAX_COLLECTION_RETRIES_EXCEEDED` 추가. ai-agent 는 어느 코드도 발화 안 함 (handler 미구현).

8. **구현 품질**:
   - `sanitizeEvidence` (`:545-555`) 의 `MAX_EVIDENCE_ITEMS = 20` / `MAX_EVIDENCE_ITEM_LENGTH = 200` cap 은 spec §4 마지막 줄과 일치. non-string 필터링까지 견고.
   - `resolveStablePortId` 호출 (`:28`) — port-id.util.ts 의 단일 진실 공급원 (frontend resolver 와 동일 규칙).
   - `truncateForErrorDetails` (`:11`) — `core/error-codes.ts` 의 공통 helper 사용 (다른 노드와 통일).
   - dead code 없음. legacy `error: z.string().optional()` 필드가 schema 의 output autocomplete (`schema.ts:124`) 에 남아 있으나 handler 는 사용 안 함 — Principle 3 envelope 이전의 잔재로 보임.

## 종합 개선안 (2026-05-16)

> **병렬 편집 주의 (2026-05-29)**: `spec/4-nodes/3-ai/2-text-classifier.md §5.3` 은 [`spec-update-ai-error-output-fields`](../spec-update-ai-error-output-fields.md) plan 이 `details.retryable` (필수) + `"status": "ended"` 를 이미 보강했다 (main 반영 완료). 아래 §5.3 관련 `(spec)` 항목을 진행할 때는 그 갱신본을 기준으로 편집한다 (`originalInput` 정책은 직접 충돌 없음 — retryable/status 와 직교).

- [x] (spec) §5.3 의 `output.originalInput` (top-level) 처리 정책 결정 — 옵션 A(추천): 제거 + `output.error.details.originalInput` (이미 존재, truncated) 만 유지. 옵션 B: `output.result.originalInput` 도 함께 emit 해 정상/에러 양쪽에서 path 통일. 근거: `text-classifier.handler.ts:184-209`, 기존 plan §"진단 1".
- [x] (impl) 위 결정에 따라 `:191-193` 의 `output.originalInput` 키 제거 또는 `output.result.originalInput` 보강. 단위 테스트 `:331-396` 갱신.
- [ ] (spec) `meta.llmCalls` (single-call) ↔ `meta.turnDebug[i].llmCalls` (multi-turn) 위치 통일 검토 — 옵션 A: text-classifier 도 `meta.turnDebug[0].llmCalls` wrapper 채택해 AI 3종 동일. 옵션 B: ai-agent / info-extractor 가 single-call 경로에 `meta.llmCalls` 노출 추가. 근거: 기존 plan §"진단 2", spec §5.1 의 `meta.llmCalls` ↔ `[공통 §6](../../../spec/4-nodes/3-ai/0-common.md#6-토큰-회계-meta)` 의 `meta.turnDebug` 위치 차이.
- [ ] (impl) `output.error.details.originalInput` 의 500자 cap boundary 테스트 추가 — 501자 입력이 500자로 잘리고 `output.originalInput` 은 full 유지 검증. 근거: `:173-193`, `truncateForErrorDetails`.
- [ ] (spec) §5.3 `output.error.code` 표의 `LLM_RATE_LIMIT` / `LLM_RESPONSE_INVALID` "reserved" 라벨 유지 명시 — 현 handler 는 발화하지 않음. spec ↔ impl 명시적 정합 유지.
- [ ] (impl, optional) schema autocomplete 의 legacy `error: z.string().optional()` 필드 (`text-classifier.schema.ts:124`) 제거 검토 — Principle 3 envelope 이전 잔재. `error: z.object({code, message, details}).optional()` 로 교체해 ai-agent / info-extractor schema 와 통일.
