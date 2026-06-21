# Rationale 연속성 검토 결과

검토 범위: `spec/4-nodes/3-ai` (구현 착수 전 검토, --impl-prep)
검토 대상: M-1 1단계 `AiConditionEvaluator` 추출 및 2단계 `AiMemoryManager` 착수 준비

---

## 발견사항

이 검토는 `spec/4-nodes/3-ai` 내 Rationale 섹션(주로 `1-ai-agent.md §12`)과 현재 refactor 계획(plan/in-progress/refactor/02-architecture.md §M-1) 간의 정합성을 검토했다.

### 발견사항 없음 (충돌·위반 없음)

검토 결과, 아래 관점 모두에서 충돌이 발견되지 않았다.

**1. 기각된 대안의 재도입 — 없음**

- `1-ai-agent.md §12.9` Rationale: `memoryStrategy` 를 `contextScope` enum 확장(`auto`)으로 두는 안을 기각하고 별도 필드로 도입했다. 현재 M-1 계획 및 `AiConditionEvaluator` 추출은 이 결정을 건드리지 않는다. 추출된 클래스는 조건 평가 로직(cond_* 도구 빌드·분류·reason 추출)만 다루며 memoryStrategy 필드 구조에 개입하지 않는다.

- `1-ai-agent.md §12.12` Rationale: `summaryModelConfigId`/`extractionModelConfigId` 를 (a) 전용 필드 미도입(v1 scope-freeze 기각) → (b) 모델명 문자열 전용 필드 도입(번복) → (c) 등록 ModelConfig `config.id` 선택 + provider 디커플(재번복) 세 단계를 거쳐 확정했다. 옛 `summaryModel`/`extractionModel` 문자열 형태나 `llmConfigId` 단일 재사용 안은 모두 명시적으로 폐기됐다. 현재 M-1 추출 작업은 메모리 관련 필드를 변경하지 않아 이 결정과 무관하다.

- `02-architecture.md §C-2` Rationale: 엔진↔WebsocketService 쌍에 대해 `IExecutionEventEmitter` 류 이벤트 포트 추상화 도입을 명시적으로 기각했다(`spec/5-system/4-execution-engine.md §4.4` 근거). `AiConditionEvaluator`는 이벤트 발행과 무관한 순수 입출력 단위라 이 기각 결정에 저촉되지 않는다.

**2. 합의된 원칙 위반 — 없음**

- `1-ai-agent.md §5.1` 조건 도구 등록 원칙: 조건 도구 이름은 `cond_{sanitizeId(condition.id)}`, description은 `condition.prompt`, parameters는 `{ required: [] }` (reason 은 선택 인자). `AiConditionEvaluator.buildConditionTools()`는 이 사양을 그대로 준수하며, spec 주석(`// required: [] 는 spec/4-nodes/3-ai/1-ai-agent.md §5.1 의 도구 스키마 명시값`)까지 달아 의도를 명시한다.

- `1-ai-agent.md §5.2` 조건 도구 호출 처리 원칙: 복수 조건 도구 동시 호출 시 `conditions` 배열에서 인덱스가 가장 작은 항목을 선택. `AiConditionEvaluator.classifyToolCalls()`는 `conditions.indexOf(cond)` 비교로 정확히 이 우선순위를 구현한다.

- `1-ai-agent.md §5.1 + §6.1 step 3` tool 분류 원칙: spec 은 provider(KB/MCP/render) / condition / normal(일반 도구 stub) 분류를 정의한다. `AiConditionEvaluator.classifyToolCalls()`의 3분류(providerToolCalls / conditionToolCalls / normalToolCalls)는 이 spec 패턴과 정확히 일치한다. `AgentToolProvider.matches()` 위임으로 provider 범주를 외부화해 핸들러의 `toolProviders` 등록 순서(kb→mcp→render)에 의한 분류 결정성이 보존된다.

- `1-ai-agent.md §5.1` reason 상한 (`max 500자`): `CONDITION_REASON_MAX_CHARS = 500` 상수가 spec 값과 일치한다.

**3. 결정의 무근거 번복 — 없음**

`02-architecture.md §M-1`은 추출 범위(조건 평가만), 배치(`nodes/ai/ai-agent/` 하위 co-location), `processMultiTurnMessage` 시그니처 핸들러 잔류(§1.3 polymorphic 계약 보존)를 명시적으로 결정하고 있으며, 모두 spec 대조 판정 D(spec 무언급, 비저촉)로 정합성이 유지된다.

**4. 암묵적 가정 충돌 — 없음**

- `1-ai-agent.md §6.1 step 3` 의 "모든 provider prefix(`kb_`/`mcp_`/`render_`)·`cond_` 가 서로 disjoint 하므로 provider-우선 검사라도 분류 결과는 결정적" invariant: `AiConditionEvaluator.classifyToolCalls()`는 provider 매칭을 먼저 검사한 후 condition 이름 집합 조회를 수행하는 동일 우선순위를 따른다.

- `1-ai-agent.md §7.4 _resumeState` invariant: `AiConditionEvaluator`는 `_resumeState` 를 읽거나 쓰지 않으므로 resume 상태 불변식에 영향이 없다.

- `spec/5-system/4-execution-engine.md §1.3` `processMultiTurnMessage` polymorphic 계약: M-1 계획이 명시적으로 "시그니처 핸들러 잔류" 를 결정했고, 1단계 구현이 이를 준수한다.

---

## 요약

`spec/4-nodes/3-ai` 의 Rationale 섹션(`1-ai-agent.md §12.1~12.14`, `0-common.md §Rationale`)은 조건 평가·메모리 전략·요약/추출 모델·시스템 컨텍스트 주입 등에 걸쳐 다수의 기각 대안과 합의된 원칙을 기록하고 있다. 현재 검토 대상인 M-1 1단계(`AiConditionEvaluator` 추출, commit `24ca3340`)는 이 Rationale 결정 중 어느 것도 번복하거나 위반하지 않는다. 추출은 spec §5.1/§5.2/§6.1 이 규정한 조건 도구 등록·분류·reason 추출 동작을 behavior-preserving 으로 클래스 단위로 분리한 것이며, 기각된 대안(contextScope enum 확장, 이벤트 포트 추상화, provider 단일화 등)과 직교하는 구조 변경이다. 2단계 `AiMemoryManager` 착수를 위해서는 `1-ai-agent.md §12.9~12.14` 의 Rationale 동작 보존 체크리스트(summaryModelConfigId/extractionModelConfigId provider 디커플 불변식, language-aware 휴리스틱 적용 범위 한정, messages 물리 압축의 user 경계 보존 불변식 등)가 구현 설계의 입력으로 참조되어야 하며, 이는 plan `02-architecture.md §M-1` 2단계 항목에 이미 명시되어 있다.

---

## 위험도

NONE

STATUS: OK
