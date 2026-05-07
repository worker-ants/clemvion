### 발견사항

- **[INFO]** `lookupMcpServers`의 이중 제한 (redundant slice)
  - 위치: `candidate-lookup.service.ts` — `lookupMcpServers` 메서드
  - 상세: `query.limit = MAX_CANDIDATES`로 DB 레벨에서 이미 20개로 제한하고 있음에도 `result.data.slice(0, MAX_CANDIDATES)`를 다시 적용한다. 기존 `lookupIntegrations`, `lookupKnowledgeBases` 등에서도 동일한 패턴이 반복되는데, 이는 `IntegrationsService.findAll`이 `limit`을 무시하고 전체를 반환할 수 있다는 방어적 가정에서 비롯된 것으로 보인다. 실제로 서비스가 limit을 준수한다면 불필요한 연산이고, 준수하지 않는다면 근본 원인을 수정해야 한다.
  - 제안: `IntegrationsService.findAll`이 `limit`을 DB 쿼리에 정확히 전달하는지 확인. 보장된다면 downstream slice는 제거 가능. 현재는 기존 패턴과 일관성이 있으므로 단독 수정 불필요.

- **[INFO]** `integrations` 테이블의 `(workspace_id, status, service_type)` 복합 인덱스 검증 필요
  - 위치: `candidate-lookup.service.ts` — `lookupMcpServers` (및 `lookupIntegrations`)
  - 상세: `status='connected'` AND `serviceType IN ['mcp']` 필터로 조회한다. 기존 `integration-selector`도 동일 테이블을 사용하므로 새로운 위험이 추가된 것은 아니지만, `mcp` 타입 통합이 실제로 사용되기 시작하면 워크스페이스당 통합 수가 늘어남에 따라 `(workspace_id, status, service_type)` 복합 인덱스가 없으면 풀스캔 위험이 있다.
  - 제안: `integrations` 테이블에 `(workspace_id, status, service_type)` 복합 인덱스가 이미 존재하는지 마이그레이션 파일에서 확인. 없다면 별도 마이그레이션으로 추가 권장.

### 요약

이번 변경의 DB 관련 핵심은 `candidate-lookup.service.ts`에 `lookupMcpServers` 메서드 한 개가 추가된 것으로, 기존 `lookupIntegrations`와 동일하게 `IntegrationsService.findAll`에 위임하는 읽기 전용 단일 쿼리이다. N+1 없음, 트랜잭션 불필요(읽기 전용), 마이그레이션 스키마 변경 없음 — 순수하게 기존 패턴을 재사용한 안전한 확장이다. 실질적인 DB 위험 요소는 없으며, 기존 코드베이스에서 이어진 "이중 slice 방어" 패턴과 인덱스 커버리지 확인 여부만 운영 시 주의가 필요하다.

### 위험도

LOW