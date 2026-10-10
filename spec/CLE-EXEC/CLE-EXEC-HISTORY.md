---
id: "CLE-EXEC-HISTORY"
title: "실행 내역"
type: "feature"
version: 1
status: "approved"
requirements: ["REQ-EXHIST-001", "REQ-EXHIST-002", "REQ-EXHIST-003", "REQ-EXHIST-004", "REQ-EXHIST-005", "REQ-EXHIST-006", "REQ-EXHIST-007", "REQ-EXHIST-008", "REQ-EXHIST-009", "REQ-EXHIST-010", "REQ-EXHIST-011", "REQ-EXHIST-012", "REQ-EXHIST-013", "REQ-EXHIST-014", "REQ-EXHIST-015", "REQ-EXHIST-016", "REQ-EXHIST-017", "REQ-EXHIST-018", "REQ-EXHIST-019", "REQ-EXHIST-020", "REQ-EXHIST-021", "REQ-EXHIST-022", "REQ-EXHIST-023", "REQ-EXHIST-024", "REQ-EXHIST-025", "REQ-EXHIST-026", "REQ-EXHIST-027", "REQ-EXHIST-028", "REQ-EXHIST-029", "REQ-EXHIST-030", "REQ-EXHIST-031", "REQ-EXHIST-032", "REQ-EXHIST-033", "REQ-EXHIST-034", "REQ-EXHIST-035", "REQ-EXHIST-036", "REQ-EXHIST-037", "REQ-EXHIST-038", "REQ-EXHIST-039", "REQ-EXHIST-040", "REQ-EXHIST-041", "REQ-EXHIST-042", "REQ-EXHIST-043", "REQ-EXHIST-044", "REQ-EXHIST-045"]
basis_superseded: false
parent: "CLE-EXEC"
ancestors: ["CLE-VISION", "CLE-EXEC"]
area: "CLE-EXEC"
content_hash: "9e0bed0619a7230245a6f419b9037eae788a2de34bfc9e2d3eeb1b4915cc8626"
read_as: "approved_fallback"
task: "CLE-T-GN2THF"
source_paths: ["spec/2-navigation/14-execution-history.md", "spec/2-navigation/_product-overview.md"]
mirror_sha256: "7ab2cb12f8bc18c0c72ae0ce0ddc60ff5dcea51e3fa244c877c268dbffa878ad"
etag: "sha256-cea8c4ac9b78f142bff2e5cd08cfc2feacad4ff6849031387483701dec1c9564"
---
> 구현 상태: 구현됨 (EH-DETAIL-12 여러 노드 대화 재구성 보기만 v2 미구현) · 원문: `spec/2-navigation/14-execution-history.md`, `spec/2-navigation/_product-overview.md` (§3.15 Execution History) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

실행 내역(Execution History)은 워크플로우별 실행 목록을 보고 실행 한 건의 노드별 결과(입출력·에러·타임라인)를 살펴보는 화면이다. 대시보드, 워크플로우 목록, 에디터 같은 여러 진입점에서 들어온다. 화면은 실행 목록과 실행 상세 두 단계다.

이 문서는 두 화면의 구성, 실행 출처 분류, 목록·상세 API, 진입점, 반응형 배치를 정한다.

범위 밖:

- 실행 상세의 노드 결과 탭(미리보기·입력·출력·응답·요청·LLM 사용량·설정·메타·포트·상태·참조·오류)은 에디터 실행 결과 드로어와 같은 컴포넌트(`ResultDetail`)를 쓴다. 탭 구성·조건·기본 탭·자동 전환은 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 이 정한다.
- 대화 기록을 그리는 규칙은 [대화 미리보기](CLE-EXEC-PREVIEW.md), 노드 출력을 내역 화면에 복원하는 경로는 [실행 화면 복원 규약](CLE-EXEC-HYDRATION.md) 이 정한다.
- 재실행 버튼·체인 표시의 정책과 API 는 [재실행](CLE-EXEC-RERUN.md) 이 정한다. 이 문서는 화면 배치만 적는다.
- 에디터 안 실행 내역 패널은 [에디터 실행과 디버깅](CLE-EXEC-RUN.md), 실행·노드 실행 엔티티는 [실행 데이터와 흐름](CLE-EXEC-DATA.md), 실행 상태 값과 전이는 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) 가 정한다.

## 요구사항

- REQ-EXHIST-001 WHEN 사용자가 워크플로우의 실행 목록 화면을 열면 THE SYSTEM SHALL 그 워크플로우의 모든 실행을 테이블로 표시한다. (원본: EH-LIST-01)
- REQ-EXHIST-002 WHEN 실행 목록을 표시하면 THE SYSTEM SHALL 행마다 상태·실행 출처·시작 시각·소요 시간·노드 실행 현황을 표시한다. (원본: EH-LIST-02)
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
- REQ-EXHIST-016 WHEN 사용자가 실행 상세 화면을 열면 THE SYSTEM SHALL 상태·시작 시각·종료 시각·소요 시간·노드 실행 현황을 담은 요약 카드를 표시한다. (원본: EH-DETAIL-01)
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

## 화면과 경로

| 화면 | 경로 | 설명 |
| --- | --- | --- |
| 실행 목록 | `/w/<slug>/workflows/:id/executions` | 워크플로우 하나의 모든 실행 |
| 실행 상세 | `/w/<slug>/workflows/:id/executions/:executionId` | 실행 한 건의 노드별 결과 |

두 화면 모두 `(main)` 레이아웃 그룹에 속한다(사이드바 포함). `<slug>` 는 현재 워크스페이스의 slug 다. slug 라우팅 규칙은 [레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md) 이 정한다.

```text
codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/
├── page.tsx                    # 실행 목록
└── [executionId]/
    └── page.tsx                # 실행 상세
```

## 실행 목록

### 화면 구성

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 머리 | 위 | Back 링크, "<워크플로우 이름> — Executions", "Open in Editor →" 링크 | [머리](#머리) 참조 |
| 상태 필터 | 머리 아래 | `[All] [Completed] [Failed] [Running] [Cancelled] [Waiting]` | [상태 필터](#상태-필터) 참조 |
| 테이블 | 가운데 | `Status`, `Trigger`, `Started At`, `Duration`, `Nodes` 다섯 열 | [테이블](#테이블) 참조 |
| 페이지네이션 | 아래 | `← 1 2 3 ... 10 →` | [정렬과 페이지네이션](#정렬과-페이지네이션) 참조 |

### 머리

| 요소 | 설명 |
| --- | --- |
| Back 링크 | 이전 화면으로 돌아간다(`router.back()`). 진입점이 여럿(대시보드·목록·에디터)이라 고정 경로 대신 브라우저 기록으로 돌아가는 것이 의도다. 상세 화면의 "← Executions" 가 고정 링크인 것과 비대칭인 것이 맞다. 상세의 자연스러운 상위는 늘 목록이기 때문이다 |
| 워크플로우 이름 | 해당 워크플로우 이름 |
| "Open in Editor" 링크 | 에디터(`/w/<slug>/workflows/:id`)로 이동 |

### 상태 필터

상태 필터 버튼을 가로로 둔다. 고른 필터는 활성 스타일(`variant="default"`), 나머지는 비활성 스타일(`variant="outline"`)이다.

| 필터 | 값 | 설명 |
| --- | --- | --- |
| All | 없음 | 모든 실행(기본값) |
| Completed | `completed` | 완료된 실행 |
| Failed | `failed` | 실패한 실행 |
| Running | `running` | 실행 중인 실행 |
| Cancelled | `cancelled` | 취소된 실행 |
| Waiting | `waiting_for_input` | 입력 대기 중인 실행 |

대기 중(`pending`)은 실행의 유효한 상태지만 필터에서 일부러 뺀다. 실행 시작 직전의 순간적인 상태라 사용자가 조회하거나 조치할 대상이 아니다. All 필터에서는 그대로 보인다. 상태 값과 전이는 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) 가 정한다.

### 테이블

| 열 | 설명 | 정렬 |
| --- | --- | --- |
| Status | 상태 아이콘과 텍스트(`✅ Completed`, `❌ Failed`, `⏳ Running`, `⛔ Cancelled`, `🙋 Waiting`) | 가능 |
| Trigger | 실행 출처. 아이콘, 출처 라벨, 보조 라벨(트리거 이름·실행한 사람·부모 워크플로우 이름) | 없음 |
| Started At | 실행 시작 시각(`YYYY-MM-DD HH:mm:ss`) | 가능(기본 내림차순) |
| Duration | 소요 시간(초·분 자동 전환). 실행 중이면 `—` | 가능 |
| Nodes | 노드 실행 현황(`완료 수/전체 수`, 실패가 있으면 `(N failed)`) | 없음 |

**Nodes 열**: 목록 API(`GET /api/executions/workflow/:workflowId`)의 `ExecutionDto` 는 N+1 을 피하면서 배치 집계 필드 `totalNodeCount`·`completedNodeCount`·`failedNodeCount` 를 응답한다(`executions.service.ts` 의 배치 `nodeCountMap`). 화면(`page.tsx`)은 이 세 값으로 `완료 수/전체 수`(실패 시 `(N failed)`)를 그린다. 노드 실행 본문(`nodeExecutions`)은 목록 응답에 넣지 않는다.

| 동작 | 설명 |
| --- | --- |
| 행 클릭 | 그 실행의 상세(`/w/<slug>/workflows/:id/executions/:executionId`)로 이동 |
| 행 호버 | `hover:bg-[hsl(var(--muted))/0.5]` 배경 |

### 실행 출처 분류

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

`triggerSource`(화면용 다섯 값)는 엔진 내부 마커 `__triggerSource`(세 값, [트리거 노드 공통](../CLE-NODE-TRIG/CLE-NODE-TRIG-COMMON.md)·[트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md))와 **다른 식별자**다. 내부 마커는 트리거 노드 입력 페이로드의 출처 표시이고 이 DTO 필드는 `parent_execution_id` 판정까지 포함한 화면용 정리 결과라 값 집합과 층이 다르다.

### 정렬과 페이지네이션

- 테이블 머리를 누르면 오름차순과 내림차순이 토글된다. 현재 정렬 열에 화살표를 표시한다. 기본 정렬은 `started_at` 내림차순이다.
- 페이지당 20건이다. 이전·다음 버튼과 페이지 번호 버튼을 둔다. 워크플로우 목록 화면과 같은 패턴이다.
- 필터를 바꾸면 1페이지로 돌아간다.

### 빈 상태와 로딩

- **빈 상태**: 실행 기록이 없으면 Activity 아이콘, "No executions yet", "Run this workflow to see execution history here.", "Open in Editor →" 버튼을 표시한다. 빈 상태 공통 패턴은 [오류 화면과 빈 상태](../CLE-UI/CLE-UI-ERRORS.md) 가 정한다.
- **로딩**: 테이블 자리에 스켈레톤(`animate-pulse`) 5행을 표시한다.

## 실행 상세

### 화면 구성

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 머리 | 위 | "← Executions", 재실행 버튼, `[← Prev] [Next →]` | 목록으로 돌아가기, 재실행 모달, 이전·다음 실행 이동 |
| 요약 카드 | 머리 아래 | 상태, 시작·종료 시각, 소요 시간, 노드 현황, 실패 시 에러, 재실행 체인 배지 | [요약 카드](#요약-카드), [재실행과 체인 표시](#재실행과-체인-표시) 참조 |
| 노드 목록 | 왼쪽 | 실행된 노드와 상태 아이콘(skipped 제외) | 고른 노드를 강조하고 오른쪽에 상세를 표시 |
| 노드 상세 | 오른쪽 | 노드 이름, 유형 배지, 상태, 소요 시간, 결과 상세 탭 | [노드 결과 패널](#노드-결과-패널) 참조 |

### 요약 카드

| 필드 | 설명 |
| --- | --- |
| 상태 | 아이콘과 텍스트(배지 스타일) |
| 시작 시각 | `YYYY-MM-DD HH:mm:ss` |
| 종료 시각 | `HH:mm:ss`(같은 날이면 시간만) 또는 `—`(끝나지 않음) |
| 소요 시간 | 초·분 자동 전환 |
| 노드 실행 현황 | `완료 수 / 전체 수 completed`(실패가 있으면 `N failed` 추가) |

실패 상태면 요약 카드에 에러 메시지(예: `Error: Connection timeout on "API Call" node`)를 더 표시한다.

### 노드 결과 패널

요약 카드 아래에 좌우 2분할로 노드 목록과 노드 상세를 표시한다.

- **왼쪽 노드 목록**: 실행된 노드만 상태 아이콘과 함께 나열한다. 건너뛴(skipped) 노드는 뺀다. 고른 노드를 강조한다.
- **오른쪽 노드 상세**: 노드 이름, 유형 배지, 상태, 소요 시간을 표시하고 그 아래에 결과 상세 탭을 둔다. 실행 상세 화면은 에디터 실행 결과 드로어와 **같은 `ResultDetail` 컴포넌트**를 다시 쓴다. 그래서 탭 전체 구성·조건·기본 탭(대화형 AI 오류 종료 시 미리보기 우선 예외 포함)·자동 전환은 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 의 결과 상세 탭 규칙을 그대로 따른다. AI 노드의 출력 탭 확장(메타데이터 표, 추출 필드 카드)과 LLM 사용량·응답·요청 탭도 같은 문서에 있다.

### 미리보기 탭

미리보기 탭은 노드 유형마다 다른 시각 미리보기를 보여 준다. 출력 JSON 은 출력 탭에서 본다.

- **Presentation 노드**(table, carousel, chart, template, form): 에디터 실행 때와 같은 시각 렌더를 보여 준다. 유형별 렌더는 [에디터 실행과 디버깅](CLE-EXEC-RUN.md) 의 Presentation 노드 콘텐츠 표를 따른다. Carousel 은 가로 스크롤 텍스트 중심 카드 목록(제목·설명·버튼 라벨, `layout` 배지, lazy 썸네일)이고 시각 레이아웃 재구성은 대화형 채널이 맡는다([Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md)). Form 은 제출된 데이터를 보여 준다.
- **버튼이 있는 노드**: 노드의 `buttonConfig.buttons` 에서 버튼 전체 목록을 표시한다. 실행이 끝난 뒤 선택된 버튼(`buttonId` 일치)은 primary 색으로 강조하고 선택되지 않은 버튼은 outline 스타일의 비활성으로 표시한다.
- **AI 에이전트·정보 추출기(멀티턴) 노드**: 끝난 대화를 채팅 스레드 모양으로 보여 준다. **정상 종료(`completed`)뿐 아니라 오류 종료(`failed`)도 포함한다.** 노드 `outputData` 는 실패해도 저장되므로(`output.error` 와 일부 `output.result.*` 가 함께 있다, [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md)) 새로고침 뒤에도 대화가 복원되고 마지막에 `system_error` 가 인라인으로 표시된다. 내역 화면의 `system_error` 에는 `nodeExecutionId` 가 없어서 [다시 시도] 버튼은 자동으로 숨는다. 복원 규칙은 [대화 미리보기](CLE-EXEC-PREVIEW.md) 의 데이터 소스와 Inv-8 이 정한다.
  - 턴 수와 종료 사유를 표시한다.
  - User·Assistant 메시지를 말풍선으로 나열한다.
  - 도구 호출 배지는 접고 펼 수 있다.
  - **메시지 클릭**: 그 메시지의 상세 내용만 인라인으로 표시한다. assistant 는 본문과 도구 호출 배지, user 는 메시지 내용과 타임스탬프, tool 은 인자와 결과다. assistant 메시지의 원문 요청·응답·사용량은 상세의 응답·요청·LLM 사용량 탭에서 본다. 미리보기 탭은 대화 스레드에 집중한다.
  - "← Back to conversation" 버튼으로 스레드 보기로 돌아간다.
- **일반 노드**: 상태(Status)와 소요 시간(Duration)을 표시한다. 에러가 있으면 에러 메시지도 표시한다.

### 에러 상태

| 상태 | 표시 |
| --- | --- |
| Loading | 스켈레톤 3블록 |
| API Error | "Failed to load execution. Please try again." 과 Back 버튼 |
| Not Found | "Execution not found." 와 Back 버튼 |

### 이전·다음 실행 이동

- 상세 화면 머리 오른쪽에 `← Prev`·`Next →` 버튼을 둔다.
- 같은 워크플로우의 시간 순서에서 이전·다음 실행으로 이동한다.
- 첫 실행과 마지막 실행에서는 해당 버튼을 비활성화한다.

### 재실행과 체인 표시

요약 카드 오른쪽 머리에 재실행(Re-run) 버튼이 있다. 누르면 입력 데이터 미리보기·편집 모달이 열리고 dry-run 토글로 외부 호출을 건너뛴 흐름 검증도 할 수 있다. 모달·정책·API 는 [재실행](CLE-EXEC-RERUN.md) 이 정한다.

| 영역 | 위치 | 들어가는 요소 |
| --- | --- | --- |
| 머리 | 위 | "← Executions", `[⟳ Re-run]`, `[← Prev] [Next →]` |
| 요약 | 가운데 | 상태, 시작 시각과 소요 시간, 노드 현황 |
| 체인 줄 | 요약 아래 | `📎 #3-th re-run · dry-run · 원본: #1234` 와 `[View chain (4) ▼]` |

| 요소 | 표시 조건 | 동작 |
| --- | --- | --- |
| `[⟳ Re-run]` 버튼 | 항상 표시 | 권한이 없으면 비활성화하고 툴팁 `history.rerun.permissionDenied` 를 단다. 재실행은 편집자 이상만 할 수 있다([재실행](CLE-EXEC-RERUN.md)). 누르면 재실행 모달을 연다. 역할별 동작은 [역할별 표시](#역할별-표시) 참조 |
| 체인 배지 | `execution.reRunOf != null` | "#N-th re-run · 원본: <ID>". dry-run 이면 "· dry-run" 을 붙인다. 원본 ID 를 누르면 **같은 탭**에서 원본 상세로 이동한다(`<Link href>`, `target=_blank` 없음). 재실행 **모달**의 원본 ID 링크는 새 탭이다. 체인 배지는 내비게이션이라 같은 탭, 모달은 편집 맥락을 지키려고 새 탭이다(의도한 구분) |
| `[View chain (N) ▼]` 드롭다운 | 체인의 실행이 2개 이상 | 누르면 `GET /api/executions/:id/chain` 응답을 펼친다. 항목마다 ID, 시작 시각, 최종 상태, dry-run 여부를 보여 준다. 재실행 권한이 없는 멤버(뷰어 포함)에게도 같은 조건으로 보인다([역할별 표시](#역할별-표시)) |

모달에서 "재실행" 을 누르면 `POST /api/executions/:executionId/re-run` 응답의 새 실행 ID 로 `/w/<slug>/workflows/:workflowId/executions/:newId` 로 이동한다. i18n 키와 에러 매핑은 [재실행](CLE-EXEC-RERUN.md) 에 있다.

실행 상세 화면에는 에디터 실행 결과 드로어와 같은 모양으로 Background 본문 실행 결과 섹션도 표시된다([에디터 실행과 디버깅](CLE-EXEC-RUN.md)).

#### 역할별 표시

체인 배지와 `[View chain (N) ▼]` 드롭다운은 실행 상세를 볼 수 있는 워크스페이스 멤버 모두에게 같은 조건으로 보인다. 재실행 버튼은 역할과 원본 실행의 시작자를 함께 보고 켠다(`canReRun`). 재실행은 편집자 이상만 할 수 있다. 버튼을 켜는 자세한 기준은 [재실행](CLE-EXEC-RERUN.md) 이 정한다.

| 역할 | 체인 배지 · 드롭다운 | `[⟳ Re-run]` 버튼 |
| --- | --- | --- |
| 뷰어 | 보인다 | 늘 비활성. 툴팁 `history.rerun.permissionDenied` 를 단다 |
| 편집자 | 보인다 | 자기가 시작한 실행과 시작자가 없는 자동 실행에서 활성. 남이 시작한 실행에서는 비활성이고 툴팁을 단다 |
| 소유자 · 관리자 | 보인다 | 활성 |

체인 조회 API 의 권한은 [API](#api) 절에 있다.

## 진입점

| 진입점 | 동작 |
| --- | --- |
| 대시보드 Recent Executions | 행을 누르면 그 실행의 상세(`/w/<slug>/workflows/:workflowId/executions/:executionId`)로 이동한다. 행에 `cursor-pointer` 를 준다([대시보드](../CLE-OBS/CLE-OBS-DASHBOARD.md)) |
| 워크플로우 목록 | 워크플로우 행의 더보기(⋯) 메뉴에 "실행 내역"(Execution History) 항목이 있다. i18n `workflows.executionHistory`(ko/en), [워크플로우 목록과 폴더](../CLE-WF/CLE-WF-LIST.md) 와 같은 라벨이다. 누르면 실행 목록(`/w/<slug>/workflows/:id/executions`)으로 이동한다 |
| 워크플로우 에디터 | 실행 결과 영역의 "View All Executions" 링크와 에디터 안 실행 내역 패널의 "전체 실행" 링크가 실행 목록으로 이동한다([에디터 실행과 디버깅](CLE-EXEC-RUN.md)) |
| AI 어시스턴트 | 읽기 전용 도구 `get_workflow_executions`·`get_execution_details` 로 현재 워크플로우의 실행 목록과 상세를 조회한다. 직계 자식 1단계를 포함하고 `subExecutionsTruncatedDepth` 로 잘린 깊이를 알린다. 키 기준과 값 기준 두 겹으로 마스킹하고(출력 `***`), `running`·`waiting_for_input` 실행은 부분 타임라인을 허용한다. 도구 정의는 [AI 어시스턴트 도구](../CLE-WF/CLE-WF-ASSIST-TOOLS.md) 가 정한다 |

## API

| 메서드 | 경로 | 설명 | 비고 |
| --- | --- | --- | --- |
| GET | `/api/executions/workflow/:workflowId` | 워크플로우별 실행 목록 | 페이지네이션·상태 필터·정렬 지원. 응답 형식은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 목록 응답을 따른다. **노드 실행은 싣지 않는다**(N+1 회피, [테이블](#테이블) 의 Nodes 열 참조) |
| GET | `/api/executions/:id` | 실행 상세 | `nodeExecutions` 배열 포함 |
| POST | `/api/executions/:executionId/re-run` | 원본 실행을 바탕으로 새 실행 시작 | EH-DETAIL-10. 명세는 [재실행](CLE-EXEC-RERUN.md) |
| GET | `/api/executions/:executionId/chain` | 같은 체인의 모든 실행을 시간순으로 반환 | EH-DETAIL-11. 명세는 [재실행](CLE-EXEC-RERUN.md) |

`GET /api/executions/:id` 는 따로 `@Roles` 게이트가 없어 워크스페이스 멤버 전원(뷰어 포함)이 조회한다. 응답의 `Execution.error`·`nodeExecutions[].error`·`config` 등은 응답 단계에서 마스킹된다. 기준은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이다.

체인 조회(`GET /api/executions/:executionId/chain`)와 재실행(`POST /api/executions/:executionId/re-run`)의 권한은 [재실행](CLE-EXEC-RERUN.md) 이 정한다. 체인 배지와 `[View chain (N) ▼]` 드롭다운은 실행 상세를 볼 수 있는 멤버 모두에게 같은 조건으로 보인다. 재실행 권한은 이 표시 조건에 들어가지 않는다([역할별 표시](#역할별-표시)).

**목록 API 쿼리 파라미터**

| 파라미터 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `page` | number | 1 | 페이지 번호 |
| `limit` | number | 20 | 페이지당 건수(최대 100) |
| `sort` | string | `started_at` | 정렬 기준(`started_at`, `finished_at`, `status`, `duration_ms`). 기본값이 API 규약 예시(`created_at`)와 다른 것은 의도한 도메인 예외다. 실행 기록의 자연스러운 정렬 축은 생성 시각이 아니라 시작 시각이다 |
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
  "node": {
    "id": "node-1",
    "type": "transform",
    "label": "Data Transform"
  }
}
```

## 반응형

| 화면 폭 | 배치 |
| --- | --- |
| 1280px 이상 | 기본 배치 |
| 768px ~ 1279px | 노드 결과 2분할을 세로로 쌓는다 |
| 768px 미만 | 전체를 세로로 쌓고 테이블을 카드형 목록으로 바꾼다 |

## 미결 사항

- **수동 실행 보조 라벨의 이메일 폴백**: 원문의 판정 표는 `User.name` 이 없으면 `email` 을 쓴다고 적는다. 현재 구현(`execution-trigger.ts` 의 `deriveExecutionTrigger`)은 `User.name` 만 쓰고 이름이 비었거나 공백이면 `triggerLabel` 을 null 로 둔다. 코드 주석은 이메일 같은 개인정보를 라벨에 싣지 않으려는 보안 결정이라고 적는다(ai-review 조치 커밋 `e3c578c22`). 원문을 코드에 맞출지, 폴백을 구현할지 결정 필요.

## 구현 위치

- `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/**` (실행 목록·상세 화면)
- `codebase/frontend/src/lib/executions/can-rerun.ts` (재실행 버튼 활성 판정 `canReRun`)
- `codebase/backend/src/modules/executions/executions.controller.ts` (목록·상세·재실행·체인 조회 라우트와 역할 게이트. 체인 조회 권한의 근거)
- `codebase/backend/src/modules/executions/executions.service.ts` (목록·상세 조회, 출처 분류, 노드 수 배치 집계)
- `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
- `codebase/backend/src/modules/executions/dto/query-execution.dto.ts`
- `codebase/backend/src/modules/executions/utils/*.ts`
- `codebase/backend/src/shared/utils/redact-stored-error.ts` (응답 단계 에러 마스킹)

## Rationale

### 목록 API 는 노드 실행을 빼고 배치 집계 세 값만 싣는다

목록의 Nodes 열은 `완료 수/전체 수 (N failed)` 만 필요하다. 이것 때문에 목록 응답에 노드 실행 본문을 넣으면 페이지당 20행 × 행당 수십 노드의 입출력이 실려 페이로드가 커지고 행마다 노드 실행을 조회하면 N+1 쿼리가 된다. 그래서 `ExecutionDto` 는 배치 집계 필드 `totalNodeCount`·`completedNodeCount`·`failedNodeCount` 만 싣고(`executions.service.ts` 의 단일 배치 `nodeCountMap` 조회), 노드 실행 본문은 상세 API 에서만 내려준다. 목록의 표시 요구와 상세의 진단 요구를 엔드포인트 수준에서 나눈 것이다. 같은 이유로 `executionPath` 도 **목록 응답에서는 늘 빈 배열**이다. 행마다 `execution_node_log` 를 조회하면 같은 N+1 이 되므로 단건 조회(`findById`)만 따로 채운다.

### 실행 출처를 다섯 값으로 정리하고 판정 순서를 고정한다

실행 한 건에는 출처 신호가 여러 개 동시에 있을 수 있다. 예를 들어 스케줄로 시작된 부모 워크플로우가 서브 워크플로우를 부르면 자식 실행에는 `parent_execution_id` 와 이어받은 맥락이 함께 있다. 클라이언트마다 다른 순서로 해석하면 같은 실행이 화면마다 다른 출처로 보인다. 그래서 판정 표의 순서(`subworkflow` → `manual` → `schedule` → `webhook` → `unknown`)를 백엔드 정리 규칙으로 고정하고 결과만 `triggerSource`·`triggerLabel` 로 싣는다. `subworkflow` 를 가장 앞에 둔 것은 "직접 원인"(부모 실행)이 "근원"(스케줄 등)보다 이 화면의 진단 단위에 맞기 때문이다. `unknown` 은 분류 컬럼이 생기기 전 옛 데이터를 위한 것이다.

### 건너뛴 노드를 상세 목록에서 뺀다 (EH-DETAIL-05)

분기(If/Else·Switch)로 실행되지 않은 노드에는 입출력·에러·소요 시간이 없어 진단 가치가 없다. 큰 워크플로우에서는 목록 대부분을 차지해 실패 노드를 찾기 어렵게 만든다. 이 화면은 "이 실행에서 실제로 무슨 일이 있었나" 를 보는 곳이라 실행된 노드만 남긴다. 어떤 노드가 왜 건너뛰어졌는지는 에디터 실행 결과(분기 표시)에서 본다.

### 설정 탭은 뷰어에게도 보이지만 응답 마스킹으로 안전하다

노드 상세의 설정 탭은 노드 핸들러가 실은 실행 시 설정(설정 에코)을 보여 준다. `GET /api/executions/:id` 는 따로 `@Roles` 게이트가 없어 뷰어를 포함한 워크스페이스 멤버 전원이 조회하므로 설정 탭도 뷰어에게 보인다. 안전성은 역할 제한이 아니라 **응답 단계 마스킹**에 기댄다. `config` 는 DB 에 원문으로 저장되고 나가는 자리에서만 가려진다. REST 는 `redactStoredDataForResponse`, WebSocket 은 `maskWireEnvelope` 이고 둘 다 공유 `deepRedactSecrets*` 를 쓴다. 표현식은 원문을 읽는다. 그래서 뷰어가 보는 값은 마스킹돼 있고 DB 를 직접 읽는 사람은 원문을 본다.

- 이 결정의 대상은 설정 탭의 설정 에코 하나다. 같은 엔드포인트의 `Execution.error`·`nodeExecutions[].error` 는 별개 정책으로 응답 단계에서 마스킹된다. 두 정책을 하나로 읽으면 "error 도 저장 시점에 마스킹된다" 는 틀린 결론이 나온다.
- 예전에는 엔진 경계(`handler-output.adapter.ts` 의 `maskSensitiveFields`)에서 저장 전에 마스킹했다. 그런데 표현식 컨텍스트가 같은 `config` 를 읽고 사용자가 `$node["X"].config.<field>` 참조를 쓰게 되면서 리터럴 `****abcd` 가 워크플로우에 흘러들었다. 그래서 경계 마스킹을 없애고 응답 단계 마스킹만 남겼다(2026-08-24).
- 안전 전제는 "두 마스커의 키 기준이 어긋나지 않는다" 이고 `mask-sensitive-fields.util.spec.ts` 의 포함 관계 캐너리가 `DEFAULT_SENSITIVE_KEYS` 를 직접 돌며 확인한다.
- 이 변경의 대가(같은 워크스페이스 안 노드 사이 자격 증명 전달, 생성 시점 한 곳의 안전에서 출구마다 지켜야 하는 안전으로 바뀐 점)와, 그 문제가 실제로 남는 표면이 HTTP Request 노드의 `authentication='custom'` 뿐이라는 분석은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 다룬다. 새 출구를 여는 사람은 그 문서를 읽어야 한다.

같은 전제 위에 체인 조회도 뷰어에게 열려 있다([재실행](CLE-EXEC-RERUN.md#체인-조회-권한은-실행-상세-조회와-같다-2026-10-10) 의 Rationale 참조).

### EH-DETAIL-06(단일 노드)과 EH-DETAIL-12(여러 노드, v2)를 나눈다

원래 EH-DETAIL-06 하나가 서로 다른 두 요구를 가리켰다. (a) 단일 AI 에이전트 노드의 미리보기 탭(구현 완료)과 (b) 여러 노드를 가로지르는 대화 스레드 재구성 보기(v2, 미구현)다. 한 ID 가 완료와 미해결을 동시에 뜻해 요구사항 ID 로 상태를 판정하는 도구가 잘못 판단할 수 있었다. 또 대화 스레드 규약은 "EH-DETAIL-06 의 재구성 정책에 맡긴다" 고 했는데 그 정책이 어디에도 없어 가리키는 곳이 없었다. 그래서 여러 노드 재구성에 새 ID EH-DETAIL-12(v2)를 주고 참조를 옮겼으며 EH-DETAIL-06 은 단일 노드 범위(구현됨)로 고정했다. 실행 내역 요구사항은 모두 구현돼 이 문서는 구현됨 상태를 유지한다. v2 항목 EH-DETAIL-12 는 [Clemvion 제품 개요](../CLE-VISION.md) 의 로드맵에서 추적한다. 여러 노드 재구성 보기의 모델은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 의 v2 로드맵에 있다.

### 재실행 버튼과 체인 표시의 설계 결정은 재실행 문서에 둔다

재실행 버튼과 체인 추적의 설계 결정은 [재실행](CLE-EXEC-RERUN.md) 의 Rationale 이 기준이다. 뷰어에게도 체인을 보이고 재실행 버튼만 막기로 한 결정(2026-10-10)의 근거도 [재실행](CLE-EXEC-RERUN.md#체인-조회-권한은-실행-상세-조회와-같다-2026-10-10) 에 있다. 이 문서는 화면 배치만 정한다.
