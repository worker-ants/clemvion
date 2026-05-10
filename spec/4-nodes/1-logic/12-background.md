# Spec: Background

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md) · [CONVENTIONS](../../../user_memo/node-specs-improvement/CONVENTIONS.md)

`background` 출력 포트로 연결된 서브그래프를 BullMQ 큐로 떼어내 비동기 실행하고, 메인 흐름은 `main` 포트로 즉시 통과시키는 **fire-and-forget 특수 컨테이너 노드**. 본문 결과·실패는 메인 흐름에 영향을 주지 않는다 (격리).

다른 컨테이너(Loop / ForEach / Map / Parallel)와 달리 `containerId` 멤버십 패턴을 사용하지 않는다 — `background` 출력 포트의 엣지로 연결된 노드를 본문 진입점으로 보고, 거기서 forward-reachable 한 노드 집합을 본문 서브그래프로 간주한다 ([0-common §3 비고](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach)).

핸들러 자체는 단순한 pass-through 다 — 본문 enqueue 는 `ExecutionEngineService.scheduleBackgroundBody()` 가 핸들러 종료 직후 별도로 수행하며 핸들러는 큐에 대한 지식이 없다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| notes | String | | `""` | 본문 작업의 목적·주의사항 메모. 동작에 영향 없음 (협업용 textarea) |
| notifyOnFailure | Boolean | | `false` | 본문 실패 시 워크스페이스 Admin 에게 인앱 알림 (`type: background_failure`) |
| maxDurationMs | Integer | | `300000` | 본문 최대 실행 시간 (ms). `0` = 무제한. 기본 5분. `Promise.race` 로 타임아웃 적용 |

표현식(`{{ }}`)은 사용하지 않는다 — 모든 필드는 워크플로우 정의 시점의 리터럴이다.

> Source of truth: `backend/src/nodes/logic/background/background.schema.ts` (export `backgroundNodeConfigSchema`)

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
  "port": "main"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.notes` | string | config echo (Principle 7) | 메모. handler 가 `rawConfig.notes` 명시적 echo (passthrough spread 방지) |
| `config.notifyOnFailure` | boolean | config echo | 본문 실패 시 알림 여부 (default `false`) |
| `config.maxDurationMs` | number | config echo | 본문 최대 실행 시간 ms (default `300000`, `0` = 무제한) |
| `output` | (input 전체) | runtime — pass-through | input 데이터 그대로 (변형 없음). [0-common §10](./0-common.md#10-pass-through-노드-규약) |
| `port` | `'main'` | handler return | 항상 `main` (handler 는 `background` 포트를 활성화하지 않음) |

> ⚠ **미구현 (P0)**: 현재 `background.handler.ts` 는 `meta` 필드를 반환하지 않는다. [개선안 logic/background.md §3](../../../user_memo/node-specs-improvement/logic/background.md#3-제안된-output-구조) 은 다음 4개 필드 추가를 제안한다 — 코드 반영 시까지 다운스트림에서 사용할 수 없다:
>
> | 제안 필드 | 타입 | 의미 |
> |-----------|------|------|
> | `meta.durationMs` | number | 핸들러 자체 enqueue 처리 시간 (엔진이 모든 노드에 공통 주입). 백그라운드 본문 실행 시간 아님 |
> | `meta.backgroundRunId` | string | 워크플로우 실행 내에서 백그라운드 서브그래프 run 을 식별. 모니터링 API 의 키 |
> | `meta.forkedAt` | ISO8601 | enqueue 시각 |
> | `meta.jobId` | string | BullMQ job ID. 큐 대시보드에서 추적 |

**Expression 접근 예**:
- `$node["X"].output.event` → `"user_signup"` (pass-through)
- `$node["X"].port` → `"main"`
- `$node["X"].config.maxDurationMs` → `300000`
- `$node["X"].meta.backgroundRunId` → P0 미구현 (예정 시 본문 모니터링 API 키)

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
- 본문 실행 상태를 메인 후속 노드에서 관측하려면 P0 제안의 `meta.backgroundRunId` 를 키로 모니터링 API 를 별도 호출해야 한다 (미구현).

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
