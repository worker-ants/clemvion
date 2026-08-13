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

# spec draft — EIA/WS 종결 이벤트 payload 계약을 실제에 맞춘다

## 왜

`14_18_42` cross_spec **CRITICAL**. 종결 이벤트(`execution.completed`/`failed`/`cancelled`)의
문서화된 payload 가 실제 발송과 근본적으로 다르다. spec 을 믿고 연동한 외부 고객은 문서화된
필드를 전부 `undefined` 로 받는다 — **외부 계약이 거짓인 상태**다.

## 영향 범위 — 필드 이름 전역 grep 으로 확정

> 1차 draft 는 EIA 2파일만 잡았다가 `15_15_08` 이 CRITICAL 2건으로 반려했다. **기억이 아니라
> grep 으로** 다시 세웠다:
> `grep -rn "finalNodeId\|finalPort\|nodeCount\|failedNodeId" --include="*.ts" --include="*.md" codebase/ spec/`

| 파일 | 무엇이 어긋났나 |
|---|---|
| `spec/5-system/14-external-interaction-api.md` §6.3~§6.5 | `result:{outputs,finalNodeId,finalPort}` · `durationMs` · `error` 객체 약속 |
| `spec/5-system/6-websocket-protocol.md` §4.1 | **종결 3행 전부** — `completed:{duration,nodeCount}` · `failed:{failedNodeId,duration}` · `cancelled:{cancelledBy,duration}` (flat) |
| `spec/conventions/chat-channel-adapter.md` §1.2 | `EiaEvent` 3 variant 가 `finalNodeId`·`finalPort`·`durationMs` 를 **non-optional** 로 선언. R3 가 "EIA §6 이 SoT, drift 회피" 를 표방하는데 **그 문서 자체가 drift** 가 된다 |
| `codebase/backend/src/modules/chat-channel/types.ts:388` | 같은 타입의 TS 미러 (전 필드 optional, 읽는 코드 0곳) — developer 후속 |

## 실측 — 실제 emit

| 이벤트 | 실제 payload | 위치 |
|---|---|---|
| `completed` | `{ status }` | `execution-engine.service.ts` L2371·2538·3467·4633, `retry-turn.service.ts` L723·897 |
| `failed` | `{ status, error: <string> }` | `execution-engine.service.ts` L656·3291, `retry-turn.service.ts` L956(분기) |
| `cancelled` | `{ status, result:{cancelledBy}, error? }` | `execution-engine.service.ts` L1082 |
| `cancelled` (**예외**) | `{ status }` — **`cancelledBy` 없음** | `retry-turn.service.ts` `failRetryExecution` L956 |
| fanout 봉투 | `{type,executionId,triggerId,workflowId,seq,payload,timestamp}` | `notification-fanout.service.ts` L123-137 |

**엔진에 개념 자체가 없는 필드**: `finalNodeId`·`finalPort`·`nodeCount`·`failedNodeId` (grep 0건).

## 결정 — spec 을 실제에 맞추되, 지킬 수 있는 약속은 지킨다

근거 다섯:

1. **`finalNodeId`·`finalPort`·`nodeCount`·`failedNodeId` 는 엔진에 없다.** 배선이 밀린 게
   아니라 **설계된 적이 없다.** 3개월간 아무도 못 채운 이유가 이것이다.
2. **문서화된 필드를 읽는 소비자가 0곳**이다(`chat-channel/types.ts` 는 spec 을 옮긴 타입 선언).
3. **§6.3 의 출처가 구현 이전 초안(#228)** 이고, 같은 문서 L1198 이 §5.4 를 두고
   *"코드가 SoT 이고 spec 서술이 낡았던 것이라 spec 을 맞췄다"* 로 **같은 출처에 이미 같은
   판단**을 내렸다.
4. **재조회 경로가 이미 있다** — [EIA-IN-04](../../spec/5-system/14-external-interaction-api.md#53-단발-상태-조회--get-apiexternalexecutionsexecutionid)
   가 status·result·error 를 준다. "얇은 signal + 재조회" 는 이 플랫폼의 현행 설계다.
5. 지금 상태가 최악이다 — 문서가 거짓이면 연동하는 쪽이 존재하지 않는 필드를 기다린다.

### 기록된 의도에 대한 정정

`chat-channel.dispatcher.ts` 주석 산문은 *"emit shape 를 spec 정합으로 마이그레이션"*(코드→spec)
인데 그것이 가리키는 plan 이름은 **`spec-update-…`**(spec→코드)다. 산문과 이름이 반대라
"기록된 의도" 자체가 애매하고, 어느 쪽이든 **그 plan 은 만들어진 적이 없다**
(`git log --all -S "spec-update-execution-failed-payload-shape" -- plan/` → 0건).

## 무엇을 쓸 것인가

### 0. 봉투 규칙 — **한 번 선언하고 세 이벤트에 똑같이 적용한다**

> 2차 draft 가 `payload` 래퍼를 §6.3 에만 적고 §6.4·§6.5 엔 안 적어 CRITICAL 로 반려됐다
> (`15_28_10`). 이벤트별로 쓰면 또 절반만 적용된다. **규칙을 한 자리에 두고 세 절이 그것을
> 참조하게 한다.**

outbound webhook 이 실제로 배달하는 wire 는 **항상** 이 봉투다
(`notification-fanout.service.ts` L123-137 → `notification-webhook.processor.ts` L224
`JSON.stringify(eventBody)`):

```jsonc
{
  "type":        "execution.completed" | "execution.failed" | "execution.cancelled",
  "executionId": "uuid",
  "triggerId":   "uuid",
  "workflowId":  "uuid",
  "seq":         99,
  "timestamp":   "ISO8601",
  "payload":     { /* 이벤트별 내용물 — 아래 §1~§3 */ }
}
```

**사건별 내용물은 전부 `payload` 아래에 있다.** 종전 문서는 `result`/`error`/`durationMs` 를
최상위에 그려서, spec 대로 `body.result` 를 읽는 고객은 실제로 `body.payload.result` 에 있는
값을 못 찾았다. §6.1(헤더/서명)·§6.2 의 wire 서술도 이 봉투에 맞춘다.

### 1. §6.3 `execution.completed` — `payload: { status }`

- **`finalNodeId`·`finalPort` 삭제** (엔진에 개념 없음 — 되살리지 않는다).
- `result.outputs`·`durationMs` 는 **"미구현 (Planned)"** + 후속 등재.
- 풍부한 데이터가 필요하면 [EIA-IN-04 상태 조회](../../spec/5-system/14-external-interaction-api.md#53-단발-상태-조회--get-apiexternalexecutionsexecutionid).

### 2. §6.4 `execution.failed` — `payload: { status, error }`

`error` 객체(`{code,message,nodeId,details?}`)를 **목표**로 유지하되 **현행이 일부 경로에서
string** 임을 명시(`execution-engine.service.ts` L656·L3291, `retry-turn.service.ts` L956).
dispatcher back-compat wrap(`chat-channel.dispatcher.ts` L535-560)이 그 때문임을 교차 참조.
`durationMs` 는 §6.3 과 **동일 기준**으로 Planned 표기.

### 3. §6.5 `execution.cancelled` — `payload: { status, result: { cancelledBy }, error? }`

- nested `result.cancelledBy` 로 통일(코드가 이미 그렇다).
- **캐비엇**: `retry-turn.service.ts` `failRetryExecution` L956 경로는 `cancelledBy` 를
  **emit 하지 않는다**(선재 결함). 이 캐비엇은 §6.5 **와** `chat-channel-adapter.md` §1.2
  **양쪽에** 적는다 — 한쪽만 적으면 그쪽이 다시 SoT 와 어긋난다(`15_28_10` WARNING 2).

### 4. WS §4.1 — 종결 3행

`nodeCount`·`failedNodeId`·`duration` 은 **emit 되지 않는다**(grep 0건). 삭제하거나
Planned 표기하고, `cancelled` 는 nested 로 정정한다.

### 5. `conventions/chat-channel-adapter.md` §1.2

`EiaEvent` 3 variant 를 위 결정과 맞춘다 — `finalNodeId`·`finalPort` 삭제,
`result`·`durationMs` optional 화, `cancelled` 의 `result.cancelledBy` 도 **optional**
(§3 캐비엇과 같은 이유). R3 가 "EIA §6 이 SoT" 라 선언하므로 SoT 를 고치면 여기가 따라온다.

### 6. `3-workflow-editor/3-execution.md` §8.1 — 비-authoritative 표기

이 표는 에디터 화면 관점의 **요약**이라 계약 SoT 가 아니다. 필드를 일일이 동기화하는 대신
표 상단에 "필드는 예시 — 계약 SoT 는 WS §4.1 / EIA §6" 을 명시한다. 요약표를 계약처럼
유지하려 들면 갱신 지점이 하나 더 늘고, 그게 지금 이 문제의 원인이다.

## 비목표

- `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 추적 설계 (되살리지 않는다)
- outbound notification 재시도·서명 정책
- **`duration` → `durationMs` 전역 개명** — 2차 draft 는 이걸 포함했다가 범위가 폭발했다
  (WS 종결 3행 + `node.completed` 행 + `3-workflow-editor §8.1` + …). 개명은 **일관성 작업**이고
  이번 CRITICAL(문서가 없는 필드를 약속함)과 성격이 다르다. **반경이 목적을 넘으면 자른다** —
  후속으로 뺀다. 이번엔 EIA 가 이미 쓰는 `durationMs` 를 신규 표기에만 쓰고, 기존 `duration`
  표기는 건드리지 않는다.

## 후속 (developer)

- [ ] **emit 에 `durationMs`·`result.outputs` 채우기** — 두 값은 emit 직전에 이미 세팅돼 있다
      (`savedExecution.outputData` L2356·2520·3452·4616, `durationMs` L2360).
      `retry-turn.service.ts` L723·897 도 같은 처리 필요. 채운 뒤 spec 의 Planned 마커 제거.
- [ ] **`execution.failed` 의 `error` 를 객체로 통일** — `execution-engine.service.ts` L656·L3291,
      `retry-turn.service.ts` L956. 통일하면 dispatcher back-compat wrap 이 죽은 코드가 되므로 함께 제거.
- [ ] **`chat-channel/types.ts:388` `EiaCompletedEvent` 를 §1.2 최종형과 동기화**
- [ ] **`duration` → `durationMs` 전역 개명** (범위 밖으로 뺀 것) — WS §4.1 `node.completed`,
      `3-workflow-editor §8.1`, 그 외 `duration` 표기 전수. 같은 개념이 두 이름인 상태는 남는다.
- [ ] `failRetryExecution` 의 `cancelledBy` 누락은 [`retry-turn-terminal-guard.md`](./retry-turn-terminal-guard.md) W1 에서 집행 (교차 참조만)

## 체크리스트

- [x] `--spec` 1차 `15_15_08` **BLOCK: YES** (CRITICAL 2 — 영향 범위 절반)
      → 필드 전역 grep 으로 재확정, `spec_impact` 3파일
- [x] `--spec` 2차 `15_28_10` **BLOCK: YES** (CRITICAL 1 — `payload` 봉투를 §6.3 에만 적용)
      → **봉투 규칙을 §0 으로 분리**해 세 이벤트가 참조, 개명은 범위 밖으로, 참조자 1개(+`3-execution.md`) 추가
- [ ] 재검토 BLOCK: NO 확인
- [ ] EIA §6.1·§6.2 wire 서술 + §6.3~§6.5 (봉투 §0 적용)
- [ ] WS §4.1 종결 3행
- [ ] `conventions/chat-channel-adapter.md` §1.2 3 variant (+ `cancelledBy` optional)
- [ ] `3-workflow-editor/3-execution.md` §8.1 비-authoritative 표기
- [ ] Planned gap 2건을 `spec-sync-*-gaps.md` 트래커에 등재 (`pending_plans` 연결)
- [ ] 후속 5건 등재

## Rationale

### 왜 "코드를 spec 에 맞춘다" 를 통째로 택하지 않았나

그 방향이 나은 부분이 분명히 있다 — 풍부한 webhook 은 수신자의 왕복을 줄인다. 그래서
`durationMs`·`result.outputs` 는 **채우는 쪽을 택했다**. 데이터가 emit 시점에 이미 있으므로
"못 지킬 약속" 이 아니다.

통째로 택하지 않은 이유는 **`finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 가 다른
종류**이기 때문이다. 이들은 배선이 아니라 **신규 추적 설계**를 요구한다. 그것을 "문서 동기화"
항목 안에 숨기면 3개월 전처럼 또 미뤄지고 문서만 거짓으로 남는다. 지킬 수 있는 것과 설계가
필요한 것을 갈라, 전자는 지키고 후자는 **약속을 철회**한다.

### 왜 spec 이 코드를 따르는가 (반대가 아니라)

이 저장소는 같은 질문에 이미 답했다 — §5.4 `/cancel` 응답 shape 를 두고 *"코드가 SoT 이고
spec 서술이 낡았던 것이라 spec 을 맞췄다"*(L1198, 2026-08-10). 그 근거는 "그 문구가 구현 이전
초안에서 유래했고 아무도 동기화하지 않았다" 였는데, §6.3 은 **같은 PR(#228)의 같은 초안**에서
나왔다. 같은 출처에 다른 판단을 적용할 이유가 없다.

### 1차 draft 가 왜 반려됐나 — 기록해 둔다

`15_15_08` 이 CRITICAL 2건으로 반려했고 둘 다 **범위를 절반만 잡은 것**이었다:
WS §4.1 에서 `cancelled` 행만 고치고 옆의 `completed`/`failed` 는 두었으며,
`conventions/chat-channel-adapter.md` 는 아예 `spec_impact` 에 없었다.

**이 세션에서 같은 형태가 다섯 번째다.** 그리고 나는 바로 앞 PR 에서
*"SoT 이관 시 앵커 전수 grep 을 절차로"* 를 plan 에 적어 놓고 **내 draft 에는 적용하지 않았다.**
절차를 적는 것과 따르는 것은 다른 일이다 — 이번 개정은 필드 이름 전역 grep 으로 시작했다.
