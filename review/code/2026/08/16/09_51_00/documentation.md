# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 같은 PR 안에서 "리뷰가 미룬 라운드 수"가 파일마다 다르게 적혀 있고, 그중 하나는 자기 본문의 나열과도 모순된다
  - 위치: `plan/in-progress/eia-terminal-error-sanitize.md:11`("리뷰가 **4라운드** 연속 INFO 로 밀어낸 항목이다") vs 같은 파일 `:13`(`19_27_37`·`20_05_17`·`20_50_49`·`21_14_51`·`21_49_51` — **5개**의 서로 다른 라운드 ID 나열) vs `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts:135`("리뷰가 **5라운드** 연속 INFO 로 미룬 항목인데")
  - 상세: `eia-terminal-error-sanitize.md` 의 섹션 헤더는 "4라운드"라고 선언하지만 바로 다음 줄에서 나열하는 라운드 ID 는 5개(`19_27_37`, `20_05_17`, `20_50_49`, `21_14_51`, `21_49_51`)다 — 헤더가 자기 본문의 증거와 어긋난다. 반면 신규 테스트 docstring(`terminal-error-payload.spec.ts`)은 "5라운드"라고 적어 본문의 나열과는 일치하지만 plan 헤더와는 다르다. 이 저장소는 "실측했다" 주장의 숫자 오류를 반복적으로 지적해 온 이력이 있고(§6.5 취소선·durationMs 호출부 수 등), 이번 것도 같은 클래스의 사소하지만 실재하는 불일치다. 두 파일이 같은 사실(리뷰가 몇 라운드 동안 이 항목을 미뤘는가)을 서로 다른 숫자로 영구 기록에 남기면, 다음 사람이 어느 쪽을 인용해야 할지 헷갈리고 재조사 비용이 생긴다.
  - 제안: `plan/in-progress/eia-terminal-error-sanitize.md:11` 의 헤더를 "5라운드"로 정정(본문 나열이 5개이므로)하거나, 나열에서 실제로 4개만 세는 근거(예: 두 항목이 같은 실질 지적이라 묶어 센다)를 명시. 두 파일이 같은 숫자를 쓰도록 통일.

- **[WARNING]** `toTerminalErrorPayload` 의 마스킹이 외부 제3자뿐 아니라 **내부 신뢰 채널(워크플로우 에디터 WS)**에도 적용된다는 사실이 plan/docstring 어디에도 명시되지 않았다 — 같은 리뷰 라운드가 이미 이 질문을 던졌는데 답이 기록에 없다
  - 위치: `plan/in-progress/eia-terminal-error-sanitize.md` "조치"/"범위 밖" 섹션(문서 하단부, 체크리스트 항목들) — 이 우려에 대한 언급이 없음. `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts:131-133`("이 payload 는 WS 뿐 아니라 SSE 스트림과 EIA outbound webhook 으로 **외부 제3자**에게 나간다")도 "외부 제3자"만 프레이밍하고 내부 소비자는 언급하지 않는다.
  - 상세: `toTerminalErrorPayload` 는 `ExecutionEventEmitter.emitTerminalExecution` → `WebsocketService.emitExecutionEvent` 라는 **단일 WS 채널**(`execution:<id>`)에 실려, 이 채널을 SSE 어댑터·외부 webhook fanout 이 그대로 미러링한다(실측 확인: `execution-event-emitter.service.ts` `emitTerminalExecution`). 즉 같은 마스킹된 payload 가 **워크플로우 에디터(워크스페이스 소유자, 신뢰 채널)의 WS 구독**에도 그대로 간다. 그런데 `spec/3-workflow-editor/3-execution.md §3.5` 는 이 에디터가 `Error: <message>` 배너를 그대로 노출한다고 규정하고, 이 PR 이 시작된 근거인 `review/consistency/2026/08/16/09_25_29/rationale_continuity.md:22`(WARNING)는 정확히 이 질문("내부 워크플로우 에디터의 `Error: <message>` 표시가 마스킹된 값을 받아도 되는지, 특히 워크스페이스 소유자가 자기 크레덴셜 문제를 디버깅할 때")을 명시적으로 제기했다. 같은 spec 의 `## Rationale` R17("`execution.ai_message` 라이브 이벤트" 항목)은 유사한 상황(내부 WS 도 함께 마스킹됨)을 이미 **"수용된 trade-off"**로 명문화한 선례가 있는데, 이번 PR 은 그 선례를 인용하지도, 반대로 "이건 다르다"고 구분하지도 않은 채 조용히 넘어갔다. plan 의 체크리스트는 "`--impl-prep`(`09_25_29`) BLOCK: NO — WARNING 2건이 접근을 바꿨다"라고 적어 이 라운드의 지적을 반영했다고 주장하지만, 실제로 반영된 것은 "egress-only 위치 선택"(R17 정렬) 뿐이고 이 내부-가시성 질문에는 답하지 않았다.
  - 제안: plan 또는 `redactTerminalError` 의 JSDoc(`codebase/backend/src/shared/utils/terminal-error-payload.ts`)에 한 줄 추가 — "이 마스킹은 단일 WS 채널을 외부 SSE/webhook 이 미러링하는 구조라 워크플로우 에디터(내부 신뢰 채널)에도 동일하게 적용된다. R17 의 `execution.ai_message` 사례와 같은 수용된 trade-off로 본다"(또는 반대로 별도 후속 필요 판단이면 그렇게 명시). 지금처럼 미결로 두면 다음 사람이 같은 조사를 반복해야 한다.

- **[INFO]** `terminal-error-payload.ts` 안에서 같은 함수의 호출부 수를 인접한 두 docstring 이 다른 숫자(4곳 vs 5곳)로 인용해 스코프를 명시하지 않으면 오독 소지가 있다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:8`("현재 호출부는 `EXECUTION_FAILED` **4곳**뿐이다" — 이번 diff 밖의 기존 문장) vs `:68`("이 함수가 자리로 옳은 이유는 **호출부 5곳**이 전부 emit 쪽이라는 것이다" — 이번 diff 로 신규 추가)
  - 상세: 실측(grep)하면 `toTerminalErrorPayload` 호출부는 정확히 5곳(`execution-engine.service.ts:668,3400,5030`·`retry-turn.service.ts:1001`·`chat-channel.dispatcher.ts:551`)이고, 그중 4곳이 `Execution.error` 로부터 직접 payload 를 조립하는 지점, 1곳(`chat-channel.dispatcher.ts:551`)은 이미 조립된 payload/레거시 문자열을 재정규화하는 소비 지점이다. 즉 "4곳"과 "5곳"이 서로 다른 스코프(직접 조립 vs 전체 호출)를 가리켜 실제로는 모순이 아니지만, 같은 파일의 인접한 두 JSDoc 이 스코프 구분 없이 다른 숫자를 나란히 적어 두면 다음 리더가 "누락 아닌가" 하고 재검증해야 한다.
  - 제안: `:68` 의 "5곳" 옆에 괄호로 "(직접 조립 4 + `chat-channel.dispatcher` 재정규화 1)" 정도의 한 구절을 추가해 `:8`의 "4곳"과의 관계를 명시.

- **[INFO]** 외부에 나가는 종결 payload 의 바이트 내용이 바뀌는 변경인데 `CHANGELOG.md` 에 항목이 없다
  - 위치: 저장소 루트 `CHANGELOG.md` (이번 diff 에 포함되지 않음)
  - 상세: `CHANGELOG.md` 의 `## Unreleased` 섹션은 이 저장소의 확립된 관행으로, 특히 "저장소 밖에도 도달한다 — 이 이벤트는 EIA outbound webhook 과 SSE 스트림으로 외부 제3자 통합사에게 같은 payload 로 전달된다"류의 **wire 변화 + 수신자 영향**을 매 PR 마다 적어 왔다(예: 종결 emit 타입 초크포인트 항목, `duration_ms` 오염 항목). 이번 PR 도 `error.message`/`error.details` 가 WS/SSE/webhook 으로 나갈 때 **이전엔 raw 텍스트였던 것이 이제 `***` 로 마스킹**되는 실질적인 바이트 변화이고, 외부 통합사가 (의도치 않게) 파싱하던 원문 문자열이 있었다면 그 값이 바뀐다. 다른 항목들의 관행에 비추면 이 정도 규모의 egress payload 변경도 한 줄 고지 대상이다(다만 이 변경은 보안 하드닝 방향이라 리스크 자체는 낮다).
  - 제안: `CHANGELOG.md` 에 "종결 이벤트 `error.message`/`error.details` 가 이제 secret 패턴(Bearer 토큰·연결 문자열 등)을 마스킹해 나간다. 원문을 그대로 기대하던 외부 파서가 있다면 영향받을 수 있다" 정도의 짧은 `## Unreleased` 항목 추가.

## 요약

핵심 로직 변경(`redactTerminalError` 도입, egress 초크포인트 배치)에 대한 JSDoc 자체는 이례적으로 상세하고 정확하다 — 실측 검증한 호출부 개수(`sanitizeErrorMessage` 3곳, `toTerminalErrorPayload` 5곳)·`sanitize-error-message.ts` 의 import 0줄 주장·REST `getStatus` 가 `Execution.error` 가 아니라 `stripAndRedact(execution.outputData)` 를 쓴다는 주장 모두 코드 대조 결과 정확했고, 자매 트래커(`spec-sync-external-interaction-api-gaps.md`) 와의 상호 참조도 앞선 consistency 라운드의 지적대로 채워졌다. 다만 (1) 같은 PR 안에서 "리뷰가 미룬 라운드 수"를 파일마다 다르게(4 vs 5) 적었고 그중 하나는 자기 본문 나열과도 모순되며, (2) 앞선 `09_25_29` rationale_continuity 라운드가 명시적으로 제기한 "내부 워크플로우 에디터도 마스킹된 값을 받는데 괜찮은가"라는 질문에 대한 답이 plan/JSDoc 어디에도 남지 않은 채 체크리스트만 "WARNING 2건 반영"이라 주장하고, (3) 외부로 나가는 payload 의 실제 바이트가 바뀌는데도 이 저장소의 CHANGELOG 관행을 따르지 않았다. 셋 다 코드 정확성 문제가 아니라 "기록이 남아야 할 결정이 안 남았다/서로 다르게 남았다"는 문서화 완결성 문제다.

## 위험도
LOW
