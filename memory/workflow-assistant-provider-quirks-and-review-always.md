# Workflow Assistant — 프로바이더 이상동작 대응 + review 항상 발동 (2026-04-23)

초기 self-review + 에러 풍부화 배포 후 다양한 LLM 프로바이더에서 관찰된 이슈에 대한 2차 대응을 정리.

## 1. 프로토콜 이상: tool_call + finishReason=stop (gpt-oss-120b)

### 증상
gpt-oss-120b 같은 오픈소스 서빙이 edit tool 호출 후에도 `finish` tool 을 부르지 않고 `finishReason: 'stop'` 으로 round 를 종료. LLM text 채널에는 "다음 단계 진행 중" 같은 내레이션을 남겨 사용자는 "멈춤" 으로 체감.

### 대응
`stream.service.ts` 루프 종료 조건 확장:
```ts
const hadSuccessfulEditThisRound = pendingResultsForLlm.some(...)
const shouldContinueLoop =
  pendingResultsForLlm.length > 0 &&
  (finishReason === 'tool_calls' ||
   (!finishResolved && hadSuccessfulEditThisRound));
```

**edit 가 실제로 성공한 round 에서만** round-trip. propose_plan / explore 만 있는 plan-only round 는 기존처럼 stop 으로 종료 (추가 round 의 ROI 없음).

### 프롬프트 강화
`STATIC_BLOCK_3_EDIT_PLAYBOOK` Closing the turn 섹션:
- **Past tense only** — "진행 중", "차례대로", "다음 단계", "이어서 진행하겠습니다" 등 미래형 내레이션 금지 (포착된 실제 leak 패턴).
- **finish 필수** — tool 호출 후 반드시 `finish` 를 명시 호출해야 함을 강조. 서버의 round-trip 은 fallback 이며 의존 금지.

## 2. Harmony control token 누수 (gpt-oss)

### 증상
gpt-oss-120b 가 `<|channel|>final<|message|>...` 같은 내부 제어 토큰을 응답에 노출. OpenAI SDK 의 SSE 파서가 이를 파싱하다 "Failed to parse input at pos 0: ..." 로 throw → 사용자에게 raw `LLM_CONNECTION_ERROR` 노출.

### 대응 (2계층)
`openai.client.ts`:
1. **Streaming stripping** — `delta.content` / tool_call arguments 에서 harmony 제어 토큰 제거. 패턴 2개 사용:
   - `HARMONY_CHANNEL_PREAMBLE_REGEX = /<\|channel\|>[\s\S]*?<\|message\|>/g` — preamble 전체 (channel 이름 포함) 한 번에.
   - `HARMONY_STANDALONE_TOKEN_REGEX = /<\|(channel|start|end|message|return|constrain|...)\|>/g` — 잔여 단독 토큰.
2. **Parse error 분류** — catch 블록에서 에러 메세지가 harmony 패턴 매치면 `LLM_OUTPUT_MALFORMED` 로 분류하고 사용자 친화적 한국어 안내문으로 치환. Raw 메세지는 UI 에 노출하지 않음 (로그에만).

## 3. 에러 UI 시안성 개선

### 증상
어시스턴트 패널 error box 가 `text-red-800/200` 탁한 shade 사용 → 배경과 대비 부족, 특히 11px 소형 텍스트에서 가독성 낮음.

### 대응
`assistant-message.tsx` 의 error box 를 systemHint 패턴과 동기화:
- 본문 텍스트: `text-red-950 dark:text-red-50` + `font-medium` — "가장 짙은 shade / 가장 옅은 shade" 대비 극대화.
- 에러 코드 pill: 별도 shade 배경 (red-200 light / red-800 dark) + border 로 명확히 구분.
- 본문 글자 크기 `10px → 11px` 로 상향 (message.error 타이틀과 동일 레벨).
- 긴 영문 에러 메세지 대비 `break-all` 추가.

## 4. Gemini-3-flash 존재하지 않는 노드 타입 발명

### 증상
Gemini-3-flash 이 `음식 종류 선택` 같은 label 로 add_node 시도 — catalog 에 없는 type 을 기본 시나리오 표현으로 발명. 첫 `UNKNOWN_NODE_TYPE` 응답의 `suggestedType` / `knownTypes` 힌트도 무시하고 반복 재시도.

### 대응
1. **`NODE_TYPE_ALIASES` 확장** — LLM 이 빈번히 발명하는 패턴을 실제 존재 타입으로 매핑 추가:
   - `user_input / input / question / prompt / survey / text_input` → `form`
   - `choice / choices / options / selection / selector / button_group / category / buttons` → `carousel`
   - `router / route / branch / conditional` → `switch` (boolean 은 `if_else`)
   - `email / send_mail / mail` → `send_email`
   - `display / show / render / result / output` → `template`

2. **프롬프트 강화** — `STATIC_BLOCK_3_EDIT_PLAYBOOK` Common pitfalls:
   - "Node types are a fixed catalog — do NOT invent new types based on your task wording." 추가.
   - 각 카테고리별 "흔한 오발명 → 실제 타입" 표 내장 (message/input/choice/branching/email 5계열).

3. **UNKNOWN_NODE_TYPE 시 suggestedType 을 알려주는 것에 더해 alias 매핑이 광범위해 대부분의 발명 패턴을 한 번에 교정**.

## 5. Review guard 항상 발동 (사용자 요구 반영)

### 증상
`finishBlockCount > 0` skip 조건 때문에 PLAN_NOT_COMPLETE 가 fire 한 다음에는 review 가 발동하지 않음. 사용자 보고: 복잡한 워크플로우에서 plan 가드를 통과한 뒤에도 orphan / pendingUserConfig 미안내 이슈가 여전히 발생.

### 대응
`evaluateReviewGuard` 의 `shouldSkipReview` 에서 `finishBlockCount > 0` 체크 **제거**. 두 가드는 독립 계층으로 운영:
- PLAN_NOT_COMPLETE — plan 체크박스 충족성 (step ↔ tool call 매핑)
- WORKFLOW_REVIEW_REQUIRED — 워크플로우 품질 (orphan / 실패 미해결 / pendingUserConfig 안내 / fake step 완료)

Plan 가드가 fire 했다는 것은 LLM 이 한 번 보정 했을 뿐, 결과 워크플로우의 품질을 보장하지 않음. 두 가드 모두 fire 하는 3~4 round 시나리오가 현실적 정상 경로.

### 남은 skip 조건 (최소 안전망)
- `reviewCompleted` / `reviewRoundCount >= 2` — 같은 턴 review 1회 상한
- `planClearedThisTurn` — 화제 전환
- 성공 edit 0 — 실행 턴 아님
- non-trigger 노드 ≤ 1 — trivial 편집 (ROI 낮음)

### PENDING_USER_CONFIG_UNMENTIONED 상세화
details 문자열에 구체적 노드 label + 빠진 selector 목록을 인라인으로 실어, LLM 이 다음 라운드 한국어 마무리 메세지 작성 시 즉시 참조할 수 있게 함. 예:
> "SendEmail (Integration); AIAgent (LLM Config). In the next round, emit a Korean summary that names each listed node label verbatim..."

> **2026-04-24 업데이트 — 본 가드는 이제 "candidate 0 인 항목" 에만 발동한다.**
> spec ED-AI-39 로 in-message candidate picker 가 도입되어, 워크스페이스에
> 후보가 1건 이상 있으면 프런트 picker 가 UX 를 완결한다. LLM 의 한국어
> mention 은 후보 목록이 비어있어 **사용자가 직접 Integration/LLM/KB/워크플로
> 를 등록해야 하는 경우에만** 필요하다. 상세는
> [workflow-assistant-candidate-picker.md](./workflow-assistant-candidate-picker.md).

## 6. Plan-only 턴의 핑퐁 루프 차단 (gemini-3-flash-preview)

### 증상
사용자 보고 (2026-04-23): 복합 설문조사 워크플로우 요청 → gemini-3-flash-preview 가
`propose_plan` 직후 `finish` 를 호출하지 않고 같은 턴에 수십 개의 edit 을 연쇄 발사.
프로바이더가 `finishReason: 'tool_calls'` 로 종료 → 서버가 round-trip → LLM 이
`PLAN_AWAITING_APPROVAL` 피드백을 보고도 또 edit 재시도 → `MAX_TOOL_LOOP_ROUNDS (50)`
도달 → 사용자 UI 에 "진행이 중단됐어요" + 수십 개의 빨간 배지.

### 대응 (서버 강제)
`stream.service.ts` 의 `shouldContinueLoop` 판정 앞에 단락 가드 추가:
```ts
const planProposedPendingApproval = !!planForTurn && !planForTurn.approvedAt;
if (planProposedPendingApproval) finishReason = 'stop';
const shouldContinueLoop = !planProposedPendingApproval && ...;
```

- Plan 을 제안했는데 아직 미승인 → 이번 턴 내 round-trip 금지 (1 라운드 종료).
- `finishReason` 을 `'stop'` 으로 덮어써 클라이언트가 "승인 대기" UI 로 전환.
- 시스템 프롬프트의 "Plan-only turn | Call finish immediately after propose_plan"
  규칙을 서버가 실제로 enforce. LLM 이 규칙 준수하지 않아도 핑퐁 루프는 발생 안 함.

### 호환성
- 정상 경로 (`propose_plan` → `finish` 한 라운드 내): `finishResolved=true`,
  `finishReason='stop'` 이 이미 내려가 있어 기존 `shouldContinueLoop=false` 로 자연 종료.
  가드는 중복 발동해도 동일한 최종 결과.
- `clear_plan` 이후 새 plan 없이 edit 만 하는 턴: `planForTurn=null` 이라 가드 미발동.
- History 에서 load 된 approved plan 실행 턴: `planForTurn=null`, 가드 미발동.

### 회귀 테스트
`stream.service.spec.ts` — "does NOT round-trip when a plan was proposed and is
pending approval, even if the provider reports finishReason=tool_calls
(Gemini-3-flash pattern)". `chatStream` 호출 횟수 1 + `finishReason=stop` + error
이벤트 없음을 동시에 고정.

## 7. Stall 자동 복구 (gpt-oss-120b 임의 중단)

### 증상
gpt-oss-120b 가 pending step 이 남은 plan 실행 턴에서 tool call 을 하지 않고
텍스트만 뱉고 `finishReason: 'stop'` 으로 종료. 기존 "edit 성공 round 에만 round-trip"
가드로는 cover 되지 않아 턴이 조용히 끝남. frontend 는 `turnStalledHint` 로
"이어서 진행해줘" 안내를 띄우지만 사용자가 수동으로 follow-up 을 입력해야 했다.

### 대응 (서버 자동 복구)
`stream.service.ts` 의 기존 `shouldContinueLoop` 뒤에 **stall 복구 블록** 추가:

```ts
const hasPendingActionableSteps = (() => {
  if (planPending || finishResolved) return false;
  if (pendingResultsForLlm.length > 0) return false;  // 이미 위 경로가 cover
  const ctx = findActivePlanContext(...);
  if (!ctx || ctx.status !== 'active') return false;
  return ctx.plan.steps
    .filter(s => s.action !== 'note')
    .some(s => !ctx.completedStepIds.has(s.id));
})();
if (hasPendingActionableSteps && consecutiveStallRounds < MAX_STALL_ROUNDS) {
  consecutiveStallRounds++;
  messages.push({ role: 'assistant', content: roundText });
  messages.push({ role: 'user', content: '이어서 진행해줘.' });
  continue;
}
```

- Text-only stall + pending plan → 서버가 user 역할의 nudge "이어서 진행해줘." 를
  messages 배열에 주입하고 루프 계속. LLM 은 다음 라운드에서 system prompt 의
  Active plan context + user nudge 를 보고 `[ ]` pending step 부터 resume.
- `MAX_STALL_ROUNDS = 2` 로 runaway 방지 — 2 번 연속 stall 하면 실제 막힌 상태로
  간주해 턴 종료 (MAX_TOOL_LOOP_ROUNDS=50 전에 탈출).
- 진척이 있는 라운드는 `consecutiveStallRounds = 0` 으로 리셋.
- 이 값 조정 시 `stream.service.spec.ts` "gives up after MAX_STALL_ROUNDS..." 고정
  테스트도 동시에 업데이트.

### 호환성
- Plan-only 턴 (미승인): `planPending` 단락으로 stall 가드도 건너뜀 — 사용자 approve
  대기가 올바른 상태.
- 이미 finish 성공: `finishResolved=true` 로 제외.
- Pending step 없음: plan 완료 상태면 nudge 의미 없음 → 가드 비발동.
- `pendingResultsForLlm.length > 0` 인 경우: 기존 shouldContinueLoop 가 이미 cover.

### 회귀 테스트
`stream.service.spec.ts` "auto-continue on stall with pending plan" describe:
- "auto-nudges LLM when a round ends text-only + stop + plan has pending steps"
- "gives up after MAX_STALL_ROUNDS (2) consecutive text-only stalls to prevent runaway loops"
- "does NOT auto-continue when plan has no pending actionable steps"

## 8. UX: plan-only 자동 안내 hint 제거 (2026-04-23)

### 증상
plan-only 턴에서 plan card 와 함께 "계획대로 진행해 주세요." systemHint 가 동시에
노출 → plan card 의 "계획대로 진행" 버튼 + 동일 문구의 info 박스가 중복 메시지로
인식. 사용자 피드백: 버튼이 이미 있으므로 hint 는 불필요.

### 대응
`frontend/src/lib/stores/assistant-store.ts` 의 done 이벤트 systemHint 분기에서
`planApproveConfirm` 주입 조건을 제거. `turnStalledHint` / `turnCompletedHint` 만
유지. i18n 문자열 자체는 `approveActivePlan` 이 user 메시지로 전송할 때 사용하므로
유지.

## 9. UX: 에러 버블에 "이어서 진행" 버튼 추가 (2026-04-23)

### 증상
`ASSISTANT_TOO_MANY_TOOL_CALLS` 에러 발생 시 사용자가 입력창에 "이어서 진행해줘"
를 직접 타이핑해야 복구 가능.

### 대응
- `continueAfterBudget` action 을 `assistant-store.ts` 에 추가 — `sendMessage`
  래퍼로 locale-aware 메시지 전송.
- `assistant-message.tsx` 에 `RESUMABLE_ERROR_CODES` 집합 (현재 `ASSISTANT_TOO_MANY_TOOL_CALLS`
  1 개) 을 정의, 에러 버블 아래에 "이어서 진행" 버튼 노출. `NO_LLM_CONFIG` /
  `STREAM_FAILED` 는 resume 불가이므로 버튼 없음.
- `assistant-panel.tsx` 가 `onContinueAfterBudget` 콜백을 `AssistantMessageView`
  로 주입해 snapshot 결합 유지 (plan approve 버튼과 동일 패턴).

## 11. NODE_NOT_FOUND label-lookalike hint (2026-04-24)

### 증상
LLM 이 `update_node` / `remove_node` / `add_edge` 의 `id` / `source_id` / `target_id`
자리에 사용자에게 보이는 **label** (예: `"SendEmail"`) 을 실수로 넣어
`NODE_NOT_FOUND` 가 연쇄 발생. 이로 인해 config patch 도 전혀 반영 안 되는
2차 증상까지 번짐.

### 대응 (2-layer)
1. **시스템 프롬프트 강화** (`system-prompt.ts`):
   - Contracts 블록 "Label vs identifier" 섹션에 "Tool arguments: always
     reference a node by its UUID, never by its label" 하위 문단 추가.
     UUID 의 유일한 출처 2가지 (`result.id` / `currentWorkflow.nodes[*].id`)
     명시 + 위반 예 (`update_node({id: "SendEmail"})`) 포함.
   - "Labels are globally unique" 문장에 "유일성은 add_node 충돌 감지용 —
     UUID 대체 근거 아님" 단서 병기.

2. **서버 label-lookalike hint** (`shadow-workflow.ts`):
   - `buildLabelAsIdHint(value)`: shadow 에 `node.label === value` 인 노드가
     있으면 `[hint] Value "<label>" matches the label of an existing node
     (id: <uuid>). ... [/hint]` 형태의 복구 문자열 반환. `findByLabel` 위임으로
     순회 로직 중복 제거. `sanitizeLlmProvidedString` 으로 label 을
     C0+C1+Bidi+zero-width 까지 중화 + `JSON.stringify` 로 escape.
   - `updateNode` / `removeNode`: `NODE_NOT_FOUND` 분기에 바로 hint 부착.
   - `addEdge`: **cascading failed-add_node FIFO 가 먼저**. 비었을 때만
     source 우선 label-lookalike fallback (target 은 source 매치 없을 때만).
     두 힌트가 섞이지 않도록 단일 hint.

### 호환성·주의
- `ShadowResult.hint` 는 기존부터 optional 필드. 기존 `NODE_NOT_FOUND` 소비자는
  hint 없이도 동일 동작.
- `value.length > LABEL_HINT_MAX_LEN * 4` 는 label 후보에서 제외 (Levenshtein
  유사 방어).
- `[hint] … [/hint]` 마커는 이번부터 label-lookalike 계열에만 적용. 기존
  cascading 힌트 등은 기존 형식 유지.

### 관련 spec
- `spec/3-workflow-editor/4-ai-assistant.md` §4.4.1 "NODE_NOT_FOUND hint 규칙"
  에 cascading / label-lookalike 의 발동 조건·우선순위·보안 정책 정리.
- §8 "워크플로우 조립 규칙" 행에 "tool argument id 자리 UUID 전용" 한 문장
  추가.

### 회귀 테스트
`shadow-workflow.spec.ts` → `NODE_NOT_FOUND label-lookalike hint` describe:
- update/remove/add_edge source/target 별 hint 부착
- 양측 label → source 단일 hint
- 공백 전용 id → hint 없음
- cascading FIFO 비어있을 때 label-lookalike fallback 반례
- cascading 우선순위 (FIFO 있으면 cascading hint)
- label sanitisation (newline, `<script>`)

`system-prompt.spec.ts` → "teaches that tool-argument id slots need UUIDs,
never node labels" 로 슬로건 고정 + `result.id` / `nodes[*].id` / "matches the
label of" 매칭.

관련 리뷰: `review/2026-04-24_18-27-09/`.

## 10. Stall 자동 복구 UX — 메시지 박스 분리 + `auto_resume` SSE 이벤트 (2026-04-24)

### 배경
§7 의 stall 복구가 발동하면 같은 `assistantText` 에 여러 라운드 텍스트가 누적되어
단일 `WorkflowAssistantMessage` row 로 저장된다. gpt-oss-120b 는 라운드 종료 직전
"계속 진행해도 될까요?" 같은 confirmation 문구를 반복적으로 뱉는 quirk 가 있어,
stall 전·후 라운드의 같은 문구가 한 버블 안에서 2~3번 겹쳐 UX 가 지저분해진다.

### 대응
**구조적 해결** — 서버가 stall 복구로 추가 라운드를 시작하는 순간, 누적된 텍스트를
별도 row 로 먼저 persist 하고 커서를 리셋한다. 이후 라운드는 새 row 에 누적된다.
프론트에게는 `event: auto_resume` 을 발행해 "새 버블로 분리해 달라" 는 신호를 준다.

**엔티티 변경** — `WorkflowAssistantMessage` 에 3개 필드 추가:
- `autoResumed: boolean` — 이 row 가 복구로 인해 새로 시작된 row 이면 true
- `autoResumeReason: string | null` — 현재 `'stall_pending_steps'` 한 종류
- `autoResumeAttempt: number | null` — 1..MAX_STALL_ROUNDS

마이그레이션 `V020__assistant_message_auto_resume.sql` 로 기본값 false / null 로
기존 row 호환.

**stream.service 변경** — stall 복구 블록 (§7) 에서:
```ts
// 1) 현재까지의 assistant 텍스트를 "중간 row" 로 먼저 persist
await this.persistAssistantTurn(sessionId, assistantText, pendingToolCalls,
  planPersisted ? null : planForTurn, null, 'auto_resume_pending',
  /* resumeMeta */ { autoResumed: false, ... });
if (planForTurn) planPersisted = true;
// 2) 누적 커서 리셋 — 다음 라운드는 새 row
assistantText = ''; pendingToolCalls = [];
// 3) SSE 로 프론트에 신호
yield { event: 'auto_resume', data: { reason, attempt, max } };
// 4) 기존 nudge 주입 + continue
```

턴 종료 시점의 최종 persist 에는 `autoResumed: consecutiveStallRounds > 0` 를 전달.

**`persistAssistantTurn` 시그니처 확장** — 마지막 파라미터로 `resumeMeta` 를 받고
기본값으로 `{autoResumed: false, autoResumeReason: null, autoResumeAttempt: null}`
를 쓴다. 기존 호출부 변경 최소.

**Plan 중복 방지** — 같은 턴 안에 plan 이 최초로 emit 되는 row 에만 plan 을 싣고,
그 뒤로 분리된 row 는 `plan=null` 로 persist. 로컬 `planPersisted` 플래그로 관리.

### 프론트 변경
- `AssistantSseEvent` union 에 `auto_resume` 추가 (api/assistant.ts)
- `AssistantDisplayMessage` 에 `autoResume?: {reason, attempt, max}` 추가
- `handleSseEvent` 는 그대로 유지하고, `sendMessage` 의 onEvent 콜백에서
  `auto_resume` 이벤트를 가로채 현재 `currentAssistantId` 를 새 UUID 로 갱신하면서
  새 assistant row 를 push.
- `hydrateMessage` 에서 서버의 `autoResumed=true` row 를 `autoResume` 메타로 복원.
- `assistant-message.tsx` 에서 `message.autoResume` 이 있으면 버블 위에 divider
  렌더 ("🔄 자동으로 이어서 진행했어요 (N/M)"). i18n `assistant.autoResumedHint`.

### 호환성
- 기존 row (autoResumed=false) 는 divider 가 표시되지 않음 → 기존 세션 그대로.
- 정상 턴 (stall 없음): `persistAssistantTurn` 이 한 번만 호출되어 row 1개.
- stall 1회 복구: row 2개 (`auto_resume_pending` + 최종). 최종 row 에만 autoResumed=true.
- stall 2회: row 3개. 최종 row 에 autoResumedAttempt=2.
- `MAX_STALL_ROUNDS` 상한에 걸려 포기하는 경우: 마지막 row 도 autoResumed=true 로
  persist (포기 직전 "이어서 진행해줘" 가 주입되지 않았지만 텍스트가 새 버블로
  분리되는 것은 동일하게 유지 — 서버가 분리 persist 를 이미 수행했음).

### 회귀 테스트
`stream.service.spec.ts` "auto-continue on stall with pending plan" describe 의
기존 3개 테스트에 다음 어서션 추가:
- `appendMessage` 호출 횟수가 (stall N회) + 1 개 (최종) 임을 확인.
- N+1 개 row 중 중간 row 들은 `finishReason='auto_resume_pending'`, `autoResumed=false`.
- 최종 row 는 `autoResumed=true`, `autoResumeReason='stall_pending_steps'`,
  `autoResumeAttempt=N`.
- SSE 이벤트 스트림에 `event: 'auto_resume'` 이 N회 포함, attempt 가 1..N 순증.
- plan 은 최초 emit 된 row 에만 실리고 이후 row 들의 plan=null.

`assistant-store.test.ts` — `auto_resume` 이벤트 수신 시 messages 배열에 새 row 가
추가되고 `streamingMessageId` 가 갱신되며, `autoResume` 메타가 세팅되는지 검증.

## 유지보수 체크리스트

- `stripHarmonyTokens` 추가 제어 토큰 관찰 시 `HARMONY_STANDALONE_TOKEN_REGEX` 유니온에 추가.
- `NODE_TYPE_ALIASES` 에 새 alias 추가 시 `shadow-workflow.spec.ts` it.each 케이스에도 추가.
- Review skip 조건 변경 시 `system-prompt.ts` Self-review 섹션 문구 동기화.
- Error UI 스타일 변경 시 systemHint 와 스타일 일관성 유지 (dark/light 모두 950/50 대비 규약).
- Plan-only 가드 (`planProposedPendingApproval`) 의 단락 조건 변경 시 위 "호환성" 3개 시나리오
  모두 회귀 테스트로 고정되어 있는지 확인. `stream.service.spec.ts` 에서 `finishReason=stop`
- `MAX_STALL_ROUNDS` / stall 가드 조건 변경 시: "auto-continue on stall with pending plan"
  describe 의 3 테스트 (auto-nudge / max-stall / no-pending-steps) 동시 업데이트 +
  §10 의 row 분리 / auto_resume 이벤트 어서션도 같이 업데이트.
- `auto_resume` SSE event schema 변경 시: backend `AssistantStreamEvent` union,
  frontend `AssistantSseEvent` union, controller 가 단순 JSON.stringify 하므로
  별도 DTO 없음. `assistant.autoResumedHint` i18n 포맷 (`{{attempt}}/{{max}}`) 도
  페이로드 shape 에 묶여있으니 payload key 이름 변경 시 placeholder 동시 업데이트.
- `WorkflowAssistantMessage` 에 신규 필드 추가 시: migration SQL 과 entity 의
  nullable/default 가 일치해야 한다 (autoResumed default false, 나머지 null).
  `appendMessage` 의 `Partial<WorkflowAssistantMessage>` 수용 패턴 덕분에 서비스
  계층 호출부 변경은 불필요.
- `RESUMABLE_ERROR_CODES` 에 새 에러 코드 추가 시: (1) backend 가 실제로 해당 코드 발행하는지
  확인, (2) "이어서 진행해줘" follow-up 이 의미있는 복구인지 재검토, (3) `continueAfterBudget`
  대신 별도 resume 액션이 필요한지 판단.
  을 기대하는 기존 플래닝 관련 테스트들이 이 가드에 의해 영향받지 않아야 한다.
