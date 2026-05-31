---
id: background
status: implemented
code:
  - codebase/backend/src/nodes/logic/background/background.*.ts
  - codebase/backend/src/modules/executions/background-runs/*.ts
  - codebase/backend/src/modules/execution-engine/**
---

# Spec: Background

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md) · [CONVENTIONS](../../conventions/node-output.md)

`background` 출력 포트로 연결된 서브그래프를 BullMQ 큐로 떼어내 비동기 실행하고, 메인 흐름은 `main` 포트로 즉시 통과시키는 **fire-and-forget 특수 컨테이너 노드**. 본문 결과·실패는 메인 흐름에 영향을 주지 않는다 (격리).

다른 컨테이너(Loop / ForEach / Map / Parallel)와 달리 `containerId` 멤버십 패턴을 사용하지 않는다 — `background` 출력 포트의 엣지로 연결된 노드를 본문 진입점으로 보고, 거기서 forward-reachable 한 노드 집합을 본문 서브그래프로 간주한다 ([0-common §3 비고](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach)).

핸들러 자체는 단순한 pass-through 다 — 본문 enqueue 는 `ExecutionEngineService.scheduleBackgroundBody()` 가 핸들러 종료 직후 별도로 수행하며 핸들러는 큐에 대한 지식이 없다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| notes | String | | `""` | 본문 작업의 목적·주의사항 메모. 동작에 영향 없음 (협업용 textarea) |
| notifyOnFailure | Boolean | | `false` | 본문 실패 시 워크스페이스 Admin 에게 인앱 알림 (`type: background_failed` — 데이터모델 §Notification.type 의 enum 값) |
| maxDurationMs | Integer | | `300000` | 본문 최대 실행 시간 (ms). `0` = 무제한. 기본 5분. `Promise.race` 로 타임아웃 적용 |

표현식(`{{ }}`)은 사용하지 않는다 — 모든 필드는 워크플로우 정의 시점의 리터럴이다.

> Source of truth: `codebase/backend/src/nodes/logic/background/background.schema.ts` (export `backgroundNodeConfigSchema`)

## 2. 설정 UI

```
┌──────────────────────────────────────────┐
│  Notes                                   │
│  ┌────────────────────────────────────┐  │
│  │ Fan out analytics event after      │  │
│  │ user signup                        │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [✓] Notify on failure                   │
│                                          │
│  Max duration (ms)                       │
│  ┌────────────────────────────────────┐  │
│  │ 300000                             │  │
│  └────────────────────────────────────┘  │
│  0 = 무제한                              │
└──────────────────────────────────────────┘
```

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 메인 흐름 데이터 (1개 필수). 본문 enqueue 시 스냅샷됨 |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `main` | Main | data | false | input pass-through. 핸들러 즉시 활성화 |
| `background` | Background | data | false | 본문 진입점. **핸들러가 활성화하지 않음** — `ExecutionEngineService` 가 enqueue 후 별도 ExecutionContext 에서 활성화 |

> ⚠ `background` 포트는 `main` 과 비대칭이다. handler 는 `port: 'main'` 만 반환하며 메인 흐름에 `background` 결과가 절대 합류하지 않는다 (fire-and-forget).
>
> 캔버스에서는 다른 컨테이너처럼 컨테이너 박스로 렌더링되지 않고, **일반 다중 출력 포트 노드** 형태로 표시된다.

## 4. 실행 로직

1. 핸들러는 `input` 을 변형 없이 `output` 에 복사하고 `port: 'main'` 으로 반환한다 ([0-common §10 Pass-through](./0-common.md#10-pass-through-노드-규약)).
2. 핸들러 종료 직후 `ExecutionEngineService.scheduleBackgroundBody()` 가 BullMQ `background-execution` 큐에 다음을 enqueue 한다:
   - `background` 포트 엣지의 target 노드 ID 배열 (본문 진입점)
   - `context.variables`, `context.nodeOutputCache`, `context.expressionContext` 의 **얕은 복사 스냅샷**
   - 메인 입력 (`input` 의 스냅샷)
   - `notifyOnFailure`, `maxDurationMs`
3. `BackgroundExecutionProcessor` 워커가 job 을 pop 하면 `executeBackgroundSubgraph(job)` 이 다음을 수행한다:
   - 새 `ExecutionContext` 를 생성하고 스냅샷으로 채움
   - `executeInline(workflowId, input, { entryNodeIds, ... })` 으로 진입점에서 forward-reachable 한 노드만 실행
   - `maxDurationMs > 0` 이면 `Promise.race` 로 타임아웃 적용
4. 본문 노드의 `NodeExecution` 레코드는 정상 생성되며 `parentNodeExecutionId` 가 Background 노드 자체의 NodeExecution ID 로 stamp 된다 → 타임라인에서 Background 그룹 아래로 묶여 표시.
5. 본문 실패는 메인 Execution status 에 영향 없음. `notifyOnFailure: true` 면 Admin 인앱 알림 발송.
6. 서버 재시작 시 큐에 잔류한 작업은 BullMQ 기본 정책으로 retry — 컨텍스트가 사라진 상황에서 본문이 실패할 수 있으므로 본문 측 멱등성을 권장.

**격리 컨트랙트**:

- **Variables/cache 분리**: enqueue 후 메인이 `context.variables` 를 바꿔도 본문에는 반영되지 않으며 (스냅샷 참조), 본문에서의 변수 변화도 메인으로 돌아오지 않는다.
- **Context Map 키 격리**: 본문은 메인과 같은 `executionId` 를 NodeExecution 그룹핑·WS 채널용으로 공유하되, in-memory `ExecutionContext` 는 **별도 키 `bg:<executionId>:<backgroundRunId>`** 로 Map 에 등록돼 메인 컨텍스트와 격리된다. `executeBackgroundSubgraph` 가 **자체 finally 로 해당 bgKey context 를 삭제**하며, 이는 메인 `runExecution` finally 의 `deleteContext(executionId)` 와 독립적이다 (분류 SoT [execution-context 규약 원칙 4](../../conventions/execution-context.md#원칙-4--engine-internal-infrastructure-fields-_-prefix)).
- **에러 격리**: 본문 실패 → 메인 status 무영향.
- **결과 비반환**: 본문 마지막 노드의 출력은 메인 흐름의 어떤 노드에서도 참조 불가. 결과를 기다려야 하면 `parallel` 을 사용한다.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Background 는 **분기 노드**처럼 두 개의 출력 포트를 갖지만, 핸들러는 `main` 만 반환한다 (§5.1). `background` 포트는 엔진이 **별도 ExecutionContext 에서 활성화** 하므로 메인 흐름의 `$node["X"]` 로 본문 진입점 결과를 관측할 수 없다 (§5.2 — 본문 컨텍스트 한정 관점).

### 5.1 Case: 메인 통과 (port `main`, pass-through)

핸들러가 항상 반환하는 케이스. 메인 흐름 다음 노드로 input 그대로 전달.

```json
{
  "config": {
    "notes": "Fan out analytics event after user signup",
    "notifyOnFailure": true,
    "maxDurationMs": 300000
  },
  "output": { "event": "user_signup", "userId": "u_1" },
  "meta": {
    "durationMs": 0,
    "backgroundRunId": "8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234",
    "forkedAt": "2026-05-10T05:04:37.123Z"
  },
  "port": "main"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.notes` | string | config echo (Principle 7) | 메모. handler 가 `rawConfig.notes` 명시적 echo (passthrough spread 방지) |
| `config.notifyOnFailure` | boolean | config echo | 본문 실패 시 알림 여부 (default `false`) |
| `config.maxDurationMs` | number | config echo | 본문 최대 실행 시간 ms (default `300000`, `0` = 무제한) |
| `output` | (input 전체) | runtime — pass-through | input 데이터 그대로 (변형 없음). [0-common §10](./0-common.md#10-pass-through-노드-규약) |
| `meta.durationMs` | number | runtime — handler 측정 | 핸들러 자체의 즉시 처리 시간 (ms). fire-and-forget 이므로 보통 0~수 ms. 백그라운드 본문 실행 시간 아님 (CONVENTIONS Principle 2) |
| `meta.backgroundRunId` | string (UUID v4) | runtime — handler 생성 | 워크플로우 실행 내에서 백그라운드 서브그래프 run 을 식별. 모니터링 API (§8) 의 조회 키 |
| `meta.forkedAt` | ISO8601 string | runtime — handler 측정 | fork 시점 타임스탬프 (handler entry 시각). enqueue 직후 시점과 거의 동일 |
| `meta.jobId?` | string | (optional) runtime — engine stamp | 실제 BullMQ job ID. 핸들러는 큐 시스템에 무지하므로 발행하지 않으며, `ExecutionEngineService.scheduleBackgroundBody()` 가 큐 add 후 NodeExecution.outputData 로 stamp 하는 향후 확장 지점. 현재 핸들러 출력에는 부재 |
| `port` | `'main'` | handler return | 항상 `main` (handler 는 `background` 포트를 활성화하지 않음) |

**Expression 접근 예**:
- `$node["X"].output.event` → `"user_signup"` (pass-through)
- `$node["X"].port` → `"main"`
- `$node["X"].config.maxDurationMs` → `300000`
- `$node["X"].meta.backgroundRunId` → `"8f3c6b1a-..."` (모니터링 API 키)
- `$node["X"].meta.forkedAt` → `"2026-05-10T05:04:37.123Z"`
- `$node["X"].meta.durationMs` → `0` (handler-side fire-and-forget 처리 시간)

### 5.2 Case: 본문 진입 (port `background`, fire-and-forget)

핸들러가 활성화하지 않는다. 엔진이 별도 ExecutionContext 에서 `background` 포트의 엣지를 따라 본문 진입점 노드(들) 을 활성화한다. **이 흐름은 메인 워크플로우의 `$node["X"]` 관측 대상이 아니다** — 메인 흐름에서 `port: 'background'` 가 나타나는 NodeHandlerOutput 은 존재하지 않는다.

본문 컨텍스트에서 진입점 노드의 입력은 다음과 같다:

```json
{
  "input": { "event": "user_signup", "userId": "u_1" }
}
```

| 항목 | 출처 | 설명 |
|------|------|------|
| 입력 데이터 | enqueue 시점 스냅샷 | Background 노드의 `input` 그대로 |
| `context.variables` | enqueue 시점 스냅샷 (얕은 복사) | 메인의 후속 변경은 반영 안 됨 |
| `context.nodeOutputCache` | enqueue 시점 스냅샷 | 본문에서는 enqueue 시점까지의 메인 노드 출력 참조 가능 |
| `context.expressionContext` | enqueue 시점 스냅샷 | 표현식 평가용 |
| `parentNodeExecutionId` | Background 노드의 NodeExecution ID | 본문 노드 NodeExecution 에 stamp |

**메인 흐름에서 본문 결과 접근 불가**:

- `$node["X"].output` → `main` 케이스의 input pass-through. 본문 마지막 노드의 결과 아님.
- `$node["<본문 노드>"].output` → 메인 흐름 expression 평가 시 **참조 불가** (별도 ExecutionContext).
- 본문 실행 상태를 메인 후속 노드에서 관측하려면 `meta.backgroundRunId` (§5.1) 을 키로 모니터링 API (§8) 를 별도 호출한다.

**기다려야 하는 분기는 `parallel` 사용**: Background 는 fire-and-forget 전용이며, 결과를 메인 흐름에 합류시켜야 하면 [Parallel 노드](./10-parallel.md) 의 `branches` 분기를 사용한다.

## 6. 에러 코드

Background 핸들러는 **runtime 에러 포트를 갖지 않는다**. config 검증은 schema 가 모두 흡수하며 (모든 필드 zod default 보유), pre-flight throw 외 에러 케이스가 없다 (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `notes` 가 string 아님 | `notes must be a string` | handler.validate (`evaluateMetadataBlockingErrors`) |
| `notifyOnFailure` 가 boolean 아님 | `notifyOnFailure must be a boolean` | handler.validate |
| `maxDurationMs` 가 음수 | `maxDurationMs must be >= 0` | handler.validate |
| `maxDurationMs` 가 정수 아님 | `maxDurationMs must be an integer` | handler.validate |

**본문 서브그래프 실패는 메인의 에러 코드가 되지 않는다**. 본문 노드의 NodeExecution 레코드 (`parentNodeExecutionId` stamp) 와 `notifyOnFailure: true` 의 Admin 인앱 알림에서만 가시화된다.

| 본문 측 실패 유형 | 처리 |
|-------------------|------|
| 본문 노드 throw | 해당 NodeExecution 실패. `notifyOnFailure: true` 면 Admin 알림 |
| `maxDurationMs` 초과 | `Promise.race` 타임아웃 → 본문 실행 강제 종료. `notifyOnFailure: true` 면 알림 |
| 서버 재시작 | BullMQ 기본 retry 정책 적용. 컨텍스트 휘발 시 본문 실패 가능 → 본문 멱등성 권장 |

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `Background` 행 인용 (`notify on fail · 5m` 등).

## 8. 모니터링 API

핸들러가 §5.1 에서 발급한 `meta.backgroundRunId` 를 키로, 메인 흐름의 후속 노드 / Run Results UI 가 본문 서브그래프의 실행 상태를 조회한다. fire-and-forget 격리 컨트랙트(§4) 는 그대로 유지되며 — 본 API 는 **읽기 전용** 으로 본문 결과를 메인 흐름에 합류시키지 않는다.

### 8.1 엔드포인트

```
GET /api/executions/:executionId/background-runs/:backgroundRunId
```

| 파라미터 | 위치 | 타입 | 설명 |
|----------|------|------|------|
| `executionId` | path | UUID | 메인 워크플로우 실행 ID. 권한 검증의 1차 키 (워크스페이스 소유 확인) |
| `backgroundRunId` | path | UUID v4 | `meta.backgroundRunId`. 해당 execution 안에서 Background 노드의 본문 run 식별자 |
| `cursor` | query | string | `nodeExecutions` 페이지네이션 cursor (opaque). 없으면 첫 페이지 |
| `limit` | query | int (1~200) | 페이지 크기 (기본 50). `nodeExecutions` 만 페이지네이션 대상 |

URL 은 중첩 구조 (`executions/:id/background-runs/:id`) 를 사용한다. `backgroundRunId` 가 UUID v4 로 전역 유일하므로 flat URL 도 기술적으로 가능하지만, `executionId` 를 1차 권한 키로 사용해 워크스페이스 검증을 단순화하고 `executionId` 범위 내 조회로 JSONB 풀스캔을 회피한다 ([Rationale](#rationale)).

### 8.2 응답 스키마

```json
{
  "backgroundRunId": "8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234",
  "executionId": "5d8e7f2a-...",
  "parentNodeExecutionId": "a1b2c3d4-...",
  "status": "running",
  "startedAt": "2026-05-15T05:04:37.123Z",
  "completedAt": null,
  "durationMs": null,
  "nodeExecutions": {
    "data": [ /* NodeExecution[] */ ],
    "nextCursor": "eyJpZCI6IjEyMyJ9",
    "hasMore": true
  },
  "notifications": [ /* Notification[] */ ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `backgroundRunId` | string (UUID v4) | echo |
| `executionId` | string (UUID) | 메인 실행 ID echo |
| `parentNodeExecutionId` | string (UUID) | Background 노드 자체의 `NodeExecution.id`. 본문 노드들이 이 ID 를 `parentNodeExecutionId` 로 stamp 받는다 (§4-4) |
| `status` | `'pending' \| 'running' \| 'completed' \| 'failed'` | 본문 서브그래프 집계 상태. `pending` = 본문 노드 아직 미실행, `running` = 일부 본문 노드가 진행 중/대기, `completed` = 모든 본문 노드 completed/skipped, `failed` = 한 개 이상 failed (메인 status 와 무관). 메인 Execution cancel 이 본문 run 으로 전파되는 흐름은 아직 없어 별도 `cancelled` 상태는 발행되지 않는다 |
| `startedAt` | ISO8601 | 본문 enqueue 시점 (§5.1 `meta.forkedAt` 와 동일 기준) |
| `completedAt` | ISO8601 \| null | 본문 종료 시점. `status` 가 `running` / `pending` 이면 null |
| `durationMs` | number \| null | `completedAt - startedAt` (서버 계산). 진행 중이면 null |
| `nodeExecutions.data` | NodeExecution[] | 본문 노드들의 NodeExecution 레코드. `parentNodeExecutionId = <Background 노드의 NodeExecution.id>` 로 필터. shape 은 [실행 상세 조회 §5.1](../../3-workflow-editor/3-execution.md#51-노드별-입출력-데이터) 재사용 |
| `nodeExecutions.nextCursor` | string \| null | 다음 페이지 cursor. `hasMore: false` 면 null |
| `nodeExecutions.hasMore` | boolean | 추가 페이지 존재 여부 |
| `notifications` | Notification[] | 본 backgroundRun 와 연관된 알림. `type: background_failed` (`config.notifyOnFailure: true` 이면 발행; 노드 실패와 `maxDurationMs` 타임아웃 양쪽을 포괄). [실행 엔진 §3.3](../../5-system/4-execution-engine.md#33-background-실행) 참조 |

### 8.3 페이지네이션

`nodeExecutions` 만 cursor 페이지네이션 대상이다. `notifications` 는 backgroundRun 당 통상 0~수 건이므로 전체 반환.

- **정렬 키**: `NodeExecution.startedAt ASC, id ASC` (안정 순서 — NodeExecution 엔티티에 별도 createdAt 컬럼이 없어 `startedAt` 사용)
- **cursor**: opaque base64 — 서버 내부 직렬화. 클라이언트는 해석하지 않으며 응답의 `nextCursor` 를 그대로 다음 요청에 전달한다
- **limit 기본**: 50, 최대 200
- **빈 페이지**: `data: [], nextCursor: null, hasMore: false`

### 8.4 권한

`executionId` 로 식별되는 메인 실행의 워크스페이스 멤버만 조회 가능. 멤버가 아니거나 `executionId` 가 존재하지 않으면 404 — Forbidden 으로 응답하면 attacker 가 ID 존재 여부를 추론할 수 있어 IDOR 차단 목적으로 NotFound 로 통일한다 (`ExecutionsController.findOne` 동일 패턴).

`backgroundRunId` 가 `executionId` 안에 존재하지 않으면 404.

> **Note**: 역할(Role) 기반 추가 제한(Viewer 차단 등) 은 현재 구현하지 않는다 — 기존 `ExecutionsController` 단건 조회도 workspace 멤버이기만 하면 허용하는 패턴이라 일관성을 유지한다. 향후 Role-based 차단이 필요해지면 `RolesGuard` 를 두 endpoint 에 함께 적용한다.

### 8.5 실시간 갱신 — WebSocket 채널

본문 서브그래프 진행을 실시간 수신하려면 별도 WebSocket 채널을 구독한다.

| 채널 | 이벤트 | payload |
|------|--------|---------|
| `background:run:<backgroundRunId>` | `execution.background_run.started` | `{ backgroundRunId, executionId, parentNodeExecutionId, startedAt }` |
| 〃 | `execution.background_run.completed` | `{ backgroundRunId, status: 'completed' \| 'failed' \| 'cancelled', completedAt, durationMs, failedNodeId?, errorMessage? }` |

- 본문 안의 개별 NodeExecution 이벤트(`execution.node.started` 등) 는 **기존 `execution:<id>` 채널에 그대로 발행** 된다. 본문 노드의 `parentNodeExecutionId` 가 Background 노드의 `NodeExecution.id` 와 일치하므로 클라이언트가 그 키로 필터해 본문 카드 안의 타임라인을 갱신한다.
- `background:run:<id>` 채널은 **run 수명주기 이벤트만** 발행한다 — 채널의 책임을 좁혀 메인 채널과의 데이터 중복을 막는다.
- 채널은 기존 `execution:<id>` 와 격리된다 — 메인 흐름 구독자에게 run-level 이벤트가 전파되지 않으며, 반대도 동일 (격리 컨트랙트 §4 의 사용자 가시 표현).
- 권한 검증: 구독 시 §8.4 와 동일 정책. `backgroundRunId` 에서 `executionId` 를 역조회해 워크스페이스 확인.
- 본문 종료 후 채널은 추가 이벤트를 발행하지 않는다 (재구독 시 서버는 마지막 상태 snapshot 을 emit 하지 않음 — REST GET 으로 조회).

### 8.6 AI Assistant 도구 노출

AI Assistant 의 read-only 실행 조회 도구 (`ED-AI-35~38`) 는 본 API 를 통해 background run 도 조회 가능하다. PRD 2 §10.9 "직계 자식 실행 (sub-workflow 1 level)" 정책의 background 적용 — Assistant 가 "왜 background 가 실패했나" 같은 질의에 응답할 수 있도록.

| 도구 (가칭) | 매핑 |
|-------------|------|
| `get_background_run(executionId, backgroundRunId)` | §8.1 GET 단건 조회. cursor 페이지네이션 옵션 |
| `list_background_runs(executionId)` | `Execution` 의 모든 Background 노드 NodeExecution 을 순회해 `meta.backgroundRunId` 목록 반환. ED-AI-35 직계 자식 확장 |

상세 도구 스펙은 [AI Assistant Spec](../../3-workflow-editor/4-ai-assistant.md) 의 read-only 도구 절에서 별도 정의한다 (본 plan 의 spec 갱신 범위 밖).

### 8.7 에러 코드

| HTTP | 코드 | 발생 조건 |
|------|------|-----------|
| 400 | `INVALID_CURSOR` | cursor 디코딩 실패 |
| 400 | `INVALID_LIMIT` | `limit` 1 미만 또는 200 초과 |
| 401 | (인증 미들웨어) | 토큰 없음/만료 |
| 404 | `EXECUTION_NOT_FOUND` | `executionId` 부재 또는 워크스페이스 mismatch (IDOR 차단 — Forbidden 으로 leak 하지 않는다) |
| 404 | `BACKGROUND_RUN_NOT_FOUND` | `backgroundRunId` 가 해당 execution 에 없음 |

본 API 는 외부 부수효과를 일으키지 않으므로 5xx 는 표준 NestJS 핸들러에 위임 (DB 장애 등).

## Rationale

### ExecutionContext Map 키 분리 결정

background 본문은 fire-and-forget 으로 BullMQ 워커에서 비동기 실행되는데, 부모와 동일한 `executionId` 를 in-memory context Map 키로 공유했다. 부모 실행이 (대개 본문보다 먼저) 종료하며 `deleteContext(executionId)` 를 호출하면 본문이 쓰던 context 가 같은 키로 삭제돼 후속 `setNodeOutput` 이 "Execution context not found" 로 실패했다. 해소: 본문은 `bg:<executionId>:<backgroundRunId>` 별도 Map 키를 쓰고 `executeBackgroundSubgraph` 자체 finally 로 정리한다. `executionId` 는 NodeExecution 그룹핑·WS(`execution:<id>`)·권한 1차 키이므로 원본 유지하고 in-memory Map 키만 분리한다 — 기존 격리 컨트랙트(§4 Variables/cache 스냅샷 격리)의 키-레벨 확장이다. 필드 분류·`_contextKey` 결정의 주 SoT 는 [execution-context 규약 §Rationale](../../conventions/execution-context.md#rationale) 다.

### URL 중첩 구조 결정

`GET /api/executions/:executionId/background-runs/:backgroundRunId` 로 중첩한 이유:

- `backgroundRunId` 는 UUID v4 로 전역 유일하므로 `GET /api/background-runs/:backgroundRunId` 같은 flat URL 도 기술적으로 가능
- 그러나 `meta.backgroundRunId` 는 별도 컬럼이 아닌 `NodeExecution.outputData` JSONB 안에 저장됨 — flat URL 로 단독 조회하면 JSONB 풀스캔 위험. `executionId` 범위 내 조회로 검색 범위 한정
- 권한 검증이 단순화됨 — `executionId` 1차 키로 워크스페이스 검증 후 `backgroundRunId` 확인. flat URL 은 backgroundRunId → NodeExecution → executionId → 워크스페이스 체인 필요
- REST 의미상 background run 은 execution 에 종속된 자원

`executionId` 컬럼에 대한 별도 인덱스 + `(executionId, JSONB 'meta.backgroundRunId')` 의 GIN 인덱스로 조회 성능을 보강한다.

### 페이지네이션 선적용 결정

`nodeExecutions` 에 cursor 페이지네이션을 초기부터 포함:

- Background 본문이 수십 노드 이하면 단순 응답으로도 충분하나, 본문이 Loop / ForEach 를 포함하면 수백 NodeExecution 으로 확장 가능
- 추후 `?limit=` query param 만 추가하는 것도 non-breaking 이지만, 클라이언트가 `data: [...]` 의 단순 배열을 가정하면 응답 형태 변경 시 breaking — 처음부터 `{ data, nextCursor, hasMore }` 컨테이너로 고정
- 정렬 키는 `(startedAt ASC, id ASC)` 안정 순서 — 동시에 시작된 노드의 정렬 흔들림 방지

### WebSocket 채널 격리 결정

`background:run:<id>` 채널을 `execution:<id>` 와 별개로 운영:

- 메인 흐름 구독자에게 background 본문의 NodeExecution 이벤트가 전파되면 클라이언트 측 라우팅 / 카운터가 오염 — 격리 컨트랙트(§4) 의 사용자 가시 표현
- 본문 종료 후 채널 자동 close — 메인 실행이 끝나도 background 구독이 살아있는 경우 발생 가능 (메인 후속 노드가 backgroundRunId 만 받고 실시간 관측 시작)
- 사용자가 backgroundRunId 를 알아야 구독 가능 — 메인 실행자만 알 수 있는 키이므로 추가 권한 노출 위험 없음

### AI Assistant 도구 노출 결정

PRD 2 §10.9 "직계 자식 실행 (sub-workflow 1 level)" 정책을 background run 에 적용:

- background 는 fire-and-forget 이지만 사용자 관점에서는 "메인 실행의 비동기 자식" — Assistant 가 "왜 background 가 실패했나" 같은 질의에 응답하려면 본문 NodeExecution 접근 필요
- read-only 도구로만 노출 — Assistant 가 background 재실행 / 취소 같은 부수효과를 일으킬 수 없음
- 깊이 1 제한 — background 본문 안의 sub-workflow 까지는 노출하지 않음 (token / 권한 폭증 차단)
