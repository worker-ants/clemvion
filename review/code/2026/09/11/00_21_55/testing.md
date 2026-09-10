# 테스트(Testing) 코드 리뷰 — `impl-chat-channel-patch-token` (3라운드)

## 검증 방법

프롬프트 diff 가 생략한 파일(`trigger-dto-validation.spec.ts` · `triggers.service.spec.ts` ·
`triggers.service.ts`)은 저장소에서 직접 `Read`/`grep` 으로 열어 실제 소스 줄 번호를 확인했다.
저장소를 뮤테이션하지 않았고 (`git status --short` 로 리뷰 종료 시점에 재확인, 본 세션이 만든
untracked 산출물 외 변경 없음), 대신 대상 두 spec 파일을 read-only 로 실행했다:

```
npx jest src/modules/triggers/dto/trigger-dto-validation.spec.ts src/modules/triggers/triggers.service.spec.ts
→ Test Suites: 2 passed / Tests: 181 passed, 1 skipped, 182 total
```

(`1 skipped` 은 이 PR 과 무관한 기존 `it.skip('structural anchor', ...)` 플레이스홀더 —
`triggers.service.spec.ts:964`.) RESOLUTION.md 가 주장한 "205 GREEN"과는 스코프가 다르다(그
쪽은 triggers 모듈 전체, 이 실행은 두 spec 파일만) — 축소된 범위 안에서는 GREEN 을 직접
재확인했다.

이전 두 라운드(`review/code/2026/09/10/23_21_57`, `23_55_23`)의 testing 리뷰가 이미 낸
WARNING/INFO 가 이번 diff 에서 실제로 해소됐는지를 소스 대조로 재검증하는 데 집중했다 —
동일 결함을 세 번째로 재발견해 보고하는 것을 피하기 위해서다.

## 발견사항

- **[INFO]** (이전 라운드 WARNING 해소 확인) `null`/`''` 비대칭 테스트가 대칭으로 고쳐졌다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3236-3263`
    (`it.each([['botToken','telegram','null',null], ['botToken','telegram','빈 문자열',''], ['inboundSigningPlaintext','slack','null',null], ['inboundSigningPlaintext','slack','빈 문자열','']])`)
  - 상세: `23_55_23` testing 라운드가 지적한 "`botToken` 은 null·'' 두 값, `inboundSigningPlaintext` 는 `''` 하나만 있어 축이 비대칭"이 이번 라운드에서 4-콤보 `it.each` 로 교체돼 해소됐다. 실행 결과도 GREEN 이다. 새 지적이 아니라 **조치 확인**이다.

- **[INFO]** (carry-over, 여전히 유효) `assertPatchCarriesNoSecrets`/authenticator 배선을 잇는 e2e 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3179-3194`
    (`it.each(['slack','discord'])('%s — 카드 편집 PATCH 후에도 inboundSigningRef 가 살아남는다 …')`)
    vs `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 의 케이스 E(`chatChannel: { provider: 'telegram', uiMapping: {...} }`, `botToken` 없음)
  - 상세: 이 PR 이 닫은 CRITICAL(`inboundSigningRef` fail-open)의 회귀 방지는 `TriggersService` unit spec 이 `persistedChannel()?.inboundSigningRef` 를 직접 단언하는 형태로만 존재한다. e2e 파일(`trigger-workflow-ref.e2e-spec.ts` 케이스 E)은 같은 PATCH 바디를 재사용하지만 그 목적은 `workflow` 관계 재조회 축이지 `inboundSigningRef` 보존이나 실제 웹훅 서명 검증까지는 단언하지 않는다 — docstring 도 스스로 "여기서 고정하는 것은 여전히 workflow 관계 유무 한 축뿐"이라고 명시한다. `chat-channel-slack.e2e-spec.ts`/`chat-channel-discord.e2e-spec.ts` 에도 "PATCH 후 실제 웹훅 서명이 통과하는지"를 확인하는 케이스는 없다. `23_55_23` testing 라운드가 이미 INFO(비차단)로 남겼고 이번 라운드에도 미해소 상태다 — 재확인 목적으로 유지.
  - 제안: 필수는 아님. 다음에 slack/discord e2e 파일에 "카드 편집 PATCH → 이후 실제 서명 헤더로 웹훅 전송 → 200" 케이스 1건을 추가하면 unit 경계를 넘는 배선 보장이 생긴다.

- **[INFO]** (carry-over, 여전히 유효) `assertChatChannelAlreadySetUp` 의 `incoming.provider` falsy 분기 미검증
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:740`
    (`if (incoming.provider && incoming.provider !== current.provider) { … }`)
  - 상세: `incoming.provider` 가 falsy(직접 서비스 호출 경로 등)이면 이 가드는 예외 없이 통과한다. HTTP 경로에서는 `ChatChannelUpdateConfigDto.provider` 가 여전히 필수(OmitType 이 `provider` 를 건드리지 않음, `chat-channel-config.dto.ts:172`)라 실질 도달 불가능하지만, 이 메서드 자신이 "컨트롤러 밖 호출도 방어한다"고 주석에서 주장하는 지점이라 그 주장을 검증하는 테스트가 없다는 사실은 그대로다. `triggers.service.spec.ts` 에 이 분기를 겨냥한 케이스는 확인되지 않았다(`3270` 의 "PATCH 로 provider 를 바꾸면 400" 케이스는 `incoming.provider` 가 항상 존재하는 값으로만 테스트한다).
  - 제안: 우선순위 낮음. `provider` 를 생략한 객체로 `service.update()`(또는 해당 private 메서드를 노출해)를 직접 호출해 현재 provider 가 유지되는지 문서화하는 테스트 1건이면 닫힌다.

- **[INFO]** 두 spec 파일의 `cardBody` fixture 리터럴 중복 — 회귀 캐너리 drift 위험
  - 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:785`
    (`const cardBody = (provider: string) => ({ provider, uiMapping: { formMode: 'multi_step', visualNode: 'auto' }, rateLimitPerMinute: 30, languageLocale: 'ko' });`)
    vs `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3000` (동일 리터럴)
  - 상세: 두 정의는 `ChatChannelCard` 가 실제로 보내는 바디 형태를 각각 독립적으로 흉내 낸 것이다. 프론트 카드가 보내는 필드가 바뀌면(예: `uiMapping` 에 필드 추가) 이 두 회귀 캐너리 중 하나만 갱신되고 나머지가 stale 바디로 계속 "통과"할 위험이 있다 — 테스트가 실제로 검증하는 대상(실 프론트 바디)과의 괴리가 두 곳에서 따로 벌어질 수 있는 구조다. maintainability 리뷰가 같은 항목을 코드 중복 관점에서 이미 지적했다(INFO) — 여기서는 "회귀 테스트 유효성" 관점에서 같은 사실을 재확인한다.
  - 제안: 시급하지 않음. 공유 테스트 헬퍼(`test-fixtures/chat-channel-card-body.ts` 류)로 뽑으면 두 캐너리가 항상 같은 바디를 검증하게 되어 drift 가 구조적으로 사라진다.

## 확인한 것 — 문제 없음

- **DTO 경계 회귀 방지가 촘촘하다**: `ChatChannelUpdateConfigDto` 의 5개 차단 필드(`botToken` · `inboundSigningPlaintext` · `botTokenRef` · `inboundSigningRef` · `inboundSigning`) 각각에 대해 값 형태 두 갈래(비어있지 않은 값 → 전역 파이프 중첩 경로 / null·`''` → 서비스 층 flat 경로)를 모두 실측 테스트로 고정했다(`trigger-dto-validation.spec.ts:835-868`). "실측했다"고 적은 범위가 실제 단언 범위와 일치한다.
- **생성 경로 무회귀 캐너리**: `CreateTriggerDto 는 여전히 botToken 을 요구한다`(`trigger-dto-validation.spec.ts:874`)가 D-1 을 공유 DTO 에 잘못 넣었을 때 즉시 RED 가 되도록 고정한다.
- **CRITICAL #1(fail-open) 회귀가 3개 시나리오로 대칭 커버**: 정상 slack/discord 보존(`it.each`, `triggers.service.spec.ts:3179`) · telegram server-issued 재발급(`:3196`) · `setupChannel` 실패(degraded) 경로에서도 보존(`:3210`) — 세 경로 모두 `persistedChannel()?.inboundSigningRef` 를 직접 단언해 "쓰기가 일어났다"가 아니라 "최종 영속 상태"를 검증한다. `botTokenRef` 만 걸었던 종전 결함(자매 축 누락)을 재발시키지 않는 형태다.
- **컴파일 타임 결속**: `assertChatChannelInputSafe` 를 오버로드 2개로 나눠 `mode: 'update'` 호출에는 `ChatChannelUpdateConfigDto` 만 받도록 컴파일러가 강제한다 — 문자열 판별자만 있었다면 못 잡을 짝 깨짐(`(update, 생성용 DTO)`)을 타입 레벨에서 차단한다. 실행 시 테스트로 검증할 필요가 없는 종류의 회귀를 컴파일 단계로 옮겼다.
- **격리**: `chatChannel PATCH 는 사용자 비밀을 쓰지 않는다` describe 블록의 각 `it` 는 `setup()` 을 통해 매번 새 `Test.createTestingModule` 을 만들어 mock 상태(`secrets.rotate`, `triggerRepo.update` 등 mock.calls)가 테스트 간 누수되지 않는다. DTO spec 의 `run()` 헬퍼도 매 호출마다 새 `pipe.transform` 호출이라 순서 의존성이 없다.
- **Mock 이 실제 인터페이스와 정합**: `SecretResolverService` mock(`resolve`/`store`/`rotate`/`delete`/`deleteByPrefix`/`exists`)과 `ChannelAdapterRegistry` mock(`has`/`get`) 이 실제 서비스가 호출하는 메서드 집합과 일치한다 — 존재하지 않는 메서드를 mock 하거나 실제로 호출되는 메서드를 빠뜨리지 않았다.
- **동시성 회귀 테스트 부재는 조용한 누락이 아니다**: concurrency 리뷰가 지적한 "동시 PATCH 시 lost update로 `inboundSigningRef` 가 다시 사라질 수 있다"는 이 diff 범위에서 회귀 테스트로 커버되지 않지만, `plan/in-progress/spec-draft-nullable-notation-followups.md:2116-2126` 에 사전 존재 설계(CCH-SE-01) 로 명시 등재돼 있다 — 테스트 갭이 침묵 속에 방치된 것이 아니라 근거와 함께 후속으로 넘겨졌다.
- **e2e 캐너리 docstring 이 자기 한계를 스스로 밝힌다**: `trigger-workflow-ref.e2e-spec.ts` 케이스 E 의 재작성된 docstring 이 "이 케이스가 고정하는 것은 workflow 관계 유무 한 축뿐"이라고 명시해, 이 200 응답을 "PATCH + chatChannel 전체 계약이 정상"으로 과잉 해석할 위험을 사전에 차단한다 — 이전 결함(R-CC-10 우회)을 재현하던 경고문이 해소 사실 + 위치 이관(`triggers.service.spec.ts`/`trigger-dto-validation.spec.ts`)으로 정확히 교체됐다.

## 요약

핵심 로직(PATCH 비밀 차단 D-1, secret 쓰기 게이팅 D-2, ref 재유도 회귀 D-3)은 값의 두 형태(비어있음/비어있지 않음) × 다섯 차단 필드 × 세 provider 축을 조합적으로 커버하는 unit 테스트로 촘촘히 고정돼 있고, 이전 두 라운드가 지적한 WARNING(비대칭 null 테스트)은 이번 라운드에서 4-콤보로 대칭화돼 실제로 해소됐다(재실행 GREEN 확인). 남은 항목은 전부 INFO 수준의 carry-over 다 — (1) `inboundSigningRef` 보존이 unit 레벨에서만 검증되고 실제 웹훅 서명 검증까지 잇는 e2e 가 없다, (2) `assertChatChannelAlreadySetUp` 의 provider-falsy 분기가 미검증이다, (3) 두 spec 파일의 `cardBody` fixture 중복이 향후 drift 위험을 남긴다. 셋 다 이전 라운드에서 이미 비차단으로 분류됐고 이번 리뷰도 그 분류에 동의한다 — 새로운 차단 사유는 발견하지 못했다.

## 위험도

LOW
