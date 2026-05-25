# 부작용(Side Effect) 리뷰 결과

대상 PR: chat-channel-error-notify (CCH-ERR-01~05 — Execution Failed 안전 안내)
검토 일시: 2026-05-25

---

## 발견사항

### [WARNING] `renderFailedMessage` 시그니처 변경 — 함수 인자가 `error` 객체에서 `event` 전체로 교체

- 위치: `discord-message.renderer.ts` line 265 / `slack-message.renderer.ts` line 258 (변경 후 기준)
- 상세: 두 파일의 `renderFailedMessage` 함수 시그니처가 `(error: { code: string; message: string }, config)` 에서 `(event: Extract<EiaEvent, { type: 'execution.failed' }>, config)` 로 변경되었다. 함수는 `private` (module 내부 파일 스코프) 이므로 외부 모듈에 대한 공개 API 영향은 없다. 그러나 파일 내 유일 호출처인 `renderDiscordEvent` / `renderSlackEvent` 의 호출부도 `event.error` → `event` 로 동시에 갱신(`renderFailedMessage(event, config)`)되어 있고, 호출부와 정의부가 일치함을 확인했다. 의도치 않은 호출자 파단은 없다.
- 제안: 해당 없음. 변경이 일관성 있게 적용됨.

---

### [WARNING] `console.warn` 직접 호출 — 운영 로그 레벨 불일치 가능성

- 위치: `execution-failure-classifier.ts` line 114~120
- 상세: `classifyExecutionFailure` 는 unknown error code fallback 시 `console.warn(JSON.stringify({...}))` 을 직접 호출한다. 프로젝트의 다른 모듈이 NestJS Logger / winston / pino 등 구조화 로거를 사용한다면 이 warn 만 다른 채널로 출력되어 로그 수집 파이프라인에서 누락될 수 있다. 코드 주석은 "structured log" 라고 기술하지만 실제로는 런타임 전역 `console` 에 의존한다.
- 제안: 프로젝트 표준 로거(NestJS `Logger` 또는 공통 logger util)를 DI 없이 사용할 수 없다면, 적어도 호출자(renderer) 에서 warn 처리를 감싸거나, classifier 를 pure function 으로 유지하고 호출자가 `console.warn` 책임을 지도록 분리하는 방안을 검토한다. 현 상태에서는 테스트(파일 1 line 165~179)에서 `jest.spyOn(console, 'warn')` 으로 검증하고 있으므로 동작 자체는 의도적이다.

---

### [INFO] `ChatChannelConfigDto.languageLocale` 필드 추가 — 기존 DB 직렬화·역직렬화 영향

- 위치: `chat-channel-config.dto.ts` line 315~322 / `types.ts` line 72
- 상세: `ChatChannelConfig` 인터페이스와 `ChatChannelConfigDto` 에 `languageLocale?: 'ko' | 'en'` 필드가 추가되었다. 기존 DB에 저장된 트리거 config 레코드에는 해당 키가 없다. TypeScript `optional` 필드이고 렌더러가 `undefined` 를 `'ko'` fallback 으로 처리하므로 기존 레코드를 읽을 때 동작 변화는 없다. 신규 필드는 `@IsOptional()` 데코레이터를 보유하고 있어 입력 누락 시 검증 통과한다.
- 제안: 해당 없음. 하위 호환성 유지 확인.

---

### [INFO] `LanguageHintsPlaceholderValidator` 모듈 수준 상수 3개 도입 — 전역 오염 없음

- 위치: `chat-channel-config.dto.ts` line 85~96 (`FAILURE_HINT_KEYS`, `ALLOWED_PLACEHOLDER`, `PLACEHOLDER_REGEX`)
- 상세: 세 상수는 모두 해당 파일 스코프(module-level, not exported) 이다. `PLACEHOLDER_REGEX` 는 `const` 로 선언된 `RegExp` 리터럴이므로 `lastIndex` 문제가 없다 (플래그 `g` 사용 + `String.prototype.match()` 호출 → `lastIndex` 가 stateful 하지 않음). `findFirstUnknownPlaceholder` 내부에서 매번 새 `match` 를 실행하므로 상태 누적 없음.
- 제안: 해당 없음.

---

### [INFO] `DEFAULT_LANGUAGE_HINTS` 모듈 수준 상수 — 불변 객체, 공유 상태 변형 없음

- 위치: `language-hint-defaults.ts` line 23
- 상세: `DEFAULT_LANGUAGE_HINTS` 는 `export const` 로 선언된 순수 데이터 객체이다. `resolveLanguageHint` 는 해당 객체의 필드를 읽기만 하고 쓰지 않는다. 외부에서 `DEFAULT_LANGUAGE_HINTS.ko.executionFailedInternal = '...'` 처럼 직접 변형하는 코드가 생긴다면 전역 부작용이 발생하지만, 이번 PR 내 코드 범위에서는 해당 패턴이 없다.
- 제안: 방어적으로 `Object.freeze(DEFAULT_LANGUAGE_HINTS)` 를 적용하면 런타임 변형 시도를 차단할 수 있다 (strict mode 에서 TypeError).

---

### [INFO] `TIMEOUT_CODES`, `THIRD_PARTY_CODES`, `INTERNAL_CODES` Set 상수 — 모듈 스코프, 공유 변형 없음

- 위치: `execution-failure-classifier.ts` line 31~60
- 상세: 세 `Set` 은 `const` 이지만 TypeScript `const` 는 재할당만 막고 Set 내부 변형(`add`/`delete`)은 막지 않는다. 이번 PR 내에서는 변형 코드가 없다. 단, 미래 코드가 `TIMEOUT_CODES.add('NEW_CODE')` 를 호출하면 모듈 전체 수명 동안 분류 로직이 영향받는다.
- 제안: `Object.freeze` 는 Set 에 적용 불가이므로, 변형 방지가 필요하다면 `as const` 배열 + 런타임 `new Set([...])` 패턴이나 별도 `ReadonlySet<string>` 타입 사용을 검토한다. 현재 코드베이스 규모에서는 낮은 우선순위.

---

### [INFO] `languageHints` 기존 키 `executionFailed` (단수) 행동 변경 — 사일런트 무시

- 위치: `language-hint-defaults.ts` `resolveLanguageHint` 함수 / 테스트 파일 9 line 890~898
- 상세: 이전 구현은 `config.languageHints?.executionFailed` (단수 키) 를 읽어 사용자 커스텀 메시지로 사용했다. 신규 구현은 이 키를 전혀 읽지 않고 6개의 세분화 키만 조회한다. 기존 운영 데이터에 `executionFailed` 단수 키가 설정된 트리거가 있다면, 해당 설정은 silently ignored 되고 기본 i18n 문구로 대체된다. PR 코드 주석과 테스트("legacy `executionFailed` single key is ignored (deprecated)")에서 이를 의도적 breaking change 로 명시하고 있다.
- 제안: 운영 데이터 마이그레이션이 필요한지 검토한다. `resolveLanguageHint` 에서 `executionFailed` 단수 키 존재 시 `console.warn` 으로 deprecation 경고를 출력하면 운영자가 인지할 수 있다. 문서(docs mdx 파일 15~20)에는 신규 6키만 기술되어 있으나 migration guide 는 없다.

---

### [INFO] 문서 섹션 번호 변경 — 외부 딥링크 파단 가능성

- 위치: `discord.mdx`, `discord.en.mdx`, `slack.mdx`, `slack.en.mdx`, `telegram.mdx`, `telegram.en.mdx`
- 상세: Discord / Slack 문서에서 기존 `## 7. Troubleshooting` / `## 6. Troubleshooting` 가 `## 8.` / `## 7.` 로 renumber 되었고, Telegram 문서에서도 `## 7. Limitations` 가 `## 8.` 로 밀렸다. 외부에서 해당 섹션의 앵커(`#7-troubleshooting` 등)를 직접 URL 로 공유한 경우 404 또는 엉뚱한 섹션으로 이동하는 부작용이 발생한다.
- 제안: Markdown 앵커 ID 는 섹션 제목 텍스트에서 자동 생성되므로, 기존 앵커를 유지하려면 `id` 속성을 수동으로 지정하거나 redirect 규칙을 추가해야 한다. 문서 사이트가 SEO/링크 안정성을 중요시한다면 검토를 권장한다.

---

## 요약

이번 변경은 `execution.failed` 이벤트의 렌더링 로직을 error 원문 노출 방식에서 분류 기반 i18n 방식으로 교체하는 순수 리팩토링이다. 주요 부작용 관점에서 `renderFailedMessage` 시그니처 변경은 파일 스코프 private 함수에 한정되어 외부 API 영향이 없고, 모든 호출부가 동시에 갱신되어 일관성이 유지된다. `console.warn` 직접 호출은 프로젝트 표준 로거와 달라 로그 수집 일관성 저하가 우려되지만, 테스트에서 spy 로 검증하고 있어 의도적임이 명확하다. 기존 `languageHints.executionFailed` 단수 키가 운영 데이터에 존재하는 경우 slient drop 되는 것이 실질적 행동 변화이나, PR 내에서 intentional breaking change 로 명시되어 있다. 전역 변수 오염, 파일시스템 부작용, 네트워크 호출, 환경 변수 접근은 발견되지 않았다.

## 위험도

LOW
