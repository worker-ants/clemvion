# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** 테스트 존재 여부 — 6개 신규 케이스 추가, TDD 절차 이행 확인
  - 위치: `presentation-renderers.test.tsx`, `describe("Template global buttons")` 블록
  - 상세: plan/in-progress 문서에 명시된 "(TDD) 실패하는 테스트 추가" 항목이 충실히 이행되었다. envelope 형식, legacy flat 형식, port 클릭, link 클릭, resume 시 highlight, buttonConfig 부재 6가지 경로를 각각 독립 케이스로 분리했다. Carousel 동일 패턴과 대칭적으로 구성되어 일관성도 높다.

- **[WARNING]** 커버리지 갭 — `previewHeader` 분기 중 `previewOnly=true` 경로 미검증
  - 위치: `presentation-renderers.tsx`, `previewHeader` 계산부 및 `!previewOnly &&` 조건
  - 상세: 신규 로직에서 `result.nodeType === "template"` 일 때 `previewHeader`를 `Preview (html|markdown|text)` 형태로 생성한다. 그런데 `previewOnly=true` 상태에서 Template 노드의 전체 렌더 경로(preview 헤더 숨김 + 버튼 바 노출 여부)를 검증하는 테스트가 없다. `PresentationContent`의 `previewOnly` prop 은 외부에서 주입되므로 해당 조합을 커버하지 않으면 UI 회귀가 눈에 띄지 않을 수 있다.
  - 제안: `previewOnly=true` 를 prop으로 전달하는 케이스를 "Template global buttons" describe 내부에 추가. 헤더(`Preview (...)` 문자열)가 DOM 에 나타나지 않아야 하고, 버튼 바는 여전히 렌더되어야 한다는 점을 검증한다.

- **[WARNING]** 커버리지 갭 — `buttonItemMap` 필터링 로직 Template 경로 미검증
  - 위치: `presentation-renderers.tsx` 내 `buttons` 계산 (`buttonItemMap` 분기)
  - 상세: `btnConfig.buttonItemMap` 이 존재할 때 글로벌 버튼 목록에서 item-level 버튼 ID를 제외하는 로직이 있다. Carousel 테스트에는 이 경로를 명시적으로 다루는 케이스가 없으며(기존 코드 포함), Template 신규 테스트에도 없다. 해당 로직은 공유 경로에서 처리되므로 Template 케이스에서 이를 검증하는 테스트가 자연스럽게 추가되어야 한다.
  - 제안: `buttonConfig: { buttons: [...], buttonItemMap: { "item-btn": 0 } }` 형태의 입력으로 item-level 버튼이 글로벌 버튼 바에 나타나지 않음을 확인하는 케이스를 추가한다.

- **[WARNING]** 엣지 케이스 — `onPortButtonClick` 미전달 시 port 버튼 비활성화 여부 미검증
  - 위치: `describe("Template global buttons")` 내부
  - 상세: `isInteractive = !!(onPortButtonClick || onLinkButtonClick)` 가 `false` 일 때 버튼은 `disabled` 속성을 갖고 클릭 핸들러가 호출되지 않아야 한다. 현재 "renders no button bar when buttonConfig is absent" 케이스는 핸들러를 전달하지 않지만 버튼 자체가 없는 케이스라 이 경로를 우회한다. 핸들러 없이 버튼이 있는 경우(read-only 뷰) 는 다루지 않는다.
  - 제안: 핸들러를 전달하지 않고 `buttonConfig`가 있는 케이스를 추가해 버튼이 `disabled` 상태인지, 클릭 시 콜백이 호출되지 않는지 검증한다.

- **[INFO]** Mock 적절성 — `vi.fn()` 사용이 적절하며 실제 동작과의 괴리 없음
  - 위치: "invokes onPortButtonClick" / "invokes onLinkButtonClick" 케이스
  - 상세: `vi.fn()`으로 mock 핸들러를 만들고 `fireEvent.click` 후 `toHaveBeenCalledWith` 로 인자를 검증하는 패턴이 바르게 사용되었다. 실제 DOM 이벤트를 발생시켜 컴포넌트 내부 `onClick` 로직을 통과하므로 mock 이 실제 동작을 정확히 대변한다.

- **[INFO]** 테스트 격리 — 각 케이스가 독립 렌더를 사용하며 공유 상태 없음
  - 위치: 테스트 파일 전체
  - 상세: `makeResult()` 헬퍼가 순수 함수로 default 값을 내려주고 각 테스트가 독립적으로 `render()` 를 호출한다. `@testing-library/react` 는 기본적으로 각 테스트 후 cleanup 을 수행하므로 DOM 잔류로 인한 test 간 간섭 위험이 없다.

- **[INFO]** 테스트 가독성 — 의도 표현이 명확하나 일부 assertion 방식 개선 여지
  - 위치: `expect(screen.getByText("Approve")).toBeDefined()` 패턴 (여러 케이스)
  - 상세: `getByText()` 는 요소를 찾지 못하면 예외를 던지므로 `.toBeDefined()` 는 항상 통과한다. 렌더 여부 확인이 목적이라면 `toBeDefined()` 가 의미론적으로는 무해하지만, `expect(element).not.toBeNull()` 또는 단순히 `screen.getByText(...)` 호출(throw-on-fail 활용) 이 더 명시적이다. 이는 기존 테스트에서도 같은 패턴을 써 왔으므로 일관성 차원에서는 문제 없다.
  - 제안: 단순 렌더 확인은 `screen.getByText(...)` 호출 자체로 assertion 을 대체하거나, `toBeInTheDocument()` (jest-dom matcher) 를 도입해 의도를 명확히 한다. 단, 프로젝트가 `@testing-library/jest-dom` 을 사용하지 않는다면 현재 패턴을 유지.

- **[INFO]** 회귀 테스트 — 기존 Template 케이스 전원 유효성 유지
  - 위치: `describe("TemplateContent")` 내 기존 5개 케이스
  - 상세: `TemplateContent` 내부에서 `previewOnly` 분기 및 자체 "Output Data" 섹션이 제거되었으나, 공유 경로의 `!previewOnly` 블록에서 "Output Data" 섹션이 동일하게 출력된다. 기존 "shows Output Data section with raw JSON" 케이스는 이 변경 후에도 `screen.getByText("Output Data")` 와 `screen.getByText(/"rendered": "Hello"/)` 가 공유 경로의 `JsonContent` 를 통해 통과할 것이다. "falls back to JsonContent when rendered is missing" 케이스의 주석도 새 동작("null 반환 → 공유 Output Data 섹션만 표시")으로 갱신되어 회귀 위험을 문서화했다.

- **[INFO]** 테스트 용이성 — `PresentationContent` 의 의존성 주입 구조가 테스트를 용이하게 함
  - 위치: `PresentationContent` 컴포넌트 prop 설계
  - 상세: `onPortButtonClick`, `onLinkButtonClick` 을 prop 으로 주입받는 구조이므로 mock 교체가 자연스럽다. 렌더러 내부에서 직접 라우터나 전역 상태를 소비하지 않아 테스트 환경에서 추가 setup 이 불필요하다.

---

## 요약

이번 변경은 Template 노드의 글로벌 버튼 바 미표시 버그를 수정하면서 TDD 접근에 따라 6개의 신규 테스트 케이스를 충실히 추가했다. envelope/legacy 데이터 형식, 이벤트 핸들러 위임, resume 시 선택 버튼 highlight, 버튼 없는 폴백 경로를 모두 커버하는 점은 긍정적이다. 다만 `previewOnly=true` 상태의 Template + 버튼 조합, `buttonItemMap` 필터링 경로, 핸들러 미전달 시 비활성화 동작이 미검증 상태로 남아 있어 향후 회귀 발생 가능성이 있다. 구조적으로는 의존성 주입이 일관되게 적용되어 테스트 용이성이 높으며, 각 케이스가 독립적으로 실행 가능해 격리 원칙도 잘 지켜졌다.

## 위험도

LOW
