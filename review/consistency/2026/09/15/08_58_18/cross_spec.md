# Cross-Spec 일관성 검토 — trigger-lock-followups (`--impl-prep spec/5-system/`)

## 검토 배경

`plan/in-progress/trigger-lock-followups.md`(`spec_impact: none`)는 `spec/` 을 고치는 작업이
아니라 `codebase/backend/src/modules/triggers/**` · `schedules.service.ts` 의 5건짜리
follow-up 코드 정리다. 새 엔티티·API·요구사항 ID·RBAC·상태 머신을 신설하지 않으므로, 대부분의
점검 관점(1·2·3·5)에는 해당 사항이 없다. 대신 이 plan 이 착수 전 실측(④)에서 스스로 드러낸
사실 — **Workflow/Workspace 삭제가 FK `ON DELETE CASCADE` 로 Trigger 행을 지운다** — 이
기존 `spec/data-flow/**` 문서의 상태-전이 서술과 어긋나는지를 실측으로 확인했다.

## 발견사항

- **[WARNING]** Workflow 삭제 상태 다이어그램의 CASCADE 목록에 `trigger` 가 빠져 있다
  - target 위치: `plan/in-progress/trigger-lock-followups.md` §"④ — Trigger 행을 지우는 경로는
    둘이 아니라 셋이다" (`Workflow`·`Workspace` 삭제의 FK `onDelete: 'CASCADE'`, 진입점
    `workflows.service.ts:259`) / 근거 코드 `codebase/backend/src/modules/triggers/entities/trigger.entity.ts:39,46`(`@ManyToOne(() => Workflow, { onDelete: 'CASCADE' })`, `@ManyToOne(() => Workspace, { onDelete: 'CASCADE' })`) — DB 스키마로는 `codebase/backend/migrations/V001__initial_schema.sql:146`(`workflow_id UUID NOT NULL REFERENCES workflow(id) ON DELETE CASCADE`)까지 V001 원본부터 존재
  - 충돌 대상: `spec/data-flow/11-workflow.md` §3.1 `workflow.is_active` 상태 다이어그램
    (`Active --> [*]: workflow 삭제 (CASCADE: nodes/edges/versions/executions/assistant_sessions)`)
  - 상세: 이 mermaid 다이어그램은 workflow 삭제 시 CASCADE 되는 자식 테이블을 **명시적으로
    열거**하면서 `trigger` 를 빼놓았다. 그러나 실제 FK 는 (V001 부터, 이번 plan 이 아니라
    최초 스키마부터) `trigger.workflow_id ON DELETE CASCADE` 다 — 즉 워크플로우 삭제는
    nodes/edges/versions/executions/assistant_sessions 뿐 아니라 **trigger(및 그 자식인
    schedule — FK CASCADE 연쇄)까지 지운다**. `spec/2-navigation/2-trigger-list.md` §4.3
    "cascade 동작" 표는 반대 방향(트리거 삭제 → schedule/execution/authConfig)만 다루고,
    "워크플로우 삭제 → 트리거 CASCADE" 라는 상류 방향은 어느 spec 문서에도 명시돼 있지 않다.
    이번 plan 의 실측이 바로 이 누락된 사실을 근거로 실결함(트랜잭션 밖 advisory lock 미보호로
    인한 lost update)을 찾아냈다 — 문서가 이 경로를 몰랐던 것과 코드가 이 경로를 못 잠근 것이
    같은 근본 원인(spec 미기술)에서 나온 두 증상이다.
  - 제안: `developer` 는 이 문장을 직접 쓰지 않았으므로(자기-반증형 소정정 조건 1 불충족 —
    `git blame` 대상이 아니라 원저작 문서) `spec/data-flow/11-workflow.md` 를 스스로 고치지
    말고 `project-planner` 턴으로 넘긴다. 정정 시 (a) §3.1 다이어그램의 CASCADE 목록에
    `trigger` 를 추가하고 `schedule` 로의 2차 CASCADE 도 각주로 남기며, (b)
    `spec/2-navigation/2-trigger-list.md` §4.3 표에 "워크플로우/워크스페이스 삭제로 인한
    CASCADE" 행을 상류 방향으로 추가해 이번 fix(`rewriteTriggerConfigLocked` 의
    `affected===0` 처리)가 지키는 계약을 문서 쪽에서도 가리키게 한다.

- **[INFO]** `trigger-config` advisory lock 키 네임스페이스가 `redis-keys.md` §4 에 여전히 미등재 (기지 사실, 재확인)
  - target 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:9-16`
    (`TRIGGER_CONFIG_LOCK_PREFIX` JSDoc — `{도메인}:{식별자}` 형태가 Redis 키와 겉모양이
    같지만 Postgres advisory lock 문자열이라는 경고)
  - 충돌 대상: `spec/conventions/redis-keys.md` §4 "인접 네임스페이스" — 이번에 grep 한
    결과 `trigger-config` · `exec-cap` 어느 쪽도 등재돼 있지 않다.
  - 상세: 이 PR 이 건드리는 항목 ②·③이 정확히 이 파일(`trigger-config-lock.ts`)의 JSDoc·검증
    로직이라, 같은 파일 상단에 "이미 planner 항목으로 올렸다" 고 스스로 적어 둔 미등재
    상태가 여전히 유효한지 실측했다 — **여전히 미등재**다. 이번 plan 의 스코프(developer 범위
    5건)에는 포함되지 않으므로 새 결함은 아니지만, JSDoc 을 다시 만지는 김에 이 gap 이
    묻히지 않도록 재확인한다.
  - 제안: 새 조치 불요(이미 `--impl-prep review/consistency/2026/09/14/17_10_16`
    naming_collision WARNING#2 로 planner 큐에 있음). 이번 PR 의 CHANGELOG/plan 에 "여전히
    미등재 확인함" 한 줄만 남겨 후속 세션이 중복 발견하지 않게 하는 것을 권장.

- **[INFO]** rotate-bot-token 404 계약은 이번 수정과 충돌하지 않음 (검토 후 배제, 근거만 기록)
  - target 위치: `plan/in-progress/trigger-lock-followups.md` 항목 4 (`affected` 미확인 수정)
  - 충돌 대상 후보: `spec/5-system/15-chat-channel.md` §5.4 표 (`404 RESOURCE_NOT_FOUND` —
    `triggers.service.ts:122 findById` 만 사유로 명시)
  - 상세: `rewriteTriggerConfigLocked` 가 `affected===0` 을 이제 `false` 로 정확히 보고하게
    고치면, `rotateBotToken`/`revokePerTriggerToken` 처럼 `if (!wrote) throw
    NotFoundException` 을 이미 구현하고 있는 호출부는 **기존에 문서화된 것과 동일한**
    `404 RESOURCE_NOT_FOUND` 를 (기존엔 도달 못 하던 race 창에서도) 던지게 된다. HTTP
    status·error code 가 바뀌지 않으므로 §5.4 표를 갱신할 필요는 없다 — 오히려 코드가
    문서(및 `trigger-config-lock.ts` 자체 JSDoc 의 "부재를 드러내는 방식" 표)를 더 충실히
    따르게 되는 방향이다. 새 충돌 아님, 참고로만 남긴다.

## 요약

이번 target 은 `spec/5-system/` 자체를 고치는 draft 가 아니라 `spec_impact: none` 코드
정리 5건이라, 데이터 모델·API 계약·요구사항 ID·RBAC 축에서는 새로 만들어지는 표면이 없어
직접 충돌이 없다. 다만 plan 이 착수 전 실측으로 찾아낸 "Workflow/Workspace 삭제가 CASCADE 로
Trigger 를 지운다"는 사실은 `spec/data-flow/11-workflow.md` §3.1 상태 다이어그램의 CASCADE
열거가 이미 오래전부터(V001) 불완전했음을 드러낸다 — 이는 이번 코드 fix 가 막는 실결함과
같은 뿌리(문서화되지 않은 상류 cascade)에서 나온 것이라 WARNING 으로 등재하고, 정정은
developer 권한 밖이므로 project-planner 턴으로 넘길 것을 제안한다. 나머지는 기지 사실(Redis
네임스페이스 미등재) 재확인과, 검토 후 충돌 아님으로 배제한 항목(rotate-bot-token 404 계약)
뿐이다.

## 위험도

LOW
