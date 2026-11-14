---
id: "CLE-EXEC-HISTORY"
title: "실행 내역"
type: "feature"
version: 4
status: "approved"
requirements: ["REQ-EXHIST-001", "REQ-EXHIST-002", "REQ-EXHIST-003", "REQ-EXHIST-004", "REQ-EXHIST-005", "REQ-EXHIST-006", "REQ-EXHIST-007", "REQ-EXHIST-008", "REQ-EXHIST-009", "REQ-EXHIST-010", "REQ-EXHIST-011", "REQ-EXHIST-012", "REQ-EXHIST-013", "REQ-EXHIST-014", "REQ-EXHIST-015", "REQ-EXHIST-016", "REQ-EXHIST-017", "REQ-EXHIST-018", "REQ-EXHIST-019", "REQ-EXHIST-020", "REQ-EXHIST-021", "REQ-EXHIST-022", "REQ-EXHIST-023", "REQ-EXHIST-024", "REQ-EXHIST-025", "REQ-EXHIST-026", "REQ-EXHIST-027", "REQ-EXHIST-028", "REQ-EXHIST-029", "REQ-EXHIST-030", "REQ-EXHIST-031", "REQ-EXHIST-032", "REQ-EXHIST-033", "REQ-EXHIST-034", "REQ-EXHIST-035", "REQ-EXHIST-036", "REQ-EXHIST-037", "REQ-EXHIST-038", "REQ-EXHIST-039", "REQ-EXHIST-040", "REQ-EXHIST-041", "REQ-EXHIST-042", "REQ-EXHIST-043", "REQ-EXHIST-044", "REQ-EXHIST-045"]
basis_superseded: false
parent: "CLE-EXEC"
ancestors: ["CLE-VISION", "CLE-EXEC"]
area: "CLE-EXEC"
content_hash: "fc88d1360008606ed9bab93191d202e3c99f51ff3ff31d41db1c8c91d6f98301"
read_as: "approved_fallback"
task: "CLE-T-ES1J1E"
source_paths: ["spec/2-navigation/14-execution-history.md", "spec/2-navigation/_product-overview.md"]
mirror_sha256: "177ed5824c01300c16dbdf4eedd89d7e493560b5c4fe04a35c42f99dd08e1686"
etag: "sha256-e00f04328bfc8a92908bad8c382cd8450d093bbd06c3ee294457ef6c63393b44"
---
> 구현 상태: 구현됨 (EH-DETAIL-12 여러 노드 대화 재구성 보기만 v2 미구현) · 원문: `spec/2-navigation/14-execution-history.md`, `spec/2-navigation/_product-overview.md` (§3.15 Execution History) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

실행 내역(Execution History)은 워크플로우별 실행 목록을 보고 실행 한 건의 노드별 결과(입출력·에러·타임라인)를 살펴보는 화면이다. 대시보드, 워크플로우 목록, 에디터 같은 여러 진입점에서 들어온다. 화면은 실행 목록과 실행 상세 두 단계다.

이 문서는 실행 출처 분류와 목록·상세 API, 응답 마스킹 전제를 정한다. 두 화면의 구성 · 진입점 · 반응형 배치는 하위 문서 [실행 내역 — 화면 구성](CLE-EXEC-HISTORY-UI.md) 이 정한다.

범위 밖:

- 실행 상세의 노드 결과 탭(미리보기·입력·출력·응답·요청·LLM 사용량·설정·메타·포트·상태·참조·오류)은 에디터 실행 결과 드로어와 같은 컴포넌트(`ResultDetail`)를 쓴다. 탭 구성·조건·기본 탭·자동 전환은 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 이 정한다.
- 대화 기록을 그리는 규칙은 [대화 미리보기](CLE-EXEC-PREVIEW.md), 노드 출력을 내역 화면에 복원하는 경로는 [실행 화면 복원 규약](CLE-EXEC-HYDRATION.md) 이 정한다.
- 재실행 버튼·체인 표시의 정책과 API 는 [재실행](CLE-EXEC-RERUN.md) 이 정한다. 화면 배치는 하위 문서가 적는다.
- 에디터 안 실행 내역 패널은 [에디터 실행과 디버깅](CLE-EXEC-RUN.md), 실행·노드 실행 엔티티는 [실행 데이터와 흐름](CLE-EXEC-DATA.md), 실행 상태 값과 전이는 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) 가 정한다.

## 요구사항

- REQ-EXHIST-001 WHEN 사용자가 워크플로우의 실행 목록 화면을 열면 THE SYSTEM SHALL 그 워크플로우의 모든 실행을 테이블로 표시한다. (원본: EH-LIST-01)
- REQ-EXHIST-002 WHEN 실행 목록을 표시하면 THE SYSTEM SHALL 행마다 상태·실행 출처·시작 시각·실행 시간·노드 실행 현황을 표시한다. (원본: EH-LIST-02)
- REQ-EXHIST-003 WHEN 사용자가 상태 필터 버튼을 누르면 THE SYSTEM SHALL All·Completed·Failed·Running·Cancelled·Waiting 가운데 고른 상태의 실행만 표시한다. (원본: EH-LIST-03)
- REQ-EXHIST-004 IF 실행 상태가 `pending` 이면 THE SYSTEM SHALL 상태 필터에는 두지 않고 All 필터에서만 표시한다.
- REQ-EXHIST-005 WHEN 사용자가 정렬할 수 있는 열 머리를 누르면 THE SYSTEM SHALL 그 열의 오름차순과 내림차순을 토글하고 화살표를 표시한다. (원본: EH-LIST-04)
- REQ-EXHIST-006 WHEN 실행 목록을 처음 열면 THE SYSTEM SHALL `started_at` 내림차순으로 정렬한다.
- REQ-EXHIST-007 WHEN 실행 목록을 표시하면 THE SYSTEM SHALL 페이지당 20건으로 나누고 이전·다음 버튼과 페이지 번호 버튼을 표시한다. (원본: EH-LIST-05)
- REQ-EXHIST-008 WHEN 사용자가 상태 필터를 바꾸면 THE SYSTEM SHALL 1페이지로 돌아간다.
- REQ-EXHIST-009 WHEN 사용자가 목록 행을 누르면 THE SYSTEM SHALL 그 실행의 상세 화면으로 이동한다. (원본: EH-LIST-06)
- REQ-EXHIST-010 WHEN 실행 목록 화면을 열면 THE SYSTEM SHALL 머리에 워크플로우 이름과 에디터로 가는 링크를 표시한다. (원본: EH-LIST-07)
- REQ-EXHIST-011 IF 실행 기록이 하나도 없으면 THE SYSTEM SHALL 빈 상태 안내와 에디터로 가는 버튼을 표시한다. (원본: EH-LIST-08)
- REQ-EXHIST-012 WHILE 실행 목록을 불러오는 동안 THE SYSTEM SHALL 테이블 자리에 스켈레톤 5행을 표시한다.
- REQ-EXHIST-013 WHEN 백엔드가 실행을 응답하면 THE SYSTEM SHALL 실행 출처 판정 표의 우선순위대로 `triggerSource` 와 `triggerLabel` 을 채운다.
- REQ-EXHIST-014 WHEN 백엔드가 실행 목록을 응답하면 THE SYSTEM SHALL 노드 실행 본문을 싣지 않고 `totalNodeCount`·`completedNodeCount`·`failedNodeCount` 를 배치 집계로 싣는다.
- REQ-EXHIST-015 WHEN 백엔드가 실행 목록을 응답하면 THE SYSTEM SHALL `executionPath` 를 항상 빈 배열로 싣는다.
- REQ-EXHIST-016 WHEN 사용자가 실행 상세 화면을 열면 THE SYSTEM SHALL 상태·시작 시각·종료 시각·실행 시간·전체 경과·노드 실행 현황을 담은 요약 카드를 표시한다. (원본: EH-DETAIL-01)
- REQ-EXHIST-017 IF 실행이 실패했으면 THE SYSTEM SHALL 요약 카드에 에러 메시지를 더 표시한다.
- REQ-EXHIST-018 WHEN 실행 상세 화면을 열면 THE SYSTEM SHALL 왼쪽 노드 목록과 오른쪽 노드 상세로 나뉜 결과 패널을 표시한다. (원본: EH-DETAIL-02)
- REQ-EXHIST-019 WHEN 사용자가 노드 목록에서 노드를 고르면 THE SYSTEM SHALL 에디터 실행 결과 드로어와 같은 결과 상세 탭을 표시한다. (원본: EH-DETAIL-03)
- REQ-EXHIST-020 IF 노드 실행이 실패했으면 THE SYSTEM SHALL 노드 목록에서 그 노드를 강조하고 에러 메시지를 표시한다. (원본: EH-DETAIL-04)
- REQ-EXHIST-021 IF 노드 실행 상태가 `skipped` 면 THE SYSTEM SHALL 그 노드를 노드 목록에서 뺀다. (원본: EH-DETAIL-05)
- REQ-EXHIST-022 WHEN 사용자가 노드의 미리보기 탭을 열면 THE SYSTEM SHALL Presentation 노드는 시각 미리보기, AI 에이전트 노드는 대화 기록과 메시지별 상세, 일반 노드는 상태 요약을 표시한다. (원본: EH-DETAIL-06)
- REQ-EXHIST-023 IF 노드에 버튼이 설정돼 있으면 THE SYSTEM SHALL 미리보기 탭에 모든 버튼을 표시하고 선택된 버튼을 강조한다. (원본: EH-DETAIL-07)
- REQ-EXHIST-024 IF 멀티턴 대화 노드가 오류로 끝났으면 THE SYSTEM SHALL 대화 기록과 마지막 `system_error` 를 표시하고 [다시 시도] 버튼은 숨긴다.
- REQ-EXHIST-025 WHEN 사용자가 상세 화면의 "← Executions" 를 누르면 THE SYSTEM SHALL 그 워크플로우의 실행 목록으로 이동한다. (원본: EH-DETAIL-08)
- REQ-EXHIST-026 WHEN 사용자가 이전·다음 버튼을 누르면 THE SYSTEM SHALL 같은 워크플로우의 시간 순서에서 이전·다음 실행으로 이동한다. (원본: EH-DETAIL-09)
- REQ-EXHIST-027 IF 현재 실행이 첫 실행이거나 마지막 실행이면 THE SYSTEM SHALL 해당 방향 버튼을 비활성화한다.
- REQ-EXHIST-028 WHEN 실행 상세 화면을 열면 THE SYSTEM SHALL 머리에 재실행 버튼을 항상 표시한다. (원본: EH-DETAIL-10)
- REQ-EXHIST-029 IF 사용자에게 재실행 권한이 없으면 THE SYSTEM SHALL 재실행 버튼을 비활성화하고 권한 안내 툴팁을 단다. (원본: EH-DETAIL-10)
- REQ-EXHIST-030 IF 실행의 `reRunOf` 가 비어 있지 않으면 THE SYSTEM SHALL 요약 카드에 재실행 체인 배지를 표시한다. (원본: EH-DETAIL-11)
- REQ-EXHIST-031 IF 재실행 체인의 실행이 2개 이상이면 THE SYSTEM SHALL "View chain" 드롭다운을 표시한다. (원본: EH-DETAIL-11)
- REQ-EXHIST-032 WHEN 사용자가 체인 배지의 원본 실행 ID 를 누르면 THE SYSTEM SHALL 같은 탭에서 원본 실행 상세로 이동한다.
- REQ-EXHIST-033 WHEN 재실행 모달이 새 실행 ID 를 받으면 THE SYSTEM SHALL 현재 워크스페이스의 새 실행 상세 화면으로 이동한다.
- REQ-EXHIST-034 WHEN 사용자가 여러 노드를 가로지르는 대화 재구성 보기를 열면 THE SYSTEM SHALL 여러 노드의 Presentation·AI 턴을 순번·시각·출처로 섞어 한 대화로 보여 준다. (원본: EH-DETAIL-12) (미구현)
- REQ-EXHIST-035 WHILE 실행 상세를 불러오는 동안 THE SYSTEM SHALL 스켈레톤 3블록을 표시한다.
- REQ-EXHIST-036 IF 실행 상세 조회가 실패하면 THE SYSTEM SHALL "Failed to load execution. Please try again." 과 뒤로 가기 버튼을 표시한다.
- REQ-EXHIST-037 IF 실행을 찾을 수 없으면 THE SYSTEM SHALL "Execution not found." 와 뒤로 가기 버튼을 표시한다.
- REQ-EXHIST-038 WHEN 사용자가 대시보드 Recent Executions 의 행을 누르면 THE SYSTEM SHALL 그 실행의 상세 화면으로 이동한다. (원본: EH-NAV-01)
- REQ-EXHIST-039 WHEN 사용자가 워크플로우 목록 행의 더보기(⋯) 메뉴에서 "실행 내역" 을 누르면 THE SYSTEM SHALL 그 워크플로우의 실행 목록으로 이동한다. (원본: EH-NAV-02)
- REQ-EXHIST-040 WHEN 사용자가 에디터의 실행 내역 링크를 누르면 THE SYSTEM SHALL 그 워크플로우의 실행 목록으로 이동한다. (원본: EH-NAV-03)
- REQ-EXHIST-041 WHEN AI 어시스턴트가 실행 조회 도구를 부르면 THE SYSTEM SHALL 현재 워크플로우의 실행 목록과 상세를 읽기 전용으로 돌려준다. (원본: EH-NAV-04)
- REQ-EXHIST-042 IF 화면 폭이 768px 이상 1279px 이하면 THE SYSTEM SHALL 노드 결과의 좌우 2분할을 세로로 쌓는다.
- REQ-EXHIST-043 IF 화면 폭이 768px 미만이면 THE SYSTEM SHALL 모든 영역을 세로로 쌓고 테이블을 카드형 목록으로 바꾼다.
- REQ-EXHIST-044 WHEN 뷰어가 실행 상세의 설정 탭을 열면 THE SYSTEM SHALL 응답 마스킹을 거친 설정 에코를 보여 준다.
- REQ-EXHIST-045 IF 워크스페이스 멤버(뷰어 포함)에게 재실행 권한이 없으면 THE SYSTEM SHALL 체인 배지와 "View chain" 드롭다운을 권한이 있을 때와 같은 조건으로 표시한다. (체인 조회 권한: REQ-RERUN-047)

## 하위 문서

- [실행 내역 — 화면 구성](CLE-EXEC-HISTORY-UI.md): 실행 목록 · 실행 상세 화면의 경로와 구성(머리 · 상태 필터 · 테이블 · 정렬 · 요약 카드 · 노드 결과 패널 · 미리보기 탭 · 에러 상태 · 이전·다음 이동 · 재실행과 체인 표시 · 역할별 표시), 진입점, 반응형 배치. 요구사항 줄은 모두 이 문서의 「요구사항」 절에 있다. 하위 문서는 그 가운데 화면 요구사항(REQ-EXHIST-001 ~ REQ-EXHIST-012, REQ-EXHIST-016 ~ REQ-EXHIST-043, REQ-EXHIST-045)의 화면 세부를 적는다.

이 문서 본문은 REQ-EXHIST-013 ~ REQ-EXHIST-015(실행 출처 · 목록 응답)와 REQ-EXHIST-044(설정 탭 응답 마스킹)의 세부를 적는다.

## 실행 출처 분류

실행 출처(`triggerSource`)는 실행이 어디서 시작됐는지 화면용으로 정리한 값이다. `Execution.trigger_id`, `Execution.executed_by`, `Execution.parent_execution_id` 와 `Trigger.type` 으로 다섯 값 가운데 하나로 정한다. 판정 우선순위는 표의 위에서 아래 순서다.

| source | 판정 규칙 | 아이콘 | 라벨 | 보조 라벨 |
| --- | --- | --- | --- | --- |
| `subworkflow` | `parent_execution_id != null` | GitBranch | 서브 워크플로우 | 부모 실행의 `workflow.name` |
| `manual` | 위에 해당하지 않고 `executed_by != null` | User | 수동 실행 | 실행한 사람의 `User.name`. 이름이 없을 때의 폴백은 정의가 갈린다([미결 사항](#미결-사항)) |
| `schedule` | 위에 해당하지 않고 `trigger_id != null` 이며 `Trigger.type === 'schedule'` | Clock | 스케줄 | `Trigger.name` |
| `webhook` | 위에 해당하지 않고 `trigger_id != null` 이며 `Trigger.type === 'webhook'` | Webhook | Webhook | `Trigger.name` |
| `unknown` | 그 밖(옛 데이터 대비) | HelpCircle | 없음 | 없음 |

응답 DTO 는 분류 결과를 `triggerSource`(enum)와 `triggerLabel`(보조 라벨, 없으면 null)로 싣는다. 재실행으로 만든 실행은 `manual` 로 분류되고 체인 배지가 함께 보인다([재실행](CLE-EXEC-RERUN.md)). 컬럼을 채우는 규칙은 [실행 컨텍스트](CLE-EXEC-CONTEXT.md) 의 트리거 입력 파라미터 처리 절이 정한다.

판정 표에는 `Trigger.type = 'manual'` 행이 없다. 현재 구현에는 그런 트리거로 `executed_by` 없이 시작하는 실행이 없다. `trigger_id` 를 채우는 경로는 둘뿐이다.

- 웹훅 수신과 채팅 채널 수신: `type = 'webhook'` 트리거만 찾는다([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md), [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md)).
- 스케줄 자동 발화: 스케줄에 딸린 `type = 'schedule'` 트리거를 쓴다([스케줄](../CLE-TRIG/CLE-TRIG-SCHEDULE.md)).

수동 실행, 단일 노드 실행, 스케줄 "지금 실행", 재실행은 `executed_by` 만 채우고 `trigger_id` 는 비운다. 실행 시작 옵션(`ExecuteOptions`)은 판별 유니온이라 `executedBy` 와 `triggerId` 를 함께 넘기는 호출을 컴파일 시점에 막는다(`execution-engine.service.ts`). 그런 실행이 생기더라도 판정 표대로 `unknown` 으로 분류된다.

`triggerSource`(화면용 다섯 값)는 엔진 내부 마커 `__triggerSource`(세 값, 트리거 노드 입력 페이로드의 출처 표시, [트리거 노드 공통](../CLE-NODE-TRIG/CLE-NODE-TRIG-COMMON.md)·[트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md))와 **다른 식별자**다. 이 DTO 필드는 `parent_execution_id` 판정까지 포함한 화면용 정리 결과라 값 집합과 층이 다르다.

## API

| 메서드 | 경로 | 설명 | 비고 |
| --- | --- | --- | --- |
| GET | `/api/executions/workflow/:workflowId` | 워크플로우별 실행 목록 | 페이지네이션·상태 필터·정렬 지원. 응답 형식은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 목록 응답을 따른다. **노드 실행은 싣지 않는다**(N+1 회피, [Rationale](#목록-api-는-노드-실행을-빼고-배치-집계-세-값만-싣는다)) |
| GET | `/api/executions/:id` | 실행 상세 | `nodeExecutions` 배열 포함. 실리는 필드는 아래 「실행 응답 필드」 |
| POST | `/api/executions/:executionId/re-run` | 원본 실행을 바탕으로 새 실행 시작 | EH-DETAIL-10. 명세는 [재실행](CLE-EXEC-RERUN.md) |
| GET | `/api/executions/:executionId/chain` | 같은 체인의 모든 실행을 시간순으로 반환 | EH-DETAIL-11. 명세는 [재실행](CLE-EXEC-RERUN.md) |

`GET /api/executions/:id` 는 따로 `@Roles` 게이트가 없어 워크스페이스 멤버 전원(뷰어 포함)이 조회한다. 응답의 `Execution.error`·`nodeExecutions[].error`·`config` 등은 응답 단계에서 마스킹된다. 기준은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이다.

체인 조회와 재실행의 권한은 [재실행](CLE-EXEC-RERUN.md) 이 정한다. 화면 표시 조건은 [역할별 표시](CLE-EXEC-HISTORY-UI.md#역할별-표시) 다.

**목록 API 쿼리 파라미터**

| 파라미터 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `page` | number | 1 | 페이지 번호 |
| `limit` | number | 20 | 페이지당 건수(최대 100) |
| `sort` | string | `started_at` | 정렬 기준(`started_at`, `finished_at`, `status`, `duration_ms`, `active_running_ms`). API 규약 예시(`created_at`)와 다른 것은 의도한 도메인 예외다. 실행 기록의 정렬 축은 시작 시각이다. 실행 시간 열은 `active_running_ms` 로 정렬한다 |
| `order` | string | `desc` | 정렬 순서(`asc`, `desc`) |
| `status` | string | 없음 | 상태 필터 |

**목록 API 응답 예시**

```json
{
  "data": [
    {
      "id": "uuid",
      "workflowId": "uuid",
      "status": "completed",
      "startedAt": "2024-01-15T14:02:30Z",
      "finishedAt": "2024-01-15T14:02:33Z",
      "durationMs": 3200,
      "activeRunningMs": 3100,
      "inputData": {},
      "outputData": {},
      "error": null,
      "triggerSource": "schedule",
      "triggerLabel": "매일 오전 9시 보고서",
      "triggerId": "uuid",
      "executedBy": null,
      "parentExecutionId": null,
      "recursionDepth": 0,
      "executionPath": [],
      "reRunOf": null,
      "chainId": null,
      "dryRun": false,
      "totalNodeCount": 5,
      "completedNodeCount": 5,
      "failedNodeCount": 0
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 87,
    "totalPages": 5
  }
}
```

`reRunOf`·`chainId`·`dryRun` 은 기본 실행 응답 필드다. 목록 응답의 `executionPath` 는 늘 빈 배열이다. 단건 조회만 따로 채운다([Rationale](#rationale)).

**실행 응답 필드**

- 목록 · 상세 · 중지(`POST /api/executions/:id/stop`) · 체인 · 재실행 응답의 실행 객체는 **같은 필드 집합**(`ExecutionDto`)을 싣는다. 체인 항목도 `triggerSource` · `triggerLabel` · 노드 집계 세 값을 싣는다. `ExecutionDto` 의 필드는 모두 키가 늘 있고 값이 없으면 `null` 이다([HTTP API 규약 — 응답](../CLE-API/CLE-API-CONV-RESP.md#55-부재-표현-null-과-키-생략) 의 「부재 표현: `null` 과 키 생략」 기본값).
- 상세와 재실행 응답은 여기에 `nodeExecutions` 를 더하고 `executionPath` 를 채운다. 목록 · 중지 · 체인 응답의 `executionPath` 는 빈 배열이다. `executionPathTruncated`(boolean)는 경로 행이 읽기 상한에서 잘렸을 수 있으면 `true` 다. 재실행 응답은 상세 응답과 같은 모양이다. `nodeExecutions` · `executionPathTruncated` 두 키는 상세 · 재실행 응답에만 있다.
- 선언하지 않은 실행 컬럼(`sourceIp` · `userVariables` · `resumeCallStack` · `conversationThread` · `queuedAt` · `singleNodeId` · `previousExecutionId` · `responseCode` 등)과 부모 `workflow` 객체는 싣지 않는다. 응답은 DTO 로 조립하고 엔티티를 펼쳐 내보내지 않는다. 근거는 [Rationale](#rationale) 의 「실행 응답은 한 DTO 로 싣고 노드는 참조 세 필드만 싣는다」.
- `durationMs` 는 전체 경과(ms)다. 시작부터 종료까지의 벽시계 시간이라 입력 대기 시간이 들어간다. 끝나지 않은 실행은 `null` 이다.
- `activeRunningMs` 는 실행 시간(ms)이다. 입력 대기를 뺀 순수 실행 시간이다. 저장 값의 정의와 작게 기록되는 경우는 [실행 데이터와 흐름 — 데이터 모델](CLE-EXEC-DATA-MODEL.md) 의 `active_running_ms` 가 정한다. 아래 경우에는 `null` 이다.
  - 실행이 끝나지 않았다(`pending` · `running` · `waiting_for_input`).
  - 측정되지 않았다. 저장된 값이 0 인데 `durationMs` 가 0 보다 크면 측정되지 않은 것으로 본다(마이그레이션 V083 이전 실행, 엔진이 마지막 구간을 더하기 전에 멈춘 중지 실행 등). 노드 진행 구간이 1ms 에 못 미쳐 0 으로 저장된 아주 짧은 실행도 같은 판정을 받아 `null` 이 될 수 있다.
- 실행 중(`running`)에 중지한 실행은 중지 응답의 `activeRunningMs` 에 마지막 구간이 아직 들어 있지 않다. 엔진이 다음 경계에서 그 구간을 더하므로 이후 조회에서 값이 늘어난다. 구간이 하나뿐이면 중지 응답에서는 `null` 이다.

**상세 API 응답의 `nodeExecutions` 항목 예시**

```json
{
  "id": "uuid",
  "executionId": "uuid",
  "nodeId": "node-1",
  "status": "completed",
  "startedAt": "2024-01-15T14:02:30Z",
  "finishedAt": "2024-01-15T14:02:31Z",
  "durationMs": 800,
  "inputData": { "key": "value" },
  "outputData": { "result": "..." },
  "error": null,
  "retryCount": 0,
  "parentNodeExecutionId": null,
  "node": {
    "id": "node-1",
    "type": "transform",
    "label": "Data Transform"
  }
}
```

- `node` 는 노드 참조 `{ id, type, label }` 세 필드만 싣는다. 노드 설정(`config`) · 좌표 같은 다른 노드 컬럼은 싣지 않는다.
- `parentNodeExecutionId` 는 인라인 서브 워크플로우 안에서 실행된 노드면 그 서브 워크플로우 노드 실행의 id 이고 아니면 `null` 이다. 실행 결과 타임라인에서 자식 노드를 묶을 때 쓴다.
- 사용자 행동 기록(`interactionData`)은 싣지 않는다.

## 미결 사항

- **수동 실행 보조 라벨의 이메일 폴백**: 원문의 판정 표는 `User.name` 이 없으면 `email` 을 쓴다고 적는다. 현재 구현(`execution-trigger.ts` 의 `deriveExecutionTrigger`)은 `User.name` 만 쓰고 이름이 비었거나 공백이면 `triggerLabel` 을 null 로 둔다. 코드 주석은 이메일 같은 개인정보를 라벨에 싣지 않으려는 보안 결정이라고 적는다. 원문을 코드에 맞출지, 폴백을 구현할지 결정 필요.

## 구현 위치

- `codebase/backend/src/modules/executions/executions.controller.ts` (목록·상세·재실행·체인 조회 라우트와 역할 게이트. 체인 조회 권한의 근거)
- `codebase/backend/src/modules/executions/executions.service.ts` (목록·상세 조회, 출처 분류, 노드 수 배치 집계)
- `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
- `codebase/backend/src/modules/executions/dto/query-execution.dto.ts`
- `codebase/backend/src/modules/executions/utils/*.ts`
- `codebase/backend/src/shared/utils/redact-stored-error.ts` (응답 단계 에러 마스킹)

## Rationale

### 목록 API 는 노드 실행을 빼고 배치 집계 세 값만 싣는다

목록의 Nodes 열은 `완료 수/전체 수 (N failed)` 만 필요하다. 목록 응답에 노드 실행 본문을 넣으면 페이지당 20행 × 행당 수십 노드의 입출력이 실려 페이로드가 커지고, 행마다 노드 실행을 조회하면 N+1 쿼리가 된다. 그래서 `ExecutionDto` 는 배치 집계 세 값만 싣고(`executions.service.ts` 의 단일 배치 `nodeCountMap` 조회) 노드 실행 본문은 상세 API 에서만 내려준다. 목록의 표시 요구와 상세의 진단 요구를 엔드포인트 수준에서 나눈 것이다. 같은 이유로 `executionPath` 도 **목록 응답에서는 늘 빈 배열**이다. 행마다 `execution_node_log` 를 조회하면 같은 N+1 이 되므로 단건 조회(`findById`)만 따로 채운다.

### 실행 출처를 다섯 값으로 정리하고 판정 순서를 고정한다

실행 한 건에는 출처 신호가 여러 개 동시에 있을 수 있다. 예를 들어 스케줄로 시작된 부모 워크플로우가 서브 워크플로우를 부르면 자식 실행에는 `parent_execution_id` 와 이어받은 맥락이 함께 있다. 클라이언트마다 다른 순서로 해석하면 같은 실행이 화면마다 다른 출처로 보인다. 그래서 판정 표의 순서(`subworkflow` → `manual` → `schedule` → `webhook` → `unknown`)를 백엔드 정리 규칙으로 고정하고 결과만 `triggerSource`·`triggerLabel` 로 싣는다. `subworkflow` 를 가장 앞에 둔 것은 "직접 원인"(부모 실행)이 "근원"(스케줄 등)보다 이 화면의 진단 단위에 맞기 때문이다. `unknown` 은 분류 컬럼이 생기기 전 옛 데이터를 위한 것이다.

### 설정 탭은 뷰어에게도 보이지만 응답 마스킹으로 안전하다

설정 탭은 노드 핸들러가 실은 실행 시 설정(설정 에코)을 보여 준다. `GET /api/executions/:id` 에 `@Roles` 게이트가 없어 설정 탭도 뷰어에게 보인다. 안전성은 역할 제한이 아니라 **응답 단계 마스킹**에 기댄다. `config` 는 DB 에 원문으로 저장되고 나가는 자리에서만 가려진다. REST 는 `redactStoredDataForResponse`, WebSocket 은 `maskWireEnvelope` 이고 둘 다 공유 `deepRedactSecrets*` 를 쓴다. 표현식은 원문을 읽는다. 그래서 뷰어가 보는 값은 마스킹돼 있고 DB 를 직접 읽는 사람은 원문을 본다.

- 이 결정의 대상은 설정 탭의 설정 에코 하나다. 같은 엔드포인트의 `Execution.error`·`nodeExecutions[].error` 는 별개 정책으로 응답 단계에서 마스킹된다. 두 정책을 하나로 읽으면 "error 도 저장 시점에 마스킹된다" 는 틀린 결론이 나온다.
- 기각한 대안(2026-08-24 폐지): 엔진 경계(`handler-output.adapter.ts` 의 `maskSensitiveFields`)에서 저장 전에 마스킹하면 표현식이 같은 `config` 를 읽어 `$node["X"].config.<field>` 참조로 리터럴 `****abcd` 가 워크플로우에 흘러든다.
- 안전 전제는 "두 마스커의 키 기준이 어긋나지 않는다" 이고 `mask-sensitive-fields.util.spec.ts` 의 포함 관계 캐너리가 `DEFAULT_SENSITIVE_KEYS` 를 직접 돌며 확인한다.
- 이 변경의 대가(같은 워크스페이스 안 노드 사이 자격 증명 전달, 생성 시점 한 곳의 안전에서 출구마다 지켜야 하는 안전으로 바뀐 점)와, 그 문제가 실제로 남는 표면이 HTTP Request 노드의 `authentication='custom'` 뿐이라는 분석은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 다룬다. 새 출구를 여는 사람은 그 문서를 읽어야 한다.

같은 전제 위에 체인 조회도 뷰어에게 열려 있다([재실행](CLE-EXEC-RERUN.md#체인-조회-권한은-실행-상세-조회와-같다-2026-10-10) 의 Rationale 참조).

### 실행 목록은 실행 시간을, 요약 카드는 실행 시간과 전체 경과를 보인다 (2026-11-14)

- `duration_ms` 는 시작부터 종료까지라 폼 입력 · 위젯 응답을 기다린 시간이 들어간다. 입력 대기 중 취소 · 시간 초과로 끝난 실행은 기다린 시간 전체가 소요 시간으로 보였다. 대기 회수는 기본 유예가 1시간이고 park 취소는 기한이 없다.
- 목록 · 대시보드 최근 실행 · 에디터 실행 내역 패널은 한 값만 보일 자리라 실행 시간을 보인다. 요약 카드는 자리가 있어 두 값을 함께 보인다.
- 기각한 대안: 상태(`cancelled`)로 `duration_ms` 를 숨기기. REST 중지도 `cancelled` 인데 그 값은 실제 실행 시간이라 정상 값까지 지운다.
- 기각한 대안: 네 곳 모두 두 값 표시. 목록 열이 좁아 읽기 어렵다.
- 기각한 대안: `duration_ms` 를 유지하고 상세에만 실행 시간을 더하기. 목록에서 대기 시간이 실행 시간처럼 보이는 문제가 남는다.
- `activeRunningMs` 의 측정되지 않은 경우를 `null` 로 내보내는 이유: 컬럼이 `NOT NULL DEFAULT 0` 이라 V083 이전 실행이 0 으로 남아 있다. 0 을 그대로 보이면 실제로 0ms 걸린 것처럼 읽힌다. 판정은 서버 한 곳에서 해서 화면 네 곳과 API 소비자가 같은 값을 받게 한다.
- 2026-11-14 엔진이 REST 중지 실행에 마지막 구간을 더하게 된 뒤에도 이 판정을 유지했다(CLE-T-ES1J1E). V083 이전 실행과 엔진이 구간을 더하기 전에 멈춘 실행은 여전히 0 이고, 새 컬럼 없이는 이 0 을 실제 0ms 와 가를 표지가 없다. 기각한 대안: 판정을 없애고 저장 값을 그대로 낸다. V083 이전 실행이 0ms 로 보인다.

### 실행 응답은 한 DTO 로 싣고 노드는 참조 세 필드만 싣는다 (2026-11-14)

- 목록만 `ExecutionDto` 로 조립하고 상세 · 중지 · 체인 · 재실행은 엔티티를 펼쳐 내보냈다. 그래서 선언과 실제가 달랐다. 부모 `workflow` 전 컬럼, 노드 설정 원문(`node.config`, 응답 마스킹을 거치지 않는다), 웹훅 호출자 IP(`sourceIp`), 엔진 내부 상태(`resumeCallStack`)가 선언 없이 나갔고 체인 항목에는 선언한 `triggerSource` · `triggerLabel` 이 빠졌다.
- 웹 앱은 `node` 에서 `label` · `type` 만 읽고 위 미선언 컬럼은 읽지 않는다. 웹채팅 위젯은 EIA 응답을 쓴다.
- 기각한 대안 (a): `node` 를 빼고 `nodeLabel` · `nodeType` 평면 필드를 싣기. 프런트 타입과 실행 상세 · WS 스냅샷 소비처를 함께 바꿔야 하는데 얻는 것이 없다.
- 기각한 대안 (c): 지금 실리는 값을 모두 DTO 에 선언하기. 노드 설정 원문 · 호출자 IP · 엔진 내부 상태를 계약으로 굳힌다.
- 체인 · 중지 응답의 노드 집계도 목록처럼 실행 id 묶음에 대한 배치 집계 한 번으로 센다. 항목마다 따로 세지 않는다.
