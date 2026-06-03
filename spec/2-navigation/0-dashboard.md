---
id: dashboard
status: implemented
code:
  - codebase/frontend/src/app/(main)/dashboard/page.tsx
  - codebase/backend/src/modules/dashboard/dashboard.controller.ts
  - codebase/backend/src/modules/dashboard/dashboard.service.ts
  - codebase/backend/src/modules/dashboard/dto/responses/dashboard-response.dto.ts
---

# Spec: 대시보드

> 관련 문서: [Spec 레이아웃](./_layout.md) · [Spec 인증 플로우](./10-auth-flow.md) · [PRD 내비게이션](./_product-overview.md) · [Spec 워크플로우 목록](./1-workflow-list.md) · [Spec 실행 내역](./14-execution-history.md)

---

## 1. 개요

대시보드(`/dashboard`)는 로그인 후 최초 랜딩 화면이다. 워크플로우 상태와 최근 실행 이력을 한눈에 파악하고, 빠른 액션을 수행할 수 있다.

---

## 2. 화면 구성

```
┌────────────────────────────────────────────────────────────────┐
│  Dashboard                                  [+ New Workflow]   │
│  ──────────────────────────────────────────────────────────── │
│                                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Total WF │ │ Active   │ │ Runs(7d) │ │ Success  │         │
│  │   12     │ │   10     │ │    87    │ │   94%    │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                │
│  ┌─────────────────────────────┐ ┌──────────────────────────┐ │
│  │ Recent Workflows            │ │ Recent Executions        │ │
│  │ ─────────────────────────── │ │ ──────────────────────── │ │
│  │ 1. Data Sync       2m ago  │ │ Data Sync  ✅ 3.2s  14:02│ │
│  │ 2. Email Campaign  1h ago  │ │ Report Gen ❌ 1.0s  14:01│ │
│  │ 3. Report Gen      3h ago  │ │ Email Camp ✅ 5.1s  13:58│ │
│  │ 4. Email Notify    1d ago  │ │ Email Ntfy ✅ 0.8s  13:55│ │
│  │ 5. DB Backup       2d ago  │ │ ...                      │ │
│  │                             │ │                          │ │
│  │ [View All →]                │ │                          │ │
│  └─────────────────────────────┘ └──────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. 요약 카드

상단에 4개의 요약 카드를 가로 배치한다.

| 카드 | 표시 내용 | 설명 |
|------|-----------|------|
| Total Workflows | 총 워크플로우 수 | 워크스페이스 내 전체 워크플로우 개수 |
| Active | 활성 워크플로우 수 | `isActive = true` 인 워크플로우 개수 (트리거가 활성화된 워크플로우) |
| Runs (7d) | 최근 7일 실행 횟수 | 전주(직전 7일) 대비 증감률(`runs7dChangePercent`)을 카드 하단에 함께 표시. 직전 7일 실행이 0건이면 증감 미표시 |
| Success Rate | 최근 7일 성공률 (%) | `completed / (최근 7일 전체 실행 건수) × 100`. 분모는 status 무관 7일 내 전체 실행 건수(running·pending·cancelled 포함). 카드에는 정수로 반올림하여 표시 |

> 평균 실행 시간(`avgExecutionTime`)은 summary 응답에 포함되지만(§7) 현재 요약 카드로는 노출하지 않는다.

---

## 4. 최근 워크플로우

최근 수정 기준으로 상위 5개 워크플로우를 표시한다.

| 항목 | 설명 |
|------|------|
| 정렬 기준 | `updatedAt` 내림차순 |
| 표시 필드 | 워크플로우 이름, 상태(Active/Inactive Badge), 마지막 수정 시간(`updatedAt`, 상대 시간) |
| 클릭 동작 | 워크플로우 에디터(`/workflows/:id`)로 이동 |
| "View All" 링크 | `/workflows` (워크플로우 목록)로 이동 |
| 빈 상태 | "No workflows yet. Create your first workflow!" + [+ New Workflow] 버튼 |

---

## 5. 최근 실행 이력

최근 실행 완료/실패 기준 10건을 표시한다.

| 열 | 설명 |
|----|------|
| 상태 | 실행 status 별 아이콘: ✅ completed / ❌ failed / ⏳ running·pending / ⛔ cancelled / ✋ waiting_for_input. 매핑에 없는 값은 ❓ 폴백. (DTO 의 status enum 은 pending·running·completed·failed·cancelled·waiting_for_input — 6종, SoT [데이터 모델 §2.13](../1-data-model.md)) |
| 워크플로우 이름 | 실행된 워크플로우 이름 |
| 트리거 | 실행 출처(`subworkflow`/`manual`/`schedule`/`webhook`/`unknown`) 아이콘 + 라벨. 분류 규칙·보조 라벨 정책은 [실행 내역 spec §2.4 Trigger 출처 분류](./14-execution-history.md#trigger-출처-분류) 참조 |
| 소요 시간 | 실행 소요 시간 (초/분) |
| 시각 | 실행 완료 시각 (상대 시간 또는 HH:mm) |

| 동작 | 설명 |
|------|------|
| 행 클릭 | 해당 실행의 상세 페이지(`/workflows/:workflowId/executions/:executionId`)로 이동. 상세 스펙은 [Spec 실행 내역](./14-execution-history.md) 참조 |
| 빈 상태 | "No executions yet. Run a workflow to see results here." |

---

## 6. 빠른 액션

| 액션 | 위치 | 동작 |
|------|------|------|
| + New Workflow | 페이지 헤더 우측 | 새 워크플로우 생성 → 에디터로 이동 |

---

## 7. API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/dashboard/summary | 요약 지표 (총/활성 워크플로우 수, 최근 7일 실행 건수·전주 대비 증감, 성공률, 평균 실행 시간) |
| GET | /api/dashboard/recent-workflows | 최근 갱신 워크플로우 5건 (`updatedAt` 내림차순) |
| GET | /api/dashboard/recent-executions | 최근 실행 이력 10건 (`startedAt` 내림차순) |

> 응답 본문은 공통 래퍼(`{ "data": ... }`)로 감싸진다. 아래 예시는 `data` 내부 형태다.

**응답 예시 — `/api/dashboard/summary`** (`DashboardSummaryDto`):

```json
{
  "totalWorkflows": 12,
  "activeWorkflows": 10,
  "runs7d": 87,
  "runs7dPrevious": 64,
  "runs7dChangePercent": 35.94,
  "successRate": 94.2,
  "avgExecutionTime": 4300
}
```

| 필드 | 설명 |
|------|------|
| `totalWorkflows` | 워크스페이스 내 전체 워크플로우 수 |
| `activeWorkflows` | 활성(`isActive`) 워크플로우 수 |
| `runs7d` | 최근 7일 실행 건수 |
| `runs7dPrevious` | 직전 7일(14~7일 전) 실행 건수 |
| `runs7dChangePercent` | 전주 대비 증감률(%). 직전 7일 실행이 0건이면 `null` |
| `successRate` | 최근 7일 성공률(%) = completed / runs7d × 100 |
| `avgExecutionTime` | 최근 7일 평균 실행 소요 시간 — 단위는 **밀리초(ms)** (`duration_ms` 평균을 정수 반올림). 실행 데이터가 없으면 0 |

---

## 8. 반응형

| 브레이크포인트 | 레이아웃 |
|----------------|----------|
| ≥ 1280px | 요약 카드 4열, 최근 워크플로우·실행 이력 2열 |
| 768px ~ 1279px | 요약 카드 2열, 최근 워크플로우·실행 이력 1열 (세로 스택) |
| < 768px | 요약 카드 1열, 최근 워크플로우·실행 이력 1열 |

---

## Rationale

> 본 절은 2026-06-03 spec-vs-code 동기화 시 코드 현실에 맞춰 정정한 항목의 근거다 (대안 비교형 ADR 이 아니라 code-sync 근거 기록).

### Success Rate 분모 = 7일 전체 실행 건수 (§3)

성공률 분모는 `completed/(completed+failed)` 가 아니라 **status 무관 7일 내 전체 실행 건수**(running·pending·cancelled 포함)다 (`dashboard.service.ts`). 초기 spec 초안은 분모를 `completed+failed` 로 적었으나, 구현은 7일 전체를 분모로 둔다 — "최근 활동 대비 성공 비율" 이라는 카드 의미상 진행 중·취소 건도 분모에 포함하는 현 구현을 SoT 로 채택하고 spec 을 맞췄다. (분모를 `completed+failed` 로 바꾸려면 구현 변경이 필요 — 현 시점 미채택.)

### Avg Time 카드 미노출 (§2/§3)

요약 카드는 Total / Active / Runs(7d) / Success 4종이며, 초기 초안의 **Avg Time 카드는 노출하지 않는다** (`dashboard/page.tsx`). 평균 실행 시간은 `summary` 응답(`avgExecutionTime`, ms)에는 포함되나 별도 카드로 시각화하지 않는 현 구현을 따른다.
