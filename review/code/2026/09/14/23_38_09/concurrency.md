# 동시성(Concurrency) Review — trigger-config lost-update (11라운드 fan-out)

## 검토 범위

`trigger.config` lost-update(동시 PATCH 가 `chatChannel.inboundSigningRef` 를 되돌려
인입 서명 검증이 fail-open 이 되던 결함)를 닫는 PR 의 최종 라운드. 핵심 동시성 코드:

- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (advisory lock + 락 안
  재읽기 유틸 `rewriteTriggerConfigLocked`/`acquireTriggerConfigLock`)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`update()` 창 1 인라인 락,
  `remove()`, `rotateBotToken()`, `revokePerTriggerToken()`, `normalizeNotificationSecretRef()`,
  `promoteRotatedNotificationSecrets()`, `cleanupRotatedChatChannelTokens()`,
  `mergeIntoFreshSubKey()`)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (`setupChatChannel`
  성공/실패 경로의 `rewriteTriggerConfigLocked` 배선, `survivesWithFresh` 게이트 재계산)
- `codebase/backend/src/modules/hooks/hooks.service.ts` (`touchLastTriggeredAt` — 컬럼 한정
  `update` 로 전환)
- `codebase/backend/src/modules/schedules/schedules.service.ts` (`update()` 의 trigger 컬럼
  동기화 — 컬럼 한정 `update` 로 전환)
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (advisory lock 을 직접 쥐어
  인터리빙을 결정적으로 재현하는 e2e)

이전 10라운드(`review/code/2026/09/14/18_17_44` ~ `23_01_18`)가 이미 CRITICAL 다수를
찾아 고쳤고(창 1 lost-update, hooks 대칭 자리 누락, `rotateBotToken`/cleanup 컬럼 한정
전환 시 회귀 테스트 부재, sub-key 재대입 3자리 등), 이번 라운드는 그 마지막 커밋들
(`833bb745a`·`bcba1dc5d`·`a92bce095`·`bf2becd0c`)까지 반영된 상태를 직접 코드로
검증했다. 아래는 이 시점 기준의 잔여 관찰이다.

## 발견사항

- **[INFO]** advisory lock 설계 자체는 데드락 위험이 없다 — 확인 완료, 신규 지적 아님
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-63`
    (`acquireTriggerConfigLock`), `triggers.service.ts:621-671`(`update` 창 1),
    `:1025-1039`(`remove`)
  - 상세: 모든 쓰기 경로가 "advisory lock 먼저 → 필요하면 그 안에서 행 잠금(`m.save`/`m.remove`)"
    순서를 예외 없이 지킨다. 서로 다른 두 자원을 반대 순서로 잠그는 자리가 없고, advisory
    lock 은 트리거 id 하나에 대해서만 발급되며 같은 트랜잭션 안에서 두 번째 advisory lock 을
    추가로 잡는 경로도 없다(교차 트리거 lock 획득 없음) — 순환 대기 조건이 성립하지 않는다.
    `pg_advisory_xact_lock` 은 트랜잭션 종료(커밋/롤백/예외) 시 자동 해제되므로 락 누수도 없다.
  - 제안: 없음(확인 목적의 기록).

- **[INFO]** 컬럼 한정 `update()` 경로들은 advisory lock 을 타지 않는다 — 그중 두 곳은
  이미 plan 에 "동일 클래스의 잔여 경합"으로 등재·유예된 상태를 재확인
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:234-246`
    (`name`/`isActive` 컬럼 한정 `update`) · `triggers.service.ts:1085-1093`
    (`rotateNotificationSecret`)
  - 상세: 두 경로 모두 `config` JSONB 는 건드리지 않으므로 이 PR 이 닫으려는
    `inboundSigningRef` fail-open 클래스에는 걸리지 않는다(그 점은 정확하다). 다만 같은
    트리거에 대해 `TriggersService.update()` 의 **창 1**(advisory lock 안에서 재읽은 행을
    `m.save(Trigger, target)` 로 통째로 저장)이 동시에 진행 중이면, 창 1 이 자신의 재읽기
    시점 이후에 이 두 경로가 커밋한 `name`/`isActive`(schedules 케이스) 또는
    `notificationSecretV2`/`notificationRotatedAt`(rotateNotificationSecret 케이스)를 옛
    값으로 되돌릴 수 있다 — advisory lock 을 공유하지 않는 두 쓰기가 같은 행의 다른 컬럼을
    한쪽은 컬럼 한정으로, 한쪽은 전체 엔티티로 건드리기 때문이다. 직접 코드로 재확인했고
    (`schedules.service.ts:234`, `triggers.service.ts:1085`), `plan/in-progress/trigger-config-lost-update.md:576,579`
    가 정확히 이 두 경합을 8·9라운드에 이미 실측·등재하고 "이 PR 로 넓히지 않는다"로 명시
    유예했다 — 새로 발견한 결함이 아니라 기존 유예 판단이 이번 diff 에서도 유효함을 재확인한
    것이다. 유예 사유(관측성 vs 보안, 발생에 특정 인터리빙 필요)도 근거가 있어 보인다.
  - 제안: 이번 PR 범위 확대는 불필요. 다음에 `update()` 창 1을 다시 만질 때(§D 후속 목록의
    `mergeAndSaveLocked` 분리 등) 이 두 자리도 같은 advisory lock 도메인에 넣는 편이
    구조적으로 깔끔하다는 점만 재확인.

- **[INFO]** `cleanupRotatedChatChannelTokens` 의 무조건 null-write — 이미 등재된 항목,
  코드로 재확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1487-1493`
  - 상세: `chatChannelTokenV2`/`chatChannelRotatedAt` 을 조건 없이 `null` 로 쓴다. 이 사이
    `rotateBotToken` 이 새 v2 회전을 커밋했다면 이 cleanup 이 그 새 값을 지운다. `plan/in-progress/trigger-config-lost-update.md:575` 가 "조건부 `WHERE chatChannelTokenV2 = <읽은 값>`"
    을 해법으로 8라운드에 이미 등재했다 — 신규 지적 아님, 유예 유효성만 재확인.
  - 제안: 없음(추적됨).

- **[INFO]** e2e 동시성 재현(`trigger-config-lost-update.e2e-spec.ts`)의 판별력을 실제로
  확인함
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts:133-232`
  - 상세: advisory lock 을 테스트가 직접 선점해 "요청 B 가 첫 쓰기 전에 반드시 멈춘다"는
    인터리빙을 우연이 아니라 구조적으로 강제한다. 세 단언(①B 값 생존 ②A 가 확립한 ref 생존
    ③A 의 손대지 않은 키 생존)이 서로 다른 회귀 축을 물고, `blockedBeforeRelease` 로 "겹침이
    실제로 만들어졌는지"까지 관측해 vacuous 통과를 막는다. 설계·단언 모두 건전하다.
  - 제안: 없음.

- **[INFO]** `trigger-config-lock.spec.ts`/`withTransactionMock` 이 "락 안 재읽기가 바깥
  읽기와 실제로 다를 수 있음"을 옵션(`freshFindOne`)으로 분리해 검증 — mutation 근거와 함께
  확인
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:1-28`,
    `trigger-config-lock.spec.ts:1-164`
  - 상세: 기본 mock 이 "최초 읽기 == 락 안 재읽기"로 위임되면 재읽기 자체가 검증되지 않는다는
    점을 커밋 로그가 실측(뮤턴트 GREEN)과 함께 남겨 뒀고, 실제로 그 갭을 메우는 옵션이
    구현돼 있다. 동시성 유틸 테스트로서 드문 수준의 엄밀함이다.
  - 제안: 없음.

## 요약

10라운드에 걸쳐 이미 여러 CRITICAL(창 1 lost-update, hooks/schedules 의 대칭 회귀 테스트
부재, `rotateBotToken`/notification/interaction sub-key 재대입 시 하위 키가 스냅샷으로
되돌아가는 결함 등)을 실측·수정한 뒤의 최종 상태를 코드 레벨에서 직접 재확인했다.
`rewriteTriggerConfigLocked`(락 먼저 → 재읽기 → 서브키 병합 → 컬럼과 분리해 쓰기)와
`mergeIntoFreshSubKey`(서브키 단위 병합을 시그니처로 강제)가 일관되게 적용돼 이 PR 이
닫으려는 `chatChannel.inboundSigningRef` 클래스의 lost-update 는 4개 창(성공/실패
바인더 경로·`rotateBotToken`·창 1) 모두에서 재현되지 않는다. advisory lock 사용 패턴은
"lock 먼저 → row lock" 순서를 예외 없이 지켜 데드락 조건이 성립하지 않고, 외부 HTTP 호출을
락 밖에 두어 커넥션·락 보유 시간도 짧게 유지된다. e2e·unit 양쪽에 인터리빙을 우연이 아니라
구조적으로 강제하는 회귀 테스트가 배선돼 있다. 이번 라운드에서 새로 도입된 코드(마지막 4개
커밋)에서 새로운 CRITICAL/WARNING 급 동시성 결함은 발견하지 못했다. 남아 있는 잔여 경합
(schedules/`rotateNotificationSecret`/cleanup 의 advisory-lock 도메인 밖 컬럼 쓰기)은
전부 plan(`trigger-config-lost-update.md` §후속 목록)에 8~9라운드에 이미 실측·등재되어
"이 PR 로 넓히지 않는다"로 명시 유예된 항목이며, 이번 검토로 그 유예 판단이 현재 diff
기준으로도 여전히 유효함을 확인했다. 차단 사유 없음.

## 위험도

LOW
