## 발견사항

### [WARNING] 다중 DB 작업의 트랜잭션 부재
- **위치**: `execution-engine.service.ts` — `waitForAiConversation()` 내
- **상세**: `updateExecutionStatus(... WAITING_FOR_INPUT)`와 `nodeExecutionRepository.save(nodeExec)` 두 번의 DB 쓰기가 트랜잭션 없이 순차적으로 실행됨. 중간에 프로세스 크래시 시 `Execution.status = WAITING_FOR_INPUT`은 반영되었으나 `NodeExecution.status`는 여전히 `RUNNING`인 불일치 상태가 될 수 있음.
  ```typescript
  await this.updateExecutionStatus(savedExecution, ExecutionStatus.WAITING_FOR_INPUT);
  // 여기서 크래시 발생 시 NodeExecution은 RUNNING 상태 유지
  if (nodeExec) {
    nodeExec.status = NodeExecutionStatus.WAITING_FOR_INPUT;
    await this.nodeExecutionRepository.save(nodeExec);
  }
  ```
  종료 시의 완료 처리도 동일한 패턴 반복.
- **제안**: `QueryRunner`를 사용하여 Execution 상태와 NodeExecution 상태 변경을 단일 트랜잭션으로 묶을 것.

---

### [WARNING] 오래된 nodeExec 엔티티 사용 (Stale Entity)
- **위치**: `waitForAiConversation()` — `nodeExec` 조회 후 대화 루프 종료 시점
- **상세**: `nodeExec`는 대화 시작 시점에 **한 번** 조회되고, 대화 루프(최대 수십 분 소요 가능)가 끝난 뒤 동일 객체를 재사용하여 저장. 루프 도중 다른 프로세스나 재시작으로 해당 레코드가 변경되었다면 변경 내용을 덮어쓸 위험이 있음.
  ```typescript
  // 루프 시작 전 조회
  const nodeExec = await this.nodeExecutionRepository.findOne({ ... });

  // 수십 분의 대화 루프 ...

  // 루프 종료 후 동일 객체를 그대로 저장 (최신 DB 상태 미확인)
  nodeExec.outputData = context.nodeOutputCache[node.id];
  await this.nodeExecutionRepository.save(nodeExec);
  ```
- **제안**: 루프 종료 후 최종 저장 직전에 `findOne`으로 레코드를 재조회하거나, 업데이트 시 `UPDATE ... WHERE id = ? AND status = 'waiting_for_input'` 조건부 업데이트로 방어 처리.

---

### [WARNING] 대화 이력 대용량 데이터의 outputData 저장
- **위치**: `waitForAiConversation()` 종료 처리 블록
- **상세**: `nodeExec.outputData`에 전체 대화 이력(`messages` 배열)이 그대로 저장됨. Multi Turn 모드에서 최대 20턴 × RAG 컨텍스트가 쌓이면 수십 KB~수 MB 규모의 JSON이 될 수 있음. 대부분의 RDBMS의 `jsonb`/`json` 컬럼은 허용하지만, 대량 실행 시 스토리지 증가 및 읽기 성능 저하 요인이 됨.
- **제안**: `outputData`에는 최종 응답(`response`, `metadata`, `turnCount` 등 요약 정보)만 저장하고, 전체 `messages`는 별도 컬럼 또는 별도 테이블에 분리 저장 고려.

---

### [INFO] findOne 쿼리의 인덱스 최적성
- **위치**: `waitForAiConversation()` — `nodeExecutionRepository.findOne`
  ```typescript
  const nodeExec = await this.nodeExecutionRepository.findOne({
    where: { executionId, nodeId: node.id },
    order: { startedAt: 'DESC' },
  });
  ```
- **상세**: `(executionId, nodeId)` 복합 인덱스가 존재할 경우 `WHERE` 절은 효율적으로 처리되나, `ORDER BY startedAt DESC`를 위한 정렬이 추가적인 filesort를 유발할 수 있음. 기존 인덱스 구성에 따라 `(executionId, nodeId, startedAt)` 복합 인덱스가 필요할 수 있음.
- **제안**: `NodeExecution` 엔티티의 인덱스 정의를 확인하여 `startedAt`이 포함된 복합 인덱스 존재 여부를 검토.

---

## 요약

변경된 코드는 AI Agent Multi Turn 대화 기능의 실행 엔진 측 DB 처리를 담당한다. 핵심 DB 관련 이슈는 두 가지로, 첫째 Execution과 NodeExecution 상태 전이가 트랜잭션 없이 이루어져 불일치 상태가 발생할 수 있고, 둘째 장시간 대화 루프 중 조회한 엔티티를 루프 종료 후 재검증 없이 저장하여 Stale Write 가능성이 있다. 스키마 변경이나 마이그레이션은 없으며, N+1 문제와 SQL 인젝션 위험은 없다. 대화 이력의 대용량 저장 패턴은 장기적으로 스토리지 관리에 주의가 필요하다.

## 위험도

**MEDIUM**