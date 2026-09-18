# Plan 정합성 검토 — target: `spec/conventions/` (scope, `--impl-prep`)

## 검토 맥락

이번 `--impl-prep spec/conventions/` 게이트는 `plan/in-progress/spec-draft-fk-remaining-dispositions.md`
체크리스트의 다음 단계(`V121~V130` 마이그레이션 구현 착수 직전)로 호출된 것이다. `spec/conventions/migrations.md`
의 `code:` 가 `codebase/backend/migrations/**` 를 포함해 스코프에 잡혔다. 번들은 예산 한도로 `migrations.md` ·
`audit-actions.md` · cafe24-api-catalog 일부만 전문이고 나머지는 절단됐으나, 이번 구현(FK 인덱스 마이그레이션)과
직접 관련 있는 문서는 `migrations.md` 뿐이라 이를 중심으로 대조했다.

## 대조한 것

- `spec/conventions/migrations.md` (target, 변경 없음 — `origin/main` 대비 diff 0) vs
  `plan/in-progress/spec-draft-fk-remaining-dispositions.md`(현재 작업 plan) ·
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(상위 트래커, target 이 닫으려는 항목의 소유자) ·
  나머지 `plan/in-progress/**` 전수 grep(`migrations.md`, `migration-check`, `check-migration-versions`,
  `CREATE INDEX CONCURRENTLY`, `V1[0-9]{2}__` 패턴)
- `codebase/backend/migrations/` 실물 디렉토리 최신 상태(`V120` 이 max) — target 의 "V번호는 항상 main 의
  max+1" 전제와 draft 의 "V121~V130" 할당이 착수 시점 기준으로 어긋나지 않는지
- `codebase/backend/migrations/README.md` §5 ("신규 추가에도 0) 을 둡니다", `mixed=true` 도입 여부 결정 항목) —
  target 문서가 위임하는 실행 가이드 쪽에 미해결 결정이 남아 있는지

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 트래커 반영은 구현 완료 후로 미룸 — 정합
  - target 위치: 없음(참고용)
  - 관련 plan: `plan/in-progress/spec-draft-fk-remaining-dispositions.md` 체크리스트 마지막 항목
    "트래커 · 부록 반영 · 이 draft `complete/` 이동" (`[ ]`, 아직 미수행)
  - 상세: 이 draft 가 닫으려는 `spec-draft-nullable-notation-followups.md` 의 "선두 인덱스가 없는 FK …
    28개 남음" 항목(라인 4616)은 아직 `[ ]` 상태다. draft 자신의 체크리스트가 "V121~V130 구현 → e2e →
    `/ai-review` → `--impl-done` → 트래커 반영" 순서를 이미 명시하고 있어, 지금 시점(`--impl-prep` 직전)에
    트래커가 아직 열려 있는 것은 순서상 정상이며 새로 만들어야 할 후속 항목이 아니다.
  - 제안: 조치 불요 — draft 자체 체크리스트가 이미 이 순서를 관리한다.

## 확인한 무-충돌 지점 (참고)

- **V번호 할당**: `codebase/backend/migrations/` 실물 최신 파일은 `V120__relation_tail_entity_id_index.{sql,conf}` 이고,
  다른 `plan/in-progress/**` 어디에도 `V121` 이후 번호를 선점하거나 `codebase/backend/migrations/**`,
  `check-migration-versions.py`, `migrations.spec.ts`, `migration-check.yml`, `migration-recheck-on-main.yml` 를
  건드리는 동시 작업이 없다. `migrations.md` §2 의 "신규 V번호는 항상 main 의 max+1" 원칙과 draft 의 "V121~V130"
  할당은 착수 시점 기준으로 충돌하지 않는다.
- **CONCURRENTLY 재실행 패턴**: draft 의 구현 절이 요구하는 전제("신규 추가에도 `DROP INDEX CONCURRENTLY IF EXISTS`
  0) 을 둔다", `migrations/README.md` §5 참고) 는 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  라인 1455~1475 에서 이미 `[x]` 로 확정·성문화됐다(2026-09-05). 미해결 결정이 아니다.
  - `mixed=true` 도입 여부(README.md §5 의 "indisvalid 분기" 대안)도 같은 트래커 라인 1526 에서
    "도입하지 않는다 (A, 현행 유지)" 로 이미 `[x]` 확정. target 이 가정하는 DROP-먼저 패턴과 충돌 없음.
- **노드 삭제 CASCADE 보존 정책** — `spec-draft-nullable-notation-followups.md` 라인 4609~4614 의 "캔버스
  저장이 노드를 빼면 그 노드의 실행 이력이 사라진다 — 보존 정책 결정 필요" 는 여전히 `[ ]` 미해결이지만,
  현재 draft 는 `node_execution.node_id` 의 CASCADE/SET NULL 의미론을 바꾸지 않고 `edge.target_node_id`(V121)
  인덱스만 추가한다 — 이 미해결 결정과 겹치는 컬럼·의미론 변경이 없다.
- **사용자 삭제 관련 13개 FK "비대상(라)" 처분** — 같은 트래커의 "다음 후보 — 부모 삭제가 드문 큰 테이블 셋"
  서술(라인 4626)과 draft 의 최종 처분(`llm_usage_log.llm_config_id`→V122, `audit_log.user_id`·
  `execution.executed_by`→비대상 라)이 방향은 다르지만, 이는 같은 draft 내부의 실측 기반 재분류이지 target
  문서(`spec/conventions/`)와의 충돌이 아니다.
- `spec/conventions/error-codes.md` 등 나머지 conventions 문서를 건드리는 진행 중 작업
  (`spec-conventions-engine-error-code-surface.md` 등)은 FK 인덱스 작업과 겹치는 파일·결정이 없다.

## 요약

target(`spec/conventions/`, 특히 `migrations.md`)은 이번 스프린트에서 변경되지 않았고, 이번 구현(V121~V130
FK 인덱스 마이그레이션)이 가정하는 전제 — V번호 할당 방식, CONCURRENTLY 재실행 안전 패턴, `mixed=true` 미도입
결정 — 는 모두 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에서 이미 확정·성문화되어 있다.
같은 작업 계열의 상위 트래커(`spec-draft-fk-remaining-dispositions.md`)와 target 사이에 미해결 결정 우회,
선행 plan 미해소, 후속 항목 누락 어느 것도 발견되지 않았다. `--impl-prep` 을 막을 사유 없음.

## 위험도

NONE
