---
id: "CLE-OBS-DASHBOARD"
title: "대시보드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-DASH-001", "REQ-DASH-002", "REQ-DASH-003", "REQ-DASH-004", "REQ-DASH-005", "REQ-DASH-006", "REQ-DASH-007", "REQ-DASH-008", "REQ-DASH-009", "REQ-DASH-010", "REQ-DASH-011", "REQ-DASH-012", "REQ-DASH-013", "REQ-DASH-014", "REQ-DASH-015", "REQ-DASH-016", "REQ-DASH-017", "REQ-DASH-018"]
basis_superseded: false
parent: "CLE-OBS"
ancestors: ["CLE-VISION", "CLE-OBS"]
area: "CLE-OBS"
content_hash: "57f146ac47813aa41eb619888d9d844e653890129de09d5d0ab9103a20ec615b"
read_as: "approved"
task: null
source_paths: ["spec/2-navigation/0-dashboard.md", "spec/data-flow/9-observability.md"]
mirror_sha256: "81d78c867c4fdd4a41f886e24c665714c38071bce0cb816a731422966a2ff06b"
etag: "sha256-713052a327b1f0c87a07705271e03539b72d47cd4880db82d28d36ee5f3afe1f"
---
> 구현 상태: 구현됨 · 원문: `spec/2-navigation/0-dashboard.md`, `spec/data-flow/9-observability.md` (§1.2 의 대시보드 부분) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

대시보드(Dashboard)는 로그인한 뒤 처음 보는 화면이다. 워크플로우 상태와 최근 실행을 한눈에 보여 주고 새 워크플로우 만들기 같은 빠른 동작을 제공한다.

경로는 `/dashboard` 다. 이 문서의 화면 경로(`/dashboard`, `/workflows`, `/workflows/:id/executions/:executionId` 등)는 현재 워크스페이스 기준 `/w/<slug>/...` 로 그린다. URL 슬러그가 프런트엔드 라우팅의 기준이다([레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md)). 워크플로우 에디터 캔버스도 슬러그 라우팅 2단계부터 `/w/<slug>/workflows/:id` 로 그린다.

범위 밖:

- 성공률·평균 실행 시간·증감률의 정의: [통계](CLE-OBS-STATS.md)
- 실행 상세 화면과 실행 출처 분류 규칙: [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md)
- 빈 상태 안내 문구와 공통 빈 상태 컴포넌트: [오류 화면과 빈 상태](../CLE-UI/CLE-UI-ERRORS.md)
- 워크플로우 목록 화면: [워크플로우 목록과 폴더](../CLE-WF/CLE-WF-LIST.md)
- 로그인 뒤 이동 흐름: [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md)

## 요구사항

- REQ-DASH-001 WHEN 사용자가 로그인하면 THE SYSTEM SHALL 현재 워크스페이스의 대시보드를 첫 화면으로 보인다. (원본: 0-dashboard §1)
- REQ-DASH-002 WHEN 대시보드를 열면 THE SYSTEM SHALL 전체 워크플로우 수·활성 워크플로우 수·최근 7일 실행 수·최근 7일 성공률 요약 카드 4개를 가로로 보인다. (원본: 0-dashboard §3)
- REQ-DASH-003 WHEN 최근 7일 실행 수 카드를 보이면 THE SYSTEM SHALL 직전 7일 대비 증감률을 카드 아래에 함께 보인다. (원본: 0-dashboard §3)
- REQ-DASH-004 IF 직전 7일 실행이 0건이면 THE SYSTEM SHALL 증감률을 보이지 않는다. (원본: 0-dashboard §3)
- REQ-DASH-005 WHEN 성공률 카드를 보이면 THE SYSTEM SHALL 최근 7일 성공률을 정수로 반올림해 보인다. (원본: 0-dashboard §3)
- REQ-DASH-006 WHEN 요약 카드를 그리면 THE SYSTEM SHALL 평균 실행 시간 카드를 두지 않는다. (원본: 0-dashboard §3)
- REQ-DASH-007 WHEN 대시보드를 열면 THE SYSTEM SHALL 최근 수정 순(`updatedAt` 내림차순) 상위 5개 워크플로우를 보인다. (원본: 0-dashboard §4)
- REQ-DASH-008 WHEN 사용자가 최근 워크플로우 항목을 누르면 THE SYSTEM SHALL 그 워크플로우의 에디터로 이동한다. (원본: 0-dashboard §4)
- REQ-DASH-009 WHEN 사용자가 "View All" 링크를 누르면 THE SYSTEM SHALL 워크플로우 목록으로 이동한다. (원본: 0-dashboard §4)
- REQ-DASH-010 WHEN 대시보드를 열면 THE SYSTEM SHALL 상태와 상관없이 시작 시각(`startedAt`) 내림차순으로 최근 실행 10건을 보인다. (원본: 0-dashboard §5·§7)
- REQ-DASH-011 IF 실행 상태가 아이콘 매핑에 없는 값이면 THE SYSTEM SHALL ❓ 아이콘을 보인다. (원본: 0-dashboard §5)
- REQ-DASH-012 WHEN 사용자가 최근 실행 행을 누르면 THE SYSTEM SHALL 그 실행의 상세 화면으로 이동한다. (원본: 0-dashboard §5)
- REQ-DASH-013 IF 워크스페이스에 워크플로우가 없으면 THE SYSTEM SHALL 최근 워크플로우 영역에 빈 상태 안내와 새 워크플로우 만들기 버튼을 보인다. (원본: 0-dashboard §4)
- REQ-DASH-014 IF 실행이 없으면 THE SYSTEM SHALL 최근 실행 영역에 빈 상태 안내를 보인다. (원본: 0-dashboard §5)
- REQ-DASH-015 WHEN 사용자가 헤더의 [+ New Workflow] 를 누르면 THE SYSTEM SHALL 새 워크플로우를 만들고 에디터로 이동한다. (원본: 0-dashboard §6)
- REQ-DASH-016 WHILE 화면 너비가 1280px 이상인 동안 THE SYSTEM SHALL 요약 카드를 4열로, 최근 워크플로우와 최근 실행을 2열로 배치한다. (원본: 0-dashboard §8)
- REQ-DASH-017 WHILE 화면 너비가 768px 이상 1280px 미만인 동안 THE SYSTEM SHALL 요약 카드를 2열로, 최근 워크플로우와 최근 실행을 1열로 세로로 쌓는다. (원본: 0-dashboard §8)
- REQ-DASH-018 WHILE 화면 너비가 768px 미만인 동안 THE SYSTEM SHALL 요약 카드와 두 목록을 모두 1열로 배치한다. (원본: 0-dashboard §8)

## 화면 구성

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 머리 | 맨 위 | 제목 "Dashboard", 오른쪽에 [+ New Workflow] 버튼 | 버튼을 누르면 새 워크플로우를 만들고 에디터로 이동 |
| 요약 카드 | 머리 아래, 가로 4개 | Total WF, Active, Runs(7d), Success | 읽기 전용 |
| 최근 워크플로우 | 요약 아래 왼쪽 | 최근 수정 워크플로우 5개, [View All →] 링크 | 항목을 누르면 에디터로, 링크를 누르면 목록으로 이동 |
| 최근 실행 | 요약 아래 오른쪽 | 최근 실행 10건(상태 아이콘, 워크플로우 이름, 실행 출처, 소요 시간, 시각) | 행을 누르면 실행 상세로 이동 |

## 요약 카드

| 카드 | 표시 내용 | 설명 |
| --- | --- | --- |
| Total Workflows | 전체 워크플로우 수 | 워크스페이스 안 모든 워크플로우 개수 |
| Active | 활성 워크플로우 수 | 워크플로우 활성 토글(`isActive = true`)이 켜진 워크플로우 개수. 이 토글이 트리거 발사를 막는지는 다른 문서의 미결 사항이다([트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md#미결-사항)) |
| Runs (7d) | 최근 7일 실행 수 | 직전 7일 대비 증감률(`runs7dChangePercent`)을 카드 아래에 함께 보인다. 직전 7일 실행이 0건이면 증감률을 보이지 않는다 |
| Success Rate | 최근 7일 성공률(%) | 성공률 정의는 [통계 §지표 정의](CLE-OBS-STATS.md#지표-정의) 를 따른다. 분모는 상태와 상관없는 최근 7일 전체 실행 수다(실행 중·대기 중·취소됨 포함). 카드에는 정수로 반올림해 보인다 |

평균 실행 시간(`avgExecutionTime`)은 요약 응답에 들어 있지만 카드로 보이지 않는다.

## 최근 워크플로우

| 항목 | 설명 |
| --- | --- |
| 정렬 | `updatedAt` 내림차순, 상위 5개 |
| 표시 필드 | 워크플로우 이름, 상태 배지(Active/Inactive), 마지막 수정 시각(`updatedAt`, 상대 시간) |
| 누르기 | 워크플로우 에디터(`/workflows/:id`)로 이동 |
| "View All" 링크 | 워크플로우 목록(`/workflows`)으로 이동 |
| 빈 상태 | 워크플로우가 없다는 안내와 [+ New Workflow] 버튼. 문구는 [오류 화면과 빈 상태](../CLE-UI/CLE-UI-ERRORS.md) 가 정한다 |

## 최근 실행

상태와 상관없이 시작 시각(`startedAt`) 내림차순으로 최근 실행 10건을 보인다.

| 열 | 설명 |
| --- | --- |
| 상태 | 실행 상태별 아이콘. ✅ `completed`, ❌ `failed`, ⏳ `running`·`pending`, ⛔ `cancelled`, ✋ `waiting_for_input`. 매핑에 없는 값은 ❓ 로 보인다. DTO 의 상태 값은 이 6종이다(기준: [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md)) |
| 워크플로우 이름 | 실행된 워크플로우 이름 |
| 트리거 | 실행 출처(`subworkflow`·`manual`·`schedule`·`webhook`·`unknown`) 아이콘과 라벨. 분류 규칙과 보조 라벨은 [실행 내역 §실행 출처 분류](../CLE-EXEC/CLE-EXEC-HISTORY.md#실행-출처-분류) 를 따른다 |
| 소요 시간 | 실행 소요 시간(초 또는 분) |
| 시각 | 실행 시작 시각(`startedAt`)을 상대 시간으로 보인다 |

| 동작 | 설명 |
| --- | --- |
| 행 누르기 | 그 실행의 상세 화면(`/workflows/:workflowId/executions/:executionId`)으로 이동한다. 상세 화면은 [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md) 이 정한다 |
| 빈 상태 | 실행이 없다는 안내. 문구는 [오류 화면과 빈 상태](../CLE-UI/CLE-UI-ERRORS.md) 가 정한다 |

## 빠른 동작

| 동작 | 위치 | 결과 |
| --- | --- | --- |
| + New Workflow | 페이지 머리 오른쪽 | 새 워크플로우를 만들고 에디터로 이동 |

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/dashboard/summary` | 요약 지표. 전체·활성 워크플로우 수, 최근 7일 실행 수와 직전 7일 대비 증감률, 성공률, 평균 실행 시간 |
| GET | `/api/dashboard/recent-workflows` | 최근 수정 워크플로우 5건(`updatedAt` 내림차순) |
| GET | `/api/dashboard/recent-executions` | 최근 실행 10건(`startedAt` 내림차순) |

응답 본문은 공통 응답 봉투(`{ "data": ... }`)로 감싼다. 아래 예시는 `data` 안쪽이다.

`GET /api/dashboard/summary` 응답(`DashboardSummaryDto`):

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
| --- | --- |
| `totalWorkflows` | 워크스페이스 안 전체 워크플로우 수 |
| `activeWorkflows` | 활성(`isActive`) 워크플로우 수 |
| `runs7d` | 최근 7일 실행 수 |
| `runs7dPrevious` | 직전 7일(14일 전부터 7일 전까지) 실행 수 |
| `runs7dChangePercent` | 직전 7일 대비 증감률(%). 직전 7일 실행이 0건이면 `null` |
| `successRate` | 최근 7일 성공률(%) = `completed` 수 ÷ `runs7d` × 100 |
| `avgExecutionTime` | 최근 7일 평균 실행 시간. 단위는 **밀리초**다. 완료(`completed`) 실행의 `duration_ms` 평균을 정수로 반올림한다. 실행 데이터가 없으면 0 |

## 읽는 데이터

대시보드는 자기 테이블이 없다. `DashboardService` 는 `workflow`·`execution` 레포지토리만 주입받아 집계한다(`dashboard.service.ts`). `node_execution`·`llm_usage_log` 는 읽지 않는다. LLM 비용은 대시보드가 아니라 [통계](CLE-OBS-STATS.md) 에서 본다. `integration` 테이블도 읽지 않는다.

## 구현 위치

- `codebase/frontend/src/app/(main)/w/[slug]/dashboard/page.tsx`
- `codebase/backend/src/modules/dashboard/dashboard.controller.ts`
- `codebase/backend/src/modules/dashboard/dashboard.service.ts`
- `codebase/backend/src/modules/dashboard/dto/responses/dashboard-response.dto.ts`

## Rationale

### 요약 카드에 평균 실행 시간을 두지 않는다

요약 카드는 Total, Active, Runs(7d), Success 네 가지다. 초기 초안에 있던 평균 실행 시간 카드는 보이지 않는다(`dashboard/page.tsx`). 평균 실행 시간은 요약 응답(`avgExecutionTime`, 밀리초)에 들어 있지만 따로 카드로 그리지 않는 현재 구현을 따른다.

이 절과 아래 지표 관련 결정은 2026-06-03 명세와 코드 동기화 때 코드 현실에 맞춰 정정한 근거다. 대안을 비교한 결정 기록이 아니라 코드 동기화 근거다.

### 지표 정의를 통계 문서에 모은다

성공률 분모를 최근 7일 전체 실행 수로 둔 결정과 평균 실행 시간을 완료된 실행만으로 집계하는 결정(2026-08-15)은 처음에 이 화면의 명세에 적혀 있었다. 같은 결정이 통계의 `avgDurationMs` 집계에도 걸리고 통계 명세가 이 절을 가리키고 있었다. 두 화면이 같은 정의를 쓰므로 정의와 근거를 [통계](CLE-OBS-STATS.md) 의 지표 정의 한 곳에 모았다.

### 최근 실행은 시작 시각 순으로 보인다

원문 화면 절은 최근 실행을 "완료·실패 기준 10건" 으로, 시각 열을 "실행 완료 시각" 으로 적었다. 같은 문서의 API 절과 구현(`dashboard.service.ts`)은 상태로 거르지 않고 `startedAt` 내림차순 10건을 돌려주며 화면도 `startedAt` 을 상대 시간으로 보인다. 상태 아이콘 표에도 실행 중·입력 대기가 있어 "완료·실패 기준" 과 맞지 않았다. API 절과 구현을 기준으로 바로잡았다.
