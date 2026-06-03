---
id: statistics
status: partial
code:
  - codebase/frontend/src/app/(main)/statistics/page.tsx
  - codebase/backend/src/modules/statistics/**
pending_plans:
  - plan/in-progress/spec-sync-statistics-gaps.md
---

# Spec: 통계 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#38-statistics-통계) · [Spec 레이아웃](./_layout.md) · [데이터 모델 - Execution](../1-data-model.md#213-execution)

---

## 1. 화면 구조

```
┌──────────────────────────────────────────────────────────────┐
│  Statistics                                                  │
│                                                              │
│  ┌──────────────────────────┐  ┌────────────────────────┐    │
│  │ Period: Last 7 days ▼   │  │ Workflow: All ▼       │    │
│  └──────────────────────────┘  └────────────────────────┘    │
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  1,234  │ │  95.2%  │ │  4.8%   │ │  2.3s   │           │
│  │ Total   │ │ Success │ │ Failure │ │ Avg Time│           │
│  │ Runs    │ │ Rate    │ │ Rate    │ │         │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Executions Over Time (Bar Chart)                        ││
│  │  ████ ████ ████ ████ ████ ████ ████                      ││
│  │  Mon  Tue  Wed  Thu  Fri  Sat  Sun                       ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────┐ ┌─────────────────────────────────┐│
│  │ Error Distribution   │ │ Top Workflows by Executions     ││
│  │ (Pie Chart)          │ │ (Horizontal Bar)                ││
│  └──────────────────────┘ └─────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ LLM Token Usage                        [Export ▼]        ││
│  │ Provider     Model          Tokens     Cost (est.)       ││
│  │ OpenAI       gpt-4o         125,000    $3.75             ││
│  │ Anthropic    claude-sonnet  89,000     $2.67             ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 기능 상세

### 2.1 필터

| 필터 | 옵션 |
|------|------|
| 기간 | 오늘(`1d`) / 최근 7일(`7d`, 기본) / 최근 30일(`30d`) / 최근 90일(`90d`) — 프리셋 버튼. **커스텀 범위는 미구현 (Planned)**: 백엔드 `QueryStatisticsDto` 는 `period=custom` + `startDate`/`endDate` 를 지원하나 프론트에 범위 선택 UI 없음. 반대로 프리셋 `1d`(오늘)는 프론트에만 있고 백엔드 enum(`7d`/`30d`/`90d`/`custom`)에는 없음 |
| 워크플로우 | 전체 / 특정 워크플로우 선택 |

### 2.2 요약 카드

| 카드 | 내용 |
|------|------|
| Total Runs | 선택 기간 내 총 실행 횟수. **전 기간 대비 증감률은 미구현 (Planned)** — `StatisticsSummaryDto` 및 프론트 카드 모두 증감률 필드 없음 |
| Success Rate | 성공 비율 (%) |
| Failure Rate | 실패 비율 (%) |
| Avg Duration | 평균 실행 시간 |

### 2.3 차트

| 차트 | 내용 |
|------|------|
| Executions Over Time | 기간별 실행 횟수. 성공(초록)/실패(빨강) 스택 바 차트 |
| Error Distribution | **워크플로우별** 실패 건수 비율 (파이/도넛 차트). `GET /api/statistics/errors` 는 실패 실행을 워크플로우별로 집계(`workflowId`/`workflowName`/`errorCount`/`lastErrorAt`)하며, 차트는 `workflowName` 을 분류 키로 사용. (에러 유형/코드별 분류는 아님) |
| Top Workflows | 실행 횟수 기준 상위 워크플로우 (수평 바 차트) |

### 2.4 노드별 통계 (선택 필터로 특정 워크플로우 선택 시)

| 항목 | 내용 |
|------|------|
| 노드별 평균 실행 시간 | 워크플로우 내 각 노드의 평균 소요 시간 |
| 노드별 에러율 | 노드별 실패 비율 |
| 병목 노드 표시 | 평균 실행 시간이 가장 긴 노드 하이라이트 |

### 2.5 LLM 토큰 사용량

| 항목 | 내용 |
|------|------|
| 프로바이더별 토큰 사용량 | Input/Output 토큰 구분 |
| 모델별 토큰 사용량 | 모델별 상세 |
| 예상 비용 | 공개 가격 기준 추정 비용 (참고용) |
| 일별 추이 | 기간 내 일별 토큰 사용량 추이 차트 |

### 2.6 데이터 내보내기

| 형식 | 내용 |
|------|------|
| CSV | 실행 이력 로우 데이터 |
| JSON | 통계 요약 데이터 |

---

## 3. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/statistics/summary | 요약 카드 데이터 (쿼리: `period`, `workflowId`) |
| GET | /api/statistics/executions | 기간별(일자별) 실행 집계 |
| GET | /api/statistics/errors | **워크플로우별** 실패 집계 (오류 건수 내림차순, 상위 20건) |
| GET | /api/statistics/top-workflows | 상위 워크플로우 (실행 횟수 기준 상위 10개) |
| GET | /api/statistics/node-stats | 노드별 통계 (쿼리: `workflowId`) |
| GET | /api/statistics/llm-usage/summary | LLM 토큰 사용량 요약 (프로바이더×모델별 합계 + 추정 비용) |
| GET | /api/statistics/llm-usage/timeseries | LLM 토큰 사용량 시계열 (일자×프로바이더별) |
| GET | /api/statistics/export | 데이터 내보내기 (쿼리: `format=csv|json`) |

> 쿼리 파라미터는 `QueryStatisticsDto`(`period`/`workflowId`/`startDate`/`endDate`) 를 공유한다. `workflow_id` 가 아닌 `workflowId` camelCase 임에 유의.
