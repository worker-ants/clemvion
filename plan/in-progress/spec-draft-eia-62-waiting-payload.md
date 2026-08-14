---
title: EIA §6.2 waiting_for_input 예시가 실제 wire 와 전혀 다르다 — 실측 shape 으로 재작성
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-14
owner: project-planner
status: in-progress
priority: P1
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  # 루트 cross-cutting 문서다 — `spec/5-system/1-data-model.md` 는 실재하지 않는다.
  # `09_38_17` 부터 세 라운드 연속 지적됐는데 본문은 옳게 쓰고 frontmatter 만 틀린 채였다.
  - spec/1-data-model.md
  # (3) blockquote 정정과 (7) SoT 확장이 이 문서의 Rationale·§4.4 를 함께 건드린다.
  - spec/5-system/6-websocket-protocol.md
---

## Overview

`--impl-prep` `07_44_12` 의 CRITICAL 로 발견. checker 는 "봉투(`payload` 래퍼) 누락" 을
지적했는데, **직접 실측하니 안쪽 구조가 통째로 실제와 다르다.**

이 이벤트는 **외부 통합자가 소비하는 표면**이다. 문서대로 파서를 짜면 동작하지 않는다.

## 실측 — waiting_for_input emit 4곳 전수 (소스 직접 읽음)

| emit | 파일 |
|---|---|
| buttons | `button-interaction.service.ts:400` |
| form | `form-interaction.service.ts:117` |
| AI turn1 | `ai-turn-orchestrator.service.ts:575` |
| AI re-park | `ai-turn-orchestrator.service.ts:990` |

**공통 8**: `status` · `waitingNodeId` · `waitingNodeType` · `waitingNodeLabel` ·
`nodeExecutionId` · `startedAt` · `interactionType` · `conversationThread`

**표면별**:
- buttons → `buttonConfig: { buttons, nodeOutput }`
- form → `nodeOutput`
- AI → `nodeOutput: { interactionType, config?, conversationConfig, meta }`,
  turn1 은 추가로 `turnDebug: { llmCalls, metadata }`

봉투는 `notification-fanout.service.ts:134` 이 `payload: event.payload` 로 **변환 없이** 감싼다.

### 현행 §6.2 와의 대조

| 문서가 그리는 것 | 실제 |
|---|---|
| `node: {id, type, interactionType}` | flat `waitingNodeId`·`waitingNodeType`·`interactionType` |
| `interaction: {submitUrl, streamUrl, statusUrl, cancelUrl, token, expiresAt, expectedCommands}` | **코드 전체 0건** |
| `context: {formConfig, buttonConfig, conversationConfig, conversationThread}` | flat `nodeOutput`·`buttonConfig`·`conversationThread` |
| (언급 없음) | `waitingNodeLabel`·`nodeExecutionId`·`startedAt`·`turnDebug` |
| `payload` 래퍼 없음 | 있음 (§6 도입부 normative 규칙대로) |

## 변경 제안

### (1) §6.2 — **봉투만** 맞춘다 (caveat 패턴 유지, 안쪽 재작성 철회)

- §6.3/§6.4 와 동일하게 `payload:` 래퍼 + `// webhook 봉투 기준. SSE 는 payload 래퍼 없이
  안쪽 객체가 그대로 온다.` 주석
- **안쪽 JSON(`node`/`interaction`/`context`)은 그대로 둔다.**

> **초판은 "안쪽을 실측 키로 교체" 였다 — 철회한다.**
> WS Rationale `### §4.4 wire 필드 caveat`(2026-07-14, PR #945)가 **§6.2 를 실례로 들어**
> "직접 재작성 대신 caveat + 오너십 분리" 를 채택했고, 2026-08-13 에 `waiting_for_input`
> 범위로 재확인했다. 근거도 적혀 있다 — 논리 nested 구조가 가독성상 유리하고, JSON 전체를
> 실 wire 로 바꾸면 두 문서가 어긋난다.
>
> 즉 §6.2 의 `node`/`interaction`/`context` 는 **의도된 논리 표기**이고 실제 필드명은
> 아래 blockquote 가 SoT 로 소유한다. 내가 그걸 "허구" 로 진단한 것이 틀렸다
> (`09_38_17`·`12_06_21` rationale_continuity CRITICAL).
>
> **남는 진짜 결함은 둘뿐이다** — (a) 봉투 래퍼 누락(§6.3/§6.4 와 불일치), (b) 아래 (3)의
> blockquote 오서술. 그 둘만 고친다.

### (2) `interaction` 블록 — 삭제하지 않고 **Planned** 로 표기

`#1166` 이 `durationMs`/`result.outputs` 에 쓴 방식 그대로. 설계 의도를 보존하되
"지금 오지 않는다" 를 명시한다. `expectedCommands` 는 같은 문서가 이미
"현재 미구현 문서 필드" 라 적고 있어 표기가 일관해진다.

URL 예시는 `2-api-convention.md §1`(버전은 URL 경로에 미포함) 위반이고 실재하지 않는
도메인(`api.clemvion.ai`)이므로, 구현 시점의 형태를 `§4.1 endpoints` 와 같은 **상대경로**로 적는다.

### (3) "SSE 필드명 매핑" blockquote 정정

현행은 `node.id → waitingNodeId` 처럼 **webhook↔SSE 필드명이 다르다**고 서술한다.
실측: `notification-fanout.service.ts:134` 가 `payload: event.payload` 로 **변환 없이** 싣고,
참조 구현(`channel-web-chat/src/lib/eia-events.ts` `parseWaitingForInput`)은 `ev.waitingNodeId`
를 읽는다 → **두 채널의 필드명은 같고, 다른 것은 봉투뿐**이다.

→ blockquote 를 "webhook↔SSE 매핑" 이 아니라 **"논리 표기(위 JSON) ↔ 실제 wire 필드명"**
매핑으로 다시 쓴다. 화살표 자체는 유지된다 — 바뀌는 건 **화살표의 양변이 무엇이냐**다.
이렇게 하면 caveat 패턴(논리 JSON + 실 wire caveat)이 그대로 살고, 오직 틀린 서술
("채널에 따라 필드명이 다르다")만 걷힌다.

> **형제 plan 과 충돌한다** (`12_06_21` plan_coherence W5).
> [`spec-draft-eia-notification-payload-contract.md`](./spec-draft-eia-notification-payload-contract.md)
> 가 어제 "§6.2 blockquote 에는 필드명 매핑만 남았다 — 필드명까지 달라지는 유일한 경우" 로
> 완료 처리했는데, **그 전제가 실측으로 반증됐다.** 그 plan 에 반증 각주를 다는 것을 이
> 작업의 일부로 포함한다.

### (4) `error.code` 를 옵셔널로 (§6.4 + 필드 집합 표)

실측: 종결 `error` 를 싣는 4개 지점 중 `code` 를 실제로 갖는 것은 `finalizeFailedExecution`
의 sentinel 경로(`ErrorPortFallbackError`/`ExecutionTimeLimitError`)뿐이다.

일반 `catch` 에 fallback code 를 넣으면 **의미 없는 코드가 의미 있는 코드와 같은 자리에
섞여** 수신자가 분기할 수 없다. "코드 없음" 은 부재로 전달하는 편이 정직하다.

### (5) `1-data-model.md` §2.14 — `Execution.error` 구조에 nullable `nodeId`

EIA §6.4 는 이미 `"nodeId": "uuid" | null` 을 선언하는데 data-model 은 미반영.

### (6) 인용 오귀속 (L472·673)

"Conversation Thread §4.4.6" 이 실제로는 `6-websocket-protocol.md` 소속 헤딩을 가리킨다.
`conversation-thread.md` 에 대응 앵커가 없다 → WS 문서로 재지정 + §5.1 은 그대로 유지.

### (7) `llmCalls` strip SoT 가 실제 누출 표면을 안 덮는다

`11_02_18` convention_compliance WARNING 1. **코드가 고친 결함과 같은 클래스라 눈에 띈다.**

strip 결정의 SoT 는 WS §4.4 Rationale 의 `### ai_message.llmCalls[] 외부 수신자 strip`
항목이고 EIA 도 §6.5(`ai_message`)에만 명시가 있다. 그런데 **실제로 새던 곳은
`waiting_for_input`(§6.2)** 이다 — 어느 SoT 문서도 그 표면을 명시적으로 덮지 않았다.

문서의 보호 선언이 실제 표면보다 좁았고, 코드는 그 좁은 선언보다도 더 좁게(depth-1)
구현돼 있었다. **두 겹으로 좁았다.**

- WS §4.4 Rationale 제목·본문을 **"`llmCalls` 필드 외부 수신자 strip (위치·이벤트 무관)"**
  으로 넓힌다
- EIA §6.2 에도 §6.5 와 동형의 strip 명시 문장 + §R17 역참조
- 같은 턴에 수정 이력 addendum: *"2026-08-14: depth-1 구현이 중첩 경로 2곳에서 실제 누출
  중이었음을 발견 → 깊이 무관 strip + `__proto__` 오염 방지(`81f2c60d6`·`5df89cda6`)"*
  (`11_02_18` INFO 1 — WARNING 1 과 함께 해소된다)
- 코드 JSDoc 의 SoT 목록에도 EIA §6.2 추가

## 🔴 조사 중 발견 — `turnDebug.llmCalls` 가 외부 fanout 으로 새는 것으로 보인다

`--spec` `09_38_17` CRITICAL 3(`turnDebug` 이름 충돌)을 확인하다 **그보다 큰 것**이 나왔다.
이 draft 의 범위를 넘고 심각도가 높아 **별건으로 분리**한다.

### 정적 증거 (실측)

| # | 사실 | 위치 |
|---|---|---|
| 1 | 외부 fanout 은 `stripExternalOnlyFields(wireEnvelope)` 를 거친다 | `websocket.service.ts:479` |
| 2 | 그 목록은 `['llmCalls']` **하나**이고 삭제는 **최상위 전용(depth-1 shallow)** — 주석이 *"중첩 객체 내부의 동명 필드는 strip 되지 않는다"* 고 명시 | `:310`, `:303-305` |
| 3 | AI turn1 waiting emit 은 `turnDebug: { llmCalls: turnDebugHistory[0], metadata }` 로 **중첩**시킨다 | `ai-turn-orchestrator.service.ts:615-617` |
| 4 | `turnDebugHistory[i]` 는 `{turnIndex, llmCalls, …}` 이고 `llmCalls` 는 `requestPayload?`/`responsePayload?` 를 갖는다 | `ai-turn-executor.ts:2336-2349`, `llm-tracing/llm-call-record.ts:19-20` |
| 5 | WS spec 은 `llmCalls` 가 **모든 외부 수신자**(EIA SSE·notification webhook·chat-channel)에서 strip 된다고 선언 | `6-websocket-protocol.md:519` |

→ 외부 wire 에 `payload.turnDebug.llmCalls.llmCalls[].requestPayload` 가 실린다.
**시스템 프롬프트·대화 이력·사용자 입력**이 여기 들어갈 수 있다.

### ✅ 실증 완료 — 누출 확정, 그리고 **경로가 둘이다**

`websocket.service.spec.ts` 에 실 emit shape 그대로 프로브를 넣어 **외부 fanout envelope** 을
관측했다. 두 마커가 모두 wire 에 그대로 실렸다:

| 경로 | wire 위치 | 출처 |
|---|---|---|
| 1 | `payload.turnDebug.llmCalls.llmCalls[].requestPayload` | `ai-turn-orchestrator.service.ts:615` (turn1 스냅샷) |
| 2 | `payload.nodeOutput.meta.turnDebug[].llmCalls[].requestPayload` | `ai-conversation-helpers.ts:97` — `turnDebug: state.turnDebugHistory` **전체 히스토리** |

**경로 2 가 더 나쁘다** — 단발 스냅샷이 아니라 턴 누적 전체이고, WS §4.4:449 가 정의한
**정본 필드**다(`llmCalls` 는 "debug 탭 전용" 이라고 그 표가 직접 적고 있다).

기존 strip 테스트는 **최상위 `llmCalls`** 만, 그것도 `AI_MESSAGE` 에서만 봤다. 이 경로는
아무도 보지 않았고, 그래서 `EXTERNAL_STRIPPED_FIELDS` 가 "보호한다" 는 주장이 참인
표면보다 넓게 읽혀 왔다.

> 처음엔 경로 1만 보고 프로브를 쓸 뻔했다. WS 표가 `meta.turnDebug` 항목 shape 에 `llmCalls?`
> 를 적어 둔 것을 보고 자매를 세어 둘 다 넣었다 — **한쪽만 막으면 나머지가 남는다.**

### 처분 (실제 상태)

- [x] 실증 테스트 — `websocket.service.spec.ts` 에 실 emit shape 프로브. **두 경로 모두**
      외부 fanout 에서 관측됨(RED). 수정 후 GREEN 이고 그대로 회귀 가드가 됐다
- [x] 처방 — **(a) 깊이 우선 strip 채택**, 커밋 `81f2c60d6`.
      > 착수 전엔 *"(a) 는 비용이 크니 (b) 가 유력"* 이라 적었는데 **선택이 뒤집혔다.**
      > (b)(emit 에서 빼기)는 경로 2(`nodeOutput.meta.turnDebug`)를 못 막고,
      > (c)(최상위 이름 추가)는 이름 충돌을 고착시킨다. 필드명이 이미 **문서화된 비밀
      > 마커**라 위치가 아니라 이름으로 막는 게 맞았다. 비용 우려는 clone-on-write 로
      > 상쇄했고 "공통 경로 할당 0" 을 테스트로 단언했다.
- [ ] **이름 충돌은 이 커밋에 포함되지 않았다 — 별도 잔여.**
      `turnDebug`(top-level object `{llmCalls, metadata}`) vs `nodeOutput.meta.turnDebug`
      (배열, WS §4.4:449 정본). 당초 "이 처방과 함께 정리" 라고 적었으나 strip 패치만
      landed 했다 (`10_32_29` plan_coherence W3).
      → **planner 인계**: §6.2 재작성 시 top-level 을 리네임(`turnDebugSnapshot` 등)하거나
      disambiguation 문구를 예시 옆에 부착. 그대로 옮겨 적으면 spec 에 정식 충돌로 고착된다
      (`10_32_29` naming_collision CRITICAL 1).
- [ ] **planner 인계 (선택)**: `6-websocket-protocol.md` `## Rationale` 의 "strip-only 결정"
      항목에 *"2026-08-14: depth-1 이라 실제 누출 발견 → 깊이 무관 strip 으로 강화(`81f2c60d6`)"*
      한 줄 addendum (`10_32_29` INFO 3)
- [x] 성능 실측 — 옛 shallow 와 A/B 완료(커밋 `5df89cda6`). 8턴 `turnDebugHistory`
      waiting payload, N=3000: **0.0112 → 0.0314 ms/emit (2.80배, +20.2 µs)**.
      수치와 "두 pass 를 합치지 않은 이유" 를 `stripDeep` JSDoc §비용 에 남겼다.
      > **체크박스 drift 가 바로 다음 커밋에서 재발했다** — 직전 라운드(`10_32_29` W2)에
      > 같은 지적으로 `a9574f823` 을 만들었는데, **그 커밋에서 이 항목을 `[ ]` 로 새로
      > 추가**하고 실측 후 체크하지 않았다 (`11_02_18` plan_coherence W2). 항목을 닫는
      > 커밋과 체크박스를 갱신하는 커밋이 갈리면 매번 이렇게 된다.
- [ ] **`stripDeep` identity 캐시** (`11_02_16` performance W2). 형제는 `SANITIZE_CACHE`
      (WeakMap)로 반복 emit 을 O(1) 로 줄이는데 `stripDeep` 엔 없다. 지금 붙이지 않는 이유:
      두 캐시의 무효화 시점이 갈려 "sanitize 는 적중, strip 은 미적중" 조합이 생기고 그걸
      덮는 테스트가 없다. **관측되면** 붙인다(현재 비용 +20.2 µs/emit).
- [ ] **대용량 non-AI payload A/B** (`11_02_16` performance W3). A/B 를 AI 대화 payload 로만
      쟀는데, 이 diff 는 `llmCalls` 를 가질 수 없는 **모든 node 이벤트**에도 strip 을 건다.
      HTTP 응답 JSON 같은 대용량 `nodeOutput` 이 worst case 인데 측정 안 했다 —
      **"실측했다" 는 측정한 범위 안에서만 참이다.**
- [ ] 배열 부분 clone-on-write 다원소 fixture (`11_02_16` testing INFO 11) — 저비용
- [ ] **이미 유출된 데이터에 대한 사후 대응 — 운영 판단 필요.**
      CHANGELOG 에 *"이 경로로 나간 데이터는 이미 전송된 것"* 이라 적었으나 **어느 plan
      에도 추적 항목이 없었다** (`11_02_18` plan_coherence W3). 결정 대기 사항이
      CHANGELOG 에만 있으면 릴리스 노트와 함께 흘러가 버린다.
      - 확인할 것: 이 워크스페이스들이 실제로 외부 수신자(SSE 토큰·webhook·chat-channel)를
        붙여 썼는지, 붙였다면 기간과 대상. 프롬프트 민감도에 따라 통지 여부가 갈린다
      - 이건 코드가 아니라 **운영·정책 판단**이라 사용자 결정 사항으로 남긴다

## Rationale

**왜 삭제가 아니라 Planned 인가**: `finalNodeId`/`finalPort` 는 "엔진에 개념 자체가 없다"
(emit 로직 0건 + 계산 근거 없음)라 되살릴 것이 없었다. `interaction` URL 블록은 다르다 —
REST 엔드포인트(§5)가 실재하므로 **만들 수 있는 것을 아직 안 만든 것**이다. 두 경우를
같게 처리하면 "삭제된 약속" 의 의미가 흐려진다.

**왜 예시를 실측으로 맞추나(문서에 코드를 맞추지 않고)**: 이 필드명들은 이미 프론트엔드·
위젯·참조 구현이 소비 중이다. 문서 쪽 이름으로 바꾸면 **동작하는 외부 계약을 깨는** 변경이
되고, 그건 문서 오류를 고치는 비용보다 훨씬 크다.

## 체크리스트

- [x] 실측 (4개 emit 직접 읽기 + fanout 변환 여부 + 참조 구현 소비 키)
- [ ] `/consistency-check --spec` BLOCK: NO
- [ ] spec 반영 (6항목)
- [ ] `eia-terminal-payload.md` 차단 해제 후 `--impl-prep` 재실행
