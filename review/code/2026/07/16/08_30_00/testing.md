# 테스트(Testing) 리뷰 — control-plane provider escape (escapeControlText)

## 발견사항

- **[WARNING]** `HooksService` 레벨에서 `escapeControlText` 가 실제로 "경유"하는지 검증하는 assertion 이 전무하다 — passthrough mock 이 wiring 회귀를 은폐
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:599-616` (`mockAdapter.escapeControlText = jest.fn((t) => t)`), 및 이를 사용하는 모든 control-plane 안내 테스트(예: 630, 675, 983, 1242, 1284 등)
  - 상세: `mockAdapter.escapeControlText` 가 identity(`t => t`) 로 stub 되어 있고, 어떤 테스트도 `expect(mockAdapter.escapeControlText).toHaveBeenCalledWith(...)` 를 assert 하지 않는다. 이 diff 의 핵심 목적은 "HooksService 가 발송 직전 `adapter.escapeControlText` 를 반드시 경유한다"는 wiring 인데, 현재 테스트들은 `sendMessage` 의 최종 `body.text` 가 "기대하는 default 문자열"과 같은지만 검증한다(예: `SURFACE_MISMATCH_DEFAULTS.ko`). identity mock 이므로 `HooksService` 가 `adapter.escapeControlText(text)` 호출을 통째로 빼먹고 raw `text` 를 그대로 `sendMessage` 에 넘기도록 되돌려도(예: 향후 리팩터 실수로 `adapter.escapeControlText(...)` wrapper 가 사라져도) 동일한 assertion 결과가 나와 테스트는 계속 green 이다. 즉 "F-5 제거 회귀"의 핵심 안전망이 되어야 할 wiring 자체는 테스트로 잠겨 있지 않다.
  - 제안: 최소한 1개 테스트에서 `expect(mockAdapter.escapeControlText).toHaveBeenCalledWith(<해당 default 평문>)` 를 명시적으로 assert 하거나, mock 을 identity 대신 구분 가능한 변환(예: `jest.fn((t: string) => `[ESC]${t}`)`)으로 바꿔 최종 `sendMessage` 호출의 `body.text` 에 `[ESC]` 마커가 포함됨을 assert 하는 방식으로 "escape 함수의 반환값이 실제로 발송된다"는 것을 증명하는 편이 wiring 회귀에 더 강하다.

- **[WARNING]** control-plane 7개 키 중 `help` / `formValidationFailed` / `formNextField` 3개는 `hooks.service.spec.ts` 에서 해당 코드 경로를 구동하는 테스트가 전무 (완전 미커버)
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:352-372`(`/help` 분기), `:876-911`(`formValidationFailed`, `MAX_FIELDS_HEURISTIC` 재시도 catch), `:912-928`(`formNextField`, 다음 필드 prompt) — 이 diff 가 정확히 이 세 지점의 `adapter.escapeControlText(...)` wrapping 을 추가했다.
  - 상세: `grep`(`/help`, `formNextField`, `formValidationFailed`, `MAX_FIELDS_HEURISTIC`, `currentFieldIdx`)로 `hooks.service.spec.ts` 전체를 확인했으나 이 세 분기를 실행하는 테스트가 하나도 없다. `groupChatRefusal`/`unsupportedMessageKind`/`executionStillRunning`/`surfaceMismatch` 4개는 최소한 분기 도달 테스트가 있는 반면(단, 위 WARNING 처럼 escape 호출 자체는 미검증), 나머지 3개는 diff 가 직접 건드린 라인임에도 어떤 테스트도 실행하지 않는다. `/help` 명령·form 다단계 재질문(`formNextField`)·form 검증 실패 재질문(`formValidationFailed`) 각각은 실사용 빈도가 낮지 않은 경로(다단계 form 은 매 필드마다 통과)이므로 회귀 위험이 실질적이다.
  - 제안: 3개 분기 각각에 대해 최소 1개씩 — "`/help` 텍스트 메시지 수신 → `sendMessage` 가 `escapeControlText` 를 거친 help 기본문구로 호출됨", "다단계 form 진행 중 다음 필드 있음 → `formNextField` 안내 발송", "form 재시도 한도 초과(`MAX_FIELDS_HEURISTIC`) → `formValidationFailed` 안내 발송 + `currentFieldIdx`/`partialFormData` 리셋" — 테스트를 추가할 것을 권장.

- **[INFO]** 3-provider `escapeControlText` 단위 테스트는 경계값을 잘 커버 — 양호
  - 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.spec.ts:1451-1465`, `.../slack/slack.adapter.spec.ts:807-815`, `.../discord/discord.adapter.spec.ts:172-180`
  - 상세: telegram — MarkdownV2 예약문자(`.`, `-`) escape + 예약문자 없는 평문 무변화 2케이스. slack — `<`, `>`, `&` escape + 마침표 무변화(마침표가 escape 대상이 아님을 명시적으로 검증, F-5 제거로 인한 "평문 마침표 그대로 통과" 계약을 뒷받침). discord — identity 2케이스(한국어 문장부호 포함 문자열, 슬래시 명령형 문자열). 각 provider 의 escape 규칙 차이(“무엇을 escape 하지 않는지”)까지 명시적으로 assert 하는 점이 좋다 — 향후 누군가 실수로 전체 문자를 escape 하는 회귀를 잡아낸다.
  - 제안 없음(참고 사항).

- **[INFO]** e2e/통합 레벨에서 실제 어댑터로 "cross-provider escape 정합성"(diff 가 고치려는 실제 버그 재현 시나리오)을 검증하는 테스트가 없음
  - 위치: `codebase/backend/test/chat-channel-discord.e2e-spec.ts`, `.../chat-channel-slack.e2e-spec.ts`, `.../chat-channel-trigger-create.e2e-spec.ts` (telegram e2e-spec 자체가 없음) — 모두 `escapeControlText`/`surfaceMismatch`/`MarkdownV2`/`help` 키워드 무매치.
  - 상세: 이번 diff 가 고치는 실제 버그는 "telegram default 에 baked-in 된 `\.` 가 slack/discord 로 literal 노출"되는 **cross-provider** 문제였다. 이 문제는 단일 adapter 단위 테스트만으로는 재현되지 않고(각 adapter 는 독립적으로 자기 escape 만 검증), `HooksService` + 실제(또는 최소 mock 이 아닌) 3-provider 조합에서 같은 `languageHints.surfaceMismatch` override 를 세 provider 로 각각 발송했을 때 결과가 provider 별로 올바른지 통합 검증하는 테스트가 있어야 "재발 방지"가 완전해진다. 현재는 이 계약이 코드 리뷰/스펙 문서 수준에서만 보장된다.
  - 제안: 필수는 아니나(단위 테스트 + DTO 테스트로 최소 안전망은 확보됨), `chat-channel-trigger-create.e2e-spec.ts` 류에 "실제 webhook 흐름에서 languageHints override(평문, 마침표 포함)가 provider 별로 다르게 escape 되어 나간다"는 1개 통합 시나리오를 추가하면 이 클래스의 회귀를 가장 강하게 잠글 수 있다.

- **[INFO]** F-5 제거에 대한 DTO validation 테스트가 세분화된 5개 케이스 → 1개 통합 케이스로 축소됨 — 검증 목적상 적절
  - 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:3049-3148`(diff)
  - 상세: 기존에는 "unescaped 특수문자 reject", "escaped 특수문자 통과", "특수문자 없는 override 통과", "slack 은 검증 대상 아님", "비-raw-send 키(sessionExpired) 는 예외" 5개 케이스로 `LanguageHintsRawSendValidator` 의 세부 분기를 검증했다. validator 자체가 삭제됐으므로 이 5개 분기를 개별로 유지할 필요는 없고, 새 1개 테스트("telegram + control-plane 키 평문 override(마침표 포함) 수용")로 "이전엔 거부되던 입력이 이제 통과한다"는 핵심 회귀만 검증하는 것은 합리적 트레이드오프다. `LanguageHintsRawSendValidator`/`TELEGRAM_RAW_SEND_HINT_KEYS`/`markdown-v2.ts`(+spec) 잔존 참조를 `grep` 으로 재확인했으며 dangling import/dead code 없음(테스트 파일 주석 1곳 제외) — 정리가 깔끔하다.
  - 제안 없음(참고 사항).

- **[INFO]** `ChatChannelAdapter.escapeControlText` 를 인터페이스 필수(non-optional) 멤버로 추가한 것은 테스트 용이성 관점에서 좋은 설계
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:2411-2423`
  - 상세: 옵션(`?`)이 아닌 필수 멤버로 선언해, `implements ChatChannelAdapter` 하는 실제 클래스(telegram/slack/discord adapter, `FakeAdapter`)는 TS 컴파일 시점에 누락을 잡아낸다(실제로 `channel-adapter.registry.spec.ts` 의 `FakeAdapter` 도 함께 갱신됨). 단, `form-mode.spec.ts` 처럼 `as unknown as ChatChannelAdapter` 이중 캐스트를 쓰는 fixture 는 구조적 체크를 우회하므로 컴파일 안전망 밖이다 — 다만 해당 테스트가 `escapeControlText` 를 호출하는 코드 경로를 구동하지 않아(단순 `isNativeFormAdapter` 타입가드 테스트) 실질적 리스크는 없음을 확인했다.
  - 제안 없음(참고 사항).

## 요약

telegram/slack/discord 3-provider `escapeControlText` 자체의 단위 테스트는 각 provider 의 escape 규칙 차이(무엇을 escape 하고 무엇을 안 하는지)를 명확한 경계값으로 잘 커버하고 있고, F-5 검증 제거에 대한 DTO 레벨 회귀 테스트도 핵심 계약("평문 override 도 이제 통과")을 적절히 검증한다. 그러나 이 diff 의 실질적 목적인 "`HooksService` 가 렌더러 우회 발송 시 반드시 `escapeControlText` 를 경유한다"는 wiring 자체는 `hooks.service.spec.ts` 에서 identity-passthrough mock 과 약한 assertion(`body: expect.objectContaining({ kind: 'text' })`) 조합으로 인해 사실상 검증되지 않으며, 특히 diff 가 직접 수정한 `help`/`formValidationFailed`/`formNextField` 3개 control-plane 경로는 아예 실행되는 테스트가 없다. 코드 자체의 정합성(각 provider escape 규칙, HooksService 의 escapeControlText 호출 삽입 위치)은 목검토 결과 타당해 보이나, "F-5 제거로 인한 회귀"를 실제로 감시할 자동화된 안전망은 절반만 구축되어 있다.

## 위험도

MEDIUM
