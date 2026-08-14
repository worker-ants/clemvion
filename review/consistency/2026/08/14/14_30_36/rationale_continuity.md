# Rationale 연속성 검토 — rationale_continuity

## 검토 대상 요약

이번 diff(`origin/main...HEAD`)의 핵심은 `llmCalls`(raw LLM 요청/응답 — 시스템 프롬프트·대화 이력) 외부 노출을 막는 보안 수정 시리즈다. 마지막 커밋 `34e32e62f`("fanout 만 막았다 — REST 스냅샷으로 같은 프롬프트가 나가고 있었다")는 직전 consistency 라운드(`12_06_21` cross_spec CRITICAL 1)가 지적한 "`GET /api/external/executions/:id`(`getStatus`)가 fanout 과 달리 `deepRedactSecrets` 값-마스킹만 거쳐 `llmCalls` raw payload 를 그대로 반환한다"는 갭을 닫는다고 주장한다. `spec/5-system/14-external-interaction-api.md` §R17·`spec/5-system/6-websocket-protocol.md` §4.4 Rationale 을 SoT 로 대조했다.

`spec/5-system/14-external-interaction-api.md` 본문은 diff 로 수정되지 않았으므로(코드만 변경), 아래 R17 인용은 현재 워킹트리의 **그대로인** 텍스트다 — 이 텍스트가 새 코드와 실제로 정합하는지가 이번 검토의 핵심이다.

---

## 발견사항

### [CRITICAL] `getStatus` 의 terminal `result`/`error` 분기가 R17 이 요구하는 동일 마스킹 대칭을 깨고, WS §4.4 가 명시적으로 기각한 "값-레벨 마스킹 단독" 상태로 남았다

- **target 위치**: `codebase/backend/src/modules/external-interaction/interaction.service.ts:406-419` — `result`(`ExecutionStatus.COMPLETED` 시) / `error`(`ExecutionStatus.FAILED` 시) 모두 `deepRedactSecrets(execution.outputData ?? null)` **단독**으로 조립된다. 같은 함수 안 waiting 분기(`:341-355`)는 이번 diff 로 `stripExternalOnlyFields(deepRedactSecrets(nodeExec.outputData ?? {}), MAX_REDACT_DEPTH)` 로 강화됐는데, terminal 분기만 새 유틸을 호출하지 않는다.
- **과거 결정 출처**:
  - `spec/5-system/14-external-interaction-api.md:1346-1352` — R17 "`nodeOutput.conversationConfig` + terminal `result`/`error` (강제됨 — bypass 차단)": "`getStatus` 는 `nodeOutput` 전체 **+ terminal `result`(COMPLETED)/`error`(FAILED)의 `outputData`** 를 `deepRedactSecrets` 로 마스킹한다" — 두 표면을 **동일 처리 대상**으로 명시적으로 묶은 문장. 이번 diff 는 앞쪽(`nodeOutput`)만 강화하고 뒤쪽(terminal `outputData`)은 원문 그대로 두어, 이 문장이 서술하는 대칭이 코드에서 깨졌다.
  - `spec/5-system/6-websocket-protocol.md:1064,1066` — "`ai_message.llmCalls[]` 외부 수신자 strip (strip-only 결정)": 결정은 "**fanout(외부) 경로에서는 strip**"이고, **기각된 대안**은 "값-레벨 마스킹은 ... 부분적"이라 명시한다. `deepRedactSecrets` 단독은 이 기각된 대안 그 자체다(문자열 secret 패턴/credential 키만 마스킹 — 필드 제거 아님, `sanitize-error-message.ts:33-93` 확인).
  - 직전 라운드 `review/consistency/2026/08/14/12_06_21/cross_spec.md` CRITICAL 1 제안 ①: "`getStatus()`가 `nodeOutput`(대기 중) **과 terminal `result`/`error`(`outputData`)** 를 조립하는 지점에 ... strip 을 적용" — 두 지점을 명시적으로 함께 요구했다.
- **상세**: `Execution.outputData`(terminal `result`/`error`)는 `execution-engine.service.ts:2358`/`2522` 에서 `context.nodeOutputCache[lastNodeId]`(= 마지막 노드의 `NodeExecution.outputData`)로 채워진다. AI Agent single-turn 완료 출력은 `meta.turnDebug: [{ turnIndex, llmCalls, ... }]` 를 포함한다(`ai-turn-executor.ts:1896-1930`, `llmCalls` 는 `requestPayload`/`responsePayload` 원문 보유). 즉 **AI Agent 가 마지막 노드인 워크플로우가 COMPLETED/FAILED 로 종료되면**, 그 `outputData.meta.turnDebug[].llmCalls[].requestPayload`(시스템 프롬프트 원문)가 `getStatus` 의 `result`/`error` 필드로 그대로 나간다 — `deepRedactSecrets` 는 `llmCalls` 라는 키 이름도 `requestPayload.system` 문자열도 secret 패턴/credential 키에 매치되지 않으므로 손대지 않는다. 이 REST 엔드포인트는 워크스페이스 검증 없는 `iext_*`/`itk_*` 토큰만으로 접근되는 저신뢰 외부 표면이다(§8.3) — waiting 분기에서 방금 닫은 것과 **완전히 동일한 클래스의 leak** 이다.
  이번 fix 커밋 메시지("consistency `12_06_21` CRITICAL 1... 처방을 한 곳에 둔다... 새 외부 표면이 생기면 여기를 부르면 된다")와 신설 유틸 `strip-external-only-fields.ts` 자신의 JSDoc("한 출구를 막고 나머지를 세지 않는 것이 이 결함의 반복 형태라, 처방을 한 곳에 두고 **모든 외부 출구가 같은 것을 부르게** 한다")이 스스로 선언한 원칙과, 실제로 terminal 분기를 그 공유 유틸에 연결하지 않은 코드 사이에 직접적인 모순이 있다. `12_06_21` CRITICAL 1 이 요구한 두 지점(`nodeOutput` + terminal `outputData`) 중 하나만 고쳐졌고, 그 축소에 대한 새 Rationale·plan 항목·CHANGELOG 언급이 없다(추적 문서 `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 의 "(7)" 항목·체크리스트는 WS fanout depth 이슈만 다루고 이 terminal 갭은 등재돼 있지 않다; `CHANGELOG.md` 는 WS depth fix 항목만 있고 이번 REST fix 커밋에 대응하는 항목이 없다).
  회귀 테스트도 이 비대칭을 반영한다 — 신설 waiting-분기 테스트(`interaction.service.spec.ts:614-650` 부근, `'SECRET PROMPT VIA REST'`)는 정확히 있는데, 기존 terminal 테스트(`:830` `COMPLETED result / FAILED error 의 outputData secret 도 마스킹 (EIA §R17)`)는 `Bearer sk-...`/`api_key` 같은 secret-패턴 값만 검증하고 `llmCalls`/`turnDebug` 를 갖는 fixture 는 다루지 않는다 — 같은 leak 클래스가 terminal 분기에서는 테스트로도 확인된 적이 없다.
- **제안**:
  1. `interaction.service.ts:409-419` 의 `result`/`error` 조립을 waiting 분기와 동일하게 `stripExternalOnlyFields(deepRedactSecrets(execution.outputData ?? null), MAX_REDACT_DEPTH)` 로 교체.
  2. `nodeOutputCache[lastNodeId].meta.turnDebug[].llmCalls` 를 포함하는 COMPLETED fixture 로 terminal `result`/`error` 회귀 테스트를 waiting 분기 테스트와 대칭으로 추가.
  3. R17(`spec/5-system/14-external-interaction-api.md:1346-1352`)에 "terminal `result`/`error` 도 `stripExternalOnlyFields` 를 거친다"는 문장을 추가해 텍스트를 새 구현과 재정합.

### [WARNING] `12_06_21` cross_spec CRITICAL 1 의 제안 ②(§R17 텍스트에 `llmCalls` 예외 명문화)도 이번 diff 에 반영되지 않았다

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §R17 (diff 로 변경되지 않음)
- **과거 결정 출처**: `review/consistency/2026/08/14/12_06_21/cross_spec.md` CRITICAL 1 제안 ②: "`spec/5-system/14-external-interaction-api.md` §R17 에 '`getStatus` 의 `nodeOutput.meta.turnDebug[].llmCalls`' 를 명시적으로 다루는 문장 추가"
- **상세**: 코드는 waiting 분기에서 `stripExternalOnlyFields` 를 이제 호출하지만, R17 텍스트는 여전히 "`nodeOutput` 전체 ... `deepRedactSecrets` 로 마스킹한다"고만 서술해 `llmCalls` 필드 제거 단계가 spec 문면에 없다 — 코드가 spec 보다 안전하게 동작하는 방향의 drift 지만(정반대는 아님), CLAUDE.md 의 "결정의 배경·근거는 spec 문서 끝 `## Rationale`" 원칙상 이 신규 처방도 명문화가 필요하다. 위 CRITICAL 의 제안 ③(JSDoc 문구 정정)은 이번 diff 의 `strip-external-only-fields.ts` 신설로 사실상 처리됐으나(JSDoc 이 "SSE token holders never receive it" 류 과장 문구를 갖고 있지 않음), 제안 ②는 미착수 상태로 남았다.
- **제안**: 위 CRITICAL 수정과 함께 R17 본문에 `stripExternalOnlyFields`/`llmCalls` 를 명시하는 한 문장을 추가 (planner 턴 — `spec/` 쓰기 권한 소관).

---

## 요약

이번 diff 는 WS §4.4 strip-only 결정을 depth-1 → 깊이 무관으로 강화하고, 직전 라운드가 지적한 "REST `getStatus` 가 fanout 과 다른 방어를 쓴다"는 CRITICAL 을 닫으려 했다. 그러나 실제로는 `getStatus` 의 **두 표면 중 하나(대기 중 `nodeOutput`)만** 새 공유 유틸(`stripExternalOnlyFields`)로 강화했고, R17 이 명시적으로 같은 처리 대상으로 묶은 **나머지 하나(terminal `result`/`error` 의 `outputData`)는 이전 상태(`deepRedactSecrets` 단독)로 남았다** — WS §4.4 Rationale 이 이미 "부분적"이라며 기각한 값-레벨 마스킹이 이 표면에서는 유일한 방어로 남아 있다는 뜻이다. AI Agent 가 마지막 노드인 워크플로우가 COMPLETED/FAILED 로 끝나면 그 raw `llmCalls`(시스템 프롬프트 원문)가 워크스페이스 검증 없는 `iext_*`/`itk_*` 토큰으로 그대로 노출되는 경로가 실제로 남아 있고, 이는 이번 커밋이 스스로 닫았다고 주장하는 것과 같은 클래스의 결함이다. 새 Rationale 이나 plan 항목으로 이 축소를 명시적으로 인정한 흔적도 없어 "결정의 무근거 번복"(부분 이행을 완전 이행으로 서술)에 해당한다.

## 위험도

CRITICAL
