# Cross-Spec 일관성 검토 — `spec/4-nodes/6-presentation`

## 절차 노트

- `origin/main...HEAD` 실측 diff 는 `spec/**` 변경을 포함하지 않는다 (변경분은 frontend `output-shape.ts`/테스트뿐). 번들된 target 본문(`0-common.md`/`1-carousel.md`/`2-table.md`)은 현재 워크트리의 실제 `spec/4-nodes/6-presentation/*.md` 와 거의 동일 — 즉 이미 `spec/` 에 반영된 상태다 (직전 커밋 `c3998e6cd docs(spec): presentation §4.6 opt-out …` 등). 따라서 본 검토는 "머지 전 draft vs 나머지 spec" 이 아니라 **현재 spec/ 상태의 cross-area 정합성 standing check** 로 수행했다 — target 문서가 링크하는 실제 spec 파일(execution-engine.md §7.4/§7.5/§7.5.1, websocket-protocol.md §4.2, node-output.md §4.2/§4.4/§4.5, ai-agent.md §4.1/§6.1/§6.2/§7.10/§12.4-12.8, conversation-thread.md §1.2/§1.4/§2.4/§9.1, data-model.md §2.14, canvas.md §5.3, 4-form.md §1/§1.5, interaction-type-registry.md)를 직접 읽어 대조했다.

## 발견사항

- **[WARNING]** execution-engine.md 의 "후속 항목" 이 이미 확정된 1MB cap 과 다른 수치(256KB)를 여전히 미결 TODO 처럼 남겨둠
  - target 위치: `spec/4-nodes/6-presentation/0-common.md` §4 "Output size cap (1MB — `PRESENTATION_MAX_BYTES = 1024 × 1024`)" 및 §10.4 (LLM tool 모드에도 1MB 동일 적용). 명시적으로 "integration 노드의 256KB cap 보다 4× 큰 한계" 라고 256KB 와 대비하며 1MB 를 확정한다.
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §Rationale "Engine Raw Config Exposure" → "후속 항목" 목록의 마지막 줄(라인 1460) — `Carousel / Table 의 256KB cap 적용 정책 결정.` 이 여전히 **미결(open follow-up)** 로 남아 있고, 값 힌트도 target 이 채택한 1MB 이 아니라 256KB(=integration 노드 cap) 다.
  - 상세: presentation 카테고리의 output cap 정책은 이미 `0-common.md §4/§10.4` + Rationale "버튼 cap 정책" 인접 절에서 1MB 로 확정·구현됐고 여러 다른 spec(§10.9 4-layer 정렬 등)에서도 1MB 로 일관되게 인용된다. 그런데 execution-engine.md 의 오래된 "후속 항목" bullet 은 이 결정이 아직 안 난 것처럼 서술하며, 값도 다르게(256KB) 암시한다. 이 bullet 을 읽는 독자(특히 execution-engine.md 를 SoT 로 참조하는 다른 영역 작성자)가 "carousel/table cap 은 아직 미정, 혹은 256KB 로 예정" 이라고 오독할 수 있다 — 이미 내려진 결정과 문면상 모순되는 stale 참조.
  - 제안: `project-planner` 가 execution-engine.md §Rationale "후속 항목" 의 해당 bullet 을 제거하거나 "**해결됨 — 1MB, [Presentation 공통 §4/§10.4](../4-nodes/6-presentation/0-common.md#4-출력-포맷-principle-11--43--45) 참조**" 로 갱신.

- **[INFO]** `§10.9` layer(3) 표가 "4값 중 하나" 라 말하면서 3개만 열거
  - target 위치: `spec/4-nodes/6-presentation/0-common.md` §10.9 "4 layer 분리" 표의 (3) NodeOutput interaction surface 행 — `'form_submitted' enum 값 (button_click / button_continue / form_submitted 4값 중 하나)`.
  - 충돌 대상: `spec/conventions/node-output.md` §4.4/§4.5 — `output.interaction.type` 의 실제 enum 은 `form_submitted | button_click | button_continue | message_received` 4값이며, 4번째 값 `message_received` 는 target 표의 괄호 열거에서 누락돼 있다.
  - 상세: 수치("4값")는 SoT(node-output.md)와 일치하지만 괄호 안 열거가 presentation 관련 3값만 나열해 "4값 중 하나" 라는 서술과 열거 목록이 안 맞아 보인다. `message_received` 는 presentation 노드와 무관(ai_agent/information_extractor 전용)하므로 실질적 모순은 아니나, cross-reference 를 따라가는 독자가 "표에 나온 3개가 전부인데 왜 4개라 하지" 하고 혼동할 수 있는 낮은 수준의 문서 정합성 이슈.
  - 제안: 괄호를 "`button_click` / `button_continue` / `form_submitted` — presentation 관련 3값. 4번째 `message_received` 는 AI/IE 전용" 정도로 명시하거나 숫자를 "3값(전체 4값 enum 중 presentation 관련)" 으로 표현 조정.

- **[INFO]** `data-model.md §2.14` 의 `interaction_data.interactionType` (3값: `form_submitted`/`button_click`/`button_continue`) 과 `node-output.md §4.4`의 `output.interaction.type` (4값, `message_received` 추가) 이 이름은 같지만 값 집합이 다름
  - target 위치: `spec/4-nodes/6-presentation/0-common.md` §10.9 "왜 internal bus layer 한정" — "DB `interaction_data.interactionType` enum (data-model §2.14) … 도 외부 가시 surface. 변경 불요" 로 인용.
  - 충돌 대상: `spec/1-data-model.md` §2.14 vs `spec/conventions/node-output.md` §4.4/§4.5.
  - 상세: target 자체는 두 enum 이 같다고 주장하지 않고 "본 작업 범위 밖" 으로만 언급하므로 target 이 새로 만든 불일치는 아니다. 다만 두 SoT 문서가 "interactionType" 이라는 동일 이름의 필드를 서로 다른 값 집합(3 vs 4)으로 정의하는 기존 상태는 향후 혼동 소지가 있다 — 특히 `data-model.md §2.14` 자체가 "`interactionType` 은 `WaitingInteractionType` 과 이름만 같고 별개" 라고 명시하듯, `output.interaction.type` 과도 이름만 같고 부분집합 관계라는 점을 명시하는 편이 안전하다.
  - 제안: 우선순위 낮음 — presentation spec 변경 불요, `project-planner` 백로그에만 기록 권장 (data-model.md §2.14 비고에 "node-output §4.5 의 4값 중 3값과 대응, `message_received` 미포함" 한 줄 추가 검토).

## 검증되어 충돌 없음으로 확인된 주요 cross-reference

아래는 target 이 명시적으로 인용하는 타 영역 SoT 를 직접 대조해 **모순 없음**을 확인한 것들이다 (양성 결과도 판정 근거로 기록):

- `execution-engine.md §7.4` Continuation Bus 메시지 타입 6종(`continue`/`cancel`/`button_click`/`ai_message`/`ai_end_conversation`/`retry_last_turn`) — target §10.9 의 "변경 없음" 주장과 일치.
- `execution-engine.md §7.5` `dispatchResumeTurn`(ordered `resumeTurnRegistry`, first-match-wins: form → button → AI) 과 target §10.9 의 `processAiResumeTurn` 내부 4-case 매칭(`ai_end_conversation`/`ai_message`/`form_submitted`/`button_click`)은 서로 다른 층위(외곽 노드-타입 dispatch vs AI 노드 내부 payload dispatch)로 모순 없이 정합.
- `execution-engine.md §7.5.1` 대기 표면 매트릭스(`form`=submit_form 만, `buttons`=click_button 만, `ai_conversation`/`ai_form_render`=4종 허용)와 target §10.9 "역방향 — buttons 대기 중 비-button_click 도착" 서술이 정합.
- `websocket-protocol.md §4.2` 이 이미 target §10.9 를 직접 cross-ref 하며 `execution.submit_form` payload `{executionId, formData}` 외부 wire 불변 서술과 target 의 "내부 sentinel wrap 은 internal bus 한정" 주장이 정합.
- `ai-agent.md §6.1.d.ii`/`§6.2` 의 `pendingFormToolCall`/`data.via:'ai_render'`/tool_result `{ok,type,data,message}` 가드 필드 서술이 target §10.9/§Rationale 과 문자 그대로 일치.
- `conversation-thread.md` §1.2 `presentations?` top-level 필드, §9.1 `ai_assistant` 시각 매핑(`presentations[]` inline 렌더 + `pendingFormToolCall.toolCallId` predicate)이 target §10.6/§10.7/§Rationale 과 일치.
- `node-output.md §4.2` "폐기할 필드" 의 `previousOutput` 과도기 예외가 정확히 "carousel/chart/table/template" 만 열거하고 form 은 제외 — target §4.2 의 "Form 은 해당 없음" 서술과 일치.
- `4-nodes/3-ai/0-common.md §…`(`excludeFromConversationThread` 5필드 공유 fragment) 와 `conventions/conversation-thread.md`(`appendInternal` 공통 게이트) 서술이 target §4.6 의 "런타임 공통 vs schema 선언 AI 전용" 2층위 구분과 일치.
- `4-nodes/6-presentation/4-form.md §1.5`(File 타입 UI 동작)·§1 `options[].value` 비고가 target Rationale "form option value backfill"/"file 타입 metadata-only" 와 일치하며 이미 spec 에 반영돼 있음.
- 버튼 최대 5개 cap 은 `_product-overview.md` ND-CL-08("최대 5개/아이템")과 정합, 타 영역에서 다른 상한을 선언하지 않음.
- `interaction-type-registry.md §1.2` 의 `WaitingInteractionType` 4값(`form`/`buttons`/`ai_conversation`/`ai_form_render`) 처리 매트릭스가 target 이 사용하는 `meta.interactionType: 'buttons'`/`'ai_form_render'` 용례와 정합.

## 요약

Presentation 노드 공통 규약(`spec/4-nodes/6-presentation/0-common.md` 및 하위 문서)이 인용하는 타 영역 SoT — 실행 엔진 §7.4/§7.5/§7.5.1, WebSocket 프로토콜 §4.2, node-output 컨벤션 §4.2/§4.4/§4.5, AI Agent §4.1/§6.1/§6.2/§7.10/§12.x, Conversation Thread §1.2/§9.1, data-model §2.14, 캔버스 §5.3, interaction-type-registry — 를 전수 대조한 결과 **직접 모순(CRITICAL)은 발견되지 않았다**. 이는 이 문서군이 해당 참조 대상들과 같은 작업 단위에서 동시에 갱신되어 온 것으로 보이며(다수 문서가 target 을 역참조), cross-area 정합성이 이례적으로 높다. 유일한 실질 이슈는 execution-engine.md 의 오래된 "후속 항목" 목록이 이미 확정된 1MB cap 결정과 다른 값(256KB)을 미결 상태로 남겨둔 stale 참조(WARNING)이며, 나머지는 문서 열거 완결성 수준의 INFO 2건이다.

## 위험도

LOW
