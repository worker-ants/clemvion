# 변경 범위(Scope) 리뷰

## 발견사항

발견된 범위 이탈 사항 없음.

---

## 요약

이번 변경은 plan/in-progress/channel-web-chat-followups.md §4 "presentation 보강"에 명시된 두 가지 작업 — (1) template html/markdown 풍부 렌더 + DOMPurify sanitize, (2) chart 축 레이블·x틱·값 툴팁·pie/donut 범례 추가 — 에 정확히 대응한다. 수정된 파일은 `package.json`/`package-lock.json`(신규 deps: marked, dompurify, @types/dompurify), `lib/presentation.ts`(ChartData에 xLabel/yLabel 추가), `lib/safe-html.ts`(신규 파일: renderTemplateHtml), `components/presentations.tsx`(CartesianChart 분리·PieChart 범례·TemplateView rich 렌더), `widget/styles.ts`(신규 CSS 클래스), 테스트 2개, plan 파일 체크박스 갱신으로 구성된다. 불필요한 리팩토링, 관련 없는 파일 수정, 의미 없는 포맷 변경, 무관한 임포트·설정 변경은 관찰되지 않았다. `presentations.tsx`의 ChartView→CartesianChart/PieChart 분리는 구조적으로 더 크게 보일 수 있으나 축 레이블·범례 기능을 올바르게 구현하기 위한 필연적 분해이며 범위 이탈로 볼 수 없다. 기존 SVG 좌표계 재계산은 기능 구현의 직접 결과이다.

## 위험도

NONE
