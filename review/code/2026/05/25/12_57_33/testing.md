# 테스트(Testing) 리뷰 결과

리뷰 대상: chat-channel-error-notify (CCH-ERR-* 분기 / 민감정보 strip)
리뷰 일시: 2026-05-25

---

## 발견사항

### [INFO] 테스트 존재 여부 — 전반적으로 우수

신규 핵심 로직 두 모듈(`execution-failure-classifier.ts`, `language-hint-defaults.ts`)에 대한 전용 단위 테스트가 함께 추가되었다. 세 provider 렌더러(Discord / Slack / Telegram) 의 `execution.failed` 분기는 각 `.spec.ts` 에서 보강되었고, DTO validation 은 unit(`trigger-dto-validation.spec.ts`)과 e2e(`chat-channel-trigger-create.e2e-spec.ts`) 두 계층에서 커버되었다.

---

### [WARNING] `extractStatusCode` — 부동소수 / 음수 / 0 경계값 테스트 누락

- **위치**: `/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts`
- **상세**: `extractStatusCode` 는 `Number.isInteger(v)` 로 부동소수를 차단하지만, `statusCode: 1.5` / `statusCode: -1` / `statusCode: 0` 케이스에 대한 테스트가 없다. 특히 `statusCode: 0` 은 `Number.isInteger(0)` 이 `true` 를 반환하므로 `executionFailedThirdParty4xx` 의 `placeholders` 에 `{ statusCode: 0 }` 이 포함되고 템플릿이 `0` 으로 치환된다. 사용자에게 `0` 이 출력되는 것이 의도된 동작인지 테스트로 명시되어 있지 않다.
- **제안**: `statusCode: 0`, `statusCode: 1.5`, `statusCode: -200` 케이스를 `extractStatusCode` 또는 `classifyExecutionFailure` 수준에서 추가 커버.

---

### [WARNING] `event.error` 가 런타임 `undefined`/`null` 인 방어 경로 테스트 없음

- **위치**: `/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts`
- **상세**: `classifyExecutionFailure` 는 `event.error?.code ?? ''` 와 `event.error?.details` 에 옵셔널 체이닝을 사용하므로 `error` 가 `undefined` 이어도 런타임 에러는 나지 않는다. 그러나 `EiaFailedEvent.error` 는 TypeScript 타입 상 non-optional(`error: { code: string; ... }`) 이라 spec 테스트에 이 경로가 존재하지 않는다. 다른 어댑터에서 shape 이 다른 이벤트를 잘못 라우팅하는 경우 런타임 `undefined` 가 올 수 있으므로, 방어 코드가 실제로 동작함을 검증하는 테스트 1건이 필요하다.
- **제안**: `makeEvent` 에서 `error` 를 `undefined` 로 강제 캐스팅하는 방어 케이스 1건 추가.

---

### [INFO] Slack / Telegram renderer — `unknown code` fallback (CCH-ERR-04) 경로 테스트 없음

- **위치**:
  - `/codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.spec.ts`
  - `/codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.spec.ts`
- **상세**: Discord renderer 스펙에는 `unknown code → executionFailedInternal fallback + warn log` 케이스가 있으나, Slack/Telegram renderer spec 에는 동일 경로 테스트가 없다. 세 렌더러가 동일한 `classifyExecutionFailure` 를 공유하므로 regression 위험은 낮지만, 통합 지점(렌더러 → 분류기 → i18n) 전체를 통과하는 smoke 케이스가 Slack/Telegram 에는 없다.
- **제안**: Slack / Telegram renderer spec 각각에 `unknown code` 케이스 1건 추가 (warn log 검증 포함). 또는 "각 renderer 는 classifyExecutionFailure 에 위임하며, classifier spec 이 커버한다"고 주석으로 명시하는 최소 조치라도 적용.

---

### [INFO] Telegram renderer — 사용자 override (`languageHints[key]`) 테스트 누락

- **위치**: `/codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.spec.ts`
- **상세**: Discord spec 의 "user override 우선 — languageHints[key] 가 default 위에" 케이스와 Slack spec 의 "failed (user override) → languageHints[key] 우선" 케이스는 존재하지만, Telegram spec 에는 `languageHints` override 케이스가 없다. 세 provider 는 동일한 `resolveLanguageHint` 를 사용하므로 로직 수준에서는 이미 검증되어 있으나, Telegram 렌더러의 `renderFailureMessage → applyPlaceholders` 경로에서 override 결과가 MarkdownV2 escape 를 통과하는 전 과정을 확인하는 테스트가 없다.
- **제안**: `languageHints: { executionFailedThirdParty4xx: 'CUSTOM ({statusCode})' }` 형태의 override 케이스 1건 추가. MarkdownV2 escape 후 결과도 검증.

---

### [INFO] `LanguageHintsPlaceholderValidator` — 직접 단위 테스트 없음 (integration 으로 커버)

- **위치**: `/codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` — `LanguageHintsPlaceholderValidator` 클래스
- **상세**: `LanguageHintsPlaceholderValidator.validate()` 와 `defaultMessage()` 는 `trigger-dto-validation.spec.ts` 의 `validate()` 통합 테스트와 e2e 로만 검증된다. `findFirstUnknownPlaceholder` 순수 함수에 대한 직접 단위 테스트가 없으므로, 예를 들어 `value` 가 `null` / `undefined` / 배열인 경우 초기 방어 분기가 실제로 `null` 을 반환하는지를 빠르게 확인할 수 없다. 현재 코드는 `if (value === null || value === undefined) return null` 로 방어하지만 테스트가 없다.
- **제안**: `findFirstUnknownPlaceholder` 에 `null` / `undefined` / 비객체(`string`) 입력 케이스 단위 테스트 3건 추가. 또는 내부 함수이므로 DTO validation spec 에 해당 조합 1건 추가로 대체 가능.

---

### [INFO] e2e 테스트 — `details.code === 'UNKNOWN_PLACEHOLDER'` 검증 불완전

- **위치**: `/codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` — "CCH-ERR-* override 에 unknown placeholder → 400 UNKNOWN_PLACEHOLDER" 케이스
- **상세**: e2e 케이스는 `res.body.error.code === 'VALIDATION_ERROR'` 를 검증하고 직렬화 문자열에 `'UNKNOWN_PLACEHOLDER'` 와 `'executionFailedInternal'` 가 포함되는지를 확인한다. 그러나 API 응답의 `error.details.code` 가 정확히 `'UNKNOWN_PLACEHOLDER'` 인지, `error.details.field` 값이 `'languageHints.executionFailedInternal'` 인지는 검증하지 않는다. dto 주석("ValidationPipe exceptionFactory 가 message 를 파싱해 details.code='UNKNOWN_PLACEHOLDER' + details.field 합성")의 가정이 실제 exceptionFactory 구현과 일치하는지도 e2e 를 통해 명시적으로 확인되지 않는다.
- **제안**: `res.body.error.details` 객체 또는 `res.body.error.details.code === 'UNKNOWN_PLACEHOLDER'` 를 직접 assert. exceptionFactory 의 UNKNOWN_PLACEHOLDER 파싱 로직 자체에 대한 단위 테스트 추가.

---

### [INFO] `console.warn` spy — Discord renderer spec 에서 `warnSpy` 스코프가 describe 블록 밖 단일 `it` 에만 위치

- **위치**: `/codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.spec.ts` line 133-147
- **상세**: `warnSpy` 는 해당 `it` 내에서 `mockRestore()` 로 정리되어 있어 격리 문제는 없다. 다만 spy 설정 직후 `renderDiscordEvent` 호출 전에 `console.warn` 이 다른 이유로 발생하면 false positive 가 될 수 있다. `warnSpy` 생성 직후 `warnSpy.mock.calls` 초기화를 명시적으로(`warnSpy.mockClear()`) 하거나, `expect(warnSpy).toHaveBeenCalledTimes(1)` 로 호출 횟수를 검증하는 것이 더 엄밀하다. 동일 패턴이 `execution-failure-classifier.spec.ts` 에도 있다.
- **제안**: `warnSpy.mockClear()` 이후 render 호출, 또는 `toHaveBeenCalledTimes(1)` 검증으로 강화.

---

### [INFO] `applyPlaceholders` — 빈 template 문자열 케이스 테스트 없음

- **위치**: `/codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.spec.ts`
- **상세**: `applyPlaceholders('')` 는 정상 동작(빈 문자열 반환)하지만 테스트가 없다. `resolveLanguageHint` 의 empty string override fallback 테스트와 연계하면 의미 있는 경계값이다.
- **제안**: `applyPlaceholders('', { statusCode: 200 })` 케이스 1건 추가.

---

### [INFO] `resolveLanguageHint` — `languageHints` 가 `null` 인 경우 테스트 없음

- **위치**: `/codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.spec.ts`
- **상세**: `resolveLanguageHint` 의 `languageHints` 파라미터 타입은 `Record<string, string> | undefined` 이므로 `null` 은 타입 상 허용되지 않지만, 런타임에서는 `languageHints?.[key]` 가 `null?.['key']` 와 동일하게 처리되어 fallthrough 한다. TypeScript strict 모드라면 문제없으나, 방어 coverage 관점에서 누락이다.
- **제안**: `undefined` 케이스는 이미 있으므로 추가 조치 낮은 우선순위.

---

## 요약

이번 변경은 CCH-ERR-* 민감정보 strip 과 6개 분류 키 i18n 기능을 추가하면서, 핵심 두 모듈(classifier, language-hint-defaults)에 대한 전용 단위 테스트와 세 provider 렌더러 spec 보강, DTO 계층의 unit+e2e 테스트를 함께 제공해 테스트 층위 구성이 전반적으로 양호하다. 주요 민감정보 미노출 검증(CCH-ERR-03)과 3-level lookup, placeholder 화이트리스트는 잘 커버되어 있다. 다만 `extractStatusCode` 의 경계값(0, 음수, 부동소수), `event.error` 가 `undefined` 인 방어 경로, Slack/Telegram renderer 의 `unknown code` fallback 케이스, Telegram 의 user override + MarkdownV2 escape 통합 경로, e2e 의 `UNKNOWN_PLACEHOLDER` 세부 검증 등 소수의 갭이 존재한다. 이 갭들은 기존 코드에서 regression 을 유발하기보다는 엣지 케이스 노출 위험이므로 위험도는 MEDIUM 이하다.

---

## 위험도

MEDIUM
