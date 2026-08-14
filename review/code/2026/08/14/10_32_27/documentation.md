# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** plan 문서(`spec-draft-eia-62-waiting-payload.md`)가 같은 changeset 안에서 이미 구현된 수정(`websocket.service.ts` 의 `stripDeep`)을 반영하지 않고, 이미 폐기된 대안을 여전히 "유력"으로 서술한다
  - 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md:130-137` (`### 다음 (별건)` 섹션)
  - 상세: 이 섹션은 세 항목을 전부 `[ ]` 미체크로 "별건(향후 작업)"으로 남겨 두고 있다. 그런데 항목 1("실증 테스트: … `turnDebug.llmCalls` 가 남는지 단언")과 항목 2("처방 후보 (a)/(b)/(c) 중 결정")는 **같은 diff 안의 `websocket.service.ts`/`websocket.service.spec.ts` 변경으로 이미 완료돼 있다** — `stripDeep`(깊이-무관 재귀 strip, 옵션 (a))이 구현됐고, `websocket.service.spec.ts:656-708`(`waiting_for_input 의 중첩 turnDebug.llmCalls 도 외부 fanout 에 남으면 안 된다`)이 그 회귀 가드 테스트다. 그럼에도 plan 텍스트는 "**(a) 는 비용이 크고** (c) 는 이름 충돌을 고착시키므로 **(b) 가 유력**"이라고 적어, 실제로 채택된 (a)를 비용 문제로 배제할 대안처럼 서술한다. `websocket.service.ts:328-331`(`stripExternalOnlyFields` JSDoc)의 "Clone-on-write: … 공통 경로는 할당이 없다" 설명과 `websocket.service.spec.ts:710-735`(제거할 필드가 없으면 identity 유지 테스트)이 바로 그 비용 우려를 해소하는 근거인데, plan 문서는 이 반전을 전혀 언급하지 않는다. 이 저장소는 "plan 체크박스 = 실제 상태"를 반복적으로 강조해 온 곳이라, 이 상태로 남으면 다음 세션이 "미해결 항목"으로 오인해 이미 끝난 논쟁을 다시 열거나, 반대로 이미 구현된 (a)를 "비용이 크다"는 이유로 되돌리려 시도할 위험이 있다.
  - 제안: 항목 1·2 체크박스를 완료로 갱신하고, "실제로는 (a)가 clone-on-write 로 구현되어 비용 문제가 해소됐다(테스트: `websocket.service.spec.ts` 동일성 테스트)"는 한 줄을 덧붙인다. 항목 3(이름 충돌 정리)만 별도 미해결로 남긴다는 것을 명확히 한다.

- **[WARNING]** 외부 fanout(SSE·webhook·chat-channel)으로 raw LLM 요청/응답(system prompt·대화 이력·사용자 입력 포함 가능)이 새던 정보 노출 결함의 수정에 CHANGELOG 항목이 없다
  - 위치: `CHANGELOG.md` (최상단 `## Unreleased` 앞에 신규 항목 필요) / 관련 코드: `codebase/backend/src/modules/websocket/websocket.service.ts:296-374`
  - 상세: `CHANGELOG.md` 는 이 저장소의 확립된 관행상 이 정도 심각도(정보 노출/보안)의 수정은 항상 `## Unreleased — …` 항목으로 기록해 왔다 — 예: `## Unreleased — (보안) 멱등 캐시 키를 execution + route 로 스코프 — cross-execution 응답 재생 차단`, `## Unreleased — 워크스페이스 멤버십 검증 누락(cross-tenant) 보안 수정 …` 등 유사 등급 항목이 다수 이미 존재한다. 이번 수정은 `stripExternalOnlyFields` 가 top-level(depth-1)만 삭제해 `execution.waiting_for_input` 이벤트의 `turnDebug.llmCalls.llmCalls[].requestPayload` 및 `nodeOutput.meta.turnDebug[].llmCalls[].requestPayload`(두 경로 모두)가 인증 없이도 접근 가능한 외부 SSE/webhook/chat-channel 수신자에게 그대로 전달되던 결함을 고친 것으로(WS spec §4.4 가 "모든 외부 수신자에서 strip 된다"고 이미 약속했던 것과 실제 구현이 어긋나 있었음), 위 선례들과 같은 등급의 항목이다. 그런데 이 diff 에는 CHANGELOG 변경이 없다.
  - 제안: `## Unreleased — waiting_for_input 의 중첩 turnDebug.llmCalls 가 외부 fanout(SSE/webhook/chat-channel)으로 샜다 — depth-1 strip 을 깊이-무관으로 하드닝` 형태의 항목을 위 CHANGELOG 관행에 맞춰 추가한다.

- **[WARNING]** `stripDeep` 은 형제 함수 `sanitizePayloadForWs` 가 갖는 깊이 상한(`MAX_SANITIZE_DEPTH`) 가드와 그 근거 주석이 없는데, 이 비대칭에 대한 설명이 없다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:349` (`function stripDeep(value: unknown): unknown {`, 특히 342-348의 JSDoc)
  - 상세: 같은 파일의 `sanitizePayloadForWs`/`sanitizeInner` (`websocket.service.ts:226`, `249`)는 `MAX_SANITIZE_DEPTH=10` 을 두고 "depth 가 초과하면 그 노드 이하의 키 매칭을 신뢰할 수 없다 … 통째로 `'[REDACTED_DEPTH]'` 로 대체한다(옛 구현은 원본을 그대로 반환해 누출 위험이 있었음)"라고 depth 상한의 보안적 필요성을 명시적으로 문서화한다. 반면 새로 도입된 `stripDeep` 은 재귀 깊이에 아무 상한이 없고, JSDoc(343-347)은 순환 참조만 다룬다("순환이 있으면 여기서 죽든 거기서 죽든 마찬가지"). 두 함수는 같은 payload(execution 이벤트)를 순회하며 유사한 목적(민감 필드 제거)을 갖는데, 하나는 깊이 폭주를 명시적 방어 대상으로 문서화하고 다른 하나는 언급조차 없다 — 이 비대칭이 의도된 설계(예: `stripDeep` 대상 payload 는 depth 가 실질적으로 제한돼 있다는 전제)인지 누락인지 독자가 주석만으로 판단할 수 없다.
  - 제안: `stripDeep` JSDoc 에 "이 payload 는 이미 `sanitizePayloadForWs` 를 거쳐 depth ≤ `MAX_SANITIZE_DEPTH` 로 정규화된 뒤 들어온다(그래서 별도 깊이 가드가 불필요하다)"처럼 전제를 명시하거나, 그 전제가 성립하지 않는다면 동일한 깊이 가드를 추가할 것.

- **[INFO]** `stripDeep` JSDoc 의 순환 참조 처리 근거가 실패 모드 차이를 생략한다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:346-347`
  - 상세: "순환 참조는 다루지 않는다 … 순환이 있으면 여기서 죽든 거기서 죽든 마찬가지고, 방문 집합을 들고 다니는 비용만 는다." — 그러나 순환 객체를 `stripDeep` 이 만나면 사이클 감지가 없는 순수 재귀이므로 `RangeError: Maximum call stack size exceeded` 로 죽는 반면, `JSON.stringify` 는 사이클을 감지해 `TypeError: Converting circular structure to JSON` 을 던진다 — 전자는 catch 되지 않는 스택 오버플로우, 후자는 예측 가능한 예외로 실패 모드가 다르다. 결론(가드를 넣지 않는다)은 합리적이나 "마찬가지"라는 표현은 다소 부정확하다.
  - 제안: "어느 쪽이든 요청이 실패로 끝난다(스택 오버플로우 vs JSON.stringify 예외)"처럼 실패 모드가 다름을 인정하는 표현으로 다듬으면 더 정확하다. (필수 아님 — 결론 변경 불필요)

## 확인했으나 문제 없음 (positive findings)

- `websocket.service.ts:296-334`(`EXTERNAL_STRIPPED_FIELDS`/`stripExternalOnlyFields` JSDoc)와 `stripDeep`(`:342-374`) 문서는 변경 배경("종전엔 top-level 전용이었고 그 사이로 실제로 새고 있었다")·근거(두 유출 경로 구체 파일:라인 인용)·성능 트레이드오프(clone-on-write)를 모두 정확하고 상세하게 서술한다. `EXTERNAL_STRIPPED_FIELDS` 에 새 필드 추가 시 WS spec §4.4 와 `EiaAiMessageEvent` 를 함께 갱신하라는 갱신 규율도 유지된다.
- `ai-turn-orchestrator.service.ts:615`(`turnDebug: { llmCalls: turnDebugHistory[0], metadata }`)와 `ai-conversation-helpers.ts:97`(`turnDebug: state.turnDebugHistory ?? []`) 등 새 테스트/주석이 인용하는 소스 파일:라인 참조를 직접 열어 대조한 결과 모두 정확했다.
- `websocket.service.spec.ts:635-655`, `:710-714` 의 신규 테스트 JSDoc 은 "무엇을 왜 테스트하는지"(재귀 strip 비용 근거, 두 유출 경로를 함께 봐야 하는 이유)를 명확히 설명해 예시 코드로서도 훌륭하다.
- `EiaAiMessageEvent`(`chat-channel/types.ts:366`)의 `llmCalls` 관련 주석은 깊이를 특정하지 않는 일반 서술이라 이번 depth-agnostic 수정으로 인해 stale 해지지 않는다 — 갱신 불필요.
- `spec/5-system/6-websocket-protocol.md:519`("모든 외부 fanout 수신자 … 에서는 strip 된다")는 이미 depth 를 특정하지 않고 광범위하게 서술돼 있었다 — 이번 코드 수정이 그 문서화된 약속을 실제로 충족시키는 방향이라, spec 자체는 갱신이 필요 없다(오히려 이전 코드가 이 문서화된 보장보다 좁게 구현돼 있었던 것).
- 나머지 리뷰 대상(consistency-check 산출물 5~12번 파일)은 리뷰 산출물 자체로, 내부적으로 형식(발견사항/요약/위험도 구조)이 일관되고 정확한 파일:라인 인용을 포함한다 — 별도 문서화 결함 없음.

## 요약

핵심 보안 수정(`stripExternalOnlyFields` 를 depth-1 shallow 에서 depth-agnostic 으로 하드닝)에 대한 JSDoc·테스트 문서화 자체는 매우 우수하다 — 배경·근거·트레이드오프를 모두 정확히 기록했다. 그러나 (1) 같은 changeset 에서 새로 만든 plan 문서(`spec-draft-eia-62-waiting-payload.md`)의 "다음 (별건)" 체크리스트가 이미 구현·테스트로 완료된 항목을 미해결로 남겨두고 폐기된 대안("(b) 가 유력")을 그대로 서술해 향후 혼선을 유발할 수 있고, (2) 이 저장소가 일관되게 지켜온 CHANGELOG 관행(보안/정보노출 등급 수정은 `## Unreleased` 항목화)이 이번 수정에는 적용되지 않았으며, (3) `stripDeep` 이 형제 함수(`sanitizePayloadForWs`)가 명시한 깊이-가드 보안 근거 없이 무제한 재귀한다는 비대칭에 대한 설명이 없다. 코드 자체의 문서(JSDoc/인라인 주석)는 정확하므로 CRITICAL 은 없다.

## 위험도

MEDIUM
