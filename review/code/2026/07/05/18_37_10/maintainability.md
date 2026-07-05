# 유지보수성(Maintainability) 리뷰

대상: `codebase/frontend/src/components/executions/rerun-modal.tsx` (핵심 변경), 동반 테스트 `rerun-modal.test.tsx`, `CHANGELOG.md`, `plan/in-progress/spec-code-cross-audit-2026-06-10.md`.

## 발견사항

- **[INFO]** 배열 원소 타입의 무검증(unchecked) 캐스트
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:240-249` (`fields` useMemo, `schema as TriggerParameterDefinition[]`)
  - 상세: `manualNode?.config?.parameters` 는 정적 타입 상 `Record<string, unknown>` 하위의 `unknown` 값이다. `Array.isArray(schema)` 로 배열 여부만 확인한 뒤 원소 shape(`{name, type, ...}`)은 런타임 검증 없이 `as TriggerParameterDefinition[]` 로 단언한다. 워크플로 config JSON 은 사용자가 자유 편집 가능한 데이터이므로, `name`/`type` 필드가 없거나 `type` 이 `ParamType` 5종 밖의 문자열이면 `field.type === "boolean"` 등 이후 분기에서 조용히 `text` 위젯으로 폴백되거나 `coerceInput`/`displayValue` 의 `switch`형 분기가 예상 밖 케이스를 통과시킬 수 있다. 크래시로 이어지진 않지만 "정의되지 않은 동작이 조용히 정상 경로처럼 보인다"는 점에서 유지보수 시 디버깅 난이도를 높인다.
  - 제안: 최소한 `p.name` 이 `string` 이고 `p.type` 이 `ParamType` 리터럴 집합에 속하는지 filter/guard 하거나, 매핑 시 `type` 이 알 수 없는 값이면 `"string"` 으로 명시 폴백. (긴급도 낮음 — 기존 코드베이스에도 유사한 dynamic-config 캐스트 패턴이 있을 가능성이 높아 컨벤션상 허용 범위일 수 있음.)

- **[INFO]** boolean 값의 이중 표현(`true` literal vs `"true"` 문자열)을 여러 지점에서 각각 처리
  - 위치: `rerun-modal.tsx:341` (`checked={value === true || value === "true"}`)
  - 상세: `paramValues[field.name]` 이 boolean 이거나 문자열 `"true"/"false"` 일 수 있다는 전제가 체크박스 렌더 한 곳에만 존재하고, 왜 두 형태가 공존하는지(원본 실행 `inputData.parameters` 가 과거엔 텍스트로 저장되었을 수 있어서로 추정) 주석이 없다. 이 암묵적 계약을 모르는 다음 작업자가 `setParam`/`coerceInput` 을 수정하면서 이 조건을 놓치기 쉽다.
  - 제안: 왜 두 표현이 필요한지 한 줄 주석 추가, 또는 `normalizeBoolean(value)` 같은 명시적 헬퍼로 추출해 의도를 드러내면 향후 변경 시 실수를 줄인다.

- **[INFO]** `fields.map` 렌더 블록 내 boolean/그 외 분기가 JSX 반환문 두 벌로 중복
  - 위치: `rerun-modal.tsx:327-373` (`{fields.map((field) => { if (field.type === "boolean") return (...); return (...); })}`)
  - 상세: `inputId`, `field.description` 조건부 표시(`{field.description && (...)}`) 등 레이아웃 조각이 boolean 분기와 default 분기에 거의 동일하게 두 번 등장한다. 필드 타입이 늘어날수록(현재도 object/array 는 JSON 텍스트로 렌더되어 실질 3-way 이지만 코드는 2-way 분기) 이 패턴이 반복될 가능성이 있다.
  - 제안: 현재 2-way 분기 정도는 가독성상 무리 없는 수준이나, 향후 위젯 종류가 늘어나면(예: select, date) `renderField(field)` 형태의 위젯 팩토리로 추출해 중복을 방지할 것을 권장. 지금 시점에서는 크리티컬하지 않음.

- **[INFO]** `coerceInput`/`displayValue` 가 함수 시그니처는 대칭이나 object/array 처리 로직이 유사하게 반복
  - 위치: `rerun-modal.tsx:117-141`
  - 상세: 두 함수 모두 `type === "object" || type === "array"` 분기를 갖고 JSON 직렬화/역직렬화를 담당한다. 현재는 각 함수가 3~10줄로 짧아 중복이라 부르기 애매한 수준이지만, object/array 케이스에 로직이 추가된다면(예: schema validation) 두 곳을 동시에 고쳐야 하는 결합이 생긴다.
  - 제안: 문제 삼을 정도는 아님. 향후 확장 시 참고.

- **[INFO]** 매직 스트링 `"manual_trigger"` 하드코딩
  - 위치: `rerun-modal.tsx:239` (`workflowNodes.find((n) => n.type === "manual_trigger")`)
  - 상세: 노드 타입 문자열이 리터럴로 박혀 있다. 리포지토리 전반에서 노드 타입 문자열 상수를 어떻게 관리하는지(예: 별도 enum/const 파일 존재 여부)는 이번 diff 범위에서 확인되지 않았으나, 유사 파일(`externalCall`/`dryRunDisabled` 판정)에서도 `node.type`/`def.category` 문자열 비교를 그대로 쓰고 있어 기존 파일 내 일관성은 유지된다. 코드베이스 전체 컨벤션(예: `NODE_TYPES.MANUAL_TRIGGER` 상수 존재 여부)은 이번 diff만으로는 판단 불가.
  - 제안: 만약 프로젝트에 노드 타입 상수 모듈이 이미 있다면 그것을 참조하도록 통일. 없다면 현행 유지로 충분(기존 파일 스타일과 일치).

- **[INFO]** 테스트 파일의 새 테스트 3건은 명확하고 기존 패턴(`seedDefinitions`, `renderModal`, `waitFor`)을 그대로 재사용해 일관성이 좋음
  - 위치: `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx:325-414`
  - 상세: 별도 지적 사항 없음. 테스트명이 한국어로 의도를 명확히 서술하며 스키마 로딩 async 특성을 `waitFor` 로 적절히 처리했다.

## 요약

핵심 변경은 `rerun-modal.tsx` 의 `fields` 파생 로직과 필드별 위젯 렌더링으로, 함수들(`displayValue`, `coerceInput`, `fields` useMemo)이 각각 단일 책임을 가지고 짧게(10줄 내외) 작성되어 가독성이 좋다. 주석도 spec 근거(§10.2)와 의도(스키마 부재 시 fallback)를 명확히 남겨 향후 유지보수자가 "왜"를 파악하기 쉽다. 네이밍(`fields`, `setParam`, `coerceInput`, `displayValue`)도 목적을 잘 드러내며, 기존 `paramKeys`/`handleParamChange` 를 대체하는 자연스러운 리팩터다. 지적된 항목은 전부 INFO 수준으로, unchecked 타입 캐스트와 boolean 이중 표현의 암묵적 계약 정도이며 즉각적인 버그 위험보다는 향후 확장 시 주의할 지점이다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮은 수준으로 유지되고 있고 중복 코드도 실질적으로 문제 될 정도는 아니다.

## 위험도

LOW
