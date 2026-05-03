### 발견사항

- **[WARNING]** `filterAiNoLlmProviderError`에서 AI 노드 실행마다 DB 쿼리 발생
  - 위치: `execution-engine.service.ts` — `filterAiNoLlmProviderError`, `hasDefaultLlmConfig` 호출부
  - 상세: 동일 워크스페이스 ID에 대해 AI 노드 수만큼 `llmService.hasDefaultLlmConfig` → `llmConfigService.findDefault` DB 쿼리가 반복 실행된다. 같은 실행 내에서 워크스페이스 기본 LLM 설정은 변하지 않으므로 불필요한 중복 쿼리다.
  - 제안: `filterAiNoLlmProviderError` 호출 전 실행 컨텍스트 또는 호출 스택 상위에서 결과를 한 번만 조회하고 전달하거나, `ExecutionContext`에 `defaultLlmConfigCache` 필드를 두어 워크스페이스당 1회만 조회한다.

- **[WARNING]** 노드 추가 시점의 로딩 race condition
  - 위치: `workflow-canvas.tsx` — `defaultLlmConfigId` useMemo, `buildInitialConfig`
  - 상세: `useQuery`가 완료되기 전(로딩 중)에 사용자가 AI 노드를 드래그·더블클릭으로 추가하면 `defaultLlmConfigId`는 `null`이고, 노드 config에 `llmConfigId`가 채워지지 않는다. 이후 쿼리가 완료되어도 이미 생성된 노드는 갱신되지 않는다.
  - 제안: `isLoading` 상태를 확인해 노드 추가 동작을 막거나, 노드 추가 후 쿼리가 완료된 시점에 미설정 AI 노드에 한해 `llmConfigId`를 일괄 보정하는 후처리를 추가한다.

- **[WARNING]** 테스트에서 `__workspaceId` 완전 부재 케이스가 누락됨
  - 위치: `execution-engine.service.spec.ts` — `'keeps the error when workspaceId is missing in context'`
  - 상세: `buildContext('')`는 `{ variables: { __workspaceId: '' } }`를 생성해 빈 문자열 케이스를 테스트한다. 그러나 `__workspaceId` 키 자체가 `variables`에 없는 경우(`buildContext(undefined)`)는 테스트되지 않는다. 두 경로 모두 구현상 동일하게 처리되지만 테스트로 보장되지 않는다.
  - 제안: `buildContext(undefined)` 케이스를 별도 `it`으로 추가해 키 부재 시에도 에러가 보존됨을 명시적으로 검증한다.

- **[INFO]** 프론트엔드 `LLM_PROVIDER_NODES`와 백엔드 `AI_LLM_PROVIDER_NODE_TYPES`가 별도 유지
  - 위치: `node-config-summary.ts`, `llm-provider-rule.ts`
  - 상세: 동일한 노드 타입 집합(`ai_agent`, `text_classifier`, `information_extractor`)이 두 곳에 중복 정의되어 있다. 새 AI 노드 추가 시 양쪽 모두 수정해야 한다.
  - 제안: 공유 패키지(`@workflow/node-summary` 등)에 단일 상수를 두고 양쪽이 임포트하도록 하거나, 최소한 주석으로 동기화 의무를 명시한다.

- **[INFO]** API 응답 이중 fallback 패턴이 두 파일에 반복됨
  - 위치: `workflow-canvas.tsx` L112–115, `llm-config-selector.tsx` L24
  - 상세: `data?.data ?? data ?? []`로 두 가지 응답 shape를 동시에 처리하는 방어 코드가 복수 위치에 등장한다. API가 항상 `{ data: [...] }` 형태를 반환한다면 두 번째 fallback은 불필요하다.
  - 제안: `llmConfigsApi.getAll`의 반환 타입을 고정하고 호출부의 방어 코드를 제거한다.

- **[INFO]** `noDefaultHint`가 로딩 중에 잠깐 노출될 수 있음
  - 위치: `llm-config-selector.tsx` — `!defaultConfig && value === ""` 조건
  - 상세: 컴포넌트 마운트 직후 configs가 빈 배열일 때(`isLoading` 상태) `defaultConfig`가 `undefined`이므로 힌트 메시지가 순간 표시될 수 있다.
  - 제안: `useQuery`의 `isLoading` 또는 `isPending` 플래그를 조건에 포함해 로딩 중에는 힌트를 숨긴다.

---

### 요약

핵심 비즈니스 로직(워크스페이스 기본 LLM이 있을 때 `no-llm-provider` 에러를 후처리로 필터링, 프론트엔드 캔버스에서 신규 AI 노드에 기본 LLM 자동 선택)은 구현과 테스트 모두 의도에 맞게 작성되어 있으며, `AI_NO_LLM_PROVIDER_MESSAGE` 상수를 통한 SSOT 정리도 적절하다. 다만 동일 실행 내에서 반복 DB 쿼리가 발생하는 성능 이슈, 노드 추가 직후 쿼리 미완료 상태의 race condition, 테스트에서 `__workspaceId` 키 완전 부재 케이스 미검증 등 세 가지 항목이 운영 환경에서 예상치 못한 동작을 유발할 수 있어 보완이 필요하다.

### 위험도

**LOW**