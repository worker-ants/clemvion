### 발견사항

- **[WARNING]** `schedules-page.test.tsx`에 동일한 setup 블록이 3회 중복
  - 위치: 새로 추가된 3개의 `it` 블록 각각의 첫 8줄
  - 상세: `setRole("editor")` → `mockSchedulesResponse({ data: [], pagination: ... })` → `await renderPage()` → "Add schedule" 버튼 클릭까지의 패턴이 세 테스트 모두 동일. 기존 "Visual 탭으로 전환" 테스트까지 포함하면 동일 패턴이 4회 반복된다.
  - 제안: `async function openAddDialog()` 헬퍼로 추출. 빈 스케줄 응답 객체도 `EMPTY_RESPONSE` 상수로 분리하면 `pagination` 리터럴 중복도 함께 제거된다.

- **[WARNING]** `parseCronToVisualOrNull` 이 렌더 시마다 두 번 호출됨
  - 위치: `page.tsx`, `VisualCronEditor` props 전달부 (`cronCannotRepresent={formCron.trim() !== "" && parseCronToVisualOrNull(formCron) === null}`)
  - 상세: `handleCronInputChange`에서 이미 파싱을 수행하는데, JSX 렌더 시 `cronCannotRepresent` 계산을 위해 매 렌더마다 독립적으로 재파싱한다. 대화상자가 열린 상태에서 임의의 state 변경(타임존 입력 등)이 발생할 때마다 호출된다.
  - 제안: `formCron` 변경 시점에 `canParseVisual` 을 함께 `useState`로 관리하거나, `useMemo(() => parseCronToVisualOrNull(formCron), [formCron]) === null` 형태로 memoize한다.

- **[INFO]** `page.tsx` 핸들러 함수 위의 다중 행 주석이 프로젝트 규약("기본적으로 주석 없음")을 위반
  - 위치: `handleCronInputChange`, `handleVisualStateChange`, `handleSetCronTab` 앞 주석 블록
  - 상세: CLAUDE.md는 "WHY가 비자명한 경우에만 주석을 추가"하고 "코드가 무엇을 하는지 설명하는 주석은 쓰지 않는다"고 규정한다. 세 블록 모두 코드 로직의 WHAT을 다시 기술하는 형태이다.
  - 제안: 삭제. 함수명(`handleCronInputChange`, `handleVisualStateChange`)이 이미 의도를 충분히 표현한다. `handleSetCronTab`의 "빈 cron에서 visual 탭 진입 시 cron 즉시 적용" 동작은 `if (tab === "visual" && !formCron.trim())` 조건 자체로 비자명하므로 한 줄 주석으로 줄일 수 있다.

- **[INFO]** `cron-to-visual.ts` 파일 헤더 주석에 패턴 수 불일치
  - 위치: `cron-to-visual.ts` 1-15줄, "6개 단순 패턴" 언급부
  - 상세: 주석은 "시각 편집기는 6개 단순 패턴만 produce 한다"고 하지만 실제 나열된 패턴은 5개(every-minute, hourly, daily, weekly, monthly)이다.
  - 제안: "5개 단순 패턴" 또는 패턴 목록에서 실제 6번째 패턴을 추가하거나 삭제.

- **[INFO]** `toInt` 헬퍼가 `Number()` 의 trivial wrapper
  - 위치: `cron-to-visual.ts:53`
  - 상세: `const toInt = (token: string): number => Number(token);` 는 본질적으로 `Number()` 와 동일하다. 정수 의도를 명확히 하려면 `parseInt(token, 10)` 이 더 직접적이다.
  - 제안: `parseInt(token, 10)` 으로 교체하거나 `toInt` 제거 후 호출 지점에서 직접 사용.

---

### 요약

핵심 리팩토링(state lift, controlled `VisualCronEditor`, `cron-to-visual.ts` 분리)은 책임 분리와 테스트 가능성 측면에서 올바른 방향이다. 유지보수성 상의 주된 부채는 `schedules-page.test.tsx`의 반복 setup 패턴(4회)으로, 향후 API 응답 형태나 다이얼로그 오픈 방식이 변경되면 여러 곳을 동시에 수정해야 한다. 렌더 시 `parseCronToVisualOrNull` 이중 호출은 현재 성능에 영향이 없지만 state와 derived value 간 경계가 모호해진다는 점에서 정리 가치가 있다. 나머지는 소폭 개선이며 전체 위험도는 낮다.

### 위험도

**LOW**