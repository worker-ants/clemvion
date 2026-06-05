# DB 코드 리뷰 — memory-backlog-a2-fe9c8f

대상: `git diff 7afa9ae0..HEAD -- codebase/`  
검토 파일: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts`  
일시: 2026-06-05

---

## 발견사항

### WARNING — OFFSET 초과 시 total=0 동작: 기존 API와 의미 불일치

- **위치**: `agent-memory.service.ts` L579 — `total: Number(rows[0]?.total ?? 0)`
- **상세**:  
  기존 구현(2-쿼리)은 OFFSET이 전체 그룹 수를 넘어도 별도 COUNT 쿼리가 실제 total을 반환했다. 새 단일-쿼리 구현에서는 OFFSET ≥ 전체 그룹 수일 때 `rows`가 빈 배열 → `rows[0]`이 `undefined` → `total = 0`이 반환된다.  
  클라이언트가 "전체 페이지 수"를 `Math.ceil(total / limit)`로 계산해 페이지 네비게이터를 렌더링하는 경우, 마지막 페이지를 초과한 요청에서 total이 0으로 바뀌면 UI가 페이지네이터를 1로 리셋하는 예상치 못한 동작을 유발할 수 있다. 컨트롤러/DTO 레이어가 이 의미 변화를 알고 있는지, 호출부가 `total=0`을 "빈 페이지"로 처리하도록 작성되어 있는지 확인이 필요하다.  
  코드 주석(`NOTE: OFFSET 이 전체 그룹 수를 넘어 0행이 반환되면 total 행이 없어지나 … total 0 으로 처리.`)에 이 동작이 명시되어 있고, 테스트(`'빈 결과(또는 offset 초과)면 total 0'`)도 추가되어 있어 의도적 설계 결정임은 확인된다. 그러나 기존 2-쿼리 계약과의 의미 변화가 API 소비자에게 breaking이 될 수 있으므로 WARNING으로 기록한다.
- **제안**:  
  컨트롤러/프론트엔드가 `offset >= total`일 때 `total=0`을 이전 페이지로 돌아가거나 무시하도록 처리하는지 확인한다. 만약 호출부가 빈 페이지에서도 실제 total을 필요로 한다면, CTE를 두 번 참조하는 방식(`COUNT(*) OVER()` 대신 별도 `SELECT count FROM grouped_total CTE`)으로 0행 케이스에서도 total을 살릴 수 있다. 현재 호출부 구현상 문제가 없다면 `total=0` 계약을 API 문서/스펙에 명시한다.

---

### INFO — `updated_at` 에 단독 인덱스 없음: `ORDER BY latest_updated_at DESC` filesort 발생

- **위치**: `agent-memory.service.ts` L566 — `ORDER BY grouped.latest_updated_at DESC`  
  마이그레이션: `V073__agent_memory.sql` L29 — `CREATE INDEX idx_agent_memory_scope ON agent_memory(workspace_id, scope_key, created_at)`
- **상세**:  
  현재 인덱스 `idx_agent_memory_scope`는 `(workspace_id, scope_key, created_at)` 컬럼 조합이다. `listScopes`의 CTE `grouped`는 `WHERE workspace_id = $1` + `GROUP BY scope_key` 후 `MAX(updated_at)`를 `latest_updated_at`으로 집계하고, 바깥 SELECT에서 `ORDER BY grouped.latest_updated_at DESC`로 정렬한다.  
  `MAX(updated_at)` 집계는 `GROUP BY scope_key` 완료 후 추가 정렬로 평가되므로, 스코프 수가 많아질수록(수천 개 수준 이상) PostgreSQL이 CTE 결과 전체를 filesort로 정렬하는 비용이 발생한다. 현재 `(workspace_id, scope_key, created_at)` 인덱스는 이 정렬을 커버하지 않는다.  
  단, listScopes 쿼리 자체는 `WHERE workspace_id = $1`로 이미 워크스페이스 격리가 되어 있고, `GROUP BY scope_key` 집계가 먼저 수행되므로 인덱스 스캔으로 집계 후 filesort가 발생한다. 워크스페이스당 scope 수가 수백 미만이면 실 영향은 미미하다.
- **제안**:  
  scope 수가 대규모로 늘어날 것이 예상된다면 `(workspace_id, updated_at DESC)` 복합 인덱스 추가를 고려한다. 단 현재 스케일에서는 차단 이슈가 아니다.

---

### INFO — `COUNT(*) OVER()` LIMIT 전 평가 의미 확인 (정확성 분석)

- **위치**: `agent-memory.service.ts` L564 — `COUNT(*) OVER() AS total`
- **상세**:  
  PostgreSQL에서 윈도우 함수는 `FROM … WHERE … GROUP BY … HAVING`이 완료된 결과 집합에 대해 평가되고, `ORDER BY / LIMIT / OFFSET`보다 먼저 계산된다. 따라서 이 쿼리에서 `COUNT(*) OVER()`는 CTE `grouped`의 전체 행(= 전체 distinct scope 수)을 기준으로 계산된 뒤, 그 결과에 `LIMIT`/`OFFSET`이 적용된다. 즉 LIMIT으로 잘린 페이지의 각 행에도 "전체 그룹 수"가 올바르게 부착된다.  
  이는 기존 별도 COUNT 서브쿼리와 같은 값을 산출하며, 단일 집계 패스로 통합한 것은 성능 면에서 올바른 최적화이다. `total` 정확성에 대한 우려는 OFFSET 초과(0행) 케이스를 제외하면 없다.
- **제안**: 현재 구현이 올바름. 추가 조치 불필요.

---

### INFO — SQL 인젝션 안전성: 파라미터 바인딩 충분

- **위치**: `agent-memory.service.ts` L530 — `filterSql`, L567 — `LIMIT ${limitParam} OFFSET ${offsetParam}`
- **상세**:  
  `workspaceId`, `q`, `limit`, `offset`은 모두 `$1~$4` 파라미터 바인딩으로 전달된다. `q`의 ILIKE 와일드카드(`%`)는 SQL 측 문자열 연결(`'%' || $2 || '%'`)로 처리되어 사용자 입력이 SQL에 직접 보간되지 않는다.  
  `LIMIT ${limitParam}`, `OFFSET ${offsetParam}`은 `'$2'`, `'$3'` 등 파라미터 자리표시자 문자열을 SQL에 삽입하는 것으로, 실제 값은 파라미터 배열로 전달된다. SQL 인젝션 위험 없음.
- **제안**: 현재 구현이 올바름.

---

### INFO — workspace_id 격리 유지 확인

- **위치**: `agent-memory.service.ts` L556 — `WHERE am.workspace_id = $1`
- **상세**:  
  CTE `grouped` 내 WHERE 절에 `am.workspace_id = $1`이 포함되어 있어, 다른 워크스페이스 데이터가 집계에 포함되지 않는다. 기존 2-쿼리 구현 대비 격리 로직 변경 없음. 올바름.
- **제안**: 추가 조치 불필요.

---

### INFO — embedding 컬럼 SELECT 제외 유지 확인

- **위치**: `agent-memory.service.ts` L551~554 — CTE SELECT 컬럼 목록
- **상세**:  
  CTE `grouped`가 `scope_key, COUNT(*), MAX(updated_at)`만 SELECT하고 `embedding` 컬럼을 포함하지 않는다. 기존 구현의 embedding 제외 정책이 단일-쿼리 통합 후에도 유지된다.
- **제안**: 추가 조치 불필요.

---

## 요약

`listScopes`의 2-쿼리 → CTE + `COUNT(*) OVER()` 단일쿼리 통합은 PostgreSQL 윈도우 함수 의미상 정확하다. `COUNT(*) OVER()`는 LIMIT/OFFSET 적용 전 CTE 전체 행에 대해 평가되므로 total 값은 기존 별도 COUNT 서브쿼리와 동일하다. workspace_id 격리, q ILIKE 파라미터 바인딩, embedding 제외 모두 정상 유지된다. SQL 인젝션 위험은 없다. 유일한 주의 사항은 OFFSET 초과(0행 반환) 시 `total=0`으로 처리되는 동작이 기존 2-쿼리 계약과 의미가 다르다는 점으로, 이를 기존 코드 주석과 테스트가 명시적으로 인식하고 있어 의도적 설계 결정임이 확인된다. 단, API 소비자(프론트엔드 페이지네이터) 처리 방식에 따라 UX 이슈가 될 수 있으므로 WARNING으로 기록한다. `updated_at` 단독 인덱스 부재로 인한 filesort는 현재 스케일에서 무해하나 대용량 확장 시 재검토 대상이다.

## 위험도

MEDIUM

---

BLOCK: NO
