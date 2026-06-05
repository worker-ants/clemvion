# 신규 식별자 충돌 검토 — agent-memory-scope-index (V086)

대상 diff: `git diff 84dd7314..HEAD` (merge-base 기준)
검토 일시: 2026-06-05

---

## 발견사항

발견된 CRITICAL/WARNING 항목 없음.

---

### [INFO] idx_agent_memory_scope_updated — 기존 이름과 접두어 공유

- **target 신규 식별자**: `idx_agent_memory_scope_updated`
  (`V086__agent_memory_scope_updated_index.sql`, line 15)
- **기존 사용처**:
  - `idx_agent_memory_scope` — `V073__agent_memory.sql` line 29: `(workspace_id, scope_key, created_at)` 회수·evict 인덱스
  - `idx_agent_memory_expires_at` — `V080__agent_memory_expires_at.sql` line 19: TTL 만료 부분 인덱스
  - `idx_agent_mem_emb_hnsw_*` — V074~V079: pgvector HNSW 인덱스군
- **상세**: 신규 이름 `idx_agent_memory_scope_updated` 는 기존 `idx_agent_memory_scope` 에 `_updated` suffix 를 붙인 형태다. 두 인덱스가 모두 `agent_memory` 테이블에 존재하며 각각 `created_at` / `updated_at` 을 커버하는 직교 목적이라 PostgreSQL 식별자 충돌은 없다. SQL 파일 주석(line 5-6)도 기존 `idx_agent_memory_scope` 를 명시 인용해 의도적 직교성을 명확히 설명하고 있다. 실제 충돌이 아니라 유사 접두어에 따른 혼동 가능성만 존재하는 수준이다.
- **제안**: 현재 명명으로 충분히 구별 가능. 변경 불필요. 참고로 `scope_key + updated_at` 조합임을 더 명시하고 싶다면 `idx_agent_memory_scope_key_updated_at` 형태도 가능하나, 기존 관례(`idx_agent_memory_scope` 의 축약형) 와의 일관성을 감안하면 현 이름이 적절하다.

---

### [INFO] V086 버전 번호 — .sql + .conf 쌍, 유일성 확인

- **target 신규 식별자**: `V086` (마이그레이션 버전 번호)
- **기존 사용처**: V001~V085 존재, V086 은 main 브랜치에 미존재 (`git show origin/main:codebase/backend/migrations/V086__...` NOT IN MAIN 확인)
- **상세**: `check-duplicate-versions.sh` 는 `.sql` 파일 수만 카운트한다. V086 의 `.sql` 파일은 1개(`V086__agent_memory_scope_updated_index.sql`)이고 `.conf` 파일은 Flyway 실행 옵션 전용으로 스크립트 집계에서 제외된다. 기존 V022~V079 의 `.sql + .conf` 쌍 패턴과 동일하며 V번호 중복 없음.
- **제안**: 이상 없음.

---

### [INFO] plan 파일명 `agent-memory-scope-index.md` — 슬러그 유일성 확인

- **target 신규 식별자**: `plan/complete/agent-memory-scope-index.md`
- **기존 사용처**: `plan/complete/agent-memory-admin-ui.md`, `plan/complete/agent-memory-summary-model.md` 존재. main 브랜치의 `plan/complete/` 및 `plan/in-progress/` 에 동일 파일 미존재 확인.
- **상세**: 슬러그가 기존 파일과 겹치지 않는다. agent-memory 계열 명명 관례(kebab-case)와 일치.
- **제안**: 이상 없음.

---

## 요약

신규 도입 식별자 3종 — DB 인덱스명 `idx_agent_memory_scope_updated`, 마이그레이션 버전 `V086`, plan 슬러그 `agent-memory-scope-index.md` — 모두 기존 식별자와 충돌하지 않는다. `idx_agent_memory_scope_updated` 는 기존 `idx_agent_memory_scope` 와 접두어를 공유하지만 PostgreSQL 식별자 레벨에서 완전히 구별되며, SQL 주석으로 의도적 직교성이 명시되어 있다. V086 은 main 브랜치에 미존재하며 `.sql` 파일 1개로 check-duplicate-versions.sh 기준을 충족한다. 차단 사항 없음.

## 위험도

NONE

---

BLOCK: NO
