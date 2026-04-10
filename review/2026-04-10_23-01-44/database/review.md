### 발견사항

- **[WARNING]** unreachable 노드에 대한 `node_executions` SKIPPED 레코드 미생성
  - 위치: `execution-engine.service.ts` — `reachable` 체크 블록 (`if (!reachable.has(nodeId)) { pointer++; continue; }`)
  - 상세: 기존 `portRoutingSkipped` 방식은 포트 라우팅으로 건너뛴 노드마다 `createNodeExecution(executionId, nodeId, NodeExecutionStatus.SKIPPED)`를 호출하여 `node_executions` 테이블에 레코드를 남겼습니다. 새 `reachable` 방식은 비도달 노드를 `pointer++`로 무음 처리하여 DB에 아무 기록도 생성하지 않습니다. 실행 이력 조회(`SELECT * FROM node_executions WHERE execution_id = ?`) 시 해당 실행에서 어떤 노드가 건너뛰어졌는지 추적할 수 없게 됩니다. 감사(audit) 로그, 실행 디버깅, 또는 프론트엔드의 노드 상태 조회가 `node_executions` 레코드 존재를 전제하고 있다면 데이터 불일치가 발생합니다.
  - 제안: disabled 노드 처리 코드와 동일하게 unreachable 노드에도 `createNodeExecution(executionId, nodeId, NodeExecutionStatus.SKIPPED)`를 호출하여 이력 완전성을 유지하거나, 이 변경이 의도적 설계 결정임을 명확히 문서화하고 관련 조회 쿼리와 UI 로직을 함께 수정하세요.

- **[INFO]** N+1 DB 쓰기 패턴 유지 — 기존 패턴 상속
  - 위치: `runExecution` 루프 전반 (`createNodeExecution`, `nodeExecutionRepository.save`)
  - 상세: 이번 변경과 무관하게 기존부터 존재하던 패턴입니다. unreachable 노드에 SKIPPED 레코드를 추가하지 않으므로 오히려 DB 쓰기 횟수는 줄어듭니다. 단, 포트 라우팅 브랜치가 많은 대형 워크플로우에서 실행 노드마다 개별 INSERT가 발생하는 구조는 여전히 유지됩니다.
  - 제안: 당장 조치 불필요하나 장기적으로 배치 INSERT(`save([...])`) 또는 이벤트 버퍼링 고려 가능.

- **[INFO]** `findOneBy({ id: executionId })` — 루프 진입 시점 단건 PK 조회
  - 위치: `executeInline` 내부 (`const execution = await this.executionRepository.findOneBy(...)`)
  - 상세: 이번 변경에서 새로 추가된 쿼리가 아니며, PK 기반 조회이므로 인덱스 활용이 보장됩니다. 성능 위험 낮음.
  - 제안: 현재 수준에서 조치 불필요.

---

### 요약

이번 변경은 인메모리 실행 라우팅 로직 교체(`portRoutingSkipped` → `reachable`)로, 스키마 변경·마이그레이션·인덱스·SQL 인젝션과는 무관합니다. 데이터베이스 관점에서 유일한 실질적 위험은 **비도달 노드에 대한 `node_executions` SKIPPED 레코드가 더 이상 생성되지 않는다는 점**입니다. 기존 코드는 포트 라우팅으로 건너뛴 노드도 DB에 SKIPPED 상태로 기록하여 실행 이력의 완전성을 보장했으나, 새 코드는 해당 노드를 완전히 무시하므로 실행 이력 추적 및 감사 기능에 공백이 생깁니다. 이 변경이 의도된 것인지 확인하고, 관련 조회 로직과 일관되게 처리해야 합니다.

### 위험도
**LOW**