# 동시성(Concurrency) 리뷰 — trigger-config-lost-update (2026-09-15 00:07 라운드)

## 검토 범위 및 방법

이 changeset 은 `trigger.config`(JSONB) 를 대상으로 한 lost-update(동시 PATCH 가 서로의 쓰기를
되돌려 `chatChannel.inboundSigningRef` 를 잃고 인입 웹훅 서명 검증이 fail-open 으로 돌아가는
결함)를 트리거 단위 `pg_advisory_xact_lock` + "락 안에서 재읽고 병합" 패턴으로 닫는 시리즈의
**최신(마지막) 라운드**다. 프롬프트에 실린 diff 는 대부분 이전 라운드(2026-09-14 18:17 ~
23:38, 총 11 라운드)의 리뷰 산출물이라 이번 라운드는 **가장 최근 커밋
(`91b816498` "헬퍼를 쓰면서 헬퍼가 막으려던 결함을 냈다 — patch 는 델타여야 한다")까지 반영된
현재 소스**를 직접 열어(Read/Grep, 저장소 뮤테이션 없음) 대조했다:

- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (락 프리미티브, 전문)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`update()` 창1·`remove()`·
  `rotateNotificationSecret`·`revokePerTriggerToken`·`rotateBotToken`·
  `promoteRotatedNotificationSecrets`·`cleanupRotatedChatChannelTokens`·`mergeIntoFreshSubKey`)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (`setupChatChannel`
  성공/실패 경로, `buildChannel`/`survivesWithFresh`)
- `codebase/backend/src/modules/hooks/hooks.service.ts` (`touchLastTriggeredAt`)
- `codebase/backend/src/modules/schedules/schedules.service.ts` (`update()` 의 trigger
  name/isActive 컬럼 동기화)
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (전문)
- `git show 91b816498/833bb745a/bcba1dc5d/a92bce095` 로 최근 4개 fix 커밋의 실제 diff

11 라운드에 걸쳐 이미 여러 Critical/Warning 이 지적·수정됐고(각 커밋 메시지에 뮤테이션 실측
포함), 이번 라운드에서는 **그 수정들이 현재 HEAD 에 실제로 반영돼 있는지**와 **가장 최근
diff(91b816498)가 새 결함을 들여오지 않았는지**를 우선 확인했다.

## 발견사항

이번 라운드에서 새로 지적할 Critical/Warning 은 없다. 아래는 직접 재확인한 결과와, 이미
`plan/in-progress/trigger-config-lost-update.md` §후속(developer 범위) 표에 등재되어 이 PR
스코프 밖으로 명시적으로 미뤄진 잔여 항목의 재확인이다(참고용 INFO).

- **[INFO]** `rotateBotToken` 의 `patch`-델타화 수정이 실제로 반영되어 있음 — 최신 Critical 닫힘 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rotateBotToken()` 내
    `rewriteTriggerConfigLocked(...)` 호출부 (`mergeIntoFreshSubKey` 두 번째 인자)
  - 상세: 직전 라운드(23_38_09)가 지적한 Critical — `patch` 자리에 `mergedChannel` **전체**
    (함수 시작 시점 스냅샷)를 넘겨 재읽은 `rateLimitPerMinute`/`uiMapping`/`languageLocale` 을
    무조건 되돌리던 결함 — 은 `91b816498` 커밋에서 `patch` 를
    `{...(result.configUpdates ?? {}), botTokenRef, inboundSigningRef}` (이번 회전이 실제로
    산출한 델타만)로 좁혀 닫혔다. `git show 91b816498` 로 diff 를 직접 대조했고, 현재 HEAD 의
    `triggers.service.ts` 코드가 그 diff 와 일치함을 확인했다. 커밋 메시지가 밝힌 회귀 테스트도
    "스냅샷 30 · 재읽기 99 → 최종값 99" 형태로 두 상태를 가르는 fixture 라 vacuous 하지 않다.
  - 제안: 없음(확인만).

- **[INFO]** 핵심 동시성 프리미티브(`rewriteTriggerConfigLocked`)는 락 배치·재읽기·presence
  게이트·데드락 부재가 여전히 견고함
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:136-173`
  - 상세: (1) 락은 `manager.transaction` 콜백 **안**에서만 잡히고 `pg_advisory_xact_lock` 은
    트랜잭션 종료 시 자동 해제 — 예외 경로에서도 누수 없음. (2) 락을 잡은 **뒤**에
    `m.findOne` 으로 재읽어 그 값 위에서만 병합 — 컨테이너뿐 아니라 `merge` 콜백이 돌려주는
    하위 키까지 재읽은 값 기준(`mergeIntoFreshSubKey` 로 통일). (3) 외부 HTTP 호출은 모든
    호출부에서 락 진입 **전에** 이미 끝나 있어 Cafe24 advisory-lock 기각 선례(락 보유 중 HTTP →
    커넥션 점유 시간 증가)를 정확히 피함. (4) 모든 쓰기 경로(창1·binder 성공/실패·
    `rotateBotToken`·`remove()`·`revokePerTriggerToken`·`normalizeNotificationSecretRef`·
    `promoteRotatedNotificationSecrets`)가 트리거당 **단일** 락 키(`trigger-config:<id>`)만
    잡고, 그 안에서 다른 트리거의 락이나 다른 종류의 락을 중첩해서 잡지 않는다 — AB-BA 역전
    패턴이 없어 락 오더링 데드락 조건이 성립하지 않는다. (5) 삭제(`remove()`)만
    `SET LOCAL lock_timeout`(5초, 정수만 문자열에 삽입되도록 `Math.trunc` 로 제한, 사용자
    입력이 닿지 않음)으로 대기 상한을 두고, 나머지는 임계 구간이 "재읽기+병합+UPDATE"(DB 왕복
    두 번)로 유계라는 근거 위에 의도적으로 무한 대기를 허용 — 근거와 구현이 일치한다.
  - 제안: 없음(확인만).

- **[INFO]** `SchedulesService.update()` 의 trigger `name`/`isActive` 컬럼 동기화가 여전히
  `trigger-config` advisory lock 도메인 밖 — 이미 추적된 잔여 항목, 재확인
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `update()` 의
    `await this.triggerRepository.update({ id: trigger.id }, patch);` (컬럼 한정, 락 없음).
    대응 창은 `triggers.service.ts` `update()`(창1) — 락 안에서 `fresh` 를 재읽은 뒤
    `Object.assign(target, defined, {config: mergedConfig})` 로 **엔티티 전체**를 저장한다.
  - 상세: 이 PR 은 이 write 를 `save(trigger)`(엔티티 통째 저장, `config` 까지 되씀)에서
    `update({id}, {name, isActive})`(컬럼 한정)로 바꿔 `config`/`inboundSigningRef` 를 잃는
    축은 닫았다. 다만 이 컬럼 갱신 자체는 advisory lock 을 잡지 않으므로, `PATCH
    /api/schedules/:id`(isActive 변경)와 `PATCH /api/triggers/:id`(다른 필드, isActive 미포함)가
    거의 동시에 들어오면: 창1 이 락 안에서 `fresh`(`isActive: true`)를 읽은 **직후**, schedules
    쪽 update 가 `isActive: false` 를 커밋하고, 그 뒤 창1 이 `target = {...fresh, ...defined}`
    (`defined` 에 `isActive` 없음)를 저장하면서 방금 커밋된 `false` 를 `fresh` 시점의 `true` 로
    되돌릴 수 있다. `name`/`isActive` 는 `config` 축과 달리 보안(fail-open) 성격은 아니지만
    `isActive` 는 실행 여부를 가르는 값이라 관측성 필드(`lastTriggeredAt`)보다는 영향이 크다.
  - 이 항목은 **이미 실측·문서화되어 있다** — `review/code/2026/09/14/23_01_18/concurrency.md`
    WARNING 이 시나리오를 상세히 적었고, `plan/in-progress/trigger-config-lost-update.md`
    §후속(developer 범위) 표(9라운드 W2 행, "`SchedulesService.update()` 의 trigger 컬럼
    동기화가 락 도메인 밖 — 창 1 의 전체 엔티티 저장과 경합하면 방금 커밋한 isActive 가
    되돌아갈 수 있다")에 명시적으로 "이 PR 로 넓히지 않는다" 로 등재돼 있다. 이번 라운드가 새로
    발견한 것이 아니라, 그 처분이 여전히 유효한 상태임을 재확인한 것이다.
  - 제안: 근본 수정은 별도 후속 PR — (a) 이 write 도 `acquireTriggerConfigLock` 을 잡거나
    (모듈 간 순환 의존 검토 필요), (b) 창1 자체를 `name`/`isActive` 포함 컬럼 한정 갱신으로
    전환(§D 가 이미 창1 자체 재작업은 이 PR 로 넓히지 않는다고 명시). 이번 배치를 막을 사유는
    아니다.

- **[INFO]** `cleanupRotatedChatChannelTokens` 의 무조건 컬럼 null-write가 동시 `rotateBotToken`
  의 새 v2 회전을 지울 수 있는 좁은 창 — 이미 추적된 잔여 항목, 재확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` —
    `cleanupRotatedChatChannelTokens()` 의 `await this.triggerRepository.update({id},
    {chatChannelTokenV2: null, chatChannelRotatedAt: null})`
  - 상세: 이 cron 은 쿼리 시점에 골라낸 후보(`chatChannelTokenV2 IS NOT NULL AND
    chatChannelRotatedAt <= cutoff`)에 대해 provider revoke·secret 삭제 후 두 컬럼을
    **조건 없이** `null` 로 쓴다. 그 사이(특히 provider revoke·secret 삭제라는 외부 I/O 구간)
    동시에 `rotateBotToken` 이 커밋되어 **새** `chatChannelTokenV2`/`chatChannelRotatedAt` 을
    확립하면, 이 cron 의 뒤이은 무조건 null-write 가 방금 확립된 새 v2 회전 추적을 지운다 —
    해당 secret store row 는 고아로 남고 다음 cleanup cron 도 그 행을 후보로 다시 못 고른다
    (컬럼이 이미 null). 데이터 손상·보안 fail-open 은 아니지만(고아 secret row 는 무해에
    가까움) 회전 추적이 조용히 새는 경로다.
  - 이 항목도 `plan/in-progress/trigger-config-lost-update.md` §후속(developer 범위) 표에
    "`cleanupRotatedChatChannelTokens` 의 무조건 null-write | 동시에 커밋된 `rotateBotToken` 의
    새 v2 회전을 지울 수 있다 → 조건부 `WHERE chatChannelTokenV2 = <읽은 값>` 으로 낙관적 확인
    (8라운드 W2)" 로 명시적으로 등재돼 있다 — 새 발견이 아니라 독립적으로 같은 결론에
    도달한 재확인이다.
  - 제안: 후속 PR 에서 `update()` 를 `{id, chatChannelTokenV2: v2Ref}`(읽은 값과 일치할 때만)
    조건부로 좁히거나, `affected` 행 수를 확인해 0이면 로그만 남기고 넘어가도록 한다.

- **[INFO]** cron 스윕(`promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens`)이
  후보마다 별도 트랜잭션을 순차 실행 — 동시성 버그는 아니고 이미 추적된 성능 항목
  - 위치: `triggers.service.ts` 두 cron 메서드의 `for (const trigger of candidates) { ... await
    rewriteTriggerConfigLocked(...) 또는 await this.triggerRepository.update(...) }`
  - 상세: 각 후보가 순차적으로 자기 DB 왕복(및 `rewriteTriggerConfigLocked` 경로는 advisory
    lock 획득 왕복까지)을 갖는다. 정확성 문제는 아니며(각 트리거 단위로는 락이 올바르게
    직렬화됨), 대량 회전 이벤트 시 소요 시간이 배치 크기에 비례해 늘어나는 성능 특성이다.
    `plan/in-progress/trigger-config-lost-update.md` §후속 표에 "cron 스윕이 행마다 새
    트랜잭션(왕복 약 2배) — 대량 회전 이벤트 시 소요 시간이 배치 크기에 비례. 소규모 동시성
    제한 또는 백로그 관측 로그 (9라운드 W4)" 로 이미 등재돼 있다.
  - 제안: 조치 불요(추적됨, 이번 배치를 막을 사유 아님).

- **[INFO]** `mergeIntoFreshSubKey` 의 네 번째 매개변수 `fallback` 이 계산에 전혀 쓰이지 않음
  (`void fallback;`)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:380-390`
  - 상세: 이 함수는 재읽은 `freshConfig[key]` 가 있으면 그 위에 `patch` 를 얹고, 없으면
    `{}` 위에 `patch` 만 얹는다 — 호출부 4곳(`normalizeNotificationSecretRef`,
    `revokePerTriggerToken`, `rotateBotToken`, `promoteRotatedNotificationSecrets`)이 모두
    미리 계산해 넘기는 `fallback`(예: `normalizedNotification`, `mergedChannel` 전체)은 실제로
    한 번도 읽히지 않는다. 동시성 정확성 관점에서는 "재읽은 상태가 곧 정답" 이라는 이 PR 의
    원칙과 부합해 **현재 동작 자체는 옳다**(하위 키가 통째로 사라진 상태라면 그것이 최신
    커밋 상태이므로 fallback 으로 채우면 오히려 삭제 의도를 무시하는 것이 된다). 다만 매개변수가
    계산에 관여하지 않으면서도 호출부마다 값을 만들어 넘기고 있어, 다음 사람이 "fallback 이
    실제로 어떤 안전망 역할을 한다" 고 오해하고 그 값의 정확성에 의존하는 로직을 얹을 위험이
    있다(예: 이번 라운드 커밋 메시지들이 반복해서 지적한 "헬퍼가 규율을 대신하지 않는다"
    패턴과 같은 축).
  - 제안: 이 PR 을 막을 사유는 아니다. 후속으로 `fallback` 매개변수를 제거하거나, 정말
    필요 없다는 것이 확정이면 JSDoc 에 "freshConfig 에 키가 없으면 항상 빈 객체에서
    시작한다 — fallback 은 참조되지 않는다" 를 명시해 다음 재사용자의 오독을 막을 수 있다.

## 관점별 확인

- **경쟁 조건**: `config` JSONB 를 다시 쓰는 경로는 창1·binder 성공/실패·`rotateBotToken`·
  `revokePerTriggerToken`·`normalizeNotificationSecretRef`·`promoteRotatedNotificationSecrets`
  전부 advisory lock 안에서 재읽기 후 병합 — 검증한 8개 호출부 모두 일관됨. 컬럼만 고치는
  나머지 경로(`rotateNotificationSecret`·`cleanupRotatedChatChannelTokens`·
  `SchedulesService.update()`·`hooks.service.ts#touchLastTriggeredAt`)는 락 밖이지만
  `config` 를 건드리지 않아 이 PR 이 막으려는 fail-open 클래스와는 무관하다. 다만 컬럼 자체의
  동시 갱신 경합(name/isActive, chatChannelTokenV2)은 위 INFO 두 건처럼 좁게 남아 있고 둘 다
  이미 추적됨.
- **데드락**: 모든 락 획득이 "advisory lock → 행 조작" 순서로 동일하고, 트랜잭션 하나가
  둘 이상의 서로 다른 락(다른 트리거 id 또는 다른 네임스페이스)을 동시에 보유하는 경로가
  없어 AB-BA 역전 조건이 성립하지 않는다.
- **동기화**: `pg_advisory_xact_lock(hashtext(...))` 트리거 단위 직렬화가 일관되게 적용.
- **원자성**: `manager.transaction()` + 재읽기 + `m.update`/`m.save` 가 한 트랜잭션 안에서
  원자적으로 커밋/롤백된다. `remove()` 도 같은 락을 잡아 "읽었을 땐 있었는데 저장 직전에
  삭제" 경합을 닫았다(창1의 삭제-경합 처리도 `assertTriggerFound(fresh)` 로 404 를 던져
  일관됨).
- **async/await**: 검토한 경로에서 await 누락은 발견되지 않았다. `.catch()` 체인
  (`rethrowEndpointPathConflict`)도 트랜잭션 프라미스 바깥에 정확히 위치.
- **이벤트 루프**: 블로킹 동기 연산 없음. `SET LOCAL lock_timeout` 문자열 생성이 유일한 수기
  SQL 조립인데 `Math.trunc` 로 정수만 허용하고 사용자 입력이 닿지 않아 인젝션 경로 없음.
- **리소스 풀링**: 외부 HTTP 호출(adapter.setupChannel 등)은 모든 지점에서 advisory lock 진입
  전에 끝나 있어 커넥션/락 보유 시간이 "DB 왕복 두 번" 수준으로 유계. 새로 생긴 공유 블로킹
  자원(트리거별 advisory lock)에 대한 대기 상한 부재는 이 임계구간 유계성을 근거로 의도된
  설계이며 삭제 경로만 예외적으로 5초 상한을 둔다 — 근거와 구현이 일치.

## 요약

이 changeset 은 `trigger.config` JSONB 에 대한 lost-update(및 그로 인한 인입 웹훅 서명 검증
fail-open) 를 트리거 단위 `pg_advisory_xact_lock` + "락 안 재읽기·하위 키 병합" 패턴으로 닫는
11 라운드짜리 반복 수정의 마지막 라운드다. 가장 최근 커밋(`91b816498`)이 직전 라운드의 마지막
Critical(`rotateBotToken` 의 `patch` 가 델타가 아니라 스냅샷 전체였던 결함)을 올바르게 닫았음을
`git show` 로 직접 대조해 확인했고, 핵심 프리미티브(`rewriteTriggerConfigLocked`)의 락 배치·
재읽기·데드락 부재는 소스를 직접 읽어 재검증한 결과 여전히 견고하다. 이번 라운드에서 새로
발견한 blocking 항목은 없다. 언급한 세 잔여 항목(`SchedulesService.update()` 의 name/isActive
컬럼 동기화, `cleanupRotatedChatChannelTokens` 의 무조건 null-write, cron 스윕의 순차 트랜잭션)
은 모두 이 PR 이전에 이미 별도 라운드가 발견해 `plan/in-progress/trigger-config-lost-update.md`
§후속(developer 범위) 표에 "이 PR 로 넓히지 않는다" 로 명시 등재된 것과 정확히 일치하며, 독립
재확인을 통해 그 처분이 여전히 유효함을 검증했다. `mergeIntoFreshSubKey` 의 미사용
`fallback` 매개변수는 현재 동작 자체는 올바르지만 다음 재사용자의 오독 가능성이 있어 INFO로
남긴다. 이번 배치를 막을 동시성 사유는 없다.

## 위험도

LOW
