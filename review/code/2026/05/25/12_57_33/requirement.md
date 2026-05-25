# 요구사항(Requirement) 리뷰 — Chat Channel CCH-ERR-* 실행 실패 안내

리뷰 일시: 2026-05-25  
리뷰 대상 파일: 20개 (Files 1–20)  
Spec SoT: `spec/5-system/15-chat-channel.md §3.5 CCH-ERR-*` / `spec/conventions/chat-channel-adapter.md §3.1` / `spec/5-system/15-chat-channel.md §4.1.1`

---

## 발견사항

### [INFO] spec §4.1.1 KO/EN default 표와 구현 문구의 완전 일치 확인

- 위치: `language-hint-defaults.ts` lines 990–1014
- 상세: `DEFAULT_LANGUAGE_HINTS.ko` / `.en` 12 문구가 `spec/5-system/15-chat-channel.md §4.1.1` 표와 글자 단위로 일치한다. placeholder 위치(`{statusCode}`)도 정확히 동일하다.
- 제안: 없음 (정합 확인).

---

### [INFO] `classifyExecutionFailure` 카테고리 매핑이 Convention §3.1 표와 일치

- 위치: `execution-failure-classifier.ts` lines 678–768
- 상세: `TIMEOUT_CODES`, `THIRD_PARTY_CODES`, `INTERNAL_CODES` 세트가 `spec/conventions/chat-channel-adapter.md §3.1` 의 카테고리 매핑 표와 코드 단위로 일치한다. `HTTP_4XX`/`HTTP_5XX` 우선 분기, `LLM_RATE_LIMIT` 독립 분기, unknown fallback + `console.warn(JSON.stringify({...}))` 모두 CCH-ERR-04 와 정합한다.
- 제안: 없음 (정합 확인).

---

### [WARNING] CCH-ERR-04 warn 로그 structured 형식에 `triggerId` 미포함

- 위치: `execution-failure-classifier.ts` lines 761–767
- 상세: Spec CCH-ERR-04는 `{ kind: "chat_channel_unknown_failure_code", code, hasDetails: boolean }` 포맷을 명시한다. 구현은 이 형식을 따르지만, `triggerId` 나 `executionId` 가 warn 로그에 포함되지 않아 운영 환경에서 해당 warn 로그를 특정 트리거와 연관짓기 어렵다. spec 본문은 이 필드들을 요구하지 않으므로 spec 위반은 아니지만 운영 관측성(observability) 측면에서 개선 여지가 있다.
- 제안: `event.triggerId` 를 structured 로그 payload 에 추가하는 것을 검토. 단 spec 본문을 먼저 갱신한 뒤 구현 반영 (project-planner 위임 대상).

---

### [WARNING] `applyPlaceholders` — statusCode 누락 시 `"?"` 치환이 spec 본문과 불완전 일치

- 위치: `language-hint-defaults.ts` lines 1048–1057; `language-hint-defaults.spec.ts` 라인 "omitted statusCode → '?' replacement"
- 상세: `spec/conventions/chat-channel-adapter.md §3.1` 은 statusCode omit 시 "`{statusCode}` 토큰을 `"?"` 로 치환 (또는 `({statusCode})` 괄호 segment 전체 제거 — 어댑터 자유)" 라고 두 가지 선택지를 허용한다. 구현은 `"?"` 치환을 채택하였고 spec 허용 범위 안이다. 그러나 테스트의 `HTTP_5XX without statusCode` 케이스(`discord-message.renderer.spec.ts` line 106–118)는 `expect(text).toContain('?')` 만 검증하여, KO 기본 문구 `"외부 서비스에 일시적인 문제가 발생했습니다 (?)"` 전체가 실제로 올바르게 구성되는지 확인하지 않는다. 부분 assertion 이라 회귀 탐지 범위가 좁다.
- 제안: `expect(text).toContain('외부 서비스에 일시적인 문제가')` 같이 prefix 문구도 함께 검증하거나, `toMatchInlineSnapshot` 으로 전체 문자열을 assertion 하는 방식 추가를 권장.

---

### [INFO] `resolveLanguageHint` — `languageLocale === 'ko'` 명시 분기 없이 fallthrough 처리

- 위치: `language-hint-defaults.ts` lines 1036–1040
- 상세: 구현은 `locale === 'en'` 이면 EN default, 그 외(`ko` 포함, 알 수 없는 locale 포함)는 KO fallback 으로 처리한다. spec은 (2) locale default → (3) ko fallback 의 3-level lookup을 정의하고, "unknown locale 방어"를 허용한다. 현재 구현에서 `languageLocale === 'ko'` 를 명시적으로 분기하지 않고 `else` 로 커버하는 것은 spec 허용 범위이지만, 향후 `'ja'` 등 새 locale 추가 시 해당 locale 이 ko 로 silently fallback 되어 예상과 다를 수 있다.
- 제안: 현재 spec 에서 `ko`/`en` 두 종만 허용(`LanguageLocale = 'ko' | 'en'`)하므로 현재 구현은 문제없다. 신규 locale 도입 시 `if (languageLocale === 'ko')` 명시 분기를 추가하도록 주석 남기는 것을 권장.

---

### [WARNING] `LanguageHintsPlaceholderValidator.validate` — `findFirstUnknownPlaceholder` 이중 호출로 성능 낭비

- 위치: `chat-channel-config.dto.ts` lines 1168–1182
- 상세: `validate()` 에서 `findFirstUnknownPlaceholder(value)` 를 1회 호출하고, `defaultMessage()` 에서 다시 1회 호출한다. class-validator 는 validate 실패 시 `defaultMessage()` 를 호출하므로 실패 경우 동일 순회가 2회 발생한다. 입력 크기가 작아 실제 성능 영향은 미미하지만 불필요한 중복이다.
- 제안: `validate()` 결과를 instance 필드에 캐시하거나, `defaultMessage()` 내부에서 직접 결과를 계산하는 single-pass 패턴으로 리팩토링. spec 준수 여부와 무관한 구현 품질 이슈.

---

### [INFO] DTO validator — `UNKNOWN_PLACEHOLDER` 에러 포맷이 e2e 검증 범위와 부분 불일치

- 위치: `chat-channel-config.dto.ts` line 1179; `chat-channel-trigger-create.e2e-spec.ts` lines 1440–1444
- 상세: `defaultMessage()` 는 `UNKNOWN_PLACEHOLDER:<field>:<placeholder>` 포맷을 반환한다. e2e 테스트는 `res.body.error.code === 'VALIDATION_ERROR'` 와 `JSON.stringify(res.body.error)` 가 `'UNKNOWN_PLACEHOLDER'` 를 포함하는지만 검증하며, `details.code='UNKNOWN_PLACEHOLDER'` 의 hierarchy 를 직접 검증하지 않는다. Spec R-CC-15 (c) 는 `400 VALIDATION_ERROR (details.field='languageHints.executionFailed*', code='UNKNOWN_PLACEHOLDER')` 를 기술하는데, ValidationPipe exceptionFactory 가 실제로 `details[]` 안에 `code='UNKNOWN_PLACEHOLDER'` 를 합성하는지 확인하는 assertion 이 없다.
- 제안: e2e 에서 `res.body.error.details` 배열 안의 `code` 필드를 직접 assertion 하는 검증 추가를 권장. (spec 명세된 에러 구조 검증 강화.)

---

### [INFO] Telegram renderer 테스트 — MarkdownV2 escape 후 `{statusCode}` 숫자 형태 검증 범위

- 위치: `telegram-message.renderer.spec.ts` lines 521–536
- 상세: 테스트 주석 "MarkdownV2 escape 가 ( ) . 을 escape — 401 자체는 escape 영향 없음" 은 올바르다. spec `providers/telegram §5.6` 은 `parse_mode: "MarkdownV2"` + backslash escape 를 명시하며, `{statusCode}` 치환 후 escape 가 적용되어야 한다. 단 현재 테스트는 `escapeMarkdownV2` 가 `{statusCode}` 치환 이후에 적용되는지(올바른 순서)를 직접 보장하는 assertion 이 없다. 치환 → escape 순서가 뒤바뀌면 `{statusCode}` 가 먼저 escape 되어 `\{statusCode\}` 로 변환되어 치환이 실패할 수 있다.
- 제안: `renderFailureMessage` 이 `applyPlaceholders` 결과를 반환하고, 이를 호출하는 `renderTelegramMessages` 가 `renderText` (내부적으로 `escapeMarkdownV2` 호출) 에 전달하는 파이프라인이 코드상 명확히 분리되어 있으므로 현재 코드는 올바른 순서다. 다만 이 순서 보장을 명시적으로 테스트하는 assertion 추가를 권장.

---

### [INFO] `EiaFailedEvent` 타입 — spec의 `EiaEvent['execution.failed']` 별칭 여부 확인 필요

- 위치: `execution-failure-classifier.ts` line 648 import; 파일 내 `EiaFailedEvent` 사용
- 상세: `classifyExecutionFailure` 의 시그니처가 `event: EiaFailedEvent` 를 받지만 spec Convention §3.1 의 함수 시그니처는 `event: Extract<EiaEvent, { type: "execution.failed" }>` 를 명시한다. 구현에서 `EiaFailedEvent` 가 `Extract<EiaEvent, { type: "execution.failed" }>` 와 동일한 shape 인지는 `types.ts` 정의에 의존하며, diff 범위에서는 직접 확인되지 않는다. 실제 타입이 spec 과 다른 별도 타입이라면 타입 drift 가능성이 있다.
- 제안: `types.ts` 에서 `EiaFailedEvent = Extract<EiaEvent, { type: 'execution.failed' }>` 로 명확히 alias 정의되어 있는지 확인. 현재 diff 기준으로는 문제가 드러나지 않으므로 INFO 등급 유지.

---

### [INFO] Telegram spec §5.6 — `parse_mode: "MarkdownV2"` 명시가 renderer 구현에서 직접 확인되지 않음

- 위치: `telegram-message.renderer.ts` 변경 diff (파일 6)
- 상세: spec `providers/telegram §5.6` 은 `parse_mode: "MarkdownV2"` 를 명시한다. diff 에서 `renderFailureMessage` 는 `applyPlaceholders(template, placeholders)` 결과 string 을 반환하고, 이를 `renderText(renderFailureMessage(event, config))` 로 감싸며 `renderText` 가 `escapeMarkdownV2` + `splitByLimit` 를 처리한다. `parse_mode: "MarkdownV2"` 는 `sendMessage` 호출 시 채워지는 것으로 추정되며, 본 diff 범위에서는 해당 파라미터가 실제로 set 되는지 확인이 불가하다.
- 제안: `parse_mode` 가 renderer diff 이외의 위치(adapter sendMessage 등)에서 처리된다면 이슈 없음. spec과의 정합성 확인을 별도 review turn에서 수행 권장.

---

### [INFO] Discord renderer 테스트 — `languageLocale` 미설정 시 KO default 동작 테스트 없음

- 위치: `discord-message.renderer.spec.ts` (파일 1) 전체
- 상세: Discord renderer 테스트는 CCH-ERR-03 민감정보 strip, HTTP_4XX/HTTP_5XX placeholder 치환, LLM_RATE_LIMIT, LLM_TIMEOUT, DB_QUERY_FAILED, unknown code fallback, user override, languageLocale=en 을 커버한다. 그러나 `CONFIG` 에 `languageLocale` 미설정 시(디폴트 ko) 기본 KO 문구가 나오는지를 명시적으로 검증하는 케이스는 LLM_RATE_LIMIT / LLM_TIMEOUT 케이스 등이 KO 문구("`요청량이 많아`", "`처리 시간이 초과`")를 검증함으로써 암묵적으로 커버된다. 명시적 테스트 케이스는 없지만 실질적으로는 커버되어 있어 INFO 등급 판정.
- 제안: 명시적인 "languageLocale 미설정 → KO default" 케이스를 추가하면 의도가 더 명확해진다.

---

### [INFO] Slack/Discord renderer — `languageHints.executionFailed` (구 single-key deprecated) 키가 새 분기에서 무시되는 동작 테스트 부재

- 위치: `slack-message.renderer.spec.ts` (파일 3), `discord-message.renderer.spec.ts` (파일 1)
- 상세: `language-hint-defaults.spec.ts` 에는 "`legacy 'executionFailed' single key is ignored (deprecated)`" 케이스가 있다. 그러나 Slack/Discord renderer 테스트에는 구 단일 키(`executionFailed`)를 `languageHints` 에 설정했을 때 새 6키 default 로 fallback 되는지를 검증하는 케이스가 없다. 운영 환경에서 기존에 `executionFailed` 키를 설정했던 운영자가 예상과 다른 동작을 경험할 수 있다.
- 제안: renderer 레벨 테스트에서도 구 키 무시 동작을 1케이스 추가 권장.

---

### [INFO] 문서(user guide) — KO default 문구 표가 spec §4.1.1 과 일치

- 위치: `telegram.mdx`, `slack.mdx`, `discord.mdx` (KO), `telegram.en.mdx`, `slack.en.mdx`, `discord.en.mdx` (EN) 각 §7.2 / §6.2 / §7.2 섹션
- 상세: 각 user guide 에 기재된 KO/EN 기본 문구 12개가 spec `§4.1.1` 표 및 `DEFAULT_LANGUAGE_HINTS` 구현과 완전히 일치한다. lookup 순서(1→2→3), `{statusCode}` placeholder 정책, `UNKNOWN_PLACEHOLDER` 에러 코드 안내가 일관되게 기술되어 있다.
- 제안: 없음 (정합 확인).

---

## 요약

이번 변경은 CCH-ERR-01~04 의 핵심 요구사항(실행 실패 분류 helper, KO/EN i18n default 문구, 3 provider renderer 리팩토링, placeholder whitelist DTO validator, e2e 테스트)을 전반적으로 충실하게 구현하고 있다. spec §3.5 의 5개 요구사항 ID, Convention §3.1 의 카테고리 매핑 표, §4.1.1 의 12개 default 문구, R-CC-15 (c) 의 DTO validator 정책이 코드에 line-level 로 반영되어 있다. 주요 우려 사항은 (1) warn 로그에 `triggerId` 가 누락되어 운영 관측성이 낮은 점 (WARNING), (2) `{statusCode}` 누락 시 `"?"` 치환 결과에 대한 assertion 범위가 좁은 점 (WARNING), (3) e2e 에서 `UNKNOWN_PLACEHOLDER` 의 details hierarchy 가 직접 검증되지 않는 점 (INFO) 이다. CRITICAL 또는 spec 직접 위반 항목은 발견되지 않았다.

---

## 위험도

LOW
