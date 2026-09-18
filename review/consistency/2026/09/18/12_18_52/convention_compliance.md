# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-trigger-workflow-index.md`

## 검토 범위 및 방법

target 문서(트리거 `(workflow_id)` 인덱스 spec draft)가 다루는 세 표면 — (1) `spec/1-data-model.md` §3 인덱스 전략 표
추가, (2) 같은 문서 `## Rationale` 신규 절, (3) `spec/data-flow/10-triggers.md` §2.1 문구 추가, (4) 구현 섹션의
`V111` 마이그레이션 — 각각을 관련 정식 규약과 대조했다.

- `spec/conventions/migrations.md` (Flyway 마이그레이션 명명·V번호 정책) — 전문 대조
- `spec/conventions/spec-impl-evidence.md` (frontmatter 의무 대상/제외) — 전문 대조
- `spec/conventions/review-citations.md` (리뷰 산출물 인용 형식) — 관련 절 대조
- `codebase/backend/migrations/README.md` (§4·§5 CONCURRENTLY·`.conf`·롤백 주석 실무 규칙) — migrations.md 가 위임하는 실행 세칙이라 함께 대조
- target 이 편집을 예고한 두 spec 파일의 실제 현재 본문(`spec/1-data-model.md` §3, `spec/data-flow/10-triggers.md` §2.1)과 대조해 삽입 위치·표 서식이 기존 관례와 일치하는지 확인
- 실물 저장소 상태(`ls codebase/backend/migrations`)로 V번호 계산(V110 → V111)의 정합성 확인

## 발견사항

발견된 CRITICAL·WARNING 없음.

- **[INFO]** 신규 식별자 "grep 0건" 주장의 스코프가 문서에 명시되어 있지 않음
  - target 위치: `## 구현 (같은 PR, developer 턴)` 첫 불릿 — "새 식별자 `idx_trigger_workflow_id`·`V111` 은 저장소 grep 0건."
  - 위반 규약: 없음 (정식 규약 위반은 아님 — `spec/conventions/migrations.md` 는 V번호 재사용·중복만 금지하며 이 조건은 실제로 충족됨. 참고 성격의 INFO)
  - 상세: 실측 결과 `idx_trigger_workflow_id`·`V111` 두 토큰은 `codebase/**`·`spec/**`·실제 마이그레이션 파일에는 0건이 맞지만, `review/code/2026/09/17/19_14_29/{SUMMARY,performance,database}.md` 세 곳에 **제안 문구로 이미 등장**한다(이번 draft가 그 제안을 실행하는 것이므로 정상). "저장소 grep 0건"이라는 표현만 보면 이 review 문서들과 상충하는 것처럼 읽힐 수 있다.
  - 제안: "실제 코드/마이그레이션 파일 기준 grep 0건(제안 단계의 review 문서 언급은 제외)"처럼 스코프를 한 단어만 좁혀 명시하면 향후 대조 시 혼동을 줄일 수 있다. 규약 준수에는 영향 없음.

## 규약별 대조 결과 (양호 — 근거 기록)

- **명명 규약 (`migrations.md` §1·§2)**: `V111__trigger_workflow_id_index.sql` + 동일 base name `.conf` 는 `V<번호>__<snake_case_descriptor>` 패턴을 그대로 따른다. 저장소 실측(`ls codebase/backend/migrations`) 상 현재 max 는 `V110` 이므로 `V111` 은 "max+1 단조 증가"(§2) 를 충족한다. 인덱스 식별자 `idx_trigger_workflow_id` 는 README.md 의 `idx_foo_bar`(`idx_<table>_<column>`) 예시 및 기존 선례(`idx_schedule_trigger_id` V106, `idx_execution_trigger_started` V096 등)와 동일 명명 패턴이다.
- **`CONCURRENTLY`/`.conf`/롤백 주석 (migrations 실무 규칙, README §4·§2)**: draft 는 "V106 형태, 수동 롤백 주석 포함"을 명시해 `.conf`(`executeInTransaction=false`) 동봉과 `-- DOWN:` 롤백 주석 관례를 정확히 지목했다 (V106 실물 파일과 대조 확인 — 동일 패턴). 파일당 `CREATE INDEX CONCURRENTLY` 한 개만 두는 §5 컨벤션도 위반하지 않는다(단일 CREATE 문).
- **spec 문서 구조 규약 (`spec-impl-evidence.md` §1)**: `spec/1-data-model.md`(basename `EXCLUDE_BASENAMES` 등재) 와 `spec/data-flow/**`(inclusive list 밖, frontmatter 의무 자체가 없음) 모두 frontmatter 의무 대상이 아니므로, draft 가 두 파일의 frontmatter 를 건드리지 않는 것은 규약과 일치한다. `spec/1-data-model.md` frontmatter `code:` 는 이미 `codebase/backend/migrations/V*.sql` 글롭을 포함하므로 `V111` 신규 파일도 자동 커버되어 별도 frontmatter 수정이 불필요하다는 점도 맞다.
- **표 서식 (`spec/1-data-model.md` §3)**: 기존 행들(예: `Schedule | (trigger_id) | … CONCURRENTLY, V106`, `Execution | (trigger_id, started_at DESC) … | … V096`)과 동일하게 `| 테이블 | 인덱스 | 목적 문장 … CONCURRENTLY, V<번호> |` 형식을 따른다. 새 행은 기존 `Trigger` 행들(922~923줄) 바로 다음에 위치해 같은 엔티티 그룹핑 관례도 지킨다.
- **data-flow 본문 갱신 (`spec/data-flow/10-triggers.md` §2.1)**: 인용된 원문("… 인덱스는 V002.")이 실제 173번째 줄과 정확히 일치하고, 추가되는 문장의 "V<번호>" 인용 스타일은 같은 문서의 다른 절(예: 176번째 줄의 `(V110)` 인용)과 동일한 관례다.
- **트래커/plan 상호참조**: "부모 삭제 경로의 성능 후속" 항목의 "첫째·셋째 불릿"이 실제 `plan/in-progress/spec-draft-nullable-notation-followups.md`의 순서(1: 인덱스 부재, 2: 순차 처리 지연, 3: `select` 좁히기)와 정확히 일치한다.
- **리뷰 인용 형식 (`review-citations.md`)**: `plan/**` 문서는 이 규약의 적용 대상이 아니지만(§3 "대상 아님"), draft 는 어차피 전체 경로 형식(`review/code/2026/09/17/19_14_29` 등)을 사용해 권장 형태를 상회한다 — bare `hh_mm_ss` 사용 없음.
- **금지 항목**: `migrations.md` 가 금지하는 alphanumeric suffix, V번호 재사용, `outOfOrder` 사용, 기존 V파일 수정 등 어느 것도 target 에 나타나지 않는다.

## 요약

target 문서는 마이그레이션 명명·V번호 정책(`spec/conventions/migrations.md`), 마이그레이션 실무 규칙(`CONCURRENTLY`/`.conf`/롤백 주석), spec frontmatter 의무 대상/제외 규정(`spec/conventions/spec-impl-evidence.md`), 기존 spec 문서의 표·본문 서식 관례를 모두 실물 대조까지 거쳐 정확히 따르고 있다. 리뷰 인용 형식도 규약 요구 수준을 상회한다. CRITICAL·WARNING 급 위반은 발견되지 않았고, 유일한 INFO 는 정식 규약 위반이 아니라 "grep 0건" 표현의 스코프 명시 제안에 그친다.

## 위험도

NONE
