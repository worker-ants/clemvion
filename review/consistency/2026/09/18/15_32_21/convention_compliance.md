# 정식 규약 준수 검토 — 그래프 RAG 삭제 연쇄 FK 인덱스 넷 (V117~V120)

## 검토 범위와 방법

`spec/conventions/` 자체 델타는 0개 파일(이 PR 은 그 영역을 바꾸지 않았다 — 정상). 실제 구현 diff(9파일/241줄)는
`codebase/backend/migrations/V117~V120__*.{sql,conf}` 4쌍 + `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`
확장 + `spec/1-data-model.md`·`spec/5-system/10-graph-rag.md`·`spec/data-flow/6-knowledge-base.md` 갱신이다. 이 델타에
적용되는 정식 규약은 `spec/conventions/migrations.md`(+ 시행 상세인 `codebase/backend/migrations/README.md`)이며,
부수적으로 `spec-impl-evidence.md`(frontmatter)·`review-citations.md`(주석 인용 형식)를 대조했다. 모든 대상 파일은
워킹트리 절대경로로 직접 Read 했다(번들에 diff 본문이 실리지 않았으므로).

## 발견사항

없음 — CRITICAL/WARNING 없음.

대조한 항목과 결과:

1. **파일 명명 (`migrations.md` §1)** — `V117__entity_last_seen_chunk_id_index.sql` 등 네 파일 모두
   `V<정수>__<snake_case>.sql` 형식, 설명자는 권장 문자집합(영문 소문자+숫자+`_`)만 사용. `.conf` base name 이
   대응 `.sql` 과 정확히 일치(4쌍 모두 확인). alphanumeric suffix 없음.
2. **V번호 정책 (§2)** — V116 다음 V117~V120 연속 4개, gap 없음, 재사용 없음. plan 체크리스트에 기록된
   `check-migration-versions.py --base origin/main` 결과(`OK: 120 migration(s), max V120`)와 일치.
3. **Append-only (§3)** — 기존 V116 이하 파일 수정 없음, 신규 V만 추가.
4. **비-트랜잭션 모드 + 단일 CREATE (README §4·§5)** — 네 `.conf` 모두 `executeInTransaction=false`, 각 `.sql` 은
   `CONCURRENTLY` 기반 `CREATE` 정확히 1개.
5. **신규 추가에도 DROP-먼저 (README §5, 2026-09-18 규칙·선례 V111~V116)** — 네 파일 모두
   `DROP INDEX CONCURRENTLY IF EXISTS <새 이름>` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS <새 이름>` 순서를 지킨다.
   신규 추가라 옛 이름 DROP 은 없음 — 규칙이 요구하는 정확한 형태.
6. **DOWN 주석 (README §2)** — 네 파일 모두 하단에 `-- DOWN(...): DROP INDEX CONCURRENTLY IF EXISTS ...` 존재.
   README 예시는 두 줄(`-- DOWN:` + 별도 줄)이지만, 실제로는 V111~V116 이 이미 세운 한 줄 형태(`-- DOWN(수동 롤백
   참고 — Flyway 자동 실행 아님): ...`)를 그대로 잇는다 — 이 PR 이 만든 새 이탈이 아니라 기존 로컬 관행 계승.
7. **인덱스 이름 패턴** — `idx_<table>_<column>` (`idx_entity_last_seen_chunk_id` 등)로 저장소 전역 관행과 일치.
8. **spec 교차 인용 (migration 헤더 ↔ spec 본문 ↔ plan 실측)** — 헤더의 실측 수치(129,941→48.1 ms, 4.25→0.38 ms,
   1,795.7→2.37 ms, 개별 인덱스별 52,323/76,220/611.8/606.4 ms 와 크기 12/24/19/19 MB, 쓰기비용 1,438.8→1,467.9 ms ·
   1,879.3→2,084.0 ms)가 `spec/1-data-model.md` `## Rationale` 신설절·`plan/in-progress/spec-draft-graph-fk-indexes.md`
   실측 표와 문자 그대로 일치. 인덱스명·테이블·컬럼·partial 조건·V번호(V117~V120)도 `spec/1-data-model.md` §2.12.2/§2.12.3/§3,
   `spec/5-system/10-graph-rag.md` §2.3/§2.4, `spec/data-flow/6-knowledge-base.md` sink 표 넷이 서로 어긋남 없이 대응한다.
9. **e2e 명명·검증 (`deletion-cascade-indexes.e2e-spec.ts`)** — 기존 `EXPECTED` 배열 패턴(이름 + `def` 정규식, `indisvalid`
   포함 대조)을 그대로 확장. 9개 항목 전부 실재 확인.
10. **`review-citations.md`** — 마이그레이션 헤더가 인용하는 것은 `spec/1-data-model.md §3`·`plan/complete/...` 같은
    전체 경로/섹션 표기이지 bare `hh_mm_ss` 형태의 review 세션 인용이 아니다 — 이 규약이 금지하는 패턴에 해당하지 않는다.
11. **`spec-impl-evidence.md` (frontmatter)** — `spec/1-data-model.md` 는 `EXCLUDE_BASENAMES` 대상이라 frontmatter
    의무 자체가 없다. `spec/5-system/10-graph-rag.md` 는 이미 `status: implemented` + `code:` 글로브가 매치를 만족하는
    상태라 게이트에 영향 없음. 이 문서의 `code:` 가 과거 `V025__graph_rag.sql` 을 명시 인용한 선례가 있어 V117~V120 도
    나란히 적는 편이 정합적이라는 관전은 가능하나(경미), `migrations.md` 자신의 `code: codebase/backend/migrations/**`
    가 이미 전 마이그레이션 파일을 포괄하므로 **의무 사항은 아니다** — CRITICAL/WARNING 으로 올리지 않음.

## 참고 (범위 밖·이미 추적 중)

- `plan/complete/` 선인용(마이그레이션 헤더 4·e2e 1·spec Rationale 1)은 `review/code/2026/09/18/15_20_31/SUMMARY.md`
  WARNING 1 로 이미 식별·처분됨(이 PR 마지막 커밋에서 draft 를 `plan/complete/` 로 이동 예정) — `spec/conventions/**`
  규약이 아니라 plan-lifecycle 문제라 본 검토의 대상 규약 밖이며, 중복 등재하지 않는다.
- `V119__relation_head_entity_id_index.conf` 의 주석 "V119 **은**"은 한국어 조사 오류로 보인다("V119"는 "구"로 끝나
  모음 종성이라 "는"이 맞다) — 순수 오탈자 수준이며 `spec/conventions/` 어떤 규약도 이 형식을 규정하지 않는다.
  조치 불요, 다음에 그 파일을 건드릴 때 정정 권장.

## 요약

이번 PR(V117~V120 FK 인덱스 넷 + e2e 확장 + spec 3문서 갱신)은 `spec/conventions/migrations.md` 와 그 시행 세부인
`codebase/backend/migrations/README.md` 의 명명·V번호·append-only·비트랜잭션·DROP-먼저·단일-CREATE 규칙을 예외 없이
지킨다. 마이그레이션 헤더·e2e·spec 세 문서 사이의 수치·식별자 교차 인용도 문자 단위로 일치해 정식 규약이 요구하는
"실제 작성 가이드" 준수와 "구현-spec 정합" 양쪽에서 결함을 찾지 못했다. `spec/conventions/**` 자체에는 변경이 없어
명명 규약·문서 구조 규약·API 문서 규약(OpenAPI/DTO)이 직접 걸릴 여지도 없다(이 PR 은 애플리케이션 코드·API 표면을
건드리지 않는 순수 DDL 변경). 유일하게 언급할 사항(plan 선인용·조사 오탈자)은 이미 다른 검토에서 추적 중이거나
규약 위반이 아닌 오탈자 수준이라 위험도에 반영하지 않는다.

## 위험도

NONE
