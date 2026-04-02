### 발견사항

- **[INFO]** 변경된 코드 자체는 데이터베이스와 직접 관련 없음
  - 위치: 모든 diff 파일
  - 상세: 이번 변경은 template 노드의 표현식 해석 방식을 expression engine으로 위임하고, 관련 파일 경로를 업데이트하는 내용이 전부임. DB 조작 코드 변경 없음.

- **[WARNING]** N+1 쿼리 — 노드 실행마다 execution 레코드를 개별 조회/저장
  - 위치: `execution-engine.service.ts`, `executeNode` 메서드 내 "Update execution path" 블록
  - 상세: `runExecution`의 `sortedNodeIds` 루프에서 각 노드마다 `executionRepository.findOneBy` → `save`가 반복됨. N개 노드 실행 시 2N번의 추가 DB 쿼리 발생.
  - 제안: `executionPath` 갱신을 루프 외부로 분리하거나, TypeORM의 `update`를 사용한 단일 쿼리(`array_append` 또는 JSON 컬럼 직접 조작)로 대체. 변경된 diff와 직접 관련은 없지만 기존 코드에 존재하는 구조적 문제임.

- **[INFO]** 복합 인덱스 고려 대상
  - 위치: `waitForFormSubmission` — `nodeExecutionRepository.findOne({ where: { executionId, nodeId }, order: { startedAt: 'DESC' } })`
  - 상세: `(executionId, nodeId, startedAt DESC)` 복합 인덱스 없이 조회 시 테이블 스캔 발생 가능. 이번 변경사항과 무관하나, 현재 파일에 존재하는 쿼리.
  - 제안: `NodeExecution` 엔티티에 `@Index(['executionId', 'nodeId', 'startedAt'])` 추가 검토.

---

### 요약

이번 변경의 핵심은 template 노드의 표현식 해석을 handler 내부 자체 파서에서 execution engine의 expression resolver로 위임하는 리팩터링이며, 데이터베이스 로직에 직접적인 변경은 없다. 다만 `execution-engine.service.ts`의 전체 컨텍스트에서 기존부터 존재하던 N+1 패턴(노드 실행마다 execution path를 개별 조회·저장)은 워크플로우 노드 수에 비례해 DB 부하를 증가시키는 구조적 문제로, 별도 개선이 권장된다.

### 위험도
LOW