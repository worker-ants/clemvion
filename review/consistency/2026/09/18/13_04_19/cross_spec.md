# Cross-Spec 일관성 검토 — trigger `(workflow_id)` 인덱스 (S1~S4, 초점 S4)

## 발견사항

없음 — CRITICAL·WARNING·INFO 어느 등급의 cross-spec 충돌도 발견되지 않았다.

### 확인한 근거

- **S1/S2 (`spec/1-data-model.md`)**: §3 인덱스 전략 표에 `Trigger | (workflow_id) | ...`, 그 위 `notification_health` 부분
  인덱스(V061) 행, `## Rationale` 최상단에 `### Trigger \`(workflow_id)\` 인덱스 (2026-09-18)` 절 — 모두 draft 대로 이미
  워킹트리에 반영되어 있고 실측 표·같은 클래스 전수 결과와 정확히 일치한다.
- **S3 (`spec/data-flow/10-triggers.md`)**: §2.1 `trigger` 생성 행 「인덱스/제약」 칸이 draft 대로 `(workflow_id)` 인덱스
  문장을 덧붙여 반영되어 있다.
- **코드·마이그레이션 대조**: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` 의
  `releaseExternalForParent`(`select: { id, type, config }`, `where: parent`)와 `lockParentAndListTriggerIds`
  (`manager.find(Trigger, { select: { id }, where: parent })`)가 draft 의 "workflow_id 로 트리거를 찾는 곳 셋" 서술과
  정확히 일치하고, FK `trigger_workflow_id_fkey ON DELETE CASCADE` 를 더해 셋이 맞다. `V111__trigger_workflow_id_index.sql`
  은 `DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_workflow_id;` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` 순서로
  README §5 "신규 추가에도 0) 을 둡니다" 패턴을 그대로 구현했다. 새 식별자 `idx_trigger_workflow_id`·`V111` 은
  `codebase/`·`spec/`·`plan/` 전수 grep 결과 이 작업이 만든 자리(SQL·`.conf`·spec 2곳·e2e 주석) 외 다른 의미로 이미
  점유된 곳이 없다.
- **`spec/2-navigation/2-trigger-list.md`**: §2.3.1 `workflowId` read-only(v1) 서술, §4.3 cascade 표·"부모 행을 잠근 뒤
  같은 트랜잭션에서 열거" 서술이 draft 의 실측·Rationale 과 모순 없이 일치한다.
- **같은 클래스 전수(FK 7개)**: `auth_config.workspace_id`·`knowledge_base.workspace_id`·
  `integration_oauth_state/preview.workspace_id`·`alert_rule.workflow_id`·`integration_usage_log.workflow_id` 를
  `spec/1-data-model.md` §3 표에서 대조한 결과 이들에 대한 선두 인덱스 행이 실제로 없다 — draft 의 "나머지 여섯은 인덱스가
  없다"는 전제와 spec 현재 상태가 어긋나지 않는다. 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에도
  이 여섯에 대한 항목이 아직 없어 draft 가 추가하려는 "새 항목"과 중복이 없다.
- **S4 (`spec/conventions/migrations.md` §5 말미 콜아웃, 이번 회차 초점)**: 현재 워킹트리는 아직 **1라운드 RESOLUTION 이
  유지한 구버전**(`인덱스 교체는 별도 패턴이 있다` / README §5 "인덱스 교체는 DROP-먼저"만 언급)을 담고 있고, draft 가 이를
  교체·신규 추가 모두를 포괄하는 문장으로 바꾸자고 제안한다. 이 번복에는 실제 근거가 있다 — 2라운드 코드리뷰
  (`review/code/2026/09/18/12_54_44/SUMMARY.md` WARNING 2)가 "교체에 한정된 문장처럼 읽혀 이 PR 이 고치려는 V106 갭을
  재생산하는 경로"라고 명시적으로 지적했고, draft 의 제안 문구는 그 WARNING 의 제안 문장("교체 또는 신규 추가 모두 README §5
  의 DROP-먼저 패턴을 따른다")을 그대로 반영한다. 1라운드 RESOLUTION(`review/code/2026/09/18/12_43_23/RESOLUTION.md`
  WARNING 1)의 "spec 은 고치지 않는다" 판단을 뒤집는 근거로 draft 가 직접 인용하는 것도 이 2라운드 WARNING 이다 — 자기모순
  없이 진행 경위가 문서에 남아 있다.
  - 새 문구가 가리키는 `codebase/backend/migrations/README.md` §5 는 실제로 "인덱스 교체는 DROP-먼저"와 "신규 추가에도 0)
    을 둡니다" 두 하위 패턴을 모두 담고 있어(커밋 `ff7d79967` 로 이미 반영됨), draft 의 새 콜아웃 문구가 가리키는 대상과
    실제 문서 내용이 일치한다. `(V056)`/`(V106)` 각 사례 인용도 실제 마이그레이션 파일(교체/신규 추가)과 일치한다.
  - 이 콜아웃 텍스트를 인용하는 다른 spec/코드 위치는 없어(grep 전수), 문구 교체가 다른 문서에 깨진 참조를 남기지 않는다.
  - `spec/conventions/migrations.md` 자신의 §5 "3단계"("README.md §4·§5 참고")와 새 콜아웃이 겹치는 것처럼 보이지만,
    draft Rationale 이 이미 "3단계는 `.conf` 맥락" 이라고 스코프를 구분해 적어 두어 오독 소지를 줄인다 — 이 구분은 spec 본문
    자체에는 명시되지 않으므로 다음 사람이 두 문장의 스코프 차이를 spec 만 보고 알기는 어렵지만, 이는 기존부터 있던 구조이고
    이번 draft 가 새로 만든 모호성이 아니다(등급 부여 대상 아님, 참고용 관찰).

## 요약

target draft(`plan/in-progress/spec-draft-trigger-workflow-index.md`)가 제안하는 `spec/1-data-model.md`·
`spec/data-flow/10-triggers.md` 변경은 이미 워킹트리에 반영되어 있고 코드·마이그레이션·인접 spec(`2-trigger-list.md`)과
정합적이다. 이번 회차의 초점인 S4(`spec/conventions/migrations.md` §5 콜아웃, 1라운드 처분 번복)는 2라운드 코드리뷰
WARNING 이 요구한 문구를 그대로 반영하고 실제 README §5 최신 내용과 일치하며, 다른 문서에 이 문구를 참조하는 곳이 없어
전파성 충돌도 없다. 새 식별자(`idx_trigger_workflow_id`, `V111`)의 이름 충돌도 없다. Cross-Spec 관점에서 데이터 모델·API
계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 모순이 발견되지 않았다.

## 위험도
NONE
