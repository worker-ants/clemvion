# 데이터베이스(Database) 리뷰 결과

## 발견사항

- **[INFO]** `last_run` 정렬 시 correlated subquery 성능
  - 위치: `workflows.service.ts` — `findAll` 메서드, `sort === 'last_run'` 분기 (라인 1444–1452)
  - 상세: `(SELECT MAX(e.started_at) FROM execution e WHERE e.workflow_id = w.id)` 는 결과 행마다 execution 테이블을 풀스캔한다. `execution(workflow_id, started_at)` 복합 인덱스가 없으면 워크플로 수가 많아질수록 쿼리 비용이 선형 증가한다. 현재 코드에는 해당 인덱스 존재 여부가 보이지 않는다.
  - 제안: `execution` 테이블에 `CREATE INDEX idx_execution_workflow_started ON execution (workflow_id, started_at DESC)` 를 확인·추가한다. 인덱스가 있으면 index scan only 로 처리되어 subquery 오버헤드를 최소화할 수 있다.

- **[INFO]** `findAll` 에서 `getCount()` 와 `getMany()` 를 별도 호출
  - 위치: `workflows.service.ts` 라인 1458–1462
  - 상세: `totalItems` 를 위한 `getCount()` 와 실제 데이터를 위한 `getMany()` 가 각각 별도 쿼리로 발행된다. 대용량 테이블에서 `COUNT(*)` 비용이 존재하나, 현재 구조(페이지네이션 spec 준수)에서는 불가피하다. 성능 이슈가 발생하면 `COUNT` 를 `ESTIMATE` 로 대체하거나 캐시를 고려할 수 있다.
  - 제안: 현재로는 허용 수준. 워크플로 수가 수십만 건 이상으로 증가하면 `pg_relation_size` 기반 추정치나 materialized view 를 검토한다.

- **[INFO]** `syncNodes` 내 `manager.remove` 개별 삭제 가능성
  - 위치: `workflows.service.ts` 라인 1941
  - 상세: `manager.remove(Node, nodesToDelete)` 는 배열을 받으나, TypeORM 의 `remove` 는 내부적으로 행마다 DELETE 쿼리를 발행할 수 있다. 삭제 대상 노드가 많을 경우 N 개의 DELETE 가 발생한다.
  - 제안: `manager.delete(Node, { id: In(nodesToDelete.map(n => n.id)) })` 방식의 단일 DELETE IN 쿼리로 교체하면 라운드트립을 줄일 수 있다.

- **[INFO]** `exportWorkflow` 에서 노드·엣지 별도 조회 (순차 쿼리)
  - 위치: `workflows.service.ts` 라인 1549–1550
  - 상세: `nodeRepository.find` 와 `edgeRepository.find` 가 순차적으로 실행된다. 두 쿼리는 독립적이므로 `Promise.all` 병렬 실행이 가능하다.
  - 제안: `const [nodes, edges] = await Promise.all([this.nodeRepository.find(...), this.edgeRepository.find(...)])` 으로 병렬화한다. (참고: `getGraphWarnings` 에서는 이미 `Promise.all` 패턴을 올바르게 사용하고 있다.)

## 긍정적 사항

- **SQL 인젝션 방어**: `sort` 파라미터를 화이트리스트(`getSortColumn` 메서드)로 검증하고, `last_run` 서브쿼리 문자열은 사용자 입력을 전혀 반영하지 않는다. 테스트 케이스 `'미허용 sort 는 created_at 폴백 (injection 차단)'` 도 이를 명시적으로 검증하고 있다.
- **트랜잭션**: `create`, `saveCanvas`, `importWorkflow` 모두 `dataSource.transaction` 으로 원자성 보장.
- **LLM 조회 호이스팅**: `importWorkflow` 에서 AI 노드가 여러 개여도 `modelConfigService.findDefault` 를 트랜잭션 외부에서 1회만 호출하여 N+1 DB 왕복을 방지한다.
- **배치 insert**: `importWorkflow` 의 노드/엣지 배치 `manager.insert` 로 N 왕복 → ~3 왕복 최적화.
- **파라미터화 쿼리**: 모든 `andWhere` 호출이 바인딩 파라미터(`:workspaceId`, `:userId`, `:search`, `:tag`, `:folderId`)를 사용한다.

## 요약

이번 변경의 핵심은 `findAll` 에 `last_run` correlated subquery 정렬을 추가한 것으로, 인젝션 방어와 NULLS LAST 처리는 올바르게 구현되어 있다. 데이터베이스 관점에서의 주요 위험은 `execution(workflow_id, started_at)` 복합 인덱스 누락 시 subquery 성능 저하이나, 이는 스키마 마이그레이션으로 해결 가능한 INFO 수준이다. 트랜잭션 사용, 파라미터화 쿼리, LLM 호이스팅 등 전반적인 DB 접근 패턴은 양호하다.

## 위험도

LOW
