# 문서화(Documentation) Review

## 대상

- `spec/5-system/15-chat-channel.md` — §4.1.1 F-5 (`LanguageHintsRawSendValidator` 등록 시점 검증) 신설
- `spec/5-system/4-execution-engine.md` — §7.5.1 nodeId 검사 진입점별 커버리지 표 F-6 갱신
- `spec/5-system/6-websocket-protocol.md` — §4.2 `execution.click_button`/ack 노트 F-6 갱신

세 파일 모두 spec-only 변경. 대응 코드(`LanguageHintsRawSendValidator` / `chat-channel-config.dto.ts`,
`websocket.gateway.ts` 4개 continuation handler, `execution-engine.service.ts`
`resolveWaitingNodeExecutionId`)를 직접 대조해 spec 서술과 실제 구현 일치 여부, CHANGELOG·plan 갱신
정확성을 검증했다.

## 발견사항

- **[WARNING]** plan 체크리스트 전부 완료됐는데 `plan/in-progress/` 에 잔류 — `complete/` 미이동
  - 위치: `plan/in-progress/eia-command-waiting-surface-guard.md`
  - 상세: 본 plan 의 메인 체크리스트(S-1 spec 동기 포함)와 후속 항목 F-1~F-6 **전부** `[x]` 로
    표시돼 있고(`grep '\[ \]'` 결과 0건), F-5/F-6 은 오늘(2026-07-14) "완료" 로 명시돼 있다.
    `.claude/docs/plan-lifecycle.md §3` 은 "모든 항목이 완료된 순간 `complete/` 로 이동" +
    "이동은 마지막 작업 PR 안에서 — plan 이동만 담은 별 PR 분리 금지" 를 규정한다. 본 review 대상
    diff(F-5 DTO validator + F-6 WS nodeId 대조, 커밋 `ee13e3bf9`/`2eda0da55`/`3ed47bcc6`)가 바로
    그 "마지막 작업" 인데, `chore(plan): mark eia-command-waiting-surface-guard complete` 커밋 +
    `git mv` + `spec_impact` frontmatter 필드 추가가 빠져 있다.
  - 제안: 같은 PR 안에서 `plan/complete/` 로 이동하고 `spec_impact` frontmatter 에 이번에 갱신된
    3개 spec 파일(및 F-1~F-4 가 이미 갱신한 `14-external-interaction-api.md` /
    `4-nodes/6-presentation/0-common.md` / `3-workflow-editor/3-execution.md` /
    `conventions/interaction-type-registry.md`)을 명시.

- **[WARNING]** F-5 가 처음 언급한 3개 `languageHints` 키가 spec 어디에도 독립 정의가 없음
  - 위치: `spec/5-system/15-chat-channel.md` §4.1.1 신설 문단 (`**control-plane raw-send 키의
    등록 시점 검증 (F-5)**`)
  - 상세: 이 문단이 나열하는 raw-send 대상 7개 키 중 `unsupportedMessageKind` /
    `formValidationFailed` / `formNextField` 3개는 `spec/` 전체에서 **이 한 문단에만** 등장한다
    (`grep -rn` 확인 — §4.1 `languageHints` JSON 예제에도, §4.1.1 KO/EN default 표에도 없음).
    코드에서는 실제로 쓰이는 키다(`hooks.service.ts` L810/L901/L917)이고 DTO
    `ApiPropertyOptional` swagger 설명에는 나열돼 있으나, 정작 이 spec 문서(§4.1 예제)와 프런트
    트리거 drawer 도움말(`codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts` 의
    `languageHintsHelp` — `groupChatRefusal / executionStarted / executionCompleted /
    executionStillRunning / help / formOpenLabel / sessionExpired / surfaceMismatch` 만 나열)
    양쪽 다 이 3개 키를 빠뜨렸다. 운영자가 F-5 문단만 읽고 "이 키들도 override 가능하구나" 는 알아도
    무엇을 언제 보내는 안내인지, default 문구가 무엇인지 spec 에서 찾을 방법이 없다. F-5 가 신설한
    문제는 아니지만(pre-existing gap), 이번 변경이 이 3개 키를 처음으로 spec 표면에 노출시킨
    당사자이므로 인벤토리를 완성하고 넘어가는 편이 문서 일관성에 맞다.
  - 제안: §4.1 JSON 예제 또는 §4.1.1 표에 3개 키를 추가(용도·발화 시점·default 문구), 최소한
    트리거 drawer `languageHintsHelp` 문자열에는 백필. 별도 plan/backlog 항목으로 미룰 경우 이
    F-5 문단에 "미문서화 갭 — 별도 백로그" 각주라도 남기는 것을 권장.

- **[INFO]** §7.5.1 커버리지 표의 "WS gateway 4개 handler 가 forward" 서술이 근소하게 과장
  - 위치: `spec/5-system/4-execution-engine.md` §7.5.1, "nodeId 검사 진입점별 커버리지" 표 —
    `WS continuation (execution.*)` 행
  - 상세: 해당 행 두 번째 문장 "WS gateway 4개 handler 가 `data.nodeId` 를 `expectedNodeId` 로
    forward" 는 `execution.submit_form`/`click_button`/`submit_message`/`end_conversation` 4개
    continuation handler 전부가 forward 한다는 인상을 준다. 그러나 `handleSubmitForm`
    (`websocket.gateway.ts` L502-503)의 `@MessageBody() data` 타입은 애초에 `nodeId` 필드가 없고
    `continueExecution(data.executionId, data.formData)` 호출에도 `expectedNodeId` 인자를 넘기지
    않는다 — forward 할 필드 자체가 구조적으로 없다. 실제로 forward 하는 건 `click_button`
    (§L572 `nodeId?`) / `submit_message`(L642) / `end_conversation`(L709) 3개뿐이다. 같은 행의
    바로 앞 문장이 이미 3개 명령으로 정확히 scope 했으므로 혼동 소지는 낮지만, 뒤 문장만 따로
    읽으면 부정확하다.
  - 제안: "WS gateway 4개 handler 가" → "WS gateway 는 (해당 3개 handler 가)" 또는 "click_button
    /submit_message/end_conversation 3개 handler 가" 로 정정.

- **[INFO]** 2차 개요 문서(`3-workflow-editor/3-execution.md` §8.2)가 canonical WS 명령 표와
  더 벌어짐 — 본 PR 범위 밖이나 인접 drift
  - 위치: `spec/3-workflow-editor/3-execution.md` L313-322 (WS 명령 요약 표)
  - 상세: 이 표는 `execution.submit_form` payload 를 "executionId, nodeId, formData" 로,
    `execution.click_button` 을 "executionId, nodeId, buttonId" 로 flat 하게 적는다. 그러나
    canonical `6-websocket-protocol.md` §4.2 에 따르면 `submit_form` 은 애초에 `nodeId` 를 받지
    않고(§L1388: "`nodeId`/`toolCallId` 는 클라이언트 전달 필드가 아니다"), `click_button` 의
    `nodeId` 는 이번 F-6 으로 신설된 **optional** 필드다. `execution.retry_last_turn` 행도
    "executionId, nodeId" 로 적혀 있으나 canonical 문서는 `nodeExecutionId` 를 쓴다고 명시한다.
    이 표는 이번 diff 의 대상이 아니라서(frontmatter 에 `code:`/`pending_plans:` 도 없어 build-time
    가드 대상도 아님) 직접적인 회귀는 아니지만, F-6 으로 canonical 문서가 더 정밀해진 지금 이
    개요 표와의 간극이 한층 벌어졌다.
  - 제안: 비차단이지만 별도 후속으로 이 표를 "상세는 §6-websocket-protocol.md 참조" 로 단순화하거나
    필드를 optional 표기로 정정 — spec 간 정합성 백로그에 등재 권장.

## 정합성 검증 (문제 없음 확인)

- F-5: `spec/5-system/15-chat-channel.md` §4.1.1 이 나열한 7개 raw-send 키·MarkdownV2 특수문자
  집합(`_ * [ ] ( ) ~ \` > # + - = | { } . !`)·에러 메시지 포맷(`UNSAFE_TELEGRAM_MARKDOWN:<field>:
  <char>`)·제외 목록(`formOpenLabel`/`sessionExpired`/CCH-ERR-* 6키) 모두
  `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
  (`TELEGRAM_RAW_SEND_HINT_KEYS`/`MD_V2_SPECIAL_CHARS`/`LanguageHintsRawSendValidator`) 와 정확히
  일치.
- F-6: `spec/5-system/6-websocket-protocol.md` §4.2 의 `execution.click_button` payload
  (`{ executionId, nodeId?, buttonId }`) 및 ack 노트, `spec/5-system/4-execution-engine.md` §7.5.1
  커버리지 표(EIA 적용/chat-channel 면제/WS 조건부 적용/`/continue` 미적용) 모두
  `websocket.gateway.ts` L570-750 의 3개 handler forwarding 과 `execution-engine.service.ts`
  L4702-5347 의 `resolveWaitingNodeExecutionId(executionId, expectedCommand, expectedNodeId?)`
  구현과 일치.
- CHANGELOG: `CHANGELOG.md` "Unreleased — EIA/WS 대기 표면 가드 후속 정리 (F-4/F-5/F-6)" 항목 2·3 이
  두 spec 변경의 동기·범위(제외 키, 3개 handler forwarding, submit_form/`/continue` 미적용)를 정확히
  요약. `plan/in-progress/eia-command-waiting-surface-guard.md` 경로도 정확히 cross-link.
- JSDoc: `LanguageHintsRawSendValidator` 클래스·`TELEGRAM_RAW_SEND_HINT_KEYS` 상수·
  `resolveWaitingNodeExecutionId` 의 `@param expectedNodeId` 모두 spec anchor 를 인라인 cross-link
  로 동반해 SoT 추적이 쉬움 — 새로 추가된 코드 주석 품질은 양호.

## 요약

세 spec 파일의 변경 내용은 대응 코드(DTO validator, WS gateway 3개 handler, 실행 엔진 publisher
lookup)와 정밀히 일치하며 CHANGELOG 요약도 정확하다. 다만 (1) 이번이 사실상 plan
`eia-command-waiting-surface-guard.md` 의 마지막 작업인데도 전체 체크리스트 완료에도 불구하고
`plan/complete/` 로 이동하지 않은 점, (2) F-5 문단이 처음 노출시킨 3개 `languageHints` 키
(`unsupportedMessageKind`/`formValidationFailed`/`formNextField`)가 spec 예제·유저向 도움말 어디에도
정의돼 있지 않은 점이 문서 완결성 관점의 실질적 개선 포인트다. 나머지는 §7.5.1 표의 근소한 과장
서술과, 본 PR 범위 밖의 2차 개요 문서 drift로 비차단 수준이다.

## 위험도

LOW
