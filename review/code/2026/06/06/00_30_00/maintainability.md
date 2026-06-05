# 유지보수성 코드 리뷰 — memory internals refactor

**대상 커밋 범위**: `2b793ffa..HEAD` — `codebase/` 내 변경  
**리뷰어 관점**: 유지보수성 (가독성 · 네이밍 · 중복 해소 · 응집도 · 복잡도)

---

## 발견사항

### WARNING: DEFAULT_MEMORY_* 상수의 단일 진실이 ai-agent.schema.ts 를 경유하는 간접 경로로 남아 있음

- **위치**: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` L33–35
- **상세**: 리팩터가 상수 SoT 를 `shared/agent-memory-schema.ts` 로 이전했으나, `information-extractor.handler.ts` 는 `shared/agent-memory-schema` 가 아닌 `../ai-agent/ai-agent.schema` 에서 `DEFAULT_MEMORY_TOP_K` / `DEFAULT_MEMORY_THRESHOLD` 를 가져온다. `ai-agent.schema` 는 이를 `SHARED_` 별칭으로 재수출하는 하위호환 relay 이므로 런타임 값은 동일하지만, 의존 그래프상 IE 핸들러 → AI Agent 스키마 → shared 라는 2단 경로가 형성된다. 새 노드가 같은 패턴을 따르면 의도치 않게 ai-agent 스키마에 의존하게 되고, `ai-agent.schema.ts` 의 relay 를 삭제하거나 이름을 변경할 때 IE 핸들러가 조용히 깨진다.
- **제안**: `information-extractor.handler.ts` 의 import 를 `'../ai-agent/ai-agent.schema'` → `'../shared/agent-memory-schema'` 로 교체한다. `ai-agent.schema.ts` 의 relay export 는 AI Agent 핸들러 전용으로만 남기거나, 코멘트에 "IE 핸들러는 이 경로를 쓰지 않는다"는 제약을 명시한다.

---

### WARNING: `scheduleMemoryExtraction` 위임 래퍼에 `selfNodeId` 사용 불가 인자가 남아 있음

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L951–982 (private `scheduleMemoryExtraction`)
- **상세**: private 메서드 시그니처가 `selfNodeId: string` 을 받지만 공유 헬퍼 호출부(L968–981)로 전달하지 않는다. 주석(L965–967)이 "추적용으로만 받는다"고 설명하지만, 함수가 아무 작업에도 이 인자를 사용하지 않으므로 실질적 dead parameter다. 호출부(L1414, L1541, L1772, L2674 등 6곳)는 모두 `selfNodeId: context.nodeId ?? ''` 를 전달한다. 이 인자가 없어도 동작이 동일한데 6개 호출부마다 강제로 채워야 하므로 유지보수 표면이 불필요하게 크다.
- **제안**: `selfNodeId` 인자를 제거하거나, 실제로 로깅/추적에 쓰일 계획이 있다면 공유 헬퍼 `ScheduleMemoryExtractionArgs` 에 optional 필드로 추가해 IE와 ai-agent 모두 일관되게 전달하도록 한다.

---

### WARNING: `injectRecallPrefix` 핵심 패턴이 두 핸들러에 걸쳐 중복됨 (recall 경로만 미공유)

- **위치**: `ai-agent.handler.ts` L754–799 vs `information-extractor.handler.ts` L291–346
- **상세**: `scheduleMemoryExtraction` 와 `resolveMemoryTtlDays` 는 공유 헬퍼로 추출됐으나, 회수(recall) 실행 패턴(`resolveScopeKey` → `recall` → try/catch → `buildRecallBlock` → `appendStablePrefix`)은 두 핸들러에 별도 private 메서드(`injectMemoryContext` / `injectRecallPrefix`)로 남아 있다. 로직은 구조·순서·fallback 처리(queryText 빈 경우 systemPrompt 폴백)까지 사실상 동일하다. 향후 세 번째 노드가 `persistent` 회수를 추가하면 같은 패턴을 세 번째로 복제해야 한다.
- **제안**: 이번 PR 범위 외의 추가 리팩터이므로 즉각 수정을 요구하지 않는다. 다만 `shared/agent-memory-injection.ts` 에 `performRecallAndBuildPrefix(deps, args)` 수준의 헬퍼를 준비해두면 단일 진실 확장이 자연스럽다.

---

### INFO: `BuildAgentMemorySchemaFieldsOptions` 의 optional 필드 (`tokenBudgetOrder` / `summaryModelOrder`) 가 노드 전용임을 타입에서 표현하지 않음

- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts` L65–71
- **상세**: 두 optional 필드는 "ai_agent 전용"이라고 JSDoc 에 적혀 있지만 타입상으로는 `number | undefined` 다. 이 인터페이스를 보는 개발자는 두 필드가 독립적임을 JSDoc 에서만 파악해야 한다. 반면 IE 스키마 호출부(L138–162)에는 이 두 필드가 전혀 없어 의도가 명확하다. 현재 구조는 기능상 문제없으나, `strategy.values` 가 `readonly [string, ...string[]]` 로 타입이 고정된 것과 달리 "ai_agent 전용 선택 필드"라는 제약이 타입 레벨에서 표현되지 않아 인터페이스 가독성이 낮다.
- **제안**: JSDoc 수준에서는 충분히 문서화되어 있으므로 현재 상태로 허용 가능하다. 강화하려면 두 필드를 `AiAgentOnlyMemorySchemaOptions` 타입으로 분리 후 `BuildAgentMemorySchemaFieldsOptions & Partial<AiAgentOnlyMemorySchemaOptions>` 로 구성하거나, 별도 오버로드를 제공한다.

---

### INFO: `estimateTextTokens` 와 `estimateTokensLanguageAware` 가 모두 공개 export 되어 API 표면을 이중화

- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` L75–105
- **상세**: `estimateTextTokens` 는 `estimateTokensLanguageAware` 의 단순 위임 래퍼(guard + delegate 2줄)로, 모듈 외부에서 둘 다 노출된다. 현재 외부 소비자는 없으나 공개 API 를 불필요하게 늘린다. 함수명 차이(`estimateTextTokens` vs `estimateTokensLanguageAware`)가 "memory 경로 전용" vs "일반 언어인식 추정"이라는 의미 구분처럼 읽히지만 동작은 동일하다.
- **제안**: `estimateTokensLanguageAware` 를 내부 구현 함수로 비공개화(`unexported`)하거나, `estimateTextTokens` 를 단일 공개 진입점으로만 남기고 `estimateTokensLanguageAware` 를 `_internal` 접두사 또는 비공개로 유지한다. 테스트에서 직접 `estimateTokensLanguageAware` 를 호출 중이므로 비공개화 시 테스트 임포트도 변경이 필요하다.

---

### INFO: `resolveMemoryTtlDays` 직접 단위 테스트가 이전된 홈(`agent-memory-injection.spec.ts`)에 없음

- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts`
- **상세**: `resolveMemoryTtlDays` 의 경계값 테스트(W7)는 `ai-agent.memory.spec.ts` L1185에 있으며 `execute` 호출을 통한 통합 경로로만 검증한다. 함수 자체는 이제 `shared/agent-memory-injection.ts` 에 있으나 해당 spec 파일에 직접 단위 테스트가 없다. 통합 테스트로 커버되므로 기능 안전성 문제는 아니지만, 함수의 SoT 파일과 단위 테스트 파일이 분리되어 있어 해당 함수를 수정할 때 어느 파일에 테스트를 추가해야 하는지 불분명하다.
- **제안**: `agent-memory-injection.spec.ts` 에 `resolveMemoryTtlDays` 경계값 케이스를 직접 단위 테스트로 추가한다. `ai-agent.memory.spec.ts` 의 W7 테스트는 통합 커버리지로 유지하거나 제거한다.

---

## 요약

이번 리팩터는 `resolveMemoryTtlDays`, `scheduleMemoryExtraction`, schema fragment 빌더를 `shared/` 로 추출하는 목적을 잘 수행했다. `agent-memory-injection.ts` 파일의 응집도는 "메모리 주입 관련 유틸 전체"라는 범주로 설명 가능하고 함수 단위 문서화가 충실하다. 단, `information-extractor.handler.ts` 가 shared 상수를 ai-agent 스키마를 경유해 가져오는 잔여 간접 의존이 있어 단일 진실 확보가 완전하지 않으며, ai-agent 핸들러의 위임 래퍼에 사용되지 않는 `selfNodeId` 인자가 dead parameter 로 남아 있다. recall 실행 패턴의 중복은 이번 범위에서 의도적으로 미처리한 것으로 보이나 향후 확장 시 동일 코드가 세 번째로 복제될 위험이 있다.

## 위험도

MEDIUM

---

BLOCK: NO
