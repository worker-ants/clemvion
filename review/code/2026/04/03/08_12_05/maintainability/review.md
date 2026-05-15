### 발견사항

---

**[INFO] `table` 노드의 `pagination` 기본값 처리 로직이 직관적이지 않음**
- 위치: `node-config-summary.ts` — `tableSummary()`
- 상세: `pagination === false`일 때만 페이지네이션을 생략하고, `undefined`(미설정)일 때는 페이지네이션이 있다고 가정합니다. 의도는 이해되지만, 코드만 읽으면 "왜 false만 체크?"라는 의문이 생깁니다.
- 제안: 조건을 `if (pagination) return ... · pagination` 형태로 뒤집거나, 주석으로 기본값 의미를 명시

---

**[INFO] `codeSummary()`의 `LANG_DISPLAY`가 함수 내부 상수로 선언됨**
- 위치: `node-config-summary.ts` — `codeSummary()`
- 상세: `{ javascript: "JavaScript" }` 딕셔너리가 함수 호출마다 재생성됩니다. 또한 현재 항목이 하나뿐이라 확장성이 떨어집니다.
- 제안: 모듈 수준 상수로 이동하고, 지원하는 언어를 모두 등록

```ts
const LANG_DISPLAY: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  // ...
};
```

---

**[INFO] `custom-node.tsx` 헤더 요약의 `maxWidth: "60px"`가 인라인 style로 하드코딩됨**
- 위치: `custom-node.tsx:82`
- 상세: 나머지 스타일은 Tailwind 클래스로 처리되지만 이 값만 인라인 style입니다. 노드 너비(180px)에 비례한 값이므로 의도가 있을 수 있으나, 변경 시 두 곳을 동시에 수정해야 합니다.
- 제안: Tailwind arbitrary value `max-w-[60px]`으로 통일하거나 상수로 분리

---

**[INFO] `showHeaderSummary` / `showBodySummary` 조건식이 컴포넌트 상단에 노출됨**
- 위치: `custom-node.tsx:62~64`
- 상세: 두 변수의 논리 관계가 복잡하고 주석에 의존합니다. 특히 컨테이너 노드의 경고/비경고 분기 의도가 코드에서 바로 읽히지 않습니다.
- 제안: 의미 있는 중간 변수를 추출하거나 함수로 분리

```ts
const isWarning = summary?.isWarning ?? false;
const showHeaderSummary = isContainer && showSummary && !!summary && !isWarning;
const showBodySummary  = showSummary && !!summary && (!isContainer || isWarning);
```

---

**[INFO] `workflow-canvas.tsx`의 `TooltipProvider` 들여쓰기가 일관되지 않음**
- 위치: `workflow-canvas.tsx:368~546`
- 상세: `<TooltipProvider>`가 `return` 바로 아래에 위치하지만, 내부 `<div>`와 동일한 들여쓰기 수준으로 처리되지 않아 JSX 트리 구조가 한눈에 파악되기 어렵습니다.
- 제안: Fragment `<>...</>` 또는 Provider를 래퍼로 명확히 들여쓰기 정렬

---

**[INFO] `merge` 노드가 항상 configured 처리됨 (경고 없음)**
- 위치: `node-config-summary.ts` — `mergeSummary()`, 테스트 파일
- 상세: `inputCount`가 0이거나 `strategy`가 빈 문자열("")이면 올바르게 null을 반환하지만, `{ inputCount: 0, strategy: "" }` 같은 엣지 케이스 테스트가 없습니다. 또한 다른 노드와 달리 `merge`는 빈 config(`{}`)에서 null을 반환하므로 WARNING 처리됩니다. 그러나 "0 inputs · strategy가 빈 문자열"의 경계값 테스트가 누락되어 있습니다.
- 제안: 경계값 테스트 추가

---

**[INFO] 테스트의 `renderNode` 기본 설정이 `http_request`에 의존**
- 위치: `custom-node.test.tsx` — `renderNode()` 기본값
- 상세: 기본 타입이 `http_request`이므로, 다른 타입 테스트 시 명시적 override가 필요합니다. `renderNode({ label: "My Node" })`는 `http_request` + 설정된 config로 렌더링되어, 요약이 항상 나타나는 상태입니다. 특정 테스트에서 의도가 모호해질 수 있습니다.
- 제안: 기본 타입을 요약이 없는 `manual_trigger`로 변경하거나, 각 테스트가 명시적으로 타입을 지정하도록 유도

---

### 요약

전반적으로 코드 구조가 명확하며 레지스트리 패턴(`FORMATTERS`)을 통한 노드별 포매터 분리는 확장성과 가독성 면에서 우수합니다. `node-config-summary.ts`는 단일 책임을 잘 유지하고 있고, 테스트 커버리지도 충실합니다. 다만 `codeSummary` 내부 상수, 인라인 style 혼용, 컨테이너 노드 분기 조건의 가독성, `TooltipProvider` JSX 들여쓰기 불일치 등 소규모 개선 여지가 있습니다. 이슈들은 모두 기능 정확성보다는 미래의 수정 용이성에 영향을 미치는 수준입니다.

### 위험도

**LOW**