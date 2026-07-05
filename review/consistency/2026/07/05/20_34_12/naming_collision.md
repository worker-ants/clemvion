# 신규 식별자 충돌 검토 — trigger-param 타입 통합

- target: `git diff origin/main...HEAD` (worktree `trigger-param-type-consolidate-79b10c`)
- 변경 요지: `codebase/frontend/src/lib/api/triggers.ts` 에 canonical `TriggerParameterDefinition` + `TriggerParameterType` 신설. 기존 로컬 중복 `TriggerParameter`(`trigger-configs.tsx`) 및 로컬 `TriggerParameterDefinition`/`ParamType`(`rerun-modal.tsx`)을 제거하고 canonical import 로 교체.

## 발견사항

검토 결과 충돌 없음. 확인한 세부 내역은 아래와 같다.

### 1. 신규 이름 자체의 사전 사용 여부

- `TriggerParameterDefinition` — 변경 전 frontend 에는 `rerun-modal.tsx` 로컬 정의(동일 shape) 1곳에만 존재했고, 이번 diff 로 제거되었다. 잔존 참조 없음(`grep -rn "\bTriggerParameter\b"` 결과 0건).
- `TriggerParameterType` — 변경 전 frontend 어디에도 존재하지 않던 완전 신규 이름. `rerun-modal.tsx` 의 구 로컬 이름은 `ParamType`(별도 이름)이었고 이번 diff 로 제거되었다. `ParamType` 잔존 참조도 0건.
- 따라서 "동일 식별자가 다른 의미로 이미 사용 중"인 CRITICAL 케이스는 없음.

### 2. Backend 이름 정합

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` 에 이미 동일 이름의 `TriggerParameterDefinition` interface 가 존재(`{ name, type: CoercibleType, required?, defaultValue?, description? }`).
- Backend `CoercibleType`(`utils/coerce-type.ts`) = `'string' | 'number' | 'boolean' | 'object' | 'array'` — 프런트 신규 `TriggerParameterType` 의 union 과 리터럴까지 완전히 동일.
- 프런트 신규 타입은 이름·shape·의미 모두 backend 와 정합되며, backend 에는 `TriggerParameterType` 이라는 별도 명칭이 없어(문자열 union 은 `CoercibleType` 이름으로 존재) 프런트에서 새로 이 이름을 붙였다는 차이만 있다 — 의미 충돌이 아니라 프런트측 편의 명명이며 문제 없음.
- `trigger-parameter.types.ts` 에는 이 외에도 `TriggerParameterValidationError`, `TriggerParameterErrorDetail`, `TriggerParameterValidationException` 이 있으나 이번 프런트 diff 는 이 이름들을 사용하지 않아 충돌 대상이 아니다.

### 3. Spec 정합

- `spec/4-nodes/7-trigger/0-common.md` §"TriggerParameterDefinition 스키마"(라인 40-50)의 `interface TriggerParameterDefinition { name; type: 'string'|'number'|'boolean'|'object'|'array'; required?; defaultValue?; description?; }` 와 신규 프런트 타입이 필드 단위로 완전히 일치.
- `spec/4-nodes/7-trigger/1-manual-trigger.md` 도 동일 이름을 `config.parameters` 스키마 타입으로 참조 — 신규 canonical 정의가 spec 상의 기존 계약을 그대로 반영한 것이며 새로운 의미를 도입하지 않음.

### 4. 인접 유사 이름과의 혼동 가능성 점검 (WARNING 후보 없음)

- frontend `lib/types/trigger.ts` 의 `TriggerType`(`"webhook" | "schedule" | "manual"`, 트리거 **종류**)과 신규 `TriggerParameterType`(파라미터 **값 타입**, `"string"|"number"|...`)은 이름이 유사(`Trigger*Type`)하지만 각각 정의 위치·문서화 JSDoc 이 명확하고 기존에도 공존해온 명명 패턴이라 실질적 혼동 사례는 확인되지 않음(INFO 수준 관찰에 그침, 별도 조치 불요).
- `lib/api/triggers.ts` 내 기존 `TriggerDetail`, `TriggerListItem`, `TriggerListParams`, `TriggerUpdateBody` 등과도 이름이 겹치지 않음.

### 5. 파일 경로

- 신규 export 위치가 기존 파일 `codebase/frontend/src/lib/api/triggers.ts`(trigger 도메인 API 타입의 canonical 홈) 내부이며 새 파일을 만들지 않았다. 명명 컨벤션 위반이나 경로 충돌 없음.

## 요약

이번 diff 는 순수 리팩터(동작 무변경, 타입 통합)로, 신규로 도입된 `TriggerParameterDefinition`/`TriggerParameterType` 은 (a) 기존 frontend 사용처와는 제거된 로컬 중복을 대체하는 것이어서 충돌이 아니고, (b) backend `trigger-parameter.types.ts`/`coerce-type.ts` 및 spec `0-common.md §1`·`1-manual-trigger.md` 의 기존 정의와 이름·shape·의미가 완전히 정합한다. CRITICAL/WARNING 등급에 해당하는 신규 식별자 충돌은 발견되지 않았다.

## 위험도

NONE
