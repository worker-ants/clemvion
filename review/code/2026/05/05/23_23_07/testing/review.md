### 발견사항

- **[WARNING]** 통합 테스트 1번 — `selectedDays` 단언 누락
  - 위치: `schedules-page.test.tsx` 새 테스트 `"expression 입력 → visual 전환 시 cron 이 시각 컨트롤로 분해"`
  - 상세: 테스트 설명("Mon 만 선택된 상태")과 달리 `frequencySelect.value === "weekly"` 만 검증하고 `selectedDays=[1]` 에 해당하는 요일 버튼의 선택 상태는 확인하지 않는다. `VisualCronEditor` 가 잘못된 `selectedDays` 를 받아도 이 테스트는 통과한다.
  - 제안: `screen.getByRole("button", { name: /^mon$/i })` 등의 선택 상태(aria-pressed, className 등)를 추가 단언하거나, `selectedDays` 를 검증할 수 있는 role/label 을 컴포넌트에 추가하고 테스트에서 확인한다.

- **[WARNING]** 편집(openEdit) 경로 통합 테스트 부재
  - 위치: `schedules-page.test.tsx` — RBAC 블록
  - 상세: `openEdit(schedule)` 는 기존 스케줄의 `cronExpression` 을 `parseCronToVisualOrNull` 로 분해해 `formVisualState` 를 세팅하는 중요 경로이나, 이를 검증하는 테스트가 없다. "visual 표현 가능 cron 으로 편집 진입 → visual 탭에서 올바른 state 표시"와 "visual 표현 불가 cron 으로 편집 진입 → 안내 메시지 표시" 모두 미커버.
  - 제안: `mockSchedulesResponse(row())` + edit 버튼 클릭 → 편집 다이얼로그 열기 → visual 탭 전환 → frequency/hour/minute 단언 형태로 테스트 추가.

- **[WARNING]** `cronCannotRepresent = false` 인 음성 경로 미검증
  - 위치: `schedules-page.test.tsx`
  - 상세: 안내 문구가 표시되는 경우만 테스트하고, 변환 가능한 cron(예: `"0 9 * * *"`)을 입력한 뒤 visual 탭으로 이동했을 때 안내 문구가 _나타나지 않아야_ 함을 검증하는 테스트가 없다.
  - 제안: `"0 9 * * *"` 입력 → visual 탭 → `queryByText(/cannot be represented/i)` 가 `null` 임을 단언하는 케이스 추가.

- **[INFO]** `buildCronFromVisual` 단위 테스트 — 정렬되지 않은 `selectedDays` 미검증
  - 위치: `cron-to-visual.test.ts` — `buildCronFromVisual` describe
  - 상세: `parseCronToVisualOrNull` 는 정렬 보장 테스트가 있으나, `buildCronFromVisual` 에서 `selectedDays: [5,1,3]` 같은 비정렬 입력이 `"0 9 * * 1,3,5"` 로 정렬 출력되는지 직접 테스트가 없다.
  - 제안: `selectedDays: [5,1,3]` → `"0 9 * * 1,3,5"` 케이스 추가.

- **[INFO]** `buildCronFromVisual` — `weekly` 경계값 테스트 부족
  - 위치: `cron-to-visual.test.ts`
  - 상세: `selectedDays: [0]` (Sun) 단독 선택 케이스가 `parseCronToVisualOrNull` 에는 있으나 `buildCronFromVisual` 에는 없다. 또한 `selectedDays: [0,6]` (Sun+Sat) 같은 양 경계 조합도 미커버.
  - 제안: `{ ...DEFAULT_VISUAL_STATE, frequency: "weekly", selectedDays: [0] }` → `"0 9 * * 0"` 케이스 추가.

- **[INFO]** `handleCronInputChange` — 불완전한 cron 입력 시 크래시 방지 테스트 없음
  - 위치: `schedules-page.test.tsx`
  - 상세: 사용자가 표현식 탭에서 `"0 9 *"` 처럼 필드 수가 맞지 않는 중간 상태를 입력하면 `parseCronToVisualOrNull` 은 `null` 을 반환하고 `formVisualState` 는 직전 값을 유지해야 한다. 이 경로가 예외 없이 동작함을 검증하는 테스트가 없다.
  - 제안: 잘못된 cron 입력 후 visual state 가 변하지 않음을 확인하는 케이스 추가 또는 기존 테스트에 중간 입력 단계 삽입.

- **[INFO]** `formVisualState` 리셋 검증 없음
  - 위치: `schedules-page.test.tsx`
  - 상세: 스케줄 생성 성공 후 `resetForm()` 이 `formVisualState` 를 `DEFAULT_VISUAL_STATE` 로 되돌리는지 검증하는 테스트가 없다. 재오픈 시 이전 선택이 유지되는 버그가 있어도 탐지 불가.
  - 제안: 스케줄 생성 mock 성공 → 다이얼로그 재오픈 → visual 탭 → frequency/hour/minute 가 default 값인지 단언.

---

### 요약

핵심 변환 유틸(`cron-to-visual.ts`)의 단위 테스트는 파싱 경계값·null 안전성·round-trip 등 주요 경로를 충실히 커버하고 있다. 통합 테스트 3개도 핵심 시나리오를 명확하게 표현하나, 첫 번째 테스트가 "Mon 선택 상태" 단언을 누락해 `selectedDays` 동기화 버그를 놓칠 수 있으며, 편집(openEdit) 경로와 `cronCannotRepresent = false` 음성 경로가 전혀 커버되지 않는다. `buildCronFromVisual` 단위 테스트도 비정렬 입력·Sunday 경계값 케이스가 빠져 있어 `parseCronToVisualOrNull` 대비 커버리지가 상대적으로 얕다.

### 위험도

**LOW**