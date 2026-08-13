# Cross-Spec 일관성 검토 — EIA outbound notification payload 계약

target: `plan/in-progress/spec-draft-eia-notification-payload-contract.md`
검토 모드: spec draft (`--spec`)

## 발견사항

- **[CRITICAL]** WS §4.1 표의 `execution.completed`/`execution.failed` 는 target 이 EIA §6.3/§6.4 를 재작성한 뒤에도 여전히 실제와 다른 필드를 약속한 채로 남는다 — target 이 직접 지목한 것과 같은 결함군을, 같은 target 이 손대는 같은 파일에서 절반만 고친다
  - target 위치: `## 무엇을 쓸 것인가 → 3. §6.5 execution.cancelled — nested 로 통일, WS §4.1 동기화` (target 문서 §3). 여기서 target 은 WS §4.1 을 **`execution.cancelled` 행에 한해서만** nested 로 정정한다고 명시하고, `execution.completed`/`execution.failed` 행은 언급하지 않는다.
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.1 (실제 파일 L170, 표 L177-178)
    ```
    L177: | `execution.completed` | `{ executionId, status, duration, nodeCount }` | 실행 완료 |
    L178: | `execution.failed`    | `{ executionId, error, failedNodeId, duration }` | 실행 실패 |
    ```
  - 상세: target 문서의 "실측" 절(§왜)이 이미 확인했듯, `execution.completed`/`execution.failed`/`execution.cancelled` 세 이벤트는 **단일 sink** `emitExecution` → `WebsocketService.executionEvents$` 에서 나오며, WS 게이트웨이와 EIA outbound notification(§6.3-6.5)·chat-channel dispatcher 는 모두 이 **동일한 emit** 의 서로 다른 소비자다(target 자신도 §6.5 절에서 "두 spec 문서가 서로 모순"이라며 WS §4.1 을 cancelled 한정으로 손댄다). 그런데 실제 emit 은 `emitExecution(id, EXECUTION_COMPLETED, { status })` — `duration`·`nodeCount` 개념이 없다. `execution.failed` 도 실제로는 `{ status, error }`(현행 일부 string) 이지 `failedNodeId` 라는 top-level 필드는 존재하지 않는다(EIA §6.4 은 `error.nodeId` 로 nest, WS §4.1 은 `failedNodeId` 로 flat — 필드명 자체도 다르다). target 이 EIA §6.3/§6.4 를 실제 봉투로 정정하고 나면, **같은 `spec_impact` 파일 목록에 든 WS §4.1** 이 정정되지 않은 채 `duration`/`nodeCount`/`failedNodeId` 라는, target 자신이 "존재한 적 없다"고 실측한 필드를 계속 약속하게 된다. EIA §6.3(정정 후)과 WS §4.1(미정정)이 **같은 단일 이벤트에 대해 서로 다른 shape** 를 문서화하는 상태가 새로 생긴다 — target 이 처음에 고치려던 "문서가 거짓" 문제를 한 파일(WS)에 그대로 재생산한다.
  - 제안: target 의 §3(WS §4.1 동기화)을 `execution.cancelled` 뿐 아니라 `execution.completed`/`execution.failed` 행까지 확장한다. 최소한 두 행에 `duration`/`nodeCount`/`failedNodeId` 는 미구현(Planned) 또는 삭제로 표기하고, EIA §6.3/§6.4 의 실제 필드명(`durationMs`, `error.nodeId`)과 필드명을 통일하거나 "WS 는 논리적 요약, 실제 wire 는 EIA §6 참조"라는 명시적 caveat 를 §4.1 표 앞(§1 의 Socket.IO 추상화 caveat 와 같은 위치)에 추가한다.

- **[CRITICAL]** `spec/conventions/chat-channel-adapter.md` §1.2 `EiaEvent` 유니온이 "EIA §6 이 SoT" 라고 명시적으로 선언해 놓고도 target 의 `spec_impact`/체크리스트에서 빠져 있다 — target 이 EIA §6.3 을 재작성하면 이 컨벤션의 타입 정의가 즉시 stale 해진다
  - target 위치: frontmatter `spec_impact` (target 문서 L29-31, `14-external-interaction-api.md` + `6-websocket-protocol.md` 두 파일만 나열) 및 `## 체크리스트` — `spec/conventions/chat-channel-adapter.md` 갱신 항목이 없다.
  - 충돌 대상: `spec/conventions/chat-channel-adapter.md` §1.2 (실제 파일 L138-147), 특히 L140 "`EiaEvent` 는 [EIA §6 outbound notification payload] 의 5종 union — **별 신규 타입 정의 없이 EIA spec 의 payload shape 을 재사용 (drift 회피)**" 및 L527 `### R3. EiaEvent 를 별 타입으로 정의하지 않고 EIA spec 위임` (공식 Rationale 항목).
  - 상세: 이 컨벤션은 자신의 `EiaEvent.execution.completed` 타입을 다음과 같이 못박는다(L146):
    ```
    { type: "execution.completed"; /* EIA §6.3 */ ...; result: { outputs: unknown; finalNodeId: string; finalPort: string }; durationMs: number; ... }
    ```
    `finalNodeId`/`finalPort` 가 **non-optional** 로, `durationMs` 도 **non-optional number** 로 선언돼 있다. target 은 EIA §6.3 을 다음으로 교체한다:
    ```
    { type: "execution.completed"; ...; payload: { status: "completed" }; ... }  // result/finalNodeId/finalPort 삭제, durationMs = "미구현 (Planned)"
    ```
    target 자신의 근거 1이 "`finalNodeId`·`finalPort` 는 엔진에 개념 자체가 없다"이므로, 이 필드들은 삭제 대상이지 optional 화 대상도 아니다. 그런데 `chat-channel-adapter.md` 는 "drift 회피"를 목적으로 EIA §6 을 그대로 베낀 타입을 공식 Rationale(R3)로 못박아 둔 문서라, target 이 EIA §6.3 만 고치고 이 컨벤션을 방치하면 **"drift 회피"가 목적인 문서 자체가 drift** 상태로 남는다. 존재한 적 없는 필드(`finalNodeId`/`finalPort`)를 "EIA §6.3 SoT" 라고 명시하며 계속 약속하는 상태가 된다.
  - 참고: 실제 백엔드 코드(`codebase/backend/src/modules/chat-channel/types.ts` L386-390 `EiaCompletedEvent`)는 이미 `result`/`durationMs` 를 전부 optional 로 선언해 두어 컨벤션 문서보다 코드가 더 방어적이다(target 이 §왜 절에서 "전 필드 optional, 읽는 코드가 없다"고 언급한 바로 그 타입). 즉 코드는 이미 실제에 가깝고, **컨벤션 문서만** 뒤처진다 — target 의 "코드가 SoT, spec 이 낡았다" 논리가 이 컨벤션 파일에도 그대로 적용된다.
  - 제안: `spec_impact` 에 `spec/conventions/chat-channel-adapter.md` 를 추가하고, §1.2 `EiaEvent.execution.completed` 타입에서 `result`/`finalNodeId`/`finalPort` 를 삭제(또는 `payload: {status}` 로 교체)하고 `durationMs` 를 optional 로 낮춘다. 최소한 후속 항목으로 명시 등재한다.

- **[WARNING]** `execution.failed` 의 `durationMs` 마련 상태가 target 문서 내에서 §6.3 과 비대칭 처리돼, 다운스트림 타입 정의와의 정합 여부가 불명확하다
  - target 위치: `## 무엇을 쓸 것인가 → 2. §6.4 execution.failed` (target 문서, `error` 필드만 다루고 `durationMs` 언급 없음)
  - 충돌 대상: target 문서 자신의 "실측" 표(§왜, "fanout 봉투" 행 — "최상위 `result`/`durationMs` **없음**")와 `spec/conventions/chat-channel-adapter.md` L147(`execution.failed` 도 `durationMs: number` non-optional)
  - 상세: target 은 §6.3(`execution.completed`)의 `durationMs` 는 명시적으로 "미구현 (Planned)" 마커를 붙이기로 했다. 그러나 실측 표는 "fanout 봉투" 자체(모든 이벤트 공통)에 `durationMs` 가 없다고 적었는데, §6.4(`execution.failed`) 절에는 같은 처리를 안 했다 — `error` 필드 현행/목표 병기만 다루고 `durationMs` 는 기존 서술(암묵적으로 채워짐)을 그대로 둔다. `chat-channel-adapter.md` 는 `execution.failed.durationMs` 를 non-optional 로 선언하고 있어, 만약 실제로 `execution.failed` 경로도 `durationMs` 미배선이라면 §6.3 과 동일한 "약속했지만 없다" 문제가 §6.4 에도 남는다.
  - 제안: `execution.failed` 의 `durationMs` 배선 여부를 §6.3 과 같은 기준으로 실측하고, 미배선이면 §6.4 에도 동일하게 "미구현 (Planned)" 마커를 붙이거나 후속 체크리스트에 포함한다.

- **[INFO]** EIA `durationMs` ↔ WS `duration` 필드명 불일치 — 같은 개념을 가리키는 두 이름이 target 이 손대는 두 파일에 그대로 남는다
  - target 위치: `## 무엇을 쓸 것인가 → 3.` (WS §4.1 동기화 서술)
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §6.3-6.5 (`durationMs`) vs `spec/5-system/6-websocket-protocol.md` §4.1 (`duration`)
  - 상세: 두 필드가 같은 실행 종료 소요시간을 가리키는 것으로 보이는데 이름이 다르다. target 이 이미 WS §4.1 을 일부 손대는 김에(cancelled 행) 이름도 통일하면 향후 혼동을 줄일 수 있다. 크리티컬은 아니며 위 CRITICAL 항목들을 처리하는 과정에서 자연히 정리될 사안.
  - 제안: WS §4.1 필드명을 `durationMs` 로 통일하거나, 의도적으로 다른 개념(WS 는 다른 정밀도/단위)이면 그 사실을 명시.

## 요약

target 초안 자체(EIA §6.3-6.5 재작성)의 판단 근거는 견고하다 — 실제 emit·재조회 경로·과거 판례를 근거로 "코드가 SoT" 라는 결론은 타당하다. 그러나 target 이 고치는 범위가 **문제의 절반**에서 멈춘다: (1) 같은 `spec_impact` 목록에 든 `6-websocket-protocol.md` §4.1 은 `execution.cancelled` 행만 nested 로 정정되고 `execution.completed`/`execution.failed` 행은 target 이 직접 실측해 "존재한 적 없다"고 밝힌 `duration`/`nodeCount`/`failedNodeId` 를 계속 약속한 채 남는다. (2) `spec_impact` 에 아예 포함되지 않은 `spec/conventions/chat-channel-adapter.md` 는 "EIA §6 이 SoT, drift 회피" 를 공식 Rationale(R3)로 못박아 둔 문서인데, target 이 EIA §6.3 의 `result.finalNodeId`/`finalPort`/`outputs` 를 삭제하면 이 컨벤션의 타입 정의만 즉시 stale 해진다 — 정작 실제 백엔드 코드(`chat-channel/types.ts`)는 이미 그 필드들을 optional 로 방어해 둔 상태라, "코드가 SoT, spec 이 낡았다" 는 target 자신의 논리가 이 컨벤션 파일에도 똑같이 적용돼야 한다. 두 결함 모두 target 이 원래 고치려던 "문서가 실제와 다른 필드를 약속해 외부 계약이 거짓" 문제를 인접 파일에 그대로 재생산하는 형태라 등급을 CRITICAL 로 매겼다. WARNING/INFO 항목은 §6.4 `durationMs` 처리의 비대칭과 필드명 불일치로, CRITICAL 항목을 처리하면서 함께 정리 가능하다.

## 위험도

HIGH
