# 부작용(Side Effect) 코드 리뷰 — trigger-deletion-release

검증을 위해 저장소 파일을 수정하지 않았다 (`Read`/`Grep`/`Bash` 읽기 전용 대조만 수행). `git status --short` 로 확인한 잔여 변경 없음 (`review/code/2026/09/17/19_40_27/` 산출물 디렉터리만 untracked).

## 조사 범위

`trigger-resource-release.ts`(신규 정책 함수) · `trigger-resource-releaser.service.ts`(신규 서비스) ·
`triggers.service.ts` · `chat-channel-binder.service.ts` · `schedules.service.ts` ·
`workflows.service.ts` · `workspaces.service.ts` · `trigger-config-lock.ts` · `secret-ref.ts` 를
diff 뿐 아니라 전체 파일로 읽고, DI 배선(module 파일)·e2e 스펙·`jest.config.ts` 주석까지 대조했다.
`/ai-review` 1·2라운드(`review/code/2026/09/17/18_45_09/RESOLUTION.md`)가 이미 처분한 항목(스케줄
job 배치 해제 롤백, 워크스페이스 잠금 순서, 지연 해석 헬퍼 중복, `TriggersService:` 로그 접두,
`triggerSecretPrefix` 의 `buildSecretRef` 미재사용 등)은 코드로 반영된 것을 확인했고 재-flag 하지
않았다.

## 발견사항

- **[WARNING]** `SecretResolverService.deleteByPrefix` 의 안전 근거 주석이 이번 PR 로 사실과 어긋난다 — 호출부 위치·개수 주장이 stale
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:172-174` (이 파일 자체는 이번 diff 에 없다 — 원본을 직접 열어 확인)
  - 상세: 이 함수 JSDoc 은 "현재 프로덕션 호출부는 `triggers.service.ts` 한 곳뿐이고 `secret://triggers/{uuid}/` 라 메타문자가 들어갈 수 없다(2026-08-09 전수 확인)" 라고 못박고, 바로 다음 문장에서 "그 안전은 **호출부 목록이 그대로일 때만** 참이다. 사용자 입력이 섞인 prefix 를 넘기는 호출부가 하나 생기면 주석은 아무것도 막지 못한다" 라고 스스로 경고한다. 이번 PR 이 정확히 그 "호출부 목록이 바뀌는" 사건이다 — `grep -rn "deleteByPrefix(" codebase/backend/src --include="*.ts"` (spec 제외)로 직접 대조한 결과, 원래 유일한 프로덕션 호출부이던 `triggers.service.ts` 의 직접 호출은 이번 PR 로 **제거됐고**, 유일한 남은 호출부는 새 파일 `trigger-resource-release.ts:62`(`deleteTriggerSecretsAfterCommit` 내부) 다. 즉 호출부 "개수"는 여전히 1개로 유지되지만(스케줄·워크플로·워크스페이스·트리거 4경로 + 5개 보상 자리 전부가 `triggerSecretPrefix`→`deleteTriggerSecretsAfterCommit` 한 함수로 수렴), 주석이 지목하는 **파일명·근거("2026-08-09 전수 확인" 당시의 호출부 목록)는 더 이상 실제 코드와 일치하지 않는다**. 실제 안전은 이 함수 자체의 런타임 가드(`% _ \` 거부)가 지켜 실행 시점 위험은 없지만, 다음에 이 prefix 안전성을 재검토할 사람이 "호출부는 triggers.service.ts 하나뿐" 이라는 문장을 근거로 판단하면 잘못된 전제로 시작하게 된다.
  - 제안: `현재 프로덕션 호출부는 triggers.service.ts 한 곳뿐이고` → `현재 프로덕션 호출부는 trigger-resource-release.ts 의 deleteTriggerSecretsAfterCommit 한 곳뿐이고` 로 정정하고, 날짜·재확인 근거도 이번 리팩터 시점으로 갱신한다.

- **[INFO]** 보상 경로가 이전에는 조용한 no-op이던 자리에 실제 외부 provider 호출(네트워크 I/O)을 새로 추가한다 — 의도적이며 spec/CHANGELOG 와 일치함을 확인
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` 의 `undoWrite` 호출부 두 곳(`setupChatChannel` 성공 경로의 `wrote===false` 분기, degraded 경로의 `wroteDegraded===false` 분기) · `codebase/backend/src/modules/triggers/triggers.service.ts:926`(`normalizeNotificationSecretRef`) · `:1395`(`rotateBotToken`) · `:1512`(`promoteRotatedNotificationSecrets`)
  - 상세: 이 다섯 자리 모두 종전엔 "락 안 재기록이 행 부재를 만나면 아무것도 하지 않고 넘어간다"(rotateBotToken 은 즉시 404, 나머지는 그냥 통과)였다. 이번 PR 은 그 자리마다 `undoAbsentTriggerWrite`/`undoAbsentWrite`를 붙여, 행이 사라진 트리거에 대해 방금 등록한 provider 콜백을 `teardownChannelConfig`로 실제로 되돌리는 **새 외부 HTTP 호출**을 추가한다. 코드 리뷰 체크리스트의 "네트워크 호출: 의도하지 않은 외부 서비스 호출" 관점에서 반드시 짚어야 할 변경이지만, 직접 대조한 결과 (1) `CHANGELOG.md` Unreleased 항목이 정확히 이 동작을 예고하고 있고, (2) `trigger-resource-release.spec.ts`·`triggers.service.spec.ts`(락 안 재읽기 describe 블록)·e2e(`trigger-deletion-releases-resources.e2e-spec.ts`)가 이 새 호출을 명시적으로 단언·재현하며, (3) 함수 자체가 `try/catch`로 감싸 provider 실패를 삼키고 로그만 남겨(호출자에게 던지지 않음) best-effort 계약을 지킨다. 의도치 않은 부작용이 아니라 이 PR 의 핵심 목적(자원 누수 봉쇄)임을 확인했다.
  - 제안: 조치 불필요. 다만 다음에 이 다섯 호출부 중 하나에서 `undoWrite`/`undoAbsentWrite` 호출을 빼는 리팩터가 있으면, 그 자체가 이번에 막은 리소스 누수 클래스의 재발이라는 점을 리뷰 시 상기할 것.

- **[INFO]** `TriggersService`·`WorkspacesService`·`WorkflowsService` 생성자 시그니처가 바뀌었다 — DI 전용 호출이라 실질 영향 없음을 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:244-260`(`ChannelListenerRegistry` 제거, `TriggerResourceReleaserService` 추가) · `codebase/backend/src/modules/workspaces/workspaces.service.ts` 생성자(`ModuleRef` 추가) · `codebase/backend/src/modules/workflows/workflows.service.ts` 생성자(`ModuleRef` 추가)
  - 상세: `grep -rln "new WorkspacesService(\|new WorkflowsService(\|new TriggersService("` 로 저장소 전체를 확인한 결과 프로덕션·테스트 어디서도 이 클래스들을 수동으로 `new` 하는 곳이 없다 — 전부 Nest DI(`@Injectable` + `Test.createTestingModule`)를 거친다. 관련 스펙 파일(`triggers.service.spec.ts`·`triggers.web-chat.spec.ts`·`workspaces.service.spec.ts`)의 provider 배열도 각각 `TriggerResourceReleaserService`/`TRIGGER_RESOURCE_RELEASER` mock 을 추가해 새 의존성을 반영했다. `ModuleRef` 는 Nest 테스트 모듈에 자동 바인딩되는 코어 provider라 별도 mock 없이도 주입된다 — 두 서비스 스펙 파일에 `ModuleRef` mock 이 없는 것은 누락이 아니다.
  - 제안: 조치 불필요.

## 검증한 항목 (문제 없음 — 근거만 기록)

- `secret-ref.ts` 신규 `buildSecretRefPrefix`: `buildSecretRef({...parts, name:'x'})` 로 만든 뒤 마지막 1글자를 잘라내는 구현이 `secret-ref.spec.ts` 3건(정상 접두·이웃 id 비충돌·형식 검증 위임)으로 뒷받침됨. 문자열 변환 로직이 없어 인코딩 불일치 위험 없음.
- `SecretResolverService.deleteByPrefix` 의 LIKE 메타문자(`% _ \`) 거부 가드는 이번 PR 로 호출부가 여러 모듈에 늘어난 뒤에도 트리거 `id` 가 UUID(`@PrimaryGeneratedColumn('uuid')`)라 메타문자가 섞일 수 없다는 전제를 유지한다 — 런타임 가드가 실제 방어선이라 위 WARNING 은 사실 나열의 정확성 문제이지 실행 시점 취약점은 아니다.
- `schedules.module.ts` 에 새로 추가된 `SecretStoreModule` import 는 `secret-store.module.ts` 를 직접 열어 `imports: [ConfigModule, TypeOrmModule.forFeature([SecretStore])]` 뿐임을 확인 — 순환 의존 없음 주석이 사실과 일치.
- `chat-channel-binder.service.ts` 의 `ChatChannelBinderService` ↔ `TriggerResourceReleaserService` 순환 여부: 전자는 `undoAbsentTriggerWrite`(순수 함수)만 import 하고 후자 서비스 클래스는 import 하지 않는다 — 실제 constructor 순환 없음.
- `trigger-deletion-releases-resources.e2e-spec.ts` 는 두 개의 독립된 `describe` 블록이 각각 자체 `db`/`ds`/`scheduleQueue` 를 선언·정리(`afterAll`)한다 — 핸들 이중 정리·leak 없음. `jest.config.ts` 주석이 예고한 "BullMQ Queue 도 afterAll 에서 닫는다" 주장과 실제 `scheduleQueue.close()`/`ds.destroy().catch(...)` 호출이 일치.
- `TriggerResourceReleaserService.lockParentAndListTriggerIds` 의 `TriggerParent`(`{workflowId}` | `{workspaceId}`) 를 TypeORM `where` 에 그대로 넘기는 부분은 `Trigger` 엔티티에 실제 `workspaceId`·`workflowId` 컬럼이 존재함을 엔티티 파일에서 직접 확인 — 조용히 틀린 조건이 되는 결함 아님(유지보수성 리뷰의 암묵적 커플링 지적과는 별개로, 지금 당장 잘못된 필터링은 아니다).
- `setLocalLockTimeout` 이 트랜잭션 전체(`SET LOCAL`)에 적용되는 것은 트랜잭션 커밋/롤백 시 자동 해제되는 PostgreSQL 표준 동작이라 다른 세션·트랜잭션으로 새는 전역 부작용이 아니다.

## 요약

이번 PR 은 트리거 삭제 자원 정리를 트리거 삭제 외 세 경로(스케줄·워크플로·워크스페이스)로 확장하고, 삭제와 겹친 다섯 쓰기 경로에 자기-보상(teardown+비밀 삭제) 로직을 추가한다 — 검토한 부작용 관점 중 "네트워크 호출"·"이벤트/콜백" 항목에서 실질적인 새 외부 호출이 여러 곳에 생기지만, 전부 CHANGELOG·spec·전용 단위/e2e 테스트로 뒷받침되는 **의도된** 변경이었다. 시그니처 변경(3개 서비스 생성자)도 DI 전용이라 실사용 호출자에 영향이 없음을 직접 확인했다. 유일하게 짚을 만한 것은 이번 diff 밖에 있는 `secret-resolver.service.ts` 의 JSDoc 이 "호출부는 triggers.service.ts 한 곳뿐" 이라는, 이 PR 로 더 이상 사실이 아닌 주장을 그대로 남기고 있다는 점이다 — 실행 시점 안전은 별도 런타임 가드가 지키므로 기능적 결함은 아니지만, 다음 안전성 재검토의 전제를 흐릴 수 있어 WARNING 으로 기록한다.

## 위험도

LOW
