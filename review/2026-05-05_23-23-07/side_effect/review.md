## 발견사항

### [WARNING] `DEFAULT_VISUAL_STATE.selectedDays` 공유 배열 참조 노출
- **위치**: `cron-to-visual.ts:36` / `parseCronToVisualOrNull` 내 `{ ...DEFAULT_VISUAL_STATE, frequency: ... }` 반환
- **상세**: `parseCronToVisualOrNull`이 `every-minute`, `hourly`, `daily`, `monthly` 패턴을 반환할 때 shallow spread를 사용하므로, 반환 객체의 `selectedDays`는 `DEFAULT_VISUAL_STATE.selectedDays`와 **동일 배열 참조**를 공유한다. 현재 코드에서는 `handleDayToggle`이 항상 새 배열을 생성(`filter` / `spread+sort`)하고, `buildCronFromVisual`도 `[...selectedDays].sort()`로 복사하므로 실제 변이는 발생하지 않는다. 그러나 이 util을 임포트하는 미래 호출자가 `state.selectedDays.push(x)` 같은 직접 변이를 시도하면 전역 상수가 오염된다.
- **제안**: `DEFAULT_VISUAL_STATE`를 `Object.freeze`하거나, `parseCronToVisualOrNull`에서 `selectedDays: [...DEFAULT_VISUAL_STATE.selectedDays]`로 복사 후 반환.

```ts
// cron-to-visual.ts
export const DEFAULT_VISUAL_STATE: VisualState = Object.freeze({
  frequency: "daily",
  minute: 0,
  hour: 9,
  selectedDays: Object.freeze([1, 2, 3, 4, 5]) as number[],
  dayOfMonth: 1,
}) as VisualState;
```

---

### [INFO] `handleSetCronTab("visual")` — 빈 폼에서 `formCron` 암묵적 초기화
- **위치**: `page.tsx`, `handleSetCronTab` 함수
- **상세**: 새 스케줄 생성 시 `formCron`이 빈 상태에서 visual 탭으로 전환하면 `setFormCron(buildCronFromVisual(formVisualState))`가 호출되어 `"0 9 * * *"`이 자동 설정된다. 이후 expression 탭으로 돌아오면 사용자가 아무것도 입력하지 않았음에도 input에 cron이 채워진다. 이는 의도된 동작이나(plan 문서 §검증 시나리오 참조), **"사용자가 명시적으로 cron을 입력하지 않았다"는 상태 구분이 사라진다**는 부작용이 있다. `handleSubmit`의 `!formCron.trim()` 검증은 더 이상 "visual 탭을 한 번도 방문하지 않은 신규 스케줄"에서만 작동하게 된다.
- **제안**: 현재 스펙 의도와 일치하므로 코드 변경은 불필요하나, 향후 "사용자 편집 여부" 추적이 필요하다면 별도 `isDirty` flag를 두는 것을 권장.

---

### [INFO] `handleCronInputChange` — 타이핑 도중 visual state 갱신
- **위치**: `page.tsx`, `handleCronInputChange`
- **상세**: cron input에 한 글자씩 입력할 때마다 `parseCronToVisualOrNull`이 호출된다. 예: `"0 *"` 입력 중 우연히 `"0 * * * *"`(hourly)를 통과하면 visual state가 hourly로 바뀐다. visual 탭이 보이지 않는 상태에서 발생하므로 UX 이슈는 없고, 실제로는 5개 필드가 완성될 때만 매칭되어 중간 상태는 대부분 null을 반환한다. 부작용 없음이나, 예: `"* * * * *"` 입력 후 한 글자 지우면 visual state가 이미 every-minute으로 바뀐 상태로 남는다.
- **제안**: 현재 동작은 허용 범위 내. 변경 불필요.

---

### [INFO] `VisualCronEditor` prop 인터페이스 변경 — 파일 내부 컴포넌트
- **위치**: `page.tsx:159-175`
- **상세**: `value: string / onChange: (cron: string)` → `state: VisualState / onChange: (next: VisualState) / cronCannotRepresent / cronExpression`으로 변경. `VisualCronEditor`는 `page.tsx` 내부에서만 정의·사용되므로 외부 호출자 없음. 영향 없음.

---

### [INFO] `openEdit` — `cronTab` 미리셋 없음
- **위치**: `page.tsx`, `openEdit` 함수
- **상세**: `openEdit`은 `cronTab`을 `"expression"`으로 리셋하지 않는다. 사용자가 visual 탭에서 닫지 않고 다른 스케줄의 edit을 열면 visual 탭이 활성 상태로 남는다. `formVisualState`는 `parseCronToVisualOrNull`로 올바르게 초기화되므로 데이터 손실은 없으나, expression을 기본 탭으로 보여주고 싶다면 `openEdit`에도 `setCronTab("expression")`을 추가할 수 있다. `resetForm`에는 이미 있음.
- **제안**: UX 일관성을 위해 `openEdit`에 `setCronTab("expression")` 추가 고려 (필수 아님).

---

## 요약

이번 변경은 `VisualCronEditor` 내부 state를 부모로 lift하고, `cron-to-visual.ts` 유틸을 신규 추출한 전형적인 controlled component 리팩토링이다. 부작용 측면에서 실질적 위험은 `DEFAULT_VISUAL_STATE.selectedDays` 공유 참조 노출 하나로, 현재 코드 경로에서는 문제가 발생하지 않지만 미래 호출자에게 잠재적 함정이 될 수 있다. 나머지는 의도된 동작이거나 영향 범위가 파일 내부로 한정된다.

## 위험도

**LOW**