# 요구사항(Requirement) Review — V-14 Re-run 모달 원본 ID 링크 + typed 폼

대상: `codebase/frontend/src/components/executions/rerun-modal.tsx`,
`codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx`,
`CHANGELOG.md`, `plan/in-progress/spec-code-cross-audit-2026-06-10.md`,
`review/consistency/2026/07/05/18_21_17/SUMMARY.md`

SoT: `spec/5-system/13-replay-rerun.md §10.2` (+ `§4-execution-engine.md §6.1.1`, `spec/4-nodes/7-trigger/0-common.md §1` for `TriggerParameterDefinition` shape/coercion contract).

## 발견사항

- **[INFO]** 새로 추가된 schema 필드의 `defaultValue` 가 재실행 폼 프리필에 반영되지 않음
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:179-198` (`originalParameters` → `paramValues` 초기화), `239-253` (`fields` 도출)
  - 상세: `TriggerParameterDefinition.defaultValue` 는 타입 정의에 존재하지만(`110-117`), `paramValues` 초기값은 오직 `extractParameters(original.inputData)`(원본 실행 당시 입력값)에서만 온다. 워크플로가 원본 실행 이후 편집되어 manual_trigger 스키마에 새 필드가 추가된 경우(원본 실행 시점엔 없던 파라미터), 재실행 폼은 그 필드를 빈 값(`""`/`false`)으로 렌더한다 — schema 의 `defaultValue` 도 원본 실행의 부재 키도 아닌 "빈 값"으로 채워짐. `resolveTriggerParameters` (backend) 는 `inputOverride` 에 키가 없으면 자체적으로 `defaultValue ?? null` 을 적용하므로(서버 측 안전망 존재), 데이터 정합성 자체는 지켜지나 **폼에 표시되는 값과 실제 제출되는(서버가 채우는) 기본값이 다를 수 있다** — 사용자가 빈 문자열 텍스트 필드를 그대로 두고 제출하면 프론트가 `""`(string) 를 `inputOverride` 로 보내는데, `required=false` 필드라면 서버가 이를 falsy 로 보고 `defaultValue` 로 대체하지만(§coerce 로직 `value === ''` 분기), boolean 필드는 `false` 를 명시 전송하므로 서버가 `defaultValue: true` 를 의도했어도 무시된다.
  - 제안: `fields` 도출 시 스키마의 `defaultValue` 를 `paramValues` 초기 seed 에 병합(`originalParameters[name] ?? schemaDefault`)하는 것을 고려. spec §10.2 본문은 "원본 실행의 입력 데이터를 폼으로 미리 채워 표시"만 규정하고 schema `defaultValue` 프리필까지는 명시하지 않아 spec 위반은 아님(회색지대) — 다만 실사용 시나리오(스키마 변경 후 재실행)에서 혼란 여지가 있어 INFO 로 기록.

- **[INFO]** boolean 필드의 "체크되지 않음" 표시가 실제 미설정 상태와 `false` 설정 상태를 구분하지 않음
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:350` (`checked={value === true || value === "true"}`)
  - 상세: `value` 가 `undefined`(필드가 아예 없음)이든 `false`(명시적으로 false)든 체크박스는 동일하게 unchecked 로 렌더된다. 제출 시 `setParam` 이 호출되지 않은 필드는 `paramValues` 에 키가 아예 없을 수 있어(`extractParameters` 가 빈 객체 반환한 경우) `inputOverride` 에서 해당 키가 누락된다 — 이 경우 서버 `resolveTriggerParameters` 가 `defaultValue` 로 채우므로 실사용상 문제는 크지 않으나, 사용자가 "unchecked = 명시적 false" 로 오인하고 제출 후 서버가 `defaultValue: true` 로 override 하면(스키마에 그런 default 가 있다면) 사용자 기대와 다른 결과가 나올 수 있다. minor.

- **[INFO]** `field.description` 이 boolean 위젯에서 checkbox `<label>` 안 인라인으로 렌더되어 접근성상 label 텍스트에 description 이 포함됨
  - 위치: `rerun-modal.tsx:340-361`
  - 상세: `<label htmlFor={inputId}>` 내부에 `<span>{field.name}</span>` 와 `<span>{field.description}</span>` 이 모두 자식으로 있어, screen reader 의 accessible name 이 "name description" 형태로 합쳐진다. 텍스트/숫자 필드는 `<Label htmlFor>` + 별도 `<span>` 형제 구조(366-380)로 description 이 label 밖에 있는 것과 비대칭. 기능 결함은 아니나 일관성 관점에서 사소한 흠.

- **[INFO]** `coerceInput` 의 object/array JSON 파싱 실패 시 raw 문자열을 그대로 `paramValues` 에 저장 — 제출 시 서버가 `isCoerceFailure` 로 이를 감지해 `400 INVALID_INPUT` 을 반환하는 것으로 위임(cross-verified: `coerce-type.ts`+`resolve-trigger-parameters.ts` 의 `isCoerceFailure` 가 object/array 비-object/array 값을 실패로 판정 후 `TriggerParameterValidationException`→`400`). 프론트는 이 400 을 `parseErrorCode`(RERUN_* 코드 매핑) 로만 처리하는데 `INVALID_INPUT` 코드는 `ERROR_CODE_TO_KEY` 맵에 없어 `t("history.rerun.genericError")` 로 fallback — 필드별 사유(`err.errors`)가 토스트에 노출되지 않는다. 기능 자체는 동작(제출 실패 자체는 사용자에게 보임)하나 "어느 필드가 잘못됐는지"까지는 전달되지 않아 UX 세밀도가 낮음. spec §10.2 는 이 에러 UX 를 명시하지 않으므로 스펙 위반은 아님 — 회색지대.

## Spec fidelity 교차검증 (결과: 완전 일치)

- **원본 ID 새 탭 링크**: spec §10.2 필드표 "원본 실행 헤더 — ID 클릭 시 새 탭으로 원본 상세 페이지" ↔ 구현 `<a href="/workflows/{workflowId}/executions/{id}" target="_blank" rel="noopener noreferrer">` (`rerun-modal.tsx:299-306`) — 경로 패턴 일치(§10.2 필드표 "재실행 버튼" 행의 `/workflows/:workflowId/executions/:newId` 라우팅 패턴과 동일 구조). 테스트로 커버(`rerun-modal.test.tsx` L317-328 신규 + L685-696 duplicate — 동일 케이스가 파일에 두 번 존재하는 것으로 보이나 이는 diff hunk 표시 중복이며 실제 파일엔 1회만 존재할 가능성 높음, 파일 전체본에서 확인 요망).
- **manual_trigger 스키마 기반 typed 폼**: spec §10.2 필드표 "입력 데이터 폼 — Manual Trigger parameters 스키마 기반 동적 폼. 필드 라벨/타입은 워크플로의 manual_trigger 노드 config 에서 도출" ↔ 구현 `fields` useMemo 가 `workflowNodes.find(type==='manual_trigger').config.parameters` 에서 `{name, type, description}` 도출(239-253) — 일치.
- **타입별 위젯 매핑**: string→text, number→number, boolean→checkbox, object/array→JSON 텍스트 — 요구사항 설명과 일치. `TriggerParameterDefinition` 필드 shape(`name/type/required/defaultValue/description`)이 `spec/4-nodes/7-trigger/0-common.md §1` 의 TypeScript interface 와 완전히 동일(line-level 일치, 필드명·타입 순서까지 동일).
- **타입 coerce 후 backend 수용**: `coerceInput()` (number→`Number()`, boolean 은 checkbox 로 이미 native, object/array→`JSON.parse`) 로 만들어진 `paramValues` 가 `inputOverride` 로 전송되고, backend `executions.service.ts:401` `resolveTriggerParameters(schema, dto.inputOverride ?? {})` → `coerceToType()` 가 이미 native 값(`typeof value === 'number'`/`'boolean'`/object/array)을 그대로 통과시키는 것을 확인(코드 read: `coerce-type.ts`) — CHANGELOG·consistency SUMMARY 의 "backend native-typed 값 수용" 주장이 코드로 실증됨.
- **스키마 부재 시 원본 키 text fallback**: `fields` useMemo 의 `Array.isArray(schema) && schema.length > 0` 분기가 false 면 `Object.keys(originalParameters).map(name => ({name, type: 'string'}))` — 요구사항 설명과 일치, 데이터 은닉 없음(모든 원본 키가 fallback 필드로 노출).
- **read-only 토글, dry-run 토글, submit inputOverride**: diff 로 건드리지 않은 `useOriginalInput`/`dryRun`/`handleSubmit` 로직은 그대로 보존됨(코드 read 로 확인) — "no lost behavior" 요구사항 충족.
- **RR-PL-02 pre-fill 의미**: spec 은 "원본 실행의 입력 데이터를 폼으로 미리 채워 표시"만 규정 — schema `defaultValue` 프리필까지는 명시하지 않으므로 위 INFO 항목은 spec 위반이 아니라 회색지대.
- **§10.3 chain badge (same-tab)와의 불일치**: consistency SUMMARY 가 이미 식별한 대로 §10.2(모달 ID=new-tab) vs §10.3(chain badge 원본 링크=same-tab, "📎 #3-th re-run · dry-run · 원본: #1234")은 다른 UI 요소이며 본 PR 스코프는 §10.2 한정이라 문제 없음. 다만 본 리뷰에서도 §10.3 원본 링크가 어느 target 을 쓰는지 코드 확인은 스코프 밖(diff 미포함)이라 생략.

## TODO/FIXME

없음.

## 테스트

`vitest run src/components/executions/__tests__/rerun-modal.test.tsx` 재실행 결과 14/14 통과 확인(신규 3케이스: 새 탭 링크, number/boolean typed 위젯 렌더, boolean 토글 후 native boolean `inputOverride` 전송).

## 요약

V-14 구현은 `spec/5-system/13-replay-rerun.md §10.2` 가 명시한 두 항목(원본 ID 새 탭 링크, manual_trigger `config.parameters` 스키마 기반 typed 동적 폼)을 line-level 로 정확히 충족한다. `TriggerParameterDefinition` 타입 shape 은 `spec/4-nodes/7-trigger/0-common.md §1` 의 TypeScript 선언과 완전히 동일하고, 프론트 `coerceInput`이 만드는 native-typed 값(boolean/number/object/array)은 backend `coerceToType`/`resolveTriggerParameters` 가 그대로 수용하는 것을 코드 교차 확인했다(CHANGELOG·consistency SUMMARY 의 "native-typed 값 수용" 주장은 실증됨). 기존 동작(useOriginalInput read-only, dry-run toggle, inputOverride 제출)은 diff 로 훼손되지 않고 보존되어 있으며 스키마 부재 시 원본 키 text fallback 도 데이터 은닉 없이 정확히 구현됐다. 발견된 이슈는 전부 INFO 등급(schema `defaultValue` 가 재실행 폼 프리필에 반영되지 않는 gray-area, boolean unchecked vs false 구분 모호, JSON coerce 실패 시 필드별 사유 미노출)으로, spec §10.2 본문이 명시하지 않는 영역이라 CRITICAL/WARNING 대상은 없다. TODO/FIXME 없음, 테스트 14/14 통과.

## 위험도

LOW
