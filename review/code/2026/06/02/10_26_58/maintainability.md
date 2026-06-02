# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: integration-configs.tsx (파일 1)

- **[INFO]** 함수 추출 후 주석 누락으로 의도 전달 불완전
  - 위치: diff 제거 블록 직후 남겨진 인라인 주석 (line 79~81)
  - 상세: `readCafe24Extras` · `resolveCafe24OperationLabel` 를 외부 모듈로 이동한 뒤 "추출됨 (drift 방지)" 코멘트만 남아 있다. 코멘트 자체는 이유를 설명하지만, 이 파일을 처음 읽는 사람은 `// 위 import 참조` 라는 문구를 쫓아 import 상단을 확인해야 한다. 주석이 코드보다 더 큰 인지 부담을 준다.
  - 제안: 해당 주석 블록 전체 제거. import 한 줄만 남기면 공유 헬퍼 사용 의도가 자연스럽게 전달된다. 필요하다면 JSDoc 레벨 import 그룹 주석(`// shared cafe24 helpers`)으로 대체.

---

### 파일 3: cafe24-allowlist-editor.tsx

- **[WARNING]** `commit` 함수의 타입 우회(`undefined as unknown as string[]`)가 유지보수 지뢰
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/cafe24-allowlist-editor.tsx` line ~569
  - 상세: `onChange(sameAsAll ? (undefined as unknown as string[]) : next)` 는 `onChange` 시그니처(`(enabledTools: string[]) => void`)와 실제 전달값(`undefined`)이 불일치한다. 타입 캐스팅으로 컴파일러를 침묵시키지만 런타임 계약은 어긴다. 부모 컴포넌트(`mcp-server-selector.tsx`)가 이 `undefined` 를 `patch` 함수에 그대로 전달하기 때문에 동작하지만, 미래에 부모나 `McpServerRef` 타입이 변경되면 조용히 버그로 이어진다.
  - 제안: `onChange` 타입을 `(enabledTools: string[] | undefined) => void` 로 수정하고, 호출 지점(`mcp-server-selector`)에서 `undefined` 분기를 명시 처리한다. Props 인터페이스 수정이 파급 범위를 명확히 드러내어 차후 변경 시 컴파일러가 보호한다.

- **[WARNING]** 렌더 함수 내 `const` 핸들러 정의 — 컴포넌트 리렌더마다 재생성
  - 위치: `cafe24-allowlist-editor.tsx` `isEnabled`, `base`, `commit`, `toggleOp`, `setCategory` (lines ~558~590)
  - 상세: `extras` 존재 확인 이후 렌더 함수 본문에서 5개의 함수가 `const`로 선언된다. 이들은 `enabledTools`, `allIds`, `onChange` 에 클로저를 형성하며 매 렌더마다 새 참조가 생성된다. 현재는 성능 이슈보다 패턴 일관성 문제가 크다 — 이 파일의 다른 부분이 `useCallback`을 사용하지 않아도 일관성은 유지되지만, 프로젝트 내 비슷한 컴포넌트들이 훅을 활용하는 패턴이면 유지보수자가 혼란을 겪는다.
  - 제안: 현재 규모(함수 수, props 안정성)에서 `useCallback` 강요는 과도하다. 다만 `base()`를 별도 함수가 아닌 인라인 표현식(`enabledTools ?? allIds`)으로 두거나, 이 컴포넌트가 순수 함수형으로 유지됨을 명시하는 주석으로 의도를 표현하면 충분하다.

- **[INFO]** `base`라는 이름이 추상적
  - 위치: `cafe24-allowlist-editor.tsx` `const base = (): string[] => enabledTools ?? allIds;`
  - 상세: `base`는 "materialize된 enabledTools 기준값"을 반환하는 함수지만 이름만으로는 그 의미가 불분명하다. 이 함수를 처음 읽는 사람은 `base()`가 무엇의 베이스인지 파악하기 위해 사용 맥락을 뒤져야 한다.
  - 제안: `materializedTools()` 또는 `effectiveTools()` 처럼 목적을 드러내는 이름으로 변경.

- **[INFO]** JSX 내 `resources.map` 콜백 복잡도
  - 위치: `cafe24-allowlist-editor.tsx` `return` 블록 내 `{resources.map((resource) => { ... })}` (약 45 lines)
  - 상세: `resources.map` 콜백 내에서 `categoryRestricted`, `enabledCount`, `allOn`, `someOn` 계산과 중첩 `ops.map` 렌더가 모두 인라인으로 처리된다. 현재 길이(~45줄)가 경계선에 있으나, 향후 per-operation 편집 기능(toolOverrides 등)이 추가되면 이 블록이 빠르게 비대해진다.
  - 제안: `ResourceGroup` 서브컴포넌트 또는 `OperationRow` 서브컴포넌트로 분리를 고려. 지금 당장 강제할 수준은 아니지만 분리 준비 여지를 남겨 두는 것이 유지보수성을 높인다.

---

### 파일 4: mcp-server-selector.tsx

- **[INFO]** `patch` 함수명과 파라미터명 충돌
  - 위치: `mcp-server-selector.tsx` `function patch(integrationId: string, patch: Partial<McpServerRef>)` (line ~1045)
  - 상세: 함수명 `patch`와 파라미터명 `patch`가 동일하다. 함수 내부에서 파라미터 `patch`를 참조할 때 함수 자체가 섀도잉된다. 현재 함수 내부에서 재귀 호출이 없으므로 버그는 발생하지 않지만, 리팩터 중 함수명을 변경하거나 재귀 패턴을 추가할 때 혼란을 준다.
  - 제안: 파라미터명을 `updates` 또는 `partialRef`로 변경.

- **[INFO]** `expanded` Set 상태가 삭제된 integration을 계속 추적
  - 위치: `mcp-server-selector.tsx` `toggleExpanded` 로직
  - 상세: integration이 `remove()`로 제거되어도 `expanded` Set에서 해당 `integrationId`가 정리되지 않는다. 같은 id의 integration이 다시 추가되면 이전 펼침 상태가 유지되는 예상치 못한 동작이 발생할 수 있다. 현재 UX상 큰 문제는 아니지만 상태 생명주기 불일치다.
  - 제안: `remove` 함수 내에서 `setExpanded(prev => { const next = new Set(prev); next.delete(integrationId); return next; })`를 함께 호출.

- **[WARNING]** 하드코딩된 영문 에러 메시지 두 곳
  - 위치: `mcp-server-selector.tsx` lines ~1056~1064
  - 상세: `"Failed to load MCP servers. Check the integrations service and reload."`, `"No MCP server registered..."`, `"No MCP servers attached..."` 세 문자열이 영문으로 하드코딩되어 있다. 같은 파일의 다른 텍스트는 모두 `t(...)` i18n 함수를 통해 처리된다. 특히 이 컴포넌트는 ko/en 지원 코드베이스의 일부다.
  - 제안: 세 문자열을 `ko/nodeConfigs.ts` · `en/nodeConfigs.ts` 에 i18n 키로 등록하고 `t()` 호출로 대체. 이번 PR 범위가 아니라면 `// TODO(i18n): ...` 주석으로라도 마킹.

---

### 파일 7: cafe24-extras.ts

- **[INFO]** `readCafe24Extras` 의 타입 내로잉 중복 검사
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/lib/node-definitions/cafe24-extras.ts` lines ~1180~1187
  - 상세: `!e.operationsByResource` 와 `typeof e.operationsByResource !== "object"` 를 모두 확인한다. JavaScript에서 `!e.operationsByResource`가 falsy이면 `typeof` 검사는 항상 `false`(since `undefined` is not an object)이므로 두 조건이 부분적으로 중복된다. 가독성보다 코드 양이 늘어난다.
  - 제안: 실질적인 버그는 아니므로 강요하지 않으나, 단순화 시: `if (!e.operationsByResource || typeof e.operationsByResource !== "object" || ...)` 에서 첫 조건을 제거하고 `typeof` 만 유지하거나, Zod 같은 스키마 라이브러리로 narrowing을 통일하는 방향을 고려.

---

### 파일 2: cafe24-allowlist-editor.test.tsx

- **[INFO]** `op` 헬퍼 함수 이름이 지나치게 축약
  - 위치: `cafe24-allowlist-editor.test.tsx` line ~142
  - 상세: `op(id, labelKey, restricted?)` 함수가 test fixture 빌더로 쓰이지만 이름이 너무 짧아서 처음 보는 사람은 역할을 즉시 파악하기 어렵다. 같은 파일 내 loop variable `op`와 이름이 겹쳐 혼란을 준다 (JSX 내 `ops.map((op) => ...)` 패턴과 test 파일의 함수 `op`).
  - 제안: `makeOp` 또는 `buildOperation`으로 rename.

- **[INFO]** 테스트 케이스 이름의 영한 혼용
  - 위치: `cafe24-allowlist-editor.test.tsx` `it("default_true: enabledTools undefined → ...")`
  - 상세: `default_true` 라는 snake_case 기술 용어가 한국어 설명 문장 앞에 혼합되어 있다. 다른 테스트 케이스는 순수 한국어다. 일관성이 없으면 팀이 나중에 추가하는 케이스의 명명 규칙을 결정하기 어렵다.
  - 제안: `"enabledTools가 undefined이면 모든 체크박스 checked (default_true 규칙)"` 처럼 한국어 설명 안에 기술 용어를 괄호로 넣는 방식으로 통일.

- **[INFO]** `headerBoxes[0]` 인덱스 접근의 암묵적 순서 의존
  - 위치: `cafe24-allowlist-editor.test.tsx` line ~276 `fireEvent.click(headerBoxes[0])`
  - 상세: "첫 카테고리(mileage) 헤더" 라고 주석에 명시했지만, `resources.sort()`의 알파벳 순서에 의존한다. 현재 fixture에서 `mileage < product < store` 순이므로 `[0]`이 mileage가 맞지만, fixture의 resource key가 바뀌거나 정렬 로직이 변경되면 테스트가 조용히 다른 카테고리를 클릭한다.
  - 제안: `screen.getByRole("checkbox", { name: /mileage/i })` 처럼 aria-label로 직접 대상을 특정하거나, `getByLabelText` 활용.

---

### 전체 파일 공통

- **[INFO]** Tailwind 매직 문자열 반복: `text-[10px]`, `h-3 w-3`, `hsl(var(--muted-foreground))`
  - 위치: `cafe24-allowlist-editor.tsx` 전반, `mcp-server-selector.tsx` 전반
  - 상세: `text-[10px]`, `h-3 w-3`, `text-[hsl(var(--muted-foreground))]` 가 여러 줄에 걸쳐 반복된다. 이 값들이 변경될 경우(예: 기본 폰트 크기 조정) 모든 사용 지점을 수동으로 찾아야 한다.
  - 제안: 프로젝트 전체 관례가 인라인 Tailwind 클래스 반복을 허용하면 현 상태 유지. 그렇지 않다면 `cn()` 유틸을 통한 공통 클래스 그룹 상수화 또는 `@layer components`에서 컴포넌트 클래스 정의를 고려.

---

## 요약

이번 변경의 핵심인 `cafe24-extras.ts` 공유 헬퍼 추출과 `Cafe24AllowlistEditor` 신설은 drift 방지라는 유지보수 목적에 잘 부합한다. 코드 구조가 전반적으로 명확하고 주석이 충실하다. 단, `onChange` 시그니처와 실제 전달값(`undefined`) 사이의 타입 불일치는 향후 타입 계층이 바뀌면 조용히 버그로 이어질 수 있어 WARNING 수준의 주의가 필요하다. `mcp-server-selector.tsx` 내 하드코딩 영문 에러 메시지가 i18n 패턴과 일관성이 없는 점도 정리가 필요하다. 나머지 지적 사항들은 가독성·네이밍 수준의 INFO로, 긴급 수정 없이 다음 리팩터 기회에 병행 처리할 수 있다.

## 위험도

LOW

STATUS: SUCCESS
