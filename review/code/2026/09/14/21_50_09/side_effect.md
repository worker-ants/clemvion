# 부작용(Side Effect) Review — trigger-config-lost-update (7라운드, 최종 상태 재검증)

## 검토 범위 및 방법

`origin/main...HEAD` 전체 diff(127 파일, 대부분 이전 라운드 리뷰 산출물)를 확인했고, 실제
런타임 코드가 있는 파일은 다음으로 좁혔다: `hooks.service.ts`/`hooks.service.spec.ts`,
`triggers.service.ts`/`triggers.service.spec.ts`, `trigger-config-lock.ts`/`.spec.ts`,
`chat-channel-binder.service.ts`, `chat-channel-input-rules.ts`/`.spec.ts`,
`trigger-transaction-mock.ts`, `triggers.web-chat.spec.ts`, repo-guard 정적 분석 스크립트
3종, `trigger-config-lost-update.e2e-spec.ts`. 이 변경은 이미 6라운드(`18_17_44`~`21_18_21`)
`/ai-review` 를 거쳤고 직전 라운드(`21_18_21`, 14인 전수 Critical 0)가 지적한 두 항목
(WARNING#6 `SET LOCAL lock_timeout` 범위 서술 부정확, INFO orphan JSDoc)이 마지막 커밋
(`bf2becd0c`)에서 실제로 반영됐는지를 소스 대조로 재확인하는 방식으로 진행했다. 저장소에
쓰기는 하지 않았다 — `git status --short` 로 확인, 이 세션이 만든 산출물 디렉터리 외 변경 없음.

## 발견사항

지적할 CRITICAL/WARNING 은 없다. 직전 라운드에서 열려 있던 두 건은 아래와 같이 코드 상태로
확인된다.

- **[INFO]** (해소 확인) `SET LOCAL lock_timeout` 의 실제 적용 범위(advisory lock 한 줄이
  아니라 같은 트랜잭션의 `DELETE` 행 잠금·`Schedule` CASCADE 연쇄까지)가 이제 JSDoc 에
  명시됐다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:47-55`
    (`acquireTriggerConfigLock` 내부 주석, `review/code/2026/09/14/21_18_21` side_effect
    WARNING#6 인용 포함)
  - 상세: 이전 라운드가 "advisory lock 하나만 겨눈 문서가 실제로는 트랜잭션 전체 락 대기에
    적용된다"고 지적했던 것을, 범위를 좁히는 코드 변경(`RESET`) 대신 **문서 정정**으로
    닫았다. 이는 원 지적의 제안 (1)(2) 중 (2)를 택한 것이고, 발생 조건이 좁고(비참여 writer
    가 5초 이상 같은 행 점유) 실패해도 트랜잭션 롤백이라 데이터 손상이 없다는 원래 판단과도
    일치한다. 재-flag 하지 않는다.
  - 제안: 없음(수용됨).

- **[INFO]** (해소 확인) orphan JSDoc — `touchLastTriggeredAt` 삽입으로 밀려났던
  `markChatChannelRateLimited` 의 CCH-NF-03 docblock 이 제자리로 복귀했다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:957-984`
  - 상세: `git show bf2becd0c -- codebase/backend/src/modules/hooks/hooks.service.ts` 로
    확인 — CCH-NF-03 블록이 `markChatChannelRateLimited` 선언 바로 위로 이동했고,
    `touchLastTriggeredAt` 은 자신의 JSDoc(`save` 미사용 이유·in-memory 갱신 명시)만 갖는다.
    재-flag 하지 않는다.

- **[INFO]** `EntityManager.update()`/`repository.update()` 로의 전환이 TypeORM
  엔티티 lifecycle 콜백(`@BeforeUpdate`/`@AfterUpdate`)·`@EventSubscriber` 를 우회하는
  특성은 이번 PR 이 `Trigger` 쓰기 4~5곳(`touchLastTriggeredAt`, `rewriteTriggerConfigLocked`
  내부 `m.update`, `remove()`)에 걸쳐 반복 도입한다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:973-980`
    (`touchLastTriggeredAt`), `codebase/backend/src/modules/triggers/trigger-config-lock.ts:170`
    (`m.update(Trigger, { id: triggerId }, patch)`)
  - 상세: 현재 저장소에 `Trigger` 관련 `@EventSubscriber`/`@BeforeUpdate`/`@AfterUpdate` 가
    0건임(`review/code/2026/09/14/19_44_08` side_effect 리뷰가 grep 으로 확인, 이번 라운드도
    동일 결과 재확인)이라 지금은 관측 가능한 부작용이 아니다. `@UpdateDateColumn`(`updated_at`)
    은 `UpdateQueryBuilder` 가 `save()`/`update()` 양쪽에서 자동 반영하므로 그 컬럼도 영향
    없다. 다만 향후 누군가 `Trigger` 에 lifecycle 훅을 추가하면, `save()` 를 계속 쓰는 창
    1(`update()`의 `Object.assign` + `m.save(Trigger, target)`)과 `.update()` 로 컬럼만
    갱신하는 나머지 쓰기 사이에 **훅이 타는 경로와 안 타는 경로**가 이미 갈라져 있다는 점을
    인지하지 못한 채 그 훅에 의존하는 로직을 짤 위험이 있다. 이미 3라운드 이상 반복 검토된
    지점이라 신규 결함은 아니고, 차단 사유도 아니다.
  - 제안: 조치 불요. 후속으로 `Trigger` 에 lifecycle 훅을 추가하는 PR 이 생기면, 이 PR 이
    만든 "일부는 `save`, 일부는 `update`" 이원 구조를 그 PR 의 영향 분석에 명시적으로 포함할
    것.

## 관점별 확인

- **의도치 않은 상태 변경 / 전역 변수**: `trigger-config-lock.ts` export 는
  `TRIGGER_CONFIG_LOCK_PREFIX`·`TRIGGER_DELETE_LOCK_TIMEOUT_MS`(불변 상수)와 순수
  함수(`triggerConfigLockKey`, `acquireTriggerConfigLock`, `rewriteTriggerConfigLocked`)뿐 —
  모듈 레벨 mutable 상태 없음. `previousInboundSigningRef`(`triggers.service.ts:553`)는
  `update()` 메서드 로컬 `let` 이 트랜잭션 콜백 클로저 안에서 재할당되는 것으로, 함수
  스코프를 벗어나지 않는다 — 전역 상태 아님. `trigger.lastTriggeredAt` in-memory 갱신
  (`touchLastTriggeredAt`)은 JSDoc 이 명시한 의도된 동작이고 두 호출부 모두 그 뒤
  `trigger.config` 를 읽지 않아 부수 영향 없음을 재확인했다.
- **파일시스템 부작용**: 코드 변경 자체에 파일 I/O 없음. e2e 스펙(`trigger-config-lost-update.e2e-spec.ts`)이 `afterAll` 에서 자신이 만든 트리거 행만 정리(DB, 파일 아님).
- **시그니처/인터페이스 변경**: `TriggersService.findById`/`update`/`remove`/`rotateBotToken` 등 공개 메서드 시그니처는 변경 없음(내부 구현만 교체). 신규 `private` 메서드
  (`assertTriggerFound`, `throwTriggerNotFound`, `findByIdForUpdate`, `touchLastTriggeredAt`)는 외부
  호출자가 없다. `extractInboundSigningRef(config: unknown): string | undefined` 는 신규 export
  함수지만 기존 인라인 캐스트 3곳을 대체하는 것으로 계약 변경 없음(7갈래 unit 케이스로 커버).
  `withTransactionMock` 은 테스트 전용 유틸로 프로덕션 인터페이스가 아니다. 컨트롤러·DTO·라우트는
  일절 건드리지 않았다.
- **환경 변수**: 신규/변경 없음.
- **네트워크 호출**: 신규 외부 호출 없음. 오히려 이 PR 의 설계(`rewriteTriggerConfigLocked` JSDoc)가
  외부 HTTP 호출을 advisory-lock 트랜잭션 **밖**에 두도록 강제해, 인입 hot path(`hooks.service.ts`)에도
  같은 원칙(config 재작성 자체를 컬럼 한정 `update` 로 좁혀 트랜잭션을 아예 열지 않음)이 적용됐다.
- **이벤트/콜백**: `channelListenerRegistry.register`(성공 시에만) / `unregister`(삭제 시) 호출
  조건은 이전 라운드에서 고정되었고 이번 diff 로 재확인 — 쓰기가 advisory-lock 재읽기에서 skip
  되면(`wrote === false`) register 를 호출하지 않는다(`chat-channel-binder.service.ts:286-291`).
  `withTransactionMock` 의 `onLock`/`onLockTimeout` 콜백은 테스트 관측 고리로 프로덕션에 영향
  없음. repo-guard 정적 분석 스크립트(`endpoint-path-conflict-wrap-guard.ts`)의 `isManagerTriggerSave`
  확장은 빌드/테스트 시점 스캐너 로직 변경이며 런타임 이벤트/콜백과 무관하다.

## 요약

이 라운드는 직전 6라운드가 이미 정착시킨 부작용 관련 결함(fail-open 재발, 삭제된 트리거의
부활, 유령 listener 등록, 무기한 삭제 대기, 부정확한 락 범위 서술, orphan JSDoc)을 코드 상태
대조로 재확인했고, 마지막 커밋(`bf2becd0c`)이 직전 라운드가 지적한 두 건(락 타임아웃 범위
문서, orphan JSDoc)을 실제로 반영했음을 확인했다. 이번 diff 자체(삭제 실패 전파 테스트 강화,
`assertTriggerFound`/`throwTriggerNotFound` 분리, JSDoc 위치 정정)는 새로운 전역 상태·
파일시스템·네트워크·환경변수·시그니처·이벤트 부작용을 만들지 않는다. 유일하게 남겨 둘 만한
관찰은 `save()`→`update()` 전환이 구조적으로 TypeORM lifecycle 훅/subscriber 를 우회한다는
특성인데, 현재 `Trigger` 엔티티에 그런 훅이 0건이라 지금은 관측 가능한 회귀가 아니며 이미
이전 라운드에서 같은 결론으로 검토된 사항이다(INFO, 신규 아님). 부작용 관점에서 이번 배치를
막을 사유는 없다.

## 위험도

LOW
