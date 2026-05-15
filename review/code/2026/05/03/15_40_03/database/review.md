### 발견사항

- **[WARNING]** AI 노드 실행마다 반복되는 동일 DB 쿼리 (N+1 유사 패턴)
  - 위치: `execution-engine.service.ts` — `filterAiNoLlmProviderError` → `llmService.hasDefaultLlmConfig(workspaceId)` → `llmConfigService.findDefault(workspaceId)`
  - 상세: `filterAiNoLlmProviderError`는 노드 실행 직전 유효성 검사 단계에서 호출된다. 하나의 워크플로우에 AI 노드(`ai_agent`, `text_classifier`, `information_extractor`)가 N개 존재하면, **동일한 `workspaceId`에 대해 `findDefault` DB 쿼리가 N회 실행**된다. `workspaceId`의 기본 LLM 설정은 실행 도중 변경되지 않으므로 이 반복은 불필요한 DB 부하다.
  - 제안: `ExecutionContext` 또는 실행 옵션 객체에 `hasDefaultLlmConfig` 결과를 캐싱하거나, `filterAiNoLlmProviderError` 외부에서 한 번만 resolve한 뒤 플래그(`defaultLlmResolved: boolean`)로 주입한다. 또는 `LlmService.hasDefaultLlmConfig` 내부에 짧은 TTL(예: 실행 단위 or 수초) 인메모리 캐시(`Map<workspaceId, { result: boolean, ts: number }>`)를 두는 것도 실용적이다.

- **[INFO]** `findDefault` 쿼리의 인덱스 의존성
  - 위치: `llm.service.ts` — `hasDefaultLlmConfig` → `llmConfigService.findDefault(workspaceId)`
  - 상세: `findDefault`는 내부적으로 `WHERE workspace_id = ? AND is_default = true` 형태의 쿼리를 실행할 것으로 추정된다. 위 WARNING의 반복 호출이 개선되더라도, 해당 컬럼에 복합 인덱스 `(workspace_id, is_default)`가 없다면 테이블 풀 스캔이 발생할 수 있다. 변경된 코드 범위에는 마이그레이션이 포함되어 있지 않으므로 기존 인덱스 현황을 확인할 것.
  - 제안: `LlmConfig` 엔티티 또는 마이그레이션에 `(workspace_id, is_default)` 복합 인덱스가 존재하는지 검토한다.

---

### 요약

이번 변경의 핵심 DB 관련 이슈는 `filterAiNoLlmProviderError`가 AI 노드 유효성 검사 시점에 매번 `llmConfigService.findDefault`를 호출한다는 점이다. 워크플로우 내 AI 노드 수만큼 동일한 `workspaceId`에 대한 쿼리가 중복 실행되어 불필요한 DB 부하가 발생한다. 워크플로우 실행 컨텍스트 수준에서 한 번만 resolve하고 결과를 재사용하도록 개선하면 해결된다. 스키마 변경, 마이그레이션, 트랜잭션, SQL 인젝션 측면에서는 이번 변경으로 인한 추가 위험은 없다.

### 위험도
LOW