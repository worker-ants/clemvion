# Code Review 통합 보고서

> 리뷰 대상: `web-chat-presentation-rich` — channel-web-chat 위젯 template 풍부 렌더(DOMPurify + marked) 및 차트 축 레이블·범례·툴팁 보강
> 생성일시: 2026-06-02 09:47:42

## 전체 위험도

**MEDIUM** — XSS 방어 계층은 올바르게 구성되어 있으나, `safe-html.ts` 단위 테스트 부재·`isSafeUrl` URL 스킴 차단 미비·`marked.parse` 타입 캐스팅 런타임 가드 누락 등 보안 관련 테스트 공백이 복합적으로 존재한다. spec-impl 불일치(recharts vs inline SVG, HTML sanitize caveat)는 project-planner 경유 수정이 필요하다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `isSafeUrl` — `blob:` / `file:` 스킴 차단 누락. `javascript:`, `data:`, `vbscript:` 는 차단하나 `blob:` / `file:` 는 허용됨 | `src/lib/presentation.ts` — `isSafeUrl` 함수 | `if (lower.startsWith("blob:") \|\| lower.startsWith("file:")) return false;` 추가 |
| 2 | 보안 | `dangerouslySetInnerHTML` 사용 시 DOMPurify 미초기화·빈 문자열 에지케이스 방치. `safeHtml !== null` 체크만 있고 빈 문자열 확인 없음 | `src/widget/components/presentations.tsx` — `TemplateView` | `safeHtml !== null && safeHtml.length > 0` 조건 추가; DOMPurify 버전 lockfile 정확 고정 |
| 3 | 보안 | `marked` 파싱 결과가 DOMPurify 전에 raw HTML로 존재 — `marked` 알려지지 않은 파싱 버그가 DOMPurify 우회 가능성 잔존 | `src/lib/safe-html.ts` — `renderTemplateHtml` | marked 옵션에 필요 최소 기능만 명시 활성화; CI에 `npm audit` 추가 |
| 4 | 보안 | `hookInstalled` 모듈 레벨 전역 — `DOMPurify.removeHook()` 호출 시 hook 이 조용히 제거돼도 `hookInstalled === true` 잔존 | `src/lib/safe-html.ts` — `hookInstalled` / `ensureLinkHook` | hook 멱등성 보장(매번 덮어쓰기) 또는 제거 방어 로직 추가 |
| 5 | 테스트 | `safe-html.ts` 직접 단위 테스트 파일 없음 — SSR 폴백 분기(`typeof window === "undefined"`), `hookInstalled` 재진입, `format === "text"` → null 경로 미검증 | `src/lib/safe-html.ts` (신규 파일 전체) | `src/lib/safe-html.test.ts` 신설; SSR 분기는 `vi.stubGlobal`로 `window` 제거 후 테스트 |
| 6 | 테스트 | `hookInstalled` 모듈 수준 전역 상태 — 테스트 간 격리 위협. `vi.resetModules()` 없어 테스트 실행 순서에 따라 결과 상이 가능 | `src/lib/safe-html.ts` L1; `presentations.test.tsx` 전체 | `beforeEach`/`afterEach`에서 `DOMPurify.removeHooks` 호출 또는 `vi.resetModules()` + 동적 import 패턴 |
| 7 | 테스트 | `marked.parse` `as string` 타입 강제 캐스팅 — Promise 반환 시 `[object Promise]` 가 DOMPurify에 전달되어 XSS 방어 무력화 가능. 런타임 타입 단언 없음 | `src/lib/safe-html.ts` L26 | `instanceof Promise` 런타임 가드 추가; `safe-html.test.ts`에 `typeof result === "string"` 단언 |
| 8 | 의존성 | `dompurify: "^3.4.7"`, `marked: "^18.0.4"` caret 범위 — minor/patch 자동 업그레이드 허용. XSS 방어 핵심 보안 패키지에 비의도 업그레이드 위험 | `codebase/channel-web-chat/package.json` dependencies | exact 버전(`"3.4.7"`, `"18.0.4"`)으로 고정; 보안 패치는 의도적 PR로 추적 |
| 9 | 의존성 | `marked@18.0.4`의 `engines: { node: ">=20" }` 요구가 `package.json`에 `engines` 필드 없이 암묵 허용 | `codebase/channel-web-chat/package.json` | `"engines": { "node": ">=20" }` 추가 |
| 10 | 문서화 | `CartesianChart` 내 마진 상수(`mL`, `mR`, `mT`) 인라인 주석 부재 — 4방향 마진 도입 의도를 코드만으로 파악 어려움 | `src/widget/components/presentations.tsx` — `CartesianChart` 상단 | 각 변수에 역할 주석 한 줄 추가 (예: `// 좌측 여백(y눈금 공간)`) |
| 11 | 문서화 | `README.md` "상태" 섹션에 "잔여(rich presentation ...): followups.md" 문구가 이미 완료된 기능을 잔여로 기술 | `codebase/channel-web-chat/README.md` 마지막 줄 | 완료 기능 반영 갱신; `safe-html.ts`, 차트 축 레이블·범례·툴팁 추가 기술 |
| 12 | 요구사항 | `safe-html.ts` SSR/build 컨텍스트에서 html/markdown 포맷은 항상 null 반환 — JSDoc 미기술로 향후 Storybook/테스트 사용 시 혼동 위험 | `src/lib/safe-html.ts` — `renderTemplateHtml` | JSDoc에 "클라이언트 전용(`window` 필수) — SSR 컨텍스트에서 null 반환" 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `USE_PROFILES: { html: true }` — 광범위한 태그 허용, DOMPurify 기본 정책 의존. 임베드 위젯 특성상 화이트리스트 방식 전환 가능 | `src/lib/safe-html.ts` — `DOMPurify.sanitize()` 옵션 | `ALLOWED_TAGS` / `ALLOWED_ATTR` 화이트리스트 방식 전환 검토 |
| 2 | 보안 | `cellText` — `JSON.stringify`로 임의 객체 문자열화 시 민감 내부 구조 화면 노출 가능성 | `src/widget/components/presentations.tsx` — `cellText` | rows 데이터 출처(백엔드 신뢰) 보장 문서화 |
| 3 | 보안 | `marked@^18.0.4` caret 범위 — lockfile 외 `npm update` 시 자동 마이너/패치 업그레이드 | `codebase/channel-web-chat/package.json` | CI에 `npm audit --audit-level=moderate` 추가 |
| 4 | 요구사항 | spec `3-chart.md §4` "recharts" 참조가 inline SVG 구현과 불일치 — spec 갱신 필요 | `spec/4-nodes/6-presentation/3-chart.md §4` | project-planner 경유 "inline SVG (channel-web-chat 위젯 전용, 번들 경량화)"로 수정 |
| 5 | 요구사항 | `presentations.test.tsx` XSS 방어 테스트가 `if (img)` / `if (a)` 조건부 검증 — 태그 완전 제거 시 XSS 속성 검증 미실행 | `presentations.test.tsx` L2422–2424 | `expect(tpl.querySelector("img")).not.toBeNull()` 단언 추가 또는 의도 주석 기술 |
| 6 | 테스트 | `axisLabel` 빈 문자열(`""`) 처리 테스트 케이스 없음 | `src/lib/presentation.test.ts` | `label: ""` 케이스 추가 |
| 7 | 테스트 | `truncLabel` 순수 함수 직접 단위 테스트 없음 — 경계값(길이=max, max-1, max+1, 빈 문자열) 미검증 | `src/widget/components/presentations.tsx` — `truncLabel` | 별도 util 모듈 추출 후 단위 테스트 또는 컴포넌트 테스트에서 말줄임표 단언 추가 |
| 8 | 테스트 | line/area 차트 타입 컴포넌트 테스트 없음 — `polyline`, `polygon`, `circle` 렌더 미검증 | `presentations.test.tsx` | `chartType: "line"` / `"area"` 케이스 SVG 요소 존재 및 tooltip 내용 검증 추가 |
| 9 | 테스트 | donut 차트 테스트 없음 — `PieSlices` donut hole circle, `PieChart donut=true` 경로 미검증 | `presentations.test.tsx` | donut 케이스 추가 (`.wc-chart-pie-wrap` + donut hole circle 확인) |
| 10 | 테스트 | `FORBID_TAGS` 효과 미검증 — `form`, `input`, `style` 태그 제거 테스트 없음 | `presentations.test.tsx` | `<form><input type=text></form><style>*{display:none}</style>` 케이스 추가 |
| 11 | 유지보수성 | `CartesianChart` 내 매직 넘버 산재 — `mL=30`, `mB=38/26`, tick step `6` 등 의미 불명 | `src/widget/components/presentations.tsx` — `CartesianChart` | `CHART_MARGIN_LEFT`, `CHART_MAX_X_TICKS` 등 파일 상단 상수로 추출 |
| 12 | 유지보수성 | `PieSlices` pie 중심·반지름 하드코딩 — viewBox 변경 시 연동 수정 필요 | `presentations.tsx` — `PieSlices` (`cx=70`, `cy=70`, `r=50`) | `PIE_SVG_SIZE = 140`에서 파생 표현으로 명시 |
| 13 | 유지보수성 | `PieChart` `aria-label="pie chart"` donut 타입 미반영 | `presentations.tsx` — `PieChart` | `aria-label={donut ? "donut chart" : "pie chart"}` |
| 14 | 유지보수성 | `marked.parse` `as string` 캐스팅 이유 주석 없음 | `src/lib/safe-html.ts` L26 | `// marked.parse with async:false always returns string synchronously` 주석 추가 |
| 15 | 문서화 | `spec/4-nodes/6-presentation/5-template.md` "HTML sanitize caveat"가 클라이언트 DOMPurify 추가 미반영 — spec-impl 불일치 | `spec/4-nodes/6-presentation/5-template.md` L35 | project-planner 경유 클라이언트측 DOMPurify sanitize 보충 노트 추가 요청 |
| 16 | 문서화 | `presentation.ts` `yLabel` JSDoc 없음 — `xLabel` 주석만 두 필드를 함께 설명 | `src/lib/presentation.ts` — `ChartData` 인터페이스 | `yLabel`에 `/** Y축 레이블(config.yAxis.label). */` 추가 |
| 17 | 문서화 | `toChart` JSDoc에 `xLabel`/`yLabel` 추출 동작 미기술 | `src/lib/presentation.ts` — `toChart` 함수 JSDoc | `xLabel/yLabel 은 config.xAxis.label / config.yAxis.label 에서 추출(빈 문자열이면 undefined).` 한 줄 추가 |
| 18 | 문서화 | `presentations.tsx` 파일 상단 주석이 chart 한정 설명 — template용 `marked`/`dompurify` 도입 미언급 | `src/widget/components/presentations.tsx` L3 | `// template 풍부 렌더는 lib/safe-html(DOMPurify+marked) 사용.` 보충 |
| 19 | 의존성 | `dompurify` 듀얼 라이선스(MPL-2.0 OR Apache-2.0) — 프로젝트의 공식 라이선스 선택 미문서화 | `codebase/channel-web-chat/package.json` | `LICENSE` 파일 또는 문서에 Apache-2.0 선택 기록 |
| 20 | 범위 | 변경 범위 이탈 없음 — 모든 수정이 plan §4 "presentation 보강"에 정확히 대응 | 전체 변경 파일 | 해당 없음 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | `isSafeUrl` blob:/file: 스킴 차단 누락, DOMPurify hookInstalled 방어 미비, USE_PROFILES 화이트리스트 미적용 |
| testing | MEDIUM | `safe-html.ts` 단위 테스트 파일 없음, hookInstalled 테스트 격리 위협, marked.parse 타입 캐스팅 런타임 가드 없음 |
| requirement | LOW | spec 3-chart.md §4 recharts 참조가 inline SVG 구현과 불일치, safe-html.ts 단위 테스트 부재, SSR 폴백 미문서화 |
| side_effect | LOW | hookInstalled 모듈 전역 상태 테스트 간 오염 가능, DOMPurify.addHook 전역 영구 등록 |
| maintainability | LOW | CartesianChart 매직 넘버 산재, hookInstalled 모듈 레벨 가변 상태, PieSlices 하드코딩 |
| documentation | LOW | README 상태 섹션 오래된 문구 잔존, spec template.md HTML sanitize caveat 미반영 |
| dependency | LOW | caret 버전 지정 보안 패키지 자동 업그레이드 위험, engines 필드 없음, dompurify 라이선스 선택 미문서화 |
| scope | NONE | 변경 범위 이탈 없음 |

---

## 발견 없는 에이전트

- **scope**: 변경 범위 이탈 사항 없음. plan §4 "presentation 보강" 두 항목에 정확히 대응.

---

## 권장 조치사항

1. **[보안 즉시]** `isSafeUrl` 에 `blob:` / `file:` 스킴 차단 추가 (`src/lib/presentation.ts`)
2. **[보안 즉시]** `TemplateView`의 `dangerouslySetInnerHTML` 조건에 `safeHtml.length > 0` 추가 (`src/widget/components/presentations.tsx`)
3. **[테스트 즉시]** `src/lib/safe-html.test.ts` 신설 — SSR 폴백, text/null, hookInstalled 재진입, marked.parse 타입 단언 포함
4. **[테스트 즉시]** `marked.parse` 결과에 `instanceof Promise` 런타임 가드 추가 또는 `typeof result !== "string"` 시 에러 처리
5. **[보안 권장]** `dompurify`/`marked` 버전을 `package.json`에서 exact 버전으로 고정; CI에 `npm audit --audit-level=moderate` 추가
6. **[테스트 권장]** hookInstalled 테스트 격리 — `beforeEach`/`afterEach`에서 `DOMPurify.removeHooks` 또는 `vi.resetModules()` + 동적 import
7. **[테스트 권장]** line/area/donut 차트 타입, `FORBID_TAGS` 효과, `axisLabel` 빈 문자열 케이스 테스트 추가
8. **[문서화 권장]** README "상태" 섹션 갱신 — 완료된 rich render 기능 반영, 잔여 항목(show/hide 핸들러 등)으로 수정
9. **[spec 위임]** project-planner 경유: `spec/4-nodes/6-presentation/3-chart.md §4` "recharts" → "inline SVG" 수정; `spec/4-nodes/6-presentation/5-template.md` HTML sanitize caveat에 클라이언트 DOMPurify 보충
10. **[유지보수 권장]** `CartesianChart` 매직 넘버를 파일 상단 명명 상수로 추출; `PieChart` aria-label donut 동적 처리; `mL`/`mR`/`mT` 변수에 주석 추가

---

## 라우터 결정

`routing=done` — 전체 8개 reviewer 가 `router_safety` 강제 포함으로 실행됨.

- **실행(forced)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `dependency` (8명, 전원 router_safety 강제)
- **제외(skipped)**: `performance`, `architecture`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (6명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |

- **강제 포함(router_safety)**: security, requirement, scope, side_effect, maintainability, testing, documentation, dependency (8명 전원)