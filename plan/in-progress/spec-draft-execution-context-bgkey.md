---
worktree: fix-bg-context-key
started: 2026-05-31
owner: developer
---

# Spec draft — ExecutionContext Map 키 분리 (background race 수정 SoT)

consistency-check --impl-prep(`review/consistency/2026/05/31/22_00_38/SUMMARY.md`, BLOCK:YES)
가 요구한 SoT 선행 갱신. 설계 확정: 엔진 내부 `_contextKey?` 필드(선례 `_executedNodes`/
`_resumeState`/`_retryState`), Map 키 = `contextKey ?? executionId`, background 본문만
`bg:${executionId}:${backgroundRunId||parentNodeExecutionId||'root'}`, executionId 원본 유지.

## 변경 1 — `spec/conventions/execution-context.md`

### §1 원칙 1 (Stable core) 아래 새 분류 단락 추가
> **엔진 내부 인프라 필드 (`_`-prefix, 핸들러 비소비)**: 노드 핸들러가 읽지 않고 엔진 순회/
> 라우팅에만 쓰이는 상태는 `_`-prefix 로 표기해 internal 임을 신호한다. 선례: `_executedNodes`
> (sub-workflow inline 순회), `_resumeState`/`_retryState` (재개/리트라이 continuation).
> 이들은 Stable core(전 노드 공통 소비) 도 container-specific 도 아닌 **엔진 전용** 범주로,
> `node-handler.interface.ts` 에 `_`-prefix optional 로 두되 핸들러 계약 표면에는 포함하지 않는다.

### §2 결정 규칙 표 끝에 행 추가
| 핸들러가 읽지 않고 엔진 순회/라우팅에만 쓰는가? | `_`-prefix 엔진 내부 필드 (`node-handler.interface.ts` optional, 핸들러 계약 비노출) | 재검토 |

### `_contextKey` 항목 명시 (§1 새 단락 내 또는 표 주석)
- `_contextKey?: string` — ExecutionContextService 의 in-memory `Map<key, ExecutionContext>`
  라우팅 키. **기본값 = `executionId`** (비-background context 는 항상 동일 → 동작 불변).
  background 서브그래프 한정으로 `bg:<executionId>:<backgroundRunId>` 형태의 별도 키 사용.
  **in-memory Map 라우팅 전용** — Redis 키 패턴(execution-engine §9.1)과 무관.

### §Rationale 에 결정 추가
> **왜 `_contextKey` 를 엔진 내부 필드로 두는가** — context 의 in-memory Map 키는 어떤 노드
> 핸들러도 소비하지 않는 순수 라우팅 식별자다. Stable core 에 넣으면 전 핸들러에 무관 필드가
> 노출되나, `_`-prefix 엔진 내부 필드(선례 `_executedNodes`)로 두면 핸들러 표면 오염 없이
> 엔진만 참조한다. God Object 우려(원칙 1·3)는 "핸들러가 보는 필드의 비대화" 가 본질이므로
> 핸들러 비노출 internal 필드에는 비해당. background 본문이 부모와 동일 executionId 를 Map
> 키로 공유해 부모 cleanup 이 본문 context 를 삭제하던 race 해소가 목적이며, executionId 자체는
> NodeExecution 그룹핑·WS 채널·권한 1차 키로 원본 유지하고 **Map 키만** 분리한다.

## 변경 2 — `spec/4-nodes/1-logic/12-background.md`

### frontmatter `code:` 에 경로 추가
```
  - codebase/backend/src/modules/execution-engine/**
```
(본문 실행·context 격리 로직이 `executeBackgroundSubgraph`/`scheduleBackgroundBody` 에 있음.)

### §4 격리 컨트랙트 에 항목 추가
> - **Context Map 키 격리**: 본문은 메인과 같은 `executionId` 를 NodeExecution 그룹핑·WS
>   채널용으로 공유하되, in-memory ExecutionContext 는 **별도 키
>   `bg:<executionId>:<backgroundRunId>`** 로 Map 에 등록돼 메인 컨텍스트와 격리된다.
>   `executeBackgroundSubgraph` 가 **자체 finally 로 해당 bgKey context 를 삭제**하며, 이는
>   메인 `runExecution` finally 의 `deleteContext(executionId)` 와 독립적이다.

### §Rationale 에 결정 추가
> ### ExecutionContext Map 키 분리 결정
> background 본문은 fire-and-forget 으로 BullMQ 워커에서 비동기 실행되는데, 부모와 동일한
> `executionId` 를 in-memory context Map 키로 공유했다. 부모 실행이 (대개 본문보다 먼저)
> 종료하며 `deleteContext(executionId)` 를 호출하면 본문이 쓰던 context 가 같은 키로 삭제돼
> 후속 `setNodeOutput` 이 "Execution context not found" 로 실패했다. 해소: 본문은
> `bg:<executionId>:<backgroundRunId>` 별도 Map 키를 쓰고 자체 finally 로 정리한다.
> `executionId` 는 NodeExecution 그룹핑·WS(`execution:<id>`)·권한 1차 키이므로 원본 유지하고
> in-memory Map 키만 분리한다 (스냅샷 격리 §4 와 동일 원칙의 키-레벨 확장).

## 변경 3 — `spec/5-system/4-execution-engine.md`

### §3.3 Background 실행 — "동일 execution_id 공유" 항목 보완
기존:
> - 메인 Execution과 동일한 `execution_id`를 공유. 본문 노드의 `parentNodeExecutionId` 가 …

수정:
> - 메인 Execution과 동일한 `execution_id`를 공유 (NodeExecution 그룹핑·WS 채널·권한 1차 키).
>   단 **in-memory ExecutionContext Map 키만** background 는 별도 `bg:<executionId>:<backgroundRunId>`
>   를 사용해 부모 컨텍스트와 격리하며, `executeBackgroundSubgraph` 가 자체 finally 로 정리한다
>   ([Background §4](../4-nodes/1-logic/12-background.md#4-실행-로직)). 본문 노드의
>   `parentNodeExecutionId` 가 Background 노드 자신의 NodeExecution id 를 가리킨다

### §6.1 컨텍스트 구조 — 필드 표 아래 주석 추가
> **엔진 내부 Map 키 (`_contextKey`)**: ExecutionContextService 의 in-memory
> `Map<key, ExecutionContext>` 라우팅 키. `createContext(executionId, …, contextKey?)` 에서
> Map 키 = `contextKey ?? executionId` — 비-background 호출은 `contextKey` 를 생략해 항상
> `executionId` 와 동일(동작 불변). background 본문만 `bg:<executionId>:<backgroundRunId>` 를
> 전달한다. **이 키는 in-memory 전용** — Redis 키 패턴(§9.1)과 무관하다.

## Rationale (draft 자체 결정 근거)
- 코드 레벨 시그니처(AI 멀티턴 클러스터 `handleAiMessageTurn` 등에 `contextKey` 파라미터
  추가)는 spec 에 박제하지 않는다 — `4-nodes/6-presentation/0-common.md §10.9` 등은 dispatch
  의미만 서술하고 시그니처 SoT 는 `execution-engine.service.ts` 다. 따라서 §10.9 갱신 불요.
- `handleAiTurnError → finalizeAiNode('FAILED')` 원자성 정책은 contextKey 파라미터 추가로
  분기/순서가 바뀌지 않으므로(키는 조회 대상만 지정) 별도 Rationale 불요.
