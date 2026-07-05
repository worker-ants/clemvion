# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** `TriggerParameter` 공개 export 제거 (trigger-configs.tsx) — 소비처 0건 확인
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:40-46` (제거된 블록)
  - 상세: 로컬에서 `export type TriggerParameter = {...}` 로 선언·재노출되던 타입이 제거되고, 동일 파일 내부 사용처는 전부 `@/lib/api/triggers` 의 `TriggerParameterDefinition` 으로 치환됨. 저장소 전체(`codebase/frontend/src`)에서 `TriggerParameter` 단독 식별자(즉 `TriggerParameterDefinition`/`TriggerParameterType` 이 아닌 형태)를 참조하는 곳을 grep 했으나 매치 0건 — 이 파일을 import 하는 다른 컴포넌트/테스트도 없음(`from ".../trigger-configs"` 참조 검색 결과 없음). 따라서 이번 제거로 깨지는 외부 소비처는 없음.
  - 제안: 없음(확인 완료, 안전).

- **[INFO]** `rerun-modal.tsx` 로컬 `ParamType`/`TriggerParameterDefinition` 제거 후 공용 타입으로 치환
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:107-131` (diff), `RerunField.type`, `displayValue`, `coerceInput` 시그니처
  - 상세: 순수 이름 교체(`ParamType`→`TriggerParameterType`, 로컬 `interface TriggerParameterDefinition`→import) 이며 필드 구성(`name: string; type: ParamType; required?: boolean; defaultValue?: unknown; description?: string;`)이 `lib/api/triggers.ts` 신설 타입과 구조적으로 동일. `displayValue`/`coerceInput`/`RerunField.type` 은 모두 이 파일 내부(private) 함수·타입이라 외부 호출자에 영향 없음. 런타임 로직(문자열 리터럴 유니온 `"string"|"number"|"boolean"|"object"|"array"`, JSON.parse 등)은 변경되지 않음.
  - 제안: 없음.

- **[INFO]** `lib/api/triggers.ts` 신규 export 추가 — 순수 타입, 런타임 부작용 없음
  - 위치: `codebase/frontend/src/lib/api/triggers.ts:749-762`
  - 상세: `export type TriggerParameterType` / `export interface TriggerParameterDefinition` 은 컴파일 타임에만 존재하는 타입 선언으로 런타임 바이트코드에 영향 없음(전역 상태·부수효과 없음). 이 모듈은 이미 `apiClient` 기반 함수(트리거 CRUD 등)를 export 하는 파일이지만, 이번 변경분은 그 함수들의 시그니처·동작에는 손대지 않음(diff 범위가 타입 선언 삽입뿐).
  - 제안: 없음.

- **[INFO]** 함수 시그니처 변경 범위 확인
  - 위치: `trigger-configs.tsx` — `updateParameter(i, key: keyof TriggerParameter, val)` → `keyof TriggerParameterDefinition`; `rerun-modal.tsx` — `displayValue`/`coerceInput` 파라미터 타입
  - 상세: 두 타입이 구조적으로 동일(nominal 차이만 있고 shape 일치)하므로 `keyof` 결과 유니온도 동일(`"name"|"type"|"required"|"defaultValue"|"description"`). 모두 파일-로컬(비-export 또는 호출자가 같은 파일 내부) 함수라 외부 시그니처 계약 변경 아님.
  - 제안: 없음.

## 요약

이번 변경은 두 파일에 중복 선언되어 있던 트리거 파라미터 스키마 타입(`ParamType`/로컬 `TriggerParameterDefinition`, `trigger-configs.tsx` 의 `export type TriggerParameter`)을 `lib/api/triggers.ts` 의 단일 canonical 타입(`TriggerParameterType`, `TriggerParameterDefinition`)으로 통합하는 순수 타입 리팩터다. 전역 상태·파일시스템·환경변수·네트워크 호출·이벤트/콜백 어느 것도 건드리지 않으며, 런타임 로직(문자열 리터럴 비교, JSON 처리 등)도 그대로 보존된다. 유일하게 실제 확인이 필요했던 부분은 `trigger-configs.tsx` 에서 제거된 `export type TriggerParameter` 의 외부 소비 여부였는데, 저장소 전체 grep 결과 이 이름을 참조하는 다른 소스/테스트 파일이 없어(파일을 import 하는 곳 자체가 없음) 공개 API 제거로 인한 영향은 없다고 판단된다. 제거된 타입과 신설 타입의 shape(필드명·옵셔널 여부·유니온 멤버)도 diff상 완전히 일치해 타입 레벨에서도 회귀 위험이 없다.

## 위험도

NONE
