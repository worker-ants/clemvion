# Side Effect Review — memory-internals-refactor-813b6e

**범위**: `git diff 2b793ffa..HEAD -- codebase/`
**관점**: behavior-preserving 리팩토링 동작 불변 검증
**날짜**: 2026-06-06

---

## CRITICAL

없음.

---

## WARNING

### W1 — ai-agent.handler.ts 주석 오기: `getThreadExcludingNode` 참조 잔존
- **위치**: `/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 라인 943
- **상세**: `scheduleMemoryExtraction` 메서드의 JSDoc 주석이 "**격리 invariant**: `getThreadExcludingNode` 가 반환하는..." 이라고 기술하고 있다. 그러나 원본(merge-base)에서도 이미 `getThread(args.target)`를 사용했고, 공유 헬퍼도 동일하게 `conversationThreadService.getThread(args.target)`를 사용한다. `getThreadExcludingNode`는 이 경로에서 한 번도 호출된 적이 없다. 동작 상 무해하지만 잘못된 주석이 다음 수정자를 혼란시킬 수 있다.
- **제안**: 주석을 "`getThread` 가 반환하는 readonly turns 를 shallow-copy 한 스냅샷만 payload 에 담아..."로 정정.

### W2 — `buildAgentMemorySchemaFields` 반환 타입이 `Record<string, z.ZodTypeAny>` — spread 시 타입 손실
- **위치**: `/codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts` 라인 86, 246
- **상세**: `fields`가 `Record<string, z.ZodTypeAny>`로 선언되어 반환된다. `z.object({...buildAgentMemorySchemaFields(...)})` spread 시 TypeScript는 각 키의 정확한 Zod 타입(예: `ZodDefault<ZodEnum<...>>`)을 추론하지 못하고 `ZodTypeAny`로 flatten된다. 이는 `z.infer<typeof aiAgentNodeConfigSchema>`가 기존 인라인 정의 대비 덜 정밀한 타입을 생성할 수 있음을 의미한다. 기존에 인라인 선언에서는 각 필드가 좁은 타입(`ZodDefault<ZodEnum<['manual','summary_buffer','persistent']>>` 등)으로 추론되었다.
- **runtime 동작 영향 여부**: Zod의 `parse`/`safeParse` 런타임 동작은 타입 추론과 독립적이므로 parse 결과 자체는 변하지 않는다. 그러나 `AiAgentConfig` / `InformationExtractorConfig` 타입 추론이 의도적으로 좁은 타입을 필요로 하는 소비자에게서 타입 에러를 숨길 수 있다.
- **제안**: 반환 타입을 `as const` 패턴 또는 `buildConversationContextSchemaFields`처럼 각 필드를 `readonly` 튜플로 명시 반환하거나, `satisfies` 제약을 활용해 타입 정보를 보존.

---

## INFO

### I1 — DEFAULT_MEMORY_* 값 동치 확인 (이상 없음)
- `shared/agent-memory-schema.ts`: `TOKEN_BUDGET=8000`, `TOP_K=5`, `THRESHOLD=0.7`
- `ai-agent.schema.ts` (원본 + re-export): 동일 값
- IE 핸들러가 여전히 `ai-agent.schema`에서 `DEFAULT_MEMORY_TOP_K`, `DEFAULT_MEMORY_THRESHOLD`를 import하는 경로도 `ai-agent.schema`가 shared에서 re-export하므로 런타임 값 동치 유지.

### I2 — `resolveMemoryTtlDays` 경계 동작 불변 확인 (이상 없음)
- 원본 ai_agent private 메서드: `typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN; if (!isFinite(n) || n <= 0) return undefined; return Math.floor(n)`
- 원본 IE private 메서드: 동일 로직
- 공유 헬퍼: byte-identical 로직. 경계값 0/음수/NaN/"30"/1.7 처리 동일.

### I3 — `scheduleMemoryExtraction` 헬퍼화 payload 동치 확인 (이상 없음)
- `workspaceId`, `scopeKey`, `llmConfigId`, `model`, `extractionModel`, `embeddingModel`, `turns`, `ttlDays` — 원본과 공유 헬퍼 모두 동일 필드를 동일 방식으로 cast/주입.
- watermark 전진 로직 (M1): `!enqueued` 시 `prevWatermark` 반환, `enqueued` 시 `fresh.reduce((m,t) => t.seq > m ? t.seq : m, prevWatermark ?? -1)` — 원본 IE는 `fresh.reduce(...)` 1라인, 원본 ai_agent는 `maxSeq` 변수로 분리. 공유 헬퍼는 ai_agent 패턴(변수 분리)으로 통일됐으나 수식은 동일.
- `getThread` vs `getThreadExcludingNode`: 원본 ai_agent의 `scheduleMemoryExtraction`이 이미 `getThread`를 사용했고, 공유 헬퍼도 `getThread` 사용 — 동작 동일 (W1 주석만 문제).

### I4 — IE schema `memoryStrategy` enum 분기 (2값) 불변 확인 (이상 없음)
- 원본: `z.enum(['manual', 'persistent']).default('manual')`
- 신버전: `z.enum(strategy.values)` where `values: ['manual', 'persistent']`, `.default('manual')` — 동일.
- `memoryTokenBudget`, `summaryModel`은 `tokenBudgetOrder`/`summaryModelOrder` 미전달 시 방출 안 됨 — IE 호출부에서 두 옵션 모두 미전달 → 동일.

### I5 — 파일 이전 경로 변경 (이상 없음)
- `ai-agent/agent-memory-injection.ts` → `shared/agent-memory-injection.ts`
- `ai-agent/agent-memory-injection.spec.ts` → `shared/agent-memory-injection.spec.ts`
- 두 핸들러 모두 새 경로로 import 업데이트됨. IE에서 `buildRecallBlock`, `appendStablePrefix` import도 새 경로로 이전.

### I6 — `summary_buffer` 전략 호출 경로 주석 불일치 (정보 수준)
- ai-agent handler 주석(라인 947): "`summary_buffer` / `manual` 전략은 호출되지 않는다 (회귀 금지 불변식 — 호출부가 strategy 로 분기)"라고 되어 있으나, 실제 호출부(라인 1538, 1769, 2671)는 `memoryStrategy`를 그대로 넘기며 strategy 분기 없이 호출한다. 공유 헬퍼 내부에서 `strategy !== 'persistent'` 체크로 early-return 처리된다. 원본도 동일 방식이었으므로 동작 변경 없음.

---

## 요약

이번 리팩토링은 `scheduleMemoryExtraction`, `resolveMemoryTtlDays`, `buildAgentMemorySchemaFields` 세 로직을 ai_agent 전용 파일에서 `shared/` 공유 헬퍼로 추출하고, `agent-memory-injection.ts` 파일을 `shared/`로 이동하는 pure 구조 정리다. 핵심 검토 항목(schema fragment 필드 order/label/default/visibleWhen/enum, resolveMemoryTtlDays 경계, scheduleMemoryExtraction enqueue payload·watermark·snapshot 동작, DEFAULT_MEMORY_* 값, import 경로)은 모두 원본과 동치임이 확인된다. W1(주석 오기)은 동작에 무영향하고, W2(반환 타입 손실)는 런타임 parse 동작에 영향 없으나 타입 추론 정밀도 저하로 향후 소비자 타입 에러 감지를 약화시킬 수 있다. CRITICAL 항목은 없다.

---

## 위험도

LOW

---

BLOCK: NO
