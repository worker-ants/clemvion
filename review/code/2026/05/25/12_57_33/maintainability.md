# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: chat-channel error notify — CCH-ERR-* 분류·i18n·DTO 검증·문서 변경 (파일 1~26)
리뷰 일시: 2026-05-25

---

## 발견사항

### [INFO] `renderFailedMessage` / `renderFailureMessage` 이름 불일치 — Discord·Slack 은 `renderFailedMessage`, Telegram 은 `renderFailureMessage`
- 위치: `discord-message.renderer.ts` (함수명 `renderFailedMessage`), `slack-message.renderer.ts` (함수명 `renderFailedMessage`), `telegram-message.renderer.ts` (함수명 `renderFailureMessage`)
- 상세: 세 프로바이더가 동일한 역할(실행 실패 메시지 렌더링)을 담당하는 private helper 를 갖고 있으나 이름이 통일되지 않았다. `renderFailedMessage` vs `renderFailureMessage` 는 실질적으로 같은 의미이지만 프로바이더별로 불일치하여, 신규 기여자가 함수 역할을 파악하거나 검색할 때 혼란을 초래한다.
- 제안: 세 파일 모두 `renderFailedMessage` 또는 `renderFailureMessage` 중 하나로 통일. 관용적으로는 `renderFailedMessage` 가 더 간결하다.

---

### [INFO] `renderFailedMessage` / `renderFailureMessage` 구현 본문이 세 파일에서 완전 중복
- 위치: `discord-message.renderer.ts` 239~283 행, `slack-message.renderer.ts` 254~476 행, `telegram-message.renderer.ts` 62~616 행 (각 신규 함수 본문)
- 상세: 세 함수는 `classifyExecutionFailure(event)` → `resolveLanguageHint(key, ...)` → `applyPlaceholders(template, placeholders)` 라는 동일한 3-step 구현 패턴을 갖는다. 유일한 차이는 JSDoc 에서 Discord/Slack/Telegram 을 구분하는 한 줄뿐이다. 신규 에러 분류 로직이 추가될 때 세 곳을 모두 수정해야 하는 상황이 발생한다.
- 제안: `shared/` 에 `resolveFailedMessageText(event, config)` 같은 공통 함수를 정의하여 세 렌더러가 호출하도록 위임. 각 렌더러는 결과 문자열을 자신의 포매팅 래퍼에 전달하면 된다. Telegram 의 경우 MarkdownV2 escape 가 `renderText` 내부에서 자동 적용되므로 공통 함수 분리가 용이하다.

---

### [INFO] `LanguageHintsPlaceholderValidator.defaultMessage` 에서 `findFirstUnknownPlaceholder` 를 두 번 호출
- 위치: `chat-channel-config.dto.ts` `LanguageHintsPlaceholderValidator` 클래스, `validate` / `defaultMessage` 메서드
- 상세: `validate(value)` 에서 `findFirstUnknownPlaceholder(value) === null` 을 평가하고, `defaultMessage(args)` 에서 `findFirstUnknownPlaceholder(args.value)` 를 재호출한다. 검증 실패 시 동일 입력에 대해 함수가 두 번 실행된다. `findFirstUnknownPlaceholder` 는 순수 함수이고 성능 영향은 미미하지만, 결과를 캐싱하지 않는다는 점은 코드 의도의 명확성을 떨어뜨린다.
- 제안: class-validator 의 `ValidatorConstraintInterface` 패턴 특성상 `validate` 와 `defaultMessage` 가 별도로 호출되어 상태 공유가 불가능하다. 이 경우 현재 구현 방식이 관용적이므로 수용 가능하다. 다만 주석에 "class-validator 의 stateless 설계로 인해 재계산" 임을 명시하면 독자의 의문을 해소할 수 있다.

---

### [INFO] `extractStatusCode` 함수가 `details: unknown` 에 대해 `in` 연산자 + `as` 단언을 사용 — 가독성 측면 개선 여지
- 위치: `execution-failure-classifier.ts` `extractStatusCode` 함수 (712~724 행)
- 상세: `'statusCode' in details` 체크 후 `(details as { statusCode: unknown }).statusCode` 로 단언하는 패턴은 올바르게 동작하지만 중간 단언이 다소 장황하다. `unknown` 타입 내로우잉의 표준 패턴이지만, 이름 있는 type guard 함수로 분리하면 의도가 더 명확해진다.
- 제안: 현재 구현으로 충분히 안전하고 함수 자체가 짧아서 즉각적인 리팩토링 필요도는 낮다. 단, 유사 패턴이 다른 곳에서도 필요해질 경우 `shared/type-guards.ts` 로 추출을 고려.

---

### [INFO] `FAILURE_HINT_KEYS` 와 `ExecutionFailureClass['key']` union 이 두 곳에서 별도로 관리 — 동기화 위험
- 위치: `execution-failure-classifier.ts` (타입 정의 `ExecutionFailureClass.key` union), `chat-channel-config.dto.ts` `FAILURE_HINT_KEYS` 배열 (1128~1135 행)
- 상세: 유효한 실패 분류 키는 `ExecutionFailureClass['key']` union 과 `FAILURE_HINT_KEYS as const` 배열로 두 곳에서 나열된다. 신규 분류 키가 추가될 때 두 곳을 동시에 갱신해야 한다. `DEFAULT_LANGUAGE_HINTS` 맵에도 동일 키 목록이 암묵적으로 강제된다(`Record<ExecutionFailureClass['key'], string>` 타입).
- 제안: `execution-failure-classifier.ts` 의 `ExecutionFailureClass['key']` 를 `const`로 export 하고, `FAILURE_HINT_KEYS` 는 해당 union 을 `satisfies` 또는 tuple 형태로 파생시켜 단일 진실을 유지. 예: `export const FAILURE_HINT_KEYS = [...] as const satisfies readonly ExecutionFailureClass['key'][]`.

---

### [INFO] 문서 섹션 번호 renumber 가 파일마다 달라 일관성 부재 — Discord §7 → §8, Slack §6 → §7, Telegram §7 → §8
- 위치: `discord.en.mdx`, `discord.mdx`, `slack.en.mdx`, `slack.mdx`, `telegram.en.mdx`, `telegram.mdx` (각 파일의 기존 Troubleshooting 섹션 번호 변경)
- 상세: Discord / Telegram 의 Troubleshooting 은 §7→§8, Slack 의 Troubleshooting 은 §6→§7 로 renumber 되었다. 세 문서가 구조적으로 다른 섹션 수를 갖는 것은 어쩔 수 없는 사실이지만, 추가 커스터마이즈 섹션이 서로 다른 번호(Discord/Telegram §7.x, Slack §6.x)로 배치된 점을 명시적으로 알지 못하면 독자가 cross-reference 시 혼란을 겪을 수 있다. 이는 기능 결함이 아닌 문서 유지보수 상의 관찰사항이다.
- 제안: 세 문서의 신규 섹션 번호를 통일하거나, 각 문서 앞부분의 목차(있다면)를 함께 갱신했는지 확인. 현재 변경 범위에서는 목차 갱신이 보이지 않는다.

---

### [INFO] `config.languageLocale as LanguageLocale | undefined` — 불필요한 타입 단언
- 위치: `discord-message.renderer.ts` `renderFailedMessage` 함수, `slack-message.renderer.ts` `renderFailedMessage` 함수, `telegram-message.renderer.ts` `renderFailureMessage` 함수
- 상세: `ChatChannelConfig.languageLocale` 의 타입이 이미 `'ko' | 'en' | undefined` 로 선언(`types.ts`)되어 있음에도 불구하고, 세 렌더러 모두 `config.languageLocale as LanguageLocale | undefined` 로 명시적 단언을 수행한다. `LanguageLocale = 'ko' | 'en'` 과 동일하므로 단언이 불필요하다.
- 제안: 단언을 제거하거나, `types.ts` 의 `languageLocale` 필드 타입을 `LanguageLocale | undefined` 로 직접 참조하여 타입 일관성을 강화.

---

### [WARNING] 단위 테스트 fixture `BASE` / `BASE_EVENT_FIELDS` 가 단일 문자 단축값(`'e'`, `'t'`, `'w'`)을 사용 — 진단 가능성 저하
- 위치: `discord-message.renderer.spec.ts` (BASE 객체 51~59 행), `telegram-message.renderer.spec.ts` (BASE_EVENT_FIELDS 관련 변경 행)
- 상세: `executionId: 'e'`, `triggerId: 't'`, `workflowId: 'w'` 같은 단일 문자 값은 테스트 실패 시 로그에서 의미를 파악하기 어렵다. CCH-ERR-03 민감정보 strip 검증 테스트에서는 `'exec-leak'`, `'node-leak'` 처럼 명시적인 값을 사용하고 있어 대조적이다. 기본 fixture 와 민감정보 fixture 사이의 네이밍 철학 불일치가 나타난다.
- 제안: BASE fixture 의 필드값도 `'exec-base'`, `'trigger-base'`, `'workflow-base'` 와 같이 최소한의 의미 있는 이름으로 변경. 진단 가능성이 향상되며 fixture 재사용 시 혼동도 줄어든다.

---

### [WARNING] `findFirstUnknownPlaceholder` 함수가 DTO 파일 내부에 노출 범위 제한 없이 위치 — 책임 분리 미흡
- 위치: `chat-channel-config.dto.ts` (함수 `findFirstUnknownPlaceholder`, 1141~1157 행)
- 상세: `findFirstUnknownPlaceholder` 는 순수 함수로서 validator 내부 헬퍼이지만, DTO 파일 내에 module-level 함수로 선언되어 외부에서도 import 가능하다. DTO 파일은 HTTP 입력 경계 계층이므로 비즈니스 로직 헬퍼가 혼재하면 테스트 단위 분리도 어려워진다. 더불어 `FAILURE_HINT_KEYS`도 같은 파일에 위치하며, 이 키 목록은 `execution-failure-classifier.ts` 의 타입과 중복된다(위 INFO 항목 참조).
- 제안: `findFirstUnknownPlaceholder` 와 `FAILURE_HINT_KEYS` 를 `shared/` 에 별도 helper 로 추출하거나, `execution-failure-classifier.ts` 에서 파생하여 중복을 제거.

---

### [WARNING] `languageHints` 의 key 화이트리스트와 placeholder 화이트리스트가 분리된 두 레이어에서 각각 강제 — 전체 그림이 코드상 불명확
- 위치: `chat-channel-config.dto.ts` (`LanguageHintsPlaceholderValidator`), `language-hint-defaults.ts` (`resolveLanguageHint`), `execution-failure-classifier.ts` (`classifyExecutionFailure`)
- 상세: 보안 정책(CCH-ERR-03)의 enforcement 가 세 레이어에 분산되어 있다. DTO validator 는 등록 시점에 placeholder 를 제한하고, `resolveLanguageHint` 는 런타임 키 lookup 을 수행하며, `classifyExecutionFailure` 는 입력 필드 화이트리스트를 문서화한다. 각각의 역할은 명확하지만, 어디서 어떤 계약이 강제되는지 세 파일을 모두 읽어야만 파악할 수 있다. 한 레이어에서만 우회되어도 전체 보안 모델이 깨질 수 있다.
- 제안: `language-hint-defaults.ts` 상단 주석 또는 별도 README 에 "보안 계층 지도 (defense-in-depth)"를 한 단락으로 정리. 각 레이어의 역할과 우회 불가 이유를 명시하면 미래 기여자가 한 계층을 건너뛰는 실수를 방지할 수 있다.

---

## 요약

이번 변경은 실행 실패 메시지의 민감정보 노출을 방지하기 위해 분류 helper, i18n 기본값 맵, DTO 검증기, 세 provider 렌더러 수정, 테스트, 문서를 체계적으로 추가했다. 함수 길이, 중첩 깊이, 순환 복잡도 측면에서는 모두 양호하며 각 함수가 단일 책임을 잘 지킨다. 주요 유지보수성 위험은 두 가지다. 첫째, 세 렌더러에서 동일 3-step 패턴이 중복되어 있어 향후 분류 로직 변경 시 세 곳을 모두 수정해야 한다. 둘째, `ExecutionFailureClass['key']` union 과 `FAILURE_HINT_KEYS` 배열이 별도로 관리되어 신규 키 추가 시 동기화 누락 위험이 있다. 나머지 발견사항은 네이밍 통일, 불필요한 타입 단언 제거, 테스트 fixture 가독성 향상 수준의 참고 사항이다. 전반적으로 설계 의도가 명확하고 주석이 충실하여 중간 이상의 유지보수성을 갖추고 있다.

---

## 위험도

LOW
