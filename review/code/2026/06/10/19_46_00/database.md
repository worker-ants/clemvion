# 데이터베이스(Database) Review

본 변경셋은 성능 백로그(refactor/01-performance) 구현으로, **스키마 변경(DDL)·마이그레이션은 전혀 없고** 기존 쿼리의 형태/횟수를 줄이는 리팩터링이다. DB 관점 핵심 변경은 4건: perf #1(N+1 제거), perf #4(대시보드 6쿼리→2쿼리), perf #10(import 행단위 save→배치 insert), perf #2(S3 배치삭제 — DB 아님). 검토 결과 데이터 정합성·인덱스 측면에서 안전하며, 발견은 모두 INFO 수준이다.

## 발견사항

### perf #1 — rehydration N+1 제거 (execution-engine.service.ts)

- **[INFO]** nodeId 당 `findOne` 직렬 왕복 → 단일 `In()` 배치 조회로 N+1 제거. 모범적 수정.
  - 위치: `execution-engine.service.ts` rehydrateContext (diff @@ -1306,27 +1330,45)
  - 상세: `find({ where: { executionId, nodeId: In(seenNodeIds), status: COMPLETED }, order: { startedAt: 'DESC' } })`. 마이그레이션 `V034 (execution_id, node_id, started_at DESC)` 복합 인덱스가 `execution_id` 등치 + `node_id IN(...)` + `started_at DESC` 정렬을 정확히 커버함을 확인했다(코드 주석의 인덱스 주장 검증 완료). `status = COMPLETED` 는 인덱스 컬럼이 아니지만, `(execution_id, node_id)` prefix 로 후보 row 가 이미 충분히 좁혀지므로 잔여 필터 비용은 무시 가능.
  - 파라미터화: TypeORM `In()` / 객체 where — 안전(SQL 인젝션 없음).
  - 의미론: `startedAt` DESC 전역 정렬에서 nodeId 별 첫 등장 row 채택 = 기존 per-node `findOne(order DESC)` 와 동일. spec 회귀 테스트(파일 5)가 "nodeId 당 최신 COMPLETED 1건" 불변식을 고정.
  - 제안: 없음.

### perf #4 — 대시보드 6쿼리 5왕복 → 집계 2쿼리 (dashboard.service.ts)

- **[INFO]** `COUNT(*) FILTER (WHERE ...)` / `AVG(...) FILTER (...)` 로 분모·분자 의미론을 SQL 안에 통합. 왕복 감소 + 의미론 명시화로 양호.
  - 위치: `dashboard.service.ts` getSummary (diff @@ -56,38 +56,64)
  - 상세: workflow 집계 1쿼리(`COUNT(*)`, `COUNT(*) FILTER (WHERE w.is_active)`) + execution 집계 1쿼리(7d/prev7d/success7d/avg7d FILTER). 인덱스 측면: workflow 쪽은 `idx_workflow_workspace_active (workspace_id, is_active)` 가, execution 쪽은 `inner join e.workflow` + `w.workspace_id = ?` + `e.started_at >= 14일` 범위 스캔으로 `idx_execution_workflow_started (workflow_id, started_at DESC)` 를 활용한다(확인 완료). FILTER 절은 모두 동일 14일 후보집합 내 조건부 집계라 추가 인덱스 불필요.
  - 파라미터화: `:workspaceId`, `:sevenDaysAgo`, `:completedStatus`, `:fourteenDaysAgo` 모두 바인딩 — 안전. FILTER 내부 `e.status = :completedStatus` 도 enum 값 바인딩.
  - 정합성 주의(검증됨): `prev7d = COUNT(*) FILTER (WHERE e.started_at < :sevenDaysAgo)` 는 WHERE 의 `>= :fourteenDaysAgo` 하한과 결합해 [14d, 7d) 구간을 표현 — 기존 두 `getCount()` 와 동일. 단위 테스트(파일 3)가 분모(total7d) 의미·경계값(prev7d=0, total7d=0, avg null)을 고정.
  - DB 호환성: `FILTER (WHERE ...)` 는 PostgreSQL 9.4+ 표준 SQL 집계 필터. 프로젝트가 PG 전용이므로 portability 우려 없음.
  - 제안: 없음. (참고: 두 집계 쿼리는 `Promise.all` 병렬화 가능하나, 왕복 6→2 이미 달성했고 의존성 없는 독립 쿼리라 추가 최적화는 선택사항.)

### perf #10 — importWorkflow 행단위 save 루프 → 배치 insert (workflows.service.ts)

- **[INFO]** N개 node `save` + P개 update + M개 edge `save` 루프(N+P+M 왕복) → UUID 앱측 사전생성 + `manager.insert` 배치 2회(~3 왕복). 트랜잭션 안에서 수행되어 원자성 보존.
  - 위치: `workflows.service.ts` importWorkflow (diff @@ -265,9 +267,15 / @@ -279,7 +287,25)
  - 상세: `randomUUID()` 로 nodeId 사전 생성 후 containerIndex/toolOwnerIndex remap 을 insert 페이로드에 즉시 포함 → 2차 update 루프 제거. 모든 작업이 기존 `dataSource.transaction`(manager) 컨텍스트 내부라 부분 실패 시 롤백됨(정합성 안전).
  - **주의(코드에 명시됨, 적절)**: `manager.insert` 는 `@BeforeInsert` hook·cascade 를 건너뛴다. 주석에서 "Node/Edge 엔티티에 둘 다 없음(2026-06-10 확인). 향후 hook 추가 시 배열 save 로 되돌릴 것" 으로 가드를 문서화. 이는 정확한 위험 인지이며, 장래 회귀 방지 장치로 적절하다.
  - 대량 데이터: 노드 수가 매우 큰 import(수천+)면 단일 `insert` 의 파라미터 수가 PG 의 바인딩 파라미터 상한(약 65535)에 닿을 수 있으나, import 워크플로의 현실적 노드 수를 고려하면 비현실적. 필요 시 청크 분할 여지만 남겨두면 됨(현 시점 조치 불요).
  - 파라미터화: `QueryDeepPartialEntity` 페이로드 — TypeORM 이 파라미터 바인딩, 안전.
  - 제안: 없음.

### perf #2 — KB 삭제 시 S3 배치 삭제 (knowledge-base.service.ts / s3.service.ts)

- **[INFO]** (DB 영역 아님 — 객체 스토리지) 문서 N건 직렬 단건 `s3.delete` 루프 → `deleteMany`(DeleteObjects 1000키/요청 청크). DB 측 변경은 `kbRepository.remove(kb)` 호출 위치 불변. best-effort/warn 의미론 보존. DB 정합성 영향 없음.
  - 위치: `knowledge-base.service.ts` remove (diff @@ -675,11 +675,25)
  - 상세: S3 키 수집용 문서 조회는 기존 querybuilder(`d.knowledge_base_id = :id AND kb.workspace_id = :workspaceId`) 그대로 — 파라미터화 안전. S3 배치 실패는 warn 후 KB row 삭제 진행(트랜잭션 외부 best-effort, 스펙 정책 일치).
  - 제안: 없음.

### perf #14 — env read-once 캐시 (execution-engine.service.ts)

- **[INFO]** `configService.get` 반복 호출을 lazy read-once 캐시로 — DB 무관(설정 읽기). 영향 없음.

### 프론트엔드 store/selector 변경 (execution-store.ts 외)

- **[INFO]** `selectSortedNodeResults` WeakMap 메모이즈 + 파생 index Map 도입. 클라이언트 메모리 자료구조이며 DB 와 무관. 해당 없음.

## 요약

데이터베이스 관점에서 본 변경셋은 **순수 쿼리 최적화 리팩터링**으로, DDL/마이그레이션/스키마 변경이 전혀 없어 무중단 배포 lock·데이터 손실 위험이 없다. 핵심 개선 3건(perf #1 N+1 제거, perf #4 6→2 집계쿼리, perf #10 배치 insert)은 모두 기존 인덱스(V034 복합, idx_workflow_workspace_active, idx_execution_workflow_started)로 충분히 커버되고, 모든 동적 값은 TypeORM 파라미터 바인딩을 거쳐 SQL 인젝션 위험이 없으며, import 배치 insert 는 기존 트랜잭션 안에서 수행되어 원자성을 보존한다. perf #10 의 hook/cascade 우회는 코드 주석에 명시적 가드로 문서화되어 적절하다. 발견사항은 모두 INFO 수준이며 차단·수정이 필요한 항목은 없다.

## 위험도
LOW
