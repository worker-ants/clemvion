# 부작용(Side Effect) Review — trigger-config-lost-update (10라운드째, 마지막 커밋 `833bb745a` 이후 첫 검토)

## 검토 방법

`origin/main...HEAD` 전체 diff 를 프롬프트로 받았고, 프롬프트에서 생략된 파일
(`trigger-config-lock.ts`·`chat-channel-binder.service.ts`·`triggers.service.ts`·
`triggers.service.spec.ts`·`schedules.service.ts` 등)은 저장소에서 `Read`/`git show` 로 원문을
직접 확인했다. 이 PR 은 이미 9라운드에 걸쳐 다관점 리뷰를 받았고
(`review/code/2026/09/14/{18_17_44 … 23_01_18}`), 가장 최근 커밋 `833bb745a`(23_37 커밋, 직전
라운드 `23_01_18` 의 Critical 1·Warning 1 을 처리)가 이번이 처음 검토되는 상태다. 아래는 그
최신 커밋이 **실제로 주장하는 수정 효과를 냈는지**를 코드 추적으로 검증한 결과다. 저장소
파일은 뮤테이션하지 않았다 (`git status --short` 로 확인, `review/code/2026/09/14/23_38_09/`
산출물 외 잔여 없음).

## 발견사항

- **[CRITICAL]** `rotateBotToken` 의 "네 번째 자리" 수정이 실제로는 lost-update 를 닫지 못한다 — `mergeIntoFreshSubKey` 의 `patch` 인자에 **델타가 아니라 전체 스냅샷**을 넘긴다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1199`(초기 비-락 읽기
    `chatChannelCfg`), `:1263`(`mergedConfig = { ...chatChannelCfg, botTokenRef }`),
    `:1282-1287`(`mergedChannel = { ...mergedConfig, ...(result.configUpdates ?? {}), botTokenRef, inboundSigningRef }`),
    `:1314-1320`(`this.mergeIntoFreshSubKey(freshConfig, 'chatChannel', mergedChannel, mergedChannel)`)
    — 헬퍼 정의는 `:380-392`.
  - 상세: `mergeIntoFreshSubKey(freshConfig, key, patch, fallback)` 는
    `{ ...freshConfig, [key]: { ...base, ...patch } }` 를 반환한다(`:391`) — 즉 `patch` 에 있는
    키는 락 안에서 재읽은 `base`(=`freshConfig[key]`)를 **무조건 덮어쓴다**. 이 함수를 올바르게
    쓰는 자리(`normalizeNotificationSecretRef:869-874` 의 `{ signing: updatedSigning }`,
    `revokePerTriggerToken:1149-1154` 의 `{ triggerToken: newToken }`,
    `promoteRotatedNotificationSecrets:1432-1437` 의 `{ signing: updatedSigning }`)는 전부
    `patch` 를 **이번 호출이 실제로 바꾼 필드만**으로 좁혀서, 재읽은 `base` 의 나머지 필드가
    살아남게 한다. 그런데 `rotateBotToken`(`:1314-1320`, 커밋 `833bb745a` 신설)은 `patch` 자리에
    `mergedChannel` **전체**를 넘긴다. `mergedChannel` 은 `mergedConfig`(`:1263`)를 경유해
    `chatChannelCfg`(`:1199`, **락 없이 함수 시작 시점에 읽은 스냅샷**)를 통째로 스프레드해
    만든 객체라, `provider`·`uiMapping`·`rateLimitPerMinute`·`languageLocale` 등 이 회전과
    무관한 기존 필드를 **전부** 담고 있다. 그래서 `setupChannel` 의 외부 HTTP 호출이 진행되는
    동안(바로 이 PR 이 "임계 구간" 이라고 부르는 그 구간) 동시 PATCH 가 `chatChannel.uiMapping`
    이나 `rateLimitPerMinute` 를 바꿔 커밋해도, 락 안 재읽기(`freshConfig`)가 그 새 값을 보더라도
    `patch=mergedChannel` 이 **함수 시작 시점의 옛 값으로 그 자리를 다시 덮어쓴다**. 결과적으로
    이 호출부는 `mergeIntoFreshSubKey` 를 거치지만 실질적으로는 **여전히 스냅샷 통째 대입과
    거의 동일한 결과**를 낸다 — `botTokenRef`/`inboundSigningRef`/`result.configUpdates` 의
    키를 제외한 모든 `chatChannel` 서브필드에서, 이 PR 전체가 닫으려는 것과 **같은 클래스의
    lost update** 가 그대로 재발한다. 커밋 메시지 자체가 "8라운드에 만든 `mergeIntoFreshSubKey`
    를 여기에도 적용했다"고 적어 이 자리가 고쳐졌다고 선언하지만, 실제 효과는 helper 를
    거치는 형태만 바뀌었을 뿐 그 안전장치가 동작하지 않는다.
  - 왜 회귀 테스트가 이걸 못 잡았나: 같은 커밋이 추가한
    `triggers.service.spec.ts:4082-4107`(`'rotateBotToken — 재읽은 chatChannel 의 다른 필드가
    살아남는다'`)는 `freshWithRate`(락 안 재읽기)에 `rateLimitPerMinute: 99` 를 넣지만,
    이 테스트의 `makeService`(`:3708` 이하)가 쓰는 바깥(비-락) `findOne` mock 은 `withoutRef()`
    (`:3676-3677`, `rateLimitPerMinute` **없음**)로 고정돼 있다. 그래서 `chatChannelCfg`(함수
    시작 시점 스냅샷)에는 애초에 `rateLimitPerMinute` 키가 **존재하지 않고**, 그 결과
    `mergedChannel` 에도 그 키가 없어 `patch` 가 그 키를 덮어쓸 수가 없다 — `base` 의 `99` 가
    살아남는 것은 병합 로직이 옳아서가 아니라 **patch 에 같은 키가 아예 없어서**다. 이 저장소
    memory 의 "판별 fixture 는 두 상태가 **같은 키를 다른 값**으로 가져야 한다"는 규율(바로 위
    `withRef`/`withoutRef` 주석이 스스로 이 규율을 설명하고 있다, `:3671-3674`)이 이 새 테스트
    자신에는 적용되지 않았다 — 초기 스냅샷과 락-재읽기 양쪽에 **같은 키를 다른 값**으로 둬야
    (예: `chatChannelCfg` 에 `rateLimitPerMinute: 30`, `freshConfig.chatChannel` 에는 `60`) 이
    결함이 드러난다.
  - 제안: `rotateBotToken` 의 병합 호출을 다른 세 자리와 같은 패턴으로 좁힌다 —
    `this.mergeIntoFreshSubKey(freshConfig, 'chatChannel', { ...(result.configUpdates ?? {}),
    botTokenRef, inboundSigningRef }, mergedChannel)` (patch 는 이번 회전이 실제로 산출한
    필드만, fallback 만 기존처럼 `mergedChannel` 전체). 그 뒤 회귀 테스트의 `withoutRef`(바깥
    스냅샷)에도 `rateLimitPerMinute` 를 **다른 값으로** 채워, patch 축소가 실제로 효과가 있음을
    뮤테이션(패치를 다시 `mergedChannel` 전체로 되돌리기)으로 확인해야 한다.

## 그 외 확인한 것 — 이번 라운드 기준 새 위험 없음

- **`@UpdateDateColumn` 자동 갱신**: `Trigger.updatedAt`(`entities/trigger.entity.ts:162`)은
  `save()`→`update()` 전환에도 값이 비지 않는다 — 설치된 `typeorm@0.3.31` 의
  `UpdateQueryBuilder.js`(`metadata.updateDateColumn` 분기, 약 397-405행)를 직접 열어
  `Repository.update()`/`EntityManager.update()` 가 엔티티 메타데이터를 타는 한(둘 다 raw 테이블
  명이 아니라 엔티티 클래스를 받으므로 그렇다) `updated_at = CURRENT_TIMESTAMP` 를 자동으로
  덧붙임을 소스 레벨에서 재확인했다(이전 라운드 `20_49_15` 의 같은 결론과 일치).
- **TypeORM 리스너/서브스크라이버 우회**: `@BeforeUpdate`/`@AfterUpdate`/`EntitySubscriberInterface`
  구현이 `codebase/backend/src` 전체에 0건이라(재확인), `save()`→`update()` 전환으로 실제
  우회되는 훅이 없다.
- **트랜잭션 중첩**: `rewriteTriggerConfigLocked`(`trigger-config-lock.ts:136-173`)의
  `manager.transaction()` 을 부르는 세 자리(`chat-channel-binder.service.ts:266,310` /
  `triggers.service.ts` 의 `normalizeNotificationSecretRef`·`revokePerTriggerToken`·
  `rotateBotToken`·`promoteRotatedNotificationSecrets`) 모두, 호출 시점에 바깥 트랜잭션이 이미
  커밋된 뒤(외부 HTTP 호출 이후 또는 `create`/`update` 본 트랜잭션 완료 이후)라 별도 커넥션의
  독립 트랜잭션으로 안전하게 열린다 — 진행 중인 트랜잭션 안에서 다시 `manager.transaction()`
  을 호출해 예기치 않은 savepoint/커넥션 분리가 생기는 자리는 없었다.
  `SchedulesService.update()`(`schedules.service.ts:233-247`)의 trigger 컬럼 동기화는 advisory
  lock 없이 `triggerRepository.update()` 만 쓰지만, 이 경로가 바꾸는 것은 `name`/`isActive`
  단일 컬럼뿐이라(JSONB 병합이 아님) 그 자체로는 lost-update 위험이 없다. 다만 `plan/in-progress/
  trigger-config-lost-update.md:579`(9라운드 W2)가 이미 "창 1(`TriggersService.update()`)의
  아직-미해결 `save(trigger)` 와 경합하면 방금 커밋된 `isActive` 가 되돌아갈 수 있다"를 후속
  항목으로 등재해 뒀고, 이번 라운드에 코드 대조 결과 그 서술과 현재 코드가 정확히 일치한다 —
  새로 발견한 것이 아니라 추적 상태 재확인이다.
- **시그니처/공개 API/환경 변수/네트워크 호출**: 이번 diff 로 컨트롤러·DTO·라우트·응답
  스키마·환경 변수 읽기/쓰기 변경은 없다. 신규 export(`rewriteTriggerConfigLocked`·
  `acquireTriggerConfigLock`·`triggerConfigLockKey`·`extractInboundSigningRef`·
  `TRIGGER_ENTITY`)는 전부 모듈 내부/테스트 유틸리티 성격이라 외부 호출자 계약에 영향이 없다.
  외부 provider 호출(`adapter.setupChannel`/`secrets.rotate`/`secrets.resolve`)의 횟수·순서는
  이전 라운드들이 검증한 대로 이번 마지막 커밋에서도 바뀌지 않았다.

## 요약

가장 최근 커밋(`833bb745a`)이 직전 라운드가 지적한 두 항목(cleanup 경로 테스트 부재, `rotateBotToken`
의 "네 번째 자리")을 처리했다고 선언했으나, 실측 결과 **`rotateBotToken` 쪽은 실제로 고쳐지지
않았다** — `mergeIntoFreshSubKey` 의 `patch` 인자에 이번 회전의 델타가 아니라 함수 시작 시점의
전체 스냅샷(`mergedChannel`)을 넘겨, 락 안 재읽기로 얻은 최신 `chatChannel` 서브필드를 여전히
덮어쓴다 — `botTokenRef`/`inboundSigningRef`/`result.configUpdates` 를 제외한 모든 필드에서 이
PR 이 막으려는 것과 같은 클래스의 lost update 가 재발한다. 새로 추가된 회귀 테스트는 두 상태
(초기 스냅샷/락-재읽기)에 겹치는 키를 두지 않아 이 결함을 잡지 못하는 vacuous 케이스다. 이 한
지점을 제외하면, `@UpdateDateColumn` 자동 갱신·리스너 우회 부재·트랜잭션 중첩 부재·공개 API/환경
변수/네트워크 호출 무변경 등 이전 9라운드가 검증해 온 안전장치는 이번 라운드에서도 유지되고
있음을 소스 대조로 재확인했다.

## 위험도

CRITICAL
