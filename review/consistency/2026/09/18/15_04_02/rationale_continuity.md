# Rationale 연속성 검토 — 그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (V117~V120)

## 검토 대상

- `plan/in-progress/spec-draft-graph-fk-indexes.md` (착수 예정 구현: V117~V120 마이그레이션 + e2e 확장)
- 이미 반영된 spec 커밋 `dfd4fd783`(`spec/1-data-model.md` §2.12.2·§2.12.3·§3·`## Rationale`, `spec/5-system/10-graph-rag.md` §2.3·§2.4, `spec/data-flow/6-knowledge-base.md` sink 표)
- 대조한 과거 Rationale: `spec/conventions/migrations.md` §1·§2·§5·§7, `codebase/backend/migrations/README.md` §4·§5, `spec/1-data-model.md` `## Rationale`의 기존 절(«삭제 연쇄의 FK 인덱스 다섯», «Trigger `(workflow_id)` 인덱스»), V111~V116 선례 파일

## 발견사항

없음 — CRITICAL/WARNING 없음.

### 확인한 정합 포인트 (참고, 조치 불요)

- **번호 정책 준수**: origin/main 의 현재 max(V)는 V116(`6dbac1f53`)이고 본 브랜치의 유일한 신규 커밋은 spec 문서뿐(마이그레이션 파일 미생성, `codebase/backend/migrations/`에 V117~V120 부재 확인됨) — plan 이 예고하는 V117~V120은 `migrations.md` §2 "단조 증가·gap 금지"와 충돌하지 않는다.
- **README §5 "신규 추가에도 0)을 둡니다" 패턴 준수**: plan 의 구현절이 "파일당 `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` + `.conf executeInTransaction=false`"를 명시하고 선례로 V111~V116을 인용한다. 이는 README §5가 V106의 실패 사례(신규 추가에 0-DROP 누락 시 invalid 인덱스가 영영 안 낫는 문제)를 근거로 2026-09-18에 확정한 규칙과 정확히 일치하며, 폐기된 대안(0-DROP 없는 신규 추가)을 재도입하지 않는다.
- **네이밍 충돌 없음**: `idx_entity_last_seen_chunk_id`·`idx_relation_evidence_chunk_id`·`idx_relation_head_entity_id`·`idx_relation_tail_entity_id`를 `codebase/`·`spec/`·`plan/` 전체에서 grep한 결과 plan 문서 자신 외에는 0건 — 기존 인덱스명과 충돌하거나 과거에 폐기된 이름을 재사용하지 않는다.
- **partial index 판단 기준 재사용**: `last_seen_chunk_id`·`evidence_chunk_id`는 nullable이라 partial(`WHERE ... IS NOT NULL`), `head_entity_id`·`tail_entity_id`는 NOT NULL이라 non-partial — 이는 V115·V116(`llm_usage_log`의 두 nullable FK)이 세운 "FK 트리거의 등치 조회는 IS NOT NULL을 함의하므로 partial 가능" 판단 기준을 그대로 계승한 것이며, 임의로 다른 기준을 도입하지 않았다.
- **"다섯" 절의 선행 예측 갱신 방식이 자기 자신이 세운 선례를 따름**: `dfd4fd783`의 유일한 기존 텍스트 편집은 "다섯" 절 말미 "나머지 32개 FK … 지식 베이스 연쇄가 다음 후보"라는 문장에 "— 같은 날 위 «그래프 RAG …» 절이 그 넷을 닫아 28개가 남았다" 를 괄호로 덧붙인 것뿐이다(diff 확인, 원문 "그 절의 문장은 그 범위에서 참이라 고치지 않는다"는 그대로 보존). 이는 "다섯" 절 자신이 "Trigger `(workflow_id)` 인덱스" 절에 대해 이미 쓴 것과 동일한 패턴("그 절의 문장은 그 범위에서 참이라 고치지 않는다" + 상태만 별도 언급)이라 무근거 번복이 아니라 확립된 관행의 반복이다. 해당 편집은 plan 자체의 `--spec` 처리에서 WARNING 1로 이미 지적·처분된 항목이며 새 Rationale 문구도 그때 함께 작성됐다.
- **"KB 선두 인덱스" 관행과의 관계**: "entity·relation의 기존 인덱스는 전부 knowledge_base_id가 선두"라는 서술은 하드 invariant로 선언된 적이 없고(grep 전수 확인, "모든 인덱스는 KB 선두여야 한다" 류의 금지 문장 없음) 현재 상태를 기술한 관찰문이다. 새 인덱스가 이를 벗어나는 것은 FK 트리거 자체가 KB를 모른다는 사실에 기인하며 KB-scoped 조회 경로에는 영향을 주지 않는다 — 우회되는 시스템 invariant는 없다.
- **"작은 테이블은 넣지 않는다" 원칙과의 정합**: "다섯" 절이 `alert_rule.workflow_id`·`edge.target_node_id`를 "작은 테이블이라 넣지 않았다"고 명시한 것과 대비해, 이번 대상(`entity`·`relation`)은 그래프 모드 KB에서 청크에 비례해 커지는 테이블임을 plan이 별도로 근거 짓고 있어 동일 원칙 내에서 다른 결론(index 추가)에 이른 것이 정합적으로 설명된다.

## 요약

이 PR(V117~V120 예정)의 spec 반영과 착수 plan은 `migrations.md`·README §5의 인덱스 작성 규약, 그리고 `spec/1-data-model.md` 기존 Rationale(다섯 절·Trigger 절)이 세운 판단 기준(0-DROP 신규 추가 패턴, partial-index 여부 판단 축, 선행 예측 갱신 시 원문 보존+상태만 덧붙이는 방식)을 그대로 계승하며, 과거에 명시적으로 기각된 대안을 재도입하거나 합의 원칙을 우회하는 지점을 찾지 못했다. 유일하게 과거 문장을 건드린 편집은 상태 갱신 성격이며 이미 해당 plan의 `--spec` 단계에서 WARNING으로 식별되고 정확히 처분된 항목이라 별도 지적 사항이 없다.

## 위험도

NONE
