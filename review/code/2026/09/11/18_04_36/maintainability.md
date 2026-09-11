# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위 메모

프롬프트가 잘라낸 3개 파일(`chat-channel-binder.service.ts`·`triggers.service.spec.ts`·`triggers.service.ts`)은 `Read` 로 원본을 직접 열어 확인했다. 파일 7~16(`plan/**`, `review/consistency/**`)은 프로세스 산출물(plan·consistency-check 리포트)이라 "함수 길이/중첩/매직넘버" 같은 코드 유지보수성 관점의 대상이 아니므로 코드 파일(1~6번, 전부 `codebase/backend/src/modules/triggers/`)에 집중했다. 저장소에 어떤 뮤테이션도 가하지 않았다(`git status --short` 로 판단할 변경 없음 — 읽기만 수행).

이 PR 은 `TriggersService` 의 두 private 메서드(`setupChatChannel`/`teardownChatChannel`)와 `buildCallbackUrl` 헬퍼를 각각 `ChatChannelBinderService`(신규 provider)와 `buildTriggerCallbackUrl`(신규 순수 함수)로 뽑아내는 **동작 보존 이동**이다. 로직 자체의 신규 작성은 거의 없다(호출부 배선 변경 위주).

## 발견사항

- **[INFO]** `setupChatChannel` 이 여전히 189줄(생성자 이후 로직 기준 83~271행)에 6~8가지 관심사(레지스트리 조회 → 가드 → callback URL 조립 → secret ref 생성 → 3종 secret 쓰기 게이팅 → adapter 호출 → 성공/실패 양쪽의 config 병합 및 컬럼 갱신)를 담고 있다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:83-271` (`setupChatChannel`)
  - 상세: 이 diff 는 해당 함수를 **옮기기만** 했고 손대지 않았다. 같은 지적이 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(`- [ ] setupChatChannel 이 6~8가지 관심사를…`, `/ai-review 2026-09-10 23_55_23` `maintainability` W6)에 등재돼 있고, 이번 `--impl-prep`(`review/consistency/2026/09/11/17_39_32`)도 새 항목을 추가하지 않았다. 즉 **새로운 결함이 아니라 기존 추적 항목이 이동한 파일에서도 그대로 관측된다**는 확인이다 — 별도 백로그 항목을 새로 만들 필요는 없어 보인다.
  - 제안: 기존 트래커 항목을 그대로 유지하되, 이번 이동으로 파일이 바뀌었으니(구 `triggers.service.ts` → 신 `chat-channel-binder.service.ts`) 다음에 그 항목을 처리할 때 대상 파일 경로만 갱신하면 된다.

- **[INFO]** secret ref 생성 로직과 `trigger.config` 캐스팅 패턴이 이동 이후 **두 파일**에 걸쳐 반복된다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:118-127` (`botTokenRef`/`inboundSigningRef` 생성) vs `codebase/backend/src/modules/triggers/triggers.service.ts:1019-1037` (`rotateBotToken` 안의 동일 패턴). 그리고 `trigger.config as { chatChannel?: ChatChannelConfig }` 캐스팅은 `chat-channel-binder.service.ts:279`, `triggers.service.ts:997`, `triggers.service.ts:1218` 세 곳에 있다.
  - 상세: 이 중복 자체는 새로 생긴 게 아니다 — 이동 전에도 같은 파일(`triggers.service.ts`) 안에서 `setupChatChannel`/`rotateBotToken` 두 메서드가 각자 `buildSecretRef` 를 호출하며 중복했다. 다만 이동으로 인해 **같은 파일 내부 중복 → 서로 다른 두 파일 간 중복**이 되면서, 한쪽만 보고 있으면 다른 쪽이 존재하는지 알아채기 더 어려워졌다(발견 가능성이 낮아진다는 점에서 유지보수성 관점의 미세한 후퇴). `buildSecretRef` 호출부의 `name` 문자열(`'bot-token'`/`'inbound-signing'`)이 나중에 바뀌면 두 파일을 동시에 고쳐야 하는데, 지금은 그 사실을 알려주는 코드 상의 연결고리(공유 상수·헬퍼)가 없다.
  - 제안: `buildChatChannelSecretRefs(triggerId): { botTokenRef, inboundSigningRef }` 같은 작은 공유 헬퍼로 뽑아 두 파일이 같은 함수를 호출하게 하면, 다음에 ref 스킴이 바뀔 때 grep 없이도 컴파일 타임에 갱신 지점이 드러난다. 급하지 않은 개선이라 이번 PR 을 막을 사유는 아니다.

- **[INFO]** 옮겨온 로그 경고 3곳이 여전히 `` `TriggersService: …` `` 리터럴로 시작해, logger 컨텍스트(`ChatChannelBinderService`)와 메시지 본문이 불일치한다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:100`, `:250`, `:253`, `:288`
  - 상세: 클래스 상단 docstring(46행 부근)에 "의도적으로 남겼다 — 관측 가능한 출력이 달라지면 순수 이동 주장이 약해진다"고 명시돼 있고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 정정 항목으로 이미 등재돼 있다(developer, 2026-09-11). 실제 로그를 보는 운영자 입장에서는 "TriggersService" 라는 존재하지 않는(이젠 다른 클래스로 옮겨간) 이름이 찍혀 디버깅 시 혼동을 줄 수 있는 실질적 유지보수성 이슈이지만, 의도적 트레이드오프이고 후속 정정이 트래커에 걸려 있어 이 PR 에서 추가 조치는 불필요하다.
  - 제안: 없음(이미 계획됨) — 다음에 이 파일을 손댈 때 리터럴만 `ChatChannelBinderService:` 로 갱신.

- **[INFO]** 테스트 파일(`triggers.service.spec.ts`, `triggers.web-chat.spec.ts`)에 `ChatChannelBinderService` provider 등록이 다수(14개 describe 블록) 추가됐지만, 실제 diff 는 `createBaseProviders()`/`otherProviders()` 헬퍼 덕에 10줄(import 2 + 등록 8)에 그친다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:41` (`createBaseProviders` 헬퍼 — 5블록 공유), 그 외 직접 나열 블록들(`:112,428,615,1577,1737,1845,2139,2335`), `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts:80`
  - 상세: 이건 결함이 아니라 긍정 관찰이다 — `ChatChannelBinderService` 를 mock 없이 실제 클래스로 등록해도 그 생성자 의존(`Repository<Trigger>`·`ChannelAdapterRegistry`·`ChannelListenerRegistry`·`SecretResolverService`·`ConfigService`)이 각 테스트 모듈에 이미 등록돼 있어 새 mock 이 필요 없다. 헬퍼 재사용 덕에 14곳 변경이 10줄로 억제된 것은 테스트 보일러플레이트 중복을 낮게 유지한 좋은 사례다. 조치 불요, 기록 목적.

## 요약

이번 diff 는 `TriggersService`(1300줄대 God-service)에서 `setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl` 을 명확한 경계 기준(외부 협력자 수·소유권 분리)으로 뽑아낸 잘 설계된 **동작 보존 리팩터링**이다. 새 클래스는 같은 폴더의 선례(`chat-channel-token-rotator.service.ts`)와 네이밍·구조가 일치하고, 왜 provider 인지/왜 `chat-channel/` 이 아닌 `triggers/` 에 있는지/왜 로그 리터럴을 안 바꿨는지를 근거와 함께 docstring 에 남겨 다음 사람이 되돌리지 않도록 방어하고 있다. 실질적으로 새로 도입된 매직 넘버·깊은 중첩·불명확한 네이밍은 없었고, 유일하게 눈에 띄는 함수 길이 이슈(`setupChatChannel` 189줄)는 이 PR 이 만든 게 아니라 이미 별도 트래커 항목으로 추적 중인 사전 존재 이슈가 그대로 옮겨온 것이다. 이동으로 인해 secret-ref 생성 로직과 `trigger.config` 캐스팅 패턴이 한 파일 내부 중복에서 두 파일 간 중복으로 바뀌어 발견 가능성이 소폭 낮아진 점, 그리고 의도적으로 남긴 로그 리터럴 불일치 정도가 참고할 만한 INFO 성격의 관찰이다. 테스트 파일 변경은 기존 헬퍼 재사용으로 보일러플레이트 중복을 잘 억제했다.

## 위험도

LOW
