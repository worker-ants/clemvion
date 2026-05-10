# Spec: 실행 엔진 상세

> 관련 문서: [Spec 아키텍처 개요](../0-overview.md) · [Spec 에러 처리](./3-error-handling.md) · [Spec 실행/디버깅](../3-workflow-editor/3-execution.md) · [데이터 모델 - Execution](../1-data-model.md#213-execution)

---

## 1. 실행 상태 머신

### 1.1 Execution 상태

```
                    ┌─ cancelled
                    │
                    ├─ waiting_for_input ─┬─ running (재개)
pending → running ──┤                     └─ cancelled
                    ├─ completed
                    │
                    └─ failed
```

| 상태 | 설명 | 전이 조건 |
|------|------|-----------|
| `pending` | 실행 요청됨, Worker 할당 대기 | 트리거/수동 실행 시 생성 |
| `running` | 실행 중 | Worker가 태스크 소비 시 |
| `waiting_for_input` | 사용자 입력 대기 중 — Form 노드, 버튼이 설정된 Presentation 노드, 또는 AI Agent Multi Turn 대화 입력 대기 | Form 노드 도달, 버튼이 설정된 Presentation 노드 도달, 또는 AI Agent Multi Turn 대화 턴 대기 시 |
| `completed` | 정상 완료 | 모든 노드 실행 완료 |
| `failed` | 실패 | 노드 에러 + Stop Workflow 정책, 또는 시스템 에러 |
| `cancelled` | 사용자 취소 | 사용자가 실행 중단 요청 |

**허용되는 상태 전이:**

| From | To | 조건 |
|------|----|------|
| pending | running | Worker 할당 |
| pending | cancelled | 큐 대기 중 취소 |
| running | completed | 정상 종료 |
| running | failed | 에러 발생 |
| running | cancelled | 사용자 취소 |
| running | waiting_for_input | Form 노드 도달, 버튼이 설정된 Presentation 노드 도달, 또는 AI Agent Multi Turn 대화 턴 대기 |
| waiting_for_input | running | 사용자 폼 제출, 버튼 클릭, 또는 AI 대화 메시지 수신/대화 종료 (실행 재개) |
| waiting_for_input | cancelled | 사용자 취소 또는 타임아웃 |

> **원자성 보장**: `running ↔ waiting_for_input` 전이는 짝이 되는 `NodeExecution` 상태 변경 (`waiting_for_input` / `completed`) 과 **단일 DB 트랜잭션** 으로 묶여 commit / rollback 된다. 서버가 두 save 사이에 크래시해도 `Execution` 과 `NodeExecution` 의 상태 불일치가 발생하지 않는다 (구현: `ExecutionEngineService.updateExecutionStatus` 의 `linkedNodeExec` 파라미터). WebSocket 이벤트 발행은 트랜잭션 commit 후 수행한다.

### 1.3 블로킹/재개 컨트랙트 (NodeHandlerOutput `status`)

개별 노드는 `NodeHandlerOutput.status` 로 엔진 흐름 제어 디렉티브를 표현한다. 공통 블로킹/재개 컨트랙트 (CONVENTIONS Principle 4):

| `status` | 의미 | 방출 시점 |
|-----------|------|-----------|
| `undefined` | 일반 완료 (대부분 노드) | 비블로킹 노드 최종 출력 |
| `waiting_for_input` | 사용자 입력 대기 | Form · Carousel(button) · Chart(button) · Table(button) · Template(button) · AI Agent multi-turn · Information Extractor multi-turn |
| `resumed` | 사용자 입력을 수신한 직후 | 재개 tick (observability-only, 라우팅 효과 없음) |
| `ended` | multi-turn 종료 | LLM 대화가 `completed` / `user_ended` / `max_turns` / `max_retries` / `error` 중 하나로 최종 정산 시 |
| `requires_integration` | 외부 통합이 연결되지 않아 준비 필요 | send_email 등 integration 미연결 시 (Stage 4) |
| `requires_playwright` | PDF 렌더러 필요 | PDF 노드 |

**재개 상태 (resumed) 구체 규약** — CONVENTIONS §4.1, 4.4, 4.5:

```
[노드 도달]
   ↓
 status: "waiting_for_input"
 output: <런타임 계산값 only — Principle 1.1>
   ↓ (사용자 입력 수신)
 status: "resumed"
 output: {
   ...waiting 시점 런타임 필드,
   interaction: {
     type: "form_submitted" | "button_click" | "button_continue" | "message_received",
     data: <type 별 payload>,
     receivedAt: ISO8601
   }
 }
   ↓ (multi-turn LLM 의 경우 종료 조건 도달 시)
 status: "ended"
 port: <end reason 기반 포트>
 output: { result: {...} } 또는 { error: {...} }
```

**재개 state 직렬화 필드** (`NodeHandlerOutput.output._resumeState`):

- AI 계열(ai_agent / information_extractor) multi-turn 핸들러가 다음 턴을 처리하기 위해 보관하는 내부 상태.
- 실행 엔진은 `_resumeState` 를 우선 읽고, 없으면 레거시 `_multiTurnState` 로 fall-back 한다 (Stage 2 rename, Stage 5 에서 legacy 키 제거 예정).
- expression resolver 는 이 필드를 expose 하지 않는다 (internal-only).
- 최종 출력 저장 시 엔진이 `_resumeState` / `_multiTurnState` 양쪽 모두를 제거한다.

**`interaction.data` payload 규격** (CONVENTIONS §4.5):

| `interaction.type` | `data` 형태 | 적용 노드 |
|---|---|---|
| `form_submitted` | `{ [fieldName]: value }` | `form` |
| `button_click` | `{ buttonId, buttonLabel, selectedItem? }` | `carousel` / `table` / `chart` / `template` |
| `button_continue` | `{ buttonId, buttonLabel, url }` | link 타입 버튼 |
| `message_received` | `{ content, role: "user" }` | `ai_agent` / `information_extractor` multi-turn |

> 현재 엔진은 presentation 노드의 `status: 'submitted' | 'button_click' | 'button_continue'` 레거시 값을 유지한다. Stage 3(presentation Principle 1.1 재작성) 에서 모두 `resumed` 로 통일 예정.

### 1.2 NodeExecution 상태

```
                    ┌─ completed
                    │
pending → running ──┤
                    ├─ failed
                    │
                    ├─ skipped
                    │
                    └─ waiting_for_input → completed (폼 제출, 버튼 클릭, 또는 AI 대화 종료 시)
```

| 상태 | 설명 |
|------|------|
| `pending` | 실행 대기 (선행 노드 완료 대기) |
| `running` | 실행 중 |
| `waiting_for_input` | 사용자 입력 대기 중 — Form 노드, 버튼이 설정된 Presentation 노드, 또는 AI Agent Multi Turn 대화 입력 대기 |
| `completed` | 정상 완료 |
| `failed` | 실행 실패 |
| `skipped` | 건너뜀 (노드 비활성, Skip Node 정책, 조건 분기 미선택) |

---

## 2. 그래프 순회

### 2.1 토폴로지 정렬 기반 실행 (순환 참조 지원)

워크플로우 실행 시 노드 그래프를 토폴로지 정렬(Topological Sort)하여 실행 순서를 결정한다.
순환 참조(Cyclic Graph)를 지원하기 위해 **back-edge 기반 실행** 방식을 사용한다.

```
1. 워크플로우의 모든 노드와 엣지를 로드
2. 컨테이너 내부 노드(container_id != null)를 글로벌 그래프에서 제외
3. Tool Area 노드(tool_owner_id != null)를 글로벌 그래프에서 제외
4. DFS로 back-edge (순환을 형성하는 간선) 식별
5. back-edge를 제거한 forward-edge만으로 DAG 구성 → 토폴로지 정렬
6. pointer 기반 순차 실행:
   - 분기는 선택된 포트만 실행
   - 노드 실행 후 back-edge가 활성화(포트 매칭)되면 pointer를 되감아 재실행
   - 노드별 최대 반복 횟수 초과 시 실행 중단 (에러)
```

#### 순환 참조 제한

| 설정 | 환경 변수 | 기본값 | 설명 |
|------|-----------|--------|------|
| 노드별 최대 반복 횟수 | `MAX_NODE_ITERATIONS` | `100` | 단일 노드가 한 실행에서 반복될 수 있는 최대 횟수. `0` 설정 시 무제한. |

#### back-edge 활성화 조건

- 소스 노드의 출력에 `_selectedPort`가 있는 경우: back-edge의 `sourcePort`가 선택된 포트와 일치할 때만 활성화
- 소스 노드의 출력에 `_selectedPort`가 없는 경우: **항상 활성화** (무조건 루프백)
  - 따라서 `_selectedPort`를 출력하지 않는 일반 노드(pass-through)에 back-edge를 연결하면 탈출 불가능한 무한 루프가 됨
  - 이 경우 `MAX_NODE_ITERATIONS` 가드에 의해 최종적으로 실행이 중단됨
  - **순환 참조는 반드시 분기 노드(Switch, If/Else 등)의 특정 포트에서만 back-edge를 연결해야 안전함**
- 활성화된 back-edge가 있으면 해당 타겟 노드부터 재실행, 재실행 구간의 포트 라우팅 스킵 상태가 초기화됨

#### `_selectedPort` 메타데이터 처리

`_selectedPort`는 해당 노드의 엣지 라우팅에만 사용되는 내부 메타데이터이다. 다운스트림 노드의 input으로 전달될 때 자동으로 제거(strip)된다. 이를 통해 pass-through 노드(Variable, Set Variable 등)를 거쳐도 이후 노드가 잘못 skip되지 않는다.

### 2.2 컨테이너 내부 독립 정렬

컨테이너 노드(Loop, ForEach, Map) 내부의 자식 노드는 독립적으로 토폴로지 정렬한다. Background 는 컨테이너 멤버십(`container_id`) 모델을 사용하지 않고 `background` 포트 엣지로 본문을 식별한다 — §3.3 참조.

- 컨테이너 실행 시점에 내부 노드의 실행 순서를 별도 산출
- 내부 그래프는 글로벌 DAG 사이클 검사에서 제외 (반복 구조 허용)
- 컨테이너 경계를 넘는 엣지는 존재하지 않음 (포트를 통해서만 데이터 전달)

### 2.3 Tool Area 노드 처리

Tool Area에 등록된 노드(tool_owner_id != null)는 그래프 순회에 참여하지 않는다.

- AI Agent의 LLM이 도구 호출을 요청할 때만 **on-demand**로 실행
- 실행 결과는 AI Agent 노드의 tool call 컨텍스트로 반환
- NodeExecution 레코드는 정상 생성 (parent_execution_id = AI Agent의 NodeExecution)

---

## 3. 컨테이너 실행

컨테이너 노드(Loop / ForEach / Map)는 공통적으로 `body` 출력 포트로 진입하여 서브그래프를 반복 실행하고, body 내부 노드 중 **`emit` 입력 포트에 연결된 노드**의 출력을 각 반복의 결과로 수집하여 `done` 출력 포트로 배열을 내보낸다.

### 3.0 공통 수집 모델 — `emit` 포트

각 컨테이너는 `emit`이라는 **입력 포트**를 가진다. body 서브그래프의 한 노드가 그 출력을 container의 emit 포트로 연결하면, 해당 노드의 iter별 출력이 결과 배열 원소로 수집된다.

**검증 규칙 (엔진이 컨테이너 실행 시작 전에 강제)**
- emit 포트에 연결된 body 노드가 **0개** → `CONTAINER_MISSING_EMIT` 에러로 실행 실패.
- emit 포트에 연결된 body 노드가 **2개 이상** → `CONTAINER_MULTIPLE_EMIT` 에러로 실행 실패.
- emit source가 port routing으로 해당 iter에 도달하지 못한 경우 → 그 iter의 수집 값은 `undefined`.

### 3.1 Loop 실행

```
1. count 평가 → N회
2. plan = planContainerBody(loopNode, nodes, edges)  // emit 검증 포함
3. for i in 0..N:
   a. $loop.index = i, $loop.count = N 바인딩
   b. 컨테이너 내부 노드 그래프를 토폴로지 순서로 실행
   c. plan.emitSource의 출력을 results[i]로 수집
   d. breakCondition 평가 → 충족 시 조기 종료
4. results 배열을 done 포트로 전달
```

- 각 반복은 독립된 NodeExecution 세트 생성 (iteration 인덱스 기록).
- `maxIterations` 초과 시 `MAX_ITERATIONS_EXCEEDED` 에러.
- 중첩 Loop 시 외부 `$loop`가 자동으로 save/restore된다(`LoopExecutor`).

### 3.2 ForEach / Map 실행

ForEach와 Map은 동일한 `ForEachExecutor`를 공유한다. 시맨틱만 다르다(ForEach=side effect, Map=transform).

```
1. arrayField(또는 Map의 inputField) 평가 → 배열 추출
2. plan = planContainerBody(containerNode, nodes, edges)  // emit 검증 포함
3. for each item, index in array:
   a. $item = 현재 항목, $itemIndex = index 바인딩
   b. 컨테이너 내부 노드 그래프를 토폴로지 순서로 실행
   c. plan.emitSource의 출력을 results[index]로 수집
   d. errorPolicy에 따라 에러 처리:
      - stop    → 즉시 실패
      - skip    → results[index] = { _skipped: true, error: { code, message } }
      - continue → 동일. 에러 정보는 NodeExecution에도 기록
4. results 배열을 done 포트로 전달
```

- 결과 배열은 원본 배열과 **동일 인덱스**를 유지한다. 이를 통해 다운스트림에서 원본 ↔ 결과 매칭이 가능하다.
- 중첩 ForEach 시 외부 `$item` / `$itemIndex`가 자동으로 save/restore된다(`ForEachExecutor`).

#### body 서브그래프 제약

- **back-edge(순환)** 금지 — `Container body contains back-edges` 에러.
- **blocking 노드**(form / buttons / ai_conversation) 금지 — body 내부에서 사용자 대기 상태가 발생하면 iter 반복 의미가 모호해지므로 차단.
- body 내부에 또 다른 컨테이너 중첩은 허용. 스코프 체인은 §3.4 참조.

### 3.4 중첩 컨테이너 스코프

컨테이너가 중첩된 경우(예: Loop > ForEach), 내부 컨테이너는 **스코프 체인**을 통해 외부 컨텍스트를 참조할 수 있다.

#### 3.4.1 스코프 체인 규칙

| 규칙 | 설명 |
|------|------|
| 읽기 가능 | 내부 컨테이너에서 외부 컨테이너의 컨텍스트 변수를 읽을 수 있다 |
| 쓰기 불가 | 내부 컨테이너에서 외부 컨테이너의 컨텍스트 변수를 직접 수정할 수 없다 |
| Shadowing | 동명 변수가 존재하면 내부(현재 스코프)가 우선한다 |
| `$parent` 접근 | `$parent.loop`, `$parent.item`으로 한 단계 외부 컨테이너 컨텍스트에 명시적으로 접근 |

#### 3.4.2 예시: Loop > ForEach 중첩

```
Loop (외부)                    ForEach (내부)
──────────────                 ──────────────────
$loop.index = 2               $item = "current item"
$loop.count = 10              $item.index = 1
                               $parent.loop.index = 2  (외부 Loop 참조)
                               $parent.loop.count = 10
```

- 내부 ForEach에서 `$loop`를 참조하면 → 외부 Loop의 `$loop` (ForEach는 `$loop` 변수를 생성하지 않으므로 shadowing 없음)
- 내부 ForEach에서 `$item`을 참조하면 → ForEach 자신의 현재 항목
- 외부 Loop에 대해 명시적으로 `$parent.loop`로도 접근 가능

---

### 3.3 Background 실행

> **✅ 구현 완료 (평면 구조 — PRD 3 §4.11 ND-BG-05 대안 구현)**: Background 는 컨테이너 멤버십(`container_id`) 모델을 사용하지 않는다. 대신 `background` 포트 엣지로 본문 진입점을 식별하고, 별도 BullMQ `background-execution` 큐 + 워커로 비동기 실행한다.

흐름:

```
1. main 포트로 입력 데이터를 즉시 pass-through (메인 흐름 계속)
2. 핸들러 실행 직후 ExecutionEngineService 의 scheduleBackgroundBody() 가
   현재 컨텍스트 스냅샷(variables 얕은 복사 + rawConfig)을 담아 본문 진입점들을
   `background-execution` 큐로 enqueue
3. 워커는 executeBackgroundSubgraph() 에서 background 포트 엣지로부터 forward-reachable
   한 서브그래프를 격리된 컨텍스트로 실행 (parentNodeExecutionId 그룹핑)
4. 백그라운드 완료/실패 시 설정에 따라 알림 — NotificationsService 통해
```

- 메인 Execution과 동일한 `execution_id`를 공유. 본문 노드의 `parentNodeExecutionId` 가 Background 노드 자신의 NodeExecution id 를 가리킨다
- 백그라운드 실패가 메인 흐름의 Execution 상태에 영향을 주지 않음
- 백그라운드 실패 시 `notifyOnError=true`이면 `notifyChannels`에 따라 알림 전송:
  - `in_app`: Notification 엔티티 생성 (`type: background_failed`, 실행 시작 사용자에게)
  - `email`: 실행 시작 사용자 이메일로 실패 알림 발송
- Execution 상세 화면에서 Background 실행 결과를 별도 섹션으로 표시 (성공/실패 불문). 본문 실행 모니터링 API 는 `plan/in-progress/background-monitoring-api.md` 에서 별도 추적

---

## 4. Worker 모델

### 4.1 아키텍처

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Execution  │────→│  Redis BQ    │────→│  Worker 1   │
│  Engine     │     │  (Task Queue)│     │  Worker 2   │
│  (Producer) │     │              │     │  Worker N   │
└─────────────┘     └──────────────┘     └─────────────┘
```

### 4.2 태스크 단위

- **1 Worker = 1 NodeExecution**: 각 Worker는 한 번에 하나의 노드 실행을 처리
- 태스크 메시지 형식:

```json
{
  "taskId": "uuid",
  "executionId": "uuid",
  "nodeId": "uuid",
  "nodeType": "ai_agent",
  "input": { ... },
  "context": {
    "variables": { ... },
    "loopContext": null,
    "itemContext": null
  },
  "timeout": 30000,
  "retryCount": 0
}
```

### 4.3 수평 확장

| 항목 | 설명 |
|------|------|
| Worker 인스턴스 수 | 환경 변수로 설정 (기본: 4) |
| 스케일 아웃 | Worker 프로세스를 추가하여 처리량 증가 |
| 큐 파티셔닝 | 워크스페이스별 큐 분리 가능 (멀티테넌트 격리) |
| 우선순위 큐 | 수동 실행 > 트리거 실행 > 스케줄 실행 |

### 4.4 이벤트 발행 sink — `WebsocketService` 단일 sink 정책

> **결정**: 실행 엔진의 외부 이벤트 발행 (`NODE_STARTED` / `NODE_COMPLETED` / `EXECUTION_*` / `AI_MESSAGE` 등) sink 는 **`WebsocketService` 가 canonical** 이며, 별도 추상화 (`IExecutionEventEmitter` 같은 인터페이스 / Nest `EventEmitter2`) 를 도입하지 않는다.

근거:

- **단일 sink** — 본 시스템에서 외부 이벤트 소비자는 WebSocket 클라이언트 1종 뿐. 다중 sink 가 가시화되기 전까지 추상화는 YAGNI.
- **분산은 Continuation Bus (§7.4) 가 담당** — 인스턴스 간 fan-out 은 Redis pub/sub 채널 `execution:continuation` 이 처리하므로, 이벤트 발행 추상화와 분산 동작은 직교.
- **순환 의존 처리** — `ExecutionEngineService ↔ WebsocketService` 의 순환은 NestJS 표준 패턴인 `forwardRef(() => WebsocketService)` 로 해결. 이는 Nest 권장 패턴이며 회피해야 할 안티패턴이 아님.
- **테스트 격리** — Spec 테스트에서는 `Partial<WebsocketService>` mock 으로 충분. 추상화 인터페이스를 위한 별도 noop 구현체 불필요.

> 향후 외부 sink (Webhook 콜백, 텔레메트리 export 등) 가 실제로 추가될 때 본 결정을 재검토한다.

---

## 5. 노드 핸들러 계약

### 5.1 NodeHandler 인터페이스

모든 노드 유형은 공통 핸들러 인터페이스를 구현한다.

```ts
interface NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult;
  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput>;
}

interface NodeHandlerOutput {
  /**
   * **원본(pre-evaluation) 입력 설정의 echo**. expression(`{{ ... }}`) 이 포함된 필드는
   * 평가 전 형태 그대로 echo 하고, 평가 결과는 `output.*` 에 둔다 (CONVENTIONS Principle 7).
   * 민감 정보(credential 본체) 는 포함하지 않는다.
   */
  config: Record<string, unknown>;

  /** 실제 생산된 결과값 — 배열/객체/primitive 모두 허용. */
  output: unknown;

  /** 부가 실행 정보. durationMs, statusCode, tokensUsed 등 관측 메타데이터. */
  meta?: Record<string, unknown>;

  /** 라우팅 디렉티브. 값은 노드 정의의 출력 포트 식별자. */
  port?: string;

  /** 엔진 흐름 제어. 'waiting_for_input' | 'requires_integration' | 'requires_playwright' 등. */
  status?: string;
}
```

| 메서드 | 설명 |
|--------|------|
| `validate(config)` | 노드 설정의 유효성 검사. 워크플로우 저장/실행 전에 호출. 에러 시 `{ valid: false, errors: [...] }` 반환 |
| `execute(input, config, context)` | 노드 실행. `config` 는 expression 평가 후 값. `context.rawConfig` 로 평가 전 원본을 함께 받는다. `NodeHandlerOutput` 을 반환한다 |

**config vs output 원칙** (CONVENTIONS Principle 1.1 / 7)

- `NodeHandlerOutput.config` 는 "노드가 **어떻게 설정됐는가**" — 워크플로 작성자가 입력한 **원본(pre-evaluation)** 형태. 후속 노드는 `$node["X"].config.<field>` 로 참조한다.
- `output` 은 "노드가 **무엇을 생산/사용했는가**" — expression 평가 결과·실행 결과. 후속 노드는 `$node["X"].output.<field>` 로 참조한다.
- 따라서 expression 이 포함된 필드는 두 영역에 서로 다른 값이 존재한다 (예: `config.subject = "Hello {{ name }}"`, `output.subject = "Hello Alice"`).
- `meta` 는 실행 부산물(시간, 외부 상태코드, 토큰 사용량). 비즈니스 로직이 아닌 관측 정보.
- `port`, `status` 는 엔진이 읽어 흐름을 결정하는 디렉티브 — 일반 downstream 참조는 권장하지 않는다.

**민감 정보 정책**

- `config`에는 `integrationId` UUID, 액션 이름, 파라미터만 echo한다.
- credentials 객체(access_token, password, api_key, private_key 등)는 handler 내부에서만 사용하고 반환값에 포함하지 않는다.
- AES-256-GCM으로 저장된 credential을 복호화해 외부 서비스에 전달한 뒤, 반환값을 구성할 때는 credential을 떨어뜨린다.

### 5.2 `$node` Expression 네임스페이스

Expression resolver는 각 노드의 `NodeHandlerOutput`을 그대로 `$node[nodeKey]`에 노출한다. Legacy `$node[key] = { output: ... }` wrapper는 제거되었다.

```ts
// expression-resolver.service.ts
$node[resolvedKey] = executionContext.nodeOutputCache[nodeId];
```

| 표현식 | 반환 |
|--------|------|
| `$node["SendEmail"].output.messageId` | 메일 전송 결과 messageId |
| `$node["SendEmail"].config.subject` | 노드 설정의 **원본** 제목 (예: `"Hello {{ name }}"` — expression 미평가 형태) |
| `$node["SendEmail"].output.subject` | 실제 발송된 제목 (예: `"Hello Alice"` — expression 평가 결과) |
| `$node["HTTP"].meta.statusCode` | HTTP 응답 상태코드 |
| `$node["HTTP"].output.response` | 응답 본문 |
| `$node["IfElse"].port` | 실행 시 선택된 포트 (`'true'` / `'false'`) |
| `$node["Form"].status` | `'waiting_for_input'` 등 엔진 디렉티브 |

expression 이 포함된 필드는 `.config.*` 에서 **원본** 을, `.output.*` 에서 **평가 결과** 를 얻는다. expression 이 포함되지 않은 필드(예: `mode`, `chartType`)는 두 영역의 값이 동일하므로 `.config.*` 만 사용해도 충분하다.

`nodeKey`는 노드 라벨(중복 시 `#N` suffix)과 노드 UUID 두 방식 모두 지원한다. `.output`·`.config`·`.meta`·`.port`·`.status` 외의 필드는 정의되지 않는다.

### 5.3 Port Selector 패턴

조건 분기 노드(`if-else`, `switch`, `text-classifier`, `http-request`, `ai-agent` 조건 라우팅)는 반환값에 `port` 필드를 함께 설정한다:

```ts
return {
  config: { condition: '...' },
  output: forwardedData,      // downstream으로 전달될 입력
  port: 'true' | 'false',     // 엔진이 이 포트의 엣지만 활성화
};
```

엔진의 `applyPortSelection(output)`은 `output.port`를 읽어 `_selectedPort`를 기록하고, downstream 노드의 input은 `output.output`이 된다.

Legacy `{ port, data }` 패턴은 제거되었으며, 이행 기간 호환성을 위해 `output.data`가 있으면 `output.output`으로 자동 보정한다.

### 5.4 NodeHandlerRegistry

```
interface NodeHandlerRegistry {
  register(nodeType: string, handler: NodeHandler) → void
  get(nodeType: string) → NodeHandler
}
```

- 시스템 시작 시 모든 빌트인 노드 핸들러를 레지스트리에 등록
- 마켓플레이스를 통해 설치된 커스텀 플러그인 노드도 동일 레지스트리에 등록
- 미등록 nodeType 조회 시 `UNKNOWN_NODE_TYPE` 에러

### 5.5 표현식 해석 단계

노드 실행 전, config 객체의 문자열 필드에 포함된 `{{ }}` 표현식을 해석한다. 엔진은 **원본(rawConfig) 과 평가 결과(resolvedConfig) 모두** 핸들러에 노출하여 핸들러가 echo 와 실행을 분리할 수 있게 한다.

```
1. handler.validate(rawConfig) → 원본 config의 구조 유효성 검사
2. resolvedConfig = ExpressionResolver.resolveConfig(rawConfig, exprContext, nodeType)
   - config 객체를 재귀 순회하며 문자열 값의 {{ }} 패턴을 evaluate()
   - 전체가 {{ expr }}인 경우: 평가 결과의 원래 타입 유지 (number, object 등)
   - 혼합 텍스트 + 표현식: 결과는 항상 string
   - number, boolean, null: 패스스루
   - 1회 패스만 수행 (재귀 해석 없음)
3. handler.execute(input, resolvedConfig, { ...context, rawConfig }) → output
```

`context.rawConfig` 는 평가 전 원본 config 의 reference 다. 핸들러가 `NodeHandlerOutput.config` echo 시 사용한다 (CONVENTIONS Principle 7). 핸들러는 평가된 값으로 동작하지만 echo 는 원본을 보존하여 후속 노드의 `$node["X"].config.*` / `$node["X"].output.*` 직교성을 유지한다.

**ExpressionContext 구성**:

| 변수 | 소스 |
|------|------|
| `$input` | 이전 노드 출력 (gatherNodeInput 결과). 트리거 노드에서는 `{ parameters, ...(트리거별 메타) }` |
| `$params` | `$input.parameters`의 축약형. Trigger 노드가 생성한 구조화된 입력 파라미터에 직접 접근 |
| `$node` | nodeMap + nodeOutputCache → 노드 라벨 키 맵. `$node["Label"].output` 형태로 접근 |
| `$var` | context.variables (Variable Declaration/Modification으로 관리) |
| `$execution` | `{ id, workflowId, startedAt, mode }` |
| `$now` | 실행 시점의 현재 시각 (ISO 8601, UTC). 같은 실행 안에서는 동일한 값으로 고정 |
| `$loop` | loopContext (Loop 컨테이너 내부) |
| `$item`, `$itemIndex` | itemContext (ForEach 컨테이너 내부) |

**핸들러별 제외 규칙**:

| 핸들러 | 제외 키 | 사유 |
|--------|---------|------|
| `code` | `code` | 원시 JavaScript — 자체 런타임(`$input`, `$vars`, `$execution`) 사용 |
| `template` | `template` | 자체 `{{ }}` 파서로 input 데이터 참조. 향후 범용 표현식으로 통합 예정 |

> **상세**: 표현식 문법, 내장 함수, 타입 시스템은 [표현식 언어 스펙](./5-expression-language.md) 참조.

### 5.6 Worker 실행 흐름

```
1. Worker가 태스크 큐에서 태스크 메시지를 수신
2. registry.get(nodeType) → handler 조회
3. handler.validate(rawConfig) → 유효하지 않으면 즉시 실패 (INVALID_NODE_CONFIG)
4. ExpressionResolver.resolveConfig(rawConfig) → resolvedConfig (§5.5)
5. handler.execute(input, resolvedConfig, { ...context, rawConfig }) → output
6. 출력 정규화: output이 JSON 직렬화 가능한지 확인
7. NodeExecution 레코드에 input, output, status 기록
8. 다음 노드 태스크 생성 (그래프 순회에 따라)
```

### 5.7 노드 유형별 리트라이 정책

| 카테고리 | 기본 리트라이 | 설정 가능 | 비고 |
|----------|-------------|-----------|------|
| Integration | 최대 3회, 지수 백오프 | O (maxRetries, retryDelay) | 외부 서비스 일시 장애 대응 |
| AI | 최대 2회, 지수 백오프 | O | LLM 프로바이더 일시 장애 대응 |
| Logic | 리트라이 없음 | X | 결정론적 실행, 재시도 무의미 |
| Data | 리트라이 없음 | X | 결정론적 실행, 재시도 무의미 |
| Flow | 최대 1회 | O | 하위 워크플로우 호출 실패 시 |
| Presentation | 리트라이 없음 | X | UI 렌더링, 재시도 무의미 |

> 사용자가 노드 설정 패널의 에러 처리 정책에서 "Retry"를 선택하면 위 기본값을 오버라이드할 수 있다. [노드 공통 스펙 §2.4](../3-workflow-editor/1-node-common.md#24-에러-처리-정책) 참조.

---

## 6. 실행 컨텍스트

### 6.1 컨텍스트 구조

```json
{
  "executionId": "uuid",
  "workflowId": "uuid",
  "nodeExecutionId": "uuid",
  "rawConfig": {
    "subject": "Hello {{ name }}",
    "body": "Welcome, {{ user.firstName }}!"
  },
  "variables": {
    "__workspaceId": "uuid",
    "myVar": "value"
  },
  "nodeOutputCache": {
    "node-uuid-1": { "field": "output data" },
    "node-uuid-2": { ... }
  },
  "loopContext": {
    "index": 3,
    "count": 10,
    "isFirst": false,
    "isLast": false
  },
  "itemContext": {
    "item": { ... },
    "index": 2,
    "isFirst": false,
    "isLast": false
  }
}
```

| 필드 | 언제 설정되는가 | 용도 |
|------|----------------|------|
| `executionId` | 실행 시작 시 고정 | Execution/NodeExecution 귀속 |
| `workflowId` | 실행 시작 시 고정 | 표현식 컨텍스트, 사용처 확인 |
| `nodeExecutionId` | 엔진이 handler.execute 호출 직전 주입, 노드별 갱신 | Integration 핸들러가 `IntegrationUsageLog.node_execution_id`로 기록 |
| `rawConfig` | 엔진이 handler.execute 호출 직전 주입, 노드별 갱신 | 노드 정의에 저장된 **원본 config** (expression 미평가). 핸들러가 `NodeHandlerOutput.config` echo 에 사용 (Principle 7). Shallow `Object.freeze` 적용 — top-level mutation 차단, 중첩 객체는 read-only 로 다룬다 |
| `engineResolvedConfigCache` | 엔진이 expression 평가 직후, 노드별로 누적 갱신 | 노드별로 **expression 평가가 끝난 config** 의 snapshot. `runContainerInner` / `runParallel` 같이 핸들러 종료 후 별도 단계에서 동작 파라미터(Loop `count`, Parallel `branchCount`/`maxConcurrency`/`waitAll`, ForEach `errorPolicy` 등) 를 다시 읽어야 하는 경로가 사용한다. **expression 컨텍스트에는 노출하지 않는다** — `$node["X"].config` 는 여전히 raw echo 를 반환해야 한다 (Principle 7 보존). 핸들러가 raw 만 echo 하는 컨테이너의 동작 파라미터가 silent default fallback 되거나 `Number("{{...}}")` 가 NaN 이 되던 문제를 차단 |

**Multi-turn 재개 시 `rawConfig` snapshot 정책**:
- 첫 turn 의 `executeNode` 가 `waiting_for_input` 으로 진입하면 엔진이 `state.rawConfig = Object.freeze({ ...node.config })` 을 자동 snapshot 한다.
- 후속 turn 의 `processMultiTurnMessage(message, state)` 는 state 만 받으므로 (ExecutionContext 미주입), 핸들러가 `state.rawConfig` 로 일관되게 접근한다.
- **의도된 차이**: `context.rawConfig` 는 매 노드 실행 시점의 fresh DB read, `state.rawConfig` 는 첫 turn 시점의 frozen snapshot. 단일 multi-turn 실행 도중 사용자가 워크플로 정의를 변경해도 후속 turn 은 첫 turn 시점의 정의로 일관되게 동작한다 — replay reproducibility.
| `variables.__workspaceId` | 실행 시작 시 주입 (workflow.workspaceId) | Integration 조회, AI LLM 설정 조회 등 워크스페이스 단위 리소스 해소 |
| `variables.*` (그 외) | 트리거·워크플로우 변수 | 표현식 `{{ $variables.X }}` 평가 |

### 6.1.1 트리거 입력 파라미터 seeding

실행 엔진의 진입 API는 `execute(workflowId, input?, options?)` 시그니처이며, `input`은 트리거 종류와 무관하게 아래 규약을 따른다.

```typescript
type TriggerExecutionInput = {
  parameters?: Record<string, unknown>;
  // webhook 한정 추가 필드
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  method?: string;
};

type ExecuteOptions = {
  /** 수동 실행 시 사용자 UUID. 저장된 값은 `Execution.executed_by` 컬럼에 매핑. */
  executedBy?: string;
  /** schedule/webhook 트리거 발화 시 트리거 UUID. 저장된 값은 `Execution.trigger_id` 컬럼에 매핑. */
  triggerId?: string;
};
```

- **공통 유틸** `resolveTriggerParameters(workflow, rawValues)`:
  1. 워크플로우 그래프에서 `manual_trigger` 노드를 찾아 `config.parameters` 스키마 조회
  2. required 누락 시 `InvalidInputError` (호출측이 400/실행 실패로 매핑)
  3. 기본값(defaultValue) 적용
  4. `coerceToType`로 타입 강제 변환 (variable-declaration 공용 유틸)
- **Manual**: 컨트롤러가 `{ parameterValues }`를 수신 → `resolveTriggerParameters` 수행 → `{ parameters }` + `{ executedBy: user.sub }` 형태로 `execute()` 호출. 결과 Execution 행은 `executed_by` 컬럼이 채워져 출처가 `manual` 로 분류된다.
- **Webhook**: `HooksService`가 `body`를 raw source로 사용하여 `resolveTriggerParameters` 수행. 실패 시 `400 Bad Request` 후 Execution 생성하지 않음. 성공 시 `{ parameters, body, headers, query, method }` + `{ triggerId: trigger.id }` 로 `execute()` 호출. 결과 Execution 행은 `trigger_id` 컬럼이 채워져 출처가 `webhook` 으로 분류된다.
- **Schedule (cron 자동 발화)**: `ScheduleRunnerService.process()`가 `schedule.parameterValues`를 제한 컨텍스트(`{ $now, $schedule: { id, cronExpression, timezone } }`)로 ExpressionResolver에 통과시킨 뒤 `resolveTriggerParameters` 수행 → `{ parameters }` + `{ triggerId: schedule.triggerId }` 로 `execute()` 호출. `$node`, `$input`, `$var` 불가. 결과 Execution 행은 `trigger_id` 컬럼이 채워져 출처가 `schedule` 로 분류된다.
- **Schedule "지금 실행"**: 사용자가 수동으로 즉시 실행 버튼을 누른 경우는 Manual 경로와 동일하게 `{ executedBy: userId }` 로 호출 — 출처는 `manual`.

> 출처 분류 규칙(우선순위 + 라벨)은 [Spec 실행 내역 §2.4](../2-navigation/14-execution-history.md#24-테이블) 참조. 분류 헬퍼 구현은 `backend/src/modules/executions/utils/execution-trigger.ts` 의 `deriveExecutionTrigger`.

Manual Trigger 핸들러의 `execute()` 출력은 항상 다음 형태이다:

```json
{
  "config": { "parameters": [...] },
  "output": {
    "parameters": { "name": "test", "count": 3 },
    "body": "...(webhook 시)",
    "headers": "...(webhook 시)"
  }
}
```

다운스트림 표현식 해석 시 `$input.parameters === $params === context.parameters` 관계가 성립한다.

### 6.2 저장 전략

| 단계 | 저장소 | 설명 |
|------|--------|------|
| 실행 중 | Redis | 실행 컨텍스트를 Redis에 저장 (TTL: 실행 타임아웃 × 2) |
| 노드 완료 시 | Redis + PostgreSQL | nodeOutputCache 업데이트(Redis), NodeExecution 레코드 저장(PostgreSQL) |
| 실행 완료 시 | PostgreSQL | 전체 컨텍스트를 PostgreSQL에 영구 저장, Redis에서 삭제 |

### 6.3 재실행/조회 정책 (Replay Policy)

저장된 실행 이력을 사용자가 다시 활용하는 시나리오의 정책. 의미가 다른 두 모드를 분리해 정의한다 — 한쪽은 외부 부수효과 0, 다른 쪽은 새 실행으로 부수효과 재트리거.

| 모드 | 의미 | 구현 상태 | 외부 부수효과 | expression 평가 |
|------|------|-----------|---------------|-----------------|
| **View** | 실행 이력 조회 — `NodeExecution.outputData` 를 그대로 표시 | ✅ 구현됨 (execution-history UI) | ❌ 없음 | ❌ 없음 |
| **Re-run** | 새 Execution 시작 — 현재 워크플로 정의의 raw config 를 다시 평가 | 🚧 미구현 (future PRD) | ✅ 재트리거 — 이메일 재발송, HTTP 재호출 등 | ✅ `$now` / `random()` 등 새 실행 시점 재고정 |
| **Multi-turn resume** | 같은 실행의 다음 turn 진행 — `state.rawConfig` frozen snapshot 사용 | ✅ 구현됨 (§1.3 / `executions/:id/continue`) | 해당 노드 한정 (`processMultiTurnMessage`) | 해당 노드 한정 |

**핵심 직교성**:
- **View 와 Multi-turn resume 은 replay 가 아니다**. View 는 historical record 조회, Multi-turn resume 은 진행 중 실행의 다음 turn.
- **Re-run 은 새 Execution row 를 생성**한다 — 기존 row 의 input 을 복사할 수 있으나, 실행 결과는 현재 워크플로 정의 + 현재 시각 + 외부 응답에 따라 달라진다.
- Re-run 도입 시 외부 부수효과 가드 (확인 모달 / dry-run 모드 / 멱등성 키) 는 별도 PRD 에서 설계한다 — 본 spec 의 정책 범위 밖.

**옛 NodeExecution row 호환성** (raw config exposure 도입 이전):
- 옛 row 는 `outputData.config` 가 expression **평가 후** 형태 (예: `{ subject: "Hello Alice" }`). 새 row 는 평가 **전** 형태 (예: `{ subject: "Hello {{ name }}" }`).
- 백필하지 않는다 — historical record 로 보존.
- expression 컨텍스트의 cross-execution 참조는 없다 (각 실행은 자기 nodeOutputCache 만 사용). 따라서 옛 row 의 의미 차이는 **UI 표시 차이만** — 실행 동작에는 영향 없음.
- View 는 best-effort — 옛 실행의 Send Email · HTTP Request 는 신규 `output.{subject, body, requestBody, responseHeaders, bodyTruncated}` 필드가 부재할 수 있다.

---

## 7. 장애 복구

### 7.1 Worker Heartbeat

| 항목 | 값 |
|------|-----|
| Heartbeat 간격 | 5초 |
| 미응답 판정 | 3회 연속 미응답 (15초) |
| 미응답 시 동작 | 해당 태스크를 큐에 재발행 (재큐) |

### 7.2 체크포인트 기반 Resume

```
1. 워크플로우 실행 중 각 노드 완료 시 체크포인트 저장
   - 완료된 노드 목록, 각 노드의 출력 데이터, 현재 실행 컨텍스트
2. Worker 장애 발생 시:
   a. 미완료 태스크(현재 실행 중이던 노드)를 재큐
   b. 새 Worker가 태스크 소비
   c. 해당 노드만 재실행 (이전 완료 노드는 재실행하지 않음)
3. 전체 Execution Engine 재시작 시:
   a. status=running인 Execution 목록 조회
   b. 각 Execution의 마지막 체크포인트에서 resume
```

### 7.3 멱등성 보장

- 각 NodeExecution에 고유 taskId 부여
- Worker는 실행 전 taskId 중복 확인 (이미 완료된 태스크는 스킵)
- 외부 API 호출 노드(Integration)의 멱등성은 노드 설정에서 관리

### 7.4 분산 실행 (Multi-instance)

LB 뒤에 backend 인스턴스 N개를 두는 수평 확장 환경에서의 실행 정합성 정책. 단일 인스턴스 환경에서도 모든 메커니즘이 동일하게 동작하므로 운영 토폴로지에 따른 분기는 없다.

**`execution_node_log` append-only 모델**

이전 모델 (`execution.execution_path` UUID 배열, `array_append()` 로 갱신) 은 DB 수준 atomic 추가는 가능했으나 다중 인스턴스에서 동시 INSERT 시 인스턴스 간 절대 순서가 보장되지 않았다. PR-B 부터:

- `execution_node_log (id BIGSERIAL, execution_id UUID, node_id UUID, created_at TIMESTAMPTZ)` 테이블에 노드 실행이 append.
- BIGSERIAL `id` 는 PostgreSQL sequence 가 부여하므로 인스턴스 동시성 안전. `(execution_id, id)` 정렬이 곧 실행 순서.
- `Execution.executionPath` 컬럼 제거. 외부 API 응답의 `executionPath: string[]` 시그니처는 유지 — `findById` 가 본 테이블의 정렬 쿼리로 채운다. 목록 조회 응답에서는 N+1 회피 위해 빈 배열로 반환한다.
- 이행 마이그레이션 두 단계로 분리 — V035 (테이블 생성 + `UNNEST WITH ORDINALITY` 이행, `executeInTransaction=false`) / V036 (컬럼 DROP, `lock_timeout=3s`). 운영 DB DDL lock 영향 최소화. Flyway 컨벤션상 alphanumeric suffix (V035a 등) 는 silent skip 되므로 항상 정수 prefix 사용.

**Continuation Bus (사용자 입력 fan-out)**

`pendingContinuations` Map (Promise resolver 보관) 은 인스턴스 로컬에 머물고, 사용자 입력 이벤트만 Redis pub/sub 으로 모든 인스턴스에 전파된다.

| 항목 | 값 |
|------|-----|
| Redis 채널 | `execution:continuation` |
| 메시지 타입 | `continue` / `cancel` / `button_click` / `ai_message` / `ai_end_conversation` |
| 메시지 스키마 | `{ type: ContinuationType, executionId: string, payload?: unknown }` |
| Connection 분리 | publisher / subscriber 별개 ioredis 인스턴스 (pub/sub 모드는 read-only command 만 받음) |

```
[client] → controller / WS gateway
            ↓
        bus.publish(msg)
            ↓
   ─── Redis pub/sub ───
   ↓                  ↓
instance A         instance B
  ↓                  ↓
dispatch          dispatch
  ↓                  ↓
pendingMap?       pendingMap?
  hit                miss
  ↓                  ↓
resolve()        silent skip
```

- 모든 진입점은 항상 `bus.publish` 한다. 자기 인스턴스에 로컬 Map 키가 있어도 마찬가지 — "내 Map 에 있으면 직접" 분기는 race window 가 생긴다.
- 메시지 수신 시 로컬 `pendingContinuations` Map 에 키가 있는 인스턴스 한 곳만 실제 resolve. 키가 없는 인스턴스는 silent skip.
- `continueExecution` / `cancelWaitingExecution` / `continueButtonClick` / `continueAiConversation` / `endAiConversation` 모두 동일 패턴. "No pending continuation" 즉시 throw 는 단일 인스턴스에서 정확히 판단 불가하므로 폐기된다.
- WAITING_FOR_INPUT 상태의 사전 검증 (controller / WS gateway) 은 publisher 측 책임.

**Recovery (`recoverStuckExecutions`)**

다중 인스턴스에서 신규 기동한 인스턴스가 다른 인스턴스에서 정상 처리 중인 WAITING_FOR_INPUT 을 잘못 FAIL 시키지 않도록 보수적 가드.

- **분산 lock**: `redis SET 'exec:recover:lock' <hostname:uuid-token> EX 60 NX` — 60초 TTL. 획득 실패 시 본 인스턴스는 skip. 컨테이너에서 PID 가 충돌해도 `hostname + UUID` 로 owner 식별 보장.
- **명시적 release**: 작업 종료 시 owner 검증 Lua script 로 lock 을 즉시 해제 — TTL 만료 대기 없이 다음 인스턴스가 처리 가능. owner 가 다르면 (이미 expire 후 다른 인스턴스가 잡은 lock) 절대 삭제하지 않는다.
- **Stale 임계값**: `started_at < now() - 30분` 인 row 만 FAIL UPDATE. 30분 미만의 신규 대기는 보존된다.
- 세 가드를 함께 적용해, 동시 부팅·진행 중 부팅 어떤 시나리오에서도 정상 대기를 잃지 않는다.

---

## 8. 동시 실행 제한

| 제한 항목 | 기본값 | 설정 위치 |
|-----------|--------|-----------|
| 워크스페이스당 동시 Execution 수 | 10 | Workspace.settings |
| 워크플로우당 동시 Execution 수 | 3 | Workflow.settings |
| 단일 Execution 최대 노드 수 | 500 | 시스템 설정 |
| 단일 Execution 최대 실행 시간 | 30분 | Workflow.settings |
| 노드별 기본 타임아웃 | 30초 | Node.config |

**제한 초과 시 동작:**
- 워크스페이스/워크플로우 제한 초과 → 새 Execution은 `pending` 상태로 큐 대기
- 최대 실행 시간 초과 → `EXECUTION_TIMEOUT` 에러 → Execution.status = `failed`
- 큐 대기 시간 제한 (기본: 5분) 초과 → `cancelled` 처리

---

## 9. Redis 키 네이밍 컨벤션

### 9.1 키 패턴

모든 Redis 키는 아래 패턴을 따른다:

```
{service}:{workspaceId}:{resource}:{id}:{sub}
```

| 세그먼트 | 설명 | 예시 |
|----------|------|------|
| `service` | 서비스 식별자 | `exec` (실행 엔진), `core` (Core API), `ws` (WebSocket) |
| `workspaceId` | 워크스페이스 UUID | `550e8400-...` |
| `resource` | 리소스 유형 | `execution`, `node`, `lock`, `rate`, `session` |
| `id` | 리소스 ID | UUID |
| `sub` | 하위 키 (선택) | `context`, `output`, `heartbeat` |

### 9.2 용도별 키 정의 및 TTL

| 키 패턴 | 용도 | TTL |
|---------|------|-----|
| `exec:{wsId}:execution:{execId}:context` | 실행 컨텍스트 (변수, nodeOutputCache) | 실행 타임아웃 × 2 |
| `exec:{wsId}:execution:{execId}:status` | 실행 상태 (running, waiting 등) | 실행 타임아웃 × 2 |
| `exec:{wsId}:node:{nodeExecId}:output` | 노드 실행 출력 캐시 | 실행 타임아웃 × 2 |
| `exec:{wsId}:worker:{workerId}:heartbeat` | Worker 헬스체크 | 15초 |
| `exec:{wsId}:lock:{execId}` | 실행 동시 접근 잠금 | 30초 (자동 갱신) |
| `core:{wsId}:rate:{userId}` | API Rate Limit 카운터 | 60초 |
| `ws:{wsId}:session:{connId}` | WebSocket 세션 정보 | 세션 유지 시간 |
| `exec:{wsId}:queue:priority` | 우선순위 큐 (Sorted Set) | 영구 (큐 소비 시 삭제) |
| `execution:continuation` (Pub/Sub) | 분산 인스턴스 사용자 입력 fan-out 채널 — 워크스페이스 단위가 아닌 **전역**. cross-cutting 라우팅 성격으로 §9.1 패턴의 예외 (§7.4 참조) | 채널 (TTL 없음) |
| `exec:recover:lock` | 부팅 시 stuck recovery 분산 lock — 워크스페이스 단위가 아닌 **전역**. 단일 인스턴스만 recovery UPDATE 를 수행하도록 보장 (§7.4 참조) | 60초 |

> 두 전역 키 (`execution:continuation`, `exec:recover:lock`) 는 §9.1 의 `{service}:{workspaceId}:{resource}` 패턴을 따르지 않는다. 각각 인스턴스 간 메시징 / 부팅 단일 진입 가드라는 **워크스페이스에 종속되지 않는** 책임을 가지므로 전역 키로 둔다.

---

## 10. Integration Handler 계약

Integration 노드(HTTP, Database, Send Email, 등)를 처리하는 핸들러는 공통 베이스(`IntegrationHandlerBase`)를 통해 credential을 해소하고 호출 이력을 기록한다. 노드별 세부 동작은 [Spec Integration 공통 §4](../4-nodes/4-integration/0-common.md#4-handler-실행-세멘틱) 참조.

### 10.1 IntegrationsService API (실행 엔진용)

```ts
class IntegrationsService {
  /**
   * 실행 엔진 전용 내부 조회. credentials는 AES-256-GCM transformer가
   * 복호화한 평문으로 반환된다 — 결과는 시크릿으로 취급할 것.
   */
  getForExecution(id: UUID, workspaceId: UUID): Promise<Integration>;

  /**
   * 노드 실행 완료 시 호출. 성공·실패 여부와 durationMs를 기록하고
   * integration.last_used_at / last_error 를 갱신한다.
   */
  logUsage(params: {
    integrationId: UUID;
    nodeExecutionId: UUID;
    workflowId: UUID;
    status: 'success' | 'failed';
    durationMs: number;
    error?: { code?: string; message?: string } | null;
  }): Promise<void>;
}
```

`logUsage`는 best-effort — 내부 예외를 swallow하므로 실행 흐름을 중단시키지 않는다.

### 10.2 IntegrationHandlerBase 계약

모든 Integration 핸들러는 다음 베이스를 상속 또는 동등한 로직을 수행한다:

```ts
class IntegrationHandlerBase {
  constructor(protected readonly integrationsService?: IntegrationsService) {}

  protected resolveIntegration(
    integrationId: UUID,
    context: ExecutionContext,
    expectedServiceType: string,
  ): Promise<Integration>;  // workspaceId / service_type / status 모두 검증

  protected logUsage(
    context: ExecutionContext,
    params: IntegrationUsageParams,
  ): Promise<void>;
}
```

`resolveIntegration` 실패 시 `IntegrationError(code, message)`를 throw하며 `code`는 [Spec Integration 공통 §4.2](../4-nodes/4-integration/0-common.md#42-공통-에러-코드) 공통 vocabulary를 사용한다.

### 10.3 호출 순서

```
engine.runNode
  ├─ nodeExecution = createNodeExecution(execId, nodeId, RUNNING)
  ├─ context.nodeExecutionId = nodeExecution.id    # ← 엔진이 주입
  ├─ resolvedConfig = expressionResolver.resolve(config, ctx)
  ├─ handler.execute(input, resolvedConfig, context)
  │    ├─ integration = resolveIntegration(...)
  │    ├─ <외부 SDK 호출>
  │    └─ logUsage({ status, durationMs, error? })
  └─ nodeExecution.status = COMPLETED | FAILED
```

- `context.nodeExecutionId`는 각 노드 호출 직전 새로 배정되므로 순차 실행 모델에서 안전하다.
- `integrationsService`가 주입되지 않은 레거시/테스트 경로에서는 핸들러가 `status: 'requires_integration'` stub을 반환(엔진 단위 테스트 호환성).

### 10.4 Fallback / Degraded 모드

- `context.variables.__workspaceId`가 누락되면 핸들러는 `Missing workspace context` 오류를 throw하여 즉시 실패 처리.
- `integrationsService` 미주입 환경(예: 단순 샌드박스 실행)에서는 Integration 조회·Usage 로깅이 모두 skip된다 — 프로덕션 경로에서는 반드시 주입돼야 한다.
