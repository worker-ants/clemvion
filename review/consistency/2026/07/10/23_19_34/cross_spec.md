# Cross-Spec 일관성 검토 — EIA/WS continuation 명령 ↔ 대기 노드 표면 매트릭스 가드

검토 모드: `--impl-prep` (착수 예정 구현, scope=`spec/5-system/14-external-interaction-api.md` 및 실행 엔진 공유 chokepoint)

## 총평 (검토 전 확인한 사실 관계)

구현 계획을 뒷받침하는 근거를 코드·spec 양쪽에서 직접 추적한 결과, **핵심 설계(에러 코드 재사용·AI 표면 4종 허용)는 기존 spec 이 이미 명시적으로 요구하는 동작과 정합**한다. 아래 발견사항은 대부분 "충돌"이 아니라 **매트릭스 도입이 함께 건드려야 할 인접 영역**(같은 target 문서 내부 정합성, 인접 노드 타입의 동일 버그 클래스, 문서 touch-up)이다. CRITICAL 은 없다.

---

## 발견사항

### 1. [WARNING] EIA §6.2 `expectedCommands` 광고 필드가 신규 매트릭스보다 좁다 (동일 target 문서 내부 불일치)

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §6.2 (outbound notification payload), L560-562 — `interactionType: 'ai_conversation'` 일 때 `expectedCommands: ["submit_message", "end_conversation"]` 로 **2종만** 광고.
- **충돌 대상**: 이번 구현이 도입하려는 매트릭스는 `ai_conversation`/`ai_form_render` 대기에 **4종 모두** 허용한다. 동일 target 문서(§5.1 "적용 노드" 컬럼, L285-290)의 명령별 "적용 노드" 표는 반대로 `submit_form`→Form, `click_button`→Carousel/Table/Chart/Template 로 좁게 서술한다.
- **상세**: `expectedCommands` 는 현재 코드베이스에 구현이 전혀 없다(grep 0건, `notification-fanout.service.ts`/`dto/responses.dto.ts` 모두 미사용) — 순수 문서 스펙이다. 반면 `AI Agent §6.2 step 2.c.fallback`(`spec/4-nodes/3-ai/1-ai-agent.md:404`)은 "`pendingFormToolCall` 누락 시 (invariant 예외) — silent drop 금지 — form JSON 데이터를 plain `ai_user` 메시지로 push"를 명시하고, `Presentation §10.9`(`spec/4-nodes/6-presentation/0-common.md:412`)는 "button_click ... 도달하게 되면 else 분기(warn+no-op park)가 graceful degradation"을 명시한다. 즉 **더 깊은 layer(AI Agent §6.2, Presentation §10.9)는 이미 `ai_conversation` 대기 중 submit_form/click_button 도착을 정상 시나리오로 취급**하고 있으며, 새 매트릭스의 "4종 모두 허용"은 이 기존 계약과 정합한다. 문제는 §6.2 의 `expectedCommands` 필드만 이 사실을 반영하지 못해 **같은 문서 안에서 광고값(2종)과 실제 서버 수용 범위(4종)가 어긋난다**는 점이다.
- **제안**: (a) 이번 구현 범위에서 `expectedCommands` 를 건드리지 않는다면 최소한 §6.2 에 각주로 "서버는 `ai_conversation`/`ai_form_render` 대기 중 4종 모두 수용하나(관용/graceful fallback, §6.2 step 2.c / §10.9 참조), 본 필드는 **권장** 명령만 광고한다"는 구분을 명시할 것. (b) 향후 `expectedCommands` 를 실제로 구현하게 되면 이 두 표(§5.1 적용 노드, §6.2 expectedCommands)와 신규 매트릭스 3개가 동시에 정합해야 함을 사전에 기록해 둘 것.

### 2. [WARNING] `판정 불가 → fail-open` 이 인접 §7.5 dispatch 게이트의 fail-closed 관례와 어긋난다

- **target 위치**: 구현 계획의 "판정 불가(legacy row) → fail-open" 결정 (`resolveWaitingNodeExecutionId` 신규 로직).
- **충돌 대상**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1898-1919` (`dispatchResumeTurn`) — 동일 layer, 동일 `persistedInteractionType` 신호를 쓰는 **자매 게이트**가 이미 존재하며, 이 게이트는 매칭 handler 를 못 찾으면 **fail-closed**로 `RehydrationError('RESUME_CHECKPOINT_MISSING', ...)` 를 throw 한다 (`resolveWaitingNodeExecutionId` 처럼 조용히 통과시키지 않음).
- **상세**: 코드베이스 전반의 fail-open/fail-closed 관례를 조사한 결과(`spec/5-system/12-webhook.md` §공개 webhook throttle Guard, `spec/5-system/4-execution-engine.md` §sub-workflow workspace 격리 fail-closed 전환, `spec/7-channel-web-chat/4-security.md` §R3 등), **fail-open 은 일관되게 "인프라 가용성 저하"(Redis/DB 장애) 시나리오 전용**이고, **데이터 무결성/상태 정합성 게이트는 fail-closed 가 원칙**이다(예: `assertSameWorkspace` 가 "fail-open→fail-closed 전환"까지 거친 전례, PR #637). 이번 신규 매트릭스는 인프라 장애 대응이 아니라 "커맨드 표면 정합성" 데이터 게이트이므로, 관례상 **판정 불가 시에도 fail-closed(409 반려)가 더 일관적**이다. 다행히 실질 blast radius 는 좁다 — `dispatchResumeTurn` 의 `'buttons'`/`'ai_conversation'` 엔트리는 `persistedInteractionType`/`isAiConversation` 로 selects() 하므로 legacy 판정불가 행은 어차피 handler 매칭에 실패해 `RESUME_CHECKPOINT_MISSING` 으로 하류에서 걸러진다(방어선 이중화). 위험이 실제로 남는 것은 `'form'` 엔트리뿐이다 — 이건 `blockingInteraction === 'form'` 이 **정적** `node.type` 핸들러 메타데이터로 항상 결정되므로 (persisted 메타와 무관), "판정 불가"라도 강제로 form 처리기로 들어가 §10.9 에서 이미 지적된 "sentinel 없는 폴백" 취약점을 그대로 재현할 수 있다.
- **제안**: fail-open 을 유지하려면 Rationale 에 "왜 이 게이트만 예외적으로 availability-우선인가"를 명시하고, 최소한 `'form'` 정적 매칭 케이스(legacy 판정불가 + node.type=form)에 한해서는 fail-closed 로 좁히는 것을 검토할 것. 또는 단순화를 위해 게이트 전체를 fail-closed 로 통일하고(§7.5 자매 게이트와 동형), "판정 불가"가 실제로 발생 가능한지(=`outputData.meta.interactionType` 이 이미 §7.5 rehydration 의 필수 신호로 쓰이고 있어 사실상 전 blocking 타입에 이미 요구되는 값인지)를 먼저 실증해 빈 집합이면 정책 충돌 자체가 무의미해진다는 점도 함께 기록.

### 3. [WARNING] 동일 버그 클래스가 `buttons` 표면에도 존재 — 매트릭스가 암묵적으로 동작을 바꾸지만 계획에 명시되지 않음

- **target 위치**: 구현 계획은 "재현된 문제"를 Form 대기 + `end_conversation` 사례로만 서술한다.
- **충돌 대상**: `codebase/backend/src/modules/execution-engine/button-interaction.service.ts:37-106` — `resolveButtonInteraction` 의 "(d) fallback — `type !== 'button_click'` → `continue`" 로직. `resumeTurnRegistry` 의 `'buttons'` 엔트리는 `persistedInteractionType==='buttons'` 로만 selects 하고(도착 payload 의 type 은 보지 않음, 발견사항 #2 와 동일 구조), `processButtonResumeTurn` 내부에서 `isButtonClickPayload` 가 false 면 **암묵적으로 `_selectedPort='continue'`** 를 선택해 노드를 완료시킨다.
- **상세**: 즉 buttons 대기 중 `end_conversation`/`submit_form`/`submit_message` 가 도착해도 현재는 에러 없이 "Continue 버튼을 누른 것"처럼 조용히 처리된다 — Form 사례만큼 "빈 데이터로 오염"되지는 않지만, **의도치 않은 그래프 분기(엉뚱한 포트로 진행)**라는 유사한 무결성 문제다. 신규 매트릭스("buttons 대기 → click_button 만")가 publisher 단계에서 먼저 거부하게 되면 이 (d) fallback 경로는 사실상 도달 불가능해진다 — 이는 **바람직한 부수효과**이지만, 계획서에 명시되지 않아 (a) 구현 시 이 회귀 테스트가 누락될 위험, (b) `spec/4-nodes/6-presentation/0-common.md` 가 AI 표면(§10.9)만큼 이 buttons fallback 동작 변화를 문서화하지 않아 spec-코드 정합성이 다시 벌어질 위험이 있다.
- **제안**: 구현 시 이 buttons 시나리오도 회귀 테스트에 포함하고, `spec/4-nodes/6-presentation/0-common.md` 에 §10.9 와 대칭되는 절(또는 §10.9 확장)로 "buttons 대기 중 비-`button_click` 도착은 이제 publisher 단계 409 로 거부되며, 과거의 암묵적 `continue` 폴백은 legacy-row fail-open 케이스에서만 잔존한다"를 명시할 것.

### 4. [INFO] `POST /api/executions/:id/continue` 스펙 문구가 게이트의 확장된 트리거 조건을 반영하지 못함 (cross-spec 영향 범위 문서화 누락)

- **target 위치**: `spec/3-workflow-editor/3-execution.md:334` — "`POST /api/executions/:id/continue` ... 대기 상태가 아니면 422 `INVALID_STATE`".
- **충돌 대상**: `resolveWaitingNodeExecutionId` 는 EIA 뿐 아니라 이 REST `/continue` 엔드포인트(`codebase/backend/src/modules/executions/executions.controller.ts:165-181`, `continueExecution` 경유)와도 공유되는 **단일 chokepoint** — 다른 spec 영역(`3-workflow-editor`)에 실질 영향이 미친다.
- **상세**: `/continue` 는 코드상 form 데이터만 받는 form-only 엔드포인트다(body `{ formData? }`). 현재는 `resolveWaitingNodeExecutionId` 가 노드 타입을 보지 않으므로, waiting 노드가 buttons/ai 인데 `/continue` 를 호출하면 **오늘도** form 폴백 경로(§10.9 의 "sentinel 없는 폴백")를 그대로 타 동일 버그 클래스가 발생할 수 있다. 신규 매트릭스가 이 경로도 함께 막아주는 것은 바람직하지만, target 문서의 "대기 상태가 아니면" 이라는 문구는 "대기 중이지만 표면이 다름" 케이스를 포함하지 않아 문서상 트리거 조건이 새 동작보다 좁다.
- **제안**: `spec/3-workflow-editor/3-execution.md` §9 의 해당 행을 "대기 상태가 아니거나 대기 중인 노드가 Form 표면이 아니면 422 `INVALID_STATE`"로 살짝 확장하고, 이번 EIA 작업과 같은 PR/후속에서 함께 갱신할 것 (target 문서 밖 영역이라 project-planner 의 별도 손질 필요).

### 5. [WARNING] `hooks.service.ts` graceful catch 가 silent 202 swallow 라면 chat-channel 의 "항상 사용자 안내" 관례와 어긋난다

- **target 위치**: 구현 계획 "부수: `hooks.service.ts` 의 `forwardToInteractionService` 가 ConflictException(STATE_MISMATCH) 을 graceful catch".
- **충돌 대상**: `spec/5-system/15-chat-channel.md` 의 기존 UX 관례 — CCH-CV-03("running" 안내, L68) / `languageHints.sessionExpired`(L224, §7.5 rehydration 실패 안내) / CCH-ERR-04("silently swallow 금지", L102) — **사용자가 보낸 진짜 메시지**가 처리되지 못하는 경우 항상 설명 메시지를 보낸다는 일관된 패턴. (silent 202 skip 은 봇/그룹챗/rate-limit 등 **사용자 발화가 아닌** 케이스에만 쓰인다, L410-417 표.)
- **상세**: 실제로 이 catch 가 발동하는 구체 시나리오를 추적하면: `hooks.service.ts:589-618` 에서 `state?.formState` 가 **미설정**(= native-modal Form 대기 중이거나 buttons/carousel 대기 중)인 상태로 사용자가 자유 텍스트를 보내면 `forwardToInteractionService` 가 무조건 `command:'submit_message'` 로 EIA 를 호출한다 — 오늘은 이것이 §10.9 "sentinel 없는 폴백"을 타 **빈 폼이 조용히 제출되는 버그**를 재현하고, 신규 게이트 이후에는 **409 로 거부**된다. 계획의 "graceful catch" 가 단순히 로그만 남기고 202 로 삼키면, 사용자 입장에서는 "메시지가 사라짐"이라는 다른 종류의 UX 결손이 남는다(데이터 오염보다는 낫지만, chat-channel spec 의 기존 안내 관례에는 못 미침).
- **제안**: 이 catch 지점에서도 `sendExecutionStillRunningNotice`/`reNoiseFormModal` 과 같은 패턴으로 사용자에게 간단한 안내(예: "지금은 자유 텍스트를 받을 수 없어요, 버튼/폼으로 응답해주세요")를 best-effort 발송할 것을 검토. 신규 `languageHints` 키가 필요하면 `spec/5-system/15-chat-channel.md` §4.1 표(L217-233)에 함께 등재해야 한다. 최소한 silent-swallow 로 결정한다면 그 근거(예: "버튼/폼 대기 중 자유 텍스트는 CCH-MP-02/03 UI 설계상 애초에 발생하지 않아야 하는 edge race 이므로 안내 비용이 낮다")를 Rationale 에 남길 것.

---

## 확인된 정합성 (충돌 아님 — 참고용)

- **에러 코드 재사용은 완전히 정합**: `spec/5-system/4-execution-engine.md` §7.5.1(L1039-1054), `spec/5-system/14-external-interaction-api.md` §5.1(L341) + R13(L1066-1078), `spec/conventions/error-codes.md`/`spec/5-system/3-error-handling.md`(L86-157) 세 곳 모두 `InvalidExecutionStateError → EIA 409 STATE_MISMATCH / WS ack INVALID_EXECUTION_STATE / REST `/continue` 422 INVALID_STATE` 매핑을 이미 SoT 로 명시한다. 신규 코드 불필요 — 계획과 정확히 일치.
- **`ai_form_render` 를 AI 서브스테이트로 취급하는 것은 spec 상 정당**: `spec/conventions/interaction-type-registry.md` §1.2(L48, L55)가 이미 "`ai_form_render` 는 별도 registry 항목이 아니라 `ai_conversation` 항목이 함께 매칭"한다고 명시한다.
- **AI 표면 4종 허용의 근거가 명확히 존재**: `spec/4-nodes/3-ai/1-ai-agent.md:404`(submit_form silent-drop 금지 fallback), `spec/4-nodes/6-presentation/0-common.md:412`(button_click graceful re-park invariant), `codebase/.../ai-turn-orchestrator.service.ts:305`(stale inline_keyboard 로그) 세 곳이 모두 "AI 대기 중 이종 명령 도착은 정상적으로 관용 처리되어야 한다"를 이미 전제하고 있다.
- **widget-app.md §3.1/R7 은 충돌이 아니라 클라이언트측 선제 방어**: 위젯은 이미 대기 표면이 `ai_conversation`+nodeId 확정일 때만 `end_conversation` 을 보내고, 그 외(buttons/form 대기, nodeId 미확정)에는 범용 `cancel` 을 쓴다(L86, L170-173). 서버측 매트릭스는 이 클라이언트 설계를 방어적으로 재확인(defense-in-depth)할 뿐 모순되지 않는다.
- **RBAC/정보노출 관점 이슈 없음**: 신규 409 응답의 상세 메시지가 노출하는 정보(대기 노드의 실제 interactionType)는 토큰 보유자가 이미 `execution.waiting_for_input` SSE/webhook 이벤트에서 알고 있는 정보와 동일 범주라 §8.2 정보노출 최소화 원칙과 충돌하지 않는다.

---

## 요약

이번 구현 계획의 핵심 설계(퍼블리셔 chokepoint 위치, 에러 코드 재사용, AI 표면 4종 허용)는 코드·spec 교차검증 결과 기존 계약과 견고하게 정합하며 새 요구사항 ID/엔티티/RBAC 충돌은 발견되지 않았다. 다만 (1) 같은 target 문서 안에서 `expectedCommands` 광고값이 실제 허용 범위보다 좁고, (2) fail-open 선택이 인접 §7.5 dispatch 게이트의 fail-closed 관례에서 벗어나며, (3) 동일 버그 클래스가 `buttons` 표면에도 존재해 매트릭스가 암묵적으로 그 동작까지 바꾸지만 계획서·presentation spec 모두 이를 명시하지 않고, (4) `POST /continue`(다른 spec 영역)의 문구가 확장된 트리거 조건을 반영하지 못하며, (5) chat-channel 의 graceful catch 가 이 spec 영역의 "항상 사용자 안내" 관례에서 벗어날 위험이 있다. 다섯 건 모두 구현을 막는 직접 모순은 아니지만, 착수 전 명시적 결정(또는 후속 spec 갱신 커밋)이 필요하다.

## 위험도

MEDIUM
