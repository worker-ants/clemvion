## 성능 코드 리뷰 — `assistant-integration` 브랜치

---

### 발견사항

---

#### **[WARNING] `renderNodeCatalog()` 미캐시 — 매 LLM 턴마다 O(n) 재계산**

- **위치**: `system-prompt.ts` — `buildSystemPrompt()` 상단, `renderNodeCatalog(nodeDefs)` 호출부
- **상세**: `expressionReferenceCache` 는 모듈 수명 내 1회만 계산하는 잘 설계된 캐시인 반면, `renderNodeCatalog(nodeDefs)` 는 캐시가 없어 매 LLM 턴마다 전체 노드 정의를 순회해 카탈로그 문자열을 재조립한다. 노드 정의는 서버 시작 시 레지스트리에 등록된 후 불변이므로, 이 O(n) 연산은 캐시 대상이다. 노드가 수십 개 이상일 경우 턴이 쌓일수록 누적 비용이 된다.
- **제안**:
  ```typescript
  let nodeCatalogCache: string | null = null;
  // export for test isolation if needed
  export function resetNodeCatalogCacheForTesting() { nodeCatalogCache = null; }

  function getCatalog(nodeDefs: NodeDefinitionView[]): string {
    if (nodeCatalogCache !== null) return nodeCatalogCache;
    nodeCatalogCache = renderNodeCatalog(nodeDefs);
    return nodeCatalogCache;
  }
  ```
  `expressionReferenceCache` 와 동일한 패턴. 노드 정의 변경 시(런타임 동적 등록이 가능한 경우) 레지스트리 변경 이벤트로 캐시를 무효화한다.

---

#### **[WARNING] `chat()` / `stream()` — `params.messages` 3회 순회 + 변환 로직 중복**

- **위치**: `anthropic.client.ts` — `chat()` L22-55, `stream()` L175-207 (동일 코드 블록)
- **상세**: 두 메서드 모두 `params.messages`를 다음과 같이 3회 순회한다.
  1. `.filter(m => m.role === 'system')` → 시스템 메시지 추출
  2. `.map(m => m.content)` → 내용만 취합
  3. `.filter(m => m.role !== 'system').map(...)` → Anthropic 포맷 변환

  동일한 배열을 3번 읽는다. 또한 이 변환 로직과 `tool_choice` 구성 로직이 `chat()`/`stream()` 양쪽에 **그대로 복사**되어 있어, 추후 최적화 또는 버그 수정을 한쪽에만 적용하는 실수가 생긴다. 히스토리가 길어질수록(수십 ~ 수백 메시지) 비용 차이가 드러난다.
- **제안**: 메시지 변환을 `private buildMessages(params: ChatParams)` 로 추출해 단일 패스로 처리한다.
  ```typescript
  private buildMessages(params: ChatParams): {
    system: string | undefined;
    messages: Anthropic.MessageParam[];
  } {
    const systemParts: string[] = [];
    const messages: Anthropic.MessageParam[] = [];
    for (const m of params.messages) {
      if (m.role === 'system') { systemParts.push(m.content); continue; }
      // ... 기존 변환 로직
      messages.push(converted);
    }
    return { system: systemParts.join('\n\n') || undefined, messages };
  }
  ```

---

#### **[WARNING] `tool_choice` 구성 로직 중복 — `chat()` / `stream()` 양쪽에 동일 블록**

- **위치**: `anthropic.client.ts` — `chat()` L62-82, `stream()` L217-237
- **상세**: `params.toolChoice`에 따라 `base` 객체를 만들고 `disable_parallel_tool_use: false`를 붙이는 조건 분기가 두 메서드에 완전히 동일하게 존재한다. 위 `buildMessages()` 추출과 함께 `buildRequestToolChoice()` 헬퍼로 분리하면 유지보수·성능 회귀 위험을 동시에 줄인다.
- **제안**: `private buildToolChoice(params: ChatParams): Anthropic.ToolChoiceParam | undefined` 헬퍼로 추출.

---

#### **[INFO] `renderActivePlanSection()` — `steps` 배열 2회 필터**

- **위치**: `system-prompt.ts` — `renderActivePlanSection()` 내부
- **상세**:
  ```typescript
  const totalActionable = ctx.plan.steps.filter((s) => s.action !== 'note');
  const doneCount = totalActionable.filter((s) => ctx.completedStepIds.has(s.id)).length;
  ```
  동일 배열을 2회 순회한다. 플랜 스텝은 보통 5–20개이므로 실질 영향은 극소, 그러나 단일 루프로 통합 가능하다.
- **제안**:
  ```typescript
  let totalActionable = 0, doneCount = 0;
  for (const s of ctx.plan.steps) {
    if (s.action === 'note') continue;
    totalActionable++;
    if (ctx.completedStepIds.has(s.id)) doneCount++;
  }
  ```
  `completedStepIds`가 `Set`이므로 `has()` 는 이미 O(1) — 변경 후에도 전체 O(n) 유지.

---

#### **[INFO] `JSON.parse` / `JSON.stringify` 왕복 — 툴 호출 인수**

- **위치**: `anthropic.client.ts` — `chat()` L44 (`JSON.parse(tc.arguments)`), `stream()` L308 (`block.argsParts.join('')` 후 소비 측 parse)
- **상세**: `tc.arguments`는 이미 JSON 문자열인데 `JSON.parse` 후 Anthropic SDK에 넘기고, SDK 응답의 `block.input`은 객체인데 다시 `JSON.stringify`한다. 이 직렬화 왕복은 타입 안전성을 위해 현재 구조에서 불가피하나, 크고 복잡한 툴 인수(예: 긴 워크플로우 설정 패치)에서는 유의미한 비용이다. 현재로서는 수용 가능하나, 툴 호출 빈도가 높아지면 재검토 대상이다.
- **제안**: 단기는 현상 유지. 장기적으로 `arguments`를 parsed 형태로 캐리하는 내부 인터페이스 변경을 검토.

---

#### **[INFO] `ASSISTANT_TOOLS` 모듈 상수 + `Object.freeze` — 잘 최적화됨**

- **위치**: `tool-definitions.ts` — 파일 하단 `ASSISTANT_TOOLS` 선언
- **상세**: `buildAssistantTools()`가 매 턴 호출되어도 동일한 frozen 배열 참조를 반환한다. 도구 정의 재생성 비용 0. 현재 구현 좋음.

---

#### **[INFO] `expressionReferenceCache` — 잘 설계된 lazy 캐시**

- **위치**: `system-prompt.ts` — `getExpressionReferenceSection()`, `resetExpressionCacheForTesting()`
- **상세**: `getAllFunctionNames().sort().join(', ')` 및 대형 문자열 조립을 프로세스 수명 내 1회로 제한. 테스트 격리용 리셋 API도 제공. 모범 패턴으로 `renderNodeCatalog` 캐싱 시 그대로 적용 가능.

---

### 요약

전반적으로 아키텍처 수준의 성능 설계(정적 블록 모듈 상수, `expressionReferenceCache`, `ASSISTANT_TOOLS` frozen 상수)는 잘 되어 있다. 핵심 개선 여지는 두 곳이다: 첫째, `renderNodeCatalog()`가 매 LLM 턴마다 O(n) 재계산되는 부분은 `expressionReferenceCache`와 동일한 패턴으로 캐싱하면 턴 누적 비용을 제거할 수 있다. 둘째, `chat()`·`stream()` 양쪽에 중복된 메시지 변환 + `tool_choice` 구성 로직을 공유 헬퍼로 추출하면 메시지 배열 순회 횟수를 3→1회로 줄이고 코드 분기를 제거할 수 있다. 나머지 항목은 운영 규모에서 유의미하지 않다.

### 위험도

**LOW** — 현재 트래픽·데이터 규모에서 즉각적인 장애 위험은 없으나, `renderNodeCatalog` 미캐시와 메시지 변환 중복은 LLM 호출 빈도가 높아질수록 선형으로 누적되는 개선 대상이다.