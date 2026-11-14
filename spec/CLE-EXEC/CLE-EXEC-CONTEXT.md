---
id: "CLE-EXEC-CONTEXT"
title: "실행 컨텍스트"
type: "convention"
version: 9
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC"
ancestors: ["CLE-VISION", "CLE-EXEC"]
area: "CLE-EXEC"
content_hash: "db4ef9a8b8fff7917a492383a56357c52edafcc09564e3929b67ab4534ce9446"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/5-system/4-execution-engine.md", "spec/conventions/execution-context.md"]
mirror_sha256: "b30604f6aa8b8637ee268dca593d0b76315284d30172c1e00687c139168a92f9"
etag: "sha256-37160fe521d6b8fc77c114fcd718a32997025b73601782120c3262c7154fc254"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/execution-context.md` (전체), `spec/5-system/4-execution-engine.md` (§6.1~§6.3, Rationale "실행 컨텍스트 in-memory + DB durable") · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

실행 컨텍스트(`ExecutionContext`)는 엔진이 dispatch 직전에 모든 노드 핸들러에 넣어 주는 하나의 실행 상태 객체다. 변수, 노드 출력 캐시, 대화 스레드 같은 값이 들어 있다. 세그먼트가 끝나면 사라지고 재개할 때 DB 에서 다시 만든다.

기능이 늘 때마다 기능별 필드를 바로 얹으면(`parentParallelConcurrency`, `abortSignal` 처럼) 이 객체는 시간이 지나며 모든 것을 떠안는 God Object 가 된다. 특정 컨테이너 안에서만 뜻이 있는 필드가 모든 노드에 보여 책임 경계도 흐려진다. 이 규약은 필드를 나누는 기준과 새 필드를 더할 때의 결정 규칙을 정하고 **앞으로의 변경**에 적용한다.

이 문서는 컨텍스트의 구조도 정한다. 트리거 입력을 실행에 싣는 규칙은 [실행 컨텍스트 — 트리거 입력과 진입 API](CLE-EXEC-CONTEXT-TRIGGER.md), 실행 중 상태를 어디에 저장하는지와 저장된 실행을 다시 쓰는 모드의 경계는 [실행 컨텍스트 — 저장 전략과 재개](CLE-EXEC-CONTEXT-STORAGE.md) 가 정한다(아래 「하위 문서」).

범위 밖:

- `abortSignal` 의 동작 계약(전파 의무, best-effort, 에러 분류)은 [노드 취소](CLE-EXEC-CANCEL.md) 가 정한다. 이 문서는 그 필드의 분류만 정한다.
- 핸들러가 원본 설정과 평가된 설정을 받는 계약은 [노드 핸들러 계약](CLE-EXEC-HANDLER.md) 에 있다.
- park 한 실행을 되살리는 rehydration 절차는 [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md) 에 있다.
- 실행 엔티티의 durable 컬럼 정의는 [실행 데이터와 흐름](CLE-EXEC-DATA.md) 에 있다.
- 재실행의 API·권한·dry-run 은 [재실행](CLE-EXEC-RERUN.md) 이 정한다.

## 규칙

### 필드 분류

1. **안정 핵심(stable core)**: `ExecutionContext` 에는 모든 노드가 함께 쓰는 최소 필드만 둔다.
   - 식별: `workflowId`, `executionId`, `nodeExecutionId`, `nodeId?`
   - 실행 표준: `variables`, `nodeOutputCache`, `structuredOutputCache`, `rawConfig`, `recursionDepth`. `nodeOutputCache` 와 `structuredOutputCache` 는 Parallel 의 병렬 분기에 들어갈 때 얕은 복사로 격리한다([Parallel 노드](../CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md)). 엔진은 노드 출력을 등록된 루트 컨텍스트에 쓰고 같은 항목을 그 병렬 분기의 사본에도 옮긴다(REQ-PARALLEL-031). 병렬 분기 안 안쪽 Parallel 의 병렬 분기가 쓴 출력은 바깥 병렬 분기의 사본에도 옮긴다.
   - 여러 기능이 함께 쓰는 취소: `abortSignal?: AbortSignal`. 선택 필드이고 best-effort 규약이다. 모든 노드가 지켜야 하는 것은 아니다.
   - 위 목록은 이 규약이 직접 다루는 발췌다. 전체 필드 정의의 기준은 `node-handler.interface.ts` 다(`conversationThread`, `itemContext`, `loopContext`, `expressionContext` 등 포함).
2. **컨테이너 전용 필드**: 특정 컨테이너 노드 안에서만 뜻이 있는 필드는 `ExecutionContext` 에 바로 얹지 않고 별도 인터페이스로 확장한다.

   ```typescript
   interface ParallelBranchContext extends ExecutionContext {
     parentParallelConcurrency: number; // 필수. Parallel 분기 안에서만 뜻이 있다
   }
   ```

   중첩 Parallel 동시 실행 수 전파용 `parentParallelConcurrency` 는 이 원칙에 따라 `ParallelBranchContext` 로 분리한다(2026-05-30). [Parallel 노드](../CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md) 결정 G 가 이 필드를 `ExecutionContext` 에 바로 더했던 것을 뒤집은 결정이다.

   이 값은 Parallel 의 병렬 분기 밖 두 경로에서도 다룬다. 정본은 [Parallel 노드 §놓인 위치별 실행과 중첩 깊이](../CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md#놓인-위치별-실행과-중첩-깊이) 다.
   - 컨테이너 반복 회차는 컨테이너가 받은 컨텍스트를 그대로 쓴다. 그래서 병렬 분기 안 컨테이너 본문은 바깥 병렬 분기의 값을 이어받는다(REQ-PARALLEL-035).
   - 동기 서브 워크플로우는 실행하는 동안 호출한 쪽 컨텍스트의 값을 떼어 두고, 끝나면 실패했더라도 되돌린다. 그래서 서브 워크플로우의 Parallel 은 깊이 1 부터 센다(REQ-PARALLEL-036).
3. **선택 필드 늘리기 금지**: 새로 여러 기능이 함께 쓰는 기능을 더할 때 `ExecutionContext` 에 선택 필드를 바로 늘리지 않는다.
   - 모든 노드가 쓰는 기능이면 `ExecutionContext` 에 더하고 `node-handler.interface.ts` 를 고치고 이 문서에 분류 근거를 적는다.
   - 특정 컨테이너나 기능에 한정되면 `XBranchContext extends ExecutionContext` 로 확장한다(규칙 2).
   - 기존 필드(`abortSignal`, `rawConfig`, `recursionDepth` 등)는 도입 때의 근거를 각자 갖고 있다. 이 규칙은 그 필드들을 옮기라는 뜻이 아니고 **앞으로 더하는 필드**에 적용한다.
4. **엔진 내부 필드(`_` 접두)**: 노드 핸들러가 **읽지 않고** 엔진의 그래프 순회와 컨텍스트 라우팅에만 쓰는 상태는 `_` 접두로 표시한다. `node-handler.interface.ts` 에 `_` 접두 선택 필드로 두되 핸들러 계약 표면에는 넣지 않는다. 안정 핵심도 컨테이너 전용도 아닌 엔진 전용 범주다.
   - `_executedNodes`: 서브 워크플로우 인라인 순회에서 이미 실행한 노드 집합.
   - `_contextKey?: string`: `ExecutionContextService` 의 메모리 `Map<key, ExecutionContext>` 라우팅 키. 기본값은 `executionId` 다. 백그라운드가 아닌 컨텍스트는 늘 이 값이라 동작이 그대로다. Background 본문만 `bg:<executionId>:<backgroundRunId>` 형태의 별도 키를 쓴다. 메모리 Map 라우팅 전용이고 Redis 키 패턴과 무관하다([비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md)).
   - `_callStack?: ResumeCallStackFrame[]`: 중첩 `executeInline` 호출 체인을 park·재개하기 위한 엔진 내부 프레임 스택. 새로 park 할 때 `Execution.resume_call_stack` 에 저장되고 rehydration 이 이 스택으로 서브 워크플로우 프레임을 하나씩 다시 들어간다. 핸들러는 읽지 않고 엔진(`driveCallStackResume`·`driveResumeFrame`)만 참조한다([장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md)).
   - `_executedNodes` 와 `_contextKey` 는 이 분류가 생기기 전에 더해졌고 규칙 4 를 만들며 소급해 분류했다.
   - `_resumeState`·`_retryState` 는 `ExecutionContext` 필드가 아니고 핸들러 반환값(`NodeHandlerOutput`)의 최상위 내부 필드다. 정본은 [노드 출력 규약 Principle 0](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-0-노드-출력의-다섯-필드) 이다.
5. **`variables.__*` 시스템 예약 이름**: `ExecutionContext.variables` 는 사용자 정의 워크플로우 변수 맵이다. 엔진은 실행을 시작할 때 시스템 값을 `__`(밑줄 두 개) 접두 키로 이 맵에 넣는다. `__*` 는 예약 접두어이고 사용자 변수 이름에 `__` 를 쓸 수 없다.
   - 지금 넣는 값(기준: `node-handler.interface.ts` JSDoc): `__workspaceId`(실행 시작 때 `workflow.workspaceId`, 통합 조회·모델 설정 등 워크스페이스 단위 리소스 해석), `__workspaceName`(`Workspace.name` 복제, AI 시스템 맥락 접두), `__workspaceTimezone`(`Workspace.settings.timezone`, IANA, 시스템 맥락 접두와 스케줄 기본 시간대 해석), `__dryRun`(재실행 dry-run 모드, [재실행](CLE-EXEC-RERUN.md)). 새 시스템 값은 반드시 `__` 접두를 쓴다.
   - 규칙 4 와 다르다. 규칙 4 는 `ExecutionContext` **최상위**의 엔진 전용 필드이고 이 규칙은 사용자에게 보이는 `variables` **맵 안**에 들어가는 시스템 값이다. 위치(최상위와 맵 안)와 접두(`_` 하나와 `__` 둘)가 모두 다르다.
   - 저장 정책: park 때 `Execution.user_variables` 에 저장하는 값은 시스템 `__*` 를 뺀 사용자 정의분이다(`filterUserVariables`, `!key.startsWith('__')`). 재개할 때 엔진이 `__*` 를 다시 넣는다.
   - 예약은 변수 선언 노드와 변수 수정 노드에서 `RESERVED_VARIABLE_NAME` 으로 강제한다. 세 층이 함께 강제한다.
     - **L0 저장 시점**: `WorkflowsService.saveCanvas`·`importWorkflow` 가 글자 그대로의 `__` 이름을 400(`RESERVED_VARIABLE_NAME`, `details.offenders[]`)으로 거부한다. `restoreVersion` 은 게이트 이전 스냅샷 복원이라 이 게이트를 건너뛴다. 수동 트리거 파라미터 스키마 게이트(`validateManualTrigger`)와 같은 옛 데이터 예외다.
     - **L1 사전 검증**: 두 노드의 `validateConfig` 가 글자 그대로의 `__` 이름을 돌려주고 엔진이 `INVALID_NODE_CONFIG` 로 실행 직전에 막는다. 저장 게이트를 우회해 들어온 데이터의 안전망이다.
     - **L2 런타임**: 핸들러 `execute` 가 **평가된** 이름을 다시 검사해 예외를 던진다. `{{ }}` 로 만든 이름은 여기서만 실제 값이 드러나므로 이 층이 실질 강제 지점이다. 기준 코드는 `reserved-variable-name.util.ts` 이고 carousel `button.id` 의 `__item_` 접두 스키마 거부가 선례다.
   - `importWorkflow` 는 `restoreVersion` 과 달리 옛 데이터 예외가 없다. 가져오는 JSON 은 이 워크스페이스의 과거 스냅샷이 아닌 새 데이터이므로 `__` 이름을 400 으로 거부한다. 규칙 도입 전에 내보낸 워크플로우를 다시 가져오면 이 게이트에 걸릴 수 있다. 사용자가 JSON 의 이름을 고쳐 다시 시도한다.
   - **강제 범위 밖(Code 노드)**: Code 노드는 `$vars` 를 통째로 바꿔 넣으므로(`nodes/data/code/code.handler.ts`) 사용자 코드가 `$vars.__workspaceId` 를 써도 거르지 않고 `context.variables` 를 덮어쓴다. `__workspaceId` 는 통합 자격 증명 조회(`getForExecution(id, workspaceId, use)`)·모델 설정 해석·서브 워크플로우 dispatch 의 워크스페이스 신뢰 경계로 쓰이므로 Code 노드로 이를 위조하면 원칙적으로 다른 워크스페이스 리소스에 접근을 시도할 수 있다. 이 위험은 기존부터 있었다. 근본 대책(워크스페이스 식별자를 사용자가 바꿀 수 있는 `variables` 맵 밖으로 옮기기)은 별도 과제다. park 필터는 여전히 `__*` 를 버리지만 두 변수 노드 경로에서는 L0·L1·L2 로 사용자 정의 `__*` 변수가 애초에 생기지 않아 조용히 사라지는 문제는 없어졌다. 노드 쪽 설명은 [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) 에 있다.

### 새 필드 추가 결정

| 질문 | 예 | 아니오 |
| --- | --- | --- |
| 모든(또는 대부분의) 노드가 읽는가? | `ExecutionContext` 에 더한다 | 아래로 |
| 특정 컨테이너 안의 분기에서만 뜻이 있는가? | `XBranchContext extends ExecutionContext` 로 분리한다(규칙 2) | 아래로 |
| 여러 기능이 함께 쓰지만 일부 노드만 읽는가? (예: 취소) | `ExecutionContext` 의 **선택** 필드로 두고 동작 계약은 별도 best-effort 규약 문서에 맡긴다 | 아래로 |
| 핸들러가 읽지 않고 엔진 순회·라우팅에만 쓰는가? | `_` 접두 엔진 내부 필드(규칙 4). 인터페이스에 선택 필드로 두고 핸들러 계약에 노출하지 않는다 | 다시 검토 |

### 진단 로그

`ExecutionContextService` 는 컨텍스트 수명주기의 핵심 사건을 `[ctx-trace]` 접두 로그로 남긴다. `createContext` 덮어쓰기(OVERWRITE), `deleteContext`, `setNodeOutput` 대상 없음(MISSING), `setStructuredOutput`·`setEngineResolvedConfig` 대상 없음이 대상이다. 운영 로그에서 `[ctx-trace]` 로 검색해 컨텍스트 경쟁과 키 라우팅 오류를 추적한다.

setter 가 대상 컨텍스트를 찾지 못했을 때(키 라우팅 오류)의 동작은 둘로 나뉜다.

| setter | 컨텍스트가 없을 때 | 이유 |
| --- | --- | --- |
| `setNodeOutput` (엄격) | 예외와 `logger.error` | 핸들러 출력 전달은 보장돼야 한다. 잃어버린 것을 조용히 넘기지 않는다 |
| `setStructuredOutput`·`setEngineResolvedConfig` (best-effort) | 아무것도 하지 않고 `logger.warn` | 보조 캐시라 잃어도 실행은 계속된다. 잘못된 키를 진단하려고 경고는 남긴다 |

## 컨텍스트 구조

아래 예시는 핸들러가 읽는 필드만 보인다. 엔진 내부 `_` 접두 필드(`_contextKey`, `_executedNodes`, `_callStack`)는 핸들러가 쓰지 않으므로 뺐다.

```json
{
  "executionId": "uuid",
  "workflowId": "uuid",
  "nodeExecutionId": "uuid",
  "nodeId": "uuid",
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
    "node-uuid-2": { }
  },
  "loopContext": { "index": 3, "count": 10, "isFirst": false, "isLast": false },
  "itemContext": { "item": { }, "index": 2, "isFirst": false, "isLast": false },
  "conversationThread": {
    "id": "default",
    "nextSeq": 2,
    "turns": [
      { "seq": 0, "nodeId": "...", "nodeType": "form", "source": "presentation_user", "text": "name=Alice, age=30", "timestamp": "2026-05-14T10:00:00.000Z" },
      { "seq": 1, "nodeId": "...", "nodeType": "ai_agent", "source": "ai_assistant", "text": "안녕하세요 Alice님", "timestamp": "2026-05-14T10:00:02.500Z" }
    ],
    "totalChars": 42
  }
}
```

| 필드 | 언제 채우는가 | 용도 |
| --- | --- | --- |
| `executionId` | 실행 시작 때 고정 | 실행·노드 실행 귀속 |
| `workflowId` | 실행 시작 때 고정 | 표현식 컨텍스트, 사용처 확인 |
| `nodeId` | 엔진이 `handler.execute` 직전에 넣고 노드마다 바꾼다 | 지금 실행 중인 노드의 ID. AI 노드는 대화 스레드와 시스템 컨텍스트에 자기 노드를 적을 때 쓴다. 통합 서비스는 개인 통합을 조회할 때 이 값으로 노드가 속한 워크플로우의 작성자를 구한다([통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#integrationsservice-api-실행-엔진용)). 멀티턴(AI 에이전트·정보 추출기)의 재개 턴은 엔진 `buildRetryReentryState` 가 재구성 상태에 넣은 값을 쓴다 |
| `nodeExecutionId` | 엔진이 `handler.execute` 직전에 넣고 노드마다 바꾼다 | 통합 핸들러가 `IntegrationUsageLog.node_execution_id` 에 기록한다. AI 노드 핸들러(AI 에이전트·Text Classifier·정보 추출기)는 `LlmCallContext` 로 `llm_usage_log.node_execution_id` 에 기록한다. 멀티턴(AI 에이전트·정보 추출기)의 재개 턴은 실행 컨텍스트를 받지 않으므로 엔진 `buildRetryReentryState` 가 재구성 상태에 넣은 현재 턴 행 PK 를 쓴다. Text Classifier(재개 없는 한 번 호출)는 첫 호출의 `context.nodeExecutionId` 만 쓴다([LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md)) |
| `rawConfig` | 엔진이 `handler.execute` 직전에 넣고 노드마다 바꾼다 | 노드 정의에 저장된 **원본 설정**(표현식 평가 전). 핸들러가 `NodeHandlerOutput.config` 에코에 쓴다. 얕은 `Object.freeze` 를 걸어 최상위 변경을 막고 중첩 객체는 읽기 전용으로 다룬다 |
| `engineResolvedConfigCache` | 엔진이 표현식 평가 직후 노드마다 쌓는다 | 노드별 **평가가 끝난 설정** 스냅샷. `runContainerInner`·`runParallel` 처럼 핸들러가 끝난 뒤 따로 동작 파라미터(Loop `count`, Parallel `branchCount`·`maxConcurrency`·`waitAll`, ForEach `errorPolicy` 등)를 다시 읽는 경로가 쓴다. **표현식 컨텍스트에는 노출하지 않는다**. `$node["X"].config` 는 여전히 원본 에코를 돌려준다. 핸들러가 원본만 에코하는 컨테이너의 동작 파라미터가 조용히 기본값으로 떨어지거나 `Number("{{...}}")` 가 NaN 이 되던 문제를 막는다 |
| `structuredOutputCache` | 엔진이 핸들러 호출마다 `nodeOutputCache` 와 함께 채운다 | 노드별 노드 출력 다섯 필드 객체. 표현식 resolver 가 이 캐시로 `$node[X].config`·`.output`·`.meta`·`.port`·`.status` 를 노출한다([노드 핸들러 계약](CLE-EXEC-HANDLER.md)). 핸들러는 거의 읽지 않는다 |
| `variables.__workspaceId` | 실행 시작 때 `workflow.workspaceId` 로 넣는다 | 통합 조회, 모델 설정 조회 등 워크스페이스 단위 리소스 해석 |
| `variables.*`(그 밖) | 트리거·워크플로우 변수(변수 선언 노드·변수 수정 노드가 설정하는 사용자 정의 런타임 값) | 표현식 `$var.X` 평가. park 때 사용자 정의분이 저장되고 rehydration 이 되살리므로(규칙 5 저장 정책) park 뒤 노드가 그대로 읽는다 |
| `conversationThread` | 실행 시작 때 빈 스레드(`{ id: 'default', nextSeq: 0, turns: [], totalChars: 0 }`)로 만들고 노드 훅이 쌓는다 | 사용자 인터랙션과 AI 대화 턴의 단일 기준. `ConversationThreadService.append*` 가 유일한 변경 진입점이고 핸들러는 직접 바꾸지 않는다. 표현식에는 `$thread` 로 노출한다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)) |
| `loopContext`·`itemContext` | 컨테이너 회차마다. Background 워커는 작업 스냅샷에 실린 값으로 되살린다([Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md#요구사항) REQ-BGRUN-028) | Loop·ForEach 본문의 반복 변수 원천([컨테이너 실행](CLE-EXEC-CONTAINER.md)). 컨테이너 본문 안 Background 의 본문도 큐에 넣은 회차의 값을 읽는다([컨테이너 실행 §컨테이너 본문 안 Background](CLE-EXEC-CONTAINER.md#컨테이너-본문-안-background)) |
| `recursionDepth` | `createContext` 가 `0` 으로 만들고 서브 워크플로우 인라인 실행에 들어갈 때마다 1 씩 늘린다 | 무한 재귀 방지 |
| `abortSignal` | 취소 신호를 만드는 생산자가 넣는다 | 노드 취소 신호([노드 취소](CLE-EXEC-CANCEL.md)) |

**메모리 Map 키(`_contextKey`)**: `createContext(executionId, workflowId, options?: { initialVariables?, recursionDepth?, contextKey?, conversationThread? })` 에서 Map 키는 `options?.contextKey ?? executionId` 다. `conversationThread?: MutableConversationThread` 는 rehydration 이 `Execution.conversation_thread` 컬럼에서 되살린 스레드를 새 컨텍스트에 넣는 옵션이다. 백그라운드가 아닌 호출은 `contextKey` 를 생략하므로 키가 늘 `executionId` 와 같다. Background 본문만 `bg:<executionId>:<backgroundRunId>` 를 넘겨 부모 컨텍스트와 키를 가른다([컨테이너 실행](CLE-EXEC-CONTAINER.md)).

**멀티턴 재개 때의 `rawConfig` 스냅샷**: 턴 단위로 고정하고 재개 때 현재 `node.config` 에서 다시 만든다. 규칙은 [실행 컨텍스트 — 저장 전략과 재개](CLE-EXEC-CONTEXT-STORAGE.md#멀티턴-재개-때의-rawconfig-스냅샷) 에 있다.

## 하위 문서

- [실행 컨텍스트 — 트리거 입력과 진입 API](CLE-EXEC-CONTEXT-TRIGGER.md): 진입 API `execute()` 의 입력 · 옵션, `workspaceId` 대조, `resolveTriggerParameters`, 진입 경로별 호출 값. 맡는 요구사항 번호: 없음.
- [실행 컨텍스트 — 저장 전략과 재개](CLE-EXEC-CONTEXT-STORAGE.md): 단계별 저장소, 입력 대기 커밋 항목, 멀티턴 `rawConfig` 스냅샷, 조회 · 재실행 · 멀티턴 재개 모드의 경계. 맡는 요구사항 번호: 없음.

## 트리거 입력 파라미터 싣기

→ [실행 컨텍스트 — 트리거 입력과 진입 API](CLE-EXEC-CONTEXT-TRIGGER.md#트리거-입력-파라미터-싣기)

## 미결 사항

- **`ExecutionContext.triggerData` 의 분류**: [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 의 Rationale 은 `triggerData` 를 어떤 노드 핸들러도 직접 읽지 않는 resolver 전용 원천이라고 설명한다. 이 규약의 규칙 4 와 결정 표는 핸들러가 읽지 않는 필드를 `_` 접두 엔진 내부 필드로 두라고 하고 규칙 3 은 새 필드의 분류 근거를 이 문서에 적으라고 한다. 현재 코드의 필드 이름은 접두 없는 `triggerData` 이고 이 규약과 컨텍스트 구조 표 어디에도 기록이 없다. `triggerData` 를 규칙 4 의 예외로 등재할지, `_triggerData` 로 바꿀지 결정해야 한다. 같은 결정이 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md#미결-사항) 의 미결 사항에도 올라 있다. 결정하면 분류 근거는 규칙 3 에 따라 이 문서에 적는다.

## 구현 위치

- `codebase/backend/src/nodes/core/node-handler.interface.ts` (`ExecutionContext`, `ParallelBranchContext`)
- `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts`
- `codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts`
- `codebase/backend/src/modules/integrations/personal-integration-use-facts.ts` (`loadExecutionUseFacts`. `nodeId` 로 노드가 속한 워크플로우의 작성자를 구한다)

## Rationale

### 실행을 시작하는 워크스페이스를 진입 API 의 필수 옵션으로 둔다 (2026-10-05)

→ [실행 컨텍스트 — 트리거 입력과 진입 API](CLE-EXEC-CONTEXT-TRIGGER.md#실행을-시작하는-워크스페이스를-진입-api-의-필수-옵션으로-둔다-2026-10-05)

### `parentParallelConcurrency` 를 `ParallelBranchContext` 로 나눈다

`parentParallelConcurrency` 는 중첩 Parallel 의 동시 실행 수 곱 상한(결정 #3·G·D)을 위해 바깥 Parallel 이 자식 분기에 넘기는 값이다. Parallel 분기 안에서만 뜻이 있다. `ExecutionContext` 의 선택 필드로 두면 HTTP·AI·DB 등 모든 노드가 상관없는 필드를 보고 같은 방식이 Loop·ForEach 전용 필드로 되풀이되면 God Object 가 쌓인다. 별도 인터페이스로 나누면 "이 필드는 Parallel 분기에서만 읽힌다" 를 타입이 강제하고 안정 핵심이 작게 유지된다. 비용은 분기 컨텍스트를 만드는 곳과 쓰는 곳의 타입 좁히기 한 번뿐이다.

### `abortSignal` 은 안정 핵심에 둔다

취소는 한 컨테이너에 한정되지 않고 Parallel `cancel-others-on-fail`, 워크플로우 시간 한도, 사용자 실행 중지, 안전 종료처럼 여러 기능이 함께 쓰는 기반이다. 컨테이너별 인터페이스로 쪼개면 오히려 쓰는 곳마다 타입이 갈린다. 그래서 선택 필드로 안정 핵심에 두고 "모든 노드가 지킬 필요는 없는 best-effort" 라는 동작 계약은 [노드 취소](CLE-EXEC-CANCEL.md) 가 맡는다. 필드 분류와 동작 계약의 기준 문서를 나눈 것이다.

### "선택 필드 늘리기 금지" 는 새 필드에만 적용한다

기존 필드를 한꺼번에 옮기면 운영 핸들러 24개와 엔진 주입부를 넓게 고쳐야 해 회귀 위험이 따른다. [노드 취소](CLE-EXEC-CANCEL.md) 가 핸들러 시그니처를 바꾸지 않은 이유와 같은 맥락이다. 이 규약의 가치는 앞으로 쌓이는 것을 막는 데 있으므로 새 변경에만 적용한다.

### `_contextKey` 를 엔진 내부 필드로 둔다

컨텍스트의 메모리 Map 키는 어떤 노드 핸들러도 읽지 않는 라우팅 식별자다. 안정 핵심에 넣으면 모든 핸들러에 상관없는 필드가 보인다. `_executedNodes` 처럼 `_` 접두 엔진 내부 필드로 두면 핸들러 표면을 더럽히지 않고 엔진만 참조한다. God Object 우려의 본질은 핸들러가 보는 필드가 커지는 것이므로 핸들러에 보이지 않는 내부 필드에는 해당하지 않는다. 이 결정의 기준은 이 문서이고 [Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) 가 이를 참조한다.

도입 계기는 Background 본문이 부모와 **같은 `executionId` 를 Map 키로 쓰던 것**이다. 먼저 끝난 부모의 `deleteContext(executionId)` 가 fire-and-forget 본문이 쓰던 컨텍스트를 같은 키로 지워 "Execution context not found" 경쟁이 생겼다. `executionId` 는 노드 실행 묶음·WebSocket 채널·권한의 1차 키라 그대로 두고 **메모리 Map 키만** Background 에서 `bg:*` 로 나눴다. 규칙 4 는 핸들러가 읽지 않는 엔진 필드를 위한 **새 갈래를 더한** 것이다. 기존 결정 표의 "다시 검토" 칸은 그대로 남는다.

### 부가 필드를 `ExecutionOptions` 하나로 묶는 안을 기각한다

모든 부가 필드를 `options` 객체 하나로 묶는 안도 검토했다. 이 안은 컨테이너별 뜻 차이를 타입으로 나타내지 못하고(`options.parentParallelConcurrency` 가 Parallel 이 아닌 컨텍스트에도 보인다) 선택 필드 늘리기를 객체 안으로 옮길 뿐이다. 컨테이너별 `extends` 분리가 타입 안전성과 책임 경계 모두에서 낫다.

이 기각의 대상은 핸들러에 넣는 `ExecutionContext` 필드 묶음이다. `ExecutionContextService.createContext()` 의 인자를 옵션 객체(`options?: { initialVariables?, recursionDepth?, contextKey?, conversationThread?, ... }`)로 받는 것은 핸들러가 보는 표면과 무관해 이 기각 범위 밖이다.

### `variables.__*` 예약을 세 층으로 강제한다 (2026-07-11)

규칙 5 는 원래 약속일 뿐 강제가 없었다. 강제를 들이며 한 지점만으로는 모자란다는 것이 설계의 핵심이었다. `handler.validate`(사전 검증)는 실행 때만 돌아 잘못된 저장이 실행 직전까지 조용히 지나간다. 두 변수 노드의 이름 필드는 `{{ }}` 표현식 대상이라(`EXPRESSION_EXCLUSIONS` 에 없음) 사전 검증은 **평가 전 원본**만 본다. `name: "{{ $input.x }}"` 가 런타임에 `__workspaceId` 로 평가되면 원본 검사를 피한다. 그래서 저장 시점(L0, 바로 400), 사전 검증(L1, 안전망), 런타임 평가 뒤(L2, 실질 강제)의 세 층을 둔다. L2 가 없으면 강제가 성립하지 않는다.

### 호환이 깨지는 변경을 받아들인다

이 강제로 `__foo` 변수를 쓰던 기존 워크플로우는 저장(L0)에서 400 이 나거나 실행(L2)에서 실패한다. 그러나 그런 변수는 이미 반쯤 깨져 있었다. park 저장의 `filterUserVariables` 가 `__*` 를 **관찰할 수 없게 버려** 재개 뒤 조용히 사라졌다. 변수 선언 노드가 일부러 택한 조용한 건너뛰기·대체(`meta.skipped`·`meta.coercionWarnings` 로 **관찰할 수 있음**)와는 다른 종류의 침묵이다. 관찰할 수 있는 침묵은 두고 관찰할 수 없는 침묵(park 에서 버림)은 명시적 실패로 바꾼다. 조용한 데이터 손실보다 명시적 실패가 낫다.

### Code 노드는 강제 범위 밖에 둔다

Code 노드는 `$vars` 를 통째로 바꿔 넣으므로 사용자 코드가 `$vars.__workspaceId` 를 쓰면 예약 키를 덮어쓴다. 그러나 임의 코드 실행 노드에 변수 이름 허용 목록을 강제하려면 사용자 JS 출력 전체를 살펴 거부해야 해 두 선언형 노드의 필드 검증과 성격이 다르다. 그것은 Code 노드의 격리와 계약을 따로 정해야 하는 문제다. 그래서 이 강제는 사용자가 **폼으로 이름을 직접 적는** 두 노드로 한정하고 Code 노드 경로는 남은 위험으로 그대로 적어 둔다.

### `nodeId` 를 필드 표에 적는다 (2026-10-25)

`nodeId` 는 코드에 이미 있는 선택 필드(`node-handler.interface.ts`)인데 이 표에 없었다. NERV Task `CLE-T-MG0EQZ` 에서 개인 통합 사용 판정에 쓸 워크플로우 작성자를 이 값으로 구하기로 했다. 통합 서비스가 노드 행에서 그 노드가 속한 워크플로우를 찾는다. 그래서 표에 행을 더하고 쓰임을 적었다. 새 필드가 아니므로 규칙 3 과 「새 필드 추가 결정」 표를 다시 거치지 않는다. 분류는 규칙 1 의 식별 필드와 같다. 엔진이 모든 노드에 넣는 값이고 특정 기능이나 컨테이너에만 뜻이 있는 값이 아니다. 타입은 `nodeId?` 선택 필드다. 같은 Task 의 2026-10-24 승인본은 워크플로우 작성자를 새 선택 필드 `workflowAuthorId` 로 넣고 규칙 3 의 예외로 두려 했다. 그 안을 버린 이유는 [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md) Rationale 에 있다.
