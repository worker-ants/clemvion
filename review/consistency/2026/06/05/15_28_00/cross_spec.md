# Cross-Spec 일관성 검토 — agent_memory scope-index V086

검토 범위: `git diff 84dd7314..HEAD`
검토 시각: 2026-06-05
주요 변경: `codebase/backend/migrations/V086__agent_memory_scope_updated_index.sql` 신규 마이그레이션 + 관련 spec 2건(`spec/5-system/17-agent-memory.md`, `spec/1-data-model.md`) 갱신

---

## CRITICAL

없음.

---

## WARNING

### W-01 AGM-02 요구사항이 V086 인덱스를 미등재
- target 위치: `spec/5-system/17-agent-memory.md §1` 인덱스 기술(line 42) + AGM-02 요구사항 정의(line 46)
- 충돌 대상: `codebase/backend/migrations/V086__agent_memory_scope_updated_index.sql` — `CREATE INDEX … ON agent_memory(workspace_id, scope_key, updated_at)`
- 상세: 마이그레이션 V086 은 `(workspace_id, scope_key, updated_at)` 인덱스(`idx_agent_memory_scope_updated`)를 신설했다. 그러나 `spec/5-system/17-agent-memory.md §1` 인덱스 서술(line 42)은 V073(`created_at`)·pgvector·V080(`expires_at`) 세 인덱스만 나열하고, V086 인덱스는 서술하지 않는다. `AGM-02` 요구사항 본문(line 46)도 `(workspace_id, scope_key, created_at)` 만 언급한다. V086 주석에 따르면 이 인덱스는 `listScopes(AGM-12)`의 `ORDER BY MAX(updated_at)` 를 index-only scan 으로 커버하기 위한 것이나, `§1` spec 텍스트와 AGM-02 에 반영이 없다.
- 제안: `spec/5-system/17-agent-memory.md §1` 인덱스 행에 `(workspace_id, scope_key, updated_at)` 를 V086 참조와 함께 추가. AGM-02 요구사항 본문도 "scope 조회·정렬(`updated_at`) 커버 인덱스(V086)" 을 병기.

### W-02 `spec/1-data-model.md §3` 인덱스 전략에 V086 인덱스 누락
- target 위치: `spec/1-data-model.md §3` AgentMemory 인덱스 행(line 800-802)
- 충돌 대상: V086 마이그레이션
- 상세: §3 인덱스 전략 표는 `(workspace_id, scope_key, created_at)` (V073) 와 pgvector 및 `expires_at` partial (V080) 두 인덱스만 등재한다. V086 의 `(workspace_id, scope_key, updated_at)` 인덱스가 누락되어 §3 표와 실제 DB 스키마가 불일치한다.
- 제안: `spec/1-data-model.md §3` AgentMemory 섹션에 행 추가: `AgentMemory | (workspace_id, scope_key, updated_at) | scope 목록 MAX(updated_at) 정렬 index-only scan — AGM-12 listScopes (V086)`.

### W-03 AGM-12/AGM-13 및 §6(메모리 관리 API)가 이 diff 에서 삭제됐으나 V086 마이그레이션은 AGM-12 를 전제함
- target 위치: `spec/5-system/17-agent-memory.md §6 v2 로드맵` (diff: §6 "메모리 관리 API" 섹션 전체 삭제, AGM-12/13 삭제, `spec/2-navigation/16-agent-memory.md` 파일 삭제)
- 충돌 대상: `V086__agent_memory_scope_updated_index.sql` 주석 — "listScopes (admin 메모리 가시화, AGM-12 — `GET /agent-memories/scopes`) 는 … MAX(updated_at) DESC"
- 상세: 이 diff 는 `spec/5-system/17-agent-memory.md §6`(메모리 관리 API, AGM-12/13), `spec/2-navigation/16-agent-memory.md`, `spec/2-navigation/_product-overview.md §3.13/NAV-AM-*` 를 전부 삭제했다. V086 마이그레이션은 그 삭제된 AGM-12(`GET /agent-memories/scopes`)의 쿼리 최적화를 목적으로 작성되었고, 마이그레이션 주석에 `AGM-12` 를 명시한다. 삭제 후 마이그레이션 주석이 존재하지 않는 요구사항 ID 를 참조하는 불일치가 발생했다. AGM-12/13 를 "범위 밖(미구현)"으로 처리한 의도라면 마이그레이션 주석이 잘못된 근거를 제시하는 것이고, 반대로 API 기능이 구현 유지라면 spec §6 을 삭제한 것이 잘못이다.
- 제안: (A) 메모리 관리 API 가 여전히 구현 유지라면 — 삭제된 §6 / AGM-12 / AGM-13 / NAV-AM spec 을 복원. (B) 관리 API 를 scope 외로 이동한 것이라면 — V086 마이그레이션 주석에서 `AGM-12` 참조를 "scope 목록 정렬 최적화 인덱스" 등 중립적 기술로 교체.

---

## INFO

### I-01 V083/V084/V085 마이그레이션이 `spec/1-data-model.md §2.13` 에 미반영
- target 위치: `spec/1-data-model.md §2.13 Execution` (diff: `active_running_ms`, `conversation_thread`, `user_variables` 컬럼 정의 삭제)
- 충돌 대상: `V083__execution_active_running_ms.sql`, `V084__execution_conversation_thread.sql`, `V085__execution_user_variables.sql`
- 상세: 이 diff 에서 `spec/1-data-model.md §2.13 Execution` 표의 `active_running_ms`·`conversation_thread`·`user_variables` 컬럼 행이 삭제되었다. 그러나 세 마이그레이션이 동일 diff 범위에 존재하여 실제 DB 에는 이 컬럼들이 추가된다. `spec/5-system/4-execution-engine.md §8 / §6.2 / §7.5` 는 이 컬럼들을 참조하므로, `spec/1-data-model.md` 만 컬럼 없는 상태가 된다. 본 검토 범위는 cross-spec 일관성이고 V083–V085 마이그레이션의 spec 등재는 별도 작업 분리(scope-freeze)로 의도된 것일 수 있으나, 현재 단일진실 파일(§2.13)과 마이그레이션 사이의 불일치가 발생해 있다. (`spec/5-system/4-execution-engine.md` 를 기준으로 세 컬럼은 구현됨.)
- 제안: V083–V085 컬럼이 구현 채택된 경우 `spec/1-data-model.md §2.13` 에 세 컬럼 행 복원(또는 별도 plan 으로 spec 동기화).

### I-02 V086 마이그레이션 `.conf` 파일 존재 여부 확인 권장
- target 위치: `V086__agent_memory_scope_updated_index.sql` 주석(line 11–13)
- 충돌 대상: Flyway `executeInTransaction=false` 관례
- 상세: 마이그레이션 주석이 "동봉된 V086__agent_memory_scope_updated_index.conf (executeInTransaction=false) 와 함께 실행" 을 명시한다. 해당 `.conf` 파일이 실제로 git 에 포함되어 있는지 본 diff 범위에서 확인하지 못했다. `.conf` 없이 `CREATE INDEX CONCURRENTLY` 가 트랜잭션 안에서 실행되면 Flyway 오류로 마이그레이션이 중단된다.
- 제안: `.conf` 파일 병행 커밋 여부를 배포 전 확인.

---

## 요약

이 diff 의 핵심 변경은 `(workspace_id, scope_key, updated_at)` 인덱스 마이그레이션(V086) 신설이다. 두 target spec(`spec/5-system/17-agent-memory.md §1`/`AGM-02` 와 `spec/1-data-model.md §3`)이 V073/V080 인덱스만 열거하고 V086 인덱스를 등재하지 않아 DB 스키마와 spec 단일진실이 불일치한다(W-01, W-02). 더 중요한 문제는 같은 diff 에서 메모리 관리 API spec(§6, AGM-12/13, NAV-AM-*, `spec/2-navigation/16-agent-memory.md`)이 삭제되었음에도 V086 마이그레이션 주석이 삭제된 AGM-12 를 목적 근거로 명시하는 내부 모순이 발생했다(W-03). CRITICAL 차단 사유는 없으나 W-01·W-02·W-03 는 spec 단일진실 파일의 인덱스 목록과 요구사항 ID 참조가 현실 마이그레이션과 어긋나는 상황이므로 spec 갱신 또는 마이그레이션 주석 정정이 필요하다.

---

## 위험도

MEDIUM

---

BLOCK: NO
