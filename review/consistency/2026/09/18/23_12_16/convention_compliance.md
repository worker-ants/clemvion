# 정식 규약 준수 검토 — convention_compliance

## 검토 범위·전제

- scope `spec/conventions/**` 델타: 0개 파일 (이 PR 은 이 spec 영역을 바꾸지 않았다 — 정상).
- 실제 diff: `codebase/backend/migrations/V121~V130` (10 인덱스, `.sql`+`.conf` 20파일) + `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`.
- 이 diff 가 걸리는 정식 규약은 `spec/conventions/migrations.md`(`code: codebase/backend/migrations/**`) 하나이며, 작성 가이드는 `codebase/backend/migrations/README.md` §4·§5 가 보완한다. 두 문서를 HEAD 워킹트리에서 절대경로로 전문 읽고, V121~V130 `.sql`/`.conf` 전부를 직접 읽어 대조했다(번들 프롬프트는 예산 초과로 diff 본문·`migrations.md` 본문이 잘려 있어 신뢰하지 않았다).

## 발견사항

이번 diff(V121~V130) 자체에서 신규 CRITICAL/WARNING 위반은 발견하지 못했다. 검증한 항목:

- **파일 명명** (`migrations.md` §1): `V121`~`V130` 은 V120 대비 연속·단조 증가, 설명자는 전부 소문자+숫자+`_` (`edge_target_node_id_index` 등), `.conf` 는 `.sql` 과 동일 base name. `python3 scripts/check-migration-versions.py --base origin/main` → `OK: 130 migration(s), max V130` 실측 통과, `check-duplicate-versions.sh` 도 무출력(통과).
- **인덱스 교체/신규 추가 패턴** (`migrations.md` §5 후단, README §5): 10개 파일 전부 `DROP INDEX CONCURRENTLY IF EXISTS <새 이름>` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS <새 이름>` 순서 하나씩만 가지며(`CREATE` 개수 = 1), 파일 끝에 `-- DOWN(...)` 롤백 주석이 있다. `.conf` 는 전부 `executeInTransaction=false` 한 줄. `alter TABLE`/`DO $$` 류 transactional statement 와 섞인 파일 없음.
- **인덱스 이름 패턴**: `idx_<table>_<column(s)>` (예: `idx_edge_target_node_id`, `idx_model_config_workspace_kind`) — `migrations.md` 에 명문 규칙은 없지만 V105~V120 선례와 100% 일치.
- **partial 인덱스 조건**: nullable FK 컬럼(V122·V123·V124·V125·V126)은 전부 `WHERE <col> IS NOT NULL`, 근거 주석("V115~V118 과 같은 이유")까지 선례를 인용 — README 의 partial-인덱스 관례와 일치.
- **spec 문서와 글자 그대로 대조** (`spec/1-data-model.md` §3 인덱스 전략 표): V121~V130 10행 전부 테이블·컬럼·partial 조건·V번호가 마이그레이션 파일과 리터럴 일치 확인(예: V122 `llm_usage_log (llm_config_id) WHERE llm_config_id IS NOT NULL` ↔ spec 965행 동일). 불일치 없음.
- **처분 셈 정합**: `plan/complete/spec-draft-deletion-cascade-indexes.md` 부록 표를 직접 세어, "인덱스 열"(V121~V130) = 10 + "비대상 스물하나" = 21 → 31, 전수(37+보정 3) = 40 이 spec Rationale·`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 체크박스 서술과 모두 일치함을 확인.
- **코드 주석의 리뷰/spec 인용 형식** (`spec/conventions/review-citations.md` §2·§3, `codebase/**` 대상): 각 헤더가 `spec/1-data-model.md §3 인덱스 전략`, `plan/complete/spec-draft-fk-remaining-dispositions.md` 등 **전체 경로**를 쓴다 — bare `hh_mm_ss` 형태 없음. 규약 준수.
- **e2e 스펙 파일 명명**: `deletion-cascade-indexes.e2e-spec.ts` — 기존 kebab-case `*.e2e-spec.ts` 관행과 일치.

### [WARNING] `spec/conventions/` 문서 구조 3섹션 편차 — 이 PR 이전부터 존재, 이미 트래킹됨

- target 위치: `spec/conventions/migrations.md` 전체 구조, 그리고 `spec/conventions/` 최상위 23개 문서 중 13개
- 위반 규약: `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조 (3섹션 권장)" — `## Overview` / 본문 / `## Rationale`
- 상세:
  1. `migrations.md` 는 Rationale 이 번호 붙은 `## 7. 폐기 대안 (Rationale)` 이고 그 뒤에 `## 참고` 섹션이 하나 더 온다 — 다른 conventions 문서들은 bare `## Rationale` 이 종결 섹션인 것과 다르다.
  2. `spec/conventions/` 최상위 23개 파일 중 13개가 `## Overview` 를 생략한다 (예: `cafe24-api-catalog/_overview.md`, `cafe24-api-metadata.md` 는 `# CONVENTION: ...` h1 만 있고 `## Overview` h2 가 없음). `node-output.md` 는 Rationale 도 없다고 알려져 있다(본 세션에서는 예산상 재확인 못 함).
- **이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(라인 4644~4648) 에 `[ ]` 미결 항목으로 등재되어 있고**, 그 항목 자체가 "이 작업과 무관한 기존 상태 — checker 가 `spec/conventions/` scope 를 훑다 드러냈다" 고 명시한다 (`--impl-prep review/consistency/2026/09/18/22_44_08` WARNING 1). 즉 본 PR 의 diff 가 만든 위반이 아니다.
- 제안: 새로 만들 것 없음 — 이미 트래커에 "결정할 것: 관례로 맞출지, 레퍼런스형 규약은 예외로 둘지" 로 열려 있다. 본 PR 을 이 사유로 막을 근거는 아니다(scope 밖·pre-existing).

## 요약

이번 PR 의 실제 diff(FK 인덱스 V121~V130 + e2e 스펙 1개)는 `spec/conventions/migrations.md`·`codebase/backend/migrations/README.md` §4·§5 가 요구하는 명명·번호·`.conf` 페어링·DROP-먼저-CREATE-하나·DOWN 주석·partial 조건 관례를 10개 파일 전부에서 예외 없이 지켰고, V번호 가드(`check-migration-versions.py`)·중복 가드(`check-duplicate-versions.sh`) 실측도 통과했다. `spec/1-data-model.md` §3 표·`review-citations.md` 인용 형식·plan 처분 셈도 마이그레이션 파일과 리터럴로 일치해 새로 도입된 규약 위반은 없다. 유일하게 보고할 사항은 `spec/conventions/` 문서군 전반의 3섹션(Overview/본문/Rationale) 구조 편차인데, 이는 이 PR 이전부터 있던 상태이고 이미 별도 트래커 항목으로 등재·WARNING 처리되어 있어 본 PR 을 블록할 사유가 아니다.

## 위험도

NONE
