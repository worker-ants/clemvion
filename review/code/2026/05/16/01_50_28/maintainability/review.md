# 유지보수성(Maintainability) 리뷰

## 발견사항

### presentation-renderers.tsx

- **[INFO]** `TemplateContent` 함수 내 html/markdown 분기 — 래퍼 div 중복
  - 위치: `TemplateContent` 함수 (라인 1175–1201)
  - 상세: `outputFormat === "html"` 분기와 `outputFormat === "markdown"` 분기, 그리고 기본 text 분기 모두 동일한 `<div className="rounded border border-[hsl(var(--border))] p-3">` 래퍼를 반복한다. 세 분기에서 외부 컨테이너 JSX가 100% 동일하고 내부 콘텐츠만 다르다.
  - 제안: 래퍼를 분기 밖으로 추출하고, 내부 콘텐츠만 분기해 `innerPreview` 변수에 할당한 후 한 번만 반환한다. 또는 `html`과 `markdown`이 같은 `prose` 래퍼를 공유하므로 두 케이스를 하나의 분기로 묶어 `dangerouslySetInnerHTML`에 전달되는 내용만 다르게 처리할 수 있다.

- **[INFO]** `previewHeader` 산출 로직에 노드 타입 하드코딩
  - 위치: `PresentationContent` 함수, `previewHeader` 변수 (라인 1352–1355)
  - 상세: `result.nodeType === "template"` 조건이 switch 문 바로 아래서 다시 등장한다. 로직이 분리되어 있어 향후 노드 타입이 추가될 때 switch 케이스와 이 조건을 각각 수정해야 한다. `previewHeader`가 노드 타입에 따라 달라진다면 switch 케이스 안에서 함께 결정하는 편이 응집도가 높다.
  - 제안: switch 케이스 내에 `previewHeader` 를 함께 결정하거나, 노드별 설정 객체 방식으로 분리한다.

- **[INFO]** `btnConfig` 타입 단언 이중 캐스팅
  - 위치: `PresentationContent` 함수 (라인 1331–1336)
  - 상세: `as Record<string, unknown> | undefined) ?? ...) as Record<string, unknown> | undefined` 처럼 동일 타입으로 이중 단언하고 있다. 중간 타입 단언이 최종 단언과 동일하므로 중복이다.
  - 제안: 중간 단언을 제거하고 최종 단언 하나로 단순화한다.

- **[INFO]** `CarouselContent` 함수의 `items` 타입 표현식 과도한 길이
  - 위치: `CarouselContent` 함수 (라인 993–1000)
  - 상세: `items` 를 구성하는 표현식이 동일한 inline 배열 타입을 세 번 반복(`data.items as ... ?? config?.items as ... ) as ...`)하고 있어 60줄에 걸쳐 펼쳐진다. 리뷰 대상 diff와 직접 관련은 없으나 기존 코드로서 유지보수 시 수정 포인트가 세 군데다.
  - 제안: 공유 타입 alias `CarouselItem`을 파일 상단에 선언하고 세 군데 타입 참조를 교체한다.

- **[WARNING]** `PresentationContent` 함수 길이 및 복합 책임
  - 위치: `PresentationContent` 함수 전체 (라인 1244–1411, ~170줄)
  - 상세: 단일 함수가 (1) 구조화/비구조화 payload 파싱, (2) 인터랙션 언래핑, (3) 노드 타입 라우팅, (4) 버튼 필터링, (5) previewHeader 결정, (6) 전체 JSX 렌더링까지 담당한다. 이번 변경으로 template 케이스가 switch 에 합류하며 책임이 더 명확해진 점은 개선이지만, 함수 전체 복잡도는 여전히 높다.
  - 제안: payload 언래핑(`unwrapPayload`), 버튼 추출(`extractButtons`), 헤더 결정(`resolvePreviewHeader`) 등 보조 함수로 분리해 `PresentationContent` 가 오케스트레이션만 담당하도록 한다.

### presentation-renderers.test.tsx

- **[WARNING]** "Template global buttons" 와 "Carousel global buttons" describe 블록 간 테스트 구조 중복
  - 위치: `describe("Template global buttons")` (라인 505–665) vs. `describe("Carousel global buttons (new NodeHandlerOutput shape)")` (라인 405–503)
  - 상세: 두 describe 블록이 거의 동일한 시나리오 집합을 각각 별도로 구현한다. "renders global buttons from envelope config.buttonConfig", "still renders buttons from legacy flat data.buttonConfig", "highlights selected button on resumed shape" 등 3~4개 it-block 이 페이로드 형태와 nodeType만 다를 뿐 구조가 동일하다. 이번 PR에서 Template 블록이 신규 추가되면서 중복이 가시화됐다.
  - 제안: 공통 버튼 시나리오를 파라미터화한 헬퍼 함수(예: `runButtonSuiteFor(nodeType, payloadBuilder)`)로 묶고, 각 describe 블록은 해당 노드 타입에 고유한 케이스만 추가한다. 단, 테스트 가독성을 해치지 않는 수준에서만 적용한다.

- **[INFO]** `makeResult` 헬퍼와 인라인 outputData 중첩 깊이
  - 위치: 신규 테스트 내 `makeResult(...)` 호출들 (라인 510–533 등)
  - 상세: `config.buttonConfig.buttons[n]` 에 도달하려면 객체 리터럴이 4단계 깊이까지 중첩된다. 각 it-block 마다 동일한 중첩 구조가 반복되어 가독성이 저하된다.
  - 제안: 자주 반복되는 버튼 픽스처를 상수(`APPROVE_BTN`, `REJECT_BTN` 등)로 분리하거나, `makeButtonConfig(buttons)` 팩토리를 두어 중첩을 줄인다.

- **[INFO]** 테스트 이름 일관성 — "invokes onPortButtonClick" / "invokes onLinkButtonClick" 패턴 Carousel 에는 없음
  - 위치: Template describe 블록 (라인 558–612)
  - 상세: Carousel 블록에는 핸들러 호출 검증 it-block이 없는 반면 Template 블록에는 `invokes onPortButtonClick`, `invokes onLinkButtonClick` 케이스가 추가되었다. 이 비대칭이 의도적이라면 주석으로 명시하는 것이 좋다.
  - 제안: 비대칭이 의도적이면 Carousel describe 블록에 `// handler-invocation tests are covered by the global button bar integration tests` 등 한 줄 주석을 추가해 의도를 명시한다.

- **[INFO]** 매직 문자열 `"bg-[hsl(var(--primary))]"` 반복
  - 위치: 테스트 파일 라인 195, 501, 646 / 렌더러 파일 라인 1047, 1379
  - 상세: 버튼 선택 상태를 검증하는 단언에서 동일한 Tailwind 클래스 문자열이 테스트와 소스 코드 양쪽에 분산돼 있다. 클래스명이 변경될 때 모든 위치를 수동으로 찾아야 한다.
  - 제안: 테스트 파일 상단에 `const SELECTED_BTN_CLASS = "bg-[hsl(var(--primary))]"` 상수를 선언하고 세 단언에서 참조한다. 렌더러 쪽은 design token 변수나 `cn()` 유틸로 응집화한다.

---

## 요약

이번 변경은 Template 노드의 early-return을 제거하고 공통 `switch` 흐름에 통합함으로써 중복 렌더링 코드를 제거하고 버튼 바 버그를 수정한 방향 자체는 유지보수성 측면에서 긍정적이다. `TemplateContent`의 책임이 단순화되고 `previewOnly` prop 제거로 API 표면도 줄었다. 다만 `TemplateContent` 세 분기에서 동일 래퍼 div가 반복되고, `PresentationContent` 함수가 여전히 여러 책임을 단일 함수로 보유하는 점이 이 코드베이스의 지속적인 유지보수 부담으로 남는다. 테스트에서는 Carousel/Template 두 describe 블록이 거의 동일한 시나리오를 독립적으로 구현해 향후 유사 노드 추가 시 동일 중복이 세 번째로 발생할 위험이 있다.

## 위험도

LOW
