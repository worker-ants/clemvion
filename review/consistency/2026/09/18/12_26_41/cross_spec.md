# Cross-Spec 일관성 검토 — `spec/2-navigation/` (--impl-prep)

## 점검 범위

`--impl-prep` 선언 scope 는 `spec/2-navigation/` 이나, 실제 착수 대상은 이미 `--spec`(BLOCK: NO, `review/consistency/2026/09/18/12_18_52`)을 통과해 main 에 머지된 `fa1153e64`(Trigger `(workflow_id)` 인덱스 V111) 의 후속 구현이다. 걸리는 spec 은 셋: `spec/1-data-model.md`(§3 인덱스 표 + Rationale), `spec/2-navigation/2-trigger-list.md`(releaser·e2e), `spec/conventions/migrations.md`(V111 `.sql`/`.conf`). 아래는 이 셋과 나머지 `spec/**` 사이의 데이터 모델·API·요구사항 ID·상태 전이·RBAC·계층 책임 충돌 여부를 확인한 결과다.

## 확인한 항목 (충돌 없음)

1. **인덱스 정의 중복/충돌 없음** — `spec/1-data-model.md` §3 신규 행 `Trigger | (workflow_id) | ... V111` 과 `spec/data-flow/10-triggers.md` §2.1 의 동일 V111 각주가 서로 다른 문서에서 같은 사실(트리거 삭제 경로 열거 2회 + FK CASCADE)을 기술하며 모순 없이 일치한다. `V111` 이름·설명자는 `codebase/backend/migrations/`(최신 `V110__schedule_workspace_next_run_index.*`)에 아직 미점유이며 spec 전체에서도 이 두 자리 외 재정의가 없다(grep 전수).
2. **`select: { id, type, config }` 좁히기 — 소비 필드와 정확히 일치** — `TriggerResourceReleaserService.releaseExternalMany`(및 그 호출자 `releaseExternalForParent`)가 실제로 읽는 필드는 `trigger.type`(schedule 필터링) · `trigger.id`(listener unregister·schedule 조회 키) · `trigger.config`(`ChatChannelBinderService.teardownChatChannel`이 `trigger.config.chatChannel` 을 읽음) 셋뿐임을 소스에서 직접 확인했다. `spec/2-navigation/2-trigger-list.md` §4.3 이 서술하는 "외부 자원(schedule BullMQ job · chat channel provider 등록 teardown · listener registry)" 범위와 정확히 대응한다 — `workspaceId` 등 다른 필드는 teardown 경로에서 쓰이지 않는다(setup 경로인 `setupChatChannel` 만 `workspaceId` 를 쓴다).
3. **`releaseExternal(trigger)`(단건, `triggers.service.ts`) 는 영향 없음** — 이 경로는 이미 로드된 전체 `Trigger` 엔티티를 그대로 넘기므로, 이번 select 좁히기는 `releaseExternalForParent` 내부의 자체 `find()` 호출에만 적용된다. 다른 두 호출자(`workflows.service.ts`, `workspaces.service.ts`)도 같은 내부 find 를 경유하므로 동일하게 안전하다.
4. **마이그레이션 컨벤션과 정합** — plan 이 택한 "V106 처럼 CREATE 만 두지 않고, 신규 추가임에도 DROP-먼저 invalid 잔재 정리를 앞에 둔다"는 방침은 `spec/conventions/migrations.md`(§5 각주 "인덱스 교체는 DROP-먼저")가 가리키는 `codebase/backend/migrations/README.md` §5 "인덱스 교체는 DROP-먼저" 절의 처방(신규 추가 V106 형태의 위험까지 명시)과 정확히 일치한다. 두 문서 간 SoT 참조("작성 가이드는 README, 버전 정책은 migrations.md")도 그대로 유지된다.
5. **Rationale 의 `plan/complete/...` 선행 참조는 기존 관례** — `spec/1-data-model.md` 새 Rationale 절이 아직 `plan/in-progress/` 에 있는 `spec-draft-trigger-workflow-index.md` 를 `plan/complete/` 경로로 인용하는 것은, 같은 문서의 선례(V110 절이 `plan/complete/spec-draft-schedule-index.md` 를 같은 방식으로 선참조)와 동일한 패턴이라 신규 불일치가 아니다.
6. **"이 셋 말고 `workflow_id` 로 트리거를 찾는 곳은 없다"는 근거 확인** — `codebase/backend/src/modules/{triggers,schedules}` grep 상, `trigger.workflowId` 를 참조하는 나머지 자리는 전부 이미 로드된 관계(`schedule.trigger?.workflowId` 등)를 읽는 것이지, `trigger` 테이블에 대한 독립적인 `WHERE workflow_id = ?` 조회가 아니다. Rationale 의 "그 외 없음" 주장과 어긋나지 않는다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 0).

## 요약

이번 변경은 `spec/1-data-model.md`(V111 인덱스 행 + Rationale) · `spec/data-flow/10-triggers.md`(§2.1 각주) · `spec/conventions/migrations.md`(README §5 위임)에 걸치는 좁은 성능 후속 조치로, 이미 `--spec` 게이트(BLOCK: NO, Critical/Warning 0)를 통과해 main 에 반영되어 있다. 구현 단계에서 계획된 `select: { id, type, config }` 좁히기는 실제 소비 코드(`TriggerResourceReleaserService`/`ChatChannelBinderService`)와 대조했을 때 필드 누락이 없고, V111 마이그레이션 형태(DROP-먼저)는 기존 마이그레이션 컨벤션·README 처방과 정확히 일치한다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 다른 `spec/**` 영역과의 모순을 발견하지 못했다.

## 위험도

NONE
