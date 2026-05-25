# 문서화(Documentation) 리뷰 결과

리뷰 대상: chat-channel-error-notify PR (CCH-ERR-* 실행 실패 안내 메시지 개선)
리뷰 일시: 2026-05-25

---

## 발견사항

### [INFO] 독스트링 품질 — 핵심 공개 함수 문서화 우수
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` (모듈 헤더 + `ExecutionFailureClass` 인터페이스 + `extractStatusCode`)
- 상세: `classifyExecutionFailure` 는 모듈 레벨 JSDoc 에 SoT spec 참조 3종, 입력 화이트리스트(CCH-ERR-02), 허용 외 필드 불사용 계약(CCH-ERR-03), side-effect (console.warn / CCH-ERR-04) 까지 명시하고 있다. `ExecutionFailureClass` 인터페이스 필드 설명도 key 와 placeholders 모두 JSDoc 가 붙어 있다. 공개 API 수준으로 충분하다.
- 제안: 없음.

### [INFO] 독스트링 품질 — `language-hint-defaults.ts` 공개 함수 문서화 우수
- 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts`
- 상세: `resolveLanguageHint` 는 `@param` / `@returns` 태그가 3개 파라미터에 대해 모두 명시되어 있고 3-level lookup 순서가 번호로 문서화되어 있다. `applyPlaceholders` 는 화이트리스트 1종과 미지원 placeholder 의 런타임 안전성 동작이 JSDoc 에 설명되어 있다. `DEFAULT_LANGUAGE_HINTS` 에도 키 추가 시 양 locale 동시 갱신 의무가 명시되어 있다.
- 제안: 없음.

### [INFO] Breaking change 주석 — `renderFailedMessage` 함수 내부 문서 적절
- 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts` (239-264행 추가 JSDoc) 및 동일 패턴이 `slack-message.renderer.ts` (448-457행), `telegram-message.renderer.ts` (596-604행)
- 상세: 세 renderer 모두 `renderFailedMessage` / `renderFailureMessage` 에 breaking change 날짜(2026-05-25), 이전 구현의 문제점(CCH-ERR-03 위반), 신규 구현의 계약(classifier + resolveLanguageHint + applyPlaceholders), provider 별 포맷 특이사항(Discord plain text, Slack mrkdwn 미사용, Telegram MarkdownV2 escape 위임)을 JSDoc 으로 기술하고 있다.
- 제안: 없음.

### [INFO] spec 참조 정확성 — `execution-failure-classifier.ts` 의 CCH-ERR-* 섹션 번호가 spec draft 와 다를 수 있음
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` 모듈 JSDoc 2행
  ```
  *   - spec/5-system/15-chat-channel.md §3.5 CCH-ERR-01~05 (시스템 의무)
  ```
- 상세: spec draft `spec-draft-chat-channel-error-notify.md` 는 신규 §3.5 를 삽입하면서 기존 §3.5(비기능 요구사항)를 §3.6 으로 renumber 하는 구조다. 구현 코드의 JSDoc 은 CCH-ERR-* 가 §3.5 에 위치한다고 기술하고 있다. spec 이 실제로 반영된 후에는 이 참조가 정확하다. 그러나 spec 갱신 전/후 시점 차이로 인해 만약 spec 이 아직 main 에 반영되지 않았다면, 현재 main 의 §3.5 는 "비기능 요구사항"이고 CCH-ERR-* 는 존재하지 않는다. 코드와 spec 이 같은 PR 에서 동시 반영된다면 문제가 없으나, spec 이 별도 워크트리(`spec-draft-chat-channel-error-notify`)에서 아직 draft 상태이므로 구현 코드의 JSDoc 이 아직 미반영된 spec 섹션을 참조하고 있는 상황이다.
- 제안: spec 이 main 에 merge 되기 전에 구현을 먼저 merge 하는 경우 JSDoc 의 `§3.5` 참조가 일시적으로 stale 이 된다. 두 작업이 동시에 merge 된다면 허용 가능. plan 에 spec merge → impl merge 순서를 명시하거나 JSDoc 에 "(spec draft — merge 후 유효)" 표기를 추가하면 모호성이 제거된다.

### [WARNING] `languageHints` 인터페이스 JSDoc — deprecated 키(`executionFailed`) 에 대한 안내 없음
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` line 74
  ```typescript
  /** 봇이 보내는 자체 안내 메시지 i18n. */
  languageHints?: Record<string, string>;
  ```
- 상세: `language-hint-defaults.spec.ts` 의 테스트("legacy `executionFailed` single key is ignored (deprecated)")에서 기존 단일 키 `executionFailed` 가 무시된다는 것이 명확히 기술되어 있다. 그러나 `ChatChannelConfig.languageHints` 의 JSDoc 은 여전히 짧은 1줄 설명뿐이며, 기존 운영자가 `executionFailed` 를 사용했다면 신규 분류 체계로 마이그레이션이 필요하다는 안내가 없다. 이전 단일 키(`executionFailed`)를 사용하던 운영자는 코드를 보고서는 마이그레이션 필요성을 인지하기 어렵다.
- 제안: `languageHints` 의 JSDoc 을 다음 수준으로 보강한다.
  ```typescript
  /**
   * 봇이 보내는 자체 안내 메시지 i18n. 실행 실패 분기는 CCH-ERR-* 6 키 사용.
   * @deprecated `executionFailed` 단일 키는 v3.5 이후 무시됨 — CCH-ERR-* 6 키로 대체.
   * @see languageLocale — locale 선택
   */
  ```

### [WARNING] `LanguageHintsPlaceholderValidator` — 클래스 JSDoc 이 `_args` 파라미터 무시를 언급하지 않음
- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` line 1166-1182
- 상세: `validate(value, _args)` 에서 `_args` 가 의도적으로 무시되고 있다. JSDoc 은 클래스 수준에서 scope(CCH-ERR-* 6 키만)와 기존 키 면제 이유를 명시하고 있으나, 왜 `ValidationArguments` 를 import 해서 사용하지 않는지 — 즉, `defaultMessage` 에서만 사용하고 `validate` 에서는 불필요하다는 이유 — 가 문서화되어 있지 않다. 추후 유지보수자가 `_args` 를 사용해야 한다고 착각하고 로직을 추가할 위험이 있다.
- 제안: `validate` 메서드에 짧은 인라인 주석 또는 `@param` 태그로 `_args` 가 사용되지 않는 이유를 기술한다.
  ```typescript
  /** value 만으로 검증 가능 — args 불필요 (stateless pure check). */
  validate(value: unknown, _args: ValidationArguments): boolean {
  ```

### [INFO] 사용자 문서(MDX) — 4개 채널 문서 모두 신규 섹션 추가됨
- 위치:
  - `/codebase/frontend/src/content/docs/06-integrations-and-config/discord.mdx` (한국어)
  - `/codebase/frontend/src/content/docs/06-integrations-and-config/discord.en.mdx` (영어)
  - `/codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx` (한국어)
  - `/codebase/frontend/src/content/docs/06-integrations-and-config/slack.en.mdx` (영어)
  - `/codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx` (한국어)
  - `/codebase/frontend/src/content/docs/06-integrations-and-config/telegram.en.mdx` (영어)
- 상세: 6개 모든 문서에 `languageLocale`, lookup 순서, CCH-ERR-* 6 키 표, Callout 민감정보 보호 설명, default 문구 코드 블록이 포함되어 있다. KO/EN 기본 메시지가 구현 코드(`DEFAULT_LANGUAGE_HINTS`)와 일치한다. 섹션 번호 재정렬(기존 "7. 트러블슈팅" → "8. 트러블슈팅" 등)도 적용되어 있다.
- 제안: 없음. 문서화 완성도가 높다.

### [INFO] MDX 문서 — KO 메시지만 표시하고 EN 메시지는 표시하지 않는 경우 있음
- 위치: `discord.mdx`, `slack.mdx`, `telegram.mdx` (한국어 채널 문서)
- 상세: KO 문서는 "KO default 문구" 코드 블록만 보여주고 EN 기본 메시지를 표시하지 않는다. 반대로 EN 문서는 EN default 메시지만 표시한다. `languageLocale: "ko"` 사용자가 EN 기본 메시지를 확인하려면 EN 문서를 열어야 한다. 실용적으로는 불편하지 않지만, 비교하거나 확인하는 사용자를 위해 KO 문서에도 EN 기본 문구를 접기 형태로 추가하거나 EN 문서 링크를 안내하면 완성도가 높아진다.
- 제안: 낮은 우선순위. 현재 구조로도 충분하며 개선 시 별도 이슈로 관리한다.

### [INFO] CHANGELOG — 변경사항 기록 없음
- 위치: 워크트리 루트 및 `codebase/backend/`
- 상세: breaking change(`executionFailed` 단일 키 무시, `{{code}}` / `{{message}}` placeholder 제거, `languageLocale` 신규 필드 추가)를 포함한 변경이지만, 프로젝트에 별도 CHANGELOG 파일이 존재하지 않는 것으로 확인된다(`.claude/worktrees/chat-channel-error-notify-6d37ec/` 하위에 CHANGELOG 파일 없음). 이 프로젝트는 CHANGELOG 를 관리하지 않는 정책인 것으로 보이며, plan 파일과 spec Rationale 이 그 역할을 대체하고 있다.
- 제안: 현재 프로젝트 규약으로는 CHANGELOG 미관리가 정책이므로 추가 조치 불필요. 단, `languageHints.executionFailed` 키 폐기와 같은 breaking change 는 `spec/5-system/15-chat-channel.md §3.5` 의 Rationale 또는 plan 파일의 migration note 에 명시되어 있는지 별도 확인을 권장한다.

### [INFO] 테스트 파일 자체 문서화 — 테스트 의도가 명확히 기술됨
- 위치: `discord-message.renderer.spec.ts`, `slack-message.renderer.spec.ts`, `telegram-message.renderer.spec.ts`, `execution-failure-classifier.spec.ts`, `language-hint-defaults.spec.ts`
- 상세: 모든 신규/변경 테스트 파일의 `describe` / `it` 레이블에 CCH-ERR-* 요구사항 ID, 분기 조건, 기대 동작이 명시되어 있다. `discord-message.renderer.spec.ts` 는 파일 상단에 모듈 수준 JSDoc 으로 커버 범위(기존 spec vs 신규 §5.6)를 설명한다.
- 제안: 없음.

### [INFO] `execution-failure-classifier.ts` — `classifyExecutionFailure` 함수 자체에 JSDoc 없음
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` line 726
- 상세: 모듈 레벨 JSDoc 이 매우 상세하지만 공개 함수 `classifyExecutionFailure` 자체에는 별도 JSDoc 이 없다. 모듈 JSDoc 이 함수 동작을 충분히 커버하고 있어 실용적으로 문제가 없다. 그러나 IDE 툴팁에서 함수 hover 시 모듈 JSDoc 이 표시되지 않는 경우가 있으므로, 간단한 `@param` / `@returns` 태그를 함수 바로 위에 추가하면 소비자 DX 가 향상된다.
- 제안:
  ```typescript
  /**
   * error.code + details.statusCode 만 사용해 CCH-ERR-* 6 키 중 하나를 결정한다.
   * @param event EiaFailedEvent — code / details 이외 필드 미사용 (CCH-ERR-02/03)
   * @returns ExecutionFailureClass — key + placeholders (statusCode 만 허용)
   */
  export function classifyExecutionFailure(
  ```

---

## 요약

이번 변경은 문서화 측면에서 전반적으로 매우 충실하다. 핵심 공개 함수(`classifyExecutionFailure`, `resolveLanguageHint`, `applyPlaceholders`)는 SoT spec 참조, 입력 화이트리스트, 반환 계약이 모두 JSDoc 으로 명시되어 있다. 세 provider renderer 의 `renderFailedMessage` 는 breaking change 날짜와 이유, provider 별 포맷 특이사항까지 기술하고 있다. 6개 MDX 사용자 문서는 `languageLocale`, 3-level lookup 순서, CCH-ERR-* 6 키 표, 민감정보 보호 Callout, default 문구 코드 블록을 빠짐없이 포함하며 KO/EN 양 언어 대칭이 유지된다. 개선 여지가 있는 부분은 두 가지다. 첫째, `ChatChannelConfig.languageHints` 인터페이스 JSDoc 이 deprecated 된 `executionFailed` 단일 키에 대한 마이그레이션 안내를 제공하지 않아 기존 운영자에게 혼동을 줄 수 있다. 둘째, `classifyExecutionFailure` 함수 자체에 JSDoc 이 없어 IDE 툴팁 경험이 떨어진다. 두 건 모두 blocking 은 아니다.

## 위험도

LOW

---

관련 파일:
- `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts`
- `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts`
- `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/backend/src/modules/chat-channel/types.ts`
- `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/frontend/src/content/docs/06-integrations-and-config/discord.mdx`
- `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/frontend/src/content/docs/06-integrations-and-config/discord.en.mdx`
- `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx`
- `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/frontend/src/content/docs/06-integrations-and-config/slack.en.mdx`
- `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx`
- `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-error-notify-6d37ec/codebase/frontend/src/content/docs/06-integrations-and-config/telegram.en.mdx`
