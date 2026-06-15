# Database Review — execution §1.3 single-node execution

**리뷰 세션**: 2026-06-15 15:29:28
**대상 브랜치**: claude/exec-test-dataset-22

---

## 발견사항

### [INFO] V098 마이그레이션: nullable 컬럼 추가 — 무중단 안전
- **위치**: `codebase/backend/migrations/V098__execution_single_node.sql`
- **상세**: `ALTER TABLE execution ADD COLUMN single_node_id UUID NULL` / `ADD COLUMN previous_execution_id UUID NULL` 두 컬럼 모두 nullable·default null. PostgreSQL에서 nullable 컬럼 추가는 테이블 전체 rewrite 없이 카탈로그 업데이트만 수행하므로 실질적 잠금 없음. 기존 행은 자동으로 NULL을 갖게 되어 회귀 없음.
- **평가**: 무중단 배포(rolling deployment) 안전. `re_run_of`/`chain_id` 선례와 일관.

### [INFO] FK 제약 미추가 — 의도적, 선례 일관
- **위치**: `V098__execution_single_node.sql` 주석, `execution.entity.ts`
- **상세**: `single_node_id`(Node FK), `previous_execution_id`(Execution FK) 모두 명시적 FK 제약 없음. 마이그레이션 주석에 "디버그 메타데이터; 노드/실행 삭제 시 dangling 가능하나 조회 시 무시"로 설계 근거 명시. `re_run_of`/`chain_id` 선례를 따름.
- **평가**: 정상. dangling 참조를 조회 시 무시하는 패턴은 이 코드베이스 일관 설계다.

### [INFO] 인덱스 미추가 — 근거 명시, 수용 가능
- **위치**: `V098__execution_single_node.sql` 주석, `plan/in-progress/exec-single-node.md`
- **상세**: "조회 패턴 없음(디버그 전용) → 인덱스 미추가"로 주석에 명시. `single_node_id`, `previous_execution_id` 컬럼은 실행 조회 경로에 포함되지 않고, 엔진이 읽는 `getLatestPredecessorOutputs`는 `executionId`(PK) 기준으로 `node_execution` 테이블을 조회하는 것이지 이 컬럼으로 `execution` 테이블을 검색하지 않음.
- **평가**: 설계 의도 명확. 디버그 전용 필드에 인덱스 미추가는 적절.

### [INFO] `getLatestPredecessorOutputs` 쿼리 패턴 — LIMIT 없음, 소규모 결과셋
- **위치**: `execution-engine.service.ts` (diff 생략됐으나 SUMMARY W-18 및 RESOLUTION 참조)
- **상세**: 직속 predecessor 노드 id 목록(`IN (...)`) + `executionId` + `status=COMPLETED` 조건으로 `node_execution` 테이블 조회. 직속 predecessor 수는 워크플로우 그래프 특성상 소수(대체로 1-3개)라 결과셋이 작음. LIMIT 없이 전체 적재 후 앱 레벨 dedup. `{finishedAt: DESC, id: DESC}` 정렬(tie-break 포함)이 RESOLUTION I-31 조치로 추가됨.
- **평가**: 저위험. 단일 노드의 직속 predecessor는 본질적으로 소규모. 대용량화 시 `DISTINCT ON (node_id)` 전환이 더 효율적이나 현재 패턴은 기능 정확성 충족.

### [INFO] `node_execution` 조회 인덱스 사용 — 기존 인덱스 적합
- **위치**: `execution-engine.service.ts` `getLatestPredecessorOutputs`
- **상세**: `executionId` + `status` + `nodeId IN (...)` 복합 조건. `node_execution` 테이블에 `execution_id` 기반 인덱스가 이미 존재한다고 가정할 수 있음(기존 실행 엔진이 동일 패턴으로 사용). 추가 인덱스 없이 기존 인덱스로 커버 가능.
- **평가**: 신규 인덱스 불필요.

### [INFO] `previousExecutionId` 워크플로우 소속 검증 — DB 조회로 안전 처리
- **위치**: `workflows.controller.ts` L492-504
- **상세**: `executionRepository.findOneBy({ id: body.previousExecutionId, workflowId: id })` 로 같은 워크플로우 소속인지 DB에서 검증. 타 워크플로우 실행을 seed 출처로 지정하는 것을 차단. 파라미터화된 TypeORM 쿼리 사용으로 SQL 인젝션 없음.
- **평가**: 정상. 단순 PK+FK 조건 조회로 인덱스 적중 기대.

### [INFO] 트랜잭션 — 기존 패턴 일관
- **위치**: `execution-engine.service.ts` `execute()` 메서드
- **상세**: `single_node_id`/`previous_execution_id` 저장은 Execution 엔티티 생성 시 함께 영속됨(기존 `dryRun`/`sourceIp`와 동일 패턴). 큐 worker가 execution 행을 재조회하는 선례 패턴 유지.
- **평가**: 트랜잭션 경계 변경 없음. 기존 설계와 일관.

### [INFO] N+1 쿼리 — 해당 없음
- **상세**: `getLatestPredecessorOutputs`는 단일 `find` 호출로 배치 조회. 반복문 내 개별 쿼리 없음.
- **평가**: N+1 문제 없음.

---

## 요약

이번 변경의 DB 관련 코드는 V098 마이그레이션(nullable 컬럼 2개 추가)과 `getLatestPredecessorOutputs` 조회 헬퍼, 컨트롤러의 `previousExecutionId` 소속 검증 쿼리로 구성된다. 마이그레이션은 PostgreSQL에서 무중단 안전하고, FK 미추가·인덱스 미추가 모두 설계 의도가 주석에 명시되어 기존 선례와 일관된다. 새 조회 쿼리들은 파라미터화된 TypeORM 메서드를 사용하여 SQL 인젝션 위험이 없으며, `node_execution` 조회의 결과셋 크기는 직속 predecessor 특성상 본질적으로 소규모라 LIMIT 부재가 실질적 위험이 되지 않는다. RESOLUTION에서 I-31(finishedAt 동점 tie-break)이 조치되어 정렬 비결정성도 해소됐다. 전반적으로 DB 레이어의 변경은 보수적이고 안전하게 설계되어 있다.

---

## 위험도

NONE
