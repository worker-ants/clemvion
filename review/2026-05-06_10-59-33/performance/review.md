---

## 성능 코드 리뷰

### 발견사항

---

**[WARNING] `getCronDescription()` 렌더 루프 내 비캐시 호출**
- 위치: `src/app/(main)/schedules/page.tsx:1003-1006`
- 상세: `cronstrue.toString()`은 표현식 파싱 + 자연어 생성을 포함한 비trivial 연산이다. 리스트 뷰에서 스케줄 행마다 매 렌더마다 호출되며, `useMemo` 없이 노출된다. 필터 변경, 토글 뮤테이션 성공 시(`invalidateQueries`) 전체 목록이 리렌더되고 모든 행의 `getCronDescription`이 재실행된다.
- 제안:
  ```ts
  // schedules.map(...) 바깥, useMemo로 미리 계산
  const cronDescriptions = useMemo(
    () => Object.fromEntries(schedules.map(s => [s.id, getCronDescription(s.cronExpression)])),
    [schedules]
  );
  // 렌더에서: cronDescriptions[schedule.id]
  ```

---

**[WARNING] RAG 컨텐츠 정규식 — 매 렌더 재실행**
- 위치: `src/components/editor/run-results/conversation-inspector.tsx:383, 593-595, 667-692`
- 상세: `item.content.match(/\[Source: /g)`, `content.matchAll(/\[Source: ([^\]]+)\]/g)` 가 세 곳에서 잠재적으로 큰 문자열(RAG 컨텍스트 전체)에 대해 매 렌더마다 실행된다. `SummaryView`의 아이템 루프(line 593-595)는 모든 RAG 아이템에 대해 반복되며, `RagBubbleSummary`(line 667-692)도 메모이제이션 없이 실행된다.
- 제안:
  ```ts
  // RagBubbleSummary 또는 SelectedItemDetail — useMemo로 감싸거나
  // SummaryView의 items useMemo 계산 시점에 sourceCount를 함께 추출
  const ragSourceCount = useMemo(
    () => isRag ? (item.content.match(/\[Source: /g) ?? []).length : 0,
    [isRag, item.content]
  );
  ```

---

**[WARNING] `Intl` 포맷터 인스턴스 미캐시 — 리스트 렌더 시 반복 생성**
- 위치: `src/lib/utils/date.ts:69-101`
- 상세: `formatDate`는 호출마다 `new Date(date)`, `toLocaleDateString(intlLocale, { year, month, ... })` 을 실행한다. 브라우저는 내부적으로 `Intl.DateTimeFormat` 인스턴스를 재사용하기도 하지만, 매번 `options` 객체를 새로 리터럴 생성한다. 트리거 목록(최대 20행), 스케줄 목록, 버전 히스토리 등 리스트 렌더에서 행당 1회씩 누적된다.
- 제안: 포맷 유형별 `Intl.DateTimeFormat` 인스턴스를 로케일 키로 캐시하면 반복 생성 비용을 제거할 수 있다:
  ```ts
  const fmtCache = new Map<string, Intl.DateTimeFormat>();
  function getFormatter(locale: string, opts: Intl.DateTimeFormatOptions) {
    const key = `${locale}:${JSON.stringify(opts)}`;
    if (!fmtCache.has(key)) fmtCache.set(key, new Intl.DateTimeFormat(locale, opts));
    return fmtCache.get(key)!;
  }
  ```

---

**[WARNING] `getWebhookUrl()` 행당 2회 호출**
- 위치: `src/app/(main)/triggers/page.tsx:443, 451`
- 상세: 웹훅 행 렌더에서 URL을 표시용(line 443)과 복사 클릭 핸들러 클로저(line 451) 에 중복으로 계산한다. 핸들러는 클릭 시점에서야 실행되지만, 렌더 시 `onClick` 클로저가 새로 생성되므로 매 렌더마다 실질적으로 함수 객체 낭비가 발생한다.
- 제안: `webhookUrl`을 행 컴포넌트 내에서 한 번만 계산하고 두 곳에 공유한다. 또는 별도 `TriggerRow` 컴포넌트로 분리해 `useMemo`/변수 재사용으로 해결.

---

**[INFO] `VisualCronEditor` — 매 렌더 `Array.from({ length: 60 })` 생성**
- 위치: `src/app/(main)/schedules/page.tsx:220-226, 253-260`
- 상세: 분(0–59), 시(0–23) 옵션 배열이 컴포넌트 바깥에 상수로 정의되어 있지 않고 렌더 내에서 생성된다. 값이 변하지 않으므로 모듈 레벨 상수로 이동하면 매 렌더마다 60개 객체 배열 생성을 피할 수 있다.
- 제안:
  ```ts
  const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);
  const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
  ```

---

**[INFO] `CalendarView.monthName` — `toLocaleString` 매 렌더 호출**
- 위치: `src/app/(main)/schedules/page.tsx:368-371`
- 상세: `viewDate.toLocaleString("default", { month: "long", year: "numeric" })` 가 `useMemo` 없이 계산된다. 캘린더 뷰 내부에서 `today`나 `isCurrentMonth` 등 다른 값 변경으로 리렌더가 발생하면 매번 재실행된다.
- 제안: `useMemo(() => viewDate.toLocaleString(...), [viewDate])` 로 감싸거나, `year`/`month` 의존 메모화.

---

**[INFO] `button-bar.tsx` — `isSafeUrl()` 렌더당 + 클릭당 중복 실행**
- 위치: `src/components/editor/run-results/button-bar.tsx:112, 65-68`
- 상세: 버튼 렌더 시 `disabled` 조건(line 112)과 `handleClick` 내부(line 65-68) 양쪽에서 `isSafeUrl(btn.url)` 을 호출한다. `new URL()` 생성은 작지만, 버튼 수가 많은 경우 렌더당 N회 실행된다. `buttons.map`에서 한 번만 계산해 놓으면 충분하다.

---

### 요약

이번 변경사항에서 성능상 가장 주목할 부분은 두 곳이다. 첫째, `schedules/page.tsx`의 리스트 렌더 루프 내에서 `getCronDescription()`(cronstrue 파싱 포함)을 매 렌더마다 행 수만큼 반복 호출하고 있어, 뮤테이션 완료 후 invalidate 사이클마다 전체 비용이 누적된다. 둘째, `conversation-inspector.tsx`에서 RAG 컨텐츠 크기가 클 수 있는 문자열에 정규식을 메모이제이션 없이 렌더마다 반복 실행한다. `Intl` 포맷터 인스턴스 재사용 부재는 리스트가 20개 이상 행을 렌더할 때 눈에 띄지 않는 수준이지만, 캐시로 선제 대응 가능하다. 나머지 항목들(Array.from 상수화, 중복 URL 계산)은 규모가 작아 체감 영향은 낮다.

### 위험도

**LOW** — 현재 규모에서 사용자가 체감할 수 있는 렌더 지연은 없지만, 스케줄/트리거 목록이 증가하거나 AI Agent 결과 시각화가 더 빈번해지면 `getCronDescription` 반복 호출과 RAG 정규식 이슈가 WARNING 수준의 체감 지연으로 이어질 수 있다.