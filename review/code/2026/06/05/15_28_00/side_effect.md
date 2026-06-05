# 부작용(Side Effect) 리뷰 — V086 인덱스 추가 + plan spec_impact

대상 커밋: `faa464b8` (84dd7314..HEAD)
변경 파일:
- `codebase/backend/migrations/V086__agent_memory_scope_updated_index.sql`
- `codebase/backend/migrations/V086__agent_memory_scope_updated_index.conf`
- `plan/complete/agent-memory-scope-index.md` (신규)
- `plan/complete/rag-rerank-followup-v2.md` (spec_impact 추가)
- `plan/complete/rag-rerank-impl.md` (spec_impact 추가)
- `spec/1-data-model.md` (인덱스 표 1행 추가)
- `spec/5-system/17-agent-memory.md` (AGM-02 인덱스 목록 갱신)

---

## CRITICAL

없음.

---

## WARNING

- **[WARNING] AGM-12 참조가 spec 에 존재하지 않음**
  - 위치: `V086__agent_memory_scope_updated_index.sql` 주석 3행 — `listScopes (admin 메모리 가시화, AGM-12 — GET /agent-memories/scopes)`
  - 상세: 마이그레이션 주석이 AGM-12 요구사항 ID와 `GET /agent-memories/scopes` 엔드포인트를 기정사실로 언급하나, `spec/5-system/17-agent-memory.md` 에 AGM-12 는 정의되어 있지 않다(AGM-11까지만 존재). `plan/complete/agent-memory-scope-index.md` 도 동일하게 AGM-12 를 인용한다. 미정의 요구사항 ID 를 마이그레이션 주석·plan 에 참조하면 향후 유지보수자가 해당 인덱스의 목적 추적 시 혼란을 유발한다.
  - 제안: 주석을 `(admin 메모리 가시화 — GET /agent-memories/scopes, spec §6 예정)` 처럼 AGM-12 ID 없이 서술하거나, spec 에 AGM-12 를 정식 등록한 뒤 참조할 것. 현재 단계(인덱스만 선제 추가)에서 미구현 기능의 ID를 주석에 고정하는 것은 spec-impl evidence 단일 진실 원칙에 어긋난다.

- **[WARNING] listScopes 쿼리 미구현 상태에서 인덱스 선제 추가**
  - 위치: `V086__agent_memory_scope_updated_index.sql`, `agent-memory.service.ts` 전체
  - 상세: 인덱스가 커버하는 `GROUP BY scope_key ORDER BY MAX(updated_at) DESC` 쿼리가 현재 `agent-memory.service.ts` 에 존재하지 않는다(코드베이스 전수 grep 결과 0건). `GET /agent-memories/scopes` 엔드포인트도 컨트롤러에서 발견되지 않는다. 즉 인덱스는 현재 아무 쿼리에도 사용되지 않는 orphan 상태다. 이 자체가 동작 부작용은 아니지만(인덱스가 있어도 쿼리가 없으면 DB 에 무해), 운영 환경 테이블 크기에 따라 `CONCURRENTLY` 실행 비용(I/O·CPU 시간)이 즉시 발생한다.
  - 제안: plan 의 "비고: SQL 자체는 무변경" 은 정확하나, 관련 기능 구현 PR 이 병행/후속 진행될 것임을 plan 또는 마이그레이션 주석에 명시할 것.

---

## INFO

- **[INFO] CONCURRENTLY + executeInTransaction=false 패턴 — 기존 패턴과 일치**
  - 위치: `V086__agent_memory_scope_updated_index.conf` (1행), `V086__agent_memory_scope_updated_index.sql` (15행)
  - 상세: `V074`~`V079` (agent_memory HNSW 인덱스)와 동일한 `executeInTransaction=false` + `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 패턴. 프로젝트 컨벤션과 완전 일치. Flyway 비-트랜잭션 모드에서 중단 시 invalid 인덱스가 남을 수 있으나 이는 CONCURRENTLY 의 기지 동작이며 `IF NOT EXISTS` 덕분에 재실행 시 이미 valid 한 인덱스는 no-op. invalid 인덱스는 수동 `DROP INDEX CONCURRENTLY` 후 재실행이 필요하며, 마이그레이션 주석의 DOWN 절에 `DROP INDEX CONCURRENTLY IF EXISTS` 로 안내되어 있다.

- **[INFO] 기존 created_at 인덱스(idx_agent_memory_scope)와의 직교성**
  - 위치: `V073__agent_memory.sql` 29행 vs `V086__agent_memory_scope_updated_index.sql` 15행
  - 상세: 신규 `(workspace_id, scope_key, updated_at)` 인덱스는 기존 `(workspace_id, scope_key, created_at)` 인덱스를 대체하지 않고 병존한다. evict 경로(`ORDER BY created_at DESC`)는 기존 인덱스를 계속 사용하며 쿼리 플랜 변경 없음. `V080` 의 `(expires_at) WHERE expires_at IS NOT NULL` partial 인덱스도 영향받지 않는다. 세 인덱스가 독립적으로 공존하며 기존 쿼리 결과 불변 확인.

- **[INFO] plan 파일 spec_impact 추가 — 동작 부작용 없음**
  - 위치: `plan/complete/rag-rerank-followup-v2.md`, `plan/complete/rag-rerank-impl.md`
  - 상세: 완료된 plan 파일에 `spec_impact` frontmatter 키를 소급 추가한 것으로 메타데이터 정비 성격. 코드/DB/API 동작에 영향 없음.

- **[INFO] spec 문서 변경 — 기술적 부작용 없음**
  - 위치: `spec/1-data-model.md` 인덱스 표, `spec/5-system/17-agent-memory.md` AGM-02 서술
  - 상세: 인덱스 표에 신규 행 추가, AGM-02 서술에 신규 인덱스 언급 추가. 런타임 동작에 영향 없는 문서 갱신.

---

## 요약

V086 마이그레이션은 순수 인덱스 추가(`CREATE INDEX CONCURRENTLY IF NOT EXISTS`)이며, 기존 쿼리 결과·함수 시그니처·공유 상태·API 동작을 변경하지 않는다. `executeInTransaction=false` + `IF NOT EXISTS` 조합으로 재실행 안전성과 무중단 배포 요건을 충족하며, 기존 `created_at` 인덱스 및 `expires_at` partial 인덱스와 완전히 직교하여 evict/recall 경로에 플랜 변경이 없다. 주요 주의점은 두 가지다. 첫째, 마이그레이션 주석과 plan 이 참조하는 AGM-12 요구사항 ID 가 spec 에 미등록 상태로 spec-impl 단일 진실 원칙에 어긋난다. 둘째, 인덱스가 커버하는 `listScopes` 쿼리 및 `GET /agent-memories/scopes` 엔드포인트가 현재 미구현 상태이므로 인덱스는 orphan 으로 존재하며 `CONCURRENTLY` 실행 비용만 배포 시 즉시 발생한다. rag-rerank plan 의 spec_impact 소급 추가와 spec 문서 갱신은 동작 부작용이 없다.

---

## 위험도

LOW

BLOCK: NO
