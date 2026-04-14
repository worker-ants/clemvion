### 발견사항

---

**[WARNING] `createVersion`의 버전 번호 채번 경쟁 조건 (Race Condition)**
- 위치: `workflow-versions.service.ts` — `createVersion()` 메서드
- 상세: 최신 버전 번호를 `SELECT … ORDER BY version DESC LIMIT 1`로 읽은 뒤 `+1`하여 INSERT하는 구조는 동시 저장 요청이 겹칠 경우 두 트랜잭션이 동일한 `version` 값을 도출하고 둘 다 INSERT를 시도하는 경쟁 조건이 발생합니다. `(workflow_id, version)` UNIQUE 제약이 있으므로 한 쪽은 `UniqueViolation` 예외로 실패하며 클라이언트에 500 에러가 노출됩니다.
- 제안: 채번을 DB 시퀀스/함수로 위임하거나, INSERT를 `(workflow_id, version)` UNIQUE 충돌 시 재시도하는 로직을 추가하거나, 버전 번호 결정 쿼리와 INSERT를 동일 트랜잭션 안에서 `SELECT FOR UPDATE`로 잠금을 획득한 뒤 수행하세요. 가장 간단한 방법은 PostgreSQL의 `INSERT … ON CONFLICT DO NOTHING` + 재시도 또는 `nextval` 시퀀스 활용입니다.

---

**[WARNING] `saveCanvas` 트랜잭션과 `createVersion` 호출 간 원자성 부재**
- 위치: `workflows.service.ts` — `saveCanvas()`, spec §9
- 상세: 캔버스 변경은 `dataSource.transaction(...)` 안에서 커밋되지만, `createVersion` 호출은 트랜잭션 바깥에서 수행됩니다. 캔버스 커밋 후 `createVersion`이 실패하면 캔버스는 저장됐지만 버전 레코드는 없는 불일치 상태가 됩니다. spec §9에서 "다음 저장에서 자동으로 따라잡힌다"고 허용하고 있으나, 이 경우 이전 버전 번호와의 gap이 생기고 `changeSummary`가 유실됩니다.
- 제안: `createVersion`을 동일 트랜잭션 매니저(`manager`)로 실행하도록 `WorkflowVersionsService`에 트랜잭션 매니저를 수신하는 오버로드를 추가하거나, `EntityManager`를 직접 전달해 원자성을 확보하세요.

---

**[WARNING] `workflow_version.snapshot` 컬럼에 인덱스 없음 — 대용량 시 쿼리 성능**
- 위치: `workflow-version.entity.ts` — `snapshot` 컬럼
- 상세: `snapshot`은 `jsonb` 타입으로 현재 조회(전체 목록·단건)에서는 문제가 없습니다. 그러나 향후 스냅샷 내 특정 필드(예: 특정 노드 타입 포함 여부)로 필터링하거나, 워크플로우 삭제 CASCADE 후 orphan 정리가 필요해질 경우 GIN 인덱스 부재가 성능 문제로 이어질 수 있습니다. 즉각적 위험은 아니지만 사전에 인지해야 합니다.
- 제안: 현 시점에서는 `workflow_id` FK 인덱스와 `(workflow_id, version)` UNIQUE 인덱스로 충분합니다. `snapshot` 내부 필드 검색이 필요해지면 `CREATE INDEX … USING GIN (snapshot)`을 마이그레이션에 추가하세요.

---

**[WARNING] `findByWorkflow`에서 `snapshot` 컬럼 전량 로드**
- 위치: `workflow-versions.service.ts` — `findByWorkflow()`
- 상세: 버전 목록 API는 UI 패널에서 버전 번호·작성자·변경 요약만 표시하면 됩니다. 그러나 `find()`가 `snapshot` jsonb 전체를 SELECT합니다. 노드/엣지가 수십 개 이상인 워크플로우가 수백 버전 쌓이면 불필요하게 수 MB의 데이터가 전송됩니다.
- 제안: `select: { id: true, workflowId: true, version: true, changeSummary: true, createdBy: true, createdAt: true }` 옵션을 추가하거나 QueryBuilder로 `snapshot`을 제외한 컬럼만 SELECT하세요. `snapshot`은 단건 상세 조회(`findOne`)에서만 로드합니다.

---

**[INFO] `workflow_version` 테이블에 마이그레이션 파일 미확인**
- 위치: `workflow-version.entity.ts`
- 상세: 리뷰 대상 파일에 `workflow_version` 테이블 생성 마이그레이션 파일이 포함되어 있지 않습니다. TypeORM `synchronize: true`로 운영 중이라면 스키마 변경이 자동 적용되어 배포 시 예기치 않은 DDL이 실행될 위험이 있습니다. `(workflow_id, version)` UNIQUE 인덱스 생성은 대용량 테이블에서 테이블 잠금을 유발할 수 있습니다.
- 제안: 운영 환경에서는 반드시 `synchronize: false`로 설정하고 명시적 마이그레이션 파일을 관리하세요. UNIQUE 인덱스는 `CREATE UNIQUE INDEX CONCURRENTLY`를 사용하면 잠금 없이 생성할 수 있습니다.

---

**[INFO] `changeSummary?: string` 필드의 `undefined` vs `null` 혼용**
- 위치: `workflow-versions.service.ts` — `createVersion()`, `workflow-version.entity.ts`
- 상세: 엔티티에서 `changeSummary`는 `nullable: true`(DB에서 NULL 허용)인데, 서비스 코드에서 `changeSummary: changeSummary || undefined`로 저장합니다. TypeORM은 `undefined` 필드를 INSERT 시 해당 컬럼을 생략(DB default 적용)하는데, 이 컬럼의 DB default가 없으므로 NULL로 저장됩니다. 동작은 동일하지만 의도가 명확하지 않습니다.
- 제안: `changeSummary: changeSummary ?? null`로 명시적으로 처리하면 의도가 분명해집니다.

---

### 요약

전반적으로 스키마 설계(`workflow_version` 엔티티, UNIQUE 제약, CASCADE 설정)와 단건 조회 로직은 적절합니다. 가장 시급한 문제는 **버전 채번의 경쟁 조건**으로, 동시 저장 시 UNIQUE 위반 에러가 발생할 수 있습니다. 또한 **캔버스 트랜잭션과 버전 생성의 원자성 부재**는 spec에서 허용하고 있으나 데이터 일관성 관점에서 개선이 권장됩니다. 버전 목록 조회 시 `snapshot` 전체를 로드하는 구조는 데이터가 쌓일수록 성능 저하로 이어질 수 있으므로, SELECT 절을 요약 필드로 한정하는 것이 좋습니다.

### 위험도
**MEDIUM**