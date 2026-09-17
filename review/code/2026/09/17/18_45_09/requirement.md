# 요구사항(Requirement) 리뷰 — 트리거 삭제 자원 정리 (DRT-2)

## 범위 요약

`spec/2-navigation/2-trigger-list.md` §3·§4.3·§4.4, `spec/conventions/secret-store.md` §2.1·§5.3·§6
을 계약 SoT 로 삼아 "트리거 행을 없애는 네 경로"(트리거 화면 삭제 · 스케줄 화면 삭제 · 워크플로
삭제 · 워크스페이스 삭제)와 "락 밖 비밀 쓰기 뒤 락 안 재기록이 행 부재로 실패하는 다섯 자리"
(RP-1~RP-5)의 자원 정리를 구현한 변경. `trigger-resource-release.ts`(순수 함수, 순서·실패 정책)
+ `TriggerResourceReleaserService`(injectable, 배선) 로 정책을 단일화하고, 네 삭제 경로·다섯 쓰기
보상 자리를 모두 이 두 함수로 리팩터링했다. 새 e2e(`trigger-deletion-releases-resources.e2e-spec.ts`,
7 케이스, 실제 Postgres 재진입 보상 합성 포함)와 대규모 unit 보강이 동반됐다.

각 파일을 spec 본문과 line-level 로 대조하고, 주요 서비스 메서드(`TriggersService.remove`/
`rotateBotToken`/`normalizeNotificationSecretRef`/`promoteRotatedNotificationSecrets`,
`SchedulesService.remove`, `WorkflowsService.remove`, `WorkspacesService.deleteWorkspace`,
`ChatChannelBinderService.setupChatChannel`, `TriggerResourceReleaserService` 전체)를
저장소에서 직접 `Read` 해 diff 문맥 밖의 인접 코드까지 확인했다.

## 발견사항

- **[INFO]** `[SPEC-DRIFT]` (이미 추적됨) `spec/2-navigation/2-trigger-list.md` §4.3 상단 註 (line 286-287)와 `spec/data-flow/10-triggers.md` §1.4 "Trigger 직접 삭제" 행이 이 PR 이 착지하면 서로 어긋난다
  - 위치: `spec/2-navigation/2-trigger-list.md:287` ("그 전까지는 트리거 화면 삭제만 네 자원을 모두 정리하고… 비밀을 행 삭제 **전에** 지운다") — 이 문장은 **이 PR 이전 코드**를 서술한다. 이 PR 은 `TriggersService.remove`(`codebase/backend/src/modules/triggers/triggers.service.ts` 의 `remove()`)를 정확히 그 반대(외부 해제 → 락·행 삭제 → **커밋 뒤** 비밀)로 바꿨다.
  - 상세: 코드는 spec 이 최종적으로 요구하는 상태(§4.3 표 다음 문단 · §2.1 · §5.3 · §6)와 line-level 로 정확히 일치한다(`deleteTriggerSecretsAfterCommit`/`undoAbsentTriggerWrite` 의 순서·실패 정책이 §2.1 호출 규약 문구와 거의 축자적으로 대응). 문제는 §4.3 의 "그 전까지는…" 과도기 문구와 `data-flow/10-triggers.md §1.4` 의 Planned 태그 누락 행이 이 PR 착지 시점에 **동시에** 낡는다는 점이다. 이는 이미 이 changeset 안의 `review/consistency/2026/09/17/18_00_19/cross_spec.md` WARNING 과 `plan/in-progress/trigger-deletion-release.md` 체크리스트 마지막 항목("planner 후속 신설 — Planned 태그·§4.3 과도기 문구 제거 · `secret-store.md` `partial`→`implemented`")에 **명시적으로 포착·추적**돼 있다. `spec_impact: none` 이고 그 문장을 이 developer 가 쓴 것도 아니므로 자기-반증형 소정정 예외 대상이 아니며, plan 도 정확히 그렇게 처리(planner 턴 예약)하고 있다.
  - 제안: 코드는 유지한다(코드가 옳다). spec 반영은 `--impl-done` 이후 별도 `project-planner` 턴에서 `2-trigger-list.md §4.3` 과도기 문구 삭제 + `data-flow/10-triggers.md §1.4` Planned 태그 정합 + `secret-store.md` frontmatter `status: partial`→`implemented` 를 함께 갱신한다. 이 항목은 이미 plan 체크리스트에 있으므로 **새로 등재할 필요는 없고**, `--impl-done` 종결 시 그 항목이 실제로 지켜지는지만 확인하면 된다.

- **[INFO]** `TriggerResourceReleaserService.lockParentAndListTriggerIds` 가 부모 행 잠금(`manager.findOne`)의 결과를 확인하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` — `lockParentAndListTriggerIds` (파일 9, `manager.findOne(Workflow, …)` / `manager.findOne(Workspace, …)` 호출부, 반환값 미사용)
  - 상세: `findById`(→ `WorkflowsService.remove`/`WorkspacesService.assertWorkspaceDeletable`)로 이미 존재를 확인한 뒤 트랜잭션에 들어가므로 통상 경로에서는 문제가 되지 않지만, `findById` 자체가 non-locking 이라 findById 직후·트랜잭션 진입 전 사이에 동시 삭제가 끼어들면 `findOne` 이 `null` 을 돌려줘도 코드가 이를 무시하고 계속 진행한다(트리거 목록은 정확히 0건이 되어 안전, 다만 뒤이은 `manager.remove(workflow)`/`wsRepo.remove(workspace)` 가 이미 사라진 엔티티를 대상으로 호출된다). 이는 이 PR 이 새로 만든 구멍이 아니라 기존 `WorkflowsService.remove`/`WorkspacesService.deleteWorkspace` 가 애초에 non-locking `findById` 위에 지어졌던 것과 같은 클래스의 레이스이고, spec 본문도 이 동시-삭제 케이스를 규정하지 않는다(§4.3 은 "남는 창" 문단에서 유사 창을 외부 자원 쪽으로만 명시).
  - 제안: 차단 사유 아님. 후속으로 `lockParentAndListTriggerIds` 가 `null` 이면 명시적으로 조기 반환(빈 배열)하도록 방어하면 의도가 코드에 드러나 다음 사람이 "잠금 결과를 왜 안 쓰지"라고 재의심하는 비용을 줄인다.

- **[INFO]** `WorkspacesService.deleteWorkspace` 트랜잭션 안에서 워크스페이스 행이 두 번 잠긴다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `assertWorkspaceDeletable(memRepo, wsRepo, workspaceId, requesterId, { mode: 'pessimistic_write' })` 호출(트랜잭션 내부) 직후 `releaser.lockParentAndListTriggerIds(manager, { workspaceId })` 가 같은 workspace row 를 `manager.findOne(Workspace, …, lock)` 로 재차 잠근다.
  - 상세: 같은 트랜잭션 안에서 이미 보유한 락을 다시 요청하는 것은 Postgres 상 no-op 에 가까워 정합성 문제는 없다(요구된 "잠근 뒤 열거" 순서는 두 번 다 지켜진다). 순수 중복 작업이라 성능·가독성 관점의 사소한 낭비.
  - 제안: 차단 사유 아님. 원한다면 `assertWorkspaceDeletable` 이 locked 로 얻은 workspace 엔티티를 `lockParentAndListTriggerIds` 에 재사용하도록 리팩터링 여지가 있으나 스코프 밖.

## 대조 결과 — 위반 없음 (근거 기록)

- **`deleteTriggerSecretsAfterCommit`**(`trigger-resource-release.ts`)이 `secret-store.md §2.1` "트리거 행이 없어질 때… 행 삭제가 **커밋된 뒤에** 한다… 실패하면 던지지 않고" 및 §5.3/§6 예시 코드와 line-level 로 일치 — 던지지 않음·error 로그·prefix per-trigger 순회·감사 로그 미기록(workspace_id FK 소실 위험 회피) 모두 구현됨. 단위 테스트(`trigger-resource-release.spec.ts`)가 "하나 실패해도 나머지 계속" · "빈 목록 no-op" 을 커버.
- **`undoAbsentTriggerWrite`** 가 `2-trigger-list.md §3` "쓰지 못했으면 락 밖에서 만든 것을 되돌린다"(teardown → 비밀 삭제 순서, 둘 다 던지지 않음)와 정확히 대응. RP-1~RP-5 다섯 자리(`normalizeNotificationSecretRef`·`rotateBotToken`·`promoteRotatedNotificationSecrets`·`ChatChannelBinderService.setupChatChannel` 성공/degraded) 모두 `rewriteTriggerConfigLocked` 의 `false` 분기에서 이 헬퍼를 호출하도록 배선을 직접 확인했다(코드 리딩, diff 밖 인접 라인 포함).
- **`TriggersService.remove`**: 외부 해제(`releaseExternal`) → 락+행 삭제(대기 상한 5초 유지) → 커밋 뒤 비밀(`releaseSecretsAfterCommit`) → 감사 순서가 §4.3 표 다음 문단·§4.4 "락 대기 상한 5초" 서술과 정확히 일치. 행 삭제 실패 시 로그 문구가 "비밀은 아직 남아 있다"로 갱신돼 실제 상태(순서 반전 후에는 비밀이 아직 안 지워짐)와 일치하도록 고쳐졌다 — 예전 문구 그대로 두었다면 사실과 어긋났을 자리다.
- **`SchedulesService.remove`**: `TriggerResourceReleaserService` 대신 순수 함수를 직접 호출(모듈 순환 회피, 근거는 plan "모듈 위치" 절과 코드 주석이 대응) — schedule 타입 트리거는 chat channel 을 가질 수 없어 외부 해제가 BullMQ job 뿐이라는 전제와 일치, chat-channel teardown/listener unregister 를 부르지 않는 것이 결함이 아니라 설계임을 확인.
- **`WorkflowsService.remove` / `WorkspacesService.deleteWorkspace`**: "외부 해제(트랜잭션 밖) → (부모 잠금 → 트리거 열거 → 행 삭제, 같은 트랜잭션) → 커밋 뒤 비밀" 이 `§4.3` "워크플로·워크스페이스 삭제는… 부모 행을 잠근 뒤 같은 트랜잭션에서 열거한다" 문단과 정확히 대응. 워크스페이스는 추가로 "권한 검사가 외부 해제보다 먼저" 를 도입했고 이는 spec 이 요구하지 않지만 합리적인 강화이며 e2e(403 케이스)로 회귀 가드됨(대상 코드가 spec 을 위반하지 않으면서 넓히는 것이라 SPEC-DRIFT 대상 아님, 그냥 구현 세부).
- **`TriggerResourceReleaserService.releaseExternalMany`**: R8(listener registry unregister) 이 세 경로(트리거·워크플로·워크스페이스)에서 호출되는 것을 코드로 직접 확인 — `spec/5-system/15-chat-channel.md` R8 "반드시 unregister" 준수. schedule job 해제 실패 시 **던져서 삭제를 멈춘다**(§4.4 "락 대기 상한" 문단의 "되돌릴 수 없는 외부 자원 해제" 전제와 일치).
- **`secret-store.md §6`** "워크스페이스 삭제도 트리거 단위 prefix 로 정리한다(workspace_id 조건 삭제 경로를 두지 않는다)" — `releaseSecretsAfterCommit(triggerIds, …)` 이 트리거 id 별로 `deleteByPrefix` 를 호출하는 것을 확인, `workspace_id` 를 조건으로 한 일괄 삭제 쿼리는 코드 어디에도 없음.
- e2e(`trigger-deletion-releases-resources.e2e-spec.ts`)의 "대조군" 설계(이웃 트리거 비밀 생존 단언)가 "넓게 지우는 결함"을 판별하도록 구성돼 있고, "삭제와 겹친 비밀 쓰기" describe 는 HTTP 로는 못 끊는 인터리빙(A 가 S 보다 늦는 경우)을 실제 Postgres 재진입으로 고정 — 보상 **전** 1행 단언으로 판별 입력 자체를 증명한다(vacuous 방지). TODO/FIXME/HACK/XXX 주석은 변경 파일 전체에서 0건.
- 반환값 경로: `deleteTriggerSecretsAfterCommit`/`undoAbsentTriggerWrite` 모두 `Promise<void>` 로 선언되고 모든 분기(성공/실패/빈 목록)에서 실제로 resolve 하며 예외를 다시 던지는 경로가 없음을 확인(설계 의도와 정확히 일치).

## 요약

트리거 행을 없애는 네 경로와 락 밖 쓰기 보상 다섯 자리의 자원 정리 순서·실패 정책이
`spec/2-navigation/2-trigger-list.md §3/§4.3/§4.4`, `spec/conventions/secret-store.md §2.1/§5.3/§6`
와 line-level 로 정확히 일치하도록 구현됐다. 두 함수(`trigger-resource-release.ts` 순수 함수 +
`TriggerResourceReleaserService`)로 정책을 단일화해 아홉 자리(네 삭제 경로 + 다섯 보상 자리)의
drift 위험을 줄였고, 실제 Postgres 에 붙는 e2e 로 HTTP 로는 재현 불가능한 인터리빙까지 재진입
고정했다. CRITICAL 로 볼 결함은 찾지 못했다. 유일하게 남는 spec 불일치(`2-trigger-list.md §4.3`
과도기 문구·`data-flow/10-triggers.md §1.4` Planned 태그)는 이 PR 이 착지하면 발생하는 **의도된
후속 작업**이고, 이미 이 changeset 의 consistency-check 산출물과 plan 체크리스트에 명시적으로
추적돼 있어 새로 등재할 필요가 없다(코드를 되돌릴 사안이 아니라 `--impl-done` 이후 별도
`project-planner` 턴에서 spec 문구만 정리하면 된다). 그 외 두 건은 정합성에 영향 없는 사소한
중복/방어 누락(INFO)이다.

## 위험도

LOW
