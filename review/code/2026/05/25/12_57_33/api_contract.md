# API 계약(API Contract) 리뷰 결과

대상 변경: chat-channel-error-notify (CCH-ERR-* — Execution Failed 사용자 안내 개선)
리뷰 일시: 2026-05-25

---

## 발견사항

### [WARNING] `languageHints.executionFailed` 단일 키 → 6개 분류 키 전환 — 기존 클라이언트 breaking change

- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (파일 12), `types.ts` (파일 11)
- 상세: 이전 `renderFailedMessage` 구현은 `config.languageHints?.executionFailed` 단일 키를 사용하고, `{{code}}` / `{{message}}` placeholder를 지원했다. 이번 변경으로 해당 단일 키는 완전히 무시(silently ignored)되고, 6개 신규 키(`executionFailedThirdParty4xx` 등)와 `{statusCode}` 단일 placeholder 체계로 교체된다. `languageHints.executionFailed` 를 이미 설정한 기존 운영자(API 클라이언트)는 아무 에러 없이 설정이 무시되고 기본 문구가 사용된다. 또한 `{{code}}` / `{{message}}` placeholder를 사용한 기존 설정도 동작 변경이 발생한다.
- 제안: (1) `languageHints.executionFailed` 단일 키에 대한 deprecation warning 응답 헤더(`Deprecation`, `Sunset`) 또는 최소한 API 응답 본문 내 `warnings` 배열을 통해 기존 운영자에게 명시적으로 알릴 것을 권장한다. (2) 마이그레이션 기간을 두거나 해당 breaking change를 API changelog에 명시하는 것을 강력히 권장한다. 현재는 코드 주석("`Breaking change (2026-05-25)`")에만 기록되어 있어 API 소비자가 이를 알 수 없다.

---

### [WARNING] `{{code}}` / `{{message}}` placeholder → `{statusCode}` placeholder 형식 불일치 — 기존 계약과의 비호환

- 위치: `discord-message.renderer.ts` (파일 2), `slack-message.renderer.ts` (파일 4), `telegram-message.renderer.ts` (파일 6)
- 상세: 이전 API 계약은 `{{code}}` / `{{message}}` (이중 중괄호) 형식을 허용했다. 신규 계약은 `{statusCode}` (단일 중괄호) 형식 1종만 허용한다. placeholder 형식 자체가 바뀌어 기존 문서나 운영 가이드에서 이 형식을 기재한 클라이언트에게 혼란을 줄 수 있다. 또한 기존 `{{code}}` / `{{message}}` placeholder를 넣어 저장된 DB 데이터(기존 운영 트리거 설정)는 `executionFailed` 키 자체가 무시되므로 런타임에 적용되지 않는다.
- 제안: 신규 placeholder 형식이 기존과 다른 이유(단일 중괄호)를 API 문서에 명시하고, 기존 이중 중괄호 형식이 더 이상 지원되지 않음을 changelog에 기록한다.

---

### [WARNING] `languageLocale` 신규 필드 — 미설정 시 `"ko"` 강제 기본값의 암묵성

- 위치: `types.ts` (파일 11), `chat-channel-config.dto.ts` (파일 12)
- 상세: `languageLocale` 필드가 신규로 추가되며 생략 시 `"ko"` 로 암묵적으로 fallback된다. 이전에는 이 필드가 없었고, `languageHints` 에 운영자가 원하는 언어의 문구를 직접 지정했다. 신규 기본 문구(KO default 6개 키)가 `languageLocale` 없이 자동 적용되므로, 기존에 `languageHints` 에 아무것도 설정하지 않은 클라이언트는 이제 한국어 기본 문구를 받게 된다. 이는 이전 동작(`오류가 발생했습니다 — ${error.message}` 고정 문구)과 다르다.
- 제안: `ApiProperty` 의 `default: 'ko'` 가 Swagger 문서에는 반영되어 있어 문서 수준에서는 양호하다. 다만 실제 DB에 저장되는 값(null vs "ko" 문자열)의 일관성을 확인하고, 기존 트리거에 대해 기본값이 올바르게 적용되는지(특히 영어권 운영자가 기존 트리거를 유지하는 경우) 마이그레이션 시나리오를 검토할 것을 권장한다.

---

### [INFO] `languageHintsPlaceholderValidator` 에러 응답 형식 — `UNKNOWN_PLACEHOLDER:<field>:<placeholder>` 파싱 의존성

- 위치: `chat-channel-config.dto.ts` (파일 12), `chat-channel-trigger-create.e2e-spec.ts` (파일 14)
- 상세: `LanguageHintsPlaceholderValidator.defaultMessage()`가 `UNKNOWN_PLACEHOLDER:languageHints.executionFailedInternal:{nodeId}` 형태의 콜론 구분 문자열을 반환하고, ValidationPipe의 `exceptionFactory`가 이를 파싱하여 `details.code='UNKNOWN_PLACEHOLDER'` + `details.field`를 합성한다고 명시되어 있다. 이 파싱 로직이 `exceptionFactory` 구현에 올바르게 반영되어 있는지 이번 diff에서는 확인되지 않는다. e2e 테스트는 `res.body.error.code === 'VALIDATION_ERROR'`만 검증하고 `details.code === 'UNKNOWN_PLACEHOLDER'`는 직접 검증하지 않으며, `JSON.stringify(res.body.error).includes('UNKNOWN_PLACEHOLDER')`로 간접 확인하고 있다.
- 제안: `exceptionFactory`에서 `UNKNOWN_PLACEHOLDER:<field>:<placeholder>` 포맷을 파싱하여 `details` 객체를 구성하는 로직이 실제로 구현되어 있는지 확인한다. e2e 테스트에서 `res.body.error.details.code === 'UNKNOWN_PLACEHOLDER'`를 직접 검증하면 계약 준수 여부를 더 명확히 보증할 수 있다.

---

### [INFO] 기존 `executionCancelled` / `executionCompleted` 키와의 lookup 비일관 — 구 단일 키 방식 혼재

- 위치: `telegram-message.renderer.ts` (파일 6), `slack-message.renderer.ts` (파일 4), `discord-message.renderer.ts` (파일 2)
- 상세: `execution.completed` / `execution.cancelled` 이벤트는 여전히 `config.languageHints?.executionCompleted` / `config.languageHints?.executionCancelled` 단일 키 방식을 사용하고 직접 string fallback을 쓴다. `execution.failed`만 신규 3-level lookup(classifyExecutionFailure + resolveLanguageHint)으로 교체되어 이벤트 타입별 lookup 방식이 혼재된다. 이는 현재 API 계약상 breaking이 아니지만, 장기적으로 `languageHints` 의 키 체계가 일관되지 않아 운영자가 혼동할 수 있다.
- 제안: 현재 변경 범위 내에서 즉시 수정할 사항은 아니다. 향후 `execution.completed` 등 나머지 이벤트 타입도 동일한 3-level lookup 패턴으로 통일하는 리팩토링 plan을 별도로 수립하는 것을 권장한다.

---

### [INFO] `languageLocale=fr` 등 unknown locale → DTO 레벨 400 거부 vs. 런타임 silently "ko" fallback 의 이중성

- 위치: `chat-channel-config.dto.ts` (파일 12) `@IsIn(['ko', 'en'])`, `language-hint-defaults.ts` (파일 10) `resolveLanguageHint`
- 상세: DTO 레벨에서 `@IsIn(['ko', 'en'])`로 unknown locale을 400으로 거부한다. 그러나 `resolveLanguageHint` 내부에서도 unknown locale을 `'ko'` fallback으로 처리한다. 런타임 safeguard는 방어적 코드로 적절하지만, 테스트(`'fr' as unknown as LanguageLocale`)에서 이 path를 명시적으로 커버하는 것이 DTO 수준의 validation이 버그로 빠진 경우의 last-resort임을 나타낸다. 계약 관점에서는 DTO-레벨 validation이 일차 방어선이고 런타임 fallback이 이차 방어선인 구조로 적절하다.
- 제안: 현재 구조는 적절하다. 추가 조치 불필요.

---

## 요약

이번 변경의 핵심 API 계약 위험은 `languageHints.executionFailed` 단일 키 + `{{code}}` / `{{message}}` 이중 중괄호 placeholder 지원의 **묵시적 폐기**이다. 기존 운영자가 해당 설정을 사용하고 있더라도 어떠한 오류나 경고 없이 설정이 무시되고 신규 기본 문구로 교체된다. 이는 하위 호환성 관점에서 breaking change에 해당하며, API 응답 내 deprecation 알림 또는 changelog 공지가 필요하다. 신규 `languageLocale` 필드 추가와 placeholder 화이트리스트 검증(`{statusCode}` 1종)은 요청 검증 및 에러 응답 형식 측면에서 전반적으로 올바르게 설계되었다. e2e 테스트에서 `UNKNOWN_PLACEHOLDER` 에러 세부 구조(`details.code`)를 직접 검증하지 않는 점은 계약 보증 측면에서 보완이 권장된다.

## 위험도

MEDIUM
