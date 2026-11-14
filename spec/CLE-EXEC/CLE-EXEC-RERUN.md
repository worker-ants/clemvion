---
id: "CLE-EXEC-RERUN"
title: "재실행"
type: "feature"
version: 5
status: "approved"
requirements: ["REQ-RERUN-001", "REQ-RERUN-002", "REQ-RERUN-003", "REQ-RERUN-004", "REQ-RERUN-005", "REQ-RERUN-006", "REQ-RERUN-007", "REQ-RERUN-008", "REQ-RERUN-009", "REQ-RERUN-010", "REQ-RERUN-011", "REQ-RERUN-012", "REQ-RERUN-013", "REQ-RERUN-014", "REQ-RERUN-015", "REQ-RERUN-016", "REQ-RERUN-017", "REQ-RERUN-018", "REQ-RERUN-019", "REQ-RERUN-020", "REQ-RERUN-021", "REQ-RERUN-022", "REQ-RERUN-023", "REQ-RERUN-024", "REQ-RERUN-025", "REQ-RERUN-026", "REQ-RERUN-027", "REQ-RERUN-028", "REQ-RERUN-029", "REQ-RERUN-030", "REQ-RERUN-031", "REQ-RERUN-032", "REQ-RERUN-033", "REQ-RERUN-034", "REQ-RERUN-035", "REQ-RERUN-036", "REQ-RERUN-037", "REQ-RERUN-038", "REQ-RERUN-039", "REQ-RERUN-040", "REQ-RERUN-041", "REQ-RERUN-042", "REQ-RERUN-047", "REQ-RERUN-048", "REQ-RERUN-049", "REQ-RERUN-050", "REQ-RERUN-051", "REQ-RERUN-052", "REQ-RERUN-053", "REQ-RERUN-054", "REQ-RERUN-055"]
basis_superseded: false
parent: "CLE-EXEC"
ancestors: ["CLE-VISION", "CLE-EXEC"]
area: "CLE-EXEC"
content_hash: "652030b4a1f3ddb01b9f41f1cf8631e92354456907e88378c39a16003124ad83"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/5-system/13-replay-rerun.md"]
mirror_sha256: "c397b2adff404de57de4bda8e87012c8c9b1586d4710baf812cfc29c79734f05"
etag: "sha256-918032ab5540fdcde19cfe2e712fb5e5bdc8e292ebdf634f74f69015d357abeb"
---
> 구현 상태: 구현됨 · 원문: `spec/5-system/13-replay-rerun.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

재실행(Re-run)은 기존 실행을 바탕으로 새 실행을 만드는 기능이다. 새 실행은 원본 실행과 재실행 체인(`chain_id`)으로 묶인다.

**배경**: [실행 컨텍스트](CLE-EXEC-CONTEXT.md) 의 실행 기록 재사용 정책은 조회(View), 재실행(Re-run), 멀티턴 재개를 서로 다른 방식으로 나눈다. 사용자는 실행 상세 화면에서 "이 실행을 같은 입력으로 다시 돌려 결과를 비교하고 싶다", "시간에 따라 달라지는 결과(`$now`, `random()`)를 다시 계산하고 싶다", "외부 호출 없이 흐름만 재현하고 싶다" 같은 요구가 있다. 이 기능이 없을 때는 워크플로우를 수동 트리거 패널에서 다시 시작하는 식으로 우회해야 했다.

| 시나리오 | 재실행으로 얻는 것 |
| --- | --- |
| **디버그·재현** | 실패한 실행을 같은 입력으로 다시 돌려 원인을 찾는다. 외부 호출까지 다시 일어나지 않게 끄고(dry-run) 흐름만 보고 싶을 때 안전장치가 있다 |
| **재시도** | 일시적 실패(외부 API 5xx, 네트워크 끊김)를 빠르게 한 번 더 시도한다. 입력을 고치지 않고 한 번 클릭으로 끝난다 |
| **테스트** | 입력 일부만 바꿔 다시 돌리고 결과 차이를 비교한다(예: 다른 사용자 ID 로 같은 흐름 재현) |
| **시간 재계산** | `$now`·`random()`·외부 응답에 따라 달라지는 결과를 새 실행 시점으로 다시 고정한다 |

이 문서와 하위 문서는 재실행의 API, 외부 부수효과 안전장치(확인 모달과 dry-run 토글), 입력 데이터 모달, 체인 데이터 모델, 권한, AI 어시스턴트와의 경계, 멀티턴·Form·버튼 노드의 재실행 방식, 진입점을 정한다.

범위 밖(향후 확장, [재실행 — 정책](CLE-EXEC-RERUN-POLICY.md#향후-확장) 참조):

- 부분 재실행(실패 지점부터 이어 실행, 단일 노드 디버그). 단일 노드 실행은 별도 진입점으로 이미 있다([에디터 실행과 디버깅](CLE-EXEC-RUN.md)).
- 표현식만 다시 평가하는 방식, 멀티턴 입력 재사용(자동 진행), AI 어시스턴트 재실행 도구, 노드별 멱등성 키 자동 부여, 노드별 재실행 정책 메타.

두 진입점(실행 상세 화면 실행 결과 드로어)의 화면 배치는 [실행 내역](CLE-EXEC-HISTORY.md) 과 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 이 정한다. 모달·정책·API 의 기준은 이 문서와 하위 문서다.

## 요구사항

- REQ-RERUN-001 WHEN 사용자가 재실행 버튼을 누르면 THE SYSTEM SHALL 원본 실행 정보, 외부 부수효과 노드 수, 입력 데이터 폼, dry-run 토글, 재실행·취소 버튼이 있는 확인 모달을 연다. (원본: RR-PL-01)
- REQ-RERUN-002 WHILE dry-run 토글이 켜진 동안 THE SYSTEM SHALL 부수효과 노드가 외부 호출을 건너뛰고 모의 출력을 돌려주게 한다. (원본: RR-PL-01)
- REQ-RERUN-003 IF dry-run 토글이 꺼져 있으면 THE SYSTEM SHALL 외부 호출을 그대로 다시 일으킨다. (원본: RR-PL-01)
- REQ-RERUN-004 WHEN 모달이 열리면 THE SYSTEM SHALL 원본 실행의 `inputData.parameters` 를 수동 트리거 파라미터 스키마 기반 폼에 미리 채운다. (원본: RR-PL-02)
- REQ-RERUN-005 WHEN 사용자가 "원본 입력 그대로 사용" 토글을 켜면 THE SYSTEM SHALL 폼을 읽기 전용으로 바꾸고 원본 입력으로 재실행한다. (원본: RR-PL-02)
- REQ-RERUN-006 IF 수동 트리거 파라미터 스키마가 없으면 THE SYSTEM SHALL 원본 `inputData.parameters` 키를 타입 없는 텍스트 필드로 보여 준다.
- REQ-RERUN-007 IF 원본 입력 값이 마스킹 마커면 THE SYSTEM SHALL 그 필드를 비워 두고 사용자가 채울 때까지 제출을 막는다.
- REQ-RERUN-008 IF 구조(object·array) 필드의 값이 JSON 으로 파싱되지 않으면 THE SYSTEM SHALL 재실행 제출을 막는다.
- REQ-RERUN-009 IF `inputOverride` 의 값 가운데 마스킹 마커와 정확히 같은 값이 있으면 THE SYSTEM SHALL `400 INVALID_TRIGGER_PARAMETERS` 와 `details[].code = MASKED_VALUE_RESUBMITTED` 로 거부한다.
- REQ-RERUN-010 WHEN 재실행을 요청하면 THE SYSTEM SHALL 워크플로우 전체를 실행한다. (원본: RR-PL-03)
- REQ-RERUN-011 WHEN 원본 실행이 멀티턴 AI·Form·버튼 노드를 거쳤으면 THE SYSTEM SHALL 재실행을 새 입력 대기 세션으로 시작하고 원본의 사용자 응답을 다시 쓰지 않는다. (원본: RR-PL-04)
- REQ-RERUN-012 WHEN 재실행 실행을 만들면 THE SYSTEM SHALL `re_run_of` 에 원본 실행 ID 를, `chain_id` 에 체인 루트 실행 ID 를 채운다. (원본: RR-PL-05)
- REQ-RERUN-013 IF `re_run_of` 를 거슬러 올라간 깊이가 32 를 넘으면 THE SYSTEM SHALL `409 RERUN_CHAIN_DEPTH_EXCEEDED` 로 거부한다. (원본: RR-PL-05)
- REQ-RERUN-014 IF 호출자가 워크스페이스 멤버가 아니면 THE SYSTEM SHALL `403 NOT_A_MEMBER` 로 거부한다. (원본: RR-PL-06)
- REQ-RERUN-015 IF 호출자가 뷰어면 THE SYSTEM SHALL `403 EDITOR_REQUIRED` 로 거부한다. (원본: RR-PL-06)
- REQ-RERUN-016 IF 원본이 다른 사용자가 시작한 실행이고 호출자가 소유자나 관리자가 아니면 THE SYSTEM SHALL `403 RERUN_PERMISSION_DENIED` 로 거부한다. (원본: RR-PL-06)
- REQ-RERUN-017 IF 원본 실행의 `executed_by` 가 NULL 이면 THE SYSTEM SHALL 편집자 이상이면 누구에게나 재실행을 허용한다. (원본: RR-PL-06)
- REQ-RERUN-018 WHILE dry-run 모드인 동안 THE SYSTEM SHALL 일반 재실행과 같은 권한 조건을 적용한다. (원본: RR-PL-06)
- REQ-RERUN-019 IF 사용자에게 재실행 권한이 없으면 THE SYSTEM SHALL 실행 상세 화면의 재실행 버튼을 비활성화하고 툴팁으로 안내한다. (원본: RR-PL-06)
- REQ-RERUN-020 IF 사용자에게 재실행 권한이 없으면 THE SYSTEM SHALL 실행 결과 드로어의 재실행 버튼을 숨긴다.
- REQ-RERUN-021 WHEN 사용자가 AI 어시스턴트에게 실행을 다시 돌려 달라고 하면 THE SYSTEM SHALL 재실행을 트리거하지 않고 실행 상세 화면에서 직접 하라고 안내한다. (원본: RR-PL-07)
- REQ-RERUN-022 WHEN dry-run 실행의 컨텍스트를 만들면 THE SYSTEM SHALL 첫 노드 실행 전에 `variables.__dryRun = true` 를 넣는다.
- REQ-RERUN-023 WHEN 입력 대기 뒤 rehydration 하면 THE SYSTEM SHALL `Execution.dry_run` 으로 `variables.__dryRun` 을 복원한다.
- REQ-RERUN-024 WHEN 부수효과 노드가 dry-run 으로 실행되면 THE SYSTEM SHALL 외부 호출 없이 `_dryRun: true` 모의 출력을 저장하고 노드 실행을 `completed` 로 끝낸다.
- REQ-RERUN-025 IF dry-run 요청인데 워크플로우나 그 워크플로우가 서브 워크플로우로 부르는 워크플로우(동기 · 비동기, 아래 단계 포함)에 `supportsDryRun` 이 true 가 아닌 부수효과 노드가 있으면 THE SYSTEM SHALL `400 RERUN_DRY_RUN_NOT_APPLICABLE` 로 재실행 전체를 거부한다.
- REQ-RERUN-026 IF 워크플로우에 dry-run 을 지원하지 않는 노드가 있으면 THE SYSTEM SHALL 모달의 dry-run 토글을 비활성화하고 툴팁으로 안내한다.
- REQ-RERUN-027 WHILE dry-run 모드인 동안 THE SYSTEM SHALL AI 노드의 LLM 호출은 그대로 한다.
- REQ-RERUN-028 WHILE dry-run 모드인 동안 THE SYSTEM SHALL AI 에이전트가 부르는 부수효과 도구에 모의 응답을 돌려준다.
- REQ-RERUN-029 WHEN dry-run 실행 결과를 표시하면 THE SYSTEM SHALL 노드 카드에 `🧪 dry-run` 배지를 달고 `_dryRun: true` 가 있는 출력을 강조한다.
- REQ-RERUN-030 WHEN 실행 상세 화면이 dry-run 실행을 표시하면 THE SYSTEM SHALL `_dryRun` 표시가 없는 노드에도 `Execution.dry_run` 으로 배지를 단다.
- REQ-RERUN-031 WHEN 재실행이 만들어지면 THE SYSTEM SHALL `201` 과 함께 새 실행을 `reRunOf`·`chainId`·`dryRun` 을 포함해 돌려준다.
- REQ-RERUN-032 IF `executionId` 가 없거나 다른 워크스페이스의 실행이면 THE SYSTEM SHALL `404 RERUN_EXECUTION_NOT_FOUND` 로 거부한다.
- REQ-RERUN-033 IF 원본 실행의 워크플로우가 삭제됐으면 THE SYSTEM SHALL `404 RERUN_WORKFLOW_DELETED` 로 거부한다.
- REQ-RERUN-034 IF `inputOverride` 가 수동 트리거 파라미터 스키마와 맞지 않으면 THE SYSTEM SHALL `400 INVALID_TRIGGER_PARAMETERS` 로 거부하고 필드별 사유를 `error.details[]` 에 싣는다.
- REQ-RERUN-035 WHEN 체인 조회를 요청하면 THE SYSTEM SHALL 같은 체인의 모든 실행을 `started_at` 오름차순으로 돌려준다.
- REQ-RERUN-036 WHEN 재실행이 만들어지면 THE SYSTEM SHALL 감사 로그에 `execution.re_run` 을 남긴다.
- REQ-RERUN-037 IF 감사 로그 기록이 실패하면 THE SYSTEM SHALL 재실행을 그대로 진행한다.
- REQ-RERUN-038 IF 한 사용자가 1분에 재실행을 10번 넘게 요청하면 THE SYSTEM SHALL `429 RATE_LIMITED` 로 거부한다.
- REQ-RERUN-039 WHEN 재실행하면 THE SYSTEM SHALL 원본 실행 시점 스냅샷이 아니라 현재 워크플로우 정의로 실행한다.
- REQ-RERUN-040 WHEN 재실행하면 THE SYSTEM SHALL 트리거를 다시 발화하지 않고 수동 경로로 진행하며 `executed_by` 를 호출자로, `trigger_id` 를 NULL 로 채운다.
- REQ-RERUN-041 WHEN 모달이 새 실행 ID 를 받으면 THE SYSTEM SHALL 실행 상세 화면에서는 새 실행 상세 경로로 이동한다.
- REQ-RERUN-042 WHEN 사용자가 모달의 원본 실행 ID 를 누르면 THE SYSTEM SHALL 새 탭에서 원본 실행 상세를 연다.
- REQ-RERUN-047 WHEN 워크스페이스 멤버가 체인 조회를 요청하면 THE SYSTEM SHALL 멤버의 역할과 원본 실행의 시작자와 상관없이 조회를 허용한다.
- REQ-RERUN-048 WHEN dry-run 실행의 AI 에이전트가 Cafe24 · MakeShop 내부 MCP 브리지 도구를 부르고 그 operation 의 HTTP 메서드가 GET 이 아니거나 상태를 바꾸는 GET 예외 목록에 있으면 THE SYSTEM SHALL 외부 API 를 부르지 않고 `_dryRun: true` 와 `executed: false` 가 든 `success` 모의 응답을 LLM 에 돌려준다.
- REQ-RERUN-049 WHEN dry-run 실행의 AI 에이전트가 예외 목록에 없는 GET 브리지 operation 을 부르면 THE SYSTEM SHALL 평소처럼 외부 API 를 부르고 그 결과를 돌려준다.
- REQ-RERUN-050 WHEN dry-run 실행의 AI 에이전트가 외부 MCP 서버의 도구를 부르면 THE SYSTEM SHALL 서버가 붙인 도구 annotation(`readOnlyHint` 등)과 상관없이 `tools/call` 을 보내지 않고 REQ-RERUN-048 과 같은 모양의 모의 응답을 돌려준다.
- REQ-RERUN-051 WHILE dry-run 모드인 동안 THE SYSTEM SHALL AI 에이전트의 MCP 메타 도구(`list_resources` · `read_resource` · `list_prompts` · `get_prompt`)와 내장 `kb_*` · `render_*` · `cond_*` 도구는 그대로 실행한다.
- REQ-RERUN-052 WHEN dry-run 실행의 AI 에이전트가 멀티턴 재개 턴이나 마지막 턴 재시도로 다시 들어가면 THE SYSTEM SHALL AI 재개 체크포인트(`_resumeCheckpoint`)가 아닌 실행 컨텍스트의 `variables.__dryRun` 에서 dry-run 여부를 다시 구해 REQ-RERUN-048 ~ REQ-RERUN-050 을 이어 적용한다.
- REQ-RERUN-053 WHEN dry-run 이 부수효과 노드의 호출을 모의 출력으로, 부수효과 도구의 호출을 모의 응답으로 대신하면 THE SYSTEM SHALL 통합 활동 로그를 남기지 않고, 도구 호출이면 `mcpDiagnostics.errors[]` 도 남기지 않는다.
- REQ-RERUN-054 WHEN dry-run 실행이 비동기 서브 워크플로우를 시작하면 THE SYSTEM SHALL 자식 실행 행의 `dry_run` 을 true 로 남기고 자식 실행도 dry-run 으로 실행한다.
- REQ-RERUN-055 WHEN dry-run 실행이 동기 서브 워크플로우나 Background 본문을 실행하면 THE SYSTEM SHALL 부모의 `variables.__dryRun` 을 이어받아 그 안의 노드도 dry-run 으로 실행한다.

2026-10-10 임시 가드의 요구사항 네 개(REQ-RERUN-043 ~ REQ-RERUN-046)는 2026-10-23 에 폐기했고 번호를 다시 쓰지 않는다. REQ-RERUN-048 ~ REQ-RERUN-053 이 그 자리를 대신한다. 근거는 [Rationale](#dry-run-에서-부수효과-도구만-모의-응답으로-대신한다-2026-10-23) 에 있다.

## 결정 요약

| 항목 | 결정 | 정책 ID |
| --- | --- | --- |
| A. 외부 부수효과 안전장치 | **A5**: 확인 모달과 dry-run 토글(기본 꺼짐). 부수효과 노드는 노드 메타로 분류한다 | `RR-PL-01` |
| B. 입력 데이터 방식 | **B2**: 원본 미리보기와 편집 모달이 기본. "원본 입력 그대로 사용" 토글로 B1 도 된다 | `RR-PL-02` |
| C. 부분 재실행 | **C1**: v1 은 워크플로우 전체만 | `RR-PL-03` |
| D. 멀티턴 노드 처리 | **D1**: 사용자가 새로 입력(새 멀티턴 세션) | `RR-PL-04` |
| E. 체인 추적 모델 | **E3**: `re_run_of` 자기 참조 FK 와 `chain_id` UUID 둘 다. 체인 깊이 32 제한 | `RR-PL-05` |
| F. 권한 | 재실행은 원본 실행 시작자이면서 워크스페이스 편집자 이상. dry-run 도 같다. 체인 조회 권한은 REQ-RERUN-047 이고 워크스페이스 멤버 전원이다(실행 상세 조회와 같다) | `RR-PL-06`(재실행 권한) |
| G. AI 어시스턴트 | **G1**: 재실행을 트리거하지 않는다(읽기 전용 정책 유지) | `RR-PL-07` |

정책 본문은 [재실행 — 정책](CLE-EXEC-RERUN-POLICY.md) 에 있다. A · B · C · D · G 와 F(권한)의 근거도 그 문서에 있다. E(E3 · 체인 깊이 32 · `chain_id` NULLABLE)의 근거는 [재실행 — API 와 데이터 모델](CLE-EXEC-RERUN-API.md#rationale), dry-run 판정과 서브 워크플로우 상속의 근거는 [재실행 — dry-run](CLE-EXEC-RERUN-DRYRUN.md#rationale) 과 [재실행 — dry-run 의 AI 에이전트 도구](CLE-EXEC-RERUN-AGENT.md#rationale) 에 있다.

## 하위 문서

| 문서 | 맡는 내용 | 요구사항 |
| --- | --- | --- |
| [재실행 — 정책](CLE-EXEC-RERUN-POLICY.md) | RR-PL-01 ~ RR-PL-07, 체인 조회 권한, 다른 정책과의 관계, 향후 확장 | REQ-RERUN-001, REQ-RERUN-003, REQ-RERUN-010, REQ-RERUN-011, REQ-RERUN-014 ~ REQ-RERUN-018, REQ-RERUN-021, REQ-RERUN-039, REQ-RERUN-040, REQ-RERUN-047 |
| [재실행 — dry-run](CLE-EXEC-RERUN-DRYRUN.md) | 부수효과 분류 · 판정, 엔진 동작과 사전 점검, 서브 워크플로우 상속, 결과 표시 | REQ-RERUN-002, REQ-RERUN-022 ~ REQ-RERUN-025, REQ-RERUN-029, REQ-RERUN-030, REQ-RERUN-053 ~ REQ-RERUN-055 |
| [재실행 — dry-run 의 AI 에이전트 도구](CLE-EXEC-RERUN-AGENT.md) | LLM 호출, AI 에이전트 도구의 모의 응답 | REQ-RERUN-027, REQ-RERUN-028, REQ-RERUN-048 ~ REQ-RERUN-052 |
| [재실행 — API 와 데이터 모델](CLE-EXEC-RERUN-API.md) | API, 에러 코드, 체인 · dry-run 컬럼, 감사 로그, rate limit | REQ-RERUN-009, REQ-RERUN-012, REQ-RERUN-013, REQ-RERUN-031 ~ REQ-RERUN-038 |
| [재실행 — 화면](CLE-EXEC-RERUN-UI.md) | 진입점, 재실행 모달, 마스킹된 입력 처리, 체인 표시, i18n 키 | REQ-RERUN-004 ~ REQ-RERUN-008, REQ-RERUN-019, REQ-RERUN-020, REQ-RERUN-026, REQ-RERUN-041, REQ-RERUN-042 |

## 정책

### RR-PL-07 AI 어시스턴트 비트리거 (G1)

→ [재실행 — 정책](CLE-EXEC-RERUN-POLICY.md#rr-pl-07-ai-어시스턴트-비트리거-g1)

## dry-run

### 부수효과 판정

→ [재실행 — dry-run](CLE-EXEC-RERUN-DRYRUN.md#부수효과-판정)

### 서브 워크플로우와 Background 본문

→ [재실행 — dry-run](CLE-EXEC-RERUN-DRYRUN.md#서브-워크플로우와-background-본문)

### LLM 호출

→ [재실행 — dry-run 의 AI 에이전트 도구](CLE-EXEC-RERUN-AGENT.md#llm-호출)

## 비기능 요구

| 항목 | 정책 |
| --- | --- |
| 권한 | 재실행은 RR-PL-06, 체인 조회는 REQ-RERUN-047([결정 요약](#결정-요약) F) |
| 감사 로그 | `execution.re_run` 이벤트([감사 로그](CLE-EXEC-RERUN-API.md#감사-로그)) |
| rate limit | [rate limit](CLE-EXEC-RERUN-API.md#rate-limit) 절(REQ-RERUN-038) |
| 관측 | 노드 실행의 dry-run 표시와 체인 배지로 재실행 트래픽을 일반 수동 실행과 구분할 수 있다 |
| 회귀 방지 | 단위·통합·e2e 테스트가 다음을 지킨다. 입력 같음·수정·dry-run 경우, 재실행 권한 거부(`NOT_A_MEMBER`, `EDITOR_REQUIRED`, `RERUN_PERMISSION_DENIED`), 체인 조회의 뷰어 허용(남이 시작한 실행도 200), 삭제된 워크플로우(`RERUN_WORKFLOW_DELETED`), 체인 깊이 32 초과(`RERUN_CHAIN_DEPTH_EXCEEDED`), 멀티턴 노드 새 세션(RR-PL-04), AI 어시스턴트 비트리거(RR-PL-07), dry-run 에서 AI 에이전트의 부수효과 도구는 모의 응답을 받고 읽기 도구는 실제로 호출됨(단일 턴 · 재개 턴 · 마지막 턴 재시도 재진입), 상태를 바꾸는 GET 예외 목록의 누락 감지, 서브 워크플로우와 Background 본문의 dry-run 상속(REQ-RERUN-054 · REQ-RERUN-055), 서브 워크플로우까지 보는 사전 점검 |

## 미결 사항

- **재실행 모달의 외부 호출 집계와 MCP 도구**: 모달의 부수효과 노드 수(화면 문구 "외부 호출 노드 N개")는 `supportsDryRun: true` 인 노드만 센다(`rerun-modal.tsx`). AI 에이전트에 연결된 MCP 서버와 Cafe24 · MakeShop 도구는 세지 않는다. 그래서 dry-run 을 끈 일반 재실행에서 AI 에이전트가 외부 데이터를 바꿀 수 있어도 모달 안내에는 드러나지 않는다. 안내에 MCP 도구를 넣을지 결정이 필요하다. [부수효과 판정](CLE-EXEC-RERUN-DRYRUN.md#부수효과-판정) 은 실행 중 도구 호출 단위라서 모달이 미리 셀 수 있는 단위(노드 · 연결된 MCP 지원 통합)와 다르다. 담당 Task 는 CLE-T-5WK8QA 다.
- **dry-run 재실행의 메모리 추출**: 메모리 전략이 `persistent` 인 AI 에이전트 · 정보 추출기는 추출한 메모리를 `agent_memory` 에 쓴다([에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md)). dry-run 재실행에서도 `agent_memory` 에 저장한다. 메모리 관리 코드(`ai-memory-manager.ts`, `agent-memory-extraction` 큐)에 dry-run 분기가 없다. dry-run 에서 이 저장을 막을지 결정이 필요하다. 담당 Task 는 CLE-T-C9GF9F 다.
- **활동 로그를 정하는 문서의 dry-run 예외**: 모의 출력 · 응답으로 대신한 호출이 활동 로그를 남기지 않는다는 규칙(REQ-RERUN-053)의 기준은 [재실행 — dry-run](CLE-EXEC-RERUN-DRYRUN.md#부수효과-판정) 이다. 활동 로그를 정하는 문서들은 아직 «호출마다» · «성공·실패와 관계없이 1건» 으로만 적고 dry-run 예외를 적지 않는다. [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md) 의 6단계와 규칙 7, [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) 의 REQ-INTMGMT-021 과 활동 로그 기록 시점 표, [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md) 의 활동 로그와 `last_used_at`, [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md) · [Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md) · [Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md) 의 활동 로그 요구사항이 그렇다. 그 문장들은 실제로 나간 호출을 말하는 것으로 읽는다. 세 노드는 처음부터 활동 로그 단계 전에 모의 출력을 돌려줬다. 그 문서들에 예외를 적는 일은 CLE-T-M6W7RE 가 맡는다. [용어 사전 — 실행](../CLE-GLOSSARY-EXEC.md) 의 「dry-run」 · 「부수효과 노드」 정의를 도구까지 넓히고 「부수효과 도구」 · 「모의 응답」 을 더하는 일도 같은 Task 다.

## 구현 위치

각 하위 문서의 「구현 위치」 절에 있다.

## Rationale

결정마다 근거는 그 주제의 하위 문서 끝 Rationale 에 있다. 다른 문서가 링크하는 절은 아래에서 이어 준다.

### `chain_id` 는 NULLABLE 이다 (2026-05-31, 결정 F2)

→ [재실행 — API 와 데이터 모델](CLE-EXEC-RERUN-API.md#chain_id-는-nullable-이다-2026-05-31-결정-f2)

### dry-run 에서 AI 에이전트의 MCP 도구를 막는다 (2026-10-10)

→ [재실행 — dry-run 의 AI 에이전트 도구](CLE-EXEC-RERUN-AGENT.md#dry-run-에서-ai-에이전트의-mcp-도구를-막는다-2026-10-10)

### dry-run 에서 부수효과 도구만 모의 응답으로 대신한다 (2026-10-23)

→ [재실행 — dry-run 의 AI 에이전트 도구](CLE-EXEC-RERUN-AGENT.md#dry-run-에서-부수효과-도구만-모의-응답으로-대신한다-2026-10-23)

### 체인 조회 권한은 실행 상세 조회와 같다 (2026-10-10)

→ [재실행 — 정책](CLE-EXEC-RERUN-POLICY.md#체인-조회-권한은-실행-상세-조회와-같다-2026-10-10)
