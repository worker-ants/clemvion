### 발견사항

- **[INFO]** `formatVariable` 함수의 `parts.join("")` 패턴이 약간 부자연스러움
  - 위치: `node-config-summary.ts`, `formatVariable`
  - 상세: 빈 문자열로 join하면서 각 요소에 공백/구분자를 직접 포함시키는 방식. 기능상 문제없으나 `join`의 역할이 모호해짐.
  - 제안: `return v.name + (v.type ? `: ${v.type}` : "") + (...)` 형태의 직접 연결이 더 명료하거나, 현 방식 유지 시 주석으로 의도 명시.

- **[INFO]** 표시 한계 상수(2)가 매직 넘버로 하드코딩됨
  - 위치: `node-config-summary.ts`, `variableDeclarationSummary` (기존 3 → 2로 변경)
  - 상세: `valid.length <= 2`, `valid.slice(0, 2)` 등 숫자 2가 의미 설명 없이 사용됨. 기존 코드도 같은 패턴이었으나 이번 변경으로 값이 달라짐.
  - 제안: 파일 상단에 `const MAX_INLINE_VARS = 2` 상수 추출. 다른 summary 함수들(`sendEmailSummary` 등)도 유사 패턴이므로 일관성 차원에서 통일.

- **[INFO]** `FormConfig`의 required 체크박스가 기존 `CheckboxField` 공유 컴포넌트를 사용하지 않음
  - 위치: `presentation-configs.tsx`, `FormConfig` 내 필드 반복 블록
  - 상세: 파일 상단에 `CheckboxField`가 import되어 있고 실제로 다른 곳(`TableConfig`)에서 사용 중인데, 새로 추가된 "Required" 체크박스는 raw `<input type="checkbox">`로 구현됨. 스타일과 동작이 달라질 수 있음.
  - 제안: `CheckboxField`로 교체. `CheckboxField`가 `key`/`onChange` 시그니처를 지원한다면 `updateField(i, "required", v)` 형태로 교체 가능.

- **[INFO]** `handleScroll`의 `e.target` 타입 캐스팅 중복
  - 위치: `expression-input.tsx`, `handleScroll`
  - 상세: `UIEvent<HTMLInputElement | HTMLTextAreaElement>`를 받으면서도 내부에서 `(e.target as HTMLElement)`로 다시 캐스팅. 이미 제네릭 타입에서 타입이 좁혀져 있으므로 `e.currentTarget`을 사용하면 캐스팅 불필요.
  - 제안: `e.target` → `e.currentTarget` 사용. React 이벤트에서 핸들러가 붙은 요소를 참조할 때는 `currentTarget`이 더 안전하고 타입도 정확함.

- **[INFO]** `onScroll`이 `<input type="text">`에도 부착됨 (단방향 스크롤 불필요)
  - 위치: `expression-input.tsx`, 단일행 `<input>` 렌더 분기
  - 상세: 단일행 input은 수직 스크롤이 없고 수평 스크롤도 거의 발생하지 않음. 기능에 영향은 없으나 불필요한 핸들러 등록.
  - 제안: `onScroll={handleScroll}`을 `multiline` 분기(`<textarea>`)에만 부착하거나, 현 코드 유지 시 주석으로 "단일행에서도 수평 스크롤 동기화를 위해 유지" 명시.

---

### 요약

이번 변경은 전반적으로 기존 패턴과 일관성을 유지하며 작고 명확한 개선을 담고 있다. `formatVariable` 추출은 단일 책임 원칙에 부합하고, 스크롤 동기화 로직은 `useCallback`과 `ref`를 활용해 적절히 캡슐화되어 있다. 주요 우려사항은 없으며, `CheckboxField` 미사용 일관성 이슈와 매직 넘버 2가 설명 없이 변경된 점이 소규모 개선 여지로 남는다.

### 위험도
**LOW**