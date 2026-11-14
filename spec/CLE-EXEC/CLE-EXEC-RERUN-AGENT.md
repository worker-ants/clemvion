---
id: "CLE-EXEC-RERUN-AGENT"
title: "재실행 — dry-run 의 AI 에이전트 도구"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-RERUN"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-RERUN"]
area: "CLE-EXEC"
content_hash: "74eca6b71826acfdec5d39236a8904c199c4e480cc9df3618acd00d9b4d986b3"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "d66839071885ffe9162dd906c0b53eeee126321e2785b8eea5f628847aea55a2"
etag: "sha256-9cf5d72154812b626bd60cd9ce83ad924de529fe2f068c97cfeb48d483495081"
---
## 개요

이 문서는 [재실행](CLE-EXEC-RERUN.md) 의 하위 문서로 dry-run 재실행에서 AI 노드의 LLM 호출과 AI 에이전트가 부르는 도구를 어떻게 다루는지 정한다. 부수효과 기준은 [부수효과 판정](CLE-EXEC-RERUN-DRYRUN.md#부수효과-판정) 이다.

## LLM 호출

AI 노드(AI 에이전트, 텍스트 분류기, 정보 추출기)의 LLM 호출은 외부 호출이지만 dry-run 에서도 **그대로 한다**.

- LLM 응답이 하류 분기 결정에 바로 쓰인다(예: AI 에이전트의 도구 선택, 텍스트 분류기의 카테고리).
- LLM 호출은 보통 부수효과가 아니다. 응답을 받을 뿐 외부 시스템 상태를 바꾸지 않는다.

**도구 호출**: AI 에이전트가 부르는 도구 가운데 부수효과 도구는 dry-run 때 외부로 나가지 않고 모의 응답을 받는다. 읽기 도구는 실제로 호출된다. 판정 기준은 [부수효과 판정](CLE-EXEC-RERUN-DRYRUN.md#부수효과-판정) 이다. LLM 에는 모의 결과가 전달되고 LLM 은 그것으로 다음 턴을 진행한다.

AI 에이전트에는 노드를 도구로 연결하는 입력 경로가 없다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md#도구-연결-입력-경로-제거)). 그래서 HTTP Request 노드나 Send Email 노드는 AI 에이전트의 도구가 되지 않는다. AI 에이전트가 외부 시스템에 닿는 도구는 MCP 도구다. 외부 MCP 서버의 도구와 Cafe24 · MakeShop 내부 MCP 브리지의 operation 이 여기에 든다([MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)).

모의 응답은 `success` 상태이고 본문에 `_dryRun: true` 와 `executed: false` 가 있다. 모의 처리한 호출도 `turnDebug[].toolCalls` 에 `success` 로 남고 `maxToolCalls` 에 센다. 결과의 모양, `wouldHaveCalled` 의 필드, 활동 로그와 진단 집계 규칙은 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md#dry-run-재실행) 의 「dry-run 재실행」 절이 정한다.

- **노드와 도구의 확인 순서는 다르다**: 도구 이름 · 인자 검증 실패(`INVALID_TOOL_ARGUMENTS`, `CAFE24_MISSING_FIELDS` 등)와 알 수 없는 도구(`MCP_UNKNOWN_TOOL`, `CAFE24_UNKNOWN_OPERATION` 등)는 도구 프로바이더가 dry-run 확인보다 먼저 판정해 평소대로 보고한다. LLM 이 고칠 수 있는 인자 에러를 dry-run 에서도 똑같이 돌려주려는 것이다. Cafe24 · MakeShop 노드 핸들러는 반대로 dry-run 확인을 필수 필드 검증보다 먼저 해서 필수 필드가 빠진 쓰기 operation 도 모의 출력으로 끝난다. 두 순서는 일부러 다르게 뒀다([Rationale](#dry-run-에서-부수효과-도구만-모의-응답으로-대신한다-2026-10-23)). 외부 MCP 도구의 인자 검증은 JSON 파싱뿐이다(`inputSchema` 검증 미구현, [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md#미결-사항) 의 미결 사항).
- MCP 메타 도구(`list_resources` · `read_resource` · `list_prompts` · `get_prompt`)는 읽기 전용이라 그대로 보낸다. 내장 `kb_*`(지식 저장소 검색)와 `render_*`(표시) 도구도 외부 시스템 상태를 바꾸지 않아 그대로 실행한다.
- 모의 응답 판정은 도구 실행(`execute`) 단계에만 있다. 도구 목록 구성(`buildTools`) 단계의 목록 조회 · 만료 통합 토큰 갱신과 실제로 부른 GET 의 인증 실패 처리(401 토큰 갱신, 403 상태 전환과 알림)는 통합을 유지하는 작업이라 평소처럼 나간다. 동작은 [MCP 클라이언트 「도구 목록 구성 단계」](../CLE-INT/CLE-INT-MCP.md#도구-목록-구성-단계) 가 정하고 결정 근거는 [MCP 클라이언트 Rationale](../CLE-INT/CLE-INT-MCP.md#dry-run-에서도-도구-목록-구성과-인증-처리는-평소처럼-한다-2026-11-13-cle-t-8b66bk) 에 있다.
- 서브 워크플로우 자식 실행에서도 똑같이 동작한다([서브 워크플로우와 Background 본문](CLE-EXEC-RERUN-DRYRUN.md#서브-워크플로우와-background-본문)).

**dry-run 여부를 넘기는 길**: 도구 프로바이더 실행 문맥(`ProviderExecCtx`)의 `dryRun` 으로 넘긴다. 값은 턴마다 다음에서 구한다.

| 턴 | 값의 출처 |
| --- | --- |
| 단일 턴 | `isDryRun(context)`(`variables.__dryRun === true`) |
| 멀티턴 재개 턴 | 엔진이 다시 만든 `_resumeState.dryRun` |
| 마지막 턴 재시도 재진입 | 엔진이 다시 만든 `_resumeState.dryRun` |

멀티턴 첫 진입은 LLM 을 부르지 않아 도구 호출이 없다.

엔진은 `_resumeState` 를 다시 만들 때(`buildRetryReentryState`, 재개와 재시도가 함께 쓴다) `dryRun` 을 AI 재개 체크포인트에서 읽지 않는다. 실행 컨텍스트의 `variables.__dryRun` 에서 다시 구한다. `variables.__dryRun` 은 입력 대기 뒤 `Execution.dry_run` 으로 복원된다([동작](CLE-EXEC-RERUN-DRYRUN.md#동작)). 그래서 값의 출처는 실행 행 하나다. `dryRun` 은 AI 재개 체크포인트에 넣지 않는 컨텍스트 필드 목록(`CREDENTIAL_CONTEXT_FIELDS`)에 들어 있다.

**배지**: 모의 응답의 `_dryRun: true` 는 LLM 에 돌려주는 도구 결과 본문에 있다. AI 에이전트 노드 출력의 `output` 에는 `_dryRun` 이 없다. 그래서 이 노드의 배지는 [결과 표시](CLE-EXEC-RERUN-DRYRUN.md#결과-표시) 의 비부수효과 노드 규칙을 따른다. 한 노드 안에서 모의 응답과 실제 호출이 섞여도 `turnDebug[].toolCalls` 는 둘 다 `success` 다. 둘을 가르는 것은 도구 결과 본문의 `executed: false` 뿐이고 실행 결과 화면은 이를 따로 표시하지 않는다.

## 구현 위치

- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts` (`ProviderExecCtx.dryRun`)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/dry-run-tool-result.ts` (`buildDryRunSkippedToolResult`)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` (외부 MCP 도구는 dry-run 에서 늘 모의 응답)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` (Cafe24 브리지 도구의 dry-run 판정)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts` (MakeShop 브리지 도구의 dry-run 판정)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/dry-run-guard-classification.spec.ts` (도구 프로바이더의 dry-run 분류 등록부)
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (턴마다 `dryRun` 을 도구 프로바이더에 넘긴다)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`buildRetryReentryState` 의 `dryRun` 재유도)
- `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` (`CREDENTIAL_CONTEXT_FIELDS` 의 `dryRun`)

## Rationale

### dry-run 에서 AI 에이전트의 MCP 도구를 막는다 (2026-10-10)

이 절의 임시 가드는 2026-10-23 에 걷었다. 지금 동작과 그 근거는 [아래 절](#dry-run-에서-부수효과-도구만-모의-응답으로-대신한다-2026-10-23) 에 있다. 이 절은 당시 결정의 기록이다.

**문제**: 도구 프로바이더 실행 문맥에 dry-run 표시가 없어 dry-run 재실행에서도 외부 MCP 도구와 Cafe24 · MakeShop 브리지의 쓰기 operation 이 실제로 불렸다. dry-run 을 켠 사용자의 쇼핑몰 데이터가 바뀔 수 있었다. 2026-10-10 에 사람이 아래 셋 가운데서 골랐다.

| 선택지 | 내용 | 결정 |
| --- | --- | --- |
| 1 | 도구 프로바이더에 dry-run 을 넘기고 부수효과 도구에만 모의 응답을 준다 | 목표로 채택했다. 판정 기준과 응답 모양을 정해야 해서 후속 Task CLE-T-G62XJS 로 나눴고 2026-10-23 에 들어갔다 |
| 2 | dry-run 에서 MCP 도구 호출을 막는다 | 1 이 들어갈 때까지 쓰는 임시 가드로 먼저 넣었다(CLE-T-8BX1HK). 2026-10-23 에 1 로 바꾸면서 걷었다 |
| 3 | 문서만 실제 동작에 맞추고 경고한다 | 실제 쇼핑몰 데이터가 바뀌는 위험이 그대로 남아 기각했다 |

**가드 범위**: 가드는 같은 실행 컨텍스트에서 LLM 이 고른 도구 호출의 실행(`execute`) 단계를 막았다. 업무 데이터를 외부 시스템에 쓰는 위험이 가장 큰 경로라서다. 가드 밖에 남은 경로는 셋이었고 모두 가드 이전부터 있던 갭이라 선택지 3 을 기각한 판단과 어긋나지 않는다. (a) 비동기 서브 워크플로우 자식 실행의 dry-run 상속(CLE-T-Y2F1NG)은 2026-11-12 에 해소했다([비동기 서브 워크플로우 자식도 dry-run 을 이어받는다](CLE-EXEC-RERUN-DRYRUN.md#비동기-서브-워크플로우-자식도-dry-run-을-이어받는다-2026-11-12-cle-t-y2f1ng)). (b) 도구 목록 구성(`buildTools`) 단계의 목록 조회와 `expired` 통합의 토큰 갱신(CLE-T-8B66BK)은 2026-11-13 에 평소처럼 두기로 정했다([MCP 클라이언트 Rationale](../CLE-INT/CLE-INT-MCP.md#dry-run-에서도-도구-목록-구성과-인증-처리는-평소처럼-한다-2026-11-13-cle-t-8b66bk)). (c) `persistent` 메모리 추출의 저장(CLE-T-C9GF9F)은 [미결 사항](CLE-EXEC-RERUN.md#미결-사항) 에 있다. (b) · (c) 는 외부 업무 데이터를 쓰지 않는다. 다만 토큰 갱신은 통합 상태를 바꾸고 `agent_memory` 기록은 이후 실행이 회수한다. 2026-10-23 의 모의 응답도 같은 범위에서 동작한다.

**GET 도 막았다**: 임시 가드에는 도구마다 읽기와 쓰기를 가르는 분류가 없어 브리지의 GET operation 도 막혔다. 노드 dry-run 은 Cafe24 · MakeShop 의 GET 을 그대로 부르므로 당시 노드와 도구의 동작이 달랐다. 안전을 위해 재현 충실도를 일시적으로 낮춘 것이고 2026-10-23 에 부수효과 판정이 들어가 풀렸다.

**에러가 아닌 `success` 로 돌려준다**: 에러로 돌려주면 LLM 이 도구 실패로 보고 같은 도구를 다시 부르거나 사용자에게 실패를 알릴 수 있다. 그래서 결과 상태는 `success` 로 두고 본문에 `executed: false` 와 이번 실행에서 다시 부르지 말라는 안내를 넣었다. 이 모양은 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md#render_form-제출-뒤-같은-폼-재호출을-막은-방법) Rationale 의 `render_form` 선례(`ok: true` 와 `message` 안내, 실패로 읽히는 값 기각)를 따랐다. `executed: false` 는 실패 표시가 아니라 이 호출이 외부로 나가지 않았다는 사실을 남겨 실제 결과와 모의 응답을 가르는 값이다. 실패가 아니므로 새 에러 코드는 만들지 않았다. 건너뛴 호출이 활동 로그를 남기지 않는 이유는 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md#dry-run-재실행에서-건너뛴-호출의-기록-2026-10-10) 의 Rationale 에 있다.

**메타 도구와 `kb_*` · `render_*` 는 막지 않는다**: MCP resources · prompts 메타 도구는 MCP 프로토콜이 읽기 전용으로 정한 요청이라 분류 없이도 외부 상태를 바꾸지 않는다. 이 판단은 프로토콜을 지키는 서버를 전제하고 지키지 않는 서버의 부수효과는 막지 않는다. 반면 `tools/call` 은 서버가 무엇을 하는지 알 수 없다. `kb_*` 와 `render_*` 는 외부 시스템에 닿지 않는다.

**재개 · 재진입 턴은 컨텍스트에서 다시 구한다**: 실행 컨텍스트에 묶인 값(워크스페이스 ID, 노드 실행 ID 등)은 AI 재개 체크포인트에 영속하지 않고 엔진이 컨텍스트에서 다시 구한다는 기존 규칙이 있다(`CREDENTIAL_CONTEXT_FIELDS`). dry-run 여부도 실행 행의 `dry_run` 에서 복원되는 컨텍스트 값이라 같은 규칙을 따랐다.

### dry-run 에서 부수효과 도구만 모의 응답으로 대신한다 (2026-10-23)

**결정**: 2026-10-10 에 고른 선택지 1 을 넣고 임시 가드를 걷었다. 노드와 도구가 한 기준([부수효과 판정](CLE-EXEC-RERUN-DRYRUN.md#부수효과-판정))으로 부수효과를 판정한다. 부수효과 도구는 모의 응답을 받고 읽기 도구는 실제로 호출된다. 임시 가드의 요구사항 네 개는 폐기했고 새 요구사항 여섯 개가 대신한다(번호는 [재실행](CLE-EXEC-RERUN.md) 의 요구사항 절).

**HTTP 메서드로 판정한다**: Cafe24 · MakeShop 의 operation 메타데이터는 모든 행에 `method` 가 있고 노드 dry-run 이 이미 이 값으로 GET 을 통과시켰다. 도구도 같은 값을 쓰면 노드와 도구의 판정이 같아진다. 인자 검증 순서의 차이([LLM 호출](#llm-호출))는 남겼다. 노드 쪽 순서는 이번에 바꾸지 않았다.

- **`scopeType` 을 기각했다**: `scopeType` 은 operation 을 부를 때 필요한 OAuth 권한 범위다. Cafe24 `carts_setting_update` 는 `scopeType: read` 인 PUT 이라 이 값으로 가르면 쓰기가 실제로 나간다.
- **메서드만으로는 부족한 곳을 예외 목록으로 막았다**: MakeShop `get-cart_free_config-update` 는 GET 인데 카트프리 설정을 바꾼다. 메서드 판정만 두면 dry-run 에서 설정이 실제로 바뀐다. 2026-10-23 에 두 카탈로그의 GET operation 을 모두 확인해 이 하나를 예외 목록에 넣었다. 목록이 낡지 않도록 id · path 에 쓰기 낱말이 있는 GET 을 예외 목록이나 확인한 조회 목록 중 하나에 올리게 하는 단위 테스트를 뒀다.
- **읽기 의도인 POST 는 모의 처리를 받아들였다**: MakeShop `post-cpik_member-check` 처럼 POST 로 조회하는 operation 도 모의 응답을 받는다. 반대 방향 예외 목록(읽기 POST)을 두면 판단이 하나 더 늘고 틀렸을 때 쓰기가 나간다. 재현 충실도가 조금 떨어지는 쪽을 골랐다.

**외부 MCP 도구는 늘 부수효과로 본다**: `tools/call` 은 서버가 무엇을 하는지 알 수 없다. MCP 도구 annotation 의 `readOnlyHint` 는 서버가 스스로 알리는 힌트이고 MCP 명세도 신뢰할 수 없는 서버의 annotation 을 판정 근거로 쓰지 말라고 한다. dry-run 은 사용자가 외부를 바꾸지 않으려고 켜는 안전장치라 틀렸을 때 비용이 큰 쪽을 막는다. [Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md) 가 모호한 쿼리를 읽기로 보는 것은 노드가 직접 파싱한 SQL 이 근거라서다. 외부 MCP 도구에는 그런 근거가 없어 같은 기본값을 쓰지 않았다. 외부 MCP 도구를 도구별로 나누는 정책(예: 신뢰하는 서버의 allow-list)은 필요해지면 따로 결정한다. 그때까지 읽기 전용 외부 MCP 도구도 dry-run 에서 데이터를 받지 못한다.

**활동 로그를 남기지 않는 쪽으로 맞췄다**: 이전에는 Cafe24 노드 dry-run 이 모의 출력을 내면서 활동 로그를 1건 남겼고 도구 경로는 남기지 않았다. 2026-10-23 에 사람이 «둘 다 남기지 않음» 을 골랐다. 활동 로그는 실제로 나간 외부 호출을 적는 기록이고 통합의 활동 탭과 `lastUsedAt` 이 이 기록에서 나온다. 나가지 않은 호출을 적으면 집계가 부풀고 사용자는 dry-run 이 실제로 무엇을 불렀는지 가를 수 없다. [MCP 클라이언트 Rationale](../CLE-INT/CLE-INT-MCP.md#dry-run-재실행에서-건너뛴-호출의-기록-2026-10-10) 이 적은 이 1건의 목적(활동 탭 추적)은 요구사항 문서에 근거가 없었다. HTTP Request · Send Email · Database Query 노드의 모의 출력은 처음부터(2026-05-31) 활동 로그를 남기지 않았고 Cafe24 · MakeShop 노드만 달랐다. 모의 실행의 추적은 노드 출력의 `_dryRun` 과 도구 결과 본문의 `executed: false` 가 맡는다.

- **기각한 안**: «둘 다 1건 남김» 은 dry-run 표시가 없는 `success` 행이 남고 `lastUsedAt` 이 실제 호출 없이 바뀌어 기각했다. 노드만 남기는 차이를 그대로 두는 안은 같은 dry-run 에서 두 경로의 규칙이 갈려 선택지에 넣지 않았다.
- **다른 문서에 남은 문구**: 활동 로그를 정하는 문서와 용어 사전은 아직 이 예외를 적지 않는다. 그 정리는 CLE-T-M6W7RE 가 맡는다([미결 사항](CLE-EXEC-RERUN.md#미결-사항)).

**모의 응답 안내 문구를 바꿨다**: 임시 가드의 안내는 «외부 시스템을 읽지도 바꾸지도 않았다» 였다. 이제 읽기 도구는 실제로 호출되므로 이 문장은 틀린다. 안내를 «이 호출은 보내지 않았고 아무것도 바뀌지 않았다, 성공한 것으로 보고 이어 가라, 같은 호출을 다시 하지 마라» 로 바꿨다. LLM 이 같은 쓰기를 반복하지 않고 흐름을 끝까지 진행하게 하려는 것이다. `executed: false` 는 `render_form` 선례가 기각한 `rendered: false` 와 모양이 같지만 실제 결과와 모의 응답을 가를 값이 이것뿐이라 두었고, 실패로 읽히는 위험은 status `success` 와 이 안내로 막는다. 실제로 부른 호출의 결과에는 이 키를 붙이지 않는다.

**재실행 창 집계는 따로 정한다**: 재실행 창의 외부 호출 안내(RR-PL-01)에 AI 에이전트 도구를 넣는 일은 화면과 문구를 바꾸는 제품 결정이라 이 결정에 넣지 않았다(CLE-T-5WK8QA). 이 판정이 A4 를 대신하지 않는 이유는 [왜 A5](CLE-EXEC-RERUN-POLICY.md#왜-a5확인-모달과-dry-run-토글인가) 에 있다.
