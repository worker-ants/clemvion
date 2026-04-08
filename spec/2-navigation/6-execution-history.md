# Spec: 워크플로우 실행 내역

> 관련 문서: [PRD 실행 내역](../../prd/7-execution-history.md) · [Spec 대시보드](./0-dashboard.md) · [Spec 워크플로우 목록](./1-workflow-list.md) · [Spec 실행/디버깅](../3-workflow-editor/3-execution.md) · [데이터 모델 - Execution](../1-data-model.md#213-execution)

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
│  [All] [Completed] [Failed] [Running] [Cancelled]                 │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Status   │ Started At          │ Duration │ Trigger        │   │
│  │──────────│─────────────────────│──────────│────────────────│   │
│  │ ✅ Done  │ 2024-01-15 14:02:30 │ 3.2s     │ Manual         │   │
│  │ ❌ Fail  │ 2024-01-15 13:55:10 │ 1.0s     │ Webhook        │   │
│  │ ✅ Done  │ 2024-01-15 12:30:00 │ 5.1s     │ Schedule       │   │
│  │ ✅ Done  │ 2024-01-14 18:00:00 │ 2.8s     │ Manual         │   │
│  │ ⏳ Run   │ 2024-01-14 17:55:00 │ —        │ Webhook        │   │
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

> `pending`, `waiting_for_input` 상태는 `Running` 필터에 포함하지 않고 All에서만 표시한다.

### 2.4 테이블

| 열 | 설명 | 정렬 |
|----|------|------|
| Status | 상태 아이콘 + 텍스트 (`✅ Completed`, `❌ Failed`, `⏳ Running`, `⛔ Cancelled`, `🙋 Waiting`) | 가능 |
| Started At | 실행 시작 시각 (`YYYY-MM-DD HH:mm:ss`) | 가능 (기본: 내림차순) |
| Duration | 실행 소요 시간 (초/분 자동 전환). 실행 중이면 `—` 표시 | 가능 |
| Trigger | 실행을 트리거한 방식 (`Manual`, `Webhook`, `Schedule`) | — |

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
│  [Timeline]  [Node Results]  [Workflow]                           │
│  ──────────────────────────────────────────────────────────────── │
│                                                                    │
│  (선택된 탭의 내용)                                                  │
│                                                                    │
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

### 3.3 탭: Timeline

노드별 실행 순서를 수직 타임라인으로 표시한다.

```
┌─────────────────────────────────────────────────┐
│  ● Start Node                    ✅  0.1s       │
│  │                                               │
│  ● Data Transform                ✅  0.8s       │
│  │                                               │
│  ● API Call                      ❌  1.0s       │
│  │  Error: Connection timeout                    │
│  │                                               │
│  ○ Filter (skipped)              ⏭️  —          │
│  │                                               │
│  ○ End Node (skipped)            ⏭️  —          │
└─────────────────────────────────────────────────┘
```

| 요소 | 설명 |
|------|------|
| 노드 이름 | 노드의 label (없으면 type) |
| 상태 아이콘 | ✅ completed, ❌ failed, ⏳ running, ⏭️ skipped |
| 소요 시간 | 개별 노드 실행 시간 |
| 에러 메시지 | 실패한 노드 하위에 에러 내용 표시 |
| 클릭 동작 | 클릭 시 Node Results 탭으로 전환 + 해당 노드 선택 |

### 3.4 탭: Node Results

좌우 2분할 레이아웃으로 노드 목록과 상세 정보를 표시한다.

```
┌──────────────────────┬──────────────────────────────────┐
│ Nodes                │ API Call                         │
│ ──────────────────── │ Status: ❌ Failed  Dur: 1.0s     │
│                      │                                  │
│ ✅ Start Node        │ [Input]  [Output]  [Error]       │
│ ✅ Data Transform    │ ──────────────────────────────── │
│ ❌ API Call     ←    │                                  │
│ ⏭️ Filter            │ {                                │
│ ⏭️ End Node          │   "message": "Connection ...",   │
│                      │   "code": "ETIMEDOUT",           │
│                      │   "nodeId": "api-call-1"         │
│                      │ }                                │
│                      │                                  │
└──────────────────────┴──────────────────────────────────┘
```

**좌측 패널 (노드 목록)**:
- 각 노드를 상태 아이콘과 함께 목록으로 표시
- 선택된 노드 하이라이트
- 실패한 노드는 빨간색 강조

**우측 패널 (노드 상세)**:
- 노드 이름, 상태, 소요 시간
- 서브 탭: Input / Output / Error (에러가 있을 때만)
- JSON 데이터는 구문 강조(syntax highlighting)가 적용된 코드 블록으로 표시
- 긴 JSON은 접기/펼치기(collapsible) 지원

### 3.5 탭: Workflow

읽기 전용 워크플로우 그래프를 표시하여 실행 경로를 시각화한다.

| 요소 | 설명 |
|------|------|
| 노드 표시 | 모든 워크플로우 노드를 캔버스에 표시 (읽기 전용) |
| 실행된 노드 | 정상 스타일로 표시 |
| 미실행 노드 | 반투명(opacity: 0.4)으로 표시 |
| 실패 노드 | 빨간색 테두리 하이라이트 |
| 실행 경로 | 실행된 엣지만 하이라이트, 미실행 엣지는 반투명 |
| 노드 클릭 | Node Results 탭으로 전환 + 해당 노드 선택 |
| 상호작용 | 줌/팬만 허용, 편집 불가 |

### 3.6 이전/다음 실행 네비게이션

- 실행 상세 페이지 헤더 우측에 `← Prev` / `Next →` 버튼
- 같은 워크플로우의 시간 순서 기준으로 이전/다음 실행으로 이동
- 첫 번째/마지막 실행에서는 해당 버튼 비활성화

---

## 4. 진입점

### 4.1 Dashboard — Recent Executions

| 변경 사항 | 설명 |
|-----------|------|
| 행 클릭 핸들러 | 클릭 시 `/workflows/:workflowId/executions`로 이동 |
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
| GET | `/api/executions/workflow/:workflowId` | 워크플로우별 실행 목록 | 페이지네이션, 상태 필터, 정렬 지원 |
| GET | `/api/executions/:id` | 실행 상세 (노드 실행 포함) | nodeExecutions 배열 포함 |

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
      "nodeExecutions": []
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
frontend/src/app/(main)/workflows/[id]/executions/
├── page.tsx                    # 실행 내역 목록 페이지
└── [executionId]/
    └── page.tsx                # 실행 상세 페이지
```
