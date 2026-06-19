# 데이터베이스 관점 코드 리뷰

대상 브랜치: `claude/agent-a5522a5d692774509`
기준: `origin/main..HEAD -- codebase/`
리뷰 일시: 2026-06-19

---

## 발견사항

### INFO-1 GIN 인덱스 부재 (seq scan) — 기존 이관 항목, 신규 회귀 없음

- **등급**: INFO
- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` — `getUsages()`, 라인 747–772
- **상세**: 이번 변경으로 `n.config -> 'mcpServers' @> :mcpProbe::jsonb` 조건이 추가됐다. 해당 조건에 적합한 GIN 인덱스(`jsonb_path_ops`)가 `node.config`에 존재하지 않아 seq scan이 발생한다. 그러나 기존의 `->> 'integrationId'` 직접 참조 조건도 이미 동일하게 seq scan이었으므로 이번 변경이 성능 회귀를 새로 일으킨 것은 아니다. `plan/in-progress/integration-mcp-usage-followups.md` ⑤ 항목으로 이관돼 추적 중이다.
- **제안**: 후속 작업으로 `CREATE INDEX CONCURRENTLY idx_node_config_gin ON node USING GIN (config jsonb_path_ops)` 마이그레이션 추가. `CONCURRENTLY` 특성상 트랜잭션 블록 바깥에서 실행 필요.

---

### INFO-2 `getUsages()` 내부 이중 `findById` 호출 — 기존 이관 항목

- **등급**: INFO
- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` — `remove()` 라인 702 / `getUsages()` 라인 737
- **상세**: `remove()`가 먼저 `integrationRepository.findOne()`으로 integration 행을 조회한 뒤, `getUsages()`를 호출하면 내부에서 `findById()`로 동일 행을 재조회한다. 단건 추가 SELECT이며 정확성 문제는 없다. `plan/in-progress/integration-mcp-usage-followups.md` ⑦ 항목으로 이관돼 추적 중이다.
- **제안**: `getUsages()`에 workspace 소속 검증 스킵 옵션을 추가하거나 내부 SQL 헬퍼를 분리해 `remove()` 경로에서 중복 조회를 제거한다.

---

### INFO-3 e2e INSERT 컬럼 정합 — 이상 없음 (확인 기록)

- **등급**: INFO (확인 완료, 이슈 없음)
- **위치**: `codebase/backend/test/integration-usage-mcp.e2e-spec.ts` — `insertWorkflow()` 라인 86, `insertNode()` 라인 103
- **상세**: e2e 테스트가 `workflow` 테이블에 `(workspace_id, name, is_active, created_by)` 직접 INSERT하고, `node` 테이블에 `(workflow_id, type, category, label, config)` 직접 INSERT한다.
  - `workflow` 컬럼: V001 스키마 정의와 일치. NOT NULL 컬럼 `workspace_id`, `name`, `created_by` 모두 공급됨. `is_active`는 DEFAULT FALSE이나 명시 공급해도 무방.
  - `node` 컬럼: NOT NULL 컬럼 `workflow_id`, `type`, `category`, `label`, `config` 전부 공급됨. `position_x`/`position_y`는 DEFAULT 0이 적용돼 생략 가능. `insertNode('http-request', 'integration', ...)`, `insertNode('ai-agent', 'ai', ...)`에서 사용한 `'integration'`, `'ai'` 카테고리 값은 V001 초기 스키마 및 V003 마이그레이션 기준 유효한 `node_category` enum 값이다.
- **제안**: 해당 없음. 스키마와 정합 확인됨.

---

### INFO-4 CASE 식 `:integrationId` 바인딩 — 이상 없음 (확인 기록)

- **등급**: INFO (확인 완료, 이슈 없음)
- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` 라인 766–769
- **상세**: `addSelect("CASE WHEN n.config ->> 'integrationId' = :integrationId THEN 'direct' ELSE 'mcp' END", 'usage_kind')`에서 `:integrationId` 파라미터가 `Brackets` 내부의 `.where()`에서 이미 `{ integrationId: id }`로 바인딩됐다. TypeORM QueryBuilder는 동일 파라미터 이름을 `select` 절과 `where` 절에서 공유하므로 중복 바인딩 없이 정상 동작한다. SQL Injection 위험 없음.
- **제안**: 해당 없음.

---

### INFO-5 `@>` containment 탐색 범위 — 배열 최상위 요소만 검사, 의도 부합

- **등급**: INFO (확인 완료, 이슈 없음)
- **위치**: `integrations.service.ts` 라인 755–757
- **상세**: `n.config -> 'mcpServers' @> '[{"integrationId":"<id>"}]'::jsonb`는 `mcpServers` 배열 내 적어도 하나의 요소가 `{"integrationId":"<id>"}` 키-값 쌍을 포함하는지 검사한다. 스펙의 MCP 서버 구조(`{ integrationId, enabledTools }`)에서 `integrationId`는 최상위 필드이므로 이 containment 검사는 의도에 부합한다. 중첩 배열이나 추가 키가 있어도 `@>` 연산자가 올바르게 수퍼셋 포함 여부를 판정한다.
- **제안**: 해당 없음.

---

## 요약

이번 변경의 핵심 DB 관련 코드는 `getUsages()`의 WHERE 절을 `Brackets`로 확장해 `config ->> 'integrationId'` 직접 참조와 `config -> 'mcpServers' @> :mcpProbe::jsonb` MCP 참조의 합집합을 구하고, CASE 식으로 `usage_kind`를 산출하는 부분이다. 파라미터화된 바인딩이 올바르게 사용돼 SQL Injection 위험이 없으며, e2e 테스트의 직접 INSERT 컬럼 목록도 실제 스키마 DDL과 정합된다. GIN 인덱스 부재(seq scan)와 이중 `findById` 호출은 이번 변경이 도입한 신규 회귀가 아니며 각각 `plan/in-progress/integration-mcp-usage-followups.md` ⑤·⑦ 항목으로 이관돼 추적 중이다. 마이그레이션 파일 신규 추가가 없어 스키마 변경 안전성 이슈는 해당 없음.

## 위험도

NONE

---

STATUS: DONE
