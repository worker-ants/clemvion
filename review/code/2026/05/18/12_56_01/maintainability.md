# 유지보수성(Maintainability) 리뷰

## 발견사항

### conversation-inspector.tsx

- **[WARNING]** `PresentationDetail`과 `SummaryView` 내 인라인 presentation 블록에서 `interactionLabelKey` 결정 로직 중복
  - 위치: `PresentationDetail` 함수(~line 285-290), `SummaryView` 내 `isPresentation` 블록(~line 363-370)
  - 상세: `interactionType`을 `interactionLabelKey`로 변환하는 삼항 체인이 두 곳에 동일하게 존재한다. 컴포넌트 분리가 이루어졌음에도(`PresentationCardBody`, `PresentationDetail`) `SummaryView`의 리스트 렌더 경로에는 같은 로직이 인라인으로 재구현되어 있다.
  - 제안: `interactionLabelKey`를 반환하는 순수 헬퍼 함수(`getInteractionLabelKey(interactionType)`)를 추출해 두 곳 모두에서 재사용한다.

- **[WARNING]** `PresentationDetail`과 `SystemDetail`의 헤더 블록(아이콘 + 라벨 + 타임스탬프) 구조가 사실상 동일
  - 위치: `PresentationDetail`(~line 291-306), `SystemDetail`(~line 309-330)
  - 상세: 두 컴포넌트 모두 `flex items-center gap-2`의 헤더 div 안에 아이콘, 라벨 span, 조건부 타임스탬프 span을 배치하는 패턴이 반복된다. JSX 구조와 className이 거의 동일하다.
  - 제안: `CardHeader({ icon, label, timestamp })` 같은 공용 내부 컴포넌트로 추출한다.

- **[WARNING]** `SummaryView` 내 `isPresentation` 블록이 독립적인 컴포넌트(`PresentationDetail`)를 두고도 유사한 JSX를 인라인으로 재구현
  - 위치: `SummaryView` 내 `if (isPresentation)` 반환 블록(~line 363-394)
  - 상세: 리스트 아이템 클릭 인터랙션(role, tabIndex, onClick, onKeyDown)과 스타일링 래퍼를 제외한 내부 구조가 `PresentationDetail`과 의미적으로 겹친다. 두 경로가 동기화 없이 분기되면 향후 스펙 변경 시 한쪽만 수정될 위험이 있다.
  - 제안: 리스트 아이템 래퍼(클릭·포커스 처리)와 내부 카드 콘텐츠를 분리하고, 내부 콘텐츠는 `PresentationDetail`이나 공용 컴포넌트를 재사용한다.

- **[INFO]** 하드코딩된 폰트 크기 `text-[11px]`, `text-[10px]`가 여러 곳에 산재
  - 위치: `PresentationCardBody`의 `button_continue` 분기(~line 247), `PresentationDetail` 타임스탬프 span, `SystemDetail` 타임스탬프 span, `SummaryView` 내 system note div
  - 상세: Tailwind의 임의값 클래스(`text-[10px]`, `text-[11px]`)가 반복적으로 등장한다. 프로젝트에 정의된 디자인 토큰이나 Tailwind 설정 값이 있다면 이를 활용하지 않고 픽셀을 직접 기입하고 있다.
  - 제안: `theme.extend.fontSize`에 의미 있는 이름(예: `xs-tight`, `timestamp`)으로 등록하거나, 공통 className 상수로 추출한다.

- **[INFO]** 매직 리터럴 이모지 `🧩`가 두 곳에 하드코딩
  - 위치: `PresentationDetail`(~line 296), `SummaryView` 내 `isPresentation` 블록(~line 385)
  - 상세: 이모지 자체가 프레젠테이션 source의 시각 신호로 스펙에 정의되어 있지만, 상수화 없이 문자열 리터럴로 중복 등장한다.
  - 제안: `const PRESENTATION_ICON = "🧩"` 상수로 추출한다.

---

### conversation-utils.ts

- **[WARNING]** `threadTurnsToConversationItems` 내 `turn0` 변수명이 의도를 숨김
  - 위치: `ai_assistant` 케이스(~line 738), `ai_tool` 케이스(~line 754)
  - 상세: `const turn0 = turnIndex || 1;` 에서 `turn0`이라는 이름은 "턴 인덱스가 아직 0이면 1을 쓴다"는 폴백 의도를 전달하지 못한다. `effectiveTurnIndex` 또는 `currentTurnIndex`처럼 의미를 드러내는 이름이 적합하다.
  - 제안: `const effectiveTurnIndex = turnIndex || 1;`로 변경한다.

- **[WARNING]** `presentation_user` 케이스에서 `data` 타입 단언이 중복
  - 위치: `presentation_user` 케이스(~line 770)
  - 상세: `ConversationTurn.data`는 이미 `Record<string, unknown> | undefined`로 선언되어 있는데, `const data = turn.data as Record<string, unknown> | undefined;`로 동일 타입을 다시 단언하고 있다. 단언이 필요한 이유가 없으며 독자에게 혼선을 준다.
  - 제안: 단언 없이 `const data = turn.data;`로 사용한다.

- **[WARNING]** `interactionType` 추론 조건에서 `data && typeof data === "object"` 가드가 중복
  - 위치: `presentation_user` 케이스 `interactionType` 결정부(~line 776-781)
  - 상세: 두 삼항 조건 모두 `data && typeof data === "object"`를 앞에 붙이고 있다. `data`의 타입이 이미 `Record<string, unknown> | undefined`이므로 `"url" in data`와 `"buttonId" in data`를 직접 검사하면 충분하다(`data`의 truthiness만 체크하면 됨).
  - 제안:
    ```ts
    const interactionType =
      data && "url" in data && "buttonId" in data
        ? "button_continue"
        : data && "buttonId" in data
          ? "button_click"
          : "form_submitted";
    ```

- **[INFO]** `ai_tool` 케이스에서 `content`와 `toolResult` 모두 `turn.text`로 초기화
  - 위치: `ai_tool` 케이스(~line 754-765)
  - 상세: `content: turn.text || ""`와 `toolResult: tryParseJson(turn.text ?? "")`가 같은 소스를 다른 형태로 담고 있다. 주석이 이 이중 할당을 설명하지만, 향후 `content`와 `toolResult`의 소스가 분기될 때 한쪽만 수정될 수 있다. 주석의 설명이 충분히 상세하지 않다.
  - 제안: 주석에 "content는 렌더러가 이름 조회 후 덮어쓸 플레이스홀더, toolResult는 파싱 결과"라는 역할 분리를 명확히 기재한다.

---

### conversation-inspector.test.tsx (테스트)

- **[INFO]** 테스트 케이스 제목이 구현 세부 사항(이모지 `🧩`, 한국어 레이블)을 단언 대상으로 직접 기술
  - 위치: `ConversationInspector SummaryView — source 별 시각 분기 (§9.1)` describe 블록 전반
  - 상세: 테스트 코드 자체는 적절하나, 제목 문자열에 UI 세부 표현(`🧩`, `회색 시스템 카드`, `버튼 클릭`)이 포함되어 UI가 바뀌면 제목도 함께 수정해야 한다. 제목은 의도(behavior)를 기술하고 세부 표현은 assertion에 위임하는 것이 바람직하다.
  - 제안: 제목을 `"presentation_user (button_click) renders as system card with nodeLabel chip"` 수준의 행위 중심 기술로 정리한다.

- **[INFO]** `makeItem`에 `presentation` 필드가 없는 경우와 있는 경우 팩토리 오버로드가 없어 각 테스트마다 전체 `presentation` 객체를 인라인 반복
  - 위치: 각 `it` 블록 내 `ConversationItem[]` 구성부
  - 상세: `presentation` 메타 구조가 4개 테스트 케이스에 걸쳐 반복된다. 공통 `makePresentationItem(partial)` 헬퍼가 있으면 변경 시 한 곳만 수정하면 된다.
  - 제안: `makePresentationItem({ interactionType, data, nodeLabel, ... })` 테스트 헬퍼를 추가한다.

---

### use-execution-events.ts

- **[WARNING]** `threadTurns` 존재 여부 체크와 `items.length > 0` 이중 가드가 불필요한 복잡도 유발
  - 위치: ~line 1001-1005
  - 상세: `threadTurnsToConversationItems`는 이미 빈 배열을 반환하면 그 자체가 의미 없으므로, `items.length > 0` 조건은 `threadTurnsToConversationItems` 내부에서 이미 처리된다. 외부에서 한 번 더 체크하면 `threadTurns && threadTurns.length > 0`이라는 앞선 가드와 의미가 겹친다.
  - 제안: `if (threadTurns?.length)` 하나의 조건으로 단순화하고 내부 `items.length` 체크는 제거한다.

---

### 전체 공통

- **[INFO]** `hsl(var(--...))` CSS 변수 참조가 className에 반복적으로 하드코딩
  - 위치: `PresentationCardBody`, `PresentationDetail`, `SystemDetail`, `SummaryView` 내 신규 블록 전반
  - 상세: `text-[hsl(var(--foreground))]`, `text-[hsl(var(--muted-foreground))]` 등이 7회 이상 반복된다. 기존 코드베이스에 `cn()` 유틸리티와 Tailwind 테마 확장이 있다면 이 패턴은 의미 있는 클래스 이름으로 추상화하는 것이 일관성 측면에서 바람직하다. 단, 프로젝트 전반의 기존 컴포넌트들도 같은 패턴을 사용 중이라면 일관성 위반은 아니다.
  - 제안: 기존 코드베이스 패턴을 먼저 확인하고, 전반적으로 임의값 CSS 변수 참조가 지배적이라면 현상 유지도 무방하다.

---

## 요약

이번 변경은 `ConversationTurn` 기반의 새로운 데이터 소스 경로와 `presentation`/`system` 두 가지 렌더 형식을 도입하는 작업이다. 전체적으로 타입 정의, 변환 로직, 렌더 컴포넌트, 테스트가 일관된 방향으로 구성되어 있고 스펙 참조도 명시적이다. 다만 `interactionLabelKey` 결정 로직이 `PresentationDetail`과 `SummaryView`에 중복 구현되어 있는 점이 가장 큰 유지보수 위험으로, 향후 인터랙션 종류가 추가되면 두 곳을 모두 수정해야 한다는 사실을 인지하기 어렵다. 그 외에 `turn0`이라는 불명확한 변수명, 불필요한 타입 단언, `threadTurns` 이중 가드 등 소규모 가독성 이슈들이 산재하며, 이모지와 픽셀 크기 리터럴의 상수화 미비가 향후 디자인 변경 시 산탄총 수술(shotgun surgery)을 유발할 수 있다. 전체 위험도는 중간 수준이며, 중복 로직 추출과 변수 명명 개선을 우선 조치로 권장한다.

## 위험도

MEDIUM
