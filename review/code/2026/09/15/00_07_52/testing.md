# 테스트(Testing) 리뷰 — trigger-config-lost-update

## 검토 범위

`git diff origin/main...HEAD --stat -- codebase/` 로 17개 codebase 파일(+2112/-162)을 확인했다.
`trigger-config-lock.ts`(신규)·`trigger-config-lock.spec.ts`(신규)·`triggers.service.ts`/`.spec.ts`·
`chat-channel-binder.service.ts`·`hooks.service.ts`/`.spec.ts`·`schedules.service.ts`/`.spec.ts`·
`chat-channel-input-rules.ts`/`.spec.ts`·`__test-utils__/trigger-transaction-mock.ts`·
`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`+fixture·e2e 신규 스펙을 전부 `Read` 로 직접
열어 대조했다(프롬프트가 크기 제한으로 생략한 파일 포함).

`plan/in-progress/trigger-config-lost-update.md` 를 함께 읽었다 — 이 PR 은 이미 10라운드
`/ai-review` 를 거쳤고, 그중 다수(1·2·3·7·9·10라운드)가 정확히 "테스트가 vacuous 했다"는
testing 관점 CRITICAL 이었다. 이번 라운드가 보는 것은 그 10라운드 수정 뒤의 **최종 상태**다.

## 발견사항

- **[WARNING]** `mergeIntoFreshSubKey` 의 `fallback` 분기가 4개 호출부 어디에서도 판별되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:380-392` (`mergeIntoFreshSubKey`)
    — 호출부 4곳: `:869`(`normalizeNotificationSecretRef`) · `:1149`(`revokePerTriggerToken`) ·
    `:1321`(`rotateBotToken`) · `:1442`(`promoteRotatedNotificationSecrets`)
  - 상세: 이 함수는 이 PR 의 핵심 수정 그 자체다 — "하위 키까지 재읽는다"는 9라운드 CRITICAL 이
    닫힌 자리(§D, `plan/in-progress/trigger-config-lost-update.md:3996-4003`)가 바로 이 함수다.
    ```ts
    const current = freshConfig?.[key];
    const base =
      typeof current === 'object' && current !== null
        ? (current as Record<string, unknown>)
        : fallback;
    return { ...freshConfig, [key]: { ...base, ...patch } };
    ```
    JSDoc 자신이 `@param fallback 재읽은 행에 그 키가 없을 때의 기준(보통 요청 시작 시점 값)`
    이라고 이 분기의 존재 이유를 명시한다. 그런데 `triggers.service.spec.ts` 의 기존
    테스트 4개(`normalizeNotificationSecretRef — 재읽은 notification 의 url 이 살아남는다`
    `:4031`, `revokePerTriggerToken — 재읽은 interaction 의 다른 필드가 살아남는다` `:4011`,
    `rotateBotToken — 재읽은 chatChannel 의 다른 필드가 살아남는다` `:4082`,
    `promoteRotatedNotificationSecrets` 계열 `:2565`~`:2634`)는 전부 락 안 재읽기의
    `freshConfig[key]` 가 **이미 객체로 존재하는** fixture(`withInteraction()`, `chan(99)`,
    `withRef`/`withoutRef`, `baseTrigger(signing)`)만 쓴다 — `current` 가 항상 truthy 객체라
    삼항의 `?` 분기만 행사되고 `:` 분기(= `fallback` 사용)는 이 스위트 전체에서 한 번도
    실행되지 않는다.
  - 왜 이게 이 PR 의 다른 vacuous 사례와 같은 클래스인가: 10라운드에 걸쳐 반복 지적된 패턴이
    정확히 "두 상태(스냅샷/재읽은값)가 fixture 상 **같은 값**이라 분기가 관측되지 않는다"
    였다(`withTransactionMock` JSDoc 의 CRITICAL#2·#3 실측, `rotateBotToken` 10라운드 C1의
    "fixture 가 스냅샷 쪽에 그 키를 아예 두지 않아 vacuous"). `fallback` 분기는 그 계열의
    다섯 번째 자리이고, 아직 닫히지 않았다. 실측(뮤테이션)으로 확인했다 — `mergeIntoFreshSubKey`
    의 삼항을 `const base = (current as Record<string, unknown>) ?? {}`(=`fallback` 완전
    제거, `current` 가 없으면 그냥 빈 객체)로 바꿔도 `triggers.service.spec.ts` 스위트
    전체가 GREEN 이었다(직접 패치 후 `npx jest triggers.service.spec.ts` 로 확인, 이후
    원복). 즉 지금 이 저장소는 "락 안에서 재읽었더니 그 하위 키가 아직 없는 트리거"
    시나리오(예: 최초로 `interaction`/`notification`/`chatChannel` 서브트리를 만드는
    동시 요청과 경합)에서 `fallback` 값을 실제로 실었는지 어떤 테스트도 보증하지 않는다.
  - 제안: 4곳 중 최소 1곳(가장 간단한 `revokePerTriggerToken` 또는 `rotateBotToken`)에
    "락 안 재읽기가 그 하위 키를 아예 갖고 있지 않다"(`freshFindOne`이 해당 서브키가 없는
    행을 돌려주는) fixture 를 추가하고, 결과 patch 가 `fallback`(호출부가 넘긴 pre-lock
    파생값)의 내용을 담는지 단언한다. 4곳이 같은 시그니처를 공유하므로 헬퍼 하나로 나머지
    3곳도 같은 패턴을 따르게 할 수 있다.

- **[INFO]** `acquireTriggerConfigLock` 의 `Math.trunc(timeoutMs)` 정수화가 직접 테스트되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:44-58`
  - 상세: `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` 는 파라미터
    바인딩이 안 되는 문자열 삽입 자리라 `Math.trunc` 가 유일한 방어선이라고 주석이 직접
    설명한다. `triggers.service.spec.ts:3899-3920`(`remove() 도 같은 config 락을 잡는다`)이
    이 문을 지나가지만, 넘기는 값이 이미 정수 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`)라
    `Math.trunc` 가 실제로 값을 바꾸는 입력(예: `5000.7`)으로는 한 번도 불리지 않는다.
    `trigger-config-lock.spec.ts` 에도 `acquireTriggerConfigLock` 단독 테스트가 없다(오직
    `rewriteTriggerConfigLocked` 경유로만 간접 검증). 현재 호출부가 전부 모듈 상수만 넘기므로
    실질 위험은 낮지만(사용자 입력이 닿는 경로가 없다는 것도 주석이 명시), `Math.trunc` 삭제
    같은 뮤턴트가 살아남을 자리다.
  - 제안: `trigger-config-lock.spec.ts` 에 `acquireTriggerConfigLock(manager, id, { timeoutMs: 1500.9 })`
    가 `SET LOCAL lock_timeout = '1500ms'`(소수점 제거)를 정확히 호출하는지 보는 단위 테스트를
    한 케이스 추가하면 충분하다. 급하지 않음.

- **[INFO]** (긍정 확인) 10라운드 C1 "헬퍼를 쓰면서 헬퍼가 막으려던 결함을 냈다" 수정은 판별
  fixture 로 제대로 지켜진다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:4082-4119`
    (`rotateBotToken — 재읽은 chatChannel 의 다른 필드가 살아남는다`)
  - 상세: 재읽은 행(`chan(99)`)과 요청 시작 시점 스냅샷(`chan(30)`)이 같은 키
    (`rateLimitPerMinute`)에 **다른 값**을 갖도록 만들어, `patch` 가 스냅샷 전체로
    되돌아가면 `99` 대신 `30`이 나와 실패하게 설계했다. MEMORY 가 기록한 "대조군은 두 상태가
    다르게 판정하는 값이어야 한다" 원칙을 정확히 지킨 판별 fixture다 — 위 WARNING 항목의
    반례로 남긴다(같은 파일 안에 올바른 패턴과 아직 안 닫힌 자리가 공존한다).

- **[INFO]** `withTransactionMock` — mock 이 실제 동작에 근접하게 설계됨(delegation, not no-op)
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:73-132`
  - 상세: `manager.transaction` 콜백을 실제로 실행하고 `findOne`/`update`/`save`/`remove` 를
    바깥 repo mock 으로 위임한다 — no-op 이었다면 config 쓰기를 단언하는 테스트가 "아무 일도
    안 일어났는데 통과"하는 vacuous 상태가 됐을 것이다(JSDoc 이 뮤테이션 실측 53건으로 직접
    근거를 남김). `freshFindOne` 옵션으로 "바깥 읽기 == 락 안 재읽기"인 기본값이 lost-update
    수정 자체를 검증 못 한다는 점까지 자각하고 있어(파일 상단 JSDoc), 이 저장소 특유의
    "근거는 실측으로" 규율을 mock 설계에도 일관되게 적용한 사례다. 결함으로 지적할 것이 없다.

## 요약

이 PR 은 이미 10라운드의 `/ai-review` 를 거치며 testing 관점 CRITICAL 을 다섯 차례 이상
스스로 찾아 닫았고(대부분 "두 상태가 fixture 상 같은 값이라 분기가 관측되지 않는" vacuous
패턴), 최종 상태는 그 규율을 잘 지킨 판별 fixture(예: `rotateBotToken` 의 30 vs 99)를 다수
포함한다. e2e 스펙(`trigger-config-lost-update.e2e-spec.ts`)도 sleep 경합 대신 advisory lock 을
테스트가 직접 쥐어 결정적으로 겹침을 만드는 설계라 신뢰도가 높다. 다만 이 PR 의 핵심 신규
함수인 `mergeIntoFreshSubKey` 의 `fallback` 분기(재읽은 행에 해당 하위 키가 아예 없는 경우)는
4개 호출부 전부에서 fixture 가 `current` 를 항상 채워 넣어 한 번도 실행되지 않는다 — 뮤테이션으로
직접 확인했다(`fallback` 완전 제거해도 전건 GREEN). 이 PR 이 스스로 반복 지적해 온 "판별하지
못하는 fixture" 클래스의 다섯 번째 미해결 자리로 보이며, 4곳 중 한 곳에만 대표 테스트를
추가해도 나머지 세 곳의 위험은 크게 줄어든다. 그 외에는 `Math.trunc` 정수화 같은 저위험
엣지케이스(INFO) 뿐이고, mock 설계·테스트 격리·가독성은 전반적으로 이 저장소 규율을 잘
따른다.

## 위험도

MEDIUM
