---
id: "CLE-INT-MCP-DRYRUN"
title: "MCP 클라이언트 — dry-run 재실행"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-MCP"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-MCP"]
area: "CLE-INT"
content_hash: "d3f1507f3a0026815a5dc59424d0df93fca5f478b110e0278d8fc81e8d837535"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "3ae62e361b406490956588ddb22479b5334923f709bd086b2ee9ae84ba2763d5"
etag: "sha256-77371fc807191edce28a6c3a6c4a50e081bec4884be54e504e29ddee5340f12a"
---
## 개요

이 문서는 [MCP 클라이언트](CLE-INT-MCP.md) 의 하위 문서로 dry-run 재실행에서 MCP 도구(외부 MCP 서버 도구와 Cafe24 · MakeShop 내부 MCP 브리지 도구)를 처리하는 도구 프로바이더의 동작과 건너뛴 호출의 결과 형식을 정한다.

## 범위와 판정

[재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) 의 dry-run 재실행에서는 AI 에이전트가 부른 부수효과 도구를 외부로 보내지 않고 모의 응답을 돌려준다. 무엇이 부수효과 도구인지는 [재실행 §부수효과 판정](../CLE-EXEC/CLE-EXEC-RERUN.md#부수효과-판정) 이 단일 기준이다. 읽기 전용 메타 도구(`resources/*` · `prompts/*`)는 그대로 부른다. LLM 호출도 그대로 한다. 정책은 [재실행 §LLM 호출](../CLE-EXEC/CLE-EXEC-RERUN.md#llm-호출) 이 정한다. 이 문서는 모의 응답으로 대신한 호출을 **건너뛴 호출**이라 부른다. 다른 문서의 «모의 응답으로 대신한 호출» 과 같은 말이다.

부수효과 판정은 도구 실행(`execute`) 단계에만 있다. 도구 목록 구성(`buildTools`) 단계는 dry-run 재실행에서도 평소처럼 돈다([도구 목록 구성 단계](#도구-목록-구성-단계)).

부수효과 판정은 서브 워크플로우 자식 실행에서도 똑같이 동작한다. 비동기 서브 워크플로우로 시작한 자식 실행도 부모의 dry-run 을 이어받는다([재실행 §서브 워크플로우와 Background 본문](../CLE-EXEC/CLE-EXEC-RERUN.md#서브-워크플로우와-background-본문)).

| 호출 | dry-run 재실행에서의 처리 |
|------|------|
| 외부 MCP 서버의 일반 도구(`tools/call`) | 서버에 보내지 않는다. 서버가 도구에 붙인 annotation(`readOnlyHint` 등)과 상관없다 |
| 내부 MCP 브리지 operation(Cafe24·MakeShop) 가운데 HTTP 메서드가 GET 이 아니거나 상태를 바꾸는 GET 예외 목록에 있는 것 | API 를 부르지 않는다 |
| 내부 MCP 브리지 operation 가운데 나머지 GET | 평소처럼 API 를 부른다 |
| 메타 도구(`list_resources`·`read_resource`·`list_prompts`·`get_prompt`) | 그대로 부른다 |

## 도구 목록 구성 단계

도구 목록 구성(`buildTools`) 단계는 dry-run 재실행에서도 평소와 똑같이 돈다. 이 단계에서 나가는 호출과 바뀌는 상태는 다음과 같다.

| 프로바이더 | dry-run 재실행에서도 하는 일 |
|------|------|
| 외부 MCP 서버 | 서버마다 connect · `initialize` · `tools/list` 를 보낸다. 서버가 `resources` · `prompts` capability 를 보고하면 `resources/list` · `prompts/list` 도 보낸다([단위](CLE-INT-MCP-CONN.md#단위)) |
| Cafe24 · MakeShop 내부 MCP 브리지 | `expired` 상태 통합의 토큰 갱신을 한 번 시도한다(`tryRecoverExpired` → `refreshTokenViaQueue`). 갱신에 성공하면 저장된 토큰이 바뀌고 통합이 `connected` 로 돌아온다. refresh token 이 거절되면 통합이 `error(auth_failed)` 로 바뀌고 조치 필요 알림이 간다(진단의 `skipReason` 은 `expired_refresh_failed`) |

목록 조회는 읽기 요청이고 토큰 갱신과 인증 실패 표시는 통합 유지 작업이라 [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md#부수효과-판정) 의 부수효과 판정 범위에 넣지 않는다. 도구 실행 단계에서 실제로 부른 GET 의 인증 실패 처리도 같은 이유로 평소와 같다([확인 순서](#확인-순서)). 결정과 근거는 [Rationale](#dry-run-에서도-도구-목록-구성과-인증-처리는-평소처럼-한다-2026-11-13-cle-t-8b66bk) 에 있다.

## 건너뛴 호출의 결과

건너뛴 호출에는 실행하지 않았다는 `tool_result` 를 돌려준다. status 는 `success` 다. 본문은 통합 노드의 dry-run 모의 출력과 같은 모양에 `executed` 와 `message` 를 더한 JSON 이다. LLM 은 이 결과를 받고 다음 판단을 한다. 건너뛴 호출의 결과 형식은 이 절이 단일 기준이다.

```json
{
  "_dryRun": true,
  "skippedReason": "dry-run mode",
  "wouldHaveCalled": {
    "kind": "mcp_tool",
    "integrationId": "uuid-a",
    "server": "filesystem-mcp",
    "tool": "write_file"
  },
  "executed": false,
  "message": "Not executed: this is a dry-run re-run, so this call was not sent and nothing was changed. Continue as if it had succeeded. Do not retry the same call in this run."
}
```

| `wouldHaveCalled.kind` | 대상 | 함께 싣는 필드 |
|------|------|------|
| `mcp_tool` | 외부 MCP 서버 | `integrationId`, `server`(통합 이름), `tool`(서버가 보고한 원래 도구 이름) |
| `cafe24_tool` | Cafe24 내부 MCP 브리지 | `operation`(operation id), `method`(HTTP 메서드), `resource` |
| `makeshop_tool` | MakeShop 내부 MCP 브리지 | `operation`(operation id), `method`(HTTP 메서드), `resource` |

- `skippedReason` 은 통합 노드 dry-run 모의 출력(`dry-run.util.ts` 의 `DryRunMock.skippedReason`)과 같은 필드이고 [진단 누적](CLE-INT-MCP-TOOLS.md#진단-누적-mcpdiagnostics)의 `serverSummaries[].skipReason` 과 무관하다.
- `kind` 끝의 `_tool` 은 통합 노드 dry-run 모의 출력의 `kind`(`cafe24` · `makeshop` 등)와 겹치지 않게 붙인다. 같은 통합이라도 노드의 모의 출력과 AI 에이전트 도구의 건너뛴 호출의 결과를 `kind` 만으로 가를 수 있다.
- 도구 인자 값은 싣지 않는다.
- `message` 는 LLM 이 읽는 안내라 영어로 둔다. 이 호출은 보내지 않았고 아무것도 바뀌지 않았으니 성공한 것으로 보고 이어 가되, 이번 실행에서 같은 호출을 다시 하지 말라는 뜻이다. 이 안내는 그 도구 호출에만 해당한다. 같은 실행에서 실제로 부른 읽기 호출과 도구 목록 구성 단계는 별개다([도구 목록 구성 단계](#도구-목록-구성-단계)). 이 문구는 LLM 에 돌려주는 도구 결과 본문의 일부이고 사용자 화면용 번역 문구가 아니다.
- `executed: false` 가 건너뛴 호출의 결과와 실제로 부른 호출의 결과를 가른다. 도구 프로바이더는 실제로 부른 호출의 결과에 이 필드를 붙이지 않는다. 두 결과 모두 status 는 `success` 다.
- 실패가 아니므로 새 에러 코드를 두지 않는다. `AgentToolResult.mcpErrorDelta` 도 싣지 않는다.

## 확인 순서

dry-run 여부와 부수효과 판정은 외부로 보내기 바로 앞에서 확인한다. 그 앞의 확인에서 걸린 호출은 dry-run 재실행에서도 평소와 같은 에러 결과를 돌려준다. 부수효과가 없다고 판정된 GET 내부 MCP 브리지 operation 은 평소처럼 부르므로 호출 단계 실패도 평소처럼 보고한다. 인증 실패를 받으면 통합 상태도 평소처럼 바뀐다. 만료 1분 전 토큰의 미리 갱신, 401 의 토큰 갱신과 한 번 재시도, 403 의 `error(auth_failed | insufficient_scope)` 전환과 조치 필요 알림이 모두 그대로다([인증 실패 상태 전환](CLE-INT-MCP-ERROR.md#인증-실패-상태-전환)). 노드 dry-run 의 GET 과 같다. 2026-11-13 에 이대로 두기로 정했다([Rationale](#dry-run-에서도-도구-목록-구성과-인증-처리는-평소처럼-한다-2026-11-13-cle-t-8b66bk)).

- 외부 MCP: 활성 세션이 없거나 노출하지 않은 도구 이름이면 `MCP_UNKNOWN_TOOL`, 인자 JSON 파싱에 실패하면 `INVALID_TOOL_ARGUMENTS` 다. 인자가 서버의 `inputSchema` 에 맞는지는 확인하지 않고 건너뛴다.
- Cafe24: 모르는 operation 이면 `CAFE24_UNKNOWN_OPERATION`, 필수 필드가 빠졌거나 제약을 어기면 `CAFE24_MISSING_FIELDS` 다.
- MakeShop: 모르는 operation 이면 `MAKESHOP_UNKNOWN_OPERATION`, 필수 필드가 빠졌거나 경로 자리표시자를 채우지 못하면 `MAKESHOP_MISSING_FIELDS` 다.

## 기록과 집계

- 건너뛴 호출은 [활동 로그](CLE-INT-MCP-ERROR.md#활동-로그)에 남기지 않는다. 통합 노드 dry-run 의 모의 출력도 남기지 않는다([재실행 §부수효과 판정](../CLE-EXEC/CLE-EXEC-RERUN.md#부수효과-판정)). dry-run 재실행에서 실제로 부른 GET 내부 MCP 브리지 operation 은 평소처럼 남긴다. 근거는 [Rationale](#dry-run-에서-실제로-부른-호출과-건너뛴-호출의-기록-2026-10-23) 에 있다.
- 활동 로그의 «호출마다 한 행» 규칙([Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) · [통합 관리](CLE-INT-MANAGE.md) 의 요구사항, [통합 데이터와 흐름](CLE-INT-DATA.md#호출-api-식별-채우기-규칙) 의 「호출 API 식별 채우기 규칙」)에서 «호출» 은 통합 API 로 실제로 나간 호출이다. dry-run 재실행에서 건너뛴 호출과 통합 노드 dry-run 의 모의 출력은 여기에 들지 않는다. 이 규칙의 기준은 [재실행 §부수효과 판정](../CLE-EXEC/CLE-EXEC-RERUN.md#부수효과-판정) 이다. 활동 로그를 정하는 문서들에 dry-run 예외를 적는 일은 [재실행 미결 사항](../CLE-EXEC/CLE-EXEC-RERUN.md#미결-사항) 에 있다.
- 건너뛴 호출은 `mcpDiagnostics.errors[]` 에도 넣지 않는다.
- `mcpDiagnostics.toolCalls` 에는 시도 1회로 센다. 내부 MCP 브리지 도구도 `mcp_` 이름이라 외부 MCP 와 내부 MCP 브리지의 건너뛴 호출을 모두 센다([진단 누적](CLE-INT-MCP-TOOLS.md#진단-누적-mcpdiagnostics)).
- [도구 호출 한도](CLE-INT-MCP-TOOLS.md#도구-호출-한도)(`maxToolCalls`)에도 들어간다.

## dry-run 여부 전달

dry-run 여부는 도구 프로바이더 실행 문맥의 `ProviderExecCtx.dryRun` 으로 들어온다. 턴마다 이 값을 어디서 구하는지는 [재실행 §LLM 호출](../CLE-EXEC/CLE-EXEC-RERUN.md#llm-호출) 의 요구사항과 「dry-run 여부를 넘기는 길」 표가 정한다. 이 문서는 값의 출처를 따로 정하지 않는다.

도구 목록 구성 문맥(`ProviderBuildCtx`)에는 이 값을 두지 않는다. 도구 목록 구성 단계는 dry-run 여부와 상관없이 같게 돈다([도구 목록 구성 단계](#도구-목록-구성-단계)).

## Rationale

### dry-run 재실행에서 건너뛴 호출의 기록 (2026-10-10)

2026-10-10 의 임시 가드는 AI 에이전트가 부른 MCP 도구 가운데 외부 MCP 서버의 `tools/call` 과 내부 MCP 브리지 operation 을 모두 건너뛰었다. 막는 범위와 임시 가드를 둔 배경은 [재실행 Rationale](../CLE-EXEC/CLE-EXEC-RERUN.md#dry-run-에서-ai-에이전트의-mcp-도구를-막는다-2026-10-10) 에 있다. 가드는 실행을 거부하지 않고 노드 dry-run 처럼 모의 결과로 흐름을 이었다. dry-run 을 완전하게 구현한다는 방향([재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) Rationale)은 그대로다. 2026-10-23 에 임시 가드를 부수효과 판정으로 바꿨다. 앞의 두 가지는 그대로 유효하고 셋째는 [아래 절](#dry-run-에서-실제로-부른-호출과-건너뛴-호출의-기록-2026-10-23) 로 바뀌었다.

- **활동 로그와 `errors[]` 에 남기지 않는다.** 활동 로그는 외부 API 호출 기록인데, 건너뛴 호출은 외부로 나가지 않았다. `errors[]` 는 격리된 실패 기록인데, 건너뛴 호출은 실패가 아니다. 그래서 결과의 status 도 `success` 로 두고 새 에러 코드를 만들지 않았다. 실패 모양 대신 status `success` 와 `message` 로 재호출을 막은 것은 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md#render_form-제출-뒤-같은-폼-재호출을-막은-방법) Rationale 의 `render_form` 재호출 방지 선례(`ok: true` 와 재호출 금지 `message`, 실패로 읽힐 `rendered: false` 는 기각)와 같은 이유다. 선례와 달리 `ok: true` 는 싣지 않고 `executed: false` 를 싣는다. 이 값은 건너뛴 호출과 실제로 부른 호출을 가르려고 남겼고, 실패로 읽히는 위험은 status `success` 와 `message` 로 막는다(2026-10-23 에 덧붙였다). `toolCalls` 는 원래 결과를 보지 않고 시도를 세는 카운터라 건너뛴 호출도 그대로 센다.
- **메타 도구는 막지 않는다.** MCP 프로토콜에서 resources·prompts 조회는 읽기 전용이라 외부 상태를 바꾸지 않는다. 프로토콜을 지키는 서버를 전제하며 비준수 서버의 부수효과는 이 가드가 막지 않는다.
- **통합 노드 dry-run 의 활동 로그 규칙과 다르게 둔다(2026-10-23 에 대체).** 당시 [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md#dry-run) · [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md#dry-run) 는 dry-run 모의 출력에도 활동 로그를 1건 남겼다. 당시에는 노드의 1건을 모의 실행을 활동 탭에서 추적하려는 것으로 보았지만 요구사항 문서에는 그 근거가 없었다. AI 에이전트 경로에서는 에이전트의 도구 호출 기록이 그 역할을 한다고 보아 다르게 두었다. `meta.turnDebug[].toolCalls` 에는 건너뛴 호출이 `success` 로 남고, 대화 메시지(`messages`)의 도구 결과에는 `executed: false` 가 든 본문이 남는다. 이 차이는 2026-10-23 에 둘 다 남기지 않는 쪽으로 없앴다([아래 절](#dry-run-에서-실제로-부른-호출과-건너뛴-호출의-기록-2026-10-23)).

### dry-run 에서 실제로 부른 호출과 건너뛴 호출의 기록 (2026-10-23)

[재실행](../CLE-EXEC/CLE-EXEC-RERUN.md#부수효과-판정) 의 부수효과 판정이 들어가면서 dry-run 재실행의 AI 에이전트 도구 호출은 두 가지로 나뉜다. 모의 응답으로 대신한 호출(건너뛴 호출)과 실제로 부른 읽기 호출이다. 판정 기준과 그 근거는 [재실행 Rationale](../CLE-EXEC/CLE-EXEC-RERUN.md#dry-run-에서-부수효과-도구만-모의-응답으로-대신한다-2026-10-23) 에 있다.

- **건너뛴 호출은 노드 경로와 도구 경로 모두 활동 로그에 남기지 않는다.** 2026-10-23 에 사람이 «둘 다 남기지 않음» 을 골랐다(기각한 안은 위 재실행 Rationale). HTTP Request · Send Email · Database Query 노드의 모의 출력은 처음부터 활동 로그를 남기지 않았고 Cafe24 · MakeShop 노드만 달랐다. 이번에 하나로 맞췄다. 활동 로그는 실제로 나간 외부 호출의 기록이고 통합의 활동 탭과 `lastUsedAt` 이 이 기록에서 나온다. 모의 실행은 실행 상세의 노드 출력(`_dryRun`)과 도구 결과 본문(`executed: false`)에서 따로 확인할 수 있다.
- **실제로 부른 읽기 호출은 평소처럼 기록한다.** 외부로 나간 호출이므로 활동 로그에 남기고 호출 단계 실패는 `errors[]` 에 넣는다. dry-run 이라고 따로 표시하지 않는다.
- **`executed: false` 는 건너뛴 호출에만 붙인다.** 한 노드 안에서 건너뛴 호출과 실제로 부른 호출이 섞여도 `turnDebug[].toolCalls` 에서는 둘 다 `success` 다. LLM 과 실행 기록을 읽는 사람이 둘을 가를 수 있는 값은 도구 결과 본문의 이 필드뿐이다.
- **안내 문구를 바꿨다.** 임시 가드의 안내는 «외부 시스템을 읽지도 바꾸지도 않았다» 였다. 읽기 호출이 실제로 나가게 되면서 이 문장은 맞지 않는다. «이 호출은 보내지 않았고 아무것도 바뀌지 않았다, 성공한 것으로 보고 이어 가라, 같은 호출을 다시 하지 마라» 로 바꿨다.

### dry-run 에서도 도구 목록 구성과 인증 처리는 평소처럼 한다 (2026-11-13, CLE-T-8B66BK)

**문제**: 2026-10-23 의 부수효과 판정은 도구 실행(`execute`) 단계에만 들어갔다. 도구 목록 구성(`buildTools`) 단계는 dry-run 재실행에서도 외부 MCP 서버에 목록 요청을 보내고, Cafe24 · MakeShop 브리지는 `expired` 통합의 토큰 갱신을 시도한다. 실제로 부른 GET 도 401 이면 토큰을 갱신하고 403 이면 통합 상태를 바꾼다. 이 동작을 dry-run 에서도 둘지 이전 판의 미결 사항이 추적했다.

**결정**: 2026-11-13 에 사람이 세 항목 모두 지금 동작을 유지하기로 골랐다(NERV 질문 `01a1d2f3-9510-774c-8cc1-adfb0bae76a1`, 답 «1A 2A 3A»).

| 항목 | 고른 안 | 기각한 안 |
| --- | --- | --- |
| 1 외부 MCP 서버 목록 조회 | A 평소처럼 보낸다 | B dry-run 에서 막는다. 외부 MCP 서버 도구를 LLM 에 노출하지 못해 도구 선택을 재현할 수 없다 |
| 2 만료 통합의 토큰 갱신 | A 평소처럼 한 번 시도한다 | B 갱신하지 않고 만료 통합을 도구 목록에서 뺀다(dry-run 전용 `skipReason`). 통합 유지 작업을 막을 이유가 없고, 빼면 도구 목록이 일반 실행과 달라진다 |
| 3 실제로 부른 GET 의 인증 실패 처리 | A 평소처럼 401 토큰 갱신 · 403 상태 전환 · 알림을 한다 | B 호출만 실패로 돌려준다. 만료 직전 토큰도 갱신하지 못해 dry-run 의 GET 이 일반 실행보다 자주 실패한다 |

**근거**: 재실행 원칙(RR-PL-01)이 막는 것은 이메일 재발송이나 외부 데이터 변경 같은 업무 부수효과다. 목록 조회는 MCP 프로토콜의 읽기 요청이다. 토큰 갱신과 인증 실패 표시는 통합을 유지하는 작업이고 다음 일반 실행에서도 똑같이 일어난다. 노드 dry-run 의 GET 은 처음부터 이렇게 동작했고 도구 경로도 2026-10-23(CLE-T-G62XJS)부터 같다. 그래서 도구 목록 구성 문맥(`ProviderBuildCtx`)에 dry-run 값을 넣지 않고 Cafe24 · MakeShop API 클라이언트에도 dry-run 분기를 두지 않는다.

**남는 영향**: dry-run 재실행만 돌려도 통합에 저장된 토큰이 바뀌거나 통합이 `error` 로 바뀌고 알림이 갈 수 있다. 같은 조건이면 일반 실행에서도 생기는 변화다.
