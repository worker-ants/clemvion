# 요구사항(Requirement) 리뷰 결과

리뷰 대상: AI Agent `render_*` 버튼 클릭 user-message 합성 (`button.userMessage` 필드 신설 + 합성 우선순위 구현)

참조 spec: `spec/4-nodes/6-presentation/0-common.md §1 ButtonDef`, `§1.1 유효성`, `§10.8 render_* 클릭 user-message 합성`

---

## 발견사항

### [INFO] table / chart / template — `onPortButtonClick` 미전달로 해당 노드의 global 버튼 클릭이 user-message로 흡수되지 않음

- 위치: `assistant-presentations-block.tsx` L183–198 `PresentationItem` switch 분기
- 상세: spec §10.8은 `table / chart / template buttons` 도 global 버튼 합성 대상으로 명시("global 버튼 (carousel `buttons` / table / chart / template `buttons`): `"{button.label}"`")이나, 구현에서 `table`, `chart`, `template` 케이스는 `onPortButtonClick`을 수신하는 Content 컴포넌트에 해당 prop을 전달하지 않는다. 즉 table/chart/template에 버튼을 구성했을 때 `render_*` 모드에서 버튼 클릭이 user-message로 발화되지 않는다.
- 추가 맥락: 테스트 파일(`assistant-presentations-block.test.tsx`) 마지막 주석이 이를 인지하고 "table/chart/template에는 click handler를 전달하지 않으며 TemplateContent / TableContent / ChartContent 자체도 버튼을 렌더링하지 않는다"고 설명한다. 즉 현재 Content 컴포넌트들이 `onPortButtonClick` prop 자체를 지원하지 않는 구조.
- 판단: spec §10.8이 table/chart/template global 버튼을 명시적으로 합성 대상에 포함한 반면 실제 클릭 경로가 미구현 상태임. spec과 구현 간 gap이 존재하나, 테스트 주석이 현재 단계에서 carousel per-item만 scope로 제한함을 명시 — 향후 구현 의도는 있으나 현재 단계에서 미완성.
- 제안: 현재 단계가 carousel 우선 구현임을 `plan` 문서에 명기하고, table/chart/template global 버튼 클릭 경로를 후속 task로 추적할 것. spec §10.8의 합성 표가 현재 구현 범위보다 넓게 기술되어 있으므로 spec 또는 plan에 "단계별 구현" 명시가 필요함 (수정은 `project-planner` 위임).

---

### [INFO] `validateButtons` 함수가 `userMessage` 필드를 검증하지 않음 (의도된 정책)

- 위치: `codebase/backend/src/nodes/presentation/_shared/button.types.ts` L112–179 `validateButtons`
- 상세: spec §1.1은 "`userMessage` 는 `type: "port"` 한정 — `type: "link"` 에 `userMessage` 설정 시 무시 (warning 아님)"이라고 명시한다. `validateButtons`는 `userMessage`에 대한 검증 규칙을 추가하지 않으며, zod schema 쪽도 parse-time reject 없이 통과시킨다. spec 정책(warning 아님, 무시)과 구현이 일치함.
- 판단: 의도된 동작이나, `validateButtons` 함수가 `type: "link"` + `userMessage` 조합에 대해 경고조차 반환하지 않는 것이 spec "warning 아님" 요건과 정확히 정합. 이슈 없음.

---

### [INFO] `findButtonContext` — global 버튼 경로 (step 3)에서 dynamic synthesized runtime button (`{base}__item_{idx}`) 이 `dynamicItem`과 함께 반환되지만, base 정의(`itemButtons`)에서 이미 step 2에서 매칭됨

- 위치: `assistant-presentations-block.tsx` L118–131 step 3 global buttons 탐색
- 상세: `{base}__item_{idx}` 형태의 ID가 step 2 (`itemButtons` 정의 탐색)에서 매칭되면 step 3로 내려오지 않는다. 그런데 step 3에서는 `buttonConfig.buttons`에 포함된 synthesized ID(`act__item_0` 등)에 대해서도 `dynamicItem`을 함께 반환하는 로직이 있다. step 2에서 먼저 매칭되는 경우가 정상 경로이므로 step 3의 dynamic item 보충 코드는 step 2 `itemButtons` 정의가 누락된 예외 케이스(또는 LLM이 `itemButtons` 없이 직접 synthesized ID를 `buttonConfig.buttons`에 만든 비정상 케이스)에만 작동한다.
- 판단: 회귀 방어용 defense-in-depth 코드로 볼 수 있으며 동작은 올바름. 주석("dynamic 모드의 synthesized runtime button 도 본 경로에서 매칭되며, 이 경우 suffix 로 부모 아이템 보충")이 이를 설명하고 있어 의도와 구현이 일치함. INFO 수준.

---

### [INFO] `composeUserMessage` — `userMessage` 빈 문자열 무시 처리가 spec 회색지대

- 위치: `assistant-presentations-block.tsx` L157–159
- 상세: spec §10.8은 "1 | `button.userMessage` (LLM이 §1 ButtonDef의 옵션 필드로 명시) | 그 문자열 그대로 user message 발화"라고만 명시하고, 빈 문자열 처리를 명시하지 않는다. 구현은 빈 문자열을 무시하고 다음 우선순위를 적용한다(`userMessage.length > 0` 조건). 테스트도 이를 명시적으로 검증하고 있다("LLM이 명시적으로 빈 문자열을 보내면 의도 모호 — fallback 합성을 따른다").
- 판단: spec 침묵 영역(회색지대)에서 구현이 합리적 선택을 했으나, spec §10.8에 빈 문자열 처리 규칙이 명문화되지 않음. `project-planner`가 spec에 보충하는 것을 권장.

---

### [INFO] spec §10.8 합성 경로 — backend `render-tool-provider.ts`가 `userMessage`를 별도 처리하지 않음 (의도된 passthrough)

- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts`
- 상세: spec §Rationale "왜 옵션 필드 — §10.5 backfill 대상 아님"에서 `userMessage`는 `backfillButtonUuids` 처리 대상이 아님을 명시. render-tool-provider는 zod validate → defaults overlay → 1MB cap → `backfillButtonUuids` 순서로 처리하며, `userMessage`는 zod optional로 그대로 통과한다. spec 4-layer SSOT의 backend 역할("zod schema의 `userMessage: z.string().optional()` — LLM emit 검증 + 그대로 보존")과 정합.
- 판단: 의도된 동작. 이슈 없음.

---

### [INFO] carousel `buttonDefSchema` placeholder — global 버튼과 global-only 노드(table/chart/template) 간 placeholder 텍스트 불일치

- 위치:
  - `carousel.schema.ts` L40–42: `placeholder: '클릭 시 chat 발화 텍스트 (생략 시 자동 합성: "{item.title} → {label}")'`
  - `chart.schema.ts`, `table.schema.ts`, `template.schema.ts`: `placeholder: '클릭 시 chat 발화 텍스트 (생략 시 자동 합성: label)'`
- 상세: carousel의 placeholder는 per-item 합성 공식을 보여주고, 나머지 세 노드는 global fallback(`label`)만 보여준다. spec §10.8 합성 표 우선순위 2(per-item)와 3(global)의 차이를 UI hint에 반영한 의도적 분기.
- 판단: carousel에는 per-item 버튼도 있으므로 더 복잡한 placeholder가 적절하나, carousel의 global `buttons` 배열에 붙은 placeholder도 `"{item.title} → {label}"`로 표시하는 것은 global 버튼의 실제 fallback(`"{label}"`)과 다르다. global 버튼이 per-item 컨텍스트를 갖지 않으므로 carousel global buttons에서도 `label` 단독 fallback이 적용됨 — placeholder가 살짝 오해를 줄 수 있음. 하지만 carousel에서는 사용자가 global과 per-item을 혼용할 수 있어 "더 넓은 안내"를 보여주는 의도일 수 있음. spec은 침묵.

---

## 요약

전체적으로 구현은 spec `§1 ButtonDef.userMessage` 옵션 필드 신설, `§1.1` 유효성 정책(link 타입 무시, warning 아님), `§10.8` 합성 우선순위(LLM emit → per-item fallback → global fallback → buttonId) 요건을 충실히 반영하고 있다. backend 4개 노드(carousel/chart/table/template) 스키마 모두에 `userMessage: z.string().optional()` 추가가 완료되었으며, 테스트는 zod parse 보존·JSON Schema 노출·link 타입 reject-안함·빈 문자열 fallback 등 spec이 명시한 행위를 line-level로 검증한다. frontend `findButtonContext` + `composeUserMessage` 구현은 spec §10.8 우선순위 4단계를 정확히 구현하고 있고, `handlePortButtonClick`이 두 헬퍼를 올바른 순서로 조합한다. 핵심 미완성 사항은 table/chart/template의 global 버튼 클릭이 현재 단계에서 user-message 발화 경로가 없다는 점이나, 구현자가 테스트 주석으로 scope 제한을 명시했으며 carousel per-item 경로는 완전히 구현된 상태다. spec §10.8의 합성 표가 table/chart/template을 포함하므로 plan 또는 spec에 "단계별 구현" 명기를 권장한다.

## 위험도

LOW
