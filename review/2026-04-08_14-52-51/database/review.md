### 발견사항

---

**[WARNING]** 다중 DB 작업의 트랜잭션 부재
- 위치: `execution-engine.service.ts` — `waitForAiConversation()` 내 상태 전이 구간
- 상세: `updateExecutionStatus(... WAITING_FOR_INPUT)` → `nodeExecutionRepository.save(nodeExec)` 두 번의 쓰기가 트랜잭션 없이 순차 실행됨. 중간 크래시 시 `Execution.status = WAITING_FOR_INPUT`은 반영되었으나 `NodeExecution.status = RUNNING` 상태로 불일치가 발생함. 종료 시 완료 처리 블록(`COMPLETED` 전이)도 동일한 패턴.
- 제안: `QueryRunner`로 단일 트랜잭션 처리

---

**[WARNING]** 장시간 대화 후 Stale Entity 재사용
- 위치: `waitForAiConversation()` — 루프 시작 전 `findOne` 조회, 루프 종료 후 동일 객체 저장
- 상세: `nodeExec`가 대화 시작 시점에 한 번 조회되고, 수십 분에 달할 수 있는 대화 루프 종료 후 동일 객체를 재사용하여 저장. 루프 도중 외부에서 해당 레코드가 변경(재시작, 취소 처리 등)되었을 경우 Stale Write 위험이 있음.
- 제안: 루프 종료 후 최종 저장 직전 `findOne` 재조회, 또는 `UPDATE ... WHERE status = 'waiting_for_input'` 조건부 업데이트로 방어

---

**[WARNING]** 대화 전체 이력의 `outputData` 저장
- 위치: `waitForAiConversation()` 종료 처리 블록 — `nodeExec.outputData = context.nodeOutputCache[node.id]`
- 상세: `nodeOutputCache`에는 `_multiTurnState`(전체 messages 배열 포함)가 담겨있어, 그대로 `NodeExecution.outputData`에 저장됨. Multi Turn 20턴 + RAG 컨텍스트 기준으로 수 MB 규모의 JSON이 될 수 있으며, 대량 실행 시 `jsonb` 컬럼 스토리지 및 읽기 성능에 부담.
- 제안: 저장 시 `_multiTurnState` 필드를 제거하고 최종 응답(`response`, `turnCount`, `endReason`, `metadata`)만 저장. 전체 messages는 별도 컬럼 또는 별도 테이블로 분리 고려.

---

**[INFO]** `findOne` 쿼리의 인덱스 최적성
- 위치: `waitForAiConversation()` — `nodeExecutionRepository.findOne({ where: { executionId, nodeId }, order: { startedAt: 'DESC' } })`
- 상세: `(executionId, nodeId)` 복합 인덱스로 WHERE는 커버되나, `ORDER BY startedAt DESC`가 추가 filesort를 유발할 수 있음. 인덱스에 `startedAt`이 포함되지 않으면 성능 저하 가능.
- 제안: `NodeExecution` 엔티티의 인덱스에 `(executionId, nodeId, startedAt)` 복합 인덱스 포함 여부 확인

---

### 요약

이번 변경은 스키마 변경이나 마이그레이션을 포함하지 않으며, N+1 쿼리나 SQL 인젝션 위험은 없다. 핵심 DB 이슈는 두 가지다: 첫째, 대화 시작·종료 시 `Execution`과 `NodeExecution` 상태 전이가 트랜잭션 없이 이루어져 프로세스 크래시 시 상태 불일치가 발생할 수 있다. 둘째, 수십 분의 대화 루프 후 시작 시점에 조회한 Stale Entity를 그대로 저장하여 Stale Write 위험이 있다. 또한 전체 대화 이력이 `outputData`에 저장되는 구조는 장기적으로 스토리지 비용과 쿼리 성능에 부정적 영향을 줄 수 있으므로 별도 분리를 검토해야 한다.

### 위험도
**MEDIUM**