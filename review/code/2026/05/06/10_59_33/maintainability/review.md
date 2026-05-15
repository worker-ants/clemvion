충분한 파일을 읽었습니다. 유지보수성 리뷰를 작성합니다.

---

## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] `formatDate` 두 번째 파라미터가 `string` 으로 느슨하게 타입 지정됨**
- 위치: `src/lib/utils/date.ts:69`
- 상세: `format?: string` 은 `"iso"`, `"datetime"`, `"time"`, `"date"` 이외의 값을 아무 오류 없이 허용한다. 실수로 다른 값을 전달해도 컴파일 타임에 잡히지 않고 의도치 않게 기본 `"date"` 분기로 폴백된다.
- 제안: `format?: "iso" | "datetime" | "time" | "date"` 로 변경. 이 타입을 export 해서 호출 측에서도 재사용할 수 있도록 한다.

---

**[WARNING] `RawSchedule` 인터페이스와 `mapSchedule` 함수가 컴포넌트 함수 내부에 정의됨**
- 위치: `src/app/(main)/schedules/page.tsx:481-507`
- 상세: `interface RawSchedule`과 `function mapSchedule`이 `SchedulesPage` 컴포넌트 함수 바디 안에서 선언되어 있다. 렌더링마다 함수 선언이 재생성되지는 않지만 (TS 레벨에서만 존재), IDE 탐색 시 모듈 레벨에서 검색이 되지 않고 코드 구조가 불명확해진다. `calendarSchedulesQuery` queryFn 에서도 동일한 `RawSchedule` 타입이 필요한데 스코프 밖에서 접근이 불가능하다.
- 제안: 모듈 최상단으로 끌어올린다.

---

**[WARNING] `TYPE_BADGE_STYLES` 와 `getWebhookUrl` 이 두 파일에 완전히 중복됨**
- 위치: `src/app/(main)/triggers/page.tsx:47-54, 199-203` / `src/components/triggers/trigger-detail-drawer.tsx:39-43, 226-230`
- 상세: `TYPE_BADGE_STYLES` 객체와 `getWebhookUrl` 함수가 두 파일에 완전히 동일하게 복사되어 있다. 특히 `getWebhookUrl` 의 `:3011` 포트 하드코딩이 두 곳에 있어서, 포트 변경 시 한 곳만 수정하고 나머지를 놓치는 버그가 생길 수 있다.
- 제안: `src/components/triggers/trigger-utils.ts` 같은 공유 모듈로 추출한다.

---

**[WARNING] 하드코딩된 포트 `:3011` 이 URL 생성 로직에 존재**
- 위치: `trigger-detail-drawer.tsx:228`, `triggers/page.tsx:200`
- 상세: `window.location.origin.replace(/:\d+$/, ":3011")` 은 개발/배포 환경이 바뀌면 URL이 깨지는 취약한 로직이다. 이 패턴은 "Next.js dev 포트(3000)를 백엔드 포트(3011)로 교체"하는 개발용 편의 로직인데, 환경변수 없이 하드코딩되어 있다.
- 제안: `NEXT_PUBLIC_WEBHOOK_BASE_URL` 같은 환경변수로 외부화한다.

---

**[INFO] IIFE 패턴 `{(() => { ... })()}` 이 JSX 렌더 안에서 반복 사용됨**
- 위치: `src/components/editor/run-results/conversation-inspector.tsx:307, 524, 638`
- 상세: 조건부 렌더링을 IIFE로 구현해 가독성이 저하된다. 세 곳 모두 변수 추출 또는 헬퍼 컴포넌트로 대체 가능하다. 특히 `SummaryView` 내부 `items.map` 콜백(538-655행)은 중첩 조건 + IIFE + 이중 render 분기가 결합되어 순환 복잡도가 높다.
- 제안: 복잡한 분기는 `TurnCounterLabel`, `AssistantBubble` 같은 명명된 컴포넌트 또는 인라인 변수로 추출한다.

---

**[INFO] `conversation-inspector.tsx` 내 한/영 하드코딩 UI 문자열이 i18n 계층을 우회**
- 위치: `conversation-inspector.tsx:166, 297, 298, 313-316, 617-622`
- 상세: `"← Back to conversation"`, `"Tool Call — Turn ${n}"`, `"AI Response — Turn ${n}"` 는 영문 하드코딩이고, `원문 요청 / 응답 / 사용량은 상단의 "Request"...탭에서 확인할 수 있습니다.`는 한국어 하드코딩이다. 같은 파일 내에서도 언어가 혼재하며, 다른 컴포넌트들이 `useT()` 를 통해 i18n을 일관되게 사용하는 것과 불일치한다.
- 제안: `useT()` 훅으로 번역 키를 통해 출력한다.

---

**[INFO] `schedules/page.tsx` CalendarView 의 월 이름 포맷에 `toLocaleString` 직접 호출**
- 위치: `src/app/(main)/schedules/page.tsx:368`
- 상세: `viewDate.toLocaleString("default", { month: "long", year: "numeric" })` 는 `AGENTS.md` 규약("toLocaleString 직접 호출 금지")에 해당한다. 다른 모든 날짜 표시는 `formatDate` 유틸로 일관되게 처리하는 것과 불일치한다.
- 제안: `formatDate` 에 `"month-year"` 포맷을 추가하거나, 현재 로케일 스토어를 읽어 `Intl.DateTimeFormat` 을 래핑하는 방식으로 처리한다.

---

**[INFO] `RagDetail` 과 `SummaryView` 에서 동일한 regex가 중복 사용됨**
- 위치: `conversation-inspector.tsx:383, 594`
- 상세: `/\[Source: /g` 패턴과 `.match(...).length` 로직이 두 곳에 완전히 동일하게 반복된다.
- 제안: `countRagSources(content: string): number` 헬퍼 함수로 추출한다.

---

**[INFO] `button-bar.tsx` 의 `"Continue"` 레이블이 하드코딩됨**
- 위치: `src/components/editor/run-results/button-bar.tsx:86, 134`
- 상세: `"Continue"` 텍스트가 i18n 없이 영문 고정이다. `clicked.label` 에도 동일 문자열이 기록되어 한국어 환경에서 노출된다.
- 제안: `ButtonBarProps` 에 `continueLabel?: string` 를 추가하거나 `useT()` 로 처리한다.

---

**[INFO] `expression-constants.ts` 의 피커 제외 목록이 문자열 배열로 하드코딩됨**
- 위치: `src/components/editor/expression/expression-constants.ts:78`
- 상세: `["$input", "$node", "$var"]` 는 `ROOT_VARIABLES` 항목에 새 항목이 추가될 때 반드시 함께 갱신해야 하는 암묵적 의존이다. 동기화를 실수로 놓칠 경우 잘못된 변수가 피커에 노출될 수 있다.
- 제안: `RootVariable` 에 `excludeFromPicker?: boolean` 플래그를 추가하고 필터를 그 플래그로 구동한다.

---

### 요약

전반적으로 이번 변경은 `$today` 제거와 날짜 표기 계층 통일이라는 명확한 목적 하에 잘 정리되어 있다. `date.ts` 유틸리티, `expression-constants.ts`, `version-history-panel.tsx`, `button-bar.tsx`(i18n 미처리 한 곳 제외)는 가독성과 응집도가 높다. 주요 유지보수 부채는 두 가지 영역에 집중된다: (1) `getWebhookUrl`·`TYPE_BADGE_STYLES` 의 cross-file 중복과 하드코딩 포트, (2) `conversation-inspector.tsx`의 IIFE 패턴·혼재 하드코딩 문자열이다. `schedules/page.tsx`는 1100 라인에 달하는 파일 크기 자체는 큰 문제가 아니지만 `RawSchedule` 인터페이스가 컴포넌트 함수 내부에 갇혀 있는 점과 `toLocaleString` 직접 호출이 AGENTS.md 규약을 위반하는 점이 주의할 부분이다. `formatDate` 의 `format` 파라미터 타입을 union type으로 좁히는 것은 저비용으로 전체 호출 측의 타입 안정성을 즉시 높일 수 있다.

### 위험도

**LOW**