---
id: "CLE-OBS-STATS"
title: "통계"
type: "feature"
version: 1
status: "approved"
requirements: ["REQ-STATS-001", "REQ-STATS-002", "REQ-STATS-003", "REQ-STATS-004", "REQ-STATS-005", "REQ-STATS-006", "REQ-STATS-007", "REQ-STATS-008", "REQ-STATS-009", "REQ-STATS-010", "REQ-STATS-011", "REQ-STATS-012", "REQ-STATS-013", "REQ-STATS-014", "REQ-STATS-015", "REQ-STATS-016", "REQ-STATS-017", "REQ-STATS-018", "REQ-STATS-019", "REQ-STATS-020", "REQ-STATS-021"]
basis_superseded: false
parent: "CLE-OBS"
ancestors: ["CLE-VISION", "CLE-OBS"]
area: "CLE-OBS"
content_hash: "34280c00ed4dedb37f5d9cccae74a3d448927166feeed76ca1f0d0279607c008"
read_as: "approved_fallback"
task: "CLE-T-RSF163"
source_paths: ["spec/2-navigation/0-dashboard.md", "spec/2-navigation/7-statistics.md", "spec/2-navigation/_product-overview.md", "spec/data-flow/9-observability.md"]
mirror_sha256: "f18212dd441767f09d762300c90bd75de6405e844681317fc1b804f37d9b6249"
etag: "sha256-136d3d3c809d3d3787c1871cd024f9a4fc1aa719a4c71245f2cae22f63f9ee17"
---
> 구현 상태: 구현됨 · 원문: `spec/2-navigation/7-statistics.md`, `spec/2-navigation/_product-overview.md` (§3.8), `spec/2-navigation/0-dashboard.md` (Rationale 의 지표 정의), `spec/data-flow/9-observability.md` (§1.2·§2.1·Rationale 의 통계 부분) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

통계(Statistics) 화면은 현재 워크스페이스의 워크플로우 실행을 기간과 워크플로우로 걸러 집계해 보여 준다. 경로는 `/statistics` 이고 실제 URL 은 `/w/<slug>/statistics` 다([레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md)). 실행 횟수·성공률·실패율·평균 실행 시간 요약, 실행 추이·오류 분포·상위 워크플로우 차트, 노드 통계, LLM 토큰 사용량을 보여 주고 내보내기를 제공한다.

이 문서는 대시보드와 통계가 함께 쓰는 실행 지표(성공률, 평균 실행 시간, 증감률)의 정의도 정한다.

범위 밖:

- 대시보드 요약 카드와 최근 목록: [대시보드](CLE-OBS-DASHBOARD.md)
- 개별 실행의 원인 분석(실행 상세): [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md)
- LLM 사용량 적재와 비용 계산: [LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md)
- 운영 관측용 OTel 메트릭과 통계 API 의 역할 구분: [로깅과 헬스 체크](CLE-OBS-LOGGING.md)
- 역할별 조회 권한(모든 역할이 조회 가능): [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)

## 요구사항

- REQ-STATS-001 WHEN 사용자가 통계 화면을 열면 THE SYSTEM SHALL 현재 워크스페이스의 워크플로우 실행 통계를 보여 준다. (원본: NAV-ST-01)
- REQ-STATS-002 WHEN 사용자가 기간을 고르면 THE SYSTEM SHALL 그 기간의 실행 횟수와 성공·실패 비율을 보여 준다. (원본: NAV-ST-02)
- REQ-STATS-003 WHEN 사용자가 기간 필터를 열면 THE SYSTEM SHALL 오늘·최근 7일·최근 30일·최근 90일 프리셋과 사용자 지정 범위를 제공한다. (원본: 7-statistics §2.1)
- REQ-STATS-004 WHEN 사용자가 기간을 고르지 않으면 THE SYSTEM SHALL 최근 7일을 기본으로 집계한다. (원본: 7-statistics §2.1)
- REQ-STATS-005 WHEN 사용자가 워크플로우 필터에서 특정 워크플로우를 고르면 THE SYSTEM SHALL 집계를 그 워크플로우로 좁힌다. (원본: 7-statistics §2.1)
- REQ-STATS-006 WHEN 요약을 보여 주면 THE SYSTEM SHALL 총 실행 횟수와 직전 같은 길이 기간 대비 증감률을 함께 보인다. (원본: 7-statistics §2.2)
- REQ-STATS-007 WHEN 평균 실행 시간을 계산하면 THE SYSTEM SHALL 상태가 `completed` 인 실행만 넣는다. (원본: 7-statistics R-0)
- REQ-STATS-008 WHEN 통계를 보여 주면 THE SYSTEM SHALL 워크플로우별 평균 실행 시간을 제공한다. (원본: NAV-ST-03)
- REQ-STATS-009 WHEN 실행 추이 차트를 보이면 THE SYSTEM SHALL 기간 안 일자별 실행 횟수를 성공과 실패로 나눈 스택 막대로 보인다. (원본: 7-statistics §2.3)
- REQ-STATS-010 WHEN 오류 분포 차트를 보이면 THE SYSTEM SHALL 실패 실행을 워크플로우별로 나눈 비율을 파이 또는 도넛 차트로 보인다. (원본: NAV-ST-04)
- REQ-STATS-011 WHEN 오류 분포 API 를 부르면 THE SYSTEM SHALL 실패 건수 내림차순으로 상위 20개 워크플로우를 돌려준다. (원본: 7-statistics §3)
- REQ-STATS-012 WHEN 상위 워크플로우 차트를 보이면 THE SYSTEM SHALL 실행 횟수 기준 상위 10개 워크플로우를 수평 막대로 보인다. (원본: 7-statistics §2.3)
- REQ-STATS-013 WHEN 워크플로우 필터로 특정 워크플로우를 고르면 THE SYSTEM SHALL 그 워크플로우의 노드별 평균 실행 시간과 에러율을 보인다. (원본: NAV-ST-05)
- REQ-STATS-014 WHEN 노드별 통계를 보이면 THE SYSTEM SHALL 평균 실행 시간이 가장 긴 노드를 병목으로 강조한다. (원본: 7-statistics §2.4)
- REQ-STATS-015 WHEN LLM 토큰 사용량을 보이면 THE SYSTEM SHALL 모델 프로바이더별·모델별 입력 토큰과 출력 토큰을 나눠 보인다. (원본: NAV-ST-06)
- REQ-STATS-016 WHEN LLM 토큰 사용량을 보이면 THE SYSTEM SHALL 공개 가격 기준 예상 비용을 참고용으로 함께 보인다. (원본: 7-statistics §2.5)
- REQ-STATS-017 WHEN LLM 토큰 사용량을 보이면 THE SYSTEM SHALL 기간 안 일별 토큰 사용량 추이를 차트로 보인다. (원본: 7-statistics §2.5)
- REQ-STATS-018 WHEN 사용자가 CSV 내보내기를 고르면 THE SYSTEM SHALL 통계 데이터를 CSV 파일로 내려준다. (원본: NAV-ST-07)
- REQ-STATS-019 WHEN 사용자가 JSON 내보내기를 고르면 THE SYSTEM SHALL 통계 요약 데이터를 JSON 파일로 내려준다. (원본: NAV-ST-07)
- REQ-STATS-020 WHEN 통계 API 가 쿼리를 받으면 THE SYSTEM SHALL `period`·`workflowId`·`startDate`·`endDate` 를 camelCase 이름으로 받는다. (원본: 7-statistics §3)
- REQ-STATS-021 WHEN `period` 가 `custom` 이면 THE SYSTEM SHALL `startDate`·`endDate` 로 집계 범위를 정한다. (원본: 7-statistics §2.1)

## 지표 정의

대시보드와 통계가 함께 쓰는 실행 지표다. 두 화면은 같은 이름의 지표를 같은 식으로 계산한다.

| 지표 | 정의 | 쓰는 곳 |
| --- | --- | --- |
| 성공률(success rate, `successRate`) | 완료(`completed`) 실행 수 ÷ 기간 안 전체 실행 수 × 100. 분모에는 상태와 상관없이 기간 안의 모든 실행이 들어간다(실행 중·대기 중·취소됨 포함) | 대시보드 성공률 카드(최근 7일), 통계 요약 |
| 실패율 | 기간 안 실행 중 실패 비율(%) | 통계 요약 |
| 평균 실행 시간(average duration) | 완료(`completed`) 실행의 `duration_ms` 평균. 단위는 밀리초다. 실행이 없으면 0 이다 | 대시보드 요약 응답(`avgExecutionTime`), 통계 요약(`avgDurationMs`), 상위 워크플로우 집계 |
| 증감률 | 직전 같은 길이 구간 대비 총 실행 수의 변화율(%). 직전 구간이 0건이면 값이 없다(`null`) | 대시보드 `runs7dChangePercent`, 통계 `totalExecutionsChangeRate` |

- 성공률 정의는 대시보드 원문이 정했다. 통계 요약도 현재 구현이 같은 식을 쓴다(`statistics.service.ts` 의 `buildSummary`).
- 평균 실행 시간의 `completed` 한정은 요약과 상위 워크플로우(워크플로우별) 두 집계에 걸린다. 노드별 통계의 노드 평균 실행 시간은 `completed` 한정이 아니다. 현재 구현은 `node_execution.duration_ms` 가 있는 행을 모두 평균한다.
- 증감률의 `null` 규칙은 대시보드 원문(`runs7dChangePercent`)이 정했다. 통계의 `totalExecutionsChangeRate` 도 현재 구현이 같은 규칙과 반올림(소수 둘째 자리)을 쓴다.

## 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 머리 | 맨 위 | 제목, 기간 필터, 워크플로우 필터 | 필터를 바꾸면 모든 집계를 다시 불러온다 |
| 요약 카드 | 머리 아래, 가로 4개 | 총 실행(Total Runs), 성공률(Success Rate), 실패율(Failure Rate), 평균 실행 시간(Avg Duration) | 읽기 전용 |
| 실행 추이 | 요약 아래, 전체 폭 | 일자별 스택 막대 차트 | 읽기 전용 |
| 오류 분포 · 상위 워크플로우 | 실행 추이 아래, 2열 | 왼쪽 파이·도넛 차트, 오른쪽 수평 막대 차트 | 읽기 전용 |
| LLM 토큰 사용량 | 맨 아래, 전체 폭 | 프로바이더·모델·토큰·예상 비용 표, 일별 추이 차트, 내보내기 메뉴 | 내보내기 형식 선택 |
| 노드별 통계 | 워크플로우 필터로 특정 워크플로우를 골랐을 때 | 노드별 평균 실행 시간·에러율, 병목 노드 강조 | 읽기 전용 |

### 필터

| 필터 | 옵션 |
| --- | --- |
| 기간 | 오늘(`1d`), 최근 7일(`7d`, 기본), 최근 30일(`30d`), 최근 90일(`90d`). 프리셋 버튼과 사용자 지정 범위 선택기를 모두 제공한다. 백엔드 `QueryStatisticsDto` 의 `period` 는 `1d`·`7d`·`30d`·`90d`·`custom` 이다. `custom` 은 `startDate`·`endDate` 와 함께 쓴다 |
| 워크플로우 | 전체 또는 특정 워크플로우 |

### 요약 카드

| 카드 | 내용 |
| --- | --- |
| Total Runs | 선택 기간의 총 실행 횟수. 직전 같은 길이 기간 대비 증감률(`totalExecutionsChangeRate`)을 함께 보인다(`StatisticsSummaryDto` 필드를 프런트엔드 카드가 그린다) |
| Success Rate | 성공률(%). 정의는 [지표 정의](#지표-정의) |
| Failure Rate | 실패율(%) |
| Avg Duration | 평균 실행 시간. 정의는 [지표 정의](#지표-정의) |

### 차트

| 차트 | 내용 |
| --- | --- |
| 실행 추이(Executions Over Time) | 기간 안 일자별 실행 횟수. 성공(초록)과 실패(빨강)의 스택 막대 차트 |
| 오류 분포(Error Distribution) | 실패 건수의 **워크플로우별** 비율(파이·도넛 차트). `GET /api/statistics/errors` 가 실패 실행을 워크플로우별로 집계(`workflowId`·`workflowName`·`errorCount`·`lastErrorAt`)하고 차트는 `workflowName` 을 분류 키로 쓴다. 에러 유형이나 에러 코드별 분류가 아니다 |
| 상위 워크플로우(Top Workflows) | 실행 횟수 기준 상위 워크플로우(수평 막대 차트). 현재 구현의 API 응답에는 워크플로우별 성공률과 평균 실행 시간도 들어 있다 |

### 노드별 통계

워크플로우 필터로 특정 워크플로우를 골랐을 때 보인다.

| 항목 | 내용 |
| --- | --- |
| 노드별 평균 실행 시간 | 워크플로우 안 각 노드의 평균 소요 시간 |
| 노드별 에러율 | 노드별 실패 비율 |
| 병목 노드 표시 | 평균 실행 시간이 가장 긴 노드를 강조한다 |

### LLM 토큰 사용량

| 항목 | 내용 |
| --- | --- |
| 모델 프로바이더별 토큰 사용량 | 입력·출력 토큰을 나눠 보인다 |
| 모델별 토큰 사용량 | 모델별 상세 |
| 예상 비용 | 공개 가격 기준 추정 비용(참고용). 단가표와 비용 계산은 [LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md) 이 정한다 |
| 일별 추이 | 기간 안 일별 토큰 사용량 추이 차트 |

### 데이터 내보내기

| 형식 | 내용 |
| --- | --- |
| CSV | 원문은 실행 내역의 행 단위 원시 데이터로 정한다. 현재 구현과 정의가 갈린다. [미결 사항](#미결-사항) 참조 |
| JSON | 통계 요약 데이터. 현재 구현은 요약·일자별 추이·오류 분포·상위 워크플로우를 한 파일(`statistics-<period>.json`)에 담는다 |

## API

모든 응답은 공통 응답 봉투(`{ "data": ... }`)로 감싼다([HTTP API 규약](../CLE-API/CLE-API-CONV.md)).

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/statistics/summary` | 요약 카드 데이터(쿼리 `period`, `workflowId`) |
| GET | `/api/statistics/executions` | 기간 안 일자별 실행 집계 |
| GET | `/api/statistics/errors` | **워크플로우별** 실패 집계. 실패 건수 내림차순, 상위 20건 |
| GET | `/api/statistics/top-workflows` | 실행 횟수 기준 상위 10개 워크플로우 |
| GET | `/api/statistics/node-stats` | 노드별 통계(쿼리 `workflowId`) |
| GET | `/api/statistics/llm-usage/summary` | LLM 토큰 사용량 요약. 모델 프로바이더 × 모델별 합계와 추정 비용 |
| GET | `/api/statistics/llm-usage/timeseries` | LLM 토큰 사용량 시계열. 일자 × 모델 프로바이더별 |
| GET | `/api/statistics/export` | 데이터 내보내기(쿼리 `format=csv` 또는 `json`) |

모든 엔드포인트는 쿼리 파라미터 `QueryStatisticsDto`(`period`·`workflowId`·`startDate`·`endDate`)를 함께 쓴다. `workflow_id` 가 아니라 camelCase `workflowId` 다.

## 읽는 데이터

통계는 자기 테이블이 없다. 다른 도메인이 쌓은 행을 읽어 집계만 한다.

| 원천 테이블 | 집계 |
| --- | --- |
| `execution` | 전체 실행 수, 실패 수, 성공률, 평균 실행 시간 |
| `node_execution` | 노드별 실행 횟수·평균 시간·에러율 |
| `llm_usage_log` | 모델·기간별 토큰과 비용([LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md)) |
| `workflow` | 워크스페이스 범위 필터와 워크플로우 이름 join |

`integration` 테이블은 읽지 않는다. 같은 실행 수와 LLM 사용량을 OTel 메트릭으로도 볼 수 있지만 역할이 다르다. 통계 API 가 제품 분석과 과거 추세의 기준이다([로깅과 헬스 체크](CLE-OBS-LOGGING.md)).

## 미결 사항

- **CSV 내보내기의 내용**: 원문 화면 정의(§2.6)는 CSV 를 실행 내역의 행 단위 원시 데이터로 정한다. 현재 구현(`statistics.service.ts` 의 `exportData`)은 일자별 집계 행(`date,total,completed,failed,cancelled`)을 낸다. 실행 한 건마다 한 행을 내는 원문대로 구현할지, 일자별 집계를 CSV 정의로 바꿀지 결정이 필요하다.

## 구현 위치

- `codebase/frontend/src/app/(main)/w/[slug]/statistics/page.tsx`
- `codebase/backend/src/modules/statistics/**`

## Rationale

### 평균 실행 시간은 완료된 실행만 집계한다 (2026-08-15)

`avgExecutionTime`(대시보드)과 `avgDurationMs`(통계 요약, 상위 워크플로우)는 예전에 `duration_ms IS NOT NULL` 로만 걸렀다. 그 방어가 통한 이유는 필터가 아니라 우연이었다. 취소·타임아웃 종료 경로가 이 컬럼을 비워 두었기 때문에 자동으로 빠졌다. EIA 종결 이벤트에 `durationMs` 를 싣기 시작하면서 그 다섯 경로가 값을 채운다([EIA 알림 웹훅 §종결 이벤트 필드 집합](../CLE-IX/CLE-EIA-NOTIFY.md#종결-이벤트-필드-집합)). 필터가 없으면 입력 대기 중 취소(상한 24.8일)의 **대기 시간**이 평균에 들어간다.

`completed` 만 남긴 이유: `finalizeStalledExhausted` 가 `FAILED` 로 끝나서 실패 상태도 오염된다. 오염되지 않은 상태는 `completed` 하나뿐이다.

부수 효과로 지표 정의가 좁아졌다. 예전에 들어가던 정상 실패와 사용자 중단(stop) 취소의 실제 소요 시간이 평균에서 빠진다. 사용자에게 보이는 숫자가 바뀌는 변경이다(PR #1171).

원문 통계 명세는 이 한정이 "요약과 워크플로우별(§2.4)" 두 집계에 걸린다고 적었다. §2.4 는 노드별 통계라 번호가 틀렸다. 한정이 걸리는 워크플로우별 집계는 상위 워크플로우(§2.3)다. 이 문서는 바로잡은 쪽으로 적는다.

### 성공률 분모는 기간 안 전체 실행 수다

성공률 분모는 `completed + failed` 가 아니라 상태와 상관없는 기간 안 전체 실행 수다(실행 중·대기 중·취소됨 포함). 초기 대시보드 명세 초안은 분모를 `completed + failed` 로 적었다. 구현(`dashboard.service.ts`)은 전체 실행 수를 분모로 쓴다. "최근 활동 대비 성공 비율" 이라는 카드의 뜻에 맞게 진행 중·취소 건도 분모에 넣는 현재 구현을 기준으로 삼고 명세를 맞췄다. 분모를 `completed + failed` 로 바꾸려면 구현을 바꿔야 하며 지금은 채택하지 않는다.

### LLM 사용량 API 를 `summary` 와 `timeseries` 두 엔드포인트로 나눈다

LLM 토큰 사용량 위젯에는 집계 축이 다른 두 뷰가 있다. 표는 모델 프로바이더 × 모델 축의 기간 합계(추정 비용 포함)이고 추이 차트는 일자 × 모델 프로바이더 축의 시계열이다. 한 엔드포인트로 합치면 두 문제가 생긴다. 한쪽 뷰만 갱신해도 다른 축의 전체 집계를 늘 다시 계산해 보내야 한다. 클라이언트가 한 응답을 두 축으로 다시 집계해야 한다. 축이 다른 집계는 엔드포인트를 나눠 위젯마다 따로 불러오고 캐시한다. 다른 차트(`/executions`, `/errors`, `/top-workflows`)가 위젯별 엔드포인트인 것과 같은 원칙이다.

### 쿼리 파라미터를 camelCase `workflowId` 로 둔다

쿼리 파라미터가 NestJS `QueryStatisticsDto` 프로퍼티에 이름 그대로 바인딩된다. DTO·응답 본문과 같은 camelCase 로 맞추면 이름 변환 계층이 필요 없다. snake_case 쿼리(`workflow_id`)를 받으면 응답(camelCase)과 표기가 갈라져 프런트엔드 호출부에서 섞어 쓰는 실수가 생긴다. API 절의 camelCase 안내는 이 통일이 실수로 깨지지 않게 하는 표시다.

### 오류 분포를 에러 유형이 아니라 워크플로우별 실패로 집계한다

이 화면의 진단 단위는 "어느 워크플로우가 자주 실패하는가" 다. 사용자가 할 행동(그 워크플로우의 실행 내역에 들어가 원인 확인)이 워크플로우 단위이기 때문이다. 에러 유형·코드 축은 노드와 통합마다 형식이 달라 안정된 분류 축이 되지 못한다. 개별 실패의 원인 분석은 [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md) 의 실행 상세가 맡는다. 그래서 `GET /api/statistics/errors` 는 `workflowName` 을 분류 키로 집계한다.

요구사항 NAV-ST-04 의 원문 표현 "에러 발생 빈도 및 유형별 분류" 는 이 결정 전의 문구다. 이 문서는 결정대로 "워크플로우별 오류 분포" 로 적는다.

### 사전 집계 테이블을 두지 않는다

지금 워크스페이스 규모에서는 요청마다 원본 테이블을 집계해도 충분하다. 대시보드는 `workflow`·`execution` 을, 통계는 여기에 `node_execution`·`llm_usage_log` 를 더 읽는다. 데이터가 커지면 시간 단위 사전 집계 테이블(`statistics_hourly`)을 두고 일일 배치로 채우는 방향을 검토한다(P2 이후).
