# 요구사항(Requirement) 리뷰 — 트리거 삭제 자원 정리 (DRT-2, 2라운드)

## 범위 요약

`spec/2-navigation/2-trigger-list.md` §3·§4.3·§4.4, `spec/conventions/secret-store.md` §2.1·§5.3·§6 을
계약 SoT 로 삼아 "트리거 행을 없애는 네 경로"(트리거 화면 삭제 · 스케줄 화면 삭제 · 워크플로 삭제 ·
워크스페이스 삭제)가 그 트리거의 외부 자원(schedule job · chat-channel provider 등록 · listener
registry)과 `secret_store` 비밀을 정리하도록 만든 변경. 1라운드 `/ai-review`(Critical 1 · Warning
10)의 `RESOLUTION.md`(`097e583e1`)가 이미 처분됐고, `git diff --stat 097e583e1..HEAD -- codebase/`
가 빈 것을 확인했다 — 이번 2라운드는 **1라운드 리뷰 이후 코드 변경이 없는** 상태를 재검증한다
(마지막 커밋 `048ddc271` 은 `plan/`·`review/` 문서뿐).

핵심 파일을 저장소에서 직접 `Read` 해 diff 문맥 밖 인접 코드까지 대조했다: `trigger-resource-release.ts`
(정책 SoT) · `trigger-resource-releaser.service.ts`(+spec) · `TriggersService.remove` ·
`SchedulesService.remove` · `WorkflowsService.remove` · `WorkspacesService.deleteWorkspace`
(+`assertWorkspaceDeletable`/`transferOwnership` 잠금 순서 대조) · `ChatChannelBinderService.setupChatChannel`
(성공/degraded 두 보상 분기) · `spec/2-navigation/2-trigger-list.md §3/§4.3/§4.4` ·
`spec/conventions/secret-store.md §2.1/§5.3/§6` · `spec/data-flow/10-triggers.md §1.4` ·
`spec/data-flow/12-workspace.md §1.10`.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` (이미 추적됨, 재확인) 세 spec 문서가 이 PR 착지로 낡았다 — 코드가 옳고 문구가 과거를 서술한다
  - 위치: `spec/2-navigation/2-trigger-list.md:287`(§4.3 상단 註 "그 전까지는 트리거 화면 삭제만 네 자원을 모두 정리하고… 비밀을 행 삭제 **전에** 지운다"), `spec/data-flow/10-triggers.md:139`("Schedule 삭제 … 비밀 정리 — **미구현 (Planned)**")·`:142`("Workflow·Workspace 삭제 (FK CASCADE) — **미구현 (Planned)**"), `spec/data-flow/12-workspace.md:188`("**트리거 자원 정리 — 미구현 (Planned)**")·`:202`("**미구현 (Planned)**"), `spec/conventions/secret-store.md:3`(frontmatter `status: partial`)
  - 상세: 이번 PR 이 구현한 최종 상태(외부 해제 트랜잭션 밖 선행 → 부모 잠금 뒤 트리거 열거 → 커밋 뒤 비밀 정리, 네 경로 전부)는 `2-trigger-list.md` §4.3 표 다음 문단·§2.1·§5.3·§6 이 요구하는 정책과 line-level 로 정확히 일치한다(직접 대조 완료, 아래 "대조 결과" 참조). 문제는 그 요구를 "아직 아님"으로 서술하는 과도기 문구·Planned 태그·`partial` 상태가 네 곳에 남아, 지금 이 코드가 이미 참으로 만든 사실과 spec 본문이 어긋난다는 점이다. 이 발견은 **새로운 것이 아니다** — 1라운드 requirement 리뷰(`review/code/2026/09/17/18_45_09/requirement.md` 발견사항 #1)와 `review/consistency/2026/09/17/18_00_19/cross_spec.md`, `plan/in-progress/trigger-deletion-release.md:126`("W5")·`:164`(체크리스트 "planner 후속 신설")에 이미 명시적으로 등재돼 있다. `spec_impact: none`(developer 권한 밖)이고 이 developer 가 그 문장들을 쓴 것도 아니므로 자기-반증형 소정정 예외 대상이 아니며, plan 도 정확히 그렇게(머지 뒤 별도 `project-planner` 턴) 처리하기로 돼 있다.
  - 제안: 코드는 유지한다(코드가 옳다). `--impl-done` 종결 시 plan 체크리스트의 "planner 후속 신설" 항목이 실제로 예약됐는지만 확인하면 되고, 이 리뷰가 별도 조치를 추가할 필요는 없다 — 반영 대상은 `2-trigger-list.md §4.3` 과도기 문구 삭제, `data-flow/10-triggers.md §1.4` 두 Planned 태그 정합, `data-flow/12-workspace.md §1.10`(및 §2.1 스키마 매핑 표) Planned 태그 정합, `secret-store.md` frontmatter `status: partial`→`implemented`.

- **[INFO]** (1라운드에서 이미 지적·"변경 없음"으로 처분됨, 코드 불변 재확인) `lockParentAndListTriggerIds` 가 부모 잠금 결과의 부재를 무시한다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts`(`lockParentAndListTriggerIds`, `manager.findOne(Workflow, …)`/`manager.findOne(Workspace, …)` 반환값 미사용)
  - 상세: `findById`(non-locking)가 이미 존재를 확인한 뒤 트랜잭션에 들어가므로 통상 경로는 안전하지만, `findById` 직후·트랜잭션 진입 전 사이에 동시 삭제가 끼면 `findOne` 이 `null` 이어도 코드가 계속 진행한다 — 트리거 목록은 정확히 0건이라 안전하지만 뒤이은 `manager.remove(workflow)`/`wsRepo.remove(workspace)` 가 이미 사라진 엔티티를 대상으로 호출된다. 새로 만든 구멍이 아니라 기존 서비스가 애초에 non-locking `findById` 위에 지어졌던 것과 같은 클래스의 레이스이며, `RESOLUTION.md` 항목 19·21 이 "이 PR 전에도 같은 클래스의 중복이 났다 — 새 결함 아님, 후속 등재"로 명시 처분했다.
  - 제안: 차단 사유 아님. RESOLUTION 처분과 동일 — 후속 트래커 항목으로 유지.

- **[INFO]** (1라운드에서 이미 지적·"변경 없음"으로 처분됨) `WorkspacesService.deleteWorkspace` 트랜잭션 안에서 워크스페이스 행이 두 번 잠긴다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:520`(`assertWorkspaceDeletable(..., { mode: 'pessimistic_write' })`) 직후 `:528`(`releaser.lockParentAndListTriggerIds`)가 같은 workspace row 를 재차 잠근다.
  - 상세: 같은 트랜잭션 안의 재잠금은 Postgres 상 no-op 에 가까워 정합성 문제는 없다(요구된 "잠근 뒤 열거" 순서는 두 번 다 지켜진다). `RESOLUTION.md` 항목 20 이 "같은 트랜잭션의 재잠금은 no-op — 유지"로 처분.
  - 제안: 차단 사유 아님.

## 대조 결과 — 위반 없음 (근거 기록, 직접 재대조)

- **`removeScheduleJobsOrRestore`**(`trigger-resource-releaser.service.ts:162-195`, 1라운드 CRITICAL 처분물)가 "전부 시도 → 실패 있으면 이미 해제한 **활성** job 만 재등록 → 던짐" 을 그대로 구현하고 있음을 직접 코드로 확인. `trigger-resource-releaser.service.spec.ts:140-217` 에 "하나 실패 시 나머지도 시도 + 활성만 재등록 후 던짐"·"재등록마저 실패해도 원래 실패로 던짐"·"해제 실패 시 삭제 자체를 멈춤" 세 케이스가 있어 1라운드가 언급한 뮤턴트 M16/M17 방어가 테스트로 남아 있다.
- **`deleteTriggerSecretsAfterCommit`/`undoAbsentTriggerWrite`**(`trigger-resource-release.ts`)가 `secret-store.md §2.1/§5.3/§6`·`2-trigger-list.md §3` 문구와 line-level 로 일치 — 커밋 뒤 정리·던지지 않고 로그·per-trigger prefix 순회·teardown→비밀 순서 모두 확인.
- **`TriggersService.remove`**(`:1049-1096`): 외부 해제(락 밖) → 락+행 삭제(대기 상한 5초 유지) → 커밋 뒤 비밀 → 감사 순서가 §4.3·§4.4 와 정확히 대응.
- **`SchedulesService.remove`**(`:300-352`): schedule 타입은 chat-channel 을 가질 수 없다는 전제로 `TriggerResourceReleaserService` 대신 순수 함수를 직접 호출(모듈 순환 회피) — 설계 의도와 일치, 결함 아님.
- **`WorkflowsService.remove`/`WorkspacesService.deleteWorkspace`**: "외부 해제(트랜잭션 밖) → 부모 잠금 → 트리거 열거 → 행 삭제(같은 트랜잭션) → 커밋 뒤 비밀" 이 §4.3 "워크플로·워크스페이스 삭제는… 부모 행을 잠근 뒤 같은 트랜잭션에서 열거한다" 와 정확히 대응. `assertWorkspaceDeletable`(잠금 순서: 워크스페이스 → 멤버십, `:563-597`)과 `transferOwnership`(`:687-698`)의 잠금 순서가 동일함을 직접 대조 — 1라운드 처분(#5) 유지 확인.
- **`secret-store.md §6`** "워크스페이스 삭제도 트리거 단위 prefix 로 정리한다(workspace_id 조건 삭제 경로를 두지 않는다)" — `releaseSecretsAfterCommit(triggerIds, …)` 이 트리거 id 별 `deleteByPrefix` 만 호출, `workspace_id` 조건 일괄 삭제 쿼리는 코드 어디에도 없음을 grep 으로 재확인.
- `Trigger.workspaceId`(`trigger.entity.ts:36-37`)가 직접 컬럼이라 워크플로 경유 없이도 `find({where:{workspaceId}})` 가 그 워크스페이스의 트리거 전부를 정확히 찾는다 — 누락 가능성 없음.
- `Schedule.triggerId`(`schedule.entity.ts:25-26`)가 NOT NULL 이라 `SchedulesService.remove` 의 `if (schedule.triggerId)` 가드는 항상 참인 방어적 코드 — 결함 아니고 데드코드도 아님(타입 좁히기 용도).
- TODO/FIXME/HACK/XXX 주석 0건(`git diff origin/main...HEAD -- codebase/` 전수 grep).
- 반환값: `deleteTriggerSecretsAfterCommit`/`undoAbsentTriggerWrite` 모두 모든 분기(성공/실패/빈 목록)에서 `Promise<void>` 로 resolve, 재-throw 경로 없음 — 설계 의도(호출자에게 던지지 않음)와 일치.

## 요약

1라운드 이후 `codebase/` 변경이 없어(diff 0), 이번 2라운드는 1라운드 requirement 리뷰의 결론을
재확인하는 성격이다. 네 삭제 경로(트리거·스케줄·워크플로·워크스페이스)와 락 밖 쓰기 보상 다섯 자리의
순서·실패 정책이 spec 본문과 line-level 로 정확히 일치하며, 1라운드 CRITICAL(스케줄 job 배치 해제
부분 실패)의 수정(`removeScheduleJobsOrRestore` 전부-시도+활성-job-재등록)이 코드·뮤턴트 대응
테스트 모두에 그대로 남아 있음을 직접 확인했다. 유일하게 남는 불일치는 이 PR 착지로 낡는 spec
문구 넷(§4.3 과도기 註·`data-flow/10-triggers.md` Planned 태그 2곳·`12-workspace.md` Planned
태그 2곳·`secret-store.md` `status: partial`)인데, 전부 코드가 아니라 spec 이 낡은 SPEC-DRIFT 이고
이미 plan 체크리스트·consistency 산출물에 planner 후속으로 예약돼 있어 이 리뷰가 새로 등재할 필요는
없다. 남은 두 INFO(부모 잠금 결과 미확인, 워크스페이스 이중 잠금)도 1라운드에서 "새 결함 아님·후속
등재"로 이미 처분된 항목이 코드 불변 상태로 남아 있는 것을 재확인한 것뿐이다. 차단 사유 없음.

## 위험도

LOW
