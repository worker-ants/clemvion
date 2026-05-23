# 부작용(Side Effect) 리뷰 — render-form-options-and-state-fix

## 발견사항

### [INFO] backfillFormOptionValues — 새 exported 함수 도입
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` (신설 함수 전체)
- 상세: `backfillFormOptionValues` 가 `export` 로 공개되었다. 같은 파일의 `backfillButtonUuids` / `overlayDefaults` / `renderToolName` 과 동일 패턴이므로 의도된 API 확장이다. 스펙 파일 1 (spec.ts) 의 import 목록에 이미 추가되었으므로 테스트에서 호출 가능하다.
- 제안: 문제 없음. 다만 이 함수가 `render-tool-provider` 모듈 밖에서도 임포트될 수 있다는 점은 인지할 것.

### [INFO] renderField 시그니처 변경 — idx 매개변수 추가
- 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `renderField` 함수
- 상세: `renderField(field, value, onChange)` → `renderField(field, idx, value, onChange)` 로 두 번째 매개변수가 추가되었다. 이 함수는 파일 내부(비공개) 함수이므로 외부 호출자에게는 영향 없다. 파일 내 유일 호출처 (`DynamicFormUI` 컴포넌트 내부)도 동시에 갱신되었다.
- 제안: 문제 없음.

### [INFO] FormField 인터페이스 변경 — options value 타입 확장 및 신규 필드 추가
- 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `FormField` 인터페이스
- 상세: `options?: Array<{ label: string; value: string }>` → `options?: Array<{ label: string; value: unknown }>` 로 value 타입이 확장되었다. `allowedMimeTypes?: string[]` / `maxFiles?: number` 필드도 추가되었다. 이 인터페이스는 파일 내부에만 선언되며 외부로 export 되지 않으므로 공개 API 파괴 없음. 단, 만약 다른 파일에서 이 인터페이스와 동일한 타입 형식의 데이터를 직접 구성해 DynamicFormUI 에 넘기는 경우, `value: string` 이었던 기존 타입 추론이 `value: unknown` 으로 넓어지는 방향이므로 기존 코드 파괴 없음.
- 제안: 문제 없음.

### [WARNING] DynamicFormUI — key prop 도입으로 인한 의도적 remount 부작용
- 위치: `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` 라인 452 / `codebase/frontend/src/components/editor/run-results/result-detail.tsx` 라인 1682
- 상세: `<DynamicFormUI key={waitingNodeId ?? "form"} ... />` 와 `<DynamicFormUI key={result.nodeId} ... />` 가 각각 추가되었다. React 에서 `key` 변경은 컴포넌트를 완전히 unmount 후 remount 시킨다. 이는 의도된 동작(다른 노드의 새 폼이 waiting 상태로 전환될 때 이전 입력값 초기화)이나, 다음 부작용을 수반한다:
  1. `key` 가 `waitingNodeId ?? "form"` 일 때 `waitingNodeId` 가 `null`/`undefined` 이면 항상 `"form"` — 여러 다른 노드가 순차적으로 waiting 상태가 되어도 `waitingNodeId` 가 `null` 이면 key 가 동일하게 유지되어 이전 입력값이 잔류할 수 있다.
  2. `result-detail.tsx` 에서 `key={result.nodeId}` — `result.nodeId` 가 같은 노드라도 사용자가 재사용 form 을 의도하는 경우 입력값이 보존된다. 이는 의도된 설계이나, 동일 노드가 연속으로 waiting 상태가 되는 시나리오(루프 구조)에서 이전 값이 계속 남는 문제가 있다.
- 제안: 두 위치 모두 key 선택 로직과 "어느 시점에 입력 초기화가 의도된 것인지"를 spec 또는 주석으로 명확히 기록할 것. `waitingNodeId ?? "form"` fallback 의 의미를 검토할 것.

### [INFO] number 필드 onChange 동작 변경 — 빈 문자열 처리
- 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — number case onChange
- 상세: `onChange(Number(e.target.value))` → `onChange(v === "" ? "" : Number(v))` 로 변경. 이전에 빈 문자열 입력 시 `Number("")` 인 `0` 이 state 에 저장되던 것이 이제 빈 문자열 `""` 로 저장된다. `onSubmit` 콜백이 받는 데이터 형식이 변경되므로 onSubmit 핸들러가 number 필드를 항상 `number` 타입으로 가정하던 외부 소비자에게 의도치 않은 영향을 줄 수 있다.
- 제안: `onSubmit` 데이터를 소비하는 쪽(WebSocket `submit_form` payload, LLM 회신 처리)에서 `""` 를 받을 때의 처리를 확인할 것. 현재 `formData` 는 `Record<fieldName, value>` free-form 이므로 schema 파괴는 없다.

### [INFO] radio onChange — value 타입 보존
- 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — radio case
- 상세: `checked` 비교는 `String(value ?? "") === String(opt.value ?? "")` 로 정규화되었으나, `onChange(() => onChange(opt.value))` 는 **원래 opt.value 타입** (number / boolean 등)을 그대로 state 에 저장한다. 따라서 submit 데이터의 radio 필드 값은 opt.value 의 원래 타입으로 보존된다. select 는 `onChange(e.target.value)` — DOM이 항상 string 으로 반환하므로 string 으로 저장. 두 필드 간 타입 일관성 없음.
- 제안: 의도적 설계라면(radio 는 원래 타입 보존, select 는 string 강제) 주석으로 명시. LLM 이 submit value 를 받는 시 두 필드를 동일하게 처리하는지 확인할 것.

### [INFO] file 필드 초기값 — 빈 배열 도입
- 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `initialValueFor` 함수
- 상세: `file` 타입 필드의 초기 state 가 `""` 에서 `[]` 로 변경되었다. 이전에 file 타입이 기본 case 로 처리되어 `""` 이 초기값이었다면, 이제 `[]` 로 저장된다. 단, file case 가 이전에는 switch 에 없었으므로 사실상 text input으로 렌더되었고 실제 폼 제출이 일어나지 않았을 가능성이 높다. 실질적 외부 부작용은 없다.
- 제안: 문제 없음.

### [INFO] backfillFormOptionValues — 입력 객체 변이 없음 확인
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` — `backfillFormOptionValues` 구현
- 상세: 함수 내부에서 `{ ...o, value: ... }` / `{ ...f, options: newOptions }` / `{ ...payload, fields: newFields }` 의 spread 로 새 객체를 생성한다. 입력 `payload` 원본은 변이(mutation)되지 않는다. `anyChanged` / `optsChanged` 플래그로 변경이 없으면 원본 참조를 그대로 반환한다. 테스트에서도 "원본 참조 동일성" 케이스를 명시적으로 검증한다.
- 제안: 문제 없음. Side-effect-free 설계가 명확히 이행되었다.

### [INFO] backfillFormOptionValues 호출 체인 — 함수 합성 순서
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` 라인 419-422
- 상세: `backfillFormOptionValues(type, backfillButtonUuids(type, capped.payload))` 로 호출된다. `backfillButtonUuids` 가 `form` 타입에서 early-return 하므로 form 페이로드에 대해 두 함수를 합성해도 `backfillButtonUuids` 의 효과는 없다. 반대로 비-form 타입에 대해 `backfillFormOptionValues` 가 early-return 한다. 두 함수 모두 타입-가드 early-return 으로 교환 가능하다는 주석이 있으며 실제로도 그렇다.
- 제안: 문제 없음. 다만 향후 타입이 양쪽 함수에 모두 해당되는 경우가 생기면 순서 민감도가 생길 수 있다. 현재는 form과 비-form으로 상호 배타적이다.

### [INFO] review 산출물 파일 — 절대 경로 하드코딩
- 위치: `review/consistency/2026/05/23/14_58_44/_retry_state.json` / `meta.json`
- 상세: `_retry_state.json` 파일 내 `session_dir`, `prompt_file`, `output_file` 등 필드에 `/Volumes/project/private/clemvion/...` 로 시작하는 절대 경로가 하드코딩되어 있다. 이 파일은 review 산출물로 이미 완료된 consistency check 의 상태 스냅샷이므로, 다른 환경에서 재실행 시 경로가 맞지 않을 수 있다. 그러나 이 파일 자체는 실행 아티팩트이지 설정 파일이 아니므로 실제 부작용 위험은 낮다.
- 제안: review 산출물은 이미 완료 상태이므로 실용적 위험 없음. 다만 이 파일들이 repo 에 커밋되면 다른 개발자 환경에서 경로 혼란이 생길 수 있다.

## 요약

이번 변경의 핵심은 backend의 `backfillFormOptionValues` 함수 신설 + frontend의 폼 상태 안정화 (`key` prop)이다. backend 함수는 입력 객체를 변이하지 않는 순수 함수로 구현되어 있으며, 공개 API 파괴 없이 새 함수가 추가되었다. frontend에서는 `renderField` 의 시그니처 변경이 있으나 비공개 함수로 외부 영향 없음. 실질적으로 주목할 부작용은 두 가지다: 첫째, `key` prop 도입으로 인한 의도적 remount 정책에서 `waitingNodeId` 가 `null` 일 때 key 가 `"form"` 으로 고정되어 서로 다른 노드 간 폼 전환 시에도 입력이 잔류하는 엣지케이스; 둘째, number 필드 submit 값이 number → string/number 혼합 타입으로 변경되어 소비 측에서 빈 문자열 처리가 필요해진 점. review 산출물 파일에는 절대 경로 하드코딩이 있으나 실행 아티팩트이므로 운영 영향 없다.

## 위험도

LOW
