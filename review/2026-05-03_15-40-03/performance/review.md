### 발견사항

---

**[HIGH] AI 노드 수만큼 반복되는 `hasDefaultLlmConfig` DB 쿼리 (N+1)**
- 위치: `execution-engine.service.ts` — `filterAiNoLlmProviderError` 메서드
- 상세: 동일 `workspaceId`에 대해 AI 노드(`ai_agent`, `text_classifier`, `information_extractor`)가 N개 있을 경우, 노드 검증 루프 안에서 `this.llmService.hasDefaultLlmConfig(workspaceId)`가 N번 호출된다. `llm.service.ts`의 `hasDefaultLlmConfig`는 캐싱 없이 매번 `findDefault` DB 쿼리를 발행한다. 이에 비해 `listModels`는 명시적인 TTL 캐시(`listModelsCache`)를 보유하지만, `hasDefaultLlmConfig`는 동일한 보호 장치가 없다.

  ```typescript
  // llm.service.ts — 캐싱 없음
  async hasDefaultLlmConfig(workspaceId: string): Promise<boolean> {
    if (!workspaceId) return false;
    const config = await this.llmConfigService.findDefault(workspaceId); // 매번 DB 히트
    return config !== null;
  }
  ```

  AI 노드 5개를 포함하는 워크플로우가 실행될 때, 같은 workspace 정보를 5번 조회하게 된다.

- 제안: `LlmService`에 `listModelsCache`와 동일한 패턴으로 짧은 TTL(예: 30~60초)의 인메모리 캐시를 추가하거나, `ExecutionContext`에 첫 조회 결과를 저장해 실행 생명주기 동안 재사용한다.

  ```typescript
  // 옵션 A: LlmService에 캐시 추가
  private readonly defaultConfigCache = new Map<string, { value: boolean; fetchedAt: number }>();
  private readonly DEFAULT_CONFIG_CACHE_TTL_MS = 60_000;

  async hasDefaultLlmConfig(workspaceId: string): Promise<boolean> {
    if (!workspaceId) return false;
    const cached = this.defaultConfigCache.get(workspaceId);
    if (cached && Date.now() - cached.fetchedAt < this.DEFAULT_CONFIG_CACHE_TTL_MS) {
      return cached.value;
    }
    const config = await this.llmConfigService.findDefault(workspaceId);
    const value = config !== null;
    this.defaultConfigCache.set(workspaceId, { value, fetchedAt: Date.now() });
    return value;
  }
  ```

---

**[WARNING] `filterAiNoLlmProviderError`가 노드 검증 핫 패스에 async await를 추가**
- 위치: `execution-engine.service.ts:2161–2176`
- 상세: 기존 검증 로직은 동기였으나, 이 변경으로 `handler.validate()`가 실패하는 모든 AI 노드에서 이벤트 루프 양보가 추가된다. DB 쿼리 없이 early-return하는 분기(`!AI_LLM_PROVIDER_NODE_TYPES.has(nodeType)`, `!errors.includes(...)`, `!workspaceId`)들은 즉시 반환하므로 큰 문제는 없지만, 캐시가 없는 상태에서 실제 DB 쿼리까지 도달하는 경우에는 순차 실행 지연이 발생한다.
- 제안: 위의 캐시 도입으로 자연히 완화된다. 구조 자체는 early-return 체인이 잘 구성되어 있어 추가 변경은 불필요하다.

---

**[WARNING] `LlmConfigSelector`의 `configs.find()` 미메모이즈**
- 위치: `llm-config-selector.tsx:25`
- 상세: `configs.find((c) => c.isDefault)`가 매 렌더링마다 실행된다. `configs` 배열은 React Query 캐시에서 오므로 참조가 안정적이지만, 이 컴포넌트는 부모 렌더링에 따라 자주 리렌더될 수 있다. LLM 설정 수가 수십 개를 넘지 않는 현실적 규모에서는 영향이 작으나, `useMemo`로 명시적으로 안정화할 수 있다.
- 제안:
  ```tsx
  const defaultConfig = useMemo(() => configs.find((c) => c.isDefault), [configs]);
  ```

---

**[INFO] `workflow-canvas.tsx`의 이중 타입 폴백 패턴**
- 위치: `workflow-canvas.tsx:113–116`
- 상세: `(llmConfigsData?.data as ...) ?? (llmConfigsData as ...) ?? []` 패턴은 API 응답 형태의 불일치를 런타임에 흡수하려는 의도이나, 매 렌더링마다 두 번의 타입 캐스트와 nullish 평가가 수행된다. `useMemo`로 감싸져 있어 `llmConfigsData`가 바뀔 때만 재계산되므로 실제 비용은 낮다. 다만 API 응답 타입을 고정하면 이 패턴 자체를 제거할 수 있다.
- 제안: `llmConfigsApi.getAll()`의 반환 타입을 `LlmConfigData[]`로 통일하거나, axios 인터셉터 레벨에서 `.data` 언래핑을 처리해 이중 폴백을 제거한다.

---

**[INFO] `buildInitialConfig`의 무조건 객체 복사**
- 위치: `workflow-canvas.tsx:122`
- 상세: `const config = { ...(defaultConfig ?? {}) }`는 AI 노드가 아니어도 항상 새 객체를 생성한다. 노드 추가는 빈도가 낮아 실제 성능 영향은 없지만, AI 노드 여부를 먼저 확인하고 그 외에는 원본을 그대로 반환하면 불필요한 할당을 줄일 수 있다.
- 제안:
  ```typescript
  const buildInitialConfig = useCallback(
    (nodeType: string, defaultConfig: Record<string, unknown> | undefined) => {
      if (!LLM_PROVIDER_NODES.has(nodeType) || !defaultLlmConfigId) {
        return defaultConfig ?? {};
      }
      const config = { ...(defaultConfig ?? {}) };
      if (!config.llmConfigId) config.llmConfigId = defaultLlmConfigId;
      return config;
    },
    [defaultLlmConfigId],
  );
  ```

---

### 요약

이번 변경의 핵심 성능 위험은 `filterAiNoLlmProviderError`의 **캐시 없는 DB 쿼리 반복**이다. 동일 워크스페이스에 AI 노드가 여러 개 있는 워크플로우에서 노드 수에 비례해 `findDefault` DB 쿼리가 발행되는 N+1 패턴이 형성된다. `LlmService`가 `listModels`에 이미 TTL 캐시를 구현해 둔 선례가 있으므로, 동일 패턴을 `hasDefaultLlmConfig`에도 적용하면 대부분의 위험이 해소된다. 프론트엔드 측 변경(캐시 공유 쿼리, `useMemo` 감싸기)은 전반적으로 적절히 최적화되어 있어 추가 조치가 시급하지 않다.

### 위험도

**MEDIUM** — 실제 서비스 트래픽에서 AI 노드를 다수 포함하는 워크플로우가 빈번하게 실행될 경우 DB 부하로 나타날 수 있으며, 해결책이 명확하고 기존 코드베이스에 패턴도 존재하여 수정 난도는 낮다.