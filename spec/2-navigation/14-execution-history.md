---
id: execution-history
status: implemented
code:
  - codebase/frontend/src/app/(main)/workflows/[id]/executions/**
  - codebase/backend/src/modules/executions/executions.service.ts
  - codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts
  - codebase/backend/src/modules/executions/dto/query-execution.dto.ts
  - codebase/backend/src/modules/executions/utils/*.ts
---

# Spec: 워크플로우 실행 내역

> 관련 문서: [Spec 대시보드](./0-dashboard.md) · [Spec 워크플로우 목록](./1-workflow-list.md) · [Spec 실행/디버깅](../3-workflow-editor/3-execution.md) · [데이터 모델 - Execution](../1-data-model.md#213-execution)

---

## Overview (제품 정의)

---

### 1. 개요

워크플로우 실행 내역 기능은 사용자가 특정 워크플로우의 모든 실행 이력을 조회하고, 개별 실행의 노드별 상세 결과를 확인할 수 있는 기능이다. 대시보드, 워크플로우 목록, 에디터 등 다양한 진입점에서 접근할 수 있다.

#### 1.1 배경

현재 실행 결과는 워크플로우 에디터 내부에서만 확인할 수 있어, 과거 실행 이력을 돌아보거나 특정 워크플로우의 실행 패턴을 파악하기 어렵다. 대시보드의 Recent Executions에서 워크플로우를 클릭해도 아무 동작이 없으며, 실행 이력을 체계적으로 탐색할 수 있는 별도의 화면이 필요하다.

#### 1.2 목표

- 워크플로우별 실행 이력을 한눈에 파악
- 개별 실행의 노드별 상세 결과 확인 (I/O 데이터, 에러, 타임라인)
- 실패한 실행의 원인을 빠르게 진단
- 기존 화면(대시보드, 워크플로우 목록, 에디터)과 자연스러운 네비게이션

---

### 2. 페이지 구조

2단계 구조로 구성한다:

```
/workflows/:id/executions              → 워크플로우별 실행 내역 목록
/workflows/:id/executions/:executionId → 개별 실행 상세
```

---

### 3. 요구사항

#### 3.1 실행 내역 목록 페이지

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| EH-LIST-01 | 해당 워크플로우의 전체 실행 이력을 테이블 형태로 표시 | 필수 | ✅ |
| EH-LIST-02 | 각 행에 상태, 시작 시간, 소요 시간, 트리거 유형 표시 | 필수 | ✅ |
| EH-LIST-03 | 상태별 필터링 (All, Completed, Failed, Running, Cancelled, Waiting for Input) | 필수 | ✅ |
| EH-LIST-04 | 정렬 지원 (시작 시간, 소요 시간, 상태) | 필수 | ✅ |
| EH-LIST-05 | 페이지네이션 (페이지당 20건) | 필수 | ✅ |
| EH-LIST-06 | 행 클릭 시 실행 상세 페이지로 이동 | 필수 | ✅ |
| EH-LIST-07 | 헤더에 워크플로우 이름, 에디터로 이동 링크 표시 | 필수 | ✅ |
| EH-LIST-08 | 실행 이력이 없을 때 빈 상태 안내 표시 | 필수 | ✅ |

#### 3.2 실행 상세 페이지

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| EH-DETAIL-01 | 실행 요약 정보 표시 (상태, 시작/종료 시간, 소요 시간, 노드 실행 현황) | 필수 | ✅ |
| EH-DETAIL-02 | 노드 결과 패널: 좌측 노드 목록 + 우측 노드 상세 (2분할 레이아웃) | 필수 | ✅ |
| EH-DETAIL-03 | 노드 상세 서브 탭: Preview / Input / Output / Config / Error. AI 노드는 LLM Usage 탭 추가. AI Multi Turn 타임라인에서 assistant 메시지 선택 시 Preview / Response / Request / LLM Usage 구성으로 전환 | 필수 | ✅ |
| EH-DETAIL-04 | 실패한 노드 하이라이트 및 에러 메시지 표시 | 필수 | ✅ |
| EH-DETAIL-05 | Skipped 상태 노드는 목록에서 제외 | 필수 | ✅ |
| EH-DETAIL-06 | Preview 탭: Presentation 노드는 시각적 프리뷰, AI Agent 노드는 대화 내역 + 메시지별 상세, 일반 노드는 상태 요약 | 필수 | ✅ |
| EH-DETAIL-07 | Preview 탭: 버튼이 있는 노드는 모든 버튼 표시 + 선택된 버튼 하이라이트 | 필수 | ✅ |
| EH-DETAIL-08 | 실행 목록으로 돌아가기 네비게이션 | 필수 | ✅ |
| EH-DETAIL-09 | 이전/다음 실행으로 이동 | 권장 | ✅ |
| EH-DETAIL-10 | 실행 상세 헤더에 "Re-run" 버튼 + 입력 미리보기·편집 모달. dry-run 토글 포함. 권한·dry-run 미지원 시 disabled + tooltip. 모달 명세는 [Spec Re-run §10.2](../5-system/13-replay-rerun.md#102-re-run-모달) | 필수 | ✅ |
| EH-DETAIL-11 | Re-run chain 표시 — `re_run_of != null` 인 실행은 chain badge ("#N-th re-run · dry-run · 원본: <ID>") + "View chain" 드롭다운. 모델은 [Spec Re-run §RR-PL-05](../5-system/13-replay-rerun.md#rr-pl-05--chain-추적-모델-e3) | 필수 | ✅ |

#### 3.3 진입점

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| EH-NAV-01 | Dashboard의 Recent Executions 행 클릭 시 해당 실행의 상세 페이지로 이동 | 필수 | ✅ |
| EH-NAV-02 | Workflow List 페이지에서 각 워크플로우의 실행 내역 링크 제공 | 필수 | ✅ |
| EH-NAV-03 | 워크플로우 에디터에서 과거 실행 내역 페이지로 이동 링크 제공 | 필수 | ✅ |
| EH-NAV-04 | 에디터의 AI Assistant 가 read-only 도구로 현재 워크플로의 실행 목록/상세 조회 가능 (상세: [Spec 3-workflow-editor §10.9 ED-AI-35~38](../3-workflow-editor/_product-overview.md#109-실행-결과-조회-진단수정)) | 필수 | ✅ (`get_workflow_executions` / `get_execution_details` 도구 — `workflow-assistant/tools/explore-tools.service.ts`. 직계 자식 1 depth 포함 + `subExecutionsTruncatedDepth` 힌트, `maskSensitiveFields` 자동 마스킹, running / waiting_for_input 부분 타임라인 허용) |

---

## 1. 개요

워크플로우 실행 내역은 두 개의 페이지로 구성된다:

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 실행 내역 목록 | `/workflows/:id/executions` | 특정 워크플로우의 모든 실행 이력 |
| 실행 상세 | `/workflows/:id/executions/:executionId` | 개별 실행의 노드별 상세 결과 |

두 페이지 모두 `(main)` 레이아웃 그룹에 속한다 (사이드바 포함).

---

## 2. 실행 내역 목록 페이지

### 2.1 화면 구성

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Back    Data Sync Workflow — Executions    [Open in Editor →]  │
│  ──────────────────────────────────────────────────────────────── │
│                                                                    │
│  [All] [Completed] [Failed] [Running] [Cancelled] [Waiting]       │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Status   │ Started At          │ Duration │ Nodes          │   │
│  │──────────│─────────────────────│──────────│────────────────│   │
│  │ ✅ Done  │ 2024-01-15 14:02:30 │ 3.2s     │ 5/5            │   │
│  │ ❌ Fail  │ 2024-01-15 13:55:10 │ 1.0s     │ 2/5 (1 failed) │   │
│  │ ✅ Done  │ 2024-01-15 12:30:00 │ 5.1s     │ 3/3            │   │
│  │ ✅ Done  │ 2024-01-14 18:00:00 │ 2.8s     │ 4/4            │   │
│  │ ⏳ Run   │ 2024-01-14 17:55:00 │ —        │ 1/5            │   │
│  │ ...      │                     │          │                │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ← 1  2  3  ...  10 →                                            │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 헤더

| 요소 | 설명 |
|------|------|
| Back 링크 | 이전 페이지로 돌아가기 (`router.back()`) |
| 워크플로우 이름 | 해당 워크플로우의 이름 표시 |
| "Open in Editor" 링크 | `/workflows/:id` (에디터)로 이동 |

### 2.3 필터

상태 필터 버튼을 가로로 배치한다. 선택된 필터는 활성 스타일(`variant="default"`)로, 나머지는 비활성 스타일(`variant="outline"`)로 표시한다.

| 필터 | 값 | 설명 |
|------|----|------|
| All | (필터 없음) | 모든 실행 표시 (기본값) |
| Completed | `completed` | 완료된 실행만 |
| Failed | `failed` | 실패한 실행만 |
| Running | `running` | 실행 중인 것만 |
| Cancelled | `cancelled` | 취소된 실행만 |
| Waiting | `waiting_for_input` | 입력 대기 중인 것만 |

### 2.4 테이블

| 열 | 설명 | 정렬 |
|----|------|------|
| Status | 상태 아이콘 + 텍스트 (`✅ Completed`, `❌ Failed`, `⏳ Running`, `⛔ Cancelled`, `🙋 Waiting`) | 가능 |
| Trigger | 실행 출처(어디서 트리거 되었는지) — 아이콘 + 출처 라벨 + 보조 라벨 (트리거명/실행자/부모 워크플로명) | — |
| Started At | 실행 시작 시각 (`YYYY-MM-DD HH:mm:ss`) | 가능 (기본: 내림차순) |
| Duration | 실행 소요 시간 (초/분 자동 전환). 실행 중이면 `—` 표시 | 가능 |
| Nodes | 노드 실행 현황 (`완료 수/전체 수`, 실패 시 `(N failed)` 추가) | — |

> Nodes 열 현황: 목록 API(`GET /api/executions/workflow/:workflowId`)의 `ExecutionDto` 는 N+1 을 회피하면서도 배치 집계 컬럼 `totalNodeCount` / `completedNodeCount` / `failedNodeCount` 를 응답한다(`executions.service.ts` 의 배치 `nodeCountMap`). 클라이언트(`page.tsx`)는 이 세 카운트로 `완료 수/전체 수` (실패 시 `(N failed)`) 를 렌더한다. 노드 실행 본문(`nodeExecutions`)은 여전히 목록 응답에 포함하지 않는다.

#### Trigger 출처 분류

`Execution.trigger_id`, `Execution.executed_by`, `Execution.parent_execution_id` 와 `Trigger.type` 으로 다음 5가지 출처(`triggerSource`) 중 하나로 정규화한다. 판정 우선순위는 표 위에서 아래 순서.

| source | 판정 규칙 | 아이콘 | 라벨 (출처) | 보조 라벨 |
|--------|-----------|--------|-------------|------------|
| `subworkflow` | `parent_execution_id != null` | GitBranch | 서브 워크플로우 | 부모 실행의 `workflow.name` |
| `manual` | 위에 해당 없음 + `executed_by != null` | User | 수동 실행 | 실행자 `User.name` (없으면 `email`) |
| `schedule` | 위에 해당 없음 + `trigger_id != null` && `Trigger.type === 'schedule'` | Clock | 스케줄 | `Trigger.name` |
| `webhook` | 위에 해당 없음 + `trigger_id != null` && `Trigger.type === 'webhook'` | Webhook | Webhook | `Trigger.name` |
| `unknown` | 그 외 (구 데이터 fallback) | HelpCircle | — | — |

응답 DTO 는 위 분류 결과를 `triggerSource` (enum) 와 `triggerLabel` (보조 라벨, 없으면 null) 로 노출한다.

| 동작 | 설명 |
|------|------|
| 행 클릭 | `/workflows/:id/executions/:executionId`로 이동 |
| 행 호버 | `hover:bg-[hsl(var(--muted))/0.5]` 배경 |

### 2.5 정렬

- 테이블 헤더 클릭으로 정렬 토글 (오름차순 ↔ 내림차순)
- 현재 정렬 열에 화살표 아이콘 표시
- 기본 정렬: `started_at` 내림차순

### 2.6 페이지네이션

- 페이지당 20건
- 이전/다음 버튼 + 페이지 번호 버튼
- 기존 워크플로우 목록 페이지와 동일한 패턴 사용
- 필터 변경 시 1페이지로 리셋

### 2.7 빈 상태

실행 이력이 없을 때:

```
┌────────────────────────────────────┐
│         (Activity 아이콘)           │
│                                    │
│   No executions yet               │
│   Run this workflow to see         │
│   execution history here.          │
│                                    │
│   [Open in Editor →]              │
└────────────────────────────────────┘
```

### 2.8 로딩 상태

- 테이블 영역에 스켈레톤 로더 표시 (`animate-pulse`)
- 5행의 스켈레톤 행 표시

---

## 3. 실행 상세 페이지

### 3.1 화면 구성

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Executions                              [← Prev] [Next →]     │
│  ──────────────────────────────────────────────────────────────── │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ ✅ Completed                                                  │ │
│  │ Started: 2024-01-15 14:02:30  Finished: 14:02:33  Dur: 3.2s │ │
│  │ Nodes: 10/10 completed                                       │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────┬──────────────────────────────────┐     │
│  │ Nodes                │ Carousel                  carousel│     │
│  │ ──────────────────── │                                  │     │
│  │ ✅ Manual Trigger    │ [Preview]  Input  Output         │     │
│  │ ✅ Carousel     ←    │ ──────────────────────────────── │     │
│  │ ✅ Template          │ Preview                          │     │
│  │ ✅ AI Agent          │ ┌────────────────────────────┐   │     │
│  │ ✅ Template          │ │ (Carousel 시각적 프리뷰)    │   │     │
│  │                      │ └────────────────────────────┘   │     │
│  │                      │ [버튼1] [▉ 선택된 버튼] [버튼3]  │     │
│  └──────────────────────┴──────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 실행 요약 카드

| 필드 | 설명 |
|------|------|
| 상태 | 아이콘 + 텍스트 (배지 스타일) |
| 시작 시간 | `YYYY-MM-DD HH:mm:ss` |
| 종료 시간 | `HH:mm:ss` (같은 날이면 시간만) 또는 `—` (미완료) |
| 소요 시간 | 초/분 자동 전환 |
| 노드 실행 현황 | `완료 수 / 전체 수 completed` (실패 시 `N failed` 추가) |

실패 상태일 때 요약 카드에 에러 메시지를 추가 표시:

```
┌──────────────────────────────────────────────────────────────┐
│ ❌ Failed                                                     │
│ Started: 2024-01-15 13:55:10  Finished: 13:55:11  Dur: 1.0s │
│ Nodes: 3/10 completed, 1 failed                              │
│                                                               │
│ Error: Connection timeout on "API Call" node                  │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 노드 결과 패널

요약 카드 하단에 좌우 2분할 레이아웃으로 노드 목록과 상세 정보를 표시한다.
Skipped 상태의 노드는 목록에서 제외한다.

**좌측 패널 (노드 목록)**:
- 실행된 노드만 상태 아이콘과 함께 목록으로 표시 (skipped 제외)
- 선택된 노드 하이라이트

**우측 패널 (노드 상세)**:
- 노드 이름, 타입 배지, 상태, 소요 시간
- 서브 탭(노드 레벨): **Preview** / Input / Output / **LLM Usage** (AI 노드에서만) / Config / Error (에러가 있을 때만)
- AI Multi Turn 타임라인에서 assistant 메시지를 선택하면 탭이 메시지 레벨로 전환: **Preview** / **Response** / **Request** / **LLM Usage**
- 기본 선택 탭: 에러면 Error, outputData가 있으면 Preview, 그 외 Output

### 3.4 Preview 탭

노드 유형에 따라 다른 방식으로 시각적 프리뷰를 제공한다. Output Data JSON은 별도 Output 탭에서 확인한다.

#### Presentation 노드 (table, carousel, chart, template, form)

에디터 실행 시와 동일한 시각적 렌더링을 제공한다:
- **Table**: 테이블 형태로 rows/columns 표시
- **Carousel**: 카드 슬라이드 또는 rendered HTML
- **Chart**: SVG/rendered HTML 차트
- **Template**: 포맷(html/markdown/text)에 따른 프리뷰
- **Form**: 제출된 form 데이터 표시

#### 버튼이 있는 노드

- 노드의 `buttonConfig.buttons`에서 전체 버튼 목록을 표시
- 실행 완료 후 선택된 버튼(`buttonId` 매칭)은 primary 색상으로 하이라이트
- 미선택 버튼은 outline 스타일로 비활성 표시

#### AI Agent / Information Extractor (multi-turn) 노드

완료된 대화를 채팅 스레드 형태로 표시한다:
- 턴 카운터, 종료 사유 표시
- User/Assistant 메시지를 버블 형태로 나열
- Tool Call 배지 (접기/펼치기)
- **메시지 클릭**: 개별 메시지 상세 content만 inline 표시. assistant 메시지의 원문 요청/응답/사용량은 상세 패널의 **Response / Request / LLM Usage** 탭으로 노출 (Preview 탭은 대화 스레드에 집중)
  - Assistant 메시지: 본문 + tool call 배지만 표시
  - User 메시지: 메시지 내용 + 타임스탬프
  - Tool 메시지: 인자 + 결과
- **"← Back to conversation"** 버튼으로 스레드 뷰 복귀

#### 일반 노드

- 상태 (Status), 소요 시간 (Duration) 표시
- 에러가 있으면 에러 메시지 표시

### 3.4.1 Output 탭 — AI 노드 확장

AI 노드(AI Agent, Information Extractor, Text Classifier)의 Output 탭은 일반 JSON 덤프에 더해 다음 요소를 상단에 표시한다:
- **AI Metadata Grid** — Model, Total/Request/Response/Thinking Tokens, Turn Count(멀티턴), Tool Calls(AI Agent)
- **Extracted Fields Card** (Info Extractor 전용) — 수집된 각 필드를 라벨-값 테이블로 표시. 미수집 필드는 dim "—" 로 placeholder. waiting 상태에서는 재수집 횟수(`재수집 n/m`)도 상단에 표시

### 3.4.2 LLM Usage / Response / Request 탭

AI 노드(AI Agent, Information Extractor, Text Classifier) 에서만 표시되는 최상위 탭 집합. 이전에는 단일 `LLM Information` 탭 아래 `Response / Request / Usage` 하위 탭 구조였으나, 메시지를 선택할 때의 두 번 클릭 불편을 없애기 위해 평탄화되었다.

**노드 레벨 (타임라인에서 메시지 미선택)**:
- `LLM Usage` 탭 하나만 노출. 노드 전체 집계(Model / Total / Request / Response / Thinking Tokens / Turn Count / Tool Calls / LLM Calls)
- 백엔드 핸들러가 per-call trace(`_llmCalls` 또는 `_turnDebugHistory`)를 persist 하지 않은 실행(이전 버전 기록 포함)은 "정보 없음" placeholder

**메시지 레벨 (AI Agent · Information Extractor Multi Turn 에서 assistant 메시지 선택)**:
- **Response** — 해당 턴 LLM 호출의 `responsePayload` 전체 JSON
- **Request** — 해당 턴 LLM 호출의 `requestPayload` 전체 JSON (model, messages, tools, responseFormat 등)
- **LLM Usage** — 선택한 call의 Model, Input/Output/Total/Thinking Tokens, Latency
- **Call selector**: 동일 턴에 LLM 호출이 2개 이상일 때(tool-call 루프, Info Extractor 재수집 iteration) 각 탭 상단에 드롭다운. 선택은 Response ↔ Request ↔ LLM Usage 탭 전환 사이에도 유지됨. 호출이 1개뿐이면 드롭다운은 숨김

### 3.5 에러 및 상태 처리

| 상태 | 표시 |
|------|------|
| Loading | 스켈레톤 로더 (3개 블록) |
| API Error | "Failed to load execution. Please try again." + Back 버튼 |
| Not Found | "Execution not found." + Back 버튼 |

### 3.6 이전/다음 실행 네비게이션

- 실행 상세 페이지 헤더 우측에 `← Prev` / `Next →` 버튼
- 같은 워크플로우의 시간 순서 기준으로 이전/다음 실행으로 이동
- 첫 번째/마지막 실행에서는 해당 버튼 비활성화

### 3.7 Re-run 액션

실행 요약 카드 우측 헤더에 "Re-run" 버튼을 표시한다. 클릭 시 입력 데이터 미리보기·편집 모달이 열리며, dry-run 토글로 외부 호출을 skip 한 흐름 검증도 가능하다.

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Executions       [⟳ Re-run]   [← Prev] [Next →]                │
│ ──────────────────────────────────────────────────────────────── │
│  ✅ Completed                                                     │
│  Started: 2026-05-13 09:14:02   Duration: 3.2s                   │
│  Nodes: 10/10 completed                                          │
│  ─                                                                │
│  📎 #3-th re-run · dry-run · 원본: #1234   [View chain (4) ▼]   │
└──────────────────────────────────────────────────────────────────┘
```

| 요소 | 표시 조건 | 동작 |
| --- | --- | --- |
| `[⟳ Re-run]` 버튼 | 항상 표시 | 권한 미충족 시 disabled + tooltip `history.rerun.permissionDenied` (정책 [RR-PL-06](../5-system/13-replay-rerun.md#rr-pl-06--권한-f)). 클릭 시 [Spec Re-run §10.2 모달](../5-system/13-replay-rerun.md#102-re-run-모달) |
| Chain badge | `execution.reRunOf != null` | "#N-th re-run · 원본: <ID>". dry-run 이면 "· dry-run" 부착. 원본 ID 클릭 시 같은 탭에서 원본 상세로 이동 (`<Link href>`, `target=_blank` 없음) |
| `[View chain (N) ▼]` 드롭다운 | chain 의 실행이 2개 이상 | 클릭 시 `GET /api/executions/:id/chain` 응답을 펼침. 각 항목은 ID, 시작 시각, 최종 상태, dry-run 여부 |

모달이 "재실행" 버튼을 누르면 `POST /api/executions/:executionId/re-run` 응답의 새 Execution ID 로 같은 워크스페이스 라우터에서 `/workflows/:workflowId/executions/:newId` 로 이동한다.

i18n 키와 에러 매핑은 [Spec Re-run §10.4 i18n 키](../5-system/13-replay-rerun.md#104-i18n-키) 참조.

---

## 4. 진입점

### 4.1 Dashboard — Recent Executions

| 변경 사항 | 설명 |
|-----------|------|
| 행 클릭 핸들러 | 클릭 시 `/workflows/:workflowId/executions/:executionId`로 이동 (개별 실행 상세) |
| 커서 스타일 | `cursor-pointer` 추가 |

### 4.2 Workflow List

| 변경 사항 | 설명 |
|-----------|------|
| 실행 내역 링크 | 각 워크플로우 행의 컨텍스트 메뉴(⋯)에 "Execution History" 항목 추가 |
| 클릭 동작 | `/workflows/:id/executions`로 이동 |

### 4.3 Workflow Editor

| 변경 사항 | 설명 |
|-----------|------|
| 실행 내역 링크 | 실행 결과 영역(Run Results)에 "View All Executions" 링크 추가 |
| 클릭 동작 | `/workflows/:id/executions`로 이동 |

---

## 5. API 엔드포인트

모든 API는 이미 구현되어 있으며, 추가 백엔드 작업은 불필요하다.

| 메서드 | 경로 | 설명 | 비고 |
|--------|------|------|------|
| GET | `/api/executions/workflow/:workflowId` | 워크플로우별 실행 목록 | 페이지네이션, 상태 필터, 정렬 지원. 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수. **노드 실행은 응답에 포함하지 않는다** (N+1 회피) — 위 §2.4 Nodes 열 참고 |
| GET | `/api/executions/:id` | 실행 상세 (노드 실행 포함) | nodeExecutions 배열 포함 |
| POST | `/api/executions/:executionId/re-run` | 원본 실행 기반 새 Execution 시작 | EH-DETAIL-10. 명세는 [Spec Re-run §8.1](../5-system/13-replay-rerun.md#81-post-apiexecutionsexecutionidre-run) |
| GET | `/api/executions/:executionId/chain` | 같은 chain 의 모든 실행을 시간 순으로 반환 | EH-DETAIL-11. 명세는 [Spec Re-run §8.2](../5-system/13-replay-rerun.md#82-get-apiexecutionsexecutionidchain) |

**목록 API 쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `page` | number | 1 | 페이지 번호 |
| `limit` | number | 20 | 페이지당 건수 (max: 100) |
| `sort` | string | `started_at` | 정렬 기준 (`started_at`, `finished_at`, `status`, `duration_ms`) |
| `order` | string | `desc` | 정렬 순서 (`asc`, `desc`) |
| `status` | string | — | 상태 필터 |

**목록 API 응답 형식:**

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
      "dryRun": false
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

**상세 API 응답 — nodeExecutions:**

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

---

## 6. 반응형

| 브레이크포인트 | 레이아웃 |
|----------------|----------|
| ≥ 1280px | 기본 레이아웃 |
| 768px ~ 1279px | Node Results 2분할 → 세로 스택 |
| < 768px | 전체 세로 스택, 테이블 → 카드형 목록 |

---

## 7. 라우팅

```
codebase/frontend/src/app/(main)/workflows/[id]/executions/
├── page.tsx                    # 실행 내역 목록 페이지
└── [executionId]/
    └── page.tsx                # 실행 상세 페이지
```
