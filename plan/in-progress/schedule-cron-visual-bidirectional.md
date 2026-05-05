# 스케줄 다이얼로그 cron ↔ 시각 편집 양방향 보존

## 배경

스케줄 생성·수정 다이얼로그에서 "Cron 표현식" 탭과 "시각 편집기" 탭 사이를 전환하면 사용자가 입력·조정한 설정이 보존되지 않는다.

현재 구현 (`frontend/src/app/(main)/schedules/page.tsx`):

| 전환 방향 | 현재 동작 | 문제 |
|---|---|---|
| visual → expression | `formCron` 자체는 유지(input 표시) | OK |
| expression → visual | `formCron` 유지되지만 visual UI 는 항상 디폴트(daily 09:00). 사용자가 컨트롤 1번 만지면 즉시 daily 09:00 기반 cron 으로 덮어씀 | **손실** |
| visual → expression → visual 왕복 | visual 내부 state(frequency/days/...) unmount 시 사라짐 | **손실** |

원인: `VisualCronEditor` (line 181-366) 의 5개 state(`frequency`, `minute`, `hour`, `selectedDays`, `dayOfMonth`) 가 자체 보유 + 마운트 시 cron→visual 파싱 시도 없음.

사용자 요구: 정상적인 cron 이라면 자동 변환되어 양방향 보존.

## 작업 항목

- [ ] `frontend/src/lib/utils/cron-to-visual.ts` 신규 — `parseCronToVisualOrNull(cron) → VisualState | null` 유틸
  - 매칭 패턴 6개 (visual 이 produce 가능한 것과 동일):
    - `* * * * *` → every-minute
    - `M * * * *` → hourly (M=0..59)
    - `M H * * *` → daily (M=0..59, H=0..23)
    - `M H * * D[,D...]` → weekly (D∈0..6)
    - `M H D * *` → monthly (D=1..31)
  - 매칭 불가시 `null`
- [ ] `cron-to-visual.spec.ts` 단위 테스트 — 매칭/비매칭 케이스, 경계값
- [ ] `VisualCronEditor` 의 5개 state 를 prop 으로 lift (controlled)
  - 부모(다이얼로그) 에 `visualState: VisualState` + `setVisualState` 보유
  - `useEffect(() => parse on formCron change)` 로 visual state 자동 동기화
  - `cronTab` 전환만으로는 unmount 안 발생하도록 구조 유지 (lifted state 라 괜찮지만 사이드이펙트 방지)
- [ ] expression → visual 전환 시 parser 시도 — 매칭되면 visual UI 가 cron 을 정확히 반영, 매칭 안 되면 마지막 visual state 유지 + 안내 텍스트 표시 ("이 표현식은 시각 편집으로 표현할 수 없습니다 — 시각 컨트롤을 변경하면 표현식이 새로 작성됩니다.")
- [ ] `__tests__/schedules-page.test.tsx` 에 토글 보존 테스트 추가
  - expression `"0 0 * * 1"` 입력 → visual 전환 → frequency=weekly · selectedDays=[1] 로 표시되는지
  - visual 에서 frequency=monthly · day=15 설정 → expression 전환 → "0 9 15 * *" 표시 → visual 전환 → 다시 monthly/15 유지되는지
  - 표현 불가 cron `"*/5 * * * *"` → visual 전환 → 안내 텍스트 표시 + visual UI 는 직전 상태 유지
- [ ] `spec/2-navigation/3-schedule.md §2.2` 의 "시각적 편집기" / "Cron 표현식" 행에 "표현식 ↔ 시각 편집 자동 변환 (visual 표현 가능 패턴에 한정)" 명시
- [ ] TEST WORKFLOW (lint → unit → build)
- [ ] REVIEW WORKFLOW (`ai-review` → 이슈 조치 → `RESOLUTION.md`)

## 변경하지 않을 것

- backend 영역 (스케줄 cron 저장/실행은 무관)
- 사용자 정의 cron 패턴 표현을 늘리는 것 (예: `*/N` step, `N-M` range, list of HH:MM): 본 PR 범위 외 — 별도 기능 확장으로 분리
- 다이얼로그 외 다른 영역 (workflow, calendar view 등)

## 핵심 파일

- `frontend/src/app/(main)/schedules/page.tsx` (lines 52-54, 181-366, 494-1104) — 다이얼로그 + VisualCronEditor
- `frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx` — 기존 테스트
- `frontend/src/lib/utils/cron-to-visual.ts` (신규)
- `frontend/src/lib/utils/cron-to-visual.spec.ts` (신규)
- `spec/2-navigation/3-schedule.md`

## 검증 시나리오

1. expression "0 0 * * 1" 입력 → visual 탭 → "주간 / 월요일 / 00:00" 으로 표시
2. expression "30 14 15 * *" 입력 → visual 탭 → "월간 / 매월 15일 / 14:30" 표시
3. visual 에서 "주간 / 월수금 / 09:00" 설정 → expression 탭 → "0 9 * * 1,3,5" 표시
4. (3) 상태에서 다시 visual 탭 → 월수금/09:00 그대로 보존
5. expression "*/5 * * * *" 입력 → visual 탭 → 안내 텍스트 + visual UI 는 마지막 state(또는 디폴트 daily 09:00) 표시. 사용자가 컨트롤 만질 때까지 expression 은 "*/5 * * * *" 유지
