# 동시성(Concurrency) Review — trigger-config lost-update

## 검토 범위

`trigger.config` lost-update(동시 PATCH 가 서로의 `chatChannel.inboundSigningRef` 를 되돌려
인입 서명 검증이 fail-open 되던 결함)를 advisory lock(`pg_advisory_xact_lock`) + "락 안에서
재읽어 병합" 패턴으로 닫는 변경이다. 직접 원본 파일을 열어 확인했다:
`trigger-config-lock.ts`(신규) · `triggers.service.ts`(update/remove/rotateBotToken) ·
`chat-channel-binder.service.ts`(setupChatChannel) · `hooks.service.ts`(웹훅 hot path) ·
관련 테스트 4종 · `CHANGELOG.md`.

이미 5라운드의 리뷰(18_17_44 → 20_49_15)를 거치며 대부분의 동시성 결함(창1의 형제-컬럼
되돌림, 삭제 경합, 락 대기 상한, listener 유령 등록, presence 게이트 재계산 누락 등)이
실측 기반으로 닫혀 있다. 아래는 그 다섯 라운드가 다루지 않은 잔여 관측이다.

## 발견사항

- **[WARNING]** CHANGELOG 의 "대기 상한은 없다" 서술이 이후 커밋이 추가한 삭제 경로 예외를 반영하지 못해, 구현보다 넓은 보장을 약속하고 있다
  - 위치: `CHANGELOG.md:34-36` (`**대기 상한은 없다** — 같은 트리거의 동시 요청은 앞선 요청이 커밋할 때까지 기다린다...`)
  - 상세: 이 문단은 `12ed21ff1`(창 1 을 락 안으로 옮긴 커밋)에서 작성됐다. 그 뒤 `889c93cd9`("삭제도 같은 락을 잡는다")와 `e5319a409`("...삭제 순서·상한·게이트...")가 `TriggersService.remove()` 에 `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`(`SET LOCAL lock_timeout`) 을 도입했지만, `git show <두 커밋> -- CHANGELOG.md` 로 직접 확인한 결과 **둘 다 이 CHANGELOG 문단을 건드리지 않았다** — 코드·`trigger-config-lock.ts` JSDoc(`TRIGGER_DELETE_LOCK_TIMEOUT_MS` 위 주석, `remove()` 만 예외라고 명시)·`triggers.service.spec.ts` 의 신규 테스트(`update() 는 락 대기에 상한을 두지 않는다 (삭제만 예외다)`)는 전부 "삭제만 상한이 있다" 는 비대칭을 정확히 알고 있는데, 이 CHANGELOG 문단만 "대기 상한은 없다"를 무조건으로 남겨 뒀다. 이 저장소가 반복해서 지적해 온 "문서한 보장이 구현보다 넓다" 패턴과 정확히 같은 모양이며, 이 PR 자신이 락 설계를 소개하는 바로 그 문서에서 발생했다.
  - 제안: 해당 문장을 "대기 상한은 없다(단 삭제 경로는 예외 — `TRIGGER_DELETE_LOCK_TIMEOUT_MS=5s`, 되돌릴 수 없는 정리 뒤에 무한 대기가 반쯤 삭제된 상태를 굳히는 것을 막기 위함)"처럼 정정.

- **[INFO]** 창 1(`update()`)의 재읽기~저장 구간이 짧아졌지만, 락에 참여하지 않는 웹훅 hot path(`touchLastTriggeredAt`)와의 사이에는 여전히 좁은 창이 남아 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` — `const fresh = await m.findOne(Trigger, {...})` 부터 `return m.save(Trigger, target);` 까지의 구간 (트랜잭션 콜백 내부, 대략 588~627행)
  - 상세: 이 구간에서 읽은 `fresh` 는 `lastTriggeredAt` 을 포함한 전체 컬럼을 담고 있고, `target = fresh` 에 `defined`·`config` 만 덮어써 `m.save(Trigger, target)` 로 **엔티티 전체**를 저장한다. `hooks.service.ts` 의 `touchLastTriggeredAt`(신규, 이 PR 이 추가)은 advisory lock 을 잡지 않고 `triggerRepository.update({id}, {lastTriggeredAt})` 만 실행한다 — 의도적으로 그렇다(컬럼 한정 update 는 그 자체로 lost-update 에 안전하기 때문). 그런데 window 1 의 `fresh` SELECT 가 완료된 **직후**, `m.save()` 가 실제로 UPDATE 를 보내기 **전**(둘 사이엔 동기 코드만 있어 JS 이벤트 루프 관점의 창은 매우 좁지만, 두 문장은 별개의 네트워크 왕복이라 완전히 0은 아니다) 웹훅이 `lastTriggeredAt` 을 커밋하면, window 1 의 전체-엔티티 저장이 그 값을 `fresh` 시점의 옛 값으로 되돌릴 수 있다. 이 PR 이전에는 `findById`(검증 전체보다 앞)~`save()`(메서드 끝) 구간이 훨씬 넓어 이 창이 지금보다 컸으므로 **이 PR 이 새로 만든 창은 아니고 오히려 좁혔다** — 다만 5라운드에 걸친 "형제 창" 논의(`review/code/.../19_07_43` database WARNING#2, plan §D W2)는 전부 **advisory lock 에 참여하는** 세 형제(rotateBotToken·binder 성공/실패)가 커밋한 컬럼이 되돌려지는 경우만 다루고, **락에 참여하지 않는** `touchLastTriggeredAt` 이 이 구간에서 되돌려질 수 있다는 축은 plan/CHANGELOG 어디에도 명시되지 않았다.
  - 제안: `lastTriggeredAt` 은 관측용 필드라 되돌아가도 데이터 손상은 아니고(다음 웹훅 호출이 다시 갱신한다), 위험도가 낮아 이번 배치를 막을 사유는 아니다. 다만 plan 의 "형제 창" 표에 "락에 참여하지 않는 컬럼-한정 writer(`touchLastTriggeredAt`)도 같은 구간에서 되돌려질 수 있다"는 한 줄을 추가해, 다음에 이 구간을 넓히는 변경(예: 재읽기와 저장 사이에 새 await 를 끼워 넣는 리팩터)이 이 창을 키우지 않도록 인지시키는 것을 권고.

## 확인했으나 문제 없음 (참고)

- **락 순서·데드락**: 모든 쓰기 경로(창 1·binder 성공/실패·`rotateBotToken`·`remove()`)가 트리거당 **단일** advisory lock key(`trigger-config:<id>`)만 잡고, 그 키를 잡는 순서가 모든 경로에서 "advisory lock → 행 조작"으로 동일하다 — AB-BA 역전 패턴이 없어 데드락 가능성이 없다. `pg_advisory_xact_lock` 은 같은 세션에서 재진입 가능하고 트랜잭션 종료 시 자동 해제되어 예외 경로에서도 락 누수가 없다.
- **`SET LOCAL lock_timeout` 순서**: `acquireTriggerConfigLock` 이 타임아웃을 advisory lock 획득 SQL **이전에** 설정한다(`trigger-config-lock.ts:44-53`) — Postgres 의 `lock_timeout` 은 그 이후 오는 블로킹 문장에만 적용되므로 순서가 올바르다. `triggers.service.spec.ts` 의 `remove() 도 같은 config 락을 잡는다` 테스트가 `["timeout:...", "lock:...", "remove"]` 순서를 직접 단언해 이 순서를 고정한다.
- **임계 구간 내 외부 I/O**: `rewriteTriggerConfigLocked`·창 1 모두 락 보유 중에는 `findOne`/`update`/`save` 두 번의 DB 왕복만 있고 외부 HTTP 호출(`adapter.setupChannel`)은 항상 락 **밖**에서 먼저 끝낸다(문서화된 Cafe24 advisory-lock 기각 사유를 정확히 학습). 락 보유 시간이 유계여서 무한 대기 상한 부재(창 1~3)가 감당 가능한 트레이드오프라는 근거가 실제로 성립한다.
- **테스트의 관측 고리**: `withTransactionMock` 의 `onLock`/`onLockTimeout`/`freshFindOne` 이 "락을 잡았는가"·"재읽기가 실제로 다른 값을 보는가"를 직접 관측시키고, `trigger-config-lock.spec.ts` 는 "락이 재읽기보다 먼저"라는 순서 자체를 단언한다 — 락이 SQL 한 줄이라 존재 확인만으로는 못 잡는 "락을 빼는 뮤턴트"·"두 읽기가 항상 같은 값이라 재읽기가 무의미해지는 뮤턴트" 양쪽을 실제로 잡는 구조다.
- **e2e 재현**: `trigger-config-lost-update.e2e-spec.ts` 는 우연한 인터리빙에 기대지 않고 별도 커넥션(`lockDb`)으로 advisory lock 을 직접 쥐어 B 요청을 결정적으로 정지시킨 뒤 A 를 커밋시키는 방식으로 세 가지 서로 다른 회귀(B 의 PATCH 값 유실·A 가 확립한 ref 유실·손대지 않은 키 유실)를 각각 다른 단언으로 문다 — 하나의 뮤턴트가 나머지를 조용히 통과시키지 못하게 설계돼 있다.
- **삭제 레이스의 잔여 창**(이미 별도 라운드에서 INFO 로 수용됨, 재확인만): `remove()` 의 락 안 `m.remove(trigger)` 는 `trigger` 를 최초 `findById` 시점 그대로 넘기지만, TypeORM 의 `remove(entity)` 는 PK 로 DELETE 하므로 컬럼 staleness 는 무해하다.

## 요약

이 변경의 핵심 동시성 설계(트리거 단위 advisory lock 직렬화 + 락 안 재읽기 + 외부 호출을 락 밖에 두는 경계)는 건전하고, 5라운드에 걸쳐 실측(뮤턴트)으로 검증된 상태다. 잔여 두 항목 중 하나는 순수 문서 드리프트(CHANGELOG 의 "대기 상한 없음" 서술이 이후 커밋이 추가한 삭제-경로 5초 타임아웃 예외를 반영하지 못함, WARNING)이고, 다른 하나는 이 PR 이 만든 것이 아니라 오히려 좁힌 잔여 창(창 1의 전체-엔티티 저장이 advisory lock 에 참여하지 않는 `touchLastTriggeredAt` 의 동시 갱신을 아주 좁은 창에서 되돌릴 수 있음, INFO — 데이터 손상 아님)이다. 둘 다 이번 배치를 막을 사유는 아니다.

## 위험도

LOW
