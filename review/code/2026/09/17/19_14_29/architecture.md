# 아키텍처 리뷰 — 트리거 삭제 자원 정리 (trigger-deletion-release, 2라운드)

검증을 위해 저장소 파일을 수정하지 않았다(읽기 전용 `Read`/`Grep`/`Bash` 대조만 수행). `git status --short` 확인 결과 세션 시작 시점의 `review/code/2026/09/17/19_14_29/` 외 잔여 변경 없음.

본 라운드는 1라운드(`review/code/2026/09/17/18_45_09/architecture.md`)가 지적한 항목이 `RESOLUTION.md`·커밋 `097e583e1`에서 실제로 어떻게 처분됐는지 현재 소스를 직접 열어 대조하고, 그 처분 과정에서 새로 생긴 아키텍처 관점 결함이 있는지를 본다.

## 1라운드 지적사항 처분 확인 (재확인 — 문제 없음)

실제 파일을 열어 대조한 결과 아래는 주장대로 고쳐졌다:

- 지연 해석 헬퍼 중복(WARNING#6) → `resolveTriggerResourceReleaser(moduleRef)` 하나로 통합, `workflows.service.ts:267`·`workspaces.service.ts:512` 둘 다 이 함수를 직접 호출(사설 래퍼 삭제 확인).
- binder 보상 블록 중복(WARNING#7) → `chat-channel-binder.service.ts:249-258` 로컬 `undoWrite` 클로저로 통합, 두 호출부(`:312`, `:350`)가 1줄로 축소.
- `triggerSecretPrefix` URI 하드코딩(WARNING#8) → `secret-ref.ts:44-49` `buildSecretRefPrefix`가 `buildSecretRef`의 검증을 재사용, `trigger-resource-release.ts:29-31`이 이를 위임.
- 워크스페이스 잠금 순서(WARNING#5) → `workspaces.service.ts:563-597` `assertWorkspaceDeletable`이 트랜잭션 안/밖 양쪽에서 워크스페이스 → 멤버십 순서로 통일.
- 로그 접두 `TriggersService:` 잔존(WARNING#11) → `chat-channel-binder.service.ts` 4곳 모두 `ChatChannelBinderService:`로 정정 확인.
- `SecretStoreModule`을 `SchedulesModule`이 새로 import 하며 남긴 "순환 무관" 주석(`schedules.module.ts:29`) → `secret-store.module.ts`를 직접 열어 `imports: [ConfigModule, TypeOrmModule.forFeature(...)]`뿐임을 확인, 주석 그대로 사실.

## 발견사항

- **[WARNING]** 부모(워크플로/워크스페이스) 삭제 두 곳의 "삭제 안무 + 실패 로그" 블록이 1라운드가 경고한 바로 그 축(drift 위험)에서 **오히려 늘었다** — 같은 처분 커밋이 다른 중복(지연 해석 헬퍼)은 통합하면서 이 중복은 통합하지 않고 새로 심었다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:263-291`(`remove()`, 특히 catch 블록 `:279-287`), `codebase/backend/src/modules/workspaces/workspaces.service.ts:498-551`(`deleteWorkspace()`, 특히 catch 블록 `:537-546`)
  - 상세: 두 메서드 모두 `resolveTriggerResourceReleaser(moduleRef)` → `releaseExternalForParent` → `manager.transaction(async (manager) => { lockParentAndListTriggerIds → manager.remove(parent) → return ids })` → `.catch((err) => { this.logger.error(...); throw err; })` → `releaseSecretsAfterCommit` 순서를 토씨만 다르게 반복한다. 1라운드 architecture.md(INFO#23 안무 순서)가 이미 "호출부가 셋 이상으로 늘어나면 템플릿 메서드로 승격을 고려하라"고 적어 두었는데, 이번 처분 커밋(`097e583e1`)은 바로 이 두 파일을 손대면서 **catch 블록(에러 로깅+재던짐)까지 양쪽에 거의 동일하게 새로 추가**했다 — `TriggersService.remove()`(`triggers.service.ts:1069-1083`)·`SchedulesService.remove()`(`schedules.service.ts:316-330`)에도 구조가 같은 catch 블록이 이미 있어, 이제 "행 삭제 실패 시 반쯤-삭제 상태를 로그하고 재던진다"는 관용구가 **네 곳**에서 손으로 반복된다. 같은 커밋이 지연 해석 헬퍼 중복(6줄)은 한 곳으로 합치면서 이 중복(각 15~20줄)은 합치지 않은 것은, 통합할 기회가 있었는데 놓친 것에 가깝다.
  - 제안: 최소한 `logHalfDeletedAndRethrow(logger, { caller, err, detail })` 같은 공유 헬퍼로 로그+재던짐 부분만이라도 통합하거나, 1라운드가 이미 제안한 대로 `releaser.deleteParentWithCleanup(parent, (manager, parentRow) => manager.remove(parentRow))` 형태의 템플릿 메서드로 안무 전체(잠금→열거→콜백→커밋→비밀정리→실패 로그)를 포트가 소유하게 승격한다. 지금 인스턴스가 4개(트리거·스케줄·워크플로·워크스페이스)로 이미 "둘"을 넘겼으므로, 1라운드가 유예 조건으로 든 "호출부 2개" 전제가 깨졌다고 본다.

- **[INFO]** `TriggerResourceReleaserService`(`triggers/` 소유)가 `Workflow`·`Workspace` 엔티티 클래스를 파일 수준에서 직접 import — 모듈 그래프(Nest DI) 순환은 피했지만 엔티티/타입 수준 결합은 남는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:10-11`(`import { Workflow } from '../workflows/entities/workflow.entity'`, `import { Workspace } from '../workspaces/entities/workspace.entity'`), 사용처 `:68-90`(`lockParentAndListTriggerIds`)
  - 상세: 이 설계는 `ModuleRef.get(TOKEN, {strict:false})`로 `WorkflowsModule`/`WorkspacesModule` → `TriggersModule` import를 피해 Nest 모듈 순환을 막는다(정당하고 실측 확인됨 — 1라운드 architecture.md 참고). 그런데 부모 행을 "같은 트랜잭션에서" 잠그려면 그 엔티티 클래스가 필요해, `triggers/` 안의 서비스가 `workflows/entities`·`workspaces/entities`를 직접 알게 됐다. DI 그래프 상 순환은 없지만, "trigger 모듈은 워크플로/워크스페이스의 존재를 몰라야 한다"는 경계는 엔티티 타입 층위에서 깨진다. 지금은 TypeORM 엔티티 클래스일 뿐이라 위험은 낮지만, `TriggerParent`가 부모 타입이 늘어날 때마다(포트 JSDoc이 스스로 인정하듯) 이 서비스가 그만큼의 타 도메인 엔티티를 계속 알아야 하는 구조다.
  - 제안: 현재 스코프에서는 수용 가능. 부모 타입이 3종 이상으로 늘어나거나 다른 팀이 "triggers 모듈이 워크플로/워크스페이스를 몰라야 한다"는 규약을 정식화하면, 잠금 대상 엔티티를 호출자가 넘기는 형태(`lockParentAndListTriggerIds(manager, parent, lockEntity)` 또는 콜백)로 역전하는 것을 고려.

## 확인된 긍정적 설계 (참고)

- **Saga(보상 트랜잭션) 패턴이 신규 코드(`removeScheduleJobsOrRestore`, `trigger-resource-releaser.service.ts:162-195`)에 적절히 적용됐다.** Postgres 트랜잭션과 BullMQ(Redis) 사이에는 분산 트랜잭션이 없으므로, "전부 시도 → 실패 시 이미 해제한 것만 선별 복구(활성 스케줄만) → 던져서 삭제를 멈춘다"는 순서는 표준 보상 트랜잭션 형태다. 복구 자체가 실패해도 삼키지 않고 error 로그로 남겨 "재시작이 마지막 그물"이라는 계약을 명시한 점도 실패 정책의 층위를 분명히 한다.
- **정책(순수 함수)과 배선(Nest DI)의 분리가 이번에도 유지됐다.** `resolveTriggerResourceReleaser`로 통합한 뒤에도 `trigger-resource-release.ts`는 여전히 프레임워크 독립적인 순수 함수 + 포트 인터페이스만 갖고, `TriggerResourceReleaserService`는 그 정책에 의존성만 배선한다 — `SchedulesService`가 순환 회피를 위해 포트를 우회해 같은 순수 함수(`deleteTriggerSecretsAfterCommit`)를 직접 부르는 경로도 정책 자체는 중복되지 않는다(호출 경로만 별개, 로직은 하나).

## 요약

1라운드가 지적한 아키텍처 관점 항목(지연 해석 헬퍼 중복·binder 보상 중복·URI 빌더 재사용·잠금 순서·로그 접두)은 실제 코드 대조 결과 전부 처분대로 고쳐졌고 새로운 결함은 없다. 다만 그 처분 커밋이 다른 중복은 통합하면서, 1라운드가 이미 "호출부 3개 이상이면 템플릿 메서드로 승격을 고려하라"고 적어 둔 바로 그 "삭제 안무 + 실패 로그" 블록은 워크플로/워크스페이스 두 곳에 새로 거의 동일하게 심어 놓았다 — 트리거·스케줄까지 합치면 이제 네 곳이 같은 관용구를 손으로 반복한다. 이는 기능 결함이 아니라 drift 위험(다음에 정책이 바뀌면 한 곳만 고칠 위험)이며 차단 사유는 아니다. 그 외에 `TriggerResourceReleaserService`가 타 도메인 엔티티를 직접 import 하는 결합이 있으나 현재 스코프에서는 낮은 위험으로 수용 가능하다. Saga 패턴 적용 등 신규 설계는 견고하다.

## 위험도

LOW
