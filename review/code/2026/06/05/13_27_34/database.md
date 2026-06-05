# 데이터베이스(Database) 리뷰 결과

리뷰 대상: rag-rerank-followup 변경셋 (26개 파일)
리뷰 일시: 2026-06-05

---

## 개요

변경된 26개 파일은 전부 `spec/` 및 `review/` 하위 마크다운 문서다. 실행 가능한 SQL 마이그레이션 파일(`.sql`), TypeORM/Prisma 엔티티(`.entity.ts`), 쿼리 빌더, 리포지토리 코드는 본 diff 에 포함되지 않는다. 그러나 `spec/1-data-model.md` 는 실제 마이그레이션(V081·V082·V084)으로 구현될 스키마 변경을 spec 수준에서 기술하고 있으므로, DB 설계 관점에서 검토한다.

---

## 발견사항

### [INFO] `executions.active_running_ms` 컬럼 추가 — 마이그레이션 안전성 양호

- 위치: `spec/1-data-model.md` +340행
- 상세: `active_running_ms INTEGER` 컬럼을 `executions` 테이블에 추가한다. 스펙에 "기본 0" 이 명시되어 있어 `DEFAULT 0 NOT NULL` 로 구현될 것으로 판단된다. PostgreSQL 에서 `DEFAULT` 상수를 가진 `ADD COLUMN NOT NULL` 은 테이블 재작성 없이 메타데이터 변경만으로 처리되므로(PG 11+) 무중단 배포에 안전하다. 실제 마이그레이션 SQL 이 diff 에 포함되지 않아 `DEFAULT` 값 누락 여부는 구현 시 재확인이 필요하다.
- 제안: V084(또는 해당 마이그레이션)에서 `ADD COLUMN active_running_ms INTEGER NOT NULL DEFAULT 0` 형태로 작성되었는지 구현 단계에서 확인. `DEFAULT` 없이 `NOT NULL` 만 쓰면 기존 행 처리로 전체 테이블 잠금이 발생한다.

---

### [INFO] `executions.conversation_thread JSONB NULL` 추가 (V084) — 안전한 nullable 추가

- 위치: `spec/1-data-model.md` +351행
- 상세: `NULL` 허용 JSONB 컬럼 추가다. `ADD COLUMN ... JSONB` 는 `DEFAULT` 없이도 PostgreSQL 에서 테이블 재작성 없이 처리된다. park 시점에만 쓰이고 나머지는 stale 가능한 의도적 설계로, 정합성 요건이 엄밀히 정의되어 있다.
- 제안: 이상 없음. rehydration 경로가 `conversation_thread IS NULL` 행을 안전하게 처리하는지(RESUME_CHECKPOINT_MISSING 처리 경로) 구현 코드에서 확인 권장.

---

### [INFO] RerankConfig 테이블 신설 (V081) + KnowledgeBase rerank_* 컬럼 (V082) — 스키마 설계 적절

- 위치: `spec/1-data-model.md` +360~362행
- 상세: RerankConfig 를 LLMConfig 와 분리한 sibling 테이블로 설계했다. `rerank_config_id UUID FK → RerankConfig` + `rerank_llm_config_id UUID FK → LLMConfig` 두 FK 가 모두 nullable 이어서 기존 행에 대한 마이그레이션 부담 없음. `rerank_mode` 는 Enum 컬럼(`off/cross_encoder/cross_encoder_llm`)으로 스위치 역할을 명확히 분리한다.
- 제안: V081 의 RerankConfig 테이블 생성은 기존 데이터에 영향 없는 순수 DDL ADD 이므로 안전하다. V082 의 KnowledgeBase 컬럼 추가도 nullable FK 이므로 잠금 위험 없음. 이상 없음.

---

### [INFO] `GET /agent-memories/scopes` 쿼리 — 대량 데이터 시 페이지네이션 적용 확인 필요

- 위치: `spec/5-system/17-agent-memory.md` +975행
- 상세: `GET /agent-memories/scopes` 가 `distinct scope_key` 목록을 반환하며, `limit`/`offset` 페이지네이션과 `q` 부분일치 필터를 명시하고 있다. `DISTINCT ON (scope_key)` + `LIKE '%q%` 조합은 대용량 `agent_memory` 테이블에서 순차 스캔 위험이 있다. spec 에 페이지네이션이 명시된 점은 양호하나, `scope_key` 컬럼에 인덱스가 있어야 하며, 부분일치(`LIKE '%q%'`)는 인덱스를 활용하지 못하므로 향후 데이터 증가 시 문제가 될 수 있다.
- 제안: `agent_memory(workspace_id, scope_key)` 복합 인덱스가 마이그레이션에 포함되었는지 확인. 부분일치 검색이 빈번할 경우 `pg_trgm` GIN 인덱스 또는 prefix-match(`LIKE 'q%'`)로 변경을 검토.

---

### [INFO] `DELETE /agent-memories?scopeKey=` — 대량 삭제 시 배치 처리 고려

- 위치: `spec/5-system/17-agent-memory.md` +978행
- 상세: scope 전체 삭제는 `WHERE scope_key = $1 AND workspace_id = $2 DELETE` 를 단일 쿼리로 실행한다. scope 당 최대 1000 FIFO 제한이 있어 최대 삭제 행 수가 제한되므로 현재 규모에서는 안전하다. 향후 FIFO 한도가 늘어날 경우 배치 처리가 필요할 수 있다.
- 제안: 현재 spec 의 scope 당 1000 한도 수준에서는 단일 DELETE 가 허용 가능. 한도 변경 시 배치 삭제(예: `DELETE ... WHERE id IN (SELECT id ... LIMIT 500)` 반복) 로 전환 권장.

---

## 요약

변경셋은 실행 코드가 아닌 순수 spec 문서 변경이므로, 직접적인 DB 코드 위험(N+1, 커넥션 누수, SQL 인젝션 등)은 본 diff 에 존재하지 않는다. 스키마 설계 관점에서 spec 에 기술된 변경사항은 전반적으로 적절하다: `active_running_ms` 는 `DEFAULT 0 NOT NULL` 로 안전한 컬럼 추가가 가능하고, `conversation_thread JSONB NULL` 은 무잠금 추가에 해당하며, RerankConfig/V081·V082 는 순수 ADD DDL 로 무중단 배포에 안전하다. 주의사항으로 `GET /agent-memories/scopes` 의 `DISTINCT + LIKE '%q%'` 패턴은 인덱스 미비 시 대량 데이터 환경에서 성능 저하를 유발할 수 있어 `(workspace_id, scope_key)` 인덱스 확보가 권장된다. 실제 마이그레이션 SQL 파일이 포함되지 않아 `DEFAULT` 값 누락 등 구체적인 DDL 위험은 구현 단계에서 재확인이 필요하다.

---

## 위험도

LOW
