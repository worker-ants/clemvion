# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `TemplateContent` 시그니처에서 `previewOnly` prop 제거
  - 위치: `presentation-renderers.tsx` — `TemplateContent` 함수 정의부 (diff -686, -690)
  - 상세: `previewOnly?: boolean` 파라미터가 제거되었다. 변경 전에는 `PresentationContent` 가 `<TemplateContent ... previewOnly={previewOnly} />` 로 이 prop을 내려보냈으나, 리팩터링 후 `TemplateContent` 는 더 이상 `previewOnly` 를 받지 않는다. `previewOnly` 로직은 이제 `PresentationContent` 의 공유 경로에서 처리되므로 동일한 가시적 결과를 낸다. `TemplateContent` 는 내부 함수(비공개)이므로 외부 호출자에 대한 breaking change 는 없다. 단, 파일 안에 `TemplateContent` 를 직접 호출하는 다른 위치가 생기면 이 시그니처 변경을 인지해야 한다.
  - 제안: 현재 파일 내부에서만 사용되는 함수이므로 위험도는 낮다. 향후 재사용 시 혼동을 막기 위해 함수 상단 주석으로 "previewOnly 는 PresentationContent 공유 레이어에서 처리됨"을 명시하면 충분하다.

- **[INFO]** `TemplateContent` 의 fallback 동작 변경 — `JsonContent` 렌더링에서 `null` 반환으로 전환
  - 위치: `presentation-renderers.tsx` — `TemplateContent` 내부 (`if (!content) return null`)
  - 상세: 변경 전에는 `rendered` 가 없을 때 `TemplateContent` 가 직접 `<JsonContent data={data} />` 를 렌더링했다. 변경 후에는 `null` 을 반환하고, 상위인 `PresentationContent` 의 공유 "Output Data" 섹션이 `<JsonContent data={data} />` 를 표시한다. 사용자가 보는 최종 HTML 결과는 동일하지 않다 — 이전에는 `TemplateContent` 의 로컬 컨텍스트에서 렌더링되었고, 이제는 공유 레이아웃(`space-y-3` div + "Output Data" 헤더 p 태그)의 일부로 렌더링된다. 레이아웃 구조가 달라지므로, 스냅샷 테스트나 CSS 의존 테스트가 있다면 영향을 받을 수 있다. 테스트 파일의 주석 변경("rendered 가 없으면 TemplateContent 가 JsonContent 로 fallback → null 반환")이 이 의도적 행동 변경을 정확히 서술하고 있다.
  - 제안: 의도된 변경이며 spec(0-common §6.5)과 정합하다. `PresentationContent` 의 `default` switch 브랜치(현재 `return <JsonContent data={data} />`)가 `template` nodeType 에는 도달하지 않음을 확인한다 — switch 에 `case "template":` 가 명시적으로 추가되었으므로 정상이다.

- **[INFO]** `template` nodeType이 `PresentationContent` 내부 early-return 에서 switch 분기로 이동
  - 위치: `presentation-renderers.tsx` — `PresentationContent` 함수 (diff -778~-780, +789~+794)
  - 상세: 이전에는 `template` nodeType에 대해 함수가 조기 반환(early return)했다. 이제는 `switch` 의 한 `case` 로 처리된다. 이 변경으로 `template` nodeType도 하단의 버튼 바 렌더링, `previewHeader` 계산, "Output Data" 섹션을 공유하게 된다. 이 자체는 의도된 부작용이다. 그러나 `previewHeader` 계산식(`result.nodeType === "template"` 조건)이 switch 분기와 중복 로직으로 존재하게 된다 — switch 에서 이미 nodeType을 분기했음에도 이후에 다시 `nodeType === "template"` 를 체크한다. 현재는 문제가 없지만, 향후 다른 nodeType이 포맷 suffix를 원할 경우 이 패턴이 확장되기 어렵다.
  - 제안: `previewHeader` 를 switch 분기 내부에서 설정하거나, 별도 helper map(`nodeType -> headerLabel`)으로 분리하면 switch 이후의 재체크 필요성을 제거할 수 있다. 현재는 INFO 수준.

- **[INFO]** `fireEvent` 가져오기 추가 — 이벤트 발생 테스트 도입
  - 위치: `presentation-renderers.test.tsx` — 1번째 줄 (diff +35)
  - 상세: `fireEvent` 는 `@testing-library/react` 에서 가져오는 테스트 유틸리티이며, DOM 이벤트를 직접 발생시킨다. 프로덕션 코드에는 영향이 없다. 테스트 내에서 `fireEvent.click(...)` 이 `onPortButtonClick` 및 `onLinkButtonClick` 콜백을 올바르게 트리거하는지 검증한다. 부작용 관점에서 이 자체는 문제없다.
  - 제안: 이상 없음.

- **[INFO]** `vi.fn()` 도입으로 모의 함수(mock) 사용 시작
  - 위치: `presentation-renderers.test.tsx` — `invokes onPortButtonClick` 및 `invokes onLinkButtonClick` 테스트 케이스
  - 상세: `vi` 를 import에 추가하고 `vi.fn()` 으로 모의 핸들러를 생성한다. 각 `it` 블록 내부에서 독립적으로 생성되므로 테스트 간 상태 공유가 없다. `afterEach`/`afterAll` 에서의 `vi.clearAllMocks()` 호출이 없으나, `vi.fn()` 이 `it` 스코프 내 지역 변수이므로 정리가 불필요하다. 부작용 없음.
  - 제안: 이상 없음.

- **[INFO]** `renders no button bar when buttonConfig is absent` 테스트의 `nodeType` 미지정
  - 위치: `presentation-renderers.test.tsx` — `Template global buttons` describe 블록 마지막 `it` (라인 198~213)
  - 상세: 이 테스트에서 `makeResult` 에 `nodeType` 을 명시하지 않아 기본값인 `"template"` 이 아닌 `makeResult` 의 기본값(`"template"`)이 쓰인다. `makeResult` 의 기본 `nodeType` 이 `"template"` 이므로 실제로는 template 분기를 타게 된다. `PresentationContent` 의 `switch` 에서 `template` case 가 `TemplateContent` 를 렌더링하는데, `buttonConfig` 가 없으면 버튼 바도 없어야 한다. 테스트 의도는 정확하지만, `nodeType: "template"` 을 명시하지 않은 점이 가독성을 떨어뜨린다.
  - 제안: `makeResult({ nodeType: "template", outputData: { ... } })` 로 명시하면 테스트 의도가 명확해진다.

## 요약

이번 변경은 `TemplateContent` 에서 `previewOnly` prop과 자체 fallback/Output Data 렌더링 책임을 제거하고, `PresentationContent` 의 공유 경로(버튼 바, Output Data 섹션, previewHeader)를 Template nodeType도 사용하도록 통합하는 리팩터링이다. 부작용 관점에서 전역 변수, 파일시스템, 환경 변수, 네트워크, 외부 이벤트 등 외부 상태에 대한 의도치 않은 부작용은 발견되지 않았다. 유일하게 주목할 부작용은 `rendered` 누락 시 `TemplateContent` 가 `JsonContent` 를 직접 렌더링하던 것에서 `null` 반환으로 바뀐 점인데, 이는 레이아웃 구조 변경(공유 "Output Data" 섹션으로 위임)을 수반하며 의도된 변경이다. 공개 API(`PresentationContent` 의 props)는 변경이 없고, 내부 함수(`TemplateContent`)의 시그니처 변경은 파일 내 호출처를 모두 업데이트했으므로 breaking change가 아니다. `switch` 이후 `previewHeader` 에서 nodeType을 재체크하는 중복 패턴은 확장성 면에서 INFO 수준의 개선 여지가 있다.

## 위험도

LOW
