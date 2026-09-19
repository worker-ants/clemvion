# 신규 식별자 충돌 검토 — `spec/2-navigation/`

## 전제 확인

`git status` / `git log -- spec/2-navigation/` 로 확인한 결과, 이번 워크트리(`entity-column-drift-b83f15`)의
실제 변경분은 `codebase/backend/src/modules/{alerts,edges,integrations,llm,model-config,nodes,workflow-assistant,workspaces}/entities/*.ts`
여덟 엔티티 파일뿐이며 **`spec/2-navigation/` 아래 어떤 파일도 diff 에 포함되어 있지 않다**. 번들에 실린
`1-workflow-list.md` / `2-trigger-list.md` / `3-schedule.md` 본문은 이미 `status: partial` 또는
`status: implemented` 로 병합·구현되어 있는 기존 문서다. 즉 이번 검토가 대상으로 받은 "target 문서"는
**새로 도입되는 식별자를 담은 초안이 아니라, 기존에 안정화된 spec 을 그대로 재번들한 것**이다
(plan `plan/in-progress/entity-column-declaration-drift.md` 의 체크리스트 항목
`- [ ] --impl-prep spec/2-navigation/` 가 이 스코프를 지정했다 — 엔티티 컬럼 드리프트 작업과
`spec/2-navigation/` 사이의 연결은 이 체크리스트 문구 외에는 diff 상 확인되지 않는다).

이 전제 때문에 아래 검토는 "target 이 새로 부여하는 식별자"를 찾을 수 없었고, 대신 번들에 등장하는
식별자들이 코퍼스(`spec/`, `plan/in-progress/`, `spec/conventions/`) 전체와 **이미 정합적으로
교차 참조되어 있는지**를 확인하는 형태로 수행했다.

## 점검 결과 (관점별)

### 1. 요구사항 ID 충돌
`NAV-WF-07` 은 `spec/2-navigation/_product-overview.md:54` 에서 정의되고 `1-workflow-list.md` Rationale §1
이 동일 의미("팀 워크스페이스 공유 워크플로우 구분 표시")로만 참조한다. 다른 의미로 재사용된 곳 없음.
`WH-EP-02` / `WH-MG-09` / `WH-SC-01` / `CCH-SE-01` / `CCH-SE-03` / `CCH-NF-03` / `R-CC-10` / `R-CC-11` /
`R-CC-21` 은 모두 `5-system/12-webhook.md` · `5-system/15-chat-channel.md` 쪽 SoT 를 그대로 인용하는
cross-reference 이며 번들 내부에서 재정의되지 않는다. 충돌 없음.

### 2. 엔티티/타입명 충돌
`TriggerDto` / `ScheduleDto` / `ExportWorkflowDto` / `WorkflowSettingsDto` / `UpdateWorkflowDto` /
`update-trigger.dto.ts` / `query-workflow.dto.ts` 모두 grep 결과 다른 영역에서 동명이의로 쓰이는 사례
없음. `WorkflowSettingsDto` 는 이 번들에서만 등장하고 다른 spec 문서가 이 이름을 다른 대상에 쓰지 않는다.

### 3. API endpoint 충돌
`/api/workflows`, `/api/workflows/:id/duplicate`, `/api/workflows/:id/export`, `/api/workflows/import`,
`/api/folders*`, `/api/triggers*`, `/api/schedules*` 계열을 `spec/data-flow/11-workflow.md` 등과
대조했다 — method·path·의미가 모두 일치한다(예: `POST /api/workflows/:id/duplicate` 의 "메타+전체
nodes/edges 트랜잭션 복제" 설명이 두 문서에서 동일). `/api/folders` 는 다른 spec 문서에 정의가 없어
번들이 유일한 정의처이며 충돌 후보가 없다.

관찰(정보용, 충돌 아님): `2-trigger-list.md §2.5`/§3 의 `POST /api/triggers`(webhook/manual 생성)와
`3-schedule.md §3`(Trigger 자동 생성 규칙)이 "schedule 타입은 트리거 화면에서 직접 생성 불가"를
서로 다른 문서에서 대칭적으로 서술하는데, 문구·의미가 정확히 대칭이라 충돌이 아니라 의도된 교차
서술이다.

### 4. 이벤트/메시지명 충돌
`trigger.updated` / `trigger.deleted` / `trigger.notification_secret_rotated` /
`trigger.chat_channel_bot_token_rotated` / `trigger.interaction_token_revoked` 감사 액션명을
`spec/5-system/1-auth.md §4.1`, `spec/data-flow/1-audit.md`, `spec/conventions/audit-actions.md` 와
대조 — 이름·의미·시제 패턴이 모두 일치한다. 새로 도입되는 이벤트명 없음.

### 5. 환경변수·설정키 충돌
`NEXT_PUBLIC_WEBHOOK_BASE_URL` / `NEXT_PUBLIC_API_URL` 은 `spec/5-system/12-webhook.md` (WH-EP-02)와
`spec/7-channel-web-chat/5-admin-console.md` 가 동일 우선순위·동일 구현 파일(`webhook-url.ts`)로 참조 —
정합. `Workflow.settings.maxConcurrentExecutions` 는 `spec/1-data-model.md` · `spec/5-system/4-execution-engine.md §8`
과 값(기본 3)·권한(Editor+)·SoT 가 모두 일치하며, 본문이 명시적으로 `Parallel` 노드의
`config.maxConcurrency`(노드 내부 branch 동시성)와 "스코프가 다른 별개 키"임을 self-disambiguate 하고
있어 오히려 혼동 방지가 이미 문서화되어 있다. 신규 키 충돌 없음.

관찰(정보용): `1-workflow-list.md §2.3` 소유 필터의 쿼리 파라미터 `ownership`(`mine`/`shared`/`all`)과
`spec/data-flow/12-workspace.md` 의 액션 `POST /api/workspaces/:id/transfer-ownership` 은 같은
어휘("ownership")를 쓰지만 리소스(`/workflows` vs `/workspaces`)·표현 형태(query param vs 경로
세그먼트)가 달라 실질적 식별자 충돌은 아니다.

### 6. 파일 경로 충돌
번들에 새로 도입되는 spec 파일 경로가 없다(기존 파일 재번들). `spec/2-navigation/` 폴더 안에서
번호 접두사(`0-`~`16-`, `_product-overview.md`, `_layout.md`)명명 컨벤션과 어긋나는 신규 파일 없음.

## 요약

target 으로 전달된 `spec/2-navigation/` 번들은 이번 워크트리의 실제 diff(백엔드 엔티티 컬럼 선언
여덟 곳)에 포함되지 않은, 이미 안정화·구현된 기존 spec 을 그대로 재번들한 것이라 "새로 도입하는
식별자"가 존재하지 않는다. 요구사항 ID·DTO/엔티티명·API endpoint·감사 이벤트명·ENV 변수·설정 키
전 항목을 코퍼스와 대조한 결과, 의미가 어긋나는 동명이의 사용처나 새로 신설되어 기존과 겹치는
식별자는 발견되지 않았다 — 오히려 상호 참조가 촘촘히 맞물려 있는 성숙한 영역이다. 발견한 두 건은
모두 정보성 관찰(동일 어휘의 다른 스코프 재사용, 대칭적 교차 서술)로 실제 충돌이 아니다.

## 위험도

NONE
