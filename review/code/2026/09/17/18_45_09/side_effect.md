# 부작용(Side Effect) 리뷰 — trigger-deletion-release

## 발견사항

- **[WARNING]** 워크스페이스 삭제 권한 재검사 실패(403) 시에도, 그보다 앞서 실행된 외부 자원 해제(schedule job 취소·chat-channel provider teardown·listener unregister)는 되돌려지지 않는다 — 삭제가 거부돼 워크스페이스가 그대로 남는데도 그 트리거들은 실질적으로 동작을 멈춘다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 함수 `deleteWorkspace`(504·512-513행, 잠금 없는 선검사 → 외부 해제) 및 `assertWorkspaceDeletable`(551-586행, 잠금 있는 재검사 — 진짜 결정)
  - 상세: `deleteWorkspace`는 (1) 잠금 없이 `assertWorkspaceDeletable`로 선검사 → (2) `releaser.releaseExternalForParent({workspaceId})`로 그 워크스페이스 소속 **모든 트리거**의 schedule job 해제·provider teardown·listener unregister 실행 → (3) 트랜잭션 안에서 워크스페이스 행을 `pessimistic_write`로 잠그고 **다시** `assertWorkspaceDeletable`을 호출해 최종 결정을 내린다. (1)과 (3) 사이에 요청자의 role 이 owner 에서 강등되면 (3)이 `ForbiddenException(OWNER_REQUIRED)`을 던져 워크스페이스 행·트리거 행·비밀은 전혀 지워지지 않지만, (2)에서 이미 실행된 외부 해제는 되돌리는 코드가 없다 — 그 워크스페이스의 살아있는 트리거들은 DB 상으로는 존재하는데 BullMQ job 은 취소됐고, chat-channel provider 등록은 teardown 됐고, listener registry entry 는 unregister 된 채로 남는다. `assertWorkspaceDeletable`의 JSDoc(“정리 대상은 best-effort 외부 자원뿐이다”)이 이 재검토 실패 시나리오를 스스로 인지하고 있으나, 그 문구는 “정리가 좀 늦어질 뿐”이라는 뉘앙스인 반면 실제 결과는 “삭제가 거부된, 계속 존재해야 할 워크스페이스의 트리거가 스케줄 실행·인바운드 웹훅 수신을 멈춘다”는 기능 회귀다. `plan/complete/spec-draft-deletion-releases-trigger-resources.md` D7 표(D7-1·D7-2·D7-3)는 “부모 삭제와 트리거 *생성*이 겹치는 창”만 열거했고, 이 “권한 재검사 실패로 삭제 자체가 취소되는 창”은 그 표에 별도 행으로 등재돼 있지 않다. `releaseExternalForParent`는 대상 트리거 수만큼 provider teardown 을 **순차** 호출하므로(같은 파일 `trigger-resource-releaser.service.ts` 128-147행 `releaseExternalMany`, telegram 기준 e2e 주석은 건당 최악 ~18초라고 명시) 트리거가 많은 워크스페이스일수록 (1)-(3) 창이 넓어져 동시 role 변경과 겹칠 확률도 커진다.
  - 제안: (a) 최소한 재검사 실패 시 로그로 “워크스페이스는 살아있는데 외부 자원은 이미 해제됐다”를 남겨 운영자가 알아챌 수 있게 하거나, (b) 선검사와 외부 해제 사이의 창을 좁히는 설계(예: 외부 해제 자체도 잠금 뒤로 미루거나, 실패 시 재등록을 유도하는 안내)를 검토한다. 최소한 `plan/complete/spec-draft-deletion-releases-trigger-resources.md` D7 표 또는 `trigger-deletion-release.md`에 이 창을 별도로 적어 “발생 조건이 좁다”는 판단이 이 케이스에도 실제로 검토됐음을 남길 것을 권한다(D7-1/D7-2 는 트리거 생성 경합만 다루고 권한 철회 경합은 다루지 않는다).

- **[INFO]** `releaseExternalForParent`(트랜잭션·잠금 **밖**)의 스냅샷과 실제 삭제 사이의 창에 생기거나 다시 쓰인 트리거는 비밀은 지워지지만 외부 자원(schedule job·provider 등록·listener registry)은 정리되지 않는다 — 단, 이는 `plan/complete/spec-draft-deletion-releases-trigger-resources.md` D7-1·D7-2 에서 이미 실측·논의 후 “계약 범위 밖”/“미룬다”로 명시적으로 수용된 설계 트레이드오프이며, 이번 구현(`workflows.service.ts` 264-283행 `remove`, `workspaces.service.ts` 502-541행 `deleteWorkspace`)은 그 결정을 정확히 그대로 반영하고 있다. 새로 발견한 이탈이 아니라 문서화된 잔여 창의 코드 반영을 확인한 것으로만 기록한다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:264-283`, `codebase/backend/src/modules/workspaces/workspaces.service.ts:502-541`, `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:128-147`

- **[INFO]** `WorkflowsService`·`WorkspacesService` 생성자에 `ModuleRef`가 새로 추가되고, `remove()`/`deleteWorkspace()`가 `ModuleRef.get(TRIGGER_RESOURCE_RELEASER, {strict:false})`(못 찾으면 throw)에 하드 의존하게 됐다 — 두 서비스가 컴파일 타임 import 없이 `TriggersModule`의 provider 가용성에 런타임으로 묶인다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:292-305`(`triggerResourceReleaser()`), `codebase/backend/src/modules/workspaces/workspaces.service.ts:588-598`(`triggerResourceReleaser()`)
  - 상세: 의도적 설계(모듈 순환 회피, JSDoc·plan·rationale_continuity.md INFO#2 에 이미 명시)이고 현재 `app.module.ts`에 `TriggersModule`·`WorkflowsModule`·`WorkspacesModule`이 모두 등록돼 있어 실제 위험은 없음을 확인했다(169·177·180행). 다만 이 결합은 타입체커가 잡아주지 못하는 순수 런타임 의존이라, 향후 `TriggersModule` 구성이 바뀌면(예: 별도 워커 부트스트랩 분리) 이 두 서비스의 모든 삭제 요청이 500 으로 실패하기 시작한다 — “정리를 건너뛴다”가 아니라 “삭제 자체가 실패한다”로 실패 모드가 바뀐 것은 이미 알려진 트레이드오프이나, 재확인 차 기록한다.
  - 제안: 별도 조치 불요(이미 설계 문서·이전 리뷰 라운드가 인지). 후속 리팩터링 시 `TriggersModule` 부트스트랩 스코프를 바꾸는 사람이 이 암묵적 의존을 놓치지 않도록 `app.module.ts` 또는 `trigger-resource-release.ts`의 JSDoc에 "이 토큰은 AppModule 루트에 TriggersModule 이 로드돼 있음을 전제한다"는 문구를 남겨두면 좋다.

- **[INFO]** `ChatChannelBinderService.setupChatChannel`의 “그 사이 트리거가 삭제됨” 분기(성공 경로 289-306행, degraded 경로 322-349행)가 이전에는 조용한 no-op 이었으나 이제 `undoAbsentTriggerWrite`를 통해 provider teardown(외부 네트워크 호출)과 secret 삭제를 실제로 수행한다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:292-306`, `:337-349`
  - 상세: 이는 이번 PR 의 핵심 의도(§3 “쓰지 못했으면 되돌린다”)이고 단위 테스트(`triggers.service.spec.ts` RP-4 관련 3건, `trigger-resource-release.spec.ts`)로 뒷받침돼 있어 결함은 아니다. 다만 “트리거가 그 사이 삭제된” race 분기가 이제 request 처리 경로 안에서 실제 외부 API 호출(teardown)을 유발한다는 점 — 이전에는 이 분기가 DB 쓰기 스킵만으로 끝났다 — 은 부작용의 성격이 “무해한 no-op”에서 “best-effort 지만 실패 가능한 외부 호출”로 바뀐 것이라 기록해 둔다. `undoAbsentTriggerWrite`는 teardown 실패를 삼키고 던지지 않으므로 호출자에게 새로운 예외 전파 경로가 생기지는 않는다.

## 확인했으나 문제 없음 (참고)

- `schedules.module.ts`에 추가된 `SecretStoreModule` import — `SecretStoreModule`은 `ConfigModule`/`TypeOrmModule.forFeature`만 의존해 순환 없음을 직접 확인(`secret-store.module.ts`).
- `TriggersService` 생성자에서 `ChannelListenerRegistry` 제거 — 파일 전체에서 참조가 완전히 사라졌음을 grep 으로 확인(고아 필드/미사용 주입 없음).
- `WorkflowsService`/`WorkspacesService`/`SchedulesService`/`TriggersService`를 `new`로 직접 생성하는 코드는 저장소에 없음(전수 grep 0건) — 생성자 시그니처 변경(파라미터 추가)이 DI 밖에서 깨지는 호출자는 없다.
- `TriggerResourceReleaserService`·`TRIGGER_RESOURCE_RELEASER` 토큰은 `TriggersModule`의 `exports`에 없지만 `ModuleRef.get(..., {strict:false})`는 전역 컨테이너에서 조회하므로 export 여부와 무관하게 정상 동작 — 설계 의도와 일치.
- `WorkspacesService.assertWorkspaceDeletable`이 요청당 두 번(잠금 없이·잠금 있게) 호출돼 DB 왕복이 늘지만, JSDoc 에 “권한 검사를 외부 해제보다 먼저” 두려는 의도적 설계로 명시돼 있고 데이터 정합성에 영향은 없음(성능 관점이라 side-effect 범위 밖으로 판단, 참고만 기록).
- `plan/in-progress/trigger-deletion-release.md`, `review/consistency/2026/09/17/18_00_19/**` 신규 파일 생성은 프로젝트 표준 워크플로 산출물(consistency-check·plan 트래킹)이며 예상 밖 파일시스템 부작용이 아니다.

## 검증 방법

저장소를 수정하지 않고 `Read`/`grep`으로 다음을 직접 대조했다: `secret-store.module.ts`(순환 확인), `app.module.ts`(TriggersModule/WorkflowsModule/WorkspacesModule 동시 등록 확인), `triggers.module.ts`(export 목록), `triggers.service.ts`(ChannelListenerRegistry 잔존 참조 없음), `chat-channel-binder.service.ts`·`trigger-resource-releaser.service.ts`·`workflows.service.ts`·`workspaces.service.ts` 전체 파일, `plan/complete/spec-draft-deletion-releases-trigger-resources.md` D7 표. 저장소 파일은 전혀 변경하지 않았다(`git status --short` 재확인 불필요 — 뮤테이션을 시도하지 않음).

## 요약

이 PR 의 핵심 부작용(트리거 삭제 네 경로가 이제 실제로 외부 자원·비밀을 정리한다는 것 자체)은 의도된 설계이고, 시그니처 변경(`WorkflowsService`/`WorkspacesService`/`SchedulesService`/`TriggersService` 생성자)은 전부 DI 로만 소비돼 호출자 영향이 없다. 가장 주목할 발견은 워크스페이스 삭제의 “잠금 없는 선검사 → 외부 해제 → 잠금 있는 재검사” 순서가, 재검사가 실패(403)해 삭제 자체가 취소되는 경우에도 이미 실행된 외부 해제(schedule job·provider 등록·listener registry)를 되돌리지 않는다는 점이다 — 삭제가 거부된, 계속 존재해야 할 워크스페이스의 트리거가 조용히 비활성화되는 결과라 WARNING 으로 남긴다. 그 외 워크플로/워크스페이스 삭제의 “외부 해제 스냅샷 vs 부모 잠금” 창은 이미 `plan/complete/spec-draft-deletion-releases-trigger-resources.md` D7-1/D7-2 가 실측·수용한 트레이드오프이고 코드가 그 결정을 정확히 반영하고 있어 새 결함이 아니라 확인 사항으로만 기록했다. `ModuleRef` 하드 의존과 setup 실패 분기의 신규 외부 호출도 모두 문서화·테스트된 의도적 변경이다.

## 위험도

MEDIUM
