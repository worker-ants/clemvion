# 요구사항(Requirement) 리뷰 — 그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (V117~V120)

## 검토 방법

`plan/in-progress/spec-draft-graph-fk-indexes.md` 가 선언한 목표("`entity.last_seen_chunk_id` · `relation.evidence_chunk_id` ·
`relation.head_entity_id` · `relation.tail_entity_id` 네 FK 에 인덱스를 더해 KB 삭제·재임베딩·엔티티 삭제 연쇄를 빠르게 한다")를
기준으로, 마이그레이션 8개 파일(V117~V120 `.sql`/`.conf`), e2e 테스트, spec 세 문서(`spec/1-data-model.md`,
`spec/5-system/10-graph-rag.md`, `spec/data-flow/6-knowledge-base.md`)의 실제 저장소 파일을 직접 Read/Grep 하여 대조했다.
독립 검증으로 `python3 scripts/check-migration-versions.py --base origin/main` 을 실행했고(결과: `OK: 120 migration(s), max V120`),
`entity.entity.ts`/`relation.entity.ts` 의 TypeORM 데코레이터, `V025__graph_rag.sql` 의 실제 FK `ON DELETE` 절, 선례
`V115__llm_usage_log_node_execution_id_index.sql`/`.conf`·README §5 텍스트와 대조했다. 저장소에 뮤테이션은 가하지 않았다 —
이 리뷰가 실행한 명령은 전부 `Read`/`Grep`/`cat`/`sed -n`/`find`/`git status`/`git diff`(읽기 전용) 와 스크립트 실행뿐이다.

**관측된 저장소 상태 이상(내가 만든 변경 아님)**: 리뷰 도중 `git status --short` 를 두 번 실행했는데, 세션 시작 시점 스냅샷에는 없던
미커밋 변경이 두 번째 실행에서 나타났다 — `plan/complete/spec-draft-deletion-cascade-indexes.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md` 두 파일이 `M` 상태로 추가됐다(diff 확인 결과 부록 표에 ✅ V117~V120
마킹, 트래커 "32개→28개" 갱신 — 이 PR 의 plan 상 "트래커 반영" 단계와 내용이 일치해 다른 세션이 그 단계를 실시간으로 수행 중인
것으로 보인다). 이 두 파일은 이 리뷰의 대상 파일 목록(30개)에 없었고 내가 편집하지도 않았다 — 그대로 보고한다. 아래 첫 WARNING 은
이 새 변경 내용까지 반영해 갱신했다.

## 발견사항

- **[WARNING]** `plan/complete/spec-draft-graph-fk-indexes.md` 를 인용하는 자리들이 현재 시점에는 **존재하지 않는 경로**를 가리킨다 —
  draft 는 아직 `plan/in-progress/spec-draft-graph-fk-indexes.md` 에 있고(`find plan -iname '*graph-fk-indexes*'` → in-progress 만
  존재), `complete/` 이동은 plan 체크리스트의 **마지막 미완료 항목**이다.
  - 위치: `spec/1-data-model.md` `## Rationale` → "그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (2026-09-18)" 절 말미
    (`> 출처: … 실측 절차는 \`plan/complete/spec-draft-graph-fk-indexes.md\`, 구현은 V117~V120.`); 동일 문구가
    `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.sql:5`,
    `V118__relation_evidence_chunk_id_index.sql:5`, `V119__relation_head_entity_id_index.sql:5`,
    `V120__relation_tail_entity_id_index.sql:5`, `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:15` 에도 있다.
    (위 "관측된 저장소 상태 이상" 참고 — 동시에 진행 중인 미커밋 변경으로 `plan/complete/spec-draft-deletion-cascade-indexes.md` 부록
    표 4행과 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커 항목에도 같은 `plan/complete/spec-draft-graph-fk-indexes.md`
    인용이 새로 추가돼, 이 시점 기준 깨진 링크 자리가 다섯에서 일곱으로 늘었다.)
  - 상세: 선례(V112~V116, `plan/complete/spec-draft-deletion-cascade-indexes.md`)는 spec/코드 인용과 draft `complete/` 이동을
    같은 커밋(`6dbac1f53`)에서 원자적으로 처리해 이런 창이 없었다. 이번 PR 은 spec/마이그레이션 커밋(`dfd4fd783`, `95c6f26b5`)과
    draft 이동을 분리했고, 지금(이 `/ai-review` 시점)은 아직 이동 전이라 인용이 깨진 링크다. 이 문제는 이미 `--impl-prep`
    consistency check(`review/consistency/2026/09/18/15_04_02/SUMMARY.md` WARNING 1)가 정확히 같은 자리를 지적했고, plan
    체크리스트 마지막 항목("이동 뒤 `grep -rln … spec codebase` 로 인용 전부 확인")으로 완화책이 이미 마련돼 있다 — 새로 발견한
    결함이 아니라 **아직 해소되지 않은, 추적 중인 창**이며, 지금도 다른 세션이 관련 단계를 진행 중인 것으로 보인다. 순수
    문서/주석 인용이라 런타임 동작에는 영향이 없다.
  - 제안: 이 PR 을 머지하기 전에 plan 체크리스트 마지막 항목(트래커 반영 + draft `complete/` 이동 + `grep -rln` 검증)을 반드시
    완수할 것 — 특히 이번에 새로 늘어난 두 인용 자리(부록 표·트래커)도 그 `grep -rln` 검증 범위에 포함되는지 확인. 코드 fix
    대상이 아니라 **plan 프로세스 완결** 대상이다(spec 본문 자체는 수정 불필요 — 이동만 하면 인용이 유효해진다).

- **[INFO]** 신규 4개 인덱스에 대응하는 TypeORM `@Index` 데코레이터가 `entity.entity.ts`/`relation.entity.ts` 에 추가되지 않았다.
  - 위치: `codebase/backend/src/modules/knowledge-base/entities/entity.entity.ts` (컬럼 `lastSeenChunkId` 선언부, `@Index` 없음),
    `relation.entity.ts` (컬럼 `headEntityId`/`tailEntityId`/`evidenceChunkId` 선언부, `@Index` 없음).
  - 상세: 선례 V115/V116(`llm_usage_log.node_execution_id`/`execution_id`)도 동일하게 엔티티 파일에 `@Index` 를 추가하지 않았다
    (`llm-usage-log.entity.ts` 확인) — 이 저장소가 CONCURRENTLY/partial 인덱스는 순수 SQL 마이그레이션으로만 관리하고 TypeORM
    데코레이터에 미러링하지 않는 기존 관행이다. 결함이 아니라 관행 일치.
  - 제안: 조치 불요.

## 항목별 확인 결과 (문제 없음)

1. **기능 완전성** — 4개 FK(`entity.last_seen_chunk_id_fkey` SET NULL, `relation.evidence_chunk_id_fkey` SET NULL,
   `relation.head_entity_id_fkey`/`relation.tail_entity_id_fkey` CASCADE, 전부 `V025__graph_rag.sql` 원본 정의와 대조 확인)에
   각각 정확히 매칭되는 인덱스가 추가됐고, `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` 의 `EXPECTED` 배열이
   테이블·컬럼·`WHERE` 절까지 네 항목 모두 실제 SQL 정의와 문자열 단위로 일치한다.
2. **엣지 케이스(NULL)** — `last_seen_chunk_id`/`evidence_chunk_id` 는 nullable 컬럼이라 `WHERE … IS NOT NULL` partial 인덱스로,
   `head_entity_id`/`tail_entity_id` 는 `NOT NULL` 컬럼이라 partial 조건 없이 만들어 실제 스키마 제약과 정확히 일치한다.
3. **TODO/FIXME/HACK/XXX** — V117~V120 `.sql`/`.conf`, e2e 파일 전수 grep 0건.
4. **의도-구현 일치** — 마이그레이션 헤더 주석의 실측치(예: `entity.last_seen_chunk_id` 52,323 ms(2,000회) 등)가 plan draft ·
   spec Rationale 절과 숫자 단위로 동일하며, e2e 파일 머리말 서술도 실제 `EXPECTED` 배열 내용과 부합한다.
5. **에러 시나리오** — `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 순서(README §5 "신규
   추가에도 0) 을 둡니다" 규약, 2026-09-18 V111 선례)를 그대로 따라 `CREATE` 실패 후 재실행 시 invalid 잔재가 자동 정리된다.
   e2e 가 `indisvalid` 까지 단언해 존재-only 오탐(생성 실패한 invalid 인덱스가 존재로만 통과하는 사례)을 막는다.
6. **데이터 유효성** — 해당 없음(순수 스키마 변경, 애플리케이션 입력 검증과 무관). plan 도 "애플리케이션 코드 변경 없음" 을 명시.
7. **비즈니스 로직** — KB 삭제 129,941 ms → 48.1 ms 개선의 근거인 "선두 인덱스가 skip scan 으로 KB 수에 비례" vs "선두 인덱스
   부재로 전 테이블 스캔" 구분이 spec Rationale 절에 정확히 반영됐고, `head`/`tail` 을 넣는 이유(기존 복합 인덱스가 있음에도
   KB 수 비례 비용이 남는다는 것)가 Rationale 에 명시돼 판단 근거가 코드와 spec 양쪽에서 일관된다.
8. **반환값** — 해당 없음(마이그레이션/스키마 변경). e2e 는 `it.each` 로 4개 인덱스 각각에 대해 독립 단언, 누락 없이 전수 커버.
9. **spec fidelity** — `spec/1-data-model.md`(§2.12.2/§2.12.3 인덱스 줄, §3 표 4행, Rationale 신설 절), `spec/5-system/10-graph-rag.md`
   (§2.3/§2.4 불릿), `spec/data-flow/6-knowledge-base.md`(sink 표 entity/relation 행)를 diff 와 line-level 로 대조한 결과, plan
   draft `## 변경안` S1~S5 가 지시한 내용과 실제 커밋된 spec 본문이 정확히 일치한다. 인접 절("삭제 연쇄의 FK 인덱스 다섯")의
   "32개 남음·지식 베이스 연쇄가 다음 후보" 문장도 "28개가 남았다" 로 정확히 갱신됐다. 유일한 미해결 지점은 위 WARNING 의
   `plan/complete/` 선인용이다.

## 요약

V117~V120 마이그레이션·e2e 테스트·spec 세 문서 변경은 plan draft 가 선언한 목표(그래프 RAG 삭제 연쇄 FK 넷에 인덱스 추가)를 정확히
구현하며, 신규 인덱스의 partial 여부·컬럼·이름이 실제 FK 제약(nullable/NOT NULL, ON DELETE SET NULL/CASCADE)과 line-level 로
일치하고, 선례(V111~V116)의 마이그레이션·README §5·spec 갱신 패턴을 자리 단위로 정확히 복제했다. `check-migration-versions.py`
독립 재실행으로 버전 연속성(V117~V120, gap 없음)도 확인했다. 실질적 코드 결함은 없으며, 유일한 지적은 `plan/complete/` 로의
draft 이동이 아직 이뤄지지 않아 관련 인용 자리들(spec Rationale·마이그레이션 헤더 4·e2e 머리말, 그리고 리뷰 도중 관측된 부록
표·트래커의 신규 인용까지)이 현재 시점 기준 깨진 링크라는 점인데, 이는 이미 impl-prep 단계에서 발견돼 plan 체크리스트 마지막
항목으로 추적 중인 사안이라 머지 전 완수 여부만 확인하면 된다.

## 위험도

LOW
