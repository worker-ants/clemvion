# 정식 규약 준수 검토 — spec-draft-graph-fk-indexes.md

대상: `plan/in-progress/spec-draft-graph-fk-indexes.md` (spec draft, `--spec` 모드)
대조: `spec/conventions/migrations.md`, `spec/conventions/spec-impl-evidence.md`,
`.claude/docs/plan-lifecycle.md`, `codebase/backend/migrations/README.md`,
`.claude/skills/project-planner/SKILL.md`, 실제 `spec/1-data-model.md` ·
`spec/5-system/10-graph-rag.md` · `spec/data-flow/6-knowledge-base.md` 현재 본문

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** S2/S4 의 "삽입할 표 행" 인용이 중첩 백틱을 이스케이프 없이 씀
  - target 위치: `## 변경안 → S2`, `S4` (본문 예시: `` `| Entity | (last_seen_chunk_id) … FK `ON DELETE SET NULL` … |` ``)
  - 위반 규약: 없음 (참고 확인 항목) — 순수 마크다운 렌더링 관점에서 단일 백틱 스팬 안에 리터럴 백틱을 이스케이프 없이 넣으면 스팬이 중간에서 끊긴다.
  - 상세: 그대로 렌더링하면 코드 스팬이 `FK` 뒤에서 끊기고 이후 텍스트가 어긋나 보일 수 있다. 다만 직전에 머지된 동일 패턴의 선례
    (`plan/complete/spec-draft-deletion-cascade-indexes.md` §S1 "`| NodeExecution | (node_id) | FK `ON DELETE CASCADE` … |`" 등)가
    같은 표기를 그대로 쓰고 있고, `--spec`/`--impl-prep`/`/ai-review`/`--impl-done` 전 게이트를 통과해 완료됐다 — 이 저장소의 spec-draft 문서가
    "삽입할 리터럴을 통짜로 보여주는" 용도로 채택한 기존 관행이며, 실제 `spec/1-data-model.md` 본문(정식 spec 파일, `spec-link-integrity` 등 가드
    대상)에는 이 이슈가 전이되지 않는다(개발자가 표 행을 정상 마크다운으로 다시 타이핑한다). **정식 규약 위반은 아님** — 참고용으로만 기록.
  - 제안: 조치 불요. 동일 저장소 선례와 일치하므로 규약 갱신도 불필요.

## 명명 규약 검토 (문제 없음)

- 신규 인덱스 이름 `idx_entity_last_seen_chunk_id` · `idx_relation_evidence_chunk_id` · `idx_relation_head_entity_id` ·
  `idx_relation_tail_entity_id` 는 `codebase/backend/migrations/V111~V116` 의 `idx_<table>_<column>` 패턴과 정확히 일치한다
  (예: `idx_trigger_workflow_id`, `idx_llm_usage_log_node_execution_id`).
- draft 가 스스로 `codebase/`·`spec/`·`plan/` grep 0건, `V117~V120` grep 0건을 명시해 신규 식별자 충돌 부재를 실측했다 — 이 저장소가
  과거 여러 차례(예: `D-*`→`CV-*` 충돌) 놓쳤던 "새 식별자 전수 열거" 검증을 선행한 형태다.
- V번호 `V117~V120` 은 현재 `codebase/backend/migrations/` 의 max(V116) + 1부터 연속 — `spec/conventions/migrations.md §2` (단조 증가·gap 금지)와 일치. 이 worktree 안에 V117 이상 파일이 존재하지 않음을 직접 확인했다.

## 출력 포맷 규약 검토 (문제 없음)

- `spec/1-data-model.md §3 인덱스 전략` 표에 추가하는 4행은 기존 표의 정확한 3열 구조(`테이블 | 인덱스 | 목적`)와 "FK `ON DELETE ...` — 이유. CONCURRENTLY, VNNN" 서술 관례를 그대로 따른다(V111~V116 선례와 열 대 열 비교 확인).
- `§2.12.2/§2.12.3` **인덱스** 한 줄 표기(백틱 콤마 나열)에 추가하는 표현도 기존 `**인덱스**: \`(a)\`, \`(b)\`` 포맷을 그대로 확장한다.
- `spec/5-system/10-graph-rag.md §2.3/§2.4` 불릿 추가(`- (col) WHERE … — 설명 (VNNN, 링크)`)도 기존 `- (entity_id) — entity → chunk 역방향 회수 (…)` 불릿 포맷과 일치.
- `spec/data-flow/6-knowledge-base.md` sink 표의 "인덱스" 칸 끝에 `, VNNN \`(col)\` …` 를 덧붙이는 방식도 같은 칸의 기존 값(`V025 idx_entity_kb_type, …`)과 같은 이어붙이기 관례.
- 마이그레이션 구현 계획(§구현)이 명시한 "파일당 `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` + `.conf executeInTransaction=false`"는 `codebase/backend/migrations/README.md §5` "신규 추가에도 0) 을 둡니다" 규칙 및 `CREATE` 1개/파일 컨벤션과 정확히 일치(V111 선례 인용도 정확).
- 인용한 링크 앵커 `../1-data-model.md#3-인덱스-전략`는 실제 헤딩 `## 3. 인덱스 전략` 의 github-slugger 슬러그와 일치.

## 문서 구조 규약 검토 (문제 없음)

- `plan/in-progress/spec-draft-graph-fk-indexes.md` 자체는 `project-planner/SKILL.md` 가 규정한 draft 형식(`plan/in-progress/spec-draft-<name>.md` + 본문 끝 `## Rationale`)을 그대로 따른다. spec 문서의 Overview/본문/Rationale 3섹션 요구는 draft 산출물이 아니라 **draft 가 편집할 대상 spec 문서**(`spec/1-data-model.md` 등)에 적용되는데, draft 는 기술적 인덱스 변경을 본문(S1/S2/S4/S5)과 `## Rationale`(S3)에만 배치하고 `## Overview`(제품 정의)는 건드리지 않는다 — 이는 이번 변경이 제품 정의가 아닌 성능/스키마 내부 사실이라는 점과 정합.
- frontmatter (`title`/`status`/`owner`/`worktree`/`started`/`spec_impact`)는 `.claude/docs/plan-lifecycle.md §4` 스키마(top-level in-progress plan 필수 3필드: `worktree`/`started`/`owner`)를 만족하고, `spec_impact` 리스트의 세 경로(`spec/1-data-model.md`, `spec/5-system/10-graph-rag.md`, `spec/data-flow/6-knowledge-base.md`) 모두 실존 파일 — Gate C(`spec-plan-completion.test.ts`)가 완료 시점에 요구하는 형식(리스트, bare string 아님)을 미리 충족한 상태.
- `spec/1-data-model.md`는 `spec-impl-evidence.md §1 EXCLUDE_BASENAMES`에 등재된 frontmatter 면제 문서이고, `spec/data-flow/**`는 애초에 frontmatter-evidence 대상이 아니므로 이번 편집이 frontmatter 의무를 새로 발생시키지 않는다. `spec/5-system/10-graph-rag.md`는 frontmatter 대상(§1 INCLUDE_PREFIXES)이지만 이미 `status: implemented` + 매치되는 `code:` 글로브를 보유하고 있고 draft 의 편집이 그 surface 범위를 벗어나지 않는다.

## API 문서 규약 검토

해당 없음 — 이번 변경은 OpenAPI/Swagger DTO·컨트롤러 표면을 추가하지 않는다(순수 DB 인덱스 + spec 문서). `swagger.md` 대조 불필요.

## 금지 항목 검토 (문제 없음)

- `migrations.md §1` 의 금지 사항(alphanumeric suffix, `.sql`/`.conf` base name 불일치)에 저촉되는 표현 없음 — draft 는 실제 파일명을 아직 정하지 않았고(§구현에서 인덱스명·V번호만 확정), 실제 명명은 developer 턴에서 §1 형식을 따르면 된다.
- `migrations.md §3` append-only 원칙과 관련해, 기존 V001~V116 파일을 수정하는 계획이 없고 전부 신규 V117~V120 로 처리 — 위반 없음.
- `spec-impl-evidence.md §3` lifecycle 규칙과 관련해 `status` 하향/상향을 임의로 요구하지 않음 — 세 대상 문서 모두 기존 `status`(또는 frontmatter 자체 부재)를 그대로 둔다.

## 요약

target 문서(`plan/in-progress/spec-draft-graph-fk-indexes.md`)는 이 저장소가 정식 규약으로 삼는 `spec/conventions/migrations.md`(V번호 단조성·명명·CONCURRENTLY 절차)와 `spec/conventions/spec-impl-evidence.md`(frontmatter 면제·lifecycle) 양쪽을 모두 위반 없이 따르고 있으며, 직전 머지된 동일 클래스 선례(V111~V116, `spec-draft-deletion-cascade-indexes.md`)의 표·불릿·주석 포맷을 자리 단위로 정확히 복제했다. 신규 인덱스 명명은 기존 `idx_<table>_<column>` 패턴을 따르고 충돌 부재를 grep 으로 직접 실측해 첨부했다. plan frontmatter 스키마·Gate C 사전 충족도 확인했다. API 문서(OpenAPI/DTO) 규약은 이번 변경 범위 밖이라 해당 없음. 유일하게 짚을 점은 draft 본문 내 표-행 인용에서 중첩 백틱 이스케이프 누락이라는 사소한 렌더링 이슈이나, 이는 이미 머지된 선례 문서와 동일한 관행이라 규약 위반으로 판정하지 않았다.

## 위험도

NONE
