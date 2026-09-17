---
title: 트리거 행을 없애는 네 경로가 그 트리거의 자원을 정리한다 — 구현 (트래커 DRT-2)
status: in-progress
owner: developer
worktree: trigger-deletion-release-12e987
started: 2026-09-17
spec_impact: none
---

# 트리거 삭제 자원 정리 — 구현

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«트리거 행을 없애는 모든 경로의 자원 정리를 구현한다»(DRT-2, 항목 8·9 흡수)를 닫는다.
계약 SoT 는 `spec/2-navigation/2-trigger-list.md` §3(«쓰지 못했으면 되돌린다»)·§4.3(표 다음
문단)·§4.4, `spec/conventions/secret-store.md` §2.1·§5.3·§6. 결정 근거는
`plan/complete/spec-draft-deletion-releases-trigger-resources.md` D1·D3~D6. **spec 은 고치지
않는다**(`spec_impact: none`) — 구현이 spec 에 맞춰진다.

## 착수 전 실측

### 트리거 행을 지우는 경로 — 코드에서 넷으로 확정

`workflow`·`workspace`·`"user"` 행을 지우는 코드를 전수 grep 했다. `workspace.owner_id` 는
`"user"` 에 `ON DELETE CASCADE` 라 사용자 삭제도 트리거까지 번지지만 **사용자 행을 지우는 코드가
없다**(0건). 그래서 경로는 draft 대로 넷이다: `TriggersService.remove` · `SchedulesService.remove`
· `WorkflowsService.remove` · `WorkspacesService.deleteWorkspace`.

### 쓰기 경로 — 락 밖 비밀 쓰기 뒤 락 안 재기록, 다섯 자리

`rewriteTriggerConfigLocked` 호출부 6곳 × 락 밖 `secrets.rotate` 호출부 8곳을 짝지었다.

| # | 자리 | 락 밖에서 만드는 것 | 지금 `false` 처리 |
|---|---|---|---|
| RP-1 | `TriggersService.normalizeNotificationSecretRef`(create/update) | `notification-signing` | **무시**(트래커 8) |
| RP-2 | `TriggersService.rotateBotToken` | `bot-token.v2` · `bot-token` · provider 등록 · `inbound-signing` | 404 만, 되돌림 없음(트래커 9) |
| RP-3 | `TriggersService.promoteRotatedNotificationSecrets`(cron) | `notification-signing` | 세지 않음, 되돌림 없음 |
| RP-4 | `ChatChannelBinderService.setupChatChannel` 성공 경로 | `bot-token` · provider signing · provider 등록 · issued signing | listener 등록만 건너뜀 |
| RP-5 | 같은 함수 degraded fallback | `bot-token` · provider signing · (부분) provider 등록 | **무시**(트래커 8) |

`revokePerTriggerToken` 도 락 안 재기록을 하지만 **비밀을 쓰지 않는다**(토큰은 `config` 안) —
대상 아님.

### 모듈 위치 — 순환이 어디에나 있다

`WorkflowsModule → TriggersModule` 은 `TriggersModule → SchedulesModule → ExecutionEngineModule →
WebsocketModule → WorkflowsModule` 과, `WorkflowsModule → ChatChannelModule` 은
`ChatChannelModule → WebsocketModule → WorkflowsModule` 과 순환한다. 트래커가 인용한 `#676` 은
`forwardRef` 순환을 일부러 없앤 선례이므로 새 `forwardRef` 로 때우지 않는다.

→ 정리 협력자는 **`triggers/` 안에 두고**, 워크플로·워크스페이스 서비스는 모듈 import 없이
`ModuleRef.get(TOKEN, { strict: false })` 로 **지연 해석**한다. 저장소 선례 둘
(`NotificationsService.getWebsocket` · `ExecutionEngineService.getNotificationsService`)과 같은
방법이되 **하나가 다르다: 못 찾으면 no-op 이 아니라 던진다.** 알림은 빠져도 되지만 여기서 조용히
넘어가면 이 결함이 그대로 재발한다. 토큰은 가벼운 파일에 두어 워크플로·워크스페이스 서비스가
협력자 클래스(→ schedule runner → execution engine …)를 **파일 수준에서 import 하지 않게** 한다.

### e2e 입력 — 비밀 행은 SQL 로 심는다

공개 API 로 비밀을 만드는 경로는 chat channel 뿐이고 e2e 에서 telegram setup 은 호출당 최악 ~18초다.
`notification.signing.secret` 은 DTO 에 없어 400 이다. 정리는 복호화하지 않고 `ref LIKE` 로
지우므로, 트리거는 API 로 만들고 `secret_store` 행은 `secret-store-like-prefix.e2e-spec.ts` 처럼
**SQL INSERT** 로 심는다. schedule job 은 e2e 에서 BullMQ `Queue.getJobScheduler('schedule:<id>')`
로 본다(bullmq 5.81, 기본 prefix `bull`).

## 설계

- **`trigger-resource-release.ts`** (순수 함수) — 순서·실패 정책의 단일 구현.
  - `triggerSecretPrefix(id)`
  - `deleteTriggerSecretsAfterCommit(secrets, logger, ids, caller)` — 행 삭제 커밋 뒤. **던지지 않고**
    실패를 error 로그로 남긴다(삭제는 이미 커밋됐다 — 500 을 주면 재시도가 404 가 된다). **감사 행은 남기지
    않는다** — 커밋 뒤라 `workspace_id` FK 가 이미 없을 수 있다(트래커 DRT-2 부수 주의). prefix 는 UUID 인
    트리거 id 로만 조립한다(LIKE 메타문자 거부 불변식의 전제).
  - `undoAbsentTriggerWrite({ teardown?, secrets, logger }, id, caller)` — teardown(best-effort)
    **뒤에** 비밀 삭제. 던지지 않는다.
- **`TriggerResourceReleaserService`** (`triggers/trigger-resource-releaser.service.ts`, injectable — 같은 디렉토리 provider 4개의 `*Service` 접미를 따른다) — 외부 해제(schedule job · teardown ·
  listener registry) · 부모 잠금 뒤 열거 · 커밋 뒤 비밀 정리 · 쓰기 보상.
- **네 삭제 경로**
  - 트리거: 외부 해제 → 락·행 삭제 → **커밋 뒤 비밀**(순서 반전) → 감사. 실패 로그 문구 수정.
  - 스케줄: 기존 흐름 + 커밋 뒤 비밀(`SchedulesModule` 이 `SecretStoreModule` 을 import — 순환 없음).
  - 워크플로: 외부 해제 → 트랜잭션(`workflow` 행 `pessimistic_write` → 트리거 열거 → 삭제) → 커밋 뒤 비밀.
  - 워크스페이스: **트랜잭션 밖에서 권한 검사를 먼저** → 외부 해제 → 기존 트랜잭션(잠금 뒤 재검사 +
    열거) → 커밋 뒤 비밀. 검사를 앞세우지 않으면 403 이 날 요청이 provider 등록부터 뜯는다.
- **쓰기 보상** RP-1~RP-5 — `false` 에서만. 예외(행은 있는데 실패)는 대상이 아니다.

## 뮤턴트 — 보증마다 하나, 예측을 먼저 적었다

전부 **예측 RED · 실측 RED**, 그리고 전부 **단언 실패**다(컴파일 실패로 인한 거짓 RED 0). 원복은 파일
사본(cp) — 끝난 뒤 작업 트리 상태로 `codebase/` 무변경을 확인했다.

| # | 뮤턴트 | 잡은 테스트 |
|---|---|---|
| M1 | 트리거 삭제 — 비밀을 행 삭제 **전에** | 순서 테스트 · «행 삭제 실패면 비밀 유지» |
| M1b | 트리거 삭제 — 커밋 뒤 비밀 삭제 제거 | prefix 호출 · 순서 테스트 |
| M2~M4 | RP-1·RP-2·RP-3 보상 호출 제거 | 각 자리의 보상 테스트 1건씩 |
| M5·M6 | RP-4·RP-5(binder 성공·degraded) 보상 제거 | 각 1건 |
| M7 | 워크스페이스 선검사 제거 | 순서 · 403 · personal (3건) |
| M8 | 워크플로 — 열거를 트랜잭션 밖으로 | 순서 테스트 |
| M9 | releaser — 잠금 **전에** 열거 | 워크플로·워크스페이스 잠금 순서 (2건) |
| M10 | 보상 — teardown 을 비밀 **뒤로** | teardown 순서 · teardown 실패 시 (2건) |
| M11 | 커밋 뒤 정리 — 실패를 던짐 | 던지지 않음 2건 |
| M12 | releaser — listener `unregister`(R8) 제거 | 외부 해제 배선 |
| M13 | 워크플로 — 해석 실패를 no-op 으로 삼킴 | «못 찾으면 던진다» |
| M14 | 스케줄 삭제 — 비밀 정리 제거 | 스케줄 삭제 순서 |
| M15 | 워크스페이스 — 해석 실패를 no-op 으로 삼킴 | «못 찾으면 던진다» (M13 의 대칭 빈틈을 채운 뒤 추가) |

## 내가 틀린 측정 — `getJobScheduler` 는 해제 뒤에도 undefined 가 아니다

첫 e2e 는 schedule job 해제를 `Queue.getJobScheduler('schedule:<id>')` 의 `undefined` 로 판정했다.
수정 뒤에도 그 두 케이스만 RED 였고, 받은 값은 삭제 **전**(`pattern`·`iterationCount` 있음)과 모양이
달랐다(`pattern: null`·`next: null`). bullmq 5 `transformSchedulerData` 는 해시가 비어도 **id 에 `:`
가 있으면** 레거시 `keyToData` 로 껍데기를 돌려준다 — 우리 id 가 정확히 그 형태다.

그래서 이 API 로 쓴 단언은 **«해제됐다» 는 항상 실패, «남아 있다»(403 케이스)는 항상 참**이었다. 수정 전
RED 4 중 job 두 건의 RED 는 **올바른 이유가 아니었다**(결과는 같았지만 해제 뒤에도 RED 였을 것). 판정을
스케줄러 목록(zset) 소속으로 바꿨고, 각 케이스가 **삭제 전 `true` → 삭제 후 `false`** 전이를 같은
헬퍼로 보게 해 판별력을 테스트 안에서 증명한다.

## `--impl-prep` 처분 (`review/consistency/2026/09/17/18_00_19` — **BLOCK: NO** · WARNING 6)

| # | 지적 | 처분 |
|---|---|---|
| W1 | R8 괄호 확장(planner 후속)을 트래커로 옮기는 단계가 없다 | 체크리스트에 추가 — 종결 때 새 planner 항목 |
| W2 | sweeper 재판단에 살아 있는 소유자가 없다 | 체크리스트에 추가 — 종결 때 새 트래커 항목 |
| W3 | 트래커가 보상을 **e2e 재진입**으로 못박았는데 plan 은 단위로 축소 | e2e 로 한다. 단 **HTTP 로는 끊을 자리가 없다** — 비밀 쓰기(A)와 락 안 재기록(R) 사이는 ms 이고, e2e 에서 넓은 창(telegram setup ~18초)은 A **뒤에** 쓰는 비밀이 없어 보상을 판별하지 못한다(삭제 쪽 정리가 먼저 지워 보상 없이도 GREEN — vacuous). 운영 코드에 훅을 넣지 않고, `trigger-update-save-window.e2e-spec.ts` 처럼 **실제 Postgres 에 붙어 T(행 삭제) → S(정리, 0건) → A(비밀 쓰기) → R(`rewriteTriggerConfigLocked`) → C(보상)** 순서를 재진입으로 고정한다. 보상을 빼면 1행이 남는 판별 입력이다. 서비스 다섯 자리가 `false` 에서 보상을 부르는지는 단위(+뮤턴트)가 문다 |
| W4 | R8 «반드시 unregister» 가 검증 항목에 이름이 없다 | 단위 항목에 명시 — 외부 해제를 하는 세 경로(트리거·워크플로·워크스페이스)에서 `unregister` 호출. 스케줄 트리거는 chat channel 을 못 가져 등록되지 않는다(해당 없음) |
| W5 | `data-flow/10-triggers.md §1.4` «직접 삭제» 행이 Planned 태그 없이 현재형 | 이 PR 이 그 문장을 참으로 만든다. 반대로 **다른 행의 «미구현 (Planned)» 태그와 `2-trigger-list.md §4.3` 의 과도기 문구, `secret-store.md` 의 `partial` 이 이 PR 머지 뒤 거짓이 된다** → 체크리스트에 planner 후속 등재 |
| W6 | `TriggerResourceReleaser` 가 `*Service` 접미를 깬다 | `TriggerResourceReleaserService` 로 (grep 0건) |
| INFO 2 | `ModuleRef` throw 실패 모드가 `4-execution-engine.md §4.4` 표에 없다 | planner 후속에 함께 등재 |
| INFO 3 | 부수 주의 둘이 plan 에 근거로 없다 | 설계 불릿에 추가 |
| INFO 6 | `W-a~e` 라벨이 리뷰 `W<N>` 과 겹쳐 보인다 | `RP-1~5` 로 (grep 0건) |

## 체크리스트

- [x] `/consistency-check --impl-prep spec/2-navigation/` — `review/consistency/2026/09/17/18_00_19` **BLOCK: NO** (WARNING 6 처분 위)
- [x] e2e 먼저 — 워크플로·워크스페이스·스케줄 삭제 뒤 비밀 0행 + 대조군 생존 + schedule job 해제 — 수정 전 백엔드로 **RED 4 / GREEN 2** 확인. 네 RED 모두 목표 단언에서 실패(`Expected 0 · Received 2`, job scheduler 잔존) — 거짓 RED 아님. GREEN 둘(403 선검사 · 트리거 삭제)은 수정 전에도 참인 회귀 가드
- [x] e2e 보상 합성 — 실제 Postgres 에서 T → S → A → R → C 재진입 고정. 보상 **전** 1행을 단언해 판별 입력을 테스트 안에서 증명(보상 뒤 0행)
- [x] 단위 — 순서(외부 → 행 → 비밀) · 보상 RP-1~5 · listener `unregister`(R8) · ModuleRef 해석 실패 시 던짐 · 워크스페이스 선검사 (backend 9,746 GREEN · 뮤턴트 확인은 아래)
- [x] 구현
- [x] TEST WORKFLOW — lint PASS · unit backend **9,747** · build PASS + 타입 ratchet baseline 일치(197/36) · e2e backend **321**(새 spec 7 포함) + playwright **51**. 마지막 테스트 수정 뒤 lint·unit·ratchet 재통과
- [ ] `/ai-review` 수렴
- [ ] `--impl-done`
- [ ] 트래커 반영 — DRT-2 해소 표시 · **planner 후속 신설**(Planned 태그·§4.3 과도기 문구 제거 · `secret-store.md` `partial`→`implemented` · `15-chat-channel.md` R8 괄호 · `4-execution-engine.md §4.4` throw 사례) · **sweeper 재판단 항목 신설** · plan → `complete/`
