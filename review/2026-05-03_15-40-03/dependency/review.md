### 발견사항

- **[INFO]** 신규 외부 패키지 없음 — 기존 패키지만 활용
  - 위치: 전체 변경 파일
  - 상세: 모든 신규 import(`@tanstack/react-query`, `@nestjs/*`)는 이미 의존성 목록에 존재하는 패키지이며, `useQuery`는 `LlmConfigSelector`가 동일 queryKey로 이미 사용 중입니다.
  - 제안: 유지

- **[WARNING]** `hasDefaultLlmConfig` — 노드 실행 핫패스에서 N회 DB 조회 가능
  - 위치: `execution-engine.service.ts` — `filterAiNoLlmProviderError`
  - 상세: 유효성 검증 에러가 있는 AI 노드마다 `llmService.hasDefaultLlmConfig(workspaceId)` → `llmConfigService.findDefault(workspaceId)` DB 쿼리가 발생합니다. 결과를 캐시하지 않으므로 동일 실행 내 AI 노드가 여럿이면 동일 `workspaceId`로 반복 조회합니다.
  - 제안: `filterAiNoLlmProviderError` 호출 전 또는 `ExecutionEngineService` 내부에서 `workspaceId → boolean` 결과를 `Map`으로 실행 단위 내 캐싱하거나, `LlmService.hasDefaultLlmConfig`에 짧은 TTL in-memory 캐시를 추가합니다.

- **[INFO]** 프론트/백엔드 AI 노드 타입 목록 이중 관리
  - 위치: `backend/src/nodes/ai/llm-provider-rule.ts` — `AI_LLM_PROVIDER_NODE_TYPES`, `frontend/src/lib/utils/node-config-summary.ts` — `LLM_PROVIDER_NODES`
  - 상세: 두 상수가 동일한 세 노드 타입(`ai_agent`, `text_classifier`, `information_extractor`)을 각각 정의합니다. 프론트-백엔드 번들 분리로 공유는 불가하지만, 새 AI 노드 타입 추가 시 양쪽 모두 수정해야 한다는 점이 명확히 문서화되어 있지 않습니다.
  - 제안: 두 파일의 주석 또는 `CLAUDE.md`에 "새 AI 노드 추가 시 이 두 곳을 동시에 갱신해야 함"을 명시합니다.

- **[INFO]** API 응답 형태 이중 처리 패턴
  - 위치: `workflow-canvas.tsx:115-118`, `llm-config-selector.tsx:24`
  - 상세: `data?.data ?? data ?? []` 패턴이 두 파일에서 반복됩니다. 이는 `llmConfigsApi.getAll()`의 반환 타입이 `{ data: LlmConfigData[] }` 또는 `LlmConfigData[]`로 불확정적임을 의미하며, TypeScript 타입 안전성을 우회합니다. 이 패턴은 이번 변경이 도입한 것이 아니라 기존 코드를 복사한 것이지만, 새 파일에서 노출됩니다.
  - 제안: `llmConfigsApi.getAll()`의 반환 타입을 정규화(`AxiosResponse<LlmConfigData[]>` 혹은 `LlmConfigData[]` 단일 형태)하여 방어 코드를 제거합니다.

- **[INFO]** `execution-engine` → `nodes/ai` 계층 간 의존 방향
  - 위치: `execution-engine.service.ts:54-57`
  - 상세: `modules/execution-engine`이 `nodes/ai/llm-provider-rule`을 직접 import합니다. 상수 전용 파일이므로 런타임 부담은 없으나, 실행 엔진이 특정 노드 카테고리를 직접 인식하는 결합이 생깁니다. 현재 범위는 읽기 전용 상수로 한정되어 위험도는 낮습니다.
  - 제안: 수용 가능. 단, 향후 `handler.validate`가 `{ errors: string[], ruleIds: string[] }` 형태를 반환하도록 인터페이스가 확장되면 이 직접 의존을 제거할 수 있습니다.

---

### 요약

이번 변경에서 신규 외부 패키지는 전혀 추가되지 않았으며, 기존 패키지(`@tanstack/react-query`, `@nestjs/*`)의 기능을 캐시 공유 방식으로 재활용합니다. `llm-provider-rule.ts` SSOT 파일 도입으로 3개 스키마의 메시지 상수가 통일된 것은 의존성 중복 제거 측면에서 적절합니다. 주된 의존성 리스크는 `hasDefaultLlmConfig`의 실행 핫패스 내 반복 DB 조회로, 동일 워크스페이스의 다수 AI 노드를 포함한 워크플로우에서 불필요한 쿼리가 누적될 수 있습니다. 프론트/백엔드 AI 노드 타입 목록의 이중 관리는 구조적 한계이지만 문서화로 완화 가능합니다.

### 위험도
**LOW**