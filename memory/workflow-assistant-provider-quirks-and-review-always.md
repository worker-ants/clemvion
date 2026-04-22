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

## 유지보수 체크리스트

- `stripHarmonyTokens` 추가 제어 토큰 관찰 시 `HARMONY_STANDALONE_TOKEN_REGEX` 유니온에 추가.
- `NODE_TYPE_ALIASES` 에 새 alias 추가 시 `shadow-workflow.spec.ts` it.each 케이스에도 추가.
- Review skip 조건 변경 시 `system-prompt.ts` Self-review 섹션 문구 동기화.
- Error UI 스타일 변경 시 systemHint 와 스타일 일관성 유지 (dark/light 모두 950/50 대비 규약).
