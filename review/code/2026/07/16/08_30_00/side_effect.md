# 부작용(Side Effect) Review

대상: `escapeControlText` 이관 (`ChatChannelAdapter.escapeControlText`) + F-5 (`LanguageHintsRawSendValidator`) 제거 + telegram-baked `\.` default 평문화 (control-plane-provider-escape, F-5 근본 fix)

## 발견사항

- **[WARNING]** F-5 merge~본 PR 사이 window 에 저장된 기존 escaped `languageHints` override 가 이중 escape 로 telegram 발송이 조용히 실패할 수 있음 (미해결 마이그레이션 gap)
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:1000-1013` (`sendBestEffortNotice` → `adapter.escapeControlText(text)`), `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts:26-30` (`escapeMarkdownV2` / `MD_V2_ESCAPE_REGEX`), `plan/in-progress/control-plane-provider-escape.md` "마이그레이션 주의" 섹션
  - 상세: `escapeMarkdownV2` 는 `_ * [ ] ( ) ~ \` > # + - = | { } . !` 를 단순 regex replace 로 escape 하며, **backslash(`\`) 자체는 매치 대상이 아니라서 "이미 escape 됐는지" 를 감지하지 않는다**(구 F-5 검증기 `firstUnescapedMarkdownV2Special` 는 backslash-toggle 을 정확히 처리했지만 이번에 삭제됨). 만약 F-5(#950) 가 머지된 뒤 이 PR 이 배포되기 전 사이에 operator 가 telegram control-plane 키(`surfaceMismatch`/`executionStillRunning`/`groupChatRefusal`/`unsupportedMessageKind`/`help`/`formValidationFailed`/`formNextField`)에 이미 escape 된 문자열(예: `처리 중입니다\.`)을 등록해 DB 에 저장해 두었다면, 배포 후 `escapeControlText`가 그 문자열에 다시 escape 를 적용해 `처리 중입니다\\.` 가 되고, Telegram MarkdownV2 파서는 이를 `\\`(escaped backslash, literal `\`) + 뒤따르는 **unescaped** `.` 로 해석해 `sendMessage` 가 400 을 반환한다. `sendBestEffortNotice`/`adapter.sendMessage` 호출은 모두 best-effort try/catch(`warn` 로그만 남기고 swallow)이므로, 이 시나리오에서는 **해당 안내가 사용자에게 조용히 전달되지 않는 회귀**가 된다(크래시·에러 노출 없이 기능만 소실). PR 이 스스로 이 위험을 "F-5 가 방금 머지돼 실무상 escape 된 override 사례가 없다"는 **wall-clock 타이밍 가정**으로만 완화하고 있고(코드 레벨 감지·정규화 로직·DB 마이그레이션 없음), multi-env 배포 시차·QA/시드 데이터·API 직접 호출(운영자 UI 가 아닌 경로)로 이 가정이 깨질 가능성을 배제하지 못한다.
  - 제안: (a) 배포 전 실제 DB 의 `trigger.config.chatChannel.languageHints` 를 스캔해 `provider='telegram'` + 위 7개 키에 `\` 가 포함된 값이 있는지 1회성 점검(있으면 backslash 제거 후 재저장), 또는 (b) `escapeControlText`(telegram 경로)에 이중 escape 방어(예: 이미 `\`+예약문자 쌍이면 재escape skip)를 추가해 원천 차단. 최소한 이 리스크를 plan 체크리스트에 "프로덕션 데이터 검증" 항목으로 남길 것.

- **[INFO]** `sendSurfaceMismatchNotice` 독스트링 및 `SURFACE_MISMATCH_DEFAULTS`(`language-hint-defaults.ts`) 주석이 이번 PR 로 갱신되지 않아 옛 설계(비-escape 전제)를 그대로 서술
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:1037-1045`(특히 1043-1044 줄 "문구는 렌더러 escape 를 거치지 않으므로 default 는 MarkdownV2-safe … SURFACE_MISMATCH_DEFAULTS 참조"), `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts:170-177`("반환값은 raw (호출자가 escape 없이 발송)")
  - 상세: 이 두 파일은 이번 diff 의 19개 파일 목록에 포함되지 않았다. 그런데 실제로는 `sendSurfaceMismatchNotice` 가 호출하는 `sendBestEffortNotice` 가 이제 `adapter.escapeControlText(text)` 를 거친다 — "escape 없이 발송"이라는 주석은 더 이상 사실이 아니다. 현재 `SURFACE_MISMATCH_DEFAULTS` 값 자체에는 punctuation 이 없어 당장 런타임 버그는 아니지만, 이 주석을 SoT 로 믿고 향후 누군가 default 문구에 마침표를 추가하거나(이제는 안전한데 "MarkdownV2-safe 해야 한다"는 낡은 제약을 계속 지키려 함) 반대로 이 설명을 근거로 다른 코드를 판단하면 오판 소지가 있다.
  - 제안: 두 주석을 `escapeControlText` 기반 새 설계에 맞춰 갱신(다른 6개 키의 문서/코드 주석과 동일 패턴으로).

- **[INFO]** `ChatChannelAdapter.escapeControlText` 는 optional 이 아닌 필수 메서드로 추가된 인터페이스 변경 — 실제 구현체는 모두 갱신됐으나 일부 테스트 더블은 미갱신(컴파일은 통과, 기능적 영향 없음)
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:509-522`(신규 `escapeControlText(text: string): string;`, `?` 없음), `codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts:757-766`(`as unknown as ChatChannelAdapter` 캐스트로 `escapeControlText` 미구현 유지)
  - 상세: telegram/slack/discord 3개 실 어댑터 + `channel-adapter.registry.spec.ts` 의 `FakeAdapter` + `hooks.service.spec.ts` 의 mock 은 모두 `escapeControlText` 를 구현/추가해 인터페이스 변경 파급을 정확히 반영했다. 다만 `form-mode.spec.ts` 의 `isNativeFormAdapter` 테스트용 base mock 은 `as unknown as ChatChannelAdapter` unsafe cast 를 쓰기 때문에 TS 컴파일 에러 없이 누락된 상태로 남는다. 현재 그 테스트는 `escapeControlText` 를 호출하지 않는 타입가드(`isNativeFormAdapter`) 검증용이라 즉각적 위험은 없다.
  - 제안: 사소하지만 일관성을 위해 base mock 에도 `escapeControlText: jest.fn((t) => t)` 를 추가 권장 (필수 아님).

- **[INFO]** F-5 (`LanguageHintsRawSendValidator`/`TELEGRAM_RAW_SEND_HINT_KEYS`/`chat-channel/shared/markdown-v2.ts`+spec) 완전 제거 확인 — 등록(POST/PATCH) 시점에 이전에 거부되던 telegram 평문 마침표 override 가 이제 통과함 (의도된 변경)
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (validator·상수·`@Validate` 데코레이터 삭제), `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`(옛 5개 F-5 테스트 삭제 → 신규 1개 "통과" 테스트로 교체)
  - 상세: `grep` 전수 검사 결과 `LanguageHintsRawSendValidator` / `TELEGRAM_RAW_SEND_HINT_KEYS` / `firstUnescapedMarkdownV2Special` / `MARKDOWN_V2_SPECIAL_CHARS` / `UNSAFE_TELEGRAM_MARKDOWN` 참조는 codebase/spec 어디에도 남아있지 않다(주석 1건 제외). frontend 쪽에도 해당 에러 코드에 의존하는 매핑이 없다. `UpdateTriggerDto.chatChannel` 의 nested validation 특성상, 이전에는 다른 필드만 바꾸려 해도 `languageHints` 를 함께 보내면 위반 override 가 재검출돼 PATCH 가 400 으로 막힐 수 있었는데(spec 문서가 명시했던 하위호환 주의점), 이 PR 로 그 차단 자체가 사라졌다 — 즉 "부작용을 없애기 위해 부작용을 없앤" 성격으로, side-effect 관점에서는 위험 감소 방향. F-5 검증에 의존하던 외부 자동화(API 클라이언트가 400 응답을 기대하는 테스트 등)가 있다면 그 기대가 깨지는 정도가 유일한 잔여 영향.
  - 제안: 없음 (의도된 설계와 일치, 근거 확인 완료).

- **[INFO]** `escapeControlText` 는 각 provider 의 `renderNode` 경로가 이미 쓰는 export 함수(`escapeMarkdownV2`, `escapeSlackMrkdwn`)를 그대로 재사용하며, `HooksService` 의 5개 직접 `adapter.sendMessage` 호출부(및 `sendBestEffortNotice` 경유 3곳) 모두 정확히 1회씩만 `escapeControlText` 를 적용한다(이중 escape 없음) — 코드 추적으로 확인
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:357-370`(help), `:897-910`(formValidationFailed), `:915-928`(formNextField), `:1000-1013`(sendBestEffortNotice — executionStillRunning/surfaceMismatch/groupChatRefusal/unsupportedMessageKind 경유), `:696-706`(reNoiseFormModal, `form_modal` kind 라 escape 대상 아님 — 의도대로 제외)
  - 상세: telegram default 의 `\\.`/`\\-` baked-in 리터럴은 관련 6개 키(help/groupChatRefusal/unsupportedMessageKind/formValidationFailed/formNextField/executionStillRunning) 모두 평문으로 정리됐고(grep 으로 잔여 backslash 없음 확인), `surfaceMismatch` default(`language-hint-defaults.ts`)는 애초 punctuation 이 없어 변경 불필요했다. slack/discord 는 이전에 이 literal backslash 를 그대로 사용자에게 노출했던(cross-provider 버그) 것이 이번 fix 로 해소되는 것도 코드상 확인됨(slack=`<>&`-only escape, discord=identity).
  - 제안: 없음 (positive confirmation, 의도한 fix 정확히 구현됨).

## 요약

핵심 3개 관점을 코드로 추적 검증했다. (1) `escapeControlText` 이관은 telegram/slack/discord 발송 문구를 실제로 바꾸며, 이는 CHANGELOG 가 주장하는 cross-provider literal-backslash 버그를 정확히 고치는 방향이고 각 발송 경로에서 정확히 1회만 적용돼 이중 escape 위험이 이 PR 자체의 새 코드 안에는 없다. (2) F-5 등록 시점 검증 제거는 완전하고 깨끗하게 이뤄졌으며(dangling 참조 없음), telegram 평문 마침표 override 를 다시 허용하는 것은 발송 시 자동 escape 로 대체되는 의도된 설계다. (3) telegram-baked `\.` default 의 평문화는 관련 6개 키 전부 일관되게 적용됐다. 다만 **본 PR 파일 목록 밖에 있는 `language-hint-defaults.ts`/`hooks.service.ts` 의 옛 주석이 갱신되지 않아 문서 drift 가 있고, 더 중요하게는 F-5 머지~본 PR 배포 사이에 저장됐을 수 있는 기존 escaped override 데이터에 대해 이중 escape → best-effort swallow 로 인한 "안내 미발송" 회귀 가능성이 코드 레벨 방어 없이 순수 타이밍 가정에만 의존**하고 있다. 이는 크래시나 데이터 손상은 아니지만 프로덕션에서 조용히 재현될 수 있는 side effect이므로 배포 전 실데이터 점검을 권고한다.

## 위험도

MEDIUM
