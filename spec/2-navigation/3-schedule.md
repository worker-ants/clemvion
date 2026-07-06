---
id: schedule
status: implemented
code:
  - codebase/frontend/src/app/(main)/schedules/page.tsx
  - codebase/frontend/src/lib/utils/cron-to-visual.ts
  - codebase/backend/src/modules/schedules/schedules.controller.ts
  - codebase/backend/src/modules/schedules/schedules.service.ts
  - codebase/backend/src/modules/schedules/schedule-runner.service.ts
  - codebase/backend/src/modules/schedules/schedules.module.ts
  - codebase/backend/src/modules/workspaces/workspaces.service.ts
  - codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts
  - codebase/backend/src/common/utils/timezone.ts
  - codebase/backend/src/modules/schedules/dto/**
---

# Spec: 스케줄 관리 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#33-schedule-스케줄) · [Spec 레이아웃](./_layout.md) · [데이터 모델 - Schedule](../1-data-model.md#29-schedule)

---

## 1. 화면 구조

```
┌─────────────────────────────────────────────────────────┐
│  Schedule                           [+ Add Schedule]    │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ 🔍 Search...     │  │ View: List ▼    │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ● Daily Report                                      │ │
│  │   0 9 * * *  →  "매일 오전 9:00"                    │ │
│  │   → Daily Report Gen    Next: 2026-03-27 09:00  ⋮  │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ ● Weekly Sync                                       │ │
│  │   0 0 * * 1  →  "매주 월요일 자정"                  │ │
│  │   → Data Sync           Next: 2026-03-30 00:00  ⋮  │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 기능 상세

### 2.1 스케줄 목록 항목

| 요소 | 설명 |
|------|------|
| 상태 아이콘 | Active(●) / Inactive(○) |
| 스케줄 이름 | 사용자 지정 이름 |
| Cron 표현식 | 원본 Cron 표현식 |
| 사람이 읽을 수 있는 설명 | Cron 표현식을 자연어로 변환한 설명 |
| 연결된 워크플로우 | 워크플로우 이름 표기. 클릭 시 해당 워크플로우 에디터(`/workflows/{id}`)로 이동 |
| 다음 실행 시각 | 다음 예정된 실행 시각 (절대 시간) |
| 행 액션 | 인라인 버튼: 즉시 실행(Run), 활성/비활성 토글(Toggle), 수정(Edit), 삭제(Delete). 토글·수정·삭제는 editor 이상 권한(RoleGate)에서만 노출 |

> 더보기(⋮) 오버플로 메뉴는 "실행 이력"(트리거 호출 이력 Dialog)과 "트리거에서 보기"(→ `/triggers?triggerId=…` 딥링크로 Trigger 목록에서 해당 트리거 상세 drawer 오픈) 항목을 제공한다. 두 항목 모두 트리거가 연결된 스케줄에서만 활성화된다 (`codebase/frontend/src/app/(main)/schedules/page.tsx`).

> **inbound `?triggerId=` 딥링크**: [트리거 목록](./2-trigger-list.md#21-트리거-목록-항목)의 "스케줄 관리에서 편집"(→ `/schedules?triggerId=…`)으로 진입하면, 목록을 **서버측에서 그 트리거의 스케줄로 필터**(§4 `?triggerId=`)해 보여준다. 서버 필터라 대상 스케줄이 몇 번째 페이지에 있든(cross-page) 항상 찾으며, 해당 행을 강조하고 한 번 스크롤한다. 필터 중임을 알리는 안내와 **"전체 스케줄 보기"**(→ `/schedules`) 해제 링크를 목록 위에 표시한다. 강조는 시각 표시일 뿐 편집 다이얼로그를 자동으로 열지는 않는다.

### 2.2 스케줄 생성/수정 다이얼로그

| 필드 | 설명 |
|------|------|
| 이름 | 스케줄 이름 (필수) |
| 워크플로우 | 연결할 워크플로우 선택 (드롭다운) |
| Cron 표현식 | 직접 입력 또는 시각적 편집기 (탭으로 전환). 두 모드는 단일 cron 값을 공유하며 양방향 자동 변환 (§2.2.1). |
| 시각적 편집기 | 빈도(분/시/일/주/월) 선택 → 세부 시간 설정 UI |
| 안내 메시지 | "스케줄을 생성하면 트리거 목록에 자동 등록됩니다" 인포 텍스트 |
| 사람이 읽을 수 있는 미리보기 | Cron 변환 결과 실시간 표시 |
| 다음 5회 실행 시각 | 설정된 Cron에 따른 예정 실행 시각 미리보기 |
| 타임존 | IANA 타임존 선택. 미지정 시 서버가 **워크스페이스 설정(`settings.timezone`) → `'Asia/Seoul'`** 순으로 fallback 한다 (`SchedulesService.resolveTimezone`: 명시값 > workspace settings.timezone > 'Asia/Seoul'). 워크스페이스 타임존은 `PATCH /api/workspaces/:id/settings` 의 `timezone`(IANA 검증) 으로 설정하며, 워크스페이스 설정 Overview 탭의 타임존 카드(IANA 입력, admin 이상)에서 편집한다 |

#### 2.2.1 표현식 ↔ 시각 편집 자동 변환

두 탭 사이를 전환해도 사용자의 설정값이 손실되지 않는다. 변환 가능 패턴은 시각 편집기가 produce 할 수 있는 5개 단순 형태에 한정한다.

| 변환 방향 | 동작 |
|-----------|------|
| Visual 컨트롤 변경 | `buildCronFromVisual(state)` 로 cron 을 즉시 재생성하여 표현식과 시각 state 가 동기화된다. |
| 표현식 입력 | 입력값을 `parseCronToVisualOrNull(cron)` 으로 분해한다. 매칭되면 시각 state 도 갱신; 매칭되지 않으면 시각 state 는 직전 값을 그대로 둔다. |
| 빈 cron 에서 시각 탭 진입 | 디폴트 시각 state(`daily 09:00`) 의 cron 을 즉시 적용해 사용자가 추가 행동 없이도 저장 가능. |

**시각 편집기가 표현 가능한 cron 패턴**

| 패턴 | 의미 |
|------|------|
| `* * * * *` | 매 분 |
| `M * * * *` | 매 시간, M 분 |
| `M H * * *` | 매일 H:M |
| `M H * * D[,D...]` | 매주 선택된 요일 (D ∈ 0..6) H:M |
| `M H D * *` | 매월 D일 H:M |

**표현 불가 cron** (step `*/N`, range `H-H`, list-with-range, month 지정 등) 은 시각 탭에서 안내 메시지를 표시하며, 사용자가 시각 컨트롤을 변경할 때까지 표현식은 보존된다.

> 변환 유틸: `codebase/frontend/src/lib/utils/cron-to-visual.ts` 의 `parseCronToVisualOrNull` / `buildCronFromVisual`. 시각 편집기 컴포넌트는 controlled 패턴으로 부모(다이얼로그)에 시각 state 를 lift 한다.

### 2.3 캘린더 뷰 (선택적)

- 뷰 전환 토글: List / Calendar
- 월간 캘린더에 예정된 실행을 점/이벤트로 표시
- 날짜 클릭 시 해당 일의 스케줄 상세 표시

---

## 3. Trigger 자동 생성 규칙

Schedule은 [Trigger의 서브타입](../1-data-model.md#291-trigger--schedule-동기화-규칙)이다. 라이프사이클 전반에서 동기화된다.

| 이벤트 | 동작 |
|--------|------|
| Schedule 생성 | 동일 이름/워크플로우/활성 상태의 Trigger(type=schedule)를 자동 생성 |
| Schedule 이름 수정 | 연결된 Trigger 이름 동기화 |
| Schedule 활성/비활성 | 연결된 Trigger is_active 동기화 (역방향도 동일 — Trigger 화면 토글이 schedule.is_active 와 BullMQ job 을 함께 갱신, [data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화) 참조) |
| Schedule 삭제 | 연결된 Trigger cascade 삭제 (확인 다이얼로그에 "연결된 트리거도 함께 삭제됩니다" 안내) |

**제약:**
- Schedule 유형 트리거는 Trigger 화면에서 직접 생성 불가 — 반드시 Schedule 화면에서 생성
- Schedule 화면에서 삭제 시 Trigger도 함께 삭제됨 (역방향: Trigger 화면 삭제도 `removeJob` 으로 BullMQ 엔트리를 해제한 뒤 schedule 을 FK CASCADE 삭제 — [data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화))

---

## 4. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/schedules | 목록 조회 (쿼리: page, limit, search, sort, order, `triggerId`). sort/order 는 `findAll` 이 whitelist 기반으로 반영(기본 `created_at DESC`). `triggerId`(UUID, optional)는 해당 트리거에 연결된 스케줄만 반환하는 필터로, §2.1 의 트리거→스케줄 딥링크가 cross-page 로 대상을 찾는 데 쓴다. 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| POST | /api/schedules | 스케줄 생성 |
| GET | /api/schedules/:id | 상세 조회 |
| PATCH | /api/schedules/:id | 수정. `{ isActive }` 만 보내면 활성/비활성 토글로 동작한다 (별도 `/toggle` 라우트는 없음 — schedules.controller.ts:183) |
| POST | /api/schedules/:id/run-now | 즉시 실행 (manual 라벨로 기록) |
| DELETE | /api/schedules/:id | 삭제 |
| GET | /api/schedules/:id/preview | 등록된 스케줄 기준 다음 N회 실행 시각 미리보기 |
| POST | /api/schedules/preview | 임의 cron 식·타임존으로 다음 실행 시각 계산 (스케줄 생성 전 UI 검증용 — schedules.controller.ts:117) |

---

## 5. 실행 출처 기록 규약

| 발화 경로 | Execution 행에 채우는 값 | 트리거 출처 분류 결과 |
|-----------|--------------------------|------------------------|
| Cron 자동 발화 (`ScheduleRunnerService.process`) | `trigger_id = schedule.triggerId` | `schedule` ([실행 내역 §2.4](./14-execution-history.md#24-테이블)) |
| "지금 실행" 버튼 (`SchedulesService.runNow`) | `executed_by = userId` | `manual` |

상세 시그니처는 [Spec 실행 엔진 §6.1.1](../5-system/4-execution-engine.md#611-트리거-입력-파라미터-seeding) 참조. cron 자동 발화 시 `trigger_id` 가 비어 있으면 "최근 실행" 화면이 출처를 unknown 으로 분류하므로 반드시 채워야 한다.

---

## Rationale

### sort/order 쿼리 반영 — "미구현/Planned" 표기 해제 (2026-06-10)

§4 의 `GET /api/schedules` sort/order 는 한동안 DTO 수신만 하고 `findAll` 이 무시하는 상태로 "미구현/Planned" 표기를 달고 있었다 (`plan/in-progress/spec-sync-schedule-gaps.md` 추적). 이후 `findAll` 이 허용 값 집합(whitelist) 기반 `orderBy` 를 구현해 (schedules.service.ts) 표기를 현행화했다 — Planned 해제는 기능 약속의 번복이 아니라 구현 완료에 따른 문서 동기화다.

### Schedule 유형 트리거의 생성 경로 제한

Schedule 트리거를 Trigger 화면에서 직접 생성하지 못하게 한 것(§3.1 제약)은 schedule row 없는 고아 trigger 를 API 차원에서 차단하기 위함이다 — Schedule 생성 경로만 trigger+schedule 2-step 생성을 보장한다 ([data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화)).

### 딥링크 소비의 방향별 비대칭 (§2.1 inbound `?triggerId=`)

두 방향의 `?triggerId=` 딥링크가 서로 다르게 동작하는 것은 의도적이며, 각 목적지의 데이터 접근 방식 차이에서 온다.

- **schedule → trigger** (`/triggers?triggerId=`): 트리거 상세 drawer 를 **자동으로 연다**. drawer 는 triggerId 로 단건 리소스를 직접 조회하므로 목록 로드·페이지네이션과 무관하게 항상 열 수 있다 ([trigger-list §2.3](./2-trigger-list.md#23-트리거-상세-패널-항목-클릭-시)).
- **trigger → schedule** (`/schedules?triggerId=`): 목록을 **서버측 `?triggerId=` 필터**로 그 트리거의 스케줄로 좁혀 보여주고(§4), 그 행을 강조·스크롤한다. 서버 필터라 페이지 위치와 무관하게(cross-page) 대상을 찾는다. drawer 자동 오픈이 아니라 목록 필터+강조를 택한 것은 스케줄 편집이 목록 컨텍스트(다음 실행·활성 상태 등) 안에서 이뤄지는 편이 자연스럽고, "전체 보기" 해제 경로를 명확히 두기 위함이다. 편집 다이얼로그 자동 오픈은 하지 않는다.
