# 테스트(Testing) 리뷰 — trigger-config-lost-update

## 검토 범위

`git diff origin/main...HEAD --stat -- codebase/` 로 확인한 17개 codebase 파일(+2038/-160)을
전수 확인했다. 핵심 production 변경은 5개(`hooks.service.ts`·`schedules.service.ts`·
`chat-channel-binder.service.ts`·`chat-channel-input-rules.ts`·`triggers.service.ts` +
신규 `trigger-config-lock.ts`)이고, 나머지는 테스트/테스트-유틸/정적 가드(`endpoint-path-*`)다.
프롬프트에서 diff 가 생략된 파일(`trigger-config-lock.ts`·`.spec.ts`·
`trigger-transaction-mock.ts`·`chat-channel-binder.service.ts`·`triggers.service.ts`·
`.spec.ts`·e2e-spec)은 `Read`/`git show` 로 원본을 직접 열어 확인했다. `review/code/**` 하위
과거 라운드(18_17_44 ~ 23_01_18) 산출물은 코드가 아니므로 이번 라운드 테스트 관점 평가 대상에서
제외했다(다만 그 라운드들이 지적한 testing CRITICAL 이 이번 diff 에서 실제로 닫혔는지는 대조했다).

이 PR 은 이미 8라운드에 걸쳐 mutation 실측 기반으로 테스트를 반복 강화해 온 이력이 있고
(`CHANGELOG.md`, 각 테스트 파일의 인라인 JSDoc 이 그 이력을 남긴다), 직전 라운드
(`review/code/2026/09/14/23_01_18`)가 지적한 testing CRITICAL#1(`cleanupRotatedChatChannelTokens`
전환은 했으나 동작 테스트 0건)은 이번 diff 의 마지막 커밋(`833bb745a`)에서 `Object.keys(patch)`
단언과 함께 닫힌 것을 `triggers.service.spec.ts:4139-4167` 에서 직접 확인했다.

## 발견사항

- **[INFO]** 테스트 유틸 `withTransactionMock` 의 idempotence 가드 분기가 어떤 테스트에서도 실행되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` — `if (triggerRepoMock.manager) return triggerRepoMock;` (함수 `withTransactionMock` 본문 첫 줄)
  - 상세: 이 헬퍼를 호출하는 6개 자리(`triggers.service.spec.ts` 5곳, `triggers.web-chat.spec.ts` 1곳)를 전수 확인했는데, 어느 쪽도 이미 `manager` 프로퍼티를 가진 repo mock 을 넘기지 않는다 — 즉 이 이른-반환 분기는 이 PR 안 어디에서도 도달하지 않는 dead branch 다. 이 분기가 잘못돼도(예: 조건이 뒤집히거나, 진짜로 이미 `manager` 가 있는 mock 이 나중에 이 헬퍼에 들어와 이중 래핑이 되는 경우) 지금 스위트는 그것을 잡지 못한다. production 코드가 아니라 테스트 유틸이라 심각도는 낮지만, 이 헬퍼가 "6개 파일에 흩어진 provider 중 아직 이관 안 한 4개(`auth-configs`·`external-interaction`·`hooks`·`schedules`)로 확장될 것"이라는 파일 자신의 JSDoc 예고와 맞물리면, 다음 확장자가 이미 `manager` 를 가진 mock 에 이 헬퍼를 씌우는 시나리오가 실제로 생길 수 있다.
  - 제안: 이미 `manager` 를 가진 mock 을 넘겼을 때 원본을 그대로 반환하는지 확인하는 테스트 1개를 `trigger-transaction-mock.ts` 옆에 추가하거나(전용 spec 파일 신설), 최소한 이 분기의 존재 이유를 아는 다음 사람이 실수로 지우지 않도록 JSDoc 에 "테스트 없음 — 사용처 없음" 을 명시.

- **[INFO]** `SchedulesService.update()` 의 trigger patch — `name`+`isActive` 동시 변경 조합이 테스트되지 않는다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — `describe` 블록 내 490~533 라인 부근 (`수정 — isActive:false...`, `수정 — name 만 바꾸면...` 두 `it`)
  - 상세: 이번 PR 이 추가한 두 테스트는 각각 `isActive` 단독 변경, `name` 단독 변경만 검증한다. `schedules.service.ts:241-246` 의 `patch` 조립은 두 개의 독립된 `if` 로 같은 객체에 필드를 더하는 구조라 실무적으로 위험은 낮지만, "PATCH 로 이름과 활성 여부를 동시에 바꾸면 `update()` 호출에 두 필드가 함께 실리는가" 를 직접 행사하는 케이스가 없다 — 예를 들어 두 번째 `if` 가 실수로 `patch = {}` 로 재초기화되는 뮤턴트가 들어와도 name-only/isActive-only 테스트만으로는 못 잡을 수 있다(단독 케이스에서는 재초기화가 그 필드 하나만 있을 때와 구분되지 않는다).
  - 제안: `{ name: 'new', isActive: false }` 를 함께 보내는 케이스 하나를 추가해 `update` 호출의 patch 가 `{ name: 'new', isActive: false }` 양쪽을 모두 담는지 단언.

- **[INFO]** 동일한 테스트 제목이 서로 다른 `describe` 블록에 중복
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:201`, `:810` — 둘 다 `it('lastTriggeredAt 갱신이 config 를 다시 쓰지 않는다 (컬럼 한정 update)', ...)`
  - 상세: 하나는 최상위 `describe('HooksService')` 바로 아래(webhook 일반 경로), 다른 하나는 `describe('Chat Channel 분기')` 안(채팅 채널 경로)에 있어 Jest 가 스코프로는 정확히 구분하지만, `--testNamePattern`/CI 실패 요약처럼 제목만 평평하게 나열하는 도구에서는 두 실패가 구분되지 않는다. 실제로 이 두 자리는 이 PR 이 "한쪽만 회귀 테스트를 가져 다른 쪽이 되돌려져도 전건 GREEN 이었다"(`review/code/2026/09/14/19_44_08` testing CRITICAL#2)고 스스로 기록한 바로 그 두 자리라, 앞으로 이 둘을 구분해서 추적할 필요성이 특히 높다.
  - 제안: 제목에 `(handleWebhook)` / `(chat-channel)` 처럼 최소한의 구분자를 붙인다.

- **[INFO]** `acquireTriggerConfigLock` 의 `SET LOCAL lock_timeout` 분기가 전용 unit 이 아니라 서비스 경유로만 행사된다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-63` (`acquireTriggerConfigLock`) vs `trigger-config-lock.spec.ts` (이 함수를 직접 부르는 테스트 없음 — `rewriteTriggerConfigLocked` 를 통해 옵션 없는 호출만 간접 행사)
  - 상세: `timeoutMs` 분기(`Math.trunc` 를 거친 문자열 삽입 포함)는 `triggers.service.spec.ts` 의 `remove()` 테스트가 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5000) 하나의 값으로만 간접 행사한다. 이 헬퍼 자체를 직접 부르는 테스트 파일(`trigger-config-lock.spec.ts`)에는 `acquireTriggerConfigLock` 를 이름으로 부르는 테스트가 없다. 위험은 낮다 — 이 값은 사용자 입력이 닿지 않는 모듈 상수 하나뿐이라 등가 클래스가 사실상 1개다.
  - 제안: 급하지 않음. 헬퍼를 재사용하는 다음 자리가 생기면(JSDoc 이 그 가능성을 예고한다) 그때 `acquireTriggerConfigLock` 전용 테스트(옵션 없음/있음 두 케이스)를 `trigger-config-lock.spec.ts` 에 추가하는 것으로 충분하다.

## 긍정적으로 확인한 점 (참고)

- `trigger-config-lock.spec.ts` 가 헬퍼의 계약(락→읽기 순서, lock key 바인딩, 재읽은 config 로 머지, null/undefined 좁히기, columns/config 스프레드 순서, 삭제 경합 시 `false`+merge 미호출, 존재 시 `true`)을 서비스 경유로는 만들 수 없는 분기까지 포함해 독립적으로 고정하고 있다.
- `trigger-transaction-mock.ts` 의 JSDoc 이 "기본 위임을 no-op 으로 두면 53개 케이스가 RED" 라는 실측을 근거로 위임 설계를 정당화하고, "이 수는 시점 의존이다" 라고 스스로 못박아 재사용자가 오래된 숫자를 신뢰하지 않게 한다 — memory 의 "실측했다" 반복 함정을 스스로 경계한 서술이다.
- `chat-channel-input-rules.spec.ts` 의 `extractInboundSigningRef` `it.each` 7케이스가 `chatChannel` 부재/`null`/키 부재/빈 config/`config` 자체가 `null`·`undefined` 인 경우까지 등가 클래스를 빠짐없이 덮는다.
- `trigger-config-lost-update.e2e-spec.ts` 는 두 요청의 겹침을 타이밍(우연)이 아니라 advisory lock 을 테스트가 직접 쥐는 방식으로 강제해 판별력을 확보했고, 서로 다른 자리를 무는 3개 단언(①PATCH 값 생존 ②ref 생존 ③미접촉 키 생존)을 "하나만 남기면 나머지가 조용히 통과한다" 는 이유로 함께 걸어 뒀다.
- `triggers.service.spec.ts` 의 `withRef`/`withoutRef`/`freshSequence` 설계가 "바깥 읽기 == 락 안 재읽기" 인 기본값의 함정(변경이 관측되지 않는 vacuous 위험)을 `freshFindOne` 옵션으로 구조적으로 피하고, 이번 PR 마지막 커밋까지 포함해 "같은 클래스의 자리가 몇 개 더 있는가" 를 반복 실측하며 `mergeIntoFreshSubKey` 로 수렴시켰다.
- 직전 라운드가 지적한 testing CRITICAL(`cleanupRotatedChatChannelTokens` 무테스트, `rotateBotToken` 하위 키 스냅샷 대입, `promoted` 카운터가 쓰기 skip 과 분리)이 이번 diff 마지막 커밋에서 뮤턴트 실측(RED 확인)과 함께 전부 닫혔다.

## 요약

이 PR 은 이미 여러 라운드에 걸쳐 뮤테이션 실측으로 테스트의 판별력(discriminating power)을 검증하며 하드닝해 온 이력이 있고, 이번 최종 diff 에서도 직전 라운드가 지적한 testing CRITICAL 이 실제로 닫힌 것을 확인했다. 헬퍼(`rewriteTriggerConfigLocked`)의 순서·삭제 경합·null 처리, 서비스 계층의 하위 키 병합·삭제 레이스·404 분기, e2e 의 실제 동시성 재현까지 핵심 경로의 커버리지 갭은 발견되지 않았다. 남은 항목은 전부 INFO 수준— 테스트 유틸의 미행사 분기 1곳, 서비스 patch 조합 테스트 1곳 누락, 테스트 제목 중복 1쌍, 헬퍼 옵션 분기의 간접 커버리지 1곳 — 이며 이번 배치를 막을 사유는 아니다.

## 위험도

LOW
