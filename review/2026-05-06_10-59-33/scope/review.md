충분한 컨텍스트를 확보했습니다. 이제 범위 리뷰를 수행합니다.

---

## 발견사항

### **[INFO]** `schedules/page.tsx` — `toLocaleString` 미전환
- **위치**: `schedules/page.tsx:368`
- **상세**: `CalendarView`의 월 헤더 표시에 `viewDate.toLocaleString("default", { month: "long", year: "numeric" })` 직접 호출이 남아있음. 이번 변경은 "datetime 표기를 formatDate로 통일"을 목표로 하지만, 이 케이스는 전환되지 않았음. 서버 ISO 문자열이 아닌 클라이언트 생성 `Date`이므로 AGENTS.md 의 엄밀한 적용 대상은 아니나, `"default"` 로케일 사용으로 앱 로케일 설정을 우회한다는 점에서 동일한 문제를 안고 있음.
- **제안**: `formatDate`에 `"month-year"` 포맷을 추가하거나, `Intl.DateTimeFormat`을 `intlLocale`을 명시한 형태로 교체 — 단, `formatDate`가 해당 포맷을 지원하지 않으므로 이 PR 범위 내에서 처리하기 어려우면 별도 이슈로 트래킹

---

### **[WARNING]** `user_memo/node-specs/README.md` — 파일 존재 여부 미확인
- **위치**: `user_memo/node-specs/README.md`
- **상세**: 해당 경로의 파일이 현재 작업 디렉토리(`/Volumes/project/private/idea-workflow/frontend/`)에서 접근 불가. 리뷰 대상으로 명시되어 있으나 내용 검증 불가. `user_memo/`는 "사용자가 남긴 자료"로 구분된 경로로, `$today` 제거 작업 범위에 포함될 수 있으나 변경 내용 확인 필요.
- **제안**: 해당 파일의 변경 내용이 `$today` 참조 제거에 국한되는지 별도 확인

---

### **[INFO]** `button-bar.tsx` — 클라이언트 생성 타임스탬프에 `formatDate` 적용
- **위치**: `button-bar.tsx:73, 98`
- **상세**: `new Date().toISOString()`으로 생성한 클라이언트 타임스탬프를 `formatDate(clicked.at, "time")`으로 표시. 서버 ISO datetime이 아닌 클라이언트 생성 값이지만, AGENTS.md 규약이 "ISO 8601 datetime 문자열을 화면에 표시할 때"를 대상으로 하므로 규약상 올바른 적용. 범위 내 변경.

---

### **[INFO]** 다층 변경의 일관성 — 범위 내 정합
- **상세**: `$today` 제거가 아래 전 레이어에서 일관되게 수행됨:
  - expression-engine 패키지 (`evaluator.ts`, `expression.spec.ts`)
  - 백엔드 서비스 (`expression-resolver.service.ts`, `.spec.ts`)
  - 프론트엔드 자동완성 상수 (`expression-constants.ts`)
  - AI 어시스턴트 시스템 프롬프트 (`system-prompt.ts`)
  - 사용자 문서 (`variables-and-context.mdx`, `cheatsheet.mdx`, `.en.mdx`)
  - 스펙 문서 (`spec/5-system/5-expression-language.md`)
  - AGENTS.md 규약 명문화
  - 전체 UI 컴포넌트 datetime 표기 통일 (9개 파일)

---

## 요약

변경 범위는 전반적으로 명확하게 정의된 목표(`$today` 제거 + `formatDate` 통일)에 집중되어 있으며, 과도한 리팩토링이나 무관한 수정은 발견되지 않았다. 유일한 실질적 우려 사항은 `schedules/page.tsx`의 `CalendarView`에서 `toLocaleString("default", ...)` 직접 호출이 이번 통일 작업에서 누락된 점으로, 동일한 로케일 우회 문제를 가지고 있지만 `formatDate`가 해당 포맷(`month year` 전용)을 지원하지 않아 현재 PR 범위에서 처리하기 어렵다. `user_memo/node-specs/README.md`는 내용 확인이 불가하여 별도 검토를 권장한다.

## 위험도

**LOW**