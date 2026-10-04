---
id: "CLE-TRIG-SCHEDULE"
title: "스케줄"
type: "feature"
version: 1
status: "approved"
requirements: ["REQ-SCHED-001", "REQ-SCHED-002", "REQ-SCHED-003", "REQ-SCHED-004", "REQ-SCHED-005", "REQ-SCHED-006", "REQ-SCHED-007", "REQ-SCHED-008", "REQ-SCHED-009", "REQ-SCHED-010", "REQ-SCHED-011", "REQ-SCHED-012", "REQ-SCHED-013", "REQ-SCHED-014", "REQ-SCHED-015", "REQ-SCHED-016", "REQ-SCHED-017", "REQ-SCHED-018", "REQ-SCHED-019", "REQ-SCHED-020", "REQ-SCHED-021", "REQ-SCHED-022", "REQ-SCHED-023", "REQ-SCHED-024", "REQ-SCHED-025", "REQ-SCHED-026", "REQ-SCHED-027", "REQ-SCHED-028", "REQ-SCHED-029", "REQ-SCHED-030", "REQ-SCHED-031", "REQ-SCHED-032", "REQ-SCHED-033", "REQ-SCHED-034", "REQ-SCHED-035"]
basis_superseded: false
parent: "CLE-TRIG"
ancestors: ["CLE-VISION", "CLE-TRIG"]
area: "CLE-TRIG"
content_hash: "3fc32a32f19867f20d6b3e1e6b993c0fefde02584503c11f00a7adf5b34b8fe3"
read_as: "approved_fallback"
task: "CLE-T-XYR067"
source_paths: ["spec/2-navigation/3-schedule.md", "spec/2-navigation/_product-overview.md"]
mirror_sha256: "46417abcb6d7a0a9009e06cb951811035e07ed59e66688372c69a955d27d5a2d"
etag: "sha256-144b223996c69c74ac1df483075137052acef9268c8667d29e4bcaf41acf58a9"
---
> 구현 상태: 구현됨 · 원문: `spec/2-navigation/3-schedule.md`, `spec/2-navigation/_product-overview.md` (§3.3 Schedule) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

스케줄(Schedule, `schedule`)은 Cron 표현식(cron expression, `cron_expression`)으로 워크플로우를 주기 실행하는 설정이다. 스케줄은 트리거의 서브타입이다. 스케줄마다 스케줄 유형 트리거(`Trigger.type=schedule`)가 1:1 로 붙고 스케줄 이름은 그 트리거의 이름(`trigger.name`)에 저장된다.

이 문서는 스케줄 화면(사이드바 "Schedule", 경로 `/schedules`)의 목록·딥링크·생성과 수정 대화상자·표현식과 시각 편집(visual editor) 변환·캘린더 뷰, 스케줄 API(`/api/schedules`) 계약, 스케줄 실행이 남기는 실행 출처 값을 정한다.

범위 밖 주제는 다음 문서가 정한다.

- BullMQ job scheduler 로 발사하는 흐름, 다음 실행(`next_run_at`) 계산, 트리거와 스케줄의 동기화 표: [트리거 데이터와 흐름](CLE-TRIG-DATA.md)
- 트리거 화면과 트리거 API, 트리거 삭제 정책: [트리거 관리](CLE-TRIG-MANAGE.md)
- 실행 출처(`triggerSource`)를 화면용으로 분류하는 규칙: [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md)
- 트리거 입력 파라미터를 실행 입력에 싣는 규칙: [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)
- 워크스페이스 설정 화면: [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)

## 요구사항

- REQ-SCHED-001 WHEN 사용자가 스케줄 화면을 열면 THE SYSTEM SHALL 워크스페이스의 Cron 기반 스케줄을 목록으로 표시한다. (원본: NAV-SC-01)
- REQ-SCHED-002 WHEN 사용자가 스케줄 생성·수정·삭제를 요청하면 THE SYSTEM SHALL 스케줄을 만들거나 고치거나 지운다. (원본: NAV-SC-02)
- REQ-SCHED-003 WHEN 사용자가 Cron 표현식을 입력하면 THE SYSTEM SHALL 사람이 읽을 수 있는 설명을 실시간으로 보여 준다. (원본: NAV-SC-03)
- REQ-SCHED-004 WHEN 목록 행을 그리면 THE SYSTEM SHALL 다음 실행 예정 시각을 절대 시각으로 표시한다. (원본: NAV-SC-04)
- REQ-SCHED-005 IF 다음 실행(`next_run_at`)이 NULL 이면 THE SYSTEM SHALL 다음 실행 칸에 `-` 를 표시한다.
- REQ-SCHED-006 WHEN 편집자 이상이 행의 토글 버튼을 누르면 THE SYSTEM SHALL 스케줄 활성 상태를 바꾸고 연결된 트리거와 BullMQ 작업에 반영한다. (원본: NAV-SC-05)
- REQ-SCHED-007 WHEN 사용자가 스케줄 시간대를 고르면 THE SYSTEM SHALL IANA 시간대로 저장한다. (원본: NAV-SC-06)
- REQ-SCHED-008 WHEN 사용자가 캘린더 뷰로 바꾸면 THE SYSTEM SHALL 월간 캘린더에 예정 실행을 점이나 이벤트로 표시한다. (원본: NAV-SC-07)
- REQ-SCHED-009 WHEN 스케줄을 만들면 THE SYSTEM SHALL 같은 이름·워크플로우·활성 상태의 스케줄 유형 트리거를 자동으로 만든다. (원본: NAV-SC-08)
- REQ-SCHED-010 WHEN 스케줄이나 연결된 트리거의 활성 상태가 바뀌면 THE SYSTEM SHALL 다른 쪽 활성 상태도 같은 값으로 맞춘다. (원본: NAV-SC-08)
- REQ-SCHED-011 WHEN 스케줄을 지우면 THE SYSTEM SHALL 연결된 트리거도 함께 지운다. (원본: NAV-SC-08)
- REQ-SCHED-012 WHEN 사용자가 스케줄 행 더보기(⋮)에서 "트리거에서 보기" 를 고르면 THE SYSTEM SHALL `/triggers?triggerId=…` 로 이동해 그 트리거의 상세 패널을 연다. (원본: NAV-SC-09)
- REQ-SCHED-013 IF 스케줄에 트리거가 연결되지 않았으면 THE SYSTEM SHALL 더보기(⋮)의 "실행 이력"·"트리거에서 보기" 항목을 비활성화한다.
- REQ-SCHED-014 IF 사용자 역할이 편집자 미만이면 THE SYSTEM SHALL 행의 토글·수정·삭제 버튼을 노출하지 않는다.
- REQ-SCHED-015 WHEN 스케줄 화면이 `?triggerId=` 딥링크로 열리면 THE SYSTEM SHALL 서버 필터로 그 트리거의 스케줄만 보여 주고 그 행을 강조해 한 번 스크롤한다.
- REQ-SCHED-016 WHILE `?triggerId=` 필터가 걸려 있는 동안 THE SYSTEM SHALL 필터 중이라는 안내와 "전체 스케줄 보기" 링크를 목록 위에 표시한다.
- REQ-SCHED-017 WHEN `?triggerId=` 딥링크로 행을 강조하면 THE SYSTEM SHALL 편집 대화상자를 자동으로 열지 않는다.
- REQ-SCHED-018 WHEN 생성·수정 대화상자를 열면 THE SYSTEM SHALL "스케줄을 생성하면 트리거 목록에 자동 등록됩니다" 안내와 다음 5회 실행 시각 미리보기를 보여 준다.
- REQ-SCHED-019 WHEN 사용자가 시각 편집 컨트롤을 바꾸면 THE SYSTEM SHALL `buildCronFromVisual` 로 Cron 표현식을 바로 다시 만든다.
- REQ-SCHED-020 WHEN 사용자가 Cron 표현식을 입력하면 THE SYSTEM SHALL `parseCronToVisualOrNull` 로 분해해 맞으면 시각 편집 상태를 갱신하고 맞지 않으면 직전 상태를 그대로 둔다.
- REQ-SCHED-021 WHEN Cron 값이 비어 있는 채로 시각 편집 탭에 들어오면 THE SYSTEM SHALL 기본 상태(매일 09:00)의 Cron 을 바로 적용한다.
- REQ-SCHED-022 IF 시각 편집이 Cron 표현식을 표현할 수 없으면 THE SYSTEM SHALL 안내 메시지를 보이고 사용자가 시각 컨트롤을 바꿀 때까지 표현식을 보존한다.
- REQ-SCHED-023 WHEN 스케줄 시간대를 지정하지 않으면 THE SYSTEM SHALL 워크스페이스 설정의 시간대(`settings.timezone`)를 쓴다.
- REQ-SCHED-024 IF 워크스페이스 시간대도 없으면 THE SYSTEM SHALL 기본 시간대를 쓴다(기본값은 미결 사항 참조).
- REQ-SCHED-025 WHEN 관리자 이상이 워크스페이스 시간대를 설정하면 THE SYSTEM SHALL IANA 형식을 검증해 `settings.timezone` 에 저장한다.
- REQ-SCHED-026 WHEN 스케줄 삭제 확인 대화상자를 띄우면 THE SYSTEM SHALL "연결된 트리거도 함께 삭제됩니다" 안내를 보인다.
- REQ-SCHED-027 WHEN `GET /api/schedules` 가 `sort`·`order` 를 받으면 THE SYSTEM SHALL 허용 값 목록 안의 값만 정렬에 반영하고 기본은 `created_at DESC` 로 한다.
- REQ-SCHED-028 WHEN `GET /api/schedules` 가 `triggerId` 를 받으면 THE SYSTEM SHALL 그 트리거에 연결된 스케줄만 반환한다.
- REQ-SCHED-029 WHEN `PATCH /api/schedules/:id` 가 `{ isActive }` 만 받으면 THE SYSTEM SHALL 활성 토글로 처리하고 별도 `/toggle` 경로는 두지 않는다.
- REQ-SCHED-030 WHEN 사용자가 지금 실행(`run-now`)을 요청하면 THE SYSTEM SHALL `executed_by` 에 그 사용자를 기록한 수동 실행으로 워크플로우를 시작한다.
- REQ-SCHED-031 WHEN Cron 이 자동으로 발사하면 THE SYSTEM SHALL 실행의 `trigger_id` 에 스케줄의 트리거 id 를 채운다.
- REQ-SCHED-032 WHEN 스케줄을 응답하면 THE SYSTEM SHALL 연결된 트리거를 참조 수준으로 좁혀 싣고 트리거 비밀 컬럼은 싣지 않는다.
- REQ-SCHED-033 WHEN `POST /api/schedules/preview` 가 호출되면 THE SYSTEM SHALL 받은 Cron 과 시간대로 다음 실행 시각을 계산해 돌려준다.
- REQ-SCHED-034 IF Cron 이 발사할 때 연결된 트리거의 워크플로우가 스케줄의 워크스페이스에 없으면 THE SYSTEM SHALL 실행을 만들지 않고 재시도와 `schedule_failed` 알림 없이 건너뛴 뒤 서버 에러 로그를 남긴다.
- REQ-SCHED-035 IF 지금 실행(`run-now`)에서 연결된 트리거의 워크플로우가 요청의 워크스페이스에 없으면 THE SYSTEM SHALL 실행을 만들지 않고 연결된 워크플로우가 없을 때와 같은 `400` 으로 응답한다.

## 화면 구조

스케줄 화면은 헤더, 검색·보기 전환 줄, 스케줄 목록(또는 캘린더)으로 이루어진다.

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 헤더 | 맨 위 | 제목 "Schedule", "+ Add Schedule" 버튼 | 버튼을 누르면 [생성·수정 대화상자](#생성수정-대화상자)가 열린다 |
| 검색·보기 줄 | 헤더 아래 | 검색 입력, 보기 전환(`View: List ▼`) | 목록 보기와 [캘린더 뷰](#캘린더-뷰)를 오간다 |
| 스케줄 목록 | 본문 | 스케줄마다 세 줄짜리 행 | 행 액션과 더보기(⋮) 메뉴 |

목록 행 예시는 다음과 같다.

| 상태 | 이름 | Cron 과 설명 | 셋째 줄 |
|------|------|--------------|---------|
| ● 활성 | Daily Report | `0 9 * * *` → "매일 오전 9:00" | → Daily Report Gen · Next: 2026-03-27 09:00 · ⋮ |
| ● 활성 | Weekly Sync | `0 0 * * 1` → "매주 월요일 자정" | → Data Sync · Next: 2026-03-30 00:00 · ⋮ |

### 목록 항목

| 요소 | 설명 |
|------|------|
| 상태 아이콘 | 활성(●) / 비활성(○) |
| 스케줄 이름 | 사용자가 정한 이름. 저장 위치는 연결된 트리거의 `name` 이다 |
| Cron 표현식 | 원본 Cron 표현식 |
| 사람이 읽을 수 있는 설명 | Cron 표현식을 자연어로 바꾼 설명 |
| 연결된 워크플로우 | 워크플로우 이름. 누르면 그 워크플로우 에디터(`/workflows/{id}`)로 이동한다 |
| 다음 실행 | 다음 실행 예정 시각(절대 시각). 계산할 수 없으면 `-` 다. Cron 파싱이 실패했거나 다음 발사 시각이 없어 `next_run_at` 이 NULL 인 경우다([트리거 데이터와 흐름](CLE-TRIG-DATA.md)) |
| 행 액션 | 인라인 버튼: 지금 실행(Run), 활성/비활성 토글(Toggle), 수정(Edit), 삭제(Delete). 토글·수정·삭제는 편집자 이상에게만 보인다(RoleGate). 지금 실행 버튼의 노출 권한은 [미결 사항](#미결-사항) |

### 더보기 메뉴와 딥링크

더보기(⋮) 메뉴에는 두 항목이 있다. 두 항목 모두 트리거가 연결된 스케줄에서만 활성화된다.

- "실행 이력"(화면 문구): 그 스케줄 트리거의 호출 이력 대화상자를 연다. 호출 이력의 정의는 [트리거 관리](CLE-TRIG-MANAGE.md) 가 정한다.
- "트리거에서 보기": `/triggers?triggerId=…` 딥링크로 트리거 목록에 가서 그 트리거의 상세 패널을 연다.

반대 방향 딥링크도 있다. [트리거 관리](CLE-TRIG-MANAGE.md) 화면의 "스케줄 관리에서 편집"(→ `/schedules?triggerId=…`)으로 들어오면 목록을 서버에서 그 트리거의 스케줄로 걸러 보여 준다(API 의 `?triggerId=` 필터). 서버 필터라 대상 스케줄이 몇 번째 페이지에 있든 항상 찾는다. 해당 행은 강조하고 한 번 스크롤한다. 목록 위에는 필터 중이라는 안내와 "전체 스케줄 보기"(→ `/schedules`) 해제 링크를 표시한다. 강조는 시각 표시일 뿐이고 편집 대화상자를 자동으로 열지 않는다.

### 생성·수정 대화상자

| 필드 | 설명 |
|------|------|
| 이름 | 스케줄 이름(필수) |
| 워크플로우 | 연결할 워크플로우(드롭다운) |
| Cron 표현식 | 직접 입력과 시각 편집을 탭으로 오간다. 두 탭은 하나의 Cron 값을 함께 쓰고 서로 자동으로 변환한다([표현식과 시각 편집 변환](#표현식과-시각-편집-변환)) |
| 시각 편집 | 빈도(분/시/일/주/월)를 고른 뒤 세부 시각을 정하는 UI |
| 안내 메시지 | "스케줄을 생성하면 트리거 목록에 자동 등록됩니다" |
| 사람이 읽을 수 있는 미리보기 | Cron 변환 결과를 실시간으로 표시 |
| 다음 5회 실행 시각 | 설정한 Cron 에 따른 예정 실행 시각 미리보기 |
| 시간대 | IANA 시간대 선택. 지정하지 않을 때의 폴백은 아래 참조 |

시간대를 지정하지 않으면 서버는 워크스페이스 설정의 시간대(`settings.timezone`)를 쓴다. 워크스페이스 기본 시간대의 기준 문서는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) 다. 워크스페이스 시간대도 없을 때의 기본값은 정의가 갈린다([미결 사항](#미결-사항), [워크스페이스와 멤버 §미결 사항](../CLE-ACCT/CLE-ACCT-WS.md#미결-사항)). 워크스페이스 시간대는 `PATCH /api/workspaces/:id/settings` 의 `timezone`(IANA 검증)으로 설정한다. 화면에서는 워크스페이스 설정 Overview 탭의 시간대 카드(IANA 입력, 관리자 이상)에서 편집한다([워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)).

### 표현식과 시각 편집 변환

두 탭을 오가도 사용자 설정값이 사라지지 않는다. 변환할 수 있는 패턴은 시각 편집이 만들 수 있는 다섯 가지 단순 형태로 한정한다.

| 변환 방향 | 동작 |
|-----------|------|
| 시각 컨트롤 변경 | `buildCronFromVisual(state)` 로 Cron 을 바로 다시 만들어 표현식과 시각 상태를 맞춘다 |
| 표현식 입력 | 입력값을 `parseCronToVisualOrNull(cron)` 으로 분해한다. 맞으면 시각 상태도 갱신하고 맞지 않으면 시각 상태는 직전 값을 그대로 둔다 |
| 빈 Cron 에서 시각 탭 진입 | 기본 시각 상태(`daily 09:00`)의 Cron 을 바로 적용해 사용자가 더 손대지 않아도 저장할 수 있다 |

시각 편집이 표현할 수 있는 Cron 패턴은 다음과 같다.

| 패턴 | 뜻 |
|------|------|
| `* * * * *` | 매분 |
| `M * * * *` | 매시간 M분 |
| `M H * * *` | 매일 H:M |
| `M H * * D[,D...]` | 매주 고른 요일(D ∈ 0..6) H:M |
| `M H D * *` | 매월 D일 H:M |

표현할 수 없는 Cron(step `*/N`, range `H-H`, range 가 섞인 list, 월 지정 등)은 시각 탭에 안내 메시지를 보인다. 사용자가 시각 컨트롤을 바꿀 때까지 표현식은 보존된다.

변환 유틸은 `codebase/frontend/src/lib/utils/cron-to-visual.ts` 의 `parseCronToVisualOrNull` / `buildCronFromVisual` 이다. 시각 편집 컴포넌트는 controlled 패턴으로 시각 상태를 부모(대화상자)에 올린다.

### 캘린더 뷰

캘린더 뷰는 선택 기능이다.

- 보기 전환 토글: List / Calendar
- 월간 캘린더에 예정된 실행을 점이나 이벤트로 표시한다.
- 날짜를 누르면 그날의 스케줄 상세를 표시한다.

## 트리거와의 관계

스케줄은 트리거의 서브타입이고 라이프사이클 전체에서 동기화된다. 사용자에게 보이는 규칙은 다음과 같다.

- 스케줄을 만들면 같은 이름·워크플로우·활성 상태의 스케줄 유형 트리거가 자동으로 생긴다.
- 스케줄 이름은 트리거 이름(`trigger.name`) 한곳에만 저장된다. 스케줄 수정 API 가 그 값을 쓰므로 트리거 화면에서도 같은 이름이 보인다.
- 활성 상태는 양방향으로 맞춰진다. 스케줄 쪽 토글은 트리거 `is_active` 를 바꾸고 트리거 화면 토글은 `schedule.is_active` 와 BullMQ 작업을 함께 바꾼다.
- 스케줄을 지우면 연결된 트리거도 연쇄로 지워진다. 확인 대화상자에 "연결된 트리거도 함께 삭제됩니다" 를 보인다. 반대로 트리거 화면에서 지우면 BullMQ 작업을 해제한 뒤 스케줄이 FK CASCADE 로 지워진다.
- 스케줄 유형 트리거는 트리거 화면에서 직접 만들 수 없다. 반드시 스케줄 화면에서 만든다.

이벤트별 동기화 표와 구현 순서는 [트리거 데이터와 흐름](CLE-TRIG-DATA.md) 이 정한다. 트리거 삭제 때의 자원 정리는 [트리거 관리](CLE-TRIG-MANAGE.md) 가 정한다.

## API

목록 응답 형식은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 목록 응답 규칙을 따른다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/schedules` | 목록. 쿼리: `page`, `limit`, `search`, `sort`, `order`, `triggerId`. `sort`·`order` 는 `findAll` 이 허용 값 목록으로 걸러 반영한다(기본 `created_at DESC`). `triggerId`(UUID, 선택)는 그 트리거에 연결된 스케줄만 돌려주는 필터로, 트리거에서 스케줄로 가는 딥링크가 페이지와 상관없이 대상을 찾는 데 쓴다 |
| POST | `/api/schedules` | 스케줄 생성. 본문 `workflowId` 는 연결 트리거의 `workflow_id` 가 된다. 같은 워크스페이스의 워크플로우가 아니면 400 `VALIDATION_ERROR`(`details[].field='workflowId'`)다([데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)) |
| GET | `/api/schedules/:id` | 상세 |
| PATCH | `/api/schedules/:id` | 수정. `{ isActive }` 만 보내면 활성/비활성 토글로 동작한다. 별도 `/toggle` 라우트는 없다(`schedules.controller.ts` 의 PATCH 핸들러) |
| POST | `/api/schedules/:id/run-now` | 지금 실행. 수동 실행으로 기록한다. 권한은 편집자 이상이다(현재 구현 `@Roles('editor')`). 연결된 워크플로우가 없거나 요청의 워크스페이스에 없으면 같은 400 `VALIDATION_ERROR`(메시지 `Schedule has no associated workflow`)다(REQ-SCHED-035) |
| DELETE | `/api/schedules/:id` | 삭제 |
| GET | `/api/schedules/:id/preview` | 저장된 스케줄 기준 다음 N회 실행 시각 미리보기 |
| POST | `/api/schedules/preview` | 임의 Cron 과 시간대로 다음 실행 시각을 계산한다. 스케줄을 만들기 전 화면 검증용이다(`schedules.controller.ts` 의 preview 핸들러) |

### 응답 형태

스케줄 응답(`ScheduleDto`)은 연결된 트리거를 엔티티 전체가 아니라 참조 수준으로 좁혀 함께 싣는다. 조인을 타고 트리거 비밀 컬럼이 새던 것을 막은 결과다([HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 검증 층).

| 필드 | 부재 표현 | 근거 |
|------|-----------|------|
| `trigger` | 항상 있음(기본형) | `Schedule.trigger_id` 는 NOT NULL 1:1 이다. 응답을 만드는 네 경로가 모두 채운다: `findAll`(join), `findById`(relations), `create`/`update`(저장 직후 대입, `isActive` 와 상관없음) |
| `trigger.workflow` | 키 생략([HTTP API 규약](../CLE-API/CLE-API-CONV.md) 부재 표현 기준 (b)) | (b) 로 판정한 근거는 소비자가 부재를 정상 경로로 다룬다는 점이다. 목록 매핑이 `trigger?.workflow?.name ?? ""` 로 읽는다. 부재는 생성 응답에만 있다(`create()` 는 방금 저장한 트리거를 붙이므로 그 관계가 로드되지 않는다). 목록·상세·수정에는 채워진다. e2e 가 네 응답 형태를 양성 3, 생성 음성 대조 1 로 고정한다 |

지금은 그 폴백에 닿지도 않는다. 키가 빠지는 유일한 응답(생성)을 프런트엔드가 읽지 않는다. `schedulesApi.create` 는 `Promise<void>` 로 본문을 버리고 호출부는 `schedules` queryKey 를 무효화해 다시 조회한다. 읽히지 않는 응답에는 부재를 다룰 코드 경로가 없으므로 (b) 를 자명하게 충족한다. 이것은 (b) 를 대신하는 세 번째 근거가 아니라 (b) 의 극단적인 사례다.

이 사실은 재검토 신호이기도 하다. optimistic update 등으로 생성 응답을 쓰기 시작하면 위 문장이 먼저 거짓이 된다. 그때 (b) 를 지탱하는 것은 `?? ""` 폴백 하나뿐이다.

`trigger.workflow` 는 `name` 하나만 담는다. 트리거 응답의 자매 참조([트리거 관리](CLE-TRIG-MANAGE.md))는 `id` 도 싣는다. 이 차이는 의도한 것이다. 각 참조는 그 응답을 쓰는 화면이 실제로 읽는 필드만 담는다. 스케줄 화면은 이름만 표시하고 트리거 화면은 이름에 링크를 걸 `id` 가 더 필요하다. 한쪽을 다른 쪽으로 바꾸지 않는다.

## 실행 출처 기록

스케줄로 시작한 실행은 경로에 따라 다른 컬럼을 채운다.

| 발사 경로 | 실행 행에 채우는 값 | 실행 출처 분류 결과 |
|-----------|--------------------|--------------------|
| Cron 자동 발사(`ScheduleRunnerService.process`) | `trigger_id = schedule.triggerId` | `schedule` |
| "지금 실행" 버튼(`SchedulesService.runNow`) | `executed_by = userId` | `manual` |

Cron 자동 발사에서 `trigger_id` 가 비어 있으면 실행 내역 화면이 출처를 `unknown` 으로 분류한다. 그래서 반드시 채워야 한다. 분류 규칙은 [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md), `execute()` 시그니처와 파라미터 seeding 은 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 가 정한다.

## 다른 워크스페이스의 워크플로우

두 경로 모두 실행 엔진에 실행을 시작하는 워크스페이스를 넘긴다. Cron 자동 발사는 스케줄의 워크스페이스, "지금 실행" 은 요청의 워크스페이스다. 엔진은 연결된 트리거의 워크플로우가 그 워크스페이스에 없으면 실행을 만들지 않는다. 저장 경계 이전에 남은 교차 행을 위한 동작이다([데이터 모델 개요 「저장된 교차 행 점검」](../CLE-PLAT/CLE-PLAT-DATA.md#저장된-교차-행-점검)).

| 발사 경로 | 워크플로우가 그 워크스페이스에 없을 때 |
|-----------|----------------------------------------|
| Cron 자동 발사 | 연결된 워크플로우가 없을 때처럼 건너뛰고 서버 에러 로그를 남긴다. 재시도하지 않고 `lastRunAt` · `nextRunAt` 을 바꾸지 않는다. `schedule_failed` 알림은 보내지 않는다(REQ-SCHED-034, [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) REQ-NOTIFY-052) |
| "지금 실행" | 연결된 워크플로우가 없을 때와 같은 400 이다. 두 경우를 구분하지 않는다(REQ-SCHED-035) |

## 미결 사항

- **스케줄 기본 시간대 폴백**: 스케줄 원문과 현재 구현(`SchedulesService.resolveTimezone`)은 명시값 → 워크스페이스 `settings.timezone` → `'Asia/Seoul'` 순으로 대체한다. DB 기본값도 `'Asia/Seoul'` 이다. 반면 데이터 모델의 `Workspace.settings.timezone` 서술은 워크스페이스 시간대가 없으면 서버 `process.env.TZ` → `UTC` 로 대체하고 스케줄 기본 시간대도 이 값을 따른다고 적는다([계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md)). [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md) 은 AI 시스템 컨텍스트만 `process.env.TZ` → `UTC` 이고 스케줄 시간대는 별개라고 적는다. 개인 워크스페이스를 만들 때 브라우저 시간대로 채운다는 서술도 있으나 현재 구현은 `settings={}` 로 만든다. 데이터 모델을 따르면 Cron 발사 시각이 9시간 달라질 수 있다. 스케줄과 AI 컨텍스트가 서로 다른 기본값을 써도 되는지 결정해야 한다. 워크스페이스 시간대의 기준 문서인 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#미결-사항) 에 같은 미결이 있고 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md) 도 이 결정을 따르므로 세 문서를 함께 정한다.
- **지금 실행 버튼의 노출 권한**: 스케줄 원문은 지금 실행(Run) 버튼의 권한을 적지 않는다. 권한 매트릭스([워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md))는 뷰어의 워크플로우 실행을 막고 백엔드 `run-now` 도 `@Roles('editor')` 다. 현재 프런트엔드는 Run 버튼을 RoleGate 밖에 두어 뷰어가 누르면 403 을 받는다. 화면 노출을 편집자 이상으로 맞출지 결정해야 한다.
- **워크플로우 비활성 상태가 스케줄 발사를 막는지**: 정의가 갈린다. 두 입장과 현재 구현은 [트리거 데이터와 흐름](CLE-TRIG-DATA.md) 의 미결 사항에 적는다.

## 구현 위치

- `codebase/frontend/src/app/(main)/w/[slug]/schedules/page.tsx`
- `codebase/frontend/src/lib/utils/cron-to-visual.ts`
- `codebase/backend/src/modules/schedules/schedules.controller.ts`
- `codebase/backend/src/modules/schedules/schedules.service.ts`
- `codebase/backend/src/modules/schedules/schedule-runner.service.ts`
- `codebase/backend/src/modules/schedules/schedules.module.ts`
- `codebase/backend/src/modules/workspaces/workspaces.service.ts`
- `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`
- `codebase/backend/src/common/utils/timezone.ts`
- `codebase/backend/src/modules/schedules/dto/**`
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (응답 형태 네 가지를 양성 3과 생성 음성 대조 1로 고정)
- `codebase/backend/src/shared/testing/schedule-trigger-ref*.ts` (위 e2e 단언의 정본: 좁힌 참조 키셋과 비밀 컬럼 목록)

## Rationale

### 목록 정렬 반영

`GET /api/schedules` 의 `sort`·`order` 는 한동안 DTO 로 받기만 하고 `findAll` 이 무시해서 미구현으로 표시했다. 그 뒤 `findAll` 이 허용 값 목록 기반 `orderBy` 를 구현해 표시를 현행화했다(2026-06-10). 미구현 표시를 푼 것은 기능 약속을 뒤집은 것이 아니라 구현이 끝나 문서를 맞춘 것이다.

### 스케줄 유형 트리거의 생성 경로를 스케줄 화면으로 한정한 이유

트리거 화면에서 스케줄 트리거를 직접 만들지 못하게 한 것은 스케줄 행 없는 고아 트리거를 API 수준에서 막기 위해서다. 스케줄 생성 경로만 트리거와 스케줄을 두 단계로 함께 만드는 것을 보장한다([트리거 데이터와 흐름](CLE-TRIG-DATA.md)).

### 딥링크를 방향마다 다르게 소비하는 이유

두 방향의 `?triggerId=` 딥링크가 서로 다르게 동작하는 것은 의도한 것이다. 목적지마다 데이터에 접근하는 방식이 다르다.

- 스케줄 → 트리거(`/triggers?triggerId=`): 트리거 상세 패널을 자동으로 연다. 상세 패널은 트리거 id 로 단건 리소스를 바로 조회하므로 목록 로드나 페이지와 상관없이 언제나 열 수 있다([트리거 관리](CLE-TRIG-MANAGE.md)).
- 트리거 → 스케줄(`/schedules?triggerId=`): 목록을 서버 `?triggerId=` 필터로 그 트리거의 스케줄로 좁히고 행을 강조·스크롤한다. 서버 필터라 페이지 위치와 상관없이 대상을 찾는다. 패널 자동 열기 대신 목록 필터와 강조를 고른 이유는 두 가지다. 스케줄 편집은 다음 실행·활성 상태 같은 목록 맥락 안에서 하는 편이 자연스럽다. 그리고 "전체 보기" 해제 경로를 분명히 둘 수 있다. 편집 대화상자는 자동으로 열지 않는다.
