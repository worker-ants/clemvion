## 발견사항

---

### [WARNING] `isError` 분기가 `portColor`와 동일한 결과를 반환 — 불필요한 분기
- **위치**: `custom-edge.tsx` `edgeStroke` 계산부
- **상세**: `portType === "error"`이면 `portColor`는 이미 `PORT_TYPE_COLORS.error`와 동일합니다. `isError` 분기를 거쳐도 `portColor`와 같은 값이 반환되므로 분기 자체가 무의미합니다.
  ```typescript
  const edgeStroke = isHighlighted
    ? portColor
    : isError                      // portColor === PORT_TYPE_COLORS.error로 동일
      ? PORT_TYPE_COLORS.error
      : props.selected
        ? "hsl(var(--primary))"
        : portColor;
  ```
- **제안**: `isError` 분기를 제거하고 아래처럼 단순화하세요.
  ```typescript
  const edgeStroke = isHighlighted || !props.selected ? portColor : "hsl(var(--primary))";
  ```

---

### [WARNING] "bright" 마커가 일반 마커와 색상이 동일 — 명칭과 구현 불일치
- **위치**: `custom-edge.tsx` `EdgeMarkerDefs`
- **상세**: `arrow-data-bright`, `arrow-system-bright` 등 8개의 `-bright` 마커가 `PORT_TYPE_COLORS`의 동일한 값을 사용합니다. 이름이 시각적 차이를 암시하지만 실제로는 중복 정의입니다. 미래 유지보수자가 "bright" 마커를 수정할 때 혼란을 유발합니다.
- **제안**: bright/normal 구분을 제거하고 `markerId`를 단일 `` `arrow-${portType}` ``으로 통일하거나, 실제로 밝기가 다른 색상을 적용하세요.

---

### [WARNING] `getMarkerIdForPortType` 함수가 프로덕션 코드에서 미사용
- **위치**: `edge-utils.ts:57-65`
- **상세**: `export`되고 테스트까지 작성된 함수이지만, `custom-edge.tsx`에서는 `` `arrow-${portType}` `` 템플릿 리터럴로 마커 ID를 직접 구성합니다. 이 함수는 사실상 dead export입니다. 함수가 존재하면 다음 개발자는 "어딘가에서 쓰이고 있다"고 오해하게 됩니다.
- **제안**: `custom-edge.tsx`에서 이 함수를 사용하도록 리팩토링하거나, 사용하지 않으면 제거하세요.

---

### [WARNING] `className` 문자열 조작이 취약
- **위치**: `use-edge-highlighting.ts:44,51`
- **상세**: `.replace("edge-highlighted", "").trim()`으로 클래스를 제거하는 방식은 `edge-highlighted-extra`처럼 다른 클래스에 해당 문자열이 포함된 경우 의도치 않게 일부를 제거할 수 있고, 공백 처리도 취약합니다.
  ```typescript
  const existing = edge.className?.replace("edge-highlighted", "").trim() ?? "";
  ```
- **제안**: `Set<string>` 기반으로 클래스를 관리하거나 `clsx`/`classnames`를 활용하세요.
  ```typescript
  const classes = new Set((edge.className ?? "").split(" ").filter(Boolean));
  classes.delete("edge-highlighted");
  return [...classes].join(" ") || undefined;
  ```

---

### [WARNING] `switch`문과 `Record` 패턴이 동일 파일 내에서 혼용
- **위치**: `edge-utils.ts:12-16` (PORT_TYPE_COLORS) vs `edge-utils.ts:57-65` (getMarkerIdForPortType)
- **상세**: `PORT_TYPE_COLORS`는 `Record<EdgePortType, string>` 객체 패턴을 사용하는데, 바로 아래의 `getMarkerIdForPortType`은 `switch`문을 사용합니다. 동일한 목적(타입 → 값 매핑)에 두 가지 패턴이 혼재하여 일관성이 없습니다.
- **제안**: `Record` 패턴으로 통일하세요.
  ```typescript
  const MARKER_IDS: Record<EdgePortType, string> = {
    data: "arrow-data",
    system: "arrow-system",
    error: "arrow-error",
    container: "arrow-container",
  };
  export function getMarkerIdForPortType(portType: EdgePortType): string {
    return MARKER_IDS[portType];
  }
  ```

---

### [WARNING] 매직 넘버가 CSS와 TSX 전반에 분산
- **위치**: `globals.css:73,85`, `custom-edge.tsx:50,51`
- **상세**: `0.12`(dimmed opacity), `150ms`(transition), `8 4`(stroke-dasharray), `2.5`/`1.5`(stroke width), `0.6s`(animation duration) 등이 설명 없이 하드코딩되어 있습니다. 특히 `0.12`는 의미가 불명확하고 CSS 여러 곳에서 반복됩니다.
- **제안**: CSS에서는 CSS 변수로, TSX에서는 상수로 추출하세요.
  ```css
  :root { --edge-dim-opacity: 0.12; --edge-transition: 150ms ease; }
  ```
  ```typescript
  const STROKE_WIDTH = { normal: 1.5, highlighted: 2.5 } as const;
  ```

---

### [WARNING] `resolvePortType`이 `ai_agent` 노드 타입을 하드코딩
- **위치**: `edge-utils.ts:35-44`
- **상세**: 새 노드 타입이 추가될 때마다 이 함수를 수정해야 하는 구조입니다. 노드 정의(`node-definitions`)에 포트 타입 정보가 이미 있음에도 `ai_agent`만 인라인 분기로 처리됩니다. 유지보수 포인트가 두 곳으로 분산됩니다.
- **제안**: `NodeDefinition`의 `outputs`에 `portType: EdgePortType` 필드를 추가하고 `resolvePortType`이 정의에서 읽도록 통일하세요.

---

### [INFO] `isFocusActive`가 `enhancedEdges` `useMemo` 의존성에 중복 포함
- **위치**: `use-edge-highlighting.ts:38`
- **상세**: `isFocusActive`는 `highlightedEdgeIds`에서 파생된 값입니다. 두 값이 항상 동시에 변경되므로 deps 배열 `[edges, highlightedEdgeIds, isFocusActive]`에 둘 다 포함하는 것은 의존성 추적 측면에서 중복입니다.
- **제안**: `isFocusActive`를 deps에서 제거하고 `!highlightedEdgeIds`로 조기 반환 조건을 처리하세요.

---

### [INFO] Legacy 마커(`arrow`, `arrow-selected`) 사용처 미확인 상태로 잔존
- **위치**: `custom-edge.tsx` `EdgeMarkerDefs`
- **상세**: 주석에 "backward compatibility"라고 명시되어 있으나, 현재 코드베이스에서 `#arrow`, `#arrow-selected`를 참조하는 코드가 없다면 dead code입니다.
- **제안**: 코드베이스 전체 grep으로 사용처를 확인하고, 없다면 제거하세요.

---

### [INFO] `buildEdgeData` 반환 타입이 `Record<string, unknown>`으로 느슨
- **위치**: `edge-utils.ts:70-77`
- **상세**: 반환값의 실제 구조(`sourcePort`, `portType`, `portColor`)가 타입에 반영되지 않아 호출 지점에서 타입 캐스팅이 필요합니다. `editor-store.ts`와 `editor-loader.tsx`에서 데이터를 사용할 때 타입 안전성이 없습니다.
- **제안**: 반환 타입을 명시적 인터페이스로 정의하세요.
  ```typescript
  interface EdgeData {
    sourcePort: string;
    portType: EdgePortType;
    portColor: string;
  }
  export function buildEdgeData(...): EdgeData { ... }
  ```

---

### [INFO] CSS에서 `transition` 선언이 중복
- **위치**: `globals.css:72,75`
- **상세**: 기본 규칙(`.react-flow__edge path`)과 focus-active 오버라이드(`[data-edge-focus-active] .react-flow__edge path`) 양쪽에 동일한 `transition` 선언이 있습니다. 기본 규칙의 `transition`이 상속되므로 오버라이드에서 중복 선언이 불필요합니다.

---

## 요약

전반적으로 코드는 관심사 분리(`edge-utils`, `use-edge-highlighting` 모듈화)와 JSDoc 주석 등 좋은 구조를 갖추고 있습니다. 그러나 `isError` 중복 분기, 기능이 없는 "bright" 마커 명칭, 프로덕션 미사용 `getMarkerIdForPortType` 함수, switch/Record 혼용 패턴 등 코드가 의도를 정확히 표현하지 못하는 지점들이 유지보수자의 혼란을 유발합니다. 특히 `className` 문자열 조작 방식의 취약성과 CSS/TSX 전반의 매직 넘버 산재는 향후 스타일 또는 동작 변경 시 오류를 유발하기 쉽습니다. `resolvePortType`의 `ai_agent` 하드코딩은 노드 타입 확장 시마다 수동 개입이 필요한 구조적 취약점입니다.

## 위험도

**MEDIUM**