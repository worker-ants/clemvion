# 성능(Performance) Review

## 발견사항

- **[INFO]** `markdownToHtml` 함수의 연속 정규식 체인 — 매 호출마다 12개의 `.replace()` 를 순차 실행
  - 위치: `presentation-renderers.tsx` — `markdownToHtml` 함수 (라인 883–904)
  - 상세: 입력 문자열에 대해 12개의 정규식 치환이 순차적으로 실행된다. 각 `.replace()` 호출은 새 문자열 사본을 생성하므로, 긴 마크다운 입력에서는 O(n * k) 수준의 문자열 할당이 발생한다(k = 정규식 수). 단, 이 함수는 렌더 경로에서 한 번만 호출되고 결과가 `dangerouslySetInnerHTML` 에 그대로 전달되므로 실 서비스에서 체감 병목이 될 가능성은 낮다.
  - 제안: 현재 규모에서는 수용 가능하다. 마크다운 처리가 빈번하거나 문서 길이가 수 MB 단위로 커진다면 단일 정규식 패스 또는 `marked` / `micromark` 같은 스트리밍 파서 도입을 검토한다.

- **[INFO]** `sanitizeHtml` 호출 결과를 메모이제이션하지 않음
  - 위치: `presentation-renderers.tsx` — `TemplateContent` 컴포넌트 (라인 1175, 1188)
  - 상세: `TemplateContent` 는 `content` 와 `outputFormat` 이 동일해도 부모가 리렌더링될 때마다 `sanitizeHtml(content)` 또는 `sanitizeHtml(markdownToHtml(content))` 를 다시 실행한다. DOMPurify 파싱은 DOM 접근을 동반하므로 짧지 않은 HTML 입력에서 반복 비용이 누적될 수 있다.
  - 제안: `useMemo(() => sanitizeHtml(content), [content])` 로 감싸거나, `TemplateContent` 를 `React.memo` 로 래핑해 동일 props 에서 재계산을 방지한다.

- **[INFO]** `PresentationContent` 내 `previewHeader` 문자열 계산이 매 렌더마다 실행됨
  - 위치: `presentation-renderers.tsx` — `PresentationContent` 함수 (라인 1352–1355)
  - 상세: `result.nodeType === "template"` 조건 분기와 템플릿 리터럴 생성이 매 렌더마다 평가된다. 단순 연산이라 비용은 미미하지만, 패턴으로 보면 `useMemo` 또는 상수로 도출하는 것이 일관성 있다.
  - 제안: 현재 규모에서는 유지해도 무방하다. 리렌더 빈도가 높아지는 환경(예: 애니메이션 루프 내 state 갱신)이 생기면 `useMemo` 적용을 고려한다.

- **[INFO]** 테스트 파일에서 각 `it` 블록마다 독립적인 `render()` 호출 — cleanup 의존성
  - 위치: `presentation-renderers.test.tsx` — `Template global buttons` describe 블록 (라인 505–665)
  - 상세: 새로 추가된 6개의 테스트 케이스 각각이 독립적으로 `render()` 를 호출한다. `@testing-library/react` 는 각 테스트 후 자동으로 `cleanup` 을 수행하므로 메모리 누수 위험은 없다. 그러나 반복적인 React 트리 생성/해제 비용이 테스트 실행 시간에 소폭 영향을 준다.
  - 제안: 성능보다 격리성이 중요한 단위 테스트 환경에서는 현재 방식이 적절하다. 테스트 스위트가 수백 개로 늘어날 경우 `renderHook` 분리나 공통 fixture 팩토리 최적화를 검토한다.

- **[INFO]** `buttonItemMap` 필터링에 `Array.prototype.filter` 사용 — 버튼 수가 많을 때 선형 순회
  - 위치: `presentation-renderers.tsx` — `PresentationContent` 함수 (라인 1345–1347)
  - 상세: `buttons = buttonItemMap ? allButtons.filter(btn => !(btn.id in buttonItemMap)) : allButtons` 는 O(n) 순회다. 버튼 수가 수십 개 이하인 일반적인 UI 시나리오에서는 문제없으나, 이론적으로 많은 버튼이 있을 경우 `Set` 기반 조회가 더 명확하다.
  - 제안: 현재 규모에서는 수용 가능하다. `buttonItemMap` 이 이미 객체(`Record<string, number>`)이므로 `in` 연산자가 O(1)이어서 실제 병목은 없다. 구조 변경 없이 유지해도 된다.

## 요약

이번 변경은 `TemplateContent` 의 early-return 제거와 Template 노드를 공유 `preview + 버튼 바 + Output Data` 합성 경로로 통합하는 리팩토링이다. 성능 관점에서 신규 도입된 심각한 문제는 없다. `sanitizeHtml` / `markdownToHtml` 의 메모이제이션 부재가 반복 렌더 시 미미한 비용 누적 가능성을 갖지만, 현재 컴포넌트 사용 패턴(Run Results Drawer 내 정적 결과 표시)에서는 체감 영향이 없다. 알고리즘 복잡도, N+1 호출, 블로킹 I/O, 지연 로딩 위반 등의 고위험 항목은 발견되지 않았다.

## 위험도

LOW
