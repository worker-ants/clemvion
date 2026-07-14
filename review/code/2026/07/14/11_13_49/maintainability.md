# 유지보수성(Maintainability) 리뷰 결과

> 참고: 전달받은 `_prompts/maintainability.md` payload 에는 `spec/5-system/{15-chat-channel,4-execution-engine,6-websocket-protocol}.md` 3개 spec 문서 diff만 포함되어 있었으나, 호출자가 명시적으로 지정한 "F-4 factory/helper 추출, F-5 validator 구조" 점검 대상은 실제 구현 코드(`codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts`, `codebase/backend/src/modules/hooks/hooks.service.ts`, `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`)이므로, 해당 커밋(`ce8264f3a` F-4, `ee13e3bf9` F-5, `3ed47bcc6` F-5 style)을 `git show` 로 직접 확인해 코드 관점 리뷰를 진행했다. spec 문서 관점 관찰도 보조적으로 포함한다.

## 발견사항

- **[WARNING]** F-4 리팩터로 인한 orphan JSDoc — 문서가 잘못된 함수를 설명
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:977-1024` (커밋 `ce8264f3a`)
  - 상세: 기존에 `sendExecutionStillRunningNotice` 위에 있던 JSDoc 블록("CCH-CV-03 (b) — execution 이 running/pending... `maybeNotifyIgnored` 와 동일한 kind:'text' 경로...")이 리팩터 후에도 그대로 남아, 새로 삽입된 `sendBestEffortNotice`(F-4 전용 JSDoc 바로 위) 앞에 놓이게 됐다. 결과적으로 (1) `sendBestEffortNotice` 위에 서로 다른 두 함수를 설명하는 JSDoc 블록 2개가 연달아 붙어 있고, (2) 정작 `sendExecutionStillRunningNotice`(1009번 줄) 자신은 문서가 없는 상태가 됐다. 리뷰어/차기 작업자가 `sendBestEffortNotice` 를 읽을 때 "CCH-CV-03 (b) 전용" 설명을 공용 헬퍼의 계약으로 오독할 위험이 있다.
  - 제안: CCH-CV-03 (b) JSDoc 블록을 `sendExecutionStillRunningNotice` 정의 바로 위(1009번 줄)로 이동하고, `sendBestEffortNotice` 위에는 F-4 전용 JSDoc(983-989번 줄)만 남긴다.

- **[WARNING]** F-5 validator 의 MarkdownV2 특수문자 집합이 renderer 와 리터럴 중복 — 자체 인지된 안티패턴을 프로덕션 코드에서는 회피하지 않음
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:167-168` (`MD_V2_SPECIAL_CHARS` / `MD_V2_ESCAPE_PAIR`) vs `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts:27` (`MD_V2_ESCAPE_REGEX`)
  - 상세: 두 파일 모두 `_*[]()~\`>#+-=|{}.!` 문자 집합을 독립적으로 하드코딩한다. DTO 파일 주석 자체가 "telegram-message.renderer.ts MD_V2_ESCAPE_REGEX 와 동일" 이라고 명시해 중복을 인지하고 있다. 흥미롭게도 같은 커밋의 테스트 파일(`language-hint-defaults.spec.ts`)은 정반대 원칙을 실천한다 — "canonical MarkdownV2 escaper 를 재사용 — 특수문자 집합을 손으로 재선언하면 telegram renderer 쪽 정의가 갱신될 때 이 테스트의 안전성 보증이 stale 되어 조용히 무력화된다" 는 주석과 함께 `escapeMarkdownV2` 를 import 한다. 정작 프로덕션 validator 는 이 원칙을 적용하지 않아, 향후 renderer 쪽 이스케이프 대상 문자가 추가/변경되면 validator 가 조용히 stale 해지는 동일한 리스크를 안는다(`MD_V2_ESCAPE_REGEX` 자체는 미export 라 직접 재사용은 불가능했던 것으로 보이나, 문자 집합/정규식을 별도 shared 유틸로 추출해 두 파일이 import 하는 방식은 가능했다).
  - 제안: `MD_V2_ESCAPE_REGEX`(혹은 문자 집합)를 두 모듈이 함께 참조할 수 있는 위치(예: `chat-channel/shared/markdown-v2-chars.ts`)로 추출해 export 하고, renderer/validator 양쪽이 이를 import. 순환 의존 우려가 있다면 최소한 문자 집합 상수만 별도 파일로 분리.

- **[INFO]** F-5 validator 구조가 기존 `LanguageHintsPlaceholderValidator` 와 거의 동일한 골격을 복제 — F-4 의 factory 정신이 F-5 에는 적용되지 않음
  - 위치: `chat-channel-config.dto.ts` — `LanguageHintsPlaceholderValidator`(기존, ~103-140줄) vs `LanguageHintsRawSendValidator`(신규, ~199-217줄)
  - 상세: 두 validator 모두 "module-level 키 배열(`FAILURE_HINT_KEYS`/`TELEGRAM_RAW_SEND_HINT_KEYS`) → 순회하며 첫 위반 필드를 찾는 순수 함수(`findFirstUnknownPlaceholder`/`findFirstUnsafeRawSendHint`) → `validate()`에서 null 체크 → `defaultMessage()`에서 동일 함수를 재호출해 `PREFIX:field:detail` 문자열 조립" 이라는 동일한 패턴을 반복한다. 같은 PR 의 F-4 커밋이 3중 복제된 `resolve*` 함수를 `makeLocaleResolver` factory 로 통합한 것과 대비된다. 다만 현재는 2개 인스턴스뿐이라 "rule of three" 기준으로는 강제할 정도는 아니다.
  - 제안: 즉시 리팩터가 필요한 수준은 아니나, 세 번째 유사 validator(예: 향후 provider 확장 시 slack/discord 전용 검증)가 추가되면 `makeRawTextConstraintValidator(keys, checkFn, messagePrefix)` 형태의 공용 factory 추출을 고려.

- **[INFO]** `sendBestEffortNotice` 의 인접한 3개 `string` 매개변수 + 자유 문자열 `label` — 타입으로 보호되지 않는 호출부 실수 위험
  - 위치: `hooks.service.ts:990-996` (`sendBestEffortNotice(conversationKey, text, label, config, adapter)`), 호출부 812-816 / 1017-1023 / 1044-1050
  - 상세: `conversationKey`/`text`/`label` 세 매개변수가 모두 `string` 타입으로 인접해 있어, 호출부에서 순서를 실수로 바꿔도 TypeScript 컴파일러가 잡아내지 못한다. 또한 `label` 값이 호출부마다 자유 문자열로 흩어져 있고 명명 규칙도 불일치한다 — `'maybeNotifyIgnored'`(메서드명과 동일), `'executionStillRunning'`(호출 메서드명 `sendExecutionStillRunningNotice` 와 불일치, 필드명 기준), `'surfaceMismatch 안내'`(유일하게 한국어 접미사 포함). 로그 메시지 포맷(`` `${label} sendMessage 실패` ``)의 톤이 호출부마다 미묘하게 달라진다(이는 리팩터 전부터 존재하던 문구를 그대로 파라미터화한 것이라 신규 도입 이슈는 아니지만, 공용 헬퍼로 추출된 시점에 통일할 기회였다).
  - 제안: `label` 파라미터명을 통일된 컨벤션으로 정리하거나(예: 모두 함수명 유래 카멜케이스, 한국어 설명은 별도 JSDoc으로 이동), 장기적으로는 `{ conversationKey, text, label }` 형태의 options 객체로 바꿔 인접 string 매개변수 실수 가능성을 줄인다.

- **[INFO]** `TELEGRAM_RAW_SEND_HINT_KEYS` 목록과 `hooks.service.ts` 의 실제 raw-send 호출 지점이 컴파일러가 강제하지 않는 암묵적 계약으로 연결됨
  - 위치: `chat-channel-config.dto.ts:159-167` (`TELEGRAM_RAW_SEND_HINT_KEYS` 배열) vs `hooks.service.ts` 내 `config.languageHints?.{help,groupChatRefusal,unsupportedMessageKind,formValidationFailed,formNextField,executionStillRunning}` 직접 접근 지점들 + `resolveSurfaceMismatchMessage`
  - 상세: 현재는 두 목록이 정확히 7개 키로 일치함을 확인했다(드리프트 없음). 그러나 이 일치는 순전히 개발자가 두 파일을 동시에 기억하고 갱신하는 규율에 의존한다 — 신규 control-plane raw-send 키를 `hooks.service.ts` 에 추가하면서 `TELEGRAM_RAW_SEND_HINT_KEYS` 갱신을 빠뜨려도 컴파일/테스트 모두 통과할 수 있다(런타임에 telegram 사용자가 unescaped 특수문자를 등록해야만 늦게 발견됨).
  - 제안: 즉각 조치가 필요한 수준은 아니나, 두 목록을 하나의 SoT(예: `HooksService` 가 `TELEGRAM_RAW_SEND_HINT_KEYS` 를 import 해 `Record<(typeof TELEGRAM_RAW_SEND_HINT_KEYS)[number], ...>` 형태로 안내 발송 매핑을 구성)로 묶는 방향을 백로그에 남겨둘 만하다.

- **[INFO]** (spec 문서, payload 원본 관점) F-5 단락이 초장문 단일 문단
  - 위치: `spec/5-system/15-chat-channel.md:307` ("**control-plane raw-send 키의 등록 시점 검증 (F-5)**" 문단)
  - 상세: 검증 대상 키 목록 · 특수문자 집합 · 거부 메시지 포맷 · 제외 대상 · 구현 링크 · 잔여 갭 언급이 한 문단에 모두 압축되어 가독성이 낮다. 다만 바로 위 `surfaceMismatch` 설명 문단(305번 줄) 등 인접 문단들도 유사하게 밀도가 높아, 파일 전반의 기존 문서 컨벤션과는 일치한다(신규 이탈이 아님).
  - 제안: 우선순위 낮음. 이 파일을 다음에 손댈 때 목록형 항목(대상 키, 제외 키, 문자 집합)을 하위 bullet 으로 분리하면 스캔성이 개선된다.

## 좋았던 점 (참고)

- F-4 의 `makeLocaleResolver` factory 추출은 모범적이다 — `resolveFormOpenLabel`/`resolveSessionExpiredMessage`/`resolveSurfaceMismatchMessage` 3중 복제를 문자 그대로 동일했던 3-level lookup 로직으로 정확히 식별해 통합했고, factory 자체에 대한 직접 단위 테스트(`makeLocaleResolver (F-4 3-level lookup factory)`)를 추가해 동작 보존을 검증했다. 기존 3개 함수는 각각 한 줄 `export const ... = makeLocaleResolver(...)` 로 축소되어 가독성이 크게 개선됐다.
- `hooks.service.ts` 의 `sendBestEffortNotice` 추출도 3곳에 반복되던 try/catch/warn 골격을 성공적으로 제거해 각 호출부의 순환 복잡도를 낮췄다. commit 메시지가 `ChatChannelInboundService` 분리를 의도적으로 범위 밖으로 명시한 점(scope 관리)도 적절하다.
- F-5 validator(`LanguageHintsRawSendValidator`)는 기존 `LanguageHintsPlaceholderValidator` 와 동일한 명명/에러 포맷 컨벤션(`PREFIX:field:detail`)을 따라 일관성이 좋고, `provider` sibling 필드를 `args.object` 로 읽어 telegram 한정 적용하는 처리도 명확하다. 테스트(`trigger-dto-validation.spec.ts`)도 성공/실패/제외 케이스를 고르게 커버한다.

## 요약

이번 diff 의 핵심(F-4/F-5)은 전형적인 "3중 복제 제거 → factory 추출 + 테스트 보강" 리팩터로, 방향과 실행 모두 양호하다. 다만 리팩터 과정에서 JSDoc 블록이 원래 함수를 떠나 엉뚱한 함수 위에 남는 실수(WARNING)가 있어 문서 신뢰도를 해치고, F-5 validator 가 도입한 MarkdownV2 특수문자 판별 로직이 렌더러 코드의 문자 집합을 리터럴로 재복제하면서 같은 PR 의 테스트 코드가 명시적으로 경계했던 "stale 위험"을 프로덕션 코드에서는 그대로 안고 간다(WARNING). 그 외에는 매개변수 설계·validator 구조 중복·spec 문단 밀도 등 우선순위 낮은 개선 여지들(INFO)이다. 전체적으로 기능적 결함은 없고 테스트도 착실히 보강됐으므로 병합을 막을 사안은 아니지만, WARNING 2건은 후속 커밋으로 정리하는 것을 권장한다.

## 위험도

LOW
