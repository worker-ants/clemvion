---
id: "CLE-EXEC-CONTEXT-TRIGGER"
title: "실행 컨텍스트 — 트리거 입력과 진입 API"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-CONTEXT"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-CONTEXT"]
area: "CLE-EXEC"
content_hash: "9622df6682c7625e24e16daab44d83a9e351ec900d5d2eaed2364c954605139e"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "e9c7a7fe02941c788ca0425720ee3fc46de38ec45904fc2366e1ebc3296912d0"
etag: "sha256-0b529751219e7a896a30a95dbe6dd4ddd479c0c55afc74de2896e39cefe73851"
---
## 개요

이 문서는 [실행 컨텍스트](CLE-EXEC-CONTEXT.md) 의 하위 문서로 엔진 진입 API 의 입력 · 옵션, 실행을 시작하는 워크스페이스 대조, 진입 경로별 호출 값을 정한다.

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
  /** 스케줄·웹훅 트리거 발사 때 트리거 UUID. Execution.trigger_id 컬럼에 저장한다. */
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
| 웹훅 | `HooksService` 가 `body` 를 원천으로 `resolveTriggerParameters` 를 거친다. 실패하면 `400 Bad Request` 를 돌려주고 실행을 만들지 않는다. 성공하면 `{ __triggerSource: 'webhook', parameters, body, headers, query, method }` 와 `{ triggerId: trigger.id, workspaceId: trigger.workspaceId, sourceIp, responseCode: '202' }` 로 부른다 | `trigger_id` 가 채워져 웹훅 |
| 채팅 채널 인바운드 | `HooksService` 의 채팅 채널 분기가 파라미터 해석 없이 `{ __triggerSource: 'webhook', parameters: {}, chatChannel, body, headers, query, method }` 와 `{ triggerId: trigger.id, workspaceId: trigger.workspaceId, sourceIp, responseCode }` 로 부른다. `responseCode` 는 이 요청에 실제로 답하는 HTTP 응답 코드다. 기본은 `'202'` 이고 Discord 컴포넌트(type 3) · 모달 제출(type 5)은 `'200'` 이다([웹훅 §채팅 채널 분기](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#채팅-채널-분기)) | `trigger_id` 가 채워져 웹훅 |
| Cron 자동 발사 | `ScheduleRunnerService.process()` 가 `schedule.parameterValues` 를 제한 컨텍스트(`{ $now, $schedule: { id, cronExpression, timezone } }`)로 표현식 평가한 뒤 `resolveTriggerParameters` 를 거쳐 `{ parameters }` 와 `{ triggerId: schedule.triggerId, workspaceId }` 로 부른다. `workspaceId` 는 스케줄의 워크스페이스이고 트리거의 워크스페이스가 아니다. `$node`·`$input`·`$var` 는 쓸 수 없다 | `trigger_id` 가 채워져 스케줄 |
| 스케줄 "지금 실행" | 사용자가 지금 실행 버튼을 누른 경우 수동 실행과 같이 `{ executedBy: userId, workspaceId }` 로 부른다. `workspaceId` 는 요청의 워크스페이스다 | 수동 실행 |

출처를 가르는 규칙(우선순위와 라벨)은 [실행 내역](CLE-EXEC-HISTORY.md) 이 정한다. 분류 함수는 `deriveExecutionTrigger`(`execution-trigger.ts`)다. 민감 헤더 가리기는 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 이 정한다.

수동 트리거 노드의 출력 모양은 [수동 트리거 노드](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md) 가 정한다. 모든 경로에서 `output.parameters` 를 내고 웹훅 출처일 때만 `output.request: { method, headers, query, body }` 를 더한다. 웹훅 출처는 입력의 `__triggerSource: 'webhook'` 으로 구분한다. 뒤 노드의 표현식에서 `$input.parameters` 와 `$params` 는 같은 값이다.

## 구현 위치

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`execute`)
- `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts` (`loadTriggerParameterSchema`)
- `codebase/backend/src/modules/executions/utils/execution-trigger.ts` (`deriveExecutionTrigger`)

## Rationale

### 실행을 시작하는 워크스페이스를 진입 API 의 필수 옵션으로 둔다 (2026-10-05)

[데이터 모델 개요 「참조의 소속」](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 은 요청 본문의 참조 id 를 저장 전에 막는다. 그 전에 저장된 트리거의 `workflow_id`(스케줄은 연결 트리거를 거친다)가 다른 워크스페이스의 워크플로우를 가리키는 행은 남는다. 엔진이 워크플로우를 id 로만 읽어서(`findOneBy({ id })`) 그런 행이 발사하면 다른 워크스페이스의 워크플로우가 실행됐다. 웹훅 호출과 스케줄 «지금 실행» 이 피해자 워크플로우의 실행 행을 만드는 것을 e2e 로 재현했다.

- **엔진 한 곳에서 본다**: 대안 둘을 검토하고 엔진 한 곳을 골랐다(사람 결정, 2026-10-05). 하나는 엔진을 두고 저장된 행이 발사하는 네 곳(웹훅 · 채팅 채널 인바운드 · Cron 자동 발사 · «지금 실행»)에서 각각 대조하는 안이다. 변경은 작지만 새 진입 경로가 대조를 빠뜨리는 것을 막을 수단이 없다. [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04) 의 「저장된 참조는 읽는 쪽도 다시 만들고 rotate 는 다른 워크스페이스의 행을 덮어쓰지 않는다」 는 두 번째 방어선을 소비 지점 넷의 읽기 관문으로 두었다. 비밀 참조는 소비 지점이 흩어져 있지만 실행은 `execute()` 라는 단일 진입이 있어 한 곳에 모을 수 있다. 다른 하나는 실행 시점 방어 없이 운영 점검 SQL 로 교차 행을 찾아 사람이 정리하는 안이다. 점검과 정리 사이에 행이 계속 발사한다. 엔진이 대조하고 `workspaceId` 를 필수 옵션으로 두면 컴파일러가 호출부 일곱 곳(수동 실행 2, 재실행, «지금 실행», Cron 자동 발사, 웹훅, 채팅 채널 인바운드)과 새 호출부가 값을 빠뜨리지 못하게 한다. 어느 값을 넘길지는 컴파일러가 가르지 못한다. 그 값은 진입 경로 표가 정하고 리뷰와 호출부별 테스트가 본다(e2e `stored-cross-workspace-workflow-refs` 는 웹훅과 «지금 실행» 을 잰다). 넘기는 값을 보는 정적 가드는 두지 않았다. 운영 점검은 이 방어선과 함께 두었다가 2026-10-05 점검이 0 행이어서 걷었다([데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md#저장된-교차-행은-실행-때-한-번-더-막고-운영-점검으로-찾는다-2026-10-05) 의 «점검을 걷었다»). 같은 날 복합 FK 검증(V147) 뒤로는 DB 가 트리거 · 스케줄의 교차 행을 막고 엔진 대조는 FK 를 우회한 쓰기를 막는 방어선으로 남는다([데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md#워크스페이스-범위-참조를-복합-fk-로도-막는다-2026-10-05) 의 «실행 시점 방어선은 남긴다»).
- **선택 옵션으로 두지 않는다**: `workspaceId?` 로 두면 빠뜨린 호출부가 대조 없이 지나간다. 이 옵션의 뜻은 "빠뜨리면 안 된다" 이므로 필수다.
- **없는 워크플로우와 같은 에러다**: 다른 워크스페이스의 워크플로우를 따로 알리면 그 id 의 존재가 드러난다. [데이터 모델 개요 「참조의 소속」](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 의 "없는 id 와 다른 워크스페이스의 id 를 구분하지 않는다" 를 따른다.
- **id 로 읽은 뒤 코드에서 비교한다**: `execute()` 가 워크플로우를 읽는 자리의 결정이다. 워크스페이스를 조회 조건에 넣지 않는다. 값이 비어도 조회 예외 대신 거부로 닫힌다. 대가로 호출부 버그로 값이 빈 경우도 «없는 워크플로우» 로 보인다. [데이터 모델 개요 「조회 조건의 null · undefined」](../CLE-PLAT/CLE-PLAT-DATA.md#조회-조건의-null--undefined) 의 방향, [실행 엔진](CLE-EXEC-ENGINE.md) 의 「서브 워크플로우 워크스페이스 격리를 fail-closed 로 바꾼다」 와 같은 방향이다. 트리거 파라미터 스키마 조회(`loadTriggerParameterSchema`)는 이와 달리 워크스페이스를 조회 조건에 넣는다. 그쪽은 값이 비면 「조회 조건의 null · undefined」 규칙에 따라 예외로 닫힌다.
- **서브 워크플로우 거부와 다르게 숨긴다**: 서브 워크플로우 호출의 `WORKFLOW_FORBIDDEN_WORKSPACE` 는 그 노드를 설정한 워크스페이스 안의 실행 기록에 남는다. 진입 거부는 웹훅 호출자처럼 워크스페이스 밖으로도 응답이 나간다. 그래서 진입은 없는 워크플로우와 같게 거부한다.
- **Cron 자동 발사는 스케줄의 워크스페이스를 넘긴다**: 잡과 스케줄 조회 조건이 스케줄의 워크스페이스를 쓴다. 트리거의 워크스페이스를 넘기면 스케줄 → 트리거가 교차 행일 때 트리거 쪽 워크플로우가 이 스케줄로 돈다. 복합 FK 뒤로는 그런 교차 행이 저장 검사와 DB 제약을 함께 지나친 쓰기(FK 트리거를 끄는 복제 모드 등)에서만 생긴다. 이 대조는 그 경우를 막는 방어선으로 남는다.
