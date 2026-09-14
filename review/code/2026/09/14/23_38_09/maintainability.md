# 유지보수성(Maintainability) 리뷰 — trigger-config-lost-update (2026-09-14 23:38 라운드)

## 검토 범위

이 PR 은 이미 9라운드의 `/ai-review` 를 거쳤다(`18_17_44` ~ `23_01_18`). 이번 라운드는 직전
라운드(`23_01_18`) 이후 새로 커밋된 마지막 커밋 `833bb745a`(직전 라운드의 Critical 1건 —
`cleanupRotatedChatChannelTokens` 회귀 테스트 부재 — 과 WARNING 2건 — `rotateBotToken` 의
같은 클래스 네 번째 자리, orphan JSDoc 세 번째 재발 — 을 처분한 커밋)를 실제 파일 대조로
확인했다. `git show 833bb745a -- codebase/` 로 코드 변경분만 추려 전수 검토했다.

## 발견사항

- **[WARNING]** `rotateBotToken` 의 "네 번째 자리" 수정이 `mergeIntoFreshSubKey` 의 **narrow
  patch 계약을 어겨서**, 정확히 그 계약이 지키려던 시나리오(chatChannel 하위 필드의
  concurrent 수정)를 여전히 놓친다 — 실측으로 재현 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1314`-`1320`
    (`rewriteTriggerConfigLocked` 호출의 머지 콜백 — `mergeIntoFreshSubKey(freshConfig,
    'chatChannel', mergedChannel as unknown as Record<string, unknown>, mergedChannel as
    unknown as Record<string, unknown>)`)과 대조군 `:868`-`874`
    (`normalizeNotificationSecretRef` — `patch = { signing: updatedSigning }`), `:1149`-`1154`
    (`revokePerTriggerToken` — `patch = { triggerToken: newToken }`), `:1432`-`1437`
    (`promoteRotatedNotificationSecrets` — `patch = { signing: updatedSigning }`)
  - 상세: `mergeIntoFreshSubKey` 의 JSDoc(`:361`-`379`)은 스스로 "«어느 하위 키를, 무엇을
    얹어» 를 인자로 강제한다. 호출부가 스냅샷 객체를 통째로 대입할 자리를 없애는 것이
    요점이다" 라고 명시한다. 세 호출부(`normalizeNotificationSecretRef`·
    `revokePerTriggerToken`·`promoteRotatedNotificationSecrets`)는 정확히 이 계약대로
    `patch` 에 **이번 요청이 실제로 바꾸는 필드만** 담은 좁은 객체를 넘긴다. 그런데 이번
    커밋이 새로 고친 `rotateBotToken` 자리는 `patch` 와 `fallback` 두 자리에 **똑같은
    `mergedChannel`**(요청 시작 시점 `chatChannelCfg` 를 스프레드해 재구성한 전체 객체)을
    넘긴다 — 파라미터 이름이 다른 두 자리에 같은 변수를 넣는 것 자체가 "이 둘이 진짜 다른
    역할을 하는가?" 를 되묻게 하는 신호였다.

    `patch` 가 좁혀지지 않았으므로, 락 안에서 재읽은 `freshConfig.chatChannel` 의 필드 중
    **`mergedChannel` 에도 동일한 키가 존재하는 필드**는 무조건 `mergedChannel`(요청 시작
    시점의 스냅샷 값)로 덮인다. `mergedChannel` 은 `mergedConfig = { ...chatChannelCfg,
    botTokenRef }` 를 거쳐 만들어지므로 `chatChannelCfg` 의 **모든** 필드(`rateLimitPerMinute`,
    `uiMapping`, `languageLocale` 등)를 그대로 포함한다. 즉 "그 필드가 요청 시작 시점에
    이미 존재했고, 동시 PATCH 가 그 값을 **바꿨다**" 는 (가장 흔한) 시나리오에서는 여전히
    락 이전 스냅샷 값으로 되돌아간다 — 이번 커밋이 닫았다고 주장하는 바로 그 구멍이다.

    이번 커밋이 추가한 테스트(`triggers.service.spec.ts:4082`-`4110`,
    `rotateBotToken — 재읽은 chatChannel 의 다른 필드가 살아남는다`)는 이 실패 모드를
    잡지 못한다 — `repo.findOne`(요청 시작 시점 읽기)의 기본값(`withoutRef()`,
    `triggers.service.spec.ts:3676`-`3677`)에는 애초에 `rateLimitPerMinute` 키가 **없고**,
    락 안 재읽기(`freshWithRate`)에만 `rateLimitPerMinute: 99` 가 **새로 등장**한다. 이
    구성에서는 `mergedChannel` 이 그 키를 아예 갖지 않으므로 스프레드가 건드리지 않아
    우연히 통과한다 — "필드가 새로 생긴" 경우와 "필드가 이미 있었는데 값만 바뀐" 경우를
    가르지 못하는 판별력 없는 fixture 다. 같은 describe 블록의 `withoutRef`/`withRef`
    JSDoc(`:3671`-`3674`)이 스스로 "실제로 한 번 살려 보냈다 ... 대조군은 **두 상태가
    다르게 판정하는 값**이어야 한다" 고 정확히 이 교훈을 적어 두고도, 몇 줄 뒤에 새로 추가한
    테스트가 같은 함정에 다시 걸렸다.

    직접 실측(순수 로직을 별도 스크립트로 재현, 저장소 파일은 건드리지 않음)으로 확인:
    요청 시작 시점 `chatChannel.rateLimitPerMinute = 30`, 동시 PATCH 가 `99` 로 커밋,
    `rotateBotToken` 이 어댑터 호출을 마친 뒤 락 안에서 재읽으면 `freshConfig.chatChannel.
    rateLimitPerMinute = 99` 를 보지만, 현재 머지 로직으로 계산한 최종 저장값은 **`30`
    (스냅샷 값으로 되돌아감)** 이었다. `inboundSigningRef` 축 자체는 `buildSecretRef` 가
    `scope/resourceId/name` 만으로 결정되는 **결정적** 문자열이라 이 특정 필드에 한해서는
    "다른 값으로 덮인다" 는 사고가 실제로는 일어나지 않지만(두 경로가 같은 문자열을
    계산하므로), `rateLimitPerMinute`·`uiMapping`·`languageLocale` 처럼 요청 시작 시점
    값을 그대로 나르는 필드는 보호되지 않는다.
  - 제안: `patch` 를 이 회전이 실제로 바꾸는 필드만으로 좁힌다 — 예: `{ botTokenRef,
    ...(result.configUpdates ?? {}), ...(result.issuedInboundSigning ?
    { inboundSigningRef } : {}) }`. `mergedChannel` 은 (기존 관례대로) `fallback` 자리에만
    남긴다. 회귀 테스트는 `repo.findOne`(요청 시작 시점)과 락 안 재읽기 양쪽에 **같은 키를
    다른 값으로** 채워(예: 시작 시점 `rateLimitPerMinute: 30`, 락 안 재읽기
    `rateLimitPerMinute: 99`) 최종 patch 가 `99` 를 보존하는지로 다시 작성해야
    "네 번째 자리" 가 실제로 닫혔다고 주장할 수 있다.

## 긍정적으로 확인한 점 (참고)

- `throwTriggerNotFound()` 의 orphan JSDoc(이 PR 에서 세 번째 재발로 지적됨,
  `review/code/2026/09/14/23_01_18` maintainability WARNING)이 이번 커밋에서 정확히
  해소됐다 — JSDoc 블록이 이제 `mergeIntoFreshSubKey` 아래, `throwTriggerNotFound()`
  바로 위(`triggers.service.ts:394`-`400`)로 이동했고, `mergeIntoFreshSubKey` 자신의
  JSDoc(`:361`-`379`)도 `@param freshConfig` 가 보강돼 완결됐다.
  `trigger-config-lock.spec.ts:27`-`33` 의 3라운드 연속 미병합 이중 JSDoc 도 하나로
  합쳐졌다.
- 정적 가드를 만들려다 **착수 전 실측으로 전제를 반증하고 만들지 않기로 한 결정**
  (`plan/in-progress/trigger-config-lost-update.md` "가드를 만들려다 전제가 반증됐다"
  절, 커밋 메시지 W5)은 이 저장소 규율("세 번째 재발이면 산문 대신 코드로")을 맹목적으로
  따르지 않고, 후보 술어("두 JSDoc 이 빈 줄 없이 맞붙은 형태")가 전수 28건 중 대부분
  정당한 패턴(파일 머리말+선언 주석, 섹션 구분)과 겹친다는 것을 먼저 측정해 "오탐 25건짜리
  가드" 대신 "만들지 않는다" 를 택한 것으로, 근거 없는 가드 추가보다 훨씬 나은 판단이다.
- `promoteRotatedNotificationSecrets` 의 `promoted` 카운터 수정(`triggers.service.ts:1428`-
  `1440`)은 `mergeIntoFreshSubKey` 의 narrow-patch 계약을 정확히 지키며(`patch = { signing:
  updatedSigning }`), `wrotePromotion` 반환값을 실제로 관측해 카운터를 조건부로 증가시킨다
  — 이 라운드의 세 번째 수정 항목 중 유일하게 위 WARNING 이 지적하는 함정에 걸리지 않았다.
- `cleanupRotatedChatChannelTokens` 회귀 테스트(`triggers.service.spec.ts:4139`-`4158`)는
  `Object.keys(patches[0]).sort()` 로 patch 의 키 **집합**을 고정해, 정적 래칫이 못 보는
  "`.update()` 형태는 유지한 채 `config` 를 몰래 끼워 넣는" 회귀를 실제로 잡는다(커밋
  메시지의 뮤테이션 실측과 일치).

- **[INFO]** 새로 추가된 두 테스트가 `createQueryBuilder` mock 리터럴을 각각 인라인으로
  반복한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:4119`-`4123`,
    `:4151`-`4155` (`where`/`andWhere`/`getMany` 세 메서드로 이루어진 동일한 형태)
  - 상세: 같은 파일의 다른 describe 블록(`:1109`-`1116`, `mockQueryBuilder` 헬퍼)이 이미
    같은 패턴을 함수로 뽑아 뒀지만, 그 헬퍼는 그 describe 블록의 클로저 스코프 안에서만
    쓸 수 있어(다른 `describe`·다른 `triggerRepo`/`repo` 인스턴스) 이번 테스트들이 재사용할
    수는 없었다. 다만 이번에 새로 추가된 두 테스트끼리는 서로 같은 스코프(`makeService`
    describe 블록)에 있으므로 그 둘 사이의 반복은 로컬 헬퍼로 뽑을 수 있었다.
  - 제안: 급하지 않음 — `const mockCandidates = (repo, rows) => (repo.createQueryBuilder as
    jest.Mock).mockReturnValue({ where: jest.fn().mockReturnThis(), andWhere:
    jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue(rows) });` 정도로
    두 자리를 통합할 수 있다.

## 요약

이번 라운드의 실질 변경(`833bb745a`)은 직전 라운드가 지적한 Critical 1건(`cleanupRotatedChatChannelTokens`
회귀 테스트 부재)과 orphan JSDoc 재발(WARNING)을 정확하고 깔끔하게 닫았고, 정적 가드를
만들지 않기로 한 판단도 실측에 근거해 타당하다. 그러나 같은 커밋이 처리한 "네 번째 자리"
(`rotateBotToken`) 수정은 이 PR 이 8라운드에 만들고 이번 라운드까지 세 자리에서 일관되게
지켜 온 `mergeIntoFreshSubKey` 의 narrow-patch 계약을 어긴 채(패치와 폴백에 같은 객체를
그대로 넘김) 작성되어, 정작 그 계약이 막으려는 시나리오(chatChannel 하위 필드가 요청 시작
시점 이후 동시에 **수정**되는 경우)를 여전히 놓친다 — 순수 로직을 격리해 재현한 결과
`rateLimitPerMinute` 류 필드가 스냅샷 값으로 되돌아가는 것을 확인했다. 함께 추가된 회귀
테스트는 "필드가 새로 생긴" 경우만 검증해 이 실패 모드를 잡지 못하는 판별력 없는 fixture이며,
공교롭게도 같은 파일의 인접한 JSDoc 이 정확히 이 함정("대조군은 두 상태가 다르게 판정하는
값이어야 한다")을 스스로 경고하고 있다. 보안에 직결되는 `inboundSigningRef` 축은
`buildSecretRef` 의 결정적 문자열 특성 덕에 실제로는 값이 어긋나지 않아 이 PR 의 핵심
보안 목표(fail-open 차단)에는 영향이 없지만, "네 번째 자리를 닫았다" 는 커밋·plan 의
완결 주장은 비-보안 필드에 한해 정확하지 않다.

## 위험도

MEDIUM
