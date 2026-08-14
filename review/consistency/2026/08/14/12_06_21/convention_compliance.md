# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 검토 범위 메모

`git diff origin/main...HEAD --stat -- spec/5-system/ spec/conventions/` 는 빈 출력이다 —
이번 diff(`origin/main...HEAD`)는 `codebase/backend/src/modules/websocket/websocket.service.ts` 의
`stripExternalOnlyFields`/`stripDeep` 보안 하드닝(깊이-무관 재귀 strip, `__proto__` 오염 방어를 위한
`Object.defineProperty` 대입, lazy clone-on-write, 형제 `sanitizeInner` 와 동일 `MAX_SANITIZE_DEPTH`
경계 연산자 통일)과 그 테스트·plan/review 산출물만 포함하며, `spec/5-system/**`·`spec/conventions/**`
`.md` 파일은 이번 diff 에서 전혀 변경되지 않았다. 따라서 본 검토는 (a) 코드가 가리키는 기존 spec
텍스트가 `spec/conventions/**` 와 여전히 부합하는지, (b) 이번 코드 수정이 고친 실제 결함("외부 fanout
로 raw LLM payload 가 depth-1 strip 을 우회해 누출")이 spec 문서 계층에 완전히 반영돼 있는지를
중심으로 확인했다.

프롬프트 번들은 `spec/conventions/**` 전체와 `spec/5-system/14-external-interaction-api.md` 를
컨텍스트 예산 초과로 생략했다(본문 없이 "생략된 파일" 목록만 포함). 이 두 축은 판정에 직접 관련되므로
워크트리 절대경로로 직접 `Read`/`grep` 해 대조했다 — `spec/conventions/swagger.md`,
`spec/5-system/14-external-interaction-api.md` §6.2/§R17.

## 발견사항

- **[WARNING]** `llmCalls` strip-only 계약의 SoT 가 실제 누출 지점(`waiting_for_input`)을 여전히
  덮지 않는다 — 지난 라운드(11:02:18)에서 지적된 갭이 이번 diff 이후에도 미해소
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.4 Rationale
    `### \`ai_message.llmCalls[]\` 외부 수신자 strip (strip-only 결정)`(L1056-1064) 및 같은 문서 §4.4
    필드 표의 `nodeOutput.meta.turnDebug` 행(L449) · `spec/5-system/14-external-interaction-api.md`
    §6.2 페이로드 절(L645-699, `execution.waiting_for_input`)과 §R17(L1344, L1349)
  - 위반 규약: `spec/5-system/14-external-interaction-api.md` §6 도입부가 스스로 선언한 SoT 원칙
    ("같은 필드를 여러 문서에 나열하면 그 각각이 두 번째 SoT 가 되고, 실제로 그렇게 됐다") — 이 원칙이
    바로 이번 diff 가 고친 보안 결함의 근본 원인과 동일한 모양으로 문서 계층에도 남아 있다
  - 상세: 이번 diff 의 JSDoc(`stripExternalOnlyFields` 주석)이 명시하는 실제 결함은
    `execution.waiting_for_input` 이벤트가 `turnDebug.llmCalls.llmCalls[]`
    (`ai-turn-orchestrator.service.ts` turn1 스냅샷)와 `nodeOutput.meta.turnDebug[].llmCalls[]`
    (`ai-conversation-helpers.ts`, 턴 누적 전체) 두 경로로 raw LLM payload 를 중첩 실어, 종전
    depth-1 strip 을 통과해 SSE(`iext_*`/`itk_*` 토큰)·webhook·chat-channel 외부 수신자에게 샜다는
    것이다("테스트로 실증"). 그런데 코드가 인용하는 spec SoT 체인은 여전히 이 위치를 비켜간다:
    - WS §4.4 전용 Rationale 은 제목·본문 모두 `ai_message.llmCalls[]` 로 스코프가 좁혀져 있고
      `waiting_for_input` 의 `nodeOutput.meta.turnDebug[].llmCalls` 는 언급이 없다. 같은 문서 §4.4
      필드 표의 `nodeOutput.meta.turnDebug` 행도 "`llmCalls` 는 debug 탭 전용"이라고만 적을 뿐 "외부
      fanout 에서 strip 된다"는 문장이 없다.
    - EIA §6.2(`waiting_for_input` 의 REST/SSE 페이로드 절, 실제 누출 지점)의 jsonc 예시는
      `context: {formConfig, buttonConfig, conversationConfig, conversationThread}` 만 나열하고
      `nodeOutput.meta.turnDebug` 자체를 언급조차 하지 않는다 — "conversationConfig 는 WS §4.4 와
      동일 shape" 라는 문구만으로는, 그 shape 안에 있는 `nodeOutput.meta.turnDebug.llmCalls` 가
      external 표면에서 strip 된다는 사실을 §6.2 만 읽어서는 알 수 없다. §6.5(`execution.ai_message`)
      절만 strip 을 명시한다.
    - `nodeOutput.meta.turnDebug[].llmCalls` 가 "editor-only / external-strip 대상"이라는 인지 자체는
      존재하지만(§R17 L1344 "에디터는 external-only strip 되지 않는 `llmCalls` 디버그로 원문을 확인할
      수 있다", L1349 "에디터 전용 `turnDebug.llmCalls` 는 건드리지 않음"), 이 두 문장 모두 §6.2 나 WS
      §4.4 Rationale 로 역참조를 걸지 않는 곁가지 서술이다. 코드 JSDoc 의 SoT 주석("SoT: WS §4.4
      strip-only 결정 (+ EIA §6.5, chat-channel CCH-MP-01)")을 그대로 따라가는 독자는 R17 의 이
      문장에 도달하지 못한다.
    - 즉 "strip-only 결정"이라는 하나의 계약이 필드가 등장하는 위치별로 서로 다른 문서·절에
      비대칭적으로 흩어져 있고, 정작 이번에 실제로 새고 있던 위치(`waiting_for_input`)를 다루는 절은
      침묵한다. 지금은 코드가 필드 **이름** 기반으로 위치 무관하게 방어하므로 즉시 위험하지는 않지만,
      향후 누군가 spec 텍스트(§4.4/§6.5)만 보고 strip 로직을 `ai_message` 전용으로 재구현하면 이번에
      고친 것과 동일한 결함이 재발할 수 있는 문서 갭이다.
  - 제안: WS §4.4 Rationale 제목·본문을 "`ai_message.llmCalls[]` 외부 수신자 strip" 에서
    "`llmCalls` 필드 외부 수신자 strip(위치 무관, depth-무관 재귀)" 수준으로 넓혀
    `nodeOutput.meta.turnDebug[].llmCalls` 도 동일 strip 대상임을 명문화한다. EIA §6.2 페이로드
    절에도 §6.5 와 동형의 한 줄("`context.conversationConfig`/`nodeOutput.meta.turnDebug[].llmCalls`
    도 fanout seam 에서 strip 되어 외부 수신자에 전달되지 않는다")을 추가하고, §R17 의 L1344/L1349
    문장에서 그 절로 역참조를 건다. 코드 JSDoc 의 SoT 목록에도 EIA §6.2(또는 R17)를 추가해 앞으로
    strip 대상 필드 위치가 늘어나도 SoT 체인이 실제 누출 지점을 덮도록 한다.

## 확인했으나 위반 없음 (참고)

- **명명 규약**: WS 이벤트 type(`execution.*`, `document:embedding_*`/`document:graph_*`), URL
  케밥케이스(`/api/knowledge-bases`), 에러 코드 `UPPER_SNAKE_CASE`(`VALIDATION_ERROR` 등) 모두
  기존 규약과 일치. RPC-style sub-channel 예외(`/api/triggers/:id/notification/rotate-secret` 류)도
  §2.2 명시 예외 범위 안.
- **출력 포맷 규약**: §5 응답 wrapping(단일 `{data}`, 목록 `{data,pagination}` top-level 형제,
  비-페이징 고정 컬렉션 `{data:{items}}`)과 `spec/conventions/swagger.md` §2-5/§5/§6 의 대응 서술이
  상호 인용·형태 모두 정합. §5.4 `null` vs 키 생략 기준과 swagger.md §1-3 인용도 일치.
- **문서 구조 규약**: `spec/5-system/14-external-interaction-api.md` 는 `## Overview (제품 정의)` →
  본문 → `## Rationale` 3섹션을 명시적으로 갖춘다. `2-api-convention.md`/`6-websocket-protocol.md`
  는 명시적 `## Overview` 헤딩은 없으나(제목 아래 "관련 문서" 줄로 대체) `## Rationale` 종결 섹션은
  갖추고 있고, 이는 이번 diff 가 만든 변화가 아니라 두 문서의 기존 구조라 새 위반으로 보지 않는다.
  `_product-overview.md`/`0-` prefix 명명은 대상 밖(system 영역은 `_product-overview.md` 를 따로
  두지 않고 `2-api-convention.md` 등 번호 파일로 구성 — 기존 관행).
- **API 문서 규약**: `swagger.md` §1-3(optional 필드 `@ApiPropertyOptional`+`field?: T`)·§1-4(닫힌
  union `oneOf`/`discriminator` sound 조건)·§2-5/§5(응답 wrapping)와 `2-api-convention.md` 의
  cross-reference 가 모두 실제 swagger.md 본문과 일치함을 직접 대조로 확인. 이번 diff 는 REST DTO 를
  건드리지 않아 신규 위반 표면이 없다.
- **금지 항목**: `redis-keys.md`/`error-codes.md` 는 이번 diff(WS in-memory 필드 strip, Redis 미개입)
  와 겹치는 표면이 없어 해당 없음. `swagger.md` §6 레거시 패턴(`{data:{items,totalItems,...}}` 오용,
  빈 껍데기 `@ApiOkResponse` schema)도 대상 문서에서 재현되지 않음.

## 요약

이번 diff 는 `spec/5-system/**` 문서를 전혀 건드리지 않는 순수 백엔드 보안 하드닝(depth-1 shallow
strip → 필드명 기반 depth-무관 재귀 strip 전환 + `__proto__` 오염 방어 + lazy 할당 + 깊이 상한 경계
연산자 통일)이라, 이 diff 자체가 새로 만들어낸 명명·출력 포맷·문서 구조·API 문서·금지 패턴 위반은
없다. 다만 지난 11:02:18 라운드에서 지적된 WARNING — "strip-only 결정"의 spec SoT 가
`execution.ai_message` 로만 좁게 명문화돼 있고, 이번에 실제로 새고 있던 지점인
`execution.waiting_for_input`(EIA §6.2, `nodeOutput.meta.turnDebug[].llmCalls`)에는 이 계약이 여전히
언급되지 않는 문제 — 는 이번 diff 이후에도 미해소로 확인됐다(spec/5-system 무변경이므로 예견된
결과). 코드가 이제 필드 이름 기반으로 위치 무관 방어하므로 즉시 런타임 위험은 아니지만, 문서만 보고
strip 로직을 재구현하면 동일 결함이 재발할 수 있는 SoT 분절이 그대로 남아 있다. 프롬프트 번들이
`spec/conventions/**` 전체와 `14-external-interaction-api.md` 를 컨텍스트 예산 초과로 생략한 점도
(harness 기존 이슈 — `feedback_consistency_spec_mode_budget.md` 계열) 병행 기록한다: 이번 검토는 두
파일을 워크트리 절대경로로 직접 열어 보완했으나, 번들에만 의존하는 후속 라운드는 동일 결함을 놓칠 수
있다.

## 위험도

LOW
