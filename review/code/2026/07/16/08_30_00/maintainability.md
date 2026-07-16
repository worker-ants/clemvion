# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `escapeMarkdownV2` 를 새로 import 했음에도 동일 정규식을 재구현한 로컬 함수가 그대로 남아 중복이 심화됨
  - 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts` — `escapeControlText`(286행, `import { escapeMarkdownV2 } from './telegram-message.renderer'` 사용)와 파일 하단의 `escapePromptText`(397행, `form_prompt`/`image` fallback 발송의 201·225행에서 호출)
  - 상세: `escapePromptText` 의 정규식(`/([_*[\]()~\`>#+\-=|{}.!])/g`)은 `telegram-message.renderer.ts` 의 `MD_V2_ESCAPE_REGEX`(`escapeMarkdownV2` 가 사용)와 문자 하나 다르지 않게 동일하다. 이번 diff 는 정확히 이 파일에 `escapeMarkdownV2` 를 import 해 `escapeControlText` 구현에 쓰고 있으므로, 같은 파일 안에 "동일 escape 규칙의 서로 다른 두 구현"이 공존하게 됐다. 이는 이번 PR 이 방금 제거한 `markdown-v2.ts` SoT 중복(“두 곳에서 리터럴로 재선언하면 telegram Bot API 예약문자 변경 시 한쪽만 갱신돼 silent drift” — 삭제된 파일의 자체 코멘트)과 정확히 같은 계열의 리스크다. 향후 MarkdownV2 예약문자 집합이 바뀌면 `escapeMarkdownV2` 만 갱신되고 `escapePromptText` 는 누락될 가능성이 있다.
  - 제안: `escapePromptText(x)` 호출부(201·225행)를 이미 import 된 `escapeMarkdownV2(x)` 로 교체하고 `escapePromptText` 함수를 제거한다. 동작 동일성은 두 정규식이 완전히 일치하므로 위험 없음 — 이 PR 범위 안에서 자연스럽게 해소 가능한 부수 정리.

- **[WARNING]** `sendSurfaceMismatchNotice` 의 JSDoc 이 새 escape-at-send 설계로 갱신되지 않아 자매 함수와 불일치·오해 소지
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `sendSurfaceMismatchNotice` 상단 주석(현재 파일 기준 1037~1045행 부근, "문구는 렌더러 escape 를 거치지 않으므로 default 는 MarkdownV2-safe (language-hint-defaults.ts `SURFACE_MISMATCH_DEFAULTS` 참조)")
  - 상세: 같은 diff 에서 `sendExecutionStillRunningNotice` 의 동일 취지 주석은 "텔레그램 MarkdownV2 는 어댑터가 escape 하지 않으므로 default 문구는 pre-escaped" → "default 는 평문 — `sendBestEffortNotice` 가 provider 별로 escape 한다" 로 정확히 갱신됐다. 그런데 구조적으로 대응하는 `sendSurfaceMismatchNotice` 의 주석은 그대로 남아 여전히 "렌더러 escape 를 거치지 않으므로 default 는 MarkdownV2-safe" 라고 말한다. 실제로는 `sendSurfaceMismatchNotice` 도 `sendBestEffortNotice` 를 거쳐 `escapeControlText` 가 적용되므로, 이 주석은 "escape 가 전혀 안 걸린다"는 인상을 줘 향후 `SURFACE_MISMATCH_DEFAULTS`/override 문구를 다룰 때 왜 특수문자를 배제했는지에 대한 혼선을 유발할 수 있다(지금은 자동 escape 되므로 배제할 필요가 없어졌다는 점이 드러나지 않음).
  - 제안: `sendSurfaceMismatchNotice` 주석도 `sendExecutionStillRunningNotice` 와 동일하게 "default 는 평문 — `sendBestEffortNotice`(`escapeControlText`)가 provider 별로 escape" 형태로 갱신해 두 함수 문서를 일관되게 맞춘다.

- **[INFO]** `escapeControlText` 적용이 `sendBestEffortNotice` 로 완전히 캡슐화되지 않고 3곳에서 수작업 반복
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `/help` 처리(357~370행), `formValidationFailed` 재안내(897~910행), `formNextField` prompt(915~928행). 세 곳 모두 `{ conversationKey, body: { kind: 'text', text: adapter.escapeControlText(...) } }` 형태를 각자 조립해 `adapter.sendMessage` 를 직접 호출한다.
  - 상세: `sendBestEffortNotice` 는 정확히 이 boilerplate(+try/catch/warn)를 한 곳에 모으기 위해 신설됐다는 주석이 붙어 있지만, 위 3곳은 에러를 상위로 전파해야 하는 다른 제어 흐름(예외 재throw 허용/이미 catch 블록 내부)이라 `sendBestEffortNotice` 를 그대로 쓸 수 없어 별도 인라인으로 남아있다. 기능상 문제는 아니나, `adapter.escapeControlText(...)` 래핑이 컴파일러 강제 없이 각 호출부의 관례(주석)에만 의존하므로, 향후 새 control-plane 직접발송 코드가 추가될 때 이 래핑을 빠뜨려도 타입 에러 없이 컴파일된다.
  - 제안: 필수는 아니지만, best-effort 가 아닌 발송에도 재사용 가능한 소형 헬퍼(예: `private buildControlTextMessage(conversationKey, text, adapter)`)를 두면 래핑 누락 리스크를 낮출 수 있다. 우선순위는 낮음.

## 요약

`ChatChannelAdapter.escapeControlText` 신설과 3개 provider(telegram/slack/discord) 구현은 인터페이스 JSDoc·convention 문서·provider별 구현 주석이 모두 동일한 서술(“renderNode 경로와 동일 규칙”)로 일관되게 맞춰져 있고, 각 provider 테스트도 대칭적으로 추가돼 가독성·네이밍·일관성 면에서 양호하다. F-5 검증 로직(`LanguageHintsRawSendValidator`/`TELEGRAM_RAW_SEND_HINT_KEYS`/`markdown-v2.ts`+spec) 제거도 깔끔하게 정리됐고 잔여 참조가 없음을 확인했다. 다만 `escapeMarkdownV2` 를 새로 import 한 바로 그 파일(`telegram.adapter.ts`)에 문자 단위로 동일한 MarkdownV2 escape 정규식이 `escapePromptText` 로 중복 존재하는 점, 그리고 같은 diff 안에서 `sendExecutionStillRunningNotice` 주석은 갱신했으나 대응하는 `sendSurfaceMismatchNotice` 주석은 놓쳐 문서 일관성이 깨진 점은 이번 PR 의 취지(SoT 중복 제거)에 정확히 반하는 잔여 리스크라 후속 정리를 권한다. `escapeControlText` 적용 경로 자체(7개 control-plane 키 전수)는 빠짐없이 확인됐고 `formOpenLabel`(form_modal) 은 스펙대로 의도적으로 제외돼 있어 커버리지 누락은 없다.

## 위험도

LOW
