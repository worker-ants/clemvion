백엔드 파일(permissions needed)을 제외하고 읽은 파일들을 바탕으로 분석합니다.

---

## 발견사항

### 인터페이스·시그니처 변경

- **[INFO]** `formatDate`의 시그니처에 선택적 3번째 인수 `locale?: Locale`이 추가됨
  - 위치: `src/lib/utils/date.ts:69`
  - 상세: AGENTS.md는 `formatDate(value, "datetime" | "date" | "time")` 2-arg 형태로 문서화하나, 구현은 `formatDate(date, format?, locale?)`로 3-arg. 기존 2-arg 호출부는 **후방 호환** 유지됨.
  - `"iso"` 포맷도 신규 추가 — 호출자가 없으면 무해, 있다면 ISO 원문 반환이라 표시 계층 규약(TZ 변환 없음)과 상충할 수 있음.
  - 제안: AGENTS.md에 `"iso"` 포맷과 3번째 인수를 명시하여 문서와 구현을 동기화.

---

### 의도치 않은 상태 변경 / 전역 변수

- **[INFO]** `date.ts`의 `currentLocale()` — `useLocaleStore.getState()`를 **비반응적(snapshot)** 으로 읽음
  - 위치: `src/lib/utils/date.ts:17`
  - 상세: 컴포넌트가 렌더 중에 이 함수를 호출하면 그 시점의 로케일을 가져오므로 사실상 정상 동작. 그러나 렌더 외부(이벤트 핸들러나 setInterval 등)에서 호출하면 로케일이 변경되어도 stale 값을 읽을 수 있음. 코드 내 주석이 이를 인지하고 있음.
  - 제안: 현재 사용 패턴(렌더 중 호출)에서는 무해하므로 현 상태 유지. 비렌더 컨텍스트에 추가될 경우 주의.

- **[INFO]** `date.test.ts`에서 `useLocaleStore.setState({ locale: "ko" })` 를 `afterEach`에서 리셋
  - 위치: `src/lib/utils/__tests__/date.test.ts:15, 30, 45`
  - 상세: 테스트 간 전역 store 상태 누수를 방지하는 올바른 패턴. 특이사항 없음.

---

### 환경 의존 / 예상 외 동작

- **[WARNING]** `CalendarView`에서 `toLocaleString("default", ...)` 직접 호출
  - 위치: `src/app/(main)/schedules/page.tsx:368`
  - 상세: `viewDate.toLocaleString("default", { month: "long", year: "numeric" })` — AGENTS.md 규약(`new Date().toLocaleString()` 직접 호출 금지)을 위반. 앱 로케일 설정이 아닌 브라우저 기본 로케일로 월 이름이 표시됨. 한/영 전환 시 캘린더 헤더만 브라우저 기본값으로 표시되는 불일치 발생.
  - 제안:
    ```ts
    // 현재
    viewDate.toLocaleString("default", { month: "long", year: "numeric" })
    // 수정
    viewDate.toLocaleDateString(intlLocale, { month: "long", year: "numeric" })
    // 또는 i18n t() + formatDate 조합
    ```

- **[WARNING]** 웹훅 URL에 `:3011` 포트 하드코딩
  - 위치: `src/app/(main)/triggers/page.tsx:200–203`, `src/components/triggers/trigger-detail-drawer.tsx:227–230`
  - 상세: `window.location.origin.replace(/:\d+$/, ":3011")`는 개발 환경 가정이 코드에 노출되어 있음. 프로덕션 환경이나 포트가 다른 배포에서 잘못된 URL을 생성할 수 있음. 두 파일에 동일한 로직이 중복됨.
  - 제안: 공유 유틸로 분리하고 환경변수(`NEXT_PUBLIC_API_BASE_URL` 등) 기반으로 처리.

---

### $today 제거에 따른 기존 데이터 부작용

- **[WARNING]** `$today` 제거는 저장된 기존 워크플로우 표현식에 대한 **breaking change**
  - 위치: `expression-constants.ts`, `evaluator.ts`(미열람), `variables-and-context*.mdx`
  - 상세: 프론트엔드 자동완성과 문서에서 `$today`가 제거됨. 그러나 이미 저장된 DB의 워크플로우 표현식에 `$today`가 사용된 경우, 평가 시 `undefined` 또는 런타임 오류가 발생할 수 있음. `evaluator.ts` 파일을 읽지 못해 폴백(deprecated 경고 + fallback 값 등) 처리 여부를 확인 불가.
  - 제안: `evaluator.ts`에서 `$today` 접근 시 `$now` 기반 deprecation warning을 로그에 남기거나, 마이그레이션 스크립트로 DB의 기존 표현식을 일괄 치환하는 방안 검토.

---

### 네트워크 호출

- **[INFO]** `authentication/page.tsx` — `selectedConfigId`가 바뀔 때 usage 쿼리가 자동으로 발생
  - 위치: `src/app/(main)/authentication/page.tsx:83–90`
  - 상세: `enabled: !!selectedConfigId`로 행 클릭 시 `/auth-configs/${id}/usage` 호출이 즉시 트리거됨. 의도된 동작이지만, 행을 빠르게 여러 번 클릭하면 여러 요청이 발생할 수 있음. React Query의 기본 dedup이 있으므로 심각한 문제는 아님.

- **[INFO]** `version-history-panel.tsx` — `saveCount`가 변경될 때마다 캐시 무효화
  - 위치: `src/components/editor/version-history/version-history-panel.tsx:50–55`
  - 상세: `useEffect`로 `saveCount` 증가 시 `["workflow-versions", workflowId]` 쿼리를 무효화. 의도된 동작이며 부작용 없음.

---

### 이벤트 / 콜백

- **[INFO]** `button-bar.tsx` — 포트 버튼 클릭 시 `new Date().toISOString()` 사용
  - 위치: `src/components/editor/run-results/button-bar.tsx:75`
  - 상세: 클릭 시각을 로컬 상태에 기록하는 용도로 `new Date().toISOString()`을 사용 — AGENTS.md의 "서버에서 받은 ISO datetime 표시 시 formatDate 사용" 규약과 충돌하지 않음(이 경우 서버 datetime이 아닌 클라이언트에서 생성한 타임스탬프). 이후 `formatDate(clicked.at, "time")`으로 표시하는 것도 올바름.

---

## 요약

이번 변경의 핵심인 `$today` 제거와 `formatDate`를 통한 datetime 표기 통일은 전반적으로 올바르게 적용되었다. 대부분의 컴포넌트가 `formatDate` 규약을 준수하고 있으며, 새로 추가된 테스트도 적절하다. 그러나 두 가지 실질적 위험이 있다: **CalendarView의 `toLocaleString("default", ...)` 직접 호출** (로케일 불일치)과 **웹훅 URL의 하드코딩된 `:3011` 포트** (환경 의존). 또한 백엔드 `evaluator.ts`에서 기존 `$today` 참조에 대한 graceful 처리 여부를 확인해야 하며, 이미 저장된 표현식의 데이터 마이그레이션 계획이 명시적으로 필요하다.

## 위험도

**MEDIUM** — `$today` 제거의 기존 워크플로우 데이터 영향과 CalendarView 로케일 우회가 실 사용자에게 영향을 미칠 수 있으나, 즉각적 장애 가능성은 낮음. 웹훅 URL 하드코딩은 배포 환경에 따라 HIGH가 될 수 있음.