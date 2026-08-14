# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 검토 범위 메모

본 diff(origin/main...HEAD)는 `codebase/backend/src/modules/websocket/websocket.service.ts` 의 보안
버그 수정(`stripExternalOnlyFields` 를 depth-1 shallow delete → 필드명 기반 depth-무관 재귀 strip 으로
교체, `__proto__` 오염 방어, 지연 할당, 깊이 상한 재사용)과 그 테스트, plan/review 산출물만 포함하며
**`spec/5-system/**` 의 `.md` 파일은 이번 diff 에서 변경되지 않았다** (`git diff origin/main...HEAD --stat`
확인). 따라서 본 검토는 (a) 코드가 가리키는 기존 spec 텍스트가 정식 규약(`spec/conventions/**`)과
여전히 부합하는지, (b) 코드 수정이 고친 실제 결함(‘외부 fanout 로 raw LLM payload 누출’)이 spec 문서
에 완전히 반영되어 있는지를 중심으로 확인했다. `spec/5-system/2-api-convention.md` ·
`6-websocket-protocol.md` 는 프롬프트에 전문 번들, `14-external-interaction-api.md` 는 컨텍스트 예산
초과로 번들 생략되어 워크트리 절대경로로 직접 Read 했다.

## 발견사항

- **[WARNING]** `llmCalls` strip-only 결정의 SoT 범위가 실제 결함 발생 지점(`waiting_for_input`)을
  덮지 않는다
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.4 Rationale
    `### \`ai_message.llmCalls[]\` 외부 수신자 strip (strip-only 결정)` (관련: 같은 문서 §4.4
    `nodeOutput.meta.turnDebug` 행) · `spec/5-system/14-external-interaction-api.md` §6.2
    (`execution.waiting_for_input` 페이로드) 및 §6.5 (`execution.ai_message` strip 언급)
  - 위반 규약: `spec/conventions/**` 에 이 정확한 항목을 다루는 전용 규약 파일은 없으나,
    `spec/5-system/14-external-interaction-api.md` §6 도입부 자신이 선언한 SoT 원칙("같은 필드를
    여러 문서에 나열하면 그 각각이 두 번째 SoT 가 되고, 실제로 그렇게 됐다") 및
    `spec/conventions/conversation-thread.md` §8.1/§9.3 이 이미 `llmCalls` 를 "raw debug payload,
    WebSocket §4.4 가 못박은 필드"로 반복 인용하는 **필드-단위 단일 계약**을 전제로 한다 — 그 계약이
    실제로는 이벤트별로 분절돼 있다.
  - 상세: 지금 diff 가 고친 결함은 `execution.waiting_for_input` 이 `nodeOutput.meta.turnDebug[].llmCalls[]`
    (`ai-conversation-helpers.ts`, 턴 누적 전체)와 `turnDebug.llmCalls.llmCalls[]`
    (`ai-turn-orchestrator.service.ts` turn1 스냅샷) 두 경로로 raw LLM payload 를 중첩 실어, 종전
    depth-1 strip 이 이를 통과시켜 SSE(`iext_*`/`itk_*` 토큰)·webhook·chat-channel 외부 수신자에게
    새고 있었다는 것이다(코드 신규 JSDoc 이 "테스트로 실증"이라고 명시). 그런데 코드가 가리키는 SoT
    체인은 이번에도 여전히 `waiting_for_input` 을 비켜간다:
    - WS §4.4 의 전용 Rationale 은 제목·본문 모두 `ai_message.llmCalls[]` 로 스코프가 좁혀져 있고,
      `waiting_for_input` 의 `nodeOutput.meta.turnDebug[].llmCalls` 는 언급하지 않는다. 같은 문서
      §4.4 필드 표의 `nodeOutput.meta.turnDebug` 행은 "`llmCalls` 는 debug 탭 전용"이라고만 적을 뿐
      "외부 fanout 에서 strip 된다"는 말이 없다.
    - EIA 쪽 SoT 인 §6.5(`execution.ai_message`) 역시 `ai_message` 한정으로만 strip 을 명시한다.
      `execution.waiting_for_input` 의 §6.2 페이로드 절(실제 누출 지점)에는 `llmCalls`/strip 언급이
      **전혀 없다** — `context.conversationConfig` 를 "[Spec WS §4.4] conversationConfig 와 동일
      shape" 라고만 적어, 그 shape 안에 있는 `nodeOutput.meta.turnDebug[].llmCalls` 가 외부에 나가지
      않는다는 사실을 이 절만 읽어서는 알 수 없다.
    - `nodeOutput.meta.turnDebug[].llmCalls` 가 "editor-only / external-only-strip" 이라는 인지 자체는
      존재한다 — 단 `14-external-interaction-api.md` §R17(줄 1344, 1349, 2026-06-25) 의 곁가지
      문장("에디터는 external-only strip 되지 않는 `llmCalls` 디버그로 원문을 확인할 수 있다",
      "에디터 전용 `turnDebug.llmCalls` 는 건드리지 않음")과 `conversation-thread.md` §8.1/§9.3(UI
      Preview 노출 금지 맥락)에만 있고, 어느 쪽도 §4.4 Rationale 이나 EIA §6.2/§6.5 에서 상호 참조되지
      않는다. 코드의 SoT 주석("SoT: WS §4.4 strip-only 결정 (+ EIA §6.5, chat-channel CCH-MP-01)")을
      그대로 따라가는 독자는 이 R17 문장에 도달하지 못한다.
    - 즉 "strip-only 결정"이라는 **하나의 계약**이 필드가 등장하는 위치별로 서로 다른 문서에
      비대칭적으로 흩어져 있고, 정작 이번에 새로 새던 위치(`waiting_for_input`)를 다루는 절(§6.2)은
      침묵한다 — 이번 보안 결함의 근본 원인(코드가 위치를 낱낱이 열거하다 하나를 놓침)과 **같은 모양의
      결함이 문서 계층에도 그대로 남아 있다.**
  - 제안: WS §4.4 Rationale 을 "`ai_message.llmCalls[]` 외부 수신자 strip"에서 "`llmCalls` 필드 외부
    수신자 strip(위치 무관)" 수준으로 넓혀, `execution.waiting_for_input` 의
    `nodeOutput.meta.turnDebug[].llmCalls` 도 동일 strip 대상임을 명문화하고 depth-무관(재귀) strip
    이라는 구현 사실도 함께 적는다. EIA §6.2 페이로드 절에도 §6.5 와 동형의 한 줄
    ("`context.conversationConfig`/`nodeOutput.meta.turnDebug[].llmCalls` 도 fanout seam 에서 strip
    되어 외부 수신자에 전달되지 않는다")을 추가하고 R17 의 해당 문장에서 그 절로 역참조를 건다. 코드
    JSDoc 의 SoT 목록에도 EIA §6.2(또는 R17)를 추가해 앞으로 필드 위치가 늘어나도 SoT 체인이 실제
    누출 지점을 덮도록 한다.

## 요약

diff 자체는 `spec/5-system/**` 문서를 건드리지 않는 순수 백엔드 보안 수정(strip 을 depth-무관 재귀로
전환 + `__proto__` 오염 방어)이라 이 diff 가 새로 만들어낸 명명·출력 포맷·API 문서·금지 패턴 위반은
확인되지 않았다. 다만 코드가 고친 실제 결함(waiting_for_input 의 중첩 `llmCalls` 가 depth-1 strip 을
통과해 외부로 샜던 것)과 정확히 같은 모양의 문제가 spec 문서 계층에도 남아 있다 — "strip-only 결정"의
SoT 가 `execution.ai_message` 로만 좁게 명문화돼 있고, 실제 누출 지점이었던
`execution.waiting_for_input`(EIA §6.2)에는 이 계약이 전혀 언급되지 않는다. 지금은 코드가 필드 이름
기반으로 위치 무관하게 방어하므로 즉시 위험하지는 않지만, 향후 누군가 spec 텍스트만 보고 strip 로직을
`ai_message` 전용으로 재구현하면 동일 결함이 재발할 수 있는 문서 갭이다. 그 외 검토한 명명 규약
(`UPPER_SNAKE_CASE` 에러 코드), 출력 포맷 규약(§5 응답 wrapping·§5.4 부재 표현), 문서 구조 규약
(Overview/본문/Rationale, `_product-overview.md`), API 문서 규약(swagger.md §1-4/§1-5), 금지 패턴
(redis-keys.md, error-codes.md)은 모두 정합했다.

## 위험도

LOW
