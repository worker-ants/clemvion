# Testing Review

## 발견사항

### **[WARNING]** `safe-html.ts` 에 대한 직접 단위 테스트 없음
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` (신규 파일, 44줄 전체)
- 상세: `renderTemplateHtml` 함수와 `ensureLinkHook` 함수는 `presentations.test.tsx` 의 통합 수준 테스트를 통해 간접적으로 검증되지만, `safe-html.ts` 자체의 단위 테스트 파일이 존재하지 않는다. 특히 아래 코드 경로가 직접 테스트되지 않음:
  - `hookInstalled` 모듈 수준 상태 변수: 동일 모듈 인스턴스에서 훅이 중복 등록되지 않는지 확인하는 테스트 없음. jsdom 환경에서 `window` 가 존재하므로 훅은 설치되는데, 여러 테스트 케이스 간 `hookInstalled = true` 상태가 공유되어 훅이 한 번만 설치된다는 보장은 간접적이다.
  - `typeof window === "undefined"` 분기(SSR 폴백): jsdom 환경에서는 `window` 가 항상 존재하므로 이 분기는 단 한 번도 실행되지 않는다. SSR/static export 시 `null` 반환을 보장하는 별도 테스트가 없음.
  - `format === "text"` 의 즉시 `null` 반환 분기: `presentations.test.tsx` 의 "template text" 테스트가 컴포넌트 레벨에서 간접 검증하지만, `renderTemplateHtml` 직접 호출 시 반환값을 단언하는 코드가 없음.
- 제안: `safe-html.test.ts` 파일 신설. (1) `format === "text"` → `null` 반환, (2) `window` mocking(vi.stubGlobal 등)으로 SSR 경로 → `null` 반환, (3) markdown 변환 출력의 기본 구조 검증, (4) `hookInstalled` 재진입 시 훅 재등록 안 함 검증(vi.spyOn(DOMPurify, "addHook")).

---

### **[WARNING]** `hookInstalled` 모듈 수준 전역 상태 — 테스트 간 격리 위협
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` 상단 `let hookInstalled = false;`
- 상세: `hookInstalled` 는 모듈 로드 시 한 번 초기화되는 전역 상태다. vitest 는 기본적으로 모듈 캐시를 테스트 파일 간 공유하므로, 어떤 테스트에서 `renderTemplateHtml` 을 호출해 훅이 설치된 후 다른 테스트에서 `hookInstalled` 상태가 이미 `true` 인 채로 시작된다. 현재 `presentations.test.tsx` 에는 `vi.resetModules()` / `vi.isolateModules()` 등 모듈 상태 초기화 코드가 없다. 이는 훅 설치 여부를 검증하는 테스트가 실행 순서에 따라 다른 결과를 낼 수 있음을 의미한다.
- 제안: `safe-html.ts` 에 테스트 전용 `resetHookForTesting()` 익스포트를 추가하거나, 각 `renderTemplateHtml` 테스트 전에 `vi.resetModules()` + 동적 import 패턴을 사용해 상태를 격리한다.

---

### **[WARNING]** `marked.parse` 의 비동기 변형에 대한 타입 캐스팅 — 테스트 커버리지 미비
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` L274: `(marked.parse(rendered, { async: false }) as string)`
- 상세: `marked@18.x` 에서 `marked.parse` 의 반환 타입이 변경되었을 수 있다. `async: false` 를 명시해 동기 실행하고 `as string` 으로 강제 캐스팅하고 있는데, 이 경우 `Promise` 가 반환되면 `DOMPurify.sanitize` 에 `[object Promise]` 문자열이 전달되어 XSS 방어가 무력화된다. 현재 테스트는 markdown 입력이 정상 HTML 로 렌더되는지만 확인하며, `async: false` 가 실제로 동기 문자열을 반환하는지 런타임 타입을 단언하는 코드가 없다.
- 제안: `safe-html.test.ts` 에 `typeof result === "string"` 단언을 추가하고, `marked.parse` 반환값이 `Promise` 인 경우를 에러로 처리하도록 런타임 가드(`instanceof Promise` 체크) 추가를 고려한다.

---

### **[INFO]** `axisLabel` 헬퍼 — 빈 문자열 처리 테스트 커버리지
- 위치: `codebase/channel-web-chat/src/lib/presentation.ts` `axisLabel` 함수, `codebase/channel-web-chat/src/lib/presentation.test.ts`
- 상세: `axisLabel` 은 `label` 이 빈 문자열(`""`)일 때 `undefined` 를 반환한다(`typeof label === "string" && label`). 현재 "label 없으면 undefined" 테스트는 `yAxis` 자체가 없는 경우만 다루고, `label: ""` (명시적 빈 문자열) 케이스는 테스트되지 않는다.
- 제안: `toChart({ config: { chartType: "bar", xAxis: { field: "m", label: "" } }, output: { data: [] } })` 케이스 추가.

---

### **[INFO]** `truncLabel` 함수 — 직접 단위 테스트 없음
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` `truncLabel` 함수
- 상세: `truncLabel` 은 `max` 기본값 7로 라벨을 잘라내는 순수 함수이지만, 컴포넌트 내부 헬퍼로 정의되어 직접 테스트되지 않는다. 경계값(길이 = max, 길이 = max-1, 길이 = max+1, 빈 문자열)에 대한 테스트가 없다.
- 제안: `truncLabel` 을 별도 util 모듈로 추출하거나, 컴포넌트 레벨 테스트에서 긴 라벨 입력 시 말줄임표(`…`)가 렌더됨을 추가 단언한다.

---

### **[INFO]** line/area 차트 타입 — component 레벨 테스트 없음
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.test.tsx`
- 상세: `presentations.test.tsx` 는 bar 차트와 pie 차트를 커버하지만, `CartesianChart` 의 `type === "line"` / `type === "area"` 분기(polyline, polygon, circle 렌더)에 대한 테스트가 없다. 특히 area 차트의 polygon 렌더, line 차트의 데이터 포인트 circle 과 툴팁은 새로 추가된 코드다.
- 제안: line 차트(`chartType: "line"`)와 area 차트(`chartType: "area"`)에 대해 SVG 요소(`polyline`, `polygon`, `circle`) 존재 여부와 tooltip(`title`) 내용을 검증하는 테스트를 추가한다.

---

### **[INFO]** donut 차트 — 테스트 없음
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.test.tsx`
- 상세: pie 차트 테스트는 있으나 donut 차트(`chartType: "donut"`)에 대한 테스트가 없다. `PieSlices` 의 donut hole `<circle>` 렌더, `PieChart` 의 `donut=true` 경로가 커버되지 않는다.
- 제안: donut 차트 케이스 추가(`.wc-chart-pie-wrap` 렌더 + donut hole circle 존재 확인).

---

### **[INFO]** `FORBID_TAGS` 효과 — 컴포넌트 테스트에서 미검증
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.test.tsx` "template html — 위험 콘텐츠 제거" 테스트
- 상세: `FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"]` 에 대한 검증이 없다. `script` 제거는 테스트하지만 `form`, `input`, `style` 태그 제거는 테스트되지 않는다. 이 태그들은 임베드 위젯 컨텍스트에서 특히 중요한 보안 경계다.
- 제안: `rendered: "<form><input type=text></form><style>*{display:none}</style>"` 케이스를 추가해 `form`, `input`, `style` 이 제거됨을 확인한다.

---

## 요약

이번 변경의 핵심 신규 코드인 `safe-html.ts`(`renderTemplateHtml` + `ensureLinkHook`)에 대한 **직접 단위 테스트 파일이 존재하지 않는다**는 점이 가장 큰 리스크다. SSR 폴백 분기(`typeof window === "undefined"`)와 모듈 수준 `hookInstalled` 전역 상태는 jsdom 환경에서 실행되는 통합 테스트만으로는 완전히 검증되지 않는다. `presentations.test.tsx` 에 추가된 template/chart 관련 테스트는 XSS 방어(script 제거, javascript: href 차단), 마크다운 변환, 축 레이블 등 핵심 시나리오를 잘 커버하고 있으나, line/area/donut 차트 타입과 `FORBID_TAGS` 효과에 대한 커버리지 갭이 남아 있다. `presentation.test.ts` 의 `toChart` 신규 케이스(xLabel/yLabel 추출, label 부재)는 적절하게 추가되었다. `marked.parse` 의 `as string` 타입 강제 캐스팅은 `marked@18` 에서 실제 동기 반환을 보장하는지 런타임 단언이 없어 잠재적 위험이 있다.

## 위험도

MEDIUM
