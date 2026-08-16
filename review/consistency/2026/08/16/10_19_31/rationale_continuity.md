# Rationale 연속성 검토 — spec/5-system/ (--impl-done)

## 컨텍스트

diff-base `origin/main` 대비 실제 변경은 `spec/**` 에는 없고(`git diff origin/main -- spec/` 공집합),
코드(`codebase/backend/src/shared/utils/terminal-error-payload.ts` ·
`codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` + spec 테스트)와
`plan/in-progress/eia-terminal-error-sanitize.md` / `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
에 있다. 대상 결정: `execution.failed`/`execution.cancelled`(시스템)/chat-channel fanout 이 싣는
`error.message`/`error.details` 를 **egress 초크포인트(`toTerminalErrorPayload`)**에서
`deepRedactSecrets` 로 마스킹하도록 신설.

이 작업은 직전 라운드(`09_25_29`)의 rationale-continuity WARNING — "당초 계획이 `Execution.error` 를
**DB write 시점**에 새니타이즈하려 했는데, 이는 `14-external-interaction-api.md` R17 의
'egress-only masking, DB 는 원본 보존' 원칙과 R17 을 인용하지 않은 채 반대 방향으로 갈라진다" — 을
받아 **egress 시점(emit 직전)으로 설계를 전환**한 결과물이다. plan(`eia-terminal-error-sanitize.md`
"어디서 새니타이즈할 것인가" 절)이 R17 을 명시적으로 인용하고, "왜 write-time 안이 틀렸는가" 를
새 근거와 함께 적어 두었다 — 이 저장소가 요구하는 "결정을 뒤집을 땐 새 Rationale 을 함께 쓴다"
패턴을 정확히 따른다. 실제로 반영된 코드도 DB write 경로(`execution-engine.service.ts`
`retry-turn.service.ts` 의 raw 값 대입)를 건드리지 않고 5개 emit 호출부에서만 마스킹을 적용해
R17 의 "내부 소비처(DB 원본)는 faithful 유지" 원칙을 그대로 지킨다(직접 확인: `toTerminalErrorPayload`
호출부는 `execution-engine.service.ts` x3 · `retry-turn.service.ts` x1 · `chat-channel.dispatcher.ts`
x1 로 전부 emit 쪽, DB write 0).

또한 직전 라운드가 미결로 남겼던 "내부 신뢰 채널(워크플로우 에디터)이 마스킹된 값을 받아도 되는가"
질문도 `09_51_00` 코드리뷰 W3 에서 실측 답변이 채워졌다 — 에디터는 이 payload 의 `error.message` 를
렌더링하지 않고(REST `NodeExecution`/`Execution` 에서 별도로 읽음) webhook 구독 화이트리스트
라벨 용도로만 소비하므로 내부 표면 회귀가 없다는 근거가 plan/RESOLUTION 양쪽에 기록돼 있다.

## 발견사항

- **[INFO]** R17 "표면 제약(보안)" 열거·§6.4 note 가 신규 마스킹 대상(`error.message`/`error.details`)을 아직 반영하지 않음
  - target 위치: (코드) `codebase/backend/src/shared/utils/terminal-error-payload.ts` 의 `redactTerminalError` — spec 본문은 이번 diff 에서 미변경
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` `## Rationale` → **R17** "표면 제약(보안)" 문단(1414~1457행)의 열거형 불릿(`conversationThread` (강제됨) · `execution.ai_message` 라이브 이벤트 (강제됨) · `nodeOutput.conversationConfig` + terminal `result`/`error` (강제됨 — bypass 차단)); 및 `§6.4` payload 절(770~806행)의 "2026-08-14 emit 4곳 일원화" 유형 note 선례
  - 상세: R17 은 "egress 에서만 마스킹, DB 는 원본 보존" 원칙을 세우면서 그 적용 대상을 구체적 필드 3종(`conversationThread`, `ai_message` 텍스트, `nodeOutput.conversationConfig`+`getStatus` 의 terminal `result`/`error`)으로 **열거**해 두었다. 이번 PR 이 신설한 마스킹(`execution.failed`/`chat-channel` wire 의 `error.message`/`error.details`)은 아키텍처상 완전히 같은 "egress-only, 값-패턴 secret 마스킹" 계열의 **네 번째 인스턴스**이지만, R17 불릿 리스트에도 §6.4 payload note 에도 등재되지 않았다. 선례상 §6.4 는 `toTerminalErrorPayload` 의 이전 행동 변화(2026-08-14, 문자열→object 일원화)를 note 로 즉시 반영했었다. `plan/in-progress/eia-terminal-error-sanitize.md` 는 `spec_impact: none` 으로 판단했는데, 근거("§6.4 는 필드 **형태**만 규정하고 새니타이즈 여부를 약속하지 않는다")는 형태 불변 관점에서는 타당하지만, R17 의 열거가 사실상 "이 spec 파일 안에서 어떤 필드가 egress 마스킹되는지"의 **정본 인벤토리** 역할을 해 왔다는 점에서 이번 변경 이후 그 인벤토리가 실제 구현보다 좁아졌다(문서 완결성 gap). 코드 주석(`sanitize-error-message.ts`, `terminal-error-payload.ts`)과 CHANGELOG·plan 에는 R17 을 이미 명시적으로 인용해 뒀으므로 실질적인 원칙 위반이나 근거 누락은 아니며, spec 문서 자체의 열거만 뒤처져 있는 상태다.
  - 제안: `spec/5-system/14-external-interaction-api.md` R17 "표면 제약(보안)" 불릿 리스트에 `execution.failed`/시스템 `execution.cancelled`/chat-channel 종결 `error.message`·`error.details` (`toTerminalErrorPayload` 의 `redactTerminalError`, egress 초크포인트, `SECRET_LEAK_PATTERNS` 기반 — 자격증명 없는 연결 문자열·호스트명은 잔여 갭이라 미커버) 항목을 한 줄 추가하거나, 최소한 §6.4 note 에 "2026-08-16, 값-패턴 secret 마스킹 추가(형태 불변)"를 덧붙여 R17 인벤토리와 구현을 재동기화할 것을 권고한다. spec 변경 자체가 필수는 아니지만(형태 계약은 실제로 불변), 다음 checker/리뷰어가 R17 을 계보 추적할 때 이 인스턴스를 놓치지 않도록 하는 정합 보완이다.

## 요약

이번 구현은 직전 라운드에서 정확히 지적된 write-time/egress-only 원칙 저촉을 근거와 함께 뒤집어
egress 초크포인트로 재설계했고, DB 원본 보존·내부 신뢰 채널 무영향까지 실측으로 닫아 R17 의
"egress-only masking, DB 는 faithful 유지" 원칙을 충실히 따른다. 코드 주석·CHANGELOG·plan 전반에
R17 을 명시적으로 인용하는 등 과거 Rationale 과의 연속성을 능동적으로 관리한 흔적이 뚜렷하다.
유일한 잔여 사항은 spec 문서(R17 불릿·§6.4 note) 자체가 이 신규 마스킹 인스턴스를 아직 열거하지
않아 문서 인벤토리가 구현보다 한 걸음 뒤처진 것으로, CRITICAL/WARNING 급 저촉은 발견되지 않았다.

## 위험도
LOW
