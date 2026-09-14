# 테스트(Testing) 리뷰 — trigger-config-lost-update

## 검토 범위

`git diff origin/main...HEAD --stat -- codebase/` 기준 17개 코드 파일(+2,148/-162)을 전수
확인했다. 이 PR 은 이미 11회의 `/ai-review` 라운드를 거치며 각 라운드가 뮤테이션 실측으로
테스트 갭을 찾아 닫아 온 이력이 있다 — `plan/in-progress/trigger-config-lost-update.md` 와
`trigger-transaction-mock.ts`/각 spec 의 헤더 주석에 그 실측(RED/GREEN 건수)이 그대로
남아 있다. 이번 라운드(00_38_16)는 직전 라운드(00_07_52, Critical 0·Warning 3)의 수정
커밋(`3641ead21`)이 그 3건을 실제로 닫았는지, 그리고 최근 5개 커밋
(`a92bce095`~`3641ead21`)이 새 갭을 남기지 않았는지를 중심으로 확인했다.

핵심 파일을 직접 열어 확인했다: `trigger-config-lock.ts`/`.spec.ts`,
`triggers.service.ts`(1618줄)/`.spec.ts`(4218줄), `chat-channel-binder.service.ts`,
`chat-channel-input-rules.ts`/`.spec.ts`, `hooks.service.ts`/`.spec.ts`,
`schedules.service.ts`/`.spec.ts`, `__test-utils__/trigger-transaction-mock.ts`,
`trigger-config-lost-update.e2e-spec.ts`, `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/
`fixtures/endpoint-path-save.fixture.ts`.

## 발견사항

- **[INFO]** `mergeIntoFreshSubKey` 의 `fallback` 분기가 4개 호출부 중 **1곳**에서만
  discriminating 테스트로 커버된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:380-392`
    (`mergeIntoFreshSubKey` 정의) — 호출부는 `:869-874`(`normalizeNotificationSecretRef`),
    `:1149-1154`(`revokePerTriggerToken`), `:1321-1330`(`rotateBotToken`),
    `:1442-1447`(`promoteRotatedNotificationSecrets`). fallback 분기 테스트는
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts:4072-4099`
    (`revokePerTriggerToken — 재읽은 행에 그 키가 아예 없으면 fallback 으로 쓴다`) 하나뿐이다.
  - 상세: 이 fallback(재읽은 행에 해당 하위 키가 아예 없을 때 요청 시작 시점 값으로 대체)은
    `3641ead21` 이 "「판별 못 하는 fixture」의 다섯 번째 자리"로 지적·수정한 항목인데, 수정은
    공유 헬퍼 함수 자체를 한 호출부(`revokePerTriggerToken`)로만 행사해 뮤테이션(분기를 `{}`
    로 치환)을 잡는다. 헬퍼가 하나의 순수 함수이므로 이 한 테스트가 헬퍼 내부 로직에 대한
    뮤턴트는 잡아내지만, **호출부별 배선**(예: `promoteRotatedNotificationSecrets` 가 fallback
    경로를 탄 채로 `wrotePromotion` 카운터·`notificationSecretV2` 클리어와 올바르게 상호작용
    하는지, `rotateBotToken` 이 fallback 경로에서도 `botTokenRef`/`inboundSigningRef` 델타를
    잃지 않는지)는 검증되지 않는다. 이 클래스의 결함이 이미 이 PR 안에서 5번 재발했다는 점
    (커밋 메시지 자체가 그렇게 기록)을 감안하면, 호출부 중 하나라도 향후 리팩터로 헬퍼 호출을
    인라인 병합으로 바꾸면 그 순간 이 보호가 조용히 사라진다.
  - 제안: 차단 사유는 아니다(공유 프리미티브 뮤턴트는 이미 죽는다). 여유가 있으면
    `promoteRotatedNotificationSecrets`/`rotateBotToken`/`normalizeNotificationSecretRef`
    각각에 대해 "재읽은 행에 해당 하위 키가 없다" 케이스를 1개씩 추가해, 헬퍼가 아니라
    **각 호출부의 배선**을 고정하는 것이 안전하다.

- **[INFO]** e2e 의 진단용 단언(④ `blockedBeforeRelease`)이 고정 sleep 이후 단발 관측이라
  타이밍에 취약할 수 있다
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts:183-191`,
    `:230-231`
  - 상세: `SETTLE_MS`(300ms) 대기 후 `bSettled` 와 DB 상태를 한 번만 읽어 "B 가 락에서
    실제로 멈춰 있었다"를 기록한다. CI 환경이 예상보다 느려 그 시점까지 B 의 첫 쓰기 시도조차
    시작하지 못했거나, 반대로 예상보다 빨라 이미 값이 반영됐다면 이 관측 자체가 흔들릴 수
    있다. 다만 저자가 스스로 이 값을 "판별이 아니라 관측 보조"로 명시하고, 실제 회귀를 잡는
    단언 ①②③(`:225,227,229`)은 advisory lock 을 테스트가 직접 쥐고 있어 타이밍과 무관하게
    결정적이다 — ④ 는 진단 정보에 가깝다.
  - 제안: 차단 사유는 아니다. ④ 가 실제로 실패하는 사례가 관측되면 고정 sleep 대신
    `pg_stat_activity` 폴링(짧은 간격 반복 확인)으로 바꾸는 것을 고려할 수 있다.

## 긍정적으로 확인한 점

- **discriminating fixture 규율이 실제로 지켜진다.** `withoutRef`/`withRef`,
  `chan(30)`/`chan(99)`, `legacy(url1)`/`legacy(url2)` 등 "두 상태가 같은 키를 다른 값으로
  가진다"는 원칙이 최근 라운드의 모든 회귀 테스트에 적용돼 있다 — 이 PR 자체가 여러 차례
  "새로 생긴 필드만 검증해 스냅샷 통째 대입을 못 잡는" vacuous 테스트를 뮤테이션으로 잡아
  고친 이력이 `triggers.service.spec.ts:4111-4148`(`rotateBotToken`) 등에 남아 있다.
- **트랜잭션 mock 을 공유 유틸(`__test-utils__/trigger-transaction-mock.ts`)로 승격**해
  6개 spec 파일에 흩어질 뻔한 배선을 한 곳으로 모았고, `onLock`/`onLockTimeout`/
  `freshFindOne` 훅으로 "락 순서"·"타임아웃 SQL"·"두 읽기가 실제로 다르다"를 모두 관측
  가능하게 만들었다 — SQL 한 줄짜리 락은 원래 테스트에서 관측 고리가 없었는데, 이 설계가
  그 고리를 만들었다.
- **e2e 가 우연한 인터리빙에 기대지 않는다.** advisory lock 을 테스트 코드가 직접 잡아 요청
  B 를 결정적으로 멈춰 세우고, 세 축(PATCH 값·확립된 ref·손대지 않은 키)을 각각 다른
  단언으로 문다 — "하나만 남기면 나머지가 조용히 통과한다"는 이 세션의 반복된 교훈이
  구조적으로 반영돼 있다.
- **정적 래칫(`endpoint-path-conflict-wrap-guard.ts`)이 실제 프로덕션 형태**
  (`manager.transaction(async (m) => { …; return m.save(Trigger, target); }).catch(...)`)
  **와 합성 fixture 양쪽을 모두 스캔**하고, 새 `EntityManager.save(Trigger, …)` 형태·다른
  엔티티(`Execution`)·다른 리포지토리(`schedule`)를 각각 양성/음성 fixture 로 갈라 검증한다.
- `Object.keys(patch)` 형태의 "정적 래칫은 `.save(` 만 세고 `.update(` 내용물은 안 본다"는
  자체 반성이 `cleanupRotatedChatChannelTokens`(`:4177-4205`) 등 컬럼 한정 `update` 전환
  자리마다 반복 적용돼 있다.

## 요약

이 PR 은 11라운드에 걸친 뮤테이션 기반 리뷰 사이클을 거치며 스냅샷 통째 대입·컨테이너만
재읽고 하위 키는 놓치는 함정·helper 를 쓰면서 helper 가 막으려던 결함을 재현하는 패턴·
vacuous fixture 등 같은 클래스의 결함을 여러 차례 반복해 발견·수정해 왔고, 그 과정에서
확립된 "discriminating fixture"·"공유 트랜잭션 mock"·"순서까지 단언" 규율이 최신 커밋까지
일관되게 적용되어 있다. 직전 라운드(00_07_52)의 Warning 3(문서 서술 과소·fallback 분기
미행사)은 `3641ead21` 이 실제로 닫았음을 확인했다. 남은 항목은 두 건 모두 INFO 수준이며
(공유 헬퍼의 fallback 분기가 4개 호출부 중 1곳에서만 discriminating 테스트로 커버됨, e2e
진단용 단언의 타이밍 취약성) 이번 배치를 막을 사유가 아니다.

## 위험도

LOW
