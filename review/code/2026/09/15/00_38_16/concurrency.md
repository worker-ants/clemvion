# 동시성(Concurrency) 리뷰 — trigger-config-lost-update

## 검토 범위

`git diff origin/main...HEAD --stat -- codebase/` 로 확인한 17개 codebase 파일 중 동시성과
직접 관련된 것은 `trigger-config-lock.ts`(신규) · `triggers.service.ts` ·
`chat-channel-binder.service.ts` · `hooks.service.ts` · `schedules.service.ts` ·
`chat-channel-input-rules.ts` 와 이들의 테스트/e2e다. 각 파일을 전체 컨텍스트로 직접 Read
했다(프롬프트가 크기 제한으로 diff 를 생략한 파일 포함). `endpoint-path-conflict-wrap-guard.ts`
류는 정적 분석 스크립트라 런타임 동시성 표면이 아니라서 이 리뷰의 관점 밖으로 두었다.

핵심 설계: `rewriteTriggerConfigLocked`(`trigger-config-lock.ts`)가 트리거 단위
`pg_advisory_xact_lock(hashtext('trigger-config:<id>'))` 를 잡은 뒤 **락 안에서 config 를
다시 읽어** 병합·저장한다. 외부 HTTP 호출(`adapter.setupChannel` 등)은 항상 락 **밖**에서
끝낸 뒤 이 함수를 부르므로, Cafe24 advisory lock 기각 선례(락 보유 중 HTTP 를 트랜잭션에
묶지 않는다)를 정확히 지킨다. `TriggersService.update()`(창 1)만 `save(entity)` 계약을
보존하기 위해 같은 락을 인라인으로 잡고 재읽은 행을 저장 대상으로 쓴다. 삭제(`remove()`)도
같은 락을 잡되 5초 타임아웃을 둬 "정리는 끝났는데 행은 남은" 반쯤-삭제 상태를 드러나는
오류로 바꾼다. `trigger-config-lost-update.e2e-spec.ts` 가 실제 Postgres 연결로 동시 PATCH
겹침을 advisory lock 을 테스트가 직접 쥐어 강제 재현하고, "겹침 없이 통과"하는 vacuous
테스트가 되지 않도록 겹침 여부(`blockedBeforeRelease`)까지 관측·단언한다 — 이 종류 e2e 로는
드물게 신뢰도가 높다.

데드락 관점: 모든 락 획득은 트리거 1개 id 에 대한 단일 advisory lock 이고, 어느 경로도 같은
트랜잭션 안에서 두 번째 트리거의 락이나 다른 종류의 락을 추가로 잡지 않는다(중첩·교차 순서
없음) — 데드락 가능 조합을 찾지 못했다.

## 발견사항

- **[INFO]** 창 1(`TriggersService.update()`)의 전체-행 `save()`가, 같은 advisory lock
  도메인 밖에 있는 세 컬럼-한정 writer 의 커밋을 되돌릴 수 있는 좁은 창이 남아 있다 — **이미
  8·9라운드 리뷰가 발견해 이 PR 범위 밖 후속으로 수용·등재한 항목**이며, 코드를 직접 읽어
  현재 HEAD 에서도 그대로 존재함을 확인했다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:621-671`(창 1 —
    `manager.transaction(async (m) => { acquireTriggerConfigLock(...); const fresh = await
    m.findOne(...); ...; return m.save(Trigger, target); })`, 특히 667-669)
    vs `codebase/backend/src/modules/triggers/triggers.service.ts:1087-1093`
    (`rotateNotificationSecret` 의 `triggerRepository.update({id}, {notificationSecretV2,
    notificationRotatedAt})`, 락 미참여), `codebase/backend/src/modules/triggers/triggers.service.ts:1500-1503`
    (`cleanupRotatedChatChannelTokens` 의 v2 컬럼 클리어, 락 미참여),
    `codebase/backend/src/modules/schedules/schedules.service.ts:241-246`(`SchedulesService.update()`
    의 `name`/`isActive` 컬럼 patch, 락 미참여).
  - 상세: 창 1 은 advisory lock 을 잡은 **뒤** `m.findOne` 으로 재읽고, 그 결과(`fresh`)를
    `defined`/`config` 로 덮어쓴 `target` 을 같은 트랜잭션 안에서 `m.save(Trigger, target)`
    한다. `save()` 는 `target` 이 들고 있는 **모든** 컬럼을 UPDATE 하므로, `defined` 가
    건드리지 않는 컬럼(`notificationSecretV2`·`notificationRotatedAt`·`chatChannelTokenV2`·
    `chatChannelRotatedAt`·`name`·`isActive` 등)은 `fresh` 스냅샷 값 그대로 다시 쓰인다.
    위 세 writer(`rotateNotificationSecret`·`cleanupRotatedChatChannelTokens`·
    `SchedulesService.update()`)는 컬럼 한정 `update()` 라 **서로에게는** 안전하지만,
    advisory lock 을 잡지 않으므로 창 1 의 락과 무관하게 아무 때나 자신의 UPDATE 를 실행할 수
    있다. Postgres 는 `SELECT`(m.findOne) 에 행 잠금을 걸지 않으므로, 이 셋 중 하나가 창 1의
    `m.findOne` **이후** ~ `m.save` **이전** 사이 짧은 창에 커밋되면, 창 1 의 `save` 가 그
    컬럼을 조용히 되돌린다 — 이 PR 전체가 `config` 에 대해 닫으려는 것과 **같은 lost-update
    메커니즘**이 이 세 컬럼 집합에는 그대로 남아 있는 것이다. `notificationSecretV2` 케이스는
    plan 이 스스로 "관측용(`lastTriggeredAt`)과 달리 보안 성격"이라고 적었듯, 방금 회전된
    HMAC 서명 secret 이 창 1 저장으로 조용히 구 값으로 되돌아갈 수 있어 세 항목 중 가장
    무겁다(다만 `update()` PATCH 는 `chatChannel`/`notification`/`interaction` 등 특정 필드가
    있을 때만 자주 호출되므로 rotate 직후 우연히 창 1 PATCH 가 겹쳐야 하는 좁은 창이다).
  - 참고: `plan/in-progress/trigger-config-lost-update.md:616`("`rotateNotificationSecret`
    이 락 도메인 밖 | 창 1의 저장이 그 사이 커밋된 `notificationSecretV2` 회전을 되돌릴 수
    있다... 8라운드 W4")·`:619`("`SchedulesService.update()`... 9라운드 W2")·`:615`
    (`cleanupRotatedChatChannelTokens`, 8라운드 W2)에 이미 등재돼 있고, "이 PR 로 넓히지
    않는다"는 후속 표에 명시적으로 들어가 있다. `trigger-config-lost-update.e2e-spec.ts` 도
    이 세 조합은 재현하지 않는다(binder vs 창 1 조합만 재현) — 스코프 결정과 일치하며 테스트
    누락이 아니다.
  - 제안: 이번 PR 을 막을 사유는 아니다(이미 리뷰·수용·문서화됨, 재확인 차원). 후속 PR 에서
    세 writer 도 `acquireTriggerConfigLock`/`rewriteTriggerConfigLocked` 도메인에 편입하거나,
    최소한 `notificationSecretV2` 케이스만이라도 낙관적 `WHERE notification_secret_v2 = :old`
    조건부 UPDATE 로 좁히는 것을 검토할 것(plan 이 `cleanupRotatedChatChannelTokens` 에 이미
    같은 처방을 제안해 뒀다).

- **[INFO]** 트리거 단위 advisory lock 이 이번 PR 로 1개 경로에서 7개 이상 경로로 넓어졌고,
  삭제를 뺀 전 경로가 대기 상한(`lock_timeout`) 없이 무한 대기한다 — 이미 8라운드가 등재한
  항목의 재확인.
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-63`
    (`acquireTriggerConfigLock`, `options.timeoutMs` 미지정 시 무제한 대기),
    `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(같은 파일 76행)만 `remove()`(triggers.service.ts:1027-1029)
    에 쓰인다.
  - 상세: `rewriteTriggerConfigLocked` 를 지나는 6개 이상의 호출부(창 2·3·4, notification
    정규화/회전 승격 cron 둘, per-trigger 토큰 폐기 등) + 창 1 인라인까지, 같은 트리거 id 에
    대한 config 재작성은 전부 같은 락 뒤에서 직렬화된다. 임계 구간이 "재읽기 + 머지 + UPDATE"
    뿐이라 보유 시간은 짧지만, 특정 트리거에 쓰기가 몰리면(예: 짧은 시간에 PATCH 반복 + 웹훅
    폭주 + cron 승격이 겹치는 트리거) 대기가 직렬로 누적되고 상한이 없어 커넥션 풀 슬롯을
    오래 점유할 수 있다. 데이터 정합성 문제는 아니고 지연/풀 소진 성격이다.
  - 참고: `plan/in-progress/trigger-config-lost-update.md:618`(8라운드 W6)에 이미 "이 PR 이
    이 패턴을 1곳에서 7곳 이상으로 넓혔다"고 정확히 같은 지적이 등재돼 있다.
  - 제안: 조치 불요(수용·추적됨). 특정 트리거의 컨텐션이 실측되면 그때 `lock_timeout` 을
    추가하는 것으로 이미 방향이 잡혀 있다.

## 요약

핵심 수정(advisory lock + 락 안 재읽기 + 외부 호출을 락 밖에 두는 설계)은 견고하고, 데드락을
일으킬 수 있는 중첩·교차 락 순서는 발견되지 않았다. e2e 테스트가 advisory lock 을 테스트가
직접 쥐어 겹침을 강제 재현하고 겹침 자체를 관측·단언해 vacuous 위험이 낮다. 유일하게 남는
것은 창 1(`TriggersService.update()`)의 전체-행 `save()`가 advisory lock 도메인 밖의 세
컬럼-한정 writer(`rotateNotificationSecret`·`cleanupRotatedChatChannelTokens`·
`SchedulesService.update()`)의 커밋을 좁은 창에서 되돌릴 수 있다는 점인데, 이는 코드를 직접
읽어 현재도 실재함을 확인했지만 이미 8·9라운드 리뷰가 발견해 plan 의 "이 PR 로 넓히지 않는다"
후속 표에 근거와 함께 명시적으로 수용·등재된 항목이다. 동일하게 advisory lock 사용 경로가
넓어지며 무제한 대기가 늘어난 점도 8라운드가 이미 등재했다. 새로 발견한 차단급 결함은 없다.

## 위험도

LOW
