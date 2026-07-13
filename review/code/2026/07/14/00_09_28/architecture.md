# 아키텍처(Architecture) Review

대상: `eia-command-waiting-surface-guard` F-2 — `languageHints.surfaceMismatch` 안내 발송
(`chat-channel/shared/language-hint-defaults.{ts,spec.ts}`, `hooks/hooks.service.{ts,spec.ts}`,
telegram 문서 2종, `spec/5-system/15-chat-channel.md`)

## 발견사항

- **[INFO]** `HooksService` 의 `chat-channel/shared/language-hint-defaults` import — 레이어링 적절
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:43-46` (`resolveSurfaceMismatchMessage`, `LanguageLocale` import)
  - 상세: 오케스트레이터가 명시적으로 지목한 지점을 검증한 결과, **문제 없는 레이어링**으로 판단한다. 근거:
    1. `HooksModule` 은 이미 `ChatChannelModule` 을 (forwardRef 없이) 정식 import 하고 있고 (`hooks.module.ts`), `HooksService` 는 diff 이전부터 `ChannelAdapterRegistry`/`ChannelConversationService`/`ChatChannelRateLimiterService`/`ChatChannelInboundAuthenticator`/`ChatChannelConfig`/`ChannelUpdate`/`validateFormSubmission`(`chat-channel/shared/form-mode`) 등 chat-channel 도메인 타입·서비스를 광범위하게 직접 참조한다. 즉 "provider-agnostic 훅 처리기"라는 이름과 달리 이미 chat-channel 도메인을 1급으로 알고 있는 클래스이며, 이번 import 는 새로운 결합 종류를 추가하는 것이 아니라 기존 결합 패턴을 한 파일 더 확장한 것이다.
    2. `chat-channel/shared/*` 는 `@nestjs/common Logger` 만 참조하는 순수 함수/상수 모듈로, NestJS DI provider 가 아니다. `execution-engine/execution-engine.service.ts` 도 이미 `chat-channel/shared/form-mode` 를 동일한 방식으로 import 하고 있어 (`grep` 확인), `shared/` 하위는 사실상 이 프로젝트에서 "여러 모듈이 공유하는 순수 헬퍼 레이어"로 의도적으로 설계·사용되고 있다.
    3. 순환 의존성 없음 — `chat-channel/**` 어디에서도 `hooks/` 또는 `execution-engine/` 을 import하지 않음(확인 완료).
    4. provider 별 실제 특수문자 escape/전송은 여전히 `ChatChannelAdapter.sendMessage` 인터페이스(어댑터 추상화) 뒤에 남아 있어, provider-specific 코드가 `HooksService` 로 새어 들어오지는 않는다 — 텍스트 *리졸브*(locale/override 선택)만 공유 헬퍼로 위임했을 뿐, provider 분기 자체는 어댑터 레지스트리 경계를 그대로 지킨다.
  - 결론: 호출자가 우려한 "provider-agnostic 레이어가 chat-channel 세부사항을 알게 되는" 문제는, `HooksService` 가 애초에 provider-agnostic 하다기보다 "multi-provider 오케스트레이터"(모든 chat-channel provider 를 어댑터 인터페이스로 균일 처리)였다는 기존 설계를 재확인하면 자연스럽게 해소된다. 다만 이 사실 자체("HooksService" 라는 이름이 실제 책임 범위를 과소평가함)는 아래 SRP 항목에서 별도로 다룬다.

- **[WARNING]** `language-hint-defaults.ts` 의 3-level lookup 리졸버 함수 3중 복제 (OCP/DRY)
  - 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts` — `resolveFormOpenLabel` (L522-530), `resolveSessionExpiredMessage` (L548-556), 그리고 이번 diff 로 추가된 `resolveSurfaceMismatchMessage` (L580-588)
  - 상세: 세 함수 모두 아래와 동일한 5줄 구조를 파라미터명만 바꿔 반복한다.
    ```ts
    const override = languageHints?.<key>;
    if (typeof override === 'string' && override.length > 0) return override;
    if (languageLocale === 'en') return <DEFAULTS>.en;
    return <DEFAULTS>.ko;
    ```
    `resolveLanguageHint` (CCH-ERR-* 6키, deprecation-warn 포함)는 로직이 달라 예외로 두더라도, 나머지 세 개는 완전한 구조적 중복이다. 이번 PR 은 이 패턴의 **세 번째 복제본**을 추가한 것으로, 신규 안내 키가 추가될 때마다(`groupChatRefusal`, `unsupportedMessageKind`, `help` 등도 잠재 후보) 같은 함수를 또 복붙해야 하는 구조다. OCP 관점에서 "새 키 추가 = 새 함수 작성"이 아니라 "새 키 추가 = defaults map 등록"만으로 끝나야 한다.
  - 제안: `function makeLocaleResolver<T extends string>(defaults: Record<LanguageLocale, string>, overrideKey: T)` 형태의 팩토리로 3개 함수를 통합하거나, 최소한 신규 키 추가 시 이 팩토리 패턴을 적용하도록 후속 정리를 고려. 급하지 않으나 이번 PR 이 세 번째 복제를 만든 시점이라 언급.

- **[WARNING]** `HooksService` 내 "안내 발송" private 메서드 4종 간 구조적 중복 + SRP 확장
  - 위치: `hooks.service.ts` — `maybeNotifyIgnored` (L790-822), `reNoiseFormModal` (L683-710), `sendExecutionStillRunningNotice` (L986-1007), 신규 `sendSurfaceMismatchNotice` (L1019-1041)
  - 상세: 네 메서드 모두 "문구 리졸브 → `adapter.sendMessage(...)` try → catch 시 `logger.warn` best-effort" 골격이 동일하다. 이번 diff 는 이 패턴의 4번째 사본을 추가했다(공용 `sendBestEffortNotice(update, config, adapter, text, warnLabel)` 추출 없이). 또한 이 메서드들이 누적되면서 `HooksService`(원래 generic webhook trigger 처리기)가 chat-channel inbound dispatch 전체 로직(라우팅, rate-limit, form modal, lock, notice 발송 등, `handleChatChannelWebhook` 기준 약 400줄)을 계속 흡수하는 SRP 침식이 진행 중이다. `chat-channel.dispatcher.ts` 라는 전용 파일이 이미 chat-channel 모듈 안에 존재하는데도, 실제 inbound state-machine 로직 상당 부분은 여전히 `HooksService` 에 있다.
  - 제안: (a) 단기: try/catch/warn 골격을 `sendBestEffortNotice` 헬퍼로 추출해 4중 복제를 줄인다. (b) 중장기: chat-channel inbound 처리 블록(`handleChatChannelWebhook` 및 그 private 헬퍼들)을 별도 `ChatChannelInboundService`(chat-channel 모듈 소속)로 분리하고, `HooksService.handleWebhook` 은 얇은 위임만 남기는 리팩터를 백로그로 고려. 이번 PR 범위에서 강제할 사항은 아니며 비차단(non-blocking) 관찰.

- **[WARNING]** MarkdownV2-safe 불변식이 타입/구조가 아닌 주석+단위테스트로만 강제됨 — 운영자 override 는 미검증
  - 위치: `language-hint-defaults.ts` L372-378(문서 주석), `language-hint-defaults.spec.ts` L77-80(`MD_V2_SPECIALS` 정규식 단언), `hooks.service.ts` `sendSurfaceMismatchNotice` L1024-1027, `triggers/dto/chat-channel-config.dto.ts` (`languageHints` validator — `UNKNOWN_PLACEHOLDER` 만 검사)
  - 상세: `SURFACE_MISMATCH_DEFAULTS` 의 안전성(특수문자 미포함)은 spec 테스트 1건으로만 보장된다. 그러나 `resolveSurfaceMismatchMessage` 는 `languageHints?.surfaceMismatch` **운영자 override 를 있는 그대로 반환**하며, `chat-channel-config.dto.ts` 의 validator 는 `{...}` placeholder 화이트리스트만 검사할 뿐 MarkdownV2 특수문자 여부는 검증하지 않는다. 즉 운영자가 `surfaceMismatch: "다시 확인(!) 해주세요."` 같은 override 를 설정하면, 이번 PR 이 방지하려던 바로 그 실패 모드(telegram 400 → 안내 유실)가 override 경로로 재발할 수 있다. `spec/5-system/15-chat-channel.md` 갱신분도 이 divergence(`executionStillRunning` 등은 telegram-escape 를 인라인 baked-in, `surfaceMismatch` 는 특수문자 자체를 배제)를 명시적으로 문서화하고 있어 저자들이 인지는 하고 있으나, "raw-safe text" 라는 불변식을 타입 시스템이나 DTO validator 가 아니라 각 함수의 default 문자열에 대해서만 지역적으로 보장하는 구조는 향후 provider 추가·override 확장 시 재발하기 쉬운 취약점이다.
  - 제안: 최소한 DTO validator 에 `surfaceMismatch`/`sessionExpired`/`executionStillRunning`/`help` 등 control-plane raw 발송 키에 한해 MarkdownV2 특수문자 검증(또는 등록 시점 400 반환)을 추가하는 후속 항목을 백로그화. 이번 PR 을 막을 사안은 아님(기존 `sessionExpired` 등도 동일한 갭을 이미 갖고 있어 이번 PR 이 새로 만든 문제는 아님).

- **[INFO]** `forwardToInteractionService` 시그니처 확장 (3 → 5 파라미터)
  - 위치: `hooks.service.ts` L735-741 (`trigger, executionId, update, config, adapter`)
  - 상세: `config`/`adapter` 추가는 단일 호출부(`handleChatChannelWebhook` 내 1곳, L2287-2293)에만 영향을 주므로 안전하게 반영됐다. 다만 이 private 메서드 계열(`reNoiseFormModal`, `handleFormStep`, `sendExecutionStillRunningNotice`, 이제 `forwardToInteractionService`)이 공통적으로 `(update, config, adapter, ...)` 3종 세트를 반복 전달받는 패턴이 굳어지고 있다. 파라미터가 더 늘어날 경우 `ChatChannelInboundContext { update, config, adapter, trigger, state? }` 같은 값 객체로 묶는 것을 고려할 만하다. 차단 사유 아님.

## 요약

이번 diff 의 핵심 질의(“provider-agnostic `HooksService` 가 `chat-channel/shared/language-hint-defaults` 를 import 하는 것이 레이어링상 적절한가”)에 대해서는 **적절**하다고 판단한다 — `HooksService` 는 diff 이전부터 이미 `ChatChannelModule` 을 1급으로 의존하는 multi-provider chat-channel 오케스트레이터였고, `chat-channel/shared/*` 는 `execution-engine` 모듈도 이미 사용 중인 순수-함수 공유 레이어이며, 순환 의존성이나 provider 세부사항 누출도 없다. 다만 이 특정 import 자체보다 더 근본적인 두 가지 구조적 신호가 눈에 띈다: (1) `language-hint-defaults.ts` 의 3-level lookup 리졸버가 매 신규 키마다 거의 동일한 함수로 복제되고 있고(이번 PR 이 3번째 사본), (2) `HooksService` 안에 "resolve text → best-effort sendMessage → catch warn" 패턴의 private 메서드가 4개째 누적되며 원래 이름이 암시하는 책임 범위(generic webhook 처리)를 넘어 chat-channel inbound dispatch 전체를 계속 흡수하고 있다. 두 사안 모두 이번 PR 이 새로 만든 문제라기보다 기존 패턴을 답습·확장한 것이며, 테스트 커버리지도 양호하다. 추가로 MarkdownV2-safe 불변식이 default 문자열에만 국한된 테스트로 보장되고 운영자 override 경로는 미검증인 점은 재발 가능한 갭으로 남겨둘 만하다.

## 위험도

LOW
