# 테스트(Testing) 리뷰 — trigger-config-lost-update (3라운드)

## 검증 방법

이전 두 라운드(`18_17_44`→CRITICAL 2건, `19_07_43`→전부 닫힘·LOW)가 `trigger-config-lock.ts`
경로(창 2·3·4)의 뮤테이션 내성을 이미 검증해 뒀으므로, 이번 라운드는 **그 이후에 새로 들어온
변경**(`hooks.service.ts` 웹훅 hot path 수정, `triggers.service.ts` 창 1 관련 후속, 신규
`trigger-transaction-mock.ts`/`endpoint-path-conflict-*` 가드)에 집중해 같은 방식(저장소 밖
scratch 에 원본을 `cp` 로 백업 → 저장소 파일을 직접 뮤테이션 → 테스트 실행 → `cp` 로 원복 →
`git status --short` 로 잔여물 없음 확인)으로 독립 재검증했다.

**뮤테이션 1 — `hooks.service.ts` `handleChatChannelWebhook`(라인 700-704)의
`update({id}, {lastTriggeredAt})` 를 종전 `save(trigger)` 로 되돌림 → `hooks.service.spec.ts`
54건 전부 GREEN.** (아래 CRITICAL 참조)

**뮤테이션 2 (대조) — 같은 파일 `handleWebhook`(라인 232-236)의 동일 패턴을 같은 방식으로
되돌림 → 1건 RED**(`lastTriggeredAt 갱신이 config 를 다시 쓰지 않는다` 테스트가 정확히 잡는다).
이 대조로 뮤테이션 1 의 GREEN 이 "테스트 파일 자체가 안 도는" 류의 무효 뮤턴트가 아니라
실제로 그 call site 만 무방비임을 확인했다.

두 뮤테이션 모두 원복 후 `md5`/`git status --short` 로 원본과 바이트 단위 일치, 저장소에
잔여 변경 없음(`?? review/code/2026/09/14/19_44_08/` 만 존재)을 확인했다.

## 발견사항

- **[CRITICAL]** `hooks.service.ts` 의 두 hot-path 수정 중 **chat-channel 인입 경로(더 잦은 쪽)만
  회귀 테스트가 없다** — 위 뮤테이션 1로 실측 확인
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:695-704`
    (`handleChatChannelWebhook` 안, `trigger.lastTriggeredAt = new Date(); await
    this.triggerRepository.update({ id: trigger.id }, { lastTriggeredAt: ... })`).
    대응하는 테스트 부재 위치는 `codebase/backend/src/modules/hooks/hooks.service.spec.ts`
    — 신설된 회귀 테스트(`:201` `lastTriggeredAt 갱신이 config 를 다시 쓰지 않는다`)는
    `activeTrigger.type = 'webhook'` 을 써서 **`handleWebhook`(:226-236) 경로만** 부른다.
    `describe('Chat Channel 분기', ...)`(`:590`) 블록의 "새 execution 시작" 테스트
    (`:798`)는 이 두 번째 `update()` 호출을 통과하지만, 그 자리를 겨눈 단언
    (`triggerRepo.save` 가 안 불렸는지, `update` 의 patch 가 `lastTriggeredAt` 하나뿐인지)이
    이 파일 어디에도 없다.
  - 상세: `hooks.service.ts` 의 이번 diff 는 정확히 대칭인 두 자리(`handleWebhook` ·
    `handleChatChannelWebhook`)를 `save(trigger)` → 컬럼 한정 `update()` 로 함께 고쳤고,
    `CHANGELOG.md`/커밋 메시지(`c7a9c107e`)/plan(`plan/in-progress/trigger-config-lost-update.md:349-353`)
    모두 "두 자리 모두 고쳤고 **뮤턴트 두 방향이 모두 RED** 임을 확인했다" 고 서술한다.
    그런데 실제로 뮤테이션해 보면 **두 번째 자리(chat-channel 인입)만 되돌려도 그 파일
    54건이 전부 GREEN** 이다 — plan/CHANGELOG 의 실측 서술이 한쪽 call site 에 대해서는
    사실이 아니다. 이 경로는 이 PR 이 막으려는 바로 그 보안 속성
    (`chatChannel.inboundSigningRef` presence → 인입 서명 검증)을 되돌릴 수 있는 자리이고,
    주석 자신이 "PATCH 끼리의 경합보다 훨씬 잦다(인입 메시지마다 돈다)" 고 적어 두어
    두 자리 중 오히려 **위험도가 더 높은 쪽**이다. 이전 라운드(`19_07_43`)가 발견했던
    "PR 의 핵심 수정이 unit 뮤테이션에 전혀 걸리지 않는다" 는 결함 클래스가, 그 라운드가
    닫힌 뒤 새로 들어온 변경에서 **같은 형태로 재발**한 사례다.
  - 제안: 기존 `:201` 테스트와 대칭인 케이스를 `describe('Chat Channel 분기', ...)` 안
    (예: `:798` 테스트를 확장하거나 별도 `it`)에 추가한다 — `chatChannelTrigger` 로
    `handleWebhook`(chat-channel 우회 경로)을 불러 "새 execution 시작" 분기를 태운 뒤
    `expect(triggerRepo.save).not.toHaveBeenCalled()` + `update` patch 가
    `{ lastTriggeredAt }` 뿐임을 단언한다. `:201` 테스트가 이미 그 형태(부재 단언 + 형태
    단언 병행)를 갖고 있으므로 거의 그대로 재사용 가능하다.

- **[INFO]** `trigger-config-lock.spec.ts` 의 "config 가 **null** 이면…" 테스트가 실제로는
  `undefined` 만 검증한다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts:93-100`
    (`it('config 가 null 이면 빈 객체로 좁혀 넘긴다', ...)` 본문의
    `makeManager({ config: undefined })`)
  - 상세: 프로덕션 코드(`trigger-config-lock.ts:125`, `fresh.config ?? {}`)는 `??` 라 `null`
    과 `undefined` 를 동일하게 처리하므로 동작상 차이는 없지만, 테스트 제목이 주장하는
    입력값과 실제 fixture 값이 다르다. `Trigger.config` 컬럼이 DB 에서 SQL `NULL` 로
    돌아오는 경우(JSTypeORM 은 이를 JS `null` 로 매핑) 리터럴 `null` 자체를 검증하는
    케이스는 이 스위트에 없다.
  - 제안: 급하지 않음 — 제목을 `undefined`(또는 "nullish") 로 정정하거나, `config: null`
    케이스를 하나 더 추가해 두 값 모두 `{}` 로 좁혀지는 것을 명시적으로 커버.

- **[INFO]** (이전 라운드 `19_07_43` 대비 변화 없음, 재확인) `withTransactionMock` 의
  idempotency 가드와 `freshFindOne` 시퀀스의 "모자라면 마지막 값 반복" 폴백이 여전히 어느
  테스트에도 실행되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:51`
    (`if (triggerRepoMock.manager) return triggerRepoMock;`);
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3680` 부근
    (`Math.min(freshCall, freshSequence.length - 1)`)
  - 상세: 전수 확인(`grep -rn "withTransactionMock(" src/modules/triggers/*.spec.ts`) 결과
    10개 호출부 전부 `.manager` 없는 순수 객체 리터럴만 넘기고, `freshSequence` 는 실제
    재읽기 호출 횟수와 정확히 같은 길이로만 주어진다. 둘 다 프로덕션 코드가 아니라 테스트
    인프라의 방어적 분기라 위험은 낮지만, JSDoc 이 주장하는 "모자라면 마지막 값을 반복한다"
    는 검증된 동작이 아니라 여전히 설계 의도일 뿐이다.
  - 제안: 조치 불필요 수준. 두 분기를 실제로 쓰는 테스트가 생기기 전까지는 "검증된 동작"
    으로 인용하지 말 것.

## 회귀 테스트 유효성 재확인 (참고)

`trigger-config-lock.ts`/`chat-channel-binder.service.ts`/`triggers.service.ts` 창 1 을
둘러싼 unit(`trigger-config-lock.spec.ts` 8건, `triggers.service.spec.ts` 신규 "락 안
재읽기가 동시 확립분을 본다" describe 6건) + e2e(`trigger-config-lost-update.e2e-spec.ts`)
는 이전 두 라운드가 뮤테이션으로 반복 검증했고, 이번 라운드에서 별도로 재실측하지 않았다
(변경 없음 확인만 함 — `git diff origin/main...HEAD` 로 해당 파일들이 `19_07_43` 이후
추가 수정되지 않았음을 확인). `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture
삼종(manager-save 형태 확장, 양성·음성·타 엔티티 세 갈래)도 직접 실행해 GREEN 을 재확인했다.

```
$ npx jest src/repo-guards/__tests__/endpoint-path-conflict-wrap.spec.ts --silent
Tests: 7 passed, 7 total
```

## 요약

이 PR 의 존재 이유인 `trigger-config-lock.ts` 경로(advisory lock + 락 안 재읽기, 4개 창)는
두 차례의 독립 뮤테이션 검증을 거쳐 이제 견고하게 보호돼 있다. 그런데 그 검증이 끝난 **이후**
이번 배치에 추가된 `hooks.service.ts` 웹훅 hot path 수정(같은 fail-open 클래스, plan 이 스스로
"PATCH 경합보다 훨씬 잦다" 고 적은 자리)에서 같은 결함 클래스가 한 곳에 재발했다 — 대칭인 두
call site 중 chat-channel 인입 경로(더 잦고 더 위험한 쪽)만 회귀 테스트가 없다는 것을
뮤테이션으로 실측했고(반대편 call site 는 같은 방식으로 정확히 RED 를 내 대조군으로 확인),
plan/CHANGELOG 가 "뮤턴트 두 방향 모두 RED" 라고 적은 실측 서술이 그 자리에 대해서는 사실이
아님도 함께 드러났다. 나머지는 전부 INFO 수준(테스트 제목과 fixture 값의 사소한 불일치,
테스트 인프라의 방어적 분기 2곳이 여전히 미실행)이며 차단 사유가 아니다.

## 위험도

HIGH
