### 발견사항

- **[CRITICAL]** 마이그레이션 트랜잭션 부재 — 워크플로우별 노드 업데이트가 각각 개별 쿼리로 실행되며 단일 트랜잭션으로 묶이지 않음
  - 위치: `main()` 함수, 446–452행
  - 상세: 스크립트 실행 중 프로세스 크래시 또는 DB 오류 발생 시 일부 노드만 마이그레이션된 부분 적용(partial apply) 상태가 됨. 이 경우 동일 expression 내 노드 레이블이 서로 다른 경로 규칙을 참조하게 되어 런타임 오류 발생
  - 제안: `ds.transaction()` 으로 전체 apply를 하나의 원자적 트랜잭션으로 묶거나, 최소한 워크플로우 단위로 트랜잭션 적용

```typescript
// 권장 패턴
await ds.transaction(async (em) => {
  for (const { id: workflowId } of workflows) {
    // ... node updates within the transaction
  }
});
```

---

- **[CRITICAL]** audit_log 삽입 쿼리의 `workspace_id` / `user_id` 조회 로직 불안정
  - 위치: 466–475행
  - 상세: `(SELECT workspace_id FROM workflow LIMIT 1)`, `(SELECT id FROM "user" LIMIT 1)` 는 임의의 첫 번째 행을 선택. 멀티테넌트 환경에서 잘못된 workspace 또는 user가 audit 기록에 남을 수 있으며 compliance 위반 가능성 있음. 또한 `resource_id`에 `gen_random_uuid()`를 사용해 실제 변경 대상 리소스와 연결이 끊김
  - 제안: workspace_id / user_id를 환경변수나 CLI 인수로 받거나, 실제 변경된 workflow id 목록을 포함하는 별도 audit 행을 per-workflow로 삽입

---

- **[WARNING]** N+1 쿼리 패턴 — 모든 워크플로우를 순차 반복하며 노드 쿼리 개별 실행
  - 위치: 420–453행
  - 상세: `workflows` 개수만큼 `SELECT id, type, label, config FROM node WHERE workflow_id = $1` 가 순차 실행됨. 워크플로우 수가 수천 개에 달할 경우 마이그레이션 시간이 선형으로 증가하고 DB 커넥션을 장시간 점유
  - 제안: 단일 쿼리로 JOIN 또는 `IN (...)` 배치로 전체 노드를 한번에 조회 후 메모리에서 그룹핑

```sql
SELECT n.id, n.type, n.label, n.config, n.workflow_id
FROM node n
ORDER BY n.workflow_id, n.created_at
```

---

- **[WARNING]** 마이그레이션 스크립트에 멱등성(idempotency) 체크 없음
  - 위치: `main()` 전반
  - 상세: `--apply`를 두 번 실행하면 Pass 4의 일부 규칙(특히 RENAMED_OUTPUT_FIELDS)이 이미 변환된 경로를 다시 변환하려 시도할 수 있음. 코드 주석에 "idempotent only when..." 조건을 달아놨지만 실제 이중 실행을 방지하는 guard가 없음
  - 제안: audit_log 조회로 이미 적용된 migration을 감지하거나, migration 버전 테이블을 두어 재실행을 방지

---

- **[INFO]** `carousel` 노드 타입의 static/dynamic 모드 구분 불가
  - 위치: 59–69행 주석
  - 상세: `items` 필드의 경우 static carousel이면 `config`로 이동이 맞지만, dynamic carousel이면 `output.items`에 런타임 값이 있어 잘못된 rewrite가 됨. 코드에 "Operators must review carousel hits manually" 주석이 있지만, audit_log 에 충분한 context(현재 노드의 `mode` 값)가 기록되지 않아 수동 검토 시 정보 부족
  - 제안: carousel 노드 hit 발생 시 해당 노드의 `config.mode` 값을 audit detail에 함께 기록

---

- **[INFO]** `database-query.handler.ts` 에러 코드 변경 (`QUERY_FAILED` → `DB_QUERY_FAILED`)
  - 위치: `database-query.handler.ts` diff
  - 상세: 에러 코드 문자열이 변경됨. 기존에 이 코드를 직접 비교하는 workflow expression (`output.error.code === 'QUERY_FAILED'`) 이 있다면 Silent breakage 발생. 마이그레이션 스크립트의 Pass 4 재작성 대상에 에러 코드 리터럴은 포함되어 있지 않음
  - 제안: 에러 코드 변경도 마이그레이션 스크립트의 Pass 5 (status literal) 와 유사하게 expression rewrite 대상에 포함하거나, backward-compat alias를 한 버전 동안 유지

---

### 요약

변경 대상 중 데이터베이스에 직접 영향을 미치는 파일은 `migrate-node-output-refs.ts` 와 `database-query.handler.ts` 두 가지다. 마이그레이션 스크립트는 기능적으로는 잘 설계되어 있으나, **전체 apply가 단일 트랜잭션으로 보호되지 않는 것**이 가장 심각한 문제다. 중간에 실패하면 부분 마이그레이션 상태가 되어 노드 간 표현식 경로가 불일치하고 런타임 오류를 유발한다. 추가로 N+1 쿼리 패턴, audit_log의 임의 workspace/user 참조, 멱등성 미보장도 운영 환경에서 위험 요소다. 나머지 파일들(handler output shape 변경, 스키마 정의 등)은 데이터베이스 레이어와 직접 관련이 없다.

### 위험도
**HIGH**