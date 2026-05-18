# 아키텍처(Architecture) 리뷰 결과

## 발견사항

---

### [WARNING] 렌더링 로직 중복 — SummaryView 인라인 블록과 PresentationDetail 컴포넌트의 이중화

- **위치**: `conversation-inspector.tsx` — `SummaryView` 내 `isPresentation` 분기 블록(약 363~394행)과 `PresentationDetail` 함수 컴포넌트(약 282~307행)
- **상세**: `interactionType` 레이블 키 선택 로직(`editor.conversation.cardButtonClicked` / `cardFormSubmitted` / `cardLinkContinue`)과 헤더 레이아웃(아이콘 🧩, nodeLabel chip, interaction label, 타임스탬프)이 두 곳에 완전히 동일하게 구현되어 있다. `PresentationCardBody`는 재사용되고 있지만 헤더 구성 부분이 각각 별도로 작성되어 있어 단일 책임(SRP)과 DRY 원칙을 동시에 위반한다. `SummaryView`의 목록 아이템 렌더러가 `PresentationDetail`을 통해 렌더하지 않고 직접 인라인으로 마크업을 조립하고 있는 것이 근본 원인이다.
- **제안**: `PresentationSummaryCard` 같은 단일 컴포넌트로 헤더+바디 조합을 완전 통합하고, `SummaryView`의 목록 아이템 렌더러에서 이 컴포넌트를 호출하도록 리팩터링. `SelectedItemDetail`의 `PresentationDetail`도 동일 컴포넌트를 재사용하게 구성하면 향후 헤더 UI 변경이 한 곳에서만 발생한다.

---

### [WARNING] 타입 확장이 단일 인터페이스를 비대화 — ConversationItem의 개방-폐쇄 위반

- **위치**: `execution-store.ts` — `ConversationItem` 인터페이스
- **상세**: 기존 `type: "user" | "assistant" | "tool"` 유니언에 `"presentation" | "system"` 이 추가되고, `presentation?: {...}` 옵셔널 필드가 인라인으로 삽입되었다. 이 패턴은 새 소스 타입이 생길 때마다 인터페이스 본문을 직접 수정해야 하는 개방-폐쇄 위반 구조다. 또한 `type: "system"` 아이템은 `presentation` 필드가 전혀 의미 없지만 타입 상 접근 가능하여 타입 안전성이 낮다. `toolArgs?: unknown`과 `assistantToolCalls?`도 `tool` / `assistant` 타입에만 의미 있는 필드가 같은 인터페이스에 혼재해 있어 동일한 문제가 이미 존재했고, 이번 변경이 그 패턴을 반복·확장한다.
- **제안**: Discriminated Union으로 전환. `BaseConversationItem`에 공통 필드(content, turnIndex, timestamp, isInjected)를 두고, `UserItem`, `AssistantItem`, `ToolItem`, `PresentationItem`, `SystemItem` 각 타입이 확장하도록 분리. `PresentationItem`만 `presentation` 필드를 갖도록 하면 타입 내로잉이 자동으로 동작해 렌더러 코드의 타입 캐스팅 불필요.

---

### [WARNING] 레이어 경계 침투 — presentation 레이어(컴포넌트)에서 비즈니스 로직(interactionType 추론) 중복 실행

- **위치**: `conversation-inspector.tsx` — `SummaryView` 내 `isPresentation` 분기 블록(약 364~370행)에서 `interactionType` → i18n 키 매핑 로직 재작성
- **상세**: `interactionType`을 레이블 키로 매핑하는 삼항 체인이 `PresentationDetail` 컴포넌트(약 285~290행)와 `SummaryView` 인라인 블록(약 364~370행) 두 곳에 각각 존재한다. 이 매핑 로직은 비즈니스 규칙(어떤 interactionType이 어떤 라벨에 해당하는가)에 해당하며, 프레젠테이션 레이어 두 곳에 중복 박히면 향후 새 interactionType 추가 시 두 곳을 함께 수정해야 한다는 암묵적 결합이 생긴다.
- **제안**: `interactionTypeToI18nKey(type)` 헬퍼 함수로 단순 추출하거나, 위 WARNING의 컴포넌트 통합 해결 시 자연스럽게 제거됨.

---

### [WARNING] 데이터 변환 레이어에서의 휴리스틱 추론 — 단일 책임 경계의 불명확성

- **위치**: `conversation-utils.ts` — `threadTurnsToConversationItems` 내 `presentation_user` case(약 769~781행)
- **상세**: `interactionType`이 백엔드 wire format(`ConversationTurn`)에 직접 포함되지 않아 프론트엔드 변환 레이어가 `data` 형태를 검사하여 `"button_click" | "button_continue" | "form_submitted"`를 추론한다. 이 추론 규칙(`url in data && buttonId in data → button_continue`, `buttonId in data → button_click`, else → form_submitted`)은 `spec/conventions/node-output.md §4.5`에 근거하지만, 이 비즈니스 지식이 데이터 변환 유틸리티에 박혀 있다. 백엔드가 향후 `interactionType` 필드를 직접 전송하도록 변경되면 이 추론 코드는 silent bug 유발 가능성이 있다(추론이 전송된 타입보다 우선되므로).
- **제안**: `ConversationTurn`에 `interactionType?: string` 옵셔널 필드를 추가하고, 해당 필드가 있으면 사용하고 없을 때만 fallback 추론을 수행하도록 작성. 그리고 추론 로직을 `inferInteractionType(data)` 같은 별도 함수로 분리하여 테스트 용이성 확보.

---

### [INFO] stripInlineMarkers 적용 위치의 분산 — 단일 책임 경계 모호

- **위치**: `conversation-utils.ts`(`threadTurnsToConversationItems`·`messagesToConversationItems` 양쪽), `conversation-inspector.tsx`(`SummaryView` 내 직접 호출)
- **상세**: `stripInlineMarkers`는 세 가지 경로에서 각각 호출된다: (1) `threadTurnsToConversationItems` 내부에서 각 turn.text에 적용, (2) `messagesToConversationItems` 내부에서 각 msg.content에 적용, (3) `SummaryView` 컴포넌트의 item 조립 단계에서 직접 호출. 경로 (3)은 변환 함수가 이미 strip한 결과를 받아야 하는 상황에서 컴포넌트 레이어가 다시 strip을 수행하는 구조다. 만약 변환 함수들이 항상 strip 보장을 제공한다면 (3)은 중복이고, 제공하지 않는다면 컴포넌트 레이어에 데이터 정제 책임이 흘러들어 온 것이다.
- **제안**: strip 책임을 데이터 변환 레이어(`conversation-utils.ts` 두 함수)에 완전 귀속시키고, 컴포넌트 레이어에서의 직접 `stripInlineMarkers` 호출을 제거. 두 변환 함수의 JSDoc에 "반환되는 content는 이미 strip된 상태" 계약을 명시.

---

### [INFO] fallback 경로의 중복 체크 조건 — 방어적 코딩과 중복 발생

- **위치**: `use-execution-events.ts` — `threadTurns && threadTurns.length > 0` 조건과 이어지는 `if (items.length > 0)` 내부 중첩(약 1001~1005행)
- **상세**: `threadTurns`가 빈 배열이 아닌 상태에서 `threadTurnsToConversationItems`를 호출하고, 그 결과가 다시 빈 배열인지 재확인한다. `threadTurnsToConversationItems`는 이미 빈 배열에 대해 `[]`를 반환하고, 필터링 단계가 없으므로 입력이 비어있지 않으면 출력도 반드시 비어있지 않다. 이중 체크는 코드 의도를 흐리는 defensive programming 과잉이다.
- **제안**: 외부 `threadTurns.length > 0` 가드 하나만 유지하고 내부 `items.length > 0` 체크 제거. 또는 `threadTurnsToConversationItems` 반환값만 체크하는 단일 조건으로 단순화.

---

### [INFO] 모듈 경계 — ConversationTurn 타입이 유틸 레이어에 정의되어 스토어 타입과 분리

- **위치**: `conversation-utils.ts`에 `ConversationTurn` / `ConversationTurnSource` 타입 정의, `execution-store.ts`에 `ConversationItem` 정의
- **상세**: 와이어 포맷 타입(`ConversationTurn`)이 변환 유틸리티 파일에 정의되어 있고, 스토어 도메인 타입(`ConversationItem`)은 스토어 파일에 정의되어 있다. 현재는 모듈 간 명시적 순환 참조는 없으나, 와이어 타입이 유틸 레이어에서 export되어 `use-execution-events.ts`와 `conversation-inspector.tsx`가 모두 import한다. 향후 백엔드 타입 동기화 레이어(예: 공유 패키지 또는 auto-generated types)가 도입될 때 마이그레이션 경로가 복잡해질 수 있다.
- **제안**: `ConversationTurn` / `ConversationTurnSource`를 `execution-store.ts` 또는 별도 `conversation-types.ts` 타입 전용 모듈로 이동해, 변환 로직(함수)과 도메인 타입(인터페이스) 관심사를 파일 수준에서 분리. 단기적으로는 현행 구조도 허용 가능한 범위.

---

## 요약

이번 변경은 `ConversationTurn` 소스 타입에 따른 시각적 분기 렌더링을 프론트엔드에 도입하는 것으로, 데이터 변환 레이어(`conversation-utils.ts`)와 렌더 레이어(`conversation-inspector.tsx`) 간 역할 분리의 방향성은 올바르다. `stripInlineMarkers`를 유틸 레이어에 두고 `threadTurnsToConversationItems`라는 단일 변환 함수로 wire format을 UI 모델로 전환하는 접근 또한 적절하다. 다만 동일한 presentation 카드 헤더 조립 로직이 `PresentationDetail` 컴포넌트와 `SummaryView` 인라인 블록에 이중으로 존재하는 중복이 가장 큰 구조적 문제이며, 이는 단일 책임 및 개방-폐쇄 원칙 위반으로 향후 interactionType 추가나 헤더 UI 변경 시 두 군데를 함께 수정해야 하는 유지보수 부담을 만든다. `ConversationItem` 인터페이스를 Discriminated Union으로 전환하지 않고 옵셔널 필드를 계속 추가하는 방식은 타입 안전성을 저해하는 누적 기술부채다. 레이어 구조와 모듈 경계는 전반적으로 수용 가능한 수준이며 순환 의존성은 발견되지 않았다.

## 위험도

MEDIUM
