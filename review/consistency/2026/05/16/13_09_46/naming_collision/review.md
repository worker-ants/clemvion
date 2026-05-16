# Naming Collision Review — Cafe24 Node UX Phase 3

Checker: naming_collision
Session: 2026/05/16/13_09_46
Scope: frontend only — integration-configs.tsx, shared.tsx, i18n dicts (en/ko)

---

### 발견사항

- **[INFO]** `Cafe24FieldRow` — `FieldRow` suffix 가 docs 컴포넌트에도 존재
  - target 신규 식별자: `Cafe24FieldRow` (module-local React component, `integration-configs.tsx`)
  - 기존 사용처: `frontend/src/components/docs/mdx/field-table.tsx` line 5 — `export interface FieldRow`; `FieldTable` 컴포넌트에서만 사용됨
  - 상세: 두 심볼은 완전히 다른 모듈에 위치하며 서로 import 관계가 없다. `Cafe24FieldRow` 는 node-configs 내부 비공개 함수형 컴포넌트이고, `FieldRow` 는 docs MDX 테이블용 인터페이스다. 이름이 겹치는 부분은 접미사 `FieldRow` 뿐이고 prefix `Cafe24` 가 명확히 구분한다. 현재 빌드·타입 충돌 없음.
  - 제안: 충돌이 아니므로 변경 불필요. 다만 `FieldRow` 가 향후 공유 타입 라이브러리로 추출될 경우 `Cafe24FieldRow` 이름이 혼동을 줄 수 있으므로, 그 시점에 `Cafe24FieldItem` 등으로 분리를 검토하면 충분.

- **[INFO]** `SelectField.options[].disabled` — 신규 optional 필드, 기존 call site 영향 없음
  - target 신규 식별자: `disabled?: boolean` 필드 (`shared.tsx` `SelectField` options 타입, Phase 3 신규 추가)
  - 기존 사용처: `flow-configs.tsx`, `logic-configs.tsx`, `data-configs.tsx`, `button-list-editor.tsx`, `widgets.tsx` (`SelectWidget`) — 모두 `{ value, label }` 만 전달하며 `disabled` 키를 사용하지 않음
  - 상세: optional 필드로 추가되었으므로 기존 call site 는 타입 호환이 유지된다. `widgets.tsx` 의 `SelectWidget` 은 `rawOptions` 를 spread(`...o`) 하지만, `UiHint.options` 타입(`{ value: string; label: string }[]`)에 `disabled` 가 없으므로 백엔드 페이로드를 통해 의도치 않은 `disabled` 가 흘러들어올 경로가 현재는 닫혀 있다.
  - 제안: 이슈 없음. 단, 향후 `UiHint.options` 에 `disabled` 를 추가하거나 백엔드가 해당 키를 내려보낼 경우 `SelectWidget` 의 spread 로 인해 자동으로 동작하게 된다는 점을 인지하면 충분.

---

### 제거된 식별자 잔류 확인

| 제거 대상 | 잔류 여부 |
|---|---|
| `normalizeCafe24Fields` (export) | 잔류 없음 — frontend/src 전역 검색 결과 0건 |
| `fieldRowsToObject` (export) | 잔류 없음 — frontend/src 전역 검색 결과 0건 |
| i18n `cafe24OperationPlaceholder` | 잔류 없음 — en.ts/ko.ts 및 사용처 모두 0건 |
| i18n `cafe24OperationHint` | 잔류 없음 — 전역 0건 |
| i18n `cafe24FieldsKeyPlaceholder` | 잔류 없음 — 전역 0건 |
| i18n `cafe24FieldsValuePlaceholder` | 잔류 없음 — 전역 0건 |

제거된 export 및 i18n 키에 대한 dangling reference 가 전혀 발견되지 않았다.

---

### 신규 식별자 유일성 확인

| 신규 식별자 | integration-configs.tsx 외 출현 | 판정 |
|---|---|---|
| `readCafe24Extras` | 0건 | 충돌 없음 (module-local) |
| `readFieldValues` | 0건 | 충돌 없음 (module-local) |
| `pruneFieldsToOperation` | 0건 | 충돌 없음 (module-local) |
| `findSupportedOperation` | 0건 | 충돌 없음 (module-local) |
| `findPlannedOperation` | 0건 | 충돌 없음 (module-local) |
| `Cafe24FieldRow` | 0건 (docs `FieldRow` 와 별개) | 충돌 없음 (INFO 참고) |

---

### 신규 i18n 키 유일성 확인

모든 신규 키(`cafe24OperationSelectPlaceholder`, `cafe24OperationSelectResourceFirst`, `cafe24OperationPlannedSuffix`, `cafe24OperationCoverageHint`, `cafe24OperationPlannedHint`, `cafe24OperationUnknown`, `cafe24FieldsRequired`, `cafe24FieldsOptional`, `cafe24FieldsEmpty`, `cafe24FieldsEnumHint`, `cafe24FieldsBooleanHint`, `cafe24FieldsDefaultHint`)는 `nodeConfigs.integration` 네임스페이스 하에 en.ts/ko.ts 양쪽에 정의되어 있으며, 동일 키가 다른 네임스페이스에 중복 정의된 사례는 없다.

---

### 요약

Phase 3 에서 도입된 신규 식별자(`readCafe24Extras`, `readFieldValues`, `pruneFieldsToOperation`, `findSupportedOperation`, `findPlannedOperation`, `Cafe24FieldRow`) 는 모두 module-local 로 제한되어 있으며 frontend 전역에서 동일 이름의 다른 의미 사용처가 발견되지 않았다. 제거된 export(`normalizeCafe24Fields`, `fieldRowsToObject`) 및 i18n 키 4종의 dangling reference 도 전무하다. `SelectField.options[].disabled` 확장은 optional 추가이므로 기존 call site 에 breaking change 를 유발하지 않는다. `Cafe24FieldRow` 와 docs 의 `FieldRow` 는 접두사로 충분히 구별되며 import 관계가 없어 실질적 충돌이 없다. 전체적으로 명명 충돌 위험도는 없음(NONE) 수준이며, INFO 2건은 미래 확장 시 참고 수준의 관찰사항이다.

### 위험도

NONE
