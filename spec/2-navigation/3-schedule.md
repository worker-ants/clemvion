# Spec: 스케줄 관리 화면

> 관련 문서: [PRD 내비게이션](../../prd/1-navigation.md#33-schedule) · [Spec 레이아웃](./0-layout.md) · [데이터 모델 - Schedule](../1-data-model.md#29-schedule)

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
| 연결된 워크플로우 | "→ 워크플로우 이름". 클릭 시 에디터로 이동 |
| 다음 실행 시각 | 다음 예정된 실행 시각 (절대 시간) |
| 더보기(⋮) | 수정, 활성/비활성, 즉시 실행, 실행 이력, **트리거에서 보기** (→ Trigger 목록에서 해당 트리거로 이동), 삭제 |

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
| 타임존 | IANA 타임존 선택 (기본: 워크스페이스 설정) |

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

> 변환 유틸: `frontend/src/lib/utils/cron-to-visual.ts` 의 `parseCronToVisualOrNull` / `buildCronFromVisual`. 시각 편집기 컴포넌트는 controlled 패턴으로 부모(다이얼로그)에 시각 state 를 lift 한다.

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
| Schedule 활성/비활성 | 연결된 Trigger is_active 동기화 (역방향도 동일) |
| Schedule 삭제 | 연결된 Trigger cascade 삭제 (확인 다이얼로그에 "연결된 트리거도 함께 삭제됩니다" 안내) |

**제약:**
- Schedule 유형 트리거는 Trigger 화면에서 직접 생성 불가 — 반드시 Schedule 화면에서 생성
- Schedule 화면에서 삭제 시 Trigger도 함께 삭제됨 (역방향: Trigger 삭제 시 Schedule도 삭제)

---

## 4. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/schedules | 목록 조회 (쿼리: page, limit, sort, order, search). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| POST | /api/schedules | 스케줄 생성 |
| GET | /api/schedules/:id | 상세 조회 |
| PATCH | /api/schedules/:id | 수정 |
| PATCH | /api/schedules/:id/toggle | 활성/비활성 토글 |
| POST | /api/schedules/:id/run-now | 즉시 실행 (manual 라벨로 기록) |
| DELETE | /api/schedules/:id | 삭제 |
| GET | /api/schedules/:id/preview | 다음 N회 실행 시각 미리보기 |

---

## 5. 실행 출처 기록 규약

| 발화 경로 | Execution 행에 채우는 값 | 트리거 출처 분류 결과 |
|-----------|--------------------------|------------------------|
| Cron 자동 발화 (`ScheduleRunnerService.process`) | `trigger_id = schedule.triggerId` | `schedule` ([실행 내역 §2.4](./6-execution-history.md#24-테이블)) |
| "지금 실행" 버튼 (`SchedulesService.runNow`) | `executed_by = userId` | `manual` |

상세 시그니처는 [Spec 실행 엔진 §6.1.1](../5-system/4-execution-engine.md#611-트리거-입력-파라미터-seeding) 참조. cron 자동 발화 시 `trigger_id` 가 비어 있으면 "최근 실행" 화면이 출처를 unknown 으로 분류하므로 반드시 채워야 한다.
