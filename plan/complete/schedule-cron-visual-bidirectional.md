# 스케줄 다이얼로그 cron ↔ 시각 편집 양방향 보존

## 배경

스케줄 생성·수정 다이얼로그에서 "Cron 표현식" 탭과 "시각 편집기" 탭 사이를 전환하면 사용자가 입력·조정한 설정이 보존되지 않았다.

원래 구현 (`frontend/src/app/(main)/schedules/page.tsx`):

| 전환 방향 | 원래 동작 | 문제 |
|---|---|---|
| visual → expression | `formCron` 자체는 유지(input 표시) | OK |
| expression → visual | `formCron` 유지되지만 visual UI 는 항상 디폴트(daily 09:00). 사용자가 컨트롤 1번 만지면 즉시 daily 09:00 기반 cron 으로 덮어씀 | **손실** |
| visual → expression → visual 왕복 | visual 내부 state(frequency/days/...) unmount 시 사라짐 | **손실** |

원인: `VisualCronEditor` 의 5개 state(`frequency`, `minute`, `hour`, `selectedDays`, `dayOfMonth`) 가 자체 보유 + 마운트 시 cron→visual 파싱 시도 없음.

사용자 요구: 정상적인 cron 이라면 자동 변환되어 양방향 보존.

## 작업 항목

- [x] `frontend/src/lib/utils/cron-to-visual.ts` 신규 — `parseCronToVisualOrNull(cron) → VisualState | null` 유틸
  - 매칭 패턴 5개 (visual 이 produce 가능한 것과 동일):
    - `* * * * *` → every-minute
    - `M * * * *` → hourly (M=0..59)
    - `M H * * *` → daily (M=0..59, H=0..23)
    - `M H * * D[,D...]` → weekly (D∈0..6)
    - `M H D * *` → monthly (D=1..31)
  - 매칭 불가시 `null`
- [x] `cron-to-visual.test.ts` 단위 테스트 — 매칭/비매칭 케이스, 경계값, round-trip, freeze 불변성
- [x] `VisualCronEditor` 의 5개 state 를 prop 으로 lift (controlled)
- [x] expression → visual 전환 시 parser 자동 동기화. 표현 불가 시 마지막 visual state 유지 + 안내 텍스트 표시
- [x] `__tests__/schedules-page.test.tsx` 토글 보존 시나리오 6건
  - expression `"0 0 * * 1"` → visual 분해 (frequency/요일 버튼/안내 부재 확인)
  - visual monthly/15일 → expression → visual 왕복 보존
  - 표현 불가 cron `"*/5"` → 안내 표시 + cron 보존
  - 표현 불가 cron 진입 시 직전 visual state 보존
  - openEdit 경로 (편집 다이얼로그)
  - 빈 cron 으로 visual 탭 진입 시 디폴트 cron 즉시 emit
- [x] `spec/2-navigation/3-schedule.md §2.2.1` 추가 — 표현식 ↔ 시각 편집 자동 변환 규약, 5개 패턴 표
- [x] TEST WORKFLOW (lint → unit → build) — 103 suites / 1197 tests passed
- [x] REVIEW WORKFLOW
  - [x] `ai-review` 실행 (`review/2026-05-05_23-23-07/`)
  - [x] Warning 9건 조치 (W1 freeze, W2/W3/W4 테스트 보강, W5 fallback 명시, W6 "5개" 정정, W7 plan 갱신, W8 별도 작업 분리, W9 헬퍼 추출)
  - [x] Info 11건 조치 (useMemo 캐싱, 함수형 setState, 주석 정리, JSDoc 추가, openEdit cronTab 리셋 등)
  - [x] `RESOLUTION.md` 작성 + TEST WORKFLOW 재통과

## 변경하지 않은 것

- backend 영역 (스케줄 cron 저장/실행은 무관)
- 사용자 정의 cron 패턴 표현을 늘리는 것 (예: `*/N` step, `N-M` range, list of HH:MM): 본 PR 범위 외 — 별도 기능 확장으로 분리
- `weekly + 빈 selectedDays` round-trip 깨짐: build 함수가 fallback 으로 `*` 를 emit 하여 daily 와 동일한 cron 이 됨. UI 에서 모든 요일 해제를 차단하는 것이 더 자연스러우나 본 PR 범위 외 (RESOLUTION 명시).
- `SchedulesPage` 폼 상태 분리 (W8): `useScheduleDialogForm()` 훅 추출은 별도 리팩토링 작업으로 분리.

## 핵심 파일

- `frontend/src/app/(main)/schedules/page.tsx` — 다이얼로그 + VisualCronEditor (controlled)
- `frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx` — 토글 보존 + edit 시나리오
- `frontend/src/lib/utils/cron-to-visual.ts` (신규)
- `frontend/src/lib/utils/__tests__/cron-to-visual.test.ts` (신규)
- `frontend/src/lib/i18n/dict/{ko,en}.ts` — `schedules.expressionNotRepresentable`
- `spec/2-navigation/3-schedule.md`

## 결과

- 커밋 `0a47fe70` (docs) → `859cf7dc` (fix) → REVIEW 단일 커밋
- 전체 frontend 테스트: 103 suites / 1197 tests passed
- 변환 가능 패턴은 expression ↔ visual 양방향 자동 변환되어 손실 없음. 표현 불가 cron 은 안내 메시지 + visual state 보존.
