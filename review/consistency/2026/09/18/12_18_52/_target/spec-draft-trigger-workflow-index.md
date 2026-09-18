---
title: trigger (workflow_id) 인덱스 — 워크플로 삭제가 트리거 테이블을 세 번 전부 훑는다
status: in-progress
owner: project-planner
worktree: trigger-workflow-index-3d8a52
started: 2026-09-18
spec_impact:
  - spec/1-data-model.md
  - spec/data-flow/10-triggers.md
---

# spec draft — `trigger (workflow_id)` 인덱스

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «부모 삭제 경로의 성능 후속»(developer + planner,
2026-09-17 등재 · `/ai-review` `review/code/2026/09/17/19_14_29` W1·W3·W4·INFO7) 중 **첫째·셋째 불릿**을 닫는다. 선례
`#1285`(V110)처럼 spec 행과 마이그레이션을 한 PR 에 담는다 — 이 draft 는 spec 쪽이고, 구현 체크리스트는 끝에 있다.

## 실측

### 인덱스 현황 (PostgreSQL 18, `pgvector/pgvector:pg18` 일회용 컨테이너에 V001~V110 적용)

`trigger` 의 인덱스는 `(workspace_id, type)` · `(workspace_id, endpoint_path) UNIQUE` · `notification_health` 부분 — **`workflow_id`
를 선두로 가진 인덱스가 없다**(`pg_index.indkey[0]` 대조). Postgres 는 FK 에 인덱스를 자동으로 만들지 않는다.

### `trigger.workflow_id` 로 트리거를 찾는 곳 (grep 전수)

| 자리 | 언제 | 트랜잭션·잠금 |
|---|---|---|
| `TriggerResourceReleaserService.releaseExternalForParent` — `find({ where: { workflowId } })` | 워크플로 삭제, 외부 해제 | 트랜잭션 **밖** |
| `lockParentAndListTriggerIds` — `find({ select: { id }, where: { workflowId } })` | 워크플로 삭제, 비밀 정리 대상 열거 | 삭제 트랜잭션 안, **`workflow` 행 잠금 뒤** |
| FK `trigger_workflow_id_fkey` `ON DELETE CASCADE` | 워크플로 행 삭제 | 삭제 트랜잭션 안 |

이 셋 말고는 없다 — 워크플로 삭제 한 번이 트리거 테이블을 **세 번** 찾고, 인덱스가 없으면 세 번 다 전 테이블을 훑는다.
뒤 둘은 `workflow` 행 잠금을 쥔 채 돈다.

### 비용 (트리거 수를 4배씩 — 워크스페이스당 워크플로 5 · 워크플로당 트리거 4, 워밍 뒤 1회)

| 트리거 수 | 열거 `SELECT id … WHERE workflow_id = ?` | CASCADE `trigger_workflow_id_fkey` | `DELETE FROM workflow` 전체 |
|---|---|---|---|
| 20,000 | Seq Scan · 0.63 ms (19,996행 버림) | 0.67 ms | 2.33 ms |
| 80,000 | Seq Scan · 2.26 ms | 2.19 ms | 3.68 ms |
| 320,000 | Parallel Seq Scan · 7.52 ms | 11.05 ms | 12.64 ms |
| **320,000 + `(workflow_id)`** | **Bitmap Index Scan · 0.04 ms** | **0.05 ms** | **1.26 ms** |

테이블 크기에 선형이다(4배마다 약 3.5~5배). 인덱스 크기는 320,000행에서 **4.5 MB**(테이블 41 MB). `workflow_id` 는 v1 에서
바뀌지 않으므로(트리거 목록 §2.3.1 `workflowId` read-only) 쓰기 비용은 INSERT 때뿐이다.

### 같은 클래스 전수 — `workflow`·`workspace` 를 참조하는 FK 중 선두 인덱스가 없는 것

카탈로그로 29개 FK 를 전부 대조했다. 선두 인덱스가 없는 것은 `trigger.workflow_id` 포함 **7개**:

| 부모 | 자식.컬럼 | 삭제 동작 |
|---|---|---|
| workflow | **`trigger.workflow_id`** | CASCADE — **이 draft** |
| workflow | `integration_usage_log.workflow_id` | CASCADE |
| workflow | `alert_rule.workflow_id` | CASCADE |
| workspace | `auth_config.workspace_id` | CASCADE |
| workspace | `knowledge_base.workspace_id` | CASCADE |
| workspace | `integration_oauth_state.workspace_id` | CASCADE |
| workspace | `integration_oauth_preview.workspace_id` | CASCADE |

**나머지 여섯은 이 draft 가 다루지 않는다** — 트리거는 #1346 이 삭제 경로에 **앱 쿼리 두 번**(하나는 부모 잠금 안)을 더해
비용이 세 배가 된 자리이고, 나머지는 CASCADE 한 번뿐이다. 특히 `integration_usage_log` 는 로그 테이블이라 행 수가 가장 클 수
있지만, INSERT 가 잦은 테이블에 인덱스를 더하는 것은 쓰기 비용과 맞바꾸는 판단이라(부분 인덱스 여부 포함) 따로 재야 한다.
트래커에 등재한다(아래).

## 변경안

### S1. `spec/1-data-model.md` §3 인덱스 전략 — `Trigger | (workspace_id, endpoint_path) UNIQUE` 행 다음

`| Trigger | (workflow_id) | 워크플로 삭제 경로 — 트리거 자원 정리의 열거 두 번(`WHERE workflow_id = ?`, 하나는 `workflow` 행 잠금 안)과 FK `ON DELETE CASCADE`. 이 셋 말고 `workflow_id` 로 트리거를 찾는 곳은 없다. Postgres 는 FK 에 인덱스를 자동 생성하지 않는다. CONCURRENTLY, V111 |`

### S2. `spec/1-data-model.md` `## Rationale` — 맨 위(가장 최근 결정 순)에 새 절

`### Trigger \`(workflow_id)\` 인덱스 (2026-09-18)` — 위 «`trigger.workflow_id` 로 트리거를 찾는 곳» 표의 요지 · 비용 표 · 같은
클래스 전수 결과(여섯은 별도 판단)를 옮긴다. 출처: 트래커 항목, 실측 절차는 이 draft(`plan/complete/` 로 이동), 구현 V111.

### S3. `spec/data-flow/10-triggers.md` §2.1 `trigger` 생성 행 «인덱스 / 제약» 칸 끝

`… 인덱스는 V002.` → `… 인덱스는 V002. \`(workflow_id)\` 인덱스는 워크플로 삭제 경로(트리거 자원 정리의 열거 · FK CASCADE)용이다 (V111).`

## 구현 (같은 PR, developer 턴)

- **V111** `codebase/backend/migrations/V111__trigger_workflow_id_index.sql` + `.conf`(`executeInTransaction=false`) —
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trigger_workflow_id ON trigger (workflow_id);` (V106 형태, 수동 롤백 주석 포함).
  새 식별자 `idx_trigger_workflow_id`·`V111` 은 저장소 grep 0건.
- **트래커 셋째 불릿** — `releaseExternalForParent` 가 트리거 전체 컬럼을 적재한다 → `select: { id, type, config }`. 외부 해제가
  읽는 것은 `id`(listener·로그) · `type`(schedule 판별) · `config`(chat channel teardown) 셋뿐이다.
- **증거** — e2e 에 V110 선례(`schedule-trigger.e2e-spec.ts` «schema: … (V110)»)와 같은 스키마 단언: 인덱스 실재 · `indisvalid` ·
  정의가 `(workflow_id)`. 단위 테스트에 `select` 좁히기 단언.

## 트래커 반영

- «부모 삭제 경로의 성능 후속» — 첫째(인덱스)·셋째(`select`) 불릿 해소 표시. **둘째 불릿(순차 처리 지연이 트리거 수에 선형,
  «부모 하나의 트리거 수가 작다» 는 미실측 가정)은 남긴다** — 이 PR 은 테이블 전체 크기에 따른 비용을 없앨 뿐, 부모 하나에
  딸린 트리거 수에 따른 비용은 그대로다.
- 새 항목: «`workflow`·`workspace` FK 중 선두 인덱스가 없는 여섯» (developer + planner) — 위 표 그대로, `integration_usage_log`
  우선(행 수 · 쓰기 비용 실측 선행).

## 체크리스트

- [ ] `--spec` BLOCK: NO → S1~S3 반영
- [ ] `--impl-prep`
- [ ] V111 · `select` 좁히기 · e2e 스키마 단언 · 단위 단언
- [ ] lint · unit · build · e2e
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 반영 · 이 draft `complete/` 이동

## Rationale

### 왜 이 인덱스 하나만인가

같은 클래스(선두 인덱스 없는 FK)가 일곱이지만, 트리거만 **#1346 이 비용을 세 배로 만든** 자리다 — CASCADE 한 번이던 것이
열거 두 번을 더해 세 번이 됐고, 그중 둘이 `workflow` 행 잠금 안에서 돈다. 나머지 여섯은 그 PR 과 무관한 기존 상태이고 각 테이블의
쓰기 패턴이 달라(로그 테이블 · 소형 설정 테이블) 한 마이그레이션에 묶어 판단할 성질이 아니다. 전수 결과는 버리지 않고 트래커에
옮긴다.

### 왜 `(workflow_id)` 단독인가

찾는 쿼리가 셋 다 `workflow_id` 등치 하나뿐이다(열거 둘 · CASCADE 의 `DELETE FROM ONLY trigger WHERE workflow_id = $1`). 정렬도
다른 술어도 없어 복합 인덱스가 줄 것이 없다. V110 이 «선두는 술어 컬럼이어야 한다» 를 실측으로 보인 것과 같은 판단이다.
