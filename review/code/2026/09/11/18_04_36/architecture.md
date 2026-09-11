# 아키텍처 리뷰 — T2: `ChatChannelBinderService` 추출

## 범위

`TriggersService`(1855→1351줄)에서 `setupChatChannel`/`teardownChatChannel` 두 메서드(총
212줄)와 이들이 공유하던 `buildCallbackUrl` private 헬퍼를 각각 신규 `ChatChannelBinderService`
(Nest provider)와 `trigger-callback-url.ts`(순수 함수)로 뽑아낸 Extract-Class 리팩터링. 동작
보존이 명시적 목표(`plan/in-progress/impl-chat-channel-binder-t2.md`)이며 실제로 diff 는
호출부 3곳 교체 + module 등록 + 테스트 provider 추가(10줄, 단언 변경 0)로 한정돼 있다.

## 검증한 것

- **순환 의존 재발 여부**: `chat-channel-binder.service.ts`(`modules/triggers/`)가
  `../chat-channel/channel-adapter.registry`·`channel-listener.registry`·`types`를 import 한다.
  `chat-channel.module.ts`(providers/imports)를 직접 열어 확인한 결과 그쪽은 `Trigger` **엔티티**
  타입만 참조할 뿐 `TriggersModule`을 import 하지 않는다. `secret-store.module.ts`도 마찬가지로
  `TriggersModule`을 참조하지 않는다. 즉 `#676`이 없앤 `chat-channel↔triggers` 순환은 이번
  변경으로 재발하지 않았다 — 문서(라인 39-41 JSDoc)의 주장과 실측이 일치한다.
- **모듈 export 경계**: `triggers.module.ts`에서 `ChatChannelBinderService`는 `providers`에만
  있고 `exports`에는 없다 (`codebase/backend/src/modules/triggers/triggers.module.ts:47-51,55`).
  실제로 `grep -rl ChatChannelBinderService codebase/backend/src/modules/triggers/*.ts`
  결과 컨트롤러(`triggers.controller.ts`)는 이 클래스를 전혀 참조하지 않는다 — Controller →
  `TriggersService` → `ChatChannelBinderService` 레이어 순서가 유지된다.
- **주입 dead-code 여부**: 이동 후에도 `TriggersService`가 `channelAdapterRegistry`·
  `channelListenerRegistry`·`secrets`를 계속 쓰는지 실측(`rotateBotToken`·`remove`·
  `promoteRotatedNotificationSecrets` 등 9개 호출 지점, `triggers.service.ts:1005-1263`) —
  세 협력자 모두 여전히 실사용 중이라 주입이 죽은 의존으로 남지 않았다.

## 발견사항

- **[INFO]** 서비스 경계를 건너는 `preservedInboundSigningRef` 파라미터가 "병합 전에 호출자가
  캡처해 넘긴다"는 **호출 순서 불변식**에 의존한다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:83-96` (파라미터
    선언 + JSDoc), 호출부 `codebase/backend/src/modules/triggers/triggers.service.ts:500-505,565-568`
  - 상세: 이 값은 타입 시스템이 아니라 JSDoc 산문("병합 **전**의 값이다")으로만 강제된다.
    `TriggersService.update()`가 `mergeExternalConfig` **이전에** `previousInboundSigningRef`를
    캡처해 인자로 넘기지 않으면, `inboundSigningRefSurvives` 술어가 조용히 `false`가 되어
    slack/discord PATCH 가 기존 `inboundSigningRef`를 지우고 그 트리거의 인입 서명 검증이
    fail-open 된다(문서 자신이 이 시나리오를 상세히 설명). 클래스 내부 private 메서드였을 때는
    이 불변식이 한 클래스 안에 있었지만, 지금은 두 서비스 사이의 **암묵적 계약**이 됐다 — 향후
    이 메서드를 호출하는 3번째 지점이 생기면(예: bulk-import, admin 복구 스크립트) 같은 캡처
    순서를 잊기 쉬운 구조다.
  - 제안: 지금 당장 막을 필요는 없다(테스트·JSDoc·회귀 캐너리로 충분히 방어됨). 다만 이 패턴이
    반복될 조짐이 보이면 `previousInboundSigningRef`를 별도 타입(`PreMergeChatChannelSnapshot`
    같은)으로 래핑해 "병합 전 상태"임을 타입 레벨에서 드러내는 것을 고려. 지금은 문서화 수준의
    방어로 충분.

- **[INFO]** `setupChatChannel` 하나가 여전히 provider 검증·secret store 쓰기 3종·adapter 호출·
  trigger 영속화·health 상태 전이·listener registry 등록까지 6~8개 관심사를 담고 있다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:83-271`
  - 상세: 이번 PR 은 **순수 이동**이 목표라 이 구조를 그대로 옮겼을 뿐이다. 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md`에 developer 항목
    (`/ai-review 2026/09/10 23_55_23 maintainability W6`, "133 → 186줄")으로 추적 중이므로
    새 결함이 아니라 **이관된 결함**이다. Extract-Class 로 클래스 경계는 개선됐지만 메서드 내부
    응집도 문제는 그대로 남아 있다는 점만 재확인.
  - 제안: 기존 백로그 항목 처리 시 이 파일(`chat-channel-binder.service.ts`)을 대상으로 갱신.

- **[INFO]** `TriggersService` 단위 테스트 14개 블록이 `ChatChannelBinderService`를 테스트
  더블 없이 **실제 클래스**로 주입한다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:41,112,428,615,1577,
    1737,1845,2139,2335` 등, `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts:80`
  - 상세: `createBaseProviders()`/`otherProviders()` 헬퍼를 포함해 전 블록이
    `providers: [TriggersService, ChatChannelBinderService, ...]` 형태다. 협력자 인터페이스를
    mock 하는 대신 실제 구현을 물려, `TriggersService`를 조회만 하는 테스트조차 내부적으로
    `ChatChannelBinderService`의 생성자 의존(4개)까지 해석해야 한다. 이는 plan 이 명시한
    "단언 diff 0줄" 증거 전략과 정확히 일치하는 **의도된 선택**(behavior-preserving 리팩터링의
    검증 방법)이라 이 PR 을 막을 사유는 아니다. 다만 클래스 경계가 이제 실재하는데도 그 경계를
    테스트 격리에 활용하지 않아, 향후 `ChatChannelBinderService` 내부를 바꾸면 chat-channel 과
    무관한 `TriggersService` 테스트(findAll, remove 등)까지 실패할 잠재적 표면이 넓다.
  - 제안: 지금은 조치 불요. 다음에 `ChatChannelBinderService`를 다시 손댈 일이 생기면, 최소한
    chat-channel 과 무관한 describe 블록(예: `findAll`, `Schedule 역방향 동기화`)에서는
    `jest.fn()` 기반 stub 으로 교체하는 것을 고려.

- **[INFO]** `buildTriggerCallbackUrl`(`trigger-callback-url.ts`)과 `common/utils/app-base-url.ts`
  의 `getAppBaseUrl()`이 "APP_URL 기본값 + trailing slash 제거"라는 같은 개념을 두 벌 유지한다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.ts:37-43`
  - 상세: 이미 `--impl-prep` consistency-check(`review/consistency/2026/09/11/17_39_32`
    naming_collision WARNING #4)가 잡아 backlog(`spec-draft-nullable-notation-followups.md`)에
    등재됐고, docstring(25-32행)에 "읽는 소스가 다르다(ConfigService vs `process.env` 직접)"는
    이유로 이번 PR 의 통합 대상에서 명시적으로 제외한다는 근거가 이미 실려 있다. 새 발견이
    아니라 이미 추적 중인 항목의 재확인.

## 요약

Extract-Class 리팩터링이 의도한 대로 정확히 수행됐다 — 새 `ChatChannelBinderService`는 협력자
4개(리포지토리·레지스트리 2종·secret resolver)를 실제로 쓰는 코드에만 DI 클래스를 적용하고,
협력자가 0인 URL 조립 로직은 순수 함수로 분리해 이 저장소의 기존 관행(`chat-channel-input-rules.ts`
/ `chat-channel-token-rotator.service.ts`)과 일관된 판정 기준을 따른다. 모듈 그래프를 직접
열어 확인한 결과 `#676`이 제거한 `chat-channel↔triggers` 순환은 재발하지 않았고, 신규 서비스는
`TriggersModule`에서 export 되지 않아 캡슐화 경계도 정확하다. `TriggersService`에 남은 협력자
주입(레지스트리 2종·`secrets`)도 여전히 실사용 중이라 죽은 의존이 아니다. 남은 관찰은 모두
INFO 수준 — (1) `preservedInboundSigningRef`가 서비스 경계를 건너는 암묵적 호출-순서 계약이 된
점, (2) `setupChatChannel` 내부 응집도 문제(이미 백로그 추적 중, 이관됨), (3) 단위 테스트가 실제
`ChatChannelBinderService`를 물려 테스트 격리 이점을 아직 활용하지 않는 점, (4) URL fallback
로직 중복(이미 추적 중) — 이며 이 중 어느 것도 이번 PR 을 막을 사유가 아니다.

## 위험도

LOW
