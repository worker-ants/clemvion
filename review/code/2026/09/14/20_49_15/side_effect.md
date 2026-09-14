# 부작용(Side Effect) Review

## 검토 범위

`trigger.config` lost-update 수정 전체 diff(`origin/main...HEAD`)를 실제 소스로 직접 열어
확인했다. 핵심 파일: `trigger-config-lock.ts`(신규) · `chat-channel-binder.service.ts` ·
`triggers.service.ts` · `hooks.service.ts`(write-site 2곳) · `chat-channel-input-rules.ts`
(신규 `extractInboundSigningRef`) · 관련 테스트/가드 유틸(`trigger-transaction-mock.ts`,
`endpoint-path-conflict-wrap-guard.ts` 등). 이 브랜치는 이미 4라운드의 `/ai-review`
(18_17_44 · 19_07_43 · 19_44_08 · 20_17_16)를 거쳤고 그 사이 두 정정 커밋
(`369852b4f`, `889c93cd9`)이 추가됐다. 이전 라운드가 지적·수정한 항목은 현재 HEAD 코드에서
실제로 반영됐는지 소스 대조로만 확인하고 재차 세지 않았다. `review/`·`plan/`·`CHANGELOG.md`
는 이번 diff 의 산출물/문서이므로 런타임 부작용 관점에서는 해당 없음.

## 발견사항

- **[WARNING]** `remove()` 가 **되돌릴 수 없는 외부 부작용을 먼저 실행한 뒤**, 상한 없는 락
  대기를 마지막 DB 삭제 단계에 새로 얹었다 — 그 대기 중 크래시/타임아웃이 나면 "이미 뜯겼는데
  DB 엔 남아 있는" 반쯤 삭제된 트리거가 생긴다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:932`(`remove()` 시작),
    `:945`(`await this.chatChannelBinder.teardownChatChannel(trigger)` — 외부 HTTP 호출),
    `:948`(`this.channelListenerRegistry.unregister(trigger.id)` — in-memory, 되돌릴 콜백 없음),
    `:950`(`await this.secrets.deleteByPrefix(...)` — secret_store row 영구 삭제),
    `:960-962`(`this.triggerRepository.manager.transaction(async (m) => { await
    acquireTriggerConfigLock(m, id); await m.remove(trigger); })` — 이번 PR(`889c93cd9`)이
    새로 추가한 자리)
  - 상세: `remove()` 는 순서대로 (1) BullMQ job 해제, (2) `teardownChatChannel`(외부 provider
    API 호출), (3) listener registry unregister, (4) secret_store row 영구 삭제를 **락 없이**
    먼저 끝낸 뒤에야 (5) DB 행 삭제를 시도한다. 이번 PR 이전엔 (5)가
    `await this.triggerRepository.remove(trigger)` 단일 쿼리라 사실상 즉시 끝났다.
    `889c93cd9` 는 이 자리를 "삭제도 같은 config 락을 잡는다" 는 근거(정당함 — 창 1 의
    쓰기-시점 삭제 경합을 닫기 위함)로 `manager.transaction()` + `acquireTriggerConfigLock`
    으로 감쌌는데, 이 락은 `trigger-config-lock.ts` JSDoc 이 명시하듯 **`lock_timeout` 이
    없어 다른 보유자가 커밋할 때까지 무한정 기다린다.** 그 "무한 대기가 감당 가능하다" 는
    근거는 *"보유자의 임계 구간이 외부 호출 없는 DB 왕복 두 번으로 짧다"* 는 것인데, 그
    전제는 **락을 잡는 쪽**(각 보유자)에는 성립해도 **락을 기다리는 이 자리**의 위험을
    없애지 않는다 — (1)~(4)가 이미 되돌릴 수 없이 끝난 뒤에 락을 기다리다가 프로세스가
    재시작되거나(배포·크래시) 클라이언트가 타임아웃돼 연결이 끊기면(진행 중인 서버 트랜잭션
    자체는 계속 대기), 최종 실패 시 트리거 행은 DB 에 **그대로 남지만** chat channel 연동·
    listener 등록·secret 은 이미 전부 사라진 상태가 된다. 그 트리거는 조회는 되는데 재시도
    삭제는 이미 사라진 secret/registry 를 다시 지우려 하고(대부분 idempotent 라 무해하겠지만
    `teardownChatChannel` 이 존재하지 않는 외부 리소스에 다시 호출되면 provider 에 따라
    에러가 날 수 있다), 감사 로그(`recordAudit` TRIGGER_DELETED`, `:964`)도 전혀 남지 않는다.
    같은 클래스의 비-원자성(외부 호출 후 DB 실패) 자체는 이 PR 이전에도 있었지만, 이전엔
    마지막 단계가 락 대기 없는 단발 쿼리라 그 창이 매우 좁았다 — 이번 커밋이 그 마지막 단계에
    **상한 없는 대기**를 새로 끼워 넣어 창을 실질적으로 넓혔다. 평상시엔 락 경합이 짧아(같은
    트리거를 겨냥한 동시 PATCH/rotate 가 드물고 있어도 임계 구간이 짧아) 영향이 미미하겠지만,
    보유자 쪽에서 예기치 못하게 트랜잭션이 오래 걸리는 사고(커넥션 풀 고갈·GC 정지·버그로
    커밋 안 되는 트랜잭션)가 나면 정확히 이 자리가 그 사고를 "돌이킬 수 없는 리소스 정리 후
    DB 삭제 미완료" 로 증폭한다.
  - 제안: 이 삭제 경로에 한해 `SET LOCAL lock_timeout` (`trigger-config-lock.ts` JSDoc 이 이미
    "임계 구간에 외부 호출/긴 계산이 들어가면 걸어야 한다" 고 예고한 바로 그 조치)를 적용해
    무한 대기를 드러나는 오류로 바꾸거나, 최소한 (2)~(4)의 외부/영구 부작용을 (5)의 DB 삭제
    **성공 확인 뒤**로 옮기는 순서 변경을 검토할 것. 지금 순서를 유지해야 한다면 최소한 (5)
    실패 시 (2)~(4)가 이미 끝났다는 사실을 감사·로그에 남겨 운영이 반쯤 삭제된 트리거를
    발견할 수 있게 하는 것을 권고.

## 확인한 것 — 이전 라운드가 지적한 CRITICAL/WARNING 이 현재 HEAD 에 실제로 반영됨

- **창 1 삭제-트리거 부활(`19_44_08` side_effect CRITICAL, `369852b4f` 로 수정)**: 현재
  `triggers.service.ts:611-621` 이 락 안 재읽기(`fresh`)가 없으면 `NotFoundException` 을
  던지고 `m.save()` 를 부르지 않는다. `save()` 의 insert-on-missing-row 시맨틱으로 삭제된
  트리거가 되살아나는 경로가 닫혀 있다.
- **읽기 시점 가드는 쓰기 시점 삭제 경합을 못 막는다(`20_17_16` database·concurrency
  WARNING#2, `889c93cd9` 로 수정)**: `remove()` 가 이제 같은 `acquireTriggerConfigLock` 을
  잡은 뒤 `m.remove(trigger)` 를 부른다(`:960-962`) — 위 새 WARNING 은 이 수정 자체를
  되돌리라는 것이 아니라, 이 수정이 새로 만든 **부수적** 위험(락 대기 위치)을 향한다.
- **`setupChatChannel` 성공 경로가 삭제-경합의 "쓰기 skip" 신호를 무시하고 유령 listener 를
  등록하던 gap(`20_17_16` side_effect INFO)**: 현재 `chat-channel-binder.service.ts:266-291`
  이 `const wrote = await rewriteTriggerConfigLocked(...)` 의 반환값을 `if (wrote) { ...
  register(...) }` 로 실제로 소비한다 — 지적된 gap 이 닫혀 있음을 확인했다.
- **hooks hot path 두 자리 중 한 자리 누락(`19_44_08` testing CRITICAL#2)**: 현재
  `hooks.service.ts` 의 두 호출부(`handleWebhook`, chat-channel 인입) 모두
  `touchLastTriggeredAt()` 을 공유해 `triggerRepository.update({id}, {lastTriggeredAt})` 만
  실행한다 — `save(trigger)` 로 `config` 전체가 함께 쓰이는 경로는 없다.

## 확인한 것 — 부작용 없음으로 판정

- **`save()` → `update()` 전환이 TypeORM 리스너/특수 컬럼을 우회하지 않는다**: `Trigger`
  엔티티에 `@BeforeUpdate`/`@AfterUpdate`/`EntitySubscriberInterface` 구현이 저장소 전체에
  0건(재확인)이고, `Trigger.updatedAt` 은 `@UpdateDateColumn`(`trigger.entity.ts:162`)인데
  TypeORM 의 `UpdateQueryBuilder`(`node_modules/typeorm/query-builder/UpdateQueryBuilder.js:
  397-405`)가 `updateEntity` 옵션이 꺼지지 않은 한(`Repository.update()`/`EntityManager.update()`
  경로 모두 끄지 않음) `@UpdateDateColumn`/`@VersionColumn` 값을 자동으로 함께 SET 하므로,
  `hooks.service.ts` 의 `save`→`update` 전환으로 `updatedAt` 갱신이 빠지는 회귀는 없다.
- **전역 변수 / 환경 변수**: 새로 읽거나 쓰는 프로세스 전역 mutable 상태 없음.
  `TRIGGER_CONFIG_LOCK_PREFIX`·`TRIGGER_ENTITY` 는 모듈 스코프 `export const`.
- **시그니처/공개 API**: `rewriteTriggerConfigLocked`·`acquireTriggerConfigLock`·
  `triggerConfigLockKey`·`extractInboundSigningRef` 는 전부 신규 export. `TriggersService.
  update()`/`create()`/`rotateBotToken()`/`remove()` 의 파라미터·반환 타입은 변경 없음(내부
  구현만 교체). 다만 `rotateBotToken()`(`triggers.service.ts:1224-1228`)은 그 사이 트리거가
  삭제되는 경합에서 종전의 "묵시적 200 + 거짓 성공 감사 기록" 대신 이제 `NotFoundException`
  (404)을 던진다 — 컨트롤러(`triggers.controller.ts:286-305`)를 통해 그대로 API 응답에
  반영되는 **관측 가능한 인터페이스 변화**다. 의도된 수정(삭제된 트리거에 대한 거짓 성공
  응답 제거)이고 매우 좁은 race window 에서만 트리거되므로 차단 사유는 아니지만, API 계약
  관점에서 이 신규 실패 모드는 기록해 둘 가치가 있다.
- **네트워크 호출**: `adapter.setupChannel`·`secrets.rotate`·`secrets.resolve` 의 호출
  횟수·순서·인자는 이번 diff 로 바뀌지 않는다. 세 곳 모두 "외부 호출을 락 밖에 둔다" 는
  제약이 실제로 지켜짐을 각 호출부에서 직접 확인했다(위 신규 WARNING 이 지적하는 것은
  `remove()` 에서 외부 호출이 락 밖에 있다는 사실 자체가 아니라, 그 호출들이 끝난 **뒤**의
  락 대기가 새로 상한 없이 길어질 수 있다는 것).
- **파일시스템**: 프로덕션 코드에 새 파일 생성/삭제 없음. `endpoint-path-conflict-wrap-guard.ts`
  는 `fs`/`ts.createProgram` 으로 소스를 읽기만 하고(쓰기 없음) `src/repo-guards/__tests__/`
  하위 정적 분석 전용이라 런타임에 로드되지 않는다.
- **테스트 인프라 격리**: `withTransactionMock`(신규)은 인자로 받은 mock 을 스프레드해 새
  객체를 반환하거나(이미 `manager` 있으면 원본 참조 그대로 반환 — 이 경우도 mutate 하지
  않음) 여러 spec 파일 사이에 상태를 공유하지 않는다.

## 요약

핵심 수정(창 2~4 의 advisory-lock 재읽기, 창 1 의 삭제 스킵, `hooks.service.ts` 컬럼 한정
update, 유령 listener 등록 gap)은 이전 네 라운드가 지적한 부작용을 실제로 닫았음을 소스
대조로 확인했다. `save()`→`update()` 전환도 TypeORM 리스너·`@UpdateDateColumn` 우회 없이
안전함을 직접 검증했다. 이번 라운드에서 새로 발견한 것은 하나 — 가장 최신 커밋(`889c93cd9`)이
`remove()` 의 마지막 DB 삭제 단계에 **상한 없는** advisory lock 대기를 추가했는데, 그 앞
단계(`teardownChatChannel` 외부 호출·listener unregister·secret 영구 삭제)는 이미 되돌릴 수
없이 끝난 뒤라, 흔치 않은 사고(락 보유자의 트랜잭션이 예기치 못하게 길어지는 상황 + 그 사이
프로세스 재시작/요청 취소)가 겹치면 "리소스는 다 뜯겼는데 DB 행은 남아 있는" 반쯤 삭제된
트리거를 만들 수 있다는 점이다. 이 자체가 삭제 경합을 닫기 위한 정당한 수정의 부산물이고
평상시 위험은 낮지만(같은 트리거를 겨냥한 락 경합이 드물고 짧음), 그 lock 이 원래 "짧은
임계 구간을 가정한 무제한 대기" 설계였던 것을 원자적이지 않은 삭제 시퀀스의 **마지막 회복
불가 단계**에 그대로 재사용한 것은 코드 리뷰 시점에 명시적으로 검토할 가치가 있다. 그 외
전역 변수·환경 변수·시그니처·공개 API(단 `rotateBotToken` 의 새 404 실패 모드 제외)·
TypeORM 리스너 우회·네트워크 호출·파일시스템 관점에서는 추가로 지적할 사항이 없다.

## 위험도

MEDIUM
