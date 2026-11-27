---
id: "CLE-EXEC-RERUN-UI"
title: "재실행 — 화면"
type: "design"
version: 5
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-RERUN"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-RERUN"]
area: "CLE-EXEC"
content_hash: "5ed6a748f34b3abe9da56f48ac9c38fdae2bbecd125e91520674cfbbbb8c5aee"
read_as: "approved_fallback"
task: "CLE-T-C56GBA"
source_paths: []
mirror_sha256: "7c15eb6f1e93b5744f92b3ab084758849a58ab7bba59632e727fec1167e35697"
etag: "sha256-1e2b983ce21673d0e0551dd27bde0963aa33bc23a13a74f59be0541040e69a37"
---
## 개요

이 문서는 [재실행](CLE-EXEC-RERUN.md) 의 하위 문서로 진입점, 재실행 모달, 마스킹된 입력 처리, 체인 표시, i18n 키를 정한다. 두 진입점 화면의 배치는 [실행 내역](CLE-EXEC-HISTORY.md) 과 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 이 정한다.

## 진입점

| 화면 | 위치 | 권한이 없을 때 |
| --- | --- | --- |
| 실행 상세 화면([실행 내역](CLE-EXEC-HISTORY.md)) | 요약 카드 오른쪽 머리 | 버튼을 비활성화하고 툴팁 "재실행 권한이 없어요 (정책 RR-PL-06)" |
| 실행 결과 드로어([에디터 실행과 디버깅](CLE-EXEC-RUN.md)) | 드로어 머리 오른쪽 | 버튼을 숨긴다(드로어는 워크플로우를 만드는 도중의 화면이라 소음을 줄인다) |

두 진입점 모두 같은 모달을 띄운다. 권한 판정(`canReRun`)은 [RR-PL-06](CLE-EXEC-RERUN-POLICY.md#rr-pl-06-권한-f) 을 따른다.

## 재실행 모달

모달에 무엇이 들어가는지는 [RR-PL-01](CLE-EXEC-RERUN-POLICY.md#rr-pl-01-외부-부수효과-안전장치-a5) 이 정한다. 이 절은 그 요소의 배치와 동작을 정한다.

| 영역 | 위치 | 들어가는 요소 |
| --- | --- | --- |
| 머리 | 위 | 제목 "재실행"(en "Re-run Execution"), 원본 실행(`#1234 · 2026-05-12 14:02:30 · ✅ Completed`) |
| 안내 | 머리 아래 | 안내 문장 "이 워크플로우에는 부수효과 노드가 3개 있어요" 와 그 아래 작은 글씨의 노드별 개수 "Send Email × 1, HTTP Request × 2". MCP 서버를 연결한 AI 에이전트 노드가 있으면 그 아래에 "MCP 서버를 연결한 AI 에이전트 노드 1개" 줄이 붙는다 |
| 입력 데이터 | 가운데 | "원본 입력 그대로 사용 (RR-PL-02)" 토글, 파라미터별 필드(예: `name`, `count`, `extra.flag`) |
| dry-run | 입력 아래 | "dry-run 모드 (부수효과 호출은 모의 처리)" 토글(RR-PL-01). 부수효과 호출만 모의 출력 · 모의 응답으로 대신하고 읽기 호출은 실제로 실행한다([부수효과 판정](CLE-EXEC-RERUN-DRYRUN.md#부수효과-판정)) |
| 버튼 | 아래 | 취소, 재실행 |

| 요소 | 기본값 | 동작 |
| --- | --- | --- |
| 원본 실행 머리 | 없음 | 원본 ID, 시작 시각, 최종 상태를 표시한다. ID 를 누르면 **새 탭**에서 원본 상세를 연다. 실행 상세 화면의 체인 배지 원본 링크는 **같은 탭**이다([실행 내역](CLE-EXEC-HISTORY.md)). 모달은 편집 맥락을 벗어나지 않으려고 새 탭, 체인 배지는 내비게이션이라 같은 탭이다(의도한 구분) |
| 부수효과 노드 안내 | 없음 | 워크플로우의 `supportsDryRun: true` 노드 수를 노드 유형별로 모아 보여 준다(`grouped by node.type`) |
| MCP 서버를 연결한 AI 에이전트 노드 안내 | 없음 | 노드 타입이 `ai_agent` 이고 config 의 `mcpServers` 가 비지 않은 배열이거나 비지 않은 표현식 문자열인 노드를 1개로 센다. 표현식은 평가하지 않고 연결된 것으로 본다. Cafe24 · MakeShop 도구도 `mcpServers` 로 연결하므로(service_type 이 `cafe24` · `makeshop` 인 내부 MCP 도구 제공자) 외부 MCP 서버와 구분하지 않고 센다. 수가 0 이면 이 줄을 보이지 않는다. 부수효과 노드 안내의 수에는 더하지 않는다. 근거는 [Rationale](#재실행-창은-mcp-서버를-연결한-ai-에이전트-노드를-따로-센다) 에 있다 |
| 입력 데이터 폼 | 원본의 `inputData.parameters` | 수동 트리거 parameters 스키마 기반 동적 폼. 필드 라벨과 타입은 워크플로우의 수동 트리거 노드 설정에서 가져온다. **스키마가 없으면**(수동 트리거 노드를 지운 경우 등) 원본 `inputData.parameters` 키를 타입 없는 텍스트 필드로 보여 줘 데이터가 숨지 않게 한다. 타입별 위젯은 string 텍스트, number 숫자, boolean 체크박스, object·array JSON 이다 |
| "원본 입력 그대로 사용" 토글 | 꺼짐(편집 가능) | 켜면 폼이 읽기 전용이 되고 "재실행" 버튼 한 번으로 끝난다. 화면은 토글 상태로 `useOriginalInput` 을 늘 명시해서 보낸다 |
| "dry-run 모드" 토글 | 꺼짐 | 워크플로우에 `supportsDryRun: false` 노드가 있으면 비활성화하고 툴팁 "이 워크플로우에는 dry-run 미지원 노드가 있어요" 를 단다([동작](CLE-EXEC-RERUN-DRYRUN.md#동작)) |
| "재실행" 버튼 | 없음 | 누르면 권한을 확인하고 `POST /api/executions/:id/re-run` 을 부른다. 실행 상세 화면에서는 응답의 새 실행 ID 로 `/w/<slug>/workflows/:workflowId/executions/:newId` 로 이동한다(현재 워크스페이스 slug 기준, [레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md)). 드로어에서는 이동하지 않고 에디터 안에서 새 실행을 지켜본다([에디터 실행과 디버깅](CLE-EXEC-RUN.md)) |
| "취소" 버튼 | 없음 | 모달을 닫고 바꾼 입력을 버린다 |

## 마스킹된 입력 처리

`Execution.inputData` 는 응답 단계에서 마스킹돼 내려온다. 입력 데이터 폼은 원본 `inputData.parameters` 를 미리 채우고 "원본 입력 그대로 사용" 토글의 UI 기본값은 꺼짐이다. 그래서 사용자가 폼을 건드리지 않아도 그 값이 `inputOverride` 로 다시 전송된다. 마스킹 마커가 그대로 다시 가면 리터럴 `'***'` 가 새 실행의 **실제 입력값**이 된다. 가시성이 떨어지는 문제가 아니라 데이터 오염이다. 그래서 모달과 서버가 마커를 막는다.

- **프리필하지 않는다**: 미리 채울 값이 마스킹 마커면 채우지 않고 그 필드를 비운 채 다시 입력하라고 안내한다.
- **제출을 막는다**: 사용자가 그 필드를 채우고 값에 마커가 남아 있지 않고 구조(object·array) 필드면 JSON 파싱에 성공할 때까지 제출을 막는다. 무효 JSON 으로 두면 파싱이 원문 문자열로 돌아가 마커 감지를 비켜 가므로 그 상태도 막는다. 안내만 하고 빈 문자열을 통과시키면 오염 값만 `'***'` 에서 `''` 로 바뀔 뿐이다. 그래서 "다시 입력하게 강제한다" 를 문구대로 구현한다.
- **토글을 켜는 것이 오히려 정답이다**: `useOriginalInput: true` 면 서버가 원본 엔티티를 직접 읽어 마스킹과 상관없이 원문으로 재실행한다. 이때는 차단도 풀린다.
- **서버가 한 번 더 막는다**: 위 차단은 화면 경로에 있어 UI 를 거치지 않는 클라이언트(`curl` 등)는 비켜 갈 수 있다. 그래서 서버가 `inputOverride` 의 값 가운데 마커와 **정확히 같은** 값이 있으면 `400 INVALID_TRIGGER_PARAMETERS` 와 `details[].code = MASKED_VALUE_RESUBMITTED` 로 거부한다. 오염이 실제로 일어나지 않는다. 화면 차단은 어느 필드가 문제인지 그 자리에서 보여 주는 안내로 남는다.

에디터의 "히스토리에서 불러오기" 는 같은 컬럼을 JSON 텍스트 전체로 채우므로 필드 단위로 비울 수 없다. 그쪽은 마커를 그대로 보여 주고 남아 있는 동안 실행을 막는다([에디터 실행과 디버깅](CLE-EXEC-RUN.md)). 마스킹 범위와 근거는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.

## 체인 표시

실행 상세 화면 요약 카드에 체인 정보를 표시한다. 화면 배치는 [실행 내역](CLE-EXEC-HISTORY.md) 이 정한다. 체인 배지와 드롭다운은 [체인 조회 권한](CLE-EXEC-RERUN-POLICY.md#체인-조회-권한) 을 따르므로 뷰어를 포함한 워크스페이스 멤버 모두에게 보인다.

| 요소 | 표시 조건 | 내용 |
| --- | --- | --- |
| 체인 배지 | `re_run_of != null` | "N번째 재실행"(en "#N-th re-run")과 원본 실행 ID 링크. dry-run 이면 "· dry-run" 을 붙인다 |
| 체인 보기 드롭다운(`history.rerun.viewChain`) | 체인의 실행이 2개 이상 | 누르면 같은 체인의 모든 실행을 펼친다. 항목마다 ID, 시작 시각, 최종 상태, dry-run 여부 |

## i18n 키

| 키 | 한국어 | 영어 |
| --- | --- | --- |
| `history.actions.rerun` | 재실행 | Re-run |
| `history.rerun.modal.title` | 재실행 | Re-run Execution |
| `history.rerun.modal.originalLabel` | 원본 실행 | Original Execution |
| `history.rerun.modal.sideEffectWarning` | 이 워크플로우에는 부수효과 노드가 {{count}}개 있어요 | This workflow includes {{count}} side-effect node(s) |
| `history.rerun.modal.agentToolWarning` | MCP 서버를 연결한 AI 에이전트 노드 {{count}}개 | {{count}} AI agent node(s) with connected MCP servers |
| `history.rerun.useOriginalInput` | 원본 입력 그대로 사용 | Use original input |
| `history.rerun.maskedInputBlocked` | 자격증명으로 판별돼 가려진 입력이 있어요. 해당 항목을 직접 입력하거나 '원본 입력 그대로 사용'을 켜 주세요. | Some inputs were masked as credentials. Enter them directly, or turn on "Use original input". |
| `history.rerun.dryRunToggle` | dry-run 모드 (부수효과 호출은 모의 처리) | Dry-run mode (mock side-effect calls) |
| `history.rerun.dryRunDisabledTooltip` | 이 워크플로우에는 dry-run 미지원 노드가 있어요 | This workflow contains nodes that don't support dry-run |
| `history.rerun.confirmButton` | 재실행 | Re-run |
| `history.rerun.cancelButton` | 취소 | Cancel |
| `history.rerun.chainBadge` | {{n}}번째 재실행 | #{{n}}-th re-run |
| `history.rerun.chainBadgeDryRun` | dry-run | dry-run |
| `history.rerun.chainOrigin` | 원본 | original |
| `history.rerun.viewChain` | 체인 보기 ({{count}}) | View chain ({{count}}) |
| `history.rerun.permissionDenied` | 재실행 권한이 없어요 (정책 RR-PL-06) | You don't have permission to re-run (RR-PL-06) |
| `history.rerun.chainDepthExceeded` | 같은 체인의 재실행이 한도(32)에 도달했어요 | This chain has reached the re-run depth limit (32) |
| `history.rerun.workflowDeleted` | 원본 실행의 워크플로우가 삭제되어 재실행할 수 없어요 | The workflow of the original execution has been deleted |
| `history.rerun.dryRunNotApplicable` | 이 워크플로우는 dry-run 모드로 재실행할 수 없어요 | This workflow cannot be re-run in dry-run mode |
| `history.rerun.assistantBlocked` | 재실행은 사용자가 실행 상세 페이지에서 직접 트리거해야 해요 (RR-PL-07) | Re-run must be triggered manually on the execution detail page (RR-PL-07) |
| `history.rerun.genericError` | 재실행하지 못했어요 | Re-run failed |

화면 문구 자체의 기준은 i18n 사전이다([다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md)).

## 구현 위치

- `codebase/frontend/src/components/executions/rerun-modal.tsx`
- `codebase/frontend/src/lib/executions/can-rerun.ts` (`canReRun`, 재실행 버튼 판정)

## Rationale

### 입력 데이터 마스킹을 예외로 두지 않고 마커를 막는다

결정일: 2026-08-20

2026-08-20 이전에는 `Execution.inputData` 만 응답 마스킹에서 뺐다. 마스킹하면 모달이 미리 채운 `'***'` 가 새 실행의 실제 입력값이 되기 때문이다. 이제는 이 컬럼도 마스킹하고 대신 모달이 마커를 미리 채우지 않으며 서버가 마커 재전송을 거부한다([마스킹된 입력 처리](#마스킹된-입력-처리)). 마스킹 정책의 근거는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 에 있다.

### 재실행 창은 MCP 서버를 연결한 AI 에이전트 노드를 따로 센다

결정일: 2026-11-20

**결정**: 재실행 창의 부수효과 안내 아래에 «MCP 서버를 연결한 AI 에이전트 노드 N개» 를 따로 한 줄로 보인다. N 이 0 이면 이 줄은 보이지 않는다. 노드 타입이 `ai_agent` 이고 config 의 `mcpServers` 가 비지 않은 배열이거나 비지 않은 표현식 문자열이면 1개로 센다. Cafe24 · MakeShop 도구도 `mcpServers` 로 연결하므로(service_type 이 `cafe24` · `makeshop` 인 내부 MCP 도구 제공자) 외부 MCP 서버와 구분하지 않고 같은 줄에 센다. 부수효과 노드 수(`supportsDryRun: true` 노드 수와 노드별 개수)는 그대로 둔다. 배치와 문구는 [재실행 모달](#재실행-모달) 에 있다. 사람이 권장안을 골랐다(NERV Task `CLE-T-5WK8QA` · `CLE-T-JAQSXQ`).

**노드 config 로 센다**: [부수효과 판정](CLE-EXEC-RERUN-DRYRUN.md#부수효과-판정) 은 실행 중 도구 호출마다 한다. 재실행 창은 실행 전에 열리므로 이 판정을 미리 할 수 없다. 창이 실행 전에 볼 수 있는 것은 노드 config 다.

**서버나 도구가 아닌 노드를 센다**: 연결된 서버 수나 노출되는 부수효과 도구 수는 실행 전에 정해지지 않는다. `enabledTools` 에 따라 노출되는 도구가 달라진다. `mcpServers` 가 표현식이면 실행해야 값이 나온다. Cafe24 · MakeShop 도구는 호출마다 operation 의 HTTP 메서드로 판정한다. 그래서 노드 수로 센다. 표현식은 평가하지 않고 연결된 것으로 본다. 실행 전에 값을 알 수 없으니 안전한 쪽으로 센 것이다.

**부수효과 노드 수와 섞지 않는다**: 부수효과 노드 수는 dry-run 사전 점검(`assertDryRunSupported`)과 같은 메타(`supportsDryRun`)로 센 숫자다. 여기에 AI 에이전트 노드를 더하면 그 숫자의 뜻이 달라진다.

**A4 유예를 대신하지 않는다**: 이 집계는 [재실행 — 정책 「향후 확장」](CLE-EXEC-RERUN-POLICY.md#향후-확장) 에 미뤄 둔 A4(노드별 재실행 정책 메타)를 대신하지 않는다. 창 안내는 노드 config 의 `mcpServers` 연결만 센다. 실제 dry-run 동작은 바꾸지 않는다.

**기각한 대안**:

- 안내에 넣지 않는다: dry-run 을 끈 재실행에서 AI 에이전트가 외부 데이터를 바꿀 수 있는데 창에서는 알 수 없다.
- 부수효과 노드 수에 합친다: 위에 적은 대로 숫자의 뜻이 달라져 기각했다.
- 연결된 서버 수나 도구 수를 센다: 실행 전에 확정되지 않아 기각했다.

**화면 문구를 용어 사전에 맞춘다**: 화면 문구 «외부 호출 노드» 를 [용어 사전 — 실행](../CLE-GLOSSARY-EXEC.md) 의 표준 용어 «부수효과 노드» 로 바꿨다. 화면 표기만 예외로 두지 않았다(NERV Task `CLE-T-JAQSXQ`). 같은 작업에서 ko 화면 문구의 «워크플로» 도 «워크플로우» 로 맞췄다. 재실행 창 ko 문구의 문체는 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 규칙 7 의 해요체를 따른다. 이 창만 합쇼체로 두는 예외는 두지 않았다(2026-11-26 사람 결정, NERV Task `CLE-T-A6QF3F`). ko 문구의 «Re-run» · «chain» 도 같은 창의 버튼 «재실행» 과 «체인» 으로 맞췄고 모달 제목도 «재실행» 으로 정했다. 영어 표기를 용어집 예외로 두지 않았다(2026-11-27 사람 결정, NERV Task `CLE-T-C56GBA`).
