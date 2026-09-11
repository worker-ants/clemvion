# 요구사항(Requirement) 리뷰 — impl-chat-channel-binder-t2

## 검토 방법 메모

프롬프트가 파일 1(`chat-channel-binder.service.ts`)·4(`triggers.service.spec.ts`)·5(`triggers.service.ts`)의 전체 컨텍스트를 크기 제한으로 잘라냈기 때문에, 해당 3개 파일과 관련 spec 문서(`spec/5-system/15-chat-channel.md` §5.4.1.1, `spec/conventions/secret-store.md`, `spec/conventions/chat-channel-adapter.md`, `spec/data-flow/14-chat-channel.md`)를 `Read`/`Grep` 으로 직접 열어 대조했다. 추가로 `git show a2e5b7e16`(T2 커밋) 로 diff 를 재확인하고, 이동 전/후 코드가 바이트 단위로 동일한지 대조했다. 저장소 파일은 전혀 수정하지 않았다(`git status --short` 결과 clean, 뮤테이션 불필요 — 정적 대조만으로 판정 가능했다).

## 발견사항

- **[SPEC-DRIFT]** `setupChatChannel` 소유 클래스를 현재형으로 서술하는 spec 문서 3곳이 이번 이동으로 stale 해진다
  - 위치: `spec/conventions/secret-store.md:146`, `spec/conventions/chat-channel-adapter.md:369`, `spec/data-flow/14-chat-channel.md:29`
  - 상세: 세 곳 모두 `` `triggers.service.ts.setupChatChannel` 구현체 ``·`` `TriggersService.setupChatChannel` ``·`triggers.service.ts` — `setupChatChannel` / `rotateBotToken` / `cleanupRotatedChatChannelTokens` 식으로 `setupChatChannel` 을 `TriggersService`/`triggers.service.ts` 소유로 현재형 서술한다. 이 PR 로 `setupChatChannel`/`teardownChatChannel` 은 `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` 의 `ChatChannelBinderService` 로 실제 이동했다(코드 확인 완료 — `triggers.service.ts` 에는 해당 private 메서드가 더 이상 존재하지 않고 `this.chatChannelBinder.setupChatChannel(...)` 호출만 남음). 코드 쪽은 의도된 리팩터(동작 보존, 단언 diff 0)이므로 이 불일치는 코드 결함이 아니라 spec 갱신 누락이다.
  - 제안: 코드 유지 + spec 반영. 세 문서의 해당 문장을 `TriggersService 가 ChatChannelBinderService.setupChatChannel 을 호출해` 형태로 정정. **이미 이번 턴의 `--impl-prep` consistency-check(W2)가 동일 지점을 짚었고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재되어 있음**(자기-반증형 소정정 조건1 불성립 — 문장을 developer 가 쓴 게 아니라 이전 planner 턴이 썼으므로 developer 직접 수정 불가, planner 턴 필요는 맞는 판단). 중복 처리 방지를 위해 이 발견이 이미 추적 중임을 밝힌다.

- **[SPEC-DRIFT]** `15-chat-channel.md` frontmatter `code:` 및 §7 구현 파일 구조 다이어그램이 신규 파일을 반영하지 않는다
  - 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` (파일 상단 1~14행), §7 "구현 파일 구조"
  - 상세: frontmatter `code:` 는 `triggers/` 하위를 명시 경로로만 나열하고(`triggers.service.ts`·`triggers.controller.ts`·`chat-channel-token-rotator.service.ts` 등) glob 이 아니다. 이번 PR 이 신설한 `chat-channel-binder.service.ts`·`trigger-callback-url.ts` (및 이전 T1 이 신설한 `chat-channel-input-rules.ts`)가 이 목록에 없다(`Read` 로 직접 확인). `code:` 미등재는 `--impl-done` spec-linked 게이트가 이 파일들을 대상에서 제외한다는 뜻이라 실질적 영향이 있다.
  - 제안: 코드 유지 + spec 반영(`code:` 에 3개 파일 추가 또는 `codebase/backend/src/modules/triggers/**` glob 전환). **이미 W1/INFO#1 로 추적 중**(`plan/in-progress/spec-draft-nullable-notation-followups.md:2209-2224`, "대상 6→8개" 로 갱신됨).

- **[INFO]** 이동한 로그 경고 4개가 여전히 `TriggersService:` 리터럴 접두를 단다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:100, 250, 253, 288` (게이트 기준)
  - 상세: logger 컨텍스트는 `ChatChannelBinderService.name` 인데 메시지 문자열은 `TriggersService: ...` 로 시작해 관측자가 로그만 보고 잘못된 클래스를 추적하게 할 수 있다. docstring(48~46행)과 커밋 메시지가 "순수 이동 주장 약화 방지" 목적으로 의도적으로 남겼다고 명시하고, 이 리터럴을 단언하는 테스트가 0건임(실측)을 근거로 든다 — 의도와 실제가 일치하는 문서화된 트레이드오프이며 followups 파일에 developer 항목으로 이미 등재됨.
  - 제안: 조치 불요(이번 PR 스코프 아님, 이미 후속 등재됨). 다음에 그 파일을 편집할 때 정정.

- **[INFO]** `buildTriggerCallbackUrl` 의 `??` fallback 이 `common/utils/app-base-url.ts` 의 `getAppBaseUrl()` 과 개념 중복
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.ts:41`
  - 상세: 두 함수 모두 `'http://localhost:3011'` 기본값 + 후행 슬래시 제거를 갖지만 읽는 소스가 다르다(`ConfigService.get('app.url')` vs `process.env.APP_URL` 직접). PR 은 이 중복을 통합하지 않기로 명시적으로 결정했고(DI 변경이 되어 9~14개 테스트 모듈의 mock 통제권이 깨짐), docstring 에 그 근거를 남겼다. 실측(`app.config.ts:57` 이 이미 `||` 로 기본값을 박아 `app.url` 이 프로덕션에서 `undefined` 가 될 수 없음)도 확인했다 — 정확한 서술이다.
  - 제안: 조치 불요. 이미 W4 로 등재됨.

- **[INFO]** `rotate-bot-token` 엔드포인트에 OpenAPI 데코레이터 부재 — 이번 PR 범위 밖의 사전 존재 갭
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken`
  - 상세: 이 PR 이 손대는 코드가 아니다(T2 diff 파일 목록에 `triggers.controller.ts` 없음). 이미 W3 로 등재되어 있어 중복 보고만 한다.

## 기능/로직 검증 결과 (결함 없음 확인)

다음은 "결함이 있는지" 를 적극적으로 찾은 항목이며, 전부 **문제 없음**으로 확인했다:

1. **순수 이동 검증**: `git show a2e5b7e16 -- codebase/backend/src/modules/triggers/triggers.service.spec.ts` 를 실측하면 `+12/-0` 이고 12줄 전부 `import` 1줄 + `ChatChannelBinderService,` provider 등록 9줄 — 삭제 0, 단언(`expect`) 변경 0. `triggers.web-chat.spec.ts` 도 `+2/-0`. plan 의 "단언 diff 0줄" 주장과 실측이 일치한다.
2. **로직 동일성**: 옮겨진 `setupChatChannel`/`teardownChatChannel` 본문을 옛 `triggers.service.ts` 의 삭제된 private 메서드와 라인 단위로 대조 — 완전히 동일하다. `buildCallbackUrl` → `buildTriggerCallbackUrl` 전환도 `baseUrl ?? 'http://localhost:3011'` + 동일한 슬래시 정규화 로직으로 의미 동일.
3. **DI 배선 정합성**: `ChatChannelBinderService` 생성자가 요구하는 `Repository<Trigger>`(`TypeOrmModule.forFeature`) · `ChannelAdapterRegistry`/`ChannelListenerRegistry`(`ChatChannelModule` export 확인) · `SecretResolverService`(`SecretStoreModule` export 확인) · `ConfigService`(`ConfigModule`) 전부 `TriggersModule` imports 에 이미 존재 — 런타임 DI 실패 위험 없음. `exports: [TriggersService]` 그대로라 `ChatChannelBinderService` 는 모듈 캡슐 내부에만 머문다(docstring 의도와 일치).
4. **댕글링 참조 없음**: 저장소 전체에서 `buildCallbackUrl`(구 메서드명) 잔존 0건, `ChatChannelBinderService` 사용처가 `triggers/` 모듈 밖에 0건 — 이동이 깨끗하다.
5. **spec §5.4.1.1 / R-CC-21 대조**: 세 비밀-쓰기(botToken UPSERT / provider-issued signing / server-issued telegram signing)의 게이팅 로직이 spec 표(§5.4.1.1) 및 R-CC-21 caveat 과 line-level 로 일치 — `storeUserSuppliedSecrets` 로 앞의 둘만 막고 telegram 의 `issuedInboundSigning` 은 무조건 저장. `inboundSigningRefSurvives` 술어(`providerIssuedStored || preservedInboundSigningRef`)도 §5.4.1.1 "새로 썼거나 · 이미 있었으면 보존" 서술과 일치.
6. **TODO/FIXME/HACK/XXX**: 신규 3파일 전수 grep 0건.
7. **에러 시나리오**: `endpointPath` 부재 시 `BadRequestException({code:'CHAT_CHANNEL_ENDPOINT_REQUIRED', ...})` throw, 미등록 provider 는 로그 후 조용히 `return`(설계된 skip), `setupChannel` 실패는 catch 되어 `chatChannelHealth: 'degraded'` + `chatChannelLastError` 저장(trigger 비활성화 없음, CCH-SE-01 과 일치) — 모든 경로에서 반환값(`Promise<void>`)이 명확하다.
8. **테스트 실측**: developer 커밋 메시지가 주장하는 "9,587 passed / 455 스위트 — 이동 전과 동일" 은 이 리뷰에서 직접 재실행하지는 않았으나(별도 CI/ratchet 검증 단계가 담당), 정적 대조 결과(단언 diff 0, DI 배선 정합) 로 미루어 신뢰할 수 있는 주장이다.

## 요약

이번 변경은 `TriggersService` 의 chat-channel adapter 바인딩(setup/teardown) 로직을 `ChatChannelBinderService` 로 옮기는 **순수 리팩터**이며, 실제로 로직·시그니처·에러 코드·검증 규칙이 전혀 바뀌지 않았음을 라인 단위 대조로 확인했다. 기능적 결함(CRITICAL/WARNING 수준)은 발견되지 않았다. 유일한 실질 이슈는 spec 문서 3+1곳이 옮겨진 클래스 소유권을 현재형으로 서술하던 것이 이번 이동으로 stale 해진 SPEC-DRIFT 이며, 이는 이미 이번 턴의 `--impl-prep` consistency-check 가 동일 지점을 선제 발견해 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재해 두었다(중복 지적임을 명시). 나머지(로그 리터럴 접두, fallback 중복, OpenAPI 데코레이터 부재)는 전부 의도적으로 스코프 밖으로 분리되어 이미 후속 트래커에 기록된 항목이다.

## 위험도

LOW
