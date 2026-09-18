# 신규 식별자 충돌 검토 — `trigger (workflow_id)` 인덱스 (--impl-prep, scope=spec/2-navigation/)

## 검토 범위 정정

호출 payload 는 `scope=spec/2-navigation/` 로 `1-workflow-list.md` / `2-trigger-list.md` / `3-schedule.md` 등을
번들했으나, 이번 plan(`plan/in-progress/spec-draft-trigger-workflow-index.md`)이 실제로 새 식별자를 도입하는
자리는 **`spec/1-data-model.md` §3 인덱스 표 + `## Rationale`**, **`spec/data-flow/10-triggers.md` §2.1**,
그리고 developer 턴에서 만들 **`codebase/backend/migrations/V111__trigger_workflow_id_index.sql`(+`.conf`)** 다.
S1~S3 는 이미 커밋됐다(`fa1153e64`) — 이번 세션은 그 뒤 `--impl-prep`, 즉 아직 만들어지지 않은 V111 마이그레이션·인덱스명이
실측·구현 단계로 넘어가기 전 재확인이다. `spec/2-navigation/**` 자체는 이 plan 으로 신규 식별자를 도입하지 않는다
(트리거/워크플로우/스케줄 화면 스펙 본문은 무변경) — 아래는 그 스코프 밖에서 실제로 새로 생기는 식별자를 저장소 전수
검색으로 대조한 결과다.

## 점검 관점별 결과

### 1. 요구사항 ID 충돌
새 요구사항 ID 도입 없음 (NAV-WF-* 류 ID 신설 없음). 해당 없음.

### 2. 엔티티/타입명 충돌
새 엔티티·DTO·인터페이스 없음 — 기존 `Trigger` 테이블에 인덱스만 추가한다. 해당 없음.

### 3. API endpoint 충돌
신규 endpoint 없음. 해당 없음.

### 4. 이벤트/메시지명 충돌
webhook·queue·SSE 이벤트명 신설 없음. 해당 없음.

### 5. 환경변수·설정키 충돌
ENV var·config key 신설 없음. 해당 없음.

### 6. 파일 경로·식별자 충돌 (실질 쟁점)

- **인덱스명 `idx_trigger_workflow_id`** — `codebase/`·`spec/`·`plan/` 전수 grep 결과, 이 draft/spec 문서 자신과 그것을
  대상으로 한 `review/**` 산출물(`review/code/2026/09/17/19_14_29/*`, `review/consistency/2026/09/18/12_18_52/**`)
  외에는 등장하지 않는다. 실제 마이그레이션 SQL(`codebase/backend/migrations/*.sql`)·TypeORM 엔티티
  (`trigger.entity.ts` — `@Index` 데코레이터 없음, 이 저장소는 인덱스를 SQL 마이그레이션으로만 관리)에도 정의가 없다.
  기존 `trigger` 인덱스는 `idx_trigger_workspace_type`(V002) / `idx_trigger_workspace_endpoint`(V002) /
  `idx_trigger_notification_degraded`(V061) 세 개뿐이고 이름이 겹치지 않는다. 명명 패턴도 선례
  (`idx_execution_workflow_status` V105 · `idx_schedule_trigger_id` V106 · `idx_schedule_workspace_next_run` V110)의
  `idx_<table>_<column>` 컨벤션을 그대로 따른다.
- **마이그레이션 번호 `V111`** — `ls codebase/backend/migrations/` 실측 결과 현재 max 는 `V110__schedule_workspace_next_run_index.{sql,conf}` 다.
  `V111` 은 어떤 `.sql`/`.conf` 파일명으로도 아직 점유되지 않았고, `spec/conventions/migrations.md` §2 의
  "max(V)+1 단조 증가" 를 충족한다. `spec/1-data-model.md`·`spec/data-flow/10-triggers.md`·이 plan 파일에 `V111` 문자열
  참조가 있으나 전부 "구현은 V111 로 한다" 는 예고 참조이지 실물 파일이 아니다.
- **Rationale 신규 절 제목 `### Trigger \`(workflow_id)\` 인덱스 (2026-09-18)`** — `spec/1-data-model.md` `## Rationale`
  섹션의 다른 절 제목(`User` 민감 컬럼 방어 / Schedule 인덱스 / `alert_rule` 등재 / WorkflowVersion.snapshot / Execution.execution_path /
  install_token 형식)과 텍스트·앵커 모두 겹치지 않는다 — 앵커 중복으로 인한 duplicate-slug(`-1` suffix) 문제 없음.
- **§3 표 신규 행 `Trigger | (workflow_id)`** — 같은 표에 `Node | (workflow_id)`, `Edge | (workflow_id)` 행이 이미 있으나
  이들은 서로 다른 테이블(Node/Edge/Trigger)의 컬럼이라 컬럼명 재사용 자체는 정상이며 식별자 충돌이 아니다(FK 컬럼명 관례).
- **트래커 신규 항목 라벨 `«workflow·workspace FK 중 선두 인덱스가 없는 여섯»`** — 저장소 전수 grep 결과 이 plan 문서 자신과
  그 대상 review 산출물 외에는 등장하지 않아 기존 트래커 불릿(«부모 삭제 경로의 성능 후속»)과 이름이 겹치지 않는다.
  단, 이 항목이 실제로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 본문에 반영됐는지는 이 plan 의
  `## 체크리스트` 마지막 항목("트래커 반영")이 아직 미체크 상태로 남겨 추적한다 — 이는 라벨 충돌이 아니라 반영 시점의 문제이므로
  naming_collision 관점의 결함은 아니다(plan_coherence 관점).
- **e2e 스키마 단언 문구** — V110 선례(`schedule-trigger.e2e-spec.ts:76` `it('schema: … (V110)', …)`)와 같은 패턴으로
  V111 케이스를 추가할 예정이나, 현재 어떤 `it()`/`describe()` 설명 문자열도 "V111" 을 포함하지 않아 신설 시 중복 없음.

## 요약

이번 plan 이 새로 도입하는 식별자(마이그레이션 파일명 `V111__trigger_workflow_id_index.{sql,conf}`, 인덱스명
`idx_trigger_workflow_id`, `spec/1-data-model.md` §3 신규 표 행과 `## Rationale` 신규 절 제목, 트래커 신규 항목 라벨)를
`codebase/`·`spec/`·`plan/` 전수 검색으로 대조한 결과 기존 정의·의미와의 충돌이나 명명 컨벤션 이탈이 발견되지 않았다.
S1~S3 spec 반영은 이미 커밋되어 있고(`fa1153e64`), 아직 실체화되지 않은 것은 developer 턴의 V111 마이그레이션 파일뿐이며
그 자리도 현재 비어 있다(max V110). 유일한 잔여 리스크는 버전 번호의 구조적 특성상 병렬 세션이 동시에 `V111` 을 점유할
가능성인데, 이는 이름의 의미 충돌이 아니라 `spec/conventions/migrations.md` 가 이미 다루는 "머지 race 안전망" 범주라 이
관점에서는 CRITICAL/WARNING 사유가 되지 않는다 — plan 자신도 "커밋 직전 V111 미점유 재확인" 을 이미 명시하고 있다(INFO,
비차단).

## 위험도

NONE
