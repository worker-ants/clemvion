---
title: 트리거 행을 없애는 모든 경로는 외부 자원을 먼저 해제한다 — 워크플로·워크스페이스 삭제의 정리 계약
status: in-progress
owner: project-planner
worktree: spec-deletion-releases-1476ae
started: 2026-09-17
spec_impact:
  - spec/2-navigation/1-workflow-list.md
  - spec/2-navigation/2-trigger-list.md
  - spec/data-flow/10-triggers.md
  - spec/data-flow/11-workflow.md
  - spec/data-flow/12-workspace.md
  - spec/1-data-model.md
  - spec/conventions/secret-store.md
---

# spec draft — 삭제 경로의 트리거 자원 해제 계약

## 배경 — 좁은 항목을 재다가 넓은 결함을 찾았다

트래커 developer 항목 8(«`rewriteTriggerConfigLocked` 반환값을 무시하는 호출부 2곳 — 0행이면 방금
쓴 secret 이 고아가 된다») 을 착수하며 전제를 쟀다. 그 «고아 secret» 이 좁은 경합에서만 생기는지
확인하려고 삭제 경로를 따라가니, **워크플로·워크스페이스 삭제는 트리거의 외부 자원을 하나도 해제하지
않는다.** 항목 8 의 경합은 이 결함의 아주 좁은 한 경우였다. 사용자 결정(2026-09-17)으로 이 결함으로
전환한다.

## 실측

### 트리거 삭제가 행을 지우기 **전에** 해제하는 것 — `TriggersService.remove()`

| # | 해제 | 빠지면 |
|---|---|---|
| 1 | schedule 타입이면 BullMQ job scheduler `schedule:<id>` 해제(`removeJob`) | job 이 계속 발화하고 runner 가 `Schedule <id> not found, skipping` warn 을 cron 주기마다 **영구히** 남긴다(`schedule-runner.service.ts`) |
| 2 | `teardownChatChannel` — provider 쪽 webhook 등록 해제(best-effort, CCH-AD-03) | Telegram/Slack/Discord 에 우리 콜백 등록이 남는다 |
| 3 | listener registry `unregister` | 인메모리 유령 엔트리 |
| 4 | `secrets.deleteByPrefix('secret://triggers/<id>/')` | **암호화된 bot token·서명 secret 이 영구히 남는다** — `secret_store` 에는 FK 가 없다(V063, §R4 의 의도된 설계) |

### 워크플로·워크스페이스 삭제는 위 넷 중 **아무것도** 하지 않는다

| 경로 | 구현 | 트리거 행 |
|---|---|---|
| `DELETE /api/workflows/:id` | `WorkflowsService.remove()` = `findById` → `workflowRepository.remove` → 감사 | FK CASCADE(`trigger.workflow_id NOT NULL … ON DELETE CASCADE`, V001) |
| `DELETE /api/workspaces/:id` | `WorkspacesService.deleteWorkspace()` = 비관적 락 트랜잭션 안에서 `workspace_invitation` DELETE → `workspace_member` DELETE → `workspace` remove | FK CASCADE(`trigger.workspace_id`, 그리고 workflow 경유) |

`deleteByPrefix` 를 부르는 곳은 저장소 전체에 `TriggersService.remove()` **하나**다.

### spec 이 이미 서로 어긋나 있다

| 자리 | 문면 | 실제 |
|---|---|---|
| `spec/1-data-model.md` `secret_store.workspace_id` | *"application-level cascade — `TriggersService.delete()` / **workspace 삭제 시 `deleteByPrefix` 로 정리**"* | workspace 삭제는 정리하지 않는다. 그리고 `delete()` 는 없는 메서드다(`remove()`) |
| `spec/data-flow/12-workspace.md §1.10` | 삭제 = 멤버십·워크스페이스 row 잠금 → 초대 → 멤버 → 워크스페이스 | 위 `1-data-model` 의 약속을 **적지 않는다** — 두 문서가 서로 다른 동작을 말한다 |
| `spec/2-navigation/1-workflow-list.md §2` 삭제 행 | *"연결된 트리거/스케줄도 함께 **비활성화**"* | **삭제**된다. `trigger.workflow_id` 가 `NOT NULL … ON DELETE CASCADE` 라 워크플로 없이 «비활성 트리거» 로 남을 수 없다 — 데이터 모델과 모순되는 문장이지 제품 의도가 아니다 |
| `spec/conventions/secret-store.md §R4` | *"trigger 삭제 시의 명시적 cleanup 책임은 `TriggersService.delete()` 가 진다"* | 책임을 **트리거 삭제 한 경로**에만 적었다. application-level cascade 를 택했으면 **트리거 행을 없애는 모든 경로**가 그 책임을 져야 한다 — 이 결함의 설계 근원 |

트래커 planner 항목 «없는 메서드 `TriggersService.delete()` 가 세 곳에 있다» 의 planner 몫 둘
(`1-data-model.md` · `secret-store.md §R4`)이 이 draft 의 편집 자리와 겹쳐 함께 닫는다(세 번째인
`V063` 마이그레이션 주석은 Flyway 체크섬 때문에 고치지 않는 것으로 이미 처분돼 있다).

## 결정

### D1. 규칙 — 트리거 행을 없애는 **모든** 경로는 행을 지우기 전에 그 트리거들의 외부 자원을 해제한다

해제 집합은 위 표의 넷(schedule job · chat channel teardown · listener registry · `secret_store`
prefix)이다. 경로를 목록으로 적지 않고 **규칙**으로 적는다 — 다음에 트리거 행을 지우는 경로가 생겨도
같은 규칙이 문다.

### D2. 행 삭제는 기존대로 FK CASCADE 에 맡긴다 — 트리거마다 «트리거 삭제» 를 부르지 않는다

**기각한 대안**: 워크플로·워크스페이스 삭제가 트리거마다 `DELETE /api/triggers/:id` 경로를 그대로
부른다. ① 트리거마다 `trigger.deleted` 감사가 **새로** 생긴다 — 지금은 `workflow.deleted` 하나만
남는다(동작 변화). ② 트리거 N 개가 N 개의 트랜잭션이 되어 워크플로 삭제의 DB 원자성이 깨진다.
**해제만 공유하고 행은 한 번의 CASCADE** 로 지운다.

### D3. 외부 호출은 DB 트랜잭션 **밖에서, 행 삭제 전에** 한다

`TriggersService.remove()` 와 같은 순서다. provider teardown 을 트랜잭션 안에 두면 락 보유 중 HTTP
요청이 끼어든다 — Cafe24 토큰 갱신이 advisory lock 을 기각한 사유와 같다
(`spec/2-navigation/4-integration.md`). 워크스페이스 삭제는 비관적 락 트랜잭션 **전에** 해제한다.
teardown 은 기존대로 best-effort 다(실패해도 삭제는 진행).

### D4. 워크스페이스 삭제는 추가로 `secret_store` 를 `workspace_id` 로 **명시 DELETE** 한다

§1.10 이 이미 FK 가 없는 `workspace_invitation` 을 같은 트랜잭션 안에서 명시 DELETE 한다 —
`secret_store` 도 FK 가 없는 같은 성격의 테이블이다. prefix 를 scope 마다 열거하지 않고
`workspace_id` 로 지우므로 트리거 외 scope 가 생겨도 덮는다(목록이 아니라 규칙).

### D5. 남는 창 — 적어 둔다

해제 대상 트리거를 **열거한 뒤** 행 삭제 **전에** 같은 워크플로에 새로 생긴 트리거는 해제를 받지
못한다. 워크스페이스 경로는 D4 가 그 트리거의 `secret_store` 까지 덮지만, provider 등록·schedule job 은
남을 수 있다. 워크플로 경로는 네 자원 모두 남을 수 있다. 발생 조건(삭제와 생성이 같은 워크플로에서
동시)이 좁아 이 계약 범위 밖으로 둔다.

## 변경안

### S1. `spec/2-navigation/1-workflow-list.md` — 목록 액션 표의 «삭제» 행

`| 삭제 | 확인 다이얼로그 후 삭제. 연결된 트리거/스케줄도 함께 비활성화 |`
→
`| 삭제 | 확인 다이얼로그 후 삭제. 연결된 트리거는 **함께 삭제**된다(FK CASCADE — schedule 트리거면 스케줄까지). 삭제 전에 각 트리거의 외부 자원(schedule job · chat channel webhook · 비밀)을 해제한다 — [트리거 목록 §4.3](./2-trigger-list.md#43-cascade-동작) |`

### S2. `spec/2-navigation/2-trigger-list.md §4.3` — «상류» 행의 동작 칸 끝에 덧붙임

> **외부 자원은 행 삭제 전에 앱이 해제한다** — 트리거 삭제(§4.4)가 하는 해제(schedule BullMQ job ·
> chat channel teardown(best-effort) · listener registry · `secret_store` 의
> `secret://triggers/<id>/` 비밀)를, 워크플로·워크스페이스 삭제도 그 경로가 지울 트리거마다 **DB
> 트랜잭션 밖에서 먼저** 한다. 워크스페이스 삭제는 여기에 더해 `secret_store` 를 `workspace_id` 로
> 명시 삭제한다([data-flow/12-workspace §1.10](../data-flow/12-workspace.md#110-워크스페이스-삭제--나가기)).
> 열거 뒤·행 삭제 전에 새로 생긴 트리거는 해제를 받지 못할 수 있다(좁은 창).

### S3. `spec/data-flow/10-triggers.md §1.4` — schedule 동기화 표에 행 추가

`| Workflow·Workspace 삭제 (FK CASCADE) | FK CASCADE 로 trigger → schedule row 동반 삭제 | 삭제 **전에** schedule 타입 트리거마다 `removeJob(schedule.id)` — 트리거 직접 삭제와 같은 해제 ([트리거 목록 §4.3](../2-navigation/2-trigger-list.md#43-cascade-동작)) |`

### S4. `spec/data-flow/11-workflow.md §3.1` — FK 파급 표의 `trigger` 행 끝에 덧붙임

`외부 자원(schedule job · chat channel webhook · 비밀)은 이 CASCADE **전에** 앱이 해제한다 — [트리거 목록 §4.3](../2-navigation/2-trigger-list.md#43-cascade-동작).`

### S5. `spec/data-flow/12-workspace.md §1.10` — `DELETE /api/workspaces/:id` 행 동작 칸

현재 문면 뒤를 다음 순서로 고친다:

`… team 전용(personal 은 `403 CANNOT_DELETE_PERSONAL`). **트랜잭션 전에** 워크스페이스의 트리거마다 외부 자원(schedule job · chat channel teardown · listener registry · `secret_store` prefix)을 해제한다([트리거 목록 §4.3](../2-navigation/2-trigger-list.md#43-cascade-동작)). 이어 단일 트랜잭션 + 비관적 락(`pessimistic_write`)으로 멤버십·워크스페이스 row 를 잠근 뒤, FK 관계가 선언되지 않은 `workspace_invitation` · **`secret_store`(`workspace_id` 기준)** 를 **명시 DELETE** → `workspace_member` DELETE → `workspace` 삭제 (`deleteWorkspace`).`

### S6. `spec/1-data-model.md` — `secret_store.workspace_id` 행

`| workspace_id | UUID | application-level cascade — `TriggersService.delete()` / workspace 삭제 시 `deleteByPrefix` 로 정리 |`
→
`| workspace_id | UUID | application-level cascade(FK 없음) — 트리거 행을 없애는 모든 경로가 행 삭제 전에 `deleteByPrefix('secret://triggers/<id>/')` 로 정리하고, workspace 삭제는 여기에 더해 `workspace_id` 로 명시 DELETE 한다 ([트리거 목록 §4.3](./2-navigation/2-trigger-list.md#43-cascade-동작)) |`

### S7. `spec/conventions/secret-store.md §R4`

`trigger 삭제 시의 명시적 cleanup 책임은 `TriggersService.delete()` 가 진다.`
→
`명시적 cleanup 책임은 **트리거 행을 없애는 모든 경로**가 진다 — 트리거 삭제(`TriggersService.remove()`)뿐 아니라 FK CASCADE 로 트리거를 지우는 워크플로·워크스페이스 삭제도 행 삭제 전에 정리한다. application-level cascade 를 택하면 DB 가 대신 지워 주지 않으므로, 책임을 한 경로에만 적으면 나머지 경로가 조용히 고아를 남긴다(2026-09-17 실측 — 워크플로·워크스페이스 삭제가 정리하지 않고 있었다).`

## 이 draft 가 **안** 하는 것

- **구현** — developer 턴이 별 PR 로 한다(트래커에 등재). 모듈 순환(`WorkflowsModule → TriggersModule →
  SchedulesModule → ExecutionEngineModule → WebsocketModule → WorkflowsModule`)은 구현 설계 문제라
  spec 에 적지 않는다.
- **사후 정리(sweeper)** — 이미 남은 고아 `secret_store` row · provider 등록 · schedule job 을 치우는 일.
  구현 뒤 별도 판단.
- **삭제 감사의 트리거 단위 기록** — D2 로 기각.

## Rationale

### 규칙으로 적는 이유

«트리거 삭제 시 정리한다» 는 문장이 §R4·`1-data-model` 에 있었지만 **경로 하나**만 주어로 삼았고,
그래서 FK CASCADE 로 트리거를 지우는 두 경로가 계약 밖에 있었다. 경로를 하나 더 적어 넣으면 세 번째
경로가 생길 때 같은 일이 반복된다. 주어를 «트리거 행을 없애는 모든 경로» 로 둔다.

### «비활성화» 를 제품 의도가 아니라 오기로 판정한 이유

`trigger.workflow_id` 는 V001 부터 `NOT NULL REFERENCES workflow(id) ON DELETE CASCADE` 다. 워크플로가
없는 트리거는 데이터 모델에서 존재할 수 없으므로 «비활성 상태로 남긴다» 는 구현 가능한 선택지가 아니다.
`spec/1-data-model.md` 가 SoT 이고, 그와 모순되는 목록 화면 문장을 고친다. 프런트엔드에 «비활성화»
문구는 없다(grep 0건).
