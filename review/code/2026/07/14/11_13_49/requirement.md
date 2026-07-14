# Requirement Review — EIA 후속 F-4/F-5/F-6

리뷰 payload 는 spec 문서 3건(diff)만 포함하고 있어(`spec/5-system/15-chat-channel.md`,
`spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md`), 대응하는
실제 코드 변경(commit `ce8264f3a` F-4, `ee13e3bf9` F-5, `2eda0da55`/`3ed47bcc6` F-6)을
저장소에서 직접 대조했다. 대상 코드: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts`,
`codebase/backend/src/modules/hooks/hooks.service.ts`,
`codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`,
`codebase/backend/src/modules/websocket/websocket.gateway.ts`,
`codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`resolveWaitingNodeExecutionId`),
`codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` + 관련 `*.spec.ts`.

## 발견사항

- **[WARNING]** F-4 리팩터 후 orphan 된 JSDoc — 주석(의도)이 실제로 문서화하는 대상과 어긋남
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:977-1024`
  - 상세: 원래 `sendExecutionStillRunningNotice` 를 설명하던 JSDoc 블록("CCH-CV-03 (b) — execution 이
    running/pending … executionStillRunning 안내를 발송한다 …")이 리팩터 후에도 그대로 남아, 이제는
    새로 추출된 공용 helper `sendBestEffortNotice` 바로 위(`983-989`)에 붙어 있다. 정작
    `sendExecutionStillRunningNotice` 자체(`1009`)는 아무 docstring 도 갖지 않게 됐다. 두 블록이
    연속으로 붙어 있어 컴파일에는 문제없지만, "CCH-CV-03 (b)" 설명이 마치 `sendBestEffortNotice`
    (범용 helper) 를 설명하는 것처럼 오독될 수 있다.
  - 제안: 첫 번째 블록(977-982)을 `sendExecutionStillRunningNotice` 정의 바로 위(1009줄)로 이동하거나,
    "CCH-CV-03 (b)" 언급을 제거하고 `sendBestEffortNotice` 전용 설명만 남긴다.

- **[WARNING]** spec 본문 자체의 수치 오류 — 같은 diff 안에서 "4개 handler" vs 실제 3개
  - 위치: `spec/5-system/4-execution-engine.md` 표 (§7.5.1 커버리지 표, diff 참조: "WS gateway 4개
    handler 가 `data.nodeId` 를 `expectedNodeId` 로 forward")
  - 상세: 실제로 F-6 이 수정한 WS gateway handler 는 `handleClickButton` / `handleSubmitMessage` /
    `handleEndConversation` 3개뿐이다 (`grep -n "F-6" codebase/backend/src/modules/websocket/websocket.gateway.ts`
    → 3곳). `handleSubmitForm` 은 같은 문장에서 "미제공(예: `execution.submit_form`)이면 skip" 으로
    명시적으로 **제외**되는데, 바로 이어서 "WS gateway 4개 handler" 라고 써서 자기모순이다. 같은 PR 의
    `CHANGELOG.md`("`click_button` 은 … 확장했으나 …, `execution.submit_form` … 는 미적용")과
    `plan/in-progress/eia-command-waiting-surface-guard.md` F-6 항목("WS gateway 4개 handler —
    `handleSubmitMessage`/`handleEndConversation`/`handleClickButton`" — 이름은 3개만 나열)도 3개로 서술한다.
    코드는 정확하다 — spec 서술의 숫자만 틀렸다.
  - 제안: "4개" → "3개" 로 정정 (spec 직접 수정은 `project-planner` 위임 대상).

- **[WARNING]** F-6 이후 갱신되지 않은 내부 JSDoc — 의도(주석) vs 실제 caller 목록 불일치
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5272-5279`
    (`resolveWaitingNodeExecutionId` 의 `@param expectedNodeId` 문서)
  - 상세: 주석이 "외부 EIA `/interact` 진입점만 전달한다" 라고 명시하는데, F-6 이후
    `continueButtonClick`/`continueAiConversation`/`endAiConversation` (WS gateway 경유) 도
    `expectedNodeId` 를 조건부로 전달한다(코드 4815-4882줄). F-1 시점엔 맞는 서술이었으나 F-6 이
    caller 를 늘리면서 이 JSDoc 을 갱신하지 않아 stale 상태다. 기능 결함은 아니지만, 향후 유지보수 시
    "이 값은 REST 에서만 온다" 는 잘못된 전제로 코드를 읽을 위험이 있다.
  - 제안: "외부 EIA `/interact` 및 WS gateway(F-6, 제공 시)가 전달한다" 로 갱신.

- **[INFO]** (본 delta 범위 밖, pre-existing) `languageHints.formValidationFailed` /
  `formNextField` / `unsupportedMessageKind` 키가 `spec/5-system/15-chat-channel.md` §4.1 예시
  JSON(262-279줄)이나 §4.1.1 표에는 등재되지 않고, F-5 로 신규 추가된 raw-send 키 나열 문장에서만
  처음 등장한다. 코드(`hooks.service.ts:363,810,901,917`)에는 이미 이전 커밋부터 존재하는 키들이라
  이번 F-4/F-5/F-6 변경이 만든 문제는 아니지만, F-5 서술이 이 세 키의 유일한 spec 언급이 됐다는 점은
  기록해 둔다. 차단 사유 아님.

## 코드-스펙 일치 확인 (문제 없음, 근거만 기록)

- **F-4**(`makeLocaleResolver` + `sendBestEffortNotice`): 3개 resolver(`resolveFormOpenLabel`/
  `resolveSessionExpiredMessage`/`resolveSurfaceMismatchMessage`)의 override→locale→ko fallback 로직이
  factory 추출 전후 완전히 동일함을 diff 로 확인. `HooksService` 의 3개 발송 호출부
  (`maybeNotifyIgnored`/`sendExecutionStillRunningNotice`/`sendSurfaceMismatchNotice`)가 만드는 warn
  로그 문자열도 리팩터 전후 동일(`hooks.service.spec.ts:979` 의 `'surfaceMismatch 안내 sendMessage 실패'`
  assertion 이 리팩터 후에도 그대로 성립) — "순수 리팩터, 동작 보존" 주장이 코드로 뒷받침됨.
- **F-5**(`LanguageHintsRawSendValidator`): `TELEGRAM_RAW_SEND_HINT_KEYS` 7개가 spec 문구의 7개 키
  (`help`/`groupChatRefusal`/`unsupportedMessageKind`/`executionStillRunning`/`surfaceMismatch`/
  `formValidationFailed`/`formNextField`)와 정확히 일치. `MD_V2_SPECIAL_CHARS` 18자
  (`_*[]()~\`>#+-=|{}.!`)가 spec 나열 및 Telegram Bot API MarkdownV2 예약문자 집합과 일치.
  `provider !== 'telegram'` 조기 스킵, escape-pair 사전 제거 후 검출 로직도 spec 서술과 일치.
  에러 메시지 포맷 `UNSAFE_TELEGRAM_MARKDOWN:<field>:<char>` 도 코드와 동일. `ChatChannelConfigDto` 가
  `create-trigger.dto.ts`/`update-trigger.dto.ts` 양쪽에서 재사용돼 PATCH 경로도 커버.
- **F-6**(WS nodeId 대조): `websocket.gateway.ts` 의 `handleClickButton`(nodeId 선택, 미전달 시
  undefined)·`handleSubmitMessage`/`handleEndConversation`(nodeId 필수 필드, frontend 가 실제로
  싣음 — `use-execution-interaction-commands.ts:245,265`) 이 `expectedNodeId` 로 전달되고,
  `resolveWaitingNodeExecutionId` 가 `expectedNodeId !== undefined && rows[0].nodeId !== expectedNodeId`
  일 때만 `InvalidExecutionStateError`(`code='INVALID_EXECUTION_STATE'`)를 던진다 — spec 의
  "제공되면 대조, 미제공이면 skip" 정책과 정확히 일치. `buildContinuationErrorAck` 가
  `ExecutionError.code` 를 ack `errorCode` 로 그대로 노출해 spec 의 "WS ack `INVALID_EXECUTION_STATE`"
  주장도 코드로 확인. `execution.submit_form`(`handleSubmitForm`)은 nodeId 필드가 없어 미적용 — spec
  서술과 일치. 단위 테스트(`websocket.gateway.spec.ts` F-6 describe 블록 3건)가 세 handler 각각의
  forwarding 을 직접 검증.

## 요약

spec payload 3건(chat-channel/execution-engine/websocket-protocol)과 실제 F-4/F-5/F-6 코드
(`makeLocaleResolver`/`sendBestEffortNotice` 리팩터, telegram raw-send DTO validator, WS gateway
nodeId forwarding)를 line-level 로 대조한 결과, 핵심 동작(검증 대상 키 목록·특수문자 집합·에러 코드·
nodeId 대조 조건·frontend 실제 발신 여부)은 모두 spec 서술과 정확히 일치하고 단위 테스트로 뒷받침된다.
발견된 문제는 전부 기능 결함이 아니라 이번 리팩터/확장 과정에서 갱신을 놓친 주석·spec 서술 수준의
사소한 불일치(orphan JSDoc, "4개"→실제 3개 handler 오기, stale `@param` 주석)로, 실행 동작에는 영향이
없다. TODO/FIXME 류 미완성 마커, 반환값 누락, 엣지 케이스 미처리는 발견되지 않았다.

## 위험도

LOW
