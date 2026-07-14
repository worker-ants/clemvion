# 문서화(Documentation) 리뷰 결과

대상: EIA/WS 대기 표면 가드 후속 정리 (F-4/F-5/F-6) diff — 9개 파일
집중 점검: spec §7.5.1 "3개 handler" 정정, spec §4.1.1 F-5 PATCH 스코프·shared SoT 갱신의 정확성.

## 발견사항

- **[WARNING]** `markdown-v2.ts` JSDoc이 "양쪽이 import 한다"고 주장하지만 실제로는 한쪽만 import — 렌더러는 여전히 독립 리터럴을 유지
  - 위치: `codebase/backend/src/modules/chat-channel/shared/markdown-v2.ts:1-15` (모듈 JSDoc), 대비 `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts:27-30`
  - 상세: 신규 모듈 JSDoc은 "이 집합은 두 곳에서 필요하다 — `escapeMarkdownV2`(렌더러) / `LanguageHintsRawSendValidator`(DTO)... **여기 단일 정의하고 양쪽이 import 한다**"라고 명시한다. 그러나 실제 코드를 확인하면 `chat-channel-config.dto.ts` 만 `firstUnescapedMarkdownV2Special`/`MARKDOWN_V2_SPECIAL_CHARS` 를 import 하고, `telegram-message.renderer.ts` 는 여전히 자체 리터럴 `const MD_V2_ESCAPE_REGEX = /([_*[\]()~\`>#+\-=|{}.!])/g;` 를 독립적으로 유지한다(import 없음, `grep ^import` 로 확인). 바로 다음 문장 "렌더러의 escape 정규식이 본 집합과 일치함은 `markdown-v2.spec.ts` 의 계약 테스트가 강제한다"가 사실은 정확한 서술인데, 이는 역으로 "import 로 단일화되지 않고 테스트로만 동등성을 보증하는 guarded duplication" 구조임을 스스로 증명한다 — 앞 문장의 "양쪽이 import 한다" 는 과장/오기다. 이 모듈 자체가 "F-5 ai-review architecture WARNING"(중복 리터럴 지적)에 대한 후속 조치로 만들어졌는데, 정작 절반만 해소(DTO만 단일화, 렌더러는 잔존 중복)한 상태를 문서가 "완전 해소"인 것처럼 서술해 향후 독자를 오도할 수 있다(예: `MARKDOWN_V2_SPECIAL_CHARS` 를 바꿨을 때 렌더러가 "자동으로" 함께 바뀐다고 오인 → 실제로는 렌더러 쪽 별도 수정 + 테스트 재실행 전까지 drift 가능).
  - 제안: JSDoc 문구를 실제 구조에 맞게 정정. 예: "여기 단일 정의하고 DTO 검증기(`LanguageHintsRawSendValidator`)가 import 한다. 렌더러(`escapeMarkdownV2`)는 자체 regex 를 유지하며, 두 정의의 동등성은 `markdown-v2.spec.ts` 의 계약 테스트가 강제한다(런타임 import 공유가 아닌 테스트 가드)." 또는 근본적으로 렌더러도 `MARKDOWN_V2_SPECIAL_CHARS` 를 import해 정규식을 구성하도록 코드를 바꿔 문서 주장을 사실화하는 편이 더 견고하다(코드 리뷰어 영역이지만 문서 정확성과 직결).

- **[INFO]** plan 문서가 이번 spec 정정("4개"→"3개")과 동기화되지 않음
  - 위치: `plan/in-progress/eia-command-waiting-surface-guard.md:131`
  - 상세: F-6 섹션 체크리스트가 "WS gateway **4개** handler — `handleSubmitMessage`/`handleEndConversation`/`handleClickButton` 이 `data.nodeId` 를 continue* 의 `expectedNodeId` 로 forward" 라고 적혀 있는데, 정작 나열된 handler 이름은 3개뿐이다. 이는 이번 diff 가 `spec/5-system/4-execution-engine.md` §7.5.1 에서 정확히 고친 것과 동일한 계수 오류(4→3)이며, 같은 작업(F-6)을 추적하는 plan 레코드에는 아직 반영되지 않았다. 코드/spec 정정은 정확하지만, 작업 이력 SoT 인 plan 파일에 미러링된 오기가 남아 향후 이 plan 문서를 근거로 재작업하거나 회고할 때 혼선을 줄 수 있다.
  - 제안: 같은 PR 혹은 후속 커밋에서 plan 파일의 "4개" → "3개" 로 동기화 정정(사소하지만 plan lifecycle 문서 정합성 차원에서 권장).

- **[INFO]** `markdown-v2.ts` 신규 추출(SoT 통합) 자체가 CHANGELOG 에는 명시적으로 기록되지 않음
  - 위치: `CHANGELOG.md` "Unreleased — EIA/WS 대기 표면 가드 후속 정리 (F-4/F-5/F-6)" 항목 2번(F-5)
  - 상세: CHANGELOG 의 F-5 항목은 `LanguageHintsRawSendValidator` 도입만 서술하고, 이번 diff 로 새로 만들어진 `chat-channel/shared/markdown-v2.ts` (SoT 모듈로의 로직 추출)에 대한 언급은 없다. 동작 자체는 보존(behavior-preserving refactor)이라 필수는 아니지만, 이 모듈이 향후 "MarkdownV2 특수문자 판정 로직을 어디서 찾아야 하는가"의 단일 참조점이 되므로 한 줄 추가해두면 추적성이 좋아진다.
  - 제안: F-5 항목 말미에 "(후속) MarkdownV2 특수문자 판정 로직을 `chat-channel/shared/markdown-v2.ts` 로 추출해 DTO 검증기와의 공유 SoT 로 정리" 정도의 짧은 보강. 선택 사항, 차단 아님.

## 검증 완료 사항 (정확함 — 참고용)

- **spec §7.5.1 "3개 handler" 정정** (`spec/5-system/4-execution-engine.md:1056`): `codebase/backend/src/modules/websocket/websocket.gateway.ts` 실제 handler 구현(`handleSubmitForm`/`handleClickButton`/`handleSubmitMessage`/`handleEndConversation`)을 직접 대조 확인 — `nodeId` 를 `expectedNodeId` 로 forward 하는 것은 `click_button`/`submit_message`/`end_conversation` 3개뿐이고 `submit_form` 은 애초에 `nodeId` 필드가 없다. "4개"→"3개" 정정은 사실과 일치. 같은 문서 §7.5.1 하단(`:1067`)에 남아있는 별개의 "WS gateway 4개 handler"(모든 continuation handler 가 `resolveWaitingNodeExecutionId` 를 거쳐 동기 ack 를 표면한다는 다른 주장, §7.5.2 의 "4종 continuation 핸들러" 서술과도 일치)와 개념이 달라 내부 모순이 아니다 — 오히려 이번 정정이 "nodeId forward 대상 3개"와 "resolveWaitingNodeExecutionId 사용 4개" 두 다른 집합을 정확히 구분해낸 것으로 평가된다.
- **spec §4.1.1 F-5 PATCH 스코프 갱신** (`spec/5-system/15-chat-channel.md:3399-3400`): `UpdateTriggerDto.chatChannel` 이 `@IsOptional() @ValidateNested()` + "부분 갱신 — 전체 객체 다시 send" 주석(`codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:98-104`)임을 직접 확인 — nested DTO 를 payload 에 포함하면 그 안의 `languageHints` 도 함께 재검증된다는 신규 서술과 정확히 부합. "다른 필드만 바꾸려 해도 languageHints 를 함께 보내면 과거 위반 override 가 재검출돼 400" 이라는 하위호환 주의점은 실제 class-validator 동작(필드 부재 시에만 `@IsOptional` 이 skip)과 일치하는 타당한 설명.
- **shared SoT 참조 갱신**: `LanguageHintsRawSendValidator` 구현이 실제로 `chat-channel/shared/markdown-v2.ts` 의 `firstUnescapedMarkdownV2Special` 를 import 해 사용하며(`chat-channel-config.dto.ts:2927,2958`), DTO 내부의 옛 리터럴 `MD_V2_SPECIAL_CHARS`/`firstUnescapedMdV2Special` 는 완전히 제거됐다(전체 repo grep 결과 잔존 참조 없음). spec 서술("MarkdownV2 특수문자 판별은 ... 을 공유 SoT 로 쓴다")은 DTO 측만 언급하고 있어 정확하다(렌더러까지 포함한다고 주장하지 않음 — 위 WARNING 은 코드 JSDoc 쪽의 과장이지 spec 문서 쪽 문제는 아님).
- `hooks.service.ts` 의 JSDoc 재배치(F-4 관련 comment 를 `sendBestEffortNotice` 위에서 `sendExecutionStillRunningNotice` 위로 이동 + "`maybeNotifyIgnored` 와 동일한 kind:'text' 경로" 문구 제거)는 실제 함수 배치·역할과 재정합되는 정확한 주석 정정.
- 테스트 파일 3종(F-5/F-6/F-4 회귀 가드)의 인라인 주석은 "왜 이 테스트가 필요한가"(regex 우회 회귀, 인자 순서 오연결, kind:'text' 경로)를 명확히 서술해 품질이 좋다.
- CHANGELOG 는 F-4/F-5/F-6 전체를 이미 상세히 기록 중이며, "3개 handler" 관련 서술도 CHANGELOG 자체 내에서는 처음부터 정확했다(click_button 은 실질 no-op 등 상세 명시) — 이번 spec 정정이 CHANGELOG 와 새로 정합하게 된 것으로 판단.

## 요약

이번 diff 의 핵심 문서 변경 — spec §7.5.1 "WS gateway 4개 handler" → "이 3개 handler" 정정과 §4.1.1 F-5 PATCH 스코프·shared SoT 문단 추가 — 는 실제 코드(websocket.gateway.ts, update-trigger.dto.ts, chat-channel-config.dto.ts)를 직접 대조 검증한 결과 모두 정확하며, 기존 CHANGELOG·§6-websocket-protocol.md 와도 정합한다. 다만 신규 추출된 `markdown-v2.ts` 모듈의 JSDoc 이 "렌더러도 shared SoT 를 import 한다"고 실제와 다르게 서술하는 점(WARNING)과, 동일한 "4→3" 계수 오류가 `plan/in-progress/eia-command-waiting-surface-guard.md` 에는 아직 남아있는 점(INFO)이 사소한 잔여 정합성 갭으로 발견됐다. 두 건 모두 동작에 영향은 없고 차단 사유는 아니다.

## 위험도

LOW
