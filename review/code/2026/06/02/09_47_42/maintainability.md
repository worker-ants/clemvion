# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `CartesianChart` 내 매직 넘버 산재
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` — `CartesianChart` 함수 내부
- 상세: `mL = 30`, `mR = CHART_SVG_PAD / 3`, `mT = CHART_SVG_PAD / 3`, `mB = xLabel ? 38 : 26`, `r={2.5}` (line/area circle radius), 틱 step `6`(최대 개수), y-offset `+11`, `+4`, `-4` 등 SVG 좌표·여백 값들이 인라인 숫자로 산재해 있다. `CHART_SVG_PAD`는 상수화되어 있으나 파생 계산값들은 그렇지 않다.
- 제안: `CHART_MARGIN_LEFT = 30`, `CHART_TICK_Y_OFFSET = 11`, `CHART_MAX_X_TICKS = 6` 등 의미 있는 상수로 추출. 혹은 기존 `CHART_SVG_PAD`처럼 파일 상단에 그룹으로 선언.

### [INFO] `PieSlices` 내 pie 중심·반지름 하드코딩
- 위치: `presentations.tsx` — `PieSlices` 함수 (`cx = 70`, `cy = 70`, `r = 50`, `r * 0.55`)
- 상세: viewBox가 `"0 0 140 140"`이고 중심·반지름이 그에 대응하나, 모두 리터럴 숫자로 기술되어 있다. viewBox 변경 시 연동 수정이 필요한 숫자들이 함수 내부에 숨어 있다.
- 제안: `PIE_SVG_SIZE = 140`에서 `cx = PIE_SVG_SIZE / 2`, `r = PIE_SVG_SIZE * 0.357` 등 파생 표현으로 명시하거나, 파일 상단에 pie 전용 상수 블록을 추가.

### [INFO] `CartesianChart` 함수 인라인 series 분기로 함수 길이 증가
- 위치: `presentations.tsx` — `CartesianChart` 함수
- 상세: line/area와 bar 분기가 하나의 함수 내부에서 `let series: React.ReactNode` 변수에 할당되는 형태로 합쳐져 있다. 함수 전체가 약 85줄에 달하며, y축 눈금·x틱·축 레이블까지 모두 포함한다. `ChartView`에서 이미 `isPie` 분기로 `CartesianChart`를 분리한 것과 일관성 있게, bar/line/area series 생성을 별도 함수(`BarSeries`, `LineSeries` 등)로 분리하면 각 함수가 단일 책임을 가질 수 있다.
- 제안: series 생성 로직을 별도 순수 함수로 추출하거나, 현 구조를 유지하되 분기 comment를 명확히 유지하는 최소 방향 중 선택.

### [INFO] `hookInstalled` 모듈-레벨 가변 상태
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` — `let hookInstalled = false;`
- 상세: 모듈 레벨의 변이 가능한 boolean은 테스트 격리를 어렵게 만든다. 각 테스트에서 모듈 재import 없이 hook 상태가 누적된다. 현재 구조에서는 `DOMPurify` hook이 중복 등록되지 않도록 guard하는 용도이나, 테스트 환경에서 `window` mock을 교체하거나 hook을 리셋하려면 모듈 캐시를 flush해야 한다.
- 제안: 단기적으로 현 구조 유지는 가능하나, 테스트 격리가 필요해지면 `ensureLinkHook`에 `forceReset` 파라미터를 추가하거나 closure 기반으로 리팩토링 고려.

### [INFO] `marked.parse` 반환값 타입 캐스트 (`as string`)
- 위치: `safe-html.ts` — `(marked.parse(rendered, { async: false }) as string)`
- 상세: `marked.parse`는 버전에 따라 `string | Promise<string>` 반환 시그니처를 가진다. `async: false` 옵션으로 동기 동작을 강제하나, 타입 캐스트로 컴파일러 검사를 우회하고 있다. 라이브러리 버전 업그레이드 시 조용히 깨질 수 있다.
- 제안: 캐스트 이유를 주석에 명시. 예: `// marked.parse with async:false always returns string synchronously`.

### [INFO] `axisLabel` 내부 함수가 `toChart` 내부에 정의됨
- 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `toChart` 함수 내 `const axisLabel = (axis: unknown): string | undefined`
- 상세: `axisLabel`은 `config.xAxis`/`config.yAxis` 두 곳에만 쓰이므로 현재 위치가 적절하나, 추후 다른 converter에서 axis label 추출이 필요해질 경우 중복이 발생할 수 있다. 현재는 문제 없음.
- 제안: 현 구조 유지. 재사용 필요 시 파일 수준 헬퍼로 이동.

### [INFO] `styles.ts`의 CSS 문자열 내 파생 선택자 반복 패턴
- 위치: `codebase/channel-web-chat/src/widget/styles.ts`
- 상세: `.wc-template-body[data-rich]` 선택자가 6줄에 걸쳐 반복되는 패턴으로 추가되었다. 현재 파일은 단일 템플릿 리터럴 CSS로 관리되고 있어 구조 변경이 어려우나, 파생 선택자 반복이 늘어나는 추세다.
- 제안: 단기적으로 현 구조 유지 가능. `[data-rich]` 하위 스타일을 one-block comment로 묶어 가독성 확보.

### [INFO] `PieChart` SVG `aria-label`이 donut 타입을 반영하지 않음
- 위치: `presentations.tsx` — `PieChart` 함수 내 `aria-label="pie chart"`
- 상세: `CartesianChart`는 `type` 변수로 동적 aria-label을 생성하지만, `PieChart`는 donut 여부와 무관하게 `"pie chart"`로 하드코딩되어 있다. donut 차트에도 `"pie chart"`가 표시된다.
- 제안: `aria-label={donut ? "donut chart" : "pie chart"}`로 수정.

## 요약

이번 변경은 chart 축 레이블·툴팁·범례와 template 풍부 렌더(DOMPurify + marked 연동)를 추가하는 기능 보강이다. 전체적으로 코드 의도가 명확하고 기존 패턴(`asRecord`, `asButtons` 등)을 일관되게 따르고 있다. `safe-html.ts`는 책임이 단명하고 주석이 충분하며, `ChartView`-`CartesianChart`-`PieChart` 분리 구조도 적절하다. 주요 유지보수 위험은 `CartesianChart` 내 매직 넘버 산재와 `hookInstalled` 모듈 레벨 변이 상태로, 둘 다 현 규모에서는 즉각적 위험이 아니나 장기적으로 수치 의미를 상수화하고 hook 설치 로직의 테스트 격리 방안을 마련하는 것이 권장된다.

## 위험도

LOW
