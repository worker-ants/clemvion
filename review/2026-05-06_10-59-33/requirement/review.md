이제 분석한 내용을 바탕으로 리뷰를 작성합니다.

---

## 발견사항

### **[WARNING]** `schedules/page.tsx` — `toLocaleString` 직접 호출로 AGENTS.md 규약 위반
- **위치**: `schedules/page.tsx:368`
- **상세**: `CalendarView` 컴포넌트의 월 이름 표시에서 `viewDate.toLocaleString("default", { month: "long", year: "numeric" })` 를 직접 사용. `viewDate`는 클라이언트 생성 값이지만, AGENTS.md는 "toLocaleString()/toLocaleDateString()/toLocaleTimeString()을 직접 호출하지 않는다"고 명시. 앱 로케일 설정 우회 가능.
- **제안**: `formatDate(viewDate, "date")`를 사용하되, 월+년 전용 포맷이 필요하다면 `formatDate`에 `"month-year"` 포맷을 추가.

---

### **[WARNING]** `date.ts:69` — `formatDate`가 유효하지 않은 입력에 대해 "Invalid Date" 문자열을 반환
- **위치**: `date.ts:69-101`
- **상세**: `new Date(undefined)` → `Invalid Date`, `new Date("")` → `Invalid Date`. 반환값이 그대로 UI에 렌더링돼 사용자에게 "Invalid Date"가 노출될 수 있음. 현재 각 호출 지점은 null 체크를 하고 있지만, 함수 내부에 방어 로직이 없어 미래의 잘못된 호출에 취약.
- **제안**:
  ```ts
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  ```

---

### **[WARNING]** `date.ts:63` — JSDoc의 `"date"` 포맷 설명 부정확
- **위치**: `date.ts:63`
- **상세**: JSDoc에 `"date"` 포맷이 `"short month + year (default)"` 로 기재되어 있지만 실제 구현은 `year`, `month`, `day: "numeric"` 옵션을 모두 포함. "day"가 빠진 설명은 사용자 혼란을 초래.
- **제안**: JSDoc을 `"date"` — year, short month, day (default, client TZ) 로 수정.

---

### **[WARNING]** `date.test.ts:118-122` — `"datetime"` 포맷 테스트에서 시간 컴포넌트 검증 누락
- **위치**: `date.test.ts:118-122`
- **상세**: `"datetime"` 포맷의 핵심 기능은 날짜 + 시간(hour:minute)을 같이 출력하는 것. 그런데 테스트는 "Jan"과 "2026"만 검증하고 시간 부분(`12:00`, `AM/PM` 등)을 전혀 확인하지 않음. `"date"` 포맷과 `"datetime"` 포맷을 구분하는 주요 특성이 검증되지 않는 상태.
- **제안**: 
  ```ts
  expect(result).toMatch(/\d{1,2}:\d{2}/); // HH:mm 패턴 검증 추가
  ```

---

### **[WARNING]** `trigger-detail-drawer.tsx` 및 `triggers/page.tsx` — Webhook URL에 개발 포트(3011) 하드코딩
- **위치**: `trigger-detail-drawer.tsx:227-231`, `triggers/page.tsx:199-203`
- **상세**: `window.location.origin.replace(/:\d+$/, ":3011")` 패턴이 두 곳에 중복 구현. 프로덕션 환경(포트 없음 또는 다른 포트)에서 URL이 항상 `:3011`로 강제 변환되어 잘못된 URL이 사용자에게 노출됨.
- **제안**: 환경 변수(`process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL`)에서 base URL을 읽거나, 개발/프로덕션을 구분하는 설정을 사용. 중복 구현도 단일 util 함수로 통합.

---

### **[WARNING]** `trigger-detail-drawer.tsx` — 사용자 노출 문자열 i18n 미적용
- **위치**: `trigger-detail-drawer.tsx` 전체
- **상세**: "Trigger Details", "Overview", "Schedule Configuration", "Next Run", "Webhook Configuration", "HTTP Method", "Authentication", "Signature Header", "Recent Calls", "No recent calls found.", "Trigger not found.", "Usage Example (curl)" 등 사용자에게 직접 노출되는 문자열이 모두 영어 하드코딩. 나머지 페이지들은 `useT()` + `t(key)` 패턴을 일관성 있게 적용.
- **제안**: `useT()`를 도입하고 i18n 키로 교체.

---

### **[WARNING]** `date.ts:78-86` — `"datetime"` 포맷에 `toLocaleDateString` 사용 (의미적 부정확)
- **위치**: `date.ts:78-86`
- **상세**: `toLocaleDateString`은 날짜 전용 포맷 메서드. 시간 옵션(`hour`, `minute`)을 포함하면 동작은 하지만, 일부 JavaScript 엔진/런타임에서 시간 부분이 누락될 수 있음. MDN은 날짜+시간 포맷에 `toLocaleString`을 권장.
- **제안**: `"datetime"` 브랜치에서 `d.toLocaleString(intlLocale, {...})` 사용.

---

### **[INFO]** `version-history-panel.tsx:70-75` — Diff 비교 시 버전 순서 보장 없음
- **위치**: `version-history-panel.tsx:70-75`
- **상세**: `selectedForDiff[0]`이 `aId`, `selectedForDiff[1]`이 `bId`로 할당. 선택 순서에 따라 diff 방향이 달라지지만 UI에서 어느 버전이 "기준(before)"인지 명시되지 않음. 사용자가 최신 → 구버전 순으로 선택하면 역방향 diff가 생성됨.
- **제안**: `startDiff()` 내에서 버전 번호 기준으로 정렬(`aId ← 낮은 버전, bId ← 높은 버전`)하거나, 선택 순서를 UI에 "Base / Compare" 레이블로 명확히 표시.

---

### **[INFO]** `conversation-inspector.tsx:313-317` — 한국어 문자열 i18n 미적용
- **위치**: `conversation-inspector.tsx:313-317`
- **상세**: `"원문 요청 / 응답 / 사용량은 상단의..."` 문자열이 i18n 시스템 우회하여 하드코딩. 영어 사용자에게 노출 시 한국어 그대로 보임.
- **제안**: `t("editor.rawRequestResponseHint")` 등의 i18n 키로 교체.

---

### **[INFO]** `button-bar.tsx:86` — "Continue" 레이블 하드코딩
- **위치**: `button-bar.tsx:86`
- **상세**: `setClicked({ label: "Continue", ... })` 와 Continue 버튼 텍스트가 i18n 없이 영어 하드코딩. 다국어 환경에서 일관성 부족.
- **제안**: `t("editor.continueButton")` 등의 키로 교체.

---

### **[INFO]** `variables-and-context.en.mdx:95` — `today()` 함수 존재 여부 미검증
- **위치**: `variables-and-context.en.mdx:95`, `variables-and-context.mdx:106`
- **상세**: 두 언어 문서 모두 "`today()` 함수로 서버 로컬 TZ 기준 날짜를 얻을 수 있다"고 안내하나, expression-engine 구현 파일(접근 불가)에서 `today()` 함수의 실제 존재 여부를 확인할 수 없음. 문서와 구현 간 괴리 가능성.
- **제안**: `evaluator.ts` 및 expression-engine 함수 목록에서 `today()` 구현 확인 필요.

---

## 요약

`$today` 제거 + `$now`/`formatDate` 도입이라는 핵심 요구사항은 전반적으로 잘 이행되었습니다. `expression-constants.ts`, 문서(MDX), 각 UI 페이지의 datetime 표시가 일관되게 `formatDate`를 사용하도록 전환되었습니다. 다만 `schedules/page.tsx` CalendarView의 `toLocaleString` 직접 호출(규약 위반), Webhook URL의 개발 포트 하드코딩(기능 버그), `trigger-detail-drawer.tsx`의 i18n 누락(기능 일관성 결여), `"datetime"` 포맷 테스트의 시간 컴포넌트 검증 부재 등이 요구사항 완전성 측면에서 보완이 필요합니다. `formatDate`의 유효하지 않은 입력 처리 부재는 방어적 프로그래밍 관점에서 추가 처리가 권장됩니다.

## 위험도

**MEDIUM**