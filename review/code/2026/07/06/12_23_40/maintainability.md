# 유지보수성 리뷰 — /schedules 역방향 딥링크 행 강조

대상: `codebase/frontend/src/app/(main)/schedules/page.tsx` (commit 54f8aaac9, `git diff origin/main...HEAD`)

## 발견사항

- **[INFO]** `el.scrollIntoView?.(...)` optional chaining이 코드베이스에서 유일한 사례로 스타일 편차
  - 위치: `codebase/frontend/src/app/(main)/schedules/page.tsx:1031`
  - 상세: 동일한 스크롤-강조 패턴을 쓰는 다른 3곳(`components/docs/docs-mobile-sidebar.tsx:79`, `components/editor/run-results/result-detail.tsx:703`, `components/editor/expression/expression-autocomplete.tsx:41`)은 모두 optional chaining 없이 `el.scrollIntoView(...)`를 직접 호출하고, jsdom 갭은 테스트 쪽에서 `Element.prototype.scrollIntoView = vi.fn()`으로 stub해서 해결한다. 본 PR의 테스트(`schedules-page.test.tsx:542`)도 동일하게 `Element.prototype.scrollIntoView = vi.fn()`을 stub하므로, `?.`가 실질적으로 막아주는 실패 경로가 이미 테스트에도 없다. 즉 optional chaining은 기능적으로 불필요한 방어 코드이며, 기존 관용구와 미세하게 다른 스타일을 만든다.
  - 제안: 일관성을 위해 다른 3곳과 동일하게 `el.scrollIntoView({ block: "center" })` 직접 호출로 통일하거나, 이 방식을 유지할 거라면 왜 이 컴포넌트만 optional chaining이 필요한지(예: 구형 브라우저·SSR 안전성 목적) 주석으로 명시. 현재는 결정 배경이 드러나지 않아 다음 리더가 "실수로 붙인 것"과 "의도적 방어"를 구분하기 어렵다.

- **[INFO]** `cn(isFocused && "bg-[hsl(var(--accent))]")` — 단일 조건부 인자만 넘기는 `cn()` 호출
  - 위치: `codebase/frontend/src/app/(main)/schedules/page.tsx:1036-1038`
  - 상세: 같은 파일의 다른 `cn(...)` 호출(예: 826-850행 tab 버튼)은 base class + 조건부 variant class를 함께 묶는 다중 인자 형태다. 여기서는 `<tr>`에 다른 base 클래스가 없어 `cn()`이 사실상 단일 조건식 하나만 감싸는 wrapper로 쓰인다. 동작에는 문제가 없으나(falsy 시 `undefined`/빈 문자열 처리를 위해 `cn` 사용이 합리적이긴 함), 굳이 유틸을 부를 필요 없이 `isFocused ? "bg-[hsl(var(--accent))]" : undefined`로도 동일한 결과를 더 직접적으로 표현할 수 있다. 사소한 스타일 취향 차이 수준.
  - 제안: 변경 불필요. 코드베이스에 이미 `cn(condition && "...")` 단일-조건 패턴이 다른 곳에도 있다면(예: 424행 부근) 일관성 있는 선택이니 그대로 두어도 무방.

- **[INFO]** `scrolledFocusRef`는 페이지네이션 재방문 시 재스크롤을 하지 않는 설계이나 이 의도가 주석에 없음
  - 위치: `codebase/frontend/src/app/(main)/schedules/page.tsx:500, 1029-1030`
  - 상세: `scrolledFocusRef.current`는 컴포넌트 생애주기 동안 단 한 번만 `true`로 전환되는 module-level이 아닌 컴포넌트-level ref다. 사용자가 페이지네이션으로 포커스 대상 행이 없는 페이지로 이동했다가 다시 원래 페이지로 돌아와도 재스크롤은 일어나지 않는다(구현상 의도된 "최초 진입 1회"로 보이지만, 이 엣지케이스가 주석에 명시되어 있지 않다). 기능 결함은 아니며 spec 요구사항(딥링크 최초 진입 시 강조/스크롤)을 충족하지만, 향후 유지보수자가 "왜 페이지 이동 후 재방문 시 스크롤이 안 되지?"라는 질문을 할 수 있다.
  - 제안: 상단 주석(494-497행)에 "포커스 강조(`isFocused`)는 페이지 이동과 무관하게 매 렌더 유지되지만, 자동 스크롤은 최초 마운트 1회만 수행한다"는 한 줄을 추가하면 의도가 더 명확해진다. 필수는 아님.

## 비교 검토 — #832 triggers/page.tsx lazy-init 패턴과의 접근 차이

`triggers/page.tsx`는 `useState<string | null>(() => searchParams.get("triggerId"))`로 URL 파라미터를 **lazy initializer**에서 한 번 읽어 로컬 selection state로 승격시키고, drawer는 그 state(`selectedTriggerId`)를 prop으로 받아 독립적으로 fetch한다. 이후 URL과 완전히 분리된다(주석: "이후 사용자 조작은 URL 과 독립").

`schedules/page.tsx`는 `searchParams.get("triggerId")`를 **매 렌더 파생값**(`focusTriggerId`)으로 유지하고, 별도의 boolean ref(`scrolledFocusRef`)로 "스크롤은 1회만" 세분화해서 제어한다. 렌더 파생값은 서버 목록 데이터(`schedules`)에 의존해 "어느 행이 focus 대상인가"를 계산해야 하므로, lazy `useState` 한 번으로 캡처할 수 있는 성질의 값이 아니다(목록 로딩 전에는 어떤 행이 매치되는지 알 수 없고, 페이지 전환 시 다른 행 집합이 로드된다). 즉:

- triggers: URL 값 자체가 즉시 최종 selection(드로어 identity) → 1회 캡처로 충분.
- schedules: URL 값은 "찾아야 할 대상"일 뿐, 실제 강조 여부는 비동기로 로드되는 `schedules` 리스트와의 매칭 결과 → 매 렌더 파생이 필연적이며, `useEffect` 없이 파생값 계산 + ref 콜백에서 부수효과(스크롤)를 1회로 게이팅하는 방식은 이 코드베이스가 이미 채택한 "effect-내 setState 회피" 관용구(`docs-mobile-sidebar.tsx`의 클릭 캡처 방식, `cafe24/makeshop-allowlist-editor.tsx`의 `ref={(el) => { if (el) el.indeterminate = ... }}` idempotent DOM 직접조작)와 결이 같다.

두 페이지의 접근 차이는 데이터 의존성 차이(즉시 확정 가능한 값 vs 비동기 리스트에 의존하는 파생값)에서 비롯된 정당한 분기이며, 동일 패턴을 억지로 통일할 이유는 없다. 다만 `scrolledFocusRef` + 조건부 ref 콜백 조합은 `result-detail.tsx`의 `useEffect + refMap` 방식(전체 컴포넌트에서 더 흔한 패턴)과도 다른 제3의 변형이라는 점은 주목할 만하다 — `useEffect`를 쓰지 않기로 한 선택은 이 파생값이 `schedules.map` 루프 안에서 각 행마다 계산되는 렌더 로컬 값이라 effect의 dependency로 뽑아내기보다 ref 콜백이 더 자연스럽다는 점에서 합리적이다.

## 가독성 / 조건부 ref·data-testid 패턴

- `data-testid={isFocused ? "schedule-focused-row" : undefined}`와 `ref={isFocused ? (el) => {...} : undefined}`를 나란히 두고 `className={cn(isFocused && "...")}` 까지 3중으로 `isFocused` 분기를 반복하는 형태는 다소 장황하지만, 각 attribute가 React가 요구하는 서로 다른 타입(string|undefined, RefCallback|undefined, string)이라 하나의 표현식으로 묶기 어렵다. 20줄 내외로 짧고 각 줄의 의도(테스트 훅 / 스크롤 부수효과 / 시각 강조)가 분리되어 있어 가독성은 양호한 수준.
- 주석(494-497행)은 "왜"(spec 참조), "무엇을"(강조+스크롤), "한계"(페이지네이션으로 인해 현재 페이지 밖 행은 강조 불가, 후속 필요)를 모두 명시해 실제 구현(`schedulesApi.list`에 triggerId 필터 파라미터 부재)과 정합한다.

## 요약

변경은 짧고 지역적이며(20여 줄), 목적(딥링크 진입 시 스케줄 행 강조·1회 스크롤)에 비례하는 복잡도를 갖는다. 매직 넘버·과도한 중첩·중복 코드는 없고, 주석은 spec 근거와 구현 한계(페이지네이션 cross-page 미지원)를 정확히 설명한다. triggers/page.tsx의 lazy-init selection과 다른 접근을 택한 것은 스케줄 강조가 비동기 리스트 매칭에 의존하는 파생값이라는 근본적인 데이터 흐름 차이에서 기인하며 정당하다. 발견된 사항은 전부 INFO 수준의 스타일 편차(`scrollIntoView?.`의 optional chaining이 코드베이스 유일 사례, 단일-조건 `cn()` 호출, 페이지네이션 재방문 시 재스크롤 미발생에 대한 주석 부재)로, 기능적 결함이나 향후 유지보수를 저해할 만한 CRITICAL/WARNING 요소는 없었다.

## 위험도

NONE
