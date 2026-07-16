# 동시성(Concurrency) Review

## 발견사항

- **[WARNING]** `saveCanvas` 트랜잭션 안에서 트랜잭션 밖(별도) 커넥션을 사용하는 Integration 조회 — 커넥션 풀 자원 경합/정체 위험
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` — `saveCanvas` (L426-464, 특히 L450 `await this.evaluateToolPayloadWarningsAndThrow(savedNodes, workspaceId)`), `evaluateToolPayloadWarningsAndThrow` (L648-660), `loadIntegrationForBudget` (`this.integrationRepository.findOne(...)`)
  - 상세: `saveCanvas` 는 `this.dataSource.transaction(async (manager) => {...})` 콜백 안에서 `syncNodes`/`syncEdges`(트랜잭션 `manager` 사용, 커넥션 1개 점유·row lock 보유)를 실행한 뒤, 신규 추가된 `evaluateToolPayloadWarningsAndThrow` → `loadIntegrationForBudget` 을 호출한다. 이 메서드는 `@InjectRepository(Integration)` 로 주입된 `this.integrationRepository.findOne(...)` 를 사용하는데, 이 리포지토리는 DataSource 기본 매니저에 바인딩돼 있어 **트랜잭션의 `manager` 를 재사용하지 않고 풀에서 별도 커넥션을 새로 요청**한다. 즉 하나의 `saveCanvas` 호출이 진행 중(idle-in-transaction 상태로 첫 커넥션 보유)에 동시에 두 번째 커넥션을 필요로 한다.
    코드 주석("통합 조회는 트랜잭션 밖 커밋 데이터에 대한 read-only 라 rollback 무관")은 **정합성**(rollback 여부) 측면만 다룰 뿐 **자원(커넥션 풀)** 측면은 다루지 않는다. 같은 코드베이스의 기존 관행과도 어긋난다 — 예: `agent-memory.service.ts` 의 트랜잭션 블록은 "내부 쿼리는 manager 로 실행한다" 는 명시적 규칙을 따른다.
    `codebase/backend/src/common/config/database.config.ts` 기준 `poolMax` 기본값은 10(`DB_POOL_MAX`), `poolConnectionTimeoutMs` 기본값은 **0(무기한 대기, pg 기본값)**이다. 동시에 진행 중인 `saveCanvas` 트랜잭션 수가 늘어 풀이 포화되면(모든 커넥션이 각 트랜잭션의 "1번째 커넥션"으로 점유), 각 트랜잭션이 두 번째 커넥션을 무기한 대기하게 되어 **커넥션 풀 기아/사실상 데드락**으로 이어질 수 있다(어느 트랜잭션도 자신의 1번째 커넥션을 반환하지 못함). 발생 확률은 "AI Agent + mcpServers 노드를 포함한 동시 저장 요청 수가 poolMax 에 근접"하는 부하 조건에 좌우되지만, 타임아웃이 없어(0=무기한) 트리거 시 조용한 hang 으로 나타나 장애 진단이 어렵다.
    또한 `mcpServers` 참조가 여러 개인 AI Agent 노드나 AI Agent 노드가 여러 개인 그래프는 아래 두 번째 발견사항(순차 루프)으로 인해 라운드트립 수만큼 "커넥션 1개 보유 + 커넥션 1개 추가 요청" 윈도우가 반복돼, Node/Edge row lock 보유 시간도 함께 늘어난다.
  - 제안: `loadIntegrationForBudget` 이 `saveCanvas` 경로에서는 주입된 `integrationRepository` 대신 트랜잭션의 `manager`(예: `manager.getRepository(Integration)` 또는 `manager.findOne(Integration, ...)`)를 사용하도록 배선한다. read-only 조회라 rollback 의미와 무관하므로 안전하게 적용 가능하며, 커넥션을 1개로 유지해 풀 경합 자체를 제거한다. (`getGraphWarnings` 는 트랜잭션 밖 단순 조회 endpoint 이므로 현재처럼 주입된 repository 사용 유지 가능.)

- **[WARNING]** 순차 `for...of` + `await` 루프 — 트랜잭션 지속시간 및 조회 API 지연 증가
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts` — `evaluateAiAgentToolPayloadWarnings` (L1403-1419, 그래프 내 ai_agent 노드 순회) 및 `reproduceConfigToolDefs` (L1427-1473, 노드 내 `mcpServers` 참조 순회)
  - 상세: 두 루프 모두 서로 독립적인 비동기 조회(`deps.loadIntegration(...)`)를 `for...of` + `await` 로 **순차** 실행한다. 같은 파일(`workflows.service.ts`)의 `getGraphWarnings` 는 이미 `Promise.all([nodeRepository.find, edgeRepository.find])` 로 독립 I/O 를 병렬화하는 관행을 쓰고 있지만, 신규 통합 조회는 이 패턴을 따르지 않았다. 노드별·mcpServer별 조회는 서로 다른 `integrationId` 를 대상으로 하므로 병렬화해도 안전하다. 순차 처리는 (a) 위 첫 번째 발견사항의 트랜잭션(및 그 안의 row lock) 보유시간을 AI Agent 노드/통합 참조 수에 비례해 늘리고, (b) 조회 전용 `GET /workflows/:id/graph-warnings` 응답 지연도 동일하게 늘린다.
  - 제안: `Promise.all(nodes.filter(isAiAgent).map(evaluateNode))` (필요 시 `mcpServers` 참조 단위도 `Promise.all`)로 병렬화한다. `Promise.all` 은 완료 순서와 무관하게 결과 배열의 인덱스 순서를 보존하므로, 소스 docstring 이 명시하는 "결정적 — per-node 최대 1건" 계약은 그대로 유지된다.

- **[INFO]** best-effort 평가의 "동일 스냅샷" 결정성 문구는 순차 루프 하에서 엄밀히 보장되지 않음
  - 위치: `tool-payload-save-warning.ts` L1401-1402 (`evaluateAiAgentToolPayloadWarnings` docstring: "결정적 — 동일 (nodes, 통합 상태) 스냅샷에 동일 결과.")
  - 상세: 위 순차 루프로 인해 한 번의 `getGraphWarnings`/`saveCanvas` 호출 내에서도 노드별 통합 조회 사이에 시간차가 생긴다. 그 사이 다른 요청이 해당 `Integration` row(예: 연결 해제/재연결)를 갱신하면, 같은 호출 안에서도 노드마다 다른 통합 상태를 관찰할 수 있어 "단일 스냅샷" 이라는 문구가 물리적으로는 100% 보장되지 않는다. 기능이 advisory(경고, 실패 시 fail-safe 방향으로 skip)이고 저장을 막는 경로가 아니라 실질 위험은 낮으나, 문서 문구를 "동일 호출 내에서도 완전한 원자적 스냅샷은 아님(best-effort)" 로 완화하거나, 필요하다면 관련 통합을 배치(`IN (...)`) 조회해 스냅샷화하는 것을 고려할 수 있다.

## 요약

이번 변경은 `WorkflowsService` 에 새 `evaluateAiAgentToolPayloadWarnings` backend-only async graph-warning 평가를 배선하면서, `saveCanvas` 트랜잭션 안에서 트랜잭션과 무관한(주입된) `Integration` 리포지토리로 DB 조회를 수행하도록 만들었다. 이는 데이터 정합성(경쟁 조건/락 오사용) 문제는 아니지만, 트랜잭션이 이미 점유한 커넥션과는 별개로 동일 풀에서 추가 커넥션을 요구하는 패턴이며, 코드베이스가 기존에 지켜온 "트랜잭션 내부 쿼리는 manager 로" 관행을 벗어난다. `poolConnectionTimeoutMs` 기본값이 무기한 대기이므로, 동시 부하가 커넥션 풀 크기에 근접할 경우 조용한 hang(사실상 커넥션 풀 데드락)으로 이어질 수 있는 잠재 위험이 있다. 여기에 더해 노드/참조 단위 조회가 `Promise.all` 없이 순차 처리돼 트랜잭션 보유 시간과 조회 API 지연을 불필요하게 늘린다. 두 사항 모두 즉각적인 correctness 버그는 아니지만 동시성/자원 관리 관점에서 조치를 권장하는 명확한 설계 이슈이며, 수정(트랜잭션 `manager` 재사용 + `Promise.all` 병렬화)은 국소적이고 저비용이다.

## 위험도

MEDIUM
