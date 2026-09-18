# 신규 식별자 충돌 검토 — `spec-draft-trigger-workflow-index.md`

## 발견사항

없음. target 이 새로 도입하는 모든 식별자를 저장소 전수 검색으로 대조했고, 기존 사용처와의 충돌을 찾지 못했다.

### 검토한 신규 식별자와 대조 결과

- **마이그레이션 파일명 `V111__trigger_workflow_id_index.sql`(+`.conf`)** — `codebase/backend/migrations/` 최신 버전은 `V110__schedule_workspace_next_run_index.sql`(+`.conf`)이다. `V111` 은 저장소 전체(`*.sql`, `*.conf`)에서 grep 0건 — 다음 순번과 일치, 충돌 없음.
- **인덱스명 `idx_trigger_workflow_id`** — 저장소 전수 grep 결과 이 draft 파일 자신과 그 draft 를 대상으로 한 review 산출물(`review/code/2026/09/17/19_14_29/*.md`, `review/consistency/2026/09/18/12_18_52/_target/*`)에만 나타난다. 코드·마이그레이션·spec 본문 어디에도 기존 정의가 없다. 명명 패턴도 선례(`idx_execution_workflow_status`(V105), `idx_schedule_trigger_id`(V106), `idx_schedule_workspace_next_run`(V110))의 `idx_<table>_<column>` 컨벤션을 그대로 따른다 — 컨벤션 이탈도 없다.
- **`spec/1-data-model.md` §3 인덱스 전략 표의 신규 행 `Trigger | (workflow_id) | …`** — 같은 표의 기존 `Trigger` 행은 `(workspace_id, type)` 과 `(workspace_id, endpoint_path) UNIQUE` 뿐이다(1행:922, 2행:923). `(workflow_id)` 조합은 아직 그 표에 없어 행 자체가 충돌하지 않는다. `Schedule | (trigger_id)`(V106, 924행) 와 인접해 있으나 대상 컬럼·테이블이 달라 혼동 여지가 없다.
- **`## Rationale` 신규 절 제목 `### Trigger \`(workflow_id)\` 인덱스 (2026-09-18)`** — `spec/1-data-model.md` 의 기존 `###` 제목 전수(예: `### Schedule 인덱스 \`(next_run_at, is_active)\` → \`(workspace_id, next_run_at)\` (2026-09-04)`, `### \`alert_rule\` 을 §2.25 로 등재 (2026-08-31)` 등)와 동일 제목이 없다. 날짜(2026-09-18)도 겹치는 기존 절이 없다.
- **`spec/data-flow/10-triggers.md` §2.1 `trigger` 행 말미 추가 서술** `… \`(workflow_id)\` 인덱스는 워크플로 삭제 경로…(V111).` — 기존 서술은 "`(workspace_id, endpoint_path) UNIQUE` + `(workspace_id, type)` 인덱스는 V002" 로 끝난다(171행). 신규 서술은 다른 컬럼 조합·다른 V번호를 가리켜 기존 문장과 겹치지 않는다.
- **트래커(plan/in-progress/spec-draft-nullable-notation-followups.md) 신규 항목 라벨 `«workflow`·`workspace` FK 중 선두 인덱스가 없는 여섯»`** — 트래커·spec 전수 grep 으로 "선두 인덱스가 없는" 문자열을 대조했고 이 draft 자신 외에는 등장하지 않는다. 기존 트래커 불릿(«부모 삭제 경로의 성능 후속»)과 이름이 겹치지 않으며, target 은 그 불릿의 첫째·셋째만 해소 표시하고 새 항목을 별도로 추가하므로 트래커 항목 계보도 명확하다.
- **요구사항/식별번호** — target 은 신규 요구사항 ID(V-xx, §번호 등)를 부여하지 않는다(기존 §3, 기존 `## Rationale` 섹션 안에 절을 추가할 뿐). API endpoint·webhook/queue/SSE 이벤트명·ENV 변수·config key 도 이 draft 는 도입하지 않는다(순수 인덱스 추가 + `select` 필드 좁히기).
- **파일 경로** — 신규 spec 파일을 만들지 않고 기존 `spec/1-data-model.md`, `spec/data-flow/10-triggers.md` 를 수정한다. 마이그레이션 파일 경로 `codebase/backend/migrations/V111__trigger_workflow_id_index.sql`(+`.conf`) 는 기존 번호 정책(`spec/conventions/migrations.md`)과 `Vxxx__<설명>` 명명 컨벤션을 그대로 따르고, 경합하는 동시 작업의 `V111` 선점도 현재 시점 grep 상 없다(단, 병렬 세션이 먼저 `V111` 을 쓸 수 있으므로 구현 착수 직전 재확인 권장 — 아래 요약 참고).

## 요약

target 이 새로 도입하는 식별자(마이그레이션 파일명 `V111`, 인덱스명 `idx_trigger_workflow_id`, spec 표 신규 행 `Trigger | (workflow_id)`, `## Rationale` 신규 절 제목, 트래커 신규 항목 라벨)를 저장소 전수 검색으로 대조한 결과 기존 사용처와의 의미 충돌·명명 컨벤션 이탈이 발견되지 않았다. 인덱스명은 V105·V106·V110 선례의 `idx_<table>_<column>` 패턴을 정확히 따르고, `V111` 은 현재 저장소의 최신 마이그레이션(V110) 바로 다음 번호로 비어 있다. 새 요구사항 ID·API endpoint·이벤트명·ENV 변수·신규 spec 파일은 이 draft 의 범위에 없다. 유일한 잔여 리스크는 버전 번호의 구조적 특성(병렬 세션이 동시에 `V111` 을 잡을 수 있음)이며, 이는 이름 자체의 의미 충돌이 아니라 `spec/conventions/migrations.md` 가 이미 다루는 "머지 race 안전망" 범주라 본 관점에서는 CRITICAL/WARNING 사유가 되지 않는다(구현 착수 직전 재확인 권장 — INFO).

## 위험도

NONE
