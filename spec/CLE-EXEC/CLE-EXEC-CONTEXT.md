---
id: "CLE-EXEC-CONTEXT"
title: "실행 컨텍스트"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC"
ancestors: ["CLE-VISION", "CLE-EXEC"]
area: "CLE-EXEC"
content_hash: "b7f06c532aeeb66b7b6c732dbe8743032f6a2f8dd0d1eb748a241b6c445e7a4a"
read_as: "approved_fallback"
task: "CLE-T-XYR067"
source_paths: ["spec/5-system/4-execution-engine.md", "spec/conventions/execution-context.md"]
mirror_sha256: "ec7571b145680c27a27fb981f6d424f19fd054b9c08f3adf98052106f5e053ef"
etag: "sha256-679abbdc8a238746243f2aac77e26dfea3e02be9c59a2e9e8f3d31d7fa2354dd"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/execution-context.md` (전체), `spec/5-system/4-execution-engine.md` (§6.1~§6.3, Rationale "실행 컨텍스트 in-memory + DB durable") · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

실행 컨텍스트(`ExecutionContext`)는 엔진이 dispatch 직전에 모든 노드 핸들러에 넣어 주는 하나의 실행 상태 객체다. 변수, 노드 출력 캐시, 대화 스레드 같은 값이 들어 있다. 세그먼트가 끝나면 사라지고 재개할 때 DB 에서 다시 만든다.

기능이 늘 때마다 기능별 필드를 바로 얹으면(`parentParallelConcurrency`, `abortSignal` 처럼) 이 객체는 시간이 지나며 모든 것을 떠안는 God Object 가 된다. 특정 컨테이너 안에서만 뜻이 있는 필드가 모든 노드에 보여 책임 경계도 흐려진다(2026-05-30 코드 리뷰 SUMMARY#11). 이 규약은 필드를 나누는 기준과 새 필드를 더할 때의 결정 규칙을 정한다. 기존 필드를 소급해 옮기지 않고 **앞으로의 변경**에 적용한다.

이 문서는 컨텍스트의 구조, 트리거 입력을 실행에 싣는 규칙, 실행 중 상태를 어디에 저장하는지, 저장된 실행을 다시 쓰는 모드의 경계도 함께 정한다.

범위 밖:

- `abortSignal` 의 동작 계약(전파 의무, best-effort, 에러 분류)은 [노드 취소](CLE-EXEC-CANCEL.md) 가 정한다. 이 문서는 그 필드의 분류만 정한다.
- 핸들러가 원본 설정과 평가된 설정을 받는 계약은 [노드 핸들러 계약](CLE-EXEC-HANDLER.md) 에 있다.
- park 한 실행을 되살리는 rehydration 절차는 [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md) 에 있다.
- 실행 엔티티의 durable 컬럼 정의는 [실행 데이터와 흐름](CLE-EXEC-DATA.md) 에 있다.
- 재실행의 API·권한·dry-run 은 [재실행](CLE-EXEC-RERUN.md) 이 정한다.

## 규칙

### 필드 분류

1. **안정 핵심(stable core)**: `ExecutionContext` 에는 모든 노드가 함께 쓰는 최소 필드만 둔다.
   - 식별: `workflowId`, `executionId`, `nodeExecutionId`
   - 실행 표준: `variables`, `nodeOutputCache`, `structuredOutputCache`, `rawConfig`, `recursionDepth`. `nodeOutputCache` 와 `structuredOutputCache` 는 Parallel 분기에 들어갈 때 얕은 복사로 격리한다([Parallel 노드](../CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md)).
   - 여러 기능이 함께 쓰는 취소: `abortSignal?: AbortSignal`. 선택 필드이고 best-effort 규약이다. 모든 노드가 지켜야 하는 것은 아니다.
   - 위 목록은 이 규약이 직접 다루는 발췌다. 전체 필드 정의의 기준은 `node-handler.interface.ts` 다(`conversationThread`, `itemContext`, `loopContext`, `expressionContext` 등 포함).
2. **컨테이너 전용 필드**: 특정 컨테이너 노드 안에서만 뜻이 있는 필드는 `ExecutionContext` 에 바로 얹지 않고 별도 인터페이스로 확장한다.

   ```typescript
   interface ParallelBranchContext extends ExecutionContext {
     parentParallelConcurrency: number; // 필수. Parallel 분기 안에서만 뜻이 있다
   }
   ```

   중첩 Parallel 동시 실행 수 전파용 `parentParallelConcurrency` 는 이 원칙에 따라 `ParallelBranchContext` 로 분리한다(2026-05-30, C-1 옵션 a). [Parallel 노드](../CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md) 결정 G 가 이 필드를 `ExecutionContext` 에 바로 더했던 것을 뒤집은 결정이다.
3. **선택 필드 늘리기 금지**: 새로 여러 기능이 함께 쓰는 기능을 더할 때 `ExecutionContext` 에 선택 필드를 바로 늘리지 않는다.
   - 모든 노드가 쓰는 기능이면 `ExecutionContext` 에 더하고 `node-handler.interface.ts` 를 고치고 이 문서에 분류 근거를 적는다.
   - 특정 컨테이너나 기능에 한정되면 `XBranchContext extends ExecutionContext` 로 확장한다(규칙 2).
   - 기존 필드(`abortSignal`, `rawConfig`, `recursionDepth` 등)는 도입 때의 근거를 각자 갖고 있다. 이 규칙은 그 필드들을 옮기라는 뜻이 아니고 **앞으로 더하는 필드**가 분류 기준을 통과하게 하려는 것이다.
4. **엔진 내부 필드(`_` 접두)**: 노드 핸들러가 **읽지 않고** 엔진의 그래프 순회와 컨텍스트 라우팅에만 쓰는 상태는 `_` 접두로 표시한다. `node-handler.interface.ts` 에 `_` 접두 선택 필드로 두되 핸들러 계약 표면에는 넣지 않는다. 안정 핵심도 컨테이너 전용도 아닌 엔진 전용 범주다.
   - `_executedNodes`: 서브 워크플로우 인라인 순회에서 이미 실행한 노드 집합.
   - `_contextKey?: string`: `ExecutionContextService` 의 메모리 `Map<key, ExecutionContext>` 라우팅 키. 기본값은 `executionId` 다. 백그라운드가 아닌 컨텍스트는 늘 이 값이라 동작이 그대로다. Background 본문만 `bg:<executionId>:<backgroundRunId>` 형태의 별도 키를 쓴다. 메모리 Map 라우팅 전용이고 Redis 키 패턴과 무관하다([비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md)).
   - `_callStack?: ResumeCallStackFrame[]`: 중첩 `executeInline` 호출 체인을 park·재개하기 위한 엔진 내부 프레임 스택. 새로 park 할 때 `Execution.resume_call_stack` 에 저장되고 rehydration 이 이 스택으로 서브 워크플로우 프레임을 하나씩 다시 들어간다. 핸들러는 읽지 않고 엔진(`driveCallStackResume`·`driveResumeFrame`)만 참조한다([장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md)).
   - `_executedNodes` 와 `_contextKey` 는 이 분류가 생기기 전에 더해졌고 규칙 4 를 만들며 소급해 분류했다.
   - `_resumeState`·`_retryState` 는 `ExecutionContext` 필드가 아니다. 핸들러 반환값(`NodeHandlerOutput`)의 최상위 내부 필드이고 [노드 출력 규약 Principle 0](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-0-노드-출력의-다섯-필드) 이 정한다.
5. **`variables.__*` 시스템 예약 이름**: `ExecutionContext.variables` 는 사용자 정의 워크플로우 변수 맵이다. 엔진은 실행을 시작할 때 시스템 값을 `__`(밑줄 두 개) 접두 키로 이 맵에 넣는다. `__*` 는 예약 접두어이고 사용자 변수 이름에 `__` 를 쓸 수 없다.
   - 지금 넣는 값(기준: `node-handler.interface.ts` JSDoc): `__workspaceId`(실행 시작 때 `workflow.workspaceId`, 통합 조회·모델 설정 등 워크스페이스 단위 리소스 해석), `__workspaceName`(`Workspace.name` 복제, AI 시스템 맥락 접두), `__workspaceTimezone`(`Workspace.settings.timezone`, IANA, 시스템 맥락 접두와 스케줄 기본 시간대 해석), `__dryRun`(재실행 dry-run 모드, [재실행](CLE-EXEC-RERUN.md)). 새 시스템 값은 반드시 `__` 접두를 쓴다.
   - 규칙 4 와 다르다. 규칙 4 는 `ExecutionContext` **최상위**의 엔진 전용 필드이고 이 규칙은 사용자에게 보이는 `variables` **맵 안**에 들어가는 시스템 값이다. 위치(최상위와 맵 안)와 접두(`_` 하나와 `__` 둘)가 모두 다르다.
   - 저장 정책: park 때 `Execution.user_variables` 에 저장하는 값은 시스템 `__*` 를 뺀 사용자 정의분이다(`filterUserVariables`, `!key.startsWith('__')`). 재개할 때 엔진이 `__*` 를 다시 넣는다.
   - 예약은 변수 선언 노드와 변수 수정 노드에서 `RESERVED_VARIABLE_NAME` 으로 강제한다. 세 층이 함께 강제한다.
     - **L0 저장 시점**: `WorkflowsService.saveCanvas`·`importWorkflow` 가 글자 그대로의 `__` 이름을 400(`RESERVED_VARIABLE_NAME`, `details.offenders[]`)으로 거부한다. `restoreVersion` 은 게이트 이전 스냅샷 복원이라 이 게이트를 건너뛴다. 수동 트리거 파라미터 스키마 게이트(`validateManualTrigger`)와 같은 옛 데이터 예외다.
     - **L1 사전 검증**: 두 노드의 `validateConfig` 가 글자 그대로의 `__` 이름을 돌려주고 엔진이 `INVALID_NODE_CONFIG` 로 실행 직전에 막는다. 저장 게이트를 우회해 들어온 데이터의 안전망이다.
     - **L2 런타임**: 핸들러 `execute` 가 **평가된** 이름을 다시 검사해 예외를 던진다. `{{ }}` 로 만든 이름은 여기서만 실제 값이 드러나므로 이 층이 실질 강제 지점이다. 기준 코드는 `reserved-variable-name.util.ts` 이고 carousel `button.id` 의 `__item_` 접두 스키마 거부가 선례다.
   - `importWorkflow` 는 `restoreVersion` 과 달리 옛 데이터 예외가 없다. 가져오는 JSON 은 이 워크스페이스의 과거 스냅샷이 아닌 새 데이터이므로 `__` 이름을 400 으로 거부한다. 규칙 도입 전에 내보낸 워크플로우를 다시 가져오면 이 게이트에 걸릴 수 있다. 사용자가 JSON 의 이름을 고쳐 다시 시도한다.
   - **강제 범위 밖(Code 노드)**: Code 노드는 `$vars` 를 통째로 바꿔 넣으므로(`nodes/data/code/code.handler.ts`) 사용자 코드가 `$vars.__workspaceId` 를 써도 거르지 않고 `context.variables` 를 덮어쓴다. `__workspaceId` 는 통합 자격 증명 조회(`getForExecution(id, workspaceId)`)·모델 설정 해석·서브 워크플로우 dispatch 의 워크스페이스 신뢰 경계로 쓰이므로 Code 노드로 이를 위조하면 원칙적으로 다른 워크스페이스 리소스에 접근을 시도할 수 있다. 이 위험은 기존부터 있었다. 근본 대책(워크스페이스 식별자를 사용자가 바꿀 수 있는 `variables` 맵 밖으로 옮기기)은 별도 과제다. park 필터는 여전히 `__*` 를 버리지만 두 변수 노드 경로에서는 L0·L1·L2 로 사용자 정의 `__*` 변수가 애초에 생기지 않아 조용히 사라지는 문제는 없어졌다. 노드 쪽 설명은 [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) 에 있다.

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
| `setStructuredOutput`·`setEngineResolvedConfig` (best-effort) | 아무것도 하지 않고 `logger.warn` | 보조 캐시라 잃어도 실행은 계속된다. 잘못된 키를 진단하려고 경고는 남긴다(2026-06-03 코드 리뷰 INFO#7) |

## 컨텍스트 구조

아래 예시는 핸들러가 읽는 필드만 보인다. 엔진 내부 `_` 접두 필드(`_contextKey`, `_executedNodes`, `_callStack`)는 핸들러가 쓰지 않으므로 뺐다.

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
| `nodeExecutionId` | 엔진이 `handler.execute` 직전에 넣고 노드마다 바꾼다 | 통합 핸들러가 `IntegrationUsageLog.node_execution_id` 에 기록한다. AI 노드 핸들러(AI 에이전트·Text Classifier·정보 추출기)는 `LlmCallContext` 로 `llm_usage_log.node_execution_id` 에 기록한다. 멀티턴(AI 에이전트·정보 추출기)의 재개 턴은 실행 컨텍스트를 받지 않으므로 엔진 `buildRetryReentryState` 가 재구성 상태에 넣은 현재 턴 행 PK 를 쓴다. Text Classifier(재개 없는 한 번 호출)는 첫 호출의 `context.nodeExecutionId` 만 쓴다([LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md)) |
| `rawConfig` | 엔진이 `handler.execute` 직전에 넣고 노드마다 바꾼다 | 노드 정의에 저장된 **원본 설정**(표현식 평가 전). 핸들러가 `NodeHandlerOutput.config` 에코에 쓴다. 얕은 `Object.freeze` 를 걸어 최상위 변경을 막고 중첩 객체는 읽기 전용으로 다룬다 |
| `engineResolvedConfigCache` | 엔진이 표현식 평가 직후 노드마다 쌓는다 | 노드별 **평가가 끝난 설정** 스냅샷. `runContainerInner`·`runParallel` 처럼 핸들러가 끝난 뒤 따로 동작 파라미터(Loop `count`, Parallel `branchCount`·`maxConcurrency`·`waitAll`, ForEach `errorPolicy` 등)를 다시 읽는 경로가 쓴다. **표현식 컨텍스트에는 노출하지 않는다**. `$node["X"].config` 는 여전히 원본 에코를 돌려준다. 핸들러가 원본만 에코하는 컨테이너의 동작 파라미터가 조용히 기본값으로 떨어지거나 `Number("{{...}}")` 가 NaN 이 되던 문제를 막는다 |
| `structuredOutputCache` | 엔진이 핸들러 호출마다 `nodeOutputCache` 와 함께 채운다 | 노드별 노드 출력 다섯 필드 객체. 표현식 resolver 가 이 캐시로 `$node[X].config`·`.output`·`.meta`·`.port`·`.status` 를 노출한다([노드 핸들러 계약](CLE-EXEC-HANDLER.md)). 핸들러는 거의 읽지 않는다 |
| `variables.__workspaceId` | 실행 시작 때 `workflow.workspaceId` 로 넣는다 | 통합 조회, 모델 설정 조회 등 워크스페이스 단위 리소스 해석 |
| `variables.*`(그 밖) | 트리거·워크플로우 변수(변수 선언 노드·변수 수정 노드가 설정하는 사용자 정의 런타임 값) | 표현식 `$var.X` 평가. park 때 시스템 `__*` 를 뺀 사용자 정의분이 `Execution.user_variables` 에 저장되고 rehydration 이 되살린다. 그래서 park 전에 설정한 변수를 park 뒤 노드가 그대로 읽는다 |
| `conversationThread` | 실행 시작 때 빈 스레드(`{ id: 'default', nextSeq: 0, turns: [], totalChars: 0 }`)로 만들고 노드 훅이 쌓는다 | 사용자 인터랙션과 AI 대화 턴의 단일 기준. `ConversationThreadService.append*` 가 유일한 변경 진입점이고 핸들러는 직접 바꾸지 않는다. 표현식에는 `$thread` 로 노출한다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)) |
| `loopContext`·`itemContext` | 컨테이너 회차마다 | Loop·ForEach 본문의 반복 변수 원천([컨테이너 실행](CLE-EXEC-CONTAINER.md)) |
| `recursionDepth` | `createContext` 가 `0` 으로 만들고 서브 워크플로우 인라인 실행에 들어갈 때마다 1 씩 늘린다 | 무한 재귀 방지 |
| `abortSignal` | 취소 신호를 만드는 생산자가 넣는다 | 노드 취소 신호([노드 취소](CLE-EXEC-CANCEL.md)) |

**메모리 Map 키(`_contextKey`)**: `createContext(executionId, workflowId, options?: { initialVariables?, recursionDepth?, contextKey?, conversationThread? })` 에서 Map 키는 `options?.contextKey ?? executionId` 다. `conversationThread?: MutableConversationThread` 는 rehydration 이 `Execution.conversation_thread` 컬럼에서 되살린 스레드를 새 컨텍스트에 넣는 옵션이다. 백그라운드가 아닌 호출은 `contextKey` 를 생략하므로 키가 늘 `executionId` 와 같다. Background 본문만 `bg:<executionId>:<backgroundRunId>` 를 넘겨 부모 컨텍스트와 키를 가른다([컨테이너 실행](CLE-EXEC-CONTAINER.md)).

**멀티턴 재개 때의 `rawConfig` 스냅샷**:

- 첫 턴의 `executeNode` 가 `waiting_for_input` 에 들어가면 엔진이 `state.rawConfig = Object.freeze({ ...node.config })` 로 스냅샷을 뜬다.
- 뒤 턴의 `processMultiTurnMessage(message, state)` 는 `state` 만 받으므로(실행 컨텍스트 없음) 핸들러는 `state.rawConfig` 로 일관되게 읽는다.
- `context.rawConfig` 는 노드를 실행할 때마다 DB 에서 새로 읽은 값이고 `state.rawConfig` 는 한 턴을 처리하는 동안 고정된 스냅샷이다. 이 차이는 의도한 것이다.
- 멀티턴 AI 는 턴마다 입력 대기에서 코루틴을 해제하고(턴 단위 park) 다음 메시지가 오면 rehydration 으로 재개한다. 재개 때 `buildRetryReentryState` 가 **현재 `node.config` 에서 `rawConfig` 를 새로 만들어 다시 고정한다**. 그래서 고정 범위는 한 턴이고 park 중에 워크플로우 정의를 고치면 다음 턴부터 새 정의가 적용된다. 대화 전체를 첫 턴 정의로 고정하던 이전 동작을 대신한다.

## 트리거 입력 파라미터 싣기

엔진 진입 API 는 `execute(workflowId, input, options)` 다. `options` 는 필수다. `input` 은 트리거 종류와 상관없이 아래 모양을 따른다.

```typescript
type TriggerExecutionInput = {
  parameters?: Record<string, unknown>;
  // 웹훅에만 있는 필드
  body?: unknown;
  // 민감 헤더 값은 받을 때 [REDACTED] 로 가린 상태로 실린다. 인증은 가리기 전 원본으로 한다.
  headers?: Record<string, string>;
  query?: Record<string, string>;
  method?: string;
};

type ExecuteOptions = {
  /** 실행을 시작하는 쪽의 워크스페이스. 모든 호출이 넘긴다. */
  workspaceId: string;
  /** 수동 실행한 사용자 UUID. Execution.executed_by 컬럼에 저장한다. */
  executedBy?: string;
  /** 스케줄·웹훅 트리거 발화 때 트리거 UUID. Execution.trigger_id 컬럼에 저장한다. */
  triggerId?: string;
};
```

위 블록은 모든 변형에 필수인 `workspaceId` 와 **출처를 가르는 공통 옵션**만 보인다. 실제 `ExecuteOptions` 유니온에는 모드별 메타 필드가 더 있고 각자 문서가 기준이다.

- 재실행(`reRunOf`·`chainId`·`dryRun`)과 단일 노드 실행(`singleNodeId`·`previousExecutionId`)은 `executedBy` 쪽(수동 실행)에 붙는다. [재실행](CLE-EXEC-RERUN.md), [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 참고.
- 웹훅 호출 기록(`sourceIp`·`responseCode`)은 `triggerId` 쪽에 붙는다. [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 참고.
- 이 필드들은 모두 `Execution` 컬럼에 저장되고 큐에서 다시 읽은 뒤 `runExecution` 이 쓴다.
- `workspaceId` 는 대조에만 쓰고 저장하지 않는다. 대조를 통과하면 `variables.__workspaceId`(`workflow.workspaceId` 에서 온다)와 같은 값이다.
- 우선순위 계산용 `triggerType` 은 [큐 워커와 동시 실행 제한](CLE-EXEC-WORKER.md) 에서 정한다.

**실행을 시작하는 워크스페이스**: 이 실행을 시작한 요청 · 트리거 · 스케줄이 속한 워크스페이스다. 호출부가 `workspaceId` 로 넘긴다. 엔진은 워크플로우를 읽은 뒤 그 워크플로우의 워크스페이스가 `options.workspaceId` 와 같은지 본다. 다르면 `execute()` 는 워크플로우가 없을 때와 같은 `WorkflowNotFoundError` 로 거부하고 실행 행을 만들지 않는다. 없는 워크플로우와 다른 워크스페이스의 워크플로우를 구분하지 않는다. 대조는 진입 한 곳에서만 한다. 엔진 안의 다른 읽기(재개, 실행 구동, 실패 알림 등)는 이미 만든 실행 행을 따라 워크플로우를 id 로 읽는다. 진입 경로마다 넘기는 값은 아래 표가 정한다. 거부됐을 때의 응답은 진입 경로의 문서가 정한다. 근거는 [데이터 모델 개요 「참조의 소속」](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 이다.

서브 워크플로우 호출은 이 진입 API 를 쓰지 않는다. 실행 중 노드 설정이 가리키는 워크플로우는 [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) 가 `WORKFLOW_FORBIDDEN_WORKSPACE` 로 따로 막는다.

공통 함수 `resolveTriggerParameters(workflow, rawValues)`:

1. 워크플로우 그래프에서 `manual_trigger` 노드를 찾아 `config.parameters` 스키마를 읽는다. 호출부가 스키마를 `loadTriggerParameterSchema(nodeRepository, workflowId, workspaceId)` 로 실행을 시작하는 워크스페이스 안에서만 읽는다. 워크플로우가 그 워크스페이스에 없으면 스키마가 없는 것으로 보고 이어지는 `execute()` 가 거부한다. 다른 워크스페이스 워크플로우의 필수 파라미터로 400 을 내지 않는다.
2. 필수 값이 없으면 `InvalidInputError` 를 던진다. 호출하는 쪽이 400 이나 실행 실패로 바꾼다.
3. 기본값(`defaultValue`)을 채운다.
4. `coerceToType` 으로 타입을 맞춘다(변수 선언 노드와 같은 함수).

| 진입 경로 | 동작 | 기록되는 출처 |
| --- | --- | --- |
| 수동 실행 | 컨트롤러가 `{ parameterValues }` 를 받아 `resolveTriggerParameters` 를 거친 뒤 `{ parameters }` 와 `{ executedBy: user.sub, workspaceId }` 로 `execute()` 를 부른다. `workspaceId` 는 요청의 워크스페이스다 | `executed_by` 가 채워져 수동 실행 |
| 단일 노드 실행 | 수동 실행과 같이 `{ executedBy: user.sub, workspaceId, singleNodeId, previousExecutionId }` 로 부른다. `workspaceId` 는 요청의 워크스페이스다 | `executed_by` 가 채워진다 |
| 재실행 | `ExecutionsService.reRun` 이 원본 실행을 요청의 워크스페이스에서 찾은 뒤 `{ executedBy, workspaceId, reRunOf, chainId, dryRun }` 로 부른다 | `executed_by` 가 채워진다 |
| 웹훅 | `HooksService` 가 `body` 를 원천으로 `resolveTriggerParameters` 를 거친다. 실패하면 `400 Bad Request` 를 돌려주고 실행을 만들지 않는다. 성공하면 `{ parameters, body, headers, query, method }` 와 `{ triggerId: trigger.id, workspaceId: trigger.workspaceId }` 로 부른다 | `trigger_id` 가 채워져 웹훅 |
| 채팅 채널 인바운드 | `HooksService` 의 채팅 채널 분기가 파라미터 해석 없이 `{ parameters: {}, chatChannel, body, headers, query, method }` 와 `{ triggerId: trigger.id, workspaceId: trigger.workspaceId, sourceIp, responseCode: '202' }` 로 부른다 | `trigger_id` 가 채워져 웹훅 |
| 스케줄 자동 발화 | `ScheduleRunnerService.process()` 가 `schedule.parameterValues` 를 제한 컨텍스트(`{ $now, $schedule: { id, cronExpression, timezone } }`)로 표현식 평가한 뒤 `resolveTriggerParameters` 를 거쳐 `{ parameters }` 와 `{ triggerId: schedule.triggerId, workspaceId }` 로 부른다. `workspaceId` 는 스케줄의 워크스페이스이고 트리거의 워크스페이스가 아니다. `$node`·`$input`·`$var` 는 쓸 수 없다 | `trigger_id` 가 채워져 스케줄 |
| 스케줄 "지금 실행" | 사용자가 지금 실행 버튼을 누른 경우 수동 실행과 같이 `{ executedBy: userId, workspaceId }` 로 부른다. `workspaceId` 는 요청의 워크스페이스다 | 수동 실행 |

출처를 가르는 규칙(우선순위와 라벨)은 [실행 내역](CLE-EXEC-HISTORY.md) 이 정한다. 분류 함수는 `deriveExecutionTrigger`(`execution-trigger.ts`)다. 민감 헤더 가리기는 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 이 정한다.

수동 트리거 노드의 출력 모양은 [수동 트리거 노드](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md) 가 정한다. 모든 경로에서 `output.parameters` 를 내고 웹훅 출처일 때만 `output.request: { method, headers, query, body }` 를 더한다. 뒤 노드의 표현식에서 `$input.parameters` 와 `$params` 는 같은 값이다.

## 저장 전략

| 단계 | 저장소 | 설명 |
| --- | --- | --- |
| 실행 중 | 메모리(`ExecutionContextService` 의 세그먼트 로컬 Map) | 실행 컨텍스트(변수, 노드 출력 캐시, 대화 스레드 등)를 인스턴스 로컬 `Map<contextKey, ExecutionContext>` 에 둔다. park(세그먼트 종료)나 완료 때 사라진다. 크래시·재시작·다른 인스턴스 재개는 아래 durable 컬럼에서 rehydration 이 다시 만든다. Redis 에 저장하지 않는다 |
| 노드 완료 때 | 메모리 + PostgreSQL | 메모리 컨텍스트의 노드 출력 캐시를 갱신하고 노드 실행 행과 `execution_node_log`(노드 순서)를 PostgreSQL 에 저장한다 |
| 노드 훅 때 | 메모리(`ExecutionContext.conversationThread` 일부) | `ConversationThreadService.append*` 가 Presentation 재개 `interaction`, 멀티턴 AI 메시지와 응답이 생길 때 메모리 스레드를 갱신한다. 실행 내역 화면의 기준은 `NodeExecution.outputData`(`output.interaction`·`output.messages`·`output.result.response`)이고 재개용 스냅샷은 아래 입력 대기 행에서 따로 커밋한다 |
| 입력 대기 진입 때 | PostgreSQL(`NodeExecution.outputData`, `Execution.conversation_thread`, `Execution.user_variables`, `Execution.resume_call_stack`) | 다음 노드를 재개하는 데 필요한 모든 것을 커밋한다. 메모리 컨텍스트는 park 때 사라지고 재개는 이 컬럼들에서 rehydration 이 다시 만든다. 커밋 항목은 아래 목록과 같다 |
| 실행 완료 때 | PostgreSQL | 최종 출력과 상태를 영구 저장하고 메모리 실행 컨텍스트를 지운다(`finalizeRehydrationCleanup` 또는 세그먼트 종료) |

입력 대기에 들어갈 때 커밋하는 항목:

1. 대기 표면(`interactionType`)과 노드의 `rawConfig` 스냅샷.
2. 멀티턴이면 `_resumeState` 에서 자격 증명을 뺀 부분집합 `_resumeCheckpoint`([실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md)). `_resumeState` 전체는 메모리에만 있다.
3. 현재 `context.conversationThread` 전체 스냅샷을 `Execution.conversation_thread`(jsonb)에 저장한다. 마지막 쓰기가 최신 스냅샷이고 rehydration 이 여기서 그대로 되살린다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)).
4. `context.variables` 가운데 시스템 `__*` 를 뺀 사용자 정의분을 `Execution.user_variables`(jsonb)에 저장한다.
5. 중첩 서브 워크플로우(`executeInline`) 안에서 park 하면 호출 체인(가장 바깥에서 대기 중인 안쪽 직전까지)을 `Execution.resume_call_stack`(jsonb)에 저장한다. rehydration 이 이 스택으로 서브 워크플로우 프레임을 하나씩 다시 들어간다. 최상위 park(중첩 깊이 0)는 `NULL` 이다. 버전은 체크포인트와 따로 진화하는 `CALL_STACK_SCHEMA_VERSION` 이다.

재개용 별도 컬럼 `_continuationCheckpoint` 는 만들지 않는다. 1·2 는 기존 기준인 `NodeExecution.outputData` 를 rehydration 의 단일 기준으로 쓴다. 5 의 `resume_call_stack` 은 park 시점의 **중첩 실행 위치**(호출 체인)를 저장한다. 재개 데이터를 나르는 컬럼이 아니므로 `_continuationCheckpoint` 기각과 범주가 다르다.

**실시간 조기 표시 신호는 저장하지 않는다**: 멀티턴 재개 공통 경로(WebSocket `execution.submit_message` 와 채널 텍스트 수신이 함께 지나는 `message_received` 재개 시점)는 다음 턴 LLM 호출 전에 WebSocket `execution.user_message` 이벤트를 내 사용자 발화를 바로 보여 준다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)). 이 신호는 `tool_call_*` 와 같은 실시간 진행 신호이고 저장 대상이 아니다. `NodeExecution.outputData` 는 위 표대로 턴 경계에서만 저장되고 사용자 발화의 저장 정합은 턴이 끝날 때의 `execution.ai_message` 스냅샷(`output.result.messages`)이 보장한다. "재개 전용 WebSocket 이벤트를 새로 만들지 않는다" 는 원칙은 이미 `node.*` 이벤트로 알 수 있는 재개 사실을 다시 알리는 이벤트(`resumed_after_restart`)를 기각한 것이다. 발화 내용을 싣는 이벤트가 따로 없던 이 신호에는 해당하지 않는다([장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md)).

## 재실행과 조회 정책

저장된 실행 기록을 다시 쓰는 시나리오의 정책이다. 뜻이 다른 모드를 나눠 정한다. 한쪽은 외부 부수 효과가 없고 다른 쪽은 새 실행으로 부수 효과를 다시 일으킨다.

| 모드 | 뜻 | 구현 상태 | 외부 부수 효과 | 표현식 평가 |
| --- | --- | --- | --- | --- |
| 조회(View) | 실행 내역 조회. `NodeExecution.outputData` 를 그대로 보인다 | ✅ 구현됨(실행 내역 화면) | ❌ 없음 | ❌ 없음 |
| 재실행(Re-run) | 새 실행 시작. 현재 워크플로우 정의의 원본 설정을 다시 평가한다 | ✅ 정의됨([재실행](CLE-EXEC-RERUN.md)) | ✅ 다시 일으킨다(이메일 재발송, HTTP 재호출 등). dry-run 으로 건너뛸 수 있다 | ✅ `$now`·`random()` 등을 새 실행 시점으로 다시 고정 |
| 멀티턴 재개 | 같은 실행의 다음 턴 진행. `state.rawConfig` 고정 스냅샷을 쓰고 고정 범위는 한 턴이다 | ✅ 구현됨(WebSocket `execution.submit_message`, EIA `interact`) | 해당 노드 한정(`processMultiTurnMessage`) | 해당 노드 한정 |

- **조회와 멀티턴 재개는 재실행이 아니다**. 조회는 지난 기록을 보는 것이고 멀티턴 재개는 진행 중인 실행의 다음 턴이다.
- **재실행은 새 실행 행을 만든다**. 기존 행의 입력을 복사할 수 있지만 결과는 현재 워크플로우 정의, 현재 시각, 외부 응답에 따라 달라진다.
- 재실행의 부수 효과 가드(확인 모달과 dry-run 토글)와 dry-run 정의는 [재실행](CLE-EXEC-RERUN.md) 이 정한다.

원본 설정 노출 이전의 옛 노드 실행 행:

- 옛 행의 `outputData.config` 는 표현식 **평가 후** 모양이다(예: `{ subject: "Hello Alice" }`). 새 행은 평가 **전** 모양이다(예: `{ subject: "Hello {{ name }}" }`).
- 소급 변환하지 않고 지난 기록으로 보존한다.
- 표현식 컨텍스트는 다른 실행을 참조하지 않는다(실행마다 자기 노드 출력 캐시만 쓴다). 그래서 옛 행의 차이는 **화면 표시 차이뿐**이고 실행 동작에는 영향이 없다.
- 조회는 best-effort 다. 옛 실행의 Send Email·HTTP Request 는 새 `output.{subject, body, requestBody, responseHeaders, bodyTruncated}` 필드가 없을 수 있다.

## 미결 사항

- **`ExecutionContext.triggerData` 의 분류**: [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 의 Rationale 은 `triggerData` 를 어떤 노드 핸들러도 직접 읽지 않는 resolver 전용 원천이라고 설명한다. 이 규약의 규칙 4 와 결정 표는 핸들러가 읽지 않는 필드를 `_` 접두 엔진 내부 필드로 두라고 하고 규칙 3 은 새 필드의 분류 근거를 이 문서에 적으라고 한다. 현재 코드의 필드 이름은 접두 없는 `triggerData` 이고 이 규약과 컨텍스트 구조 표 어디에도 기록이 없다. `triggerData` 를 규칙 4 의 예외로 등재할지, `_triggerData` 로 바꿀지 결정해야 한다. 같은 결정이 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md#미결-사항) 의 미결 사항에도 올라 있다. 결정하면 분류 근거는 규칙 3 에 따라 이 문서에 적는다.

## 구현 위치

- `codebase/backend/src/nodes/core/node-handler.interface.ts` (`ExecutionContext`, `ParallelBranchContext`)
- `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts`
- `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts`
- `codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts`
- `codebase/backend/src/modules/executions/utils/execution-trigger.ts` (`deriveExecutionTrigger`)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`execute`, park 저장)
- `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts` (`loadTriggerParameterSchema`)

## Rationale

### 실행을 시작하는 워크스페이스를 진입 API 의 필수 옵션으로 둔다 (2026-10-05)

[데이터 모델 개요 「참조의 소속」](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 은 요청 본문의 참조 id 를 저장 전에 막는다. 그 전에 저장된 트리거의 `workflow_id`(스케줄은 연결 트리거를 거친다)가 다른 워크스페이스의 워크플로우를 가리키는 행은 남는다. 엔진이 워크플로우를 id 로만 읽어서(`findOneBy({ id })`) 그런 행이 발화하면 다른 워크스페이스의 워크플로우가 실행됐다. 웹훅 호출과 스케줄 «지금 실행» 이 피해자 워크플로우의 실행 행을 만드는 것을 e2e 로 재현했다(NERV Task `CLE-T-XYR067`).

- **엔진 한 곳에서 본다**: 이 Task 에서 대안 둘을 검토했고 엔진 한 곳을 골랐다(사람 결정, 2026-10-05). 하나는 엔진을 두고 저장된 행이 발화하는 네 곳(웹훅 · 채팅 채널 인바운드 · cron 발화 · «지금 실행»)에서 각각 대조하는 안이다. 변경은 작지만 새 진입 경로가 대조를 빠뜨리는 것을 막을 수단이 없다. [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04) 의 「저장된 참조는 읽는 쪽도 다시 만들고 rotate 는 다른 워크스페이스의 행을 덮어쓰지 않는다」 는 두 번째 방어선을 소비 지점 넷의 읽기 관문으로 두었다. 비밀 참조는 소비 지점이 모듈마다 흩어져 있다. 실행은 `execute()` 라는 단일 진입이 있어 한 곳에 모을 수 있다. 다른 하나는 실행 시점 방어 없이 운영 점검 SQL 로 교차 행을 찾아 사람이 정리하는 안이다. 점검과 정리 사이에 행이 계속 발화한다. 엔진이 대조하고 `workspaceId` 를 필수 옵션으로 두면 컴파일러가 호출부 일곱 곳(수동 실행 2, 재실행, «지금 실행», Cron 자동 발화, 웹훅, 채팅 채널 인바운드)과 새 호출부가 값을 빠뜨리지 못하게 한다. 어느 값을 넘길지는 컴파일러가 가르지 못한다. 진입 경로 표가 정하고 리뷰가 본다. 운영 점검은 이 방어선과 함께 둔다([데이터 모델 개요 「저장된 교차 행 점검」](../CLE-PLAT/CLE-PLAT-DATA.md#저장된-교차-행-점검)).
- **선택 옵션으로 두지 않는다**: `workspaceId?` 로 두면 빠뜨린 호출부가 대조 없이 지나간다. 이 옵션의 뜻은 "빠뜨리면 안 된다" 이므로 필수다.
- **없는 워크플로우와 같은 에러다**: 다른 워크스페이스의 워크플로우를 따로 알리면 그 id 의 존재가 드러난다. [데이터 모델 개요 「참조의 소속」](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 의 "없는 id 와 다른 워크스페이스의 id 를 구분하지 않는다" 를 따른다.
- **id 로 읽은 뒤 코드에서 비교한다**: 워크스페이스를 조회 조건에 넣지 않는다. 값이 비어도 조회 예외 대신 거부로 닫힌다. 대가로 호출부 버그로 값이 빈 경우도 «없는 워크플로우» 로 보인다. [데이터 모델 개요 「조회 조건의 null · undefined」](../CLE-PLAT/CLE-PLAT-DATA.md#조회-조건의-null--undefined) 의 방향, [실행 엔진](CLE-EXEC-ENGINE.md) 의 「서브 워크플로우 워크스페이스 격리를 fail-closed 로 바꾼다」 와 같은 방향이다.
- **서브 워크플로우 거부와 다르게 숨긴다**: 서브 워크플로우 호출의 `WORKFLOW_FORBIDDEN_WORKSPACE` 는 그 노드를 설정한 워크스페이스 안의 실행 기록에 남는다. 진입 거부는 웹훅 호출자처럼 워크스페이스 밖으로도 응답이 나간다. 그래서 진입은 없는 워크플로우와 같게 거부한다.
- **Cron 자동 발화는 스케줄의 워크스페이스를 넘긴다**: 잡과 스케줄 조회 조건이 스케줄의 워크스페이스를 쓴다. 트리거의 워크스페이스를 넘기면 스케줄 → 트리거가 교차 행일 때 트리거 쪽 워크플로우가 이 스케줄로 돈다.

### `parentParallelConcurrency` 를 `ParallelBranchContext` 로 나눈다

`parentParallelConcurrency` 는 중첩 Parallel 의 동시 실행 수 곱 상한(결정 #3·G·D)을 위해 바깥 Parallel 이 자식 분기에 넘기는 값이다. Parallel 분기 안에서만 뜻이 있다. `ExecutionContext` 의 선택 필드로 두면 HTTP·AI·DB 등 모든 노드가 상관없는 필드를 보고 같은 방식이 Loop·ForEach 전용 필드로 되풀이되면 God Object 가 쌓인다(코드 리뷰 SUMMARY#11). 별도 인터페이스로 나누면 "이 필드는 Parallel 분기에서만 읽힌다" 를 타입이 강제하고 안정 핵심이 작게 유지된다. 비용은 분기 컨텍스트를 만드는 곳과 쓰는 곳의 타입 좁히기 한 번뿐이다.

### `abortSignal` 은 안정 핵심에 둔다

취소는 한 컨테이너에 한정되지 않고 Parallel `cancel-others-on-fail`, 워크플로우 시간 한도, 사용자 실행 중지, 안전 종료처럼 여러 기능이 함께 쓰는 기반이다. 컨테이너별 인터페이스로 쪼개면 오히려 쓰는 곳마다 타입이 갈린다. 그래서 선택 필드로 안정 핵심에 두고 "모든 노드가 지킬 필요는 없는 best-effort" 라는 동작 계약은 [노드 취소](CLE-EXEC-CANCEL.md) 가 맡는다. 필드 분류와 동작 계약의 기준 문서를 나눈 것이다.

### "선택 필드 늘리기 금지" 는 새 필드에만 적용한다

기존 필드를 한꺼번에 옮기면 운영 핸들러 24개와 엔진 주입부를 넓게 고쳐야 하고 회귀 위험이 따른다. [노드 취소](CLE-EXEC-CANCEL.md) 가 핸들러 시그니처를 바꾸지 않은 이유와 같은 맥락이다. 이 규약의 가치는 앞으로 쌓이는 것을 막는 데 있으므로 새 변경에만 적용한다.

### `_contextKey` 를 엔진 내부 필드로 둔다

컨텍스트의 메모리 Map 키는 어떤 노드 핸들러도 읽지 않는 라우팅 식별자다. 안정 핵심에 넣으면 모든 핸들러에 상관없는 필드가 보인다. `_executedNodes` 처럼 `_` 접두 엔진 내부 필드로 두면 핸들러 표면을 더럽히지 않고 엔진만 참조한다. God Object 우려의 본질은 핸들러가 보는 필드가 커지는 것이므로 핸들러에 보이지 않는 내부 필드에는 해당하지 않는다. 이 결정의 기준은 이 문서이고 [Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) 가 이를 참조한다.

도입 계기는 Background 본문이 부모와 **같은 `executionId` 를 Map 키로 쓰던 것**이다. 먼저 끝난 부모의 `deleteContext(executionId)` 가 fire-and-forget 본문이 쓰던 컨텍스트를 같은 키로 지워 "Execution context not found" 경쟁이 생겼다. `executionId` 는 노드 실행 묶음·WebSocket 채널·권한의 1차 키라 그대로 두고 **메모리 Map 키만** Background 에서 `bg:*` 로 나눴다. 규칙 4 는 핸들러가 읽지 않는 엔진 필드를 위한 **새 갈래를 더한** 것이다. 기존 결정 표의 "다시 검토" 칸은 그대로 남는다.

### 부가 필드를 `ExecutionOptions` 하나로 묶는 안을 기각한다

모든 부가 필드를 `options` 객체 하나로 묶는 안도 검토했다(코드 리뷰 SUMMARY#11 제안). 이 안은 컨테이너별 뜻 차이를 타입으로 나타내지 못하고(`options.parentParallelConcurrency` 가 Parallel 이 아닌 컨텍스트에도 보인다) 선택 필드 늘리기를 객체 안으로 옮길 뿐이다. 컨테이너별 `extends` 분리가 타입 안전성과 책임 경계 모두에서 낫다.

이 기각의 대상은 핸들러에 넣는 `ExecutionContext` 필드 묶음이다. `ExecutionContextService.createContext()` 의 인자를 옵션 객체(`options?: { initialVariables?, recursionDepth?, contextKey?, conversationThread?, ... }`)로 받는 것은 핸들러가 보는 표면과 무관해 이 기각 범위 밖이다(2026-06-03 코드 리뷰 INFO#3).

### `variables.__*` 예약을 세 층으로 강제한다 (2026-07-11)

규칙 5 는 원래 약속일 뿐 강제가 없었다. 강제를 들이며 한 지점만으로는 모자란다는 것이 설계의 핵심이었다. `handler.validate`(사전 검증)는 실행 때만 돌아 잘못된 저장이 실행 직전까지 조용히 지나간다. 두 변수 노드의 이름 필드는 `{{ }}` 표현식 대상이라(`EXPRESSION_EXCLUSIONS` 에 없음) 사전 검증은 **평가 전 원본**만 본다. `name: "{{ $input.x }}"` 가 런타임에 `__workspaceId` 로 평가되면 원본 검사를 피한다. 그래서 저장 시점(L0, 바로 400), 사전 검증(L1, 안전망), 런타임 평가 뒤(L2, 실질 강제)의 세 층을 둔다. L2 가 없으면 강제가 성립하지 않는다.

### 호환이 깨지는 변경을 받아들인다

이 강제로 `__foo` 변수를 쓰던 기존 워크플로우는 저장(L0)에서 400 이 나거나 실행(L2)에서 실패한다. 그러나 그런 변수는 이미 반쯤 깨져 있었다. park 저장의 `filterUserVariables` 가 `__*` 를 **관찰할 수 없게 버려** 재개 뒤 조용히 사라졌다. 변수 선언 노드가 일부러 택한 조용한 건너뛰기·대체(`meta.skipped`·`meta.coercionWarnings` 로 **관찰할 수 있음**)와는 다른 종류의 침묵이다. 관찰할 수 있는 침묵은 두고 관찰할 수 없는 침묵(park 에서 버림)은 명시적 실패로 바꾼다. 조용한 데이터 손실보다 명시적 실패가 낫다.

### Code 노드는 강제 범위 밖에 둔다

Code 노드는 `$vars` 를 통째로 바꿔 넣으므로 사용자 코드가 `$vars.__workspaceId` 를 쓰면 예약 키를 덮어쓴다. 그러나 임의 코드 실행 노드에 변수 이름 허용 목록을 강제하려면 사용자 JS 출력 전체를 살펴 거부해야 해 두 선언형 노드의 필드 검증과 성격이 다르다. 그것은 Code 노드의 격리와 계약을 따로 정해야 하는 문제다. 그래서 이 강제는 사용자가 **폼으로 이름을 직접 적는** 두 노드로 한정하고 Code 노드 경로는 남은 위험으로 그대로 적어 둔다.

### 실행 컨텍스트는 메모리에 두고 durable 은 DB 로 한다 (2026-07-04)

초기 설계는 실행 상태 전반을 Redis 에 두려 했다. 실행 컨텍스트(변수·노드 출력 캐시), 실행 상태, 노드 출력, 워커 heartbeat, 실행 잠금, 우선순위 큐를 각각 Redis 키(`exec:{ws}:…:context`·`:status`·`:output`·`:heartbeat`·`:lock`·`queue:priority`)로 두는 안이었다. **이 설계는 구현되지 않았고** 실제 구조는 다음으로 모였다.

- **실행 컨텍스트는 메모리의 세그먼트 로컬 Map 이다**. park·완료 때 사라지고 재개는 rehydration 이 durable 컬럼(`Execution.conversation_thread`·`user_variables`·`resume_call_stack`), `NodeExecution.outputData`, `execution_node_log` 에서 **DB 로부터 다시 만든다**. Redis 컨텍스트 저장소를 두지 않는 이유는 셋이다.
  - park 해제 모델과 겹친다. park 때 durable 기준은 이미 PostgreSQL 이므로 Redis 사본은 rehydration 원천을 둘로 나눠 기준이 갈리게 한다.
  - 인스턴스 사이 문제는 구조로 이미 풀었다. 시작 큐 작업 ID 중복 제거로 한 실행의 세그먼트는 늘 하나이고 아무 인스턴스나 DB rehydration 으로 재개하며 크래시 재구동도 DB 에서 다시 만든다. 세그먼트 로컬 메모리는 결함이 아니라 의도한 설계다.
  - 노드 출력마다 Redis 를 왕복하는 비용 없이 세그먼트 안에서는 메모리로 처리하고 경계(park·완료)에서만 DB 에 커밋한다.
- 실행 상태는 PostgreSQL `Execution.status` 이고 Redis 사본이 없다. 노드 출력은 `NodeExecution.outputData` 와 순서 기록 `execution_node_log` 다. 워커 heartbeat 는 만들지 않고 BullMQ stalled 검출이 대신한다. 실행 잠금은 재개 진입의 DB 원자 claim 과 부팅 복구의 전역 `exec:recover:lock` 으로 충분하다. 우선순위는 BullMQ 기본 작업 우선순위다.

그래서 저장 전략과 Redis 키 표에서 위 Redis 항목을 빼고 실제 모델로 적었다. 남는 손실은 세그먼트 누적 시간 추적(`segmentStartMs`)이 메모리에 있다는 점이다. 이는 안전 종료 때 누적 시간을 덜 세는 것을 받아들인 결정이고 세그먼트 시작 시각 저장은 확정되지 않은 후속 후보로 남긴다([큐 워커와 동시 실행 제한](CLE-EXEC-WORKER.md), [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md)). 전면적인 Redis 컨텍스트 저장소는 기준이 둘로 갈릴 위험 때문에 채택하지 않는다.

### 멀티턴 설정은 턴마다 새로 만든다 (D3)

턴마다 rehydration 이 `buildRetryReentryState` 로 `node.config` 를 새로 만들므로 park 중 워크플로우 편집이 다음 턴부터 반영된다. 체크포인트에 원본 설정을 저장해 대화 전체를 고정하는 대안은 구현 복잡도를 더하고 최신 정의를 반영하는 편이 더 자연스러워 택하지 않았다. 같은 입력의 재현성이 턴 단위로 약해지는 것은 모든 재개를 rehydration 한 경로로 모으기 위한 trade-off 다. park 해제 결정의 전체 경위는 [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md) 에 있다.
