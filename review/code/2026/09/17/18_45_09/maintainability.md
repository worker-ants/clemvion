# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** 지연 해석 헬퍼 `triggerResourceReleaser()`가 두 파일에 사실상 동일하게 복제됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:300`(정의 시작, JSDoc 292-299) / `codebase/backend/src/modules/workspaces/workspaces.service.ts:593`(정의 시작, JSDoc 588-592)
  - 상세: 두 서비스 모두 `private triggerResourceReleaser(): TriggerResourceReleasePort { return this.moduleRef.get<TriggerResourceReleasePort>(TRIGGER_RESOURCE_RELEASER, { strict: false }); }` 를 토씨 하나 다르지 않게 반복한다. JSDoc 문구도 "못 찾으면 던진다"는 같은 취지를 각자 다른 문장으로 다시 쓰고 있어, 정책이 바뀌면(예: 실패 시 재시도·캐싱 추가) 두 곳을 동시에 고쳐야 하고 하나만 고치면 조용히 drift 한다.
  - 제안: 이 6줄+JSDoc을 `trigger-resource-release.ts`(이미 `TRIGGER_RESOURCE_RELEASER` 토큰·포트 인터페이스의 SoT)에 `resolveTriggerResourceReleaser(moduleRef: ModuleRef): TriggerResourceReleasePort` 같은 공용 함수로 옮기고 두 서비스는 이를 호출만 하게 한다.

- **[WARNING]** `ChatChannelBinderService.setupChatChannel`(이미 260줄이 넘는 단일 함수, `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:88-351`)에 거의 동일한 보상 호출 블록이 두 번 추가됨
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:296-305`(성공 경로 `wrote===false`) 및 `:340-347`(degraded 경로 `wroteDegraded===false`)
  - 상세: 두 블록 모두 `undoAbsentTriggerWrite({ teardown: () => this.teardownChannelConfig(trigger.id, <cfg>), secrets: this.secrets, logger: this.logger }, trigger.id, '<caller>')` 형태로, `<cfg>`(`buildChannel({}, result)` vs `internalCfg`)와 caller 문자열만 다르다. 이미 가장 긴 함수 중 하나인 `setupChatChannel`에 거의 동일한 10줄 블록을 두 번 더 넣어 길이·중첩·순환복잡도를 함께 늘렸다.
  - 제안: `const undoWrite = (cfg: ChatChannelConfig, caller: string) => undoAbsentTriggerWrite({ teardown: () => this.teardownChannelConfig(trigger.id, cfg), secrets: this.secrets, logger: this.logger }, trigger.id, caller);` 로 로컬 헬퍼를 만들어 두 호출부를 각각 1줄로 줄인다.

- **[WARNING]** `triggerSecretPrefix()`가 `secret-ref.ts`의 URI 빌더를 재사용하지 않고 스킴을 별도로 하드코딩함
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts:27-29`
  - 상세: `secret://<scope>/<resourceId>/<name>` 형식의 단일 SoT는 `secret-store/secret-ref.ts`의 `buildSecretRef({scope, resourceId, name})`인데, 신규 `triggerSecretPrefix(triggerId)`는 `` `secret://triggers/${triggerId}/` `` 를 독립적으로 조립한다. 두 곳 모두 `'triggers'` scope 리터럴을 따로 갖고 있어, URI 스킴이 바뀌면(예: 세그먼트 순서·구분자 변경) 한쪽만 고치고 다른 쪽(삭제 시 쓰는 접두 매칭)을 놓칠 위험이 생긴다 — 이 접두는 `deleteByPrefix`의 LIKE 매칭 대상이라 어긋나면 조용히 아무것도 안 지우거나 과도하게 지운다.
  - 제안: `secret-ref.ts`에 `buildSecretPrefix(scope: string, resourceId: string): string` 류의 헬퍼를 추가해 `buildSecretRef`와 같은 정규식 검증을 공유하고, `triggerSecretPrefix`는 그걸 `buildSecretPrefix('triggers', triggerId)`로 위임한다.

- **[INFO]** `TriggerParent` 객체를 TypeORM `where` 절로 그대로 재사용하는 암묵적 커플링
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:56`(`this.triggerRepository.find({ where: parent })`), `:78-79`(`manager.find(Trigger, { select: { id: true }, where: parent })`)
  - 상세: `TriggerParent = { workflowId: string } | { workspaceId: string }` 타입을 그대로 TypeORM의 `where`로 넘긴다. 이는 `Trigger` 엔티티의 컬럼명이 `workflowId`/`workspaceId`와 정확히 일치해야만 성립하는 암묵적 계약인데, 호출부 어디에도 그 사실이 주석으로 없다. 둘 중 하나가(엔티티 컬럼 리네임 등) 바뀌면 컴파일은 통과하고 쿼리만 조용히 잘못될 수 있다.
  - 제안: `TriggerParent` 정의부(`trigger-resource-release.ts:107-108`) JSDoc에 "이 타입은 `Trigger` 엔티티의 FK 컬럼명과 동일해야 하며 TypeORM `where` 절로 직접 재사용된다"는 한 줄을 남긴다.

- **[INFO]** `lockParentAndListTriggerIds`의 if/else 두 분기가 구조를 그대로 반복
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:64-76`
  - 상세: `if ('workflowId' in parent) { manager.findOne(Workflow, {...}) } else { manager.findOne(Workspace, {...}) }` — 두 분기가 엔티티 클래스와 `where.id` 값만 다르고 `select`/`lock` 옵션은 동일하게 반복된다. 지금은 부모 타입이 둘뿐이라 문제는 작지만, 세 번째 부모 타입이 추가되면 같은 형태의 분기가 하나 더 늘어난다.
  - 제안: 필수는 아님. 부모가 늘어날 계획이 있다면 `[entity, id] = 'workflowId' in parent ? [Workflow, parent.workflowId] : [Workspace, parent.workspaceId]` 형태로 공통화하는 것을 고려.

## 요약

새 파일 `trigger-resource-release.ts`(순수 함수 + 정책 SoT)와 `trigger-resource-releaser.service.ts`(Nest 배선)는 책임 분리가 명확하고, 각 함수(`deleteTriggerSecretsAfterCommit`·`undoAbsentTriggerWrite`·`releaseExternalMany`)의 길이·중첩이 적절하며 JSDoc이 "왜"를 충실히 설명해 저장소의 기존 문서화 관례와 일치한다. `WorkspacesService.assertWorkspaceDeletable` 추출처럼 기존 중복(트랜잭션 안/밖 검사)을 오히려 줄인 부분도 있다. 다만 네 삭제 경로에 배선을 반복 이식하는 과정에서 (1) 두 서비스에 동일한 지연 해석 헬퍼가 그대로 복제됐고, (2) 이미 가장 큰 함수인 `setupChatChannel`에 거의 동일한 보상 호출 블록이 두 번 더 추가돼 길이·복잡도가 늘었으며, (3) 신규 시크릿 접두 빌더가 기존 URI 빌더(`secret-ref.ts`)를 재사용하지 않고 스킴을 별도로 하드코딩했다. 셋 다 지금 당장 동작을 해치지는 않지만 다음 변경에서 두 곳 중 한 곳만 고쳐질 위험(drift)을 남긴다.

## 위험도

LOW
