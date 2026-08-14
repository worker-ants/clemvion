# Cross-Spec 일관성 검토 — cross_spec

## 검토 대상 요약

이번 diff(`origin/main...HEAD`)는 `spec/**` 문서를 직접 수정하지 않고
`codebase/backend/src/modules/websocket/websocket.service.ts`(+ `.spec.ts`)만 바꾼다 — `EXTERNAL_STRIPPED_FIELDS`(`llmCalls`) strip 을 **top-level(depth-1) shallow delete** 에서 **깊이 무관 재귀 strip**(`stripDeep`, lazy clone-on-write, `__proto__` 안전)으로 확장한 보안 수정이다. JSDoc·커밋 메시지 모두 SoT 로 `spec/5-system/6-websocket-protocol.md §4.4` `llmCalls[]` strip-only 결정( + EIA §6.5, chat-channel CCH-MP-01)을 명시한다. 이 SoT 를 기준으로 **동일 불변식을 공유해야 하는 다른 spec 영역·다른 코드 표면**과 실제로 정합한지 대조했다.

`spec/5-system/14-external-interaction-api.md` 본문과 `<git diff>` 섹션은 prompt 조립 시 컨텍스트 예산 초과로 생략되어 있었다 — 지시대로 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서 `git diff`·`Read`·`grep` 으로 직접 재확인했다.

---

## 발견사항

### [CRITICAL] `GET /api/external/executions/:id`(REST `getStatus`)가 WS §4.4 의 "모든 외부 fanout 수신자 strip" 불변식을 그대로 우회한다

- **target 위치**: `codebase/backend/src/modules/websocket/websocket.service.ts:294-320`(JSDoc — "stripped from the fanout envelope so SSE token holders / channel end-users never receive it", `EXTERNAL_STRIPPED_FIELDS = ['llmCalls']`) + `:539`(`stripExternalOnlyFields(wireEnvelope)` 적용 지점)
- **충돌 대상**:
  - `spec/5-system/6-websocket-protocol.md:519`(§4.4) — "**모든 외부 fanout 수신자** — external-interaction SSE 스트림(`iext_*`/`itk_*` 토큰으로 인증)... 에서는 strip 된다"
  - `spec/5-system/14-external-interaction-api.md` §R17(`getStatus` `nodeOutput` 실값 노출 결정 — "`getStatus`·SSE fanout **모두** `NodeExecution.outputData`(→`nodeOutput`)... 를 동봉하므로 이들은 **공개 EIA 표면**으로 흘러간다")
  - 실제 구현: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()`(:337-386, 특히 `:341` `deepRedactSecrets(nodeExec.outputData)`, `:385` `{ ...base, nodeOutput: out }`)
- **상세**: WS §4.4 는 `llmCalls`(raw LLM `requestPayload`/`responsePayload` — 시스템 프롬프트·대화 이력·tool 정의 포함)를 "인증된 내부 WS 채널에만" 두고 **모든 외부 수신자에서 strip** 한다고 normative 하게 선언한다. 이 PR 의 `stripDeep` 은 그 strip 을 depth-1 → 깊이 무관으로 강화해, `websocketService.executionEvents$` 를 구독하는 세 표면(`sse-adapter.service.ts` = EIA SSE 스트림, `notification-fanout.service.ts` = webhook, `chat-channel.dispatcher.ts`)엔 실제로 적용된다.
  그런데 같은 `iext_*`/`itk_*` 토큰(`InteractionGuard`, 워크스페이스 체크 없음)으로 접근 가능한 **REST 단발 조회** `GET /api/external/executions/:id`(`interaction.controller.ts:166` → `interaction.service.ts getStatus()`)는 이 fanout 파이프라인을 전혀 거치지 않는다. `getStatus()` 는 DB 의 `NodeExecution.outputData`(=`nodeExec.outputData`)를 직접 읽어 `deepRedactSecrets` 만 적용한다. `deepRedactSecrets`(`shared/utils/sanitize-error-message.ts:127`)는 **문자열 leaf 값의 secret 패턴** 또는 **credential 이름의 키**(`CREDENTIAL_KEY_PATTERN` — `password|token|secret|api_key|...`)만 마스킹하는 값-레벨 방어이지, `llmCalls` 같은 **필드 전체 제거**를 하지 않는다. `llmCalls` 라는 키 이름 자체는 `CREDENTIAL_KEY_PATTERN` 에 매치되지 않으므로, 그 안의 `requestPayload.messages`/`system` 등 일반 대화 텍스트·시스템 프롬프트는 secret 패턴에 우연히 걸리지 않는 한 **마스킹되지 않고 그대로** 외부로 나간다.
  `interactionType === 'ai_conversation'`(AI Agent Multi Turn 대기 중)일 때 `nodeExec.outputData.meta.turnDebug`(= `buildConversationMetaFromResumeState` 의 `turnDebugHistory`, `ai-conversation-helpers.ts:97`)가 `llmCalls[]` 를 담은 채로 DB 에 영속되고(`ai-turn-orchestrator.service.ts:887` `withInteractionMeta(safe, 'ai_conversation')`, 주석 `:1209` "**strip 하지 않고** outputData 에 보존"), `getStatus()` 는 이를 `deepRedactSecrets` 만 거쳐 `context.nodeOutput` 으로 **그대로 재노출**한다(`interaction.service.ts:385`).
  즉 이번 PR 의 JSDoc 이 스스로 적은 "SSE token holders ... never receive it" 주장은 **같은 토큰으로 REST 엔드포인트를 치면 거짓**이 된다 — fanout 채널(스트림/웹훅/챗채널)만 막혔고, 같은 신뢰수준의 REST 스냅샷 표면은 이 PR 이전부터 지금까지 열려 있다.
  이 갭은 신규는 아니다 — `plan/complete/eia-secret-masking-residuals.md`(2026-07-10 완료) P1-2 항목이 "SSE waiting emit 의 non-conversationConfig `nodeOutput` 은 `sanitizePayloadForWs`(키) + `deepRedactSecrets` 로 **충분 판단**"이라 결정한 바 있다. 그러나 이 결정은 `llmCalls` 전용 **필드 단위 strip-only 결정**(WS §4.4, 이 결정 이후에 성립·명문화됨)을 반영하지 못한 채 남았고, `getStatus()` 는 애초에 `sanitizePayloadForWs` 도 거치지 않는다(§R17 스스로 "REST 는 `sanitizePayloadForWs` 미적용 경로라 필수"라고 `deepRedactSecrets` 만 언급). 따라서 "충분 판단"의 전제 자체가 `llmCalls` 클래스에는 적용되지 않는다.
- **제안**:
  1. `interaction.service.ts`의 `getStatus()`가 `nodeOutput`(대기 중 `context.nodeOutput`)과 terminal `result`/`error`(`outputData`)를 조립하는 지점에 `websocket.service.ts` 의 `stripDeep`/`EXTERNAL_STRIPPED_FIELDS` 와 동등한 필드 strip 을 `deepRedactSecrets` 앞뒤로 적용 — 두 함수가 지금처럼 서로 다른 모듈에 사실상 중복 구현돼 있으므로 `EXTERNAL_STRIPPED_FIELDS`/strip 로직을 공유 유틸(`shared/utils`)로 승격해 두 소비처가 재사용하게 하는 편이 향후 세 번째 드리프트를 막는다.
  2. `spec/5-system/14-external-interaction-api.md` §R17 에 "`getStatus` 의 `nodeOutput.meta.turnDebug[].llmCalls`" 를 명시적으로 다루는 문장 추가 — 현재 §R17 은 "`nodeOutput` 일반 키 allowlist(미구현·잔여)"만 언급하고 `llmCalls` 라는 이름 있는 예외를 언급하지 않아, WS §4.4 의 "모든 외부 fanout 수신자" 문구가 REST `getStatus` 를 포함하는지 배제하는지 spec 상 모호하다 — 이 모호성이 바로 이 CRITICAL 의 근본 원인이다.
  3. `websocket.service.ts`의 JSDoc(`:294-320`) 문구 "SSE token holders ... never receive it"를 "fanout envelope(SSE 스트림/webhook/chat-channel) 수신자"로 정정하거나, REST `getStatus` 도 막은 뒤에 유지 — 현재 문구는 고쳐지지 않은 표면을 고쳐졌다고 암시한다.

### [WARNING] `plan/complete/eia-secret-masking-residuals.md` P1-2 결정이 이후 성립한 WS §4.4 strip-only 결정과 충돌한 채 "완료"로 종결돼 있다

- **target 위치**: (해당 없음 — 이번 diff 직접 변경분 아님, 위 CRITICAL 의 배경 문서)
- **충돌 대상**: `plan/complete/eia-secret-masking-residuals.md:29,59` vs `spec/5-system/6-websocket-protocol.md` Rationale `### ai_message.llmCalls[] 외부 수신자 strip (strip-only 결정)`(:1056 부근)
- **상세**: 완료된 plan 은 "SSE waiting emit 의 non-conversationConfig `nodeOutput` 은 `sanitizePayloadForWs`(키) + `conversationConfig`(값+키)로 충분 판단"이라고 결론짓고 `llmCalls` 를 이 판단의 예외로 괄호 안에만 언급했다("에디터 전용 `turnDebug.llmCalls` 보존 필수" — 내부 WS 채널 보존 요구로 읽힘). 이후 별도로 성립한 WS §4.4 strip-only 결정은 `llmCalls` 를 "외부 fanout 전 표면에서 제거"로 격상시켰는데, `plan/complete/` 로 이미 종결된 위 plan 은 갱신되지 않았고 그 결정의 근거("`sanitizePayloadForWs`(키) 로 충분")가 `llmCalls`(비-credential-이름 키)에는 애초에 적용되지 않는다는 점도 재검토되지 않았다.
- **제안**: `plan/complete/` 문서를 소급 수정하지 않는 게 관행(교훈: "1회성·역사 문서")이므로, 대신 위 CRITICAL 제안 ②(§R17 갱신)로 최신 결정을 spec 에 명문화하고 이 plan 은 "후속 CRITICAL 로 대체됨" 참조만 남기는 편을 권한다.

### [INFO] `websocket.service.ts` 재귀 strip 이 EIA §R17 `deepRedactSecrets`(shared/utils)와 사실상 같은 클래스의 방어를 별도 구현으로 유지

- **target 위치**: `codebase/backend/src/modules/websocket/websocket.service.ts` `stripDeep`(:322 이후) vs `codebase/backend/src/shared/utils/sanitize-error-message.ts` `deepRedactSecrets`(:127)
- **충돌 대상**: 없음(직접 모순은 아님) — 다만 두 함수 모두 "lazy clone-on-write, depth cap(`MAX_SANITIZE_DEPTH`/`MAX_REDACT_DEPTH`), `__proto__` 안전 대입" 패턴을 각자 재구현하고 있고, `websocket.service.ts` 자신의 형제 `sanitizeInner`(credential 마스킹)까지 포함하면 유사 순회 로직이 3곳(`sanitizeInner`, `stripDeep`, `deepRedactSecrets`)에 존재한다.
- **상세**: 위 CRITICAL 이 실제로 해소되려면 이 세 곳 중 최소 두 곳(`stripDeep`, `deepRedactSecrets`)이 `getStatus()` 경로에서 함께 동작해야 하므로, 지금 갈라져 있는 구현을 하나의 공유 순회 프리미티브로 합치는 편이 재발(네 번째 표면 누락)을 구조적으로 막는다. 이번 PR 의 JSDoc(`websocket.service.ts:394-408`)이 이미 "두 pass 를 합치지 않은 이유"를 문서화했지만, 그 논의는 `sanitizePayloadForWs`+`stripDeep`(같은 파일, WS 채널) 사이의 트레이드오프이지 `interaction.service.ts` 의 `deepRedactSecrets` 단독 경로까지 포함하지 않는다.
- **제안**: 급하지 않음. 위 CRITICAL 수정 시 구조를 정리할 기회로 병행 고려.

---

## 요약

이번 diff 자체(depth-무관 `llmCalls` strip)는 WS §4.4·EIA §6.5·chat-channel CCH-MP-01 이 공유하는 "raw LLM 요청/응답은 내부 WS 채널 전용" 불변식을 SSE 스트림·notification webhook·chat-channel 세 fanout 표면에서 올바르게 강화한다(diff 로 확인). 그러나 cross-spec 검증 과정에서, 같은 불변식을 공유해야 하는 **네 번째 표면인 REST `GET /api/external/executions/:id`(`getStatus`)** 가 이 fanout 파이프라인을 전혀 거치지 않고 `deepRedactSecrets` 값-마스킹만으로 `nodeOutput.meta.turnDebug[].llmCalls`(raw request/response payload)를 그대로 반환한다는 사실을 코드 레벨에서 확인했다. `getStatus` 는 fanout 과 동일한 저신뢰 `iext_*`/`itk_*` 토큰으로 접근되고, EIA spec §R17 스스로 이를 "SSE fanout 과 동일한 공개 EIA 표면"이라 규정하므로, 이는 WS §4.4 의 "모든 외부 fanout 수신자에서 strip" 선언과 실제 구현 사이의 직접적인 모순이다. diff 가 새로 만든 결함은 아니고(사전 존재), diff 의 JSDoc·PR 목표("raw 프롬프트가 새고 있었다"를 닫는 것)와 정면으로 어긋나는 잔존 표면이라는 점에서 CRITICAL 로 판단했다.

## 위험도

CRITICAL
