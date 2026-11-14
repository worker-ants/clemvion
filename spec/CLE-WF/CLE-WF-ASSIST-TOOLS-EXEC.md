---
id: "CLE-WF-ASSIST-TOOLS-EXEC"
title: "AI 어시스턴트 도구 — 실행 조회"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-ASSIST-TOOLS"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-ASSIST-TOOLS"]
area: "CLE-WF"
content_hash: "a991b961f1d628049c0c2d307a605313cc7432e1260703fd58ec3e82f43bbd95"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "415619d3be6137f4444aed98a4368e284814c1309364f027ad188a3e341299b6"
etag: "sha256-ea7b1a6a65bf03e7adacbc14d28b9e0098928e8034ca7edf711a32ffbc3b87b6"
---
## 개요

이 문서는 [AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md) 의 하위 문서로 실행 조회 도구 `get_workflow_executions`·`get_execution_details` 의 조회 범위, 응답 구조, 마스킹, 크기 상한, 에러 코드를 정한다. 두 도구의 인자와 반환 요약은 부모 문서의 [탐색 도구](CLE-WF-ASSIST-TOOLS.md#탐색-도구) 표에 있다.

`get_workflow_executions` 와 `get_execution_details` 는 사용자가 "왜 실행이 실패했어?" 같은 질문을 할 때 실행 결과를 읽어 원인을 진단하고 노드 수정으로 이어 가게 하는 읽기 전용 도구다. 두 도구 모두 `kind='explore'` 이며 계획 전용 턴에서도 쓸 수 있다. 쓰는 순서(목록 → 한 건 상세)는 [AI 어시스턴트 §시스템 프롬프트](CLE-WF-ASSIST.md#시스템-프롬프트)가 LLM 에 가르친다.

## 조회 범위

실행 조회는 세션의 `workflow_id` 에 묶인다. `get_workflow_executions` 는 `workflowId` 인자를 받지 않고 세션 워크플로우의 실행만 돌려준다. `get_execution_details` 는 실행 ID 를 받지만 그 실행이 다음 둘 중 하나여야 한다.

- 현재 워크플로우의 실행
- 그 실행 트리의 직계 자식 실행(부모 실행의 워크플로우 호출 노드가 부른 서브 워크플로우의 자식 `Execution`)

판정 순서는 이렇다.

1. 실행을 ID 로 찾는다. 없으면 `EXECUTION_NOT_FOUND` 다.
2. 실행의 워크스페이스가 세션 워크스페이스와 다르면 `EXECUTION_NOT_FOUND` 와 똑같이 다룬다. 다른 워크스페이스 실행의 존재를 드러내지 않기 위해서다.
3. `execution.workflowId` 가 세션 워크플로우와 같으면 통과한다.
4. 아니면 `execution.parentExecutionId` 가 가리키는 부모를 한 번 조회한다. 부모의 `workflowId` 가 세션 워크플로우와 같으면 통과한다.
5. 둘 다 아니면 `EXECUTION_NOT_IN_SCOPE` 로 거부한다.

다른 워크플로우의 독립 실행을 보려면 사용자가 그 워크플로우의 에디터와 AI 어시스턴트로 옮겨 가야 한다.

## 자식 실행 확장

통과한 실행의 직계 자식(`parentExecutionId` 가 그 실행인 실행)을 모두 조회해 `subExecutions` 에 담는다. 손자 이상(2단계)은 채우지 않는다. 자식 가운데 하나라도 그 아래 서브 워크플로우 실행이 있으면 `subExecutionsTruncatedDepth` 를 싣는다. 더 깊은 실행은 자식 실행 ID 로 따로 조회한다.

## `get_execution_details` 응답 구조

```typescript
interface ExecutionDetailsResponse {
  ok: true;
  execution: {
    id: UUID;
    workflowId: UUID;
    workflowName: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting_for_input';
    startedAt: string;            // ISO 8601
    finishedAt: string | null;    // 진행 중·입력 대기 동안 null
    durationMs: number | null;
    inputData: unknown;           // 마스킹
    outputData: unknown | null;   // 마스킹
    error: unknown | null;        // 마스킹
    parentExecutionId: UUID | null;  // 다른 실행의 서브 워크플로우로 불렸다면 그 부모 ID
    recursionDepth: number;       // 최상위 = 0
  };
  timeline: Array<{
    nodeExecutionId: UUID;
    nodeId: UUID;
    nodeLabel: string;
    nodeType: string;
    // 노드 실행 상태 값은 실행 상태 머신 문서를 따른다
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped' | 'waiting_for_input';
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    inputData: unknown;           // 마스킹
    outputData: unknown | null;   // 마스킹
    error: unknown | null;        // 마스킹
    retryCount: number;
    parentNodeExecutionId: UUID | null;  // 인라인 서브 워크플로우·컨테이너 묶음
  }>;
  subExecutions: Array<{          // 직계 자식 실행(1단계). 2단계 이상은 자식 ID 로 따로 호출
    execution: /* 위 execution 과 같은 필드 */;
    timeline: /* 위 timeline 과 같은 구조 */;
  }>;
  subExecutionsTruncatedDepth?: number;  // 자식 안에 서브 워크플로우가 더 있으면 "N 단계 이후 생략" 신호
  timelineTruncated?: true;              // 이 실행의 timeline 이 500행을 넘어 앞 500행만 담았다. subExecutions[*].timelineTruncated 도 자식별로 같은 뜻
}
```

타임라인 `status` 의 값 집합은 [실행 상태 머신과 대기·재개 §노드 실행 상태](../CLE-EXEC/CLE-EXEC-STATE.md#노드-실행-상태)를 따른다. 조회는 DB 의 상태 값을 그대로 옮기므로 취소된 실행을 조회하면 `cancelled` 가 나온다.

## 마스킹

`inputData`·`outputData`·`error` 는 서버가 두 층을 겹쳐 가린 뒤 돌려준다.

1. 키 이름 기준 `maskSensitiveFields` 를 먼저 적용한다.
2. 그 위에 값 패턴 기준 `deepRedactSecrets` 를 적용한다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)).

두 층을 거친 값은 `"***"` 로 나간다. 객체와 배열은 재귀로 훑는다. 키 이름은 남기므로 어떤 키가 가려졌는지는 응답에서 읽을 수 있다. DB 원문은 그대로 두고 읽는 순간에만 바꾼다. 순서는 키 먼저, 값 나중이다. 순서를 뒤집으면 두 층이 서로의 결과를 지운다. 이 조합은 `redactAssistantFields` 가 맡는다.

- **포맷은 이 도구만의 합성 결과다.** `maskSensitiveFields` 자체의 포맷은 `"****<last4>"` 로 바뀌지 않는다. 같은 유틸을 쓰는 다른 곳(AI 에이전트 노드)은 포맷 면에서 영향을 받지 않는다. 여기서 `"***"` 가 되는 것은 위에 겹친 `deepRedactSecrets` 가 값을 다시 덮기 때문이다. 노드 `config` 의 설정 에코는 응답 마스킹 단계에서만 가린다.
- **가리는 키는 넓어졌다.** 옛 리터럴 목록(`apiKey`, `api_key`, `password`, `token`, `accessToken`, `refreshToken`, `secret`, `clientSecret`, `authorization`)은 접두형 `token` 계열(`csrf_token`, `auth_token`, `session_token`, `csrfToken`)을 통과시켰다. 겹친 층의 `CREDENTIAL_KEY_PATTERN` 이 이 계열을 덮는다. 이 확장은 공유 목록(`DEFAULT_SENSITIVE_KEYS`)을 넓히므로 같은 유틸을 쓰는 다른 곳도 가리는 범위가 넓어진다. 포맷은 그대로이고 대상만 늘었다.
- **남은 빈틈은 그대로 이어받는다.** `deepRedactSecrets` 가 일부러 통과시키는 값은 이 도구에서도 통과한다. 목록은 여기서 다시 적지 않고 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)의 "의도한 잔여 빈틈" 전체를 따른다.

## 페이로드 크기

- `inputData`·`outputData`·`error` 개별 필드에는 크기 상한을 두지 않는다. 목록 → 한 건 상세 순서의 2단계 조회로 LLM 이 폭주를 스스로 피하게 한다.
- 타임라인 행 수는 실행 한 건당 500행으로 제한한다. 루프 노드가 수천 번 돈 실행을 직렬화하다 컨텍스트가 넘치는 것을 막기 위해서다. 넘치면 앞 500행만 담고 `timelineTruncated: true` 를 싣는다. 자식 실행 타임라인도 각각 같은 상한을 쓴다. LLM 은 이 플래그가 켜지면 사용자에게 "앞쪽 500 단계까지만 본 상태" 라고 알린다.
- 한 턴에 큰 페이로드를 세 번 이상 조회하면 [어시스턴트 도구 호출 한도](CLE-WF-ASSIST.md#어시스턴트-도구-호출-한도)에 가까워질 수 있다.

## 진행 중 실행은 스냅샷이다

`running`·`waiting_for_input` 실행을 조회하면 응답을 만드는 시점까지의 부분 상태를 돌려준다. 서비스가 타임라인·자식 실행·2단계 존재 여부를 병렬 쿼리로 모으므로 쿼리 사이에 상태가 바뀌면 세 결과의 시점이 몇 밀리초 어긋날 수 있다. 같은 실행 ID 를 다시 조회하면 어긋남이 풀린다. LLM 도 결과를 "조회 시점 스냅샷" 으로 알고 사용자에게 보고한다.

| `execution.status` | 동작 |
|--------------------|------|
| `completed`, `failed`, `cancelled` | 완결된 타임라인을 돌려준다 |
| `running`, `waiting_for_input` | 지금까지 기록된 부분 타임라인을 돌려준다. 아직 돌지 않은 노드는 빠지고 진행 중인 노드는 `running`·`waiting_for_input` 으로 표시된다. `execution.finishedAt`·`durationMs` 는 `null` 이다 |
| `pending` | 첫 노드도 시작하지 않은 상태다. `timeline` 은 빈 배열이고 `execution` 필드만 채운다 |

실행 중 편집 도구를 거부하는 규칙([AI 어시스턴트 요구사항](CLE-WF-ASSIST.md#요구사항)의 `ASSISTANT_WORKFLOW_RUNNING`, 미구현)은 조회 도구에는 적용하지 않는다. AI 어시스턴트는 실행 중인 워크플로우도 진단 목적으로 조회할 수 있다.

## 에러 코드

| 코드 | 상황 |
|------|------|
| `EXECUTION_NOT_FOUND` | ID 가 없거나 워크스페이스 경계 밖이다 |
| `EXECUTION_NOT_IN_SCOPE` | ID 는 있지만 현재 세션 워크플로우의 실행도, 그 직계 자식 실행도 아니다 |

## 구현 위치

- `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` (실행 조회 도구. 탐색 도구와 같은 서비스)
- `codebase/backend/src/modules/workflow-assistant/tools/redact.ts` (조회 결과 마스킹)

## Rationale

### 실행 조회 도구 도입

AI 어시스턴트가 자동으로 만든 표현식이 분기에서 `null` 로 터지는 일이 있었다. 어시스턴트가 실행 결과를 읽고 원인을 진단해 비슷한 실수를 스스로 고칠 수 있게 하려고 실행 조회 도구를 넣었다.

| 항목 | 결정 | 근거 |
|------|------|------|
| 도구 수 | 2종 (`get_workflow_executions`, `get_execution_details`) | 기존 탐색 도구와 같은 패턴이다. 목록 → 상세 2단계로 토큰을 아낀다 |
| 범위 | 현재 세션 워크플로우의 실행과 그 실행 트리의 직계 자식 실행(1단계) | 사용자가 "서브 워크플로우 노드에서 실행된 건 1 이야 2 야?" 라고 물었다. 실행 트리 관점으로 답했다. 2단계 이상은 따로 호출해 응답 부피를 제어한다 |
| 마스킹 | `maskSensitiveFields` 와 `deepRedactSecrets` 를 겹치고 `"***"` 로 낸다. 원본은 DB 에 둔다 | 채팅 창에 그대로 그려지므로 최소한의 안전 기본값이 필요하다. 2026-08-23 결정으로 키 축만 쓰던 방식에 값 축을 겹쳤다. 키 축만으로는 자유 텍스트 안의 자격 증명을 잡지 못한다 |
| 페이로드 크기 | 필드 크기 상한 없음(마스킹만) | 사용자가 명시적으로 고른 선택이다. 대신 프롬프트가 2단계 패턴을 강제한다 |
| 진행 중·입력 대기 실행 조회 | 허용. 지금까지의 부분 타임라인을 돌려준다 | 실시간 디버깅을 위해서다. 실행 중 편집 거부 규칙은 읽기에 적용하지 않는다 |
| 세션 범위 키 | `session.workflow_id` 에서 자동으로 얻는다. `workflowId` 인자를 받지 않는다 | 범위 경계를 분명히 하고 LLM 이 틀린 `workflowId` 를 추정하지 못하게 한다 |
| 도구 kind | `'explore'` (read-only). 계획 전용 턴에서도 쓸 수 있고 실행 중 거부 규칙도 적용하지 않는다 | 다른 탐색 도구와 맞춘다 |

구현 결정은 다음과 같다.

- **Repository 를 직접 주입했다.** `executions.service.ts` 의 `findById`·`findByWorkflow` 를 어댑터로 감싸지 않은 이유는 셋이다. `ExecutionsService.findById` 는 Nest HTTP 예외 `NotFoundException` 을 던져 tool-result 형태 `{ok: false, error}` 와 맞지 않는다. `findByWorkflow` 는 컨트롤러용 DTO 래퍼(`PaginatedResponseDto`)를 돌려줘 LLM 응답에는 과하다. 기존 `listWorkflows`·`listIntegrations` 도 Repository 직접 주입 패턴이다. 나중에 `ExecutionsService` 에 RBAC 같은 공통 규칙이 들어가면 그때 서비스 주입으로 바꾼다. 이 trade-off 는 `explore-tools.service.ts` 클래스 머리 주석에 적혀 있다.
- i18n 키는 `assistant.exploreExecutionsList`·`assistant.exploreExecutionDetails`·`assistant.executionNotInScope` 다.

열어 둔 주제는 다음과 같다.

- 2단계 이상 서브 워크플로우 확장 화면: 지금은 `subExecutionsTruncatedDepth` 로 신호만 주고 따로 조회한다. 사용자 보고가 쌓이면 선택 인자 `depth?: number` 를 검토한다.
- 진행 중 실행의 부분 타임라인 안정성: WebSocket 스트림과 REST 조회 시점이 엇갈려 같은 실행이 조회할 때마다 다른 타임라인을 낼 수 있다. 지금은 응답을 "조회 시점 스냅샷" 으로 보고 사용자에게 알리게 한다. 실제 사용 중 혼선이 보고되면 시스템 프롬프트에 단락을 더한다.
- `get_workflow_executions` 의 `search`·`dateRange` 옵션: 실행 내역 REST API 가 이미 status·정렬·페이지를 지원하므로 서버 쿼리를 새로 만들지 않고도 늘릴 수 있다. 사용자 요청이 오면 조금씩 더한다.
