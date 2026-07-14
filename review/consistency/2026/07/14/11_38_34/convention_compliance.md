# 정식 규약 준수 검토 — convention_compliance

- target: `spec/5-system/4-execution-engine.md` (검토 모드 `--impl-done`, diff-base `origin/main`)
- 실제 diff 범위: execution-engine / external-interaction / websocket / chat-channel(hooks, shared) / triggers DTO (plan `eia-command-waiting-surface-guard`, F-1/F-2/F-4/F-5/F-6)

## 발견사항

- **[WARNING] `markdown-v2.ts` 의 "단일 정의 + 양쪽 import" SoT 주장과 실제 구현 불일치**
  - target 위치: `codebase/backend/src/modules/chat-channel/shared/markdown-v2.ts` (신규 파일, diff L290-334) JSDoc
  - 위반 규약: 명시적 조문은 없으나, 프로젝트가 반복적으로 강제하는 SoT 원칙(`error-codes.md`, `cafe24-api-metadata.md`, `audit-actions.md` 등이 공유하는 "이중 선언 금지 → 단일 정의 + import" 패턴)과 본 파일 자신의 JSDoc 이 스스로 선언한 계약
  - 상세: `markdown-v2.ts` 헤더 주석은 "이 집합은 두 곳에서 필요하다 — ① `telegram-message.renderer.ts` 의 `escapeMarkdownV2` ② `chat-channel-config.dto.ts` 의 `LanguageHintsRawSendValidator`. 두 파일이 각자 리터럴로 재선언하면 ... silent drift 가 난다. 여기 단일 정의하고 **양쪽이 import** 한다" 라고 명시한다. 그러나 실제로는 **DTO 쪽만** `firstUnescapedMarkdownV2Special`/`MARKDOWN_V2_SPECIAL_CHARS` 를 import 하고, `telegram-message.renderer.ts` 는 여전히 자체 `MD_V2_ESCAPE_REGEX = /([_*[\]()~\`>#+\-=|{}.!])/g` 리터럴을 그대로 유지한다(diff 에도 renderer 수정 없음 — import 문 `L1-16` 그대로). 즉 "재선언 금지·단일 SoT" 라는 파일 자신의 존재 이유가 실제로는 지켜지지 않고, 대신 `markdown-v2.spec.ts` 의 "SoT drift 가드" 테스트(`MARKDOWN_V2_SPECIAL_CHARS ↔ escapeMarkdownV2 계약`)가 **값 동등성만 사후 검증**한다. 두 리터럴이 현재는 같은 문자 집합이라 기능상 문제는 없지만, JSDoc 의 "양쪽이 import 한다" 는 서술은 사실과 다르며, renderer 쪽이 컴파일 타임 커플링 없이 별도로 유지되는 한 향후 한쪽만 갱신되는 실제 drift 위험은 test 통과 여부에만 의존한다(원래 막고자 했던 실패 모드를 test 로 대체했을 뿐 구조적으로 제거하지 않음).
  - 제안: (a) `telegram-message.renderer.ts` 의 `MD_V2_ESCAPE_REGEX` 를 `MARKDOWN_V2_SPECIAL_CHARS` 로부터 파생(`new RegExp(...)`)하도록 리팩터해 JSDoc 이 말하는 "양쪽 import" 를 실제로 구현하거나, (b) 리팩터가 이번 스코프 밖이면 JSDoc 문구를 "값은 `markdown-v2.spec.ts` 의 계약 테스트로 동기화를 보증하며, 구조적 단일화(양쪽 import)는 아직 DTO 쪽만 완료됨" 처럼 사실에 맞게 정정할 것.

- **[WARNING] `SURFACE_MISMATCH_DEFAULTS` 확장이 `i18n-userguide.md` 적용 범위 밖에서 계속 성장**
  - target 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts` (diff L205-231, `SURFACE_MISMATCH_DEFAULTS` + `resolveSurfaceMismatchMessage`)
  - 위반 규약: [`spec/conventions/i18n-userguide.md` Principle 3](../../../../../../spec/conventions/i18n-userguide.md) — "백엔드 코드가 사용자 가시 응답으로 던지는 ... 문자열은 **영문 SoT** 로 두고 frontend `backend-labels.ts` 에 한국어 매핑을 등록한다 ... ❌ 금지: 백엔드 응답에 한국어 문자열을 직접 박는 행위"
  - 상세: 본 PR 은 `makeLocaleResolver` factory 로 `formOpenLabel`/`sessionExpired`/`surfaceMismatch` 3개 키를 통합했는데, 이 3개 모두 backend 코드(`language-hint-defaults.ts`)에 **한국어 + 영어 default 문구를 직접** 박아 두고 있다. `i18n-userguide.md` §적용 범위는 `codebase/frontend/**`(dict indirection) · `codebase/backend/**`(영문 SoT 발행 + frontend 매핑) · `codebase/channel-web-chat/**`(위젯 로컬 catalog) 세 갈래만 명시하며, "chat-channel 봇이 외부 채널로 직접 발송하는 control-plane 안내 문구는 frontend UI 표면이 없으므로 Principle 3 예외" 라는 서술이 어디에도 없다. 실무적으로는 이 문구가 telegram/slack/discord 로 직접 나가고 프론트 UI 를 거치지 않으므로 예외가 합리적이지만(스스로도 `resolveSurfaceMismatchMessage` JSDoc·`spec/5-system/15-chat-channel.md §4.1.1` 에서 "KO/EN 두 locale 모두 backend 가 보관한다"고 설명), 이 예외가 **정식 규약 문서에 codify 되어 있지 않아** 규약만 읽으면 Principle 3 위반으로 보인다. 이번 PR 로 그 패턴이 3번째 키로 확장되며 "고정된 예외" 가 아니라 "계속 자라는 카테고리" 가 되고 있다.
  - 제안: `i18n-userguide.md` §적용 범위에 "chat-channel `languageHints` control-plane 안내 문구(형식은 `codebase/backend/.../shared/language-hint-defaults.ts`)는 frontend UI 표면이 없는 봇-직접-발송 텍스트라 Principle 3 매핑 의무에서 예외이며, KO/EN default 를 backend 에 함께 보관한다" 한 문장을 추가해 이 이미 정착된(그리고 계속 성장 중인) 패턴을 규약과 일치시킬 것을 권장.

- **[INFO] DTO-embedded validation sub-code (`UNSAFE_TELEGRAM_MARKDOWN`) 가 `error-codes.md` 레지스트리 밖**
  - target 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` `LanguageHintsRawSendValidator.defaultMessage()` (diff L1160-1168, `UNSAFE_TELEGRAM_MARKDOWN:<field>:<char>`)
  - 위반 규약: [`spec/conventions/error-codes.md` §적용 범위](../../../../../../spec/conventions/error-codes.md) — "본 규율은 ... 프로젝트 전체의 에러 코드 문자열에 적용된다"
  - 상세: `UNSAFE_TELEGRAM_MARKDOWN` 은 기존 `UNKNOWN_PLACEHOLDER`(`LanguageHintsPlaceholderValidator`) 와 정확히 동형 패턴(`message` 필드에 `<CODE>:<field>:<detail>` colon-encoding, 실제 wire 상 `details[].code` 는 `INVALID_FIELD` 로 평탄화 — `validation.pipe.ts` 확인)으로 신설됐다. 두 코드 모두 `error-codes.md` §3(historical-artifact 예외) · §4(내부 전용 분류 코드) 어디에도 등재되지 않아, 이 계열(class-validator `defaultMessage` 에 박히는 구조화 sub-code)이 §1 의미 기반 명명·도메인 prefix 원칙의 적용 대상인지 문서상 판단이 어렵다. `UNSAFE_TELEGRAM_MARKDOWN` 자체는 `UNKNOWN_PLACEHOLDER` 선례를 정확히 따랐으므로 이번 PR 만의 새로운 이탈은 아니다(선례를 답습).
  - 제안: 시급하지 않음. `error-codes.md` 에 "class-validator `ValidatorConstraint.defaultMessage` 에 embed 되는 `<CODE>:<field>:<detail>` 형 sub-code(`UNKNOWN_PLACEHOLDER`/`UNSAFE_TELEGRAM_MARKDOWN` 등)는 최종 wire `details[].code`(`INVALID_FIELD`)로 평탄화되는 진단용 message 문자열이라 §1-§3 레지스트리의 등재 대상이 아니다" 는 한 줄 스코프 명시를 추가하면 향후 유사 코드 신설 시 등재 여부 혼란을 줄일 수 있음.

## 요약

diff 는 명명(`UNSAFE_TELEGRAM_MARKDOWN` sub-code, `resolveSurfaceMismatchMessage`/`makeLocaleResolver` 등) · API 문서 데코레이터(`@ApiConflictResponse` 설명 갱신) · 에러 코드 재사용(`STATE_MISMATCH`/`INVALID_EXECUTION_STATE` 신규 코드 신설 없이 기존 코드에 nodeId 불일치 케이스 흡수) 측면에서 기존 `spec/conventions/**`(swagger.md, error-codes.md, chat-channel-adapter.md, interaction-type-registry.md) 의 확립된 패턴을 대체로 충실히 재사용하고 있고, `LanguageHintsPlaceholderValidator`/`FORM_OPEN_LABEL_DEFAULTS` 같은 기존 선례를 정확히 모사해 신규 검증기·문구를 추가했다. CRITICAL 급 직접 위반은 발견되지 않았다. 다만 (1) 신규 `markdown-v2.ts` 가 스스로 선언한 "양쪽 import 단일 SoT" 계약을 renderer 쪽에서 실제로 이행하지 않아 문서-코드 불일치가 있고, (2) chat-channel 봇 전용 KO/EN 백엔드 하드코딩 패턴이 `i18n-userguide.md` Principle 3 문면상 예외로 codify 되지 않은 채 3번째 키로 계속 확장되고 있어 규약 문서 갱신이 필요하다.

## 위험도

LOW
