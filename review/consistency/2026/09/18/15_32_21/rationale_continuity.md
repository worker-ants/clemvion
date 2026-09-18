# Rationale 연속성 검토 — 그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (V117~V120, impl-done)

## 검토 범위

- **scope(`spec/conventions/`) 델타 0개** — 확인함. 이 PR 은 conventions 를 바꾸지 않았으므로 그 영역에는 검토할 신규 결정이 없다.
- 실제 구현 diff(9파일/241줄)는 `spec/1-data-model.md`·`spec/5-system/10-graph-rag.md`·`spec/data-flow/6-knowledge-base.md`
  (커밋 `dfd4fd783`) + `codebase/backend/migrations/V117~V120__*.{sql,conf}`·`deletion-cascade-indexes.e2e-spec.ts`
  (커밋 `95c6f26b5`) + `plan/in-progress/spec-draft-graph-fk-indexes.md` + 두 트래커(`plan/complete/spec-draft-deletion-cascade-indexes.md`,
  `plan/in-progress/spec-draft-nullable-notation-followups.md`)의 미커밋 갱신이다. 절대경로 워킹트리에서 `git diff origin/main...HEAD`
  로 전부 직접 대조했다.
- **동일 작업에 대해 이미 두 차례 rationale-continuity 검토가 선행함**: `review/consistency/2026/09/18/14_54_15`(--spec, 위험도 NONE)
  · `review/consistency/2026/09/18/15_04_02`(--impl-prep, 위험도 NONE). 본 검토는 그 위에 **실제 구현 코드(마이그레이션 SQL·e2e·트래커
  최종 상태)가 계획·Rationale 과 어긋나지 않았는지**를 impl-done 관점에서 재확인한다.

## 발견사항

없음 — CRITICAL/WARNING 없음.

### 확인한 정합 포인트 (참고, 조치 불요)

- **마이그레이션 ↔ spec 인덱스 정의 축자 일치**: V117~V120 네 `.sql` 의 인덱스명·테이블·컬럼·partial 조건
  (`idx_entity_last_seen_chunk_id ON entity (last_seen_chunk_id) WHERE ... IS NOT NULL` 등)이 `spec/1-data-model.md` §2.12.2/§2.12.3·
  §3 인덱스 전략 표·`spec/5-system/10-graph-rag.md` §2.3/§2.4·`spec/data-flow/6-knowledge-base.md` sink 표와 번호(V117~V120)까지
  글자 그대로 맞는다.
- **DROP-먼저 신규 추가 관행 준수**: 넷 모두 `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` +
  `.conf executeInTransaction=false` 형태다. 이는 `migrations/README.md §5`("신규 추가에도 0) 을 둡니다" — V106 실패 사례가 확정한
  규칙, 선례 V111~V116)와 정확히 일치하며, README §5 가 명시적으로 기각한 "0-DROP 없는 신규 추가" 를 재도입하지 않는다.
- **partial index 판단 축 재사용**: `last_seen_chunk_id`·`evidence_chunk_id`(nullable) 는 partial, `head_entity_id`·`tail_entity_id`
  (NOT NULL) 는 non-partial — V115·V116 이 세운 "FK 트리거 등치 조회는 IS NOT NULL 을 함의" 기준을 그대로 계승한다.
- **헤더 실측 수치 ↔ spec Rationale ↔ plan 실측표 3자 일치**: KB 하나 삭제 129,941 → 48.1 ms, 재임베딩 1,795.7 → 2.37 ms, 엔티티
  하나 삭제 4.25 → 0.38 ms 를 마이그레이션 헤더·`spec/1-data-model.md` `## Rationale` «그래프 RAG 삭제 연쇄의 FK 인덱스 넷»·plan 실측표
  세 곳에서 동일하게 확인했다. spec 이 코드보다 넓게 말하는 곳 없음(수치·범위 모두 마이그레이션 헤더에도 동일하게 실려 있다).
- **"다섯" 절의 선행 예측 갱신이 그 절 자신의 관례를 따름**: `spec/1-data-model.md` `## Rationale`의 기존 절("삭제 연쇄의 FK 인덱스 다섯")
  말미 "나머지 32개 FK … 지식 베이스 연쇄가 다음 후보" 문장에 "— 같은 날 위 «그래프 RAG …» 절이 그 넷을 닫아 28개가 남았다" 가 **괄호로
  덧붙여졌을 뿐, 원문("그 절의 문장은 그 범위에서 참이라 고치지 않는다")은 보존**됐다(diff 확인). 이는 "다섯" 절 자신이 "Trigger
  `(workflow_id)` 인덱스" 절에 대해 이미 쓴 방식(원문 보존 + 상태만 별도 언급)의 반복이며, 이 편집은 `--spec`(14_54_15) 단계에서
  WARNING 1 로 이미 지적·처분됐고 새 Rationale 문구도 그때 함께 작성됐다 — 결정의 무근거 번복이 아니다.
- **트래커 "32개→28개" 갱신이 부록 SoT 와 실제로 일치**: `plan/complete/spec-draft-deletion-cascade-indexes.md` 부록 표를
  `awk 'NR>184 && /^\| [a-z_]+ \|/'`로 세면 전수 37행, `!/✅/` 로 세면 28행 — 트래커(`spec-draft-nullable-notation-followups.md`)의
  "28개 남음" 주장과 정확히 일치한다(지어낸 숫자 아님, 직접 카운트로 재확인).
- **부록 ✅ 표기 방식이 기존 관례(✅ V116)를 그대로 따름**: 이번 네 행에 "✅ V117 (`plan/complete/spec-draft-graph-fk-indexes.md`)" 등을
  추가한 것은 앞선 "execution → llm_usage_log.execution_id | SET NULL | ✅ V116" 행과 동일한 서식이며, 새로 추가된 각주("✅ 는 뒤 PR 이
  닫은 것까지 갱신한다 — 표 자체는 V111 시점 카탈로그 그대로")는 표의 스코프(고정 카탈로그)를 명확히 하는 보완 설명이지 과거 결정을
  뒤집는 것이 아니다.
- **"KB 선두 인덱스" 서술은 하드 invariant 가 아님**(재확인, 15_04_02 의 결론과 동일): "entity·relation 의 기존 인덱스는 전부
  knowledge_base_id 가 선두" 라는 문장은 관찰 서술이지 "모든 인덱스가 KB 선두여야 한다" 는 금지 규칙으로 spec 어디에도 선언돼 있지
  않다(grep 재확인, 해당 금지 문장 0건). V119·V120 이 KB 비선두 단일 컬럼 인덱스를 추가한 것은 FK 트리거 자체가 KB 를 모른다는 사실에
  기인하며, 기존 `(knowledge_base_id, head_entity_id)` 등 KB-scoped 검색 경로는 그대로 유지되므로 우회되는 invariant가 없다.
- **"단독 컬럼 인덱스" 판단 기준도 기존 원칙과 정합**: "Trigger `(workflow_id)` 인덱스" 절이 세운 "선두가 술어 컬럼 하나뿐이면 복합
  인덱스가 줄 것이 없다" 는 기준을 `head_entity_id`/`tail_entity_id`(FK 트리거의 등치 조건이 그 컬럼 하나)에도 동일하게 적용했다 —
  새 기준을 임의로 들여오지 않았다.
- **네이밍 충돌 없음**(재확인): `idx_entity_last_seen_chunk_id`·`idx_relation_evidence_chunk_id`·`idx_relation_head_entity_id`·
  `idx_relation_tail_entity_id` 를 `codebase/`·`spec/`·`plan/` 전체에서 grep, 계획·구현 문서 자신 외 충돌 0건.
- **코드 리뷰(2026/09/18 15_20_31)도 Critical 0** — WARNING 2건은 모두 "plan draft 가 아직 `plan/complete/` 로 이동 전이라 선인용이
  일시적으로 깨진 링크" 류의 **북키핑** 항목이지 Rationale 내용의 충돌이 아니며, plan 체크리스트 마지막 미체크 항목("트래커 반영 ·
  이 draft `complete/` 이동")이 그 해소 절차를 이미 명시하고 있다.

## 요약

이번 impl-done 검토는 앞선 두 차례(`--spec`·`--impl-prep`) rationale-continuity 검토가 위험도 NONE 으로 판정한 계획을, 실제 구현
(마이그레이션 SQL 넷·e2e 확장·spec 세 문서·플랜 트래커 최종 상태)까지 확장해 재검증한 것이다. 인덱스 정의·번호·partial 조건은 spec ↔
마이그레이션 ↔ e2e 세 곳에서 축자 일치하고, README §5 가 확정한 0-DROP 신규 추가 패턴·V115/V116 이 세운 partial-index 판단 축·
"Trigger" 절이 세운 단독 컬럼 인덱스 판단 기준을 그대로 계승했다. 유일하게 과거 문장을 건드린 편집("32개→28개")은 그 절 자신이
이미 쓴 "원문 보존 + 상태 별도 언급" 관례를 반복한 것으로, 새 Rationale 도 같은 커밋에 함께 실렸다. 기각된 대안의 재도입, 합의
원칙 위반, 무근거 번복, 시스템 invariant 우회는 어느 것도 발견되지 않았다.

## 위험도

NONE
