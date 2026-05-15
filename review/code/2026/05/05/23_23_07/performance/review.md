### 발견사항

- **[INFO]** `parseCronToVisualOrNull` — 매 keystroke 호출 시 정규식 + 문자열 파싱 중복 실행
  - 위치: `page.tsx` `handleCronInputChange` + `VisualCronEditor` `cronCannotRepresent` prop
  - 상세: `handleCronInputChange`에서 `parseCronToVisualOrNull(cron)` 1회, 렌더마다 `parseCronToVisualOrNull(formCron) === null` 1회 추가 호출. 사용자가 타이핑할 때마다 동일 cron 문자열을 두 번 파싱함.
  - 제안: `parsedVisual`을 `useMemo`로 memoize하거나, `handleCronInputChange`에서 결과를 `formVisualState`와 별도 `formCronParseable` boolean state로 저장해 두면 render당 1회로 줄어듦.

```ts
// page.tsx ~863
cronCannotRepresent={
  formCron.trim() !== "" &&
  parseCronToVisualOrNull(formCron) === null  // 렌더마다 재파싱
}
```

- **[INFO]** `getCronDescription` — visual 탭 preview 블록에서 동일 `cronExpression`으로 2회 호출
  - 위치: `page.tsx` `VisualCronEditor` JSX, `{cronExpression}` 렌더 블록
  - 상세: `getCronDescription(cronExpression)` 조건 체크 1회 + 렌더 1회로 총 2회 `cronstrue.toString` 실행. `cronstrue`는 외부 라이브러리로 비용이 0에 가깝지 않음.
  - 제안: `const desc = getCronDescription(cronExpression)` 로컬 변수로 할당 후 재사용.

- **[INFO]** `buildCronFromVisual` — weekly 분기에서 `selectedDays`를 매 호출마다 새 배열 복사 후 sort
  - 위치: `cron-to-visual.ts:141`
  - 상세: `[...selectedDays].sort(...)` — `selectedDays`는 이미 `parseCronToVisualOrNull`과 `handleDayToggle` 양쪽에서 정렬된 상태로 관리됨. 불필요한 방어적 복사+정렬.
  - 제안: 진입점(handleDayToggle, parseCronToVisualOrNull)에서 정렬 보장이 이미 되어 있으므로 `selectedDays.join(",")` 으로 단순화 가능. 또는 적어도 `[...selectedDays]` spread는 유지하되 `sort` 제거.

- **[INFO]** `parseCronToVisualOrNull` — weekly 분기에서 `Set` 생성 후 즉시 `Array.from` 변환
  - 위치: `cron-to-visual.ts:106`
  - 상세: `Array.from(new Set(numbers)).sort(...)` — cron dow 필드는 유효 입력이 0-6 숫자 7개이고, 중복 제거를 위해 Set을 할당. 입력 길이가 최대 7이므로 절대 비용은 미미하나 매 keystroke 실행 경로에 있음.
  - 제안: 사실상 성능 영향 없음. INFO 수준으로만 기록.

- **[INFO]** 테스트 파일 — `createWrapper()`가 각 `it` 블록마다 새 `QueryClient` 생성
  - 위치: `schedules-page.test.tsx:29-37`
  - 상세: 기존 패턴 유지이며 테스트 격리를 위한 의도적 설계. 테스트 수가 많아질수록 초기화 오버헤드가 누적되나 현재 규모에서는 무시 가능.
  - 제안: 현 규모에서는 변경 불필요.

---

### 요약

이번 변경의 핵심인 `cron-to-visual.ts`와 state lift 구조는 성능 관점에서 전반적으로 양호하다. 파싱 함수 자체는 O(1) 문자열 분기로 매우 가볍고, state를 부모로 올려 불필요한 re-mount를 제거한 설계는 오히려 성능에 긍정적이다. 실질적 개선 여지는 렌더 경로에서 `parseCronToVisualOrNull`이 같은 `formCron`으로 두 번 호출되는 것과, `VisualCronEditor` 내 `getCronDescription` 이중 호출 정도로, 두 항목 모두 로컬 변수/memoize로 간단히 해결 가능하다. 치명적 성능 이슈는 없음.

### 위험도

**LOW**