---
id: "CLE-EXEC-RERUN-DRYRUN"
title: "재실행 — dry-run"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-RERUN"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-RERUN"]
area: "CLE-EXEC"
content_hash: "69f3dcac2608e16e95273bddac169b593d2fdd4fd0c54f5283329ca2debf981a"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "377c57493732967785566d722c57713f398a4583a2b2032d9d5f1598f88de8af"
etag: "sha256-cb32fe729578d1588467040fd78df86e237ee5e15ad14a757c9f3bb1e4a2ef41"
---
## 개요

이 문서는 [재실행](CLE-EXEC-RERUN.md) 의 하위 문서로 dry-run 재실행에서 무엇을 부수효과로 보고 엔진과 노드가 어떻게 모의 출력을 내는지 정한다. AI 에이전트 도구와 LLM 호출은 [재실행 — dry-run 의 AI 에이전트 도구](CLE-EXEC-RERUN-AGENT.md), 실행 행의 `dry_run` 컬럼은 [재실행 — API 와 데이터 모델](CLE-EXEC-RERUN-API.md#dry-run-표시) 이 정한다.

## 부수효과 노드 분류

다음 노드를 **부수효과 노드**로 분류한다. dry-run 에서 외부 호출을 건너뛰는 대상이다. 「건너뛰는 조건」 칸은 요약이고 기준은 [부수효과 판정](#부수효과-판정) 표다.

| 카테고리 | 노드 | 건너뛰는 조건 | `supportsDryRun` |
| --- | --- | --- | --- |
| Integration | [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md) | 외부 호출 | true |
| Integration | [Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md) | 메일 발송 | true |
| Integration | [Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md) | write 작업만. write 판정(쿼리 유형과 SQL 첫 동사 목록)은 노드 문서가 정한다. read(SELECT)는 부수효과가 없어 dry-run 에서도 그대로 호출한다 | true |
| Integration | [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) | GET 이 아니거나 상태를 바꾸는 GET 인 operation. Cafe24 의 예외 목록은 비어 있어 POST·PUT·DELETE 가 대상이다([Cafe24 operation 메타데이터](CLE-C24-META)). GET 은 그대로 호출한다 | true |
| Integration | [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) | GET 이 아니거나 상태를 바꾸는 GET 인 operation. MakeShop Shop API 는 GET·POST 만 쓰므로 POST 와 예외 목록의 GET 이 대상이다([MakeShop operation 메타데이터](CLE-MKS-META)). 나머지 GET 은 그대로 호출한다 | true |
| Trigger 외부 발신 | 해당 없음(v1 트리거는 모두 수신 쪽이다) | 없음 | 없음 |

다음은 **내부 부수효과가 없다**고 보고 dry-run 에서도 그대로 실행한다.

- Logic, Flow, Data, AI(LLM 호출은 외부지만 워크플로우 결과 재현에 필요하다, [LLM 호출](CLE-EXEC-RERUN-AGENT.md#llm-호출)), Presentation(UI 렌더), Trigger(이미 발화된 뒤의 재실행이라 트리거는 다시 발화하지 않는다)

AI 에이전트 노드 자체는 그대로 실행한다. 이 노드가 부르는 도구는 부수효과 판정 기준으로 모의 응답을 받거나 그대로 호출된다([재실행 — dry-run 의 AI 에이전트 도구](CLE-EXEC-RERUN-AGENT.md)).

분류 기준은 노드 메타 `category`([노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md))와 노드별 boolean 메타 `supportsDryRun` 이다. `supportsDryRun` 은 노드가 모의 출력을 낼 수 있는지를 나타내는 노드 단위 값이다(노드 스키마 필드, `nodes/core/node-component.interface.ts`). 모든 부수효과 노드는 v1 에서 `supportsDryRun: true` 를 기본으로 제공하고 각 핸들러가 모의 출력을 돌려줄 수 있어야 한다. 현재 구현에서 `supportsDryRun: true` 를 선언한 노드 스키마는 위 다섯 노드뿐이다(각 노드의 `*.schema.ts`). 위 표의 노드 목록은 이 메타에서 나온다. 부수효과 노드를 새로 더하면 이 표도 함께 고친다.

모달의 부수효과 노드 수(화면 문구 "외부 호출 노드 N개")와 사전 점검(`assertDryRunSupported`)도 이 메타만 본다. AI 에이전트 도구의 판정은 호출마다 따로 하고 이 메타와 무관하므로 모달 집계에 들지 않는다([미결 사항](CLE-EXEC-RERUN.md#미결-사항)).

## 부수효과 판정

dry-run 이 모의 출력 · 응답으로 대신할 호출을 고르는 기준이다. 부수효과 노드와 AI 에이전트 도구가 이 표 하나를 기준으로 쓴다. 노드가 실제 호출 대신 돌려주는 결과를 **모의 출력**, 도구가 돌려주는 결과를 **모의 응답**이라 부른다. 「부수효과 도구」 는 이 기준에서 부수효과로 판정된 AI 에이전트 도구를 말한다.

| 호출 | 부수효과로 보는 조건 | 판정 근거 |
| --- | --- | --- |
| HTTP Request · Send Email 노드 | 늘 | 노드 종류 |
| Database Query 노드 | write 작업. 판정이 모호한 쿼리는 읽기로 본다 | 노드 문서의 write 판정 |
| Cafe24 · MakeShop operation(노드와 내부 MCP 브리지 도구) | HTTP 메서드가 GET 이 아니거나, 메서드는 GET 인데 상태를 바꾸는 GET 예외 목록에 있다 | operation 메타데이터의 `method` 와 예외 목록 |
| 외부 MCP 서버의 도구(`tools/call`) | 늘 | 무엇을 하는지 판정할 수 없어 부수효과로 본다 |
| MCP 메타 도구 · `kb_*` · `render_*` · `cond_*` | 보지 않는다(그대로 실행) | 프로토콜상 읽기 전용이거나 외부 시스템에 닿지 않는다. `cond_*` 는 그래프 분기만 고른다 |
| 도구 목록 구성(`buildTools`)의 목록 조회 · 만료 통합 토큰 갱신, 실제로 부른 GET 의 토큰 갱신 · 인증 실패 처리 | 보지 않는다(그대로 실행) | 통합을 유지하는 작업이고 업무 데이터를 외부에 쓰지 않는다([MCP 클라이언트 「도구 목록 구성 단계」](../CLE-INT/CLE-INT-MCP.md#도구-목록-구성-단계)) |

- Cafe24 · MakeShop 은 operation 메타데이터의 `method` 로 판정한다([Cafe24 operation 메타데이터](CLE-C24-META), [MakeShop operation 메타데이터](CLE-MKS-META)). `scopeType` 은 OAuth 권한 범위라 쓰지 않는다. 예를 들어 Cafe24 `carts_setting_update` 는 `scopeType: read` 인 PUT 이고 부수효과로 판정된다.
- 상태를 바꾸는 GET 예외 목록은 2026-10-23 에 두 카탈로그의 GET operation 을 모두 확인해 정했다. MakeShop `get-cart_free_config-update`(카트프리 설정 변경) 하나이고 Cafe24 에는 없다. 메타데이터를 다시 생성할 때 id · path 에 쓰기를 뜻하는 낱말이 있는 GET 이 새로 생기면 단위 테스트(`dry-run-state-changing-get.spec.ts`)가 막는다. Cafe24 에 그런 GET 이 생기면 MakeShop 의 `MAKESHOP_STATE_CHANGING_GET_OPERATION_IDS` 와 짝이 되는 Cafe24 목록을 둔다.
- 읽기 의도인 POST(예: MakeShop `post-cpik_member-check` 회원 연동 확인)도 메서드로 판정하므로 모의 응답을 받는다. 재현 충실도보다 안전을 고른 보수적 결과다.
- 외부 MCP 서버가 도구에 붙인 annotation(`readOnlyHint` 등)은 판정에 쓰지 않는다.
- 판정할 근거가 없으면 부수효과로 본다. 틀렸을 때 비용이 큰 쪽(외부 상태가 바뀌는 쪽)을 막는 것이다. Database Query 노드만 예외로 모호한 쿼리를 읽기로 본다(노드가 직접 파싱한 SQL 이 근거인 기존 규칙).
- Cafe24 · MakeShop 노드 핸들러와 내부 MCP 브리지 도구 프로바이더는 같은 판정 함수(`nodes/core/dry-run.util.ts` 의 `isDryRunMockedOperation`)를 쓴다.
- 모의 출력 · 응답으로 대신한 호출은 외부로 나가지 않았으므로 통합 활동 로그를 남기지 않는다. 실제로 부른 읽기 호출은 평소처럼 남긴다. 이 규칙의 기준은 이 문서다. 다른 문서에 이 예외를 적는 일은 [미결 사항](CLE-EXEC-RERUN.md#미결-사항) 에 있다.

판정 기준의 근거는 [재실행 — dry-run 의 AI 에이전트 도구](CLE-EXEC-RERUN-AGENT.md#dry-run-에서-부수효과-도구만-모의-응답으로-대신한다-2026-10-23) 에 있다.

## 동작

엔진은 `createContext` 때 실행 컨텍스트의 런타임 변수로 `variables.__dryRun: boolean` 을 넣는다. `__workspaceId` 같은 시스템 예약 변수와 같은 `__` 접두 규칙이다([실행 컨텍스트](CLE-EXEC-CONTEXT.md)). 값은 실행 행의 `dry_run` 컬럼([dry-run 표시](CLE-EXEC-RERUN-API.md#dry-run-표시))에서 오고 입력 대기 뒤 rehydration 에서도 똑같이 복원된다. 핸들러는 `context.variables.__dryRun === true` 로 나눈다. 공통 헬퍼 `nodes/core/dry-run.util.ts` 의 `isDryRun(context)`·`buildDryRunMock(kind, wouldHaveCalled)` 를 쓴다.

- 핸들러가 `isDryRun(context)` 이고 자기 노드가 부수효과 노드면:
  - 외부 호출을 **하지 않는다**.
  - 모의 객체를 노드 출력의 `output` 값으로 돌려준다.

    ```json
    {
      "_dryRun": true,
      "skippedReason": "dry-run mode",
      "wouldHaveCalled": {
        "kind": "http_request",
        "method": "POST",
        "url": "https://api.example.com/users",
        "bodyPreview": "..."
      }
    }
    ```

  - 노드 실행 상태는 `completed` 다(건너뜀이 아니다, 흐름은 정상으로 진행). 노드 실행 행의 `outputData.output` 에 이 모의 객체를 그대로 저장한다. 그래서 판정 키는 `outputData.output._dryRun` 이다.
- 부수효과 노드인데 `supportsDryRun !== true` 인 노드가 워크플로우나 그 워크플로우가 부르는 서브 워크플로우에 하나라도 있으면 재실행 서비스가 들어가기 전 사전 점검(`assertDryRunSupported`)에서 `RERUN_DRY_RUN_NOT_APPLICABLE`(400)로 재실행 전체를 거부한다. 권장 UX 는 모달 단계에서 미리 찾아 dry-run 토글을 비활성화하고 툴팁으로 안내하는 것이다. v1 의 부수효과 노드는 모두 `supportsDryRun: true` 라 정상 워크플로우는 통과한다.
  - 사전 점검은 재실행할 워크플로우에서 시작한다. 워크플로우 호출 노드(동기 · 비동기 모두)가 가리키는 워크플로우를 너비 우선으로 따라가며 모든 노드를 본다. 서브 워크플로우 자식 실행도 dry-run 을 이어받기 때문이다([서브 워크플로우와 Background 본문](#서브-워크플로우와-background-본문)).
  - 이미 본 워크플로우는 다시 보지 않는다(순환 가드). 깊이 한도는 서브 워크플로우 재귀 한도와 같은 10 이다. 그보다 깊은 호출은 실행 때 재귀 한도로 실패한다.
  - 대상 `workflowId` 가 표현식이면 실행 전에는 대상을 알 수 없어 보지 않는다. 다른 워크스페이스의 워크플로우도 보지 않는다. 그런 호출은 엔진이 실행 때 막는다.
  - 모달의 토글 판정은 재실행할 워크플로우의 노드만 본다. 서브 워크플로우에만 있는 미지원 노드는 재실행을 요청할 때 서버가 거부한다.

## 서브 워크플로우와 Background 본문

dry-run 실행이 시작한 서브 워크플로우와 Background 본문도 dry-run 으로 실행한다. 부모가 dry-run 이 아니면 이 경로들도 dry-run 이 아니다.

| 경로 | dry-run 을 이어받는 방법 |
| --- | --- |
| 비동기 서브 워크플로우(`executeAsync`) | [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) 가 `dryRun: isDryRun(context)` 를 엔진에 넘긴다. 엔진은 이 값을 자식 실행 행의 `dry_run` 에 남긴다. 자식 실행은 [동작](#동작) 의 규칙대로 이 컬럼에서 `variables.__dryRun` 을 만든다. 입력 대기 뒤 rehydration 에서도 같다 |
| 동기 서브 워크플로우(`executeInline`) | 부모 실행 컨텍스트를 같이 쓰므로 `variables.__dryRun` 이 그대로 있다 |
| Background 본문 | 본문을 큐에 넣을 때 `context.variables` 를 통째로 복사하므로 `__dryRun` 도 함께 실린다 |

그래서 자식 실행 안에서도 부모와 같은 [부수효과 판정](#부수효과-판정) 으로 모의 출력 · 응답을 낸다. 비동기 자식 실행은 자기 실행 행에 `dry_run` 이 남아 실행 상세 화면에서도 배지가 붙는다([결과 표시](#결과-표시)).

사전 점검도 같은 범위를 본다([동작](#동작)).

## 결과 표시

실행 결과 드로어와 실행 상세 화면은 dry-run 으로 실행된 노드 실행을 눈에 띄게 구분한다.

- 노드 카드에 `🧪 dry-run` 배지를 단다.
- 노드 출력의 `output` 에 `_dryRun: true` 가 있으면(`outputData.output._dryRun`) 출력을 자동으로 강조한다.
- 체인 배지에도 "dry-run" 을 붙인다(`#3-th re-run · dry-run`).

**배지 판정 범위**: `_dryRun` 표시는 실제로 모의 처리한 노드(`supportsDryRun` 부수효과 노드)의 출력에만 들어간다. 그래서 **실행 상세 화면**은 노드별 `_dryRun` 표시에 더해 실행 수준의 **`Execution.dry_run`** 도 함께 반영한다. 표시가 없는 비부수효과 노드(Logic·Flow·Data·AI 등)도 dry-run 실행에 속하면 배지를 단다. "이 실행 전체가 dry-run 이었다" 를 개별 노드 상세에서도 알 수 있게 하려는 것이다. **에디터 실행 결과 드로어**는 실행 수준 플래그를 받지 않아 노드 표시로만 판정한다. 두 화면의 차이는 의도한 비대칭이다.

## 구현 위치

- `codebase/backend/src/nodes/core/dry-run.util.ts` (`isDryRun`, `buildDryRunMock`, 부수효과 판정 `isDryRunMockedOperation`)
- `codebase/backend/src/nodes/integration/makeshop/metadata/index.ts` (상태를 바꾸는 GET 예외 목록 `MAKESHOP_STATE_CHANGING_GET_OPERATION_IDS`)
- `codebase/backend/src/nodes/integration/dry-run-state-changing-get.spec.ts` (예외 목록 누락 감지)
- `codebase/backend/src/modules/executions/executions.service.ts` (`assertDryRunSupported`. 사전 점검은 서브 워크플로우까지 너비 우선으로 본다)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`executeAsync` 가 자식 실행 행에 남기는 `dry_run`)
- `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` (비동기 호출에 `dryRun: isDryRun(context)` 를 넘긴다)
- `codebase/backend/src/nodes/core/workflow-executor.interface.ts` (`executeAsync` 옵션의 `dryRun`)
- `codebase/backend/test/re-run.e2e-spec.ts` (dry-run 재실행이 시작한 비동기 서브 워크플로우 자식 실행 행의 `dry_run`)

## Rationale

### 비동기 서브 워크플로우 자식도 dry-run 을 이어받는다 (2026-11-12, CLE-T-Y2F1NG)

**문제**: dry-run 여부는 실행 컨텍스트의 `variables.__dryRun` 과 실행 행의 `dry_run` 으로만 전해졌다. 비동기 서브 워크플로우로 시작한 자식 실행은 별도 실행 행이라 이 값을 받지 못했다. 그래서 dry-run 재실행이어도 자식 실행 안의 부수효과 노드와 AI 에이전트 도구가 외부를 그대로 불렀다. 2026-10-10 임시 가드 이전부터 있던 차이다. 동기 서브 워크플로우와 Background 본문이 값을 물려받는지도 확인되지 않았다.

**결정**: 2026-11-12 에 사람이 아래 셋 가운데 A 를 골랐다(NERV 질문 `01a1d022-4046-7267-af17-2519fc2b6cc1`).

| 선택지 | 내용 | 결정 |
| --- | --- | --- |
| A | 비동기 자식에 dry-run 을 넘겨 실행 행에 남기고 사전 점검을 서브 워크플로우(동기 · 비동기, 재귀 · 순환 가드)까지 넓힌다 | 채택 |
| B | dry-run 에서는 비동기 자식을 시작하지 않고 모의 출력으로 대신한다 | 기각. 자식 워크플로우의 흐름을 검증할 수 없다 |
| C | 지금처럼 자식은 실제로 실행한다 | 기각. dry-run 인데 실제 부수효과가 난다 |

**A 를 고른 이유**: dry-run 은 외부 호출 없이 흐름만 보려고 켜는 안전장치다. 자식 실행도 부모와 같은 규칙으로 모의 출력 · 응답을 받으면 흐름 전체를 검증하면서 외부 상태는 바꾸지 않는다. 값을 자식 실행 행의 `dry_run` 에 남기면 부모와 같은 경로(`createContext` 와 rehydration)로 `__dryRun` 을 만들어 입력 대기 뒤에도 유지되고 배지도 붙는다.

**사전 점검을 넓힌 이유**: 자식 실행이 dry-run 으로 돌면 자식 워크플로우의 부수효과 노드도 모의 출력을 낼 수 있어야 한다. 그래서 안전하게 dry-run 할 수 없으면 재실행 전체를 거부한다는 원칙을 서브 워크플로우까지 적용했다. 동기 서브 워크플로우는 원래 dry-run 이 이어졌는데 사전 점검은 그 대상을 보지 않았으므로 동기 · 비동기를 함께 본다. 서브 워크플로우는 자기 자신이나 앞 워크플로우를 다시 부를 수 있어 순환 가드를 두고, 재귀 한도 10 보다 깊은 호출은 실행 때 실패하므로 볼 필요가 없다.

**확인만 한 경로**: 동기 서브 워크플로우와 Background 본문은 원래 dry-run 을 이어받았다. 테스트로 고정만 했다.

**남은 한계**: 표현식 대상 호출과 모달 판정의 범위 한계([동작](#동작))가 남는다. v1 의 부수효과 노드는 모두 `supportsDryRun: true` 라 지금은 이 한계로 실제 호출이 나가지 않는다. `supportsDryRun` 이 true 가 아닌 부수효과 노드가 생기면 이 한계를 다시 본다.

**기존 워크플로우 영향**: dry-run 재실행이 비동기 서브 워크플로우를 부르면 이제 자식 실행이 외부를 부르지 않는다. 일반 실행과 dry-run 을 끈 재실행은 바뀌지 않는다.
