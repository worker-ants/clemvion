# 유지보수성 리뷰 — summaryModel / extractionModel (agent-memory-summary-model-fa4efb)

리뷰어: maintainability sub-agent  
날짜: 2026-06-05  
대상 diff: `git diff origin/main..HEAD`

---

## CRITICAL

### C-1: `summaryModel` 이 `multiTurnStateBase` 에 포함되지 않아 multi-turn resume 시 항상 유실

**위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 라인 2527 vs. 2152-2191

**상세**: `processMultiTurnMessageInner` 의 resume 경로는 `state.summaryModel as string | undefined` 를 읽어 `injectMemoryContext` 의 `summaryModel` 인자로 전달한다(라인 2527). 그러나 `multiTurnStateBase`(라인 2152-2191)에 `summaryModel` 항목이 추가되지 않았다. 첫 turn 에서 `_resumeState` 가 `{ ...multiTurnStateBase, messages, ... }` 로 직렬화될 때 `summaryModel` 키가 존재하지 않으므로, turn 2 이후 `state.summaryModel` 은 항상 `undefined` 가 되고 노드 `model` 로 폴백한다. 사용자가 `summaryModel` 을 설정해도 multi-turn 에서는 두 번째 turn부터 무시된다. 동일 패턴으로 `extractionModel` 도 `multiTurnStateBase` 에 없으나, 그쪽은 `config: state` 전체를 `scheduleMemoryExtraction` 에 넘기고 내부에서 `args.config.extractionModel` 을 읽으므로 마찬가지로 turn 2+ 에서 `undefined` 가 된다. 이 행동이 의도된 graceful-degradation 이라면 코드 주석과 테스트가 명시해야 하며, 의도된 것이 아니라면 두 필드를 `multiTurnStateBase` 에 추가해야 한다. 테스트는 single-turn 케이스만 다루므로 이 시나리오가 검증되지 않는다.

**제안**:
```ts
// multiTurnStateBase 에 추가
summaryModel: config.summaryModel as string | undefined,
extractionModel: config.extractionModel as string | undefined,
```
또는 의도적 degradation이면 라인 2527 주변에 명시적 주석 추가 + multi-turn 전용 테스트 케이스 작성.

---

## WARNING

### W-1: 요약 fallback 체인이 두 곳에서 각각 인라인 표현으로 중복 구현

**위치**:
- `ai-agent.handler.ts` 라인 952: `model: args.summaryModel || args.model`
- `agent-memory-extraction.processor.ts` 라인 64-65: `extractionModel || model || llmConfig.defaultModel`

**상세**: 요약 경로의 fallback 체인(`summaryModel → model`)은 `injectMemoryContext` 내부에서 즉석 `||` 연산으로 평가된다. 추출 경로의 fallback 체인(`extractionModel → model → llmConfig.defaultModel`)은 processor 에서 별도 `const resolvedExtractionModel` 로 평가된다. 두 패턴 간 네이밍 일관성이 없다(한쪽은 변수로 분리, 한쪽은 인수 전달 시 인라인). 나중에 체인 규칙이 변경될 때(예: null-safe `??` 로 전환, 또는 빈 문자열 처리 추가) 수정 대상 위치가 분산되어 한 곳만 수정하는 실수가 발생하기 쉽다. `buildSummaryBufferUpdate` 를 호출하는 쪽에서 모델을 미리 결정해 전달하는 현재 구조는 맞지만, 핵심 fallback 로직이 호출부 인라인 표현식에 숨어 있어 가독성이 낮다.

**제안**: 함수 또는 유틸리티로 추출:
```ts
// 공통 헬퍼 (handler 또는 별도 파일)
function resolveOverrideModel(
  override: string | undefined,
  nodeModel: string,
): string {
  return override || nodeModel;
}
```
최소한 `injectMemoryContext` 내부에서도 `const resolvedSummaryModel = args.summaryModel || args.model;` 처럼 변수로 분리해 이름을 부여하면 의도가 명확해진다(processor 의 `resolvedExtractionModel` 패턴과 일치).

### W-2: `embeddingModel` schema 필드의 `widget` 이 신규 모델 필드와 불일치

**위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` 라인 596 vs. 615, 632

**상세**: `embeddingModel` 은 `widget: 'text'` 를 사용하고, 이번 PR 에서 추가된 `summaryModel` 및 `extractionModel` 은 `widget: 'expression'` 을 사용한다. 세 필드는 같은 Memory 그룹의 연속 항목(order 49.5 / 49.6 / 49.7)이며, 사용 의미도 동일하게 "모델 ID 또는 expression" 이다. UI 관점에서 같은 그룹 내 같은 의미의 필드가 다른 위젯을 사용하면 일관성이 없고 UX 오해를 유발한다(`embeddingModel` 에는 expression 변수 `{{ ... }}` 사용 불가). 단, `embeddingModel` 의 `widget: 'text'` 는 pre-existing 으로 이번 PR 의 직접 변경 대상이 아니다.

**제안**: `embeddingModel` 의 widget 을 `'expression'` 으로 통일하거나, 신규 필드들이 `'text'` 를 의도적으로 쓰지 않은 이유를 주석으로 명시. 이번 PR 에서 같이 처리하면 context 가 명확하다.

---

## INFO

### I-1: fallback 체인 주석이 여러 파일에 반복 기재

**위치**:
- `agent-memory-extraction.queue.ts` 인터페이스 JSDoc (라인 45-51)
- `agent-memory.service.ts` 메서드 파라미터 JSDoc (라인 178-180)
- `ai-agent.handler.ts` 내부 주석 (라인 1143-1145, 1640-1641, 2526-2527)
- `agent-memory-extraction.processor.ts` 주석 (라인 61-65)

**상세**: `extractionModel → model → llmConfig.defaultModel` 체인 설명이 4개 파일에 걸쳐 4회 반복된다. 사양 참조(`§3·§6.1·§12.12`)도 매 주석마다 반복된다. 규칙이 변경될 때 일부만 갱신되면 주석 불일치가 생긴다. 현재 수준은 허용 가능하나, 단일 출처 주석을 `AgentMemoryExtractionJob` JSDoc 에 두고 나머지는 "see AgentMemoryExtractionJob" 참조로 줄이는 방향이 유지보수성에 유리하다.

### I-2: `as string | undefined` 캐스팅 패턴 반복

**위치**: `ai-agent.handler.ts` 라인 1141-1149, 1641, 2527

**상세**: `args.config.extractionModel as string | undefined`, `config.summaryModel as string | undefined` 등 동일한 unsafe cast 가 반복된다. 이 패턴은 기존 코드(pre-existing)에도 널리 쓰이므로 이번 PR 고유 문제는 아니지만, 신규 필드에 동일 패턴을 답습했다. 타입 안전 헬퍼(`getStringField(config, 'summaryModel')`)가 없는 한 현재 codebase 의 관행과 일관된다.

### I-3: schema `order` 값에 소수점 사용

**위치**: `ai-agent.schema.ts` 라인 584 (49), 597 (49.5), 616 (49.6), 633 (49.7)

**상세**: 기존 `memoryTtlDays` (order 49) 와 `maxTurns` (order 50) 사이에 신규 필드 3개를 끼워넣기 위해 49.5, 49.6, 49.7 이라는 소수점 order 값을 사용했다. 사용은 가능하지만 기존 정수 order 관행과 다르며, 추후 Memory 그룹에 필드를 추가할 때 49.7과 50 사이의 "여유 공간"이 이미 좁아졌다. order 재번호 매기기(memoryTtlDays=49, embeddingModel=50, summaryModel=51, extractionModel=52, maxTurns=53)가 장기적으로 가독성이 높다.

---

## 요약

이번 PR 은 `summaryModel` / `extractionModel` 이라는 두 전용 모델 필드를 추가하며, schema 추가·fallback 체인·테스트까지 전반적으로 잘 구조화되어 있다. 주요 유지보수성 리스크는 `summaryModel` (및 `extractionModel`)이 `multiTurnStateBase` 에 포함되지 않아 multi-turn resume 시 설정이 유실된다는 점(C-1)으로, 이것이 의도된 graceful degradation인지 버그인지 명확하지 않다. 부수적으로, 요약 fallback 체인이 두 위치에서 서로 다른 스타일로 인라인 구현되어 있고(W-1), `embeddingModel` widget 타입이 신규 필드와 불일치한다(W-2). fallback 로직을 네임드 변수로 통일하고, C-1 의 multi-turn 시나리오에 대한 명시적 처리 또는 테스트를 추가하면 유지보수 부채를 줄일 수 있다.

## BLOCK: YES
