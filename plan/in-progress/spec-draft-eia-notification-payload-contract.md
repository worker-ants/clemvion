---
status: in-progress
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-13
owner: project-planner
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/5-system/6-websocket-protocol.md
  - spec/conventions/chat-channel-adapter.md
  - spec/3-workflow-editor/3-execution.md
pending_plans:
  - plan/in-progress/spec-sync-external-interaction-api-gaps.md
  - plan/in-progress/spec-sync-websocket-protocol-gaps.md
---

# spec draft — 종결 이벤트 payload: 필드 집합을 단일 SoT 로, 봉투는 채널별 1회

## 왜

`14_18_42` cross_spec **CRITICAL** — 종결 이벤트(`execution.completed`/`failed`/`cancelled`)의
문서화된 payload 가 실제와 다르다. spec 을 믿고 연동한 외부 고객은 문서화된 필드를 전부
`undefined` 로 받는다.

그런데 그 CRITICAL 을 고치려는 시도가 **`--spec` 에서 3회 연속 반려**됐고, 세 번 다
"같은 규칙을 일부 절에만 적용" 이었다:

| 라운드 | 놓친 적용처 |
|---|---|
| `15_15_08` | WS §4.1 을 `cancelled` 행만 · `chat-channel-adapter.md` 누락 |
| `15_28_10` | `payload` 봉투를 §6.3 에만 |
| `15_45_53` | `cancelledBy` 캐비엇을 §6.5·adapter 에만 |

**세 번의 반려가 원인을 가리킨다.** `cancelledBy` 하나가
`14-external-interaction-api.md`(3회) · `6-websocket-protocol.md`(1회) ·
`conventions/chat-channel-adapter.md`(2회) 에 **각자 필드를 열거**하는 형태로 존재한다.
이 구조에서는 어떤 변경도 N번 손으로 적용해야 하고, 한 번만 빠뜨리면 그 자리가 새 drift 다.

이 저장소는 같은 문제의 해법을 이미 갖고 있다 —
[`conventions/redis-keys.md`](../../spec/conventions/redis-keys.md):
*"인벤토리는 **포인터만** 갖는다. 한 표에 상세까지 모으면 그 표가 곧 두 번째 SoT 가 된다."*
종결 이벤트 payload 에는 그 원칙이 적용된 적이 없다.

## wire 는 **셋**이다 — 그리고 그 사실은 §6.2 에 이미 적혀 있었다

> 4차 draft 는 "두 wire(WS / webhook·SSE)" 라 적었고 `16_18_00` 이 CRITICAL 로 반려했다.
> **맞는 반려다.** 나는 `emitExecutionEvent` 의 **생산자 분기 두 개**를 재고 "둘" 이라
> 결론했는데, 그중 fanout 갈래를 **소비자 둘이 서로 다르게** 변형한다. 생산자를 재고
> 소비자를 안 잰 것 — 이 세션이 반복한 "한 지점 재고 일반화" 다.

생산자 (`websocket.service.ts` `emitExecutionEvent` L453-489):

- `wireEnvelope` = `{ executionId, ...payload필드, seq, timestamp }` — flat
- `fanoutEnvelope` = `wireEnvelope` + routing context (`triggerId`/`workflowId`, L576-582)

소비자에서 갈린다:

| # | 채널 | 최종 wire | 근거 |
|---|---|---|---|
| 1 | **WS** (에디터) | `wireEnvelope` 그대로 — flat | `broadcastToChannel` L471 |
| 2 | **SSE** (외부 스트림) | `fanoutEnvelope` **그대로** — flat + `triggerId`/`workflowId`. **재래핑 없음** | `writeSseFrame` 이 `JSON.stringify(event.payload)` — `interaction-stream.controller.ts:167` |
| 3 | **webhook** (outbound notification) | `fanoutEnvelope` 를 **`payload` 키에 통째로** 넣고 다시 감쌈 → `executionId`·`seq`·`timestamp` 가 **바깥과 안쪽에 중복** | `notification-fanout.service.ts` L123-137 |

**`payload` 래퍼는 webhook 전용이다.**

그리고 이건 미기록 사실이 아니었다 — EIA **§6.2 의 blockquote**(L615)가
*"SSE 스트림은 notification envelope 재구성 없이 fanout wire 를 그대로 전송"* 이라고
이미 적고 있다. **§6.3~§6.5 에만 없다.**

즉 내 오독의 원인이 이 draft 가 고치려는 결함 그 자체다 — **같은 규칙이 일부 절에만
적혀 있으면, 나머지 절만 읽은 사람은 반드시 틀린 일반화를 한다.** 반려 5회 중 3회가
"규칙을 일부 절에만 적용" 이었는데, 이번엔 내가 그 문서의 **피해자** 쪽에 섰다.
(B)단일화의 근거가 하나 더 늘었다.

## 결정 — 필드 집합은 1곳, 봉투는 채널별 1곳, 나머지는 포인터

### (1) EIA **§6 도입부**(번호 없는 절)에 공유 필드 집합을 둔다 — **재넘버링 없음**

> 4차 반려(`16_04_30`)의 CRITICAL 은 "§6.3 신설 → §6.4~§6.6 이 밀림 → 참조가 stale" 이었다.
> **그 반경을 추적하는 대신 없앴다.** `## 6.` 과 `### 6.1` 사이가 **비어 있어**(실측) 거기에
> 번호 없는 도입부로 넣으면 기존 번호가 하나도 안 밀린다.
>
> 재넘버링을 했다면 깨졌을 참조 — `grep -rn "EIA §6\.\|external-interaction-api.md#6" spec/ codebase/`
> 로 **spec·코드 합쳐 ~15곳**(`sdk/src/client.ts` 의 `§6.2~§6.5`,
> `notification-dispatcher.types.ts` 의 `§6.6`, `chat-channel/types.ts` 의 `§6.5 line 536` 등).
> **§6.1~§6.6 헤딩은 문구까지 그대로 둔다** → 파생 마크다운 앵커 4곳도 살아남는다.

도입부가 소유하는 것 — **종결 이벤트가 실어 나르는 사실(유일한 규범 필드 집합)**:

| 필드 | 상태 | 비고 |
|---|---|---|
| `status` | 구현됨 | `completed` \| `failed` \| `cancelled` |
| `error` | 구현됨(형태 불일치) | **현행 일부 경로 string** — 목표는 `{code,message,nodeId,details?}` |
| `result.cancelledBy` | 구현됨(경로 1곳 누락) | `cancelled` 한정. `retry-turn.service.ts` `failRetryExecution` L956 은 emit 안 함 |
| `result.outputs` | **미구현 (Planned)** | 데이터는 emit 직전 존재 |
| `durationMs` | **미구현 (Planned)** | 데이터는 emit 직전 존재 |
| ~~`finalNodeId`·`finalPort`·`nodeCount`·`failedNodeId`~~ | **삭제** | emit 로직 0건 — 엔진에 개념이 없다. 약속을 철회한다 (`chat-channel/types.ts:388` 의 미사용 타입 흔적은 후속에서 함께 정리) |

### (2) 봉투는 **세 갈래를 한 자리에** 적는다

- **EIA §6 도입부** — webhook 과 SSE 를 나란히:
  - **webhook**: `{type, executionId, triggerId, workflowId, seq, timestamp, payload:{…}}`.
    `executionId`·`seq`·`timestamp` 의 **안팎 중복**도 여기 적는다.
  - **SSE**: `payload` 래퍼 **없이** flat (+`triggerId`/`workflowId`).
    §6.2 L615 blockquote 와 **같은 사실**이므로, 그 서술을 도입부로 끌어올려
    5종 이벤트 전체에 걸리게 한다 (§6.2 에는 waiting 고유 필드 예시만 남긴다).
- **WS §4.1** — flat 봉투. **필드 열거를 버리고** "(1) 의 필드 집합이 flat 하게 펼쳐진다"
  + "webhook 봉투와 다르다(§6 도입부)" 두 줄로.
- **§6.3~§6.5 본문**은 (1)·(2) 참조로 축약. **헤딩은 건드리지 않는다.**

> **표기 caveat** (`16_18_00` naming WARNING 2): WS §4.1 과 `3-execution.md` §8.1 은
> `duration`(Ms 없음)을 쓴다. 의미는 (1) 의 `durationMs` 와 같지만 **전역 개명은 비목표**다.
> 따라서 **기존 표기는 그대로 두고**, (1) 표에 "WS 계열 문서는 같은 값을 `duration` 으로
> 적는다" 를 한 줄 명시한다 — 지시와 비목표가 상충하지 않게.

> **행동 계약은 필드 열거와 함께 버리지 않는다** (`16_18_00` plan_coherence WARNING 1).
> `cancelledBy` 의 **닫힌 3값 union**(`user`/`system`/`timeout`), `error.code` 의 `RESUME_*`
> 매핑, **일반 user cancel 에는 `error` 부재** — 이건 필드 이름이 아니라 **동작 약속**이라
> 축약의 대상이 아니다. §6.5 의 이 서술을 (1) 도입부로 **이관**하고, 축약 diff 에서
> 소실되지 않았는지 확인한다. [`retry-turn-terminal-guard.md`](./retry-turn-terminal-guard.md) **#2** 가 이 계약에 의존한다.

### (3) 나머지는 포인터로 — 필드 열거를 없앤다

- `conventions/chat-channel-adapter.md` §1.2 `EiaEvent` — 3 variant 의 필드 열거를 (1) 참조로
  축약. **SoT 는 EIA spec 이다** — 그 문서 R3(*"구체 필드 갱신은 항상 EIA spec 우선"*)가 이미
  이 방향을 명시했고, 코드 타입(`chat-channel/types.ts`)은 **구현체이지 SoT 가 아니다**.
  (3차 draft 가 "코드 타입을 SoT 로" 라 적었던 것은 R3 및 이 draft 자신의 후속 항목과
  모순이었다 — `16_04_30` convention WARNING 4. 정정한다.)
- `3-workflow-editor/3-execution.md` §8.1 — 화면 관점 요약표. "필드는 예시, 계약 SoT 는 (1)".
- **`EIA §6.5 line 536` 하드코딩 줄 인용 — 전수 6곳** (`16_18_00` naming WARNING 3).
  §6.5 의 실제 위치는 **675행**이라 이미 stale 하다. 앵커 링크는 붙어 있으므로 `line 536`
  텍스트만 제거하면 된다.
  - **이번 PR (spec 3곳)**: `chat-channel-adapter.md:145`·`:354`, `5-system/15-chat-channel.md:76`
  - **후속 (코드 3곳, planner 권한 밖)**: `chat-channel.dispatcher.ts:506`,
    `chat-channel.dispatcher.spec.ts:428`, `chat-channel/types.ts:378`
  > 처음엔 "§1.2 한 곳" 으로 적었다가 grep 하고 6곳임을 알았다. **줄 번호 인용은 구조적으로
  > 다시 stale 해지므로** 되살리지 않고 앵커만 남긴다.

## 왜 (A)N곳 동기화가 아니라 (B)단일화인가

(A)를 **세 라운드 시도한 실측**이 근거다. 매 라운드가 새 적용처를 찾았고, 3차 WARNING 들
(§6.2 SSE caveat 매핑 · §6.5 `ai_message` flat 서술 · `EiaEvent` 봉투)은 **아직 더 있다**고
가리킨다. (A)는 맞추는 순간만 정합하고 구조는 그대로다 — 다음 변경에서 같은 3라운드를 다시 낸다.

(B)는 작업량이 크지만 **N-places 문제 자체를 없앤다.** 이 세션이 `redis-keys.md` 로 증명한 형태다.

## 비목표

- `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 추적 설계 (되살리지 않는다)
- `duration` → `durationMs` 전역 개명 — 일관성 작업이고 반경이 목적을 넘는다. 후속.
  이번엔 **기존 `duration` 표기를 건드리지 않고** (1) 표에 동의어임을 한 줄 적는다.
- `execution.ai_message` 의 봉투 서술 — 종결 이벤트가 아니다. 후속으로 분리
  (`15_45_53` rationale WARNING 2).
- outbound notification 재시도·서명 정책

## 후속 (developer)

- [ ] emit 에 `durationMs`·`result.outputs` 채우기 (`execution-engine.service.ts` L2356·2520·
      3452·4616 + `retry-turn.service.ts` L723·897) → (1) 표의 Planned 해제
- [ ] `execution.failed` 의 `error` 를 객체로 통일 (L656·L3291, `retry-turn.service.ts` L956) →
      `chat-channel.dispatcher.ts` back-compat wrap 제거
- [ ] `chat-channel/types.ts:388` 을 (1) 최종형과 동기화
- [ ] `duration` → `durationMs` 전역 개명
- [ ] 코드 3곳의 `EIA §6.5 line 536` 인용에서 줄 번호 제거 (`chat-channel.dispatcher.ts:506`,
      `chat-channel.dispatcher.spec.ts:428`, `chat-channel/types.ts:378`)
- [ ] `execution.ai_message` 봉투 서술 정정 (별건)
- [ ] `node-output-redesign/README.md:372` 의 EIA §6.3 cross-ref 재검증 — 절 번호는 그대로지만
      §6.3 이 참조하는 내용의 성격이 바뀐다(`16_04_30` plan_coherence INFO 4)
- [ ] `failRetryExecution` 의 `cancelledBy` 누락 → [`retry-turn-terminal-guard.md`](./retry-turn-terminal-guard.md) **#2** 에서 집행
      (그 항목 완료 시 (1) 표의 "경로 1곳 누락" 도 함께 해제)

## 체크리스트

- [x] `--spec` 1~3차 **BLOCK: YES** — 셋 다 "규칙을 일부 절에만 적용". 반려 3회가 (A)의 비용
      실측이 됐고 (B)로 전환하는 근거가 됐다
- [x] `--spec` 4차(`16_04_30`) — 재넘버링 반경(CRITICAL). **재넘버링을 없애** 소멸
      (§6 도입부는 비어 있다), PR #945 선례 인용, "코드 타입을 SoT" 문구 정정
- [x] `--spec` 5차(`16_18_00`) — **"두 wire" 전제가 틀렸다.** SSE 는 재래핑하지 않는다
      (`interaction-stream.controller.ts:167` = `JSON.stringify(event.payload)`). 생산자 분기만
      재고 소비자를 안 쟀다 → **세 wire** 로 정정. 그 사실이 §6.2 에만 있고 §6.3~§6.5 엔
      없다는 것이 (B)의 추가 근거
- [x] 행동 계약(닫힌 union·`error.code`·user-cancel `error` 부재) 이관 명시 (W1)
- [x] `duration`/`durationMs` 표기 caveat — 비목표와 상충하지 않게 (W2)
- [x] `line 536` 인용 **전수 grep — 6곳**(spec 3 / 코드 3). "§1.2 한 곳" 이라던 최초 판단 정정 (W3)
- [x] `grep -rn "EIA §6\." spec/ codebase/` — ~15곳, 재넘버링 안 하므로 전부 유효
- [ ] 재검토 BLOCK: NO 확인
- [ ] EIA §6 도입부 신설(필드 집합 + webhook/SSE 두 갈래 봉투 + 행동 계약) — §6.1~§6.6 헤딩 불변
- [ ] §6.2 L615 blockquote 를 도입부로 이관 (waiting 고유 예시만 §6.2 잔류)
- [ ] §6.3~§6.5 본문 축약 (헤딩 유지 → 앵커 4곳 보존)
- [ ] WS §4.1 종결 3행 → 참조 + flat 봉투
- [ ] `chat-channel-adapter.md` §1.2 축약 + `line 536` 제거(§1.2·§8 표)
- [ ] `15-chat-channel.md:76` 의 `line 536` 제거
- [ ] `3-workflow-editor/3-execution.md` §8.1 → 비-authoritative 표기
- [ ] Planned gap 2건을 `spec-sync-*-gaps.md` 에 등재
- [ ] 후속 8건 등재

## Rationale

### 왜 spec 이 코드를 따르는가

이 저장소는 같은 질문에 이미 답했다 — §5.4 `/cancel` 응답 shape 를 두고 *"코드가 SoT 이고
spec 서술이 낡았던 것이라 spec 을 맞췄다"*(L1198, 2026-08-10). 근거는 "그 문구가 구현 이전
초안에서 유래했고 아무도 동기화하지 않았다" 였는데, §6.3 은 **같은 PR(#228)의 같은 초안**에서
나왔다. 같은 출처에 다른 판단을 적용할 이유가 없다.

### WS §4.4 선례(PR #945)와의 관계 — 같은 원칙의 다른 얼굴

WS `## Rationale` 의 *"§4.4 wire 필드 caveat — 직접 재작성 대신 caveat + 오너십 분리"*
(2026-07-14, PR #945)가 두 가지를 정했다:

1. **오너십 분리로 3중 복제·재-drift 회피** — *"전체 매핑을 세 문서(WS/EIA/architecture)에
   복제하면 새 drift 표면이 열린다"*. **이번 (B)가 하려는 것이 정확히 이것이다** — 선례에
   반하는 게 아니라 그 원칙을 종결 이벤트에 처음 적용하는 것이다.
   > §4.4 가 EIA 를 **전체** SoT 로 격상하지 않은 이유는 그 이벤트에서 WS 가 자기 소유 필드
   > (`waitingNodeType`·`waitingNodeLabel`·`nodeExecutionId`·`startedAt`)를 갖기 때문이다.
   > **종결 이벤트에는 WS 전용 부가 필드가 없다** — 그래서 같은 오너십 분리 원칙이 여기서는
   > "단일 SoT + 포인터" 로 수렴한다. 두 결정은 반대가 아니라 같은 규칙의 두 경우다.
2. **직접 재작성 대신 caveat** — 이건 `waitingNodeId` vs `nodeId` 처럼 **필드가 존재하되
   이름/중첩이 다른** 경우의 판단이다. 아래 문단 참조.

### 왜 caveat 이 아니라 rewrite 인가

PR #945 의 "caveat" 판단은 **표현 차이**에 맞다 — `waitingNodeId`/`nodeId` 는 **같은 사실을
다른 형태로** 실어 나르므로, 캐노니컬 JSON 을 두고 매핑을 각주로 다는 것이 정보를 잃지 않는다.

이번은 **필드가 아예 없다.** `finalNodeId` 는 형태가 다른 게 아니라 **존재하지 않는다.**
없는 것을 각주로 설명하면 문서는 **여전히 그것을 약속**한다 — caveat 는 "이렇게 읽어라" 이지
"이건 없다" 가 아니다. 그래서 여기서는 rewrite 다.

### 왜 "지킬 수 있는 약속" 은 남기나

`durationMs`·`result.outputs` 는 emit 직전에 이미 값이 있다. 못 지킬 약속이 아니라 **안 지킨
약속**이라 Planned 로 남기고 후속에 등재한다. 반대로 `finalNodeId`·`finalPort`·`nodeCount`·
`failedNodeId` 는 **신규 추적 설계**를 요구한다 — 둘을 한 항목에 섞으면 3개월 전처럼 통째로
미뤄지고 문서만 거짓으로 남는다.

### 반려 5회를 기록으로 남기는 이유

1~3차는 같은 실패였다. 매번 "내가 또 절반만 잡았다" 로 읽고 그 자리를 메웠는데, **그 진단이
얕았다** — 절반만 잡히는 이유가 계약이 4곳에 재서술돼 있다는 구조였다. 개인의 부주의로
읽히는 실패가 세 번 반복되면 그때는 구조를 의심해야 한다.

4·5차는 성격이 다르다. 4차는 해법의 **부작용 반경**(재넘버링), 5차는 내 **사실 전제**(wire 수)
였다. 특히 5차가 유익하다 — 내가 §6.3~§6.5 만 읽고 SSE 를 webhook 과 같다고 믿었는데, 그
사실은 §6.2 에만 적혀 있었다. **이 draft 가 고치려는 결함이 이 draft 를 틀리게 만든 것**이라,
(B)의 필요성이 추상 논증이 아니라 이 문서 자신의 이력으로 증명됐다.
