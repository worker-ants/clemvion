# 요구사항(Requirement) 리뷰 — render_form 옵션 collision + DynamicFormUI 상태/타입 안정화

리뷰 대상: 파일 7개 (render-tool-provider.ts/spec.ts, page.tsx, result-detail.tsx, dynamic-form-ui.tsx/test.tsx, plan.md)
기준: plan/in-progress/render-form-options-and-state-fix.md 의 7가지 문제 항목 + spec/4-nodes/6-presentation/0-common.md §10.5, spec/4-nodes/6-presentation/4-form.md §1

---

## 발견사항

### [CRITICAL] spec §10.5 에 form option value backfill 단계(step 4)가 존재하지 않음 — spec fidelity 위반

- 위치: `render-tool-provider.ts:418`, `render-tool-provider.spec.ts:44`, `dynamic-form-ui.tsx`, `dynamic-form-ui.test.tsx`
- 상세: 코드 주석 및 테스트 전반이 "spec §10.5 step 4" 를 form option value backfill 의 근거 단계로 인용하고 있다. 그러나 현재 `spec/4-nodes/6-presentation/0-common.md` §10.5 의 실제 step 4 는 "LLM 이 같은 turn 안에서 재시도 가능..." 이다 — form option backfill 에 관한 step 은 spec 어디에도 정의되어 있지 않다. CHANGELOG (line 363) 에도 `button.id` backfill(step 3) 은 기록되어 있으나 form option backfill 항목은 없다. Rationale 절에도 `form option value backfill` 단락이 없다.
  - `render-tool-provider.ts` JSDoc: `@spec/4-nodes/6-presentation/0-common.md §10.5 step 4`
  - `render-tool-provider.spec.ts`: `describe('backfillFormOptionValues (spec §10.5 step 4)', ...)`
  - `dynamic-form-ui.test.tsx`: `spec/4-nodes/6-presentation/0-common.md §10.5 step 4 ... and §10.6`
  - `dynamic-form-ui.tsx` 코드 주석: `spec §10.5 step 4 SSOT 4-layer alignment`
  코드 구현 자체는 올바르나, 인용된 spec 단계가 존재하지 않아 SDD 원칙(Spec-Driven Development)상 spec 이 선행되어야 하는 규약을 위반하고 있다. plan 의 TDD 체크리스트에서도 "(S) project-planner 위임 — §10.5 form option value backfill + spec 변경" 항목이 체크되지 않은 채로(`[ ]`) 코드가 먼저 작성됐다.
- 제안: `project-planner` 에 위임하여 `spec/4-nodes/6-presentation/0-common.md` §10.5 에 form option value backfill 단계를 step 4 로 추가 (기존 step 4·5 → step 5·6 재번호), CHANGELOG 2026-05-23 항목 추가, Rationale 단락 추가 후 spec 을 코드에 정합화할 것.

---

### [CRITICAL] `spec/4-nodes/6-presentation/4-form.md` 에 `§1.5` 절이 존재하지 않음

- 위치: `dynamic-form-ui.tsx:1127`, `dynamic-form-ui.test.tsx:479` (`spec/4-nodes/6-presentation/4-form.md §1.5 — file 필드의 metadata-only 직렬화 형식`)
- 상세: 코드 및 테스트가 `spec 4-form §1.5` 를 file 필드 metadata-only 직렬화의 SoT 로 인용하고 있다. 그러나 현재 `spec/4-nodes/6-presentation/4-form.md` 에는 §1.5 절이 존재하지 않는다 — §1 은 `FormField 구조` 표 하나와 allowedMimeTypes 기본값 블록, 재제출 정책 표로 구성되어 있으며 "§1.5" 번호의 하위 섹션은 없다. `type: 'file'` 필드의 UI 동작(metadata-only 직렬화 규약, binary 미전달 정책)이 spec 에 명시되지 않은 채 구현이 먼저 이루어진 상태다. plan.md 의 "file 타입 — spec 미정. project-planner 가 결정 시 본 PR 에서 구현" 기술과 모순된다 — 구현이 이미 포함되어 있다.
- 제안: `project-planner` 에 위임하여 `spec/4-nodes/6-presentation/4-form.md` 에 §1.5 (file 필드 metadata-only 직렬화) 절을 추가하고, `dynamic-form-ui.tsx` / `dynamic-form-ui.test.tsx` 의 `§1.5` 인용이 실제 spec 절과 일치하도록 정합화할 것.

---

### [WARNING] `backfillFormOptionValues` 가 `false` (boolean) 값을 "non-empty" 로 보존하는 동작이 `value: z.unknown().default('')` 와 상충할 수 있음

- 위치: `render-tool-provider.ts:383-386`
- 상세: `needsBackfill` 조건은 `v === undefined || v === null || (typeof v === 'string' && v.length === 0)` 이다. `false` 는 이 조건에 해당하지 않아 보존된다. 그러나 `optionSchema.value: z.unknown().default('')` 는 LLM 이 `value: false` 를 emit 하면 zod 가 그대로 통과시킨다. 이 경우 frontend `<option value={String(false ?? "")}>` → `"false"` 라는 string 이 DOM 에 렌더되고, submit 시에도 `"false"` 문자열로 LLM 에 전달된다. LLM 이 boolean `false` 를 의도하고 emit 했을 때 round-trip 시 타입 드리프트가 발생하나, spec 에 boolean option value 의 처리 정책이 명시되어 있지 않다 (spec 은 `value: unknown` 으로 타입만 허용하고 round-trip 형태 무관). 테스트 케이스(spec.ts line 144-166)는 이 동작을 "frontend coerce 위임"으로 문서화하고 있어 설계 의도가 있음. spec 의 회색지대.
- 제안: spec §10.5 (추가될 step 4) 에서 boolean/number option value 의 round-trip 정책(frontend String coerce 의 LLM 매핑 보장 여부)을 명시하도록 `project-planner` 에 위임. 구현 자체는 현재 계획된 동작과 일치.

---

### [WARNING] `DynamicFormUI` key fallback `"form"` 이 다중 form 동시 표시 시 충돌 가능

- 위치: `page.tsx:615` — `key={waitingNodeId ?? "form"}`
- 상세: `waitingNodeId` 가 `null` 또는 `undefined` 인 경우 `"form"` 이라는 고정 string 이 key 로 사용된다. 실행 중 `waitingNodeId` 가 없는 상태에서 다른 form이 render 되면 동일 key 를 공유하게 되어 의도하지 않은 state 재사용이 발생할 수 있다. `result-detail.tsx` 에서는 `key={result.nodeId}` 를 사용해 노드 ID 를 직접 쓰는 방식과 일관성이 없다.
- 제안: `key={waitingNodeId ?? "form"}` 을 `key={waitingNodeId ?? "form-no-id"}` 처럼 보다 구체적인 fallback 으로 변경하거나, `waitingNodeId` 가 항상 존재하는 상태에서만 `DynamicFormUI` 를 렌더하도록 조건 조정. 현재 isWaitingForm 조건에 waitingNodeId 존재 여부를 포함하는 방법도 검토.

---

### [WARNING] `number` 필드 빈 문자열 보존 동작이 spec 에 명시되지 않음

- 위치: `dynamic-form-ui.tsx:1176-1179`
- 상세: `onChange` 에서 `v === "" ? "" : Number(v)` 로 빈 문자열을 보존한다. plan.md (항목 3)은 이를 "number 빈 입력 보존" 으로 기술하며 spec §Rationale 인용도 있으나 실제 spec 에는 이 동작 규약이 존재하지 않는다. `form_submitted` 데이터에 `""` (빈 문자열)이 포함될 때 LLM 이 `number` 타입으로 해석할지 여부가 spec 미정이며, 후속 노드의 type 검증에서 문제가 생길 수 있다. `form.schema.ts` 의 `formFieldSchema` 에도 number 필드의 빈 입력 처리 규약이 없다.
- 제안: spec `4-form.md §4` (실행 로직) 또는 §6.2 (form 입력 검증) 에 number 필드 빈 입력 시 제출 값 정책을 명시하도록 `project-planner` 에 위임.

---

### [INFO] `plan/in-progress` 의 TDD 체크리스트가 미체크 상태인 채 PR 코드가 완성됨

- 위치: `plan/in-progress/render-form-options-and-state-fix.md:1774-1785`
- 상세: 체크리스트 모든 항목(`(S)` spec 위임, consistency-check, spec commit, impl-prep, 등)이 `[ ]` (미완료) 상태다. plan lifecycle 규칙상 plan 문서는 작업 진행 상태를 반영해야 한다. 실제 코드는 완성 수준이므로 체크리스트와 현실 사이에 괴리가 있다.
- 제안: plan 문서의 체크리스트를 실제 완료 항목은 `[x]` 로 갱신. spec 관련 항목은 `project-planner` 위임 후 체크.

---

### [INFO] `dynamic-form-ui.test.tsx` 의 file 필드 테스트가 `maxFiles=1` 일 때 `multiple=false` 만 검증하고 maxFiles 미설정 케이스를 검증하지 않음

- 위치: `dynamic-form-ui.test.tsx:640-680`
- 상세: `maxFiles: 1` → `multiple=false`, `maxFiles: 3` → `multiple=true` 는 검증. 그러나 `maxFiles` 가 undefined/미설정인 경우(`typeof field.maxFiles === "number"` 조건에서 false) `multiple=false` 로 동작하는 케이스가 테스트에 없다. 구현(`dynamic-form-ui.tsx:1275`)은 `typeof field.maxFiles === "number" && field.maxFiles > 1` 로 올바르게 처리하지만 테스트 커버리지 누락.
- 제안: `maxFiles` 미설정 케이스에서 `multiple=false` 임을 검증하는 테스트 케이스 추가.

---

### [INFO] `backfillFormOptionValues` 의 `false` (boolean `0`) primitive option 처리 시 `typeof opt !== 'object'` 체크에서 early-return 가능성

- 위치: `render-tool-provider.ts:461`
- 상세: `if (opt === null || typeof opt !== 'object') return opt;` 조건에서 LLM 이 option 을 `0` (number primitive) 으로 emit 하면 `typeof 0 !== 'object'` → early-return 되어 해당 option 이 그대로 통과된다. 이 경우 `{ label, value }` 구조가 아닌 primitive 가 options 배열에 남게 되어 frontend `opt.label`, `opt.value` 접근이 `undefined` 를 반환한다. 테스트(spec.ts line 236-258)는 이 동작을 "pass through" 로 검증하고 있으나, primitive option 이 frontend 에 도달했을 때 DynamicFormUI 의 `{opt.label}` 렌더가 `undefined` 를 렌더한다는 엣지 케이스 문서화가 없다.
- 제안: 해당 동작이 의도된 것이라면 JSDoc 또는 spec 에 "primitive option entry 는 그대로 통과 — frontend 가 undefined 처리" 를 명시. 아니라면 primitive option 을 필터링하거나 frontend 방어 코드 추가.

---

## 요약

본 변경은 `render_form` 의 select/radio option value collision (핵심 버그), DynamicFormUI state remount, number 빈 입력 강제, file 타입 미구현, type drift 비교 실패 등 5가지 실질적 문제를 올바르게 구현하고 있으며, 백엔드 `backfillFormOptionValues` 함수의 로직과 테스트 커버리지는 edge case (null, undefined, empty string, non-object, multi-field index) 를 충분히 검증하고 있다. 그러나 핵심적인 spec fidelity 결함이 두 가지 존재한다: (1) 코드 전반이 인용하는 "spec §10.5 step 4 (form option value backfill)" 가 실제 spec 에 없으며, (2) `§1.5 (file 필드 metadata-only 직렬화)` 절 역시 spec 에 존재하지 않아 SDD 원칙 위반이다. 이 두 항목은 코드가 spec 보다 앞서 작성된 상태이므로 `project-planner` 를 통해 spec 을 정합화해야 merge 를 진행할 수 있다.

---

## 위험도

**HIGH** — spec 에 존재하지 않는 step 을 코드 전반이 SoT 로 인용하는 spec fidelity 위반이 2건 존재하며, plan 의 spec-first 체크리스트가 미완료인 채로 코드가 선행 작성된 구조적 위반이다. 기능 동작은 올바르나 SDD 규약 준수를 위해 spec 정합화가 선행되어야 한다.
