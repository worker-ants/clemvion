# 유지보수성(Maintainability) 리뷰

## 발견사항

### widgets.tsx — MultiSelectWidget

- **[WARNING]** rawOptions 파생 로직 중복 — SelectWidget 과 거의 동일한 패턴 반복
  - 위치: `widgets.tsx` L134-144 (`MultiSelectWidget`), L95-103 (`SelectWidget`)
  - 상세: `ui?.options ?? (Array.isArray(schema.X?.enum) ? schema.X.enum.map(...) : [])` 다음 `.map(o => ({ value: o.value, label: translateBackendOptionLabel(o.label, locale) ?? o.label }))` 순서의 2단계 옵션 파생 패턴이 두 위젯에서 각각 인라인으로 반복된다. `SelectWidget` 은 `schema.enum`(flat), `MultiSelectWidget` 은 `schema.items?.enum` + `schema.enum` 두 경로를 체크하는 차이가 있으나 나머지 로직은 동일하다.
  - 제안: `resolveWidgetOptions(schema, ui, locale)` 와 같은 헬퍼 함수를 `utils.ts` 또는 별도 `option-utils.ts` 에 추출하고, 두 위젯 모두에서 호출한다. 파라미터로 `{ fromItems?: boolean }` 플래그를 주면 flat vs nested enum 경로를 통일할 수 있다.

- **[WARNING]** `toggle` 함수가 `useCallback` 없이 매 렌더마다 재생성됨
  - 위치: `widgets.tsx` L147-152
  - 상세: `toggle` 은 `selected` 와 `onChange` 에 의존하는 클로저인데 `useCallback` 으로 감싸지 않는다. 이웃한 `SelectWidget`, `TextWidget` 등은 내부 핸들러를 인라인 arrow 로 처리하는 일관된 패턴이므로 이 자체가 규칙 위반은 아니다. 그러나 `CheckboxField` 가 memo 된 컴포넌트라면 불필요한 리렌더를 유발한다. 현재 코드베이스에서 `CheckboxField` 의 memo 여부를 확인하기 전까지는 LOW 이지만, 나중에 메모이제이션이 추가될 경우 silent 성능 저하 원인이 된다.
  - 제안: `const toggle = useCallback((optionValue: string) => { ... }, [selected, onChange])` 로 감싸거나, 인라인 핸들러 패턴(`onChange={() => toggle(opt.value)}`)을 제거하고 직접 계산을 `onChange` 에 전달하는 방식으로 통일한다.

- **[INFO]** options 매핑 시 spread(`...o`) 대신 명시적 필드 선택
  - 위치: `widgets.tsx` L141-144
  - 상세: `SelectWidget`(L100-103)은 `{ ...o, label: ... }` spread 를 사용하는 반면, `MultiSelectWidget`(L141-144)은 `{ value: o.value, label: ... }` 로 필드를 명시적으로 나열한다. 둘 다 정확하지만 파일 내 스타일이 일치하지 않는다. `UiHint.options` 가 나중에 `disabled` 같은 추가 필드를 갖게 되면 `MultiSelectWidget` 에서는 자동으로 전달되지 않는 차이가 생긴다.
  - 제안: `SelectWidget` 의 spread 패턴과 통일하거나, 두 위젯 모두 명시적 필드 선택으로 통일하는 방향 중 하나를 선택한다.

- **[INFO]** `rawOptions` / `options` 파생이 `useMemo` 없이 매 렌더 계산됨
  - 위치: `widgets.tsx` L134-144
  - 상세: `FieldArrayWidget`(L1027)에서는 `fieldEntries` 를 `useMemo` 로 메모이제이션하는데, `MultiSelectWidget` 의 옵션 파생은 메모이제이션 없이 렌더마다 재실행된다. `ui.options` 나 `schema` 가 렌더 사이에 참조 동일성이 보장되지 않을 경우 불필요한 계산이 발생한다. 현재 파일에서 다른 위젯(`SelectWidget` 등)도 메모이제이션하지 않으므로 일관성은 있지만 중기적으로 고려할 지점이다.
  - 제안: 당장은 기존 패턴과 일관성을 유지하는 방향이 적절하나, 옵션 리스트가 커지거나 translation 비용이 높아질 경우 `useMemo` 도입을 검토한다.

---

### multi-select-widget.test.tsx

- **[WARNING]** 동일한 render 블록이 여러 테스트에 복사됨
  - 위치: `multi-select-widget.test.tsx` L73-93, L95-115, L117-133, L135-151, L153-168
  - 상세: `schema={ARRAY_ENUM_SCHEMA} ui={makeUi()} label="컨텍스트 섹션" value={["time", "timezone"]} onChange={...}` 패턴이 5개 테스트에서 거의 동일하게 반복된다. 나중에 `WidgetProps` 인터페이스나 `makeUi` 기본 구조가 바뀌면 5곳을 동시에 수정해야 한다.
  - 제안: `function renderDefault(overrides?: Partial<Parameters<typeof MultiSelectWidget>[0]>)` 형태의 헬퍼를 파일 상단에 추가해 공통 render 호출을 중앙화한다.

- **[INFO]** `within` import 가 사용되지 않음
  - 위치: `multi-select-widget.test.tsx` L38
  - 상세: `import { ..., within } from "@testing-library/react"` 에서 `within` 이 본 파일 어디에서도 사용되지 않는다. 잔여 import 는 코드베이스 lint(unused-imports) 규칙에서 경고를 낼 수 있고, 파일을 처음 읽는 개발자에게 의도를 오해하게 할 수 있다.
  - 제안: `within` import 를 제거한다.

- **[INFO]** "emits the same option only once even on rapid double-toggle" 테스트 — 테스트 제목과 본문의 행동이 불일치
  - 위치: `multi-select-widget.test.tsx` L259-279
  - 상세: 테스트 제목은 "rapid double-toggle" 을 암시하지만 실제 구현은 `fireEvent.click` 을 한 번만 호출하고 `onChange` 가 1회만 불렸음을 assert 한다. 설명 주석이 "두 번 클릭" 시나리오를 언급하나 두 번째 클릭 코드는 없다. 제목이 의도를 정확히 전달하지 못한다.
  - 제안: 제목을 "calls onChange exactly once per click" 으로 바꾸거나, 실제로 두 번 클릭하는 시나리오를 구현해 제목과 본문을 맞춘다.

---

### widget-registry.ts / types.ts

- **[INFO]** 변경 자체는 최소 — 기존 패턴과 완전히 일치
  - 위치: `widget-registry.ts` L561, `types.ts` L1193
  - 상세: `multiselect` 항목이 `select` 바로 다음 알파벳·논리적 순서에 삽입되어 있고, 기존 위젯 등록 패턴을 그대로 따른다. 별도 지적 사항 없음.

---

### plan 파일들

- **[INFO]** plan frontmatter 에 `worktree` 값이 placeholder 로 남아있음
  - 위치: `plan/in-progress/spec-update-ai-error-output-fields.md` L1 frontmatter `worktree: (assigned at impl-start)`
  - 상세: CLAUDE.md 규약상 in-progress plan 은 frontmatter 에 worktree 를 명시해야 한다. 현재 `(assigned at impl-start)` 는 백로그 상태임을 나타내는 메모이나, `status: backlog` 와 중복 표현이며 자동화 도구가 worktree 필드를 파싱할 경우 오류를 낼 수 있다.
  - 제안: `status: backlog` 인 plan 은 `plan/in-progress/` 대신 별도 `plan/backlog/` 경로를 두거나, worktree 를 `null` 또는 공백으로 명확히 표기한다. 프로젝트 규약이 backlog 상태를 `in-progress/` 안에 두는 것을 허용하지 않는다면 경로 이동이 필요하다.

---

## 요약

이번 변경의 핵심인 `MultiSelectWidget` 구현은 전반적으로 단순하고 명확하며, 기존 위젯들의 구조적 패턴(`FieldGroup` + 내부 컴포넌트 + `translateBackend*` 계층)을 일관성 있게 따른다. 가장 주의가 필요한 지점은 `SelectWidget` 과의 rawOptions 파생 로직 중복으로, 두 위젯이 서로 다른 enum 경로(`schema.enum` vs `schema.items?.enum`)를 처리하는 차이가 있어 향후 세 번째 유사 위젯이 추가되거나 옵션 파생 규칙이 변경될 때 두 곳을 동시에 수정해야 하는 위험이 있다. 테스트 파일에서는 render 블록 반복과 `within` 미사용 import 가 경미한 중복·노이즈를 만들고, `toggle` 핸들러 네이밍은 명확하지만 `useCallback` 미적용이 나중에 메모이제이션 도입 시 주의를 요한다. 전체적으로 즉각적인 결함보다는 중기 유지보수성 개선 여지가 주를 이룬다.

## 위험도

LOW
