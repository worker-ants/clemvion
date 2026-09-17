---
title: 트리거 행을 없애는 모든 경로는 그 트리거의 자원을 정리한다 — 워크플로·워크스페이스 삭제의 정리 계약과 삭제·쓰기 경합
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

# spec draft — 삭제 경로의 트리거 자원 정리 계약

## 배경 — 좁은 항목을 재다가 넓은 결함을 찾았다

트래커 developer 항목 8(«`rewriteTriggerConfigLocked` 반환값을 무시하는 호출부 2곳 — 0행이면 방금
쓴 secret 이 고아가 된다») 을 착수하며 전제를 쟀다. 그 «고아 secret» 이 좁은 경합에서만 생기는지
확인하려고 삭제 경로를 따라가니, **워크플로·워크스페이스 삭제는 트리거의 외부 자원을 하나도 해제하지
않는다.** 항목 8 의 경합은 이 결함의 아주 좁은 한 경우였다. 사용자 결정(2026-09-17)으로 이 결함으로
전환한다.

> **1차 `--spec` 이 BLOCK 했다** (`review/consistency/2026/09/17/16_32_44`, Critical 2). ① 같은 규약
> 문서(`secret-store.md`) 안에서 §R4 한 문장만 고치고 §2.1 표·§6 을 남겨 문서가 자기모순이 됐다.
> ② 새 정리 규칙이 **이미 미뤄 둔 원자성 결함**(삭제와 겹친 쓰기가 비밀을 고아로 남긴다)을 인용도
> 해소도 없이 더 넓은 경로로 늘렸다. 둘 다 맞는 지적이라 이 개정판은 ① 을 S8~S10 으로 닫고, ② 는
> 미루지 않고 **비밀 쪽을 닫는다**(D4~D6). 외부 자원 쪽은 남는 창으로 적는다(D7).

## 실측

### 트리거 행을 지우는 경로는 **넷**이고, 정리하는 것은 하나뿐이다

| 경로 | 구현 | 외부 자원 해제 | `secret_store` 정리 |
|---|---|---|---|
| `DELETE /api/triggers/:id` | `TriggersService.remove()` | schedule job · chat channel teardown · listener registry | `deleteByPrefix` — **행 삭제 전에** |
| `DELETE /api/schedules/:id` | `SchedulesService.remove()` | schedule job | **없음** |
| `DELETE /api/workflows/:id` | `WorkflowsService.remove()` = `findById` → `workflowRepository.remove` → 감사 | **없음** | **없음** |
| `DELETE /api/workspaces/:id` | `WorkspacesService.deleteWorkspace()` = 트랜잭션 안에서 멤버십·워크스페이스 행 `pessimistic_write` → 초대 DELETE → 멤버 DELETE → 워크스페이스 remove | **없음** | **없음** |

- 뒤의 둘은 FK CASCADE 로 트리거를 지운다(`trigger.workflow_id` · `trigger.workspace_id` 모두
  `ON DELETE CASCADE`, V001).
- 스케줄 삭제의 «없음» 도 실결함일 수 있다 — 스케줄 트리거는 chat channel 을 못 갖지만,
  `notification` 설정은 DTO(`create-trigger.dto.ts`)에 **트리거 타입 제한이 없어** 알림 서명 비밀을
  가질 수 있다.
- `deleteByPrefix` 를 부르는 곳은 저장소 전체에 `TriggersService.remove()` **하나**다.
- `secret_store.workspace_id` 를 **조건으로 지우는 코드는 없다** — `secret-store` 모듈에서 이
  컬럼은 쓰기(`store`/`rotate`)와 로그에만 나온다.

### 빠지면 무엇이 남나

| 자원 | 빠지면 |
|---|---|
| schedule BullMQ job scheduler `schedule:<id>` | job 이 계속 발화하고 runner 가 `Schedule <id> not found, skipping` warn 을 cron 주기마다 **영구히** 남긴다(`schedule-runner.service.ts`) |
| chat channel provider 등록(`teardownChatChannel`, best-effort, CCH-AD-03) | Telegram/Discord 에 우리 콜백 등록이 남는다 |
| listener registry | 인메모리 유령 엔트리 |
| `secret_store` 의 `secret://triggers/<id>/` | **암호화된 bot token·서명 secret 이 영구히 남는다** — `secret_store` 에는 FK 가 없다(V063, §R4 의 의도된 설계) |

### 순서와 경합 판정을 떠받치는 세 사실

1. **teardown 이 비밀을 읽는다.** Telegram·Discord adapter 의 `teardownChannel` 은
   `resolveBotToken` 으로 `secret_store` 의 bot token 을 꺼낸다(Telegram 은 못 꺼내면
   `deleteWebhook` 을 건너뛴다). Slack 은 no-op. → **비밀은 외부 해제보다 먼저 지울 수 없다.**
2. **부모 행을 잠그면 그 부모를 참조하는 자식 INSERT 가 막힌다.** 로컬 Postgres 의 스크래치 DB 에서
   두 세션으로 쟀다(`lock_timeout = 1s`):

   | 세션 A (3초 보유) | 세션 B: 같은 부모를 참조하는 자식 INSERT |
   |---|---|
   | 부모 `SELECT` (잠금 없음) — 대조 | 성공 |
   | 부모 `SELECT … FOR UPDATE` | `canceling statement due to lock timeout` — FK 검사의 `SELECT 1 FROM ONLY p x WHERE id = $1 FOR KEY SHARE OF x` 에서 대기 |
   | **다른** 부모 `FOR UPDATE` — 대조 | 성공 |

   → 부모 행을 잠근 뒤 같은 트랜잭션에서 트리거를 열거하면, 열거 뒤 행 삭제 전에 **그 부모 밑에**
   트리거가 새로 생길 수 없다. 워크스페이스 삭제는 이미 워크스페이스 행을 `pessimistic_write` 로 잡는다.
3. **삭제 중인 행을 UPDATE 하면 커밋까지 기다렸다가 0행이 된다.** 같은 방식으로, 세션 A 가 부모를
   `DELETE`(자식 CASCADE)한 채 8초 보유하고 세션 B 가 그 자식을 UPDATE 했다: `updated=0`, 경과 약
   10초. 대조군(A 가 잠금 없이 보유, B 는 다른 자식 UPDATE)은 `updated=1`, 약 4초 — 차이 약 6초가
   A 의 커밋을 기다린 시간이다(두 경과 모두 `docker exec` 기동 지연을 포함한다). 기존 창 1 e2e
   `trigger-update-save-window.e2e-spec.ts` ③ 은 **이미 없는** 행의 UPDATE 가 0행임을 재고, 이 실측은
   **삭제 중인** 행을 잰다 — 둘이 합쳐 `rewriteTriggerConfigLocked` 의 0행 판정이 CASCADE 와 겹친
   재기록을 놓치지 않는다는 근거다.

### 쓰기 경로 — 비밀을 락 **밖에서** 먼저 쓴다

`config` 를 다시 쓰는 경로는 트리거 단위 advisory lock 안에서 재읽기·병합하지만
([트리거 목록 §3](../../spec/2-navigation/2-trigger-list.md#3-api)), `secret_store` 쓰기와 provider 등록은
**락 밖에서, 락 안 재기록보다 먼저** 한다(외부 호출을 락에 넣지 않는다는 같은 절의 제약).
`rewriteTriggerConfigLocked` 는 행 부재에서만 `false` 다 — 락 안 재읽기가 비었거나(`!fresh`), 병합
UPDATE 가 0행에 매치됐을 때. 그 `false` 를 받은 뒤 **이미 쓴 비밀을 되돌리는 호출부는 없다** —
트래커 항목 8(반환값 무시 2곳)·9(`rotateBotToken` 은 404 를 던지지만 새 토큰은 남긴다).

`PATCH` 의 본 저장은 비밀 쓰기보다 **앞선다** — `update()` 안에서 본 저장 트랜잭션이 끝난 뒤에
`normalizeNotificationSecretRef` 와 `setupChatChannel` 이 호출된다. 그래서 본 저장이 CASCADE 로
실패하는 창(§3 의 500)에서는 쓴 비밀이 아직 없다.

### spec 이 이미 서로 어긋나 있다

| 자리 | 문면 | 실제 |
|---|---|---|
| `spec/1-data-model.md` `secret_store.workspace_id` | *"application-level cascade — `TriggersService.delete()` / **workspace 삭제 시 `deleteByPrefix` 로 정리**"* | workspace 삭제는 정리하지 않는다. `delete()` 는 없는 메서드다(`remove()`) |
| `spec/data-flow/12-workspace.md §1.10` | 삭제 = 멤버십·워크스페이스 row 잠금 → 초대 → 멤버 → 워크스페이스 | 위 `1-data-model` 의 약속을 **적지 않는다** — 두 문서가 서로 다른 동작을 말한다 |
| `spec/2-navigation/1-workflow-list.md §2` 삭제 행 | *"연결된 트리거/스케줄도 함께 **비활성화**"* | **삭제**된다. `trigger.workflow_id` 가 `NOT NULL … ON DELETE CASCADE` 라 워크플로 없이 «비활성 트리거» 로 남을 수 없다 |
| `spec/conventions/secret-store.md §R4` | *"trigger 삭제 시의 명시적 cleanup 책임은 `TriggersService.delete()` 가 진다"* | 책임을 **트리거 삭제 한 경로**에만 적었다 — 이 결함의 설계 근원 |
| 같은 문서 §2.1 호출 규약 표 | 시점 칸 *"Trigger 삭제"* 하나 | 트리거 행이 없어지는 경로는 넷이다 |
| 같은 문서 §5.3 예시 | `deleteByPrefix` → `repo.delete` 순 | 아래 D4 가 뒤집는 순서 |
| 같은 문서 §6 둘째 문단 | *"`workspace_id` 컬럼은 workspace 삭제 시 cascade 정리용 (`DELETE FROM secret_store WHERE workspace_id = $1`)"* | 그렇게 지우는 코드가 없다 — 그리고 `1-data-model` 은 같은 일을 `deleteByPrefix` 로 한다고 적어, **정리 방식부터 두 문서가 갈린다** |
| `spec/2-navigation/2-trigger-list.md §4.4` «락 대기 상한 5초» | 락 전에 끝내는 정리에 *"secret 삭제"* 포함 | 현재 구현과는 맞다. D4 가 바꾸는 문장 |

트래커 planner 항목 «없는 메서드 `TriggersService.delete()` 가 세 곳에 있다» 의 planner 몫 둘
(`1-data-model.md` · `secret-store.md §R4`)이 이 draft 의 편집 자리와 겹쳐 함께 닫는다(세 번째인
`V063` 마이그레이션 주석은 Flyway 체크섬 때문에 고치지 않는 것으로 이미 처분돼 있다).

## 결정

### D1. 규칙 — 트리거 행을 없애는 **모든** 경로는 그 트리거들의 자원을 정리한다

정리 집합은 위 표의 넷(schedule job · chat channel provider 등록 · listener registry ·
`secret_store` prefix)이다. 경로를 목록으로 적지 않고 **규칙**으로 적는다 — 다음에 트리거 행을 지우는
경로가 생겨도 같은 규칙이 문다. 오늘 기준 경로는 트리거·스케줄·워크플로·워크스페이스 삭제 넷이다.

### D2. 행 삭제는 기존대로 FK CASCADE 에 맡긴다 — 트리거마다 «트리거 삭제» 를 부르지 않는다

**기각한 대안**: 워크플로·워크스페이스 삭제가 트리거마다 `DELETE /api/triggers/:id` 경로를 그대로
부른다. ① 트리거마다 `trigger.deleted` 감사가 **새로** 생긴다 — 지금은 `workflow.deleted` 하나만
남는다(동작 변화). ② 트리거 N 개가 N 개의 트랜잭션이 되어 워크플로 삭제의 DB 원자성이 깨진다.
**정리만 공유하고 행은 한 번의 CASCADE** 로 지운다.

### D3. 외부 자원은 DB 트랜잭션 **밖에서, 행 삭제 전에** 해제한다

`TriggersService.remove()` 와 같은 순서다. provider teardown 을 트랜잭션·락 안에 두면 락 보유 중 HTTP
요청이 끼어든다 — Cafe24 토큰 갱신이 advisory lock 을 기각한 사유와 같다
(`spec/2-navigation/4-integration.md`, 트리거 목록 §3 이 이미 인용). 워크스페이스 삭제는 비관적 락
트랜잭션 **전에** 해제한다. teardown 은 기존대로 best-effort 다(실패해도 삭제는 진행).

### D4. `secret_store` 비밀은 행 삭제가 **커밋된 뒤에** 지운다 — 트리거 삭제도 순서를 뒤집는다

네 경로 모두 같다. 근거는 셋이다.

1. **외부 해제보다 먼저 지울 수 없다** — teardown 이 비밀을 읽는다(실측 1).
2. **삭제와 겹친 쓰기를 D5 의 보상과 함께 결정적으로 닫는다** — 아래 D5 의 인터리빙 표. 행 삭제 **전에**
   지우면, 정리와 행 삭제 사이에 커밋된 쓰기(락 안 재기록이 `true`)가 남긴 비밀을 아무도 지우지 않는다.
3. **삭제가 도중에 실패할 때 덜 망가진다** — 지금은 락 대기 5초를 넘기면 «비밀까지 지워졌는데 행은
   남은» 트리거가 남는다(그 트리거의 비밀 `resolve` 는 미존재로 throw 한다 — `secret-store.md §2`).
   뒤집으면 실패 시 비밀과 행이 함께 남는다.

**같은 트랜잭션 안에서 지우지 않는 이유**: `SecretResolver` 는 PostgreSQL 에 결합하지 않고 백엔드를
규약 변경 없이 바꿀 수 있게 정의돼 있다(`secret-store.md §3.4`). 트리거 행 트랜잭션에 비밀 삭제를
묶으면 그 전제가 깨진다. 대가는 **커밋과 정리 사이에 프로세스가 죽으면 비밀이 남는 것**이다(D7 창 3).

**철회한 1차안 — 워크스페이스 삭제는 `secret_store` 를 `workspace_id` 로 트랜잭션 안에서 명시 DELETE.**
1차 `--spec` 대상이었다. 같은 §3.4 에 걸리고(인터페이스에 워크스페이스 단위 삭제가 없어 SQL 을 직접
쓰게 된다), D6 이 열거를 경합 없이 만들므로 트리거 단위 prefix 로 충분하다. `1-data-model` 이 이미
`deleteByPrefix` 를 말하고 있어 그쪽에 맞춘다.

### D5. 쓰기 경로의 보상 — 락 안 재기록이 행 부재로 끝나면, 락 밖에서 만든 것을 되돌린다

락 밖에서 `secret_store` 에 비밀을 쓰거나 provider 에 등록한 뒤 락 안 재기록이 **행 부재로 쓰지
못한**(`false` — 재읽기 부재 또는 0행) 요청은, provider 등록을 teardown 한 뒤(best-effort) 그 트리거의
비밀을 `deleteByPrefix('secret://triggers/<id>/')` 로 지운다. 행이 없으므로 prefix 전체를 지워도
안전하다(트리거 id 는 UUID 라 재사용되지 않는다). 트래커 항목 8·9 가 이 규칙의 구현 자리다.

**미뤄 둔 항목과의 관계** — `plan/complete/trigger-config-lost-update.md` 의 5라운드 W1 이자
«후속(developer 범위)» 표의 *"secret store 쓰기·provider 등록의 원자성"* 은 *"정리 순서를 바꾸려면
«외부 호출을 락 안에 두지 않는다» 제약과 정면으로 부딪히므로 별도 설계 검토"* 로 미뤄졌다. **비밀 쪽
절반은 그 전제가 성립하지 않는다** — D4+D5 는 락에 아무것도 넣지 않는다. 순서(정리를 행 삭제 뒤로)와
보상(쓰기 쪽이 부재를 보면 되돌림)만으로 닫힌다. **provider 등록 쪽 절반은 여전히 미룬다**(D7 창 2).

**비밀 쪽이 닫힌다는 인터리빙 논증.** 삭제 D 는 `T`(행 삭제 커밋) → `S`(비밀 정리), 쓰기 W 는
`A`(비밀 쓰기 커밋) → `R`(락 안 재기록) → `false` 면 `C`(보상 삭제). `S` 는 `T` 뒤, `R` 은 `A` 뒤다.

| `A` 와 `S` | `R` | 비밀을 지우는 쪽 |
|---|---|---|
| `A` 가 `S` 의 삭제 문보다 먼저 커밋 | 무엇이든 | `S` |
| `A` 가 `S` 뒤에 커밋 | `A` > `S` > `T` 이고 `R` > `A` 이므로 `R` 은 `T` 뒤 — 행이 없다 → `false` | `C` |
| `A` 가 이미 있는 행을 UPDATE(`rotate`)하는데 `S` 가 그 행을 지우는 중 | UPDATE 는 `S` 커밋까지 기다렸다가 0행 — **쓰인 비밀이 없다** | (지울 것 없음) |

`R` 이 `false` 를 돌려주는 조건도 경로마다 성립한다. 락을 잡는 두 삭제 경로(트리거·스케줄)는 `R` 이
락을 기다렸다가 `T` 뒤에 재읽기해 부재를 본다. 락을 못 잡는 CASCADE 경로는 재읽기가 `T` 전이어도 병합
UPDATE 가 삭제 중인 행에서 기다렸다가 0행이 된다(실측 3) — `rewriteTriggerConfigLocked` 의 `affected`
판정이 이미 이 창을 위해 있다. 표 셋째 행의 `rotate` UPDATE 도 같은 실측에 기댄다.

### D6. 부모 삭제 경로는 비밀을 지울 트리거를 **부모 행을 잠근 뒤 같은 트랜잭션에서** 열거한다

워크플로·워크스페이스 삭제는 행 삭제 트랜잭션 안에서 부모 행(`workflow` / `workspace`)을 먼저 잠그고,
그 뒤 트리거 id 를 열거해 커밋 뒤 `S` 에 넘긴다. 잠금 뒤엔 그 부모를 참조하는 트리거 INSERT 가 FK
검사에서 막히므로(실측 2) **열거에서 빠지는 트리거가 없다**. 막힌 INSERT 는 커밋 뒤 FK 위반으로
실패하고, 트리거 생성은 행 INSERT 가 비밀 쓰기보다 먼저라 비밀도 생기지 않는다.

워크스페이스 삭제는 이미 워크스페이스 행을 `pessimistic_write` 로 잠그므로 그 뒤에 열거만 더한다.
워크플로 삭제는 지금 명시 트랜잭션도 행 잠금도 없으므로 둘 다 새로 둔다.

### D7. 남는 창 — 적어 둔다

| # | 창 | 남는 것 | 처분 |
|---|---|---|---|
| 1 | 외부 해제를 위한 열거(트랜잭션 **전**) 뒤, 부모 잠금 전에 생긴 트리거 | 그 트리거의 schedule job · provider 등록 · listener registry. **비밀은 D6 이 덮는다** | 발생 조건(부모 삭제와 트리거 생성이 동시)이 좁다. 계약 범위 밖 |
| 2 | 삭제 쪽 외부 해제 **뒤**, 행 삭제 **전에** 커밋된 동시 요청(provider 재등록 · schedule 재활성화) | 그 요청이 만든 provider 등록 · schedule job — `R` 이 `true` 라 D5 의 보상이 돌지 않는다 | **미룬다** — 위 5라운드 W1 의 provider 절반. 닫으려면 외부 해제도 행 삭제 **뒤로** 옮기고, 삭제 트랜잭션이 트리거 행을 `FOR UPDATE` 로 다시 읽어 최신 설정으로 teardown 해야 한다. 그러면 teardown 실패 시 «행은 없는데 provider 등록이 남는» 쪽으로 실패 방식이 바뀌고, §4.4 의 «정리 먼저, 락 나중» 순서도 다시 정해야 한다 — 별도 설계 검토 |
| 3 | 행 삭제 커밋과 비밀 정리 사이의 프로세스 종료 | 그 트리거들의 비밀 | D4 의 대가. 사후 정리(sweeper)의 대상 — 아래 «안 하는 것» |

## 변경안

### S1. `spec/2-navigation/1-workflow-list.md` — 목록 액션 표의 «삭제» 행 + frontmatter

`| 삭제 | 확인 다이얼로그 후 삭제. 연결된 트리거/스케줄도 함께 비활성화 |`
→
`| 삭제 | 확인 다이얼로그 후 삭제. 연결된 트리거는 **함께 삭제**된다(FK CASCADE — schedule 트리거면 스케줄까지). 트리거가 쓰던 외부 등록과 비밀도 정리한다 — [트리거 목록 §4.3](./2-trigger-list.md#43-cascade-동작) |`

frontmatter `pending_plans:` 에 `plan/in-progress/spec-draft-nullable-notation-followups.md` 추가(이
문서는 이미 `partial`).

### S2. `spec/2-navigation/2-trigger-list.md §4.3` — 표 **다음에** 문단 추가

> **트리거 행을 없애는 모든 경로는 그 트리거의 자원을 정리한다** (2026-09-17 결정, 구현은 frontmatter
> `pending_plans` 에서 추적 — 그 전까지는 트리거 화면 삭제만 정리하고, 비밀을 행 삭제 **전에** 지운다).
> 경로는 트리거 화면 삭제([§4.4](#44-결과에러)) · 스케줄 화면 삭제 · 위 상류 행의 워크플로·워크스페이스
> 삭제다. 자원은 둘로 갈리고 시점이 다르다:
>
> | 자원 | 시점 | 이유 |
> |---|---|---|
> | 외부 — schedule BullMQ job · chat channel provider 등록(teardown, best-effort) · listener registry | 행 삭제 **전**, DB 트랜잭션 **밖** | teardown 이 `secret_store` 의 bot token 을 읽는다(Telegram·Discord). 외부 호출은 락 안에 두지 않는다([§3](#3-api)) |
> | `secret_store` 의 `secret://triggers/<id>/` 비밀 | 행 삭제가 **커밋된 뒤** | 삭제와 겹친 쓰기가 비밀을 고아로 남기지 않게 — [§3](#3-api) 의 «쓰지 못했으면 되돌린다» 와 짝 |
>
> 워크플로·워크스페이스 삭제는 비밀을 지울 트리거를 **부모 행을 잠근 뒤 같은 트랜잭션에서** 열거한다 —
> 잠금 뒤엔 그 부모를 참조하는 트리거 INSERT 가 FK 검사에서 막혀 열거에서 빠지는 트리거가 없다.
> 남는 창은 외부 자원 쪽이다: 외부 해제용 열거 뒤에 생긴 트리거, 그리고 해제 뒤·행 삭제 전에 동시 요청이
> 다시 만든 provider 등록·schedule job 은 남을 수 있다. 행 삭제 커밋과 비밀 정리 사이에 프로세스가 죽으면
> 비밀이 남는다.

### S3. `spec/2-navigation/2-trigger-list.md §4.4` — «락 대기 상한 5초» 불릿

`… 되돌릴 수 없는 정리를 끝낸다(트리거 화면 삭제는 schedule 타입이면 BullMQ job 해제 → chat channel teardown → secret 삭제, 스케줄 화면 삭제는 BullMQ job 해제). 그래서 … 그 트리거가 «정리는 끝났는데 행은 남은» 상태라는 사실을 서버 로그에 남긴다.`
→
`… 되돌릴 수 없는 **외부 자원 해제**를 끝낸다(트리거 화면 삭제는 schedule 타입이면 BullMQ job 해제 → chat channel teardown, 스케줄 화면 삭제는 BullMQ job 해제 — [§4.3](#43-cascade-동작)). 그래서 … 그 트리거가 «외부 등록은 해제됐는데 행은 남은» 상태라는 사실을 서버 로그에 남긴다. 비밀은 행 삭제가 커밋된 **뒤에** 지우므로 이때는 지워지지 않는다.`

### S4. `spec/2-navigation/2-trigger-list.md §3` — «동시 쓰기 직렬화» 의 «락으로 막을 수 없는 삭제 경로» 불릿 **다음에** 불릿 추가

`> - **쓰지 못했으면 락 밖에서 만든 것을 되돌린다** — 락 밖에서 \`secret_store\` 에 비밀을 쓰거나 provider 에 등록한 뒤 위 판정으로 **쓰지 못한** 요청은, provider 등록을 teardown 한 뒤(best-effort) 그 트리거의 비밀(\`secret://triggers/<id>/\`)을 지운다. 삭제 쪽이 비밀을 행 삭제 **뒤에** 지우는 것([§4.3](#43-cascade-동작))과 짝을 이뤄, 삭제와 겹친 쓰기가 비밀을 고아로 남기지 않는다.`

### S5. `spec/data-flow/10-triggers.md §1.4` — schedule 동기화 표에 행 추가

`| Workflow·Workspace 삭제 (FK CASCADE) — **미구현 (Planned)** | FK CASCADE 로 trigger → schedule row 동반 삭제 | 삭제 **전에** schedule 타입 트리거마다 \`removeJob(schedule.id)\` — 트리거 직접 삭제와 같은 해제 ([트리거 목록 §4.3](../2-navigation/2-trigger-list.md#43-cascade-동작)) |`

### S6. `spec/data-flow/11-workflow.md §3.1` — FK 파급 표의 `trigger` 행 끝에 덧붙임

`트리거가 쓰던 외부 등록·비밀의 정리는 이 CASCADE 앞뒤로 앱이 한다 — **미구현 (Planned)**, [트리거 목록 §4.3](../2-navigation/2-trigger-list.md#43-cascade-동작).`

### S7. `spec/data-flow/12-workspace.md` — §1.10 삭제 행 + §2.1 매핑 표

**§1.10 `DELETE /api/workspaces/:id` 행** — 현재 문면 끝에 덧붙인다:

`**트리거 자원 정리 — 미구현 (Planned)**: 워크스페이스의 트리거는 FK CASCADE 로 함께 지워지므로, 트랜잭션 **전에** 외부 자원(schedule job · chat channel teardown · listener registry)을 해제하고, 워크스페이스 row 를 잠근 **뒤** 같은 트랜잭션에서 트리거를 열거해 커밋 **뒤** 그 트리거들의 \`secret_store\` 비밀을 지운다 ([트리거 목록 §4.3](../2-navigation/2-trigger-list.md#43-cascade-동작)).`

**§2.1 Postgres 매핑 표** — `workspace` 삭제 행 짝으로 추가:

`| \`secret_store\` | 워크스페이스 삭제 (§1.10) — **미구현 (Planned)** | 트랜잭션 **커밋 뒤**, 트랜잭션 안에서 열거한 트리거마다 DELETE \`ref LIKE 'secret://triggers/<id>/%'\` (\`deleteByPrefix\`) | FK 없음 (V063) — \`workspace_id\` 를 조건으로 지우지 않는다 |`

### S8. `spec/1-data-model.md` — `secret_store.workspace_id` 행

`| workspace_id | UUID | application-level cascade — \`TriggersService.delete()\` / workspace 삭제 시 \`deleteByPrefix\` 로 정리 |`
→
`| workspace_id | UUID | 귀속 워크스페이스. **FK 없음**(application-level cascade — [secret-store §R4](./conventions/secret-store.md#r4-trigger-fk-미설정)). 이 컬럼을 조건으로 지우는 경로는 없고, 정리는 트리거 단위 prefix(\`deleteByPrefix\`)로 한다 — 어느 경로가 언제 지우는지는 [트리거 목록 §4.3](./2-navigation/2-trigger-list.md#43-cascade-동작) |`

이 행은 **현재 사실만** 말하고 계약은 §4.3 을 가리킨다 — 그래서 `1-data-model.md` 는 `implemented`
를 유지한다(미구현 약속을 이 문서에 두지 않는다).

### S9. `spec/conventions/secret-store.md §R4`

`trigger 삭제 시의 명시적 cleanup 책임은 \`TriggersService.delete()\` 가 진다.`
→
`명시적 cleanup 책임은 **트리거 행을 없애는 모든 경로**가 진다 — 트리거 삭제(\`TriggersService.remove()\`)뿐 아니라 스케줄 삭제, FK CASCADE 로 트리거를 지우는 워크플로·워크스페이스 삭제도 정리한다. application-level cascade 를 택하면 DB 가 대신 지워 주지 않으므로, 책임을 한 경로에만 적으면 나머지 경로가 조용히 고아를 남긴다(2026-09-17 실측 — 네 경로 중 한 곳만 정리하고 있었다). 정리 시점(행 삭제 커밋 뒤)과 쓰기 경로의 보상은 §2.1.`

### S10. `spec/conventions/secret-store.md` — §2.1 표 · §5.3 예시 · §6 · frontmatter

**§2.1 호출 규약 표** — «Trigger 삭제» 행을 고치고, 바로 아래에 보상 행을 더한다:

`| 트리거 행이 없어질 때 (트리거·스케줄·워크플로·워크스페이스 삭제) | 해당 trigger 의 모든 ref 를 \`deleteByPrefix('secret://triggers/{id}/')\` 로 일괄 삭제 — **행 삭제가 커밋된 뒤에** 한다(provider teardown 이 이 비밀을 읽으므로 그보다 먼저 지울 수 없고, 행 삭제 전에 지우면 그 사이 커밋된 쓰기가 남긴 비밀을 아무도 지우지 않는다). cascade 차원 — DB FK 가 없으므로 application 책임. 개별 \`delete()\` 보다 prefix 패턴 권장. **prefix 불변식 2건**: (기존 문면 유지) |`
`| 락 밖에서 비밀을 쓴 뒤 트리거 락 안 재기록이 행 부재로 실패 | \`deleteByPrefix('secret://triggers/{id}/')\` 로 **되돌린다** — 위 행과 짝이다. 행이 없으므로 prefix 전체가 안전하다 ([트리거 목록 §3](../2-navigation/2-trigger-list.md#3-api)) |`

**§5.3 예시** — 순서를 뒤집는다:

```typescript
async removeTrigger(triggerId: string) {
  // 외부 provider teardown 은 이보다 앞에서 끝낸다 — teardown 이 비밀을 읽는다.
  await this.repo.delete(triggerId);
  // 행 삭제가 커밋된 뒤에 지운다. 그 사이 끼어든 쓰기는 락 안 재기록에서 행 부재를 보고 스스로
  // 되돌린다(§2.1). 개별 ref delete 보다 prefix 패턴 권장 — 추가 secret 도 자동 정리.
  await this.secrets.deleteByPrefix(`secret://triggers/${triggerId}/`);
}
```

**§6** — 제목 *"Trigger 삭제 시 cascade"* 를 *"트리거 행이 없어질 때 cascade"* 로 바꾼다(이 제목의
앵커를 인용하는 자리는 `spec/`·`codebase/`·`plan/` 전체에 0건 — 실측). 첫 문단의 *"Trigger 삭제 시
application 이 … `TriggersService.remove()` 가 … 일괄 삭제하는
의무"* 를 *"트리거 행이 없어지는 **모든 경로**(트리거·스케줄·워크플로·워크스페이스 삭제)가 행 삭제
커밋 뒤 `deleteByPrefix('secret://triggers/{id}/')` 로 일괄 삭제하는 의무 (§2.1 / §5.3 / §R4)"* 로
넓힌다. 둘째 문단 *"`workspace_id` 컬럼은 workspace 삭제 시 cascade 정리용 (`DELETE FROM secret_store
WHERE workspace_id = $1`)"* 은 다음으로 교체한다:

`\`workspace_id\` 는 귀속 워크스페이스를 기록한다(로그의 SS-SE-05 식별자이기도 하다). **이 컬럼을 조건으로 지우는 경로는 두지 않는다** — 워크스페이스 삭제도 트리거 단위 prefix 로 정리한다. 인터페이스(§2)에 워크스페이스 단위 삭제가 없고, 백엔드 교체가 규약 변경 없이 가능해야 하기 때문이다(§3.4). 워크스페이스 삭제가 정리 대상 트리거를 빠짐없이 모으는 방법은 [트리거 목록 §4.3](../2-navigation/2-trigger-list.md#43-cascade-동작). (2026-09-17 정정 — 그 전까지 이 문단은 SQL 한 줄로 이미 정리되는 것처럼 적었지만 그렇게 지우는 코드는 없었다.)`

**frontmatter** — `status: implemented` → `partial`, `pending_plans:` 에
`plan/in-progress/spec-draft-nullable-notation-followups.md`.

## 비대상 — 보고 고치지 않는 자리

| 자리 | 판정 |
|---|---|
| `spec/5-system/15-chat-channel.md` CCH-AD-03 *"Trigger disable / 삭제 시 … `teardownChannel()` 자동 호출"* | CASCADE 로 없어지는 것도 **트리거 삭제**다 — 문면이 새 계약보다 좁지 않다. 경로를 요구사항 문장에 열거하면 오히려 목록이 된다 |
| `secret-store.md §R4` 제목 «Trigger FK 미설정» | FK 를 두지 않았다는 사실 그대로라 참이다. 범위는 본문(S9)이 넓힌다 |
| Rationale 번호 접두 표기(`R4` vs `R-4`) | 문서마다 다르지만 늘 경로와 함께 인용돼 충돌이 없다 |
| `V063__secret_store.sql` 주석의 `TriggersService.delete()` | Flyway 체크섬 — 트래커에 이미 처분 |

## 트래커 반영 (같은 PR)

| # | 자리 | 반영 |
|---|---|---|
| T1 | `spec-draft-nullable-notation-followups.md` developer 항목(트리거 락 후속) 표의 **8·9** | «→ 이 draft D5 로 흡수 — 구현은 T2» 로 전환 표기 |
| T2 | 같은 트래커에 **developer 항목 신설** | D1·D3~D6 구현: 네 삭제 경로 · `TriggersService.remove()` 순서 반전(+ 실패 로그 문구) · 쓰기 경로 보상(호출부는 `rewriteTriggerConfigLocked` 호출부와 락 밖 비밀 쓰기로 **전수** 열거) · 모듈 순환(`WorkflowsModule → TriggersModule → SchedulesModule → ExecutionEngineModule → WebsocketModule → WorkflowsModule`) · e2e(워크플로 삭제 후 비밀 0행 · 재진입으로 끊은 동시 회전의 보상) |
| T3 | 같은 트래커 planner 항목 «없는 메서드 `TriggersService.delete()` 가 세 곳» | 1·2 를 S8·S9 로 닫고, 3 은 기존 무조치 처분 → 항목 종결 |

## 이 draft 가 **안** 하는 것

- **구현** — developer 턴이 별 PR 로 한다(T2). 모듈 순환은 구현 설계 문제라 spec 에 적지 않는다.
- **사후 정리(sweeper)** — 이미 남은 고아 `secret_store` row · provider 등록 · schedule job, 그리고 D7
  창 3 이 남기는 비밀을 치우는 일. 구현 뒤 별도 판단.
- **D7 창 2(provider 등록 절반)** — 외부 해제를 행 삭제 뒤로 옮기는 설계. 별도 설계 검토.
- **삭제 감사의 트리거 단위 기록** — D2 로 기각.

## Rationale

### 규칙으로 적는 이유

«트리거 삭제 시 정리한다» 는 문장이 §R4·`1-data-model` 에 있었지만 **경로 하나**만 주어로 삼았고,
그래서 트리거 행을 지우는 나머지 세 경로가 계약 밖에 있었다. 경로를 하나 더 적어 넣으면 다음 경로가
생길 때 같은 일이 반복된다. 주어를 «트리거 행을 없애는 모든 경로» 로 둔다.

**1차안은 같은 병을 문서 단위로 앓았다** — 경로는 규칙으로 넓혔는데, 그 규칙을 적은 규약 문서 안에서는
§R4 한 자리만 고치고 §2.1·§5.3·§6 을 남겼다. 이 개정판은 `secret-store.md` 안에서 «트리거 삭제» 를
주어로 삼은 자리를 전수(§2.1 표 · §5.3 예시 · §6 두 문단 · §R4)로 고친다.

### 미루지 않고 비밀 쪽을 닫은 이유

미뤄 둔 원자성 항목의 보류 사유는 «정리 순서를 바꾸려면 외부 호출을 락에 넣어야 한다» 였다. 비밀에
대해서는 락이 필요 없다 — 삭제 쪽은 **정리를 행 삭제 뒤로**, 쓰기 쪽은 **행 부재를 보면 되돌림** 으로
모든 인터리빙이 닫힌다(D5 표). 이 draft 가 정리 경로를 넷으로 넓히는 만큼 경합 표면도 넓어지므로,
같은 PR 계열에서 닫는 편이 규칙을 넓히고 구멍을 함께 넓히는 것보다 낫다.

provider 등록 쪽은 같은 방법이 통하지 않는다 — teardown 이 **최신 설정**을 봐야 하는데 삭제 쪽이 그것을
보장하려면 행 잠금 아래 재읽기와 teardown 시점 이동이 함께 필요하고, 실패 방식이 사용자에게 보이게
바뀐다. 그래서 창 2 로 적고 미룬다.

### «비활성화» 를 제품 의도가 아니라 오기로 판정한 이유

`trigger.workflow_id` 는 V001 부터 `NOT NULL REFERENCES workflow(id) ON DELETE CASCADE` 다. 워크플로가
없는 트리거는 데이터 모델에서 존재할 수 없으므로 «비활성 상태로 남긴다» 는 구현 가능한 선택지가 아니다.
`spec/1-data-model.md` 가 SoT 이고, 그와 모순되는 목록 화면 문장을 고친다. 프런트엔드에 «비활성화»
문구는 없다(grep 0건).

### 1차 `--spec` WARNING 처분

| # | 지적 | 처분 |
|---|---|---|
| W1 | developer 구현 트래커 미등재 · `status: implemented` 문서에 `pending_plans` 없음 | T2 신설. 미구현 약속을 담게 되는 `secret-store.md` 는 `partial` + `pending_plans`(S10). `1-data-model.md` 는 현재 사실만 적고 계약을 §4.3 에 위임해 `implemented` 유지(S8). data-flow 문서는 frontmatter 가 없어 문중 **미구현 (Planned)** 표기(해당 디렉토리 관례) |
| W2 | 착수 계기였던 트래커 항목 8 과 교차 참조 없음 | T1 |
| W3 | `12-workspace.md §2.1` 매핑 표에 `secret_store` 행 없음 | S7 |
| W4 | S2 제목이 «표 셀에 덧붙임» 인데 내용은 blockquote | S2 제목을 «표 다음에 문단 추가» 로 |
