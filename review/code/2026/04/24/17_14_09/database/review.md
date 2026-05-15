### 발견사항

- **[WARNING] N+1 병렬 중복 쿼리 — `evaluateReviewGuard` 내 노드별 후보 조회**
  - 위치: `workflow-assistant-stream.service.ts` — `evaluateReviewGuard` 내 `Promise.all(snapshot.nodes.map(...))`
  - 상세: 리뷰 가드가 발동할 때마다 스냅샷의 모든 노드에 대해 `collectPendingUserConfigWithCandidates`를 병렬 호출한다. 이 메서드는 노드별로 `fillCandidates` → `lookup` → 위젯 타입별 DB 쿼리를 실행한다. 예를 들어 5개 노드가 모두 `integration-selector`(같은 `workspaceId`, 같은 `serviceType`)를 갖는다면 `integrations.findAll`이 5번 독립적으로 실행된다. 결과가 동일함에도 디듀플리케이션이 없다. `finish`가 매 실행 턴에 호출되므로 이 경로는 핫패스에 해당한다.
  - 제안: `evaluateReviewGuard` 에서 `Promise.all` 이전에 노드별 pending 필드를 수집한 뒤, 위젯 타입 × serviceType 조합을 키로 한 번만 조회하고 결과를 Map으로 캐싱해 각 노드에 분배한다. 또는 `CandidateLookupService.fillCandidates`에서 같은 widget 타입끼리 배치 조회하도록 내부 구현을 개선한다.

- **[INFO] 애플리케이션 레이어 이중 슬라이스**
  - 위치: `candidate-lookup.service.ts` — `lookupIntegrations` / `lookupLlmConfigs` / `lookupKnowledgeBases` / `lookupWorkflows`
  - 상세: `query.limit = MAX_CANDIDATES(20)`로 DB 레이어에서 이미 제한한 뒤 `result.data.slice(0, MAX_CANDIDATES)`를 다시 적용한다. 서비스가 limit을 무시하거나 인메모리 집계를 하는 경우 안전망이 되지만, 동작 신뢰성을 낮추는 중복이다.
  - 제안: DB limit이 보장된다면 애플리케이션 슬라이스를 제거하거나, limit 보장 여부를 서비스 계약 주석으로 명시한다.

- **[INFO] 복합 인덱스 존재 여부 확인 필요**
  - 위치: `candidate-lookup.service.ts` — `lookupIntegrations`
  - 상세: `integrations.findAll`은 `WHERE workspace_id = ? AND status = 'connected' [AND service_type IN (?)]` 패턴으로 실행될 가능성이 높다. `(workspace_id, status, service_type)` 또는 `(workspace_id, status)` 복합 인덱스가 없으면 워크스페이스 내 Integration 수가 늘어날수록 풀 스캔으로 성능이 저하된다. 이 쿼리는 리뷰 가드에서 노드 수만큼 반복된다.
  - 제안: `integrations` 테이블에 `(workspace_id, status, service_type)` 복합 인덱스가 없으면 마이그레이션으로 추가한다. `llm_configs`와 `knowledge_bases` 역시 `(workspace_id)` 인덱스를 확인한다.

- **[INFO] 트랜잭션 불필요 — 전부 읽기 전용**
  - 위치: `candidate-lookup.service.ts` 전체
  - 상세: 모든 DB 접근이 SELECT 전용이므로 트랜잭션 정합성 위험 없음. 쓰기는 사용자가 picker에서 Confirm 시 editor-store를 통해 프론트엔드 로컬 상태만 변경하므로 서버 측 쓰기 경로도 이 PR에는 없다.

---

### 요약

이번 변경의 DB 관련 핵심 로직은 `CandidateLookupService`의 후보 조회다. 읽기 전용 쿼리 집합이라 트랜잭션·데이터 손실 위험은 없고 페이지네이션(limit 20)도 적용되어 대량 데이터 위험은 낮다. 그러나 `evaluateReviewGuard`에서 스냅샷 전체 노드를 순회하며 동일 위젯 타입에 대해 중복 DB 쿼리를 발사하는 구조가 핫패스(매 finish 호출)에 노출되어 있어 노드가 많아질수록 불필요한 DB 부하가 누적된다. 운영 환경에서 워크플로 복잡도가 커지기 전에 디듀플리케이션 또는 배치 조회로 개선하고, Integration 테이블의 복합 인덱스를 확인하는 것이 권장된다.

### 위험도
**MEDIUM**