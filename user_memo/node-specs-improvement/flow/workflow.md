# `workflow` (Sub-Workflow) — Output 일관성 개선 제안

- **노드 타입**: `workflow`
- **카테고리**: `flow`
- **현재 스펙 문서**: [`user_memo/node-specs/flow/workflow.md`](../../node-specs/flow/workflow.md)
- **공통 규칙**: [`../CONVENTIONS.md`](../CONVENTIONS.md)
- **불일치 매트릭스**: [`../INCONSISTENCY_MATRIX.md`](../INCONSISTENCY_MATRIX.md)

> 다른 워크플로우를 호출하는 노드입니다. `sync` 모드는 부모 실행 컨텍스트 안에서 인라인 실행, `async` 모드는 별도 큐로 비동기 실행을 등록합니다. 두 모드의 `output` 모양이 현재 완전히 달라 워크플로우 작성자가 예측하기 어렵다는 근본 문제가 있습니다.

---

## 1. 현재 Output 구조 요약

### 1.1. `sync` 모드

`executeInline()` 의 반환값(= sub-workflow 최종 노드 결과)이 **그대로 `output` 에 담깁니다.** 별도 래핑이 없습니다.

```json
{
  "config": {
    "workflowId": "wf_uuid_1234",
    "mode": "sync",
    "inputMapping": [],
    "timeout": 300
  },
  "output": {
    "result": "success",
    "data": [1, 2, 3]
  }
}
```

→ `output` 아래에 무엇이 있을지는 **호출된 sub-workflow 에 전적으로 의존**합니다. 같은 `workflow` 노드를 두 번 사용해도 가리키는 ID 가 다르면 `output.*` 경로가 완전히 달라집니다.

### 1.2. `async` 모드

```json
{
  "config": {
    "workflowId": "wf_uuid_1234",
    "mode": "async",
    "inputMapping": [],
    "timeout": 300
  },
  "output": {
    "executionId": "sub-exec-async-1"
  },
  "meta": {
    "status": "started"
  }
}
```

→ `output` 이 고정된 `{ executionId }` 모양이며, `meta.status: 'started'` 로 큐 등록 여부를 표시합니다.

### 1.3. 에러 케이스

- **재귀 깊이 초과** (`depth ≥ 10`): `throw` → 엔진이 노드 실패로 마킹. `error` 포트 없음.
- **sub-workflow 내부 실패** / `Workflow not found` / expression 에러: `executeInline()`/`executeAsync()` 에서 throw 된 그대로 재전파.
- 즉, **현재 핸들러에는 `error` 포트도 `output.error` 도 없습니다.** CONVENTIONS Principle 3.3 이 "`workflow` 는 sub-workflow 실패 시 `error` 포트를 가져야 함" 으로 명시한 상태와 어긋납니다.

### 1.4. 스키마 / 핸들러 키 불일치

`workflow.schema.ts` 는 매핑 항목 필드를 `target` / `source` 로 정의하지만, `workflow.handler.ts` (그리고 `validate()`) 는 `paramName` / `expression` 을 읽습니다. 프론트엔드 저장 키와 핸들러 읽기 키가 어긋나 있어 `subInput = { undefined: undefined }` 가 될 위험이 있습니다. Output 구조 이슈는 아니지만 **사용자가 `config.inputMapping` 을 echo 로 디버깅할 때 혼란**을 유발하므로 함께 해결할 필요가 있습니다.

---

## 2. 식별된 불일치

| # | 문제 | 관련 Principle | 현재 동작 | 기대 동작 |
| --- | --- | --- | --- | --- |
| 1 | sync / async 의 `output` 모양이 완전히 다름 | **P1 (예측 가능성)**, **P0 (5-필드 invariant)** | sync: sub-workflow 결과를 그대로, async: `{ executionId }` | 항상 `output.result` 또는 `output.execution` 중 **고정된 키 구조**를 사용 |
| 2 | sync 모드가 sub-workflow 결과를 wrapper 없이 그대로 노출 | **P1**, **P9 (Container 오버라이트 명문화)** | `output = subResult` | `output.result = subResult` 로 1단 래핑 — `loop.iterations`, `foreach.items` 와 동일한 결 |
| 3 | async 의 `meta.status: 'started'` 위치 | **P0 (5-필드 invariant)**, **P4 (status 값 사전)** | `meta.status` 사용 | `status` 는 **NodeHandlerOutput 최상위 필드**. `meta.status` 는 메트릭이 아님 → 최상위 `status` 로 이동 |
| 4 | 에러 포트 / `output.error` 부재 | **P3 (에러 컨트랙트 통일)** | 모든 에러 throw | runtime 에러(`Workflow not found`, sub 내부 실패, 재귀 초과)는 `port: 'error'` + `output.error` |
| 5 | 실행 메트릭이 output 안에 섞임 | **P2 (meta 는 실행 메트릭)** | `output.executionId` (async 추적용 ID가 `output`) | 추적 ID 는 도메인 데이터이지만, 실행 시작 시각/대상 sub-workflow ID 같은 메트릭은 `meta.*` 로 |
| 6 | `durationMs`, `subWorkflowId` 등 공통 메트릭 부재 | **P2** | `meta` 가 async 에만 존재, sync 에는 `meta` 없음 | `meta.durationMs`, `meta.subWorkflowId`, `meta.recursionDepth` 를 **두 모드 모두** 에 포함 |
| 7 | 스키마 / 핸들러 매핑 키 불일치 (`target`/`source` vs `paramName`/`expression`) | **P7 (Config echo)** | config echo 결과에 저장된 원본 키가 핸들러 의도와 다름 | 스키마와 핸들러를 한 쪽(`paramName`/`expression` 권장)으로 통일 |

---

## 3. 제안된 Output 구조

### 3.1. Core 변경 요약

1. **항상 1단 래핑**: sync 는 `output.result`, async 는 `output.execution` — 두 모드 모두 `output` 바로 아래의 도메인 키 1개만 있는 구조로 통일.
2. **`status` 최상위 이동**: `meta.status` → `status` 로 이동. 값은 sync 는 `'ended'`, async 는 `'started'`.
3. **`error` 포트 신설**: runtime 에러는 `port: 'error'` + `output.error: { code, message, details? }` 형태로 내보내고, pre-flight(`workflowId` 누락 등)만 throw.
4. **공통 `meta` 필드**: `meta.durationMs`, `meta.subWorkflowId`, `meta.recursionDepth` 를 두 모드 공통으로 제공. async 는 `meta.startedAt` 추가.
5. **스키마/핸들러 키 통일**: 본 문서 범위는 output 이지만, config echo 가 신뢰성 있으려면 `paramName` / `expression` 으로 스키마를 맞추는 것을 권장 (별도 변경셋).

### 3.2. Before / After — `sync` 모드 성공

**Before**

```json
{
  "config": { "workflowId": "wf_uuid_1234", "mode": "sync" },
  "output": { "result": "success", "data": [1, 2, 3] }
}
```

**After**

```json
{
  "config": {
    "workflowId": "wf_uuid_1234",
    "mode": "sync",
    "inputMapping": [],
    "timeout": 300
  },
  "output": {
    "result": { "result": "success", "data": [1, 2, 3] }
  },
  "meta": {
    "durationMs": 428,
    "subWorkflowId": "wf_uuid_1234",
    "recursionDepth": 1
  },
  "status": "ended"
}
```

### 3.3. Before / After — `async` 모드 성공

**Before**

```json
{
  "config": { "workflowId": "wf_uuid_1234", "mode": "async" },
  "output": { "executionId": "sub-exec-async-1" },
  "meta": { "status": "started" }
}
```

**After**

```json
{
  "config": {
    "workflowId": "wf_uuid_1234",
    "mode": "async",
    "inputMapping": [],
    "timeout": 300
  },
  "output": {
    "execution": {
      "id": "sub-exec-async-1",
      "startedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "meta": {
    "durationMs": 12,
    "subWorkflowId": "wf_uuid_1234",
    "recursionDepth": 1,
    "startedAt": "2026-04-19T12:34:56.000Z"
  },
  "status": "started"
}
```

### 3.4. Before / After — 에러

**Before** (현재는 항상 throw → 엔진 레벨 실패)

```
(throw) Error: Workflow not found: wf_uuid_9999
```

**After**

```json
{
  "config": { "workflowId": "wf_uuid_9999", "mode": "sync" },
  "output": {
    "error": {
      "code": "SUB_WORKFLOW_NOT_FOUND",
      "message": "Workflow not found: wf_uuid_9999",
      "details": { "workflowId": "wf_uuid_9999" }
    }
  },
  "meta": {
    "durationMs": 8,
    "subWorkflowId": "wf_uuid_9999",
    "recursionDepth": 1
  },
  "port": "error"
}
```

에러 코드 사전 (제안):

| code | 의미 |
| --- | --- |
| `SUB_WORKFLOW_NOT_FOUND` | `workflowId` 로 조회 실패 |
| `SUB_WORKFLOW_FAILED` | sub-workflow 내부 노드 실행 중 실패 |
| `SUB_WORKFLOW_TIMEOUT` | sync 모드에서 `timeout` 초과 |
| `MAX_RECURSION_DEPTH_EXCEEDED` | `recursionDepth >= 10` |
| `SUB_WORKFLOW_QUEUE_FAILED` | async 모드 큐 등록 실패 |

> Pre-flight 성격의 설정 오류(`workflowId` 누락, `mode` 잘못된 값, `timeout < 0`, `inputMapping` 배열 아님)는 P3.1 에 따라 **계속 throw** 합니다. 위 에러들은 runtime 에러이므로 port/error 로 흘립니다.

### 3.5. 필드 사전

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `output.result` | any (sync 성공 시) | `executeInline()` 반환값. sub-workflow 최종 노드의 결과 그대로. |
| `output.execution.id` | string (async 성공 시) | 비동기 실행 추적 ID. |
| `output.execution.startedAt` | ISO8601 (async 성공 시) | 큐 등록 완료 시각. |
| `output.error.code` | string (에러 시) | 위 사전 참조. `UPPER_SNAKE_CASE`. |
| `output.error.message` | string (에러 시) | 원문 메시지 (로그/디버깅용). |
| `output.error.details` | object? (에러 시) | `workflowId`, stack, sub 노드 경로 등 노드별 세부정보. |
| `meta.durationMs` | number | sync 는 inline 실행 소요, async 는 큐 등록 소요. |
| `meta.subWorkflowId` | string | 호출된 sub-workflow ID (`config.workflowId` 와 동일하지만 메트릭 관점에서 중복 제공). |
| `meta.recursionDepth` | number | 이 실행이 몇 번째 중첩인지 (0 = 최상위, 1 = 최상위의 자식). |
| `meta.startedAt` | ISO8601 (async) | async 큐 등록 시각. |
| `status` | `'ended' \| 'started' \| undefined` | sync 완료는 `'ended'`, async 큐 등록은 `'started'`. 에러 케이스는 `undefined`. |
| `port` | `'out' \| 'error'` | 에러 시 `'error'`, 성공 시 생략(= 기본 `'out'`). |

---

## 4. 마이그레이션 영향도

### 4.1. Expression 경로 비교

| 용도 | Before | After | Breaking? |
| --- | --- | --- | --- |
| sync 반환값 전체 | `$node["X"].output` | `$node["X"].output.result` | **YES** |
| sync 반환값의 특정 필드 | `$node["X"].output.data` | `$node["X"].output.result.data` | **YES** |
| async 실행 ID | `$node["X"].output.executionId` | `$node["X"].output.execution.id` | **YES** |
| async 시작 시각 (신규) | — | `$node["X"].output.execution.startedAt` | N/A (신설) |
| async 상태 | `$node["X"].meta.status` | `$node["X"].status` | **YES** |
| 실행 소요 시간 (신규) | — | `$node["X"].meta.durationMs` | N/A (신설) |
| 에러 발생 여부 분기 | (throw → 에러 포트 없음) | `port === 'error'` + `$node["X"].output.error.code` | **YES** (신설) |
| config echo | `$node["X"].config.workflowId` | 동일 | NO |

### 4.2. 영향 범위 추정

- **Sync 모드 사용자는 전부 영향**. 기존 `$node["X"].output.*` 접근은 전부 `$node["X"].output.result.*` 로 교체해야 합니다. 가장 큰 breaking 포인트.
- **Async 모드 사용자**: `executionId` 경로 변경 + `meta.status` → `status` 이동. 보통 async 모드는 결과를 즉시 안 쓰므로 영향이 상대적으로 적음.
- **에러 핸들링**: 지금은 throw 되던 것이 `port:'error'` 로 흐르게 되면서, 기존에 try/catch 로 실행 실패를 감지하던 상위 실행 로직은 **노드가 성공적으로 완료한 것으로 보게 됨**. → 워크플로우 빌더에서 `error` 포트를 명시적으로 연결하지 않으면 에러가 **silent 하게 무시**될 수 있으므로, 마이그레이션 시 "error 포트 미연결 경고" UI 필요.

### 4.3. 마이그레이션 전략

1. **1단계 (호환 기간, 선택적)**: 핸들러가 sync 결과를 `output.result` 에 담고 **동시에 `output` 루트에도 스프레드**(`...subResult`) 로 유지. 사용자 기존 workflow 가 깨지지 않도록 하되 문서/린트 경고로 `output.result.*` 사용을 권장.
2. **2단계**: 릴리스 노트에 deprecate 공지, 기존 workflow 정의를 스캔해 `$node["X"].output.*` → `$node["X"].output.result.*` 자동 치환 마이그레이션 도구 제공.
3. **3단계**: 루트 스프레드 제거. `output.result` 만 남김.

> 대안: 2단계 호환 기간 없이 major 버전 업에서 일괄 전환. sub-workflow 사용이 많은 조직은 breaking 이 크므로 현실적으로는 1-2단계 호환 기간을 두는 편이 안전합니다.

### 4.4. 에러 포트 신설의 추가 비용

현재 노드 정의에 `outputs: [{ id: 'out' }]` 만 있습니다. `error` 포트를 추가하면:

- UI 상 모든 기존 `workflow` 노드에 새 포트 점이 생김 (연결 없이 비어 있음).
- 기본적으로 `error` 포트 미연결 = 에러 silent drop. 이를 막기 위해 엔진 레벨에서 "`error` 포트가 있고 미연결이면 실행 실패로 처리" fallback 을 넣거나, 검증 시 warning 을 띄워야 합니다.

---

## 5. 근거

### 5.1. 왜 sync 결과를 `output.result` 로 래핑해야 하는가

CONVENTIONS **Principle 1** 은 "output 은 비즈니스 데이터만" 을 명시하며, **Principle 9** 는 container 노드의 최종 output 모양을 고정된 스키마(`{ iterations, count }`, `{ items, count }`, `{ branches, count }`) 로 통일합니다. `workflow` 는 container 카테고리(`isContainer: true`) 이면서도 현재 유일하게 **스키마 없이 raw 결과를 루트에 노출**합니다.

Principle 9 의 기조를 `workflow` 에 적용하면 최소한 `output.result` 로 한 겹 래핑하는 것이 자연스럽습니다. 이는 `code` 노드가 이미 사용 중인 `output.result` 네이밍과도 일치(Principle 8.2 의 "코드 실행 결과 = `output.result`")하며, 사용자가 "sub-workflow = 한 덩어리 실행 단위의 결과" 라는 멘털 모델을 갖게 합니다.

### 5.2. 왜 sync / async 의 `output` 1차 키를 분리해야 하는가

"항상 `output.result`" 로 통일하려면 async 모드의 `executionId` 도 `output.result.executionId` 로 들어가야 하는데, 이는 "sync 의 result 와 async 의 result 는 의미가 다르다" 는 애매함을 만듭니다. 대신 **의미가 다른 두 종류의 출력임을 키 이름으로 구분**(`result` vs `execution`) 하는 것이 Principle 1(예측 가능성) 과 더 부합합니다. 즉:

- `output.result` 가 있으면 → sync 완료, 이 값이 sub-workflow 결과.
- `output.execution` 이 있으면 → async 큐 등록 완료, 결과는 별도 조회 필요.
- `output.error` 가 있으면 → 실패.

세 가지 1차 키가 상호 배타적으로 존재하므로 `output` 의 첫 depth 만 보고도 상태 분기가 가능합니다.

### 5.3. 왜 `status` 를 최상위로 올려야 하는가

CONVENTIONS **Principle 0** 은 `{ config, output, meta, port, status }` 의 5-필드 invariant 를 정의합니다. 현재 async 가 쓰는 `meta.status: 'started'` 는 P0 위배입니다. 그리고 **Principle 4 (status 값 사전)** 은 허용 값을 `waiting_for_input`, `resumed`, `ended`, `requires_integration`, `undefined` 로 규정하지만, 축 9 에 `'started'` 는 없습니다. 본 제안은 async 시작을 **`started`** 로 **축 9 에 새로 추가**합니다 — sub-workflow async 는 "블로킹 대기" 가 아니라 "시작시켜 놓고 즉시 반환" 이라는 고유한 의미이므로 `resumed`/`ended` 어디에도 맞지 않기 때문입니다.

> 대안: async 성공 시 `status` 를 `undefined` 로 두고 `meta.mode === 'async'` 만으로 표현하는 방법. 하지만 엔진/UI 가 "이 노드는 실행을 시작만 했다" 라는 상태를 한 필드로 볼 수 있는 가치가 크다고 판단해 `started` 를 도입했습니다.

### 5.4. 왜 `error` 포트를 신설해야 하는가

CONVENTIONS **Principle 3.3** 은 `workflow` 를 "반드시 `error` 포트를 가져야 할 노드" 로 명시합니다. 현재 핸들러는 모든 에러를 throw 하여 엔진 레벨 실행 실패로 만드는데, 이는 sub-workflow 체인의 중간 실패를 **상위 워크플로우가 복구할 수 없게** 만듭니다. 예컨대 "sub-workflow 가 실패하면 fallback sub-workflow 를 호출" 같은 패턴이 불가능합니다.

`error` 포트 + `output.error` 컨트랙트를 도입하면:

- 재귀 깊이 초과 시에도 상위에서 포착 가능.
- sub-workflow 내부 에러가 구조화된 `code` + `message` 로 올라와 로그/대시보드 집계 가능.
- `http_request`, `database_query`, `send_email`, `code` 와 동일한 에러 컨트랙트 → 인지 부담 감소.

### 5.5. 왜 공통 `meta` 필드가 필요한가

현재 sync 는 `meta` 자체가 없고 async 만 `{ status }` 를 가집니다. 실행 성능 대시보드나 디버거 관점에서 sub-workflow 호출은 **지연의 가장 큰 후보** 이므로, `meta.durationMs` 는 필수적입니다. `meta.subWorkflowId`, `meta.recursionDepth` 는 타임라인 UI 에서 중첩 실행을 시각화할 때 이미 엔진 내부 정보로 존재하는 값이므로 echo 비용이 거의 없습니다.

### 5.6. Breaking 비용 평가

이 제안의 **가장 비싼 변경**은 `output = subResult` → `output.result = subResult` 입니다. sync 모드를 사용하는 모든 기존 워크플로우가 영향을 받습니다. 그럼에도 이 변경을 추천하는 이유:

1. **현재 구조가 P1/P9 를 동시에 위배**. 호환 유지 시 `workflow` 는 영구적으로 "예외 노드" 가 되어 다른 개선 노력이 무의미해집니다.
2. **대안(sync 결과를 루트에 스프레드)은 네임 충돌 위험**. sub-workflow 가 `error`/`result`/`execution` 같은 키를 반환하면 이 제안의 분기 로직이 깨집니다.
3. **마이그레이션 자동화 가능**. expression 파서가 `$node["X"].output.<path>` 를 인식하므로, `workflow` 노드를 가리키는 expression 만 `output.result.<path>` 로 치환하는 도구를 제공할 수 있습니다.

반면 async 쪽 변경(`output.executionId` → `output.execution.id`, `meta.status` → `status`) 은 async 사용 패턴이 적고, 주로 `executionId` 하나만 꺼내 쓰므로 실제 영향은 제한적입니다.

### 5.7. 스키마/핸들러 키 불일치 처리

본 제안의 output 구조 변경과 독립적으로, `inputMapping` 의 `target`/`source` vs `paramName`/`expression` 불일치는 **같은 릴리스에 함께 해결**할 것을 권장합니다. 이유:

- `config.inputMapping` 이 echo 되므로 output 문서화의 신뢰성에 직접 영향.
- 사용자가 "매핑이 전달 안 됨" 을 디버깅할 때 `$node["X"].config.inputMapping` 을 보게 되는데, 여기 echo 된 키가 핸들러가 읽는 키와 다르면 혼란이 가중됨.
- 권장 방향: **핸들러 그대로(`paramName`/`expression`) 유지 + 스키마/프론트엔드 저장 포맷을 맞추는 쪽**이 변경 면적이 작음. 혹은 핸들러에 양쪽 키를 모두 허용(`paramName ?? target`, `expression ?? source`) 하는 방어 코드 추가.

---

## 요약

- **sync**: `output.result` 로 1단 래핑, `status: 'ended'`, `meta.durationMs`/`subWorkflowId`/`recursionDepth` 포함.
- **async**: `output.execution: { id, startedAt }`, `status: 'started'` 최상위로, `meta` 는 동일 공통 필드 + `startedAt`.
- **에러**: `port: 'error'` + `output.error: { code, message, details? }` 도입. pre-flight 는 throw 유지.
- **breaking 비용이 크지만**, `workflow` 가 Container 원칙(P1/P9)의 예외로 영구 존속하는 것보다 한 번에 정리하는 편이 장기적으로 싸다.
