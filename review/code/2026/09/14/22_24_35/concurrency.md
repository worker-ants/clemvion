# 동시성(Concurrency) Review — trigger-config lost-update

## 검토 범위

`trigger.config` lost-update(동시 PATCH 가 서로의 `chatChannel.inboundSigningRef` 를 되돌려
인입 서명 검증이 fail-open 되던 결함)를 트리거 단위 `pg_advisory_xact_lock` + "락 안에서
재읽어 병합" 패턴으로 닫는 변경이다. `trigger-config-lock.ts`(신규) · `triggers.service.ts`
(`update`/`remove`/`rotateBotToken`/`rotateNotificationSecret`/`revokePerTriggerToken`/
`promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens`) ·
`chat-channel-binder.service.ts`(`setupChatChannel`) · `hooks.service.ts`(웹훅 hot path) ·
`schedules.service.ts`(`update` 의 trigger 동기화) 및 관련 테스트·e2e 를 직접 열어 확인했다.

이미 이 PR 은 최소 7라운드의 리뷰(`18_17_44` → `21_50_09`)를 거치며 핵심 결함(4개 창의
`config` lost-update)과 그로부터 파생된 결함(형제-락-참여 창들의 컬럼 되돌림·삭제 경합·
listener 유령 등록·presence 게이트 재계산 누락·CHANGELOG 의 "대기 상한 없음" 서술 drift 등)을
실측(뮤턴트) 기반으로 닫아 왔다. 아래는 그 라운드들이 명시적으로 다루지 않은 잔여 각도다.

## 발견사항

- **[WARNING]** 창 1(`update()`)의 전체-엔티티 저장이, **advisory lock 에 참여하지 않는**
  컬럼-한정 writer(`rotateNotificationSecret` 등)가 그 사이 커밋한 값을 되돌릴 수 있다 —
  그중 하나는 보안에 직결되는 secret rotation 이다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:588-637`
    (`update()` 트랜잭션 콜백 — `const fresh = await m.findOne(...)` 부터
    `return m.save(Trigger, target);` 까지) 와 `triggers.service.ts:1026-1056`
    (`rotateNotificationSecret` — `this.triggerRepository.update({id}, {notificationSecretV2, notificationRotatedAt})`,
    advisory lock 미참여)
  - 상세: 이 구간에서 읽은 `fresh` 는 `Trigger` 의 전체 컬럼(`notificationSecretV2`·
    `notificationRotatedAt`·`chatChannelTokenV2`·`chatChannelRotatedAt`·`lastTriggeredAt`
    포함)을 담고, `target = fresh` 에 DTO 의 `defined` 필드와 `config` 만 덮어써
    `m.save(Trigger, target)` 로 **엔티티 전체**를 저장한다(TypeORM 은 `undefined` 프로퍼티만
    건너뛰므로, `fresh` 로부터 온 나머지 컬럼은 전부 값이 있어 그대로 실린다 — 이 파일
    564-568행 주석이 이미 이 skip 규칙을 근거로 든다). `fresh` SELECT 가 끝난 **직후**,
    `m.save()` 가 실제 UPDATE 를 보내기 **전**(둘 사이는 동기 코드뿐이라 창은 좁지만, 서로
    다른 두 SQL 문이라 0은 아니다) `rotateNotificationSecret` 같은 **락에 참여하지 않는**
    컬럼-한정 writer 가 `notificationSecretV2`/`notificationRotatedAt` 을 커밋하면, 창 1 의
    전체-엔티티 저장이 그 값을 `fresh` 시점의 **회전 이전 값**으로 되돌린다. `rotateNotificationSecret`
    은 이미 `TRIGGER_NOTIFICATION_SECRET_ROTATED` 감사 로그를 남기고 새 secret 을 응답으로
    반환한 뒤이므로, 결과는 "API·감사 로그는 회전 성공을 보고하지만 DB 에는 **회전 이전(구)
    secret** 이 남아 outbound notification 서명 검증이 구 secret 으로도 통과하는" 상태다 —
    이 PR 이 닫으려는 것과 **같은 클래스**(락 미참여 창이 커밋한 값을 창 1 의 전체-저장이
    조용히 덮는다)의 lost update이지만, 대상이 인입 서명이 아니라 **outbound 서명 secret
    rotation** 이다. 같은 패턴이 `promoteRotatedNotificationSecrets` 의 stale-clear 분기
    (`triggers.service.ts:1337`) · `cleanupRotatedChatChannelTokens`(`triggers.service.ts:1432`,
    chatChannelTokenV2/RotatedAt — grace 정리 지연, 보안 무관) · `schedules.service.ts` 의
    trigger 동기화(`schedules.service.ts:241-246`, name/isActive — 같은 필드를 창 1 도 쓸 수
    있어 일반적 last-write-wins에 가까움, 저위험) · `hooks.service.ts` 의 `touchLastTriggeredAt`
    (`hooks.service.ts:227`, `:686`, `lastTriggeredAt` — 관측용, 다음 웹훅이 자연 복구)에도
    적용된다. **`lastTriggeredAt` 축은 이미 직전 라운드(`review/code/2026/09/14/21_18_21`
    concurrency INFO)가 "데이터 손상 아님·자연 복구" 로 판정해 조치 불요로 수용됐다** — 그
    판정 자체는 타당하다. 다만 그 라운드는 `touchLastTriggeredAt` 하나만 검토했고, **같은
    구조가 `notificationSecretV2` 에도 적용된다는 것은 어느 라운드의 산출물에도 명시되지
    않았다** — 이 필드는 "관측용이라 되돌아가도 무해"라는 근거가 성립하지 않는 유일한
    사례다(회전 완료 응답·감사 로그와 실제 DB 상태가 어긋난다는 점에서 오히려 이 PR 이
    닫은 fail-open 과 같은 성격의 문제).
  - 제안: `chatChannelHealth` 등 lock-참여 형제 컬럼에 이미 적용한 원칙 — "config 를 고치는
    자리는 락 안 재작성으로, 컬럼만 고치는 자리는 컬럼 한정 갱신으로" — 을 `rotateNotificationSecret`
    에도 확장해 `acquireTriggerConfigLock` 을 먼저 잡게 하면(비용은 advisory lock SQL 한
    줄), 창 1 의 `fresh` 재읽기가 이 커밋도 보게 되어 같은 락 도메인 안으로 들어온다. 즉시
    닫기 어렵다면 최소한 plan 의 "형제 창" 표에 "락에 참여하지 않는 컬럼-한정 writer 중
    `notificationSecretV2`/`notificationRotatedAt` 는 관측용이 아니라 보안 성격이라
    `lastTriggeredAt` 과 위험도가 다르다"는 구분을 남겨, 다음 사람이 두 필드를 같은 위험도로
    묶어 판단하지 않게 하는 것을 권고.

## 확인했으나 문제 없음 (참고)

- **락 순서·데드락**: 모든 쓰기 경로가 트리거당 단일 advisory lock key(`trigger-config:<id>`)만
  잡고, 잡는 순서가 모든 경로에서 "advisory lock → 행 조작"으로 동일하다 — AB-BA 역전이
  없어 데드락 가능성이 없다. `promoteRotatedNotificationSecrets` 도 트리거를 순차 for-loop 로
  처리해(동시에 두 트리거의 락을 겹쳐 쥐지 않음) 교착 경로가 없다.
- **삭제 경합**: `remove()` 가 같은 advisory lock 을 삭제 상한(`TRIGGER_DELETE_LOCK_TIMEOUT_MS=5s`)과
  함께 잡아, "읽었을 땐 있었는데 저장 직전 삭제" 창을 닫았다. `m.remove(trigger)` 가 pre-lock
  엔티티를 그대로 넘기지만 TypeORM 의 `remove()` 는 PK 로 DELETE 하므로 컬럼 staleness 는
  무해하다.
- **임계 구간 내 외부 I/O 없음**: `rewriteTriggerConfigLocked`·창 1 모두 락 보유 중에는
  DB 왕복만 있고, `adapter.setupChannel` 같은 외부 HTTP 호출은 항상 락 **밖**에서 먼저
  끝낸다 — 문서화된 Cafe24 advisory-lock 기각 선례를 정확히 학습한 설계다.
- **테스트의 관측 고리**: `trigger-config-lock.spec.ts` 가 "락이 재읽기보다 먼저"라는 순서
  자체를 단언하고, `triggers.service.spec.ts` 의 `'update() — 형제 창이 커밋한 컬럼도
  되돌리지 않는다'` 테스트가 lock-참여 형제(`chatChannelHealth` 등)의 생존을 뮤턴트로
  검증한다 — 다만 이 테스트군은 **lock 에 참여하는** 형제만 다루고, 이번 발견의 대상인
  **lock 미참여** 컬럼-한정 writer(`rotateNotificationSecret` 등)와 창 1의 상호작용은 어떤
  suite 에도 없다(위 WARNING 의 근거).
- **e2e 재현**: `trigger-config-lost-update.e2e-spec.ts` 는 별도 커넥션으로 advisory lock 을
  직접 쥐어 결정적 인터리빙을 만들고, `config` 레벨의 세 회귀(B 값 유실·A 의 ref 유실·손대지
  않은 `config` 키 유실)를 각각 다른 단언으로 문다. 다만 이 e2e 도 `config` JSONB 안의 키만
  보고, 위 발견의 대상인 `Trigger` 테이블의 다른 **컬럼**은 다루지 않는다.

## 요약

이 변경의 핵심 동시성 설계(트리거 단위 advisory lock 직렬화 + 락 안 재읽기 + 외부 호출을
락 밖에 두는 경계)는 건전하고 여러 라운드에 걸쳐 뮤턴트로 검증됐다. 이번 라운드에서 새로
확인한 잔여 항목은 하나다: 창 1(`update()`)의 전체-엔티티 저장이 advisory lock 에 참여하지
않는 컬럼-한정 writer 의 커밋을 되돌릴 수 있다는 구조적 한계가, 이미 수용된 `lastTriggeredAt`
축(무해·자연 복구) 뿐 아니라 `notificationSecretV2`/`notificationRotatedAt`
(`rotateNotificationSecret`)에도 적용된다 — 이쪽은 "관측용이라 무해"라는 근거가 성립하지
않고, 회전 API·감사 로그가 성공을 보고한 뒤에도 DB 에는 회전 이전 secret 이 남을 수 있다는
점에서 이 PR 이 닫은 fail-open 과 같은 성격의 문제다. 창(window) 자체는 이 PR 이 새로 만든
것이 아니라 오히려 좁혔고(전체 요청 구간 → 트랜잭션 내 SELECT~UPDATE 구간), 재현에는 두
동시 요청의 정밀한 인터리빙이 필요해 발생 확률은 낮다. 그래도 이 PR 이 스스로 세운 "형제
창은 같은 락 도메인으로 넣는다"는 원칙에 비추면 `rotateNotificationSecret` 이 그 도메인
밖에 남아 있다는 점은 문서화(plan 후속 표)만이라도 필요하다고 판단해 WARNING 으로 남긴다.
이번 배치를 막을 사유는 아니다.

## 위험도

LOW
