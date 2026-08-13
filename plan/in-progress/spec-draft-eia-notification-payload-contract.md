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

## 두 wire 는 실제로 다르다 — 이걸 먼저 못 박는다

> 순진한 "WS 를 EIA 로 가리키게 한다" 는 **새 거짓을 만든다.** 착수 전 실측으로 잡았다.

`websocket.service.ts` `emitExecutionEvent`(L453-489)가 **두 갈래**를 만든다:

| 채널 | shape | 근거 |
|---|---|---|
| **WS** (에디터, `broadcastToChannel`) | `{ executionId, ...payload, seq, timestamp }` — payload 필드가 **flat spread** | L461-468 |
| **fanout → webhook/SSE** | 위 flat 봉투를 `payload` 키에 **통째로 넣고** 다시 감싼다: `{ type, executionId, triggerId, workflowId, seq, timestamp, payload: {...} }` | L479-484 → `notification-fanout.service.ts` L123-137 |

따라서 webhook body 는 `executionId`·`seq`·`timestamp` 가 **바깥과 안쪽에 중복** 등장한다.
이건 결함이 아니라 현재 구조의 사실이고, spec 이 지금까지 한 번도 적지 않았다.

## 결정 — 필드 집합은 1곳, 봉투는 채널별 1곳, 나머지는 포인터

### (1) 신설: EIA §6.3 "종결 이벤트가 실어 나르는 사실" — **유일한 규범 필드 집합**

| 필드 | 상태 | 비고 |
|---|---|---|
| `status` | 구현됨 | `completed` \| `failed` \| `cancelled` |
| `error` | 구현됨(형태 불일치) | **현행 일부 경로 string** — 목표는 `{code,message,nodeId,details?}` |
| `result.cancelledBy` | 구현됨(경로 1곳 누락) | `cancelled` 한정. `retry-turn.service.ts` `failRetryExecution` L956 은 emit 안 함 |
| `result.outputs` | **미구현 (Planned)** | 데이터는 emit 직전 존재 |
| `durationMs` | **미구현 (Planned)** | 데이터는 emit 직전 존재 |
| ~~`finalNodeId`·`finalPort`·`nodeCount`·`failedNodeId`~~ | **삭제** | 엔진에 개념 자체가 없다(grep 0건) — 약속을 철회한다 |

### (2) 봉투는 채널별로 **각 한 번만** 서술

- **EIA §6.x** — webhook/SSE 봉투(`payload` 래퍼 + 중복 필드 사실). 내용물은 (1) 참조.
- **WS §4.1** — WS flat 봉투. **필드 열거를 버리고** "(1) 의 필드 집합이 flat 하게 펼쳐진다"
  로 바꾼다. 두 봉투가 다르다는 사실도 여기 한 줄.

### (3) 나머지는 포인터로 — 필드 열거를 없앤다

- `conventions/chat-channel-adapter.md` §1.2 `EiaEvent` — 3 variant 의 필드 열거를 (1) 참조로.
  타입 정의가 필요하면 **코드 타입을 SoT 로** 가리킨다(`chat-channel/types.ts`).
- `3-workflow-editor/3-execution.md` §8.1 — 화면 관점 요약표. "필드는 예시, 계약 SoT 는 (1)".

## 왜 (A)N곳 동기화가 아니라 (B)단일화인가

(A)를 **세 라운드 시도한 실측**이 근거다. 매 라운드가 새 적용처를 찾았고, 3차 WARNING 들
(§6.2 SSE caveat 매핑 · §6.5 `ai_message` flat 서술 · `EiaEvent` 봉투)은 **아직 더 있다**고
가리킨다. (A)는 맞추는 순간만 정합하고 구조는 그대로다 — 다음 변경에서 같은 3라운드를 다시 낸다.

(B)는 작업량이 크지만 **N-places 문제 자체를 없앤다.** 이 세션이 `redis-keys.md` 로 증명한 형태다.

## 비목표

- `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 추적 설계 (되살리지 않는다)
- `duration` → `durationMs` 전역 개명 — 일관성 작업이고 반경이 목적을 넘는다. 후속.
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
- [ ] `execution.ai_message` 봉투 서술 정정 (별건)
- [ ] `failRetryExecution` 의 `cancelledBy` 누락 → [`retry-turn-terminal-guard.md`](./retry-turn-terminal-guard.md) **#2** 에서 집행
      (그 항목 완료 시 (1) 표의 "경로 1곳 누락" 도 함께 해제)

## 체크리스트

- [x] `--spec` 1·2·3차(`15_15_08`·`15_28_10`·`15_45_53`) **BLOCK: YES** — 셋 다 "규칙을 일부
      절에만 적용". 반려 3회가 (A)의 비용 실측이 됐고 (B)로 전환하는 근거가 됐다
- [x] **두 wire 가 다르다는 것을 착수 전 실측** — 순진한 단일화가 만들 뻔한 새 거짓을 차단
- [ ] 재검토 BLOCK: NO 확인
- [ ] EIA §6.3 신설(필드 집합) + §6.x 봉투 1회 + §6.4/§6.5 를 참조로 축약
- [ ] WS §4.1 종결 3행 → 필드 열거 제거, (1) 참조 + flat 봉투 서술
- [ ] `chat-channel-adapter.md` §1.2 → (1) 참조
- [ ] `3-workflow-editor/3-execution.md` §8.1 → 비-authoritative 표기
- [ ] Planned gap 2건을 `spec-sync-*-gaps.md` 에 등재
- [ ] 후속 6건 등재

## Rationale

### 왜 spec 이 코드를 따르는가

이 저장소는 같은 질문에 이미 답했다 — §5.4 `/cancel` 응답 shape 를 두고 *"코드가 SoT 이고
spec 서술이 낡았던 것이라 spec 을 맞췄다"*(L1198, 2026-08-10). 근거는 "그 문구가 구현 이전
초안에서 유래했고 아무도 동기화하지 않았다" 였는데, §6.3 은 **같은 PR(#228)의 같은 초안**에서
나왔다. 같은 출처에 다른 판단을 적용할 이유가 없다.

### 왜 caveat 이 아니라 rewrite 인가

WS 는 종전에 "wire caveat" 방식(캐노니컬 JSON 은 두고 차이를 각주로)을 쓴 선례가 있다
(`15_45_53` rationale INFO 2). 그 선례는 **표현 차이**(같은 사실을 다른 형태로 실어 나름)에
맞다. 이번은 **필드가 아예 없다** — `finalNodeId` 는 형태가 다른 게 아니라 존재하지 않는다.
없는 것을 각주로 설명하면 문서는 여전히 그것을 약속한다.

### 왜 "지킬 수 있는 약속" 은 남기나

`durationMs`·`result.outputs` 는 emit 직전에 이미 값이 있다. 못 지킬 약속이 아니라 **안 지킨
약속**이라 Planned 로 남기고 후속에 등재한다. 반대로 `finalNodeId`·`finalPort`·`nodeCount`·
`failedNodeId` 는 **신규 추적 설계**를 요구한다 — 둘을 한 항목에 섞으면 3개월 전처럼 통째로
미뤄지고 문서만 거짓으로 남는다.

### 반려 3회를 기록으로 남기는 이유

같은 실패를 세 번 반복한 뒤에야 구조를 봤다. 매번 "내가 또 절반만 잡았다" 로 읽고 그 자리를
메웠는데, **그 진단이 얕았다** — 절반만 잡히는 이유가 계약이 4곳에 재서술돼 있다는 구조였다.
개인의 부주의로 읽히는 실패가 세 번 반복되면 그때는 구조를 의심해야 한다.
