### 발견사항

- **[WARNING]** 비도달 노드(unreachable)에 대한 `NodeExecution` 레코드 미생성
  - 위치: `execution-engine.service.ts` — `reachable` 체크 블록 (`pointer++; continue;`)
  - 상세: 기존 `portRoutingSkipped` 방식에서는 포트 라우팅으로 건너뛴 노드에 대해 `createNodeExecution(... NodeExecutionStatus.SKIPPED)`를 호출하여 DB에 SKIPPED 레코드를 남겼습니다. 새로운 `reachable` 방식에서는 비도달 노드가 그냥 `continue`되어 `node_executions` 테이블에 아무 레코드도 생성되지 않습니다. 실행 이력 조회, 감사(audit) 쿼리, 또는 프론트엔드에서 "이 노드는 왜 실행 안 됐나"를 추적하는 로직이 SKIPPED 레코드 존재를 전제한다면 데이터 불일치가 발생합니다.
  - 제안: 비도달 노드도 `createNodeExecution(... SKIPPED)`를 호출하거나, 아니면 이 변경이 의도적임을 팀 내 명확히 공유하고 관련 조회 쿼리를 함께 수정하세요.

- **[INFO]** N+1 DB 쓰기 패턴 — 기존 패턴 유지
  - 위치: `runExecution` 루프 전반 (`createNodeExecution`, `nodeExecutionRepository.save`)
  - 상세: 이번 변경과 무관하게 기존부터 존재하는 패턴으로, 노드마다 개별 INSERT가 발생합니다. 워크플로우 규모가 수십 노드 이상으로 커지면 레이턴시가 누적됩니다.
  - 제안: 당장 변경 불필요하나, 장기적으로 배치 INSERT(`save([...])`) 또는 이벤트 버퍼링을 고려할 수 있습니다.

- **[INFO]** `findOneBy({ id: executionId })` — 루프 진입 시점 단건 조회
  - 위치: `executeInline` 내부 (`const execution = await this.executionRepository.findOneBy(...)`)
  - 상세: 이 변경 자체에서 쿼리가 추가된 것은 아니나, `executeInline`이 중첩 호출될 경우 부모 실행당 추가 SELECT가 발생합니다. PK 조회이므로 인덱스 사용은 보장되어 성능 위험은 낮습니다.
  - 제안: 현재 수준에서 조치 불필요.

---

### 요약

이번 변경의 핵심은 인메모리 도달 가능성(reachability) 추적 로직의 교체로, 스키마 변경·마이그레이션·인덱스·SQL 인젝션과는 무관합니다. 데이터베이스 관점에서 실질적인 위험은 **비도달 노드에 대한 `node_executions` SKIPPED 레코드 미생성** 하나입니다. 기존 코드는 포트 라우팅으로 건너뛴 노드도 DB에 기록을 남겼으나, 새 코드는 silent skip이므로 실행 이력 완전성이 낮아집니다. 이 행동 변화가 의도적인지 확인하고, 관련 조회 로직과 함께 일관되게 처리되어야 합니다.

### 위험도

**LOW**