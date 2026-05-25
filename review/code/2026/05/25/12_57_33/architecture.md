# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] 공유 분류 로직의 `shared/` 계층 분리 — 적절한 응집도 향상
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts`, `shared/language-hint-defaults.ts`
- 상세: 기존에는 각 provider renderer(`discord`, `slack`, `telegram`)에서 error 처리 로직이 각각 인라인으로 존재했다. 이번 변경은 분류 로직(`classifyExecutionFailure`)과 i18n 조회 로직(`resolveLanguageHint`, `applyPlaceholders`)을 `shared/` 하위 독립 모듈로 분리했다. 이는 단일 책임 원칙(SRP)을 올바르게 적용한 사례이며, 3개 renderer 가 동일한 로직을 공유하는 방식이 DRY 원칙에도 부합한다.
- 제안: 현행 구조 유지. 신규 provider 추가 시 동일 shared helper 를 재사용하는 패턴이 명확히 수립됨.

---

### [INFO] renderer 함수 시그니처 변경 (`error` 객체 → 전체 `event`) — 적절한 경계 확장
- 위치: `discord-message.renderer.ts:266-284`, `slack-message.renderer.ts:254-276`, `telegram-message.renderer.ts:51-88`
- 상세: `renderFailedMessage(error, config)` → `renderFailedMessage(event, config)` 로 파라미터가 변경되었다. classifier 가 `event.error.details?.statusCode` 를 추출해야 하기 때문에 event 전체가 필요했고, 변경이 불가피하다. 단, 이 함수는 `private`(module-level) 이므로 public API 변경은 없다. `renderDiscordEvent` / `renderSlackEvent` / `renderTelegramMessages` 의 공개 시그니처는 동일하게 유지된다.
- 제안: 현행 유지. `Extract<EiaEvent, { type: 'execution.failed' }>` 타입 narrowing 이 정확하게 적용되어 있다.

---

### [INFO] `LanguageHintsPlaceholderValidator` 배치 위치 — `triggers/dto` 와 `chat-channel` 의 책임 분리 경계
- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:1167-1182`
- 상세: Validator class 가 `triggers/dto` 에 정의되어 있으며, 검증에 필요한 `FAILURE_HINT_KEYS` 상수도 동일 파일 내에 로컬로 선언되어 있다. 이 상수는 `shared/execution-failure-classifier.ts` 의 `ExecutionFailureClass['key']` union 과 의미상 중복이다. 현재는 두 곳이 동기화되어 있지만, 신규 오류 코드 키가 추가될 때 `FAILURE_HINT_KEYS` 배열이 누락될 수 있는 잠재적 드리프트 지점이다.
- 제안: `FAILURE_HINT_KEYS` 를 `shared/execution-failure-classifier.ts` 에서 export 하거나, `ExecutionFailureClass['key']` union 을 직접 파생해 validator 에서 참조하도록 리팩터링하면 단일 진실 원칙이 강화된다. 단, 현재 규모에서 실용적 위험은 낮다.

---

### [WARNING] `console.warn` 직접 사용 — 구조화 로그 계층 위반 가능성
- 위치: `shared/execution-failure-classifier.ts:760` (diff 기준)
- 상세: unknown 오류 코드 fallback 시 `console.warn(JSON.stringify({...}))` 를 직접 호출한다. 코드 주석에 "structured log (CCH-ERR-04)"라고 명시되어 있으나, NestJS 환경에서는 일반적으로 `Logger` (NestJS built-in) 또는 프로젝트 표준 logger 를 사용해야 한다. `console.warn` 은 NestJS 의 log interceptor 체계 밖에서 출력되므로 log level 제어, context 주입(요청 ID 등), 운영 환경 log aggregation 등이 적용되지 않는다.
- 추가적으로, 이 함수는 "pure function" 이라고 헤더에 명시("provider-invariant pure function")되어 있지만 `console.warn` side-effect 가 있어 순수 함수 정의와 모순된다. 주석은 "Side-effect: unknown code fallback 시 console.warn" 으로 별도 표기하고 있으나, 아키텍처적으로 side-effect 있는 함수를 pure 함수와 동일 계층에 두는 것은 혼란을 초래한다.
- 제안: (1) `console.warn` → 프로젝트 표준 logger 주입 또는 최소한 NestJS `Logger.warn` 정적 메서드로 교체. (2) 함수 헤더에서 "pure" 표현 제거 또는 "side-effect-minimal" 로 수정.

---

### [INFO] `LanguageLocale` 타입 중복 선언 — `types.ts` vs `language-hint-defaults.ts`
- 위치: `types.ts:72` (`languageLocale?: 'ko' | 'en'`), `shared/language-hint-defaults.ts:979` (`export type LanguageLocale = 'ko' | 'en'`)
- 상세: `ChatChannelConfig.languageLocale` 의 리터럴 타입 `'ko' | 'en'` 은 `types.ts` 에 인라인으로 정의되고, `LanguageLocale` named type 은 `language-hint-defaults.ts` 에 별도 선언되어 있다. 또한 `discord-message.renderer.ts` / `slack-message.renderer.ts` / `telegram-message.renderer.ts` 에서 `config.languageLocale as LanguageLocale | undefined` 타입 캐스팅이 3군데 반복된다. 이는 `ChatChannelConfig.languageLocale` 의 타입이 `LanguageLocale` 을 직접 참조하지 않기 때문에 발생하는 구조적 문제다.
- 제안: `types.ts` 에서 `languageLocale?: LanguageLocale` 로 선언하고 `LanguageLocale` 을 `shared/language-hint-defaults.ts` 또는 별도 `shared/locale.ts` 에서 re-export 하면 타입 캐스팅이 불필요해진다. 현재 `as` 캐스팅은 타입 안전성 구멍은 아니지만 구조적 중복 표시다.

---

### [INFO] `languageHints` 필드의 `Record<string, string>` — 키 타입 비구조적
- 위치: `types.ts:75`, `chat-channel-config.dto.ts:1213`
- 상세: `languageHints` 가 `Record<string, string>` 으로 정의되어 있어 타입 수준에서 어떤 키가 유효한지 알 수 없다. CCH-ERR-* 6개 키와 기존 키(`executionStarted`, `executionCompleted`, 등) 가 혼재하며, 유효 키 목록이 타입 시스템이 아닌 runtime validator 와 문서에만 존재한다. 이는 개방-폐쇄 원칙(OCP) 관점에서, 신규 키 추가 시 타입 변경 없이 validator 만 갱신하면 되는 유연성을 제공하지만 동시에 타입 레벨 자동완성과 exhaustiveness check 을 포기한 것이다.
- 제안: 현재 규모에서 `Record<string, string>` 유지는 합리적인 트레이드오프로 보인다. 단, 중장기적으로 키 집합이 안정화되면 `Partial<Record<ValidLanguageHintKey, string>>` 같은 명시적 타입으로 마이그레이션을 고려할 수 있다.

---

### [INFO] 3개 provider renderer 에서 동일한 `renderFailedMessage` 패턴 복제 — 중간 수준의 코드 중복
- 위치: `discord-message.renderer.ts:265-284`, `slack-message.renderer.ts:253-277`, `telegram-message.renderer.ts:62-88`
- 상세: 세 provider의 `renderFailedMessage`(또는 `renderFailureMessage`) 함수 본문이 사실상 동일하다: `classifyExecutionFailure` → `resolveLanguageHint` → `applyPlaceholders`. 차이는 함수 이름 컨벤션(`renderFailedMessage` vs `renderFailureMessage`)과 JSDoc 내용뿐이다. 이 패턴 자체는 정상이나(공유 helper 가 실제 로직을 담고 있으므로), provider 추가 시 동일한 보일러플레이트가 반복된다.
- 제안: `shared/` 에 `buildFailureText(event, config): string` 유틸리티 함수를 노출하면 각 renderer 에서 한 줄 호출로 축약 가능하다. 단 Telegram 의 경우 결과를 `renderText()` 에 넘겨야 하므로 래핑 계층 유지가 필요하고, 완전한 단일화는 어렵다. 현재 규모(3개 provider)에서는 강제하지 않아도 무방하다.

---

### [INFO] `LanguageHintsPlaceholderValidator.defaultMessage` 의 `findFirstUnknownPlaceholder` 이중 호출
- 위치: `chat-channel-config.dto.ts:1175-1181`
- 상세: `validate()` 와 `defaultMessage()` 가 각각 독립적으로 `findFirstUnknownPlaceholder(value)` 를 호출한다. class-validator 는 `validate()` 가 false 일 때만 `defaultMessage()` 를 호출하므로 실패 케이스에서 동일 값에 대해 파싱이 두 번 수행된다. 성능 영향은 무시할 수 있는 수준(소규모 객체 파싱)이지만, stateless validator 의 "no instance fields" 요구사항 때문에 결과를 캐싱하기 어려운 구조적 한계다.
- 제안: 현재 사용 규모에서 실질적 문제는 없다. 필요하다면 `validate()` 내부에서 결과를 파라미터로 저장하는 대신 `ValidationArguments.object` 에 메타 주입하는 패턴을 검토할 수 있으나, class-validator 설계상 권장되지 않는다. 현 구조 유지 수용.

---

## 요약

이번 변경은 chat-channel provider 에서 execution failure 메시지 렌더링 책임을 적절하게 분해했다. 분류 로직(`execution-failure-classifier`)과 i18n 조회(`language-hint-defaults`)를 `shared/` 계층으로 추출하여 3개 provider 간 코드 중복을 실질적으로 줄였으며, provider renderer 의 public 인터페이스는 변경 없이 내부 구현만 교체된 점(개방-폐쇄 원칙 준수)은 긍정적이다. CCH-ERR-03 보안 요구사항(민감정보 미노출)을 classifier 입력 화이트리스트와 DTO 레벨 placeholder 검증 두 계층으로 방어한 것도 설계상 올바르다. 주요 아키텍처 우려사항은 두 가지다: (1) `FAILURE_HINT_KEYS` 상수가 `execution-failure-classifier.ts` 의 key union 과 별도로 관리되어 향후 드리프트 위험이 있고, (2) `console.warn` 직접 사용이 NestJS 로깅 체계 밖에서 실행되어 운영 환경 log 관리가 불완전하다. 이 두 항목은 즉각 차단 수준은 아니나 중기적으로 개선이 권장된다.

## 위험도

LOW
