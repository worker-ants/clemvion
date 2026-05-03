### 발견사항

---

**[WARNING] 테스트에서 `AI_NO_LLM_PROVIDER_MESSAGE` 상수를 직접 복사**
- 위치: `execution-engine.service.spec.ts:2982`
- 상세: `NO_LLM_MSG`를 한국어 문자열 리터럴로 직접 정의했는데, 이것은 `llm-provider-rule.ts`의 `AI_NO_LLM_PROVIDER_MESSAGE`와 동일한 내용입니다. 메시지가 바뀌면 이 테스트는 변경을 감지하지 못하고 조용히 통과합니다. SSOT를 만든 이유가 바로 이 문제를 방지하기 위함인데, 테스트 자체가 그 약속을 깨고 있습니다.
- 제안: `import { AI_NO_LLM_PROVIDER_MESSAGE } from '../../nodes/ai/llm-provider-rule';`로 교체하여 상수를 재사용

---

**[WARNING] API 응답 이중 형태 정규화 로직이 두 컴포넌트에 중복**
- 위치: `workflow-canvas.tsx:114–118`, `llm-config-selector.tsx:24`
- 상세: `(llmConfigsData?.data as LlmConfigData[] | undefined) ?? (llmConfigsData as LlmConfigData[] | undefined) ?? []` 패턴이 두 곳에서 독립적으로 등장합니다. API 응답 형태가 `{ data: T[] }` 또는 `T[]` 두 가지일 수 있다는 것은 API 클라이언트 계층이 정규화를 책임져야 하는 사실입니다. 이 패턴이 셋째 컴포넌트에 복사될 때 버그가 생길 수 있습니다.
- 제안: `llmConfigsApi.getAll()`이 항상 `LlmConfigData[]`를 반환하도록 정규화하거나, `useQuery` 래퍼 훅으로 추출

---

**[WARNING] `llmService` 캐스팅 패턴이 테스트 4곳에 반복**
- 위치: `execution-engine.service.spec.ts` — `describe('AI no-llm-provider rule...')` 내 4개 테스트
- 상세:
  ```typescript
  const llm = (
    service as unknown as { llmService: { hasDefaultLlmConfig: jest.Mock } }
  ).llmService;
  llm.hasDefaultLlmConfig.mockResolvedValue(true/false);
  ```
  이 패턴이 각 `it()` 블록마다 반복됩니다. `describe` 스코프에 `let llm` 을 선언하고 `beforeEach`에서 할당했다면 4번의 중복 타입 단언을 제거할 수 있었습니다.
- 제안:
  ```typescript
  let llm: { hasDefaultLlmConfig: jest.Mock };
  beforeEach(() => {
    llm = (service as any).llmService;
  });
  ```

---

**[WARNING] 프론트·백엔드 AI 노드 타입 집합이 별도로 관리됨**
- 위치: `backend/src/nodes/ai/llm-provider-rule.ts:30–33`, `frontend/src/lib/utils/node-config-summary.ts:30–34`
- 상세: `AI_LLM_PROVIDER_NODE_TYPES`(백엔드)와 `LLM_PROVIDER_NODES`(프론트엔드)가 동일한 3개 노드 타입을 각각 독립적으로 정의합니다. 새 AI 노드 타입(`image_generator` 등)을 추가할 때 두 파일을 모두 업데이트해야 하는데, 하나를 빠뜨리면 백엔드는 에러를 필터링하지만 프론트는 경고 뱃지를 숨기지 못하는(또는 그 반대) 불일치가 생깁니다. 주석에도 "SSOT"라고 명시했으나 프론트에는 이 연결이 문서화되어 있지 않습니다.
- 제안: `llm-provider-rule.ts` 파일 상단 또는 `node-config-summary.ts` 내에 "이 목록은 백엔드 `AI_LLM_PROVIDER_NODE_TYPES`와 동기화를 유지해야 함" 주석을 명시하거나, 공유 패키지로 추출

---

**[INFO] `Filterable` 로컬 타입이 private 메서드 시그니처를 복제**
- 위치: `execution-engine.service.spec.ts:2989–2996`
- 상세: `Filterable` 타입은 `filterAiNoLlmProviderError`의 파라미터 타입을 수동으로 명세합니다. 실제 구현의 `ExecutionContext` 타입을 그대로 쓰지 않고 `{ variables?: Record<string, unknown> }`로 축약해서 정의했기 때문에, 메서드 시그니처가 바뀌어도 컴파일 오류가 발생하지 않습니다.
- 제안: 가능하면 `Parameters<typeof (service as any)['filterAiNoLlmProviderError']>` 같은 방식으로 실제 타입과 연결하거나, `// keep in sync with filterAiNoLlmProviderError signature` 주석 추가

---

**[INFO] `buildContext('')` 와 테스트 명칭의 의미 불일치**
- 위치: `execution-engine.service.spec.ts:3063`
- 상세: 테스트 이름이 "keeps the error when workspaceId is **missing** in context"인데 실제로는 `buildContext('')` — 즉 키가 존재하지만 빈 문자열인 경우를 테스트합니다. "absent" (키 없음)과 "empty string"(빈 문자열)은 의미상 다를 수 있어, 미래 독자가 혼동할 여지가 있습니다.
- 제안: 테스트 이름을 `'keeps the error when workspaceId is empty string'`으로 변경하거나, 두 경우(키 없음 / 빈 문자열)를 별도 테스트로 분리

---

### 요약

이번 변경은 `AI_NO_LLM_PROVIDER_MESSAGE`와 `AI_LLM_PROVIDER_NODE_TYPES`를 공유 상수로 추출하는 등 SSOT 설계 의도가 명확하고, `filterAiNoLlmProviderError`의 조기 반환 구조도 간결합니다. 다만 그 SSOT 원칙이 테스트 내부(`NO_LLM_MSG` 리터럴 복사)와 프론트엔드(`LLM_PROVIDER_NODES` 별도 정의)에서 부분적으로 깨지고 있으며, API 응답 이중 형태 정규화 로직이 두 컴포넌트에 중복되어 API 계층의 책임 경계가 흐려졌습니다. 이 네 가지 사항을 정리하면 향후 AI 노드 타입 추가나 메시지 변경 시 놓치는 지점을 방지할 수 있습니다.

### 위험도

**LOW**