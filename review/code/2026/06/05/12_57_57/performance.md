# Performance Code Review — listScopes 단일쿼리 최적화

대상 커밋 범위: `7afa9ae0..HEAD` (worktree: `memory-backlog-a2-fe9c8f`)
리뷰어: performance sub-agent
일시: 2026-06-05

---

## 발견사항

### INFO: 집계 패스 2→1 감소 — 왕복도 2→1 확인됨 (검토 항목 1)

- **위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` L550–568
- **상세**: 변경 전에는 `dataSource.query()` 호출이 두 번 발생했다 — 첫 번째가 GROUP BY + COUNT(*) + MAX(updated_at) 페이지 데이터, 두 번째가 동일 WHERE 조건을 가진 `SELECT COUNT(*) FROM (SELECT scope_key ... GROUP BY scope_key) sub` 총개수 서브쿼리. 두 호출은 순차 await 이므로 DB 왕복도 2회였다. 변경 후에는 CTE `grouped` 가 집계 패스 1회를 수행하고, 외부 SELECT 의 `COUNT(*) OVER()` 가 같은 결과셋에 total 을 부착한다. DB 왕복이 1회로 감소하고, DB 측 집계 패스도 동일 데이터에 대해 1회만 수행된다.
- **결론**: 개선 확인. 회귀 없음.

---

### INFO: `COUNT(*) OVER()` 추가 비용 — 무시 가능 (검토 항목 2)

- **위치**: `agent-memory.service.ts` L564
- **상세**: `COUNT(*) OVER()` 는 CTE 결과 전체 행(distinct scope 수 N개)을 한 번 스캔한다. LIMIT 이 적용되기 전 N개 grouped 행이 WindowAgg 에 공급되므로, N 이 수천 단위까지는 실질 비용이 무시 가능하다. listScopes 는 관리 UI 용 페이지네이션 API 이고, distinct scope 수는 workspace 당 수백~수천 수준이 상한이므로 현 규모에서 문제없다. N 이 수십만을 초과하는 환경에서는 CTE 구체화 + WindowAgg 비용이 증가할 수 있으나, 현 제품 규모에서는 백로그 유지 항목으로 분류한다.
- **결론**: 현 규모에서 비용 무시 가능. 확인.

---

### WARNING: `ORDER BY MAX(updated_at) DESC` filesort — 인덱스 미커버 (검토 항목 3)

- **위치**: `agent-memory.service.ts` L566, `migrations/V073__agent_memory.sql` L29
- **상세**: `ORDER BY grouped.latest_updated_at DESC` 는 CTE 집계 결과에 대한 정렬이다. 기반 테이블 인덱스는 `idx_agent_memory_scope ON agent_memory(workspace_id, scope_key, created_at)` 이며 `updated_at` 은 포함되지 않는다. GROUP BY 집계 후 ORDER BY MAX(updated_at) 는 filesort 가 불가피하다 — 집계 전에 인덱스로 ORDER BY 를 만족할 수 없기 때문이다. 이는 변경 전 쿼리에서도 동일하게 존재하던 상황이며 이번 변경이 신규 도입한 회귀가 아니다. 개선 방향: `(workspace_id, scope_key, updated_at)` covering index 로 index-only scan 유도 가능하나, GROUP BY 특성상 filesort 완전 제거는 불가능하다. 현 규모에서 긴급하지 않아 백로그 유지.
- **결론**: 기존부터 존재하던 비용. 신규 회귀 아님. 백로그 유지.

---

### WARNING: offset 초과 시 total=0 반환 — 의미론 변화 (검토 항목 4)

- **위치**: `agent-memory.service.ts` L578–579, `agent-memory.controller.ts` L79
- **상세**: offset 이 전체 그룹 수를 초과하면 CTE 에서 0행이 반환되고 `rows[0]?.total ?? 0` 이 0을 반환한다. 이전 코드에서는 별도 COUNT 쿼리가 항상 실제 total 을 반환했으므로 이는 의미론 변화다 — 이전: offset=90, 실제 scope=2 → total=2 반환; 이후: offset=90 → total=0 반환. 컨트롤러는 `page = Math.floor(offset / limit) + 1` 로 page 를 파생하므로 total=0 + page>1 의 조합이 가능하다. `PaginatedResponseDto.create` 가 이 조합을 올바르게 처리하는지 확인이 필요하다. 프론트엔드 페이지네이션 UI 가 total 을 "전체 항목수"로 표시할 경우 마지막 페이지 이후 요청 시 표시 오류가 발생할 수 있다. 테스트에서 이 동작을 expect 하고 코드 주석도 인지하고 있으나, 프론트엔드와 의미론 협의 여부를 확인할 것.
- **결론**: 기능 회귀 가능성 있음. offset 초과 요청이 실제로 발생하지 않는 구조라면 무해하나, 명시 확인 필요. BLOCK 대상은 아님.

---

### INFO: LIMIT/OFFSET 파라미터 바인딩 — 안전 (검토 항목 4 보완)

- **위치**: `agent-memory.service.ts` L531–532, L567
- **상세**: `limitParam`/`offsetParam` 은 `'$2'`, `'$3'` 등 플레이스홀더를 SQL 템플릿에 보간하고 실제 값은 파라미터 배열로 전달한다. SQL injection 위험 없으며 이전 코드와 동일 패턴이다. 변경이 이 부분을 악화시키지 않는다.
- **결론**: 안전. 회귀 없음.

---

## 요약

핵심 변경인 `listScopes` 2쿼리→1쿼리(CTE + `COUNT(*) OVER()`) 통합은 DB 왕복 1회 절감 및 집계 패스 중복 제거라는 목적을 올바르게 달성한다. `COUNT(*) OVER()` 의 WindowAgg 추가 비용은 현 규모에서 무시 가능하며, `ORDER BY MAX(updated_at) DESC` filesort 는 이전부터 존재하던 비용으로 이번 변경이 악화시키지 않는다. 주목할 점은 offset 초과 시 `total=0` 반환으로 의미론이 변경되었다는 것으로, 프론트엔드 페이지네이션이 이 케이스에 의존하지 않는 구조임을 확인하는 것이 권장된다. 전체적으로 성능 방향의 변경은 유효하며 신규 성능 회귀는 없다.

## 위험도

LOW

---

BLOCK: NO
