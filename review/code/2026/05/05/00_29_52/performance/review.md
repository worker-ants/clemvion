### 발견사항

- **[INFO]** `summarizeToolResult` — 순수 동기 함수, 호출마다 재계산
  - 위치: `conversation-inspector.tsx` L208–242 (`summarizeToolResult`)
  - 상세: `SummaryView` 내부 `items.map()` 루프에서 매 렌더마다 호출됨. 결과가 대형 배열/객체일 경우 `Object.keys()` 비용이 있지만, 최대 1회만 키를 꺼내므로 O(1)에 가깝고 실용적 임팩트는 없음. 단, `String(v).slice(0, 40)` 에서 `String(v)` 가 대형 객체를 stringify할 수 있는데(`v`가 nested object인 경우), 실제 truncate 대상 문자열을 다 만들고 나서 잘라냄. `String(v)` 호출 전에 타입 체크 후 필요하면 `JSON.stringify` 대신 `String(v.constructor.name)` 등으로 대체하거나 길이 가드를 두면 안전함.
  - 제안: 별도 캐싱은 불필요하나, `typeof v === "object" && v !== null` 분기를 추가해 nested object stringify 비용을 방어.

- **[WARNING]** `ragSourceCount` 계산 — `isRag` 여부와 무관하게 매 아이템마다 실행
  - 위치: `conversation-inspector.tsx` L524–526
  ```tsx
  const ragSourceCount = isRag
    ? (item.content.match(/\[Source: /g) ?? []).length
    : 0;
  ```
  - 상세: 이 자체는 단락 처리되어 있으나, 이 계산이 `isTool` early return 이전에 위치함. `isTool` 인 경우 `ragSourceCount`는 사용되지 않음에도 계산 선언이 먼저 나옴. 현재 코드 순서상 JS 엔진은 실제로 삼항연산자 단락 평가(`isRag`가 false → 0 반환)를 하므로 regex는 실행되지 않아 실제 비용은 없음. 그러나 코드 가독성과 의도 명확성을 위해 `isTool` 분기 이후에 배치하는 것이 바람직함.
  - 제안: `ragSourceCount` 선언을 `isTool` early return 아래로 이동하거나, `isRag && item.content.match(...)` 구조로 재작성.

- **[INFO]** `handleKeyDown` 클로저 — 매 렌더마다 새 함수 인스턴스 생성
  - 위치: `conversation-inspector.tsx` — `SummaryView` 내 `items.map()` 블록
  - 상세: `onSelectItem(i)` 를 캡처하는 `handleClick`, `handleKeyDown` 이 각 아이템마다 인라인 클로저로 생성됨. 아이템 수가 수십 개 이하인 UI라면 GC 부담은 미미. 만약 수백 개 이상의 turn이 예상된다면 `useCallback`으로 캡처 후 인덱스를 data attribute로 위임하는 이벤트 위임 패턴이 유효.
  - 제안: 현재 규모(대화 turn 수십 개)에서는 허용 범위. 필요 시 `data-index` + 단일 핸들러로 이벤트 위임 고려.

- **[INFO]** 테스트 파일 — `baseProps` 모듈 수준 상수로 `vi.fn()` 공유
  - 위치: `conversation-inspector.test.tsx` L30–38
  - 상세: `vi.fn()` 인스턴스가 테스트 간 공유됨. `beforeEach`에서 `mockClear()`로 초기화하므로 상태 오염은 방지됨. 그러나 새 테스트가 추가될 때 `mockClear` 호출을 누락하면 이전 테스트의 호출 기록이 남아 `toHaveBeenCalledWith` 등의 단언이 오탐할 수 있음.
  - 제안: `beforeEach` 내에서 `vi.fn()`을 재할당하거나 `vi.clearAllMocks()`를 전역 설정에 추가하여 방어.

### 요약

변경된 코드는 성능 측면에서 전반적으로 양호하다. `summarizeToolResult`는 순수 동기 함수로 입력 크기에 비례하는 O(1)~O(k) 연산이며, `useMemo`로 감싸인 `items` 배열 위에서 동작하므로 불필요한 재계산은 방지된다. 주의할 점은 `String(v)`가 nested object에 대해 암묵적 `.toString()` 호출 → `"[object Object]"` 반환을 하여 truncate 의미가 퇴색할 수 있는 엣지 케이스와, `ragSourceCount` 계산이 `isTool` early return 이전에 선언되어 코드 의도가 불명확해 보이는 점이다. 테스트의 shared `vi.fn()` 패턴은 현재는 안전하나 확장 시 취약해질 수 있다.

### 위험도

**LOW**