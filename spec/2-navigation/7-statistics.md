---
id: statistics
status: implemented
code:
  - codebase/frontend/src/app/(main)/w/[slug]/statistics/page.tsx
  - codebase/backend/src/modules/statistics/**
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
| 기간 | 오늘(`1d`) / 최근 7일(`7d`, 기본) / 최근 30일(`30d`) / 최근 90일(`90d`) — 프리셋 버튼 + 커스텀 범위 선택. 백엔드 `QueryStatisticsDto` enum 은 `1d`/`7d`/`30d`/`90d`/`custom` 이며 `custom` 은 `startDate`/`endDate` 와 함께 사용한다. 프론트는 프리셋 버튼과 커스텀 범위 피커를 모두 제공한다 |
| 워크플로우 | 전체 / 특정 워크플로우 선택 |

### 2.2 요약 카드

| 카드 | 내용 |
|------|------|
| Total Runs | 선택 기간 내 총 실행 횟수. 직전 동일 기간 대비 증감률(`totalExecutionsChangeRate`)을 함께 표시한다 (`StatisticsSummaryDto` 필드 → 프론트 카드 렌더) |
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

---

## Rationale

### R-1. LLM 사용량 API 를 `summary` / `timeseries` 두 endpoint 로 분리한 이유

LLM 토큰 사용량 위젯(§2.5)은 집계 축이 다른 두 뷰를 가진다 — 표는 **프로바이더×모델** 축의 기간 합계(+추정 비용), 추이 차트는 **일자×프로바이더** 축의 시계열. 한 endpoint 로 합치면 (a) 한쪽 뷰만 갱신해도 다른 축의 전체 집계를 항상 다시 계산·전송하고, (b) 클라이언트가 한 응답을 두 축으로 재집계해야 한다. 축이 다른 집계는 endpoint 를 분리해 각 위젯이 독립적으로 fetch/캐시한다. 다른 차트들(`/executions`, `/errors`, `/top-workflows`)이 위젯별 endpoint 인 것과 같은 원칙.

### R-2. 쿼리 파라미터를 `workflowId` (camelCase) 로 둔 이유

쿼리 파라미터가 NestJS `QueryStatisticsDto` 프로퍼티에 이름 그대로 바인딩되므로, DTO·응답 본문과 같은 camelCase 로 통일하면 별도 rename/변환 계층이 필요 없다. snake_case 쿼리(`workflow_id`)를 받으면 응답(camelCase)과 표기가 갈라져 프론트 호출부에서 혼용 실수가 생긴다. 본문 §3 의 유의 문구는 이 통일이 실수로 깨지지 않게 하는 가드 표기다.

### R-3. Error Distribution 을 에러 유형이 아닌 **워크플로우별** 실패 집계로 한 이유

이 화면의 진단 단위는 "어느 워크플로가 자주 실패하는가"다 — 사용자가 취할 행동(해당 워크플로의 실행 내역으로 들어가 원인 확인)이 워크플로 단위이기 때문. 에러 유형/코드 축은 노드·통합마다 형식이 달라 안정된 분류 축이 되지 못하며, 개별 실패의 원인 분석은 [실행 내역 상세](./14-execution-history.md)가 담당한다. 그래서 `GET /api/statistics/errors` 는 `workflowName` 을 분류 키로 집계한다(§2.3).
