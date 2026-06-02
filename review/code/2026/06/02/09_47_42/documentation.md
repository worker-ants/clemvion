# 문서화(Documentation) Review — web-chat-presentation-rich

## 발견사항

### [INFO] `safe-html.ts` 신규 파일 — 모듈 수준 주석 충분
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` 전체
- 상세: 파일 상단에 4행의 모듈 주석이 있고, `ensureLinkHook` 에 단행 JSDoc, `renderTemplateHtml` 에는 포맷별 동작·SSR 폴백·null 반환 의미를 모두 설명하는 JSDoc이 있다. 보안 맥락(XSS, DOMPurify 역할)도 명시돼 있어 문서화 품질이 우수하다.
- 제안: 없음. 현재 상태 유지.

### [INFO] `presentation.ts` — `ChartData.xLabel` / `yLabel` JSDoc 부분 문서화
- 위치: `codebase/channel-web-chat/src/lib/presentation.ts` (ChartData 인터페이스, xLabel 정의부)
- 상세: `xLabel` 에는 `/** 축 레이블(config.xAxis.label / config.yAxis.label). */` JSDoc이 붙어 있지만, `yLabel` 에는 별도 JSDoc이 없다. `xLabel` 주석이 두 필드를 함께 설명하고 있어 `yLabel` 만 읽을 때 설명이 없어 약간 어색하다.
- 제안: `yLabel` 에도 간단한 `/** Y축 레이블(config.yAxis.label). */` 주석을 추가하거나, `xLabel`/`yLabel` 블록을 하나의 JSDoc 블록으로 통합한다.

### [WARNING] `presentations.tsx` — `CartesianChart` 내부 마진 상수 일부 설명 부재
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx`, `CartesianChart` 함수 내 `mL`, `mR`, `mT` 변수 선언부
- 상세: SVG 레이아웃을 결정하는 마진 변수 `mL=30`, `mR`, `mT` 가 인라인 주석 없이 등장한다. `mB = xLabel ? 38 : 26` 줄에는 한국어 주석이 있으나 나머지 세 변수에는 설명이 없다. 기존 `pad` 방식(단일 패딩)에서 4방향 명시적 마진 방식으로 변경됐음을 코드만으로는 파악하기 어렵다.
- 제안: `mL`/`mR`/`mT` 각 선언에 역할 한 줄씩 추가. 예:
  ```ts
  const mL = 30;  // 좌측 여백(y눈금 공간)
  const mR = CHART_SVG_PAD / 3;  // 우측 여백
  const mT = CHART_SVG_PAD / 3;  // 상단 여백
  ```

### [WARNING] README — rich template 렌더·safe-html 기능 미반영 (오래된 설명 잔존)
- 위치: `codebase/channel-web-chat/README.md`, "상태" 섹션 마지막 줄
- 상세: README 마지막 줄 `"잔여(rich presentation 전용 컴포넌트 등): channel-web-chat-followups.md"` 는 이번 변경으로 완료된 기능을 아직 "잔여"로 기술한다. `plan/in-progress/channel-web-chat-followups.md` 에서는 해당 항목이 `[x]` 완료로 체크됐다. 또한 `lib/safe-html.ts`(DOMPurify + marked 기반 sanitize)의 신규 추가, template 렌더러의 plain text → 풍부 렌더 전환, 차트 축 레이블·범례·툴팁 기능이 README "상태" 섹션에 반영되지 않았다.
- 제안:
  1. "잔여(rich presentation ...): followups.md" 문구를 갱신해 실제 잔여 항목(show/hide command 핸들러 등)으로 수정.
  2. "상태" 섹션에 다음 기능 추가: `presentations.tsx`(carousel/table/chart/template inline 렌더러), `safe-html.ts`(DOMPurify sanitize + marked markdown 변환), 차트 축 레이블·범례·툴팁.

### [INFO] spec 5-template.md — "HTML sanitize caveat" 노트가 클라이언트 측 구현을 미반영
- 위치: `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/5-template.md`, 라인 35
- 상세: `> **HTML sanitize caveat** — output.rendered 는 sanitize 되지 않는다. 신뢰할 수 없는 입력이 {{ }} 로 치환되는 경우, 템플릿 작성자가 직접 escape 해야 한다 (별도 P1 보안 트랙).` 이 caveat 은 백엔드 관점에서는 여전히 유효하나, 이번 변경으로 위젯 클라이언트에서 DOMPurify 로 sanitize 가 수행된다. spec 에 이 사실이 언급되지 않아 spec-impl 불일치가 발생한다. spec 쓰기는 project-planner 권한이므로 직접 수정 불가.
- 제안: project-planner 를 통해 해당 caveat 에 `(위젯 클라이언트는 렌더 시점에 DOMPurify 로 sanitize — lib/safe-html.ts 참조)` 보충 노트 추가를 요청.

### [INFO] `toChart` JSDoc — `xLabel`/`yLabel` 추출 동작 미기술
- 위치: `codebase/channel-web-chat/src/lib/presentation.ts`, `toChart` 함수 JSDoc (함수 직전 주석 블록)
- 상세: 기존 JSDoc은 `output.data` 추출, `chartType` 기본값, `colors` 기본값을 설명하지만, 새로 추가된 `xLabel`/`yLabel` 추출(`config.xAxis.label`, `config.yAxis.label`, 빈 문자열이면 undefined)에 대한 언급이 없다.
- 제안: JSDoc에 `xLabel/yLabel 은 config.xAxis.label / config.yAxis.label 에서 추출(빈 문자열이면 undefined).` 한 줄 추가.

### [INFO] `presentations.tsx` 파일 상단 주석 — chart 한정 설명이지만 template 외부 deps 추가 반영 여지 있음
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx`, 라인 3
- 상세: `// 차트는 임베드 위젯 번들 경량 유지를 위해 외부 차트 라이브러리 없이 inline SVG 로 그린다.` 는 chart에 대해서는 여전히 정확하지만, 이번에 template 풍부 렌더를 위해 `marked`/`dompurify` 두 외부 라이브러리가 도입됐다. 주석이 chart 범위에만 국한됨을 명시하면 더 정확하다.
- 제안: `// 차트는 임베드 위젯 번들 경량 유지를 위해 외부 차트 라이브러리 없이 inline SVG 로 그린다. template 풍부 렌더는 lib/safe-html(DOMPurify+marked) 사용.`

### [INFO] CHANGELOG 부재
- 위치: 프로젝트 루트 및 `codebase/channel-web-chat/`
- 상세: 이 프로젝트는 별도 CHANGELOG 파일을 운용하지 않는다. `plan/in-progress/channel-web-chat-followups.md` 가 변경 이력 역할을 대신하며, 이번 완료 내용도 날짜와 검증 결과를 포함해 기록돼 있다. 프로젝트 규약에 부합한다.
- 제안: 없음.

---

## 요약

이번 변경의 문서화 품질은 전반적으로 양호하다. `safe-html.ts` 신규 파일은 모듈 헤더·JSDoc·보안 맥락이 잘 갖춰져 있고, `presentation.ts`와 `presentations.tsx` 의 기존 JSDoc도 대부분 변경 내용을 반영한다. 가장 중요한 보완 과제는 두 가지다. 첫째, README "상태" 섹션에 "잔여(rich presentation...)" 라는 오래된 설명이 남아 있어 이번에 완료된 기능이 반영되지 않은 상태다. 둘째, `spec/4-nodes/6-presentation/5-template.md` 의 "HTML sanitize caveat" 가 클라이언트 측 DOMPurify sanitize 추가를 반영하지 않아 spec-impl 불일치가 생겼으며, project-planner 경로의 spec 업데이트가 필요하다. `CartesianChart` 마진 상수 주석 미비와 `toChart` JSDoc 의 xLabel/yLabel 미기술은 낮은 수준의 보완 사항이다.

## 위험도

LOW

---

STATUS: SUCCESS
