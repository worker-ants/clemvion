# Rationale 연속성 검토 — `spec/conventions/` (impl-prep)

## 조사 범위에 관한 선행 메모

전달된 target 번들 중 실제 실파일 268개(포함: `spec/conventions/migrations.md`)가 "컨텍스트 예산 초과"로
본문이 생략되어 있었다. 이번 작업(`plan/in-progress/spec-draft-deletion-cascade-indexes.md` — FK 인덱스
V112~V116 마이그레이션 구현)과 직접 관련된 컨벤션은 하필 그 생략된 파일 중 하나(`migrations.md`)였다. 번들에
없다는 사실을 "해당 내용 없음"으로 취급하지 않고 `spec/conventions/migrations.md`,
`codebase/backend/migrations/README.md`, 최근 마이그레이션 파일(V106·V110·V111)을 직접 Read 하여 대조했다.
번들에 포함돼 있던 파일(`audit-actions.md`, `cafe24-api-catalog/*`, `cafe24-api-metadata.md`)은 이번 구현
대상(FK 인덱스 마이그레이션)과 도메인이 겹치지 않아 충돌 후보가 없었다.

## 발견사항

### [INFO] impl-prep 번들이 대상 도메인의 SoT 컨벤션을 예산 초과로 누락
- target 위치: 번들 §"⚠️ 컨텍스트 예산 초과로 생략된 파일 268개" 목록 — `spec/conventions/migrations.md` 포함
- 과거 결정 출처: `.claude/docs`/사용자 메모 — consistency `--spec`/`--impl-prep` 기본 예산이 conventions 디렉토리를
  통째로 떨어뜨리는 재발 이슈 (선행 사례: `feedback_consistency_spec_mode_budget.md`)
- 상세: 이번 구현은 DB 인덱스 마이그레이션(V112~V116)이고 이를 규율하는 유일한 컨벤션이 `migrations.md` 인데,
  번들 순서상 앞쪽 6개 파일(`audit-actions.md` · `cafe24-api-catalog/*` 4개 · `cafe24-api-metadata.md`)만
  적재되고 그 뒤 268개가 전부 잘렸다. 우연히 실제로 관련 있는 파일이 잘린 쪽에 있었다 — reviewer 가 "번들에
  없으니 문제 없음"으로 판정했다면 거짓 음성이 났을 자리다.
- 제안: 이번 건은 직접 Read 로 보완해 판정에는 영향이 없었다(아래 참조). 다만 orchestrator 쪽에서 impl-prep
  번들 조립 시 "구현 대상 영역과 직접 연관된 컨벤션 파일"을 예산 우선순위 앞쪽으로 배치하거나, 최소한 elision
  경고에 "관련 후보"를 별도로 표시하는 개선을 고려할 것 (harness 개선 사항 — 이 PR 의 blocker 는 아님).

### [해당 없음으로 확인 — CRITICAL/WARNING 미발견] `migrations.md` Rationale 대비 계획 검증
- target: `plan/in-progress/spec-draft-deletion-cascade-indexes.md` §"구현" (V112~V116, `CREATE INDEX CONCURRENTLY` 다섯 개)
- 과거 결정 출처: `spec/conventions/migrations.md` §2(V번호 정책) · §3(append-only) · §4(`outOfOrder=false`) ·
  §5(신규 마이그레이션 절차 + 인덱스 마이그레이션 별도 패턴) · §7(폐기 대안: 타임스탬프 prefix · `outOfOrder=true` ·
  Merge Queue · branch protection)
- 대조 결과:
  - V번호: 현재 main max 는 `V111__trigger_workflow_id_index.sql`. 계획한 V112~V116 은 gap 없는 단조 증가로
    §2 를 그대로 따른다.
  - append-only: 계획은 기존 V001~V111 파일을 수정하지 않고 새 V만 추가한다 — §3 위반 없음.
  - 인덱스 마이그레이션 패턴: migrations.md §5 는 "`CREATE INDEX CONCURRENTLY` 앞에 `DROP INDEX CONCURRENTLY
    IF EXISTS <새 인덱스 이름>` 을 둔다"를 명시하고, 이는 `codebase/backend/migrations/README.md` §5 의 V056(교체
    실패로 인덱스 0개)·V106(신규 추가인데 DROP 없어 invalid 인덱스가 영영 안 고쳐짐) 두 실제 사고 이력에 근거한다.
    이 규칙은 2026-09-18 V111 에서 "신규 추가에도 0) 을 둔다"로 공식화됐다(실측: `V111__trigger_workflow_id_index.sql`
    본문에 동일 패턴 존재). 계획서는 "앞에 invalid 잔재 정리 `DROP INDEX CONCURRENTLY IF EXISTS <이름>`(README §5
    «신규 추가에도 0) 을 둡니다», V111 선례)"라고 명시해 이 규칙을 정확히 인용하고 따른다 — 기각된 대안(§7 목록에는
    없지만 README §5 표의 "CREATE만" 패턴, 즉 V106 이 실질적으로 폐기된 대안)을 되풀이하지 않는다.
  - §7 폐기 대안(타임스탬프 prefix · `outOfOrder=true` · Merge Queue · branch protection 승격) 중 어느 것도
    이 계획에서 재도입되지 않는다.
  - 명명 규약: 제안된 인덱스명(`idx_node_execution_node_id` 등)은 기존 `idx_trigger_workflow_id`(V111) ·
    `idx_schedule_workspace_next_run`(V110) 계열과 동일한 `idx_<table>_<column>` 패턴이다.
- 판정: 위반 없음. 오히려 최근에 성문화된 규칙(V111 선례)을 정확히 인용·준수하는 사례.

### [해당 없음으로 확인] `spec/1-data-model.md ## Rationale` 결정 번복 여부
- target: 계획 §S3 (새 Rationale 절 "삭제 연쇄의 FK 인덱스 다섯 (2026-09-18)")
- 과거 결정 출처: `spec/1-data-model.md ## Rationale` "Trigger `(workflow_id)` 인덱스 (2026-09-18)" 절 —
  "`integration_usage_log` 는 … 쓰기 비용과 맞바꾸는 판단이라 따로 잰다" (예고 문장)
- 상세: 이 예고를 뒤집거나 무시하지 않고, 새 Rationale 절이 "이 절이 그 검토다"라고 명시적으로 연결하며 실측
  결과(쓰기 비용 표 포함)를 제시한다. 기존 절의 문장("그 절의 문장은 그 범위에서 참이라 고치지 않는다")도 보존한다 —
  결정 무근거 번복(관점 3)에 해당하지 않고, 오히려 모범적인 continuity 사례다.
- 판정: 문제 없음. (참고로 `1-data-model.md` 자체는 이번 리뷰의 공식 scope(`spec/conventions/`) 밖이지만,
  실제 구현 대상과 직결돼 교차 확인했다.)

## 요약
이번 --impl-prep 리뷰의 공식 target(`spec/conventions/`) 번들은 컨텍스트 예산 초과로 268개 파일(하필 이번
구현과 가장 관련 있는 `migrations.md` 포함)이 생략되어 있었으나, 직접 Read 로 보완 검증한 결과 계획된
V112~V116 FK 인덱스 마이그레이션은 `migrations.md` 의 V번호 정책·append-only 원칙·`outOfOrder=false`·
인덱스 마이그레이션 전용 패턴(§5, V056/V106 사고에서 도출되어 V111 에서 성문화된 "신규 추가에도 DROP 먼저"
규칙)을 정확히 인용하고 준수한다. §7 에 기록된 폐기 대안(타임스탬프 prefix·`outOfOrder=true`·Merge Queue·
branch protection) 중 어느 것도 재도입되지 않았다. `spec/1-data-model.md` 의 새 Rationale 절도 직전 절이
예고한 "따로 잰다"는 약속을 명시적으로 이행하며 기존 문장을 보존해 결정 연속성을 지켰다. Rationale
연속성 관점에서 CRITICAL·WARNING 사유는 발견되지 않았다.

## 위험도
LOW
