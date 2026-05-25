# 보안(Security) 코드 리뷰 결과

리뷰 대상: chat-channel-error-notify PR (CCH-ERR-* 분기 — execution.failed 안내 메시지 재설계)
리뷰 일시: 2026-05-25

---

## 발견사항

### [INFO] console.warn 에 `event.error.code` 원문 노출 — 구조적 로그이지만 코드값 포함

- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` 라인 760-766
- 상세: unknown code fallback 시 `console.warn(JSON.stringify({ kind: 'chat_channel_unknown_failure_code', code, hasDetails: ... }))` 로 로그를 남긴다. `code` 에는 `event.error.code` 원문(예: 미래에 추가될 새 ErrorCode enum 값)이 들어간다. 현재 `error.code` 는 내부 enum 값(예: `HTTP_4XX`, `DB_QUERY_FAILED`)으로 그 자체가 민감정보라기보다는 내부 분류 레이블이므로 위험도는 낮다. 그러나 미래에 ErrorCode 값에 세부 URL, 호스트명, 자유 형식 문자열 등이 포함될 경우 로그 라인을 통해 인프라 정보가 누출될 수 있는 패턴이다.
- 제안: `code` 값을 허용된 enum 화이트리스트 여부만 판별한 후 로그 필드에는 `unknownCode: true` 정도의 불투명 마커만 남기거나, `code` 의 타입을 enum 리터럴 유니온으로 좁혀 unknown 분기에 도달하는 값이 실제 string 임을 명시적으로 표시하는 방어 레이어를 추가하면 향후 안전성이 높아진다. 현재 구조에서는 LOW 수준.

---

### [INFO] `languageHints` 사용자 override 의 XSS 방어 — 렌더러별 escaping 책임 확인 필요

- 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts` `resolveLanguageHint` / `applyPlaceholders`, 그리고 각 렌더러(`discord-message.renderer.ts`, `slack-message.renderer.ts`, `telegram-message.renderer.ts`)
- 상세: `resolveLanguageHint` 는 사용자가 등록한 `languageHints[key]` 원문 문자열을 그대로 반환하고, `applyPlaceholders` 는 `{statusCode}` 치환 후 최종 문자열을 반환한다. Discord / Slack 렌더러는 이 결과를 `textMessage(...)` 에 직접 전달한다. Telegram 렌더러는 `renderText(renderFailureMessage(...))` 를 호출하며, `renderText` 내부에서 `escapeMarkdownV2` 를 거친다. 즉, Telegram 은 operator override 문자열도 MarkdownV2 escape 처리가 적용되어 있다.
  - Discord / Slack 의 경우 `textMessage` 는 plain text 로 전달되므로 HTML/markdown 인젝션 위험은 제한적이다. 다만 DTO 단계(`LanguageHintsPlaceholderValidator`)에서 `{...}` 형태 placeholder 화이트리스트만 검증하며 HTML 태그, URL, 자바스크립트 스키마 등에 대한 sanitization 은 없다.
  - 실제 위험도는 operator(내부 운영자)만 `languageHints` 를 등록할 수 있는지, 일반 최종 사용자가 이 값을 주입할 수 있는지에 달려 있다. API 엔드포인트가 인가된 운영자만 접근 가능하다면 위험도는 낮다. 그러나 코드 자체에는 입력값 길이 제한(MaxLength)이나 HTML 태그 필터링이 없다.
- 제안: `languageHints` 값에 대해 `MaxLength` 데코레이터(예: 500자)를 추가해 DoS 및 메시지 비정상 확장을 방어하는 것을 권장한다. 운영자 인가 경계가 API 레벨에서 확실히 보장된다면 현행 수준으로 운영 가능하나, 해당 엔드포인트 접근 제어가 느슨할 경우 medium 위험이 된다.

---

### [INFO] DTO `defaultMessage` 에 사용자 입력값(`found.placeholder`)이 포함된 오류 메시지 노출

- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` 라인 1176-1180, `LanguageHintsPlaceholderValidator.defaultMessage`
- 상세: validation 실패 시 오류 메시지를 `UNKNOWN_PLACEHOLDER:${found.field}:${found.placeholder}` 형태로 구성하며, `found.placeholder` 는 사용자가 입력한 `{...}` 문자열(예: `{nodeId}`, `{executionId}`) 그대로 포함된다. 이 메시지는 400 응답 body 의 `error.details` 혹은 `error.message` 에 그대로 반영된다. 테스트(라인 1333-1334)에서도 `{nodeId}` 가 응답에 포함되는 것을 기대한다.
  - 현재 `{...}` placeholder 는 32자 이내 알파벳 수준의 값이므로 정보 누출 위험은 매우 낮다. 단, `\{[^}]+\}` 정규식은 `}` 가 없는 경우를 무한 매칭하지 않도록 `[^}]+` 로 제한하고 있어 ReDoS 위험은 없다.
  - 그러나 사용자가 의도적으로 매우 긴 placeholder 문자열을 삽입할 경우(예: `{` + 수천 자 + `}`), 해당 내용이 그대로 오류 응답에 포함된다.
- 제안: `found.placeholder` 를 오류 메시지에 포함하기 전 최대 길이를 제한(예: 64자)하거나, 사용자 제공 값을 응답에 반사하지 않는 형태(예: `UNKNOWN_PLACEHOLDER:<field>:detected`)로 변경하는 것을 고려한다. 현행 운영 위험도는 낮지만 보안 심층 방어 관점에서 개선 여지가 있다.

---

### [INFO] `PLACEHOLDER_REGEX = /\{[^}]+\}/g` — ReDoS 가능성 검토

- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` 라인 1139
- 상세: `[^}]+` 는 backtracking 이 없는 단순 부정 문자 클래스로, ReDoS 취약점이 없다. `String.prototype.match` 와 함께 사용 시 안전하다.
- 제안: 없음. 현행 정규식은 안전하다.

---

### [INFO] `extractStatusCode` 런타임 타입 가드 — 안전한 패턴

- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` 라인 712-724
- 상세: `details: unknown` 에서 `statusCode` 를 추출할 때 `typeof details === 'object'`, `details !== null`, `'statusCode' in details`, `typeof v === 'number' && Number.isInteger(v)` 를 모두 확인한다. 프로토타입 오염(prototype pollution) 시도에 대해서도 `'statusCode' in details` 는 객체 프로퍼티를 체크하므로 `Object.prototype.statusCode` 가 존재하는 경우 의도치 않은 값이 추출될 수 있다. 단, 그 값도 `Number.isInteger(v)` 를 통과해야 하므로 실질적 공격 경로는 매우 제한적이다.
- 제안: 프로토타입 오염 방어를 강화하려면 `Object.prototype.hasOwnProperty.call(details, 'statusCode')` 또는 `Object.hasOwn(details, 'statusCode')` 를 사용하는 것을 고려할 수 있다. 현행 패턴의 위험도는 INFO 수준.

---

### [INFO] 기존 렌더러의 보안 취약점 제거 확인 (개선 사항)

- 위치: `discord-message.renderer.ts`, `slack-message.renderer.ts`, `telegram-message.renderer.ts` (이전 구현 제거)
- 상세: 이번 변경의 핵심 보안 개선은 이전 구현에서 `error.message` 원문을 `{{message}}` placeholder 로 사용자에게 그대로 노출하던 패턴 (`return \`오류가 발생했습니다 — ${error.message}\`` 및 `template.replace('{{message}}', error.message)`) 을 완전히 제거한 것이다. 이전 구현은 `ENOTFOUND api.internal.example.com`, DB 쿼리 오류 메시지, 스택 트레이스 등 민감한 내부 정보가 최종 사용자(채팅 채널)에게 노출될 수 있는 심각한 정보 누출 취약점이었다. 이번 변경으로 classifier → i18n lookup → placeholder 치환의 3단계 파이프라인을 통해 generic 문구만 전달하도록 수정되었으며, 이는 명백한 보안 개선이다.
- 제안: 없음. 올바른 수정.

---

### [INFO] 하드코딩된 시크릿 없음

- 위치: 전체 변경 파일
- 상세: API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿은 없다. 테스트 코드의 `botTokenRef: 'r'`, `botToken: '111:fake'`, `botToken: '111:e2eToken'` 은 명시적으로 테스트용 placeholder 임을 알 수 있으며, 실제 토큰 형식도 아니다.
- 제안: 없음.

---

### [INFO] 인증/인가 변경 없음

- 위치: 전체 변경 파일
- 상세: 이번 변경은 실행 실패 안내 메시지 렌더링 로직에 국한된다. 인증/인가 레이어, 세션 관리, API 엔드포인트 접근 제어에 대한 변경은 없다.
- 제안: 없음.

---

## 요약

이번 변경의 핵심 보안 목적인 "실행 실패 시 사용자에게 내부 오류 정보(error.message, nodeId, executionId, URL 등)를 노출하지 않는다"는 CCH-ERR-03 요구사항이 코드, 테스트, DTO 유효성 검사, 문서 모두에서 일관되게 구현되어 있다. 이전 구현의 직접 문자열 치환(`{{message}}`, `${error.message}`)에 의한 정보 누출 취약점이 제거된 것은 명확한 보안 개선이다. 부가적으로 살펴볼 점으로는 (1) unknown code fallback 로그에 `error.code` 원문이 포함되는 패턴(향후 enum 값 확장 시 위험), (2) `languageHints` operator override 문자열에 대한 길이 제한 부재, (3) validation 오류 응답에 사용자 입력 placeholder 문자열이 반사되는 패턴이 있으나, 모두 현재 운영 맥락에서 INFO/LOW 수준이다. `extractStatusCode` 런타임 타입 가드는 안전하게 구현되어 있고, placeholder 정규식도 ReDoS 위험이 없다. 하드코딩된 시크릿은 없으며, 인증/인가 레이어 변경도 없다.

---

## 위험도

LOW
