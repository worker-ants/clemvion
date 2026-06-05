# 요구사항 리뷰 — agent_memory listScopes filesort 해소 인덱스 (V086)

**대상 diff**: `84dd7314..HEAD` (커밋 faa464b8)
**검토 목표**: (1) V086 인덱스가 filesort 해소 목적을 충족하는지, (2) spec 정합 갱신 완결성, (3) plan 완료 상태 정확성

---

## ## CRITICAL

_없음._

---

## ## WARNING

_없음._

---

## ## INFO

### [INFO] index-only scan 가능성은 visibility map 의존 — 주석의 확신 표현은 낙관적
- 위치: `codebase/backend/migrations/V086__agent_memory_scope_updated_index.sql` L7–8
- 상세: SQL 주석 "index-only scan 으로 커버한다" 는 PostgreSQL 이 `(workspace_id, scope_key, updated_at)` 를 인덱스에서 직접 읽을 때 성립한다. 실제로 쿼리(`listScopes`) 가 이 인덱스에서 직접 읽어가는 컬럼은 `workspace_id`, `scope_key`, `updated_at` 세 가지로, 구성된 인덱스 컬럼과 일치한다. 단, PostgreSQL 의 index-only scan 은 visibility map 이 최신화되어 있어야 heap fetch 를 완전히 피한다. VACUUM 주기가 낮은 고빈도 쓰기 테이블에서는 heap fetch 가 잔류할 수 있다. 이 조건은 마이그레이션 수준에서 보장 불가이며, 프로덕션 환경의 autovacuum 설정에 따라 효과가 달라진다. 기능 정확성에는 영향 없으나 주석의 "index-only scan" 표현은 조건부로 이해해야 한다.
- 제안: 현 구현은 유지. 주석에 "(visibility map 최신 시 index-only scan — autovacuum 의존)" 정도의 단서를 추가하면 오해를 줄일 수 있다. 필수 아님.

### [INFO] `COUNT(*)` 최적화(W2) 는 이미 기존 코드에 적용됨 — 이번 V086 과 직교
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` L535–L568
- 상세: PR #471 SUMMARY 의 백로그 DB perf W2("데이터+COUNT 이중 집계 → `COUNT(*) OVER()`") 는 `listScopes` 쿼리 내 `COUNT(*) OVER()` 윈도우 함수로 이미 해결된 상태다. 이번 V086 의 범위(filesort W1) 와 직교하며, 중복 작업 없음.

### [INFO] 백로그 중 W4(`metadata->>'kind'` 인덱스) 는 이번 변경에 포함되지 않음
- 위치: `review/code/2026/06/05/09_50_08/SUMMARY.md` L35, `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` L635
- 상세: PR #471 SUMMARY 백로그에 나열된 DB perf W4(`metadata->>'kind'` 인덱스 부재) 는 이번 V086 범위 밖이다. `GET /agent-memories` 의 `kind` 필터 쿼리(`metadata->>'kind' = $3`)에 GIN/expression 인덱스가 없어 seq scan 이 발생할 수 있다. 관련 plan 항목 없음. 별도 백로그로 유지됨이 확인된다. 기능 정확성에 영향 없음.

---

## 발견사항 요약

### (1) V086 인덱스 목적 충족 여부

`listScopes` 쿼리는 `WHERE am.workspace_id = $1 GROUP BY am.scope_key ORDER BY MAX(am.updated_at) DESC` 패턴이다. 기존 `idx_agent_memory_scope (workspace_id, scope_key, created_at)` 는 `updated_at` 을 포함하지 않아 집계 과정에서 heap fetch + filesort 가 발생했다. V086 이 추가한 `idx_agent_memory_scope_updated (workspace_id, scope_key, updated_at)` 는 세 컬럼 모두 인덱스에 포함되므로 PostgreSQL 이 해당 인덱스로 `(workspace_id, scope_key)` 그룹별 `MAX(updated_at)` 를 탐색할 수 있게 된다. `CONCURRENTLY IF NOT EXISTS` 와 `executeInTransaction=false` 조합은 Flyway CONCURRENTLY 요건에 올바르게 대응한다. 기존 `created_at` 인덱스와 공존하며 기존 회수/evict 쿼리 플랜에 영향이 없다. **목적 충족: 충족.**

### (2) spec 정합 갱신 완결성

- `spec/5-system/17-agent-memory.md §1` 인덱스 설명 행과 AGM-02 요구사항 라인이 모두 V086 인덱스를 반영하여 갱신됐다.
- `spec/1-data-model.md §3` 인덱스 전략 표에 `AgentMemory (workspace_id, scope_key, updated_at)` 행이 추가됐다.
- `spec/5-system/17-agent-memory.md` frontmatter `pending_plans` 는 변경 전부터 `ai-context-memory-followup-v2`, `agent-memory-admin-ui`, `agent-memory-summary-model` 세 개의 in-progress 항목을 열거하며, 이 항목들은 이번 V086 작업과 무관한 별도 계획이므로 그대로 유지됨이 정상이다. **spec 정합: 완결.**

### (3) plan 완료 상태 정확성

`plan/complete/agent-memory-scope-index.md` 가 `status: complete`, `worktree`, `branch`, `spec_impact`, `code` 모두 기록됐다. 체크리스트(`[x]`) 두 항목(마이그레이션, spec 갱신)이 모두 완료 표시다. plan/in-progress 에 관련 항목이 잔존하지 않는다. **plan 상태: 정확.**

---

## 요약

V086 마이그레이션은 PR #471 database reviewer 백로그 W1(listScopes `MAX(updated_at)` filesort) 을 목적에 부합하게 해소한다. 인덱스 컬럼 구성 `(workspace_id, scope_key, updated_at)` 은 `listScopes` 쿼리의 `WHERE workspace_id + GROUP BY scope_key + MAX(updated_at)` 패턴을 직접 커버하며, CONCURRENTLY 배포 처리도 올바르다. spec(`17-agent-memory §1`, AGM-02, `1-data-model §3`) 과 plan(`plan/complete/agent-memory-scope-index.md`) 도 빠짐없이 갱신됐다. Critical/Warning 발견 없음.

## 위험도
NONE

## BLOCK: NO
